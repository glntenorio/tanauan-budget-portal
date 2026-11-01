import { useEffect } from 'react';

/** Sets a meta tag's content, adding the tag if the page has none. */
function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = value;
}

/**
 * Keeps the head in step with the page: title, description, and the canonical
 * URL on the portal's own domain (the base comes from the canonical link the
 * build writes, so a mirror never claims to be the original).
 */
export function useTitle(title: string, description?: string) {
  useEffect(() => {
    document.title = title;
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    if (description) {
      setMeta('meta[name="description"]', 'name', 'description', description);
      setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    }
    const canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const base = canonical?.dataset.base;
    if (canonical && base) {
      const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');
      const route = window.location.pathname.slice(appBase.length).replace(/^\/?/, '/');
      const href = base + (route === '/' ? '/' : route);
      canonical.href = href;
      setMeta('meta[property="og:url"]', 'property', 'og:url', href);
    }
  }, [title, description]);
}
