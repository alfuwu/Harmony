import React, { useContext, useState, createContext } from "react";
import { Message, Reaction } from "../utils/types";

export interface MessageState {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (msg: Message) => void;
  addMessages: (msgs: Message[]) => void;
  updateMessage: (msg: Partial<Message> & { id: number }) => void;
  removeMessage: (id: number) => void;
  removeMessages: (ids: number[]) => void;
  removeMessageByNonce: (nonce: number) => void;
  addReaction: (payload: { messageId: number; userId: number; emoji: any }) => void;
  removeReaction: (payload: { messageId: number; userId: number; emoji: any }) => void;
}

const MessageContext = createContext<MessageState | undefined>(undefined);

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = (msg: Message) =>
    setMessages(prev => {
      // Replace optimistic message by nonce, otherwise deduplicate by id
      const filtered = prev.filter(m =>
        (m.nonce === undefined || m.nonce !== msg.nonce) && m.id !== msg.id
      );
      return [...filtered, msg];
    });

  const addMessages = (msgs: Message[]) => {
    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const existingNonces = new Set(prev.map(m => m.nonce).filter(Boolean));
      const incoming = msgs.filter(m =>
        !existingIds.has(m.id) && (m.nonce === undefined || !existingNonces.has(m.nonce))
      );
      return [...prev, ...incoming];
    });
  };

  const updateMessage = (patch: Partial<Message> & { id: number }) =>
    setMessages(prev =>
      prev.map(m => m.id === patch.id ? { ...m, ...patch } : m)
    );

  const removeMessage = (id: number) =>
    setMessages(prev => prev.filter(m => m.id !== id));

  const removeMessages = (ids: number[]) =>
    setMessages(prev => prev.filter(m => !ids.includes(m.id)));

  const removeMessageByNonce = (nonce: number) =>
    setMessages(prev => prev.filter(m => m.nonce !== nonce));

  const addReaction = ({ messageId, userId, emoji }: { messageId: number; userId: number; emoji: any }) =>
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions: Reaction[] = m.reactions ? [...m.reactions] : [];
      const existing = reactions.find(r => r.emoji?.id === emoji?.id && r.emoji?.name === emoji?.name);
      if (existing) {
        if (!existing.reactors.includes(userId))
          return { ...m, reactions: reactions.map(r => r === existing ? { ...r, reactors: [...r.reactors, userId] } : r) };
        return m;
      }
      return { ...m, reactions: [...reactions, { emoji, reactors: [userId] }] };
    }));

  const removeReaction = ({ messageId, userId, emoji }: { messageId: number; userId: number; emoji: any }) =>
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = (m.reactions ?? [])
        .map(r => r.emoji?.id === emoji?.id && r.emoji?.name === emoji?.name
          ? { ...r, reactors: r.reactors.filter(id => id !== userId) }
          : r
        )
        .filter(r => r.reactors.length > 0);
      return { ...m, reactions };
    }));

  const value: MessageState = {
    messages,
    setMessages,
    addMessage,
    addMessages,
    updateMessage,
    removeMessage,
    removeMessages,
    removeMessageByNonce,
    addReaction,
    removeReaction,
  };

  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};

export const useMessageState = (): MessageState => {
  const ctx = useContext(MessageContext);
  if (!ctx)
    throw new Error("useMessageState must be used within a MessageProvider");
  return ctx;
};