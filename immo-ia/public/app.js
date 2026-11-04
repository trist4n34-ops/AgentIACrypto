'use strict';
const $ = (s, r = document) => r.querySelector(s);
const eur = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';
const pct = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const scoreClass = (s) => (s >= 75 ? 's-good' : s >= 60 ? 's-ok' : s >= 45 ? 's-mid' : 's-bad');
const negoClass = (l) => ({ Facile: 's-good', Possible: 's-ok', Difficile: 's-bad' }[l]);

const form = $('#filters');
let items = [];

function params() {
  const p = new URLSearchParams();
  new FormData(form).forEach((v, k) => { if (v !== '') p.set(k, v); });
  return p;
}

async function loadListings() {
  const res = await fetch('/api/listings?' + params());
  const data = await res.json();
  items = data.items;
  $('#count').textContent = `${data.count} bien(s) trouvé(s)` + (data.count > items.length ? ` — ${items.length} meilleurs affichés` : '');
  $('#grid').innerHTML = items.map(card).join('') || '<p class="muted">Aucun bien ne correspond à ces critères.</p>';
}

function card(l) {
  const a = l.analysis;
  const title = l.type === 'immeuble' ? `Immeuble de ${l.units} lots` : `${l.typeLabel} ${l.surface} m²`;
  return `<button class="card" data-id="${l.id}">
    <div class="card__head">
      <div><h3>${esc(title)}</h3><div class="where">${esc(l.city)} (${esc(l.dept)}) · ${esc(l.region)}</div></div>
      <div class="score ${scoreClass(a.score)}" title="Score IA">${a.score}</div>
    </div>
    <div class="price">${eur(l.price)} <small>${eur(a.askPxM2)}/m²</small></div>
    <div class="metrics">
      <div class="metric"><b>${pct(a.netYield)}</b><span>Rdt net</span></div>
      <div class="metric"><b>${a.discountPct > 0 ? '−' : '+'}${pct(Math.abs(a.discountPct), 0)}</b><span>vs marché</span></div>
      <div class="metric"><b>${a.monthlyCashflow >= 0 ? '+' : ''}${eur(a.monthlyCashflow)}</b><span>Cash-flow/mois</span></div>
    </div>
    <div class="tags">
      <span class="tag ${negoClass(a.negoLabel)}">Négociation : ${a.negoLabel}</span>
      <span class="tag neutral">DPE ${l.dpe}</span>
      <span class="tag neutral">${l.daysOnline} j en ligne</span>
    </div>
    <div class="verdict">${a.verdict}</div>
  </button>`;
}

function modal(l) {
  const a = l.analysis;
  const title = l.type === 'immeuble' ? `Immeuble de rapport — ${l.units} lots, ${l.surface} m²` : `${l.typeLabel} ${l.surface} m²`;
  const list = (arr, cls) => arr.length ? `<ul class="list ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Rien de particulier.</p>';
  $('#modalBody').innerHTML = `<div class="m">
    <div class="m__top">
      <div><h2>${esc(title)}</h2><div class="muted">${esc(l.address)}, ${esc(l.city)} (${esc(l.dept)}) · ${esc(l.seller)}${l.floor !== null ? ` · étage ${l.floor}` : ''}</div>
        <div class="tags" style="margin-top:8px">${l.features.map((f) => `<span class="tag neutral">${esc(f)}</span>`).join('')}</div></div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="score ${scoreClass(a.score)}">${a.score}</div>
        <button class="m__close" aria-label="Fermer">×</button>
      </div>
    </div>
    <div class="box"><h4>Verdict de l'IA</h4><div class="verdict" style="font-size:1.15rem">${a.verdict}</div></div>
    <div class="two">
      <div class="box"><h4>✔ Points forts</h4>${list(a.pros, 'pro')}</div>
      <div class="box"><h4>⚠ Points de vigilance</h4>${list(a.cons, 'con')}</div>
    </div>
    <div class="two">
      <div class="box"><h4>Rentabilité</h4><div class="rows">
        <span>Prix affiché</span><b>${eur(l.price)}</b>
        <span>Frais de notaire (7,5 %)</span><b>${eur(a.notary)}</b>
        <span>Travaux</span><b>${eur(a.works)}</b>
        <span><b>Coût total</b></span><b>${eur(a.totalCost)}</b>
        <span>Loyer estimé / mois</span><b>${eur(a.monthlyRent)}</b>
        <span>Vacance estimée</span><b>${pct(a.vacancyPct)}</b>
        <span>Charges annuelles</span><b>${eur(a.annualCharges)}</b>
        <span>Rendement brut</span><b>${pct(a.grossYield, 2)}</b>
        <span>Rendement net</span><b>${pct(a.netYield, 2)}</b>
      </div></div>
      <div class="box"><h4>Financement</h4><div class="rows">
        <span>Emprunt</span><b>${eur(a.capital)}</b>
        <span>Mensualité</span><b>${eur(a.payment)}</b>
        <span>Cash-flow mensuel</span><b>${a.monthlyCashflow >= 0 ? '+' : ''}${eur(a.monthlyCashflow)}</b>
      </div>
      <h4 style="margin-top:14px">Prix vs marché</h4><div class="rows">
        <span>Ce bien</span><b>${eur(a.askPxM2)}/m²</b>
        <span>Marché local</span><b>${eur(a.marketPxM2)}/m²</b>
        <span>Écart</span><b>${a.discountPct > 0 ? '−' : '+'}${pct(Math.abs(a.discountPct))}</b>
      </div></div>
    </div>
    <div class="box"><h4>Se positionner — négociation : <span class="tag ${negoClass(a.negoLabel)}">${a.negoLabel}</span> (${a.negoScore}/100)</h4>
      <div class="bar"><i style="width:${a.negoScore}%"></i></div>
      <p style="margin:6px 0">Offre conseillée : <span class="offer">${eur(a.offerPrice)}</span> <span class="muted">(−${pct(a.negoDiscountPct)} sur le prix affiché)</span></p>
      ${a.negoReasons.length ? `<p class="muted" style="margin:0">Leviers : ${a.negoReasons.map(esc).join(' · ')}.</p>` : '<p class="muted" style="margin:0">Peu de leviers identifiés : le vendeur a peu de raisons de baisser.</p>'}
    </div>
  </div>`;
  $('#modal').showModal();
}

/* ---------- événements ---------- */
let t;
form.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadListings, 250); });
form.addEventListener('submit', (e) => e.preventDefault());
$('#grid').addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (c) modal(items.find((x) => x.id === +c.dataset.id));
});
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal') || e.target.closest('.m__close')) $('#modal').close();
});

/* ---------- secteurs ---------- */
let sectors = [], sortKey = 'grossYieldRef', sortDir = -1;
async function loadSectors() {
  sectors = await (await fetch('/api/sectors?' + params())).json();
  renderSectors();
}
function renderSectors() {
  const rows = [...sectors].sort((a, b) => {
    const x = a[sortKey] ?? -Infinity, y = b[sortKey] ?? -Infinity;
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir;
  });
  $('#sectors tbody').innerHTML = rows.map((s) => `<tr data-city="${esc(s.city)}">
    <td>${esc(s.city)} <span class="muted">(${esc(s.dept)})</span></td><td>${eur(s.pxM2)}</td><td>${s.rentM2.toLocaleString('fr-FR')} €</td>
    <td><b>${pct(s.grossYieldRef)}</b></td><td>${Math.round(s.tension * 100)} %</td>
    <td style="color:var(${s.trend >= 0 ? '--good' : '--bad'})">${s.trend > 0 ? '+' : ''}${s.trend.toLocaleString('fr-FR')} %</td>
    <td>${s.avgScore ?? '—'}</td></tr>`).join('');
}
$('#sectors thead').addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  sortDir = sortKey === th.dataset.k ? -sortDir : -1;
  sortKey = th.dataset.k;
  renderSectors();
});
$('#sectors tbody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  form.q.value = tr.dataset.city;
  show('annonces');
  loadListings();
});

/* ---------- onglets ---------- */
function show(view) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-on', b.dataset.view === view));
  $('#view-annonces').hidden = view !== 'annonces';
  $('#view-secteurs').hidden = view !== 'secteurs';
  $('#view-loyers').hidden = view !== 'loyers';
  if (view === 'secteurs') loadSectors();
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (b) show(b.dataset.view);
});

/* ---------- loyers réels (base de données de la version web) ---------- */
const median = (arr) => { const s = [...arr].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
let modelRentM2 = null;

function renderRentals(rows) {
  const apts = rows.filter((r) => r.kind === 'appartement' && r.surface > 0);
  const perM2 = apts.map((r) => r.rent / r.surface);
  const med = median(perM2);
  const stat = (v, l) => `<div class="metric"><b>${v}</b><span>${l}</span></div>`;
  $('#rentalsStats').innerHTML =
    stat(rows.length, 'annonces enregistrées') +
    stat(med === null ? '—' : med.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' €', 'loyer médian /m² (appartements)') +
    stat(modelRentM2 === null ? '—' : modelRentM2.toLocaleString('fr-FR') + ' €', 'hypothèse du modèle (Montpellier)');
  $('#rentalsTable tbody').innerHTML = rows.map((r) => {
    const m2 = r.kind === 'appartement' && r.surface > 0 ? (r.rent / r.surface).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' €' : '—';
    return `<tr><td>${esc(r.seenAt || '')}</td><td>${esc(r.label || r.kind || '')}</td><td>${esc(r.district || '')}, ${esc(r.city || '')}</td>
      <td>${r.surface ? esc(r.surface) + ' m²' : '—'}</td><td>${eur(r.rent)} <span class="muted">${r.chargesIncluded ? 'CC' : 'HC'}</span></td><td>${m2}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="muted" style="text-align:left">Aucune annonce enregistrée pour le moment.</td></tr>';
}

async function initRentals() {
  const note = $('#rentalsNote');
  let db = null;
  try { db = window.claude ? await window.claude.use('db') : null; } catch (e) { db = null; }
  if (!db) { note.textContent = 'La base de données est disponible uniquement sur la version web publiée.'; renderRentals([]); return; }
  try { const s = await (await fetch('/api/sectors')).json(); modelRentM2 = (s.find((x) => x.city === 'Montpellier') || {}).rentM2 ?? null; } catch (e) { /* facultatif */ }
  note.textContent = 'Chargement de la base…';
  const timer = setTimeout(() => { note.textContent = 'La base ne répond pas encore. Les données affichées peuvent être anciennes.'; }, 10000);
  db.collection('rentals').orderBy('seenAt', 'desc').limit(500).onSnapshot(
    (snap) => {
      clearTimeout(timer);
      note.textContent = '';
      renderRentals(snap.docs.map((d) => d.data()));
    },
    () => { clearTimeout(timer); note.textContent = 'Lecture de la base impossible pour le moment.'; }
  );
}

/* ---------- init ---------- */
(async () => {
  const meta = await (await fetch('/api/meta')).json();
  $('#regionSel').insertAdjacentHTML('beforeend', meta.regions.map((r) => `<option>${esc(r)}</option>`).join(''));
  loadListings();
  initRentals();
})();
