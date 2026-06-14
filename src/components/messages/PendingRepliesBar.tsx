import { useChannelState } from "../../lib/state/Channels";
import { useUserState } from "../../lib/state/Users";
import { t, useLocale } from "../../lib/i18n/Index";

export default function PendingRepliesBar() {
  useLocale();
  const channelState = useChannelState();
  const userState = useUserState();
  const { currentChannel } = channelState;

  if (!currentChannel)
    return null;

  const replies = channelState.getPendingReplies(currentChannel.id);
  if (replies.length === 0)
    return null;

  return (
    <div className="pending-replies-bar">
      <div className="pending-replies-header">
        <span>{t("replies.replying_to", { count: replies.length })}</span>
        <button
          className="uno"
          title={t("replies.clear_all")}
          onClick={() => channelState.clearPendingReplies(currentChannel.id)}
        >
          ✕
        </button>
      </div>
      <div className="pending-replies-list">
        {replies.map(msg => {
          const author = userState.get(msg.authorId);
          const name = author?.displayName ?? author?.username ?? t("replies.unknown");
          const preview = msg.content.length > 72
            ? msg.content.slice(0, 72) + "..."
            : msg.content;
          return (
            <div key={msg.id} className="pending-reply-item">
              <span className="pending-reply-author">{name}</span>
              <span className="pending-reply-content">{preview}</span>
              <button
                className="uno"
                title={t("remove")}
                onClick={() => channelState.removePendingReply(currentChannel.id, msg.id)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}