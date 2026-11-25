import type { AnswerRevealDTO, RevealCell } from "@dailyloop/shared";
import { DIFFICULTY_LABELS, DIFFICULTY_STYLES } from "../games/connections/difficulty";

/** Draws a finished puzzle's answer, in whichever shape its game reported. */
export function AnswerReveal({ answer }: { answer: AnswerRevealDTO }) {
  switch (answer.kind) {
    case "word":
      return (
        <div className="flex gap-1" aria-label={answer.answer}>
          {[...answer.answer].map((letter, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500 font-display text-lg font-bold text-on-accent"
            >
              {letter}
            </span>
          ))}
        </div>
      );
    case "mystery":
      return (
        <p className="text-white">
          <span className="text-sm text-fg-muted">{answer.category}: </span>
          <span className="font-display text-lg font-bold">{answer.answer}</span>
        </p>
      );
    case "groups":
      return (
        <ul className="flex flex-col gap-1.5">
          {answer.groups.map((group) => (
            <li
              key={group.title}
              className={`rounded-lg px-3 py-1.5 text-center text-sm ${DIFFICULTY_STYLES[group.difficulty]}`}
            >
              <span className="font-bold">{group.title}</span>{" "}
              <span className="opacity-70">· {DIFFICULTY_LABELS[group.difficulty]}</span>
              <div className="text-xs opacity-90">{group.words.join(", ")}</div>
            </li>
          ))}
        </ul>
      );
    case "equation":
      return (
        <div className="flex flex-col gap-1.5 text-white">
          <p className="text-sm text-fg-muted">
            {answer.numbers.join(", ")} → {answer.target}
          </p>
          <p className="font-display text-lg font-bold">
            {answer.expression ? `${answer.expression} = ${answer.target}` : "No solution recorded"}
          </p>
        </div>
      );
    case "grid":
      return <SolvedGrid rows={answer.rows} givens={answer.givens} />;
    case "path":
      return <SolvedPath {...answer} />;
  }
}

function SolvedGrid({ rows, givens }: { rows: number[][]; givens: boolean[][] }) {
  const size = rows.length;
  return (
    <div
      role="img"
      aria-label={`Solved grid: ${rows.map((row) => row.join(" ")).join(", ")}`}
      className="grid w-fit overflow-hidden rounded-lg border-2 border-white/[0.16]"
      style={{ gridTemplateColumns: `repeat(${size}, 1.75rem)` }}
    >
      {rows.flatMap((row, r) =>
        row.map((value, c) => (
          <span
            key={`${r}-${c}`}
            className={`flex h-7 items-center justify-center border-white/[0.08] text-sm ${
              c < size - 1 ? "border-r" : ""
            } ${r < size - 1 ? "border-b" : ""} ${
              c === 2 && size === 6 ? "border-r-2 border-r-white/[0.16]" : ""
            } ${(r === 1 || r === 3) && size === 6 ? "border-b-2 border-b-white/[0.16]" : ""} ${
              givens[r]?.[c] ? "font-bold text-white" : "text-brand-300"
            }`}
          >
            {value}
          </span>
        )),
      )}
    </div>
  );
}

const CELL = 28;

function SolvedPath({
  size,
  path,
  checkpoints,
  walls,
}: {
  size: number;
  path: RevealCell[];
  checkpoints: RevealCell[];
  walls: { a: RevealCell; b: RevealCell }[];
}) {
  const centre = (cell: RevealCell) =>
    `${cell.col * CELL + CELL / 2},${cell.row * CELL + CELL / 2}`;
  const extent = size * CELL;
  return (
    <svg
      role="img"
      aria-label={`Solved ${size}×${size} path through ${checkpoints.length} checkpoints`}
      viewBox={`-2 -2 ${extent + 4} ${extent + 4}`}
      className="h-auto w-full max-w-[12rem]"
    >
      <rect x={0} y={0} width={extent} height={extent} rx={6} className="fill-white/[0.04]" />
      {Array.from({ length: size - 1 }, (_, i) => (i + 1) * CELL).map((at) => (
        <g key={at} className="stroke-white/[0.08]" strokeWidth={1}>
          <line x1={at} y1={0} x2={at} y2={extent} />
          <line x1={0} y1={at} x2={extent} y2={at} />
        </g>
      ))}
      <polyline
        points={path.map(centre).join(" ")}
        fill="none"
        strokeWidth={CELL * 0.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-indigo-400/70"
      />
      <g strokeWidth={3} strokeLinecap="round" className="stroke-white/80">
        {walls.map(({ a, b }, i) => {
          // A wall sits on the edge two neighbouring cells share.
          if (a.row === b.row) {
            const x = Math.max(a.col, b.col) * CELL;
            return <line key={i} x1={x} y1={a.row * CELL} x2={x} y2={(a.row + 1) * CELL} />;
          }
          const y = Math.max(a.row, b.row) * CELL;
          return <line key={i} x1={a.col * CELL} y1={y} x2={(a.col + 1) * CELL} y2={y} />;
        })}
      </g>
      {checkpoints.map((cell, i) => (
        <g key={i}>
          <circle
            cx={cell.col * CELL + CELL / 2}
            cy={cell.row * CELL + CELL / 2}
            r={CELL * 0.34}
            className="fill-indigo-500"
          />
          <text
            x={cell.col * CELL + CELL / 2}
            y={cell.row * CELL + CELL / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={CELL * 0.4}
            fontWeight={700}
            className="fill-on-accent"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
