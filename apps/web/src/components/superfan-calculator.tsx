"use client";

import { useState } from "react";

const VALUE_PER_SUPERFAN = 52; // USD por año

const nf = new Intl.NumberFormat("es-AR");
const usd = new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function SuperfanCalculator({ initialListeners }: { initialListeners: number }) {
  const [listeners, setListeners] = useState(initialListeners || 10000);
  const [rate, setRate] = useState(2);

  const superfans = Math.round(listeners * (rate / 100));
  const yearly = superfans * VALUE_PER_SUPERFAN;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="box grid content-start gap-4 p-4">
        <label className="field">
          Oyentes mensuales
          <input
            inputMode="numeric"
            value={nf.format(listeners)}
            onChange={(e) => setListeners(Number(e.target.value.replace(/\D/g, "")) || 0)}
            className="input text-lg font-bold tabular-nums"
          />
        </label>
        <label className="field">
          Conversión a superfan: {rate.toFixed(1).replace(".", ",")}%
          <input
            type="range"
            min={1}
            max={3}
            step={0.1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="accent-orange"
          />
          <span className="flex justify-between font-normal normal-case tracking-normal text-mute">
            <span>1% conservador</span>
            <span>3% muy comprometido</span>
          </span>
        </label>
        <p className="text-xs text-mute">
          Un superfan deja unos USD {VALUE_PER_SUPERFAN} por año entre merch, shows, streams y directo. Es un promedio
          de industria, sirve para dimensionar, no para presupuestar.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="box p-4">
          <p className="tag text-mute">Superfans</p>
          <p className="mt-3 text-4xl font-bold tabular-nums">{nf.format(superfans)}</p>
        </div>
        <div className="box border-orange bg-orange p-4 text-paper">
          <p className="tag opacity-80">Por año</p>
          <p className="mt-3 text-4xl font-bold tabular-nums">{usd.format(yearly)}</p>
        </div>
        <div className="box col-span-2 p-4">
          <p className="tag text-mute">Por mes</p>
          <p className="mt-3 text-2xl font-bold tabular-nums">{usd.format(yearly / 12)}</p>
        </div>
      </div>
    </div>
  );
}
