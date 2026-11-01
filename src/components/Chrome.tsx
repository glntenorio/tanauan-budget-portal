import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { shortNameOf } from '../config';
import { usePortal } from '../lib/portal-context';
import { date } from '../lib/format';
import { NATIONAL_URL, SOURCE_CODE_URL } from '../lib/links';
import { Icon } from './Dash';
import GT_SIDEBAR from '../assets/gt-sidebar.html?raw';

// Imported, so the build gives it a hashed name (safe under long cache headers).
import BETTERGOV_LOGO from '../assets/bettergov-horizontal-primary.webp';

const NAV = [
  { to: '/', hash: '', label: 'Overview', icon: 'overview' },
  { to: '/', hash: '#projects', label: 'All projects', icon: 'projects' },
  { to: '/', hash: '#offices', label: 'Offices', icon: 'offices' },
  { to: '/gaa', hash: '', label: 'Budgets 2020–2026', icon: 'history' },
  { to: '/about', hash: '', label: 'About the data', icon: 'about' },
] as const;

const COLLAPSED_KEY = 'gt-sidebar-collapsed'; // shared with glentenorio.com's main.js

/**
 * glentenorio.com's layout: its sidebar (copied from the site by
 * scripts/sync-gt-sidebar.mjs) and the rounded content panel the portal sits in.
 */
export function GtLayout({ children }: { children: ReactNode }) {
  const { pathname, hash } = useLocation();
  const side = useRef<HTMLElement>(null);
  // The drawer is open for the page it was opened on; navigating closes it.
  const here = pathname + hash;
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === here;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenAt((typeof v === 'function' ? v(open) : v) ? here : null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    document.body.classList.toggle('locked', open);
    return () => document.body.classList.remove('locked');
  }, [open]);
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* private mode */ }
  }, [collapsed]);
  // The sidebar's own collapse button lives in the copied markup.
  useEffect(() => {
    const btn = side.current?.querySelector<HTMLButtonElement>('#sidebarToggle');
    if (!btn) return;
    const onClick = () => setCollapsed((c) => !c);
    btn.addEventListener('click', onClick);
    btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    return () => btn.removeEventListener('click', onClick);
  }, [collapsed]);

  return (
    <div className={`gt-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      <aside
        ref={side}
        className={`side${collapsed ? ' collapsed' : ''}${open ? ' open' : ''}`}
        id="drawer"
        dangerouslySetInnerHTML={{ __html: GT_SIDEBAR }}
      />
      <div className="gt-panel">
        <div className="m-nav">
          <a href="https://glentenorio.com/" className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <div className="brand-name">glen<b>tenorio</b></div>
          </a>
          <button type="button" className={`m-burger${open ? ' open' : ''}`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span />
          </button>
        </div>
        {children}
      </div>
      <button type="button" className={`scrim${open ? ' on' : ''}`} aria-hidden="true" tabIndex={-1} onClick={() => setOpen(false)} />
    </div>
  );
}

/** The portal's own header inside the panel: name, live badge, section tabs. */
export function PortalBar() {
  const { config, scope } = usePortal();
  const { pathname, hash } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const meta = scope.status === 'ready' ? scope.value.meta : null;
  const projects = scope.status === 'ready' ? scope.value.projects.length : null;
  return (
    <header className={`pbar${scrolled ? ' is-scrolled' : ''}`}>
      <div className="pbar-top">
        <Link to="/" className="pbar-title" onClick={() => pathname === '/' && window.scrollTo(0, 0)}>
          <span className="pbar-icon" aria-hidden="true"><Icon name="history" /></span>
          <span>
            <span className="pbar-name">{config.name} Budget Portal</span>
            <span className="pbar-sub">
              <span className="live-dot" aria-hidden="true" /> Live from the BetterGov.ph Budget API
              {meta && <> · data built {date(meta.built_at)}</>}
            </span>
          </span>
        </Link>
        <a className="pbar-data" href="https://bettergov.ph" target="_blank" rel="noopener">
          <span className="label">Data from</span>
          <img src={BETTERGOV_LOGO} alt="BetterGov.ph" width="110" height="24" />
        </a>
      </div>
      <nav className="ptabs" aria-label="Portal sections">
        {NAV.map((n) => {
          const active = pathname === n.to && (n.hash ? hash === n.hash : !['#offices', '#projects'].includes(hash));
          return (
            <Link
              key={n.label}
              to={{ pathname: n.to, hash: n.hash }}
              className={active ? 'active' : undefined}
              aria-current={active ? 'page' : undefined}
              onClick={() => !n.hash && pathname === n.to && window.scrollTo(0, 0)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {n.hash === '#projects' && projects != null && <span className="ptab-chip num">{projects}</span>}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function Footer() {
  const { config, scope, client } = usePortal();
  const meta = scope.status === 'ready' ? scope.value.meta : null;
  return (
    <footer className="footer">
      <div className="page footer-inner">
        <div className="footer-brand">
          <a className="footer-by" href="https://glentenorio.com" target="_blank" rel="noopener">
            <span className="footer-by-mark" aria-hidden="true" />
            <span>glen<b>tenorio</b></span>
          </a>
          <p>
            A citizen project for {shortNameOf(config)}: where the 2027 national budget is set to go, in plain language,
            with the source behind every figure. Independent, unpaid, and not affiliated with any government office.
          </p>
        </div>
        <p className="footer-source">
          Source: NEP FY 2027 and House Bill 10858 · via the BetterGov.ph Budget API
          {meta && <> · data built {date(meta.built_at)}</>}
        </p>
        {meta && <p className="footer-notice">{meta.notice}</p>}
        <ul className="footer-links">
          <li>
            <span className="label">This portal</span>
            <span>
              {shortNameOf(config)}, run by{' '}
              {config.operator.url ? (
                <a href={config.operator.url} target="_blank" rel="noopener">{config.operator.name}</a>
              ) : (
                config.operator.name
              )}
              {config.operator.email && (
                <> · <a href={`mailto:${config.operator.email}`}>{config.operator.email}</a></>
              )}
            </span>
          </li>
          <li>
            <span className="label">Every project, nationwide</span>
            <a href={NATIONAL_URL} target="_blank" rel="noopener">budget.bettergov.ph ↗</a>
          </li>
          <li>
            <span className="label">Data</span>
            <a href={`${client.base}/docs`} target="_blank" rel="noopener">Budget API and MCP ↗</a>
          </li>
          <li>
            <span className="label">Built on</span>
            <a href={SOURCE_CODE_URL} target="_blank" rel="noopener">Fork this portal for your LGU or DPWH office ↗</a>
          </li>
        </ul>
      </div>
    </footer>
  );
}

export function PageHead({ eyebrow, title, children }: { eyebrow: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <div className="lede">{children}</div>}
    </div>
  );
}
