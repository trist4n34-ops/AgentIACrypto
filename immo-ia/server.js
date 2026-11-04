'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { generateListings, CITIES } = require('./data');
const { analyze, sectorStats } = require('./analyzer');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const LISTINGS = generateListings(160);
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };

const num = (v, d) => (v === null || v === undefined || v === '' || isNaN(+v) ? d : +v);

function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function simParams(q) {
  return {
    apport: num(q.get('apport'), 10), rate: num(q.get('rate'), 3.8),
    years: num(q.get('years'), 20), gestion: q.get('gestion') === '1',
  };
}

function handleApi(url, res) {
  const q = url.searchParams;
  if (url.pathname === '/api/meta') {
    return json(res, { cities: CITIES.map((c) => c.name).sort(), regions: [...new Set(CITIES.map((c) => c.region))].sort(), total: LISTINGS.length });
  }
  const params = simParams(q);
  if (url.pathname === '/api/sectors') {
    return json(res, sectorStats(LISTINGS.map((l) => analyze(l, params))));
  }
  if (url.pathname === '/api/listings') {
    const text = (q.get('q') || '').toLowerCase().trim();
    const type = q.get('type'), region = q.get('region'), nego = q.get('nego');
    const maxPrice = num(q.get('maxPrice'), Infinity), minSurface = num(q.get('minSurface'), 0);
    const minYield = num(q.get('minYield'), 0), minScore = num(q.get('minScore'), 0);
    let items = LISTINGS.map((l) => analyze(l, params)).filter((l) => {
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
      yield: (a, b) => b.analysis.netYield - a.analysis.netYield,
      price: (a, b) => a.price - b.price,
      discount: (a, b) => b.analysis.discountPct - a.analysis.discountPct,
      nego: (a, b) => b.analysis.negoScore - a.analysis.negoScore,
    };
    items.sort(sorts[q.get('sort')] || sorts.score);
    return json(res, { count: items.length, items: items.slice(0, 60) });
  }
  const m = url.pathname.match(/^\/api\/listing\/(\d+)$/);
  if (m) {
    const l = LISTINGS.find((x) => x.id === +m[1]);
    return l ? json(res, analyze(l, params)) : json(res, { error: 'Introuvable' }, 404);
  }
  json(res, { error: 'Route inconnue' }, 404);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(url, res);
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`ImmoIA → http://localhost:${PORT}`));
