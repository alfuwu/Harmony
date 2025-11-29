import React, { useContext, useState, createContext } from "react";
import { Message } from "../utils/types";

interface MessageState {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const MessageContext = createContext<MessageState | undefined>(undefined);

export const MessageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const value = { messages, setMessages };
  return <MessageContext.Provider value={value}>{children}</MessageContext.Provider>;
};

export const useMessageState = (): MessageState => {
  const ctx = useContext(MessageContext);
  if (!ctx)
    throw new Error("useMessages must be used within a MessageProvider");
  return ctx;
};
