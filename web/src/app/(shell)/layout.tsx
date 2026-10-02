"use client";

import { ShellProvider } from "@/components/shell/ShellContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { ShellFooter } from "@/components/shell/ShellFooter";

/**
 * App shell for the broadcast-style routes (/, /arena, /history, /profile):
 * persistent sidebar + top bar.
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ShellProvider>
      <div className="min-h-dvh bg-void text-bone">
        <Sidebar />
        <div className="flex min-h-dvh flex-col lg:pl-[248px]">
          <TopBar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 md:px-6">
            {children}
          </main>
          <ShellFooter />
        </div>
      </div>
    </ShellProvider>
  );
}
