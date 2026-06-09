import { useState, useRef, useEffect } from "react";
import Twemoji from "react-twemoji";
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
import { t } from "../../../lib/i18n";
import { TranslationKeys } from "../../../lib/i18n/schema";

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

function BoxGroup({ value, onChange, options }: {
  value: number;
  onChange: (v: number) => void;
  options: VisualOpt[];
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(142px, 1fr))",
      gap: 8,
    }}>
      {options.map(opt => {
        const sel = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 9,
              cursor: "pointer",
              border: `2px solid ${sel ? "var(--accent-1)" : "var(--border)"}`,
              background: sel
                ? "color-mix(in hsl, var(--accent-1), transparent 88%)"
                : "var(--bg-2)",
              color: sel ? "var(--text-2)" : "var(--text-3)",
              fontSize: 13,
              fontWeight: sel ? 600 : 400,
              transition: "border-color 140ms, background 140ms, box-shadow 140ms",
              textAlign: "left",
              outline: "none",
              boxShadow: sel ? "0 0 0 1px var(--accent-1)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <span style={{ lineHeight: 1.3 }}>{opt.label}</span>
              <span style={{
                flexShrink: 0,
                width: 15, height: 15,
                borderRadius: "50%",
                background: sel ? "var(--accent-1)" : "transparent",
                border: `2px solid ${sel ? "var(--accent-1)" : "var(--border)"}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                color: "#fff",
                fontWeight: 900,
                transition: "background 140ms, border-color 140ms",
              }}>
                {sel ? "✓" : ""}
              </span>
            </div>
            <div style={{ borderRadius: 5, overflow: "hidden", pointerEvents: "none" }}>
              {opt.preview}
            </div>
          </button>
        );
      })}
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

function Row({ label, desc, children }: { label: TranslationKeys; desc?: TranslationKeys; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "11px 0", borderBottom: "1px solid var(--border-light)",
      gap: 16, minHeight: 46,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 500 }}>{t(label)}</div>
        {desc && (
          <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3, lineHeight: 1.4 }}>{t(desc)}</div>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function FullRow({ label, desc, children }: { label: TranslationKeys; desc?: TranslationKeys; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 500 }}>{t(label)}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 3, lineHeight: 1.4 }}>{t(desc)}</div>}
      </div>
      {children}
    </div>
  );
}

function Group({ title, children }: { title?: TranslationKeys; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      {title && (
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.08em", color: "var(--text-5)",
          paddingBottom: 8, marginBottom: 2,
          borderBottom: "1px solid var(--border)",
        }}>
          {t(title)}
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
    { name: t("jasm"), color: "#d3869b", text: t("jasm.hey") },
    { name: t("jack"), color: "#7caea3", text: t("jack.rep") },
    { name: t("jasm"), color: "#d3869b", text: t("jasm.rep") }
  ];
  return (
    <div style={{
      background: "var(--bg-4)", borderRadius: 6, padding: "8px 10px",
      fontSize: 11, lineHeight: compact ? 1.3 : 1.6,
      display: "flex", flexDirection: "column", gap: compact ? 1 : 6,
    }}>
      {msgs.map((m, i) => (
        <>
          <div key={i} style={{ display: "flex", gap: compact ? 6 : 8, alignItems: compact ? "baseline" : "flex-start" }}>
            {!compact && (
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: m.color, marginTop: 1 }} />
            )}
            <span style={{ color: m.color, fontWeight: 600, fontSize: compact ? 10 : 11, flexShrink: 0 }}>
              {compact ? m.name.slice(0, 3) : m.name}
            </span>
            <span style={{ color: "var(--text-5)", fontSize: 9 }}> • 12:00</span>
            {compact && <span style={{ color: "var(--text-4)", fontSize: 10 }}>{m.text}</span>}
          </div>
          {!compact && <div style={{ color: "var(--text-4)", fontSize: 11, marginLeft: 20 }}>{m.text}</div>}
        </>
      ))}
    </div>
  );
}

function AvatarShapePreview({ shape }: { shape: "circle" | "rounded" | "square" }) {
  const r = shape === "circle" ? "50%" : shape === "rounded" ? "25%" : "4px";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
      {["#d3869b", "#7caea3", "#a8b665"].map((c, i) => (
        <div key={i} style={{ width: 26, height: 26, borderRadius: r, background: c, flexShrink: 0 }} />
      ))}
    </div>
  );
}

function RoleColorPreview({ mode }: { mode: number }) {
  const roles = [{ color: "#d3869b", name: t("role.name1") }, { color: "#7caea3", name: t("role.name2") }];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 0" }}>
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
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, color: "var(--text-4)" }}>{t("spoiler.in")}</span>
      <span className={"spoiler" + (shown ? " shown" : "")}>{t("spoiler.in")}</span>
    </div>
  );
}

function ThemePreview({ theme }: { theme: number }) {
  const dark = theme !== 0;
  return (
    <div style={{ background: dark ? "#282828" : "#f5f0e8", borderRadius: 6, padding: "7px 10px" }}>
      <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: dark ? "#3c3836" : "#d4be98", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ background: dark ? "#504945" : "#d4c5a0", height: 7, borderRadius: 3, width: "58%", marginBottom: 4 }} />
          <div style={{ background: dark ? "#3c3836" : "#ddd0b0", height: 6, borderRadius: 3, width: "83%" }} />
        </div>
      </div>
    </div>
  );
}

function EmojiStylePreview({ system }: { system: boolean }) {
  const emojis = "😀🎉🔥";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 20, lineHeight: 1, display: "inline-block" }}>
        {system ? emojis : (
          <Twemoji options={{ className: "emoji-text" }}>
            {emojis}
          </Twemoji>
        )}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-5)", lineHeight: 1.3 }}>
        {system ? t("emoji.preview.system.desc") : t("emoji.preview.twemoji.desc")}
      </span>
    </div>
  );
}

const THEME_VISUAL: VisualOpt[] = [
  { value: 1, label: "Dark", preview: <ThemePreview theme={1} /> },
  { value: 0, label: "Light", preview: <ThemePreview theme={0} /> },
  { value: 2, label: "Follow System", preview: <div style={{ display: "flex", gap: 4 }}><ThemePreview theme={0} /><ThemePreview theme={1} /></div> },
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
  { value: 3, label: "User Preference", preview: <div style={{ fontSize: 10, color: "var(--text-5)", padding: "4px 0", lineHeight: 1.4 }}>Respects each user's own shape choice</div> },
];
const ROLE_COLOR_VISUAL: VisualOpt[] = [
  { value: 0, label: "Color Names", preview: <RoleColorPreview mode={0} /> },
  { value: 1, label: "Role Dot", preview: <RoleColorPreview mode={1} /> },
  { value: 2, label: "Dot + Name Color", preview: <RoleColorPreview mode={2} /> },
  { value: 3, label: "Don't Show", preview: <RoleColorPreview mode={3} /> },
];
const SPOILER_VISUAL: VisualOpt[] = [
  { value: 0, label: "Always Reveal", preview: <SpoilerPreview reveal={0} /> },
  { value: 1, label: "On Click", preview: <SpoilerPreview reveal={1} /> },
  { value: 2, label: "On Hover", preview: <SpoilerPreview reveal={2} /> },
  { value: 3, label: "Moderated Only", preview: <SpoilerPreview reveal={3} /> },
];
const EMOJI_STYLE_VISUAL: VisualOpt[] = [
  { value: 0, label: "Twemoji", preview: <EmojiStylePreview system={false} /> },
  { value: 1, label: "System", preview: <EmojiStylePreview system={true} /> },
];

const LANGUAGE_DATA: Array<{ value: number; flag: string; english: string; native: string; search: string[] }> = [
  { value: 0,  flag: "🇺🇸", english: "English (US)",      native: "English (US)",     search: ["english", "american", "us", "en"] },
  { value: 1,  flag: "🇬🇧", english: "English (UK)",      native: "English (UK)",     search: ["english", "british", "uk", "en-gb"] },
  { value: 2,  flag: "🇩🇪", english: "German",            native: "Deutsch",          search: ["german", "deutsch", "de", "allemand"] },
  { value: 3,  flag: "🇳🇱", english: "Dutch",             native: "Nederlands",       search: ["dutch", "netherlands", "nl", "flemish"] },
  { value: 4,  flag: "🇸🇪", english: "Swedish",           native: "Svenska",          search: ["swedish", "svenska", "sv"] },
  { value: 5,  flag: "🇳🇴", english: "Norwegian",         native: "Norsk",            search: ["norwegian", "norsk", "nb", "no"] },
  { value: 6,  flag: "🇩🇰", english: "Danish",            native: "Dansk",            search: ["danish", "dansk", "da"] },
  { value: 7,  flag: "🇪🇸", english: "Spanish",           native: "Español",          search: ["spanish", "español", "espanol", "es", "castellano"] },
  { value: 8,  flag: "🇫🇷", english: "French",            native: "Français",         search: ["french", "français", "francais", "fr"] },
  { value: 9,  flag: "🇮🇹", english: "Italian",           native: "Italiano",         search: ["italian", "italiano", "it"] },
  { value: 10, flag: "🇵🇹", english: "Portuguese",        native: "Português",        search: ["portuguese", "português", "portugues", "pt", "brasileiro"] },
  { value: 11, flag: "🇷🇴", english: "Romanian",          native: "Română",           search: ["romanian", "română", "romana", "ro"] },
  { value: 12, flag: "🏛️", english: "Latin",             native: "Latina",           search: ["latin", "latina", "la"] },
  { value: 13, flag: "🇷🇺", english: "Russian",           native: "Русский",          search: ["russian", "русский", "russkiy", "ru"] },
  { value: 14, flag: "🇵🇱", english: "Polish",            native: "Polski",           search: ["polish", "polski", "pl"] },
  { value: 15, flag: "🇱🇻", english: "Latvian",           native: "Latviešu",         search: ["latvian", "latviešu", "latviesu", "lv"] },
  { value: 16, flag: "🇺🇦", english: "Ukrainian",         native: "Українська",       search: ["ukrainian", "українська", "ukr", "uk"] },
  { value: 17, flag: "🇨🇿", english: "Czech",             native: "Čeština",          search: ["czech", "čeština", "cestina", "cs"] },
  { value: 18, flag: "🇭🇺", english: "Hungarian",         native: "Magyar",           search: ["hungarian", "magyar", "hu"] },
  { value: 19, flag: "🇬🇷", english: "Greek",             native: "Ελληνικά",         search: ["greek", "ελληνικά", "ellinika", "el"] },
  { value: 20, flag: "🇹🇷", english: "Turkish",           native: "Türkçe",           search: ["turkish", "türkçe", "turkce", "tr"] },
  { value: 21, flag: "🇨🇳", english: "Chinese",           native: "中文",             search: ["chinese", "中文", "zhongwen", "zh", "mandarin", "cantonese", "putonghua"] },
  { value: 22, flag: "🇯🇵", english: "Japanese",          native: "日本語",           search: ["japanese", "日本語", "nihongo", "ja", "jp"] },
  { value: 23, flag: "🇰🇷", english: "Korean",            native: "한국어",           search: ["korean", "한국어", "hangugeo", "ko", "kr"] },
  { value: 24, flag: "🇻🇳", english: "Vietnamese",        native: "Tiếng Việt",       search: ["vietnamese", "tiếng việt", "tieng viet", "vi"] },
  { value: 25, flag: "🇹🇭", english: "Thai",              native: "ภาษาไทย",          search: ["thai", "ภาษาไทย", "phasa thai", "th"] },
  { value: 26, flag: "🇮🇳", english: "Hindi",             native: "हिन्दी",              search: ["hindi", "हिन्दी", "hi"] },
  { value: 27, flag: "🇧🇩", english: "Bengali",           native: "বাংলা",               search: ["bengali", "বাংলা", "bangla", "bn"] },
  { value: 28, flag: "🇮🇩", english: "Indonesian",        native: "Bahasa Indonesia", search: ["indonesian", "bahasa indonesia", "id"] },
  { value: 29, flag: "🇲🇾", english: "Malay",             native: "Bahasa Melayu",    search: ["malay", "bahasa melayu", "ms"] },
  { value: 30, flag: "🇵🇭", english: "Tagalog",           native: "Tagalog",          search: ["tagalog", "filipino", "fil", "tl"] },
  { value: 31, flag: "🇸🇦", english: "Arabic",            native: "العربية",          search: ["arabic", "العربية", "arabiya", "ar"] },
  { value: 32, flag: "🇮🇷", english: "Persian",           native: "فارسی",            search: ["persian", "فارسی", "farsi", "fa", "dari"] },
  { value: 33, flag: "🇮🇱", english: "Hebrew",            native: "עברית",            search: ["hebrew", "עברית", "ivrit", "he"] },
  { value: 34, flag: "🇹🇿", english: "Swahili",           native: "Kiswahili",        search: ["swahili", "kiswahili", "sw"] },
  { value: 35, flag: "🇿🇦", english: "Afrikaans",         native: "Afrikaans",        search: ["afrikaans", "af"] },
  { value: 36, flag: "🌌", english: "Miulyn",            native: "Miulyn",           search: ["miulyn", "hyleusian"] },
  { value: 37, flag: "😇", english: "Angelic",           native: "Angelic",          search: ["angelic", "hyleusian"] },
  { value: 38, flag: "✨", english: "Jeienese",          native: "Jeienese",         search: ["jeienese", "hyleusian"] },
  { value: 39, flag: "🎭", english: "Joculenese",        native: "Joculenese",       search: ["joculenese", "hyleusian"] },
  { value: 40, flag: "⚔️", english: "Vor'khan",          native: "Vor'khan",         search: ["vorkhan", "hyleusian"] },
  { value: 41, flag: "🌊", english: "Wia",               native: "Wia",              search: ["wia", "hyleusian"] },
  { value: 42, flag: "🏴‍☠️", english: "Pirate Speak",      native: "Pirate Speak",     search: ["pirate", "ahoy", "arrr"] },
  { value: 43, flag: "💻", english: "Leet Speak",        native: "1337 5p34k",       search: ["leet", "leetspeak", "1337"] },
  { value: 44, flag: "🐷", english: "Pig Latin",         native: "Ig-Pay Atin-Lay",  search: ["pig latin", "igpay", "atinlay"] },
  { value: 45, flag: "🖖", english: "Klingon",           native: "tlhIngan Hol",     search: ["klingon", "tlhingan", "star trek"] },
  { value: 46, flag: "🧝", english: "Elvish (Sindarin)", native: "Edhellen",         search: ["elvish", "sindarin", "tolkien", "lotr"] },
  { value: 47, flag: "😹", english: "Lolcat",            native: "Lolcat",           search: ["lolcat", "ceiling cat", "can i haz"] },
  { value: 48, flag: "📜", english: "Shakespearean",     native: "Shakespearean",    search: ["shakespearean", "shakespeare", "ye olde", "thee", "thou"] },
  { value: 49, flag: "🟢", english: "Yoda Speak",        native: "Yoda Speak",       search: ["yoda"] },
  { value: 50, flag: "⭐", english: "Esperanto",         native: "Esperanto",        search: ["esperanto", "eo"] },
  { value: 51, flag: "🩷", english: "UwU",               native: "UwU",              search: ["uwu", "owo", "nya", "kawaii"] },
];

function LanguageSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = LANGUAGE_DATA.find(l => l.value === value) ?? LANGUAGE_DATA[0];

  const q = search.toLowerCase().trim();
  const filtered = q === ""
    ? LANGUAGE_DATA
    : LANGUAGE_DATA.filter(l =>
        l.native.toLowerCase().includes(q) ||
        l.english.toLowerCase().includes(q) ||
        l.search.some(t => t.includes(q))
      );

  const groups = [
    { label: t("lang.world"), values: filtered.filter(l => l.value <= 35) },
    { label: t("lang.hyleus"), values: filtered.filter(l => l.value >= 36 && l.value <= 41) },
    { label: t("lang.other"), values: filtered.filter(l => l.value >= 42) },
  ].filter(g => g.values.length > 0);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative", maxWidth: 380 }}>
      <button
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "9px 13px", borderRadius: 8, cursor: "pointer",
          background: "var(--bg-2)",
          border: `1px solid ${open ? "var(--accent-1)" : "var(--button-border)"}`,
          color: "var(--text-3)", fontSize: 14, textAlign: "left",
          boxShadow: open ? "0 0 0 1px var(--accent-1)" : "none",
          transition: "border-color 150ms, box-shadow 150ms",
        }}
      >
        <Twemoji options={{ className: "emoji-text", style: { marginRight: 15 } }}>
          {current.flag}
        </Twemoji>
        <span style={{ flex: 1 }}>{current.native}</span>
        {current.english !== current.native && (
          <span style={{ fontSize: 12, color: "var(--text-5)" }}>{current.english}</span>
        )}
        <span style={{
          color: "var(--text-5)", fontSize: 10,
          display: "inline-block",
          transform: open ? "scaleY(-1)" : "none",
          transition: "transform 150ms",
        }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", left: 0, top: "calc(100% + 4px)", right: 0,
          background: "var(--bg-2)", border: "1px solid var(--border)",
          borderRadius: 10, zIndex: 400, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", maxHeight: 320,
        }}>
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("lang.search")}
              style={{
                width: "100%", background: "var(--bg-1)",
                border: "1px solid var(--border)", borderRadius: 6,
                padding: "5px 9px", color: "var(--text-2)",
                fontSize: 13, outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {groups.length === 0 ? (
              <div style={{ padding: "18px 14px", fontSize: 13, color: "var(--text-5)", textAlign: "center" }}>
                {t("lang.no_results", { search })}
              </div>
            ) : groups.map(group => (
              <div key={group.label}>
                <div style={{
                  padding: "5px 13px 3px",
                  fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.08em", color: "var(--text-5)",
                  background: "var(--bg-3)",
                  position: "sticky", top: 0, zIndex: 1,
                }}>
                  {group.label}
                </div>
                {group.values.map(lang => (
                  <button
                    key={lang.value}
                    onClick={() => { onChange(lang.value); setOpen(false); setSearch(""); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 13px", cursor: "pointer",
                      background: lang.value === value ? "var(--active)" : "none",
                      border: "none", textAlign: "left",
                      color: "var(--text-3)", fontSize: 13,
                      borderBottom: "1px solid var(--border-light)",
                    }}
                  >
                    <Twemoji options={{ className: "emoji-text", style: { marginRight: 15 } }}>
                      {lang.flag}
                    </Twemoji>
                    <span style={{ flex: 1, fontWeight: lang.value === value ? 600 : 400 }}>
                      {lang.native}
                    </span>
                    {lang.english !== lang.native && (
                      <span style={{ fontSize: 12, color: "var(--text-5)" }}>{lang.english}</span>
                    )}
                    {lang.value === value && (
                      <span style={{ color: "var(--accent-1)", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const APP_ICON_OPTS: Opt[] = [
  { value: 0, label: "Default" },
  { value: 1, label: "Classic" },
  { value: 2, label: "Modern" },
  { value: 3, label: "Minimal" }
];
const ICON_OPTS: Opt[] = [
  { value: 0, label: "Circle" },
  { value: 1, label: "Rounded" },
  { value: 2, label: "Square" }
];
const NAME_HOVER_OPTS: Opt[] = [
  { value: 0, label: "Nothing" },
  { value: 1, label: "Show Handle (@username)" }
];
const FONT_DISPLAY_OPTS: Opt[] = [
  { value: 0, label: "Everyone" },
  { value: 1, label: "Friends" },
  { value: 2, label: "Friends of Friends" },
  { value: 3, label: "No One" }
];
const ANIMATE_OPTS: Opt[] = [
  { value: 0, label: "Always" },
  { value: 1, label: "When App is Focused" },
  { value: 2, label: "On Hover" },
  { value: 3, label: "On Click" },
  { value: 4, label: "Never" }
];
const VOICE_OPTS: Opt[] = [
  { value: 0, label: "Voice Activity" },
  { value: 1, label: "Push to Talk" }
];
const FRIEND_REQ_OPTS: Opt[] = [
  { value: 0, label: "Everyone" },
  { value: 1, label: "Friends of Friends" },
  { value: 2, label: "Mutuals and Friends of Friends" },
  { value: 3, label: "Mutual Servers Only" },
  { value: 4, label: "No One" }
];
const USER_CTX_OPTS: Opt[] = [
  { value: 0, label: "Everyone" },
  { value: 1, label: "Friends of Friends" },
  { value: 2, label: "Friends Only" },
  { value: 3, label: "Mutuals and Friends of Friends" },
  { value: 4, label: "Mutual Servers and Friends" },
  { value: 5, label: "Mutual Servers Only" },
  { value: 6, label: "No One" }
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
    whoCanSeePhoneNumber: user?.whoCanSeePhoneNumber ?? 6
  };
}

function ProfilePreviewCard({ user, displayName, pronouns, bio, bannerColorHex, previewAvatar, previewBanner, fontFamily }: {
  user: User | null | undefined;
  displayName: string | null | undefined;
  pronouns: string | null | undefined;
  bio: string | null | undefined;
  bannerColorHex: string;
  previewAvatar: string;
  previewBanner: string | undefined;
  fontFamily: string;
}) {
  const name = displayName || user?.username || "Username";
  const handle = user?.username || "username";

  return (
    <div style={{
      width: "calc(100% - 15px)",
      borderRadius: 12,
      overflow: "hidden",
      background: "var(--bg-4)",
      border: "1px solid var(--border)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.3)"
    }}>
      <div style={{
        height: 76,
        backgroundImage: previewBanner
          ? `url(${previewBanner})`
          : `linear-gradient(135deg, ${bannerColorHex}, color-mix(in hsl, ${bannerColorHex}, #000 35%))`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        flexShrink: 0
      }} />

      <div style={{ position: "relative", padding: "0 12px" }}>
        <div style={{
          position: "absolute", top: -28, left: 12,
          width: 56, height: 56,
          borderRadius: "50%",
          background: "var(--bg-4)",
          padding: 3,
          boxSizing: "border-box"
        }}>
          <img
            src={previewAvatar}
            alt={name}
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", display: "block" }}
          />
        </div>
        <div style={{ height: 30 }} />
      </div>
      <div style={{ padding: "2px 14px 14px", display: "flex", flexDirection: "column" }}>
        <div style={{
          fontFamily,
          fontSize: 17,
          fontWeight: 700,
          color: "var(--text-2)",
          lineHeight: 1.2,
          wordBreak: "break-word"
        }}>
          {name}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-5)", marginTop: 3,
          display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap"
        }}>
          <span>@{handle}</span>
          {pronouns && (
            <>
              <span style={{ color: "var(--border)" }}>·</span>
              <span style={{ color: "var(--text-4)" }}>{pronouns}</span>
            </>
          )}
        </div>

        {bio && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-5)", marginBottom: 5
            }}>
              {t("about.l")}
            </div>
            <div style={{
              fontSize: 12, color: "var(--text-3)", lineHeight: 1.5,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
              background: "color-mix(in hsl, var(--bg-3), transparent 30%)",
              borderRadius: 6, padding: "6px 8px",
              border: "1px solid var(--border-light)",
              maxHeight: 80,
              overflow: "hidden"
            }}>
              {bio}
            </div>
          </>
        )}

        {user?.joinedAt && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-5)", marginBottom: 4
            }}>
              {t("joined")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
              {/* todo: use language locale for date string? */}
              {/* todo: default to language locale for date strings, but allow users to change it if they want */}
              {new Date(user.joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UserSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { token, user, setUser, userSettings, setUserSettings } = useAuthState();
  const { addUser, setMembers } = useUserState();
  const { setMessages } = useMessageState();
  const { setServers } = useServerState();

  const [currentTab, setCurrentTab] = useState("acc");

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
    if (emailResendCooldown <= 0) return;
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
    const f = e.target.files?.[0];
    if (!f)
      return;
    e.target.value = "";
    setAvatarFile(f);
    const r = new FileReader();
    r.onload = () => { setCroppingSrc(r.result as string); setShowAviCropper(true); };
    r.readAsDataURL(f);
  }
  function pickBanner(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f)
      return;
    e.target.value = "";
    setBannerFile(f);
    const r = new FileReader();
    r.onload = () => { setCroppingSrc(r.result as string); setShowBaniCropper(true); };
    r.readAsDataURL(f);
  }
  function pickFont(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f)
      return;
    e.target.value = "";
    setFontFile(f);
  }
  function onAviCrop(blob: Blob) {
    setFAviFile(new File([blob], avatarFile?.name ?? "avatar.png", { type: blob.type }));
    setShowAviCropper(false);
    setCroppingSrc(null);
    setAvatarFile(null);
  }
  function onBaniCrop(blob: Blob) {
    setFBaniFile(new File([blob], bannerFile?.name ?? "banner.png", { type: blob.type }));
    setShowBaniCropper(false);
    setCroppingSrc(null);
    setBannerFile(null);
  }

  const opts = { headers: { Authorization: `Bearer ${token}` } };

  async function rmAvatar() {
    try {
      const res = await deleteAvatar(opts);
      const u = { ...user!, avatar: res.avatar };
      setUser(u);
      addUser(u);
      setFAviFile(null);
    } catch (e) { setSaveError((e as Error).message ?? "Failed"); }
  }
  async function rmBanner() {
    try {
      const res = await deleteBanner(opts);
      const u = { ...user!, banner: res.banner };
      setUser(u);
      addUser(u);
      setFBaniFile(null);
    } catch (e) { setSaveError((e as Error).message ?? "Failed"); }
  }
  async function rmFont() {
    try {
      const res = await deleteFont(opts);
      const u = { ...user!, nameFont: res.nameFont };
      setUser(u);
      addUser(u);
      setFontFile(null);
    } catch (e) { setSaveError((e as Error).message ?? "Failed"); }
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
        privacy: JSON.stringify(privacy)
      };
      setHasUnsaved(false);
    } catch (err) {
      setSaveError((err as Error).message ?? t("error.failed_save"));
    }
  }

  async function logout() {
    onClose();
    setUser(null); setMessages([]); setMembers([]); setServers([]);
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
              <div className="profile-id">{t("id", { "id": String(user?.id) } )}</div>
            </div>
            <button onClick={() => selectTab("Profiles")}>Edit User Profile</button>
          </div>
          <div className="profile-details uno">
            <div className="profile-item">
              <div>
                <div>{t("display_name")}</div>
                <div style={{ fontFamily: user?.displayName ? `"${user?.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif` : undefined }}>
                  {user?.displayName ?? <span style={{ color: "var(--text-5)", fontStyle: "italic" }}>{t("unset")}</span>}
                </div>
              </div>
              <button onClick={() => selectTab("Profiles")}>{t("edit")}</button>
            </div>
            <div className="profile-item">
              <div>
                <div>{t("username")}</div>
                <div>@{user?.username}{user?.discriminator ? `#${String(user.discriminator).padStart(4, "0")}` : ""}</div>
              </div>
              <button onClick={() => setChangeUsernameOpen(true)}>{t("edit")}</button>
            </div>
            <div className="profile-item">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {t("email")}
                  {user?.email && !user.emailVerified && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: "color-mix(in hsl, var(--yellow-2), transparent 78%)",
                      color: "var(--yellow-1)",
                      border: "1px solid color-mix(in hsl, var(--yellow-2), transparent 50%)",
                    }}>{t("unverified")}</span>
                  )}
                  {user?.email && user.emailVerified && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: "color-mix(in hsl, var(--green-2), transparent 78%)",
                      color: "var(--green-1)",
                      border: "1px solid color-mix(in hsl, var(--green-2), transparent 50%)",
                    }}>{t("verified")}</span>
                  )}
                </div>
                <div>
                  {user?.email
                    ? emailRevealed
                      ? user.email
                      : "*".repeat((user.email.indexOf("@") > 0 ? user.email.indexOf("@") : 4)) + user.email.substring(user.email.indexOf("@"))
                    : <span style={{ color: "var(--text-5)", fontStyle: "italic" }}>{t("unset")}</span>
                  }
                  {user?.email && (
                    <a className="ml" onClick={() => setEmailRevealed(!emailRevealed)}>
                      {emailRevealed ? t("hide") : t("reveal")}
                    </a>
                  )}
                </div>
                {user?.email && !user.emailVerified && (
                  <div style={{ marginTop: 4 }}>
                    <a
                      style={{
                        fontSize: 12,
                        color: emailResendCooldown > 0 ? "var(--text-5)" : "var(--accent-1)",
                        cursor: emailResendCooldown > 0 ? "default" : "pointer",
                      }}
                      onClick={async () => {
                        if (emailResendCooldown > 0)
                          return;
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
                      {emailResendCooldown > 0 ? `Resend in ${emailResendCooldown}s` : "Resend verification email"}
                    </a>
                    {emailResendMsg && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-5)" }}>{emailResendMsg}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="profile-item">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {t("phone")}
                  {user?.phoneNumber && user.phoneNumberVerified && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                      background: "color-mix(in hsl, var(--green-2), transparent 78%)",
                      color: "var(--green-1)",
                      border: "1px solid color-mix(in hsl, var(--green-2), transparent 50%)",
                    }}>{t("verified")}</span>
                  )}
                </div>
                <div>
                  {user?.phoneNumber
                    ? phoneRevealed ? user.phoneNumber : "•".repeat(user.phoneNumber.length)
                    : <span style={{ color: "var(--text-5)", fontStyle: "italic" }}>{t("unset")}</span>
                  }
                  {user?.phoneNumber && (
                    <a className="ml" onClick={() => setPhoneRevealed(!phoneRevealed)}>
                      {phoneRevealed ? t("hide") : t("reveal")}
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => setChangePhoneOpen(true)}>
                {user?.phoneNumber ? t("edit") : t("add")}
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
            {t("security")}
          </div>
          <div className="profile-item" style={{ marginTop: 10 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {t("2fa")}
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
                  {twoFaEnabled ? t("enabled") : t("disabled")}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-5)", marginTop: 2 }}>
                {twoFaEnabled
                  ? t("2fa.enabled")
                  : t("2fa.disabled")}
              </div>
            </div>
            <button
              onClick={() => { setTwoFactorModalMode(twoFaEnabled ? "disable" : "setup"); setTwoFactorModalOpen(true); }}
              style={twoFaEnabled ? { color: "var(--red-2)", borderColor: "color-mix(in hsl, var(--red-2), transparent 60%)" } : undefined}
            >
              {twoFaEnabled ? t("disable") : t("enable")}
            </button>
          </div>
          {!user?.emailVerified && (
            <div style={{
              marginTop: 12,
              background: "color-mix(in hsl, var(--yellow-2), transparent 86%)",
              border: "1px solid color-mix(in hsl, var(--yellow-2), transparent 55%)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--yellow-1)",
            }}>
              ⚠️ {t("2fa.email")}
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
    const previewBanner = (fBaniFile ? URL.createObjectURL(fBaniFile) : banner) ?? undefined;
    const fontFamily = fontFile && typeof fontFile !== "string"
      ? `"UploadedFont", "${user?.nameFont ?? ""}", Inter, Avenir, Helvetica, Arial, sans-serif`
      : user?.nameFont
        ? `"${user.nameFont}", Inter, Avenir, Helvetica, Arial, sans-serif`
        : `Inter, Avenir, Helvetica, Arial, sans-serif`;

    return (
      <div className="profiles">
        <div className="profiles-content halign">
          <div className="profiles-item">
            <Group title="display">
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>{t("display_name")}</label>
                <input value={displayName ?? ""} placeholder={user?.username}
                  onChange={e => setDisplayName(e.target.value || null)} maxLength={32} />
                <div style={{ fontSize: 11, color: "var(--text-5)", marginTop: 3 }}>
                  {(displayName ?? "").length}/32
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>{t("pronouns")}</label>
                <input value={pronouns ?? ""} placeholder={t("pronouns.default")}
                  onChange={e => setPronouns(e.target.value || null)} maxLength={40} />
              </div>
            </Group>

            <Group title="avi">
              <div style={{ display: "flex", gap: 8, paddingTop: 8, paddingBottom: 4 }}>
                <button onClick={() => document.getElementById("avi-file-pick")?.click()}>
                  {user?.avatar ? t("avi.change") : t("avi.set")}
                  <input id="avi-file-pick" type="file" accept="image/*" style={{ display: "none" }} onChange={pickAvatar} />
                </button>
                <button style={{ color: "var(--red-2)" }} onClick={rmAvatar} disabled={!user?.avatar && !fAviFile}>{t("remove")}</button>
              </div>
            </Group>

            <Group title="ban">
              <div style={{ display: "flex", gap: 8, paddingTop: 8, paddingBottom: 10 }}>
                <button onClick={() => document.getElementById("ban-file-pick")?.click()}>
                  {user?.banner ? t("ban.change") : t("ban.set")}
                  <input id="ban-file-pick" type="file" accept="image/*" style={{ display: "none" }} onChange={pickBanner} />
                </button>
                <button style={{ color: "var(--red-2)" }} onClick={rmBanner} disabled={!user?.banner && !fBaniFile}>{t("remove")}</button>
              </div>
              <div className="form-group" style={{ marginBottom: 4 }}>
                <label>{t("ban.color")}</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}>
                  <input type="color" value={bannerColorHex} onChange={e => setBannerColorHex(e.target.value)}
                    style={{ width: 44, height: 32, padding: 2, cursor: "pointer", boxSizing: "border-box" }} />
                  <input value={bannerColorHex}
                    onChange={e => { const v = e.target.value; if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBannerColorHex(v); }}
                    maxLength={7} style={{ width: 96, fontFamily: "monospace" }} placeholder="#000000" />
                </div>
              </div>
            </Group>

            <Group title="font">
              <div style={{ paddingTop: 8, paddingBottom: 10 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button onClick={() => document.getElementById("font-file-pick")?.click()}>
                    {user?.nameFont ? t("font.change") : t("font.set")}
                    <input id="font-file-pick" type="file" accept=".ttf,.otf,.woff,.woff2,.sfnt"
                      style={{ display: "none" }} onChange={pickFont} />
                  </button>
                  <button style={{ color: "var(--red-2)" }} onClick={rmFont} disabled={!user?.nameFont && !fontFile}>{t("remove")}</button>
                </div>
                {fontFile && typeof fontFile !== "string" && (
                  <div style={{ fontSize: 12, color: "var(--text-5)" }}>{t("font.selected", { file: fontFile.name })}</div>
                )}
              </div>
            </Group>

            <Group title="about">
              <div className="about-me">
                <MessageInput isChannel={false} placeholderText={t("about.placeholder")}
                  initialText={bio} setText={setBio} giveNull ref={bioRef} />
              </div>
            </Group>
          </div>

          <div className="preview">
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.08em", color: "var(--text-5)",
              marginBottom: 10
            }}>
              {t("preview")}
            </div>
            <ProfilePreviewCard
              user={user}
              displayName={displayName}
              pronouns={pronouns}
              bio={bio}
              bannerColorHex={bannerColorHex}
              previewAvatar={previewAvatar}
              previewBanner={previewBanner}
              fontFamily={fontFamily}
            />
          </div>
        </div>
      </div>
    );
  }

  function renderPrivacyTab() {
    return (
      <div>
        <Group title="social">
          <Row label="social.frq">
            <Sel value={privacy.whoCanSendFriendRequests} onChange={v => pwr("whoCanSendFriendRequests", v)} options={FRIEND_REQ_OPTS} />
          </Row>
          <Row label="social.dm">
            <Sel value={privacy.whoCanSendDms} onChange={v => pwr("whoCanSendDms", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="social.gdm">
            <Sel value={privacy.whoCanAddToGcs} onChange={v => pwr("whoCanAddToGcs", v)} options={USER_CTX_OPTS} />
          </Row>
        </Group>

        <Group title="vis">
          <Row label="vis.bio">
            <Sel value={privacy.whoCanSeeBio} onChange={v => pwr("whoCanSeeBio", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="vis.prns">
            <Sel value={privacy.whoCanSeePronouns} onChange={v => pwr("whoCanSeePronouns", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="vis.avi">
            <Sel value={privacy.whoCanSeeAvatar} onChange={v => pwr("whoCanSeeAvatar", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="vis.ban">
            <Sel value={privacy.whoCanSeeBanner} onChange={v => pwr("whoCanSeeBanner", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="vis.stat">
            <Sel value={privacy.whoCanSeeStatus} onChange={v => pwr("whoCanSeeStatus", v)} options={USER_CTX_OPTS} />
          </Row>
        </Group>

        <Group title="contact">
          <Row label="vis.email">
            <Sel value={privacy.whoCanSeeEmail} onChange={v => pwr("whoCanSeeEmail", v)} options={USER_CTX_OPTS} />
          </Row>
          <Row label="vis.phone">
            <Sel value={privacy.whoCanSeePhoneNumber} onChange={v => pwr("whoCanSeePhoneNumber", v)} options={USER_CTX_OPTS} />
          </Row>
        </Group>
      </div>
    );
  }

  function renderAppearanceTab() {
    return (
      <div>
        <Group title="theme">
          <FullRow label="theme.app">
            <BoxGroup value={(rd("theme", 1)) as number} onChange={v => wr("theme", v)} options={THEME_VISUAL} />
          </FullRow>
          <Row label="theme.icon">
            <Sel value={(rd("appIcon", 0)) as number} onChange={v => wr("appIcon", v)} options={APP_ICON_OPTS} />
          </Row>
        </Group>

        <Group title="layout">
          <FullRow label="layout.message_density">
            <BoxGroup
              value={(rd("compactMode", false)) as boolean ? 1 : 0}
              onChange={v => wr("compactMode", v === 1)}
              options={COMPACT_VISUAL}
            />
          </FullRow>
          <Row label="layout.show_ln">
            <Toggle value={(rd("showLineNumbers", false)) as boolean} onChange={v => wr("showLineNumbers", v)} />
          </Row>
        </Group>

        <Group title="icons">
          <FullRow label="icons.servers">
            <BoxGroup value={(rd("serverIconDisplayType", 1)) as number} onChange={v => wr("serverIconDisplayType", v)} options={AVATAR_SHAPE_VISUAL} />
          </FullRow>
          <FullRow label="icons.others">
            <BoxGroup value={(rd("avatarDisplayType", 3)) as number} onChange={v => wr("avatarDisplayType", v)} options={USER_AVATAR_SHAPE_VISUAL} />
          </FullRow>
          <FullRow label="icons.self">
            <BoxGroup value={(rd("selfAvatarDisplayType", 0)) as number} onChange={v => wr("selfAvatarDisplayType", v)} options={AVATAR_SHAPE_VISUAL} />
          </FullRow>
          <Row label="icons.app">
            <Sel value={(rd("appIconDisplayType", 0)) as number} onChange={v => wr("appIconDisplayType", v)} options={ICON_OPTS} />
          </Row>
        </Group>

        <Group title="names">
          <Row label="names.hover">
            <Sel value={(rd("nameHoverBehavior", 1)) as number} onChange={v => wr("nameHoverBehavior", v)} options={NAME_HOVER_OPTS} />
          </Row>
          <Row label="names.custom_fonts">
            <Sel value={(rd("nameFontDisplayType", 0)) as number} onChange={v => wr("nameFontDisplayType", v)} options={FONT_DISPLAY_OPTS} />
          </Row>
          <Row label="names.show_crown">
            <Toggle value={(rd("showOwnerCrown", true)) as boolean} onChange={v => wr("showOwnerCrown", v)} />
          </Row>
        </Group>

        <Group title="roles">
          <FullRow label="roles.color_display">
            <BoxGroup value={(rd("roleColorSettings", 0)) as number} onChange={v => wr("roleColorSettings", v)} options={ROLE_COLOR_VISUAL} />
          </FullRow>
          <Row label="roles.saturate">
            <Toggle value={(rd("applySaturationToRoleColors", false)) as boolean} onChange={v => wr("applySaturationToRoleColors", v)} />
          </Row>
          <Row label="roles.expand">
            <Toggle value={(rd("alwaysExpandRoles", false)) as boolean} onChange={v => wr("alwaysExpandRoles", v)} />
          </Row>
          <Row label="roles.icons">
            <Toggle value={(rd("showRoleIcons", true)) as boolean} onChange={v => wr("showRoleIcons", v)} />
          </Row>
        </Group>

        <Group title="emoji">
          <FullRow label="emoji.rendering" desc="emoji.desc">
            <BoxGroup value={(rd("emojiStyle", 0)) as number} onChange={v => wr("emojiStyle", v)} options={EMOJI_STYLE_VISUAL} />
          </FullRow>
        </Group>
      </div>
    );
  }

  function renderAccessibilityTab() {
    return (
      <div>
        <Group title="visu">
          <Row label="visu.motion">
            <Toggle value={(rd("reduceMotion", false)) as boolean} onChange={v => wr("reduceMotion", v)} />
          </Row>
          <Row label="visu.contrast">
            <Toggle value={(rd("highContrastMode", false)) as boolean} onChange={v => wr("highContrastMode", v)} />
          </Row>
          <Row label="visu.saturate">
            <Slider value={(rd("saturation", 1.0)) as number} onChange={v => wr("saturation", v)} min={0} max={2} step={0.05} format={v => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="visu.text">
            <Slider value={(rd("textSize", 1.0)) as number} onChange={v => wr("textSize", v)} min={0.75} max={1.5} step={0.05} format={v => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="visu.dyslexia">
            <Toggle value={(rd("dyslexiaFont", false)) as boolean} onChange={v => wr("dyslexiaFont", v)} />
          </Row>
        </Group>

        <Group title="anim">
          <Row label="anim.stickers">
            <Sel value={(rd("stickerAnimate", 0)) as number} onChange={v => wr("stickerAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
          <Row label="anim.emoji">
            <Sel value={(rd("emojiAnimate", 2)) as number} onChange={v => wr("emojiAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
          <Row label="anim.gif">
            <Sel value={(rd("gifAnimate", 2)) as number} onChange={v => wr("gifAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
          <Row label="anim.servers">
            <Sel value={(rd("serverAnimate", 0)) as number} onChange={v => wr("serverAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
          <Row label="anim.channels">
            <Sel value={(rd("channelAnimate", 0)) as number} onChange={v => wr("channelAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
          <Row label="anim.avis">
            <Sel value={(rd("avatarAnimate", 2)) as number} onChange={v => wr("avatarAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
          <Row label="anim.roles">
            <Sel value={(rd("glowRoleAnimate", 0)) as number} onChange={v => wr("glowRoleAnimate", v)} options={ANIMATE_OPTS} />
          </Row>
        </Group>

        <Group title="tts">
          <Row label="tts.enable">
            <Toggle value={(rd("tts", false)) as boolean} onChange={v => wr("tts", v)} />
          </Row>
          <Row label="tts.speed">
            <Slider value={(rd("ttsSpeed", 1.0)) as number} onChange={v => wr("ttsSpeed", v)} min={0.5} max={3} step={0.1} format={v => `${v.toFixed(1)}x`} />
          </Row>
        </Group>

        <Group title="input">
          <Row label="input.send">
            <Toggle value={(rd("showSendMessageButton", true)) as boolean} onChange={v => wr("showSendMessageButton", v)} />
          </Row>
          <Row label="input.space" desc="input.space.desc">
            <Toggle value={(rd("autoInsertSpaceAfterAutocomplete", true)) as boolean} onChange={v => wr("autoInsertSpaceAfterAutocomplete", v)} />
          </Row>
        </Group>
      </div>
    );
  }

  function renderVoiceVideoTab() {
    return (
      <div>
        <Group title="vol">
          <Row label="vol.in">
            <Slider value={(rd("inputVolume", 1.0)) as number} onChange={v => wr("inputVolume", v)} min={0} max={2} step={0.05} format={v => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="vol.out">
            <Slider value={(rd("outputVolume", 1.0)) as number} onChange={v => wr("outputVolume", v)} min={0} max={2} step={0.05} format={v => `${Math.round(v * 100)}%`} />
          </Row>
        </Group>
        <Group title="input_mode">
          <Row label="input_mode.voice">
            <Sel value={(rd("voiceInputMode", 0)) as number} onChange={v => wr("voiceInputMode", v)} options={VOICE_OPTS} />
          </Row>
          {rd("voiceInputMode", 0) as number === 0 && (
            <Row label="input_mode.sensitivity">
              <Slider value={(rd("inputSensitivity", -60)) as number} onChange={v => wr("inputSensitivity", v)} min={-100} max={0} step={1} format={v => `${v} dB`} />
            </Row>
          )}
        </Group>
        <Group title="processing">
          <Row label="processing.echo">
            <Toggle value={(rd("echoCancellation", true)) as boolean} onChange={v => wr("echoCancellation", v)} />
          </Row>
          <Row label="processing.suppression">
            <Toggle value={(rd("noiseSuppression", true)) as boolean} onChange={v => wr("noiseSuppression", v)} />
          </Row>
          <Row label="processing.gain">
            <Toggle value={(rd("automaticGainControl", true)) as boolean} onChange={v => wr("automaticGainControl", v)} />
          </Row>
        </Group>
      </div>
    );
  }

  function renderChatTab() {
    return (
      <div>
        <Group title="comp">
          <Row label="comp.ctrl_enter">
            <Toggle value={(rd("sendMessagesWithCtrlEnter", false)) as boolean} onChange={v => wr("sendMessagesWithCtrlEnter", v)} />
          </Row>
          <Row label="comp.mention_suggestions">
            <Toggle value={(rd("showMentionSuggestions", true)) as boolean} onChange={v => wr("showMentionSuggestions", v)} />
          </Row>
          <Row label="comp.convert_emoticons">
            <Toggle value={(rd("convertEmoticonsToEmoji", false)) as boolean} onChange={v => wr("convertEmoticonsToEmoji", v)} />
          </Row>
        </Group>

        <Group title="display">
          <Row label="display.links">
            <Toggle value={(rd("alwaysUnderlineLinks", false)) as boolean} onChange={v => wr("alwaysUnderlineLinks", v)} />
          </Row>
          <Row label="display.timestamps">
            <Toggle value={(rd("showMessageTimestamps", true)) as boolean} onChange={v => wr("showMessageTimestamps", v)} />
          </Row>
          <Row label="display.prev_md">
            <Toggle value={(rd("previewMarkdown", true)) as boolean} onChange={v => wr("previewMarkdown", v)} />
          </Row>
          <Row label="display.highlight">
            <Toggle value={(rd("highlightMentions", true)) as boolean} onChange={v => wr("highlightMentions", v)} />
          </Row>
        </Group>

        <Group title="reactions">
          <Row label="reactions.show">
            <Toggle value={(rd("showReactions", true)) as boolean} onChange={v => wr("showReactions", v)} />
          </Row>
          <Row label="reactions.count">
            <Toggle value={(rd("showReactionCount", true)) as boolean} onChange={v => wr("showReactionCount", v)} />
          </Row>
          <Row label="reactions.who">
            <Toggle value={(rd("showUsersWhoReacted", true)) as boolean} onChange={v => wr("showUsersWhoReacted", v)} />
          </Row>
        </Group>

        <Group title="spoilers">
          <FullRow label="spoilers.reveal">
            <BoxGroup value={(rd("showSpoilers", 1)) as number} onChange={v => wr("showSpoilers", v)} options={SPOILER_VISUAL} />
          </FullRow>
          <FullRow label="spoilers.friends">
            <BoxGroup value={(rd("showSpoilersFromFriends", 1)) as number} onChange={v => wr("showSpoilersFromFriends", v)} options={SPOILER_VISUAL} />
          </FullRow>
        </Group>

        <Group title="media">
          <Row label="media.images.link">
            <Toggle value={(rd("showImagesFromLinks", true)) as boolean} onChange={v => wr("showImagesFromLinks", v)} />
          </Row>
          <Row label="media.images.upload">
            <Toggle value={(rd("showImagesUploadedToHarmony", true)) as boolean} onChange={v => wr("showImagesUploadedToHarmony", v)} />
          </Row>
          <Row label="media.videos.link">
            <Toggle value={(rd("showVideosFromLinks", true)) as boolean} onChange={v => wr("showVideosFromLinks", v)} />
          </Row>
          <Row label="media.videos.upload">
            <Toggle value={(rd("showVideosUploadedToHarmony", true)) as boolean} onChange={v => wr("showVideosUploadedToHarmony", v)} />
          </Row>
          <Row label="media.embeds">
            <Toggle value={(rd("showWebEmbeds", true)) as boolean} onChange={v => wr("showWebEmbeds", v)} />
          </Row>
          <Row label="media.hide_link">
            <Toggle value={(rd("hideLinkWhenPreviewing", true)) as boolean} onChange={v => wr("hideLinkWhenPreviewing", v)} />
          </Row>
        </Group>
      </div>
    );
  }

  function renderNotificationsTab() {
    const muted = (rd("muteAllNotifications", false)) as boolean;
    return (
      <div>
        {muted && (
          <InfoBanner variant="warn">
            {t("notif.muted")}
          </InfoBanner>
        )}

        <Group title="general">
          <Row label="notif.mute" desc="notif.mute.desc">
            <Toggle value={muted} onChange={v => wr("muteAllNotifications", v)} />
          </Row>
        </Group>

        <div style={{
          opacity: muted ? 0.42 : 1,
          pointerEvents: muted ? "none" : undefined,
          transition: "opacity 220ms",
        }}>
          <Group title="delivery">
            <Row label="delivery.desk" desc="delivery.desk.desc">
              <Toggle value={(rd("enableDesktopNotifications", true)) as boolean} onChange={v => wr("enableDesktopNotifications", v)} />
            </Row>
            <Row label="delivery.sounds">
              <Toggle value={(rd("enableSoundNotifications", true)) as boolean} onChange={v => wr("enableSoundNotifications", v)} />
            </Row>
            {(rd("enableSoundNotifications", true)) as boolean && (
              <Row label="delivery.vol">
                <Slider
                  value={(rd("notificationVolume", 1.0)) as number}
                  onChange={v => wr("notificationVolume", v)}
                  min={0} max={1} step={0.05}
                  format={v => `${Math.round(v * 100)}%`}
                />
              </Row>
            )}
            <Row label="delivery.unfocused" desc="delivery.unfocused.desc">
              <Toggle value={(rd("notifyWhenUnfocused", false)) as boolean} onChange={v => wr("notifyWhenUnfocused", v)} />
            </Row>
            <Row label="delivery.preview" desc="delivery.preview.desc">
              <Toggle value={(rd("showNotificationPreview", true)) as boolean} onChange={v => wr("showNotificationPreview", v)} />
            </Row>
          </Group>

          <Group title="act">
            <Row label="act.mentions" desc="act.mentions.desc">
              <Toggle value={(rd("notifyOnMention", true)) as boolean} onChange={v => wr("notifyOnMention", v)} />
            </Row>
            <Row label="act.dm" desc="act.dm.desc">
              <Toggle value={(rd("notifyOnDirectMessage", true)) as boolean} onChange={v => wr("notifyOnDirectMessage", v)} />
            </Row>
            <Row label="act.frq" desc="act.frq.desc">
              <Toggle value={(rd("notifyOnFriendRequest", true)) as boolean} onChange={v => wr("notifyOnFriendRequest", v)} />
            </Row>
            <Row label="act.replies" desc="act.replies.desc">
              <Toggle value={(rd("notifyOnReply", true)) as boolean} onChange={v => wr("notifyOnReply", v)} />
            </Row>
            <Row label="act.reactions" desc="act.reactions.desc">
              <Toggle value={(rd("notifyOnReaction", false)) as boolean} onChange={v => wr("notifyOnReaction", v)} />
            </Row>
          </Group>
        </div>
      </div>
    );
  }

  function renderLanguageTab() {
    return (
      <div>
        <Group title="lang">
          <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>
              {t("lang.display")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-5)", marginBottom: 14, lineHeight: 1.5 }}>
              {t("lang.desc")}
            </div>
            <LanguageSelect
              value={(rd("language", 0)) as number}
              onChange={v => wr("language", v)}
            />
          </div>
        </Group>
      </div>
    );
  }

  function renderAdvancedTab() {
    return (
      <div>
        <Group title="dev">
          <Row label="dev.mode" desc="dev.mode.desc">
            <Toggle value={(rd("developerMode", false)) as boolean} onChange={v => wr("developerMode", v)} />
          </Row>
        </Group>
      </div>
    );
  }

  function loadCurrentTab() {
    switch (currentTab) {
      case "acc":           return renderAccountTab();
      case "profiles":      return renderProfilesTab();
      case "p&s":           return renderPrivacyTab();
      case "appearance":    return renderAppearanceTab();
      case "accessibility": return renderAccessibilityTab();
      case "v&v":           return renderVoiceVideoTab();
      case "chat":          return renderChatTab();
      case "notifs":        return renderNotificationsTab();
      case "lang":          return renderLanguageTab();
      case "advanced":      return renderAdvancedTab();
      default:              return null;
    }
  }

  const tabs = {
    "user": ["acc", "profiles", "p&s"],
    "app":  ["appearance", "accessibility", "v&v", "chat", "notifs", "lang", "advanced"]
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
              {/* todo: implement */}
              <input placeholder={t("settings.search")} />
            </div>
            <hr />
            {Object.entries(tabs).map(([section, items]) => (
              <div key={section} className="nav-section">
                <div className="section-header uno ellipsis">{t(`settings.${section}` as TranslationKeys)}</div>
                {items.map(item => (
                  <div
                    key={item}
                    className={"channel uno" + (currentTab === item ? " selected" : " int") + (hasUnsaved && currentTab !== item ? " semitrans" : "")}
                    onClick={() => selectTab(item)}
                    title={hasUnsaved && currentTab !== item ? "Save or revert changes before switching tabs" : undefined}
                    style={hasUnsaved && currentTab !== item ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                  >
                    <div className="nav-icon" style={{ "--mask-url": `url(./settings/${iconUrl(item)}.png)` } as any} />
                    {t(`tab.${item}` as TranslationKeys)}
                  </div>
                ))}
                <hr />
              </div>
            ))}
            <div className="channel uno int dangerous" onClick={logout}>
              <div className="nav-icon" style={{ "--mask-url": "url(./settings/logout.png)" } as any} />
              {t("settings.logout")}
            </div>
          </div>

          <div className="settings-content ovy-auto">
            <div className="settings-header ellipsis uno">
              <div className="nav-icon settings-header-icon uno" style={{ "--mask-url": `url(./settings/${iconUrl(currentTab)}.png)` } as any} />
              {t(`tab.${currentTab}` as TranslationKeys)}
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
                {t(saveError as TranslationKeys)}
              </div>
            )}

            {hasUnsaved && (
              <div className="unsaved-bar">
                <div className="uno">{t("settings.unsaved_changes")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleRevert}>{t("revert")}</button>
                  <button className="save-btn" onClick={handleSave}>{t("save_changes")}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAviCropper && croppingSrc && (
        <CroppingModal src={croppingSrc}
          onCancel={() => { setShowAviCropper(false); setCroppingSrc(null); setAvatarFile(null); }}
          onComplete={onAviCrop} headerText={t("avi.crop")} shape="circle" />
      )}
      {showBaniCropper && croppingSrc && (
        <CroppingModal src={croppingSrc}
          onCancel={() => { setShowBaniCropper(false); setCroppingSrc(null); setBannerFile(null); }}
          onComplete={onBaniCrop} headerText={t("ban.crop")} shape="rect" rectAspect={2} />
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