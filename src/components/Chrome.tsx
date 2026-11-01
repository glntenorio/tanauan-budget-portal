import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { shortNameOf } from '../config';
import { usePortal } from '../lib/portal-context';
import { date } from '../lib/format';
import { NATIONAL_URL, SOURCE_CODE_URL } from '../lib/links';
import { Icon, Tooltip } from './Dash';
import { attachPill } from '../lib/pill';
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
  // The sidebar menu gets the sliding pill (the copied markup marks Tools active).
  useEffect(() => {
    const menu = side.current?.querySelector<HTMLElement>('.nav');
    return menu ? attachPill(menu) : undefined;
  }, []);
  // A soft spotlight follows the pointer across dashboard cards.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce), (hover: none)').matches) return;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element | null)?.closest?.<HTMLElement>('.dcard, .ocard, .hcard');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
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
          <a href="/" className="brand">
            <div className="brand-mark" aria-hidden="true" />
            <div className="brand-name">glen<b>tenorio</b></div>
          </a>
          <button type="button" className={`m-burger${open ? ' open' : ''}`} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span />
          </button>
        </div>
        {children}
      </div>
      <Tooltip />
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
  const tabs = useRef<HTMLElement>(null);
  // The tabs get the sliding pill; re-measured when the page or the bar's size changes.
  useEffect(() => (tabs.current ? attachPill(tabs.current) : undefined), [pathname, hash, scrolled, projects]);
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
      <nav className="ptabs" aria-label="Portal sections" ref={tabs}>
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

/** Links on glentenorio.com, where the portal is hosted: same tab, root-relative. */
const SITE_LINKS = [
  { href: '/tools/', label: 'Free web tools' },
  { href: '/tools/website-qa/', label: 'Website QA Audit' },
  { href: '/tools/website-screenshot/', label: 'Website Screenshot Tool' },
  { href: '/blog/', label: 'Blog' },
  { href: '/about/', label: 'About Glen' },
];
const PORTAL_REPO_URL = 'https://github.com/glntenorio/tanauan-budget-portal';

export function Footer() {
  const { config, scope, client } = usePortal();
  const { pathname } = useLocation();
  const meta = scope.status === 'ready' ? scope.value.meta : null;
  const name = shortNameOf(config);
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <a className="footer-by" href="/">
              <span className="footer-by-mark" aria-hidden="true" />
              <span>glen<b>tenorio</b></span>
            </a>
            <p>
              A citizen project for {name}. As a Filipino citizen, I believe public money should be easy to see and check;
              this is my small part in that. Independent, unpaid, and not affiliated with any government office.
            </p>
          </div>
          <div className="footer-cta">
            <a className="button button-light" href="/tools/">More free tools</a>
            <a className="button button-ghost-dark" href="/contact/">Get in touch</a>
          </div>
        </div>

        <nav className="footer-cols" aria-label="Footer">
          <div>
            <p className="footer-h">This portal</p>
            <ul>
              {NAV.map((n) => (
                <li key={n.label}>
                  <Link to={{ pathname: n.to, hash: n.hash }} onClick={() => !n.hash && pathname === n.to && window.scrollTo(0, 0)}>
                    {n.label === 'Offices' ? 'Offices and districts' : n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="footer-h">On glentenorio.com</p>
            <ul>
              {SITE_LINKS.map((l) => <li key={l.href}><a href={l.href}>{l.label}</a></li>)}
            </ul>
          </div>
          <div>
            <p className="footer-h">The data</p>
            <ul>
              <li><a href={NATIONAL_URL} target="_blank" rel="noopener">Every project, nationwide <span aria-hidden="true">↗</span></a></li>
              <li><a href={`${client.base}/docs`} target="_blank" rel="noopener">Budget API and MCP <span aria-hidden="true">↗</span></a></li>
              <li><a href="https://budget.bettergov.ph/hgab/2027/methodology#disclaimer" target="_blank" rel="noopener">Methodology and notice <span aria-hidden="true">↗</span></a></li>
              <li><a href="https://bettergov.ph" target="_blank" rel="noopener">BetterGov.ph <span aria-hidden="true">↗</span></a></li>
            </ul>
          </div>
          <div>
            <p className="footer-h">Open source</p>
            <ul>
              <li><a href={PORTAL_REPO_URL} target="_blank" rel="noopener">This portal's code <span aria-hidden="true">↗</span></a></li>
              <li><a href={SOURCE_CODE_URL} target="_blank" rel="noopener">BetterGov's original <span aria-hidden="true">↗</span></a></li>
              <li><a href={SOURCE_CODE_URL} target="_blank" rel="noopener">Fork it for your LGU <span aria-hidden="true">↗</span></a></li>
            </ul>
          </div>
        </nav>

        <div className="footer-source">
          <span className="live-dot" aria-hidden="true" />
          <span>
            Source: NEP FY 2027 and House Bill 10858, via the BetterGov.ph Budget API
            {meta && <> · data built {date(meta.built_at)}</>}
          </span>
        </div>
        {meta && <p className="footer-notice">{meta.notice}</p>}

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {config.operator.name}</span>
          <span className="footer-legal">
            <a href="/privacy/">Privacy Policy</a>
            <span aria-hidden="true">·</span>
            <a href="/terms/">Terms &amp; Conditions</a>
          </span>
        </div>
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
