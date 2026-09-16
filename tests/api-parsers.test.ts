import { describe, it, expect } from "bun:test"
import {
  getContentType,
  getDisplayCategories,
  parseMovieLinks,
  parseSeasonString,
  type MediaItem,
} from "../lib/api"

function item(partial: Partial<MediaItem>): MediaItem {
  return {
    _id: "x",
    record_id: 1,
    title: "t",
    featured_image: null,
    poster: null,
    categories: null,
    status: "publish",
    url_slug: "t",
    links: null,
    content: null,
    date: "",
    modified_date: "",
    excerpt: null,
    cloudlinks: null,
    ...partial,
  }
}

describe("parseMovieLinks", () => {
  it("parses a realistic link line: url, label with quality, size in brackets", () => {
    const links = parseMovieLinks(
      "https://polished-hall-486c.brandaq.workers.dev/?vcloud=https://vcloud.fit/m4meckfcf-ymxqg, Link2, Link3, Link7, Mahaprabhu Jagannath (2026) Hindi HDTC 480p x264 [330MB], 330MB"
    )
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe(
      "https://polished-hall-486c.brandaq.workers.dev/?vcloud=https://vcloud.fit/m4meckfcf-ymxqg"
    )
    expect(links[0].label).toBe(
      "Mahaprabhu Jagannath (2026) Hindi HDTC 480p x264 [330MB]"
    )
    expect(links[0].size).toBe("330MB")
  })

  it("falls back to Watch for a bare url line", () => {
    const links = parseMovieLinks("https://vcloud.fit/abc")
    expect(links).toHaveLength(1)
    expect(links[0].url).toBe("https://vcloud.fit/abc")
    expect(links[0].label).toBe("Watch")
    expect(links[0].size).toBeUndefined()
  })

  it("drops non-http lines and empty input", () => {
    expect(parseMovieLinks(null)).toEqual([])
    expect(parseMovieLinks("")).toEqual([])
    expect(parseMovieLinks("just text here")).toEqual([])
  })

  it("picks the quality-bearing label over filler tokens", () => {
    const links = parseMovieLinks(
      "https://vcloud.fit/x, Link2, Link3, Some Title 1080p [1.2GB], 1.2GB"
    )
    expect(links[0].label).toBe("Some Title 1080p [1.2GB]")
  })
})

describe("parseSeasonString", () => {
  const raw = [
    "MTV Hustle - Season 5 Hindi Full Indian Show",
    "Episode 1 : https://w.example/a,,480p : https://w.example/b,,720p : https://w.example/c,,1080p",
    "Episode 2 : https://w.example/d,,720p : https://w.example/e,,1080p",
  ].join("\n")

  it("parses episodes and maps each quality to the preceding url", () => {
    const s = parseSeasonString(raw, 5)!
    expect(s.season).toBe(5)
    expect(s.title).toBe("MTV Hustle - Season 5 Hindi Full Indian Show")
    expect(s.episodes).toHaveLength(2)
    expect(s.episodes[0].episode).toBe(1)
    expect(s.episodes[0].links).toEqual([
      { quality: "480p", url: "https://w.example/a" },
      { quality: "720p", url: "https://w.example/b" },
      { quality: "1080p", url: "https://w.example/c" },
    ])
    expect(s.episodes[1].links).toEqual([
      { quality: "720p", url: "https://w.example/d" },
      { quality: "1080p", url: "https://w.example/e" },
    ])
  })

  it("handles quality-prefixed urls in the same token", () => {
    const s = parseSeasonString(
      "Show\nEpisode 1 : 480p : https://w.example/a,,1080p",
      1
    )!
    expect(s.episodes[0].links).toEqual([
      { quality: "480p", url: "https://w.example/a" },
    ])
  })

  it("returns null for null/empty input and skips malformed lines", () => {
    expect(parseSeasonString(null, 1)).toBeNull()
    expect(parseSeasonString("", 1)).toBeNull()
    // Header-only input yields a season with no episodes (getSeasons filters it out).
    expect(parseSeasonString("Show", 1)).toEqual({
      season: 1,
      title: "Show",
      episodes: [],
    })
    const s = parseSeasonString("Show\nEpisode 1 : not a url", 1)
    expect(s && s.episodes).toEqual([])
  })

  it("assigns an auto quality when none is present", () => {
    const s = parseSeasonString("Show\nEpisode 1 : https://w.example/a", 1)!
    expect(s.episodes[0].links).toEqual([
      { quality: "auto", url: "https://w.example/a" },
    ])
  })
})

describe("getContentType", () => {
  it("trusts the API contentType field over category inference", () => {
    expect(
      getContentType(
        item({
          contentType: "bolly_movies",
          categories: "Bollywood Series,2026",
        })
      )
    ).toBe("bolly_movies")
    expect(
      getContentType(
        item({
          contentType: "movies",
          categories: "Hollywood,Anime Series,2026",
        })
      )
    ).toBe("movies")
  })

  it("infers bolly catalogs from categories when contentType is absent", () => {
    expect(getContentType(item({ categories: "Bollywood,Action,2026" }))).toBe(
      "bolly_movies"
    )
    expect(
      getContentType(
        item({ categories: "Bollywood Series,Reality-TV", season_5: "x" })
      )
    ).toBe("bolly_series")
  })

  it("keeps anime series in anime but anime films in movies", () => {
    expect(
      getContentType(
        item({
          categories: "Hollywood Series,Anime Series,Animation",
          season_1: "x",
        })
      )
    ).toBe("anime")
    expect(
      getContentType(
        item({ categories: "Hollywood,Anime Series,2026,Animation" })
      )
    ).toBe("movies")
  })

  it("infers hollywood series via seasons, else movies", () => {
    expect(
      getContentType(
        item({ categories: "Hollywood Series,2025", season_2: "x" })
      )
    ).toBe("series")
    expect(getContentType(item({ categories: "Hollywood,Action,2026" }))).toBe(
      "movies"
    )
  })
})

describe("getDisplayCategories", () => {
  it("remaps Hollywood Series to Anime Series and dedupes for genuine anime", () => {
    const cats = getDisplayCategories(
      item({
        categories: "Hollywood Series,1080p,Anime Series,Animation",
        season_1: "x",
      })
    )
    expect(cats).toContain("Anime Series")
    // dedupe — never show the label twice
    expect(cats.filter((c) => c === "Anime Series")).toHaveLength(1)
    expect(cats).not.toContain("Hollywood Series")
  })

  it("does not remap hollywood anime-dubbed titles", () => {
    const cats = getDisplayCategories(
      item({ categories: "Hollywood,Anime Series,1080p,Hindi Dubbed Movies" })
    )
    expect(cats).toContain("Hollywood")
    expect(cats).toContain("Anime Series")
  })
})
