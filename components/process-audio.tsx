"use client";

import { useEffect, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { createClient } from "@/utils/supabase/client";

interface ProcessAudioProps {
  conversationId: string;
  elevenLabsId: string;
}

export function ProcessAudio({
  conversationId,
  elevenLabsId,
}: ProcessAudioProps) {
  const [status, setStatus] = useState<
    "idle" | "downloading" | "processing" | "uploading" | "done" | "error"
  >("idle");
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
        setStatus("downloading");

        // Download conversation data from our API
        const conversationResponse = await fetch(
          `/api/conversation/${conversationId}/transcript`
        );

        if (!conversationResponse.ok) {
          throw new Error("Failed to fetch conversation data");
        }

        const conversationData = await conversationResponse.json();

        // Download audio file from our API
        const audioResponse = await fetch(
          `/api/conversation/${conversationId}/audio`
        );

        if (!audioResponse.ok) {
          throw new Error("Failed to fetch audio");
        }

        const audioBlob = await audioResponse.blob();

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

        // Initialize FFmpeg
        const ffmpeg = new FFmpeg();
        const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd";
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

        // Write input file
        await ffmpeg.writeFile("input.mp3", await fetchFile(audioBlob));

        // Process each segment
        const segments = [];
        for (let i = 0; i < userSegments.length; i++) {
          const { startTime, duration } = userSegments[i];
          const outputName = `segment_${i}.mp3`;

          // Add a small buffer to avoid cutting off speech
          const bufferStart = Math.max(0, startTime - 0.1);
          const bufferDuration = duration + 0.2;

          await ffmpeg.exec([
            "-i",
            "input.mp3",
            "-ss",
            bufferStart.toString(),
            "-t",
            bufferDuration.toString(),
            "-c:a",
            "libmp3lame",
            "-q:a",
            "2",
            outputName,
          ]);

          segments.push(outputName);
        }

        // Create concat file
        const concatContent = segments.map((s) => `file '${s}'`).join("\n");
        await ffmpeg.writeFile(
          "concat.txt",
          new TextEncoder().encode(concatContent)
        );

        // Concatenate segments
        await ffmpeg.exec([
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "concat.txt",
          "-c",
          "copy",
          "output.mp3",
        ]);

        // Read output
        const userAudioData = await ffmpeg.readFile("output.mp3");
        if (!(userAudioData instanceof Uint8Array)) {
          throw new Error("Unexpected output format from FFmpeg");
        }

        // Convert Uint8Array to Blob for upload
        const userAudioBlob = new Blob([userAudioData], { type: "audio/mpeg" });

        // Clean up files
        await Promise.all([
          ffmpeg.deleteFile("input.mp3"),
          ffmpeg.deleteFile("concat.txt"),
          ffmpeg.deleteFile("output.mp3"),
          ...segments.map((file) => ffmpeg.deleteFile(file)),
        ]);

        setStatus("uploading");

        // Upload both audio files to Supabase Storage
        const originalAudioPath = `conversations/${conversationId}/original.mp3`;
        const userAudioPath = `conversations/${conversationId}/user.mp3`;

        const [{ error: originalUploadError }, { error: userUploadError }] =
          await Promise.all([
            supabase.storage
              .from("conversations")
              .upload(originalAudioPath, audioBlob, {
                contentType: "audio/mpeg",
                upsert: true,
              }),
            supabase.storage
              .from("conversations")
              .upload(userAudioPath, userAudioBlob, {
                contentType: "audio/mpeg",
                upsert: true,
              }),
          ]);

        if (originalUploadError || userUploadError) {
          console.error("Upload errors:", {
            originalUploadError,
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
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full animate-pulse bg-blue-500" />
        <div>
          {status === "downloading" && "Downloading audio..."}
          {status === "processing" && "Processing audio..."}
          {status === "uploading" && "Uploading processed audio..."}
          {status === "done" && "Audio processing complete!"}
        </div>
      </div>

      {status === "done" && (
        <button
          onClick={handleDownload}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
        >
          Download User Audio
        </button>
      )}
    </div>
  );
}
