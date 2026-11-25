import type { ReactNode } from "react";
import { Card } from "../../components/Card";
import { GameIcon } from "../../components/GameIcon";
import { LogoFull, LogoMark } from "../../components/Logo";
import { ThemeToggle } from "../../components/ThemeToggle";
import { useDocumentTitle } from "../../lib/use-document-title";

const GAMES = [
  { slug: "connections", name: "Connections" },
  { slug: "word-guess", name: "Word Guess" },
  { slug: "number-puzzle", name: "Number Puzzle" },
  { slug: "logic-puzzle", name: "Logic Puzzle" },
  { slug: "guess-it", name: "Guess It" },
  { slug: "pathway", name: "Pathway" },
];

export function AuthLayout({
  title,
  subtitle,
  documentTitle,
  children,
}: {
  title: string;
  subtitle: string;
  /** The browser tab title, when the heading doesn't work as one ("Welcome back"). */
  documentTitle?: string;
  children: ReactNode;
}) {
  useDocumentTitle(documentTitle ?? title);
  return (
    <main className="relative mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-12 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-20">
      <ThemeToggle className="absolute right-3 top-3 sm:right-6 sm:top-5" />
      {/* The pitch, on wide screens only — phones go straight to the form. */}
      <section className="hidden lg:block" aria-hidden="true">
        <LogoFull markClassName="h-9 w-9" className="[&>span:last-child]:text-2xl" />
        <p className="eyebrow mt-12 text-accent-300">Daily puzzles</p>
        <h2 className="mt-3 max-w-md font-display text-5xl font-bold leading-[1.05] text-white">
          Six puzzles. <span className="text-gradient">Every day.</span>
        </h2>
        <p className="mt-5 max-w-sm text-fg-muted">
          A few minutes of words, numbers and logic. Keep your streak alive and see where you land
          against your friends.
        </p>
        <ul className="mt-10 grid max-w-md grid-cols-2 gap-2.5">
          {GAMES.map((game) => (
            <li
              key={game.slug}
              className="glass-subtle flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-white/80"
            >
              <GameIcon slug={game.slug} size="sm" />
              {game.name}
            </li>
          ))}
        </ul>
      </section>

      <div className="animate-pop-in mx-auto w-full max-w-sm lg:max-w-none">
        <div className="mb-8 text-center lg:text-left">
          <LogoMark className="mx-auto mb-5 h-12 w-12 lg:hidden" />
          <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">{title}</h1>
          <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>
        </div>
        <Card intensity="strong" className="sm:p-7">
          {children}
        </Card>
      </div>
    </main>
  );
}
