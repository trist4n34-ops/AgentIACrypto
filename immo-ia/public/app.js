'use strict';
const $ = (s, r = document) => r.querySelector(s);
const eur = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';
const pct = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const scoreClass = (s) => (s >= 75 ? 's-good' : s >= 60 ? 's-ok' : s >= 45 ? 's-mid' : 's-bad');
const negoClass = (l) => ({ Facile: 's-good', Possible: 's-ok', Difficile: 's-bad' }[l]);
const sign = (n) => (n >= 0 ? '+' : '');

/* ---------- préférences locales (facultatives : le site fonctionne sans) ---------- */
const prefs = {
  get(k, d) { try { const v = localStorage.getItem('immoia.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('immoia.' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
};
let favs = new Set(prefs.get('favs', []).map(String));
let compare = [];
const form = $('#filters');
let items = [];

/* ---------- requêtes ---------- */
function params() {
  const p = new URLSearchParams();
  new FormData(form).forEach((v, k) => { if (v !== '' && k !== 'favOnly' && k !== 'alertMin') p.set(k, v); });
  if (form.favOnly.checked) p.set('ids', favs.size ? [...favs].join(',') : '0');
  return p;
}

async function loadListings() {
  const data = await (await fetch('/api/listings?' + params())).json();
  items = data.items;
  $('#count').textContent = `${data.count} bien(s) trouvé(s)` + (data.count > items.length ? ` — ${items.length} meilleurs affichés` : '');
  $('#grid').innerHTML = items.map(card).join('') || '<p class="muted">Aucun bien ne correspond à ces critères.</p>';
  const note = $('#sourceNote');
  note.hidden = data.source !== 'demo' && data.source !== 'all';
  note.textContent = data.source === 'demo'
    ? 'Annonces de démonstration : biens fictifs générés pour illustrer l\'outil. Aucune de ces annonces n\'existe.'
    : 'Les biens marqués « Démo » sont fictifs. Les autres proviennent de vos imports.';
  renderAlert();
  syncCompare();
}

function renderAlert() {
  const min = +form.alertMin.value;
  const box = $('#alertNote');
  if (!(min > 0)) { box.hidden = true; return; }
  const hits = items.filter((l) => l.analysis.valid && l.analysis.score >= min && !l.demo);
  const demoHits = items.filter((l) => l.analysis.valid && l.analysis.score >= min && l.demo).length;
  box.hidden = false;
  box.textContent = hits.length
    ? `Alerte : ${hits.length} bien(s) réel(s) atteignent un score de ${min} ou plus.`
    : `Aucun bien réel n'atteint un score de ${min}.` + (demoHits ? ` (${demoHits} bien(s) de démonstration le dépassent.)` : '');
}

/* ---------- liens et sources ---------- */
/** Lien direct si l'annonce en a un ; sinon (annonce de démonstration) une recherche équivalente chez Leboncoin. */
function providerLink(l) {
  if (l.url) return { href: l.url, label: "Voir l'annonce chez le prestataire" };
  const q = new URLSearchParams({ category: '9', text: l.city, price_max: String(Math.round(l.price * 1.05)) });
  return { href: 'https://www.leboncoin.fr/recherche?' + q, label: 'Biens similaires sur Leboncoin' };
}
const linkHtml = (l) => { const p = providerLink(l); return `<a class="ext" href="${esc(p.href)}" target="_blank" rel="noopener noreferrer">${esc(p.label)} ↗</a>`; };
const titleOf = (l) => (l.type === 'immeuble' ? `Immeuble de ${l.units} lots` : `${l.typeLabel} ${l.surface} m²`);

/* ---------- carte ---------- */
function card(l) {
  const a = l.analysis, id = String(l.id), isFav = favs.has(id);
  const body = a.valid ? `
    <div class="price">${eur(l.price)} <small>${eur(a.askPxM2)}/m²</small></div>
    <div class="metrics">
      <div class="metric"><b>${pct(a.netYield)}</b><span>Rdt net</span></div>
      <div class="metric"><b>${a.discountPct > 0 ? '−' : '+'}${pct(Math.abs(a.discountPct), 0)}</b><span>vs marché</span></div>
      <div class="metric"><b>${sign(a.monthlyCashflow)}${eur(a.monthlyCashflow)}</b><span>Cash-flow/mois</span></div>
    </div>
    <div class="tags">
      <span class="tag ${negoClass(a.negoLabel)}">Négociation : ${a.negoLabel}</span>
      <span class="tag neutral">DPE ${esc(l.dpe)}</span>
      <span class="tag neutral">${l.daysOnline} j en ligne</span>
      ${l.demo ? '<span class="tag demo">Démo</span>' : ''}
    </div>` : `<p class="muted">${esc(a.cons[0] || 'Données insuffisantes')}</p>${l.demo ? '<div class="tags"><span class="tag demo">Démo</span></div>' : ''}`;
  return `<article class="card" data-id="${esc(id)}">
    <div class="card__head">
      <div><h3><button class="card__open" data-id="${esc(id)}">${esc(titleOf(l))}</button></h3><div class="where">${esc(l.city)} (${esc(l.dept)}) · ${esc(l.region)}</div></div>
      <div class="score ${scoreClass(a.score)}" title="Score IA">${a.score}</div>
    </div>
    ${body}
    <div class="verdict">${esc(a.verdict)}</div>
    <div class="card__row">${linkHtml(l)}
      <span><button class="btn" data-fav="${esc(id)}" aria-pressed="${isFav}">${isFav ? 'Retirer des favoris' : 'Favori'}</button></span></div>
    <label class="cmp"><input type="checkbox" data-cmp="${esc(id)}" ${compare.includes(id) ? 'checked' : ''}> Comparer</label>
  </article>`;
}

/* ---------- graphique prix/m² (à l'échelle, un seul axe) ---------- */
function chart(a) {
  const max = Math.max(a.askPxM2, a.marketPxM2) * 1.18 || 1, W = 300, x = (v) => Math.round((v / max) * W);
  return `<svg class="chart" viewBox="0 0 400 96" role="img" aria-label="Prix au m² du bien : ${eur(a.askPxM2)}, marché local : ${eur(a.marketPxM2)}">
    <text class="lbl" x="0" y="14">Ce bien</text>
    <rect class="bar-a" x="0" y="20" width="${x(a.askPxM2)}" height="18" rx="3"/>
    <text x="${x(a.askPxM2) + 6}" y="33">${eur(a.askPxM2)}/m²</text>
    <text class="lbl" x="0" y="58">Marché local (${esc(a.marketSource)})</text>
    <rect class="bar-m" x="0" y="64" width="${x(a.marketPxM2)}" height="18" rx="3"/>
    <text x="${x(a.marketPxM2) + 6}" y="77">${eur(a.marketPxM2)}/m²</text>
  </svg>`;
}

/* ---------- fiche détaillée ---------- */
function modal(l) {
  const a = l.analysis;
  const list = (arr, cls) => (arr.length ? `<ul class="list ${cls}">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Rien de particulier.</p>');
  const where = [l.address, l.district, l.city && `${l.city} (${l.dept})`].filter(Boolean).map(esc).join(', ');
  const origin = l.demo ? 'Annonce de démonstration (fictive)' : `${esc(l.source)}${l.firstSeen ? `, vue pour la première fois le ${esc(l.firstSeen)}` : ''}`;
  $('#modalBody').innerHTML = `<div class="m">
    <div class="m__top">
      <div><h2>${esc(titleOf(l))}</h2><div class="muted">${where} · ${esc(l.seller)}${l.floor != null ? ` · étage ${l.floor}` : ''}</div>
        <div class="tags" style="margin-top:8px">${(l.features || []).map((f) => `<span class="tag neutral">${esc(f)}</span>`).join('')}${l.demo ? '<span class="tag demo">Démo</span>' : ''}</div></div>
      <div style="display:flex;gap:10px;align-items:center">
        <div class="score ${scoreClass(a.score)}">${a.score}</div>
        <button class="m__close" aria-label="Fermer">×</button>
      </div>
    </div>
    <div class="box"><h4>Verdict</h4><div class="verdict" style="font-size:1.15rem">${esc(a.verdict)}</div></div>
    <div class="two">
      <div class="box"><h4>Points forts</h4>${list(a.pros, 'pro')}</div>
      <div class="box"><h4>Points de vigilance</h4>${list(a.cons, 'con')}</div>
    </div>
    ${a.valid ? `
    <div class="box"><h4>Prix au m² : ce bien contre le marché (${a.discountPct > 0 ? 'décote' : 'surcote'} de ${pct(Math.abs(a.discountPct))})</h4>${chart(a)}</div>
    <div class="two">
      <div class="box"><h4>Rentabilité, ligne par ligne</h4><div class="rows">
        <span>Prix affiché</span><b>${eur(l.price)}</b>
        <span>Frais de notaire (${l.neuf ? '2,5' : '7,5'} %)</span><b>${eur(a.notary)}</b>
        <span>Travaux</span><b>${eur(a.works)}</b>
        <span><b>Coût total</b></span><b>${eur(a.totalCost)}</b>
        <span>Loyer estimé / mois</span><b>${eur(a.monthlyRent)}</b>
        <span>Vacance estimée</span><b>${pct(a.vacancyPct)}</b>
        <span>Charges annuelles (taxe foncière incluse)</span><b>${eur(a.annualCharges)}</b>
        <span>Rendement brut</span><b>${pct(a.grossYield, 2)}</b>
        <span>Rendement net</span><b>${pct(a.netYield, 2)}</b>
      </div></div>
      <div class="box"><h4>Financement</h4><div class="rows">
        <span>Emprunt</span><b>${eur(a.capital)}</b>
        <span>Mensualité</span><b>${eur(a.payment)}</b>
        <span>Cash-flow mensuel</span><b>${sign(a.monthlyCashflow)}${eur(a.monthlyCashflow)}</b>
      </div>
      <p class="src" style="margin-top:10px">Réglez l'apport, le taux et la durée dans « Simulation de financement ».</p></div>
    </div>` : ''}
    <div class="box"><h4>Voir le bien en ligne</h4><p style="margin:0">${linkHtml(l)}</p>${l.url ? '' : '<p class="muted" style="margin:6px 0 0">Annonce de démonstration : le lien ouvre une recherche équivalente (ville, budget).</p>'}</div>
    ${a.valid ? `<div class="box"><h4>Se positionner : négociation <span class="tag ${negoClass(a.negoLabel)}">${a.negoLabel}</span> (${a.negoScore}/100)</h4>
      <div class="bar"><i style="width:${a.negoScore}%"></i></div>
      <p style="margin:6px 0">Offre conseillée : <span class="offer">${eur(a.offerPrice)}</span> <span class="muted">(−${pct(a.negoDiscountPct)} sur le prix affiché)</span></p>
      ${a.negoReasons.length ? `<p class="muted" style="margin:0">Leviers : ${a.negoReasons.map(esc).join(' · ')}.</p>` : '<p class="muted" style="margin:0">Peu de leviers identifiés : le vendeur a peu de raisons de baisser.</p>'}
    </div>` : ''}
    <div class="box" id="aiBox" hidden><h4>Analyse rédigée par Claude</h4>
      <button class="btn" id="aiBtn" data-id="${esc(String(l.id))}">Rédiger l'analyse</button><p class="ai" id="aiText"></p>
      <p class="src">Le texte s'appuie uniquement sur les chiffres ci-dessus. Il ne remplace pas les calculs.</p></div>
    <p class="src">Sources : annonce, ${origin}. Prix de marché : ${esc(a.marketSource)}. Loyers : ${esc(a.rentSource)}.</p>
  </div>`;
  $('#modal').showModal();
  if (window.claude && a.valid) $('#aiBox').hidden = false; // l'analyse rédigée n'existe que dans la version web
}

async function writeAnalysis(l) {
  const out = $('#aiText'), btn = $('#aiBtn');
  let sample = null;
  try { sample = await window.claude.use('sample'); } catch (e) { sample = null; }
  if (!sample) { out.textContent = 'L\'analyse rédigée n\'est pas disponible dans cette vue.'; return; }
  btn.disabled = true; out.textContent = 'Rédaction en cours…';
  const a = l.analysis;
  const facts = { type: l.typeLabel, ville: l.city, surface_m2: l.surface, prix: l.price, prix_m2: a.askPxM2, prix_m2_marche: a.marketPxM2, ecart_marche_pct: a.discountPct,
    rendement_brut_pct: a.grossYield, rendement_net_pct: a.netYield, cashflow_mensuel: a.monthlyCashflow, score: a.score, verdict: a.verdict,
    negociation: a.negoLabel, offre_conseillee: a.offerPrice, dpe: l.dpe, jours_en_ligne: l.daysOnline, points_forts: a.pros, vigilance: a.cons, source_marche: a.marketSource };
  try {
    const r = await sample(`Tu aides un investisseur immobilier français. À partir UNIQUEMENT des chiffres JSON ci-dessous, écris en français :\n1) un résumé de 5 lignes maximum ;\n2) les 3 principaux risques ;\n3) 4 questions à poser au vendeur.\nN'invente aucun chiffre ni aucun fait absent du JSON. Si une donnée est indicative, dis-le. Pas de conseil juridique ni fiscal.\n\nJSON : ${JSON.stringify(facts)}`,
      { onText: ({ text }) => { out.textContent = text; }, cache: false });
    out.textContent = r.text;
  } catch (e) {
    out.textContent = e && e.code === 'not_granted' ? 'Autorisation refusée : l\'analyse rédigée est désactivée.' : 'L\'analyse n\'a pas pu être rédigée pour le moment.';
  } finally { btn.disabled = false; }
}

/* ---------- comparaison (2 à 4 biens) ---------- */
function syncCompare() {
  const b = $('#btnCompare');
  b.textContent = `Comparer (${compare.length})`;
  b.disabled = compare.length < 2;
}
function openCompare() {
  const rows = compare.map((id) => items.find((x) => String(x.id) === id)).filter(Boolean);
  if (rows.length < 2) return;
  const line = (label, f) => `<tr><th>${label}</th>${rows.map((l) => `<td>${f(l)}</td>`).join('')}</tr>`;
  const ok = (f) => (l) => (l.analysis.valid ? f(l.analysis, l) : '—');
  $('#modalBody').innerHTML = `<div class="m"><div class="m__top"><h2>Comparaison</h2><button class="m__close" aria-label="Fermer">×</button></div>
    <div class="tablewrap"><table class="cmp-table"><thead><tr><th></th>${rows.map((l) => `<th>${esc(titleOf(l))}<br><span class="muted">${esc(l.city)}</span></th>`).join('')}</tr></thead><tbody>
    ${line('Score', (l) => `<b>${l.analysis.score}</b> ${esc(l.analysis.verdict)}`)}
    ${line('Prix', (l) => eur(l.price))}
    ${line('Prix au m²', ok((a) => eur(a.askPxM2)))}
    ${line('Écart au marché', ok((a) => `${a.discountPct > 0 ? 'décote ' : 'surcote '}${pct(Math.abs(a.discountPct))}`))}
    ${line('Rendement brut', ok((a) => pct(a.grossYield, 2)))}
    ${line('Rendement net', ok((a) => pct(a.netYield, 2)))}
    ${line('Cash-flow mensuel', ok((a) => `${sign(a.monthlyCashflow)}${eur(a.monthlyCashflow)}`))}
    ${line('Négociation', ok((a) => `${a.negoLabel} (offre ${eur(a.offerPrice)})`))}
    ${line('DPE', (l) => esc(l.dpe))}
    ${line('Lien', (l) => linkHtml(l))}
    </tbody></table></div></div>`;
  $('#modal').showModal();
}

/* ---------- export CSV ---------- */
const csvCell = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; // neutralise les formules de tableur
function toCsv(rows) {
  const head = ['ville', 'cp_dept', 'type', 'surface_m2', 'prix', 'prix_m2', 'prix_m2_marche', 'ecart_marche_pct', 'rendement_brut_pct', 'rendement_net_pct', 'cashflow_mensuel', 'score', 'verdict', 'negociation', 'offre_conseillee', 'dpe', 'demo', 'lien'];
  const body = rows.map((l) => { const a = l.analysis; return [l.city, l.dept, l.typeLabel, l.surface, l.price, a.askPxM2, a.marketPxM2, a.discountPct, a.grossYield, a.netYield, a.monthlyCashflow, a.score, a.verdict, a.negoLabel, a.offerPrice, l.dpe, l.demo ? 'oui' : 'non', providerLink(l).href].map(csvCell).join(';'); });
  return '﻿' + [head.join(';'), ...body].join('\n');
}
async function exportCsv() {
  if (!items.length) return;
  const data = toCsv(items), filename = `immoia-${new Date().toISOString().slice(0, 10)}.csv`;
  try {
    const dl = window.claude ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename, data }); return; }
  } catch (e) { return; } // le visiteur a refusé l'enregistrement
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
  a.download = filename; document.body.appendChild(a); a.click(); a.remove();
}

/* ---------- événements ---------- */
let t;
form.addEventListener('input', (e) => {
  if (e.target.name === 'alertMin') { prefs.set('alertMin', form.alertMin.value); renderAlert(); return; }
  clearTimeout(t); t = setTimeout(loadListings, 250);
});
form.addEventListener('submit', (e) => e.preventDefault());
$('#grid').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const id = fav.dataset.fav;
    favs.has(id) ? favs.delete(id) : favs.add(id);
    prefs.set('favs', [...favs]);
    fav.textContent = favs.has(id) ? 'Retirer des favoris' : 'Favori';
    fav.setAttribute('aria-pressed', favs.has(id));
    if (form.favOnly.checked) loadListings();
    return;
  }
  if (e.target.closest('.cmp')) return;
  const c = e.target.closest('.card');
  if (c) modal(items.find((x) => String(x.id) === c.dataset.id));
});
$('#grid').addEventListener('change', (e) => {
  const cb = e.target.closest('[data-cmp]');
  if (!cb) return;
  const id = cb.dataset.cmp;
  if (cb.checked) {
    if (compare.length >= 4) { cb.checked = false; $('#count').textContent = 'Vous pouvez comparer 4 biens au maximum.'; return; }
    compare.push(id);
  } else compare = compare.filter((x) => x !== id);
  syncCompare();
});
$('#btnCompare').addEventListener('click', openCompare);
$('#btnExport').addEventListener('click', exportCsv);
$('#modal').addEventListener('click', (e) => {
  if (e.target === $('#modal') || e.target.closest('.m__close')) { $('#modal').close(); return; }
  const ai = e.target.closest('#aiBtn');
  if (ai) writeAnalysis(items.find((x) => String(x.id) === ai.dataset.id));
});

/* ---------- secteurs ---------- */
let sectors = [], sortKey = 'grossYieldRef', sortDir = -1;
async function loadSectors() { sectors = await (await fetch('/api/sectors?' + params())).json(); renderSectors(); }
function renderSectors() {
  const rows = [...sectors].sort((a, b) => {
    const x = a[sortKey] ?? -Infinity, y = b[sortKey] ?? -Infinity;
    return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sortDir;
  });
  $('#sectors tbody').innerHTML = rows.map((s) => `<tr data-city="${esc(s.city)}">
    <td>${esc(s.city)} <span class="muted">(${esc(s.dept)})</span></td><td>${eur(s.pxM2)} <span class="muted">${esc(s.marketSource)}</span></td><td>${s.rentM2.toLocaleString('fr-FR')} €</td>
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

/* ---------- concurrents (contenu statique, non vérifié en ligne) ---------- */
const COMPETITORS = [
  { name: 'SeLoger / Bien\'ici', role: 'Portails d\'annonces', plus: 'Volume d\'annonces le plus large, alertes e-mail quotidiennes', minus: 'Aucune analyse de rentabilité ni de négociation', price: 'Gratuit (acheteur)', data: 'Annonces des agences et particuliers' },
  { name: 'Jinka', role: 'Agrégateur d\'alertes', plus: 'Réunit plusieurs portails, alertes quasi instantanées, filtre les doublons', minus: 'Peu de calcul financier, pensé pour la location autant que l\'achat', price: 'Gratuit + abonnement', data: 'Portails d\'annonces' },
  { name: 'Lybox', role: 'Agrégateur pour investisseurs', plus: 'Rendement affiché sur les annonces agrégées, filtres investisseur', minus: 'Abonnement, calculs peu paramétrables', price: 'Abonnement', data: 'Portails d\'annonces, estimation de loyers' },
  { name: 'Horiz.io (ex-Rendement Locatif)', role: 'Simulateur de rentabilité', plus: 'Simulation détaillée avec fiscalité (LMNP, SCI), suivi de patrimoine', minus: 'Les biens sont saisis à la main, pas de recherche d\'annonces', price: 'Gratuit limité + abonnement', data: 'Saisie utilisateur' },
  { name: 'Castorus', role: 'Historique des annonces', plus: 'Historique des prix et durée de mise en vente d\'une annonce', minus: 'Pas de rendement ni de score, extension navigateur', price: 'Gratuit', data: 'Suivi des annonces' },
  { name: 'MeilleursAgents', role: 'Estimation de prix', plus: 'Prix au m² par rue, historique du marché', minus: 'Pas d\'annonces investisseur, pas de cash-flow', price: 'Gratuit (particulier)', data: 'Ventes réelles, estimations' },
  { name: 'ImmoIA', role: 'Analyse d\'opportunité', plus: 'Score unique : décote, rendement net, cash-flow, négociation et offre conseillée ; priorité Montpellier ; sources affichées', minus: 'Annonces réelles seulement via alertes e-mail ou import ; DVF à brancher', price: 'Ouvert, sans abonnement', data: 'DVF, alertes de l\'utilisateur, loyers observés' },
];
const COMPETITOR_PLUS = [
  'Un seul score lisible qui combine prix vs marché, rendement net, cash-flow, demande locative et marge de négociation.',
  'Une offre d\'achat conseillée avec ses leviers (durée en ligne, baisses, DPE, vendeur pressé).',
  'Chaque chiffre indique sa source et sa date ; les données indicatives ou de démonstration sont signalées.',
  'Loyers réels observés dans les alertes de l\'utilisateur, utilisés pour recaler le modèle.',
  'Favoris, comparaison côte à côte, export CSV et analyse rédigée sans abonnement.',
];
const COMPETITOR_MINUS = [
  'Pas de flux d\'annonces en direct : il faut des alertes « Acheter » ou un import.',
  'Pas de fiscalité (LMNP, SCI, déficit foncier) dans le calcul du rendement.',
  'Pas d\'historique de prix sur l\'ensemble du marché, seulement sur les annonces importées.',
  'Prix de marché indicatifs tant que DVF n\'est pas branché.',
];
function renderCompetitors() {
  $('#cmpTable').innerHTML = `<thead><tr><th>Outil</th><th>Rôle</th><th>Points forts</th><th>Limites</th><th>Prix</th><th>Données</th></tr></thead><tbody>${
    COMPETITORS.map((c) => `<tr${c.name === 'ImmoIA' ? ' style="font-weight:600"' : ''}><td data-l="Outil">${esc(c.name)}</td><td data-l="Rôle">${esc(c.role)}</td><td data-l="Points forts">${esc(c.plus)}</td><td data-l="Limites">${esc(c.minus)}</td><td data-l="Prix">${esc(c.price)}</td><td data-l="Données">${esc(c.data)}</td></tr>`).join('')}</tbody>`;
  $('#cmpPlus').innerHTML = COMPETITOR_PLUS.map((x) => `<li>${esc(x)}</li>`).join('');
  $('#cmpMinus').innerHTML = COMPETITOR_MINUS.map((x) => `<li>${esc(x)}</li>`).join('');
}

/* ---------- onglets ---------- */
function show(view) {
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('is-on', b.dataset.view === view));
  $('#view-annonces').hidden = view !== 'annonces';
  $('#view-secteurs').hidden = view !== 'secteurs';
  $('#view-loyers').hidden = view !== 'loyers';
  $('#view-concurrents').hidden = view !== 'concurrents';
  if (view === 'secteurs') loadSectors();
  if (view === 'concurrents') renderCompetitors();
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (b) show(b.dataset.view);
});

/* ---------- loyers réels : base de données (version web) ou fichier local ---------- */
const median = (arr) => { const s = [...arr].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; };
let modelRentM2 = null;

function renderRentals(rows) {
  const apts = rows.filter((r) => r.kind === 'appartement' && r.surface > 0);
  const med = median(apts.map((r) => r.rent / r.surface));
  const stat = (v, l) => `<div class="metric"><b>${v}</b><span>${l}</span></div>`;
  $('#rentalsStats').innerHTML =
    stat(rows.length, 'annonces enregistrées') +
    stat(med === null ? '—' : med.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' €', 'loyer médian /m² (appartements)') +
    stat(modelRentM2 === null ? '—' : modelRentM2.toLocaleString('fr-FR') + ' €', 'hypothèse du modèle (Montpellier)');
  $('#rentalsTable tbody').innerHTML = rows.map((r) => {
    const m2 = r.kind === 'appartement' && r.surface > 0 ? (r.rent / r.surface).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' €' : '—';
    return `<tr><td>${esc(r.seenAt || '')}</td><td>${esc(r.label || r.kind || '')}</td><td>${esc(r.district || '')}${r.district ? ', ' : ''}${esc(r.city || '')}</td>
      <td>${r.surface ? esc(r.surface) + ' m²' : '—'}</td><td>${eur(r.rent)} <span class="muted">${r.chargesIncluded ? 'CC' : 'HC'}</span></td><td>${m2}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="muted" style="text-align:left">Aucune annonce enregistrée pour le moment.</td></tr>';
}

async function initRentals() {
  const note = $('#rentalsNote');
  try { const s = await (await fetch('/api/sectors')).json(); modelRentM2 = (s.find((x) => x.city === 'Montpellier') || {}).rentM2 ?? null; } catch (e) { /* facultatif */ }
  let db = null;
  try { db = window.claude ? await window.claude.use('db') : null; } catch (e) { db = null; }
  if (!db) {
    const local = await (await fetch('/api/rentals')).json();
    note.textContent = local.length ? 'Loyers lus dans data/rentals.json (import local).' : 'Aucun loyer importé. Ajoutez des alertes de location dans data/inbox puis lancez « npm run daily ».';
    renderRentals(local.map((r) => ({ ...r, kind: r.rentKind || 'appartement', seenAt: r.firstSeen || r.seenAt })));
    return;
  }
  note.textContent = 'Chargement de la base…';
  const timer = setTimeout(() => { note.textContent = 'La base ne répond pas encore. Les données affichées peuvent être anciennes.'; }, 10000);
  db.collection('rentals').orderBy('seenAt', 'desc').limit(500).onSnapshot(
    (snap) => { clearTimeout(timer); note.textContent = ''; renderRentals(snap.docs.map((d) => d.data())); },
    () => { clearTimeout(timer); note.textContent = 'Lecture de la base impossible pour le moment.'; }
  );
}

/* ---------- init ---------- */
(async () => {
  form.alertMin.value = prefs.get('alertMin', '') || '';
  const meta = await (await fetch('/api/meta')).json();
  $('#heroNote').textContent = meta.market
    ? `Prix de marché : ${meta.market.source} ${meta.market.year} (mis à jour le ${meta.market.updatedAt}). ${meta.real ? `${meta.real} annonce(s) réelle(s) importée(s).` : 'Annonces de démonstration.'}`
    : `Prix de marché indicatifs (pas encore de données DVF). ${meta.real ? `${meta.real} annonce(s) réelle(s) importée(s).` : 'Annonces de démonstration.'}`;
  $('#regionSel').insertAdjacentHTML('beforeend', meta.regions.map((r) => `<option>${esc(r)}</option>`).join(''));
  loadListings();
  initRentals();
})();
