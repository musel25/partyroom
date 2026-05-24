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

export type VideoMeta = {
  title?: string;
  thumbnail?: string;
  author?: string;
};

export async function fetchOEmbed(videoId: string): Promise<VideoMeta> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };
    return {
      title: data.title,
      thumbnail: data.thumbnail_url,
      author: data.author_name,
    };
  } catch {
    return {};
  }
}

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  thumbnail: string;
  author: string;
};

/**
 * Search YouTube via Data API v3. Returns up to `limit` videos.
 * Each call costs 100 quota units (default daily quota is 10,000 = 100 searches).
 */
export async function searchYouTube(
  q: string,
  apiKey: string,
  limit: number = 8,
): Promise<YouTubeSearchResult[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(limit));
  url.searchParams.set("q", q);
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new Error(`YouTube search failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
      };
    }>;
  };

  const items: YouTubeSearchResult[] = [];
  for (const item of data.items ?? []) {
    const videoId = item.id?.videoId;
    const title = item.snippet?.title;
    const author = item.snippet?.channelTitle;
    const thumbnail =
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.default?.url;
    if (videoId && title && author && thumbnail) {
      items.push({ videoId, title, thumbnail, author });
    }
  }
  return items;
}
