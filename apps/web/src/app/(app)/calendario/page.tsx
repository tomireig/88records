import type { Metadata } from "next";
import { CalendarBoard } from "@/components/calendar/board";
import { requireSession } from "@/lib/auth";
import { listAccounts, listPosts, listProposals, listVideos } from "@/lib/data";
import { atLocal, dayKey, weekStart } from "@/lib/when";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ vista?: string; desde?: string }> }) {
  const { org } = await requireSession();
  const tz = org.timezone;
  const sp = await searchParams;
  const view = sp.vista === "mes" ? "month" : "week";
  const anchor = sp.desde && /^\d{4}-\d{2}-\d{2}$/.test(sp.desde) ? atLocal(sp.desde, "12:00", tz) : new Date();

  let start: Date;
  let days: number;
  if (view === "month") {
    const first = atLocal(`${dayKey(anchor, tz).slice(0, 7)}-01`, "12:00", tz);
    start = weekStart(first, tz);
    days = 42;
  } else {
    start = weekStart(anchor, tz);
    days = 7;
  }
  const end = new Date(start.getTime() + days * 24 * 3600_000 + 2 * 3600_000);

  const [accounts, posts, proposals, videos] = await Promise.all([
    listAccounts(org.id, tz),
    listPosts(org.id, start, end),
    listProposals(org.id, start, end),
    listVideos(org.id),
  ]);

  return (
    <CalendarBoard
      key={`${view}-${start.toISOString()}`}
      tz={tz}
      view={view}
      start={start.toISOString()}
      anchorDay={dayKey(anchor, tz)}
      days={days}
      accounts={accounts}
      posts={posts}
      proposals={proposals}
      videos={videos.filter((v) => v.status !== "failed")}
    />
  );
}
