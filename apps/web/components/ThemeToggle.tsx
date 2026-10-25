"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
const KEY = "ppl-theme";

/** Runs before paint (inlined in <head>) so there is no flash of the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${KEY}");var d=t==="dark"||((!t||t==="system")&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {
      // Storage can be blocked; fall back to the system theme.
    }
    if (stored === "light" || stored === "dark" || stored === "system") setTheme(stored);
  }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {
      // Not persisted; the choice still applies to this page view.
    }
  };

  const options: { value: Theme; label: string; icon: string }[] = [
    {
      value: "light",
      label: "Light theme",
      icon: "M12 4V2m0 20v-2m8-8h2M2 12h2m13.66-5.66 1.41-1.41M4.93 19.07l1.41-1.41m0-11.32L4.93 4.93m14.14 14.14-1.41-1.41M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
    },
    { value: "dark", label: "Dark theme", icon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" },
    { value: "system", label: "System theme", icon: "M3 5h18v11H3zM8 20h8M12 16v4" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="inline-flex rounded-lg border border-border bg-card p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => choose(o.value)}
          className={`rounded-md p-1.5 ${theme === o.value ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"}`}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={o.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
