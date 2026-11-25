import { useEffect, useState } from "react";
import { Button } from "../../components/Button";
import { Dialog } from "../../components/Dialog";
import { Icon } from "../../components/Icon";
import { GAME_RULES } from "./rules";

const seenKey = (slug: string) => `dailyloop-rules-seen:${slug}`;

function hasSeenRules(slug: string): boolean {
  try {
    return localStorage.getItem(seenKey(slug)) !== null;
  } catch {
    return true; // storage blocked: don't pop the dialog on every visit
  }
}

function markRulesSeen(slug: string): void {
  try {
    localStorage.setItem(seenKey(slug), "1");
  } catch {
    // not remembered; it'll show again next time
  }
}

/**
 * The "How to play" button for a game's top bar, and the rules dialog it opens. With
 * `openOnFirstVisit`, the dialog also opens by itself the first time someone plays the game.
 */
export function HowToPlay({
  slug,
  title,
  openOnFirstVisit = false,
}: {
  slug: string;
  title: string;
  openOnFirstVisit?: boolean;
}) {
  const rules = GAME_RULES[slug];
  const [open, setOpen] = useState(false);
  // A first-time player sees the rules as soon as the live board is up. GameShell (and so this
  // component) is the same instance through the loading and live states, so react to
  // openOnFirstVisit turning on, not just to the first render — by adjusting state while
  // rendering, as React recommends over an effect.
  const [checkedFirstVisit, setCheckedFirstVisit] = useState(false);
  if (openOnFirstVisit && !checkedFirstVisit) {
    setCheckedFirstVisit(true);
    if (rules && !hasSeenRules(slug)) setOpen(true);
  }

  useEffect(() => {
    if (open) markRulesSeen(slug);
  }, [open, slug]);

  if (!rules) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          markRulesSeen(slug);
          setOpen(true);
        }}
        aria-label={`How to play ${title}`}
        title="How to play"
        className="surface-inset flex h-9 w-9 items-center justify-center rounded-full text-fg-muted outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-accent-400/60"
      >
        <Icon name="help" className="text-xl" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`How to play ${title}`}
        footer={
          <Button autoFocus onClick={() => setOpen(false)}>
            <Icon name="play_arrow" className="text-lg" filled /> Got it
          </Button>
        }
      >
        <p className="text-[15px] text-white/90">{rules.goal}</p>
        <ol className="mt-4 flex flex-col gap-2.5">
          {rules.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-fg-muted">
              <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] font-mono text-xs text-accent-300">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <div className="surface-inset mt-5 flex gap-3 px-4 py-3 text-sm text-fg-muted">
          <Icon name="star" className="mt-0.5 text-lg text-yellow-300" filled />
          <p>
            <span className="font-semibold text-white">Scoring:</span> up to 100 points.{" "}
            {rules.scoring}
          </p>
        </div>
      </Dialog>
    </>
  );
}
