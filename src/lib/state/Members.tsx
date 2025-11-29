import React, { useContext, useState, createContext } from "react";
import { Member } from "../utils/types";

export interface MemberState {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
}

const MemberContext = createContext<MemberState | undefined>(undefined);

export const MemberProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [members, setMembers] = useState<Member[]>([]);
  const value = { members, setMembers };
  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
};

export const useMemberState = (): MemberState => {
  const ctx = useContext(MemberContext);
  if (!ctx)
    throw new Error("useMembers must be used within a MemberProvider");
  return ctx;
};
