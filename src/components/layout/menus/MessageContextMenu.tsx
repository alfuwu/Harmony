import { ReactNode, useEffect, useRef, useState } from "react";
import { Message } from "../../../lib/utils/Types";
import { useTranslations } from "../../../lib/state/Translations";
import ViewRawModal from "../../layout/modals/ViewRawModal";
import { CopyIcon, EditIcon, GlobeIcon, HammerIcon, HashIcon, PinIcon, ReplyIcon, SmileIcon, TrashIcon } from "../../svgs/other/Icons";
import { localeFromLanguage } from "../../../lib/i18n/LocaleMap";
import { getAs } from "../../../lib/state/Auth";

interface Action {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

type MenuItem = Action | "separator";

interface Props {
  message: Message;
  channelId: bigint;
  serverId?: bigint;
  position: { x: number; y: number };
  canManageMessages?: boolean;
  canPin?: boolean;
  onClose: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopyText?: () => void;
  onCopyId?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onReact?: () => void;
}

export default function MessageContextMenu({
  message,
  position,
  canManageMessages = false,
  canPin = false,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onCopyText,
  onCopyId,
  onPin,
  onUnpin,
  onReact
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [rawOpen, setRawOpen] = useState(false);

  const { entries, translate, dismiss } = useTranslations();
  const isTranslated = Boolean(entries.get(message.id));

  const { user: currentUser, userSettings } = getAs();

  const isOwn = message.authorId === currentUser?.id;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")
        onClose();
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const menuWidth  = 220;
  const menuHeight = 360;
  const x = Math.min(position.x, window.innerWidth  - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 8);

  function act(fn?: () => void) {
    fn?.();
    onClose();
  }

  const items: MenuItem[] = [
    {
      label: "Reply",
      icon: <ReplyIcon size={16} />,
      onClick: () => act(onReply)
    },
    {
      label: "Add Reaction",
      icon: <SmileIcon size={16} />,
      onClick: () => act(onReact)
    },
    "separator",
    ...(message.content
      ? [{
          label: isTranslated ? "Show Original" : "Translate Message",
          icon: <GlobeIcon size={16} />,
          onClick: () => {
            if (isTranslated)
              dismiss(message.id);
            else
              translate(message.id, message.content!, localeFromLanguage(userSettings?.language));
            onClose();
          }
        }]
      : []),
    {
      label: "Copy Text",
      icon: <CopyIcon size={16} />,
      disabled: !message.content,
      onClick: () => act(onCopyText)
    },
    "separator",
    ...(isOwn
      ? [{
          label: "Edit Message",
          icon: <EditIcon size={16} />,
          onClick: () => act(onEdit)
        }]
      : []),
    ...(canPin
      ? [{
          label: message.isPinned ? "Unpin Message" : "Pin Message",
          icon: <PinIcon size={16} />,
          onClick: () => act(message.isPinned ? onUnpin : onPin)
        }]
      : []),
    ...(isOwn || canManageMessages
      ? [{
          label: "Delete Message",
          icon: <TrashIcon size={16} />,
          danger: true,
          onClick: () => act(onDelete)
        }]
      : []),
    "separator",
    ...(userSettings?.developerMode
      ? [{
          label: "Copy Message ID",
          icon: <HashIcon size={16} />,
          onClick: () => act(onCopyId)
        },
        {
          label: "View Raw",
          icon: <HammerIcon size={16} />,
          onClick: () => { setRawOpen(true); }
        }]
      : [])
  ];

  const cleaned: MenuItem[] = [];
  for (const item of items) {
    if (item === "separator" && (cleaned.length === 0 || cleaned[cleaned.length - 1] === "separator"))
      continue;
    cleaned.push(item);
  }
  if (cleaned[cleaned.length - 1] === "separator")
    cleaned.pop();

  if (rawOpen) {
    return (
      <ViewRawModal
        title="json.raw_message"
        data={message}
        onClose={() => { setRawOpen(false); onClose(); }}
      />
    );
  }

  return (
    <>
      <div
        ref={ref}
        className="uno ven-colors"
        style={{
          position: "fixed",
          top: y,
          left: x,
          zIndex: 10000,
          width: menuWidth,
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          padding: "5px 4px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {cleaned.map((item, i) => {
          if (item === "separator")
            return (
              <div
                key={`sep-${i}`}
                style={{ height: 1, background: "var(--border)", margin: "4px 6px" }}
              />
            );

          return (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={item.disabled ? undefined : item.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                borderRadius: 6,
                border: "none",
                background: "none",
                color: item.danger
                  ? "var(--red-1)"
                  : item.disabled
                  ? "var(--text-5)"
                  : "var(--text-3)",
                fontSize: 13,
                cursor: item.disabled ? "default" : "pointer",
                textAlign: "left",
                transition: "background 80ms"
              }}
              onMouseEnter={e => {
                if (!item.disabled)
                  e.currentTarget.style.background = item.danger
                    ? "color-mix(in hsl, var(--red-1), transparent 82%)"
                    : "var(--bg-3)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "none";
              }}
            >
              {item.icon && (
                <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
