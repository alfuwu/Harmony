import { create } from 'zustand';

interface NicknamesStore {
  nicknames: Map<bigint, string>;
  init: (list: { subjectId: bigint; nickname: string }[]) => void;
  set: (subjectId: bigint, nickname: string | null) => void;
  get: (subjectId: bigint) => string | undefined;
}

export const useNicknames = create<NicknamesStore>((set, get) => ({
  nicknames: new Map(),

  init: (list) => {
    const nicknames: Map<bigint, string> = new Map();
    for (const { subjectId, nickname } of list)
      nicknames.set(subjectId, nickname);
    set({ nicknames });
  },

  set: (subjectId, nickname) =>
    set(s => {
      const nicknames = { ...s.nicknames };
      if (nickname == null)
        nicknames.delete(subjectId);
      else
        nicknames.set(subjectId, nickname);
      return { nicknames };
    }),

  get: (subjectId) => get().nicknames.get(subjectId)
}));
