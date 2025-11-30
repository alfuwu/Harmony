import React, { useContext, useState, createContext } from "react";
import { User } from "../utils/types";

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

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);

  const get = (id: number) =>
    users.find(c => c.id === id);

  const addUser = (user: User) => 
    setUsers(prev => [prev.filter(c => c.id !== user.id), user].flat());

  const addUsers = (newUsers: User[]) => {
    setUsers(prev => {
      const newIds = new Set(newUsers.map(c => c.id));
      return [...prev.filter(c => !newIds.has(c.id)), ...newUsers];
    });
  };

  const removeUser = (id: number) =>
    setUsers(prev => prev.filter(c => c.id !== id));

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
