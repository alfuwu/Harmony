import { useChannelState } from "../../lib/state/Channels";
import { useUserState } from "../../lib/state/Users";
import { getDisplayName } from "../../lib/utils/UserUtils";

interface TypingIndicatorProps {
  channelId: number | undefined;
  currentUserId: number | undefined;
}

export default function TypingIndicator({ channelId, currentUserId }: TypingIndicatorProps) {
  const { getTyping } = useChannelState();
  const { get } = useUserState();

  if (!channelId)
    return null;

  const typingIds = (getTyping(channelId) ?? []).filter(id => id !== currentUserId);
  if (typingIds.length === 0)
    return null;

  const names = typingIds
    .slice(0, 3)
    .map(id => {
      const u = get(id);
      return u ? getDisplayName(u) : "Someone";
    });

  let text: string;
  if (typingIds.length === 1) text = `${names[0]} is typing...`;
  else if (typingIds.length === 2) text = `${names[0]} and ${names[1]} are typing...`;
  else if (typingIds.length === 3) text = `${names[0]}, ${names[1]}, and ${names[2]} are typing...`;
  else text = `${typingIds.length.toLocaleString('en-US')} people are typing...`;

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