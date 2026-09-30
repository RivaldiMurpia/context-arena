"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ShellState {
  /** Global search query — filters the agent table on the home page. */
  query: string;
  setQuery: (q: string) => void;
  /** Mobile nav drawer. */
  drawer: boolean;
  setDrawer: (open: boolean) => void;
}

const ShellCtx = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);
  return (
    <ShellCtx.Provider value={{ query, setQuery, drawer, setDrawer }}>
      {children}
    </ShellCtx.Provider>
  );
}

export function useShell(): ShellState {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error("useShell must be used inside ShellProvider");
  return ctx;
}
