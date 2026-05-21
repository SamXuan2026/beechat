import { useEffect, useMemo, useState } from "react";
import type { User } from "../../../types/auth";
import type { Channel } from "../../../types/chat";

interface UseDraftComposerOptions {
  activeChannel?: Channel;
  currentUser: User;
}

export function useDraftComposer({ activeChannel, currentUser }: UseDraftComposerOptions) {
  const [composerValue, setComposerValue] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const draftStorageKey = useMemo(
    () => (activeChannel ? `beechat:draft:${currentUser.id}:${activeChannel.id}` : ""),
    [activeChannel, currentUser.id]
  );

  useEffect(() => {
    if (!draftStorageKey) return;
    const savedDraft = window.localStorage.getItem(draftStorageKey) || "";
    setComposerValue(savedDraft);
    setDraftSaved(Boolean(savedDraft.trim()));
  }, [draftStorageKey]);

  function handleComposerChange(value: string) {
    setComposerValue(value);
    if (!draftStorageKey) return;
    if (value.trim()) {
      window.localStorage.setItem(draftStorageKey, value);
      setDraftSaved(true);
    } else {
      window.localStorage.removeItem(draftStorageKey);
      setDraftSaved(false);
    }
  }

  function handleMentionInsert(name: string) {
    const nextValue = `${composerValue}${composerValue.endsWith(" ") || !composerValue ? "" : " "}@${name} `;
    handleComposerChange(nextValue);
  }

  function clearDraft() {
    setComposerValue("");
    if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
    setDraftSaved(false);
  }

  return {
    clearDraft,
    composerValue,
    draftSaved,
    handleComposerChange,
    handleMentionInsert
  };
}
