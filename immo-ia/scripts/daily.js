'use strict';
/**
 * Mise à jour quotidienne : node scripts/daily.js
 *  1. DVF : prix médians réels (si le réseau l'autorise ; sinon les dernières données restent en place)
 *  2. Annonces fournisseur autorisé (LISTINGS_API_URL / LISTINGS_API_KEY), si configuré
 *  3. Dossier data/inbox : e-mails d'alerte (.txt, texte brut) et exports (.csv) à importer, puis rangés dans inbox/done
 *  4. Dédoublonnage, historique des prix, alertes de score, journal
 * Aucune étape ne bloque les autres : chaque échec est consigné dans data/journal.json.
 */
const fs = require('fs');
const path = require('path');
const store = require('../store');
const { parseAlert } = require('../connectors/seloger-alert');
const { parseListingsCsv } = require('../connectors/csv');

async function main({ today = new Date().toISOString().slice(0, 10), alertMin = +process.env.ALERT_MIN_SCORE || 70 } = {}) {
  const entry = { date: today, steps: {}, errors: [] };
  const fail = (step, e) => { entry.errors.push(`${step} : ${e.message}`); entry.steps[step] = { ok: false }; console.error(step, '→', e.message); };

  // 1. DVF
  try {
    const { sync } = require('../connectors/dvf');
    const r = await sync(String(new Date().getFullYear() - 1), undefined, path.join(store.DIR, 'market.json'));
    entry.steps.dvf = { ok: r.okCount > 0, communes: r.okCount };
    if (!r.okCount) entry.errors.push('dvf : aucune commune lue (réseau ou source indisponible) ; données précédentes conservées');
  } catch (e) { fail('dvf', e); }

  // 2. API fournisseur
  const incoming = [];
  try {
    const { fetchListings } = require('../connectors/api-adapter');
    const r = await fetchListings();
    entry.steps.api = r.skipped ? { skipped: r.skipped } : { ok: true, items: r.items.length };
    incoming.push(...r.items);
  } catch (e) { fail('api', e); }

  // 3. Dossier inbox
  const inbox = path.join(store.DIR, 'inbox'), done = path.join(inbox, 'done');
  let files = [];
  try { files = fs.readdirSync(inbox).filter((f) => /\.(txt|csv)$/i.test(f)); } catch (e) { /* pas de dossier : rien à importer */ }
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(inbox, f), 'utf8');
      const items = /\.csv$/i.test(f) ? parseListingsCsv(text) : parseAlert(text, { date: today });
      incoming.push(...items);
      fs.mkdirSync(done, { recursive: true });
      fs.renameSync(path.join(inbox, f), path.join(done, f));
    } catch (e) { fail('inbox/' + f, e); }
  }
  entry.steps.inbox = { files: files.length };

  // 4. Enregistrement
  const before = new Set((store.read('listings', [])).map((l) => l.key));
  const res = store.upsert(incoming, today);
  entry.added = res.added; entry.updated = res.updated; entry.skipped = res.skipped; entry.rejected = res.rejected.length;
  if (res.rejected.length) entry.rejectedReasons = [...new Set(res.rejected.map((r) => r.reason))];

  // 5. Alertes : nouveaux biens à vendre dont le score dépasse le seuil
  try {
    process.env.IMMOIA_DATA = store.DIR;
    const { analyze } = require('../analyzer');
    entry.alerts = store.read('listings', []).filter((l) => !before.has(l.key))
      .map((l) => ({ l, a: analyze(store.withDerived(l)).analysis }))
      .filter(({ a }) => a.valid && a.score >= alertMin)
      .map(({ l, a }) => ({ city: l.city, type: l.typeLabel, price: l.price, score: a.score, url: l.url }));
  } catch (e) { fail('alerts', e); }

  store.appendJournal(entry);
  console.log(`Ajoutées ${entry.added}, mises à jour ${entry.updated}, ignorées ${entry.skipped}, rejetées ${entry.rejected}, erreurs ${entry.errors.length}, alertes ${(entry.alerts || []).length}`);
  return entry;
}

module.exports = { main };
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
