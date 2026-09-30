const MARKS = [
  { initials: "DD", bg: "rgba(232,179,75,0.12)", fg: "#e8b34b" },
  { initials: "PR", bg: "rgba(124,196,232,0.12)", fg: "#7cc4e8" },
  { initials: "WH", bg: "rgba(94,200,184,0.12)", fg: "#5ec8b8" },
] as const;

export function AgentMark({
  id,
  size = "md",
}: {
  id: number;
  size?: "sm" | "md";
}) {
  const m = MARKS[id] ?? MARKS[0];
  const cls =
    size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-[13px]";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl font-display font-bold tracking-tight ${cls}`}
      style={{ background: m.bg, color: m.fg }}
      aria-hidden
    >
      {m.initials}
    </span>
  );
}
