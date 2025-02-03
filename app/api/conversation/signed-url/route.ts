import { elevenLabs } from "@/utils/elevenlabs";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const signedUrlRequest = await elevenLabs.conversationalAi.getSignedUrl(
            {
                agent_id: process.env.NEXT_PUBLIC_AGENT_ID!,
            },
        );

        return NextResponse.json({ signedUrl: signedUrlRequest.signed_url });
    } catch (error) {
        return NextResponse.json(
            { error: "Failed to generate signed URL" },
            { status: 500 },
        );
    }
}
