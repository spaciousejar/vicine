import { NextRequest, NextResponse } from "next/server"
import { searchContent, getContentType } from "@/lib/api"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || ""

  if (!q.trim()) {
    return NextResponse.json({ results: [] })
  }

  try {
    const items = await searchContent(q)
    const results = items.map((item) => ({
      ...item,
      inferredType: getContentType(item),
    }))
    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ error: "Search failed" }, { status: 500 })
  }
}
