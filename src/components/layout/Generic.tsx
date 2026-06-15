import { useNicknames } from "../../lib/state/Nicknames";
import { getRoleGlowClass, isGradientRole, roleToStyle } from "../../lib/utils/Funcs";
import { RenderContext, RenderMarkdown } from "../../lib/utils/MarkdownRenderer";
import { Member, Role, User } from "../../lib/utils/Types";
import { getDisplayName, getDisplayRole } from "../../lib/utils/UserUtils";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-5)",
        marginBottom: 4
      }}
    >
      {children}
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />;
}

type Props = React.HTMLAttributes<HTMLSpanElement | HTMLDivElement> & {
  user: User | null;
  member?: Member;
  allowDmColors?: boolean;
  md?: RenderContext;
  spoilerState?: React.MutableRefObject<Map<number, boolean>>;
  overRole?: Role; // haha get it "overrole" as in "overrule" im so funny
  prefix?: string;
  text?: string;
  as?: "span" | "div";
};

export function Name({ user, member, allowDmColors = false, md, spoilerState, as = "span", overRole, prefix, text, ...opts }: Props) {
  const Component = as ?? "span";
  const { get: getNickname } = useNicknames();
 
  const role = overRole ?? (member && getDisplayRole(member, true));
  const textStyle = role ? roleToStyle(role, true, true) : {};
  const personalNickname = user ? getNickname(user.id) : undefined;
  const name = text ?? personalNickname ?? getDisplayName(user, member);
 
  const extraClasses: string[] = [];
  if (role && isGradientRole(role))
    extraClasses.push("has-gradient-role");
  if (role) {
    const glowClass = getRoleGlowClass(role);
    if (glowClass)
      extraClasses.push(glowClass);
  }
 
  const combinedClassName = [opts.className, ...extraClasses].filter(Boolean).join(" ");
 
  return (
    <Component
      {...opts}
      className={combinedClassName}
      style={{
        ...opts.style,
        ...textStyle,
        fontFamily: member?.nameFont || user?.nameFont
          ? `"${member?.nameFont ?? ""}", "${user?.nameFont ?? ""}", ${opts.style?.fontFamily}, Inter, sans-serif`
          : opts.style?.fontFamily,
        "--author-hover": textStyle.background ?? textStyle.color ?? "currentColor",
        "--author-hover-size": textStyle.backgroundSize ?? undefined
      } as React.CSSProperties}
    >
      {prefix}{md ? RenderMarkdown({
        content: name,
        spoilerStateRef: spoilerState,
        allowBlocks: false,
        ...md
      }) : name}
    </Component>
  );
}
 