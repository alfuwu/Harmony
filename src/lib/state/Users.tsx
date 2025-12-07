import React, { useContext, useState, createContext } from "react";
import { User } from "../utils/types";
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
}

const UserContext = createContext<UserState | undefined>(undefined);

// TODO: fix font getting ratelimited and then not fetching again
function registerUserFont(user: User) {
  const [url, isCustom] = getNameFont(user);
  if (!isCustom)
    return;
  registerFont(user.id.toString(), user.nameFont!, url!);
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

  const get = (id: number) =>
    users.find(c => c.id === id);

  const addUser = (user: User) => {
    registerUserFont(user);
    setUsers(prev => [prev.filter(c => c.id !== user.id), user].flat());
  }

  const addUsers = (newUsers: User[]) => {
    setUsers(prev => {
      const newIds = new Set(newUsers.map(c => c.id));
      for (const u of newUsers)
        registerUserFont(u);
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
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserState = (): UserState => {
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error("useUserState must be used within a UserProvider");
  return ctx;
};
