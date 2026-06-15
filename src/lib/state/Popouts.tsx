import React, { useEffect, createRef } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { rootRef } from "../../App";

export interface PopoutState {
  open: (popout: Popout) => void;
  close: (id: string) => void;
}

export interface Popout {
  id: string;
  element: React.ReactNode;
  options: any;
  closeWhenClickOutside?: boolean;
  ref?: React.RefObject<HTMLDivElement>;
  triggerRef?: React.RefObject<HTMLElement>;
}

const recentlyClosed = new Map<string, number>();

interface PopoutStoreState {
  items: Popout[];
  open: (popout: Popout) => void;
  close: (id: string) => void;
  closeAll: () => void;
}

const usePopoutStore = create<PopoutStoreState>((set, get) => ({
  items: [],

  open: (popout) =>
    set(state => {
      const closedAt = recentlyClosed.get(popout.id);
      if (closedAt !== undefined && Date.now() - closedAt < 100)
        return state;

      const exists = state.items.find(i => i.id === popout.id);
      if (exists) {
        return {
          items: state.items.map(i =>
            i.id === popout.id
              ? { ...i, element: popout.element, options: popout.options, ref: createRef<HTMLDivElement>() }
              : i
          ),
        };
      }
      return { items: [...state.items, { ...popout, ref: createRef<HTMLDivElement>() }] };
    }),

  close: (id) =>
    set(state => ({ items: state.items.filter(i => i.id !== id) })),

  closeAll: () =>
    set(state => {
      const now = Date.now();
      state.items
        .filter(i => i.closeWhenClickOutside !== false)
        .forEach(i => recentlyClosed.set(i.id, now));
      return { items: state.items.filter(i => i.closeWhenClickOutside === false) };
    }),
}));

const containerStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  pointerEvents: "none"
};

export const PopoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const items = usePopoutStore(s => s.items);
  const closeAll = usePopoutStore(s => s.closeAll);

  useEffect(() => {
    function handleGlobalMouseUp(event: MouseEvent) {
      if (items.length === 0)
        return;

      for (const item of items) {
        const node = item.ref?.current;
        if (node && node.contains(event.target as Node))
          return;
      }

      closeAll();
    }

    document.addEventListener("mouseup", handleGlobalMouseUp, { capture: true });

    return () => document.removeEventListener("mouseup", handleGlobalMouseUp, { capture: true });
  }, [items, closeAll]);

  return (
    <>
      {children}
      {createPortal(
        <div className="ven-colors" style={containerStyle}>
          {items.map(item => (
            <div
              key={item.id}
              style={item.options.style ? { pointerEvents: "auto", ...item.options.style } : { pointerEvents: "auto" }}
              ref={item.ref}
            >
              {item.element}
            </div>
          ))}
        </div>,
        rootRef.current ?? document.body
      )}
    </>
  );
};

export const usePopoutState = (): PopoutState => {
  return usePopoutStore(useShallow((s: PopoutStoreState) => ({ open: s.open, close: s.close })));
};

export const getPs = () => usePopoutState();