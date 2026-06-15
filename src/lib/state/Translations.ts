import { create } from "zustand";
import { googleTranslate } from "../api/TranslateApi";

type TranslationEntry = {
  status: "loading" | "done" | "error";
  text?: string;
};

interface TranslationsStore {
  entries: Record<number, TranslationEntry>;
  translate: (messageId: number, content: string, targetLang: string) => Promise<void>;
  dismiss: (messageId: number) => void;
}

export const useTranslations = create<TranslationsStore>((set) => ({
  entries: {},

  translate: async (messageId, content, targetLang) => {
    set(s => ({
      entries: { ...s.entries, [messageId]: { status: "loading" } }
    }));
    try {
      const text = await googleTranslate(content, targetLang);
      set(s => ({
        entries: { ...s.entries, [messageId]: { status: "done", text } }
      }));
    } catch {
      set(s => ({
        entries: { ...s.entries, [messageId]: { status: "error" } }
      }));
    }
  },

  dismiss: (messageId) =>
    set(s => {
      const entries = { ...s.entries };
      delete entries[messageId];
      return { entries };
    })
}));
