import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get conversation
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Get audio from ElevenLabs
    const audioResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation.elevenlabs_id}/audio`,
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
      },
    );

    if (!audioResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch audio from ElevenLabs" },
        { status: audioResponse.status },
      );
    }

    const audioBlob = await audioResponse.blob();

    return new NextResponse(audioBlob, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
