import { getEmojiDataFromNative } from "emoji-mart";
import EmojiPopout from "../../components/layout/popouts/EmojiPopout";
import { loadServer } from "../api/ServerApi";
import { getCs } from "../state/Channels";
import { getSs } from "../state/Servers";
import { getUs } from "../state/Users";
import { AbstractChannel, Emoji, Member, Role, RoleDisplayType, Server, User } from "./Types";
import { AnimateContext } from "./UserSettings";
import { RenderContext } from "./MarkdownRenderer";
import { Popout } from "../state/Popouts";
import { localeFromLanguage } from "../i18n/LocaleMap";
import { userSettings } from "../state/Auth";
import { ReactNode, useCallback, useState } from "react";
import { NotificationLevel, useNotifications } from "../state/Notifications";
import { getServerId } from "./ChannelUtils";

const NON_STANDARD_LOCALES = new Set([
  'miu','anl','jei','sjn','vk','wia',
  'en_PI','en_1337','en_PL','tlh','en_LOL','en_emodeng','en_YD','en_UWU'
]);

export function isFlag(native: string): boolean {
  const pts = [...(native ?? "")].map(c => c.codePointAt(0) ?? 0);
  return pts.length === 2 && pts.every(p => p >= 0x1f1e6 && p <= 0x1f1ff);
}

export function normalizeEmojiId(native: string, id?: string): string {
  let n = (id ?? "").replace(/-/g, "_");
  if (native && isFlag(native) && !n.startsWith("flag_") && !n.startsWith("regional_"))
    n = `flag_${n}`;
  return n;
}

export function getDateLocale(language?: number | null): string | undefined {
  if (language == null)
    return undefined;
  const locale = localeFromLanguage(language);
  if (NON_STANDARD_LOCALES.has(locale))
    return 'en-GB';
  return locale.replace('_', '-');
}

export function isMentioned(msg: {
  mentions?: number[] | null;
  mentionRoles?: number[] | null;
  mentionsEveryone?: boolean | null;
}, userId: number, serverId: number | undefined): boolean {
  if (msg.mentionsEveryone)
    return true;
  if (msg.mentions?.includes(userId))
    return true;
  if (serverId && msg.mentionRoles) {
    const member = getUs().getMember(userId, serverId);
    if (member?.roles.some(r => msg.mentionRoles!.includes(r)))
      return true;
  }
  return false;
}

export function sendDesktopNotification(
  authorName: string,
  content: string,
  channelId: number,
  mention: boolean
) {
  if (Notification.permission !== 'granted')
    return;

  const settings = userSettings();
  if (settings?.muteAllNotifications)
    return;
  if (!settings?.enableDesktopNotifications)
    return;

  const serverId = getServerId(channelId);
  const level = useNotifications.getState().effective(serverId, channelId);

  if (level === NotificationLevel.None)
    return;
  if (level === NotificationLevel.MentionsAndEveryone && !mention)
    return;
  if (level === NotificationLevel.DirectMentions && !mention)
    return;

  const body = settings?.showNotificationPreview
    ? (content.length > 100 ? content.slice(0, 100) + '...' : content)
    : 'New message';

  try {
    new Notification(authorName, { body, silent: !settings?.enableSoundNotifications });
  } catch {}
}

export function formatDate(iso: string, locale?: string) {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric", month: "short", day: "numeric"
  });
}

export function lerp(a: number, b: number, t: number) {
  return a + t * (b - a);
}

export function toHash(string: string) {
  let hash = 0;
  
  if (string.length == 0)
    return hash;

  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return hash;
}

export function intToHex(n: number) {
  return `#${(n >>> 0).toString(16).padStart(6, "0")}`;
}

export function isGradientRole(role: Role): boolean {
  return role.displayType === RoleDisplayType.Gradient || role.displayType === RoleDisplayType.GradientGlow;
}

export function getRoleGlowClass(role: Role): string {
  if (role.displayType !== RoleDisplayType.Glow && role.displayType !== RoleDisplayType.GradientGlow)
    return "";
  switch (userSettings()?.glowRoleAnimate ?? AnimateContext.Always) {
    case AnimateContext.OnHover:
      return "role-glow-hover";
    case AnimateContext.OnClick:
      return "role-glow-click";
    default:
      return "";
  }
}

export function roleToStyle(
  role: Role,
  textClip: boolean = true,
  enableAnimation: boolean = false
): React.CSSProperties {
  const extra = textClip ? {
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent"
  } : {};
  // @ts-expect-error
  // somewhat mitigates the issue of text decorations on gradient roles for Gecko-based browsers
  extra["color"] = role.colors?.length != null ? `#${role.colors[0].toString(16).padStart(6, "0")}` : undefined

  switch (role.displayType) {
    case RoleDisplayType.Normal:
      return {
        color: role.color != null ? intToHex(role.color) : undefined
      };

    case RoleDisplayType.Gradient: {
      if (!role.colors?.length)
        return {};

      const gradient = `linear-gradient(90deg, ${role.colors.map(intToHex).join(", ")})`;
      return {
        background: gradient,
        // @ts-expect-error
        "--role-fallback-color": intToHex(role.colors[0]),
        ...extra
      } as React.CSSProperties;
    }

    case RoleDisplayType.Glow: {
      if (role.color == null)
        return {};

      const hex = intToHex(role.color);
      const ctx = userSettings()?.glowRoleAnimate ?? AnimateContext.Always;
      const alwaysOn = enableAnimation && (ctx === AnimateContext.Always || ctx === AnimateContext.WhenFocused);

      return {
        color: hex,
        textShadow: `0 0 8px ${hex}`,
        "--role-glow-color": hex,
        ...(alwaysOn ? { animation: "glow-pulse-text 2s ease-in-out infinite" } : {})
      } as React.CSSProperties;
    }

    case RoleDisplayType.GradientGlow: {
      if (!role.colors?.length)
        return {};

      const firstHex = intToHex(role.colors[0]);
      const colors = role.colors.map(intToHex);
      const gradient = `linear-gradient(90deg, ${colors.concat(colors.slice(undefined, colors.length - 1).reverse()).join(", ")})`;
      const ctx = userSettings()?.glowRoleAnimate ?? AnimateContext.Always;
      const alwaysOn = enableAnimation && (ctx === AnimateContext.Always || ctx === AnimateContext.WhenFocused);

      return {
        background: gradient,
        backgroundSize: "200% 200%",
        // @ts-expect-error
        "--role-fallback-color": firstHex,
        "--role-glow-color": firstHex,
        filter: `drop-shadow(0 0 6px ${firstHex})`,
        ...extra,
        ...(alwaysOn ? { animation: "gradient-glow-pulse 2s linear infinite", "--author-hover-animation": "gradient-glow-pulse 2s linear infinite" } : {})
      } as React.CSSProperties;
    }

    default:
      return {};
  }
}

export function roleToMention(
  role: Role,
  enableAnimation: boolean = false
): React.CSSProperties {
  switch (role.displayType) {
    case RoleDisplayType.Normal:
      return {
        // @ts-expect-error
        "--special-mention-color": role.color != null ? intToHex(role.color) : undefined
      };
 
    case RoleDisplayType.Gradient: {
      if (!role.colors?.length)
        return {};

      const gradient = `linear-gradient(90deg, ${role.colors.map(c => intToHex(c) + "2d").join(", ")})`;
      const gradientHover = `linear-gradient(90deg, ${role.colors.map(c => intToHex(c) + "4d").join(", ")})`;
      return {
        "--special-mention-background": gradient,
        "--special-mention-background-hover": gradientHover,
        "--special-mention-color": intToHex(role.colors[0])
      } as React.CSSProperties;
    }

    case RoleDisplayType.Glow: {
      if (role.color == null)
        return {};

      const hex = intToHex(role.color);
      const ctx = userSettings()?.glowRoleAnimate ?? AnimateContext.Always;
      const alwaysOn = enableAnimation && (ctx === AnimateContext.Always || ctx === AnimateContext.WhenFocused);

      return {
        "--special-mention-color": hex,
        "--role-glow-color": hex,
        ...(alwaysOn ? { animation: "glow-pulse-text 2s ease-in-out infinite" } : {})
      } as React.CSSProperties;
    }

    case RoleDisplayType.GradientGlow: {
      if (!role.colors?.length)
        return {};

      const firstHex = intToHex(role.colors[0]);
      const colors1 = role.colors.map(c => intToHex(c) + "2d");
      const colors2 = role.colors.map(c => intToHex(c) + "6d");
      const gradient = `linear-gradient(90deg, ${colors1.concat(colors1.slice(undefined, colors1.length - 1).reverse()).join(", ")})`;
      const gradientHover = `linear-gradient(90deg, ${colors2.concat(colors2.slice(undefined, colors2.length - 1).reverse()).join(", ")})`;
      const ctx = userSettings()?.glowRoleAnimate ?? AnimateContext.Always;
      const alwaysOn = enableAnimation && (ctx === AnimateContext.Always || ctx === AnimateContext.WhenFocused);

      return {
        backgroundSize: "200% 200%",
        "--special-mention-background": gradient,
        "--special-mention-background-hover": gradientHover,
        "--special-mention-color": firstHex,
        "--role-glow-color": firstHex,
        filter: `drop-shadow(0 0 6px ${firstHex})`,
        ...(alwaysOn ? { animation: "gradient-glow-pulse 2s linear infinite" } : {})
      } as React.CSSProperties;
    }

    default:
      return {};
  }
}

export function makeMarkdownContext(
  openPopout?: (popout: Popout) => void,
  openUserPopout?: (target: Element, u: User, m: Member | undefined) => void,
  onToggleDetails?: () => void
): RenderContext {
  return {
    onMentionClick: (u: User, m: Member, event: React.MouseEvent) => {
      if (!openUserPopout)
        return;

      event.stopPropagation();
      event.preventDefault();
      openUserPopout(event.currentTarget, u, m);
    },
    onChannelClick: (channel: AbstractChannel, event: React.MouseEvent) => {
      event.stopPropagation();
      const cs = getCs();
      if (cs.currentChannel?.id !== channel.id) {
        event.preventDefault();
        const ss = getSs();
        if (ss.currentServer?.id !== channel.serverId) {
          const s = ss.get(channel.serverId);
          if (s) {
            loadServer(s);
            ss.setCurrentServer(s);
          } else return;
        }
        cs.setCurrentChannel(channel);
      }
    },
    onServerClick: (server: Server, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      const ss = getSs();
      if (ss.currentServer?.id !== server.id) {
        loadServer(server);
        ss.setCurrentServer(server);
        getCs().setCurrentChannel(null);
      }
    },
    onEmojiClick: async (emoji: Emoji, event: React.MouseEvent) => {
      if (!openPopout)
        return;

      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const name = !!!emoji.id && await getEmojiDataFromNative(emoji.name);
      openPopout({
        id: "emoji",
        element: (
          <EmojiPopout
            emoji={emoji}
            emojiId={name?.id}
            position={{
              top: rect.bottom + window.scrollY,
              left: rect.right + window.scrollX
            }}
          />
        ),
        options: {}
      });
    },
    onToggleDetails
  }
}

export function useModal(): [
  ReactNode,
  (node: ReactNode) => void,
  () => void
] {
  const [modal, setModal] = useState<ReactNode>(null);
  const openModal  = useCallback((node: ReactNode) => setModal(node), []);
  const closeModal = useCallback(() => setModal(null), []);
  return [modal, openModal, closeModal];
}
