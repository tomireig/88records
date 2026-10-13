import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-[68ch] px-5 py-12">
      <Link href="/" className="text-sm font-bold tracking-[-0.02em]">
        88RECORDS<sup className="ml-px text-[9px] font-medium text-fg-2">®</sup>
      </Link>
      <article className="mt-10 space-y-4 text-[15px] leading-7 text-fg-2 [&_h1]:mb-6 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:text-fg [&_h2]:mt-9 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </main>
  );
}
