"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const QUICK_FILTERS = ["1080p", "720p", "Dual Audio", "WEB-DL", "Hollywood", "Bollywood", "Anime Series", "Korean Series"];

function CategoryFilterInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = sp.get("q") ?? "";

  function toggle(value: string) {
    const params = new URLSearchParams(sp.toString());
    if (active.toLowerCase() === value.toLowerCase()) params.delete("q");
    else params.set("q", value);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function clear() {
    const params = new URLSearchParams(sp.toString());
    params.delete("q");
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {QUICK_FILTERS.map((f) => {
        const isActive = active.toLowerCase() === f.toLowerCase();
        return (
          <button key={f} onClick={() => toggle(f)} className="focus:outline-none">
            <Badge variant={isActive ? "default" : "secondary"} className={cn("cursor-pointer hover:opacity-80", isActive && "shadow-sm")}>
              {f}
            </Badge>
          </button>
        );
      })}
      {active && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-6 px-2 text-xs">
          Clear
        </Button>
      )}
    </div>
  );
}

export function CategoryFilter() {
  return (
    <Suspense fallback={<div className="h-6" />}>
      <CategoryFilterInner />
    </Suspense>
  );
}
