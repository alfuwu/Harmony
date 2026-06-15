interface Props {
  mention?: boolean;
  count?: number;
  style?: React.CSSProperties;
}

/**
 * Renders either a small dot (unread, no mention) or a coloured pill
 * with a count (mention). Pass nothing/false for both to render null.
 */
export default function UnreadBadge({ mention = false, count, style }: Props) {
  if (mention) {
    const label = count != null && count > 0
      ? count > 99 ? "99+" : String(count)
      : "●";

    return (
      <div
        aria-label={`${count ?? 1} unread mention${count !== 1 ? "s" : ""}`}
        style={{
          background: "var(--red-1)",
          color: "#fff",
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          padding: label === "●" ? "4px" : "2px 5px",
          borderRadius: 99,
          minWidth: 16,
          textAlign: "center",
          flexShrink: 0,
          ...style
        }}
      >
        {label}
      </div>
    );
  }

  return (
    <div
      aria-label="Unread messages"
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--text-2)",
        flexShrink: 0,
        ...style
      }}
    />
  );
}
