import { ReactNode, useEffect, useRef } from "react";
import { NotificationLevel, NOTIF_LABELS, useNotifications } from "../../../lib/state/Notifications";
import { BanIcon, BellIcon, BellOffIcon } from "../../svgs/other/Icons";

interface Props {
  channelId: number;
  serverId?: number;
  isServer?: boolean;
  position: { top: number; left: number };
  onClose: () => void;
}

const ICONS: Record<NotificationLevel, ReactNode> = {
  [NotificationLevel.AllMessages]:         <BellIcon size={16} />,
  [NotificationLevel.MentionsAndEveryone]: <BellIcon size={16} />,
  [NotificationLevel.DirectMentions]:      <BellOffIcon size={16} />,
  [NotificationLevel.None]:                <BanIcon size={16} />
};

export default function NotificationLevelPopout({ channelId, serverId, isServer = false, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { effective, setChannel, setServer } = useNotifications();
  const current = effective(serverId, channelId);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        onClose();
    }
    document.addEventListener("mousedown", onMouseDown, true);
    return () => document.removeEventListener("mousedown", onMouseDown, true);
  }, [onClose]);

  function pick(level: NotificationLevel) {
    if (isServer && serverId != null)
      setServer(serverId, level);
    else
      setChannel(channelId, level);
    onClose();
  }

  const levels = [
    NotificationLevel.AllMessages,
    NotificationLevel.MentionsAndEveryone,
    NotificationLevel.DirectMentions,
    NotificationLevel.None
  ] as const;

  const top  = Math.min(position.top,  window.innerHeight - 220);
  const left = Math.min(position.left, window.innerWidth  - 252);

  return (
    <div
      ref={ref}
      className="uno ven-colors"
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 10001,
        width: 244,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        padding: "5px 4px",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-5)",
        padding: "4px 10px 6px"
      }}>
        {isServer ? "Server Notifications" : "Channel Notifications"}
      </div>
      {levels.map(level => (
        <button
          key={level}
          onClick={() => pick(level)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "7px 10px",
            borderRadius: 6,
            background: current === level
              ? "color-mix(in hsl, var(--accent-1), transparent 85%)"
              : "none",
            border: "none",
            color: current === level ? "var(--accent-1)" : "var(--text-3)",
            fontSize: 13,
            fontWeight: current === level ? 600 : 400,
            cursor: "pointer",
            textAlign: "left",
            transition: "background 80ms"
          }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>{ICONS[level]}</span>
          <span style={{ flex: 1 }}>{NOTIF_LABELS[level]}</span>
          {current === level && (
            <span style={{ color: "var(--accent-1)", fontWeight: 700, fontSize: 12 }}>✓</span>
          )}
        </button>
      ))}
    </div>
  );
}
