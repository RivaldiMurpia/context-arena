"use client";

import { useMemo } from "react";
import { keccak256, stringToBytes } from "viem";

/**
 * Deterministic geometric avatar derived from the wallet address.
 * Mirrored 5×5 block pattern in arena acid-green tones — no network,
 * no two wallets share a face (practically).
 */
export function WalletAvatar({
  wallet,
  size = 64,
  className,
}: {
  wallet: string;
  size?: number;
  className?: string;
}) {
  const { cells, hue } = useMemo(() => {
    const hash = keccak256(stringToBytes(wallet.toLowerCase()));
    const bytes: number[] = [];
    for (let i = 2; i < hash.length; i += 2)
      bytes.push(parseInt(hash.slice(i, i + 2), 16));
    // 15 independent cells, mirrored horizontally into a 5x5 grid
    const c: boolean[] = [];
    for (let i = 0; i < 15; i++) c.push(bytes[i] % 2 === 0);
    return { cells: c, hue: 70 + (bytes[15] % 40) }; // acid-green range
  }, [wallet]);

  const n = 5;
  const rects: { x: number; y: number; key: number }[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < 3; x++) {
      if (!cells[y * 3 + x]) continue;
      rects.push({ x, y, key: y * 3 + x });
      if (x < 2) rects.push({ x: 4 - x, y, key: 100 + y * 3 + x });
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      className={className}
      role="img"
      aria-label="Wallet avatar"
      style={{ borderRadius: "50%", background: "#0b0e07" }}
    >
      {rects.map((r, i) => (
        <rect
          key={`${r.key}-${i}`}
          x={r.x}
          y={r.y}
          width={1}
          height={1}
          fill={`hsl(${hue} 90% ${38 + ((r.x * 7 + r.y * 13) % 3) * 9}%)`}
        />
      ))}
    </svg>
  );
}
