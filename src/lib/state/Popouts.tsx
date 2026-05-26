import { useState, useCallback, useContext, createRef, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createContext } from "react";
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
  triggerRef?: React.RefObject<HTMLElement>
}

export const PopoutContext = createContext<PopoutState | undefined>(undefined);

export const PopoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<Popout[]>([]);

  const recentlyClosedRef = useRef<Map<string, number>>(new Map());

  // doesn't actually close all popouts
  const closeAll = useCallback(() => {
    setItems(prev => {
      const now = Date.now();
      prev
        .filter(i => i.closeWhenClickOutside !== false)
        .forEach(i => recentlyClosedRef.current.set(i.id, now));
      return prev.filter(i => i.closeWhenClickOutside === false);
    });
  }, []);

  const open = useCallback((popout: Popout) => {
    setItems(prev => {
      const closedAt = recentlyClosedRef.current.get(popout.id);
      if (closedAt !== undefined && Date.now() - closedAt < 100) {
        //recentlyClosedRef.current.delete(popout.id);
        return prev; // stay closed
      }

      const exists = prev.find(i => i.id === popout.id);
      if (exists)
        return prev.map(i =>
          i.id === popout.id
            ? { ...i, element: popout.element, options: popout.options, ref: createRef<HTMLDivElement>() }
            : i
        );
      return [...prev, { ...popout, ref: createRef<HTMLDivElement>() }];
    });
  }, []);

  const close = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);
  
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

  const value = { open, close };

  return (
    <PopoutContext.Provider value={value}>
      {children}
      {createPortal(
        // @ts-expect-error
        <div className="ven-colors" style={containerStyle}>
          {items.map(item => (
            <div key={item.id} style={item.options.style ? {pointerEvents: "auto", ...item.options.style} : {pointerEvents: "auto"}} ref={item.ref}>
              {item.element}
            </div>
          ))}
        </div>,
        rootRef.current ?? document.body
      )}
    </PopoutContext.Provider>
  );
}

const containerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  pointerEvents: "none"
};

export const usePopoutState = (): PopoutState => {
  const ctx = useContext(PopoutContext);
  if (!ctx)
    throw new Error("usePopoutState must be used within a PopoutProvider");
  return ctx;
};
