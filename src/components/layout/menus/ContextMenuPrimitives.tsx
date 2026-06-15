import { ReactNode } from "react";

export function MenuLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "var(--text-5)",
        padding: "4px 10px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
    >
      {label}
    </div>
  );
}

export function Separator() {
  return <div style={{ height: 1, background: "var(--border)", margin: "4px 6px" }} />;
}

export function MenuButton({
  icon,
  label,
  danger = false,
  disabled = false,
  onClick
}: {
  icon?: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 10px",
        borderRadius: 6,
        border: "none",
        background: "none",
        color: danger ? "var(--red-1)" : disabled ? "var(--text-5)" : "var(--text-3)",
        fontSize: 13,
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        width: "100%",
        transition: "background 80ms"
      }}
      onMouseEnter={e => {
        if (!disabled)
          (e.currentTarget as HTMLButtonElement).style.background = danger
            ? "color-mix(in hsl, var(--red-1), transparent 82%)"
            : "var(--bg-3)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "none";
      }}
    >
      {icon && (
        <span style={{ fontSize: 14, width: 18, textAlign: "center", flexShrink: 0 }}>
          {icon}
        </span>
      )}
      {label}
    </button>
  );
}

export function ContextMenuShell({
  refProp,
  x,
  y,
  width,
  children
}: {
  refProp: React.RefObject<HTMLDivElement>;
  x: number;
  y: number;
  width: number;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={refProp}
      className="uno ven-colors"
      style={{
        position: "fixed",
        top: y,
        left: x,
        zIndex: 10000,
        width,
        background: "var(--bg-2)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        padding: "5px 4px",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {children}
    </div>
  );
}
