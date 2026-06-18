import {
  useState, useEffect, useRef, useLayoutEffect, useMemo,
} from "react";
import data from "@emoji-mart/data";
import { SearchIndex, init } from "emoji-mart";
import { renderEmoji } from "../../../lib/utils/MarkdownRenderer";
import type { Server } from "../../../lib/utils/Types";
import { t, useLocale } from "../../../lib/i18n/Index";
import type { TranslationKeys } from "../../../lib/i18n/Schema";
import { normalizeEmojiId } from "../../../lib/utils/Funcs";
import { getEmojiUrl } from "../../../lib/utils/ServerUtils";
import { getSs } from "../../../lib/state/Servers";

init({ data });

const FREQ_KEY = "emojiPicker:frequent";
const FAV_KEY  = "emojiPicker:favorites";
const GIF_KEY  = "emojiPicker:gifFavorites";

function loadArr<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}
function saveArr(key: string, val: unknown[]): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(val)
    );
  } catch { }
}

const CATEGORY_META: Record<string, { icon: string; labelKey: TranslationKeys }> = {
  people:   { icon: "😀", labelKey: "emoji_picker.cat.people"   },
  nature:   { icon: "🐶", labelKey: "emoji_picker.cat.nature"   },
  foods:    { icon: "🍔", labelKey: "emoji_picker.cat.foods"    },
  activity: { icon: "⚽", labelKey: "emoji_picker.cat.activity"  },
  places:   { icon: "✈️", labelKey: "emoji_picker.cat.places"    },
  objects:  { icon: "💡", labelKey: "emoji_picker.cat.objects"   },
  symbols:  { icon: "❤️", labelKey: "emoji_picker.cat.symbols"   },
  flags:    { icon: "🏳️", labelKey: "emoji_picker.cat.flags"     },
};

const KAOMOJI: { labelKey: TranslationKeys; items: string[] }[] = [
  { labelKey: "emoji_picker.kao.happy",     items: ["(｡◕‿◕｡)", "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "(^▽^)", "(*^▽^*)", "＼(^o^)／", "(✿◠‿◠)", "(ﾉ´ヮ`)ﾉ*: ･ﾟ", "(*^‿^*)"] },
  { labelKey: "emoji_picker.kao.sad",       items: ["(╥﹏╥)", "(T▽T)", "(；￣Д￣)", "(´；ω；`)", "இ_இ", "(ò_ó)", "(｡╯︵╰｡)", "(⌣_⌣\")"] },
  { labelKey: "emoji_picker.kao.surprised", items: ["(⊙_⊙)", "Σ(°△°|||)︴", "(ﾟДﾟ;)", "Σ(ﾟДﾟ)", "⊙▂⊙", "(°o°)", "(ﾟдﾟ)"] },
  { labelKey: "emoji_picker.kao.angry",     items: ["(╬ ಠ益ಠ)", "(ノಠ益ಠ)ノ彡┻━┻", "(>﹏<)", "(ᗒᗩᗕ)", "凸(｀△´#)", "(ー_ーゞ"] },
  { labelKey: "emoji_picker.kao.love",      items: ["(♥ω♥*)", "(◍•ᴗ•◍)❤", "(≧◡≦)", "(づ｡◕‿‿◕｡)づ", "(ﾉ´з`)♥", "♡(˃͈ દ ˂͈ ༶ )"] },
  { labelKey: "emoji_picker.kao.shrug",     items: ["¯\\_(ツ)_/¯", "╮(─▽─)╭", "┐(´д｀)┌", "¯\\(°_o)/¯", "ヽ(ー_ー )ノ", "┐(￣ヘ￣)┌"] },
  { labelKey: "emoji_picker.kao.tableflip", items: ["(╯°□°）╯︵ ┻━┻", "┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻", "┬─┬ ノ( ゜-゜ノ)", "(ノಥ益ಥ)ノ ┻━┻"] },
  { labelKey: "emoji_picker.kao.bear",      items: ["ʕ•ᴥ•ʔ", "ʕ◕ᴥ◕ʔ", "(ᵔᴥᵔ)", "ฅ^•ﻌ•^ฅ", "ʕ•̫͡•ʔ"] },
  { labelKey: "emoji_picker.kao.other",     items: ["(づ￣ ³￣)づ", "(´・ω・`)", "(°ロ°)", "(¬‿¬)", "(ó﹏ò｡)", "ب_ب", "(｡•́‿•̀｡)"] },
];

interface Emoji { id: bigint; name: string; url: string; }
interface GifResult { id: string; url: string; preview: string; title: string; }

interface Props {
  position: { top: number; left?: number; right?: number };
  onSelect: (emoji: string, e: React.MouseEvent<HTMLDivElement | HTMLButtonElement, MouseEvent>) => void;
  onSelectCustomEmoji?: (name: string, id: bigint, e: React.MouseEvent<HTMLDivElement | HTMLButtonElement, MouseEvent>) => void;
  onSelectGif?: (url: string, preview: string, e: React.MouseEvent<HTMLDivElement | HTMLButtonElement, MouseEvent>) => void;
}

const PICKER_W = 360;
const PICKER_H = 460;
// Set VITE_TENOR_API_KEY in your .env file to enable the GIF tab.
const TENOR_KEY: string = (import.meta as any).env?.VITE_TENOR_API_KEY ?? "";

export default function EmojiPickerPopout({
  position, onSelect, onSelectCustomEmoji, onSelectGif
}: Props) {
  useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const servers = getSs().servers;

  useLayoutEffect(() => {
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    }
  }, []);

  const w = size.w || PICKER_W;
  const h = size.h || PICKER_H;
  const computedLeft = position.left != null
    ? Math.max(8, Math.min(position.left, window.innerWidth - w - 8))
    : position.right != null
      ? Math.max(8, window.innerWidth - position.right - w)
      : 8;
  const computedTop = Math.max(8, Math.min(position.top, window.innerHeight - h - 8));

  const [tab, setTab] = useState<"emoji" | "gif" | "kaomoji">("emoji");

  const [emojiSearch, setEmojiSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [frequent, setFrequent] = useState<string[]>(() => loadArr<string>(FREQ_KEY));
  const [favorites, setFavorites] = useState<string[]>(() => loadArr<string>(FAV_KEY));
  const [hoveredName, setHoveredName] = useState("");
  const [hoveredNative, setHoveredNative] = useState("");
  const [activeCat, setActiveCat] = useState("frequent");
  const scrollRef = useRef<HTMLDivElement>(null);
  const catRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (tab === "emoji")
        emojiInputRef.current?.focus({ preventScroll: true });
      else if (tab === "gif")
        gifInputRef.current?.focus({ preventScroll: true });
    }, 30);
    return () => clearTimeout(t);
  }, [tab]);

  const stdCats = useMemo(
    () => (data as any).categories as { id: string; emojis: string[] }[],
    []
  );

  const serverGroups = useMemo<{ server: Server; emojis: Emoji[] }[]>(() => {
    return servers
      .map(s => ({ server: s, emojis: (s.emojis ?? []).map(e => ({ name: e.name, id: e.id, url: getEmojiUrl(e) })) as Emoji[] }))
      .filter(g => g.emojis.length > 0);
  }, [servers]);

  const allCatIds = useMemo<string[]>(() => {
    const ids: string[] = [];
    if (favorites.length > 0)
      ids.push("favorites");
    if (frequent.length > 0)
      ids.push("frequent");
    for (const g of serverGroups)
      ids.push(`server:${g.server.id}`);
    for (const c of stdCats)
      ids.push(c.id);
    return ids;
  }, [favorites.length, frequent.length, serverGroups, stdCats]);

  useEffect(() => {
    if (!emojiSearch.trim()) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    async function run() {
      const raw = emojiSearch.replace(/^:/, "").trim();
      const q = raw.replace(/_/g, " ");

      const stds = ((await SearchIndex.search(q)) ?? [])
        .slice(0, 20)
        .map((e: any) => ({ ...e, _src: "std" }));
      const customs = serverGroups
        .flatMap(g => g.emojis.filter(e => e.name.toLowerCase().includes(raw.toLowerCase())))
        .slice(0, 10)
        .map(e => ({ ...e, _src: "custom" }));
      
      if (!cancelled)
        setSearchResults([...customs, ...stds]);
    }
    run();
    return () => { cancelled = true; };
  }, [emojiSearch, serverGroups]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll || tab !== "emoji" || emojiSearch)
      return;
    const handle = () => {
      let best = allCatIds[0] ?? "";
      let bestTop = -Infinity;
      catRefs.current.forEach((el, id) => {
        const t = el.offsetTop;
        if (t <= scroll.scrollTop + 40 && t > bestTop) { bestTop = t; best = id; }
      });
      setActiveCat(best);
    };
    scroll.addEventListener("scroll", handle, { passive: true });
    handle();
    return () => scroll.removeEventListener("scroll", handle);
  }, [tab, emojiSearch, allCatIds]);

  function selectEmoji(native: string, id: string, e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    const nf = [id, ...frequent.filter(f => f !== id)].slice(0, 36);
    setFrequent(nf);
    saveArr(FREQ_KEY, nf);
    onSelect(native, e);
  }

  function scrollToCategory(catId: string) {
    const el = catRefs.current.get(catId);
    if (el && scrollRef.current) {
      scrollRef.current.scrollTop = el.offsetTop;
      setActiveCat(catId);
    }
  }

  function hoverEmoji(name: string, native = "") {
    setHoveredName(name);
    setHoveredNative(native);
  }

  const [gifSearch, setGifSearch] = useState("");
  const [gifResults, setGifResults] = useState<GifResult[]>([]);
  const [gifFavs, setGifFavs] = useState<GifResult[]>(() => loadArr<GifResult>(GIF_KEY));
  const [gifLoading, setGifLoading] = useState(false);
  const gifTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (tab !== "gif" || !TENOR_KEY) return;
    clearTimeout(gifTimer.current);
    gifTimer.current = setTimeout(async () => {
      setGifLoading(true);
      try {
        const ep = gifSearch.trim()
          ? `https://tenor.googleapis.com/v2/search?key=${TENOR_KEY}&q=${encodeURIComponent(gifSearch)}&limit=20&media_filter=tinygif`
          : `https://tenor.googleapis.com/v2/featured?key=${TENOR_KEY}&limit=20&media_filter=tinygif`;
        const json = await fetch(ep).then(r => r.json());
        setGifResults((json.results ?? []).map((r: any): GifResult => ({
          id: r.id,
          url: r.media_formats?.gif?.url ?? r.media_formats?.tinygif?.url ?? "",
          preview: r.media_formats?.tinygif?.url ?? r.media_formats?.nanogif?.url ?? "",
          title: r.title ?? "",
        })));
      } catch { /* network error */ }
      setGifLoading(false);
    }, gifSearch ? 400 : 0);
    return () => clearTimeout(gifTimer.current);
  }, [tab, gifSearch]);

  function toggleGifFav(gif: GifResult) {
    const next = gifFavs.some(f => f.id === gif.id)
      ? gifFavs.filter(f => f.id !== gif.id)
      : [gif, ...gifFavs].slice(0, 24);
    setGifFavs(next);
    saveArr(GIF_KEY, next);
  }

  const sectionHeader: React.CSSProperties = {
    fontSize: "10px", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "var(--text-5)",
    padding: "8px 12px 4px",
    position: "sticky", top: 0, zIndex: 1,
    background: "var(--bg-2)"
  };

  const emojiBtn: React.CSSProperties = {
    width: 36, height: 36, padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "1px solid transparent",
    borderRadius: "6px", cursor: "pointer", fontSize: "22px", lineHeight: 1,
    transition: "background 80ms, border-color 80ms"
  };

  function renderEmojiCell(native: string, emojiId: string) {
    const normId = normalizeEmojiId(native, emojiId);
    return (
      <button
        key={emojiId}
        style={emojiBtn}
        onMouseEnter={e => {
          e.currentTarget.style.background = "var(--bg-3)";
          e.currentTarget.style.borderColor = "var(--border)";
          hoverEmoji(normId, native);
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "none";
          e.currentTarget.style.borderColor = "transparent";
          hoverEmoji("");
        }}
        onMouseDown={e => { e.preventDefault(); selectEmoji(native, emojiId, e); }}
        title={`:${normId}:`}
      >
        {renderEmoji({ name: native })}
      </button>
    );
  }

  function renderCustomCell(e: Emoji) {
    return (
      <button
        key={e.id}
        style={emojiBtn}
        onMouseEnter={ev => {
          ev.currentTarget.style.background = "var(--bg-3)";
          ev.currentTarget.style.borderColor = "var(--border)";
          hoverEmoji(e.name);
        }}
        onMouseLeave={ev => {
          ev.currentTarget.style.background = "none";
          ev.currentTarget.style.borderColor = "transparent";
          hoverEmoji("");
        }}
        onMouseDown={ev => { ev.preventDefault(); onSelectCustomEmoji?.(e.name, e.id, ev); }}
        title={`:${e.name}:`}
      >
        <img src={e.url} alt={e.name} style={{ width: 22, height: 22, objectFit: "contain" }} />
      </button>
    );
  }

  function renderSection(
    catId: string,
    label: string,
    emojiIds?: string[],
    customEmojis?: Emoji[]
  ) {
    const hasContent = (emojiIds?.length ?? 0) > 0 || (customEmojis?.length ?? 0) > 0;
    if (!hasContent) return null;
    return (
      <div
        key={catId}
        ref={el => { if (el) catRefs.current.set(catId, el as HTMLDivElement); else catRefs.current.delete(catId); }}
      >
        <div style={sectionHeader}>{label}</div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(8, 36px)",
          gap: "2px", padding: "0 12px 8px",
        }}>
          {emojiIds?.map(eid => {
            const e = (data as any).emojis[eid];
            if (!e)
              return null;
            return renderEmojiCell(e.skins[0].native, eid);
          })}
          {customEmojis?.map(e => renderCustomCell(e))}
        </div>
      </div>
    );
  }

  function renderGifCell(gif: GifResult) {
    const isFav = gifFavs.some(f => f.id === gif.id);
    return (
      <div
        key={gif.id}
        style={{
          position: "relative", marginBottom: 4, borderRadius: 8,
          overflow: "hidden", cursor: "pointer",
          border: "1px solid var(--border)", breakInside: "avoid" as any,
        }}
        onClick={e => {
          if (onSelectGif)
            onSelectGif(gif.url, gif.preview, e);
          else
            onSelect(gif.url, e);
        }}
      >
        <img
          src={gif.preview || gif.url}
          alt={gif.title}
          style={{ width: "100%", display: "block" }}
          loading="lazy"
        />
        <button
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); toggleGifFav(gif); }}
          style={{
            position: "absolute", top: 4, right: 4, width: 22, height: 22,
            background: isFav ? "var(--accent-1)" : "rgba(0,0,0,.65)",
            border: "none", borderRadius: "50%", cursor: "pointer",
            color: "white", fontSize: "12px", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 0,
          }}
          title={isFav ? t("emoji_picker.remove_favorite") : t("emoji_picker.add_favorite")}
        >
          {isFav ? "★" : "☆"}
        </button>
      </div>
    );
  }

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0, width: 32, height: 30,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: active ? "color-mix(in hsl, var(--accent-1), transparent 80%)" : "none",
    border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "17px",
    outline: "none", opacity: active ? 1 : 0.55,
    transition: "opacity 100ms, background 100ms"
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg-1)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "6px 10px",
    color: "var(--text-1)", fontSize: "13px",
    outline: "none"
  };

  return (
    <div
      ref={ref}
      className="uno"
      style={{
        position: "fixed", top: computedTop, left: computedLeft,
        zIndex: 1000, width: PICKER_W, height: PICKER_H,
        display: "flex", flexDirection: "column",
        background: "var(--bg-2)", border: "1px solid var(--border)",
        borderRadius: "12px",
        boxShadow: "0 8px 28px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.25)",
        overflow: "hidden"
      }}
    >
      <div style={{
        display: "flex", flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in hsl, var(--bg-3), transparent 25%)"
      }}>
        {(["gif", "emoji", "kaomoji"] as const).map(tabId => (
          <button key={tabId} onClick={() => setTab(tabId)} style={{
            flex: 1, padding: "9px 0",
            background: "none", border: "none",
            borderBottom: `2px solid ${tab === tabId ? "var(--accent-1)" : "transparent"}`,
            color: tab === tabId ? "var(--text-1)" : "var(--text-4)",
            cursor: "pointer", fontSize: "12px", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "color 150ms, border-color 150ms"
          }}>
            <span style={{ fontSize: 14 }}>
              {tabId === "gif" ? "🎞" : tabId === "emoji" ? "😀" : "ᴥ"}
            </span>
            <span>{tabId === "gif" ? t("emoji_picker.tab.gif") : tabId === "emoji" ? t("emoji_picker.tab.emoji") : t("emoji_picker.tab.kaomoji")}</span>
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <>
          <div style={{ padding: "8px 10px 6px", flexShrink: 0 }}>
            <input
              ref={emojiInputRef}
              placeholder={t("emoji_picker.search")}
              value={emojiSearch}
              onChange={e => setEmojiSearch(e.target.value)}
              style={inputStyle}
            />
          </div>

          {!emojiSearch && (
            <div style={{
              display: "flex", alignItems: "center", gap: "2px",
              padding: "0 8px 6px", flexShrink: 0,
              overflowX: "auto", scrollbarWidth: "none",
              borderBottom: "1px solid var(--border)"
            }}>
              {favorites.length > 0 && (
                <button style={navBtnStyle(activeCat === "favorites")} title={t("emoji_picker.favorites")}
                  onClick={() => scrollToCategory("favorites")}>⭐</button>
              )}
              {frequent.length > 0 && (
                <button style={navBtnStyle(activeCat === "frequent")} title={t("emoji_picker.frequent")}
                  onClick={() => scrollToCategory("frequent")}>🕐</button>
              )}
              {serverGroups.map(({ server }) => (
                <button key={server.id} style={navBtnStyle(activeCat === `server:${server.id}`)}
                  title={server.name} onClick={() => scrollToCategory(`server:${server.id}`)}>
                  {server.icon
                    ? <img src={server.icon}
                        style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} alt="" />
                    : <span style={{ fontSize: "11px", fontWeight: 700 }}>{server.name[0]}</span>
                  }
                </button>
              ))}
              
              {serverGroups.length > 0 && (
                <div style={{
                  width: 1, height: 20, background: "var(--border)",
                  flexShrink: 0, margin: "0 2px"
                }} />
              )}
              {stdCats.map(cat => {
                const meta = CATEGORY_META[cat.id];
                if (!meta)
                  return null;
                return (
                  <button key={cat.id} style={navBtnStyle(activeCat === cat.id)}
                    title={t(meta.labelKey)} onClick={() => scrollToCategory(cat.id)}>
                    {meta.icon}
                  </button>
                );
              })}
            </div>
          )}

          <div ref={scrollRef} style={{
            flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative",
          }}>
            {emojiSearch ? (
              <div>
                <div style={sectionHeader}>{t("emoji_picker.search_results")}</div>
                {searchResults.length === 0
                  ? <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-5)", fontSize: "13px" }}>
                      {t("emoji_picker.no_results", { query: emojiSearch })}
                    </div>
                  : <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 36px)", gap: "2px", padding: "0 12px 8px" }}>
                      {searchResults.map(e =>
                        e._src === "custom"
                          ? renderCustomCell(e as Emoji)
                          : renderEmojiCell(e.skins?.[0]?.native ?? "", e.id as string),
                      )}
                    </div>
                }
              </div>
            ) : (
              <>
                {favorites.length > 0 &&
                  renderSection("favorites", t("emoji_picker.favorites_star"), favorites.filter(id => (data as any).emojis[id]))}
                {frequent.length > 0 &&
                  renderSection("frequent", `🕐 ${t("emoji_picker.frequent")}`, frequent.filter(id => (data as any).emojis[id]))}
                {serverGroups.map(({ server, emojis }) =>
                  renderSection(`server:${server.id}`, server.name, undefined, emojis))}
                {stdCats.map(cat =>
                  renderSection(cat.id, t(CATEGORY_META[cat.id]?.labelKey ?? "emoji_picker.cat.people"), cat.emojis))}
              </>
            )}
          </div>

          <div style={{
            flexShrink: 0, height: 34,
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 12px",
            background: "color-mix(in hsl, var(--bg-3), transparent 25%)"
          }}>
            <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>
              {hoveredNative
                ? renderEmoji({ name: hoveredNative })
                : <span style={{ opacity: 0.3 }}>😀</span>
              }
            </span>
            <span style={{
              fontSize: "12px", fontFamily: "monospace",
              color: hoveredName ? "var(--text-3)" : "var(--text-5)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
            }}>
              {hoveredName ? `:${hoveredName}:` : t("emoji_picker.hover_hint")}
            </span>
          </div>
        </>
      )}

      {tab === "gif" && (
        <>
          <div style={{ padding: "8px 10px 6px", flexShrink: 0 }}>
            <input
              ref={gifInputRef}
              placeholder={t("emoji_picker.gif.search")}
              value={gifSearch}
              onChange={e => setGifSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {!TENOR_KEY ? (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "28px", marginBottom: 8 }}>🎞</div>
                <div style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: 6 }}>{t("emoji_picker.gif.not_configured")}</div>
                <div style={{ color: "var(--text-5)", fontSize: "12px" }}>
                  {t("emoji_picker.gif.api_hint")}
                </div>
              </div>
            ) : (
              <>
                {gifFavs.length > 0 && (
                  <>
                    <div style={sectionHeader}>{t("emoji_picker.favorites_star")}</div>
                    <div style={{ columns: 2, columnGap: 4, padding: "0 8px 4px" }}>
                      {gifFavs.map(gif => renderGifCell(gif))}
                    </div>
                  </>
                )}
                <div style={sectionHeader}>{gifSearch ? t("emoji_picker.search_results") : t("emoji_picker.gif.trending")}</div>
                {gifLoading && (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-5)", fontSize: "13px" }}>
                    {t("loading")}
                  </div>
                )}
                {!gifLoading && gifResults.length === 0 && gifSearch && (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-5)", fontSize: "13px" }}>
                    {t("emoji_picker.gif.no_results", { query: gifSearch })}
                  </div>
                )}
                {!gifLoading && gifResults.length > 0 && (
                  <div style={{ columns: 2, columnGap: 4, padding: "0 8px 8px" }}>
                    {gifResults.map(gif => renderGifCell(gif))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {tab === "kaomoji" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          {KAOMOJI.map(cat => (
            <div key={cat.labelKey}>
              <div style={sectionHeader}>{t(cat.labelKey)}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "2px 10px 8px" }}>
                {cat.items.map(k => (
                  <button
                    key={k}
                    onMouseDown={e => { e.preventDefault(); onSelect(k, e); }}
                    title={t("emoji_picker.insert", { name: k })}
                    style={{
                      background: "var(--bg-3)", border: "1px solid var(--border)",
                      borderRadius: "6px", padding: "4px 8px",
                      color: "var(--text-2)", cursor: "pointer", fontSize: "13px",
                      whiteSpace: "nowrap", transition: "background 80ms"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-4)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-3)"; }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
