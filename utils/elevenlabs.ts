import { ElevenLabsClient } from "elevenlabs";

export const elevenLabs = new ElevenLabsClient({
    apiKey: process.env.ELEVEN_LABS_API_KEY!,
});
