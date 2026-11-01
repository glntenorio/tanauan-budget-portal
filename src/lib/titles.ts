/**
 * Reading project titles for display: the kind of work (for the icon), the
 * barangay (for a tag), and a shorter title without the city and province.
 * Display only: the full title is always one hover or click away.
 */
import type { IconName } from '../components/Dash';

/** "Construction of Multi-Purpose Building, Barangay X, Tanauan City, Batangas" → without the city and province. */
export function shortTitle(t: string): string {
  return t.replace(/,?\s*Tanauan City,?\s*Batangas.*$/i, '').replace(/,?\s*Batangas\s*$/i, '');
}

/** What kind of work a line is, from its title: for the row icon. */
export function kindOf(p: { dataset: string; title: string }): { icon: IconName; label: string } {
  const t = p.title.toLowerCase();
  if (p.dataset === 'fmr' || /farm-to-market|\bfmr\b/.test(t)) return { icon: 'sprout', label: 'Farm-to-market road' };
  if (/flood|drainage|canal|slope protection|river/.test(t)) return { icon: 'water', label: 'Flood control and drainage' };
  if (/bridge|\bbr\.?\b/.test(t)) return { icon: 'bridge', label: 'Bridge' };
  if (/\broad\b|\brd\b|street|concreting|circumferential|diversion/.test(t)) return { icon: 'road', label: 'Road' };
  if (/building|hall|school|center|centre|court|office/.test(t)) return { icon: 'building', label: 'Building' };
  return { icon: 'projects', label: 'Project' };
}

/** "…, Barangay Darasa, Tanauan, Batangas" → "Brgy. Darasa". */
export function barangayOf(title: string): string | null {
  // Name words are capitalised; all-caps codes ("FMR") and the city are not part of it.
  const m = /\b(?:Barangay|Brgy\.?)\s+((?![A-Z]{2,}\b)(?!Hall\b)[A-Z][\w.ñÑ-]*(?:\s+(?!Tanauan\b)(?![A-Z]{2,}\b)[A-Z0-9][\w.ñÑ-]*)*)/.exec(title);
  return m ? `Brgy. ${m[1].replace(/[,.]$/, '')}` : null;
}

/** The title without the city and province, and without the barangay when it is shown as a tag. */
export function rowTitle(title: string, brgy: string | null): string {
  let t = shortTitle(title).replace(/,?\s*Tanauan(?: City)?\s*$/i, '');
  // Only a trailing ", Barangay X" clause moves to the tag; "of Brgy. X Road" is part of the name.
  if (brgy) {
    t = t.replace(/,\s*(?:at\s+)?(?:Barangay|Brgy\.?)\s+[^,]+(?=,|$)/, '');
    // A trailing "… at Barangay X" or "… - Barangay X" (not "of Brgy. X …").
    t = t.replace(/(?<!\bof)\s+(?:at\s+|-\s+)?(?:Barangay|Brgy\.?)\s+(?!Hall\b)[^,()]+$/, '');
  }
  return t.replace(/[,\s]+$/, '');
}
