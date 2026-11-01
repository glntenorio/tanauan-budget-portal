import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { shortNameOf } from '../config';
import { usePortal } from '../lib/portal-context';
import { date } from '../lib/format';
import { NATIONAL_URL, SOURCE_CODE_URL } from '../lib/links';

const BETTERGOV_LOGO = '/brand/bettergov-horizontal-primary.png';

const NAV = [
  { to: '/', hash: '', label: '2027 projects' },
  { to: '/', hash: '#offices', label: 'Offices and districts' },
  { to: '/gaa', hash: '', label: 'Budgets 2020–2026' },
  { to: '/about', hash: '', label: 'About the data' },
];

export function Masthead() {
  const { config } = usePortal();
  const { pathname, hash } = useLocation();
  // The header stays put and tightens once the page scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`masthead${scrolled ? ' is-scrolled' : ''}`}>
      <div className="page masthead-main">
        <Link to="/" className="masthead-title" onClick={() => pathname === '/' && window.scrollTo(0, 0)}>
          {config.logo ? (
            <img src={config.logo} alt="" className="masthead-logo" />
          ) : (
            <svg className="masthead-mark" viewBox="0 0 32 32" aria-hidden="true">
              <defs>
                <linearGradient id="mark-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#6a8d5f" />
                  <stop offset="1" stopColor="#44603c" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#mark-g)" />
              <rect x="11" y="11" width="10" height="10" rx="2.5" fill="none" stroke="#fff" strokeWidth="2.6" transform="rotate(45 16 16)" />
            </svg>
          )}
          <span>
            <span className="masthead-name">{config.name}</span>
            <span className="masthead-kicker">Budget portal <span aria-hidden="true">·</span> by glen<b>tenorio</b></span>
          </span>
        </Link>
        <nav className="mainnav" aria-label="Sections">
          {NAV.map((n) => {
            const active = pathname === n.to && (n.hash ? hash === n.hash : hash !== '#offices');
            return (
              <Link
                key={n.label}
                to={{ pathname: n.to, hash: n.hash }}
                className={active ? 'active' : undefined}
                aria-current={active ? 'page' : undefined}
                // "Projects" from further down the same page goes back to the top.
                onClick={() => !n.hash && pathname === n.to && window.scrollTo(0, 0)}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <a className="masthead-with" href="https://bettergov.ph" target="_blank" rel="noopener">
          <span className="label">Data from</span>
          <img src={BETTERGOV_LOGO} alt="BetterGov.ph" width="128" height="28" />
        </a>
      </div>
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
