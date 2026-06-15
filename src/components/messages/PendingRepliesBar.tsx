import { useChannelState } from "../../lib/state/Channels";
import { useServerState } from "../../lib/state/Servers";
import { useUserState } from "../../lib/state/Users";
import { t, useLocale } from "../../lib/i18n/Index";
import { Name } from "../layout/Generic";
import { RenderMarkdown } from "../../lib/utils/MarkdownRenderer";

export default function PendingRepliesBar() {
  useLocale();

  const { currentServer } = useServerState();
  const { currentChannel, getPendingReplies, removePendingReply, clearPendingReplies } = useChannelState();
  const { get, getMember } = useUserState();

  if (!currentChannel)
    return null;

  const replies = getPendingReplies(currentChannel.id);
  if (replies.length === 0)
    return null;

  return (
    <div className="pending-replies-bar">
      <div className="pending-replies-header">
        <span>{t("replies.replying_to", { count: replies.length })}</span>
        <button
          className="uno"
          title={t("replies.clear_all")}
          onClick={() => clearPendingReplies(currentChannel.id)}
        >
          ✕
        </button>
      </div>
      <div className="pending-replies-list">
        {replies.map(msg => {
          const author = get(msg.authorId);
          return (
            <div key={msg.id} className="pending-reply-item">
              <Name
                user={author ?? null}
                member={getMember(author?.id, currentChannel.serverId)}
                md={{}}
                allowDmColors={!!!currentServer}
                className="pending-reply-author"
              />
              <span className="pending-reply-content">
                {RenderMarkdown({
                  content: msg.content,
                  noBigEmoji: true,
                  forceInline: true,
                  maxLength: 32
                })}
              </span>
              <button
                className="uno"
                title={t("remove")}
                onClick={() => removePendingReply(currentChannel.id, msg.id)}
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