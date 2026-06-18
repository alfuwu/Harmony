import { ReactNode } from "react";
import { t, useLocale } from "../../lib/i18n/Index";
import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import { useUserState } from "../../lib/state/Users";
import { Name } from "../layout/Generic";

interface TypingIndicatorProps {
  channelId: bigint | undefined;
  currentUserId: bigint | undefined;
}

export default function TypingIndicator({ channelId, currentUserId }: TypingIndicatorProps) {
  useLocale();

  const { currentServer } = useServerState();
  const { getTyping } = useChannelState();
  const { get, getMember } = useUserState();

  if (channelId === undefined)
    return null;
  
  const typingIds = (getTyping(channelId) ?? []).filter(id => id !== currentUserId);
  if (typingIds.length === 0)
    return null;

  const names = typingIds
    .slice(0, 3)
    .map(id => {
      const u = get(id);
      const m = getMember(id, currentServer?.id);
      return (
        <b>
          <Name
            user={u!}
            member={m}
            md={{}}
            allowDmColors={!!!currentServer}
          />
        </b>
      );
    });

  let text: ReactNode;
  if (typingIds.length === 1) text = <>{names[0]}{t("messages.typing")}</>;
  else if (typingIds.length === 2) text = <>{names[0]}{t("messages.typing.conjoin1")}{names[1]}{t("messages.typing_plural")}</>;
  else if (typingIds.length < 5) text = (
    <>
      {names.map((name, i) => {
        if (i < typingIds.length - 2)
          return <>{name}{t("messages.typing.conjoin2")}</>
        else if (i === typingIds.length - 2)
          return name
      })}

      {t("messages.typing.conjoin3")}{names[names.length - 1]}
      {t("messages.typing_plural")}
    </>
  );
  else text = <>{t("messages.typing.many", { count: typingIds.length })}</>;

  return (
    <div className="typing-indicator uno">
      <span className="typing-dots">
        <span />
        <span />
        <span />
      </span>
      <span className="typing-text">{text}</span>
    </div>
  );
}