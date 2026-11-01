import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import type { BridgeGroup, DatasetInfo, Disclaimer, GroupInfo } from '../api/types';
import { BRIDGE_GROUPS } from '../api/types';
import { shortNameOf, type DatasetKey } from '../config';
import { Await, Disclaimers } from '../components/Bits';
import OfficesSection from '../components/OfficesSection';
import { AreaChart, BarList, Card, CountUp, DotMatrix, Donut, Icon, Ring, type IconName } from '../components/Dash';
import { useGrown } from '../lib/motion';
import { gaaYearTotals, loadGaa } from '../lib/gaa';
import { projectsCsv, downloadText } from '../lib/csv';
import { count, php, phpDelta, plural } from '../lib/format';
import { usePortal } from '../lib/portal-context';
import { summarise, type ScopedProject, type ScopeResult, type Summary } from '../lib/scope';
import { useTitle } from '../lib/use-title';

const PAGE = 100;

type Sort = 'house' | 'nep' | 'change' | 'title';
const SORTS: Record<Sort, { label: string; cmp: (a: ScopedProject, b: ScopedProject) => number }> = {
  house: { label: 'House bill amount', cmp: (a, b) => (b.house_php ?? -1) - (a.house_php ?? -1) },
  nep: { label: 'NEP amount', cmp: (a, b) => (b.nep_php ?? -1) - (a.nep_php ?? -1) },
  change: { label: 'Size of change', cmp: (a, b) => Math.abs(b.delta_php ?? 0) - Math.abs(a.delta_php ?? 0) },
  title: { label: 'Name', cmp: (a, b) => a.title.localeCompare(b.title) },
};

export default function Home() {
  const { scope, overview, config } = usePortal();
  useTitle(
    `${config.name} 2027 Budget: Every Project, NEP vs House Bill`,
    `Every 2027 national budget project for ${config.name}: the NEP against the House bill, what was added or dropped, and the source page for each.`,
  );
  const datasets = overview.status === 'ready' ? overview.value.data.datasets : [];
  return (
    <main className="page main">
      <Await state={scope} what="projects">
        {(s) => <Projects scope={s} datasets={datasets} />}
      </Await>
    </main>
  );
}

/** Group wording from the API (label, sub, help), falling back to the row's own label. */
type GroupWords = Pick<GroupInfo, 'label' | 'sub' | 'help'>;

function groupInfo(datasets: DatasetInfo[], rows: ScopedProject[]): Record<BridgeGroup, GroupWords> {
  const fromApi = datasets[0]?.bridge.groups;
  const out = {} as Record<BridgeGroup, GroupWords>;
  for (const g of BRIDGE_GROUPS) {
    out[g] = fromApi?.[g] ?? { label: rows.find((r) => r.bridge_group === g)?.group_label ?? g, sub: '', help: '' };
  }
  return out;
}

function Projects({ scope, datasets }: { scope: ScopeResult; datasets: DatasetInfo[] }) {
  const { config, districts } = usePortal();
  const { hash } = useLocation();

  // #offices and #projects links land on their section once it has rendered.
  useEffect(() => {
    if (!hash) return;
    document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash, districts.status]);

  // The disclaimers of every response on this page: the project lists' and the districts'.
  const disclaimers = useMemo(() => {
    const byId = new Map<string, Disclaimer>(scope.disclaimers.map((d) => [d.id, d]));
    if (districts.status === 'ready') for (const env of districts.value) for (const d of env.disclaimers) if (!byId.has(d.id)) byId.set(d.id, d);
    return [...byId.values()];
  }, [scope.disclaimers, districts]);
  const name = shortNameOf(config);
  const all = scope.projects;
  const summary = useMemo(() => summarise(all), [all]);
  const groups = useMemo(() => groupInfo(datasets, all), [datasets, all]);
  const programName = (k: DatasetKey) => datasets.find((d) => d.key === k)?.short ?? k.toUpperCase();

  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const program = (params.get('program') ?? '') as DatasetKey | '';
  const status = (params.get('status') ?? '') as BridgeGroup | '';
  const why = params.get('why') ?? '';
  const office = params.get('office') ?? '';
  const sort = (params.get('sort') as Sort) in SORTS ? (params.get('sort') as Sort) : 'house';
  const [shown, setShown] = useState(PAGE);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setShown(PAGE);
  };

  /** Filter by status from a chart, and bring the list into view. */
  const pickStatus = (g: string) => {
    setParam('status', g);
    requestAnimationFrame(() => document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  useEffect(() => {
    const on = (e: Event) => pickStatus((e as CustomEvent<string>).detail);
    document.addEventListener('portal:status', on);
    return () => document.removeEventListener('portal:status', on);
  });

  // DPWH offices among the rows, largest first, for the Office filter.
  const offices = useMemo(() => {
    const n = new Map<string, number>();
    for (const p of all) if (p.office) n.set(p.office, (n.get(p.office) ?? 0) + 1);
    return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en', { numeric: true }));
  }, [all]);

  const reasons = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of all) for (const r of p.reasons) seen.set(`${r.kind}:${r.label}`, r.kind === 'office' ? `Office: ${shortOffice(r.label)}` : `Title names ${r.label}`);
    return [...seen.entries()];
  }, [all]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = all.filter((p) => {
      if (program && p.dataset !== program) return false;
      if (status && p.bridge_group !== status) return false;
      if (why && !p.reasons.some((r) => `${r.kind}:${r.label}` === why)) return false;
      if (office && p.office !== office) return false;
      if (words.length) {
        const hay = [p.title, p.program, p.pap, p.office, p.region].join(' ').toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    return rows.sort((a, b) => SORTS[sort].cmp(a, b) || a.title.localeCompare(b.title));
  }, [all, q, program, status, why, office, sort]);
  const filteredSummary = useMemo(() => summarise(filtered), [filtered]);
  const narrowed = filtered.length !== all.length;

  return (
    <>
      <div className="dash">
        <header className="banner dcard" style={{ '--i': 0 } as CSSProperties}>
          <div className="banner-bg" aria-hidden="true" />
          <div className="banner-copy">
            <p className="banner-kicker">
              <span className="live-dot" aria-hidden="true" /> FY 2027<span className="sep">·</span>NEP and House Bill 10858
            </p>
            <h1>
              {plural(summary.rows, 'project')} for {name}
              <span className="banner-h-sub"> in the 2027 national budget</span>
            </h1>
            <div className="banner-lede"><Lede summary={summary} /></div>
          </div>
          <div className="banner-actions">
            <a className="button button-light" href="#projects">See every project</a>
            {summary.groups.house_only.rows > 0 && (
              <button type="button" className="button button-glass" onClick={() => pickStatus('house_only')}>
                <span className="status-dot g-house_only" aria-hidden="true" />
                {plural(summary.groups.house_only.rows, 'House-only project')}
              </button>
            )}
          </div>
        </header>

        <Kpis summary={summary} rows={all} programName={programName} />

        <Card index={5} className="span-7" kicker="Compared, never added" title="NEP against the House bill">
          <Compare summary={summary} />
        </Card>

        <Card index={6} className="span-5" kicker="Click a slice to filter" title="What the House bill did">
          <Donut
            total={summary.rows}
            centerLabel="projects"
            active={status || undefined}
            onPick={(g) => pickStatus(status === g ? '' : g)}
            slices={BRIDGE_GROUPS.filter((g) => summary.groups[g].rows).map((g) => ({
              key: g,
              label: groups[g].label,
              value: summary.groups[g].rows,
              sub: groupAmount(g, summary.groups[g]),
              className: `g-${g}`,
            }))}
          />
        </Card>

        <Card index={7} className="span-7" kicker="By House bill amount" title="Largest projects" action={<a className="dcard-link" href="#projects">All {count(all.length)} →</a>}>
          <BarList
            items={[...all]
              .sort((a, b) => (b.house_php ?? b.nep_php ?? 0) - (a.house_php ?? a.nep_php ?? 0))
              .slice(0, 7)
              .map((p) => ({
                key: p.key,
                label: shortTitle(p.title),
                value: p.house_php ?? p.nep_php ?? 0,
                to: `/projects/${p.dataset}/${encodeURIComponent(p.id)}`,
                className: `fill-${p.bridge_group}`,
                meta: p.status_label,
                tip: `${p.title} · ${p.status_label} · NEP ${php(p.nep_php)}, House bill ${php(p.house_php)}`,
              }))}
          />
        </Card>

        <Card index={8} className="span-5" kicker="Enacted, not spent" title="Budgets 2020–2026" action={<Link className="dcard-link" to="/gaa">Open →</Link>}>
          <EnactedTrend />
        </Card>

        <aside className="dcard why span-12" style={{ '--i': 9 } as CSSProperties} aria-labelledby="why-h">
          <div className="why-mark" aria-hidden="true"><Icon name="plus" /></div>
          <div className="why-body">
            <p className="dcard-kicker">A note from Glen</p>
            <h2 id="why-h" className="dcard-title">Why I built this</h2>
            <p>
              As a Filipino citizen, I believe public money should be easy for anyone to see and check. Making the budget
              transparent is one of my personal advocacies, and this portal is my small part in it: a free, independent
              view of where the 2027 national budget is set to go in {name}, with the source behind every figure.
            </p>
            <p>
              None of it would exist without <a href="https://bettergov.ph" target="_blank" rel="noopener">BetterGov.ph</a>, the
              volunteer-run, open-source civic tech movement Filipino developer Jason Torres started in 2025. Its volunteers
              built the Budget API behind every figure here and the{' '}
              <a href="https://github.com/bettergovph/transparency-portal" target="_blank" rel="noopener">open-source portal</a> this
              one is built on, so anyone can do the same for their own city.
            </p>
            <p className="why-fine">
              I'm not paid for this and not affiliated with any government office, official or party. It makes no
              allegations: it shows what the published NEP and House bill say, as BetterGov.ph's open data reads them. I'm not part of the BetterGov.ph team; I'm one of the people building on their work.
            </p>
          </div>
          <a className="why-sign" href="/about/">
            <span className="footer-by-mark" aria-hidden="true" />
            <span><b>Glen Tenorio</b><span>Batangas, Philippines</span></span>
          </a>
        </aside>

        <div className="span-12 dash-offices" id="offices">
          <OfficesSection />
        </div>
      </div>

      <section className="section dcard dcard-table" id="projects" aria-labelledby="list-h" style={{ '--i': 9 } as CSSProperties}>
        <div className="list-head">
          <h2 id="list-h" className="section-h">
            {narrowed ? `${count(filtered.length)} of ${plural(all.length, 'project')}` : `Every project (${count(all.length)})`}
          </h2>
          <button type="button" className="button button-quiet" onClick={() => downloadText(`${config.id}-fy2027-projects.csv`, projectsCsv(filtered))}>
            Download CSV{narrowed ? ` (${count(filtered.length)})` : ''}
          </button>
        </div>

        <div className="toolbar">
          <label className="field field-grow">
            <span className="label">Search</span>
            <input type="search" value={q} placeholder="Barangay, road, school, office…" onChange={(e) => setParam('q', e.target.value)} />
          </label>
          <label className="field">
            <span className="label">Program</span>
            <select value={program} onChange={(e) => setParam('program', e.target.value)}>
              <option value="">All programs</option>
              {(Object.keys(summary.byDataset) as DatasetKey[]).map((k) => (
                <option key={k} value={k}>{programName(k)} ({count(summary.byDataset[k]!.rows)})</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="label">Status</span>
            <select value={status} onChange={(e) => setParam('status', e.target.value)}>
              <option value="">Any status</option>
              {BRIDGE_GROUPS.filter((g) => summary.groups[g].rows).map((g) => (
                <option key={g} value={g}>{groups[g].label} ({count(summary.groups[g].rows)})</option>
              ))}
            </select>
          </label>
          {offices.length > 1 && (
            <label className="field">
              <span className="label">DPWH office</span>
              <select value={office} onChange={(e) => setParam('office', e.target.value)}>
                <option value="">Any office</option>
                {offices.map(([o, n]) => <option key={o} value={o}>{shortOffice(o)} ({count(n)})</option>)}
              </select>
            </label>
          )}
          {reasons.length > 1 && (
            <label className="field">
              <span className="label">Listed because</span>
              <select value={why} onChange={(e) => setParam('why', e.target.value)}>
                <option value="">Any reason</option>
                {reasons.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span className="label">Sort by</span>
            <select value={sort} onChange={(e) => setParam('sort', e.target.value === 'house' ? '' : e.target.value)}>
              {(Object.keys(SORTS) as Sort[]).map((k) => <option key={k} value={k}>{SORTS[k].label}</option>)}
            </select>
          </label>
        </div>

        {narrowed && (
          <p className="filter-sums">
            These {count(filtered.length)}: NEP {php(filteredSummary.nep.php)} on {count(filteredSummary.nep.rows)}
            <span className="sep">·</span>House bill {php(filteredSummary.house.php)} on {count(filteredSummary.house.rows)}
            <span className="sep">·</span>
            <button type="button" className="link-button" onClick={() => { setParams(new URLSearchParams(), { replace: true }); setShown(PAGE); }}>
              Clear filters
            </button>
          </p>
        )}

        <ProjectTable rows={filtered.slice(0, shown)} programName={programName} />

        {filtered.length === 0 && <p className="state">No project matches. Try fewer words or clear the filters.</p>}
        {filtered.length > shown && (
          <div className="more">
            <span className="muted">Showing {count(shown)} of {count(filtered.length)}</span>
            <button type="button" className="button" onClick={() => setShown((n) => n + PAGE)}>Show {count(Math.min(PAGE, filtered.length - shown))} more</button>
            <button type="button" className="button button-quiet" onClick={() => setShown(filtered.length)}>Show all</button>
          </div>
        )}

        <p className="fine">
          Amounts are in pesos, as each document publishes them. A dash means that document has no such line. The NEP
          and the House bill are two versions of one budget: their totals are compared, never added.
        </p>
      </section>

      <Disclaimers items={disclaimers} compact />
    </>
  );
}

/** "Bohol 1st District Engineering Office" → "Bohol 1st DEO", for tight spaces. */
function shortOffice(office: string): string {
  return office.replace(/ District Engineering Office$/, ' DEO');
}

function groupAmount(g: BridgeGroup, c: { nep_php: number; house_php: number; rows: number }): string {
  if (!c.rows) return '—';
  switch (g) {
    case 'nep_only': return php(c.nep_php);
    case 'increased':
    case 'decreased':
    case 'scope_review': return phpDelta(c.house_php - c.nep_php);
    default: return php(c.house_php);
  }
}

function Lede({ summary }: { summary: Summary }) {
  const added = summary.groups.house_only.rows;
  const dropped = summary.groups.nep_only.rows;
  return (
    <p>
      The NEP lists {count(summary.nep.rows)} of them, for {php(summary.nep.php)}; the House bill lists{' '}
      {count(summary.house.rows)}, for {php(summary.house.php)}.{' '}
      {added || dropped ? (
        <>
          {plural(added, 'project is', 'projects are')} in the House bill only and {count(dropped)} in the NEP only: candidates
          to check, not confirmed changes.
        </>
      ) : (
        <>Every project is in both.</>
      )}
    </p>
  );
}

/** "Construction of Multi-Purpose Building, Barangay X, Tanauan City, Batangas" → without the city and province. */
function shortTitle(t: string): string {
  return t.replace(/,?\s*Tanauan City,?\s*Batangas.*$/i, '').replace(/,?\s*Batangas\s*$/i, '');
}

function KpiHead({ icon, label, hint, badge }: { icon: IconName; label: string; hint?: string; badge?: ReactNode }) {
  return (
    <div className="kpi-head">
      <span className="kpi-icon" aria-hidden="true"><Icon name={icon} /></span>
      <p className="kpi-label">{label}{hint && <span className="kpi-hint">{hint}</span>}</p>
      {badge}
    </div>
  );
}

function Kpis({ summary, rows, programName }: { summary: Summary; rows: ScopedProject[]; programName: (k: DatasetKey) => string }) {
  const grown = useGrown();
  const programs = (Object.entries(summary.byDataset) as [DatasetKey, { rows: number }][]).sort((a, b) => b[1].rows - a[1].rows);
  const max = Math.max(summary.nep.php, summary.house.php, 1);
  const houseOnly = summary.groups.house_only;
  const diff = summary.house.php - summary.nep.php;
  const pctChange = summary.nep.php ? Math.round((diff / summary.nep.php) * 100) : 0;
  // House-only first, then the rest, so the dots read as a share.
  const order: BridgeGroup[] = ['house_only', 'increased', 'decreased', 'scope_review', 'unchanged', 'nep_only'];
  const dots = [...rows]
    .sort((a, b) => order.indexOf(a.bridge_group) - order.indexOf(b.bridge_group))
    .map((p) => ({ key: p.key, className: `g-${p.bridge_group}`, title: `${shortTitle(p.title)} · ${p.status_label} · ${php(p.house_php ?? p.nep_php)}` }));
  const scale = (v: number) => (grown ? `${(v / max) * 100}%` : '0%');
  return (
    <>
      <div className="dcard kpi span-3" style={{ '--i': 1 } as CSSProperties}>
        <KpiHead icon="projects" label="Projects" hint="in the 2027 budget" />
        <p className="kpi-value num"><CountUp value={summary.rows} format={count} /></p>
        <DotMatrix items={dots} />
        <p className="kpi-sub">{programs.map(([k, c]) => `${programName(k)} ${count(c.rows)}`).join(' · ')}</p>
      </div>
      <div className="dcard kpi span-3" style={{ '--i': 2 } as CSSProperties}>
        <KpiHead icon="doc" label="NEP" hint="as proposed" />
        <p className="kpi-value num"><CountUp value={summary.nep.php} format={php} /></p>
        <div className="kpi-scale" aria-hidden="true">
          <span className="kpi-scale-row is-me" data-tip={`NEP: ${php(summary.nep.php)}`}><i style={{ width: scale(summary.nep.php) }} /></span>
          <span className="kpi-scale-row" data-tip={`House bill: ${php(summary.house.php)}`}><i style={{ width: scale(summary.house.php) }} /></span>
        </div>
        <p className="kpi-sub">{plural(summary.nep.rows, 'project')} · against the House bill below it</p>
      </div>
      <div className="dcard kpi kpi-accent span-3" style={{ '--i': 3 } as CSSProperties}>
        <KpiHead
          icon="capitol"
          label="House bill"
          hint="as passed"
          badge={diff !== 0 ? <span className={`kpi-delta ${diff > 0 ? 'up' : 'down'}`}>{diff > 0 ? '▲' : '▼'} {Math.abs(pctChange)}%</span> : undefined}
        />
        <p className="kpi-value num"><CountUp value={summary.house.php} format={php} /></p>
        <div className="kpi-scale" aria-hidden="true">
          <span className="kpi-scale-row" data-tip={`NEP: ${php(summary.nep.php)}`}><i style={{ width: scale(summary.nep.php) }} /></span>
          <span className="kpi-scale-row is-me" data-tip={`House bill: ${php(summary.house.php)}`}><i style={{ width: scale(summary.house.php) }} /></span>
        </div>
        <p className="kpi-sub">{plural(summary.house.rows, 'project')} · {phpDelta(diff)} against the NEP</p>
      </div>
      <button
        type="button"
        className="dcard kpi kpi-pop span-3"
        style={{ '--i': 4 } as CSSProperties}
        onClick={() => document.dispatchEvent(new CustomEvent('portal:status', { detail: 'house_only' }))}
      >
        <KpiHead icon="plus" label="House bill only" hint="not in the NEP" />
        <div className="kpi-row">
          <p className="kpi-value num"><CountUp value={houseOnly.rows} format={count} /></p>
          <span data-tip={`${php(houseOnly.house_php)} of ${php(summary.house.php)}: the share of the House bill total in lines the NEP does not have`}>
            <Ring share={summary.house.php ? houseOnly.house_php / summary.house.php : 0} className="ring-pop" />
          </span>
        </div>
        <p className="kpi-sub">{php(houseOnly.house_php)} of the House total · <span className="kpi-go">See them →</span></p>
      </button>
    </>
  );
}

/** The two versions on one scale. Each bar splits off the lines found in only that version. */
function Compare({ summary }: { summary: Summary }) {
  const grown = useGrown();
  const max = Math.max(summary.nep.php, summary.house.php, 1);
  const nepOnly = summary.groups.nep_only.nep_php;
  const houseOnly = summary.groups.house_only.house_php;
  const pct = (v: number) => (grown ? `${(Math.max(v, 0) / max) * 100}%` : '0%');
  const rows = [
    { key: 'nep', name: 'NEP', sub: `Proposed by the President · ${plural(summary.nep.rows, 'project')}`, total: summary.nep.php, both: summary.nep.php - nepOnly, only: nepOnly, onlyClass: 'seg-nep-only' },
    { key: 'house', name: 'House bill', sub: `As the House passed it · ${plural(summary.house.rows, 'project')}`, total: summary.house.php, both: summary.house.php - houseOnly, only: houseOnly, onlyClass: 'seg-house-only' },
  ];
  return (
    <div className="cmp">
      {rows.map((r, i) => (
        <div key={r.key} className={`cmp-row k-${r.key}`}>
          <div className="cmp-head">
            <span className="cmp-name">{r.name}<span className="cmp-sub">{r.sub}</span></span>
            <span className="cmp-amount num"><CountUp value={r.total} format={php} /></span>
          </div>
          <div className="cmp-track" aria-hidden="true">
            <span className="seg seg-both" style={{ width: pct(r.both), transitionDelay: `${200 + i * 150}ms` }} data-tip={`${r.name}, lines in both versions: ${php(r.both)}`} />
            {r.only > 0 && <span className={`seg ${r.onlyClass}`} style={{ width: pct(r.only), transitionDelay: `${500 + i * 150}ms` }} data-tip={`${r.key === 'house' ? 'In the House bill only' : 'In the NEP only'}: ${php(r.only)}. A candidate to check, not a finding.`} />}
          </div>
        </div>
      ))}
      <ul className="cmp-key">
        <li><span className="sw sw-both" />In both versions</li>
        {houseOnly > 0 && <li><span className="sw sw-house-only" />House bill only · {php(houseOnly)}</li>}
        {nepOnly > 0 && <li><span className="sw sw-nep-only" />NEP only · {php(nepOnly)}</li>}
      </ul>
      <p className="cmp-foot">Lines found in one version only are candidates to check, not findings.</p>
    </div>
  );
}

/** The enacted budgets by year, loaded on demand (searches every department once, then cached). */
function EnactedTrend() {
  const { client, config } = usePortal();
  const [state, setState] = useState<{ points: { x: string; y: number; sub: string }[] } | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    loadGaa(client, config)
      .then((g) => live && setState({ points: gaaYearTotals(g.rows).map((t) => ({ x: String(t.year), y: t.amount, sub: plural(t.programs, 'program') })) }))
      .catch((e: Error) => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [client, config]);
  if (!state) return <div className="skeleton" aria-label="Loading the enacted budgets" role="status"><span /><span /><span /></div>;
  if ('error' in state) return <p className="state state-error">Could not load: {state.error}</p>;
  const peak = state.points.reduce((a, b) => (b.y > a.y ? b : a), state.points[0]);
  const first = state.points[0];
  const last = state.points[state.points.length - 1];
  return (
    <>
      <AreaChart points={state.points} />
      {peak && (
        <dl className="trend-stats">
          <div className="is-peak"><dt>Peak · {peak.x}</dt><dd className="num">{php(peak.y)}</dd></div>
          <div><dt>{first.x}</dt><dd className="num">{php(first.y)}</dd></div>
          <div><dt>{last.x}</dt><dd className="num">{php(last.y)}</dd></div>
        </dl>
      )}
      <p className="trend-note">Programs whose names place them in {config.shortName ?? config.name}. Each year stands alone; years are never added.</p>
    </>
  );
}

/** What kind of work a line is, from its title: for the row icon. */
function kindOf(p: ScopedProject): { icon: IconName; label: string } {
  const t = p.title.toLowerCase();
  if (p.dataset === 'fmr' || /farm-to-market|\bfmr\b/.test(t)) return { icon: 'sprout', label: 'Farm-to-market road' };
  if (/flood|drainage|canal|slope protection|river/.test(t)) return { icon: 'water', label: 'Flood control and drainage' };
  if (/bridge|\bbr\.?\b/.test(t)) return { icon: 'bridge', label: 'Bridge' };
  if (/\broad\b|\brd\b|street|concreting|circumferential|diversion/.test(t)) return { icon: 'road', label: 'Road' };
  if (/building|hall|school|center|centre|court|office/.test(t)) return { icon: 'building', label: 'Building' };
  return { icon: 'projects', label: 'Project' };
}

/** "…, Barangay Darasa, Tanauan, Batangas" → "Brgy. Darasa". */
function barangayOf(title: string): string | null {
  const m = /\b(?:Barangay|Brgy\.?)\s+([A-Z][\w.ñÑ-]*(?:\s+(?!Tanauan)[A-Z0-9][\w.ñÑ-]*)*)/.exec(title);
  return m ? `Brgy. ${m[1].replace(/[,.]$/, '')}` : null;
}

/** The title without the city and province, and without the barangay when it is shown as a tag. */
function rowTitle(title: string, brgy: string | null): string {
  let t = shortTitle(title).replace(/,?\s*Tanauan(?: City)?\s*$/i, '');
  if (brgy) t = t.replace(/,?\s*(?:at\s+)?(?:Barangay|Brgy\.?)\s+[^,]+(?=,|$)/, '').replace(/\s+,/g, ',');
  return t.replace(/[,\s]+$/, '');
}

function ChangeBadge({ p }: { p: ScopedProject }) {
  switch (p.bridge_group) {
    case 'house_only': return <span className="chg chg-new">New in House</span>;
    case 'nep_only': return <span className="chg chg-dropped">Dropped</span>;
    case 'unchanged': return <span className="chg chg-same">No change</span>;
    case 'increased': return <span className="chg chg-up">{phpDelta(p.delta_php)}</span>;
    case 'decreased': return <span className="chg chg-down">{phpDelta(p.delta_php)}</span>;
    default: return <span className="chg chg-same">{phpDelta(p.delta_php)}</span>;
  }
}

function ProjectTable({ rows, programName }: { rows: ScopedProject[]; programName: (k: DatasetKey) => string }) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map((p) => Math.max(p.house_php ?? 0, p.nep_php ?? 0)), 1);
  const w = (v: number | null | undefined) => `${((v ?? 0) / max) * 100}%`;
  return (
    <div className="ptable" role="table" aria-label="Projects">
      <div className="prow prow-head" role="row">
        <span role="columnheader" className="pc-project">Project</span>
        <span role="columnheader">Status</span>
        <span role="columnheader">NEP → House bill</span>
        <span role="columnheader" className="r">Change</span>
      </div>
      {rows.map((p) => {
        const kind = kindOf(p);
        const brgy = barangayOf(p.title);
        return (
          <div className={`prow g-row-${p.bridge_group}`} role="row" key={p.key}>
            <span role="cell" className="pc-project">
              <span className={`ptype t-${kind.icon}`} data-tip={kind.label}><Icon name={kind.icon} /></span>
              <span className="pc-text">
                <Link to={`/projects/${p.dataset}/${encodeURIComponent(p.id)}`} className="ptitle" data-tip={p.title}>
                  {rowTitle(p.title, brgy)}
                </Link>
                <span className="pmeta">
                  {brgy && <span className="ploc">{brgy}</span>}
                  <span className="pprog">{programName(p.dataset)}</span>
                  {p.office && <span>{shortOffice(p.office)}</span>}
                  {p.held && <span className="tag tag-warn" data-tip="Unconfirmed match: the pairing is fuzzy or ambiguous.">unconfirmed</span>}
                </span>
              </span>
            </span>
            <span role="cell" className="pc-status">
              <span className={`pill pill-${p.bridge_group}`}>{p.status_label}</span>
            </span>
            <span role="cell" className="pc-amounts">
              <span className="amt-line">
                <span className="amt-k">NEP</span>
                <span className="amt-bar2"><i className="k-nep" style={{ width: w(p.nep_php) }} /></span>
                <span className="amt-v num">{php(p.nep_php)}</span>
              </span>
              <span className="amt-line is-house">
                <span className="amt-k">House</span>
                <span className="amt-bar2"><i className={`k-house-${p.bridge_group}`} style={{ width: w(p.house_php) }} /></span>
                <span className="amt-v num">{php(p.house_php)}</span>
              </span>
            </span>
            <span role="cell" className="pc-change r"><ChangeBadge p={p} /></span>
          </div>
        );
      })}
    </div>
  );
}
