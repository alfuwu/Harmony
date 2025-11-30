import { useState } from "react";
import { useAuthState } from "../../../lib/state/Auth";
import { useServerState } from "../../../lib/state/Servers";
import { createServer, loadServer } from "../../../lib/api/serverApi";
import { useChannelState } from "../../../lib/state/Channels";
import { useMemberState } from "../../../lib/state/Members";

export default function CreateServerModal({ open, onClose }: any) {
  const { token } = useAuthState();
  const { setCurrentServer, addServer } = useServerState();
  const channelState = useChannelState();
  const memberState = useMemberState();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [invites, setInvites] = useState("");

  async function submit() {
    const s = await createServer(
      name,
      description || undefined,
      tags ? tags.split(",").map(t => t.trim()) : undefined,
      invites ? invites.split(",").map(i => i.trim()) : undefined,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    await loadServer(s, channelState, memberState, token!);
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
        <h2>Create Your Server</h2>

        <input
          placeholder="Name"
          id="srvname"
          autoComplete="off"
          value={name}
          onChange={e => setName(e.target.value)}
        />

        <textarea
          placeholder="Description (optional)"
          id="srvdesc"
          autoComplete="off"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        <input
          placeholder="Tags (comma separated)"
          id="srvtags"
          autoComplete="off"
          value={tags}
          onChange={e => setTags(e.target.value)}
        />

        <input
          placeholder="Invite URLs (comma separated)"
          id="srvurls"
          autoComplete="off"
          value={invites}
          onChange={e => setInvites(e.target.value)}
        />

        <div className="modal-buttons">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="create-btn" onClick={submit}>Create</button>
        </div>
      </div>
    </div>
  );
}
