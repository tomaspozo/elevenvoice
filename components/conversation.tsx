"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Conversation } from "@11labs/client";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import { elevenLabs } from "@/utils/elevenlabs";
import { redirect } from "next/navigation";

async function requestMicrophonePermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch {
    console.error("Microphone permission denied");
    return false;
  }
}

async function getSignedUrl(): Promise<string> {
  const response = await fetch("/api/conversation/signed-url");
  if (!response.ok) {
    throw Error("Failed to get signed url");
  }
  const data = await response.json();
  return data.signedUrl;
}

export function ConvAI({ userId }: { userId: string }) {
  const supabase = createClient();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  async function startConversation() {
    console.log("Starting conversation");
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      alert("No permission");
      return;
    }

    const signedUrl = await getSignedUrl();
    console.log("signedUrl", signedUrl);

    const conversation = await Conversation.startSession({
      signedUrl: signedUrl,
      onConnect: () => {
        setIsConnected(true);
        setIsSpeaking(true);
      },
      onDisconnect: () => {
        setIsConnected(false);
        setIsSpeaking(false);
      },
      onStatusChange({ status }) {
        console.log("status", status);
        if (status === "disconnecting") setIsProcessing(true);
        if (status === "disconnected") {
          supabase
            .from("conversations")
            .insert({
              elevenlabs_id: conversation.getId(),
              user_id: userId,
            })
            .select("id")
            .then(async ({ data, error }) => {
              if (error) {
                console.error(error);
                alert("An error occurred during the conversation");
                return;
              }

              const conversationId = data[0].id;

              // Start saving the audio
              fetch(`/api/conversation/${conversationId}/save-audio`, {
                method: "POST",
              }).catch((error) => {
                console.error("Failed to initiate audio save:", error);
              });

              // Redirect to conversation page
              redirect(`/conversation/${conversationId}`);
            });
        }
      },
      onError: (error) => {
        console.error(error);
        alert("An error occurred during the conversation");
      },
      onModeChange: ({ mode }) => {
        setIsSpeaking(mode === "speaking");
      },
    });
    setConversation(conversation);
  }

  async function endConversation() {
    if (!conversation) {
      return;
    }
    await conversation.endSession();
    setConversation(null);
  }

  return (
    <div className={"flex justify-center items-center gap-x-4"}>
      <Card>
        <CardContent>
          <CardHeader>
            <CardTitle className={"text-center"}>
              {isConnected
                ? isSpeaking
                  ? `Agent is speaking`
                  : "Agent is listening"
                : "Disconnected"}
            </CardTitle>
          </CardHeader>
          <div className={"flex flex-col gap-y-4 text-center"}>
            <div
              className={cn(
                "orb my-10 mx-12",
                isSpeaking ? "animate-orb" : conversation && "animate-orb-slow",
                isConnected ? "orb-active" : "orb-inactive"
              )}
            ></div>

            <Button
              variant={"outline"}
              size={"lg"}
              disabled={conversation !== null && isConnected}
              onClick={startConversation}
            >
              Start conversation
            </Button>
            <Button
              variant={"outline"}
              size={"lg"}
              disabled={conversation === null && !isConnected}
              onClick={endConversation}
            >
              End conversation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
