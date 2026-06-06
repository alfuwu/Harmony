import { useState, useRef, useEffect } from "react";
import { useAuthState } from "../../../lib/state/Auth";
import { useUserState } from "../../../lib/state/Users";
import { useMessageState } from "../../../lib/state/Messages";
import { useServerState } from "../../../lib/state/Servers";
import {
  updateProfile, updateSettings, updatePrivacy,
  changeAvatar, changeBanner, changeFont,
  deleteAvatar, deleteBanner, deleteFont,
} from "../../../lib/api/userApi";
import { sendVerificationEmail } from "../../../lib/api/authApi";
import { getAvatar, getBanner, getDisplayName } from "../../../lib/utils/UserUtils";
import Search from "../../svgs/settings/Search";
import CroppingModal from "./CroppingModal";
import MessageInput, { MessageInputHandle } from "../../messages/MessageInput";
import TwoFactorModal from "./TwoFactorModal";
import ChangeUsernameModal from "./ChangeUsernameModal";
import ChangePhoneModal from "./ChangePhoneModal";

import type { UserSettings } from "../../../lib/utils/userSettings";
import { User } from "../../../lib/utils/types";

function intToHex(n: number): string {
  return "#" + Math.max(0, n >>> 0).toString(16).padStart(6, "0");
}
function hexToInt(hex: string): number {
  return parseInt(hex.replace("#", ""), 16) || 0;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 42, height: 24, borderRadius: 12, border: "none", padding: 0,
        background: value ? "var(--accent-3)" : "var(--bg-2)",
        position: "relative", cursor: "pointer", flexShrink: 0,
        transition: "background 200ms",
        boxShadow: "inset 0 0 0 1px var(--button-border)",
      }}
    >
      <span style={{
        position: "absolute", top: 4, left: value ? 22 : 4,
        width: 16, height: 16, borderRadius: "50%",
        background: value ? "#fff" : "var(--text-5)",
        transition: "left 180ms ease, background 180ms",
        display: "block",
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      }} />
    </button>
  );
}

type Opt = { value: number; label: string };

function Sel({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: Opt[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        background: "var(--bg-2)", color: "var(--text-3)",
        border: "1px solid var(--button-border)", padding: "5px 8px",
        borderRadius: 6, fontSize: 13, cursor: "pointer",
        minWidth: 170, boxShadow: "none",
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

interface VisualOpt {
  value: number;
  label: string;
  preview: React.ReactNode;
}

function VisualSel({ value, onChange, options }: {
  value: number;
  onChange: (v: number) => void;
  options: VisualOpt[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value) ?? options[0];

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button
        className="visual-sel-trigger"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 10px", borderRadius: 6, cursor: "pointer",
          background: "var(--bg-2)", border: "1px solid var(--button-border)",
          color: "var(--text-3)", fontSize: 13, minWidth: 190,
          boxShadow: "none",
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{current.label}</span>
        <span style={{ color: "var(--text-5)", fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)",
          background: "var(--bg-2)", border: "1px solid var(--border)",
          borderRadius: 8, zIndex: 300, minWidth: 240, overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: "flex", flexDirection: "column", gap: 6,
                width: "100%", padding: "10px 12px", cursor: "pointer",
                background: opt.value === value ? "var(--active)" : "none",
                border: "none", textAlign: "left", color: "var(--text-3)",
                fontSize: 13, boxShadow: "none",
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <span style={{ fontWeight: opt.value === value ? 600 : 400 }}>{opt.label}</span>
              <div style={{ borderRadius: 6, overflow: "hidden", pointerEvents: "none" }}>
                {opt.preview}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Slider({
  value, onChange, min, max, step, format,
}: {
  value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  format?: (v: number) => string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 220 }}>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1 }}
      />
      <span style={{
        minWidth: 44, textAlign: "right", fontSize: 13,
        color: "var(--text-4)", fontVariantNumeric: "tabular-nums",
      }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 0", borderBottom: "1px solid var(--border-light)",
      gap: 16, minHeight: 46,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 500 }}>{label}</div>
        {desc && (
          <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3, lineHeight: 1.4 }}>{desc}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--text-5)",
          paddingBottom: 8, marginBottom: 2,
          borderBottom: "1px solid var(--border)",
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function InfoBanner({ children, variant = "warn" }: { children: React.ReactNode; variant?: "warn" | "info" }) {
  const colors = variant === "warn"
    ? { bg: "color-mix(in hsl, var(--yellow-2), transparent 82%)", border: "color-mix(in hsl, var(--yellow-2), transparent 55%)", text: "var(--yellow-1)" }
    : { bg: "color-mix(in hsl, var(--blue-2), transparent 82%)", border: "color-mix(in hsl, var(--blue-2), transparent 55%)", text: "var(--blue-1)" };
  return (
    <div style={{
      background: colors.bg, border: `1px solid ${colors.border}`,
      borderRadius: 8, padding: "10px 14px", marginBottom: 20,
      fontSize: 13, color: colors.text, lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

function CompactPreview({ compact }: { compact: boolean }) {
  const msgs = [
    { name: "Alice", color: "#d3869b", text: "Hey, what's up?" },
    { name: "Bob",   color: "#7caea3", text: "Not much, just working on the new feature" },
    { name: "Alice", color: "#d3869b", text: "Nice! How's it going?" },
  ];
  return (
    <div style={{
      background: "var(--bg-4)", borderRadius: 6, padding: "8px 10px",
      fontSize: 11, lineHeight: compact ? 1.3 : 1.6,
      display: "flex", flexDirection: "column", gap: compact ? 1 : 6,
    }}>
      {msgs.map((m, i) => (
        <div key={i} style={{ display: "flex", gap: compact ? 6 : 8, alignItems: compact ? "baseline" : "flex-start" }}>
          {!compact && (
            <div style={{
              width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
              background: m.color, marginTop: 1,
            }} />
          )}
          <span style={{ color: m.color, fontWeight: 600, fontSize: compact ? 10 : 11, flexShrink: 0 }}>
            {compact ? m.name.slice(0, 3) : m.name}
          </span>
          {compact && <span style={{ color: "var(--text-5)", fontSize: 9 }}>12:00</span>}
          <span style={{ color: "var(--text-4)", fontSize: compact ? 10 : 11 }}>{m.text}</span>
        </div>
      ))}
    </div>
  );
}

function AvatarShapePreview({ shape }: { shape: "circle" | "rounded" | "square" }) {
  const r = shape === "circle" ? "50%" : shape === "rounded" ? "25%" : "4px";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
      {["#d3869b","#7caea3","#a8b665"].map((c, i) => (
        <div key={i} style={{ width: 28, height: 28, borderRadius: r, background: c, flexShrink: 0 }} />
      ))}
      <span style={{ fontSize: 11, color: "var(--text-5)" }}>{shape}</span>
    </div>
  );
}

function RoleColorPreview({ mode }: { mode: number }) {
  const roles = [{ color: "#d3869b", name: "Admin" }, { color: "#7caea3", name: "Mod" }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, padding: "4px 0" }}>
      {roles.map((r, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {(mode === 1 || mode === 2) && (
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.color, flexShrink: 0, display: "inline-block" }} />
          )}
          <span style={{ fontSize: 11, fontWeight: 600, color: (mode === 0 || mode === 2) ? r.color : "var(--text-4)" }}>
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function SpoilerPreview({ reveal }: { reveal: number }) {
  const shown = reveal === 0;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "var(--text-4)" }}>This message contains a </span>
      <span style={{
        fontSize: 11, padding: "1px 4px", borderRadius: 3,
        background: shown ? "transparent" : "var(--bg-1)",
        color: shown ? "var(--text-3)" : "transparent",
        border: shown ? "none" : "1px solid var(--border)",
        cursor: "pointer",
      }}>spoiler</span>
    </div>
  );
}

function ThemePreview({ theme }: { theme: number }) {
  const dark = theme !== 0;
  return (
    <div style={{ background: dark ? "#282828" : "#f5f0e8", borderRadius: 6, padding: "6px 10px", fontSize: 11, display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: dark ? "#3c3836" : "#d4be98", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ background: dark ? "#504945" : "#d4c5a0", height: 8, borderRadius: 4, width: "60%", marginBottom: 4 }} />
          <div style={{ background: dark ? "#3c3836" : "#ddd0b0", height: 7, borderRadius: 4, width: "85%" }} />
        </div>
      </div>
    </div>
  );
}

function EmojiStylePreview({ system }: { system: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
      <span style={{ fontSize: system ? 18 : 14 }}>{system ? "😀🎉🔥" : ""}</span>
      {!system && <span style={{ fontSize: 11, color: "var(--text-5)" }}>Twemoji cross-platform rendering</span>}
      <span style={{ fontSize: 11, color: "var(--text-4)" }}>{system ? "System native emoji" : ""}</span>
    </div>
  );
}

const THEME_VISUAL: VisualOpt[] = [
  { value: 1, label: "Dark", preview: <ThemePreview theme={1} /> },
  { value: 0, label: "Light", preview: <ThemePreview theme={0} /> },
  { value: 2, label: "Follow System", preview: <div style={{ display:"flex", gap:4 }}><ThemePreview theme={0} /><ThemePreview theme={1} /></div> },
];
const COMPACT_VISUAL: VisualOpt[] = [
  { value: 0, label: "Cozy (default)", preview: <CompactPreview compact={false} /> },
  { value: 1, label: "Compact", preview: <CompactPreview compact={true} /> },
];
const AVATAR_SHAPE_VISUAL: VisualOpt[] = [
  { value: 0, label: "Circle", preview: <AvatarShapePreview shape="circle" /> },
  { value: 1, label: "Rounded Square", preview: <AvatarShapePreview shape="rounded" /> },
  { value: 2, label: "Square", preview: <AvatarShapePreview shape="square" /> },
];
const USER_AVATAR_SHAPE_VISUAL: VisualOpt[] = [
  { value: 0, label: "Circle", preview: <AvatarShapePreview shape="circle" /> },
  { value: 1, label: "Rounded Square", preview: <AvatarShapePreview shape="rounded" /> },
  { value: 2, label: "Square", preview: <AvatarShapePreview shape="square" /> },
  { value: 3, label: "User Preference", preview: <div style={{fontSize:11,color:"var(--text-5)",padding:"4px 0"}}>Respects each user's chosen shape</div> },
];
const ROLE_COLOR_VISUAL: VisualOpt[] = [
  { value: 0, label: "Color Names", preview: <RoleColorPreview mode={0} /> },
  { value: 1, label: "Role Dot", preview: <RoleColorPreview mode={1} /> },
  { value: 2, label: "Dot and Name Color", preview: <RoleColorPreview mode={2} /> },
  { value: 3, label: "Don't Show", preview: <RoleColorPreview mode={3} /> },
];
const SPOILER_VISUAL: VisualOpt[] = [
  { value: 0, label: "Always", preview: <SpoilerPreview reveal={0} /> },
  { value: 1, label: "On Click", preview: <SpoilerPreview reveal={1} /> },
  { value: 2, label: "On Hover", preview: <SpoilerPreview reveal={2} /> },
  { value: 3, label: "On Moderated Servers Only", preview: <SpoilerPreview reveal={3} /> },
];
const EMOJI_STYLE_VISUAL: VisualOpt[] = [
  { value: 0, label: "Twemoji (Cross-platform)", preview: <EmojiStylePreview system={false} /> },
  { value: 1, label: "System", preview: <EmojiStylePreview system={true} /> },
];

const APP_ICON_OPTS: Opt[] = [
  { value: 0, label: "Default" },
  { value: 1, label: "Classic" },
  { value: 2, label: "Modern" },
  { value: 3, label: "Minimal" },
];
const ICON_OPTS: Opt[] = [
  { value: 0, label: "Circle" },
  { value: 1, label: "Rounded" },
  { value: 2, label: "Square" },
];
const NAME_HOVER_OPTS: Opt[] = [
  { value: 0, label: "Nothing" },
  { value: 1, label: "Show Handle (@username)" },
];
const FONT_DISPLAY_OPTS: Opt[] = [
  { value: 0, label: "Everyone" },
  { value: 1, label: "Friends" },
  { value: 2, label: "Friends of Friends" },
  { value: 3, label: "No One" },
];
const ANIMATE_OPTS: Opt[] = [
  { value: 0, label: "Always" },
  { value: 1, label: "When App is Focused" },
  { value: 2, label: "On Hover" },
  { value: 3, label: "On Click" },
  { value: 4, label: "Never" },
];
const VOICE_OPTS: Opt[] = [
  { value: 0, label: "Voice Activity" },
  { value: 1, label: "Push to Talk" },
];
const FRIEND_REQ_OPTS: Opt[] = [
  { value: 0, label: "Everyone" },
  { value: 1, label: "Friends of Friends" },
  { value: 2, label: "Mutuals and Friends of Friends" },
  { value: 3, label: "Mutual Servers Only" },
  { value: 4, label: "No One" },
];
const USER_CTX_OPTS: Opt[] = [
  { value: 0, label: "Everyone" },
  { value: 1, label: "Friends of Friends" },
  { value: 2, label: "Friends Only" },
  { value: 3, label: "Mutuals and Friends of Friends" },
  { value: 4, label: "Mutual Servers and Friends" },
  { value: 5, label: "Mutual Servers Only" },
  { value: 6, label: "No One" },
];

interface PrivacyState {
  whoCanSendFriendRequests: number;
  whoCanSendDms: number;
  whoCanAddToGcs: number;
  whoCanSeeBio: number;
  whoCanSeePronouns: number;
  whoCanSeeAvatar: number;
  whoCanSeeBanner: number;
  whoCanSeeStatus: number;
  whoCanSeeEmail: number;
  whoCanSeePhoneNumber: number;
}

function privacyFromUser(user: User | null): PrivacyState {
  return {
    whoCanSendFriendRequests: user?.whoCanSendFriendRequests ?? 0,
    whoCanSendDms: user?.whoCanSendDms ?? 4,
    whoCanAddToGcs: user?.whoCanAddToGcs ?? 4,
    whoCanSeeBio: user?.whoCanSeeBio ?? 0,
    whoCanSeePronouns: user?.whoCanSeePronouns ?? 0,
    whoCanSeeAvatar: user?.whoCanSeeAvatar ?? 0,
    whoCanSeeBanner: user?.whoCanSeeBanner ?? 0,
    whoCanSeeStatus: user?.whoCanSeeStatus ?? 0,
    whoCanSeeEmail: user?.whoCanSeeEmail ?? 6,
    whoCanSeePhoneNumber: user?.whoCanSeePhoneNumber ?? 6,
  };
}

export default function UserSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token, user, setUser, userSettings, setUserSettings } = useAuthState();
  const { addUser, setMembers } = useUserState();
  const { setMessages } = useMessageState();
  const { setServers } = useServerState();

  const [currentTab, setCurrentTab] = useState("My Account");

  const [displayName, setDisplayName] = useState<string | null | undefined>(user?.displayName);
  const [pronouns, setPronouns] = useState<string | null | undefined>(user?.pronouns);
  const [bio, setBio] = useState<string | null | undefined>(user?.bio);
  const [bannerColorHex, setBannerColorHex] = useState(intToHex(user?.bannerColor ?? 0));

  const [emailRevealed, setEmailRevealed] = useState(false);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [fontFile, setFontFile] = useState<File | string | null>(null);
  const [fAviFile, setFAviFile] = useState<File | null>(null);
  const [fBaniFile, setFBaniFile] = useState<File | null>(null);
  const [croppingSrc, setCroppingSrc] = useState<string | null>(null);
  const [showAviCropper, setShowAviCropper] = useState(false);
  const [showBaniCropper, setShowBaniCropper] = useState(false);

  const [privacy, setPrivacy] = useState<PrivacyState>(() => privacyFromUser(user));
  function pwr(key: keyof PrivacyState, value: number) {
    setPrivacy(prev => ({ ...prev, [key]: value }));
  }

  const bioRef = useRef<MessageInputHandle>(null);

  const [twoFactorModalMode, setTwoFactorModalMode] = useState<"setup" | "disable">("setup");
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [changeUsernameOpen, setChangeUsernameOpen] = useState(false);
  const [changePhoneOpen, setChangePhoneOpen] = useState(false);

  const [emailResendCooldown, setEmailResendCooldown] = useState(0);
  const [emailResendMsg, setEmailResendMsg] = useState("");

  useEffect(() => {
    if (emailResendCooldown <= 0)
      return;
    const id = setTimeout(() => setEmailResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [emailResendCooldown]);

  const initialRef = useRef({
    displayName: user?.displayName,
    pronouns: user?.pronouns,
    bio: user?.bio,
    bannerColor: user?.bannerColor ?? 0,
    settings: userSettings ? JSON.stringify(userSettings) : null,
    privacy: JSON.stringify(privacyFromUser(user)),
  });

  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if ((initialRef.current?.settings ?? null) == null && userSettings)
      initialRef.current.settings = JSON.stringify(userSettings);
  }, [userSettings]);

  function dirtyCategories() {
    const settingsDirty = !!userSettings && JSON.stringify(userSettings) !== initialRef.current.settings;
    const privacyDirty = JSON.stringify(privacy) !== initialRef.current.privacy;
    const profileDirty =
      displayName !== initialRef.current.displayName ||
      pronouns !== initialRef.current.pronouns ||
      bio !== initialRef.current.bio ||
      hexToInt(bannerColorHex) !== initialRef.current.bannerColor ||
      fAviFile !== null || fBaniFile !== null ||
      (fontFile !== null && !(typeof fontFile === "string" && fontFile === user?.nameFont));
    return { settingsDirty, privacyDirty, profileDirty };
  }

  useEffect(() => {
    const dc = dirtyCategories();
    setHasUnsaved(dc.settingsDirty || dc.privacyDirty || dc.profileDirty);
  }, [userSettings, privacy, displayName, pronouns, bio, bannerColorHex, fAviFile, fBaniFile, fontFile]);

  useEffect(() => {
    if (fontFile && typeof fontFile !== "string") {
      const url = URL.createObjectURL(fontFile);
      const style = document.createElement("style");
      style.textContent = `@font-face{font-family:"UploadedFont";src:url(${url});}`;
      document.head.appendChild(style);
      return () => {
        setTimeout(() => { document.head.removeChild(style); URL.revokeObjectURL(url); }, 50);
      };
    }
  }, [fontFile]);

  function rd(key: keyof UserSettings, def: unknown): unknown {
    return userSettings?.[key] ?? def;
  }
  function wr(key: keyof UserSettings, value: unknown) {
    setUserSettings((prev: UserSettings | null) => prev ? { ...prev, [key]: value } : prev);
  }

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; e.target.value = "";
    setAvatarFile(f);
    const r = new FileReader();
    r.onload = () => { setCroppingSrc(r.result as string); setShowAviCropper(true); };
    r.readAsDataURL(f);
  }
  function pickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; e.target.value = "";
    setBannerFile(f);
    const r = new FileReader();
    r.onload = () => { setCroppingSrc(r.result as string); setShowBaniCropper(true); };
    r.readAsDataURL(f);
  }
  function pickFont(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return; e.target.value = ""; setFontFile(f);
  }
  function onAviCrop(blob: Blob) {
    setFAviFile(new File([blob], avatarFile?.name ?? "avatar.png", { type: blob.type }));
    setShowAviCropper(false); setCroppingSrc(null); setAvatarFile(null);
  }
  function onBaniCrop(blob: Blob) {
    setFBaniFile(new File([blob], bannerFile?.name ?? "banner.png", { type: blob.type }));
    setShowBaniCropper(false); setCroppingSrc(null); setBannerFile(null);
  }

  const opts = { headers: { Authorization: `Bearer ${token}` } };

  async function rmAvatar() {
    try {
      const res = await deleteAvatar(opts);
      const u = { ...user!, avatar: res.avatar };
      setUser(u);
      addUser(u);
      setFAviFile(null);
    } catch (e: any) {
      setSaveError((e as Error).message ?? "Failed");
    }
  }
  async function rmBanner() {
    try {
      const res = await deleteBanner(opts);
      const u = { ...user!, banner: res.banner };
      setUser(u);
      addUser(u);
      setFBaniFile(null);
    } catch (e: any) {
      setSaveError((e as Error).message ?? "Failed");
    }
  }
  async function rmFont() {
    try {
      const res = await deleteFont(opts);
      const u = { ...user!, nameFont: res.nameFont }; setUser(u); addUser(u); setFontFile(null);
    } catch (e: any) {
      setSaveError((e as Error).message ?? "Failed");
    }
  }

  function handleRevert() {
    setDisplayName(initialRef.current.displayName);
    setPronouns(initialRef.current.pronouns);
    setBio(initialRef.current.bio);
    setBannerColorHex(intToHex(initialRef.current.bannerColor));
    if (initialRef.current.settings)
      setUserSettings(JSON.parse(initialRef.current.settings));
    setPrivacy(JSON.parse(initialRef.current.privacy));
    setFAviFile(null); setFBaniFile(null); setFontFile(null);
    setAvatarFile(null); setBannerFile(null);
    bioRef.current?.setText(initialRef.current.bio);
    setSaveError("");
  }

  async function handleSave() {
    setSaveError("");
    const dc = dirtyCategories();
    try {
      let u = { ...user! };

      if (dc.profileDirty) {
        await updateProfile({
          displayName: displayName ?? null,
          pronouns: pronouns ?? null,
          bio: bio ?? null,
          bannerColor: hexToInt(bannerColorHex),
        }, undefined, opts);
        u = { ...u, displayName: displayName ?? null, pronouns: pronouns ?? null,
          bio: bio ?? null, bannerColor: hexToInt(bannerColorHex) };
      }

      if (fAviFile) {
        const res = await changeAvatar(fAviFile, opts);
        u.avatar = res.avatar;
        setFAviFile(null);
      }
      if (fBaniFile) {
        const res = await changeBanner(fBaniFile, opts);
        u.banner = res.banner;
        setFBaniFile(null);
      }
      if (fontFile instanceof File) {
        const res = await changeFont(fontFile, opts);
        u.nameFont = res.nameFont;
        setFontFile(null);
      }

      if (dc.privacyDirty) {
        const orig = JSON.parse(initialRef.current.privacy) as PrivacyState;
        const patch: Partial<PrivacyState> = {};
        (Object.keys(privacy) as (keyof PrivacyState)[]).forEach(k => {
          if (privacy[k] !== orig[k])
            patch[k] = privacy[k];
        });
        if (Object.keys(patch).length > 0)
          await updatePrivacy(patch, opts);
        u = { ...u, ...privacy };
      }

      if (dc.settingsDirty && userSettings)
        await updateSettings(userSettings, opts);

      if (JSON.stringify(u) !== JSON.stringify(user)) {
        setUser(u);
        addUser(u);
      }

      initialRef.current = {
        displayName: u.displayName,
        pronouns: u.pronouns,
        bio: u.bio,
        bannerColor: u.bannerColor ?? 0,
        settings: userSettings ? JSON.stringify(userSettings) : null,
        privacy: JSON.stringify(privacy),
      };
      setHasUnsaved(false);
    } catch (err: unknown) {
      setSaveError((err as Error).message ?? "Failed to save changes.");
    }
  }

  async function logout() {
    onClose();
    setUser(null);
    setMessages([]);
    setMembers([]);
    setServers([]);
    localStorage.removeItem("token");
  }

  function selectTab(tab: string) {
    if (hasUnsaved)
      return;
    setCurrentTab(tab);
    setSaveError("");
  }

  function iconUrl(tab: string) {
    return tab.toLowerCase().replace(/\s/gm, "").replace(/&/gm, "and");
  }

  function renderAccountTab() {
    const avatar = getAvatar(user);
    const banner = getBanner(user);
    const name = getDisplayName(user);
    const twoFaEnabled = user?.twoFactorEnabled ?? false;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        <div className="profile-display">
          <div
            className="banner"
            style={{
              "--banner-color": "#" + (user?.bannerColor?.toString(16)?.padStart(6, "0") ?? "000000"),
              "--banner": banner ? `url(${banner})` : undefined,
            } as any}
          />
          <div className="profile-name uno">
            <img className="big-avatar uno" src={avatar} alt="avatar" />
            <div>
              <div style={{ fontFamily: `"${user?.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif` }}>
                {name}
              </div>
              <div className="profile-id">ID: {user?.id}</div>
            </div>
            <button onClick={() => selectTab("Profiles")}>Edit User Profile</button>
          </div>
          <div className="profile-details uno">
            <div className="profile-item">
              <div>
                <div>Display Name</div>
                <div style={{ fontFamily: user?.displayName ? `"${user?.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif` : undefined }}>
                  {user?.displayName ?? <span style={{ color: "var(--text-5)", fontStyle: "italic" }}>Not set</span>}
                </div>
              </div>
              <button onClick={() => selectTab("Profiles")}>Edit</button>
            </div>
            <div className="profile-item">
              <div>
                <div>Username</div>
                <div>@{user?.username}{user?.discriminator ? `#${String(user.discriminator).padStart(4, "0")}` : ""}</div>
              </div>
              <button onClick={() => setChangeUsernameOpen(true)}>Edit</button>
            </div>
            <div className="profile-item">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Email
                  {user?.email && !user.emailVerified && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: "color-mix(in hsl, var(--yellow-2), transparent 78%)",
                      color: "var(--yellow-1)",
                      border: "1px solid color-mix(in hsl, var(--yellow-2), transparent 50%)",
                    }}>
                      Unverified
                    </span>
                  )}
                  {user?.email && user.emailVerified && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: "color-mix(in hsl, var(--green-2), transparent 78%)",
                      color: "var(--green-1)",
                      border: "1px solid color-mix(in hsl, var(--green-2), transparent 50%)",
                    }}>
                      Verified
                    </span>
                  )}
                </div>
                <div>
                  {user?.email
                    ? emailRevealed
                      ? user.email
                      : "*".repeat((user.email.indexOf("@") > 0 ? user.email.indexOf("@") : 4)) + user.email.substring(user.email.indexOf("@"))
                    : <span style={{ color: "var(--text-5)", fontStyle: "italic" }}>Not set</span>
                  }
                  {user?.email && (
                    <a className="ml" onClick={() => setEmailRevealed(!emailRevealed)}>
                      {emailRevealed ? "Hide" : "Reveal"}
                    </a>
                  )}
                </div>
                {/* Resend verification */}
                {user?.email && !user.emailVerified && (
                  <div style={{ marginTop: 4 }}>
                    <a
                      style={{
                        fontSize: 12,
                        color: emailResendCooldown > 0 ? "var(--text-5)" : "var(--accent-1)",
                        cursor: emailResendCooldown > 0 ? "default" : "pointer",
                      }}
                      onClick={async () => {
                        if (emailResendCooldown > 0) return;
                        try {
                          await sendVerificationEmail(null, opts);
                          setEmailResendCooldown(60);
                          setEmailResendMsg("Verification email sent!");
                          setTimeout(() => setEmailResendMsg(""), 4000);
                        } catch (e: any) {
                          setEmailResendMsg(e.message ?? "Failed to resend");
                          setTimeout(() => setEmailResendMsg(""), 4000);
                        }
                      }}
                    >
                      {emailResendCooldown > 0
                        ? `Resend in ${emailResendCooldown}s`
                        : "Resend verification email"}
                    </a>
                    {emailResendMsg && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-5)" }}>
                        {emailResendMsg}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="profile-item">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Phone Number
                  {user?.phoneNumber && user.phoneNumberVerified && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: "color-mix(in hsl, var(--green-2), transparent 78%)",
                      color: "var(--green-1)",
                      border: "1px solid color-mix(in hsl, var(--green-2), transparent 50%)",
                    }}>
                      Verified
                    </span>
                  )}
                </div>
                <div>
                  {user?.phoneNumber
                    ? phoneRevealed
                      ? user.phoneNumber
                      : "•".repeat(user.phoneNumber.length)
                    : <span style={{ color: "var(--text-5)", fontStyle: "italic" }}>Not set</span>
                  }
                  {user?.phoneNumber && (
                    <a className="ml" onClick={() => setPhoneRevealed(!phoneRevealed)}>
                      {phoneRevealed ? "Hide" : "Reveal"}
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => setChangePhoneOpen(true)}>
                {user?.phoneNumber ? "Edit" : "Add"}
              </button>
            </div>
          </div>
        </div>

        <div className="profile-display" style={{ padding: "16px 20px" }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "var(--text-5)",
            paddingBottom: 10, marginBottom: 4,
            borderBottom: "1px solid var(--border)",
          }}>
            Security
          </div>

          <div className="profile-item" style={{ marginTop: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Two-Factor Authentication
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                  background: twoFaEnabled
                    ? "color-mix(in hsl, var(--green-2), transparent 78%)"
                    : "color-mix(in hsl, var(--text-5), transparent 78%)",
                  color: twoFaEnabled ? "var(--green-1)" : "var(--text-5)",
                  border: `1px solid ${twoFaEnabled
                    ? "color-mix(in hsl, var(--green-2), transparent 50%)"
                    : "color-mix(in hsl, var(--text-5), transparent 50%)"}`,
                }}>
                  {twoFaEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 2 }}>
                {twoFaEnabled
                  ? "Your account is protected with an authenticator app."
                  : "Add an extra layer of security to your account using an authenticator app."}
              </div>
            </div>
            <button
              onClick={() => {
                setTwoFactorModalMode(twoFaEnabled ? "disable" : "setup");
                setTwoFactorModalOpen(true);
              }}
              style={twoFaEnabled ? {
                color: "var(--red-2)",
                borderColor: "color-mix(in hsl, var(--red-2), transparent 60%)",
              } : undefined}
            >
              {twoFaEnabled ? "Disable" : "Enable"}
            </button>
          </div>

          {!user?.emailVerified && (
            <div style={{
              marginTop: 12,
              background: "color-mix(in hsl, var(--yellow-2), transparent 86%)",
              border: "1px solid color-mix(in hsl, var(--yellow-2), transparent 55%)",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              color: "var(--yellow-1)",
            }}>
              ⚠️ You must verify your email before enabling two-factor authentication.
            </div>
          )}
        </div>

      </div>
    );
  }

  function renderProfilesTab() {
    const avatar = getAvatar(user);
    const banner = getBanner(user);
    const previewAvatar = fAviFile ? URL.createObjectURL(fAviFile) : avatar;
    const previewBanner = fBaniFile ? URL.createObjectURL(fBaniFile) : banner;

    return (
      <div className="profiles">
        <div className="profiles-content halign">
          <div className="profiles-item">
            <Group title="Display">
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Display Name</label>
                <input value={displayName ?? ""} placeholder={user?.username}
                  onChange={e => setDisplayName(e.target.value || null)} maxLength={32} />
                <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 3 }}>
                  {(displayName ?? "").length}/32 — shown instead of your username
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Pronouns</label>
                <input value={pronouns ?? ""} placeholder="they/them"
                  onChange={e => setPronouns(e.target.value || null)} maxLength={40} />
              </div>
            </Group>

            <Group title="Avatar">
              <div style={{ display: "flex", gap: 8, paddingTop: 8, paddingBottom: 4 }}>
                <button onClick={() => document.getElementById("avi-file-pick")?.click()}>
                  {user?.avatar ? "Change Avatar" : "Set Avatar"}
                  <input id="avi-file-pick" type="file" accept="image/*" style={{ display: "none" }} onChange={pickAvatar} />
                </button>
                <button style={{ color: "var(--red-2)" }} onClick={rmAvatar} disabled={!user?.avatar && !fAviFile}>Remove</button>
              </div>
            </Group>

            <Group title="Banner">
              <div style={{ display: "flex", gap: 8, paddingTop: 8, paddingBottom: 10 }}>
                <button onClick={() => document.getElementById("ban-file-pick")?.click()}>
                  {user?.banner ? "Change Banner" : "Set Banner"}
                  <input id="ban-file-pick" type="file" accept="image/*" style={{ display: "none" }} onChange={pickBanner} />
                </button>
                <button style={{ color: "var(--red-2)" }} onClick={rmBanner} disabled={!user?.banner && !fBaniFile}>Remove</button>
              </div>
              <div className="form-group" style={{ marginBottom: 4 }}>
                <label>Banner Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                  <input type="color" value={bannerColorHex} onChange={e => setBannerColorHex(e.target.value)}
                    style={{ width: 44, height: 32, padding: 2, cursor: "pointer", boxSizing: "border-box" }} />
                  <input value={bannerColorHex}
                    onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBannerColorHex(v); }}
                    maxLength={7} style={{ width: 96, fontFamily: "monospace" }} placeholder="#000000" />
                </div>
              </div>
            </Group>

            <Group title="Name Font">
              <div style={{ paddingTop: 8, paddingBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => document.getElementById("font-file-pick")?.click()}>
                    {user?.nameFont ? "Change Font" : "Set Font"}
                    <input id="font-file-pick" type="file" accept=".ttf,.otf,.woff,.woff2,.sfnt"
                      style={{ display: "none" }} onChange={pickFont} />
                  </button>
                  <button style={{ color: "var(--red-2)" }} onClick={rmFont} disabled={!user?.nameFont && !fontFile}>Remove</button>
                </div>
                {fontFile && typeof fontFile !== "string" && (
                  <div style={{ fontSize: 12, color: "var(--text-5)" }}>Selected: {(fontFile as File).name}</div>
                )}
              </div>
            </Group>

            <Group title="About Me">
              <div className="about-me">
                <MessageInput isChannel={false} placeholderText="Write something about yourself..."
                  initialText={bio} setText={setBio} giveNull ref={bioRef} />
              </div>
            </Group>
          </div>

          <div className="preview">
            <div className="banner" style={{
              // @ts-expect-error
              "--banner-color": bannerColorHex,
              "--banner": previewBanner ? `url(${previewBanner})` : "",
              minHeight: "10vh",
            }} />
            <img className="big-avatar uno" src={previewAvatar} alt="preview" />
            <div className="profile-name uno"
              style={{ fontFamily: `"UploadedFont", "${user?.nameFont ?? ""}", Inter, sans-serif` }}>
              <div>{displayName || user?.username}</div>
            </div>
            {pronouns && (
              <div style={{ fontSize: 12, color: "var(--text-5)", marginLeft: 14, marginTop: -2 }}>{pronouns}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderPrivacyTab() {
    return (
      <div>
        <Group title="Social">
          <Row label="Who can send you friend requests">
            <Sel value={privacy.whoCanSendFriendRequests} onChange={v => pwr("whoCanSendFriendRequests", v)} options={FRIEND_REQ_OPTS} />
          </Row>
          <Row label="Who can send you direct messages">
            <Sel value={privacy.whoCanSendDms} onChange={v => pwr("whoCanSendDms", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="Who can add you to group DMs">
            <Sel value={privacy.whoCanAddToGcs} onChange={v => pwr("whoCanAddToGcs", v)} options={USER_CTX_OPTS} />
          </Row>
        </Group>

        <Group title="Profile Visibility">
          <Row label="Who can see your bio">
            <Sel value={privacy.whoCanSeeBio} onChange={v => pwr("whoCanSeeBio", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="Who can see your pronouns">
            <Sel value={privacy.whoCanSeePronouns} onChange={v => pwr("whoCanSeePronouns", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="Who can see your avatar">
            <Sel value={privacy.whoCanSeeAvatar} onChange={v => pwr("whoCanSeeAvatar", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="Who can see your banner">
            <Sel value={privacy.whoCanSeeBanner} onChange={v => pwr("whoCanSeeBanner", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="Who can see your status">
            <Sel value={privacy.whoCanSeeStatus} onChange={v => pwr("whoCanSeeStatus", v)} options={USER_CTX_OPTS} />
          </Row>
        </Group>

        <Group title="Contact Info">
          <Row label="Who can see your email">
            <Sel value={privacy.whoCanSeeEmail} onChange={v => pwr("whoCanSeeEmail", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="Who can see your phone number">
            <Sel value={privacy.whoCanSeePhoneNumber} onChange={v => pwr("whoCanSeePhoneNumber", v)} options={USER_CTX_OPTS} />
          </Row>
        </Group>
      </div>
    );
  }

  function renderAppearanceTab() {
    return (
      <div>
        <Group title="Theme">
          <Row label="App Theme"><VisualSel value={(rd("theme",1)) as number} onChange={v => wr("theme",v)} options={THEME_VISUAL} /></Row>
          <Row label="App Icon"><Sel value={(rd("appIcon",0)) as number} onChange={v => wr("appIcon",v)} options={APP_ICON_OPTS} /></Row>
        </Group>
        <Group title="Layout">
          <Row label="Message Density"><VisualSel value={(rd("compactMode",false)) as boolean ? 1:0} onChange={v=>wr("compactMode",v===1)} options={COMPACT_VISUAL} /></Row>
        </Group>
        <Group title="Icon Shapes">
          <Row label="Server Icon Shape"><VisualSel value={(rd("serverIconDisplayType",1)) as number} onChange={v=>wr("serverIconDisplayType",v)} options={AVATAR_SHAPE_VISUAL} /></Row>
          <Row label="Other Users' Avatar Shape"><VisualSel value={(rd("avatarDisplayType",3)) as number} onChange={v=>wr("avatarDisplayType",v)} options={USER_AVATAR_SHAPE_VISUAL} /></Row>
          <Row label="Your Own Avatar Shape"><VisualSel value={(rd("selfAvatarDisplayType",0)) as number} onChange={v=>wr("selfAvatarDisplayType",v)} options={AVATAR_SHAPE_VISUAL} /></Row>
          <Row label="App Icon Shape"><Sel value={(rd("appIconDisplayType",0)) as number} onChange={v=>wr("appIconDisplayType",v)} options={ICON_OPTS} /></Row>
        </Group>
        <Group title="Names">
          <Row label="Show on Username Hover"><Sel value={(rd("nameHoverBehavior",1)) as number} onChange={v=>wr("nameHoverBehavior",v)} options={NAME_HOVER_OPTS} /></Row>
          <Row label="Display Custom Fonts From"><Sel value={(rd("nameFontDisplayType",0)) as number} onChange={v=>wr("nameFontDisplayType",v)} options={FONT_DISPLAY_OPTS} /></Row>
          <Row label="Always Underline Links"><Toggle value={(rd("alwaysUnderlineLinks",false)) as boolean} onChange={v=>wr("alwaysUnderlineLinks",v)} /></Row>
        </Group>
        <Group title="Roles">
          <Row label="Role Color Display"><VisualSel value={(rd("roleColorSettings",0)) as number} onChange={v=>wr("roleColorSettings",v)} options={ROLE_COLOR_VISUAL} /></Row>
          <Row label="Apply Saturation to Role Colors"><Toggle value={(rd("applySaturationToRoleColors",false)) as boolean} onChange={v=>wr("applySaturationToRoleColors",v)} /></Row>
          <Row label="Always Expand Role List"><Toggle value={(rd("alwaysExpandRoles",false)) as boolean} onChange={v=>wr("alwaysExpandRoles",v)} /></Row>
          <Row label="Show Role Icons"><Toggle value={(rd("showRoleIcons",true)) as boolean} onChange={v=>wr("showRoleIcons",v)} /></Row>
          <Row label="Show Owner Crown"><Toggle value={(rd("showOwnerCrown",true)) as boolean} onChange={v=>wr("showOwnerCrown",v)} /></Row>
        </Group>
        <Group title="Emoji">
          <Row label="Emoji Rendering"><VisualSel value={(rd("emojiStyle",0)) as number} onChange={v=>wr("emojiStyle",v)} options={EMOJI_STYLE_VISUAL} /></Row>
        </Group>
      </div>
    );
  }

  function renderAccessibilityTab() {
    return (
      <div>
        <Group title="Visual">
          <Row label="Reduce Motion"><Toggle value={(rd("reduceMotion",false)) as boolean} onChange={v=>wr("reduceMotion",v)} /></Row>
          <Row label="High Contrast Mode"><Toggle value={(rd("highContrastMode",false)) as boolean} onChange={v=>wr("highContrastMode",v)} /></Row>
          <Row label="Saturation"><Slider value={(rd("saturation",1.0)) as number} onChange={v=>wr("saturation",v)} min={0} max={2} step={0.05} format={v=>`${Math.round(v*100)}%`} /></Row>
          <Row label="Text Size"><Slider value={(rd("textSize",1.0)) as number} onChange={v=>wr("textSize",v)} min={0.75} max={1.5} step={0.05} format={v=>`${Math.round(v*100)}%`} /></Row>
          <Row label="Dyslexia-Friendly Font"><Toggle value={(rd("dyslexiaFont",false)) as boolean} onChange={v=>wr("dyslexiaFont",v)} /></Row>
        </Group>
        <Group title="Animation">
          <Row label="Sticker Animation"><Sel value={(rd("stickerAnimate",0)) as number} onChange={v=>wr("stickerAnimate",v)} options={ANIMATE_OPTS} /></Row>
          <Row label="Emoji Animation"><Sel value={(rd("emojiAnimate",2)) as number} onChange={v=>wr("emojiAnimate",v)} options={ANIMATE_OPTS} /></Row>
          <Row label="GIF Animation"><Sel value={(rd("gifAnimate",2)) as number} onChange={v=>wr("gifAnimate",v)} options={ANIMATE_OPTS} /></Row>
          <Row label="Server Icon Animation"><Sel value={(rd("serverAnimate",0)) as number} onChange={v=>wr("serverAnimate",v)} options={ANIMATE_OPTS} /></Row>
          <Row label="Channel Icon Animation"><Sel value={(rd("channelAnimate",0)) as number} onChange={v=>wr("channelAnimate",v)} options={ANIMATE_OPTS} /></Row>
          <Row label="Avatar Animation"><Sel value={(rd("avatarAnimate",2)) as number} onChange={v=>wr("avatarAnimate",v)} options={ANIMATE_OPTS} /></Row>
          <Row label="Glowing Role Animation"><Sel value={(rd("glowRoleAnimate",0)) as number} onChange={v=>wr("glowRoleAnimate",v)} options={ANIMATE_OPTS} /></Row>
        </Group>
        <Group title="Text-to-Speech">
          <Row label="Enable TTS"><Toggle value={(rd("tts",false)) as boolean} onChange={v=>wr("tts",v)} /></Row>
          <Row label="TTS Speed"><Slider value={(rd("ttsSpeed",1.0)) as number} onChange={v=>wr("ttsSpeed",v)} min={0.5} max={3} step={0.1} format={v=>`${v.toFixed(1)}x`} /></Row>
        </Group>
        <Group title="Input">
          <Row label="Show Send Button"><Toggle value={(rd("showSendMessageButton",true)) as boolean} onChange={v=>wr("showSendMessageButton",v)} /></Row>
        </Group>
      </div>
    );
  }

  function renderVoiceVideoTab() {
    return (
      <div>
        <Group title="Volume">
          <Row label="Input Volume"><Slider value={(rd("inputVolume",1.0)) as number} onChange={v=>wr("inputVolume",v)} min={0} max={2} step={0.05} format={v=>`${Math.round(v*100)}%`} /></Row>
          <Row label="Output Volume"><Slider value={(rd("outputVolume",1.0)) as number} onChange={v=>wr("outputVolume",v)} min={0} max={2} step={0.05} format={v=>`${Math.round(v*100)}%`} /></Row>
        </Group>
        <Group title="Input Mode">
          <Row label="Voice Input Mode"><Sel value={(rd("voiceInputMode",0)) as number} onChange={v=>wr("voiceInputMode",v)} options={VOICE_OPTS} /></Row>
          <Row label="Input Sensitivity"><Slider value={(rd("inputSensitivity",-60)) as number} onChange={v=>wr("inputSensitivity",v)} min={-100} max={0} step={1} format={v=>`${v} dB`} /></Row>
        </Group>
        <Group title="Audio Processing">
          <Row label="Echo Cancellation"><Toggle value={(rd("echoCancellation",true)) as boolean} onChange={v=>wr("echoCancellation",v)} /></Row>
          <Row label="Noise Suppression"><Toggle value={(rd("noiseSuppression",true)) as boolean} onChange={v=>wr("noiseSuppression",v)} /></Row>
          <Row label="Automatic Gain Control"><Toggle value={(rd("automaticGainControl",true)) as boolean} onChange={v=>wr("automaticGainControl",v)} /></Row>
        </Group>
      </div>
    );
  }

  function renderChatTab() {
    return (
      <div>
        <Group title="Composition">
          <Row label="Send with Ctrl+Enter"><Toggle value={(rd("sendMessagesWithCtrlEnter",false)) as boolean} onChange={v=>wr("sendMessagesWithCtrlEnter",v)} /></Row>
          <Row label="Show Mention Suggestions"><Toggle value={(rd("showMentionSuggestions",true)) as boolean} onChange={v=>wr("showMentionSuggestions",v)} /></Row>
          <Row label="Convert Emoticons to Emoji"><Toggle value={(rd("convertEmoticonsToEmoji",false)) as boolean} onChange={v=>wr("convertEmoticonsToEmoji",v)} /></Row>
        </Group>
        <Group title="Display">
          <Row label="Show Timestamps"><Toggle value={(rd("showMessageTimestamps",true)) as boolean} onChange={v=>wr("showMessageTimestamps",v)} /></Row>
          <Row label="Preview Markdown"><Toggle value={(rd("previewMarkdown",true)) as boolean} onChange={v=>wr("previewMarkdown",v)} /></Row>
          <Row label="Highlight Mentions"><Toggle value={(rd("highlightMentions",true)) as boolean} onChange={v=>wr("highlightMentions",v)} /></Row>
          <Row label="Show Read Receipts"><Toggle value={(rd("showReadReceipts",true)) as boolean} onChange={v=>wr("showReadReceipts",v)} /></Row>
        </Group>
        <Group title="Reactions">
          <Row label="Show Reactions"><Toggle value={(rd("showReactions",true)) as boolean} onChange={v=>wr("showReactions",v)} /></Row>
          <Row label="Show Reaction Count"><Toggle value={(rd("showReactionCount",true)) as boolean} onChange={v=>wr("showReactionCount",v)} /></Row>
          <Row label="Show Who Reacted"><Toggle value={(rd("showUsersWhoReacted",true)) as boolean} onChange={v=>wr("showUsersWhoReacted",v)} /></Row>
        </Group>
        <Group title="Spoilers">
          <Row label="Reveal Spoilers"><VisualSel value={(rd("showSpoilers",1)) as number} onChange={v=>wr("showSpoilers",v)} options={SPOILER_VISUAL} /></Row>
          <Row label="Reveal Spoilers from Friends"><VisualSel value={(rd("showSpoilersFromFriends",1)) as number} onChange={v=>wr("showSpoilersFromFriends",v)} options={SPOILER_VISUAL} /></Row>
        </Group>
        <Group title="Media and Embeds">
          <Row label="Show Images from Links"><Toggle value={(rd("showImagesFromLinks",true)) as boolean} onChange={v=>wr("showImagesFromLinks",v)} /></Row>
          <Row label="Show Images Uploaded to Harmony"><Toggle value={(rd("showImagesUploadedToHarmony",true)) as boolean} onChange={v=>wr("showImagesUploadedToHarmony",v)} /></Row>
          <Row label="Show Videos from Links"><Toggle value={(rd("showVideosFromLinks",true)) as boolean} onChange={v=>wr("showVideosFromLinks",v)} /></Row>
          <Row label="Show Videos Uploaded to Harmony"><Toggle value={(rd("showVideosUploadedToHarmony",true)) as boolean} onChange={v=>wr("showVideosUploadedToHarmony",v)} /></Row>
          <Row label="Show Web Embeds"><Toggle value={(rd("showWebEmbeds",true)) as boolean} onChange={v=>wr("showWebEmbeds",v)} /></Row>
          <Row label="Hide Link When Previewing"><Toggle value={(rd("hideLinkWhenPreviewing",true)) as boolean} onChange={v=>wr("hideLinkWhenPreviewing",v)} /></Row>
        </Group>
      </div>
    );
  }

  function renderNotificationsTab() {
    return <div><InfoBanner variant="info">Notification settings are coming in a future update.</InfoBanner></div>;
  }

  function renderLanguageTab() {
    return <div><InfoBanner variant="info">Language settings are coming in a future update.</InfoBanner></div>;
  }

  function renderAdvancedTab() {
    return (
      <div>
        <Group title="Developer">
          <Row label="Developer Mode" desc="Adds extra tools for debugging.">
            <Toggle value={(rd("developerMode",false)) as boolean} onChange={v=>wr("developerMode",v)} />
          </Row>
        </Group>
      </div>
    );
  }

  function loadCurrentTab() {
    switch (currentTab) {
      case "My Account":       return renderAccountTab();
      case "Profiles":         return renderProfilesTab();
      case "Privacy & Safety": return renderPrivacyTab();
      case "Appearance":       return renderAppearanceTab();
      case "Accessibility":    return renderAccessibilityTab();
      case "Voice & Video":    return renderVoiceVideoTab();
      case "Chat":             return renderChatTab();
      case "Notifications":    return renderNotificationsTab();
      case "Language":         return renderLanguageTab();
      case "Advanced":         return renderAdvancedTab();
      default:                 return null;
    }
  }

  const tabs = {
    "USER SETTINGS": ["My Account", "Profiles", "Privacy & Safety"],
    "APP SETTINGS":  ["Appearance", "Accessibility", "Voice & Video", "Chat", "Notifications", "Language", "Advanced"],
  };

  return (
    <>
      <div
        className={"modal-backdrop" + (open ? " open" : "")}
        onMouseDown={() => !hasUnsaved && onClose()}
      >
        <div className="modal-container settings" onMouseDown={e => e.stopPropagation()}>
          <div className="navigation ovy-auto ovx-hidden">
            <div className="input-wrapper" style={{ width: "100%" }}>
              <Search className="input-icon" />
              <input placeholder="Search settings" />
            </div>
            <hr />
            {Object.entries(tabs).map(([section, items]) => (
              <div key={section} className="nav-section">
                <div className="section-header uno ellipsis">{section}</div>
                {items.map(item => (
                  <div
                    key={item}
                    className={"channel uno" + (currentTab === item ? " selected" : " int") + (hasUnsaved && currentTab !== item ? " semitrans" : "")}
                    onClick={() => selectTab(item)}
                    title={hasUnsaved && currentTab !== item ? "Save or revert changes before switching tabs" : undefined}
                    style={hasUnsaved && currentTab !== item ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  >
                    <div className="nav-icon" style={{ "--mask-url": `url(./settings/${iconUrl(item)}.png)` } as any} />
                    {item}
                  </div>
                ))}
                <hr />
              </div>
            ))}
            <div className="channel uno int dangerous" onClick={logout}>
              <div className="nav-icon" style={{ "--mask-url": "url(./settings/logout.png)" } as any} />
              Logout
            </div>
          </div>

          <div className="settings-content ovy-auto">
            <div className="settings-header ellipsis uno">
              <div className="nav-icon settings-header-icon uno" style={{ "--mask-url": `url(./settings/${iconUrl(currentTab)}.png)` } as any} />
              {currentTab}
            </div>

            {loadCurrentTab()}

            {saveError && (
              <div style={{
                color: "var(--red-2)", fontSize: 13, marginTop: 12,
                padding: "8px 12px",
                background: "color-mix(in hsl, var(--red-2), transparent 85%)",
                border: "1px solid color-mix(in hsl, var(--red-2), transparent 60%)",
                borderRadius: 6,
              }}>
                {saveError}
              </div>
            )}

            {hasUnsaved && (
              <div className="unsaved-bar">
                <div className="uno">You have unsaved changes</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleRevert}>Revert</button>
                  <button className="save-btn" onClick={handleSave}>Save Changes</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAviCropper && croppingSrc && (
        <CroppingModal src={croppingSrc}
          onCancel={() => { setShowAviCropper(false); setCroppingSrc(null); setAvatarFile(null); }}
          onComplete={onAviCrop} headerText="Adjust Your Avatar" shape="circle" />
      )}
      {showBaniCropper && croppingSrc && (
        <CroppingModal src={croppingSrc}
          onCancel={() => { setShowBaniCropper(false); setCroppingSrc(null); setBannerFile(null); }}
          onComplete={onBaniCrop} headerText="Adjust Your Banner" shape="rect" rectAspect={2} />
      )}

      <TwoFactorModal
        mode={twoFactorModalMode}
        open={twoFactorModalOpen}
        token={token ?? ""}
        onClose={() => setTwoFactorModalOpen(false)}
        onSuccess={() => {
          const enabled = twoFactorModalMode === "setup";
          const u = { ...user!, twoFactorEnabled: enabled };
          setUser(u);
          addUser(u);
        }}
      />

      <ChangeUsernameModal
        open={changeUsernameOpen}
        currentUsername={user?.username ?? ""}
        token={token ?? ""}
        onClose={() => setChangeUsernameOpen(false)}
        onSaved={(newUsername, newDisc) => {
          const u = { ...user!, username: newUsername, discriminator: newDisc };
          setUser(u);
          addUser(u);
        }}
      />

      <ChangePhoneModal
        open={changePhoneOpen}
        currentPhone={user?.phoneNumber}
        token={token ?? ""}
        onClose={() => setChangePhoneOpen(false)}
        onSaved={(newPhone) => {
          const u = { ...user!, phoneNumber: newPhone, phoneNumberVerified: true };
          setUser(u);
          addUser(u);
        }}
      />
    </>
  );
}