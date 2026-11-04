'use strict';
/**
 * Connecteur DVF (Demandes de valeurs foncières, données ouvertes de l'État, Licence Ouverte).
 * Source : https://files.data.gouv.fr/geo-dvf/latest/csv/<année>/communes/<dépt>/<code INSEE>.csv
 * Calcule le prix médian au m² (appartements, maisons) à partir des ventes réelles.
 *
 * Usage : node connectors/dvf.js 2024 34:34172:Montpellier 34:34057:Castelnau-le-Lez ...
 * Écrit data/market.json (utilisé automatiquement par le serveur et par le build).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

// Codes INSEE des communes favorites (à vérifier avec https://geo.api.gouv.fr/communes?nom=...)
const DEFAULT_COMMUNES = [
  ['34', '34172', 'Montpellier'], ['34', '34057', 'Castelnau-le-Lez'], ['34', '34129', 'Lattes'],
  ['34', '34198', 'Pérols'], ['34', '34120', 'Juvignac'], ['34', '34270', 'Saint-Jean-de-Védas'],
  ['34', '34154', 'Mauguio'],
];

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };

/** @returns {{apt:{medianM2,count}|null, house:{medianM2,count}|null}} */
function aggregate(csvText) {
  const [head, ...lines] = parseCsv(csvText);
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  for (const k of ['id_mutation', 'nature_mutation', 'valeur_fonciere', 'type_local', 'surface_reelle_bati'])
    if (!(k in col)) throw new Error('Colonne DVF manquante : ' + k);
  const byMutation = new Map();
  for (const r of lines) {
    if (r[col.nature_mutation] !== 'Vente') continue;
    const id = r[col.id_mutation];
    if (!byMutation.has(id)) byMutation.set(id, { price: parseFloat(r[col.valeur_fonciere]), locals: new Map() });
    const t = r[col.type_local], s = parseFloat(r[col.surface_reelle_bati]);
    if ((t === 'Appartement' || t === 'Maison') && s > 0) {
      // une ligne par local ; on dédoublonne les lignes répétées par parcelle
      byMutation.get(id).locals.set(`${t}|${s}|${r[col.nombre_pieces_principales] ?? ''}`, { t, s });
    }
  }
  const apt = [], house = [];
  for (const { price, locals } of byMutation.values()) {
    if (locals.size !== 1 || !(price > 0)) continue; // ventes à un seul bien bâti : prix au m² non ambigu
    const { t, s } = [...locals.values()][0];
    const m2 = price / s;
    if (m2 < 500 || m2 > 30000) continue; // écarte les valeurs aberrantes
    (t === 'Appartement' ? apt : house).push(m2);
  }
  const pack = (a) => (a.length >= 5 ? { medianM2: Math.round(median(a)), count: a.length } : null);
  return { apt: pack(apt), house: pack(house) };
}

function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ImmoIA-dvf-connector' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode} pour ${url}`)); }
      let d = ''; res.setEncoding('utf8'); res.on('data', (c) => (d += c)); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function sync(year, communes = DEFAULT_COMMUNES, outFile = path.join(__dirname, '..', 'data', 'market.json')) {
  const out = { source: 'DVF (data.gouv.fr)', year, updatedAt: new Date().toISOString().slice(0, 10), cities: {} };
  for (const [dept, insee, name] of communes) {
    try {
      const agg = aggregate(await download(`https://files.data.gouv.fr/geo-dvf/latest/csv/${year}/communes/${dept}/${insee}.csv`));
      out.cities[name] = { insee, ...agg };
      console.log(name, agg.apt ? `appart. ${agg.apt.medianM2} €/m² (${agg.apt.count} ventes)` : 'pas assez de ventes');
    } catch (e) { console.error(name, '→', e.message); }
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  return out;
}

module.exports = { parseCsv, aggregate, sync, DEFAULT_COMMUNES };

if (require.main === module) {
  const [year = String(new Date().getFullYear() - 1), ...args] = process.argv.slice(2);
  const communes = args.length ? args.map((a) => a.split(':')) : DEFAULT_COMMUNES;
  sync(year, communes).catch((e) => { console.error(e.message); process.exit(1); });
}
