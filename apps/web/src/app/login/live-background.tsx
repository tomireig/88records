"use client";

import { useEffect, useRef } from "react";

/**
 * Fondo vivo del login: dos haces de luz (naranja y ultramarino) que respiran despacio
 * sobre la base oscura, con un grano fino. Canvas 2D a baja resolución: liviano y a 60 fps.
 * Con prefers-reduced-motion queda quieto.
 */
export function LiveBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SCALE = 0.35; // se dibuja chico y el navegador lo escala: la luz es difusa, no hace falta más
    let raf = 0;

    const resize = () => {
      canvas.width = Math.max(1, Math.floor(window.innerWidth * SCALE));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * SCALE));
    };
    resize();
    window.addEventListener("resize", resize);

    const beam = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color.replace("A", String(alpha)));
      g.addColorStop(1, color.replace("A", "0"));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const s = t / 1000;
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#08090c";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      beam(w * (0.28 + 0.07 * Math.sin(s * 0.21)), h * (0.32 + 0.08 * Math.cos(s * 0.17)), Math.max(w, h) * 0.55, "rgba(30,30,230,A)", 0.42);
      beam(w * (0.74 + 0.06 * Math.cos(s * 0.19)), h * (0.7 + 0.07 * Math.sin(s * 0.23)), Math.max(w, h) * 0.45, "rgba(255,77,0,A)", 0.26);
      beam(w * (0.55 + 0.1 * Math.sin(s * 0.13)), h * (0.15 + 0.05 * Math.sin(s * 0.29)), Math.max(w, h) * 0.3, "rgba(112,112,255,A)", 0.12);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <>
      <canvas ref={ref} aria-hidden className="absolute inset-0 size-full blur-2xl" />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </>
  );
}
