'use strict';
/** Normalisation commune à tous les connecteurs d'annonces. */
const REGIONS = {
  'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90'],
  Bretagne: ['22', '29', '35', '56'],
  'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
  Corse: ['2A', '2B', '20'],
  'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  'Hauts-de-France': ['02', '59', '60', '62', '80'],
  'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
  Normandie: ['14', '27', '50', '61', '76'],
  'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  Occitanie: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  'Pays de la Loire': ['44', '49', '53', '72', '85'],
  "Provence-Alpes-Côte d'Azur": ['04', '05', '06', '13', '83', '84'],
};
const DEPT_REGION = Object.fromEntries(Object.entries(REGIONS).flatMap(([r, ds]) => ds.map((d) => [d, r])));

const deptOf = (zip) => (/^\d{5}$/.test(zip || '') ? (zip.startsWith('20') ? (+zip < 20200 ? '2A' : '2B') : zip.startsWith('97') ? zip.slice(0, 3) : zip.slice(0, 2)) : '');

/** « 1 123,91 », « 250 000 » (espaces ordinaires ou insécables) => nombre */
function parseNumber(s) {
  const n = parseFloat(String(s).replace(/[\s  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function guessType(label = '', rooms = 0) {
  const t = label.toLowerCase();
  if (/immeuble/.test(t)) return 'immeuble';
  if (/maison|villa|pavillon/.test(t)) return 'maison';
  if (/studio/.test(t) || rooms === 1) return 'studio';
  if (rooms === 2 || /\bt2\b/.test(t)) return 't2';
  if (rooms === 3 || /\bt3\b/.test(t)) return 't3';
  if (rooms >= 4 || /\bt[4-9]\b/.test(t)) return 't4';
  return 't2';
}
const TYPE_LABEL = { studio: 'Studio', t2: 'T2', t3: 'T3', t4: 'T4', maison: 'Maison', immeuble: 'Immeuble de rapport' };

/**
 * raw : { kind:'sale'|'rent', price|rent, surface, rooms, label, city, district, zip, url, dpe, seller, source, date }
 * @returns {{ok:true, listing}|{ok:false, reason}}
 */
function normalizeListing(raw) {
  const kind = raw.kind === 'rent' ? 'rent' : 'sale';
  const amount = Number(kind === 'rent' ? raw.rent ?? raw.price : raw.price);
  const surface = Number(raw.surface);
  if (!(amount > 0)) return { ok: false, reason: 'prix absent' };
  if (!(surface > 0)) return { ok: false, reason: 'surface absente' };
  if (!raw.city) return { ok: false, reason: 'ville absente' };
  const rooms = Number(raw.rooms) || 0;
  const type = raw.type || guessType(raw.label, rooms);
  const dept = raw.dept || deptOf(raw.zip);
  const url = typeof raw.url === 'string' && /^https?:\/\//.test(raw.url) ? raw.url : undefined; // jamais de schéma javascript:
  const dpe = 'ABCDEFG'.includes(String(raw.dpe || '').toUpperCase()) && raw.dpe ? String(raw.dpe).toUpperCase() : 'N/D';
  const base = {
    kind, demo: false, source: raw.source || 'import', url,
    city: String(raw.city).trim(), district: raw.district ? String(raw.district).trim() : '', zip: raw.zip || '', dept,
    region: raw.region || DEPT_REGION[dept] || '', type, typeLabel: TYPE_LABEL[type] || 'Bien', label: raw.label || '',
    surface, rooms, dpe, seller: raw.seller || 'N/D', seenAt: raw.date || new Date().toISOString().slice(0, 10),
  };
  if (kind === 'rent') return { ok: true, listing: { ...base, rent: amount, chargesIncluded: raw.chargesIncluded !== false, rentKind: /colocation|chambre/i.test(raw.label || '') ? 'colocation' : 'appartement' } };
  return { ok: true, listing: { ...base, price: amount, worksPerM2: Number(raw.worksPerM2) || 0, neuf: !!raw.neuf, units: raw.units || 1, features: raw.features || [] } };
}

/** Clé stable d'un bien (indépendante du prix et du lien de suivi). */
function propertyKey(l) {
  const crypto = require('crypto');
  const k = [l.kind, l.city.toLowerCase(), l.zip, l.district.toLowerCase(), l.type, l.rooms, l.surface].join('|');
  return crypto.createHash('sha1').update(k).digest('hex').slice(0, 12);
}

module.exports = { normalizeListing, propertyKey, parseNumber, guessType, deptOf, DEPT_REGION, TYPE_LABEL };
