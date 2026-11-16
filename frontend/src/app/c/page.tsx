"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicCalendar } from "@/lib/api";
import { loadPublicCalendar, SITE_MODE } from "@/lib/publicData";
import { useT } from "@/lib/i18n";
import { PublicCalendarView } from "@/components/public/PublicCalendarView";

function PublicPage() {
  const slug = useSearchParams().get("slug") ?? "";
  const { lang } = useT();
  const [data, setData] = useState<PublicCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    loadPublicCalendar(slug).then(
      (d) => {
        setData(d);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error && !data)
    return (
      <div className="glass mx-auto mt-24 max-w-md rounded-[2rem] p-8 text-center">
        <p className="text-lg font-medium">{lang === "fr" ? "Calendrier introuvable" : "Calendar not found"}</p>
        <p className="mt-2 text-sm text-muted">
          {lang === "fr" ? "Il n'est peut-être pas (encore) publié." : "It may not be published (yet)."}
        </p>
        <Link href="/" className="mt-5 inline-block text-accent-2 hover:underline">
          {lang === "fr" ? "Retour" : "Back"}
        </Link>
      </div>
    );
  if (!data)
    return (
      <div className="mx-auto mt-24 grid max-w-5xl grid-cols-4 gap-4 px-4 sm:grid-cols-8" aria-busy>
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="glass aspect-square animate-pulse rounded-3xl" />
        ))}
      </div>
    );

  return <PublicCalendarView data={data} uiLang={lang} isPreview={SITE_MODE === "studio"} onRefresh={refresh} />;
}

export default function PublicCalendarPage() {
  return (
    <Suspense>
      <PublicPage />
    </Suspense>
  );
}
