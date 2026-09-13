// Injected only into the hosted web entry, never into the desktop application.
export function redirectMobileEntry() {
  if (!['/', '/index.html'].includes(window.location.pathname)) return;
  const url = new URL(window.location.href);
  const choice = url.searchParams.get('view');
  let saved;
  try {
    if (choice === 'auto') localStorage.removeItem('raavi:web-view');
    else if (choice === 'desktop' || choice === 'light') localStorage.setItem('raavi:web-view', choice);
    saved = localStorage.getItem('raavi:web-view');
  } catch { /* Private browsing may disable persistent preferences. */ }
  const preference = choice === 'auto' ? null : (choice === 'desktop' || choice === 'light') ? choice : saved;
  const handheld = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || (window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 1024px)').matches);
  if (preference === 'light' || (preference !== 'desktop' && handheld)) {
    url.pathname = '/light/';
    url.searchParams.delete('view');
    window.location.replace(url.href);
  }
}
export const mobileEntryScript = `;(${redirectMobileEntry.toString()})();`;
