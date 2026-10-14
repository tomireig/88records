import { notFound } from "next/navigation";
import { ReleaseView } from "@/components/releases/release-view";
import { requireSession } from "@/lib/auth";
import { getRelease } from "@/lib/data";

export default async function ReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { org } = await requireSession();
  const release = await getRelease(org.id, (await params).id);
  if (!release) notFound();
  return <ReleaseView release={release} tz={org.timezone} />;
}
