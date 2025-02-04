import { ElevenLabsClient } from "elevenlabs";

export const elevenLabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY!,
});
