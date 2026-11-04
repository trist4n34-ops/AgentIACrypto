'use strict';
/**
 * Modèle d'adaptateur pour une API d'annonces payante et AUTORISÉE (contrat avec le fournisseur).
 * Non testé contre un fournisseur réel : adapte `mapItem` à la documentation du fournisseur choisi.
 * Variables d'environnement : LISTINGS_API_URL, LISTINGS_API_KEY (jamais dans le code).
 */
const https = require('https');

/** Adapter ici les noms de champs du fournisseur. */
function mapItem(it) {
  return { kind: 'sale', price: it.price, surface: it.surface, rooms: it.rooms, city: it.city, zip: it.zip_code, label: it.title,
    url: it.url, dpe: it.dpe, seller: it.seller_type, date: it.published_at && String(it.published_at).slice(0, 10), source: 'API fournisseur' };
}

function fetchJson(url, key) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let d = ''; res.setEncoding('utf8'); res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function fetchListings(env = process.env) {
  if (!env.LISTINGS_API_URL || !env.LISTINGS_API_KEY) return { skipped: 'LISTINGS_API_URL / LISTINGS_API_KEY non définies', items: [] };
  const data = await fetchJson(env.LISTINGS_API_URL, env.LISTINGS_API_KEY);
  return { items: (Array.isArray(data) ? data : data.items || []).map(mapItem) };
}
module.exports = { fetchListings, mapItem };
