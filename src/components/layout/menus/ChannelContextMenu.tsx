import { useEffect, useRef, useState } from "react";
import { AbstractChannel } from "../../../lib/utils/Types";
import NotificationLevelPopout from "../../layout/popouts/NotificationLevelPopout";
import ViewRawModal from "../../layout/modals/ViewRawModal";
import { MenuButton, MenuLabel, Separator, ContextMenuShell } from "./ContextMenuPrimitives";
import { BellIcon, CheckIcon, EditIcon, HammerIcon, HashIcon, TrashIcon } from "../../svgs/other/Icons";
import { userSettings } from "../../../lib/state/Auth";

interface Props {
  channel: AbstractChannel;
  serverId?: number;
  position: { x: number; y: number };
  canManageChannel?: boolean;
  onClose: () => void;
  onMarkRead?: () => void;
  onCopyId?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ChannelContextMenu({
  channel,
  serverId,
  position,
  canManageChannel = false,
  onClose,
  onMarkRead,
  onCopyId,
  onEdit,
  onDelete
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [rawOpen,   setRawOpen]   = useState(false);

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
    document.addEventListener("keydown",   onKey,  true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown",   onKey,  true);
    };
  }, [onClose]);

  const menuWidth = 220;
  const x = Math.min(position.x, window.innerWidth  - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - 280       - 8);

  function act(fn?: () => void) {
    fn?.();
    onClose();
  }

  if (rawOpen) {
    return (
      <ViewRawModal
        title="json.raw_channel"
        data={channel}
        onClose={() => { setRawOpen(false); onClose(); }}
      />
    );
  }

  return (
    <>
      <ContextMenuShell refProp={ref} x={x} y={y} width={menuWidth}>
        <MenuLabel label={channel.name ?? "Unknown Channel"} />
        <Separator />

        <MenuButton icon={<CheckIcon size={16} />} label="Mark as Read" onClick={() => act(onMarkRead)} />
        <Separator />

        <MenuButton
          icon={<BellIcon size={16} />}
          label="Notification Level..."
          onClick={() => setNotifOpen(true)}
        />
        <Separator />

        {canManageChannel && (
          <>
            <Separator />
            <MenuButton icon={<EditIcon size={16} />} label="Edit Channel" onClick={() => act(onEdit)} />
            <MenuButton icon={<TrashIcon size={16} />} label="Delete Channel" danger onClick={() => act(onDelete)} />
          </>
        )}

        {userSettings()?.developerMode && (
          <>
            <Separator />
            <MenuButton icon={<HashIcon size={16} />} label="Copy Channel ID" onClick={() => act(onCopyId)} />
            <MenuButton icon={<HammerIcon size={16} />} label="View Raw" onClick={() => setRawOpen(true)} />
          </>
        )}
      </ContextMenuShell>

      {notifOpen && (
        <NotificationLevelPopout
          channelId={channel.id}
          serverId={serverId}
          position={{ top: y, left: x + menuWidth + 4 }}
          onClose={() => { setNotifOpen(false); onClose(); }}
        />
      )}
    </>
  );
}


