import React, { useContext, useState, createContext } from "react";
import { User } from "../utils/types";
import { UserSettings } from "../utils/userSettings";

export interface AuthState {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  userSettings: UserSettings | null;
  setUserSettings: React.Dispatch<React.SetStateAction<UserSettings | null>>;
  token: string | null;
  setToken: React.Dispatch<React.SetStateAction<string | null>>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const value = { user, setUser, userSettings, setUserSettings, token, setToken };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthState = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthState must be used within an AuthProvider");
  return ctx;
};
