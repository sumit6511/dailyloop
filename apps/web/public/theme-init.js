// Applies the saved light/dark theme before the page first paints, so a light-theme visitor
// never sees a flash of the dark UI. Mirrors src/lib/theme.ts — keep the two in step. A plain
// external script (not inline) because the Content-Security-Policy forbids inline scripts.
(function () {
  var preference = "system";
  try {
    var stored = localStorage.getItem("dailyloop-theme");
    if (stored === "light" || stored === "dark") preference = stored;
  } catch {
    // storage blocked: follow the system
  }
  var light =
    preference === "light" ||
    (preference === "system" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: light)").matches);
  var theme = light ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", light ? "#f3f5fa" : "#04060d");
})();
