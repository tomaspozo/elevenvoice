import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createFFmpeg } from 'npm:@ffmpeg/ffmpeg@0.12.7';

import { supabase } from "../_shared/supabase.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

interface Conversation {
    id: string;
    elevenlabs_id: string;
    // Add other fields as needed
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseClient = supabase(authHeader);
        const { conversationId } = await req.json();
        if (!conversationId) {
            throw new Error("conversationId is required");
        }

        console.log("conversationId", conversationId);

        // Fetch conversation from database
        const { data: conversation, error: fetchError } = await supabaseClient
            .from("conversations")
            .select("*")
            .eq("id", conversationId)
            .single();

        if (fetchError || !conversation) {
            console.error(fetchError);
            throw new Error("Conversation not found");
        }

        // Download audio and history from ElevenLabs
        const elevenLabsResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${conversation.elevenlabs_id}`,
            {
                headers: {
                    "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY") ?? "",
                },
            },
        );

        if (!elevenLabsResponse.ok) {
            throw new Error("Failed to fetch from ElevenLabs");
        }

        const historyData = await elevenLabsResponse.json();

        // Download the audio file
        const audioResponse = await fetch(
            `https://api.elevenlabs.io/v1/convai/conversations/${conversation.elevenlabs_id}/audio`,
            {
                headers: {
                    "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY") ?? "",
                },
            },
        );

        if (!audioResponse.ok) {
            throw new Error("Failed to fetch audio from ElevenLabs");
        }

        const audioBlob = await audioResponse.blob();
        const audioBuffer = await audioBlob.arrayBuffer();

        // Extract user messages and timestamps
        const userMessages = historyData.transcript
            .filter((msg: { role: string; message: string }) => msg.role === "user")
            .map((msg: { message: string }) => msg.message);
        const userText = userMessages.join("\n");

        // Extract user segments timestamps
        const userSegments = historyData.transcript
            .filter((msg: { role: string }) => msg.role === "user")
            .map((msg: { time_in_call_secs: number }, index: number, array: any[]) => {
                const startTime = msg.time_in_call_secs;
                const nextMsg = array[index + 1];
                const duration = nextMsg 
                    ? nextMsg.time_in_call_secs - startTime 
                    : 10;
                return { startTime, duration };
            });

        // Initialize FFmpeg
        const ffmpeg = createFFmpeg({ 
            log: true,
            corePath: 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js'
        });
        await ffmpeg.load();

        // Write the input file to FFmpeg's virtual filesystem
        ffmpeg.FS('writeFile', 'input.mp3', new Uint8Array(audioBuffer));

        // Process each user segment and concatenate
        const segments = [];
        for (let i = 0; i < userSegments.length; i++) {
            const { startTime, duration } = userSegments[i];
            const outputName = `segment_${i}.mp3`;
            
            // Extract segment
            await ffmpeg.run(
                '-i', 'input.mp3',
                '-ss', startTime.toString(),
                '-t', duration.toString(),
                '-c:a', 'libmp3lame',
                outputName
            );
            
            segments.push(outputName);
        }

        // Create concat file
        const concatContent = segments.map(s => `file '${s}'`).join('\n');
        ffmpeg.FS('writeFile', 'concat.txt', new TextEncoder().encode(concatContent));

        // Concatenate all segments
        await ffmpeg.run(
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat.txt',
            '-c', 'copy',
            'output.mp3'
        );

        // Read the final output
        const userAudioData = ffmpeg.FS('readFile', 'output.mp3');

        // Clean up FFmpeg filesystem
        ['input.mp3', 'concat.txt', 'output.mp3', ...segments].forEach(file => {
            try {
                ffmpeg.FS('unlink', file);
            } catch (e) {
                console.error(`Error cleaning up ${file}:`, e);
            }
        });

        // Upload both original and processed audio
        const originalAudioPath = `conversations/${conversationId}/original.mp3`;
        const userAudioPath = `conversations/${conversationId}/user.mp3`;

        const { error: originalUploadError } = await supabaseClient
            .storage
            .from("conversations")
            .upload(originalAudioPath, audioBuffer, {
                contentType: "audio/mpeg",
                upsert: true,
            });

        if (originalUploadError) {
            throw new Error("Failed to upload original audio");
        }

        const { error: userUploadError } = await supabaseClient
            .storage
            .from("conversations")
            .upload(userAudioPath, userAudioData, {
                contentType: "audio/mpeg",
                upsert: true,
            });

        if (userUploadError) {
            throw new Error("Failed to upload user audio");
        }

        // Store the timestamps in the conversations table
        const { error: updateError } = await supabaseClient
            .from("conversations")
            .update({
                user_segments: userSegments,
                processed_at: new Date().toISOString()
            })
            .eq("id", conversationId);

        if (updateError) {
            throw new Error("Failed to update conversation with segments");
        }

        return new Response(
            JSON.stringify({
                message: "Audio processed successfully",
                originalAudioPath,
                userAudioPath,
                userSegments,
                userTranscription: userText,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            },
        );
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            },
        );
    }
});
