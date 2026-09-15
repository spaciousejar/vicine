const BASE_URL = "https://api.hicine.sbs"

export type ContentType =
  "movies" | "anime" | "series" | "bolly_movies" | "bolly_series"

export const CONTENT_TYPES: ContentType[] = [
  "movies",
  "anime",
  "series",
  "bolly_movies",
  "bolly_series",
]

// Raw API types
export interface MediaItem {
  _id: string
  record_id: number
  title: string
  featured_image: string | null
  poster: string | null
  categories: string | null
  status: string
  url_slug: string
  links: string | null
  content: string | null
  date: string
  modified_date: string
  excerpt: string | null
  cloudlinks: string | null
  // Authoritative catalog from the API (trending/search/recent); absent on
  // the per-catalog list endpoints.
  contentType?: string
  // seasons only for anime/series (up to 15 + zip)
  season_1?: string | null
  season_2?: string | null
  season_3?: string | null
  season_4?: string | null
  season_5?: string | null
  season_6?: string | null
  season_7?: string | null
  season_8?: string | null
  season_9?: string | null
  season_10?: string | null
  season_11?: string | null
  season_12?: string | null
  season_13?: string | null
  season_14?: string | null
  season_15?: string | null
  season_zip?: string | null
  [key: string]: unknown
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ApiResponse {
  data: MediaItem[]
  pagination: Pagination
}

// Parsed helpers
export interface ParsedLink {
  url: string
  label: string
  size?: string
}

export interface ParsedEpisode {
  episode: number
  links: { quality: string; url: string }[]
  raw: string
}

export interface ParsedSeason {
  season: number
  title: string
  episodes: ParsedEpisode[]
}

export function getImage(item: MediaItem): string | null {
  return item.featured_image || item.poster || null
}

export function getCategories(item: MediaItem): string[] {
  if (!item.categories) return []
  return item.categories
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
}

/**
 * Remap category labels for display. The API sometimes tags genuine anime as
 * "Hollywood Series"; correct that only when the item really is anime (via
 * getContentType, which trusts the API's contentType field), so hollywood
 * anime-dubbed titles keep their own labels.
 */
const CATEGORY_REMAP: Record<string, string> = {
  "Hollywood Series": "Anime Series",
}

export function getDisplayCategories(item: MediaItem): string[] {
  const cats = getCategories(item)
  if (getContentType(item) !== "anime") return cats
  // Dedupe: anime items often carry "Anime Series" alongside the remapped
  // "Hollywood Series", which would otherwise show the label twice.
  return [...new Set(cats.map((c) => CATEGORY_REMAP[c] ?? c))]
}

export function getYear(item: MediaItem): string | null {
  const cats = getCategories(item)
  const year = cats.find((c) => /^\d{4}$/.test(c))
  return year ?? null
}

export function parseMovieLinks(links: string | null): ParsedLink[] {
  if (!links) return []
  return links
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // format: https://... , Label, size
      const urlMatch = line.match(/(https?:\/\/\S+)/)
      const url = urlMatch ? urlMatch[1].replace(/,+$/, "") : line
      const rest = line.replace(url, "").replace(/^,+/, "").trim()
      // rest like " Link2, Link3 ... Label [300MB], 300MB" — take last meaningful label
      const parts = rest
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
      const isQualityLabel = (p: string) => /(?:\d+p\b|\d+p\])/i.test(p)
      const label =
        [...parts].reverse().find((p) => isQualityLabel(p)) ??
        [...parts].reverse().find((p) => p.length > 10) ??
        parts[0] ??
        "Watch"
      const sizeMatch = line.match(/\[([^\]]+)\]/)
      return {
        url: url.replace(/,$/, ""),
        label: label || "Watch",
        size: sizeMatch ? sizeMatch[1] : undefined,
      }
    })
    .filter((l) => l.url.startsWith("http"))
}

export function parseSeasonString(
  raw: string | null,
  seasonNum: number
): ParsedSeason | null {
  if (!raw) return null
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return null
  const title = lines[0]
  const episodeLines = lines.slice(1)
  const episodes: ParsedEpisode[] = []

  for (const line of episodeLines) {
    const epMatch = line.match(/Episode\s+(\d+)\s*:/i)
    if (!epMatch) continue
    const epNum = parseInt(epMatch[1], 10)
    const afterColon = line.slice(line.indexOf(":") + 1)
    const tokens = afterColon
      .split(",,")
      .map((c) => c.trim())
      .filter(Boolean)

    // Format: URL1,,Q2 : URL2,,Q3 : URL3,,Qn — each quality label after
    // the ",," belongs to the PREVIOUS url; a bare trailing quality
    // closes the last one. Some sources instead prefix the quality
    // ("480p : URL"), which is handled too.
    const links: { quality: string; url: string }[] = []
    let pendingUrl: string | null = null
    const pushLink = (url: string | null, quality: string) => {
      if (!url) return
      links.push({ quality: quality || "auto", url })
    }
    for (const tok of tokens) {
      const urlMatch = tok.match(/(https?:\/\/[^\s,]+)/)
      const qualityMatch = tok.match(/\b(\d{3,4}p)\b/i)
      if (urlMatch) {
        if (pendingUrl) {
          // The leading quality (if any) describes the pending URL.
          pushLink(pendingUrl, qualityMatch?.[1] ?? "")
        } else if (qualityMatch) {
          // Quality prefixed in the same token ("480p : URL").
          pushLink(urlMatch[1], qualityMatch[1])
        }
        pendingUrl = qualityMatch && !pendingUrl ? null : urlMatch[1]
      } else {
        // Pure quality token closes the pending URL.
        pushLink(pendingUrl, qualityMatch?.[1] ?? "")
        pendingUrl = null
      }
    }
    pushLink(pendingUrl, "")

    if (links.length > 0) {
      episodes.push({ episode: epNum, links, raw: line })
    }
  }

  return { season: seasonNum, title, episodes }
}

export function getSeasons(item: MediaItem): ParsedSeason[] {
  const seasons: ParsedSeason[] = []
  for (let i = 1; i <= 15; i++) {
    const key = `season_${i}` as keyof MediaItem
    const raw = item[key] as string | null | undefined
    const parsed = parseSeasonString(raw ?? null, i)
    if (parsed && parsed.episodes.length > 0) seasons.push(parsed)
  }
  return seasons
}

export async function fetchApi(
  type: ContentType,
  page: number,
  limit: number
): Promise<ApiResponse> {
  const res = await fetch(
    `${BASE_URL}/api/${type}?page=${page}&limit=${limit}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) throw new Error(`Failed to fetch ${type}: ${res.status}`)
  return res.json()
}

export function fetchMovies(page = 1, limit = 20) {
  return fetchApi("movies", page, limit)
}
export function fetchAnime(page = 1, limit = 20) {
  return fetchApi("anime", page, limit)
}
export function fetchSeries(page = 1, limit = 20) {
  return fetchApi("series", page, limit)
}
export function fetchBollyMovies(page = 1, limit = 20) {
  return fetchApi("bolly_movies", page, limit)
}
export function fetchBollySeries(page = 1, limit = 20) {
  return fetchApi("bolly_series", page, limit)
}

// /api/trending and /api/recent return a bare array instead of { data }.
async function fetchBareList(
  path: "trending" | "recent",
  limit: number,
  revalidateSeconds: number
): Promise<MediaItem[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/${path}?page=1&limit=${limit}`, {
      next: { revalidate: revalidateSeconds },
    })
    if (!res.ok) return []
    const data: unknown = await res.json()
    const arr: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray((data as { data?: unknown[] })?.data)
        ? (data as { data: unknown[] }).data
        : []
    return arr.filter((d): d is MediaItem =>
      Boolean(d && (d as MediaItem).url_slug)
    )
  } catch {
    return []
  }
}

export function fetchTrending(limit = 12): Promise<MediaItem[]> {
  return fetchBareList("trending", limit, 600)
}

export function fetchRecent(limit = 12): Promise<MediaItem[]> {
  return fetchBareList("recent", limit, 300)
}

export async function searchContent(q: string): Promise<MediaItem[]> {
  const encoded = encodeURIComponent(q.trim()).replace(/%20/g, "+")
  const res = await fetch(`${BASE_URL}/api/search/${encoded}`, {
    next: { revalidate: 120 },
  })
  if (!res.ok) return []
  const data = await res.json()
  const arr: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : []
  return arr.filter((d): d is MediaItem =>
    Boolean(d && (d as MediaItem).url_slug)
  )
}

export async function fetchBySlug(
  slug: string
): Promise<{ item: MediaItem; type: ContentType } | null> {
  // Probe every catalog's dedicated /api/<type>/<slug> endpoint. All 5
  // probes run in parallel — a Bollywood title (bolly_movies/bolly_series)
  // previously fell through these three and 404'd on its watch page.
  const probes = await Promise.all(
    CONTENT_TYPES.map(async (type) => {
      try {
        const res = await fetch(`${BASE_URL}/api/${type}/${slug}`, {
          next: { revalidate: 300 },
        })
        if (!res.ok) return null
        const data = await res.json()
        // API may return { data: item } or { data: [item] }
        const item: MediaItem | undefined = Array.isArray(data.data)
          ? data.data[0]
          : (data.data ?? data)
        if (item && item.url_slug === slug) return { item, type }
      } catch {
        // ignore
      }
      return null
    })
  )
  for (const found of probes) {
    if (found) return found
  }

  // fallback: search by fetching pages (limited to first 3 pages x 100)
  for (const type of CONTENT_TYPES) {
    for (let page = 1; page <= 3; page++) {
      try {
        const res = await fetchApi(type, page, 100)
        const found = res.data.find((d) => d.url_slug === slug)
        if (found) return { item: found, type }
        if (res.data.length < 100) break
      } catch {
        break
      }
    }
  }

  // last resort: fresh entries often appear in /api/trending before the
  // per-type indexes and slug endpoints know about them
  try {
    const list = await fetchTrending(50)
    const found = list.find((d) => d.url_slug === slug)
    if (found) return { item: found, type: getContentType(found) }
  } catch {
    // ignore
  }

  return null
}

/**
 * Fetch items of the same type, excluding a specific slug. Used for the
 * "Related content" section on the watch page.
 */
export async function fetchRelated(
  type: ContentType,
  excludeSlug: string,
  limit = 6
): Promise<MediaItem[]> {
  try {
    const res = await fetchApi(type, 1, limit + 5) // fetch a few extra in case exclude is in first page
    return res.data
      .filter((item) => item.url_slug !== excludeSlug)
      .slice(0, limit)
  } catch {
    return []
  }
}

export function getContentTypeLabel(type: ContentType): string {
  switch (type) {
    case "movies":
      return "Movies"
    case "anime":
      return "Anime"
    case "series":
      return "Series"
    case "bolly_movies":
      return "Bollywood Movies"
    case "bolly_series":
      return "Bollywood Series"
  }
}

/** Map a ContentType to the front-end listing route path. */
export function getTypeRoute(type: ContentType): string {
  switch (type) {
    case "movies":
      return "/movies"
    case "anime":
      return "/anime"
    case "series":
      return "/series"
    case "bolly_movies":
      return "/bolly-movies"
    case "bolly_series":
      return "/bolly-series"
  }
}

function hasSeasonFields(item: MediaItem): boolean {
  for (let i = 1; i <= 15; i++) {
    if (item[`season_${i}` as keyof MediaItem]) return true
  }
  return false
}

function inferContentType(item: MediaItem): ContentType {
  const c = (item.categories ?? "").toLowerCase()
  if (c.includes("bollywood series")) return "bolly_series"
  if (c.includes("bollywood")) return "bolly_movies"
  // Genuine anime series: both "Anime Series" + season fields. Anime films
  // (in the movies catalog) lack seasons and stay "movies".
  if (c.includes("anime series") && hasSeasonFields(item)) return "anime"
  if (c.includes("hollywood series") || hasSeasonFields(item)) return "series"
  return "movies"
}

/**
 * Resolve the best content type for a MediaItem. Trusts the API's
 * `contentType` field when present (authoritative for trending/search/recent)
 * and falls back to category + season inference for list-endpoint items.
 */
export function getContentType(item: MediaItem): ContentType {
  const t = item.contentType
  if (t && (CONTENT_TYPES as readonly string[]).includes(t)) {
    return t as ContentType
  }
  return inferContentType(item)
}
