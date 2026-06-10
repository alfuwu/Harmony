import { ServerState } from "../../lib/state/Servers";
import { roleToStyle } from "../../lib/utils/funcs";
import { RenderContext, RenderMarkdown } from "../../lib/utils/MarkdownRenderer";
import { Member, User } from "../../lib/utils/types";
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
  serverState?: ServerState;
  allowDmColors?: boolean;
  md?: RenderContext;
  spoilerState?: React.MutableRefObject<Map<number, boolean>>;
  as?: "span" | "div";
};

export function Name({ user, member, serverState, allowDmColors = false, md, spoilerState, as = "span", ...opts }: Props) {
  const Component = as ?? "span";

  const role = serverState && member && getDisplayRole(serverState, member, true);
  const textStyle = role ? roleToStyle(role) : {};
  const name = getDisplayName(user, member);

  return (
    <Component
      {...opts}
      style={{
        ...opts.style,
        ...textStyle,
        fontFamily: member?.nameFont || user?.nameFont ?
          `"${member?.nameFont ?? ""}", "${user?.nameFont ?? ""}", ${opts.style?.fontFamily}, Inter, sans-serif` :
          opts.style?.fontFamily,
        // @ts-expect-error
        "--author-hover": textStyle.background ?? "currentColor"
      }}
    >
      {md ? RenderMarkdown({
        content: name,
        spoilerStateRef: spoilerState,
        allowBlocks: false,
        ...md
      }) : name}
    </Component>
  )
}