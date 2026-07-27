import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Inline script to apply theme before paint (avoids flash).
 * Keep in sync with lib/theme.ts storage key and class strategy.
 */
export function ThemeScript() {
  const code = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k)||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='dark'||(t!=='light'&&d);var e=document.documentElement;e.classList.toggle('dark',r);e.style.colorScheme=r?'dark':'light';}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
