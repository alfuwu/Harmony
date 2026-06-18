export async function googleTranslate(
  text: string,
  targetLang: string,
  sourceLang = "auto"
): Promise<{ text: string, source: string }> {
  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Translate request failed: ${res.status}`);

  const json = await res.json();

  // response shape: [[[translatedChunk, originalChunk], ...], ...]
  const translated: string = (json[0] as [string, string][])
    .map(pair => pair[0] ?? "")
    .join("");

  return { text: translated, source: json[2] ?? "unkown" };
}
