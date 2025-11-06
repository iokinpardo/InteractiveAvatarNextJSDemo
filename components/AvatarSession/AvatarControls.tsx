import { ToggleGroup, ToggleGroupItem } from "@radix-ui/react-toggle-group";
import React from "react";

import { useVoiceChat } from "../logic/useVoiceChat";
import { Button } from "../Button";
import { useInterrupt } from "../logic/useInterrupt";
import { useStreamingAvatarContext } from "../logic/context";
import { NarrationMode } from "../logic/narrationMode";

import { AudioInput } from "./AudioInput";
import { TextInput } from "./TextInput";

export const AvatarControls: React.FC = () => {
  const {
    isVoiceChatLoading,
    isVoiceChatActive,
    startVoiceChat,
    stopVoiceChat,
  } = useVoiceChat();
  const { interrupt } = useInterrupt();
  const { narrationMode } = useStreamingAvatarContext();

  if (narrationMode === NarrationMode.WEBHOOK) {
    return (
      <div className="relative flex w-full flex-col items-center gap-3">
        <div className="w-full rounded-3xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
          <p className="text-left">
            Voice and text chat controls are disabled. Send webhook payloads to
            narrate announcements.
          </p>
        </div>
        <div className="absolute top-[-70px] right-3">
          <Button className="!bg-zinc-700 !text-white" onClick={interrupt}>
            Interrupt
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 relative w-full items-center">
      <ToggleGroup
        className={`bg-zinc-700 rounded-lg p-1 ${isVoiceChatLoading ? "opacity-50" : ""}`}
        disabled={isVoiceChatLoading}
        type="single"
        value={isVoiceChatActive || isVoiceChatLoading ? "voice" : "text"}
        onValueChange={(value) => {
          if (value === "voice" && !isVoiceChatActive && !isVoiceChatLoading) {
            startVoiceChat();
          } else if (
            value === "text" &&
            isVoiceChatActive &&
            !isVoiceChatLoading
          ) {
            stopVoiceChat();
          }
        }}
      >
        <ToggleGroupItem
          className="data-[state=on]:bg-zinc-800 rounded-lg p-2 text-sm w-[90px] text-center"
          value="voice"
        >
          Voice Chat
        </ToggleGroupItem>
        <ToggleGroupItem
          className="data-[state=on]:bg-zinc-800 rounded-lg p-2 text-sm w-[90px] text-center"
          value="text"
        >
          Text Chat
        </ToggleGroupItem>
      </ToggleGroup>
      {isVoiceChatActive || isVoiceChatLoading ? <AudioInput /> : <TextInput />}
      <div className="absolute top-[-70px] right-3">
        <Button className="!bg-zinc-700 !text-white" onClick={interrupt}>
          Interrupt
        </Button>
      </div>
    </div>
  );
};
