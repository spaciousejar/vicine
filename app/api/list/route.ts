import { NextRequest, NextResponse } from "next/server"
import { fetchApi, searchContent, CONTENT_TYPES } from "@/lib/api"

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const type = sp.get("type") || "movies"
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1)
  const limit = Math.min(
    60,
    Math.max(1, parseInt(sp.get("limit") || "24", 10) || 24)
  )
  const q = sp.get("q") || ""

  if (!CONTENT_TYPES.includes(type as (typeof CONTENT_TYPES)[number])) {
    return NextResponse.json({ error: "Unknown type" }, { status: 400 })
  }

  try {
    if (q.trim()) {
      const items = await searchContent(q)
      return NextResponse.json({
        data: items,
        pagination: { page: 1, limit, total: items.length, pages: 1 },
      })
    }

    const res = await fetchApi(
      type as (typeof CONTENT_TYPES)[number],
      page,
      limit
    )
    return NextResponse.json(res)
  } catch {
    return NextResponse.json(
      { error: "Failed to load titles" },
      { status: 500 }
    )
  }
}
