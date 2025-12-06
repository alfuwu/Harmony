import React, { useContext, useState, createContext } from "react";
import { Member, User } from "../utils/types";
import { registerFont, useUserState } from "./Users";
import { getNameFont } from "../utils/UserUtils";

export interface MemberState {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  get: (id: number | undefined, serverId: number | undefined) => Member | undefined;
  getMember: (id: number | undefined, serverId: number | undefined) => Member | undefined;
  addMember: (member: Member) => void;
  addMembers: (members: Member[]) => void;
  removeMember: (id: number, serverId: number) => void;
  removeMembers: (members: { id: number; serverId: number }[]) => void;
}

const MemberContext = createContext<MemberState | undefined>(undefined);

const makeKey = (id: number, serverId: number) => `${serverId}:${id}`;

function registerMemberFont(member: Member) {
  if (!member.nameFont)
    return;
  const [url, isCustom] = getNameFont(member.user, member);
  if (!isCustom)
    return;
  registerFont(makeKey(member.user.id, member.serverId), member.nameFont, url!);
}

export const MemberProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { getUser, addUser } = useUserState();
  const [members, setMembers] = useState<Member[]>([]);

  const getUserRef = (user: User) => {
    const u = getUser(user.id);
    if (!u) {
      addUser(user);
      return user;
    }
    return u;
  }

  const get = (id: number | undefined, serverId: number | undefined): Member | undefined =>
    id !== undefined && serverId !== undefined ? members.find(m => m.user.id === id && m.serverId === serverId) : undefined;

  const addMember = (member: Member) => {
    registerMemberFont(member);
    setMembers(prev => {
      const key = makeKey(member.user.id, member.serverId);
      const filtered = prev.filter(m => makeKey(m.user.id, m.serverId) !== key);
      return [...filtered, {
        ...member,
        user: getUserRef(member.user)
      }];
    });
  };

  const addMembers = (newMembers: Member[]) => {
    setMembers(prev => {
      const keys = new Set(newMembers.map(m => makeKey(m.user.id, m.serverId)));
      const filtered = prev.filter(m => !keys.has(makeKey(m.user.id, m.serverId)));
      for (const m of newMembers)
        registerMemberFont(m);
      return [...filtered, ...newMembers.map(m => ({
        ...m,
        user: getUserRef(m.user)
      }))];
    });
  };

  const removeMember = (id: number, serverId: number) =>
    setMembers(prev => prev.filter(m => makeKey(m.user.id, m.serverId) !== makeKey(id, serverId)));

  const removeMembers = (toRemove: { id: number; serverId: number }[]) =>
    setMembers(prev => prev.filter(m => !toRemove.some(r => makeKey(r.id, r.serverId) === makeKey(m.user.id, m.serverId))));

  const value = {
    members,
    setMembers,
    get,
    getMember: get,
    addMember,
    addMembers,
    removeMember,
    removeMembers
  };

  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
};

export const useMemberState = (): MemberState => {
  const ctx = useContext(MemberContext);
  if (!ctx)
    throw new Error("useMemberState must be used within a MemberProvider");
  return ctx;
};
