import { create } from "zustand";

export interface LoadingState {
  serversLoading: boolean;
  channelsLoading: boolean;
  membersLoading: boolean;
  messagesLoading: boolean;

  setServersLoading: (v: boolean) => void;
  setChannelsLoading: (v: boolean) => void;
  setMembersLoading: (v: boolean) => void;
  setMessagesLoading: (v: boolean) => void;
}

export const useLoadingState = create<LoadingState>((set) => ({
  // Everything starts in a loading state so the first paint always shows
  // skeletons rather than empty lists.
  serversLoading:  true,
  channelsLoading: true,
  membersLoading:  true,
  messagesLoading: true,

  setServersLoading:  (v) => set({ serversLoading: v }),
  setChannelsLoading: (v) => set({ channelsLoading: v }),
  setMembersLoading:  (v) => set({ membersLoading: v }),
  setMessagesLoading: (v) => set({ messagesLoading: v })
}));