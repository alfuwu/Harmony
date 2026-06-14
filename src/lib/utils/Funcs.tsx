import { getEmojiDataFromNative } from "emoji-mart";
import EmojiPopout from "../../components/layout/popouts/EmojiPopout";
import { loadServer } from "../api/ServerApi";
import { ChannelState } from "../state/Channels";
import { ServerState } from "../state/Servers";
import { UserState } from "../state/Users";
import { AbstractChannel, Member, Role, RoleDisplayType, Server, User } from "./Types";
import { AnimateContext, UserSettings } from "./UserSettings";
import { RenderContext } from "./MarkdownRenderer";
import { MessageState } from "../state/Messages";
import { Popout } from "../state/Popouts";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
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

export function getRoleGlowClass(role: Role, userSettings?: UserSettings | null): string {
  if (role.displayType !== RoleDisplayType.Glow && role.displayType !== RoleDisplayType.GradientGlow)
    return "";
  switch (userSettings?.glowRoleAnimate ?? AnimateContext.Always) {
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
  userSettings?: UserSettings | null,
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
      const ctx = userSettings?.glowRoleAnimate ?? AnimateContext.Always;
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
      const ctx = userSettings?.glowRoleAnimate ?? AnimateContext.Always;
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
  userSettings?: UserSettings | null,
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
      const ctx = userSettings?.glowRoleAnimate ?? AnimateContext.Always;
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
      const ctx = userSettings?.glowRoleAnimate ?? AnimateContext.Always;
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
  serverState: ServerState,
  channelState: ChannelState,
  userState: UserState,
  messageState: MessageState,
  userSettings: UserSettings | null,
  token: string | null,
  openPopout?: (popout: Popout) => void,
  openUserPopout?: (target: Element, u: User, m: Member | undefined) => void,
  onToggleDetails?: () => void
): RenderContext {
  return {
    serverState,
    channelState,
    userState,
    userSettings,
    onMentionClick: (u: User, m: Member, event: React.MouseEvent) => {
      if (!openUserPopout)
        return;

      event.stopPropagation();
      event.preventDefault();
      openUserPopout(event.currentTarget, u, m);
    },
    onChannelClick: (channel: AbstractChannel, event: React.MouseEvent) => {
      event.stopPropagation();
      if (channelState.currentChannel?.id !== channel.id) {
        event.preventDefault();
        if (serverState.currentServer?.id !== channel.serverId) {
          const s = serverState.get(channel.serverId);
          if (s) {
            loadServer(s, channelState, userState, messageState, token!);
            serverState.setCurrentServer(s);
          } else return;
        }
        channelState.setCurrentChannel(channel);
      }
    },
    onServerClick: (server: Server, event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      if (serverState.currentServer?.id !== server.id) {
        loadServer(server, channelState, userState, messageState, token!);
        serverState.setCurrentServer(server);
        channelState.setCurrentChannel(null);
      }
    },
    onEmojiClick: async (emoji: string, event: React.MouseEvent) => {
      if (!openPopout)
        return;

      event.stopPropagation();
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const name = await getEmojiDataFromNative(emoji);
      openPopout({
        id: "emoji",
        element: (
          <EmojiPopout
            emoji={emoji}
            emojiName={name?.id ?? emoji}
            userSettings={userSettings}
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