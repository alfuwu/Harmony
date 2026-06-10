import { useCallback, useEffect, useRef, useState } from "react";
import { MessageState } from "../../../lib/state/Messages";
import { RenderContext, RenderMarkdown } from "../../../lib/utils/MarkdownRenderer";
import { Member, Review, User } from "../../../lib/utils/types";
import { UserSettings } from "../../../lib/utils/userSettings";
import MessageInput, { MessageInputHandle } from "../../messages/MessageInput";
import { deleteReview, getReviews, submitReview, updateReview } from "../../../lib/api/userApi";
import { getAvatar } from "../../../lib/utils/UserUtils";
import { Name, SectionLabel } from "../Generic";
import { AuthState } from "../../../lib/state/Auth";
import { formatDate } from "../../../lib/utils/funcs";
import { t } from "../../../lib/i18n";
import { TranslationKeys } from "../../../lib/i18n/schema";

export const reviewsCache = new Map<number, Review[]>();

interface ReviewsModalProps {
  user: User;
  member?: Member;
  currentUser: User | null;
  ctx: RenderContext;
  messageState: MessageState;
  authState: { token: string | null; userSettings: UserSettings | null; user: User | null; };
  spoilerState: React.MutableRefObject<Map<number, boolean>>;
  opts: RequestInit;
  setPreviews: React.Dispatch<React.SetStateAction<Review[]>>;
  setCount: React.Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
}

export default function ReviewsModal({
  user,
  member,
  currentUser,
  ctx,
  messageState,
  authState,
  spoilerState,
  opts,
  setPreviews,
  setCount,
  onClose
}: ReviewsModalProps) {
  const [reviews, setReviewsInternal] = useState<Review[]>(reviewsCache.get(user.id) ?? []);
  const [loading, setLoading] = useState(!reviewsCache.has(user.id));
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null | undefined>("");
  const [submitting, setSubmitting] = useState(false);
  const getUser = ctx.userState?.getUser ?? (() => undefined);
  
  const inputRef = useRef<MessageInputHandle>(null);
  const myReview = reviews.find(r => r.authorId === currentUser?.id);

  const setReviews = (user: number, reviews: Review[]) => {
    reviewsCache.set(user, reviews);
    setReviewsInternal(reviews);
    setPreviews(reviews);
    setCount(reviews.length);
  }

  useEffect(() => {
    if (myReview)
      setDraft(myReview.content);
  }, [myReview?.content]);

  useEffect(() => {
    if (reviewsCache.has(user.id))
      return;
    let cancelled = false;
    setLoading(true);
    getReviews(user, opts)
      .then(data => {
        if (cancelled)
          return;
        setReviews(user.id, data);
      })
      .catch(() => {
        if (!cancelled)
          setError("error.reviews.load");
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user.id]);

  const handleSubmit = useCallback(async () => {
    if (!draft || !draft.trim() || submitting)
      return;
    setSubmitting(true);
    setError(null);
    try {
      if (myReview)
        await updateReview(user, draft.trim(), opts);
      else
        await submitReview(user, draft.trim(), opts);
      reviewsCache.delete(user.id);
      const fresh = await getReviews(user, opts);
      setReviews(user.id, fresh);
      setDraft("");
      inputRef.current?.setText("");
    } catch {
      setError("error.reviews.submit");
    } finally {
      setSubmitting(false);
    }
  }, [draft, myReview, submitting, user]);

  const handleDelete = useCallback(async () => {
    if (submitting)
      return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteReview(user, opts);
      reviewsCache.delete(user.id);
      const fresh = await getReviews(user, opts);
      setReviews(user.id, fresh);
      setDraft("");
    } catch {
      setError("error.reviews.delete");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, user]);

  const name = (
    <Name
      user={user}
      member={member}
      serverState={ctx.serverState}
      allowDmColors={true}
      md={ctx}
      spoilerState={spoilerState}
    />
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          zIndex: 1101,
          width: 400,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "80vh",
          borderRadius: 14,
          background: "var(--bg-3)",
          border: "1px solid var(--border)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          animation: "popout-in 160ms cubic-bezier(0.2,0,0,1.4) both",
          overflow: "hidden",
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-2)" }}>{t("reviews")}</div>
            <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 1 }}>
              {name}{"  ·  "}{t(reviews.length === 1 ? "reviews.count" : "reviews.count_plural", { count: reviews.length })}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 24, height: 24, padding: 0, borderRadius: 5, border: "none",
              background: "rgba(255,255,255,0.07)", color: "var(--text-4)",
              fontSize: 13, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0
            }}
          >✕</button>
        </div>

        <div
          className="ovy-auto"
          style={{ flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}
        >
          {loading && (
            <div style={{ color: "var(--text-5)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              {t("reviews.loading")}
            </div>
          )}
          {!loading && reviews.length === 0 && (
            <div style={{ color: "var(--text-5)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
              {t("reviews.empty")}
            </div>
          )}
          {reviews.map(review => {
            const isMine = review.authorId === currentUser?.id;
            const rUser = getUser(review.authorId) ?? null;
            
            return (
              <div
                key={review.authorId ?? review.content}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: isMine
                    ? "color-mix(in hsl, var(--accent-2), transparent 82%)"
                    : "color-mix(in hsl, var(--bg-4), transparent 40%)",
                  border: isMine
                    ? "1px solid color-mix(in hsl, var(--accent-2), transparent 55%)"
                    : "1px solid var(--border-light)"
                }}
              >
                <img
                  src={getAvatar(rUser)}
                  style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0, marginTop: 1 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 3 }}>
                    <Name
                      user={rUser}
                      serverState={ctx.serverState}
                      allowDmColors={true}
                      md={ctx}
                      spoilerState={spoilerState}
                      style={{
                        fontSize: 13,
                        fontWeight: 700
                      }}
                    />
                    {isMine && (
                      <span style={{ fontSize: 10, color: "var(--accent-1)", fontWeight: 600 }}>{t("you")}</span>
                    )}
                    {review.createdAt && (
                      <span style={{ fontSize: 11, color: "var(--text-5)", marginLeft: "auto", flexShrink: 0 }}>
                        {formatDate(review.createdAt)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-3)", lineHeight: 1.45, wordBreak: "break-word" }}>
                    {RenderMarkdown({ content: review.content, spoilerStateRef: spoilerState, ...ctx })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {currentUser && (
          <div style={{
            padding: "10px 14px 14px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}>
            <SectionLabel>{t(myReview ? "reviews.edit" : "reviews.write")}</SectionLabel>
            <div style={{
              resize: "none", width: "100%", padding: "7px 9px", borderRadius: 7,
              background: "var(--bg-1)", border: "1px solid var(--border)",
              color: "var(--text-2)", fontSize: 13, lineHeight: 1.45, outline: "none",
              boxSizing: "border-box", fontFamily: "inherit"
            }}>
              <MessageInput
                isChannel={false}
                initialText={draft}
                placeholder={
                  <>
                    {t("reviews.placeholder")}
                    {name}
                    {t("...")}
                  </>
                }
                setText={setDraft}
                authState={authState as AuthState}
                serverState={ctx.serverState}
                channelState={ctx.channelState}
                messageState={messageState}
                userState={ctx.userState}
                onEnter={() => handleSubmit()}
                ref={inputRef}
              />
            </div>
            
            {error && <div style={{ fontSize: 12, color: "var(--red-2)" }}>{t(error as TranslationKeys)}</div>}

            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              {myReview && (
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  style={{
                    padding: "5px 13px", borderRadius: 6, border: "none",
                    background: "color-mix(in hsl, var(--red-2), transparent 80%)",
                    color: "var(--red-2)", fontSize: 12, fontWeight: 600,
                    cursor: submitting ? "not-allowed" : "pointer",
                    opacity: submitting ? 0.6 : 1
                  }}
                >
                  {t("delete")}
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={!draft || !draft.trim() || submitting}
                style={{
                  padding: "5px 16px", borderRadius: 6, border: "none",
                  background: "var(--accent-1)", color: "#fff",
                  fontSize: 12, fontWeight: 600,
                  cursor: (!draft || !draft.trim() || submitting) ? "not-allowed" : "pointer",
                  opacity: (!draft || !draft.trim() || submitting) ? 0.5 : 1
                }}
              >
                {submitting ? t("saving") : myReview ? t("update") : t("submit")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}