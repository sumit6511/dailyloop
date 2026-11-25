import "@testing-library/jest-dom/vitest";

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
