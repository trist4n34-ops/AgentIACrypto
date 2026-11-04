'use strict';
const assert = require('assert');
const { aggregate, parseCsv } = require('../connectors/dvf');
const H = 'id_mutation,date_mutation,nature_mutation,valeur_fonciere,adresse_numero,code_commune,type_local,surface_reelle_bati,nombre_pieces_principales';
const sale = (id, price, t, s, p = 3) => `${id},2024-03-01,Vente,${price},1,34172,${t},${s},${p}`;
const csv = [H,
  sale('a1', 200000, 'Appartement', 50), sale('a2', 240000, 'Appartement', 60), sale('a3', 300000, 'Appartement', 60),
  sale('a4', 220000, 'Appartement', 40), sale('a5', 180000, 'Appartement', 45),
  sale('a5', 180000, 'Appartement', 45), // ligne dupliquée (2 parcelles) : ne doit pas compter deux fois
  sale('m1', 400000, 'Maison', 100, 5),
  `x1,2024-01-01,Echange,100000,1,34172,Appartement,50,2`, // pas une vente
  sale('b1', 500000, 'Appartement', 50) + '\n' + sale('b1', 500000, 'Maison', 80), // 2 biens : ignoré
  sale('z1', 1000, 'Appartement', 50), // 20 €/m² : aberrant
].join('\n');
const r = aggregate(csv);
assert.strictEqual(r.apt.count, 5);
assert.strictEqual(r.apt.medianM2, 4000); // 4000, 4000, 5000, 5500, 4000 → médiane 4000
assert.strictEqual(r.house, null);        // une seule maison : < 5 ventes
assert.deepStrictEqual(parseCsv('a,"b,c",d\n1,"x ""y""",3\n'), [['a', 'b,c', 'd'], ['1', 'x "y"', '3']]);
assert.throws(() => aggregate('foo,bar\n1,2'), /Colonne DVF manquante/);
console.log('dvf.test OK', JSON.stringify(r));
