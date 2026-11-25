// Answers general questions ("Who is Mahatma Gandhi?", "What is diabetes?")
// from Wikipedia, in the elder's own language. Free, no login, no key.
// Only the question words are sent to Wikipedia — nothing about the elder.
import { lang, keywords } from './i18n.js';

const MAX_CHARS = 420;

// Remove "what is", "क्या है", "എന്താണ്", "म्हणजे काय"... so only the topic is searched.
export function topicOf(text) {
  let q = ` ${text.toLowerCase()} `;
  const phrases = [...keywords('wiki'), ...keywords('wiki_stop')].sort((a, b) => b.length - a.length);
  for (const p of phrases) {
    if (/^[a-z' ]+$/.test(p)) q = q.replace(new RegExp(`(^|\\s)${p}(?=\\s|$)`, 'g'), ' ');
    else q = q.split(p).join(' ');
  }
  return q.replace(/[?？!.,।]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Make the text easy to listen to: drop brackets (pronunciations, dates in
// other scripts) and keep the first two sentences.
function tidy(s) {
  let prev;
  do { prev = s; s = s.replace(/\s*\([^()]*\)/g, ''); } while (s !== prev); // nested brackets too
  s = s.replace(/\s*\[[^\]]*\]/g, '').replace(/\s+([,.।])/g, '$1').replace(/\s+/g, ' ').trim();
  // Split into sentences, but not at initials like "A.P.J." or "ए.पी.".
  const sentences = [];
  let startAt = 0;
  for (let i = 0; i < s.length; i++) {
    if (!'.।!?'.includes(s[i]) || (s[i + 1] && s[i + 1] !== ' ')) continue;
    const word = s.slice(0, i).split(' ').pop().replace(/.*\./, '');
    if (s[i] === '.' && word.length < 3) continue;
    sentences.push(s.slice(startAt, i + 1)); startAt = i + 1;
  }
  if (startAt < s.length) sentences.push(s.slice(startAt));
  let out = '';
  for (const x of sentences.slice(0, 2)) {
    if (out && (out + x).length > MAX_CHARS) break;
    out += x;
  }
  return (out.length > MAX_CHARS + 200 ? out.slice(0, MAX_CHARS) + '…' : out || s.slice(0, MAX_CHARS)).trim();
}

// First try the exact article name (e.g. "Taj Mahal"), then a normal search.
async function search(site, topic) {
  return (await lookup(site, { titles: topic })) || lookup(site, { generator: 'search', gsrsearch: topic, gsrlimit: '1' });
}

async function lookup(site, how) {
  const url = `https://${site}.wikipedia.org/w/api.php?` + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', redirects: '1',
    prop: 'extracts|info|pageprops', exintro: '1', explaintext: '1', inprop: 'url', ...how,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const data = await res.json();
    const page = data.query && Object.values(data.query.pages)[0];
    if (!page || page.missing !== undefined || !page.extract || page.extract.length < 20) return null;
    if (page.pageprops && page.pageprops.disambiguation !== undefined) return null; // "may refer to…" pages
    return { title: page.title, text: tidy(page.extract), url: page.fullurl, site };
  } finally {
    clearTimeout(timer);
  }
}

// The same article in another language, using Wikipedia's own language links.
async function sameArticleIn(site, enTitle) {
  const url = 'https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action: 'query', format: 'json', origin: '*', prop: 'langlinks', lllang: site, titles: enTitle,
  });
  const data = await (await fetch(url)).json();
  const page = data.query && Object.values(data.query.pages)[0];
  const link = page && page.langlinks && page.langlinks[0];
  return link ? lookup(site, { titles: link['*'] }) : null;
}

// Does the article really talk about what was asked? (avoids odd search matches)
function relevant(r, topic) {
  const hay = (r.title + ' ' + r.text).toLowerCase();
  return topic.split(' ').filter((w) => w.length >= 2).some((w) => hay.includes(w.slice(0, Math.max(2, w.length - 2))));
}

// Returns { title, text, url } or null. { offline: true } when there is no internet.
export async function wikiAnswer(question) {
  const topic = topicOf(question);
  if (topic.length < 2) return null;
  if (!navigator.onLine) return { offline: true };
  const site = lang().wiki || lang().code;
  try {
    // Names typed or heard in English letters ("APJ Abdul Kalam") while using
    // Hindi/Malayalam/Marathi: find the English article, then read the same
    // article in the elder's language (English if there is none).
    if (site !== 'en' && /^[a-z0-9 ]+$/i.test(topic)) {
      const en = await search('en', topic);
      if (!en) return null;
      return (await sameArticleIn(site, en.title)) || en;
    }
    const r = await search(site, topic);
    return r && relevant(r, topic) ? r : null;
  } catch (e) {
    return null; // network problem or timeout
  }
}
