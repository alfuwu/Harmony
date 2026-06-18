import { useEffect, useState } from "react";
import { t, useLocale } from "../../../lib/i18n/Index";
import { TranslationKeys } from "../../../lib/i18n/Schema";
import { useShikiHighlighter } from "react-shiki";
import { userSettings } from "../../../lib/state/Auth";
import { Theme } from "../../../lib/utils/UserSettings";
import { HighlighterCore } from "shiki";
import { ensureLanguageLoaded, highlighterReady, superHighlighter } from "../../../lib/utils/MarkdownRenderer";
import { CloseIcon, CodeBracketsIcon } from "../../svgs/other/Icons";
import { BigJSON } from "../../../lib/utils/JSON";

interface Props {
  title?: TranslationKeys;
  data: unknown;
  onClose: () => void;
}

export default function RawViewModal({ title, data, onClose }: Props) {
  useLocale();
  const [copied, setCopied] = useState(false);
  const json = BigJSON.stringify(data, null, 2);

  const [hlInstance, setHlInstance] = useState<HighlighterCore | undefined>(superHighlighter);
  useEffect(() => {
    if (superHighlighter)
      return; // already ready at mount
    let alive = true;
    highlighterReady.then(() => {
      if (alive)
        setHlInstance(superHighlighter);
    });
    return () => { alive = false; };
  }, []);

  function copy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const [confirmedLang, setConfirmedLang] = useState<string>('text');
  
  useEffect(() => {
    let cancelled = false;
    setConfirmedLang('text');
    ensureLanguageLoaded('json').then(loaded => {
      if (!cancelled)
        setConfirmedLang(loaded ? 'json' : 'text');
    });
    return () => { cancelled = true; };
  }, [hlInstance]);

  const settings = userSettings();

  const light = settings?.theme === Theme.Light ||
      settings?.theme === Theme.System && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  
  const shikiTheme = light ? "github-light" : "github-dark";

  const highlighter = useShikiHighlighter(
    json,
    confirmedLang,
    shikiTheme,
    { highlighter: hlInstance }
  );

  return (
    <div className="modal-backdrop open" onClick={onClose}>
      <div
        className="modal-container"
        onClick={e => e.stopPropagation()}
        style={{
          width: 600,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          padding: 0,
          overflow: "hidden"
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0
        }}>
          <span className="uno" style={{ color: "var(--text-3)", marginRight: 12, display: "flex" }}>
            <CodeBracketsIcon />
          </span>
          <span className="uno" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-2)", flexGrow: 1 }}>
            {t(title ?? "json.raw_title")}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={copy}
              style={{
                padding: "4px 12px",
                fontSize: 12,
                background: copied
                  ? "color-mix(in hsl, var(--green-2), transparent 72%)"
                  : "var(--bg-2)",
                color: copied ? "var(--green-1)" : "var(--text-4)",
                border: `1px solid ${copied
                  ? "color-mix(in hsl, var(--green-2), transparent 45%)"
                  : "var(--button-border)"}`,
                borderRadius: 6
              }}
            >
              {copied ? t("copy") : t("json.copy")}
            </button>
            <button
              onClick={onClose}
              style={{
                width: 26, height: 26, padding: 0, borderRadius: 5, border: "none",
                background: "rgba(255,255,255,0.07)", color: "var(--text-4)",
                fontSize: 14, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
        <div className="raw-modal multiline-code">
          {highlighter ?? (
            <pre className={`shiki ${shikiTheme}`} tabIndex={0} style={{ backgroundColor: light ? "#fff" : "#24292e", color: light ? "#24292e" : "#e1e4e8" }}>
              <code>
                {json.split('\n').map((line, i) => <span key={i} className="line"><span>{line + '\n'}</span></span>)}
              </code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}