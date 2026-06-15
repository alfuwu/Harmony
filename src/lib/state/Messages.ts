import { create } from "zustand";
import type React from "react";
import { Message, Reaction } from "../utils/Types";

export interface MessageState {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (msg: Message) => void;
  addMessages: (msgs: Message[]) => void;
  updateMessage: (msg: Partial<Message> & { id: number }) => void;
  get: (id?: number | null) => Message | undefined;
  getMessage: (id?: number | null) => Message | undefined;
  removeMessage: (id: number) => void;
  removeMessages: (ids: number[]) => void;
  removeMessageByNonce: (nonce: number) => void;
  addReaction: (payload: { messageId: number; userId: number; emoji: any }) => void;
  removeReaction: (payload: { messageId: number; userId: number; emoji: any }) => void;
}

export const useMessageState = create<MessageState>((set, get) => ({
  messages: [],

  setMessages: (value) =>
    set(state => ({
      messages: typeof value === "function" ? value(state.messages) : value,
    })),

  addMessage: (msg) =>
    set(state => {
      const filtered = state.messages.filter(m =>
        (m.nonce === undefined || m.nonce !== msg.nonce) && m.id !== msg.id
      );
      return { messages: [...filtered, msg] };
    }),

  addMessages: (msgs) =>
    set(state => {
      const existingIds = new Set(state.messages.map(m => m.id));
      const existingNonces = new Set(state.messages.map(m => m.nonce).filter(Boolean));
      const incoming = msgs.filter(m =>
        !existingIds.has(m.id) && (m.nonce === undefined || !existingNonces.has(m.nonce))
      );
      return { messages: [...state.messages, ...incoming] };
    }),

  updateMessage: (patch) =>
    set(state => ({
      messages: state.messages.map(m => m.id === patch.id ? { ...m, ...patch } : m),
    })),

  get: (id) => get().messages.find(m => m.id === id),
  getMessage: (id) => get().messages.find(m => m.id === id),

  removeMessage: (id) =>
    set(state => ({ messages: state.messages.filter(m => m.id !== id) })),

  removeMessages: (ids) =>
    set(state => ({ messages: state.messages.filter(m => !ids.includes(m.id)) })),

  removeMessageByNonce: (nonce) =>
    set(state => ({ messages: state.messages.filter(m => m.nonce !== nonce) })),

  addReaction: ({ messageId, userId, emoji }) =>
    set(state => ({
      messages: state.messages.map(m => {
        if (m.id !== messageId) return m;
        const reactions: Reaction[] = m.reactions ? [...m.reactions] : [];
        const existing = reactions.find(r => r.emoji?.id === emoji?.id && r.emoji?.name === emoji?.name);
        if (existing) {
          if (existing.reactors.includes(userId)) return m;
          return {
            ...m,
            reactions: reactions.map(r =>
              r === existing ? { ...r, reactors: [...r.reactors, userId] } : r
            ),
          };
        }
        return { ...m, reactions: [...reactions, { emoji, reactors: [userId] }] };
      }),
    })),

  removeReaction: ({ messageId, userId, emoji }) =>
    set(state => ({
      messages: state.messages.map(m => {
        if (m.id !== messageId) return m;
        const reactions = (m.reactions ?? [])
          .map(r =>
            r.emoji?.id === emoji?.id && r.emoji?.name === emoji?.name
              ? { ...r, reactors: r.reactors.filter(id => id !== userId) }
              : r
          )
          .filter(r => r.reactors.length > 0);
        return { ...m, reactions };
      }),
    })),
}));

export const getMs = () => useMessageState.getState();