import { useState } from "react";
import { getSs } from "../../../lib/state/Servers";
import { createServer, loadServer } from "../../../lib/api/ServerApi";
import { t, useLocale } from "../../../lib/i18n/Index";

export default function CreateServerModal({ open, onClose }: any) {
  useLocale();
  const { setCurrentServer, addServer } = getSs();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [invites, setInvites] = useState("");

  async function submit() {
    const s = await createServer(
      name,
      description || undefined,
      tags ? tags.split(",").map(t => t.trim()) : undefined,
      invites ? invites.split(",").map(i => i.trim()) : undefined
    );

    await loadServer(s);
    addServer(s);
    setCurrentServer(s);
    onClose();
    setName("");
    setDescription("");
    setTags("");
    setInvites("");
  }

  return (
    <div className={"modal-backdrop" + (open ? " open" : "")} onClick={_ => onClose()}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        <h2>{t("create_server.title")}</h2>

        <input
          placeholder={t("create_server.placeholder.name")}
          id="srvname"
          autoComplete="off"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <textarea
          placeholder={t("create_server.placeholder.desc")}
          id="srvdesc"
          autoComplete="off"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <input
          placeholder={t("create_server.placeholder.tags")}
          id="srvtags"
          autoComplete="off"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />

        <input
          placeholder={t("create_server.placeholder.invites")}
          id="srvurls"
          autoComplete="off"
          value={invites}
          onChange={e => setInvites(e.target.value)}
        />

        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onClose}>{t("cancel")}</button>
          <button className="create-btn" onClick={submit}>{t("create")}</button>
        </div>
      </div>
    </div>
  );
}
