import React, { useContext, useState, createContext } from "react";
import { Member, User } from "../utils/types";
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
  getMembersFor: (id: number | undefined) => Member[] | undefined,
  addMember: (member: Member) => void;
  addMembers: (members: Member[]) => void;
  removeMember: (id: number, serverId: number) => void;
  removeMembers: (members: { id: number; serverId: number }[]) => void;
}

const UserContext = createContext<UserState | undefined>(undefined);

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
  registerFont(makeKey(member.user.id, member.serverId), member.nameFont, url!);
}

export function registerFont(id: string, fontName: string, url: string) {
  const selector = `style[data-user-font="${id}"]`;
  document.querySelectorAll(selector).forEach(n => n.remove());

  const style = document.createElement("style");
  style.dataset.userFont = id;
  style.textContent = `@font-face{font-family:"${fontName}";src:url("${url}");}`;
  document.head.appendChild(style);
}

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const getUserRef = (user: User) => {
    const u = get(user.id);
    if (!u) {
      addUser(user);
      return user;
    }
    return u;
  }

  const get = (id: number) =>
    users.find(c => c.id === id);

  const getMember = (id: number | undefined, serverId: number | undefined): Member | undefined =>
    id !== undefined && serverId !== undefined ? members.find(m => m.user.id === id && m.serverId === serverId) : undefined;

  const getMembersFor = (id: number | undefined) =>
    id !== undefined ? members.filter(m => m.user.id === id) : undefined;

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

  const updateMembers = (user: User) => {
    const mems = getMembersFor(user.id) ?? [];
    mems.forEach(m => m.user = user);
    addMembers(mems);
  }

  const addUser = (user: User) => {
    registerUserFont(user);
    setUsers(prev => [prev.filter(c => c.id !== user.id), user].flat());
    updateMembers(user);
  }

  const addUsers = (newUsers: User[]) => {
    setUsers(prev => {
      const newIds = new Set(newUsers.map(c => c.id));
      for (const u of newUsers) {
        registerUserFont(u);
        updateMembers(u);
      }
      return [...prev.filter(c => !newIds.has(c.id)), ...newUsers];
    });
  };

  // TODO: remove user font?
  const removeUser = (id: number) => {
    setUsers(prev => prev.filter(c => c.id !== id));
  }

  const removeUsers = (ids: number[]) =>
    setUsers(prev => prev.filter(c => !ids.includes(c.id)));

  const value = {
    users,
    setUsers,
    get,
    getUser: get,
    addUser,
    addUsers,
    removeUser,
    removeUsers,

    members,
    setMembers,
    getMember,
    getMembersFor,
    addMember,
    addMembers,
    removeMember,
    removeMembers
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserState = (): UserState => {
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error("useUserState must be used within a UserProvider");
  return ctx;
};
