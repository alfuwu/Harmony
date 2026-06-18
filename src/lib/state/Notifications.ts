import { create } from 'zustand';
import { BigJSON } from '../utils/JSON';

export enum NotificationLevel {
  AllMessages = 0,
  MentionsAndEveryone = 1,
  DirectMentions = 2,
  None = 3
}

export const NOTIF_LABELS: Record<NotificationLevel, string> = {
  [NotificationLevel.AllMessages]:         "All Messages",
  [NotificationLevel.MentionsAndEveryone]: "@Mentions & Everyone",
  [NotificationLevel.DirectMentions]:      "Direct @Mentions Only",
  [NotificationLevel.None]:                "Nothing",
};

type Prefs = {
  servers: Map<bigint, NotificationLevel>;
  channels: Map<bigint, NotificationLevel>;
};

const STORAGE_KEY = 'notifPrefs';

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return { servers: new Map(), channels: new Map() };
    const parsed = BigJSON.parse(raw);
    return { servers: parsed.servers ?? new Map(), channels: parsed.channels ?? new Map() };
  } catch {
    return { servers: new Map(), channels: new Map() };
  }
}

function savePrefs(s: Prefs) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      BigJSON.stringify({ servers: s.servers, channels: s.channels })
    );
  } catch { }
}

interface NotificationsStore extends Prefs {
  setServer: (id: bigint, level: NotificationLevel) => void;
  setChannel: (id: bigint, level: NotificationLevel) => void;
  effective: (serverId: bigint | undefined, channelId: bigint) => NotificationLevel;
}

export const useNotifications = create<NotificationsStore>((set, get) => ({
  ...loadPrefs(),
  setServer: (id, level) =>
    set(s => {
      const servers = s.servers;
      servers.set(id, level);
      savePrefs({ servers, channels: s.channels });
      return { servers };
    }),
  setChannel: (id, level) =>
    set(s => {
      const channels = s.channels;
      channels.set(id, level);
      savePrefs({ servers: s.servers, channels });
      return { channels };
    }),
  effective: (serverId, channelId) => {
    const { channels, servers } = get();
    const c = channels.get(channelId);
    if (c)
      return c;
    const s = serverId != null && servers.get(serverId);
    if (s)
      return s;
    return NotificationLevel.MentionsAndEveryone;
  }
}));
