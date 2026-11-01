import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { Envelope, ProjectDetail, Version } from '../api/types';
import { DATASET_KEYS, shortNameOf, type DatasetKey } from '../config';
import { Await, Disclaimers, ReasonTags } from '../components/Bits';
import { ChangeBadge } from '../components/ChangeBadge';
import { Card, CountUp, Icon } from '../components/Dash';
import { barangayOf, kindOf, rowTitle } from '../lib/titles';
import { php, phpFull } from '../lib/format';
import { usePortal, type Async } from '../lib/portal-context';
import { projectKey } from '../lib/scope';
import { reportHref } from '../lib/report';
import { useTitle } from '../lib/use-title';

const VERSIONS: Version[] = ['nep', 'hgab2', 'hgab3', 'api'];
const FALLBACK_VERSION_LABELS: Record<Version, string> = {
  nep: 'NEP',
  hgab2: 'House bill, second reading',
  hgab3: 'House bill, third reading',
  api: 'DPWH transparency website listing',
};

export default function Project() {
  const { dataset = '', id = '' } = useParams();
  const { client } = usePortal();
  const valid = (DATASET_KEYS as readonly string[]).includes(dataset);
  const [state, setState] = useState<{ key: string; value: Async<Envelope<ProjectDetail>> } | null>(null);
  const key = `${dataset}/${id}`;

  useEffect(() => {
    if (!valid) return;
    let live = true;
    client.project(dataset as DatasetKey, id).then(
      (value) => live && setState({ key, value: { status: 'ready', value } }),
      (error) => live && setState({ key, value: { status: 'error', error: error instanceof Error ? error : new Error(String(error)) } }),
    );
    return () => {
      live = false;
    };
  }, [client, dataset, id, key, valid]);

  if (!valid) {
    return (
      <main className="page main">
        <p className="state">There is no program called “{dataset}”. <Link to="/">Back to every project</Link></p>
      </main>
    );
  }
  const current: Async<Envelope<ProjectDetail>> = state?.key === key ? state.value : { status: 'loading' };
  return (
    <main className="page main">
      <Await state={current} what="the project">
        {(env) => <ProjectView env={env} />}
      </Await>
    </main>
  );
}

function ProjectView({ env }: { env: Envelope<ProjectDetail> }) {
  const { config, overview, scope, client } = usePortal();
  const location = useLocation();
  const p = env.data;
  useTitle(
    `${p.title.length > 48 ? `${p.title.slice(0, 46).replace(/[\s,.-]+\S*$/, '')}…` : p.title} | ${shortNameOf(config)} 2027 Budget`,
    `${p.status_label}. NEP ${php(p.nep_php)}, House bill ${php(p.house_php)}${p.office ? `, ${p.office}` : ''}. With the source pages in the 2027 budget documents.`.slice(0, 158),
  );

  const ov = overview.status === 'ready' ? overview.value.data : null;
  const program = ov?.datasets.find((d) => d.key === p.dataset);
  const versionLabel = (v: Version) => ov?.record_versions.find((r) => r.key === v)?.label ?? FALLBACK_VERSION_LABELS[v];
  const inScope = scope.status === 'ready' ? scope.value.projects.find((x) => x.key === projectKey(p.dataset, p.id)) : undefined;
  const versions = VERSIONS.filter((v) => v !== 'api' || p.dataset === 'dpwh');
  const report = reportHref(config, p, window.location.origin + location.pathname);

  const details: [string, string | null][] = [
    ['Program', program?.label ?? p.dataset.toUpperCase()],
    ['Program line', p.program],
    ['Sub-line', p.pap],
    ['DPWH office', p.office],
    ['Region', p.region],
    ['How the two versions were matched', p.labels.match?.label ?? null],
    ['Between the House readings', p.labels.reading?.label ?? null],
    ['DPWH transparency website', p.labels.dpwh_site?.label ?? null],
    ['Length', p.length_m != null ? `${Math.round(p.length_m).toLocaleString('en-US')} m` : null],
  ];

  const kind = kindOf(p);
  const brgy = barangayOf(p.title);
  const steps = versions.map((v) => ({
    v,
    label: versionLabel(v),
    amount: p[`${v}_php` as const],
    pdf: p.pdf_url[v],
    page: v === 'api' ? null : p[`${v}_page` as const],
  }));
  const max = Math.max(1, ...steps.map((x) => x.amount ?? 0));
  const all = scope.status === 'ready' ? scope.value.projects : [];
  const here = projectKey(p.dataset, p.id);
  // Other lines in the same barangay first, then the same kind of work.
  const related = [
    ...all.filter((x) => x.key !== here && brgy && barangayOf(x.title) === brgy),
    ...all.filter((x) => x.key !== here && kindOf(x).icon === kind.icon && !(brgy && barangayOf(x.title) === brgy)),
  ].slice(0, 4);
  const lat = p.lat;
  const lon = p.lon;

  return (
    <article className="project2">
      <header className="dcard phero" style={{ '--i': 0 } as CSSProperties}>
        <div className="phero-main">
          <Link to="/" className="phero-back">← All projects</Link>
          <div className="phero-title">
            <span className={`ptype ptype-lg t-${kind.icon}`} data-tip={kind.label}><Icon name={kind.icon} /></span>
            <div>
              <p className="dcard-kicker">
                {program?.short ?? p.dataset.toUpperCase()}<span className="sep">·</span>FY 2027<span className="sep">·</span>{kind.label}
              </p>
              <h1 className="project2-h">{rowTitle(p.title, brgy)}</h1>
            </div>
          </div>
          <div className="phero-tags">
            <span className={`pill pill-${p.bridge_group}`}>{p.status_label}</span>
            {brgy && <span className="ploc">{brgy}</span>}
            {p.office && <span className="phero-tag">{p.office}</span>}
            {p.region && <span className="phero-tag">{p.region}</span>}
            {p.held && <span className="tag tag-warn" data-tip="Unconfirmed match: the pairing is fuzzy or ambiguous.">unconfirmed match</span>}
          </div>
          {p.labels.status.help && <p className="phero-help">{p.labels.status.help}</p>}
          {p.title !== rowTitle(p.title, brgy) && <p className="phero-full"><span className="label">Full title</span> {p.title}</p>}
        </div>
        <dl className="phero-figs">
          <div className="is-house">
            <dt>House bill</dt>
            <dd className="num">{p.house_php == null ? '—' : <CountUp value={p.house_php} format={php} />}</dd>
          </div>
          <div>
            <dt>NEP</dt>
            <dd className="num">{p.nep_php == null ? '—' : <CountUp value={p.nep_php} format={php} />}</dd>
          </div>
          <div className="phero-change">
            <dt>Change</dt>
            <dd><ChangeBadge p={p} /></dd>
          </div>
        </dl>
      </header>

      <div className="project2-grid">
        <div className="project2-main">
          <Card index={1} kicker="Compared, never added" title="Version by version">
            <ol className="vsteps">
              {steps.map((st, i) => (
                <li key={st.v} className={`vstep${st.amount == null ? ' is-missing' : ''}`} style={{ '--i': i } as CSSProperties}>
                  <span className="vstep-dot" aria-hidden="true" />
                  <div className="vstep-body">
                    <div className="vstep-head">
                      <span className="vstep-label">{st.label}</span>
                      <span className="vstep-amount num" data-tip={st.amount == null ? 'Not listed in this version' : phpFull(st.amount)}>
                        {st.amount == null ? 'Not listed' : phpFull(st.amount)}
                      </span>
                    </div>
                    <span className="vstep-track" aria-hidden="true">
                      <i className={`k-${st.v}`} style={{ width: `${((st.amount ?? 0) / max) * 100}%`, transitionDelay: `${200 + i * 120}ms` }} />
                    </span>
                    {st.pdf ? (
                      <a className="vstep-src" href={st.pdf} target="_blank" rel="noopener">
                        <Icon name="doc" /> {st.page ? `Open page ${st.page}` : 'Open the document'} <span aria-hidden="true">↗</span>
                      </a>
                    ) : (
                      <span className="vstep-src is-none">No source page</span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="cmp-foot">
              The NEP and the House bill are two versions of one budget, so the amounts are compared, never added. Open the
              page to check each figure against the document itself.
            </p>
          </Card>

          {p.labels.flags.length > 0 && (
            <Card index={2} kicker="Read before quoting" title="Notes on this line">
              <ul className="pnotes">
                {p.labels.flags.map((f) => (
                  <li key={f.code}>
                    <span className="why-ico" aria-hidden="true"><Icon name="about" /></span>
                    <span><b>{f.label}</b>{f.help && <span>{f.help}</span>}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {related.length > 0 && (
            <Card index={3} kicker={brgy ? `Also in ${brgy} or similar` : 'Similar work'} title="More projects like this">
              <ul className="prelated">
                {related.map((x) => {
                  const k = kindOf(x);
                  const b = barangayOf(x.title);
                  return (
                    <li key={x.key}>
                      <Link to={`/projects/${x.dataset}/${encodeURIComponent(x.id)}`} className="prelated-row">
                        <span className={`ptype t-${k.icon}`}><Icon name={k.icon} /></span>
                        <span className="prelated-text">
                          <b>{rowTitle(x.title, b)}</b>
                          <span>{[b, x.status_label].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className="prelated-amt num">{php(x.house_php ?? x.nep_php)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <aside className="project2-side">
          {lat != null && lon != null && (
            <Card index={2} kicker="From the document's coordinates" title="On the map" className="pmap-card">
              <div className="pmap">
                <iframe
                  title={`Map: ${rowTitle(p.title, brgy)}`}
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.012}%2C${lat - 0.008}%2C${lon + 0.012}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lon}`}
                />
              </div>
              <a className="dcard-link" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`} target="_blank" rel="noopener">
                Open larger map ↗
              </a>
            </Card>
          )}

          <Card index={3} kicker="As the documents list it" title="Details">
            <dl className="pdetails">
              {details.filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
              <div>
                <dt>Why it is in this portal</dt>
                <dd>
                  {inScope ? (
                    <ReasonTags reasons={inScope.reasons} />
                  ) : (
                    <span className="muted">Not among this portal's projects; shown because you followed a link to it.</span>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card index={4} kicker="Check it yourself" title="Sources">
            <div className="psources">
              <a className="button button-primary" href={p.url} target="_blank" rel="noopener">On budget.bettergov.ph ↗</a>
              <a className="button" href={client.href(p.api_url)} target="_blank" rel="noopener">API record (JSON) ↗</a>
            </div>
            <div className="report2">
              <p><b>Seen this project on the ground?</b></p>
              {report ? (
                <a className="button" href={report}>Report on this project ↗</a>
              ) : (
                <p className="small">Citizen reports will go to one place for every portal, budget.bettergov.ph. Reporting is not open yet.</p>
              )}
            </div>
          </Card>
        </aside>
      </div>

      <Disclaimers items={env.disclaimers} />
    </article>
  );
}
