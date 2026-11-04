'use strict';
/** Stockage local en fichiers JSON (data/). Déduplication par bien, historique des prix, journal des exécutions. */
const fs = require('fs');
const path = require('path');
const { normalizeListing, propertyKey } = require('./connectors/normalize');

const DIR = process.env.IMMOIA_DATA || path.join(__dirname, 'data');
const file = (n) => path.join(DIR, n + '.json');
const read = (n, d) => { try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch (e) { return d; } };
const write = (n, v) => { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file(n), JSON.stringify(v, null, 2)); };

/**
 * Ajoute des annonces brutes. Un bien déjà connu (même clé) n'est pas dupliqué :
 * s'il réapparaît à un autre prix, l'historique s'allonge (=> baisses de prix).
 * @returns {{added:number, updated:number, skipped:number, rejected:{reason:string}[]}}
 */
function upsert(rawItems, today = new Date().toISOString().slice(0, 10), dir = DIR) {
  const listings = read('listings', []), rentals = read('rentals', []);
  const byKey = new Map(listings.map((l) => [l.key, l])), rentKey = new Map(rentals.map((l) => [l.key, l]));
  const res = { added: 0, updated: 0, skipped: 0, rejected: [] };
  for (const raw of rawItems) {
    const n = normalizeListing({ ...raw, date: raw.date || today });
    if (!n.ok) { res.rejected.push({ reason: n.reason }); continue; }
    const l = n.listing; l.key = propertyKey(l);
    if (l.kind === 'rent') {
      const known = rentKey.get(l.key);
      if (known && known.rent === l.rent) { res.skipped++; continue; }
      if (known) Object.assign(known, l, { firstSeen: known.firstSeen, lastSeen: today }); else { l.firstSeen = l.lastSeen = today; rentals.push(l); rentKey.set(l.key, l); }
      known ? res.updated++ : res.added++;
      continue;
    }
    const known = byKey.get(l.key);
    if (!known) { l.firstSeen = l.lastSeen = today; l.history = [{ date: today, price: l.price }]; listings.push(l); byKey.set(l.key, l); res.added++; continue; }
    known.lastSeen = today; if (l.url) known.url = l.url;
    const last = known.history[known.history.length - 1];
    if (last.price !== l.price) { known.history.push({ date: today, price: l.price }); known.price = l.price; res.updated++; } else res.skipped++;
  }
  write('listings', listings); write('rentals', rentals);
  return res;
}

/** Ajoute les champs dérivés (jours en ligne, baisses de prix) au moment de la lecture. */
function withDerived(l, today = new Date()) {
  const days = Math.max(0, Math.round((today - new Date(l.firstSeen)) / 864e5));
  let drops = 0;
  for (let i = 1; i < l.history.length; i++) if (l.history[i].price < l.history[i - 1].price) drops++;
  return { ...l, daysOnline: days, priceDrops: drops };
}

function appendJournal(entry) {
  const j = read('journal', []); j.push(entry); write('journal', j.slice(-90));
}

module.exports = { upsert, withDerived, appendJournal, read, write, DIR };
