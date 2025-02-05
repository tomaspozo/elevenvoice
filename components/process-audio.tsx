"use client";

import { useEffect, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { createClient } from "@/utils/supabase/client";
import { Button, buttonVariants } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import Link from "next/link";

interface ProcessAudioProps {
  conversationId: string;
  elevenLabsId: string;
}

export function ProcessAudio({
  conversationId,
  elevenLabsId,
}: ProcessAudioProps) {
  const [status, setStatus] = useState<
    "waiting" | "downloading" | "processing" | "uploading" | "done" | "error"
  >("waiting");
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const supabase = createClient();

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from("conversations")
        .createSignedUrl(`conversations/${conversationId}/user.mp3`, 60); // URL expires in 60 seconds

      if (error) throw error;

      // Create an anchor element and trigger download
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = "user_audio.mp3";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error("Error downloading audio:", e);
      setError("Failed to download audio");
    }
  };

  useEffect(() => {
    const processAudio = async () => {
      try {
        // Wait for audio to be saved
        const maxAttempts = 12; // Try for 2 minutes (12 * 10 seconds)
        let attempts = 0;

        while (attempts < maxAttempts) {
          const { data: conversation } = await supabase
            .from("conversations")
            .select("audio_saved_at")
            .eq("id", conversationId)
            .single();

          if (conversation?.audio_saved_at) {
            break;
          }

          attempts++;
          if (attempts === maxAttempts) {
            throw new Error("Timeout waiting for audio to be saved");
          }

          await new Promise((resolve) => setTimeout(resolve, 10000));
        }

        setStatus("downloading");

        // Download audio file from Supabase
        const { data: audioData, error: audioError } = await supabase.storage
          .from("conversations")
          .download(`conversations/${conversationId}/original.mp3`);

        if (audioError) {
          throw new Error("Failed to download audio from storage");
        }

        const audioBlob = audioData;

        // Download conversation data from our API
        const conversationResponse = await fetch(
          `/api/conversation/${conversationId}/transcript`
        );

        if (!conversationResponse.ok) {
          throw new Error("Failed to fetch conversation data");
        }

        const conversationData = await conversationResponse.json();

        // Extract user segments with correct timing
        const transcript = conversationData.transcript;
        const userSegments = [];

        for (let i = 0; i < transcript.length; i++) {
          const msg = transcript[i];
          if (msg.role === "user") {
            const startTime = msg.time_in_call_secs + 1;
            // Find the next non-user message to get the end time
            let endTime;
            for (let j = i + 1; j < transcript.length; j++) {
              if (transcript[j].role !== "user") {
                endTime = transcript[j].time_in_call_secs;
                break;
              }
            }
            // If no next message found, use a default duration of 5 seconds
            if (endTime === undefined) {
              endTime = startTime + 5;
            }
            userSegments.push({
              startTime,
              duration: endTime - startTime,
            });
          }
        }

        setStatus("processing");

        // Initialize FFmpeg with explicit error handling
        const ffmpeg = new FFmpeg();
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd";
        try {
          console.log("Loading FFmpeg...");
          await ffmpeg.load({
            coreURL: await toBlobURL(
              `${baseURL}/ffmpeg-core.js`,
              "text/javascript"
            ),
            wasmURL: await toBlobURL(
              `${baseURL}/ffmpeg-core.wasm`,
              "application/wasm"
            ),
          });
          console.log("FFmpeg loaded successfully");
        } catch (e: any) {
          console.error("FFmpeg load error:", e);
          throw new Error(`Failed to initialize FFmpeg: ${e.message}`);
        }

        // Write input file with explicit error handling
        try {
          console.log("Writing input file...");
          const inputData = await fetchFile(audioBlob);
          await ffmpeg.writeFile("input.mp3", inputData);
          console.log("Input file written successfully");
        } catch (e: any) {
          console.error("Write input file error:", e);
          throw new Error(`Failed to write input file: ${e.message}`);
        }

        // Process each segment with explicit error handling
        let filterComplex = "";
        let inputs = "";

        for (let i = 0; i < userSegments.length; i++) {
          const { startTime, duration } = userSegments[i];
          // Add a small buffer to avoid cutting off speech
          const bufferStart = Math.max(0, startTime - 0.1);
          const bufferDuration = duration + 0.2;

          // Build filter complex string
          filterComplex += `[0:a]atrim=start=${bufferStart}:duration=${bufferDuration},asetpts=PTS-STARTPTS[s${i}];`;
          inputs += `[s${i}]`;
        }

        // Add concat at the end if we have segments
        if (userSegments.length > 0) {
          filterComplex += `${inputs}concat=n=${userSegments.length}:v=0:a=1[out]`;

          try {
            console.log("Processing audio segments...");
            await ffmpeg.exec([
              "-i",
              "input.mp3",
              "-filter_complex",
              filterComplex,
              "-map",
              "[out]",
              "-c:a",
              "libmp3lame",
              "-q:a",
              "2",
              "output.mp3",
            ]);
            console.log("Audio segments processed successfully");
          } catch (e: any) {
            console.error("Error processing audio segments:", e);
            throw new Error(`Failed to process audio segments: ${e.message}`);
          }
        } else {
          // If no segments, just copy the input
          await ffmpeg.exec(["-i", "input.mp3", "-c", "copy", "output.mp3"]);
        }

        // Read output
        console.log("Reading output file...");
        const userAudioData = await ffmpeg.readFile("output.mp3");
        if (!(userAudioData instanceof Uint8Array)) {
          throw new Error("Unexpected output format from FFmpeg");
        }

        // Convert Uint8Array to Blob for upload
        const userAudioBlob = new Blob([userAudioData], { type: "audio/mpeg" });

        // Clean up files
        await Promise.all([
          ffmpeg
            .deleteFile("input.mp3")
            .catch((e) => console.error("Error deleting input.mp3:", e)),
          ffmpeg
            .deleteFile("output.mp3")
            .catch((e) => console.error("Error deleting output.mp3:", e)),
        ]);

        setStatus("uploading");

        // Upload processed audio to Supabase Storage
        const userAudioPath = `conversations/${conversationId}/user.mp3`;

        const { error: userUploadError } = await supabase.storage
          .from("conversations")
          .upload(userAudioPath, userAudioBlob, {
            contentType: "audio/mpeg",
            upsert: true,
          });

        if (userUploadError) {
          console.error("Upload errors:", {
            userUploadError,
          });
          throw new Error("Failed to upload audio files");
        }

        // Update conversation record
        const { error: updateError } = await supabase
          .from("conversations")
          .update({
            user_segments: userSegments,
            processed_at: new Date().toISOString(),
          })
          .eq("id", conversationId);

        if (updateError) {
          throw new Error("Failed to update conversation");
        }

        setStatus("done");
      } catch (e: any) {
        console.error("Error processing audio:", e);
        setError(e.message);
        setStatus("error");
      }
    };

    processAudio();
  }, [conversationId, elevenLabsId]);

  if (error) {
    return <div className="text-red-500">Error processing audio: {error}</div>;
  }

  return (
    <div className="flex flex-col items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full animate-pulse bg-blue-500" />
        <div>
          {status === "waiting" && "Waiting for audio to be ready..."}
          {status === "downloading" && "Downloading audio..."}
          {status === "processing" && "Processing audio..."}
          {status === "uploading" && "Uploading processed audio..."}
          {status === "done" && "Audio processing complete!"}
        </div>
      </div>

      {status === "done" && (
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={handleDownload}>Download your voice sample</Button>
          <Link href="/" className={buttonVariants({ variant: "link" })}>
            Record a new audio
          </Link>
        </div>
      )}
    </div>
  );
}
