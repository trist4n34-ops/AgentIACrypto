'use strict';
/** Import CSV d'annonces. En-têtes reconnus (séparateur « , » ou « ; ») : url, prix, surface, pieces, ville, cp, type, dpe, vendeur, titre, travaux_m2, neuf. */
const { parseCsv } = require('./dvf');
const { parseNumber } = require('./normalize');

const ALIASES = { price: ['prix', 'price'], surface: ['surface', 'm2'], rooms: ['pieces', 'pièces', 'rooms'], city: ['ville', 'city'], zip: ['cp', 'code_postal', 'zip'],
  type: ['type'], dpe: ['dpe'], seller: ['vendeur', 'seller'], label: ['titre', 'label'], url: ['url', 'lien'], worksPerM2: ['travaux_m2'], neuf: ['neuf'], date: ['date'] };

function parseListingsCsv(text) {
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = parseCsv(text, sep);
  const [head, ...lines] = rows;
  if (!head) return [];
  const idx = {};
  head.map((h) => h.trim().toLowerCase()).forEach((h, i) => { for (const [k, names] of Object.entries(ALIASES)) if (names.includes(h)) idx[k] = i; });
  return lines.filter((r) => r.some((c) => c.trim())).map((r) => {
    const get = (k) => (k in idx ? (r[idx[k]] || '').trim() : '');
    return { kind: 'sale', price: parseNumber(get('price')), surface: parseNumber(get('surface')), rooms: +get('rooms') || 0, city: get('city'), zip: get('zip'),
      type: get('type') || undefined, dpe: get('dpe'), seller: get('seller'), label: get('label'), url: get('url'), worksPerM2: parseNumber(get('worksPerM2')) || 0,
      neuf: /^(1|oui|true|neuf)$/i.test(get('neuf')), date: get('date') || undefined, source: 'import CSV' };
  });
}
module.exports = { parseListingsCsv };
