import { createClient } from "@/utils/supabase/server";
import { ProcessAudio } from "@/components/process-audio";

export default async function ConversationPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !conversation) {
    return <div>Conversation not found</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="w-full max-w-2xl space-y-8">
        <h1 className="text-2xl font-bold text-center">Processing Conversation</h1>
        <ProcessAudio
          conversationId={conversation.id}
          elevenLabsId={conversation.elevenlabs_id}
        />
      </div>
    </div>
  );
}
