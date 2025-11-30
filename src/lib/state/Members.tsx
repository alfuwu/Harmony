import React, { useContext, useState, createContext } from "react";
import { Member, User } from "../utils/types";
import { useUserState } from "./Users";

export interface MemberState {
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  get: (id: number, serverId: number) => Member | undefined;
  getMember: (id: number, serverId: number) => Member | undefined;
  addMember: (member: Member) => void;
  addMembers: (members: Member[]) => void;
  removeMember: (id: number, serverId: number) => void;
  removeMembers: (members: { id: number; serverId: number }[]) => void;
}

const MemberContext = createContext<MemberState | undefined>(undefined);

const makeKey = (id: number, serverId: number) => `${serverId}:${id}`;

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

  const get = (id: number, serverId: number): Member | undefined =>
    members.find(m => m.user.id === id && m.serverId === serverId);

  const addMember = (member: Member) => {
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
