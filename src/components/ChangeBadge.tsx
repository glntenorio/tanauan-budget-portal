import type { BridgeGroup } from '../api/types';
import { phpDelta } from '../lib/format';

/** What the House bill did to a line, as a small badge. */
export function ChangeBadge({ p }: { p: { bridge_group: BridgeGroup; delta_php: number | null } }) {
  switch (p.bridge_group) {
    case 'house_only': return <span className="chg chg-new">New in House</span>;
    case 'nep_only': return <span className="chg chg-dropped">Dropped</span>;
    case 'unchanged': return <span className="chg chg-same">No change</span>;
    case 'increased': return <span className="chg chg-up">{phpDelta(p.delta_php)}</span>;
    case 'decreased': return <span className="chg chg-down">{phpDelta(p.delta_php)}</span>;
    default: return <span className="chg chg-same">{phpDelta(p.delta_php)}</span>;
  }
}
