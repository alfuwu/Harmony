import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { getAs } from "../../../lib/state/Auth";
import { getSs } from "../../../lib/state/Servers";
import { getUs } from "../../../lib/state/Users";
import { api, binapi } from "../../../lib/api/Http";
import {
  Role,
  RoleDisplayType,
  Emoji,
  User,
} from "../../../lib/utils/Types";
import Search from "../../svgs/settings/Search";
import { intToHex } from "../../../lib/utils/Funcs";
import {
  isOwner,
  canManageRoles,
  canBanMembers,
  canManageServer,
} from "../../../lib/utils/PermissionUtils";
import { getAvatar, getDisplayName } from "../../../lib/utils/UserUtils";
import CroppingModal from "./CroppingModal";
import {
  createRole as apiCreateRole,
  updateRole as apiUpdateRole,
  deleteRole as apiDeleteRole,
  getBans,
  unbanMember,
  assignRole,
  removeRole,
} from "../../../lib/api/ServerApi";
import { t, useLocale } from "../../../lib/i18n/Index";
import { TranslationKeys } from "../../../lib/i18n/Schema";
import { AlertTriangleIcon, BanIcon, EditIcon, FilmIcon, HomeIcon, InviteIcon, SearchIcon, SmileIcon, StarIcon, TrashIcon, UsersIcon } from "../../svgs/other/Icons";

// ═══════════════════════════════════════════════════════════
// Permission definitions
// ═══════════════════════════════════════════════════════════

const PERMS: Record<
  string,
  { bit: bigint; label: TranslationKeys; desc: TranslationKeys; danger?: boolean }
> = {
  Administrator: {
    bit: 1n << 11n,
    label: "perm.administrator",
    desc: "perm.administrator.desc",
    danger: true,
  },
  ManageServer: {
    bit: 1n << 10n,
    label: "perm.manage_server",
    desc: "perm.manage_server.desc",
  },
  ManageRoles: {
    bit: 1n << 4n,
    label: "perm.manage_roles",
    desc: "perm.manage_roles.desc",
  },
  ManageChannels: {
    bit: 1n << 3n,
    label: "perm.manage_channels",
    desc: "perm.manage_channels.desc",
  },
  ManageEmojis: {
    bit: 1n << 42n,
    label: "perm.manage_emojis",
    desc: "perm.manage_emojis.desc",
  },
  ViewAuditLog: {
    bit: 1n << 35n,
    label: "perm.view_audit_log",
    desc: "perm.view_audit_log.desc",
  },
  CreateInvites: {
    bit: 1n << 19n,
    label: "perm.create_invites",
    desc: "perm.create_invites.desc",
  },
  ManageNicknames: {
    bit: 1n << 29n,
    label: "perm.manage_nicknames",
    desc: "perm.manage_nicknames.desc",
  },
  ChangeNickname: {
    bit: 1n << 30n,
    label: "perm.change_nickname",
    desc: "perm.change_nickname.desc",
  },
  KickMembers: {
    bit: 1n << 5n,
    label: "perm.kick_members",
    desc: "perm.kick_members.desc",
  },
  BanMembers: {
    bit: 1n << 6n,
    label: "perm.ban_members",
    desc: "perm.ban_members.desc",
  },
  MuteMembers: {
    bit: 1n << 7n,
    label: "perm.mute_members",
    desc: "perm.mute_members.desc",
  },
  DeafenMembers: {
    bit: 1n << 8n,
    label: "perm.deafen_members",
    desc: "perm.deafen_members.desc",
  },
  MoveMembers: {
    bit: 1n << 9n,
    label: "perm.move_members",
    desc: "perm.move_members.desc",
  },
  ManageQuests: {
    bit: 1n << 45n,
    label: "perm.manage_quests",
    desc: "perm.manage_quests.desc",
  },
  ReviewAppeals: {
    bit: 1n << 46n,
    label: "perm.review_appeals",
    desc: "perm.review_appeals.desc",
  },
  ViewChannels: {
    bit: 1n << 0n,
    label: "perm.view_channels",
    desc: "perm.view_channels.desc",
  },
  ViewMessageHistory: {
    bit: 1n << 23n,
    label: "perm.view_message_history",
    desc: "perm.view_message_history.desc",
  },
  SendMessages: {
    bit: 1n << 1n,
    label: "perm.send_messages",
    desc: "perm.send_messages.desc",
  },
  ManageMessages: {
    bit: 1n << 2n,
    label: "perm.manage_messages",
    desc: "perm.manage_messages.desc",
  },
  EditOtherMessages: {
    bit: 1n << 22n,
    label: "perm.edit_other_messages",
    desc: "perm.edit_other_messages.desc",
  },
  AttachFiles: {
    bit: 1n << 12n,
    label: "perm.attach_files",
    desc: "perm.attach_files.desc",
  },
  EmbedLinks: {
    bit: 1n << 13n,
    label: "perm.embed_links",
    desc: "perm.embed_links.desc",
  },
  AddReactions: {
    bit: 1n << 14n,
    label: "perm.add_reactions",
    desc: "perm.add_reactions.desc",
  },
  UseExternalEmojis: {
    bit: 1n << 15n,
    label: "perm.use_external_emojis",
    desc: "perm.use_external_emojis.desc",
  },
  MentionEveryone: {
    bit: 1n << 16n,
    label: "perm.mention_everyone",
    desc: "perm.mention_everyone.desc",
  },
  PinMessages: {
    bit: 1n << 24n,
    label: "perm.pin_messages",
    desc: "perm.pin_messages.desc",
  },
  ManageThreads: {
    bit: 1n << 17n,
    label: "perm.manage_threads",
    desc: "perm.manage_threads.desc",
  },
  CreateThreads: {
    bit: 1n << 25n,
    label: "perm.create_threads",
    desc: "perm.create_threads.desc",
  },
  Draw: {
    bit: 1n << 21n,
    label: "perm.draw",
    desc: "perm.draw.desc",
  },
  Connect: {
    bit: 1n << 38n,
    label: "perm.connect",
    desc: "perm.connect.desc",
  },
  Speak: {
    bit: 1n << 39n,
    label: "perm.speak",
    desc: "perm.speak.desc",
  },
  UseVAD: {
    bit: 1n << 40n,
    label: "perm.use_vad",
    desc: "perm.use_vad.desc",
  },
  Stream: {
    bit: 1n << 37n,
    label: "perm.stream",
    desc: "perm.stream.desc",
  },
  PrioritySpeaker: {
    bit: 1n << 36n,
    label: "perm.priority_speaker",
    desc: "perm.priority_speaker.desc",
  },
};

const PERM_GROUPS: { label: TranslationKeys; keys: string[] }[] = [
  {
    label: "perm.group.general",
    keys: [
      "Administrator",
      "ManageServer",
      "ManageRoles",
      "ManageChannels",
      "ManageEmojis",
      "ViewAuditLog",
      "CreateInvites",
      "ManageNicknames",
      "ChangeNickname",
    ],
  },
  {
    label: "perm.group.member",
    keys: [
      "KickMembers",
      "BanMembers",
      "MuteMembers",
      "DeafenMembers",
      "MoveMembers",
      "ManageQuests",
      "ReviewAppeals",
    ],
  },
  {
    label: "perm.group.text",
    keys: [
      "ViewChannels",
      "ViewMessageHistory",
      "SendMessages",
      "ManageMessages",
      "EditOtherMessages",
      "AttachFiles",
      "EmbedLinks",
      "AddReactions",
      "UseExternalEmojis",
      "MentionEveryone",
      "PinMessages",
      "ManageThreads",
      "CreateThreads",
      "Draw",
    ],
  },
  {
    label: "perm.group.voice",
    keys: ["Connect", "Speak", "UseVAD", "Stream", "PrioritySpeaker"],
  },
];

function hasBit(permissions: bigint, bit: bigint): boolean {
  return (BigInt(permissions) & bit) !== 0n;
}
function toggleBit(permissions: bigint, bit: bigint): bigint {
  const p = BigInt(permissions);
  return (p & bit) !== 0n ? p & ~bit : p | bit;
}
function hexToInt(hex: string): number {
  const clean = hex.replace("#", "");
  return parseInt(clean, 16) || 0;
}

// ═══════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════

function Toggle({
  value,
  onChange,
  accent = "var(--accent-3)",
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  accent?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        flexShrink: 0,
        width: 42,
        height: 24,
        borderRadius: 12,
        border: "none",
        padding: 0,
        background: value ? accent : "var(--bg-2)",
        position: "relative",
        cursor: "pointer",
        transition: "background 200ms",
        boxShadow: "inset 0 0 0 1px var(--button-border)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 4,
          left: value ? 22 : 4,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: value ? "#fff" : "var(--text-5)",
          transition: "left 180ms ease, background 180ms",
          display: "block",
          boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
        }}
      />
    </button>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-5)",
        padding: "18px 0 8px",
        borderBottom: "1px solid var(--border)",
        marginBottom: 2,
      }}
    >
      {label}
    </div>
  );
}

function PermToggle({
  label,
  desc,
  checked,
  onChange,
  disabled,
  danger,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "11px 0",
        borderBottom: "1px solid var(--border-light)",
        gap: 16,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: danger ? "var(--red-2)" : "var(--text-3)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-5)",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
      <Toggle
        value={checked}
        onChange={() => !disabled && onChange()}
        accent={danger ? "var(--red-3)" : "var(--accent-3)"}
      />
    </div>
  );
}

function ColorSwatch({
  color,
  onChange,
  size = 28,
}: {
  color: number | null | undefined;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hex = color != null ? intToHex(color) : "#808080";
  return (
    <div
      onClick={() => inputRef.current?.click()}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: hex,
        border: "2px solid var(--border)",
        cursor: "pointer",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
      }}
      title={t("server.pick_color")}
    >
      <input
        ref={inputRef}
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          cursor: "pointer",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}

function Tag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 8px",
        borderRadius: 20,
        background: "color-mix(in hsl, var(--accent-2), transparent 75%)",
        border: "1px solid color-mix(in hsl, var(--accent-2), transparent 45%)",
        color: "var(--accent-1)",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          boxShadow: "none",
          padding: 0,
          color: "inherit",
          cursor: "pointer",
          fontSize: 14,
          lineHeight: 1,
          opacity: 0.7,
          display: "flex",
          alignItems: "center",
        }}
      >
        ×
      </button>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════

interface BanEntry {
  userId: bigint;
  serverId: bigint;
  reason?: string;
  bannedBy: bigint;
  bannedAt: string;
}

interface RoleEditorState {
  name: string;
  description: string;
  color: number;
  colors: number[];
  displayType: RoleDisplayType;
  permissions: bigint;
  position: number;
  permissionPriority: number;
}

export default function ServerSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useLocale();

  const { user } = getAs();
  const { currentServer, addServer, removeServer } = getSs();
  const { members, users, get } = getUs();

  // ── Permission checks ──────────────────────────────────
  const me = useMemo(
    () =>
      members.find(
        (m) => m.serverId === currentServer?.id && m.userId === user?.id
      ),
    [members, currentServer?.id, user?.id]
  );

  const amOwner = isOwner(me, currentServer);
  const canSettings = canManageServer(me, currentServer);
  const canRoles = canManageRoles(me, currentServer);
  const canBans = canBanMembers(me, currentServer);

  // ── Tab navigation ─────────────────────────────────────
  const [currentTab, setCurrentTab] = useState("overview");
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  // ── Overview state ─────────────────────────────────────
  const [srvName, setSrvName] = useState("");
  const [srvDescription, setSrvDescription] = useState("");
  const [srvTags, setSrvTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<"icon" | "banner">("icon");
  const [showCrop, setShowCrop] = useState(false);

  // ── Invite state ───────────────────────────────────────
  const [inviteUrls, setInviteUrls] = useState<string[]>([]);
  const [inviteInput, setInviteInput] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // ── Emoji state ────────────────────────────────────────
  const [emojis, setEmojis] = useState<Emoji[]>([]);
  const [emojiFile, setEmojiFile] = useState<File | null>(null);
  const [emojiName, setEmojiName] = useState("");
  const [emojiUploading, setEmojiUploading] = useState(false);

  // ── Roles state ────────────────────────────────────────
  const [localRoles, setLocalRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<bigint | null>(null);
  const [roleTab, setRoleTab] = useState<"display" | "permissions">("display");
  const [roleEditor, setRoleEditor] = useState<RoleEditorState | null>(null);
  const [roleEditorDirty, setRoleEditorDirty] = useState(false);
  const [roleCreating, setRoleCreating] = useState(false);
  const [roleSaving, setRoleSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<bigint | null>(null);

  // ── Members state ──────────────────────────────────────
  const [memberSearch, setMemberSearch] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<bigint | null>(null);

  // ── Bans state ─────────────────────────────────────────
  const [bans, setBans] = useState<BanEntry[]>([]);
  const [bansLoading, setBansLoading] = useState(false);
  const [unbanningId, setUnbanningId] = useState<bigint | null>(null);

  // ── Danger zone ────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [serverSearch, setServerSearch] = useState("");

  // ── Init ───────────────────────────────────────────────
  useEffect(() => {
    if (!open || !currentServer) return;
    setSrvName(currentServer.name ?? "");
    setSrvDescription(currentServer.description ?? "");
    setSrvTags(currentServer.tags ?? []);
    setInviteUrls(currentServer.inviteUrls ?? []);
    setEmojis(currentServer.emojis ?? []);
    setLocalRoles(
      [...(currentServer.roles ?? [])].sort((a, b) => b.position - a.position)
    );
    setSelectedRoleId(null);
    setRoleEditor(null);
    setRoleEditorDirty(false);
    setHasUnsaved(false);
    setSaveError("");
    setSaveSuccess("");
    setDeleteConfirm("");
  }, [open, currentServer?.id]);

  // Track overview unsaved
  useEffect(() => {
    if (!currentServer) return;
    const dirty =
      srvName !== (currentServer.name ?? "") ||
      srvDescription !== (currentServer.description ?? "") ||
      JSON.stringify(srvTags) !== JSON.stringify(currentServer.tags ?? []) ||
      JSON.stringify(inviteUrls) !==
        JSON.stringify(currentServer.inviteUrls ?? []) ||
      iconFile !== null ||
      bannerFile !== null;
    setHasUnsaved(dirty);
  }, [
    srvName,
    srvDescription,
    srvTags,
    inviteUrls,
    iconFile,
    bannerFile,
    currentServer,
  ]);

  // Load bans when switching to bans tab
  useEffect(() => {
    if (currentTab !== "bans" || !currentServer || !canBans) return;
    setBansLoading(true);
    getBans(currentServer.id)
      .then((data: any) => setBans(data ?? []))
      .catch(() => setBans([]))
      .finally(() => setBansLoading(false));
  }, [currentTab, currentServer?.id]);

  // Sync roles list from server
  useEffect(() => {
    if (!currentServer) return;
    setLocalRoles(
      [...(currentServer.roles ?? [])].sort((a, b) => b.position - a.position)
    );
  }, [currentServer?.roles]);

  // When a role is selected, populate the editor
  const selectRole = useCallback(
    (role: Role) => {
      if (roleEditorDirty) return; // prompt first
      setSelectedRoleId(role.id);
      setRoleEditor({
        name: role.name,
        description: (role as any).description ?? "",
        color: role.color ?? 0,
        colors: role.colors ?? [],
        displayType: role.displayType ?? RoleDisplayType.Normal,
        permissions: role.permissions ?? 0n,
        position: role.position ?? 0,
        permissionPriority: (role as any).permissionPriority ?? 0,
      });
      setRoleEditorDirty(false);
      setRoleTab("display");
    },
    [roleEditorDirty]
  );

  // ── Tab list ───────────────────────────────────────────
  const tabGroups: Record<string, string[]> = {};
  if (amOwner || canSettings) tabGroups["server"] = ["overview", "invites", "emojis"];
  if (amOwner || canRoles) {
    if (!tabGroups["access"]) tabGroups["access"] = [];
    tabGroups["access"].push("roles");
  }
  if (amOwner || canBans) {
    if (!tabGroups["access"]) tabGroups["access"] = [];
    if (!tabGroups["access"].includes("members")) tabGroups["access"].push("members");
    if (!tabGroups["access"].includes("bans")) tabGroups["access"].push("bans");
  }
  if (!tabGroups["access"]) tabGroups["access"] = ["members"];
  if (amOwner) tabGroups["danger"] = ["delete"];

  const TAB_LABELS: Record<string, TranslationKeys> = {
    overview: "server.tab.overview",
    invites: "server.tab.invites",
    emojis: "server.tab.emojis",
    roles: "server.tab.roles",
    members: "server.tab.members",
    bans: "server.tab.bans",
    delete: "server.tab.delete"
  };

  const TAB_ICONS: Record<string, ReactNode> = {
    overview: <HomeIcon size={18} />,
    invites: <InviteIcon size={18} />,
    emojis: <SmileIcon size={18} />,
    roles: <StarIcon size={18} />,
    members: <UsersIcon size={18} />,
    bans: <BanIcon size={18} />,
    delete: <AlertTriangleIcon size={18} />
  };

  function selectTab(tab: string) {
    if (hasUnsaved && currentTab !== tab) return;
    setCurrentTab(tab);
    setSaveError("");
    setSaveSuccess("");
  }

  // ── Save / Revert ──────────────────────────────────────
  async function handleSave() {
    if (!currentServer) return;
    setSaveError("");
    try {
      // Update basic server info
      await api(`/servers/${currentServer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: srvName,
          description: srvDescription || null,
          tags: srvTags.length > 0 ? srvTags : null,
          inviteUrls: inviteUrls.length > 0 ? inviteUrls : null,
        }),
      });

      if (iconFile) {
        const fd = new FormData();
        fd.append("file", iconFile);
        await binapi(`/servers/${currentServer.id}/icon`, {
          method: "POST",
          body: fd,
        });
      }
      if (bannerFile) {
        const fd = new FormData();
        fd.append("file", bannerFile);
        await binapi(`/servers/${currentServer.id}/banner`, {
          method: "POST",
          body: fd,
        });
      }

      addServer({
        ...currentServer,
        name: srvName,
        description: srvDescription || null,
        tags: srvTags,
        inviteUrls,
      });
      setIconFile(null);
      setIconPreview(null);
      setBannerFile(null);
      setBannerPreview(null);
      setHasUnsaved(false);
      setSaveSuccess(t("server.saved"));
      setTimeout(() => setSaveSuccess(""), 3000);
    } catch (e: any) {
      setSaveError(e.message ?? t("error.failed_save"));
    }
  }

  function handleRevert() {
    if (!currentServer) return;
    setSrvName(currentServer.name ?? "");
    setSrvDescription(currentServer.description ?? "");
    setSrvTags(currentServer.tags ?? []);
    setInviteUrls(currentServer.inviteUrls ?? []);
    setIconFile(null);
    setIconPreview(null);
    setBannerFile(null);
    setBannerPreview(null);
    setHasUnsaved(false);
    setSaveError("");
  }

  // ── Icon / Banner upload ───────────────────────────────
  function pickFile(e: React.ChangeEvent<HTMLInputElement>, mode: "icon" | "banner") {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropMode(mode);
      setShowCrop(true);
    };
    reader.readAsDataURL(f);
  }

  function onCropDone(blob: Blob) {
    const file = new File([blob], cropMode === "icon" ? "icon.png" : "banner.png", { type: blob.type });
    const url = URL.createObjectURL(blob);
    if (cropMode === "icon") { setIconFile(file); setIconPreview(url); }
    else { setBannerFile(file); setBannerPreview(url); }
    setShowCrop(false);
    setCropSrc(null);
  }

  // ── Role editor save ───────────────────────────────────
  async function saveRoleEdits() {
    if (!currentServer || !selectedRoleId || !roleEditor) return;
    setRoleSaving(true);
    setSaveError("");
    try {
      const target = localRoles.find((r) => r.id === selectedRoleId);
      if (!target) return;
      await apiUpdateRole(
        currentServer.id,
        {
          ...target,
          name: roleEditor.name,
          color: roleEditor.color || null,
          colors: roleEditor.colors.length > 0 ? roleEditor.colors : null,
          displayType: roleEditor.displayType,
          permissions: roleEditor.permissions,
          position: roleEditor.position,
          ...(roleEditor.permissionPriority !== undefined && {
            permissionPriority: roleEditor.permissionPriority,
          }),
        } as any
      );
      const updatedRole = { ...target, ...roleEditor, color: roleEditor.color || null };
      const newRoles = localRoles
        .map((r) => (r.id === selectedRoleId ? updatedRole : r))
        .sort((a, b) => b.position - a.position);
      setLocalRoles(newRoles);
      addServer({ ...currentServer, roles: newRoles });
      setRoleEditorDirty(false);
      setSaveSuccess(t("server.role_saved"));
      setTimeout(() => setSaveSuccess(""), 2500);
    } catch (e: any) {
      setSaveError(e.message ?? t("error.role_save"));
    } finally {
      setRoleSaving(false);
    }
  }

  async function createNewRole() {
    if (!currentServer) return;
    setRoleCreating(true);
    try {
      const role = await apiCreateRole(
        currentServer.id,
        t("server.role_default_name"),
        undefined,
        undefined,
        undefined,
        undefined,
        RoleDisplayType.Normal,
        undefined
      );
      const newRoles = [...localRoles, role].sort((a, b) => b.position - a.position);
      setLocalRoles(newRoles);
      addServer({ ...currentServer, roles: newRoles });
      selectRole(role);
    } catch (e: any) {
      setSaveError(e.message ?? t("error.role_create"));
    } finally {
      setRoleCreating(false);
    }
  }

  async function deleteRole(roleId: bigint) {
    if (!currentServer) return;
    try {
      await apiDeleteRole(currentServer.id, roleId);
      const newRoles = localRoles.filter((r) => r.id !== roleId);
      setLocalRoles(newRoles);
      addServer({ ...currentServer, roles: newRoles });
      if (selectedRoleId === roleId) {
        setSelectedRoleId(null);
        setRoleEditor(null);
      }
      setDeleteConfirmId(null);
    } catch (e: any) {
      setSaveError(e.message ?? t("error.role_delete"));
    }
  }

  async function reorderRole(roleId: bigint, direction: "up" | "down") {
    if (!currentServer) return;
    const idx = localRoles.findIndex((r) => r.id === roleId);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= localRoles.length) return;

    const newRoles = [...localRoles];
    const posA = newRoles[idx].position;
    const posB = newRoles[swapIdx].position;
    newRoles[idx] = { ...newRoles[idx], position: posB };
    newRoles[swapIdx] = { ...newRoles[swapIdx], position: posA };
    newRoles.sort((a, b) => b.position - a.position);
    setLocalRoles(newRoles);

    try {
      await Promise.all([
        apiUpdateRole(currentServer.id, { ...newRoles.find((r) => r.id === roleId)! }),
        apiUpdateRole(currentServer.id, { ...newRoles.find((r) => r.id === localRoles[swapIdx].id)! }),
      ]);
      addServer({ ...currentServer, roles: newRoles });
    } catch (e) {
      // revert
      setLocalRoles(localRoles);
    }
  }

  // ── Unban ──────────────────────────────────────────────
  async function handleUnban(userId: bigint) {
    if (!currentServer) return;
    setUnbanningId(userId);
    try {
      await unbanMember(currentServer.id, { id: userId } as User);
      setBans((prev) => prev.filter((b) => b.userId !== userId));
    } catch (e: any) {
      setSaveError(e.message ?? t("error.unban"));
    } finally {
      setUnbanningId(null);
    }
  }

  // ── Delete server ──────────────────────────────────────
  async function handleDeleteServer() {
    if (!currentServer || deleteConfirm !== currentServer.name) return;
    setDeleting(true);
    try {
      await api(`/servers/${currentServer.id}`, { method: "DELETE" });
      removeServer(currentServer.id);
      onClose();
    } catch (e: any) {
      setSaveError(e.message ?? t("error.server_delete"));
      setDeleting(false);
    }
  }

  // ── Copy invite ────────────────────────────────────────
  function copyInvite(url: string) {
    const full = `${window.location.origin}/invite/${url}`;
    navigator.clipboard.writeText(full);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  }

  // ── Server members for display ─────────────────────────
  const serverMembers = useMemo(
    () => members.filter((m) => m.serverId === currentServer?.id),
    [members, currentServer?.id]
  );

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim())
      return serverMembers;
    const q = memberSearch.toLowerCase();
    return serverMembers.filter(
      (m) =>
        get(m.userId)?.username.toLowerCase().includes(q) ||
        (get(m.userId)?.displayName?.toLowerCase().includes(q) ?? false) ||
        (m.nickname?.toLowerCase().includes(q) ?? false)
    );
  }, [serverMembers, memberSearch]);

  // ═══════════════════════════════════════════════════════
  // Tab renderers
  // ═══════════════════════════════════════════════════════

  function renderOverview() {
    const iconSrc =
      iconPreview ??
      (currentServer?.icon
        ? `/api/servers/${currentServer.id}/icon/${currentServer.icon}`
        : null);
    const bannerSrc =
      bannerPreview ??
      (currentServer?.banner
        ? `/api/servers/${currentServer.id}/banner/${currentServer.banner}`
        : null);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Server card preview */}
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--border)",
            background: "var(--bg-4)",
          }}
        >
          <div
            style={{
              height: 80,
              background: bannerSrc
                ? `url(${bannerSrc}) center/cover no-repeat`
                : "linear-gradient(135deg, var(--accent-3), var(--purple-4))",
              position: "relative",
            }}
          >
            <button
              onClick={() =>
                document.getElementById("banner-upload")?.click()
              }
              style={{
                position: "absolute",
                right: 8,
                bottom: 8,
                background: "rgba(0,0,0,0.6)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 12,
                cursor: "pointer",
                boxShadow: "none",
              }}
            >
              {bannerSrc ? t("server.change_banner") : t("server.add_banner")}
            </button>
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => pickFile(e, "banner")}
            />
          </div>
          <div style={{ padding: "0 16px 16px", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: -28,
                left: 16,
                width: 56,
                height: 56,
                borderRadius: "33%",
                background: "var(--bg-3)",
                border: "4px solid var(--bg-4)",
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={() => document.getElementById("icon-upload")?.click()}
              title={t("server.change_icon")}
            >
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--text-3)",
                    background: "var(--bg-1)",
                  }}
                >
                  {srvName[0]?.toUpperCase() ?? "S"}
                </div>
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  transition: "background 150ms",
                }}
                onMouseEnter={e =>
                  (e.currentTarget.style.background =
                    "rgba(0,0,0,0.5)")
                }
                onMouseLeave={e =>
                  (e.currentTarget.style.background =
                    "rgba(0,0,0,0)")
                }
              >
                <EditIcon size={16} />
              </div>
            </div>
            <input
              id="icon-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => pickFile(e, "icon")}
            />
            <div style={{ height: 32 }} />
            <div
              style={{ fontSize: 17, fontWeight: 700, color: "var(--text-2)" }}
            >
              {srvName || t("server.name")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 2 }}>
              {serverMembers.length} member
              {serverMembers.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-5)",
            }}
          >
            Server Name
          </label>
          <input
            value={srvName}
            onChange={(e) => setSrvName(e.target.value)}
            maxLength={100}
            placeholder={t("server.name_placeholder")}
            style={{ width: "calc(100% - 22px)" }}
          />
          <div
            style={{ fontSize: 11, color: "var(--text-5)", textAlign: "right" }}
          >
            {srvName.length}/100
          </div>
        </div>

        {/* Description */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-5)",
            }}
          >
            Description
          </label>
          <textarea
            value={srvDescription}
            onChange={(e) => setSrvDescription(e.target.value)}
            maxLength={1000}
            placeholder={t("server.desc_placeholder")}
            rows={3}
            style={{
              resize: "vertical",
              background: "var(--bg-1)",
              border: "1px solid var(--button-border)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "var(--text-3)",
              fontFamily: "inherit",
              fontSize: 14,
              outline: "none",
              width: "calc(100% - 26px)",
              minHeight: 72,
            }}
          />
          <div
            style={{ fontSize: 11, color: "var(--text-5)", textAlign: "right" }}
          >
            {srvDescription.length}/1000
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-5)",
            }}
          >
            Tags
          </label>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              minHeight: 36,
              padding: "6px 8px",
              background: "var(--bg-1)",
              border: "1px solid var(--button-border)",
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            {srvTags.map((tag) => (
              <Tag
                key={tag}
                label={tag}
                onRemove={() =>
                  setSrvTags((prev) => prev.filter((t) => t !== tag))
                }
              />
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (
                  (e.key === "Enter" || e.key === ",") &&
                  tagInput.trim() &&
                  !srvTags.includes(tagInput.trim())
                ) {
                  e.preventDefault();
                  setSrvTags((prev) => [...prev, tagInput.trim()]);
                  setTagInput("");
                }
              }}
              placeholder={srvTags.length === 0 ? t("server.tags_placeholder") : ""}
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                color: "var(--text-3)",
                fontSize: 13,
                padding: "2px 4px",
                minWidth: 120,
                boxShadow: "none",
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>
            Press Enter or comma to add a tag.
          </div>
        </div>
      </div>
    );
  }

  function renderInvites() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div>
          <div style={{ fontSize: 13, color: "var(--text-4)", marginBottom: 16, lineHeight: 1.5 }}>
            Invite links let people join your server. Share them anywhere — each link
            generates a unique URL at <code style={{ fontSize: 12 }}>{"<site>/invite/<slug>"}</code>.
          </div>

          {/* Existing invites */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inviteUrls.length === 0 ? (
              <div
                style={{
                  padding: "24px 0",
                  textAlign: "center",
                  color: "var(--text-5)",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "1px dashed var(--border)",
                }}
              >
                No invite links yet. Add one below.
              </div>
            ) : (
              inviteUrls.map((url) => (
                <div
                  key={url}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--bg-1)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🔗</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-2)",
                        fontFamily: "monospace",
                      }}
                    >
                      {url}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>
                      {window.location.origin}/invite/{url}
                    </div>
                  </div>
                  <button
                    onClick={() => copyInvite(url)}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      borderRadius: 6,
                      background:
                        copiedUrl === url
                          ? "color-mix(in hsl, var(--green-2), transparent 72%)"
                          : "var(--bg-2)",
                      color: copiedUrl === url ? "var(--green-1)" : "var(--text-4)",
                      border: `1px solid ${copiedUrl === url ? "color-mix(in hsl, var(--green-2), transparent 45%)" : "var(--button-border)"}`,
                      flexShrink: 0,
                    }}
                  >
                    {copiedUrl === url ? t("copied") : t("copy")}
                  </button>
                  <button
                    onClick={() =>
                      setInviteUrls((prev) => prev.filter((u) => u !== url))
                    }
                    style={{
                      padding: "5px 10px",
                      fontSize: 12,
                      borderRadius: 6,
                      background: "color-mix(in hsl, var(--red-2), transparent 85%)",
                      color: "var(--red-2)",
                      border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
                      flexShrink: 0,
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add new invite */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-5)",
            }}
          >
            New Invite Slug
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={inviteInput}
              onChange={(e) =>
                setInviteInput(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
              }
              placeholder="my-cool-server"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const slug = inviteInput.trim();
                  if (slug && !inviteUrls.includes(slug)) {
                    setInviteUrls((prev) => [...prev, slug]);
                    setInviteInput("");
                  }
                }
              }}
              style={{ flex: 1 }}
            />
            <button
              onClick={() => {
                const slug = inviteInput.trim();
                if (slug && !inviteUrls.includes(slug)) {
                  setInviteUrls((prev) => [...prev, slug]);
                  setInviteInput("");
                }
              }}
              disabled={!inviteInput.trim() || inviteUrls.includes(inviteInput.trim())}
              style={{
                padding: "0 16px",
                background: "var(--accent-3)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: inviteInput.trim() ? "pointer" : "not-allowed",
                opacity: inviteInput.trim() && !inviteUrls.includes(inviteInput.trim()) ? 1 : 0.5,
                flexShrink: 0,
              }}
            >
              Add
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>
            Only lowercase letters, numbers, hyphens, and underscores. Save
            changes to make this live.
          </div>
        </div>
      </div>
    );
  }

  function renderEmojis() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* Upload new emoji */}
        <div
          style={{
            padding: "16px",
            background: "var(--bg-1)",
            borderRadius: 10,
            border: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-2)",
            }}
          >
            Upload New Emoji
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Name
              </label>
              <input
                value={emojiName}
                onChange={(e) =>
                  setEmojiName(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  )
                }
                placeholder="e.g. party_blob"
                maxLength={32}
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "var(--text-5)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Image
              </label>
              <button
                onClick={() => document.getElementById("emoji-upload")?.click()}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  fontSize: 13,
                  color: emojiFile ? "var(--text-2)" : "var(--text-5)",
                }}
              >
                {emojiFile ? emojiFile.name : t("server.choose_file")}
              </button>
              <input
                id="emoji-upload"
                type="file"
                accept="image/png,image/gif,image/webp"
                style={{ display: "none" }}
                onChange={(e) => setEmojiFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button
              disabled={!emojiFile || !emojiName.trim() || emojiUploading}
              onClick={async () => {
                if (!currentServer || !emojiFile || !emojiName.trim()) return;
                setEmojiUploading(true);
                try {
                  const fd = new FormData();
                  fd.append("file", emojiFile);
                  fd.append("name", emojiName.trim());
                  const newEmoji = await binapi(
                    `/servers/${currentServer.id}/emojis`,
                    { method: "POST", body: fd }
                  );
                  setEmojis((prev) => [...prev, newEmoji]);
                  addServer({ ...currentServer, emojis: [...emojis, newEmoji] });
                  setEmojiFile(null);
                  setEmojiName("");
                } catch (e: any) {
                  setSaveError(e.message ?? t("server.emoji_upload_failed"));
                } finally {
                  setEmojiUploading(false);
                }
              }}
              style={{
                padding: "8px 20px",
                background: "var(--accent-3)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
                opacity:
                  emojiFile && emojiName.trim() && !emojiUploading ? 1 : 0.4,
                cursor:
                  emojiFile && emojiName.trim() && !emojiUploading
                    ? "pointer"
                    : "not-allowed",
              }}
            >
              {emojiUploading ? t("server.uploading") : t("server.upload")}
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-5)" }}>
            Supported formats: PNG, GIF (animated), WebP · Max 256 KB · Name
            uses only lowercase letters, numbers, and underscores.
          </div>
        </div>

        {/* Emoji grid */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--text-5)",
              marginBottom: 12,
            }}
          >
            Custom Emojis — {emojis.length}
          </div>
          {emojis.length === 0 ? (
            <div
              style={{
                padding: "32px 0",
                textAlign: "center",
                color: "var(--text-5)",
                fontSize: 13,
                borderRadius: 8,
                border: "1px dashed var(--border)",
              }}
            >
              No custom emojis yet.
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 8,
              }}
            >
              {emojis.map((emoji) => (
                <div
                  key={emoji.id ?? emoji.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: "var(--bg-1)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      background: "var(--bg-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                      flexShrink: 0,
                    }}
                  >
                    {/* TODO: replace emoji with svg icon */}
                    {emoji.animated ? <FilmIcon size={22} /> : "🖼️"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontFamily: "monospace",
                      }}
                    >
                      :{emoji.name}:
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!currentServer || emoji.id == null) return;
                      try {
                        await api(
                          `/servers/${currentServer.id}/emojis/${emoji.id}`,
                          { method: "DELETE" }
                        );
                        const newEmojis = emojis.filter(
                          (e) => e.id !== emoji.id
                        );
                        setEmojis(newEmojis);
                        addServer({ ...currentServer, emojis: newEmojis });
                      } catch (e: any) {
                        setSaveError(e.message ?? t("server.emoji_delete_failed"));
                      }
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      boxShadow: "none",
                      color: "var(--text-5)",
                      cursor: "pointer",
                      padding: "2px",
                      flexShrink: 0,
                    }}
                    title={t("server.delete_emoji")}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderRoles() {
    const selectedRole = localRoles.find((r) => r.id === selectedRoleId);

    return (
      <div style={{ display: "flex", gap: 0, height: "100%", minHeight: 0 }}>
        {/* ── Left: role list ── */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid var(--border)",
            paddingRight: 12,
            marginRight: 20,
          }}
        >
          <button
            onClick={createNewRole}
            disabled={roleCreating}
            style={{
              marginBottom: 10,
              padding: "8px 0",
              background: "color-mix(in hsl, var(--accent-3), transparent 80%)",
              border: "1px solid color-mix(in hsl, var(--accent-2), transparent 55%)",
              borderRadius: 8,
              color: "var(--accent-1)",
              fontSize: 12,
              fontWeight: 700,
              cursor: roleCreating ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 16 }}>+</span>
            {roleCreating ? t("server.creating") : t("server.new_role")}
          </button>

          <div
            className="ovy-auto"
            style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}
          >
            {localRoles.map((role, idx) => {
              const isSelected = role.id === selectedRoleId;
              const hex =
                role.color != null ? intToHex(role.color) : "var(--text-5)";
              return (
                <div
                  key={role.id}
                  onClick={() => selectRole(role)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: isSelected ? "var(--active)" : "none",
                    border: `1px solid ${isSelected ? "var(--border)" : "transparent"}`,
                    transition: "background 100ms",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = "var(--hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = "none";
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: hex,
                      flexShrink: 0,
                      border:
                        role.color == null
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected ? "var(--text-2)" : "var(--text-4)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {role.name}
                  </span>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderRole(role.id, "up");
                      }}
                      disabled={idx === 0}
                      style={{
                        background: "none",
                        border: "none",
                        boxShadow: "none",
                        padding: 0,
                        color: "var(--text-5)",
                        cursor: idx === 0 ? "default" : "pointer",
                        fontSize: 10,
                        opacity: idx === 0 ? 0.2 : 0.5,
                        lineHeight: 1,
                      }}
                      title={t("server.move_up")}
                    >
                      ▲
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reorderRole(role.id, "down");
                      }}
                      disabled={idx === localRoles.length - 1}
                      style={{
                        background: "none",
                        border: "none",
                        boxShadow: "none",
                        padding: 0,
                        color: "var(--text-5)",
                        cursor:
                          idx === localRoles.length - 1 ? "default" : "pointer",
                        fontSize: 10,
                        opacity: idx === localRoles.length - 1 ? 0.2 : 0.5,
                        lineHeight: 1,
                      }}
                      title={t("server.move_down")}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: role editor ── */}
        {selectedRole && roleEditor ? (
          <div
            className="ovy-auto"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 0,
              minWidth: 0,
              paddingBottom: 80,
            }}
          >
            {/* Role editor header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background:
                    roleEditor.color != null
                      ? intToHex(roleEditor.color)
                      : "var(--text-5)",
                  flexShrink: 0,
                  border:
                    roleEditor.color == null
                      ? "1px solid var(--border)"
                      : "none",
                }}
              />
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--text-2)",
                  flex: 1,
                }}
              >
                Edit Role
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {roleEditorDirty && (
                  <>
                    <button
                      onClick={() => {
                        selectRole(selectedRole);
                      }}
                      style={{ fontSize: 12, padding: "5px 12px" }}
                    >
                      Revert
                    </button>
                    <button
                      onClick={saveRoleEdits}
                      disabled={roleSaving}
                      style={{
                        fontSize: 12,
                        padding: "5px 14px",
                        background: "var(--accent-3)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontWeight: 600,
                        cursor: roleSaving ? "wait" : "pointer",
                      }}
                    >
                      {roleSaving ? t("saving") : t("server.save_role")}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Sub-tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--border)",
                marginBottom: 20,
                gap: 0,
              }}
            >
              {(["display", "permissions"] as const).map((tabId) => (
                <button
                  key={tabId}
                  onClick={() => setRoleTab(tabId)}
                  style={{
                    padding: "8px 16px",
                    background: "none",
                    border: "none",
                    boxShadow: "none",
                    borderBottom: `2px solid ${roleTab === tabId ? "var(--accent-1)" : "transparent"}`,
                    color:
                      roleTab === tabId ? "var(--text-2)" : "var(--text-4)",
                    fontSize: 13,
                    fontWeight: roleTab === tabId ? 600 : 400,
                    cursor: "pointer",
                    textTransform: "capitalize",
                    transition: "color 150ms, border-color 150ms",
                    borderRadius: 0,
                    marginBottom: -1,
                  }}
                >
                  {tabId === "display" ? t("server.role_display") : t("server.role_permissions")}
                </button>
              ))}
            </div>

            {roleTab === "display" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Name */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-5)",
                    }}
                  >
                    Role Name
                  </label>
                  <input
                    value={roleEditor.name}
                    onChange={(e) => {
                      setRoleEditor((prev) =>
                        prev ? { ...prev, name: e.target.value } : prev
                      );
                      setRoleEditorDirty(true);
                    }}
                    maxLength={100}
                  />
                </div>

                {/* Color section */}
                <div>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-5)",
                      display: "block",
                      marginBottom: 10,
                    }}
                  >
                    Role Color
                  </label>

                  {/* Display type selector */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    {(
                      [
                        [RoleDisplayType.Normal, t("server.role_solid")],
                        [RoleDisplayType.Gradient, t("server.role_gradient")],
                        [RoleDisplayType.Glow, t("server.role_holographic")],
                        [RoleDisplayType.GradientGlow, t("server.role_gradient_glow")],
                      ] as const
                    ).map(([type, label]) => (
                      <button
                        key={type}
                        onClick={() => {
                          setRoleEditor((prev) =>
                            prev ? { ...prev, displayType: type } : prev
                          );
                          setRoleEditorDirty(true);
                        }}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: roleEditor.displayType === type ? 600 : 400,
                          background:
                            roleEditor.displayType === type
                              ? "color-mix(in hsl, var(--accent-2), transparent 72%)"
                              : "var(--bg-2)",
                          border: `1px solid ${
                            roleEditor.displayType === type
                              ? "color-mix(in hsl, var(--accent-2), transparent 40%)"
                              : "var(--button-border)"
                          }`,
                          color:
                            roleEditor.displayType === type
                              ? "var(--accent-1)"
                              : "var(--text-4)",
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Solid / Glow color picker */}
                  {(roleEditor.displayType === RoleDisplayType.Normal ||
                    roleEditor.displayType === RoleDisplayType.Glow) && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ColorSwatch
                        size={36}
                        color={roleEditor.color}
                        onChange={(hex) => {
                          setRoleEditor((prev) =>
                            prev
                              ? { ...prev, color: hexToInt(hex) }
                              : prev
                          );
                          setRoleEditorDirty(true);
                        }}
                      />
                      <input
                        value={
                          roleEditor.color != null
                            ? intToHex(roleEditor.color)
                            : "#808080"
                        }
                        onChange={(e) => {
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                            setRoleEditor((prev) =>
                              prev
                                ? { ...prev, color: hexToInt(e.target.value) }
                                : prev
                            );
                            setRoleEditorDirty(true);
                          }
                        }}
                        maxLength={7}
                        style={{ width: 100, fontFamily: "monospace" }}
                        placeholder="#808080"
                      />
                      <button
                        onClick={() => {
                          setRoleEditor((prev) =>
                            prev ? { ...prev, color: 0 } : prev
                          );
                          setRoleEditorDirty(true);
                        }}
                        style={{ fontSize: 12, padding: "5px 10px" }}
                      >
                        Reset
                      </button>
                    </div>
                  )}

                  {/* Gradient color pickers */}
                  {(roleEditor.displayType === RoleDisplayType.Gradient ||
                    roleEditor.displayType === RoleDisplayType.GradientGlow) && (
                    <div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                        {(roleEditor.colors.length > 0
                          ? roleEditor.colors
                          : [0x5865f2, 0xd3869b]
                        ).map((c, idx) => (
                          <div
                            key={idx}
                            style={{ display: "flex", alignItems: "center", gap: 6 }}
                          >
                            <ColorSwatch
                              size={32}
                              color={c}
                              onChange={(hex) => {
                                const newColors = [...(roleEditor.colors.length > 0 ? roleEditor.colors : [0x5865f2, 0xd3869b])];
                                newColors[idx] = hexToInt(hex);
                                setRoleEditor((prev) =>
                                  prev ? { ...prev, colors: newColors } : prev
                                );
                                setRoleEditorDirty(true);
                              }}
                            />
                            {idx > 1 && (
                              <button
                                onClick={() => {
                                  const newColors = roleEditor.colors.filter(
                                    (_, i) => i !== idx
                                  );
                                  setRoleEditor((prev) =>
                                    prev ? { ...prev, colors: newColors } : prev
                                  );
                                  setRoleEditorDirty(true);
                                }}
                                style={{
                                  background: "none",
                                  border: "none",
                                  boxShadow: "none",
                                  color: "var(--text-5)",
                                  cursor: "pointer",
                                  fontSize: 14,
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const base =
                              roleEditor.colors.length > 0
                                ? roleEditor.colors
                                : [0x5865f2, 0xd3869b];
                            setRoleEditor((prev) =>
                              prev
                                ? { ...prev, colors: [...base, 0xffffff] }
                                : prev
                            );
                            setRoleEditorDirty(true);
                          }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            border: "2px dashed var(--border)",
                            background: "none",
                            color: "var(--text-5)",
                            cursor: "pointer",
                            fontSize: 18,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0,
                            boxShadow: "none",
                          }}
                          title={t("server.add_color_stop")}
                        >
                          +
                        </button>
                      </div>
                      {/* Gradient preview */}
                      <div
                        style={{
                          height: 24,
                          borderRadius: 6,
                          background: `linear-gradient(90deg, ${(roleEditor.colors.length > 0
                            ? roleEditor.colors
                            : [0x5865f2, 0xd3869b]
                          )
                            .map(intToHex)
                            .join(", ")})`,
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Permission priority */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-5)",
                    }}
                  >
                    Permission Priority
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={roleEditor.permissionPriority}
                      onChange={(e) => {
                        setRoleEditor((prev) =>
                          prev
                            ? {
                                ...prev,
                                permissionPriority: parseInt(e.target.value),
                              }
                            : prev
                        );
                        setRoleEditorDirty(true);
                      }}
                      style={{ flex: 1 }}
                    />
                    <span
                      style={{
                        minWidth: 36,
                        textAlign: "right",
                        fontSize: 13,
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text-4)",
                      }}
                    >
                      {roleEditor.permissionPriority}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-5)" }}>
                    Higher priority roles override lower ones when conflicts arise.
                  </div>
                </div>

                {/* Delete role */}
                <div
                  style={{
                    marginTop: 16,
                    padding: "14px 16px",
                    background:
                      "color-mix(in hsl, var(--red-2), transparent 90%)",
                    borderRadius: 8,
                    border:
                      "1px solid color-mix(in hsl, var(--red-2), transparent 65%)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--red-2)",
                      marginBottom: 8,
                    }}
                  >
                    Delete Role
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-5)",
                      marginBottom: 10,
                    }}
                  >
                    Permanently removes this role. Members who only have this role will
                    revert to the default permissions.
                  </div>
                  {deleteConfirmId === selectedRoleId && selectedRoleId ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        style={{ fontSize: 12, padding: "5px 12px" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteRole(selectedRoleId)}
                        style={{
                          fontSize: 12,
                          padding: "5px 14px",
                          background: "var(--red-3)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 6,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Confirm Delete
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(selectedRoleId)}
                      style={{
                        fontSize: 12,
                        padding: "5px 14px",
                        background:
                          "color-mix(in hsl, var(--red-3), transparent 50%)",
                        color: "var(--red-2)",
                        border:
                          "1px solid color-mix(in hsl, var(--red-2), transparent 40%)",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      Delete Role
                    </button>
                  )}
                </div>
              </div>
            )}

            {roleTab === "permissions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {/* Admin shortcut banner */}
                {hasBit(roleEditor.permissions, PERMS["Administrator"].bit) && (
                  <div
                    style={{
                      padding: "10px 14px",
                      background:
                        "color-mix(in hsl, var(--yellow-2), transparent 82%)",
                      border:
                        "1px solid color-mix(in hsl, var(--yellow-2), transparent 50%)",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "var(--yellow-1)",
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    ⚠️ This role has <strong>Administrator</strong> — all other permission
                    checks are bypassed for members with this role.
                  </div>
                )}

                {PERM_GROUPS.map((group) => (
                  <div key={group.label}>
                    <SectionDivider label={t(group.label)} />
                    {group.keys.map((key) => {
                      const perm = PERMS[key];
                      if (!perm) return null;
                      const checked = hasBit(roleEditor.permissions, perm.bit);
                      const isAdmin =
                        key !== "Administrator" &&
                        hasBit(roleEditor.permissions, PERMS["Administrator"].bit);
                      return (
                        <PermToggle
                          key={key}
                          label={t(perm.label)}
                          desc={t(perm.desc)}
                          checked={checked || isAdmin}
                          danger={perm.danger}
                          disabled={isAdmin}
                          onChange={() => {
                            setRoleEditor((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    permissions: toggleBit(
                                      prev.permissions,
                                      perm.bit
                                    ),
                                  }
                                : prev
                            );
                            setRoleEditorDirty(true);
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-5)",
              gap: 10,
              paddingBottom: 40,
            }}
          >
            <div style={{ fontSize: 36 }}>🎭</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-4)" }}>
              Select a role to edit
            </div>
            <div style={{ fontSize: 12, textAlign: "center", maxWidth: 220 }}>
              Choose a role from the list, or create a new one.
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderMembers() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <input
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            placeholder={t("server.search_members")}
            style={{ width: "calc(100% - 22px)", paddingLeft: 32 }}
          />
          <SearchIcon
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-5)",
              pointerEvents: "none",
            }}
          />
        </div>

        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--text-5)",
          }}
        >
          Members — {filteredMembers.length}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {filteredMembers.map((member) => {
            const u = get(member.userId)!;
            const isExpanded = expandedMemberId === member.userId;
            const memberRoles = localRoles.filter((r) =>
              member.roles.includes(r.id)
            );

            return (
              <div
                key={member.userId}
                style={{
                  background: isExpanded ? "var(--bg-1)" : "none",
                  borderRadius: 8,
                  border: `1px solid ${isExpanded ? "var(--border)" : "transparent"}`,
                  overflow: "hidden",
                  transition: "background 100ms",
                }}
              >
                <div
                  onClick={() =>
                    setExpandedMemberId(isExpanded ? null : member.userId)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded)
                      e.currentTarget.style.background = "var(--hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded)
                      e.currentTarget.style.background = "none";
                  }}
                >
                  <img
                    src={getAvatar(u!, member)}
                    alt=""
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-2)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getDisplayName(get(member.userId), member)}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-5)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      @{u.username}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 180 }}>
                    {memberRoles.slice(0, 3).map((role) => (
                      <span
                        key={role.id}
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 10,
                          background: role.color
                            ? `color-mix(in hsl, ${intToHex(role.color)}, transparent 75%)`
                            : "var(--bg-2)",
                          color: role.color
                            ? intToHex(role.color)
                            : "var(--text-5)",
                          border: `1px solid ${
                            role.color
                              ? `color-mix(in hsl, ${intToHex(role.color)}, transparent 50%)`
                              : "var(--border)"
                          }`,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {role.name}
                      </span>
                    ))}
                    {memberRoles.length > 3 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "2px 7px",
                          borderRadius: 10,
                          background: "var(--bg-2)",
                          color: "var(--text-5)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        +{memberRoles.length - 3}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      color: "var(--text-5)",
                      fontSize: 10,
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 150ms",
                      flexShrink: 0,
                    }}
                  >
                    ▼
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ padding: "8px 12px 12px", borderTop: "1px solid var(--border-light)" }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        color: "var(--text-5)",
                        marginBottom: 8,
                      }}
                    >
                      Roles
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                      }}
                    >
                      {localRoles.map((role) => {
                        const hasRole = member.roles.includes(role.id);
                        return (
                          <button
                            key={role.id}
                            onClick={async () => {
                              if (!currentServer)
                                return;
                              try {
                                if (hasRole)
                                  removeRole(currentServer.id, u.id, role.id);
                                else
                                  assignRole(currentServer.id, u.id, role.id);
                              } catch (e: any) {
                                setSaveError(e.message ?? t("server.failed_update_role"));
                              }
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "4px 10px",
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: hasRole ? 600 : 400,
                              background: hasRole
                                ? role.color
                                  ? `color-mix(in hsl, ${intToHex(role.color)}, transparent 70%)`
                                  : "color-mix(in hsl, var(--accent-2), transparent 70%)"
                                : "var(--bg-2)",
                              color: hasRole
                                ? role.color
                                  ? intToHex(role.color)
                                  : "var(--accent-1)"
                                : "var(--text-5)",
                              border: `1px solid ${
                                hasRole
                                  ? role.color
                                    ? `color-mix(in hsl, ${intToHex(role.color)}, transparent 45%)`
                                    : "color-mix(in hsl, var(--accent-2), transparent 45%)"
                                  : "var(--border)"
                              }`,
                              cursor: "pointer",
                              transition: "background 100ms",
                            }}
                          >
                            {hasRole ? "✓" : "+"} {role.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderBans() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-4)", lineHeight: 1.5 }}>
          Banned members cannot rejoin the server unless unbanned.
        </div>

        {bansLoading ? (
          <div
            style={{ textAlign: "center", padding: "32px 0", color: "var(--text-5)" }}
          >
            Loading bans...
          </div>
        ) : bans.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              color: "var(--text-5)",
              fontSize: 13,
              borderRadius: 8,
              border: "1px dashed var(--border)",
            }}
          >
            No banned members.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bans.map((ban) => {
              const bannedUser = users.find((u) => u.id === ban.userId);
              return (
                <div
                  key={ban.userId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: "var(--bg-1)",
                    borderRadius: 8,
                    border:
                      "1px solid color-mix(in hsl, var(--red-2), transparent 80%)",
                  }}
                >
                  <img
                    src={getAvatar(bannedUser ?? null)}
                    alt=""
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      objectFit: "cover",
                      flexShrink: 0,
                      filter: "grayscale(60%)",
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-3)",
                      }}
                    >
                      {bannedUser
                        ? getDisplayName(bannedUser)
                        : `User #${ban.userId}`}
                    </div>
                    {ban.reason && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-5)",
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Reason: {ban.reason}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 2 }}>
                      {new Date(ban.bannedAt).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                  <button
                    onClick={() => handleUnban(ban.userId)}
                    disabled={unbanningId === ban.userId}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        "color-mix(in hsl, var(--green-2), transparent 78%)",
                      color: "var(--green-1)",
                      border:
                        "1px solid color-mix(in hsl, var(--green-2), transparent 50%)",
                      cursor:
                        unbanningId === ban.userId ? "wait" : "pointer",
                      flexShrink: 0,
                      opacity: unbanningId === ban.userId ? 0.6 : 1
                    }}
                  >
                    {unbanningId === ban.userId ? t("server.unbanning") : t("server.unban")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderDelete() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            padding: "16px 18px",
            background: "color-mix(in hsl, var(--red-2), transparent 88%)",
            border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
            borderRadius: 10,
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>⚠️</span>
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--red-2)",
                marginBottom: 6,
              }}
            >
              This action is irreversible
            </div>
            <div style={{ fontSize: 13, color: "var(--text-4)", lineHeight: 1.5 }}>
              Deleting the server permanently removes all channels, messages, roles, and
              member history. There is no recovery. All members will be removed immediately.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            style={{
              fontSize: 13,
              color: "var(--text-4)",
              lineHeight: 1.5,
            }}
          >
            To confirm, type the server name:{" "}
            <strong style={{ color: "var(--red-2)" }}>
              {currentServer?.name}
            </strong>
          </label>
          <input
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={currentServer?.name ?? t("server.name")}
            style={{ borderColor: deleteConfirm === currentServer?.name ? "var(--red-2)" : undefined }}
          />
        </div>

        <button
          onClick={handleDeleteServer}
          disabled={
            deleteConfirm !== currentServer?.name || deleting
          }
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            background:
              deleteConfirm === currentServer?.name
                ? "var(--red-3)"
                : "color-mix(in hsl, var(--red-2), transparent 85%)",
            color:
              deleteConfirm === currentServer?.name
                ? "#fff"
                : "var(--red-2)",
            border: "none",
            cursor:
              deleteConfirm === currentServer?.name && !deleting
                ? "pointer"
                : "not-allowed",
            opacity:
              deleteConfirm === currentServer?.name ? 1 : 0.5,
            transition: "background 200ms, opacity 200ms",
            alignSelf: "flex-start",
          }}
        >
          {deleting ? t("server.deleting") : t("server.delete_confirm", { name: currentServer?.name ?? t("alt.server") })}
        </button>
      </div>
    );
  }

  function renderTabContent() {
    switch (currentTab) {
      case "overview": return renderOverview();
      case "invites": return renderInvites();
      case "emojis": return renderEmojis();
      case "roles": return renderRoles();
      case "members": return renderMembers();
      case "bans": return renderBans();
      case "delete": return renderDelete();
      default: return null;
    }
  }

  if (!open || !currentServer)
    return null;

  const isRolesTab = currentTab === "roles";

  return (
    <>
      <div
        className={"modal-backdrop open"}
        onMouseDown={() => !hasUnsaved && !roleEditorDirty && onClose()}
      >
        <div
          className="modal-container settings"
          onMouseDown={(e) => e.stopPropagation()}
          style={{ maxHeight: "80vh" }}
        >
          {/* ── Navigation sidebar ── */}
          <div className="navigation ovy-auto ovx-hidden">
            {/* Server identity */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                padding: "0 4px",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "33%",
                  background: "var(--bg-1)",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {currentServer.icon ? (
                  <img
                    src={iconPreview ?? `/api/servers/${currentServer.id}/icon/${currentServer.icon}`}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text-4)",
                    }}
                  >
                    {currentServer.name[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentServer.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-5)" }}>
                  {t("server.settings.title")}
                </div>
              </div>
            </div>

            <div className="input-wrapper" style={{ width: "100%", marginBottom: 8 }}>
              <Search className="input-icon" />
              <input
                placeholder={t("server.settings.search")}
                value={serverSearch}
                onChange={e => setServerSearch(e.target.value)}
              />
            </div>

            <hr />

            {Object.entries(tabGroups).map(([section, items]) => {
              const visibleItems = serverSearch.trim()
                ? items.filter(item =>
                    t(TAB_LABELS[item]).toLowerCase().includes(serverSearch.toLowerCase())
                  )
                : items;
              if (visibleItems.length === 0)
                return null;
              return (
                <div key={section} className="nav-section">
                  <div
                    className="section-header uno ellipsis"
                    style={{ textTransform: "uppercase" }}
                  >
                    {section === "server"
                      ? t("server.group.server")
                      : section === "access"
                      ? t("server.group.access")
                      : t("server.group.danger")}
                  </div>
                  {visibleItems.map((item) => (
                    <div
                      key={item}
                      className={
                        "channel uno" +
                        (currentTab === item ? " selected" : " int") +
                        ((hasUnsaved || roleEditorDirty) && currentTab !== item
                          ? " semitrans"
                          : "")
                      }
                      onClick={() => selectTab(item)}
                      title={
                        (hasUnsaved || roleEditorDirty) && currentTab !== item
                          ? t("server.settings.unsaved_tab")
                          : undefined
                      }
                      style={{
                        ...(hasUnsaved || roleEditorDirty) && currentTab !== item
                          ? { opacity: 0.5, cursor: "not-allowed" }
                          : {},
                        ...(item === "delete" ? { color: "var(--red-2)" } : {}),
                      }}
                    >
                      <span style={{ marginRight: 8, marginTop: 5 }}>
                        {TAB_ICONS[item]}
                      </span>
                      {t(TAB_LABELS[item])}
                    </div>
                  ))}
                  <hr />
                </div>
              );
            })}
          </div>

          {/* ── Content area ── */}
          <div
            className="settings-content"
            style={{
              overflow: isRolesTab ? "hidden" : "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              className="settings-header uno"
              style={{ marginBottom: 24, flexShrink: 0 }}
            >
              <span style={{ marginRight: 10, fontSize: 20 }}>
                {TAB_ICONS[currentTab]}
              </span>
              {t(TAB_LABELS[currentTab])}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, minHeight: 0, overflow: isRolesTab ? "hidden" : "visible" }}>
              {renderTabContent()}
            </div>

            {/* Success / error messages */}
            {saveSuccess && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 14px",
                  background: "color-mix(in hsl, var(--green-2), transparent 80%)",
                  border: "1px solid color-mix(in hsl, var(--green-2), transparent 55%)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--green-1)",
                  flexShrink: 0,
                }}
              >
                ✓ {saveSuccess}
              </div>
            )}
            {saveError && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 14px",
                  background: "color-mix(in hsl, var(--red-2), transparent 85%)",
                  border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "var(--red-2)",
                  flexShrink: 0,
                }}
              >
                {saveError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Unsaved changes bar */}
      {hasUnsaved && (
        <div className="unsaved-bar">
          <div className="uno" style={{ fontSize: 13, color: "var(--text-4)" }}>
            You have unsaved changes
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleRevert}>{t("revert")}</button>
            <button className="save-btn" onClick={handleSave}>
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Cropping modal */}
      {showCrop && cropSrc && (
        <CroppingModal
          src={cropSrc}
          onCancel={() => { setShowCrop(false); setCropSrc(null); }}
          onComplete={onCropDone}
          headerText={cropMode === "icon" ? t("server.crop_icon") : t("server.crop_banner")}
          shape={cropMode === "icon" ? "circle" : "rect"}
          rectAspect={cropMode === "banner" ? 4 : undefined}
        />
      )}
    </>
  );
}
