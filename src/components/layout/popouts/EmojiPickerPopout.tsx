import { useLayoutEffect, useRef, useState } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface Props {
  position: {
    top: number;
    left?: number;
    right?: number;
  };
  onSelect: (emoji: string) => void;
}

export default function EmojiPickerPopout({
  position,
  onSelect,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current)
      return;

    const rect = ref.current.getBoundingClientRect();

    setSize({
      width: rect.width,
      height: rect.height,
    });
  }, []);

  const left =
    position.left !== undefined
      ? Math.max(
          8,
          Math.min(
            position.left,
            window.innerWidth - size.width - 8,
          ),
        )
      : undefined;

  const top = Math.max(
    8,
    Math.min(
      position.top,
      window.innerHeight - size.height - 8,
    ),
  );

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        top,
        left,
        zIndex: 1000,
        overflow: "hidden",
        borderRadius: 12,
        border: "1px solid var(--border)",
        boxShadow:
          "0 8px 28px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.25)",
      }}
    >
      <Picker
        data={data}
        previewPosition="none"
        skinTonePosition="search"
        searchPosition="sticky"
        navPosition="bottom"
        emojiButtonRadius="8px"
        emojiButtonSize={36}
        perLine={8}
        maxFrequentRows={2}
        theme="dark"
        onEmojiSelect={(emoji: any) => {
          onSelect(emoji.native);
        }}
      />
    </div>
  );
}