export type NumberOp = "+" | "-" | "*" | "/";

/** Classic Countdown-numbers constraint: only positive integer results are allowed. */
export function applyOp(a: number, b: number, op: NumberOp): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b > 0 ? a - b : null;
    case "*":
      return a * b;
    case "/":
      return b !== 0 && a % b === 0 ? a / b : null;
    default:
      return null;
  }
}

export interface ReachableValue {
  /** Fewest of the starting numbers any expression for this value needs. */
  minNumbers: number;
  /** Distinct expressions (operands of + and × treated as unordered) that produce this value
   * using `minNumbers` or more numbers — a proxy for how many ways a player could find it. */
  ways: number;
  /** One human-readable expression using the fewest numbers, e.g. "(8 × 3) − (5 + 1)". */
  expression: string;
}

const DISPLAY_OP: Record<NumberOp, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

interface Expr {
  value: number;
  /** Canonical text — commutative operands sorted, so a+b and b+a dedupe. */
  key: string;
  display: string;
  size: number;
}

function wrap(e: Expr): string {
  return e.size > 1 ? `(${e.display})` : e.display;
}

function combine(a: Expr, b: Expr, op: NumberOp): Expr | null {
  const value = applyOp(a.value, b.value, op);
  if (value === null) return null;
  const commutative = op === "+" || op === "*";
  const [first, second] = commutative && b.key < a.key ? [b, a] : [a, b];
  return {
    value,
    key: `(${first.key}${op}${second.key})`,
    display: `${wrap(first)} ${DISPLAY_OP[op]} ${wrap(second)}`,
    size: a.size + b.size,
  };
}

const OPS: NumberOp[] = ["+", "-", "*", "/"];

/**
 * Every value reachable from any subset of `numbers` (each used at most once) under the game's
 * rules, keyed by value. Built bottom-up over subsets of the starting numbers, so it's exact —
 * not sampled — and takes a few milliseconds for 4–5 numbers.
 */
export function analyzeNumbers(numbers: readonly number[]): Map<number, ReachableValue> {
  const n = numbers.length;
  const bySubset: Map<string, Expr>[] = Array.from({ length: 1 << n }, () => new Map());
  for (let i = 0; i < n; i++) {
    const v = numbers[i]!;
    bySubset[1 << i]!.set(String(v), { value: v, key: String(v), display: String(v), size: 1 });
  }

  for (let mask = 1; mask < 1 << n; mask++) {
    if ((mask & (mask - 1)) === 0) continue; // single numbers are seeded above
    const out = bySubset[mask]!;
    // Split into two non-empty halves; `sub < rest` visits each unordered split once.
    for (let sub = (mask - 1) & mask; sub > 0; sub = (sub - 1) & mask) {
      const rest = mask ^ sub;
      if (sub < rest) continue;
      for (const a of bySubset[sub]!.values()) {
        for (const b of bySubset[rest]!.values()) {
          for (const op of OPS) {
            for (const [x, y] of op === "+" || op === "*"
              ? [[a, b]]
              : [
                  [a, b],
                  [b, a],
                ]) {
              const e = combine(x!, y!, op);
              if (e && !out.has(e.key)) out.set(e.key, e);
            }
          }
        }
      }
    }
  }

  const result = new Map<number, ReachableValue>();
  const seenKeys = new Map<number, Set<string>>();
  for (let mask = 1; mask < 1 << n; mask++) {
    for (const e of bySubset[mask]!.values()) {
      const keys = seenKeys.get(e.value) ?? new Set<string>();
      seenKeys.set(e.value, keys);
      keys.add(e.key); // identical text from duplicate starting numbers counts once
      const existing = result.get(e.value);
      if (!existing || e.size < existing.minNumbers) {
        result.set(e.value, { minNumbers: e.size, ways: 0, expression: e.display });
      }
    }
  }
  for (const [value, info] of result) info.ways = seenKeys.get(value)!.size;
  return result;
}
