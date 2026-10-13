import { db } from "@88/db";
import { deleteSnapshot, saveSnapshot } from "@/app/actions/funnel";
import { ConfirmButton } from "@/components/confirm-button";
import { SuperfanCalculator } from "@/components/superfan-calculator";
import { Empty, PageHeader, Section } from "@/components/ui";
import { fmt, today } from "@/lib/dates";
import { SubmitButton } from "@/components/submit-button";
import { num, pct } from "@/lib/labels";

export const dynamic = "force-dynamic";

function Delta({ now, prev }: { now: number; prev?: number }) {
  if (prev === undefined || prev === 0) return null;
  const d = (now - prev) / prev;
  return (
    <span className={`ml-1 text-[10px] font-bold ${d >= 0 ? "text-ultra" : "text-orange"}`}>
      {d >= 0 ? "+" : ""}
      {pct(d)}
    </span>
  );
}

export default async function FanFunnelPage() {
  const snapshots = await db.fanSnapshot.findMany({ orderBy: { month: "desc" } });
  const latest = snapshots[0];
  const thisMonth = today().toISOString().slice(0, 7);

  return (
    <>
      <PageHeader tag="Fan Funnel" title="Superfans" />

      <Section title="Calculadora">
        <SuperfanCalculator initialListeners={latest?.monthlyListeners ?? 0} />
      </Section>

      <Section title="Snapshots mensuales">
        {snapshots.length === 0 ? (
          <Empty>Cargá el primer snapshot con los números de este mes.</Empty>
        ) : (
          <div className="mb-4 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="text-right">Oyentes</th>
                  <th className="text-right">Seguidores</th>
                  <th className="text-right">Mails</th>
                  <th className="text-right">Superfans</th>
                  <th className="text-right">Conversión</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => {
                  const prev = snapshots[i + 1];
                  return (
                    <tr key={s.id}>
                      <td className="capitalize">{fmt.month(s.month)}</td>
                      <td className="text-right tabular-nums">
                        {num(s.monthlyListeners)}
                        <Delta now={s.monthlyListeners} prev={prev?.monthlyListeners} />
                      </td>
                      <td className="text-right tabular-nums">
                        {num(s.followers)}
                        <Delta now={s.followers} prev={prev?.followers} />
                      </td>
                      <td className="text-right tabular-nums">
                        {num(s.emailSubs)}
                        <Delta now={s.emailSubs} prev={prev?.emailSubs} />
                      </td>
                      <td className="text-right tabular-nums">
                        {num(s.superfans)}
                        <Delta now={s.superfans} prev={prev?.superfans} />
                      </td>
                      <td className="text-right tabular-nums">
                        {s.monthlyListeners ? pct(s.superfans / s.monthlyListeners) : "—"}
                      </td>
                      <td>
                        <form action={deleteSnapshot}>
                          <input type="hidden" name="id" value={s.id} />
                          <ConfirmButton message="¿Borrar este snapshot?">Borrar</ConfirmButton>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <form action={saveSnapshot} className="box grid gap-3 p-4 md:grid-cols-6 md:items-end">
          <label className="field">
            Mes
            <input type="month" name="month" required defaultValue={thisMonth} className="input" />
          </label>
          <label className="field">
            Oyentes mensuales
            <input name="monthlyListeners" inputMode="numeric" required className="input" />
          </label>
          <label className="field">
            Seguidores
            <input name="followers" inputMode="numeric" className="input" />
          </label>
          <label className="field">
            Mails
            <input name="emailSubs" inputMode="numeric" className="input" />
          </label>
          <label className="field">
            Superfans
            <input name="superfans" inputMode="numeric" className="input" />
          </label>
          <SubmitButton className="btn btn-primary" pendingText="Guardando…">Guardar mes</SubmitButton>
          <p className="text-xs text-mute md:col-span-6">Si el mes ya existe, se actualiza.</p>
        </form>
      </Section>
    </>
  );
}
