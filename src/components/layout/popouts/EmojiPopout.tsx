import { useLayoutEffect, useRef, useState } from "react";
import { renderEmoji } from "../../../lib/utils/Markdown";
import { UserSettings } from "../../../lib/utils/userSettings";

interface EmojiPopoutProps {
  emoji: string;
  emojiName: string;
  userSettings: UserSettings | null;
  position: { top: number; left?: number; right?: number; };
}

export default function EmojiPopout({ emoji, emojiName, userSettings, position }: EmojiPopoutProps) {
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
      className="emoji-popout uno"
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
        maxWidth: "300px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: "4px" }}>
        {renderEmoji(userSettings, emoji, "emoji-big")}
        <div style={{ display: "flex", flexDirection: "column", marginLeft: "15px" }}>
          <b>:{emojiName}:</b>
          <span>A default emoji. You do not need to join any servers to use it.</span>
        </div>
      </div>
    </div>
  );
}
