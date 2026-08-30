import { registerGame } from "../registry.js";
import { connectionsGame } from "./connections/index.js";
import { wordGuessGame } from "./word-guess/index.js";
import { numberPuzzleGame } from "./number-puzzle/index.js";
import { logicPuzzleGame } from "./logic-puzzle/index.js";
import { guessItGame } from "./guess-it/index.js";

/** Called once at app startup. Safe to call more than once (idempotent). */
export function registerAllGames(): void {
  registerGame(connectionsGame);
  registerGame(wordGuessGame);
  registerGame(numberPuzzleGame);
  registerGame(logicPuzzleGame);
  registerGame(guessItGame);
}

export { connectionsGame, wordGuessGame, numberPuzzleGame, logicPuzzleGame, guessItGame };
