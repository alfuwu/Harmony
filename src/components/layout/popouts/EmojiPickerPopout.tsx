import {
  useState, useEffect, useRef, useLayoutEffect, useMemo,
} from "react";
import data from "@emoji-mart/data";
import { SearchIndex, init } from "emoji-mart";
import { renderEmoji } from "../../../lib/utils/MarkdownRenderer";
import type { UserSettings } from "../../../lib/utils/userSettings";
import type { Server } from "../../../lib/utils/types";

init({ data });

function isFlag(native: string): boolean {
  const pts = [...(native ?? "")].map(c => c.codePointAt(0) ?? 0);
  return pts.length === 2 && pts.every(p => p >= 0x1f1e6 && p <= 0x1f1ff);
}

export function normalizeEmojiId(id: string, native?: string): string {
  let n = (id ?? "").replace(/-/g, "_");
  if (native && isFlag(native) && !n.startsWith("flag_") && !n.startsWith("regional_"))
    n = `flag_${n}`;
  return n;
}

const FREQ_KEY = "emojiPicker:frequent";
const FAV_KEY  = "emojiPicker:favorites";
const GIF_KEY  = "emojiPicker:gifFavorites";

function loadArr<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
}
function saveArr(key: string, val: unknown[]): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

const CATEGORY_META: Record<string, { icon: string; label: string }> = {
  people:   { icon: "😀", label: "Smileys & People"  },
  nature:   { icon: "🐶", label: "Animals & Nature"  },
  foods:    { icon: "🍔", label: "Food & Drink"       },
  activity: { icon: "⚽", label: "Activities"         },
  places:   { icon: "✈️", label: "Travel & Places"    },
  objects:  { icon: "💡", label: "Objects"            },
  symbols:  { icon: "❤️", label: "Symbols"            },
  flags:    { icon: "🏳️", label: "Flags"              },
};

const KAOMOJI: { label: string; items: string[] }[] = [
  { label: "Happy",     items: ["(｡◕‿◕｡)", "(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧", "(^▽^)", "(*^▽^*)", "＼(^o^)／", "(✿◠‿◠)", "(ﾉ´ヮ`)ﾉ*: ･ﾟ", "(*^‿^*)"] },
  { label: "Sad",       items: ["(╥﹏╥)", "(T▽T)", "(；￣Д￣)", "(´；ω；`)", "இ_இ", "(ò_ó)", "(｡╯︵╰｡)", "(⌣_⌣\")"] },
  { label: "Surprised", items: ["(⊙_⊙)", "Σ(°△°|||)︴", "(ﾟДﾟ;)", "Σ(ﾟДﾟ)", "⊙▂⊙", "(°o°)", "(ﾟдﾟ)"] },
  { label: "Angry",     items: ["(╬ ಠ益ಠ)", "(ノಠ益ಠ)ノ彡┻━┻", "(>﹏<)", "(ᗒᗩᗕ)", "凸(｀△´#)", "(ー_ーゞ"] },
  { label: "Love",      items: ["(♥ω♥*)", "(◍•ᴗ•◍)❤", "(≧◡≦)", "(づ｡◕‿‿◕｡)づ", "(ﾉ´з`)♥", "♡(˃͈ દ ˂͈ ༶ )"] },
  { label: "Shrug",     items: ["¯\\_(ツ)_/¯", "╮(─▽─)╭", "┐(´д｀)┌", "¯\\(°_o)/¯", "ヽ(ー_ー )ノ", "┐(￣ヘ￣)┌"] },
  { label: "Tableflip", items: ["(╯°□°）╯︵ ┻━┻", "┻━┻ ︵ヽ(`Д´)ﾉ︵ ┻━┻", "┬─┬ ノ( ゜-゜ノ)", "(ノಥ益ಥ)ノ ┻━┻"] },
  { label: "Bear",      items: ["ʕ•ᴥ•ʔ", "ʕ◕ᴥ◕ʔ", "(ᵔᴥᵔ)", "ฅ^•ﻌ•^ฅ", "ʕ•̫͡•ʔ"] },
  { label: "Other",     items: ["(づ￣ ³￣)づ", "(´・ω・`)", "(°ロ°)", "(¬‿¬)", "(ó﹏ò｡)", "ب_ب", "(｡•́‿•̀｡)"] },
];

interface CustomEmoji { id: string; name: string; url: string; }
interface GifResult   { id: string; url: string; preview: string; title: string; }

interface Props {
  position: { top: number; left?: number; right?: number };
  onSelect: (emoji: string) => void;
  onSelectCustomEmoji?: (name: string, id: string) => void;
  onSelectGif?: (url: string, preview: string) => void;
  userSettings: UserSettings | null;
  servers?: Server[];
}

const PICKER_W = 360;
const PICKER_H = 460;
// Set VITE_TENOR_API_KEY in your .env file to enable the GIF tab.
const TENOR_KEY: string = (import.meta as any).env?.VITE_TENOR_API_KEY ?? "";

export default function EmojiPickerPopout({
  position, onSelect, onSelectCustomEmoji, onSelectGif, userSettings, servers = [],
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

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

  const serverGroups = useMemo<{ server: Server; emojis: CustomEmoji[] }[]>(() => {
    return servers
      .map(s => ({ server: s, emojis: ((s as any).emojis ?? []) as CustomEmoji[] }))
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

  function selectEmoji(native: string, id: string) {
    const nf = [id, ...frequent.filter(f => f !== id)].slice(0, 36);
    setFrequent(nf);
    saveArr(FREQ_KEY, nf);
    onSelect(native);
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
    background: "var(--bg-2)",
  };

  const emojiBtn: React.CSSProperties = {
    width: 36, height: 36, padding: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "none", border: "1px solid transparent",
    borderRadius: "6px", cursor: "pointer", fontSize: "22px", lineHeight: 1,
    transition: "background 80ms, border-color 80ms",
  };

  function renderEmojiCell(emojiId: string, native: string) {
    const normId = normalizeEmojiId(emojiId, native);
    return (
      <button
        key={emojiId}
        style={emojiBtn}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-3)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          hoverEmoji(normId, native);
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          hoverEmoji("");
        }}
        onMouseDown={e => { e.preventDefault(); selectEmoji(native, emojiId); }}
        title={`:${normId}:`}
      >
        {renderEmoji(userSettings, native)}
      </button>
    );
  }

  function renderCustomCell(e: CustomEmoji) {
    return (
      <button
        key={e.id}
        style={emojiBtn}
        onMouseEnter={ev => {
          (ev.currentTarget as HTMLElement).style.background = "var(--bg-3)";
          (ev.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          hoverEmoji(e.name);
        }}
        onMouseLeave={ev => {
          (ev.currentTarget as HTMLElement).style.background = "none";
          (ev.currentTarget as HTMLElement).style.borderColor = "transparent";
          hoverEmoji("");
        }}
        onMouseDown={ev => { ev.preventDefault(); onSelectCustomEmoji?.(e.name, e.id); }}
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
    customEmojis?: CustomEmoji[],
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
            if (!e) return null;
            return renderEmojiCell(eid, e.skins[0].native);
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
        onClick={() => {
          if (onSelectGif) onSelectGif(gif.url, gif.preview);
          else onSelect(gif.url);
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
          title={isFav ? "Remove from favorites" : "Add to favorites"}
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
    transition: "opacity 100ms, background 100ms",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", boxSizing: "border-box",
    background: "var(--bg-1)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "6px 10px",
    color: "var(--text-1)", fontSize: "13px",
    outline: "none",
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
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex", flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "color-mix(in hsl, var(--bg-3), transparent 25%)",
      }}>
        {(["gif", "emoji", "kaomoji"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "9px 0",
            background: "none", border: "none",
            borderBottom: `2px solid ${tab === t ? "var(--accent-1)" : "transparent"}`,
            color: tab === t ? "var(--text-1)" : "var(--text-4)",
            cursor: "pointer", fontSize: "12px", fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            transition: "color 150ms, border-color 150ms",
          }}>
            <span style={{ fontSize: 14 }}>
              {t === "gif" ? "🎞" : t === "emoji" ? "😀" : "ᴥ"}
            </span>
            <span>{t === "gif" ? "GIF" : t === "emoji" ? "Emoji" : "Kaomoji"}</span>
          </button>
        ))}
      </div>

      {tab === "emoji" && (
        <>
          <div style={{ padding: "8px 10px 6px", flexShrink: 0 }}>
            <input
              ref={emojiInputRef}
              placeholder="Search emojis..."
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
              borderBottom: "1px solid var(--border)",
            }}>
              {favorites.length > 0 && (
                <button style={navBtnStyle(activeCat === "favorites")} title="Favorites"
                  onClick={() => scrollToCategory("favorites")}>⭐</button>
              )}
              {frequent.length > 0 && (
                <button style={navBtnStyle(activeCat === "frequent")} title="Frequently Used"
                  onClick={() => scrollToCategory("frequent")}>🕐</button>
              )}
              {serverGroups.map(({ server }) => (
                <button key={server.id} style={navBtnStyle(activeCat === `server:${server.id}`)}
                  title={server.name} onClick={() => scrollToCategory(`server:${server.id}`)}>
                  {(server as any).icon
                    ? <img src={(server as any).icon}
                        style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} alt="" />
                    : <span style={{ fontSize: "11px", fontWeight: 700 }}>{server.name[0]}</span>
                  }
                </button>
              ))}
              
              {serverGroups.length > 0 && (
                <div style={{
                  width: 1, height: 20, background: "var(--border)",
                  flexShrink: 0, margin: "0 2px",
                }} />
              )}
              {stdCats.map(cat => {
                const meta = CATEGORY_META[cat.id];
                if (!meta) return null;
                return (
                  <button key={cat.id} style={navBtnStyle(activeCat === cat.id)}
                    title={meta.label} onClick={() => scrollToCategory(cat.id)}>
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
                <div style={sectionHeader}>Search Results</div>
                {searchResults.length === 0
                  ? <div style={{ padding: "24px 0", textAlign: "center", color: "var(--text-5)", fontSize: "13px" }}>
                      No emojis found for "{emojiSearch}"
                    </div>
                  : <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 36px)", gap: "2px", padding: "0 12px 8px" }}>
                      {searchResults.map(e =>
                        e._src === "custom"
                          ? renderCustomCell(e as CustomEmoji)
                          : renderEmojiCell(e.id as string, e.skins?.[0]?.native ?? ""),
                      )}
                    </div>
                }
              </div>
            ) : (
              <>
                {favorites.length > 0 &&
                  renderSection("favorites", "⭐ Favorites", favorites.filter(id => (data as any).emojis[id]))}
                {frequent.length > 0 &&
                  renderSection("frequent", "🕐 Frequently Used", frequent.filter(id => (data as any).emojis[id]))}
                {serverGroups.map(({ server, emojis }) =>
                  renderSection(`server:${server.id}`, server.name, undefined, emojis))}
                {stdCats.map(cat =>
                  renderSection(cat.id, CATEGORY_META[cat.id]?.label ?? cat.id, cat.emojis))}
              </>
            )}
          </div>

          <div style={{
            flexShrink: 0, height: 34,
            borderTop: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 8,
            padding: "0 12px",
            background: "color-mix(in hsl, var(--bg-3), transparent 25%)",
          }}>
            <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>
              {hoveredNative
                ? renderEmoji(userSettings, hoveredNative)
                : <span style={{ opacity: 0.3 }}>😀</span>
              }
            </span>
            <span style={{
              fontSize: "12px", fontFamily: "monospace",
              color: hoveredName ? "var(--text-3)" : "var(--text-5)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {hoveredName ? `:${hoveredName}:` : "Hover over an emoji…"}
            </span>
          </div>
        </>
      )}

      {tab === "gif" && (
        <>
          <div style={{ padding: "8px 10px 6px", flexShrink: 0 }}>
            <input
              ref={gifInputRef}
              placeholder="Search GIFs via Tenor…"
              value={gifSearch}
              onChange={e => setGifSearch(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
            {!TENOR_KEY ? (
              <div style={{ padding: "28px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "28px", marginBottom: 8 }}>🎞</div>
                <div style={{ color: "var(--text-3)", fontSize: "13px", marginBottom: 6 }}>GIFs not configured</div>
                <div style={{ color: "var(--text-5)", fontSize: "12px" }}>
                  Add <code style={{ background: "var(--bg-1)", borderRadius: 4, padding: "1px 5px", border: "1px solid var(--border)" }}>VITE_TENOR_API_KEY</code> to your <code style={{ background: "var(--bg-1)", borderRadius: 4, padding: "1px 5px", border: "1px solid var(--border)" }}>.env</code> file.
                </div>
              </div>
            ) : (
              <>
                {gifFavs.length > 0 && (
                  <>
                    <div style={sectionHeader}>⭐ Favorites</div>
                    <div style={{ columns: 2, columnGap: 4, padding: "0 8px 4px" }}>
                      {gifFavs.map(gif => renderGifCell(gif))}
                    </div>
                  </>
                )}
                <div style={sectionHeader}>{gifSearch ? "Search Results" : "🔥 Trending"}</div>
                {gifLoading && (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-5)", fontSize: "13px" }}>
                    Loading…
                  </div>
                )}
                {!gifLoading && gifResults.length === 0 && gifSearch && (
                  <div style={{ padding: "20px", textAlign: "center", color: "var(--text-5)", fontSize: "13px" }}>
                    No GIFs found for "{gifSearch}"
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
            <div key={cat.label}>
              <div style={sectionHeader}>{cat.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", padding: "2px 10px 8px" }}>
                {cat.items.map(k => (
                  <button
                    key={k}
                    onMouseDown={e => { e.preventDefault(); onSelect(k); }}
                    title={`Insert ${k}`}
                    style={{
                      background: "var(--bg-3)", border: "1px solid var(--border)",
                      borderRadius: "6px", padding: "4px 8px",
                      color: "var(--text-2)", cursor: "pointer", fontSize: "13px",
                      whiteSpace: "nowrap", transition: "background 80ms",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-4)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-3)"; }}
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
