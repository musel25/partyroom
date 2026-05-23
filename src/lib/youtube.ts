const ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (ID_RE.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    return ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && ID_RE.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 2 && (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live")) {
      return ID_RE.test(parts[1]!) ? parts[1]! : null;
    }
  }

  return null;
}

export async function fetchOEmbed(videoId: string): Promise<{ title?: string; thumbnail?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { title?: string; thumbnail_url?: string };
    return { title: data.title, thumbnail: data.thumbnail_url };
  } catch {
    return {};
  }
}
