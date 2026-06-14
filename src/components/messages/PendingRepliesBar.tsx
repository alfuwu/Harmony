import { useChannelState } from "../../lib/state/Channels";
import { useUserState } from "../../lib/state/Users";
import { t, useLocale } from "../../lib/i18n/Index";
import { Name } from "../layout/Generic";
import { useServerState } from "../../lib/state/Servers";
import { RenderContext, RenderMarkdown } from "../../lib/utils/MarkdownRenderer";
import { useAuthState } from "../../lib/state/Auth";

export default function PendingRepliesBar() {
  useLocale();
  const { userSettings } = useAuthState();
  const serverState = useServerState();
  const channelState = useChannelState();
  const userState = useUserState();
  const { currentChannel } = channelState;

  const markdownData: RenderContext = {
    serverState,
    channelState,
    userState,
    userSettings
  };

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
          return (
            <div key={msg.id} className="pending-reply-item">
              <Name
                user={author ?? null}
                member={userState.getMember(author?.id, currentChannel.serverId)}
                serverState={serverState}
                md={markdownData}
                allowDmColors={!!!serverState.currentServer}
                className="pending-reply-author"
              />
              <span className="pending-reply-content">
                {RenderMarkdown({
                  content: msg.content,
                  noBigEmoji: true,
                  forceInline: true,
                  maxLength: 32,
                  userState,
                  serverState,
                  channelState,
                  userSettings
                })}
              </span>
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