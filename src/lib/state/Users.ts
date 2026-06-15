import { create } from "zustand";
import type React from "react";
import { Member, User } from "../utils/Types";
import { getNameFont } from "../utils/UserUtils";

export interface UserState {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  get: (id: number) => User | undefined;
  getUser: (id: number) => User | undefined;
  addUser: (user: User) => void;
  addUsers: (users: User[]) => void;
  removeUser: (id: number) => void;
  removeUsers: (ids: number[]) => void;
  
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  getMember: (id: number | undefined, serverId: number | undefined) => Member | undefined;
  getMembersFor: (id: number | undefined) => Member[] | undefined;
  addMember: (member: Member) => void;
  addMembers: (members: Member[]) => void;
  removeMember: (id: number, serverId: number) => void;
  removeMembers: (members: { id: number; serverId: number }[]) => void;
}

const makeKey = (id: number, serverId: number) => `${serverId}:${id}`;

function registerUserFont(user: User) {
  const [url, isCustom] = getNameFont(user);
  if (!isCustom)
    return;
  registerFont(user.id.toString(), user.nameFont!, url!);
}

function registerMemberFont(member: Member) {
  if (!member.nameFont)
    return;
  const [url, isCustom] = getNameFont(member.user, member);
  if (!isCustom)
    return;
  registerFont(makeKey(member.userId, member.serverId), member.nameFont, url!);
}

export function registerFont(id: string, fontName: string, url: string) {
  const selector = `style[data-user-font="${id}"]`;
  document.querySelectorAll(selector).forEach(n => n.remove());

  const style = document.createElement("style");
  style.dataset.userFont = id;
  style.textContent = `@font-face{font-family:"${fontName}";src:url("${url}");}`;
  document.head.appendChild(style);
}

export const useUserState = create<UserState>((set, get) => ({
  users: [],
  members: [],

  setUsers: (value) =>
    set(state => ({
      users: typeof value === "function" ? value(state.users) : value,
    })),

  setMembers: (value) =>
    set(state => ({
      members: typeof value === "function" ? value(state.members) : value,
    })),

  get: (id) => get().users.find(u => u.id === id),
  getUser: (id) => get().users.find(u => u.id === id),

  addUser: (user) => {
    registerUserFont(user);
    set(state => ({
      users: [...state.users.filter(u => u.id !== user.id), user],
    }));
  },

  addUsers: (newUsers) => {
    for (const u of newUsers) registerUserFont(u);
    set(state => {
      const newIds = new Set(newUsers.map(u => u.id));
      return { users: [...state.users.filter(u => !newIds.has(u.id)), ...newUsers] };
    });
  },

  removeUser: (id) =>
    set(state => ({ users: state.users.filter(u => u.id !== id) })),

  removeUsers: (ids) =>
    set(state => ({ users: state.users.filter(u => !ids.includes(u.id)) })),

  getMember: (id, serverId) =>
    id !== undefined && serverId !== undefined
      ? get().members.find(m => m.userId === id && m.serverId === serverId)
      : undefined,

  getMembersFor: (id) =>
    id !== undefined ? get().members.filter(m => m.userId === id) : undefined,

  addMember: (member) => {
    registerMemberFont(member);
    if (member.user) {
      const existing = get().users.find(u => u.id === member.user!.id);
      if (!existing)
        get().addUser(member.user);
      member.userId = member.user.id;
      member.user = undefined;
    }
    set(state => {
      const key = makeKey(member.userId, member.serverId);
      return { members: [...state.members.filter(m => makeKey(m.userId, m.serverId) !== key), member] };
    });
  },

  addMembers: (newMembers) => {
    for (const m of newMembers) {
      if (m.user) {
        const existing = get().users.find(u => u.id === m.user!.id);
        if (!existing)
          get().addUser(m.user);
        m.userId = m.user.id;
        m.user = undefined;
      }
      registerMemberFont(m);
    }
    set(state => {
      const keys = new Set(newMembers.map(m => makeKey(m.userId, m.serverId)));
      return { members: [...state.members.filter(m => !keys.has(makeKey(m.userId, m.serverId))), ...newMembers] };
    });
  },

  removeMember: (id, serverId) =>
    set(state => ({
      members: state.members.filter(m => makeKey(m.userId, m.serverId) !== makeKey(id, serverId)),
    })),

  removeMembers: (toRemove) =>
    set(state => ({
      members: state.members.filter(
        m => !toRemove.some(r => makeKey(r.id, r.serverId) === makeKey(m.userId, m.serverId))
      ),
    })),
}));

export const getUs = () => useUserState.getState();