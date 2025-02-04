import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Get conversation
    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Get transcript from ElevenLabs
    const transcriptResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversation.elevenlabs_id}`,
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
      }
    );

    if (!transcriptResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch transcript from ElevenLabs" },
        { status: transcriptResponse.status }
      );
    }

    const transcriptData = await transcriptResponse.json();
    return NextResponse.json(transcriptData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
