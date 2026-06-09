import { Role, RoleDisplayType } from "./types";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function intToHex(n: number) {
  return `#${(n >>> 0).toString(16).padStart(6, "0")}`;
}

export function roleToStyle(role: Role, textClip: boolean = true): React.CSSProperties {
  const extra = textClip ? {
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent"
  } : {};

  switch (role.displayType) {
    case RoleDisplayType.Normal:
      return {
        color: role.color != null ? `#${role.color.toString(16).padStart(6, "0")}` : undefined
      };

    case RoleDisplayType.Gradient:
      if (!role.colors?.length)
        return {};

      return {
        background: `linear-gradient(90deg, ${role.colors
          .map(c => `#${c.toString(16).padStart(6, "0")}`)
          .join(", ")})`,
        ...extra
      };

    case RoleDisplayType.Glow:
      return {
        color: role.color != null ? `#${role.color.toString(16).padStart(6, "0")}` : undefined,
        textShadow: role.color != null
          ? `0 0 6px #${role.color.toString(16).padStart(6, "0")}`
          : undefined
      };

    case RoleDisplayType.GradientGlow:
      if (!role.colors?.length)
        return {};

      const gradient = `linear-gradient(90deg, ${role.colors
        .map(c => `#${c.toString(16).padStart(6, "0")}`)
        .join(", ")})`;

      return {
        background: gradient,
        ...extra,
        textShadow: "0 0 8px rgba(0,0,0,0.4)"
      };

    default:
      return {};
  }
}