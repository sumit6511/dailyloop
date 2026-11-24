const LEVELS: Record<string, { bars: number; label: string; color: string }> = {
  easy: { bars: 1, label: "Easy", color: "bg-emerald-400" },
  medium: { bars: 2, label: "Medium", color: "bg-amber-400" },
  hard: { bars: 3, label: "Hard", color: "bg-rose-400" },
};

/** "▮▯▯ EASY" — a three-step signal meter with its label. */
export function DifficultyMeter({ difficulty }: { difficulty: string }) {
  const level = LEVELS[difficulty] ?? { bars: 0, label: difficulty, color: "bg-white/40" };
  return (
    <span className="inline-flex items-center gap-1.5" title={`Difficulty: ${level.label}`}>
      <span className="flex items-end gap-[2px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`w-[3px] rounded-full ${i < level.bars ? level.color : "bg-white/15"}`}
            style={{ height: `${6 + i * 3}px` }}
          />
        ))}
      </span>
      <span className="eyebrow text-white/50">{level.label}</span>
    </span>
  );
}
