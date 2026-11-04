'use strict';
/**
 * Lit le texte brut (PLAIN_TEXT) d'un e-mail d'alerte SeLoger reçu par l'utilisateur et en extrait les annonces,
 * avec leur lien. Gère les ventes (« 250 000 € ») et les locations (« 930 €/mois charges comprises »).
 * Les e-mails sont des données : rien de leur contenu n'est exécuté.
 */
const { parseNumber } = require('./normalize');

function parseAlert(text, { date } = {}) {
  const lines = String(text).split(/\r?\n/).map((s) => s.trim());
  const out = [];
  let start = 0;
  lines.forEach((ln, i) => {
    if (!/^Voir l['’]annonce/i.test(ln)) return;
    const block = lines.slice(start, i + 1);
    start = i + 1;
    const urls = block.filter((s) => /^https?:\/\//.test(s));
    const url = urls[urls.length - 1];
    const priceLine = block.findIndex((s) => /€/.test(s) && /\d/.test(s));
    if (priceLine < 0) return;
    const pm = block[priceLine].match(/([\d\s  .,]*\d)\s*€\s*(\/\s*mois)?\s*(charges comprises|hors charges)?/i);
    if (!pm) return;
    const rest = block.slice(priceLine + 1).filter((s) => s && !/^https?:\/\//.test(s));
    const label = rest.find((s) => !/m²/.test(s) && !/^\(\d{5}\)$/.test(s) && !/,$/.test(s) && s.length > 2 && !/^Voir/i.test(s)) || '';
    const sm = rest.join(' ').match(/(\d+(?:[.,]\d+)?)\s*m²/);
    const rm = rest.join(' ').match(/(\d+)\s*pi[èe]ces?/i);
    const zipIdx = rest.findIndex((s) => /^\(\d{5}\)$/.test(s));
    const zip = zipIdx >= 0 ? rest[zipIdx].slice(1, 6) : '';
    const city = zipIdx > 0 ? rest[zipIdx - 1].replace(/,$/, '') : '';
    const distRaw = zipIdx > 1 ? rest[zipIdx - 2] : '';
    out.push({
      kind: pm[2] ? 'rent' : 'sale',
      price: parseNumber(pm[1]), rent: parseNumber(pm[1]),
      chargesIncluded: /comprises/i.test(pm[3] || ''),
      label, surface: sm ? parseNumber(sm[1]) : NaN, rooms: rm ? +rm[1] : 0,
      city, zip, district: /,$/.test(distRaw) ? distRaw.replace(/,$/, '') : '',
      url, source: 'alerte SeLoger', date,
    });
  });
  return out;
}

module.exports = { parseAlert };
