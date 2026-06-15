import { create } from 'zustand';

export enum NotificationLevel {
  AllMessages         = 0,
  MentionsAndEveryone = 1,
  DirectMentions      = 2,
  None                = 3
}

export const NOTIF_LABELS: Record<NotificationLevel, string> = {
  [NotificationLevel.AllMessages]:         "All Messages",
  [NotificationLevel.MentionsAndEveryone]: "@Mentions & Everyone",
  [NotificationLevel.DirectMentions]:      "Direct @Mentions Only",
  [NotificationLevel.None]:                "Nothing",
};

type Prefs = {
  servers:  Record<number, NotificationLevel>;
  channels: Record<number, NotificationLevel>;
};

const STORAGE_KEY = 'notifPrefs';

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { servers: {}, channels: {} };
    const parsed = JSON.parse(raw);
    return { servers: parsed.servers ?? {}, channels: parsed.channels ?? {} };
  } catch {
    return { servers: {}, channels: {} };
  }
}

function savePrefs(s: Prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ servers: s.servers, channels: s.channels })); }
  catch {}
}

interface NotificationsStore extends Prefs {
  setServer:  (id: number, level: NotificationLevel) => void;
  setChannel: (id: number, level: NotificationLevel) => void;
  effective:  (serverId: number | undefined, channelId: number) => NotificationLevel;
}

export const useNotifications = create<NotificationsStore>((set, get) => ({
  ...loadPrefs(),
  setServer: (id, level) =>
    set(s => {
      const servers = { ...s.servers, [id]: level };
      savePrefs({ servers, channels: s.channels });
      return { servers };
    }),
  setChannel: (id, level) =>
    set(s => {
      const channels = { ...s.channels, [id]: level };
      savePrefs({ servers: s.servers, channels });
      return { channels };
    }),
  effective: (serverId, channelId) => {
    const { channels, servers } = get();
    if (channelId in channels)
      return channels[channelId];
    if (serverId != null && serverId in servers)
      return servers[serverId];
    return NotificationLevel.MentionsAndEveryone;
  }
}));
