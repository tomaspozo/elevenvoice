import { createClient } from "@/utils/supabase/server";
import { ProcessAudio } from "@/components/process-audio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !conversation) {
    return <div>Conversation not found</div>;
  }

  return (
    <div className={"flex justify-center items-center gap-x-4"}>
      <Card className={"rounded-3xl"}>
        <CardHeader>
          <CardTitle>Processing Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <ProcessAudio
            conversationId={conversation.id}
            elevenLabsId={conversation.elevenlabs_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}
