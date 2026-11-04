'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseAlert } = require('../connectors/seloger-alert');
const { parseListingsCsv } = require('../connectors/csv');
const { normalizeListing, deptOf, parseNumber, guessType } = require('../connectors/normalize');

const ALERT = [
  '2 nouvelles annonces : Lattes', 'https://click.example/h', '', ' 2 nouvelles annonces', '', ' Recherche élargie', '',
  'https://click.example/p1', '249 000 €', '', 'https://click.example/t1', 'Appartement T3', '', 'https://click.example/s1', '3 pièces . 60,5 m²', '',
  'https://click.example/l1', '', ' Centre,', '', ' Lattes', ' (34970)', '', 'https://click.example/v1', "Voir l'annonce", '',
  'https://click.example/p2', '1 123,91 €/mois charges comprises', '', 'https://click.example/t2', 'Maison', '', 'https://click.example/s2', '5 pièces . 110 m²', '',
  'https://click.example/l2', '', ' Montpellier', ' (34000)', '', 'https://click.example/v2', "Voir l'annonce", '',
  'Se désabonner', 'https://click.example/unsub',
].join('\n');

test('alerte SeLoger : vente et location, lien, quartier, code postal', () => {
  const r = parseAlert(ALERT, { date: '2026-11-04' });
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual([r[0].kind, r[0].price, r[0].surface, r[0].rooms, r[0].city, r[0].zip, r[0].district, r[0].url],
    ['sale', 249000, 60.5, 3, 'Lattes', '34970', 'Centre', 'https://click.example/v1']);
  assert.deepStrictEqual([r[1].kind, r[1].rent, r[1].chargesIncluded, r[1].city], ['rent', 1123.91, true, 'Montpellier']);
});

test('alerte vide ou illisible : aucune annonce, aucune erreur', () => {
  assert.deepStrictEqual(parseAlert(''), []);
  assert.deepStrictEqual(parseAlert('Bonjour\nrien à voir'), []);
});

test('CSV : séparateur point-virgule, nombres français', () => {
  const r = parseListingsCsv('prix;surface;pieces;ville;cp;dpe;url\n"210 000";45,5;2;Pérols;34470;E;https://exemple.fr/a\n');
  assert.strictEqual(r.length, 1);
  assert.deepStrictEqual([r[0].price, r[0].surface, r[0].rooms, r[0].city, r[0].dpe], [210000, 45.5, 2, 'Pérols', 'E']);
});

test('normalisation : rejets et sécurité des liens', () => {
  assert.strictEqual(normalizeListing({ kind: 'sale', price: 0, surface: 40, city: 'X' }).ok, false);
  assert.strictEqual(normalizeListing({ kind: 'sale', price: 1000, surface: NaN, city: 'X' }).ok, false);
  assert.strictEqual(normalizeListing({ kind: 'sale', price: 1000, surface: 40, city: '' }).ok, false);
  const l = normalizeListing({ kind: 'sale', price: 100000, surface: 40, city: 'Lattes', zip: '34970', url: 'javascript:alert(1)', dpe: 'zz' }).listing;
  assert.strictEqual(l.url, undefined);
  assert.strictEqual(l.dpe, 'N/D');
  assert.strictEqual(l.region, 'Occitanie');
});

test('utilitaires', () => {
  assert.strictEqual(deptOf('34000'), '34');
  assert.strictEqual(deptOf('20100'), '2A');
  assert.strictEqual(deptOf('97400'), '974');
  assert.strictEqual(deptOf('abc'), '');
  assert.strictEqual(parseNumber('1 123,5'), 1123.5);
  assert.ok(Number.isNaN(parseNumber('n/a')));
  assert.strictEqual(guessType('Studio meublé', 1), 'studio');
  assert.strictEqual(guessType('Immeuble de rapport', 0), 'immeuble');
});

test('cycle quotidien : import, dédoublonnage, baisse de prix, journal, alertes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'immoia-'));
  process.env.IMMOIA_DATA = dir;
  delete require.cache[require.resolve('../store')];
  const store = require('../store');
  fs.mkdirSync(path.join(dir, 'inbox'));
  fs.writeFileSync(path.join(dir, 'inbox', 'a.txt'), ALERT);
  const { main } = require('../scripts/daily');
  // le réseau n'est pas disponible pour ce test : DVF doit échouer proprement sans bloquer l'import
  const run1 = await main({ today: '2026-11-01', alertMin: 0 });
  assert.strictEqual(run1.added, 2);               // 1 vente (listings.json) + 1 location (rentals.json)
  assert.strictEqual(store.read('rentals', []).length, 1);
  assert.ok(fs.existsSync(path.join(dir, 'inbox', 'done', 'a.txt')));
  // même bien, même prix : pas de doublon
  fs.writeFileSync(path.join(dir, 'inbox', 'b.txt'), ALERT);
  const run2 = await main({ today: '2026-11-02', alertMin: 0 });
  assert.strictEqual(run2.added, 0);
  assert.strictEqual(store.read('listings', []).length, 1);
  // même bien, prix en baisse : historique + baisse comptée
  fs.writeFileSync(path.join(dir, 'inbox', 'c.txt'), ALERT.replace('249 000', '239 000'));
  const run3 = await main({ today: '2026-11-10', alertMin: 0 });
  assert.strictEqual(run3.updated, 1);
  const l = store.withDerived(store.read('listings', [])[0], new Date('2026-11-10'));
  assert.deepStrictEqual([l.price, l.priceDrops, l.daysOnline], [239000, 1, 9]);
  const journal = store.read('journal', []);
  assert.strictEqual(journal.length, 3);
  assert.ok(journal.every((j) => typeof j.date === 'string' && Array.isArray(j.errors)));
  assert.ok(run1.alerts.length === 1); // seuil 0 : le nouveau bien déclenche une alerte
});
