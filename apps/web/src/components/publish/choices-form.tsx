"use client";

import type { PrivacyLevel } from "@88/connectors/tiktok";
import { Check } from "lucide-react";
import { cn, Switch } from "../ui";

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: "Todo el mundo",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Solo yo",
};

export const MUSIC_USAGE_URL = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
export const BRANDED_POLICY_URL = "https://www.tiktok.com/legal/page/global/bc-policy/en";

export interface ChoicesState {
  privacyLevel: PrivacyLevel | null;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  disclose: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
}

/** Todo apagado y sin privacidad elegida: TikTok no permite valores por defecto. */
export const EMPTY_CHOICES: ChoicesState = {
  privacyLevel: null,
  allowComment: false,
  allowDuet: false,
  allowStitch: false,
  disclose: false,
  brandOrganic: false,
  brandContent: false,
};

export function choicesProblems(c: ChoicesState, direct: boolean): string[] {
  const p: string[] = [];
  if (direct && !c.privacyLevel) p.push("Elegí quién puede ver el video.");
  if (c.disclose && !c.brandOrganic && !c.brandContent) p.push("Marcá si es tu marca, contenido de marca o ambos.");
  if (direct && c.brandContent && c.privacyLevel === "SELF_ONLY") p.push("El contenido de marca no puede ser privado.");
  return p;
}

export function ChoicesForm({
  value,
  onChange,
  direct,
  allowed,
  locked,
}: {
  value: ChoicesState;
  onChange: (v: ChoicesState) => void;
  direct: boolean;
  allowed: PrivacyLevel[];
  locked: { comment: boolean; duet: boolean; stitch: boolean };
}) {
  const set = (patch: Partial<ChoicesState>) => onChange({ ...value, ...patch });
  const LOCKED_HINT = "Desactivado en la configuración de la cuenta";

  return (
    <div className="space-y-6">
      {direct && (
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-fg">¿Quién puede ver este video?</legend>
          {allowed.length === 0 ? (
            <p className="text-[13px] text-bad">TikTok no devolvió opciones de privacidad para esta cuenta. No se puede publicar ahora.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5" role="radiogroup">
              {allowed.map((p) => {
                const disabled = value.brandContent && p === "SELF_ONLY";
                const checked = value.privacyLevel === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    disabled={disabled}
                    title={disabled ? "El contenido de marca no puede ser privado" : undefined}
                    onClick={() => set({ privacyLevel: p })}
                    className={cn(
                      "flex h-10 items-center justify-between rounded-md border px-3 text-left text-[13px] transition-[border-color,background,box-shadow]",
                      checked ? "border-ultra-hi bg-ultra/15 text-fg shadow-[var(--glow-ultra)]" : "border-line-strong bg-ink-3 text-fg-2 hover:border-white/20 hover:text-fg",
                      disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {PRIVACY_LABELS[p]}
                    {checked && <Check className="size-4 text-ultra-hi" />}
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>
      )}

      {direct && (
        <fieldset className="divide-y divide-line rounded-md border border-line px-3">
          <legend className="sr-only">Permisos</legend>
          <Switch label="Permitir comentarios" checked={value.allowComment} onChange={(v) => set({ allowComment: v })} disabled={locked.comment} hint={locked.comment ? LOCKED_HINT : undefined} />
          <Switch label="Permitir dúo" checked={value.allowDuet} onChange={(v) => set({ allowDuet: v })} disabled={locked.duet} hint={locked.duet ? LOCKED_HINT : undefined} />
          <Switch label="Permitir stitch" checked={value.allowStitch} onChange={(v) => set({ allowStitch: v })} disabled={locked.stitch} hint={locked.stitch ? LOCKED_HINT : undefined} />
        </fieldset>
      )}

      <fieldset className="rounded-md border border-line px-3">
        <legend className="sr-only">Contenido comercial</legend>
        <Switch
          label="Divulgar contenido comercial"
          hint="Activalo si el video promociona una marca, un producto o un servicio."
          checked={value.disclose}
          onChange={(v) => set(v ? { disclose: true } : { disclose: false, brandOrganic: false, brandContent: false })}
        />
        {value.disclose && (
          <div className="space-y-1 border-t border-line py-3">
            <Check2 checked={value.brandOrganic} onChange={(v) => set({ brandOrganic: v })} label="Tu marca" hint="Promocionás tu propio trabajo, sello o negocio. Se etiqueta como «Contenido promocional»." />
            <Check2
              checked={value.brandContent}
              onChange={(v) => set({ brandContent: v, privacyLevel: v && value.privacyLevel === "SELF_ONLY" ? null : value.privacyLevel })}
              label="Contenido de marca"
              hint="Colaboración paga con un tercero. Se etiqueta como «Colaboración pagada»."
            />
          </div>
        )}
      </fieldset>
    </div>
  );
}

function Check2({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-white/[0.03]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[#ff4d00]" />
      <span>
        <span className="block text-[13px] text-fg">{label}</span>
        <span className="block text-xs text-fg-3">{hint}</span>
      </span>
    </label>
  );
}

export function ConsentText({ brandContent }: { brandContent: boolean }) {
  return (
    <p className="text-xs leading-5 text-fg-3">
      Al publicar, aceptás la{" "}
      <a href={MUSIC_USAGE_URL} target="_blank" rel="noreferrer" className="text-fg-2 underline hover:text-fg">
        Confirmación de uso de música
      </a>{" "}
      de TikTok
      {brandContent && (
        <>
          {" "}y su{" "}
          <a href={BRANDED_POLICY_URL} target="_blank" rel="noreferrer" className="text-fg-2 underline hover:text-fg">
            Política de contenido de marca
          </a>
        </>
      )}
      .
    </p>
  );
}
