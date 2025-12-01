import React, { useContext, useState, createContext } from "react";
import { Message } from "../utils/types";

export interface MessageState {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addMessage: (msg: Message) => void;
  addMessages: (msgs: Message[]) => void;
  removeMessage: (id: number) => void;
  removeMessages: (ids: number[]) => void;
  removeMessageByNonce: (nonce: number) => void;
}

const MessageContext = createContext<MessageState | undefined>(undefined);

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = (msg: Message) =>
    setMessages(prev => [...prev.filter(m => m.nonce === undefined || m.nonce !== msg.nonce), msg]);

  const addMessages = (msgs: Message[]) => {
    setMessages(prev => {
      const existingNonces = new Set(prev.map(m => m.nonce).filter(n => n !== undefined));
      const existingIds = new Set(prev.map(m => m.id));
      const newMessages = msgs.filter(m => (m.nonce === undefined || !existingNonces.has(m.nonce)) && !existingIds.has(m.id));
      return [...prev, ...newMessages];
    });
  };

  const removeMessage = (id: number) =>
    setMessages(prev => prev.filter(m => m.id !== id));

  const removeMessages = (ids: number[]) =>
    setMessages(prev => prev.filter(m => !ids.includes(m.id)));

  const removeMessageByNonce = (nonce: number) => 
    setMessages(prev => prev.filter(m => m.nonce !== nonce));

  const value = {
    messages,
    setMessages,
    addMessage,
    addMessages,
    removeMessage,
    removeMessages,
    removeMessageByNonce,
  };
  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};

export const useMessageState = (): MessageState => {
  const ctx = useContext(MessageContext);
  if (!ctx)
    throw new Error("useMessageState must be used within a MessageProvider");
  return ctx;
};
