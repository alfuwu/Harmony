import { useLayoutEffect, useRef, useState } from "react";
import { Member, User } from "../../../lib/utils/types";
import { getAvatar, getDisplayName, getRoleColor } from "../../../lib/utils/UserUtils";
import { ServerState } from "../../../lib/state/Servers";

interface UserPopoutProps {
  user: User;
  member?: Member;
  serverState?: ServerState;
  onClose: () => void;
  position: { top: number; left?: number; right?: number; };
}

export default function UserPopout({ user, member, serverState, onClose, position }: UserPopoutProps) {
  const name = getDisplayName(user, member);
  const avatar = getAvatar(user, member);
  const roleColor = serverState ? getRoleColor(serverState, user, member, true) : undefined;
  
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, []);

  const clampedLeft = position.left ? Math.max(0, Math.min(position.left, window.innerWidth - size.width)) : undefined;
  const clampedRight = position.right ? Math.max(0, Math.min(position.right, window.innerWidth + size.width)) : undefined;
  const clampedTop = Math.max(0, Math.min(position.top, window.innerHeight - size.height));

  return (
    <div
      ref={ref}
      className="user-popout"
      style={{
        position: "fixed",
        top: clampedTop,
        left: clampedLeft ? clampedLeft : clampedRight! - size.width,
        zIndex: 1000,
        background: "var(--bg-3)",
        border: "1px solid #ccc",
        borderRadius: "6px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: "8px",
        minWidth: "200px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
        <img src={avatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: "50%", marginRight: "8px" }} />
        <span style={{ fontFamily: `${member?.nameFont}, ${user.nameFont}, Inter, Avenir, Helvetica, Arial, sans-serif`, color: roleColor ?? undefined }}>{name}</span>
      </div>
      <div>
        <strong>Username:</strong> @{user.username}
      </div>
      <div>
        <strong>ID:</strong> {user.id}
      </div>
      <button onClick={onClose} style={{ marginTop: "8px" }}>Close</button>
    </div>
  );
}
