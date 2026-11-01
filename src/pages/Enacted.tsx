/**
 * /gaa — the enacted budgets, 2020–2026, for the portal's area:
 * - each DPWH office's whole budget by year, from its district page, with the
 *   2027 NEP and House bill beside it but apart (they are not law);
 * - every program, activity or project in any department whose name names one
 *   of the portal's places, with its appropriation in each year.
 */
import { type CSSProperties, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { DistrictCard, DistrictOffice, Envelope } from '../api/types';
import { GAA_YEARS } from '../api/types';
import { shortNameOf } from '../config';
import { Await, Disclaimers } from '../components/Bits';
import { CountUp, Icon, type IconName } from '../components/Dash';
import { barangayOf, kindOf, rowTitle } from '../lib/titles';
import { downloadText } from '../lib/csv';
import { count, php, phpFull, plural } from '../lib/format';
import { departmentShort, gaaCsv, gaaYearTotals, hasYear, loadGaa, type GaaResult, type GaaRow } from '../lib/gaa';
import { usePortal, type Async } from '../lib/portal-context';
import { useTitle } from '../lib/use-title';

const PAGE = 100;
const FIRST = GAA_YEARS[0];
const LAST = GAA_YEARS[GAA_YEARS.length - 1];

export default function Enacted() {
  const { config, client, districts } = usePortal();
  const name = shortNameOf(config);
  useTitle(
    `${config.name} Budgets ${FIRST}–${LAST}: Every Enacted Program`,
    `The enacted national budgets for ${config.name} from ${FIRST} to ${LAST}: every program that names the city, year by year, from the General Appropriations Act.`,
  );
  const places = config.scope.places ?? [];

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [state, setState] = useState<Async<GaaResult>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!places.length) return;
    let live = true;
    loadGaa(client, config, (done, total) => live && setProgress({ done, total })).then(
      (value) => live && setState({ status: 'ready', value }),
      (error) => live && setState({ status: 'error', error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      live = false;
    };
  }, [client, config, places.length, attempt]);

  // #office-… links from the main page land on the office once it has rendered.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash, districts.status]);

  const placeList = places.map((p) => p.label).join(', ');
  return (
    <main className="page main">
      <header className="dcard banner banner-gaa" style={{ '--i': 0 } as CSSProperties}>
        <div className="banner-bg" aria-hidden="true" />
        <div className="banner-copy">
          <p className="banner-kicker">
            <span className="live-dot" aria-hidden="true" /> GAA<span className="sep">·</span>FY {FIRST}–{LAST}<span className="sep">·</span>Enacted budgets
          </p>
          <h1>
            {state.status === 'ready' ? `${plural(state.value.rows.length, 'program', 'programs')} for ${name}` : `${name} in the enacted budgets`}
            <span className="banner-h-sub"> in the {FIRST}–{LAST} national budgets</span>
          </h1>
          <div className="banner-lede">
            <p>
              The General Appropriations Act (GAA) is the budget Congress passes and the President signs each year: the authority to
              spend, not the money spent. These are the budgets for {FIRST} to {LAST}; the 2027 budget is still a bill.
            </p>
          </div>
        </div>
        <div className="banner-actions">
          <a className="button button-light" href="#programs">See every program</a>
          <Link className="button button-glass" to="/">The 2027 budget →</Link>
        </div>
        <div className="banner-kpis gaa-tiles">
          {state.status === 'ready' ? <GaaTiles result={state.value} /> : [0, 1, 2, 3].map((i) => <div key={i} className="dcard kpi gtile is-loading" style={{ '--i': i + 1 } as CSSProperties}><span /><span /></div>)}
        </div>
      </header>

      <OfficeHistories />

      {places.length === 0 ? (
        <p className="fine section-gap">
          This portal follows DPWH offices only. The enacted budgets list projects by name, not by office, so only each office’s
          yearly total is shown here.
        </p>
      ) : state.status === 'loading' ? (
        <div className="state" role="status">
          <span className="spinner" aria-hidden="true" /> Searching every department’s programs for {placeList}
          {progress && progress.total > 0 && <> · {count(progress.done)} of {count(progress.total)}</>}…
        </div>
      ) : state.status === 'error' ? (
        <div className="state state-error" role="alert">
          <p><strong>Could not load the enacted budgets.</strong> {state.error.message}</p>
          <button type="button" className="button" onClick={() => { setState({ status: 'loading' }); setAttempt((n) => n + 1); }}>Try again</button>
        </div>
      ) : (
        <Programs result={state.value} placeList={placeList} />
      )}

      <section className="section gaa-notes" aria-labelledby="gaa-notes-h">
        <h2 id="gaa-notes-h" className="section-h">Reading these figures</h2>
        <ul className="gnotes">
          <li><span className="why-ico" aria-hidden="true"><Icon name="doc" /></span><span><b>Appropriations, in pesos</b>The amounts in each year's GAA. The GAA publishes them in thousands.</span></li>
          {places.length > 0 && (
            <>
              <li><span className="why-ico" aria-hidden="true"><Icon name="projects" /></span><span><b>Matched by name</b>A program is listed when its name includes {placeList}. A project whose name does not say where it is will not be here.</span></li>
              <li><span className="why-ico" aria-hidden="true"><Icon name="history" /></span><span><b>One name, one row</b>One row is one name in one agency across the years. A renamed or re-scoped project shows as a new row; a dash means no appropriation under that name.</span></li>
            </>
          )}
          <li><span className="why-ico" aria-hidden="true"><Icon name="offices" /></span><span><b>Offices shown whole</b>A DPWH office's yearly figure is its whole budget as the GAA lists it. An office serving several districts is never split.</span></li>
          <li><span className="why-ico" aria-hidden="true"><Icon name="capitol" /></span><span><b>2027 is still a bill</b>The 2027 figures are the NEP and the House bill, not law. They sit beside the enacted years, never added to them.</span></li>
        </ul>
      </section>
    </main>
  );
}

function GaaTiles({ result }: { result: GaaResult }) {
  const totals = gaaYearTotals(result.rows);
  const peak = totals.reduce((a, b) => (b.amount > a.amount ? b : a), totals[0]);
  const last = totals[totals.length - 1];
  const depts = new Set(result.rows.map((r) => r.department_id)).size;
  const tiles: { icon: IconName; label: string; value: ReactNode; sub: string }[] = [
    { icon: 'projects', label: 'Programs', value: <CountUp value={result.rows.length} format={count} />, sub: `that name the city, ${FIRST}–${LAST}` },
    { icon: 'history', label: `Peak · ${peak?.year ?? ''}`, value: peak ? <CountUp value={peak.amount} format={php} /> : '—', sub: peak ? `${plural(peak.programs, 'program')} funded that year` : '' },
    { icon: 'doc', label: `Latest · ${last?.year ?? ''}`, value: last ? <CountUp value={last.amount} format={php} /> : '—', sub: last ? `${plural(last.programs, 'program')} funded` : '' },
    { icon: 'capitol', label: 'Departments', value: <CountUp value={depts} format={count} />, sub: 'with a program that names it' },
  ];
  return (
    <>
      {tiles.map((t, i) => (
        <div key={t.label} className={`dcard kpi gtile${i === 1 ? ' kpi-pop' : ''}`} style={{ '--i': i + 1 } as CSSProperties}>
          <div className="kpi-head">
            <span className="kpi-icon" aria-hidden="true"><Icon name={t.icon} /></span>
            <p className="kpi-label">{t.label}</p>
          </div>
          <p className="kpi-value num">{t.value}</p>
          <p className="kpi-sub">{t.sub}</p>
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// DPWH offices, year by year
// ---------------------------------------------------------------------------

function OfficeHistories() {
  const { districts, config } = usePortal();
  if (!config.scope.offices?.length && !config.scope.districts?.length) return null;
  return (
    <Await state={districts} what="DPWH office budgets">
      {(list) => <OfficeHistoryList list={list} />}
    </Await>
  );
}

function OfficeHistoryList({ list }: { list: Envelope<DistrictCard>[] }) {
  const offices = useMemo(() => {
    const byId = new Map<string, DistrictOffice>();
    for (const env of list) for (const o of env.data.offices) if (!byId.has(o.id)) byId.set(o.id, o);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  }, [list]);
  const officeDisclaimer = list.flatMap((e) => e.disclaimers).filter((d) => d.id === 'disclaimer-offices').slice(0, 1);
  if (!offices.length) return null;
  return (
    <section className="section" aria-labelledby="office-years-h">
      <h2 id="office-years-h" className="section-h">
        {offices.length === 1 ? 'The DPWH office’s budget, year by year' : `${count(offices.length)} DPWH offices’ budgets, year by year`}
      </h2>
      <p className="legend">
        <span><i className="sw sw-gaa" /> Enacted (GAA), whole office</span>
        <span><i className="sw sw-nep" /> 2027 NEP, whole office</span>
        <span><i className="sw sw-house" /> 2027 House bill, named projects only</span>
      </p>
      <div className="hgrid">
        {offices.map((o) => <OfficeHistory key={o.id} office={o} />)}
      </div>
      <Disclaimers items={officeDisclaimer} compact />
    </section>
  );
}

/** Three bars each: 2020–22, 2023–25, and 2026 with the two 2027 versions. */
const CONGRESSES = [{ label: '18th Congress' }, { label: '19th Congress' }, { label: '20th Congress' }];

function OfficeHistory({ office }: { office: DistrictOffice }) {
  const years = office.years ?? [];
  const slot = (fy: number, stage: string) => years.find((y) => y.fy === fy && y.stage === stage);
  const bars = [
    ...GAA_YEARS.map((fy) => ({ key: `${fy}`, label: String(fy), kind: 'gaa', v: slot(fy, 'gaa') })),
    { key: '2027-nep', label: 'NEP', kind: 'nep', v: slot(2027, 'nep') },
    { key: '2027-house', label: 'House', kind: 'house', v: slot(2027, 'hgab3') },
  ];
  const max = Math.max(1, ...bars.map((b) => b.v?.php ?? 0));
  return (
    <article className="hcard" id={office.id}>
      <header>
        <h3>DPWH {office.name}</h3>
        <span className={`tag tier tier-${office.tier}`}>{office.tier_text}</span>
      </header>
      <div className="bars" role="img" aria-label={`Budget by year: ${bars.map((b) => `${b.label} ${b.v?.php != null ? phpFull(b.v.php) : 'not found'}`).join('; ')}`}>
        {bars.map((b) => (
          <div key={b.key} className={`bar-col k-${b.kind}`} title={b.v?.php != null ? `${b.v.stage_label} ${b.key.slice(0, 4)}: ${phpFull(b.v.php)} (${b.v.scope})` : 'The office was not found that year'}>
            <span className="bar-v num">{b.v?.php != null ? php(b.v.php).replace('₱', '') : '—'}</span>
            <span className="bar-track"><span className="bar-fill" style={{ height: `${((b.v?.php ?? 0) / max) * 100}%` }} /></span>
            <span className="bar-x">{b.label}</span>
          </div>
        ))}
      </div>
      <div className="congresses" aria-hidden="true">
        {CONGRESSES.map((c) => <span key={c.label}>{c.label}</span>)}
      </div>
      {office.co_served_districts.length > 0 && (
        <p className="fine">Whole office, shared with {office.co_served_districts.map((d) => d.label).join('; ')}; not split.</p>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Programs and projects that name the place
// ---------------------------------------------------------------------------

function Programs({ result, placeList }: { result: GaaResult; placeList: string }) {
  const { config } = usePortal();
  const all = result.rows;
  const totals = useMemo(() => gaaYearTotals(all), [all]);
  const maxTotal = Math.max(1, ...totals.map((t) => t.amount));

  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const dept = params.get('dept') ?? '';
  const yearParam = Number(params.get('year'));
  const year = (GAA_YEARS as readonly number[]).includes(yearParam) ? yearParam : null;
  const [shown, setShown] = useState(PAGE);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setShown(PAGE);
  };

  const departments = useMemo(() => {
    const n = new Map<string, { label: string; rows: number }>();
    for (const r of all) {
      const d = n.get(r.department_id) ?? { label: departmentShort(r.department), rows: 0 };
      d.rows++;
      n.set(r.department_id, d);
    }
    return [...n.entries()].sort((a, b) => b[1].rows - a[1].rows);
  }, [all]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const y = year ? String(year) : null;
    const rows = all.filter((r) => {
      if (dept && r.department_id !== dept) return false;
      if (y && !hasYear(r, y)) return false;
      if (words.length) {
        const hay = `${r.name} ${r.department}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    return y ? [...rows].sort((a, b) => (b.years[y]?.amount ?? 0) - (a.years[y]?.amount ?? 0)) : rows;
  }, [all, q, dept, year]);
  const narrowed = filtered.length !== all.length;

  return (
    <>
      <section className="dcard gaa-years" aria-labelledby="gaa-years-h" style={{ '--i': 2 } as CSSProperties}>
        <header className="dcard-head">
          <div>
            <p className="dcard-kicker">Click a year to filter the list</p>
            <h2 id="gaa-years-h" className="dcard-title">By year: the programs that name {placeList}</h2>
          </div>
        </header>
        <div className="ystrip" role="group" aria-label="Pick a year">
          {totals.map((t) => (
            <button
              key={t.year}
              type="button"
              className={`ycell${year === t.year ? ' active' : ''}`}
              aria-pressed={year === t.year}
              onClick={() => setParam('year', year === t.year ? '' : String(t.year))}
            >
              <span className="label">{t.year}</span>
              <span className="ybar"><span style={{ height: `${(t.amount / maxTotal) * 100}%` }} /></span>
              <span className="yv num">{php(t.amount)}</span>
              <span className="ysub">{plural(t.programs, 'program')} funded</span>
            </button>
          ))}
        </div>
        <p className="fine">Each year’s total covers only that year’s programs that name {placeList}. Years are shown side by side, not added up.</p>
      </section>

      <section className="section dcard dcard-table" id="programs" aria-labelledby="gaa-list-h" style={{ '--i': 3 } as CSSProperties}>
        <div className="list-head">
          <h2 id="gaa-list-h" className="section-h">
            {narrowed ? `${count(filtered.length)} of ${plural(all.length, 'program')}` : `Every program and project (${count(all.length)})`}
          </h2>
          <button type="button" className="button button-quiet" onClick={() => downloadText(`${config.id}-gaa-${FIRST}-${LAST}.csv`, gaaCsv(filtered))}>
            Download CSV{narrowed ? ` (${count(filtered.length)})` : ''}
          </button>
        </div>
        <div className="toolbar">
          <label className="field field-grow">
            <span className="label">Search</span>
            <input type="search" value={q} placeholder="Road, school, barangay, agency…" onChange={(e) => setParam('q', e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Department</span>
            <select value={dept} onChange={(e) => setParam('dept', e.target.value)}>
              <option value="">All departments</option>
              {departments.map(([id, d]) => <option key={id} value={id}>{d.label} ({count(d.rows)})</option>)}
            </select>
          </label>
          <label className="field">
            <span className="label">Year</span>
            <select value={year ?? ''} onChange={(e) => setParam('year', e.target.value)}>
              <option value="">All years</option>
              {totals.map((t) => <option key={t.year} value={t.year}>{t.year} ({count(t.programs)})</option>)}
            </select>
          </label>
        </div>
        {narrowed && (
          <p className="filter-sums">
            {year ? <>{year}: {php(filtered.reduce((a, r) => a + (r.years[String(year)]?.amount ?? 0), 0))} across these {count(filtered.length)}</> : <>{count(filtered.length)} shown</>}
            <span className="sep">·</span>
            <button type="button" className="link-button" onClick={() => { setParams(new URLSearchParams(), { replace: true }); setShown(PAGE); }}>Clear filters</button>
          </p>
        )}

        {filtered.length > 0 && (
          <div className="ptable ptable-gaa" role="table" aria-label="Programs and projects, by year">
            <div className="prow prow-head prow-gaa" role="row">
              <span role="columnheader" className="pc-project">Program or project</span>
              {GAA_YEARS.map((y) => <span role="columnheader" key={y} className={`r${year === y ? ' ycol' : ''}`}>{y}</span>)}
            </div>
            {filtered.slice(0, shown).map((r) => <ProgramRow key={r.key} r={r} year={year} many={(config.scope.places?.length ?? 0) > 1} />)}
          </div>
        )}
        {filtered.length === 0 && <p className="state">No program matches. Try fewer words or clear the filters.</p>}
        {filtered.length > shown && (
          <div className="more">
            <span className="muted">Showing {count(shown)} of {count(filtered.length)}</span>
            <button type="button" className="button" onClick={() => setShown((n) => n + PAGE)}>Show {count(Math.min(PAGE, filtered.length - shown))} more</button>
            <button type="button" className="button button-quiet" onClick={() => setShown(filtered.length)}>Show all</button>
          </div>
        )}
        {result.queries.some((x) => x.truncated) && (
          <p className="fine">Some searches matched more programs than this page loads; see About the data.</p>
        )}
      </section>
    </>
  );
}

function ProgramRow({ r, year, many }: { r: GaaRow; year: number | null; many: boolean }) {
  // Each cell is tinted by its share of the program's largest year: a heat row.
  const amounts = GAA_YEARS.map((y) => (hasYear(r, y) ? r.years[String(y)]?.amount ?? 0 : 0));
  const rowMax = Math.max(1, ...amounts);
  const funded = amounts.filter((a) => a > 0).length;
  const kind = kindOf({ dataset: 'gaa', title: r.name });
  const brgy = barangayOf(r.name);
  return (
    <div className="prow prow-gaa" role="row">
      <span role="cell" className="pc-project">
        <span className={`ptype t-${kind.icon}`} data-tip={kind.label}><Icon name={kind.icon} /></span>
        <span className="pc-text">
          <span className="ptitle" data-tip={r.name}>{rowTitle(r.name, brgy)}</span>
          <span className="pmeta">
            {brgy && <span className="ploc">{brgy}</span>}
            <a className="pprog" href={`https://budget.bettergov.ph/d/${r.department_id}`} target="_blank" rel="noopener" data-tip={r.department}>
              {departmentShort(r.department)} ↗
            </a>
            <span>{plural(funded, 'year')} funded</span>
            {many && r.reasons.map((p) => <span key={p} className="tag tag-place">names {p}</span>)}
          </span>
        </span>
      </span>
      {GAA_YEARS.map((y, i) => {
        const has = hasYear(r, y);
        const amount = amounts[i];
        return (
          <span
            role="cell"
            key={y}
            data-label={String(y)}
            className={`r num gchip${has ? '' : ' none'}${year === y ? ' ycol' : ''}${has && funded > 1 && amount === rowMax ? ' is-peak' : ''}`}
            style={has ? ({ '--h': (amount / rowMax).toFixed(3) } as CSSProperties) : undefined}
            data-tip={has ? `${y}: ${phpFull(amount)}${amount === rowMax && funded > 1 ? ' · its peak year' : ''}` : `No appropriation under this name in ${y}`}
          >
            {has ? php(amount) : '—'}
          </span>
        );
      })}
    </div>
  );
}
