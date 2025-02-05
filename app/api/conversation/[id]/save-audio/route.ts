import { createClient } from "@/utils/supabase/server";

import { NextResponse } from "next/server";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAudioWithRetry(
  conversationId: string,
  retries = 3,
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}/audio`,
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
      },
    );

    if (response.ok) {
      return response;
    }

    // If not the last attempt, wait 10 seconds before retrying
    if (i < retries - 1) {
      await delay(10000);
      console.log(`Retry ${i + 1} for conversation ${conversationId}`);
    }
  }

  throw new Error("Failed to fetch audio after multiple attempts");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    // Get conversation data to verify ownership and get ElevenLabs ID
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("elevenlabs_id, user_id")
      .eq("id", id)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    // Verify user owns this conversation
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id !== conversation.user_id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    // Attempt to fetch audio with retries
    const audioResponse = await fetchAudioWithRetry(conversation.elevenlabs_id);
    const audioBlob = await audioResponse.blob();

    // Save to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("conversations")
      .upload(`conversations/${id}/original.mp3`, audioBlob, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Update conversation status
    const { error: updateError } = await supabase
      .from("conversations")
      .update({ audio_saved_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error saving audio:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }
}
