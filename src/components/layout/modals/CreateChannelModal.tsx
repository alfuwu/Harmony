import { useState } from "react";
import { getCs } from "../../../lib/state/Channels";
import { createChannel } from "../../../lib/api/ChannelApi";
import { ChannelType } from "../../../lib/utils/Types";
import { connection, joinChannel } from "../../../lib/api/SignalrClient";
import { t, useLocale } from "../../../lib/i18n/Index";
import { TranslationKeys } from "../../../lib/i18n/Schema";

interface CreateChannelModalProps {
  open: boolean;
  serverId: number;
  onClose: () => void;
}

const CHANNEL_TYPES: { value: ChannelType; labelKey?: TranslationKeys; label?: string }[] = [
  { value: ChannelType.Category, labelKey: "create_channel.type.category" },
  { value: ChannelType.Text, labelKey: "create_channel.type.text" },
  { value: ChannelType.Voice, labelKey: "create_channel.type.voice" },
  { value: ChannelType.Announcement, labelKey: "create_channel.type.announcement" },
  { value: ChannelType.Rules, labelKey: "create_channel.type.rules" },
  { value: ChannelType.Forum, labelKey: "create_channel.type.forum" },
  { value: ChannelType.Canvas, labelKey: "create_channel.type.canvas" },
  { value: ChannelType.Lounge, labelKey: "create_channel.type.lounge" },
  { value: ChannelType.Document, labelKey: "create_channel.type.document" }
];

export default function CreateChannelModal({ open, serverId, onClose }: CreateChannelModalProps) {
  useLocale();

  const { addChannel, setCurrentChannel } = getCs();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ChannelType>(ChannelType.Text);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      setError("create_channel.name_required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const channel = await createChannel(
        serverId, name.trim(), type,
        description.trim() || undefined
      );
      addChannel(channel);
      joinChannel(channel.id);
      connection?.invoke("JoinChannel", channel.id).catch(() => {});
      setCurrentChannel(channel);
      setName("");
      setDescription("");
      setType(ChannelType.Text);
      onClose();
    } catch (e: any) {
      setError(e.message ?? "create_channel.failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open)
    return null;

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
        <h2 style={{ margin: 0 }}>{t("create_channel.title")}</h2>

        <div className="form-group">
          <label>{t("create_channel.type")}</label>
          <select
            value={type}
            onChange={e => setType(Number(e.target.value) as ChannelType)}
            style={{ background: "var(--bg-1)", color: "var(--text-3)", border: "1px solid var(--button-border)", padding: "8px", borderRadius: 6 }}
          >
            {CHANNEL_TYPES.map(ct => (
              <option key={ct.value} value={ct.value}>
                {ct.labelKey ? t(ct.labelKey) : ct.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{t("create_channel.name")}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t("create_channel.placeholder.name")}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>{t("create_channel.description")}</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={t("create_channel.placeholder.desc")}
            style={{ resize: "vertical", minHeight: 60, background: "var(--bg-1)", color: "var(--text-3)", border: "1px solid var(--button-border)", borderRadius: 6, padding: "8px", fontFamily: "inherit", fontSize: "1em" }}
          />
        </div>

        {error && <div className="error-msg">{t(error as TranslationKeys)}</div>}

        <div className="modal-buttons">
          <button onClick={onClose}>{t("cancel")}</button>
          <button className="create-btn" onClick={handleCreate} disabled={loading}>
            {loading ? t("create_channel.creating") : t("create_channel.title")}
          </button>
        </div>
      </div>
    </div>
  );
}