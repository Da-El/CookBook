/**
 * CookBook theme: light default, optional dark.
 * Persists to localStorage.key: cookbook-theme
 */
(function () {
  var KEY = "cookbook-theme";

  function getPreferred() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") return saved;
    } catch (_) {}
    return "light";
  }

  function apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      var isDark = theme === "dark";
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      btn.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
      btn.title = isDark ? "Light mode" : "Dark mode";
      var icon = btn.querySelector("[data-theme-icon]");
      if (icon) icon.textContent = isDark ? "☀️" : "🌙";
    });
  }

  function toggle() {
    var next = getPreferred() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch (_) {}
    apply(next);
  }

  // Apply ASAP (script may load at end of body)
  apply(getPreferred());

  document.addEventListener("DOMContentLoaded", function () {
    apply(getPreferred());
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", toggle);
    });

    document.querySelectorAll(".toggle").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        el.classList.toggle("on");
        el.setAttribute("aria-pressed", el.classList.contains("on") ? "true" : "false");
      });
    });
  });
})();
