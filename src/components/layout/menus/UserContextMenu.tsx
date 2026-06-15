import { useEffect, useRef, useState } from "react";
import { User, Member } from "../../../lib/utils/Types";
import { useNicknames } from "../../../lib/state/Nicknames";
import NicknameModal from "../modals/NicknameModal";
import ViewRawModal from "../modals/ViewRawModal";
import { MenuButton, MenuLabel, Separator, ContextMenuShell } from "./ContextMenuPrimitives";
import { BanIcon, EditIcon, EyeIcon, HammerIcon, HashIcon, MessageIcon, PlusIcon, UserMinusIcon } from "../../svgs/other/Icons";
import { getAs, userSettings } from "../../../lib/state/Auth";

interface Props {
  user: User;
  member?: Member | null;
  position: { x: number; y: number };
  developerMode?: boolean;
  authToken: string;
  currentUserId?: number | null;
  isFriend?: boolean;
  onClose: () => void;
  onViewProfile?: () => void;
  onSendDm?: () => void;
  onAddFriend?: () => void;
  onRemoveFriend?: () => void;
  onBlock?: () => void;
  onCopyId?: () => void;
  onKick?: () => void;
  onBan?: () => void;
}

export default function UserContextMenu({
  user,
  member,
  position,
  isFriend = false,
  onClose,
  onViewProfile,
  onSendDm,
  onAddFriend,
  onRemoveFriend,
  onBlock,
  onCopyId,
  onKick,
  onBan
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);

  const { get: getNickname } = useNicknames();
  const isOwn = getAs().user?.id === user.id;

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

  const menuWidth = 220;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - 380 - 8);

  function act(fn?: () => void) {
    fn?.();
    onClose();
  }

  const hasNickname = Boolean(getNickname(user.id));

  if (nicknameOpen) {
    return (
      <NicknameModal
        user={user}
        onClose={() => { setNicknameOpen(false); onClose(); }}
      />
    );
  }

  if (rawOpen) {
    return (
      <ViewRawModal
        title="json.raw_user"
        data={member ? { user, member } : user}
        onClose={() => { setRawOpen(false); onClose(); }}
      />
    );
  }

  return (
    <ContextMenuShell refProp={ref} x={x} y={y} width={menuWidth}>
      <MenuLabel label={member?.nickname ?? user.displayName ?? user.username} />
      <Separator />

      {!isOwn && (
        <>
          <MenuButton icon={<EyeIcon size={16} />} label="View Profile" onClick={() => act(onViewProfile)} />
          <MenuButton icon={<MessageIcon size={16} />} label="Send Message" onClick={() => act(onSendDm)} />
          <Separator />
        </>
      )}

      {!isOwn && (
        isFriend
          ? <MenuButton icon="✖️" label="Remove Friend" danger onClick={() => act(onRemoveFriend)} />
          : <MenuButton icon={<PlusIcon size={16} />} label="Add Friend" onClick={() => act(onAddFriend)} />
      )}

      {!isOwn && (
        <MenuButton
          icon={<EditIcon size={16} />}
          label={hasNickname ? "Edit Nickname" : "Set Nickname"}
          onClick={() => setNicknameOpen(true)}
        />
      )}

      <Separator />

      {!isOwn && (
        <>
          {(onKick || onBan) && (
            <>
              <Separator />
              {onKick && <MenuButton icon={<UserMinusIcon size={16} />} label="Kick" danger onClick={() => act(onKick)} />}
              {onBan  && <MenuButton icon={<BanIcon size={16} />} label="Ban" danger onClick={() => act(onBan)} />}
            </>
          )}
          <Separator />
          <MenuButton icon={<BanIcon size={16} />} label="Block" danger onClick={() => act(onBlock)} />
        </>
      )}

      {userSettings()?.developerMode && (
        <>
          <Separator />
          <MenuButton icon={<HashIcon size={16} />} label="Copy User ID" onClick={() => act(onCopyId)} />
          <MenuButton icon={<HammerIcon size={16} />} label="View Raw" onClick={() => setRawOpen(true)} />
        </>
      )}
    </ContextMenuShell>
  );
}
