// Talking with Sitara: understanding a spoken "yes" or "no", and listening
// for one when a reminder or check-in asks a question.
import { keywords } from './i18n.js';
import * as voice from './voice.js';
import { micState } from './mic.js';
import { store } from './store.js';

const latin = /^[a-z0-9 '’]+$/i;
const hasWord = (text, kw) => (latin.test(kw)
  ? new RegExp(`(^|[^a-z])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`, 'i').test(text)
  : text.includes(kw));

// "yes" | "no" | null. The longest matching phrase wins, so "കുഴപ്പമില്ല"
// ("no problem") counts as yes even though it contains "ഇല്ല" ("no"), and
// "not yet" counts as no even though it contains "yet".
export function yesOrNo(alts) {
  let best = null; let bestLen = 0;
  for (const raw of alts || []) {
    const text = String(raw).toLowerCase().trim();
    for (const side of ['yes', 'no']) {
      for (const kw of keywords(side)) {
        if (kw.length > bestLen && hasWord(text, kw)) { best = side; bestLen = kw.length; }
      }
    }
    if (best) return best;
  }
  return best;
}

// Listen once for a yes/no answer, without ever making the phone ask for the
// microphone by surprise (only when it is already allowed).
export async function listenForYesNo() {
  const st = await micState();
  if (!(st === 'granted' || (st === 'unknown' && store.settings.micAsked))) return null;
  if (!voice.canListen()) return null;
  try {
    return yesOrNo(await voice.listen());
  } catch (e) {
    return null;
  }
}
