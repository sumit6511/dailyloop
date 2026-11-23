import type { ComponentType } from "react";
import { lazyPage } from "../../lib/lazy-page";

/**
 * Frontend mirror of the backend game-engine registry — add a game here once its page exists.
 * Each page is its own chunk, loaded only when that game is opened.
 */
export const GAME_PAGES: Record<string, ComponentType> = {
  connections: lazyPage(() => import("./connections/ConnectionsPage"), "ConnectionsPage"),
  "word-guess": lazyPage(() => import("./word-guess/WordGuessPage"), "WordGuessPage"),
  "number-puzzle": lazyPage(() => import("./number-puzzle/NumberPuzzlePage"), "NumberPuzzlePage"),
  "logic-puzzle": lazyPage(() => import("./logic-puzzle/LogicPuzzlePage"), "LogicPuzzlePage"),
  "guess-it": lazyPage(() => import("./guess-it/GuessItPage"), "GuessItPage"),
  pathway: lazyPage(() => import("./pathway/PathwayPage"), "PathwayPage"),
};
