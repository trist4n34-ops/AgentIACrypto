'use strict';
// Logique d'API partagée : utilisée par le serveur Node et par la version autonome (navigateur).
const { generateListings, CITIES, applyMarket } = require('./data');
const { analyze, sectorStats } = require('./analyzer');
const C = require('./config');

// Fichiers de données : data/*.json côté Node ; modules embarqués par build.js dans la version web.
function loadJson(name) {
  try { return JSON.parse(require('fs').readFileSync(require('path').join(process.env.IMMOIA_DATA || require('path').join(__dirname, 'data'), name + '.json'), 'utf8')); }
  catch (e) { try { return require('./' + name); } catch (e2) { return null; } }
}
const market = loadJson('market');
if (market) applyMarket(market);

const DEMO = generateListings(220);
const realRaw = (loadJson('listings') || []).filter((l) => l.kind !== 'rent');
const withDerived = (l) => {
  const days = Math.max(0, Math.round((Date.now() - new Date(l.firstSeen)) / 864e5));
  let drops = 0;
  for (let i = 1; i < (l.history || []).length; i++) if (l.history[i].price < l.history[i - 1].price) drops++;
  return { ...l, id: 'r' + l.key, daysOnline: days, priceDrops: drops };
};
const METRO_NAMES = new Set(CITIES.filter((c) => c.metro).map((c) => c.name));
const REAL = realRaw.map(withDerived).map((l) => ({ ...l, metro: METRO_NAMES.has(l.city) }));
const RENTALS = loadJson('rentals') || [];

const TYPES = ['studio', 't2', 't3', 't4', 'maison', 'immeuble'];
const NEGOS = ['Facile', 'Possible', 'Difficile'];
const SORTS = ['score', 'yield', 'cashflow', 'price', 'discount', 'nego'];
const ZONES = ['montpellier-first', 'montpellier', 'all'];
const SOURCES = ['real', 'demo', 'all'];

const num = (v, d, min = -Infinity, max = Infinity) => {
  if (v === null || v === undefined || v === '' || isNaN(+v)) return d;
  return Math.min(max, Math.max(min, +v));
};
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

function simParams(q) {
  return { apport: num(q.get('apport'), C.DEFAULTS.apport, 0, 100), rate: num(q.get('rate'), C.DEFAULTS.rate, 0, 20),
    years: num(q.get('years'), C.DEFAULTS.years, 1, 40), gestion: q.get('gestion') === '1' };
}

function pool(source) {
  if (source === 'real') return REAL;
  if (source === 'demo') return DEMO;
  return [...REAL, ...DEMO];
}

/** @returns {{status:number, body:object}} */
function route(pathname, q) {
  if (pathname === '/api/meta') {
    return { status: 200, body: { cities: CITIES.map((c) => c.name).sort(), regions: [...new Set(CITIES.map((c) => c.region))].sort(),
      total: DEMO.length + REAL.length, real: REAL.length, demo: DEMO.length, rentals: RENTALS.length,
      market: market ? { source: market.source, year: market.year, updatedAt: market.updatedAt } : null } };
  }
  const params = simParams(q);
  if (pathname === '/api/rentals') return { status: 200, body: RENTALS };
  if (pathname === '/api/sectors') return { status: 200, body: sectorStats(pool('all').map((l) => analyze(l, params))) };
  if (pathname === '/api/listings') {
    const source = oneOf(q.get('source'), SOURCES, REAL.length ? 'real' : 'demo');
    const zone = oneOf(q.get('zone'), ZONES, 'montpellier-first');
    const text = (q.get('q') || '').toLowerCase().trim().slice(0, 100);
    const type = oneOf(q.get('type'), TYPES, ''), nego = oneOf(q.get('nego'), NEGOS, '');
    const region = (q.get('region') || '').slice(0, 60);
    const maxPrice = num(q.get('maxPrice'), Infinity, 0), minSurface = num(q.get('minSurface'), 0, 0);
    const minYield = num(q.get('minYield'), 0, 0), minScore = num(q.get('minScore'), 0, 0, 100);
    const ids = q.get('ids') ? new Set(String(q.get('ids')).split(',').slice(0, 200)) : null;
    let items = pool(source).map((l) => analyze(l, params)).filter((l) => {
      const a = l.analysis;
      if (ids && !ids.has(String(l.id))) return false;
      if (text && !`${l.city} ${l.dept} ${l.region} ${l.typeLabel}`.toLowerCase().includes(text)) return false;
      if (type && l.type !== type) return false;
      if (region && l.region !== region) return false;
      if (l.price > maxPrice || l.surface < minSurface) return false;
      if (a.netYield < minYield || a.score < minScore) return false;
      if (nego && a.negoLabel !== nego) return false;
      if (zone === 'montpellier' && !l.metro) return false;
      return true;
    });
    const sorts = {
      score: (a, b) => b.analysis.score - a.analysis.score,
      yield: (a, b) => b.analysis.netYield - a.analysis.netYield,
      cashflow: (a, b) => b.analysis.monthlyCashflow - a.analysis.monthlyCashflow,
      price: (a, b) => a.price - b.price,
      discount: (a, b) => b.analysis.discountPct - a.analysis.discountPct,
      nego: (a, b) => b.analysis.negoScore - a.analysis.negoScore,
    };
    items.sort(sorts[oneOf(q.get('sort'), SORTS, 'score')]);
    if (zone === 'montpellier-first') items = [...items.filter((l) => l.metro), ...items.filter((l) => !l.metro)];
    return { status: 200, body: { count: items.length, source, items: items.slice(0, ids ? 200 : 60) } };
  }
  return { status: 404, body: { error: 'Route inconnue' } };
}

module.exports = { route, REAL, DEMO };
