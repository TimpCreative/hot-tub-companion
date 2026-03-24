import Script from 'next/script';

/**
 * Runs before React hydration to set data-theme from cookie.
 * Prevents flash of wrong theme on load.
 */
export function ThemeScript() {
  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){var c=document.cookie.match(/(^| )theme=([^;]+)/);var t=c?c[2]:null;document.documentElement.setAttribute('data-theme',(t==='dark'||t==='light')?t:'light');})();`,
      }}
    />
  );
}
