import { create } from "zustand";
import type React from "react";
import { Member, User } from "../utils/Types";
import { getNameFont } from "../utils/UserUtils";
import { getUser, getUsersBulk } from "../api/UserApi";

export interface UserState {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  get: (id: bigint) => User | undefined;
  getUser: (id: bigint) => User | undefined;
  addUser: (user: User) => void;
  addUsers: (users: User[]) => void;
  removeUser: (id: bigint) => void;
  removeUsers: (ids: bigint[]) => void;
  
  members: Member[];
  setMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  getMember: (id: bigint | undefined, serverId: bigint | undefined) => Member | undefined;
  getMembersFor: (id: bigint | undefined) => Member[] | undefined;
  addMember: (member: Member) => void;
  addMembers: (members: Member[]) => void;
  removeMember: (id: bigint, serverId: bigint) => void;
  removeMembers: (members: { id: bigint; serverId: bigint }[]) => void;
}

const makeKey = (id: bigint, serverId: bigint) => `${serverId}:${id}`;

function registerUserFont(user: User) {
  const [url, isCustom] = getNameFont(user);
  if (!isCustom)
    return;
  registerFont(user.id.toString(), user.nameFont!, url!);
}

function registerMemberFont(member: Member) {
  if (!member.nameFont)
    return;
  const [url, isCustom] = getNameFont(undefined, member); // TODO: fix
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
    if (!get().get(member.userId)) {
      getUser(member.userId).then(u => {
        set(state => {
          const key = makeKey(member.userId, member.serverId);
          return { users: [ ...state.users, u], members: [...state.members.filter(m => makeKey(m.userId, m.serverId) !== key), member] };
        });
      });
      return;
    }
    set(state => {
      const key = makeKey(member.userId, member.serverId);
      return { members: [...state.members.filter(m => makeKey(m.userId, m.serverId) !== key), member] };
    });
  },

  addMembers: (newMembers) => {
    const noUsers = [];
    const state = get();
    for (const m of newMembers) {
      if (!state.get(m.userId))
        noUsers.push(m.userId);
      registerMemberFont(m);
    }
    if (noUsers.length > 0) {
      getUsersBulk(noUsers).then(users => {
        set(state => {
          const keys = new Set(newMembers.map(m => makeKey(m.userId, m.serverId)));
          return { users: [...state.users, ...users], members: [...state.members.filter(m => !keys.has(makeKey(m.userId, m.serverId))), ...newMembers] };
        });
      });
      return;
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