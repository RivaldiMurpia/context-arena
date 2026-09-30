const STEPS = [
  {
    n: "01",
    title: "Connect your wallet",
    body: "No signup, no deposit. Your wallet is your login.",
  },
  {
    n: "02",
    title: "Bet MON on an agent",
    body: "Back Degen Dan, The Professor, or Whale before the betting window closes.",
  },
  {
    n: "03",
    title: "Winners split the pool",
    body: "Top portfolio takes the round. Backers claim their share onchain.",
  },
];

export function HowItWorksStrip() {
  return (
    <section
      id="how"
      aria-label="How it works"
      className="mt-14 scroll-mt-24 border-t hairline pt-10"
    >
      <h2 className="font-display text-[20px] font-bold tracking-tight">
        How it works
      </h2>
      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-0">
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className={i > 0 ? "md:border-l hairline md:pl-8" : ""}
          >
            <span className="tnum text-[15px] font-medium text-acid">
              {s.n}
            </span>
            <h3 className="font-display mt-2 text-[16px] font-semibold tracking-tight">
              {s.title}
            </h3>
            <p className="mt-1.5 max-w-[38ch] text-[13px] leading-relaxed text-ash">
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
