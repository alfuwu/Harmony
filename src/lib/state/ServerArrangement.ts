import { create } from "zustand";

export type ServerFolder = {
  id: string;
  name: string;
  color?: string;
  serverIds: bigint[];
  collapsed: boolean;
};

type Arrangement = {
  order: (bigint | string)[]; // server id OR folder id, top-to-bottom
  folders: Record<string, ServerFolder>;
};

// TODO: save server folders & order on the server (batch operations)
const STORAGE_KEY = "serverArrangement";

function load(): Arrangement {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { order: [], folders: {} };
    const parsed = JSON.parse(raw);
    return {
      order: Array.isArray(parsed.order) ? parsed.order : [],
      folders: parsed.folders && typeof parsed.folders === "object"
        ? parsed.folders
        : {}
    };
  } catch {
    return { order: [], folders: {} };
  }
}

function save(a: Arrangement) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ order: a.order, folders: a.folders })
    );
  } catch { }
}

// Merge known server IDs into the stored order, appending any new ones.
function mergeOrder(stored: (bigint | string)[], knownIds: bigint[]): (bigint | string)[] {
  const inOrder = new Set(stored.filter(x => typeof x === "bigint") as bigint[]);
  const fresh = knownIds.filter(id => !inOrder.has(id));
  return [...stored, ...fresh];
}

interface ServerArrangementStore extends Arrangement {
  init: (serverIds: bigint[]) => void;
  move: (fromIdx: number, toIdx: number) => void;
  createFolder: (name: string, color?: string) => string;
  renameFolder: (folderId: string, name: string) => void;
  colorFolder: (folderId: string, color: string) => void;
  deleteFolder: (folderId: string) => void;
  toggleFolder: (folderId: string) => void;
  addToFolder: (serverId: bigint, folderId: string) => void;
  removeFromFolder: (serverId: bigint, folderId: string) => void;
}

export const useServerArrangement = create<ServerArrangementStore>((set, get) => ({
  ...load(),

  init: (serverIds) =>
    set(s => {
      const order = mergeOrder(s.order, serverIds);
      const knownSet = new Set(serverIds);
      const cleaned = order.filter(x =>
        typeof x === "string" || knownSet.has(x as bigint)
      );
      const folders = { ...s.folders };
      for (const fid of Object.keys(folders)) {
        folders[fid] = {
          ...folders[fid],
          serverIds: folders[fid].serverIds.filter(id => knownSet.has(id))
        };
      }
      const next = { order: cleaned, folders };
      save(next);
      return next;
    }),

  move: (fromIdx, toIdx) =>
    set(s => {
      const order = [...s.order];
      const [item] = order.splice(fromIdx, 1);
      order.splice(toIdx, 0, item);
      const next = { ...s, order };
      save(next);
      return next;
    }),

  createFolder: (name, color) => {
    const id = `folder_${Date.now()}`;
    set(s => {
      const folders = {
        ...s.folders,
        [id]: { id, name, color, serverIds: [], collapsed: false }
      };
      const order = [...s.order, id];
      const next = { ...s, folders, order };
      save(next);
      return next;
    });
    return id;
  },

  renameFolder: (folderId, name) =>
    set(s => {
      const folders = {
        ...s.folders,
        [folderId]: { ...s.folders[folderId], name }
      };
      const next = { ...s, folders };
      save(next);
      return next;
    }),

  colorFolder: (folderId, color) =>
    set(s => {
      const folders = {
        ...s.folders,
        [folderId]: { ...s.folders[folderId], color }
      };
      const next = { ...s, folders };
      save(next);
      return next;
    }),

  deleteFolder: (folderId) =>
    set(s => {
      const folder = s.folders[folderId];
      const folders = { ...s.folders };
      delete folders[folderId];
      // Eject member servers back into the root order at the folder's position.
      const folderPos = s.order.indexOf(folderId);
      const order = [...s.order];
      order.splice(folderPos, 1, ...(folder?.serverIds ?? []));
      const next = { ...s, order, folders };
      save(next);
      return next;
    }),

  toggleFolder: (folderId) =>
    set(s => {
      const folders = {
        ...s.folders,
        [folderId]: { ...s.folders[folderId], collapsed: !s.folders[folderId].collapsed }
      };
      const next = { ...s, folders };
      save(next);
      return next;
    }),

  addToFolder: (serverId, folderId) =>
    set(s => {
      const order = s.order.filter(x => x !== serverId);
      const folder = s.folders[folderId];
      if (!folder)
        return {};
      const folders = {
        ...s.folders,
        [folderId]: {
          ...folder,
          serverIds: folder.serverIds.includes(serverId)
            ? folder.serverIds
            : [...folder.serverIds, serverId]
        }
      };
      const next = { ...s, order, folders };
      save(next);
      return next;
    }),

  removeFromFolder: (serverId, folderId) =>
    set(s => {
      const folder = s.folders[folderId];
      if (!folder)
        return {};
      const folders = {
        ...s.folders,
        [folderId]: { ...folder, serverIds: folder.serverIds.filter(id => id !== serverId) }
      };
      const folderIdx = s.order.indexOf(folderId);
      const order = [...s.order];
      order.splice(folderIdx + 1, 0, serverId);
      const next = { ...s, order, folders };
      save(next);
      return next;
    })
}));
