import type { Metadata } from "next";
import { LibraryView } from "@/components/library/library-view";
import { requireSession } from "@/lib/auth";
import { listAccounts, listArtists, listVideos } from "@/lib/data";

export const metadata: Metadata = { title: "Biblioteca" };

export default async function LibraryPage() {
  const { org } = await requireSession();
  const [videos, accounts, artists] = await Promise.all([listVideos(org.id), listAccounts(org.id, org.timezone), listArtists(org.id)]);
  return <LibraryView tz={org.timezone} videos={videos} accounts={accounts} artists={artists} />;
}
