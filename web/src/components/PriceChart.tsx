"use client";

import { useEffect, useRef } from "react";
import type { PricePoint } from "@/lib/arena";
import { fmtMon } from "@/lib/chain";

interface Props {
  data: PricePoint[];
  startPrice: bigint | null;
  height?: number;
}

/** Hand-rolled canvas price chart — no chart-lib weight, full control. */
export function PriceChart({ data, startPrice, height = 260 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = wrap.clientWidth;
      const h = height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const pts = data;
      const padL = 8;
      const padR = 64;
      const padT = 12;
      const padB = 22;
      const iw = w - padL - padR;
      const ih = h - padT - padB;

      if (pts.length === 0) {
        ctx.fillStyle = "#5c665c";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillText("waiting for price ticks…", padL + 8, padT + 20);
        return;
      }

      let min = pts[0].price;
      let max = pts[0].price;
      for (const p of pts) {
        if (p.price < min) min = p.price;
        if (p.price > max) max = p.price;
      }
      if (startPrice !== null) {
        if (startPrice < min) min = startPrice;
        if (startPrice > max) max = startPrice;
      }
      const span = max - min || 10n ** 16n;
      const pad = span / 8n;
      min -= pad;
      max += pad;

      const X = (i: number) =>
        padL + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
      const Y = (v: bigint) =>
        padT + ih - (Number(((v - min) * 10n ** 18n) / (max - min)) / 1e18) * ih;

      // gridlines + price labels
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#5c665c";
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g++) {
        const v = min + ((max - min) * BigInt(g)) / 4n;
        const y = Math.round(Y(v)) + 0.5;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(fmtMon(v), w - padR + 8, y + 3);
      }

      // round-open reference line
      if (startPrice !== null) {
        const y = Math.round(Y(startPrice)) + 0.5;
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#98a196";
        ctx.fillText("open", w - padR + 8, y - 5);
      }

      // time labels
      const t0 = pts[0].t;
      const t1 = pts[pts.length - 1].t;
      const fmtT = (t: number) =>
        new Date(t * 1000).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      ctx.fillStyle = "#5c665c";
      ctx.fillText(fmtT(t0), padL, h - 6);
      const mid = fmtT(t0 + Math.floor((t1 - t0) / 2));
      ctx.fillText(mid, padL + iw / 2 - 20, h - 6);
      ctx.fillText(fmtT(t1), padL + iw - 44, h - 6);

      // area fill
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
      grad.addColorStop(0, "rgba(163,230,53,0.14)");
      grad.addColorStop(1, "rgba(163,230,53,0)");
      ctx.beginPath();
      pts.forEach((p, i) => {
        const x = X(i);
        const y = Y(p.price);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#a3e635";
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.lineTo(X(pts.length - 1), padT + ih);
      ctx.lineTo(X(0), padT + ih);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // last-price dot
      const lx = X(pts.length - 1);
      const ly = Y(pts[pts.length - 1].price);
      ctx.beginPath();
      ctx.arc(lx, ly, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(163,230,53,0.25)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#a3e635";
      ctx.fill();
    };

    drawRef.current = draw;
    draw();
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => drawRef.current());
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [data, height, startPrice]);

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="block w-full" style={{ height }} />
    </div>
  );
}
