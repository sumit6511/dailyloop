import type { ComponentType } from "react";
import { ConnectionsPage } from "./connections/ConnectionsPage";
import { WordGuessPage } from "./word-guess/WordGuessPage";
import { NumberPuzzlePage } from "./number-puzzle/NumberPuzzlePage";
import { LogicPuzzlePage } from "./logic-puzzle/LogicPuzzlePage";
import { GuessItPage } from "./guess-it/GuessItPage";
import { PathwayPage } from "./pathway/PathwayPage";

/** Frontend mirror of the backend game-engine registry — add a game here once its page exists. */
export const GAME_PAGES: Record<string, ComponentType> = {
  connections: ConnectionsPage,
  "word-guess": WordGuessPage,
  "number-puzzle": NumberPuzzlePage,
  "logic-puzzle": LogicPuzzlePage,
  "guess-it": GuessItPage,
  pathway: PathwayPage,
};
