import { ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { rootRef } from "../../App";

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export default function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handler, true);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler, true);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  // Clamp position to viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuW = 200;
  //const menuH = items.length * 34 + 8;
  const x = Math.min(position.x, vw - menuW - 8);
  const y = Math.min(position.y, vh - 8);

  return createPortal(
    <div
      ref={ref}
      className="ven-colors context-menu"
      style={{ position: "fixed", top: y, left: x, zIndex: 10000 }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="context-menu-divider" />
        ) : (
          <button
            key={i}
            className={`context-menu-item${item.danger ? " danger" : ""}${item.disabled ? " disabled" : ""}`}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose(); } }}
            disabled={item.disabled}
          >
            {item.icon && <span className="context-menu-icon">{item.icon}</span>}
            {item.label}
          </button>
        )
      )}
    </div>,
    rootRef.current ?? document.body
  );
}