import { create } from "zustand";
import { googleTranslate } from "../api/TranslateApi";

type TranslationEntry = {
  status: "loading" | "done" | "error";
  text?: string;
  source?: string;
};

interface TranslationsStore {
  entries: Map<bigint, TranslationEntry>;
  translate: (messageId: bigint, content: string, targetLang: string) => Promise<void>;
  dismiss: (messageId: bigint) => void;
}

export const useTranslations = create<TranslationsStore>((set) => ({
  entries: new Map(),

  translate: async (messageId, content, targetLang) => {
    set(s => {
      const entries = s.entries;
      const prev = entries.get(messageId) ?? {};
      entries.set(messageId, { ...prev, status: "loading" });
      return { entries }
    });
    try {
      const { text, source } = await googleTranslate(content, targetLang);
      set(s => {
        const entries = s.entries;
        entries.set(messageId, { status: "done", text, source });
        return { entries }
      });
    } catch {
      set(s => {
        const entries = s.entries;
        entries.set(messageId, { status: "error" });
        return { entries }
      });
    }
  },

  dismiss: (messageId) =>
    set(s => {
      const entries = { ...s.entries };
      entries.delete(messageId);
      return { entries };
    })
}));
