import React, { useContext, useState, createContext } from "react";
import { User } from "../utils/types";

interface UserState {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const UserContext = createContext<UserState | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const value = { users, setUsers };
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserState = (): UserState => {
  const ctx = useContext(UserContext);
  if (!ctx)
    throw new Error("useUsers must be used within a UserProvider");
  return ctx;
};
