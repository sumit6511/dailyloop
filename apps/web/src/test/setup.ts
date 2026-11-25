import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

// jsdom doesn't implement <dialog>'s modal API; mimic it closely enough for ConfirmDialog.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom doesn't implement scrolling; AppShell scrolls to the top on navigation.
window.scrollTo = () => {};

// Play as a returning player: each game's rules dialog opens by itself on a first visit, which
// HowToPlay.test.tsx covers; everywhere else it would just be in the way.
beforeEach(() => {
  for (const slug of [
    "connections",
    "word-guess",
    "number-puzzle",
    "logic-puzzle",
    "guess-it",
    "pathway",
  ]) {
    localStorage.setItem(`dailyloop-rules-seen:${slug}`, "1");
  }
});
