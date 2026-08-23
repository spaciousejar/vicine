import { describe, it, expect } from "bun:test"
import { createCueStreamParser } from "../lib/subtitles"

function collect() {
  const cues: { start: number; end: number; text: string }[] = []
  const parser = createCueStreamParser((c) => cues.push(c))
  return {
    cues,
    push: (s: string) => parser.push(s),
    end: () => parser.end(),
  }
}

describe("createCueStreamParser", () => {
  it("parses a complete cue delivered in a single chunk", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHello\n")
    end()
    expect(cues).toEqual([{ start: 1, end: 2, text: "Hello" }])
  })

  it("parses a cue split across two chunks mid-timestamp-line", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\n\n00:00:01.000 --> 00:")
    push("00:02.000\nSplit cue\n")
    end()
    expect(cues).toHaveLength(1)
    expect(cues[0].start).toBe(1)
    expect(cues[0].end).toBe(2)
    expect(cues[0].text).toBe("Split cue")
  })

  it("parses multiple cues arriving in one chunk", () => {
    const { cues, push, end } = collect()
    push(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nOne\n\n00:00:03.000 --> 00:00:04.000\nTwo\n"
    )
    end()
    expect(cues.map((c) => c.text)).toEqual(["One", "Two"])
  })

  it("handles CRLF line endings", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\r\n\r\n00:00:05.000 --> 00:00:06.000\r\nCRLF cue\r\n")
    end()
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe("CRLF cue")
  })

  it("parses hour-formatted timestamps", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\n\n01:02:03.500 --> 01:02:04.500\nHours\n")
    end()
    expect(cues[0].start).toBeCloseTo(3723.5)
    expect(cues[0].end).toBeCloseTo(3724.5)
  })

  it("ignores NOTE blocks", () => {
    const { cues, push, end } = collect()
    push(
      "WEBVTT\n\nNOTE this is a comment\n\n00:00:01.000 --> 00:00:02.000\nReal\n"
    )
    end()
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe("Real")
  })

  it("strips HTML-ish tags from cue text", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<c.Bold>Styled</c>\n")
    end()
    expect(cues[0].text).toBe("Styled")
  })

  it("skips cue blocks without text", () => {
    const { cues, push, end } = collect()
    push(
      "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n\n00:00:03.000 --> 00:00:04.000\nAfter empty\n"
    )
    end()
    expect(cues.map((c) => c.text)).toEqual(["After empty"])
  })

  it("holds a partial trailing block until end-of-stream flushes it", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nDone\n\n00:00:03.000 -->")
    // The blank-line-terminated "Done" cue is emitted; the partial timestamp
    // that follows is held, not guessed at.
    expect(cues).toHaveLength(1)
    push(" 00:00:04.000\nSecond\n")
    // Still held: a lone trailing newline is not a block terminator.
    expect(cues).toHaveLength(1)
    end()
    expect(cues).toHaveLength(2)
    expect(cues[1].text).toBe("Second")
  })

  it("joins a multi-line cue whose text lines span chunk boundaries", () => {
    // This is the case that requires end()-based flushing: eager emission on a
    // trailing newline would emit "Line 1" alone and drop "Line 2".
    const { cues, push, end } = collect()
    push("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nLine 1\n")
    push("Line 2\n")
    end()
    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe("Line 1\nLine 2")
  })

  it("flushes a final cue that has no trailing newline at all", () => {
    const { cues, push, end } = collect()
    push("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nNo newline")
    end()
    expect(cues).toEqual([{ start: 1, end: 2, text: "No newline" }])
  })

  it("end() on an empty or header-only stream emits nothing and is safe", () => {
    const { cues, push, end } = collect()
    end() // nothing pushed
    push("WEBVTT\n\n")
    end()
    end() // idempotent
    expect(cues).toEqual([])
  })
})
