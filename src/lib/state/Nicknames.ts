import { create } from 'zustand';

interface NicknamesStore {
  nicknames: Record<number, string>;
  init: (list: { subjectId: number; nickname: string }[]) => void;
  set:  (subjectId: number, nickname: string | null) => void;
  get:  (subjectId: number) => string | undefined;
}

export const useNicknames = create<NicknamesStore>((set, get) => ({
  nicknames: {},

  init: (list) => {
    const nicknames: Record<number, string> = {};
    for (const { subjectId, nickname } of list)
      nicknames[subjectId] = nickname;
    set({ nicknames });
  },

  set: (subjectId, nickname) =>
    set(s => {
      const nicknames = { ...s.nicknames };
      if (nickname == null)
        delete nicknames[subjectId];
      else
        nicknames[subjectId] = nickname;
      return { nicknames };
    }),

  get: (subjectId) => get().nicknames[subjectId]
}));
