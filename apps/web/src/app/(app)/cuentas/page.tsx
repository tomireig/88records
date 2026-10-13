import type { Metadata } from "next";
import { AccountsView } from "@/components/accounts/accounts-view";
import { requireSession } from "@/lib/auth";
import { listAccounts, listArtists } from "@/lib/data";

export const metadata: Metadata = { title: "Cuentas" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { org } = await requireSession();
  const [accounts, artists, sp] = await Promise.all([listAccounts(org.id, org.timezone), listArtists(org.id), searchParams]);
  return <AccountsView tz={org.timezone} accounts={accounts} artists={artists} flash={{ connected: sp.connected, error: sp.error, detail: sp.detail }} />;
}
