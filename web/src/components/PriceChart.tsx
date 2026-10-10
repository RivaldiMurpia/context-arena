"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedItem, PricePoint } from "@/lib/arena";
import { AGENTS, EXPLORER_TX, fmtMon } from "@/lib/chain";
import { AGENT_COLORS } from "./home/AgentMark";

type TradeItem = Extract<FeedItem, { kind: "trade" }>;

interface Props {
  data: PricePoint[];
  startPrice: bigint | null;
  trades?: TradeItem[];
  height?: number;
}

/** A BUY/SELL marker plotted over the price line. */
interface Marker {
  x: number;
  y: number;
  trade: TradeItem;
}

const BUY = "#a3e635";
const SELL = "#fb7185";

function markerRadius(t: TradeItem): number {
  const mon = Number(t.isBuy ? t.amountIn : t.amountOut) / 1e18;
  const rel = Math.min(1, mon / 40);
  return 3 + rel * 2.5;
}

/** Interpolated x for a unix timestamp across the price-point time range. */
function makeXForTime(pts: PricePoint[], padL: number, iw: number) {
  const t0 = pts[0].t;
  const t1 = pts[pts.length - 1].t;
  const span = Math.max(1, t1 - t0);
  return (t: number) =>
    padL + (Math.min(t1, Math.max(t0, t)) - t0) / span * iw;
}

/**
 * Hand-rolled canvas price chart — no chart-lib weight, full control.
 * Agent trades (from the same event scan that feeds the ActivityFeed) are
 * plotted as ▲ BUY / ▼ SELL markers colored per agent; hover a marker for
 * details, click to open the tx in the explorer.
 */
export function PriceChart({ data, startPrice, trades = [], height = 260 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef<() => void>(() => {});
  const markersRef = useRef<Marker[]>([]);
  const [hover, setHover] = useState<Marker | null>(null);
  const [pulse, setPulse] = useState<{ x: number; y: number; color: string } | null>(
    null
  );

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
        markersRef.current = [];
        setPulse(null);
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
      const xForTime = makeXForTime(pts, padL, iw);

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

      // agent trade markers — oldest first so the newest paints on top
      const markers: Marker[] = trades
        .filter((t) => pts.length > 1)
        .map((trade) => ({
          x: xForTime(trade.ts),
          y: Y(trade.price),
          trade,
        }));
      for (const m of markers) {
        const color = AGENT_COLORS[m.trade.agentId] ?? "#98a196";
        const r = markerRadius(m.trade);
        ctx.beginPath();
        ctx.moveTo(m.x, m.y + (m.trade.isBuy ? -r * 1.5 : r * 1.5));
        ctx.lineTo(m.x - r, m.y + (m.trade.isBuy ? r : -r));
        ctx.lineTo(m.x + r, m.y + (m.trade.isBuy ? r : -r));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      markersRef.current = markers;
      const last = markers[markers.length - 1];
      setPulse(
        last
          ? {
              x: last.x,
              y: last.y,
              color: AGENT_COLORS[last.trade.agentId] ?? "#98a196",
            }
          : null
      );
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
  }, [data, height, startPrice, trades]);

  const markerAt = (e: React.MouseEvent<HTMLCanvasElement>): Marker | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: Marker | null = null;
    let bestD = 14 * 14;
    for (const m of markersRef.current) {
      const d = (m.x - mx) ** 2 + (m.y - my) ** 2;
      if (d <= bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  };

  const trade = hover?.trade;
  const tipColor = trade ? AGENT_COLORS[trade.agentId] ?? "#98a196" : "";

  return (
    <div ref={wrapRef} className="relative w-full">
      <canvas
        ref={canvasRef}
        className="block w-full"
        style={{ height, cursor: hover ? "pointer" : "default" }}
        role="img"
        aria-label="CTX price chart with agent trade markers"
        onMouseMove={(e) => setHover(markerAt(e))}
        onMouseLeave={() => setHover(null)}
        onClick={() => {
          if (hover) window.open(EXPLORER_TX(hover.trade.tx), "_blank", "noreferrer");
        }}
      />
      {pulse && (
        <span
          className="marker-pulse pointer-events-none absolute rounded-full"
          style={{
            left: pulse.x,
            top: pulse.y,
            width: 22,
            height: 22,
            border: `1.5px solid ${pulse.color}`,
          }}
          aria-hidden
        />
      )}
      {trade && (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] rounded-lg border border-[rgba(255,255,255,0.14)] bg-[rgba(10,12,10,0.92)] px-3 py-2 text-[11px] shadow-lg"
          style={{
            left: Math.min(Math.max(hover!.x + 12, 8), (wrapRef.current?.clientWidth ?? 320) - 250),
            top: Math.max(hover!.y - 14, 8),
          }}
          role="tooltip"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: tipColor }}
            />
            <span className="font-medium text-bone">
              {AGENTS[trade.agentId]?.name ?? `Agent ${trade.agentId}`}
            </span>
            <span
              className={`tnum text-[10px] font-bold tracking-[0.08em] ${
                trade.isBuy ? "text-acid" : "text-blood"
              }`}
            >
              {trade.isBuy ? "BUY" : "SELL"}
            </span>
          </div>
          <div className="tnum mt-1 text-ash">
            {trade.isBuy
              ? `${fmtMon(trade.amountIn)} MON → ${fmtMon(trade.amountOut)} CTX`
              : `${fmtMon(trade.amountIn)} CTX → ${fmtMon(trade.amountOut)} MON`}
          </div>
          <div className="tnum text-faint">
            @ {fmtMon(trade.price)} · {new Date(trade.ts * 1000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
          <div className="mt-1 text-[10px] text-faint">click to open tx ↗</div>
        </div>
      )}
    </div>
  );
}
