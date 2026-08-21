const BASE_URL = "https://api.hicine.sbs";

export type ContentType = "movies" | "anime" | "series";

// Raw API types
export interface MediaItem {
  _id: string;
  record_id: number;
  title: string;
  featured_image: string | null;
  poster: string | null;
  categories: string | null;
  status: string;
  url_slug: string;
  links: string | null;
  content: string | null;
  date: string;
  modified_date: string;
  excerpt: string | null;
  cloudlinks: string | null;
  // seasons only for anime/series (up to 15 + zip)
  season_1?: string | null;
  season_2?: string | null;
  season_3?: string | null;
  season_4?: string | null;
  season_5?: string | null;
  season_6?: string | null;
  season_7?: string | null;
  season_8?: string | null;
  season_9?: string | null;
  season_10?: string | null;
  season_11?: string | null;
  season_12?: string | null;
  season_13?: string | null;
  season_14?: string | null;
  season_15?: string | null;
  season_zip?: string | null;
  [key: string]: unknown;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse {
  data: MediaItem[];
  pagination: Pagination;
}

// Parsed helpers
export interface ParsedLink {
  url: string;
  label: string;
  size?: string;
}

export interface ParsedEpisode {
  episode: number;
  links: { quality: string; url: string }[];
  raw: string;
}

export interface ParsedSeason {
  season: number;
  title: string;
  episodes: ParsedEpisode[];
}

export function getImage(item: MediaItem): string | null {
  return item.featured_image || item.poster || null;
}

export function getCategories(item: MediaItem): string[] {
  if (!item.categories) return [];
  return item.categories
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

export function getYear(item: MediaItem): string | null {
  const cats = getCategories(item);
  const year = cats.find((c) => /^\d{4}$/.test(c));
  return year ?? null;
}

export function parseMovieLinks(links: string | null): ParsedLink[] {
  if (!links) return [];
  return links
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // format: https://... , Label, size
      const urlMatch = line.match(/(https?:\/\/\S+)/);
      const url = urlMatch ? urlMatch[1].replace(/,+$/, "") : line;
      const rest = line.replace(url, "").replace(/^,+/, "").trim();
      // rest like " Link2, Link3 ... Label [300MB], 300MB" — take last meaningful label
      const parts = rest.split(",").map((p) => p.trim()).filter(Boolean);
      const label = parts.find((p) => p.includes("p ") || p.includes("p]") || p.length > 10) ?? parts[0] ?? "Watch";
      const sizeMatch = line.match(/\[([^\]]+)\]/);
      return {
        url: url.replace(/,$/, ""),
        label: label || "Watch",
        size: sizeMatch ? sizeMatch[1] : undefined,
      };
    })
    .filter((l) => l.url.startsWith("http"));
}

export function parseSeasonString(
  raw: string | null,
  seasonNum: number
): ParsedSeason | null {
  if (!raw) return null;
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  const title = lines[0];
  const episodeLines = lines.slice(1);
  const episodes: ParsedEpisode[] = [];

  for (const line of episodeLines) {
    const epMatch = line.match(/Episode\s+(\d+)\s*:/i);
    if (!epMatch) continue;
    const epNum = parseInt(epMatch[1], 10);
    const afterColon = line.slice(line.indexOf(":") + 1);
    // split by ,, -> each quality chunk
    const chunks = afterColon.split(",,").map((c) => c.trim()).filter(Boolean);
    const links: { quality: string; url: string }[] = [];
    for (const chunk of chunks) {
      const urlMatch = chunk.match(/(https?:\/\/\S+)/);
      if (!urlMatch) continue;
      const url = urlMatch[1].replace(/,+$/, "");
      // quality hint is either before URL or after
      const qualityMatch = chunk.match(/(480p|720p|1080p|2160p)/i);
      const quality = qualityMatch ? qualityMatch[1] : "auto";
      links.push({ quality, url });
    }
    if (links.length > 0) {
      episodes.push({ episode: epNum, links, raw: line });
    }
  }

  return { season: seasonNum, title, episodes };
}

export function getSeasons(item: MediaItem): ParsedSeason[] {
  const seasons: ParsedSeason[] = [];
  for (let i = 1; i <= 15; i++) {
    const key = `season_${i}` as keyof MediaItem;
    const raw = item[key] as string | null | undefined;
    const parsed = parseSeasonString(raw ?? null, i);
    if (parsed && parsed.episodes.length > 0) seasons.push(parsed);
  }
  return seasons;
}

async function fetchApi(
  type: ContentType,
  page: number,
  limit: number
): Promise<ApiResponse> {
  const res = await fetch(
    `${BASE_URL}/api/${type}?page=${page}&limit=${limit}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error(`Failed to fetch ${type}: ${res.status}`);
  return res.json();
}

export function fetchMovies(page = 1, limit = 20) {
  return fetchApi("movies", page, limit);
}
export function fetchAnime(page = 1, limit = 20) {
  return fetchApi("anime", page, limit);
}
export function fetchSeries(page = 1, limit = 20) {
  return fetchApi("series", page, limit);
}

export async function fetchBySlug(
  slug: string
): Promise<{ item: MediaItem; type: ContentType } | null> {
  // API has no direct slug endpoint — search via paginated fetch with large limit is not ideal
  // Instead try each type by fetching with search — fallback to scanning first pages
  // We use a parallel fetch of all types page 1 with limit 100 and look for slug match
  // For production, better to add a dedicated /api/<type>/<slug> if available — try it first
  for (const type of ["movies", "anime", "series"] as ContentType[]) {
    try {
      const res = await fetch(`${BASE_URL}/api/${type}/${slug}`, {
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const data = await res.json();
        // API may return { data: item } or { data: [item] }
        const item: MediaItem | undefined = Array.isArray(data.data)
          ? data.data[0]
          : data.data ?? data;
        if (item && item.url_slug === slug) return { item, type };
        if (item && item._id) return { item, type };
      }
    } catch {
      // ignore
    }
  }

  // fallback: search by fetching pages (limited to first 3 pages x 100)
  for (const type of ["movies", "anime", "series"] as ContentType[]) {
    for (let page = 1; page <= 3; page++) {
      try {
        const res = await fetchApi(type, page, 100);
        const found = res.data.find((d) => d.url_slug === slug);
        if (found) return { item: found, type };
        if (res.data.length < 100) break;
      } catch {
        break;
      }
    }
  }
  return null;
}

export function getContentTypeLabel(type: ContentType): string {
  return type === "movies" ? "Movies" : type === "anime" ? "Anime" : "Series";
}
