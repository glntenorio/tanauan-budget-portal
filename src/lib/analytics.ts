/**
 * Google Analytics 4, when the build sets VITE_GA4_ID (the glentenorio.com
 * build does; a plain fork does not, and then every call here is a no-op).
 *
 * The portal changes pages without reloading, so automatic page views are off
 * and each route change sends one (see App.tsx).
 */
type Gtag = (...args: unknown[]) => void;

const gtag = (): Gtag | null => (typeof window !== 'undefined' && typeof (window as unknown as { gtag?: Gtag }).gtag === 'function' ? (window as unknown as { gtag: Gtag }).gtag : null);

export function trackPageView() {
  gtag()?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
  });
}

/** A named event with a few flat parameters. */
export function track(event: string, params: Record<string, string | number | undefined> = {}) {
  gtag()?.('event', event, { portal: 'tanauan-budget-portal', ...params });
}
