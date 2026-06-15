import { create } from "zustand";
import { User } from "../utils/Types";
import { UserSettings } from "../utils/UserSettings";

type SetAction<T> = (val: T | ((prev: T) => T)) => void;

const apply = <T>(current: T, val: T | ((prev: T) => T)): T =>
  typeof val === "function" ? (val as (p: T) => T)(current) : val;

export interface AuthState {
  user: User | null;
  setUser: SetAction<User | null>;
  userSettings: UserSettings | null;
  setUserSettings: SetAction<UserSettings | null>;
  token: string | null;
  setToken: SetAction<string | null>;
}

export const useAuthState = create<AuthState>((set) => ({
  user: null,
  setUser: (val) => set((s) => ({ user: apply(s.user, val) })),
  userSettings: null,
  setUserSettings: (val) => set((s) => ({ userSettings: apply(s.userSettings, val) })),
  token: null,
  setToken: (val) => set((s) => ({ token: apply(s.token, val) }))
}));

export const getAs = () => useAuthState.getState();

export const userSettings = () => useAuthState.getState().userSettings;