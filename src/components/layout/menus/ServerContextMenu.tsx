import { useEffect, useRef, useState } from "react";
import { Server } from "../../../lib/utils/Types";
import { useServerArrangement } from "../../../lib/state/ServerArrangement";
import NotificationLevelPopout from "../../layout/popouts/NotificationLevelPopout";
import ViewRawModal from "../../layout/modals/ViewRawModal";
import { MenuButton, MenuLabel, Separator, ContextMenuShell } from "./ContextMenuPrimitives";
import CreateFolderModal from "../modals/CreateFolderModal";
import { BellIcon, CheckIcon, FolderIcon, HammerIcon, HashIcon, LogOutIcon, PlusIcon } from "../../svgs/other/Icons";
import { getAs, userSettings } from "../../../lib/state/Auth";

interface Props {
  server: Server;
  position: { x: number; y: number };
  developerMode?: boolean;
  isOwner?: boolean;
  onClose: () => void;
  onMarkAllRead?: () => void;
  onCopyId?: () => void;
  onInvite?: () => void;
  onSettings?: () => void;
  onLeave?: () => void;
}

export default function ServerContextMenu({
  server,
  position,
  onClose,
  onMarkAllRead,
  onCopyId,
  onInvite,
  onSettings,
  onLeave
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [folderPickOpen,  setFolderPickOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);

  const { folders, createFolder, addToFolder } = useServerArrangement();
  const folderList = Object.values(folders);

  const isOwner = getAs().user?.id === server.ownerId;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")
        onClose();
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown",   onKey,  true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown",   onKey,  true);
    };
  }, [onClose]);

  const menuWidth = 228;
  const x = Math.min(position.x, window.innerWidth  - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - 380       - 8);

  function act(fn?: () => void) {
    fn?.();
    onClose();
  }

  function handleAddToFolder(folderId: string) {
    addToFolder(server.id, folderId);
    onClose();
  }

  function handleNewFolder() {
    setFolderModalOpen(true);
  }

  function handleFolderCreated(name: string, color: string) {
    const id = createFolder(name, color);
    addToFolder(server.id, id);
    setFolderModalOpen(false);
    onClose();
  }

  if (rawOpen) {
    return (
      <ViewRawModal
        title="json.raw_server"
        data={server}
        onClose={() => { setRawOpen(false); onClose(); }}
      />
    );
  }

  return (
    <>
      <ContextMenuShell refProp={ref} x={x} y={y} width={menuWidth}>
        <MenuLabel label={server.name} />
        <Separator />

        <MenuButton icon={<CheckIcon size={16} />} label="Mark All as Read" onClick={() => act(onMarkAllRead)} />
        <Separator />

        <MenuButton
          icon={<BellIcon size={16} />}
          label="Notification Level..."
          onClick={() => setNotifOpen(true)}
        />
        <MenuButton
          icon={<FolderIcon size={16} />}
          label="Add to Folder..."
          onClick={() => setFolderPickOpen(v => !v)}
        />

        {folderPickOpen && (
          <div
            style={{
              margin: "4px 8px",
              padding: "4px",
              background: "var(--bg-1)",
              borderRadius: 8,
              border: "1px solid var(--border)"
            }}
          >
            {folderList.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-5)", padding: "6px 8px" }}>
                No folders yet
              </div>
            ) : (
              folderList.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleAddToFolder(f.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "none",
                    background: "none",
                    color: "var(--text-3)",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "none"; }}
                >
                  {f.color && (
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: f.color,
                        marginRight: 6,
                        verticalAlign: "middle"
                      }}
                    />
                  )}
                  {f.name}
                </button>
              ))
            )}
            <Separator />
            <button
              onClick={handleNewFolder}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 8px",
                borderRadius: 6,
                border: "none",
                background: "none",
                color: "var(--accent-1)",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                fontWeight: 600
              }}
            >
              + New Folder
            </button>
          </div>
        )}

        <Separator />

        {onInvite && <MenuButton icon={<PlusIcon size={16} />} label="Invite People" onClick={() => act(onInvite)} />}

        {(isOwner || onSettings) && (
          <>
            <Separator />
            {onSettings && <MenuButton icon="" label="Server Settings" onClick={() => act(onSettings)} />}
          </>
        )}

        {!isOwner && onLeave && (
          <>
            <Separator />
            <MenuButton icon={<LogOutIcon size={16} />} label="Leave Server" danger onClick={() => act(onLeave)} />
          </>
        )}

        {userSettings()?.developerMode && (
          <>
            <Separator />
            <MenuButton icon={<HashIcon size={16} />} label="Copy Server ID" onClick={() => act(onCopyId)} />
            <MenuButton icon={<HammerIcon size={16} />} label="View Raw" onClick={() => setRawOpen(true)} />
          </>
        )}
      </ContextMenuShell>

      {notifOpen && (
        <NotificationLevelPopout
          channelId={-1n}
          serverId={server.id}
          isServer
          position={{ top: y, left: x + menuWidth + 4 }}
          onClose={() => { setNotifOpen(false); onClose(); }}
        />
      )}

      {folderModalOpen && (
        <CreateFolderModal
          onConfirm={handleFolderCreated}
          onClose={() => setFolderModalOpen(false)}
        />
      )}
    </>
  );
}


