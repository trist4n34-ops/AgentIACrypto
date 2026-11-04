'use strict';
// Logique d'API partagée : utilisée par le serveur Node et par la version autonome (navigateur).
const { generateListings, CITIES } = require('./data');
const { analyze, sectorStats } = require('./analyzer');

const LISTINGS = generateListings(160);
const num = (v, d) => (v === null || v === undefined || v === '' || isNaN(+v) ? d : +v);

function simParams(q) {
  return {
    apport: num(q.get('apport'), 10), rate: num(q.get('rate'), 3.8),
    years: num(q.get('years'), 20), gestion: q.get('gestion') === '1',
  };
}

/** @returns {{status:number, body:object}} */
function route(pathname, q) {
  if (pathname === '/api/meta') {
    return { status: 200, body: { cities: CITIES.map((c) => c.name).sort(), regions: [...new Set(CITIES.map((c) => c.region))].sort(), total: LISTINGS.length } };
  }
  const params = simParams(q);
  if (pathname === '/api/sectors') {
    return { status: 200, body: sectorStats(LISTINGS.map((l) => analyze(l, params))) };
  }
  if (pathname === '/api/listings') {
    const text = (q.get('q') || '').toLowerCase().trim();
    const type = q.get('type'), region = q.get('region'), nego = q.get('nego');
    const maxPrice = num(q.get('maxPrice'), Infinity), minSurface = num(q.get('minSurface'), 0);
    const minYield = num(q.get('minYield'), 0), minScore = num(q.get('minScore'), 0);
    const items = LISTINGS.map((l) => analyze(l, params)).filter((l) => {
      const a = l.analysis;
      if (text && !`${l.city} ${l.dept} ${l.region} ${l.typeLabel}`.toLowerCase().includes(text)) return false;
      if (type && l.type !== type) return false;
      if (region && l.region !== region) return false;
      if (l.price > maxPrice || l.surface < minSurface) return false;
      if (a.netYield < minYield || a.score < minScore) return false;
      if (nego && a.negoLabel !== nego) return false;
      return true;
    });
    const sorts = {
      score: (a, b) => b.analysis.score - a.analysis.score,
      cashflow: (a, b) => b.analysis.monthlyCashflow - a.analysis.monthlyCashflow,
      yield: (a, b) => b.analysis.netYield - a.analysis.netYield,
      price: (a, b) => a.price - b.price,
      discount: (a, b) => b.analysis.discountPct - a.analysis.discountPct,
      nego: (a, b) => b.analysis.negoScore - a.analysis.negoScore,
    };
    items.sort(sorts[q.get('sort')] || sorts.score);
    return { status: 200, body: { count: items.length, items: items.slice(0, 60) } };
  }
  const m = pathname.match(/^\/api\/listing\/(\d+)$/);
  if (m) {
    const l = LISTINGS.find((x) => x.id === +m[1]);
    return l ? { status: 200, body: analyze(l, params) } : { status: 404, body: { error: 'Introuvable' } };
  }
  return { status: 404, body: { error: 'Route inconnue' } };
}

module.exports = { route, LISTINGS };
