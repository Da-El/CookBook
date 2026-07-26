import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

/**
 * Optional install banner for PWA. Dismissible; hidden when already installed.
 */
export function PwaInstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem("cookbook-pwa-dismiss") === "1") return;
    } catch {
      /* ignore */
    }
    setHidden(false);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (hidden || isStandalone()) return null;

  async function install() {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setHidden(true);
      return;
    }
    // Fallback tips
    alert(
      "To install CookBook:\n\n" +
        "• Chrome/Edge: menu → Install app / Cast, save and share → Install page as app\n" +
        "• Phone: browser menu → Add to Home Screen\n" +
        "• Desktop preview: F12 → device toolbar (Ctrl+Shift+M)",
    );
  }

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem("cookbook-pwa-dismiss", "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="pwa-banner" role="region" aria-label="Install app">
      <div className="pwa-banner-text">
        <strong>CookBook on your phone</strong>
        <span className="muted text-sm">
          {deferred
            ? "Install for a full-screen app with the bottom tab bar."
            : "Preview: resize narrow or use device mode · Install from the browser menu."}
        </span>
      </div>
      <div className="pwa-banner-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={install}>
          {deferred ? "Install" : "How to"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
