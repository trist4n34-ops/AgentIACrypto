# ImmoIA

Analyse d'annonces immobilières pour investisseurs français : prix au m² comparé aux ventes réelles, rendement brut et net,
cash-flow avec financement, facilité de négociation, offre conseillée, score de 0 à 100. Priorité à Montpellier et sa métropole.

## Démarrer

    npm start            # http://localhost:3000   (Node 20 ou plus, aucune dépendance)
    npm test             # 18 tests : formules, cas limites, lecteurs d'import, cycle quotidien
    npm run build        # régénère standalone.html (version web autonome)

Sans données importées, l'application affiche des **annonces de démonstration** (fictives, badge « Démo »).
Dès qu'il existe des annonces réelles dans `data/listings.json`, ce sont elles qui s'affichent par défaut.

## Sources de données (légales uniquement)

| Donnée | Source | Comment |
|---|---|---|
| Prix de marché | DVF (data.gouv.fr, geo-dvf) | `npm run dvf -- 2024` → `data/market.json` |
| Loyers | indicatifs, ou alertes de location importées | onglet « Loyers réels » |
| Annonces de vente | alertes e-mail de l'utilisateur, CSV, API payante autorisée | dossier `data/inbox/` ou variables d'environnement |

Ne jamais scraper un portail dont les conditions l'interdisent. Chaque donnée affichée indique sa source ; les valeurs
indicatives ou de démonstration sont signalées dans l'interface.

## Mise à jour quotidienne

    npm run daily

1. DVF : met à jour `data/market.json` (si le réseau le permet ; en cas d'échec, les données précédentes sont conservées).
2. API fournisseur (optionnelle) : `LISTINGS_API_URL` et `LISTINGS_API_KEY` ; adapter `connectors/api-adapter.js` (`mapItem`) au fournisseur.
3. `data/inbox/*.txt` : texte brut d'e-mails d'alerte SeLoger ; `data/inbox/*.csv` : exports (colonnes : url, prix, surface, pieces, ville, cp, type, dpe, vendeur, titre). Les fichiers traités passent dans `inbox/done/`.
4. Dédoublonnage par bien, historique des prix (→ baisses de prix, jours en ligne), alertes (`ALERT_MIN_SCORE`, 70 par défaut), journal `data/journal.json`.

À planifier avec cron, par exemple `41 19 * * * cd /chemin/immo-ia && npm run daily`.

## Ajouter une source

Écrire un connecteur qui renvoie des objets `{ kind:'sale'|'rent', price|rent, surface, rooms, city, zip, label, url, dpe, seller, source, date }`,
puis les passer à `store.upsert()`. `connectors/normalize.js` valide et normalise (prix/surface obligatoires, liens `http(s)` uniquement).

## Calculs

Tous les paramètres (frais de notaire, vacance, charges, poids du score, seuils des verdicts, plafond de négociation) sont dans `config.js`.
Frais de notaire : 7,5 % dans l'ancien, 2,5 % dans le neuf. Rendement net = (loyers × (1 − vacance) − taxe foncière − charges non récupérables − gestion) ÷ coût total.

## Architecture

    config.js            paramètres de calcul
    analyzer.js          moteur d'analyse (rendement, cash-flow, négociation, score)
    data.js              villes et marché indicatif, annonces de démonstration
    api.js               routes (partagées par le serveur Node et la version web)
    server.js            serveur HTTP + fichiers statiques
    store.js             stockage JSON, dédoublonnage, historique, journal
    connectors/          dvf, alertes SeLoger, CSV, API fournisseur, normalisation
    scripts/daily.js     mise à jour quotidienne
    public/              interface
    build.js             génère standalone.html (page unique, calculs dans le navigateur)

## Version web publiée

La version web (`standalone.html`) ajoute : base de données partagée pour les loyers réels, analyse rédigée par Claude
(à partir des seuls chiffres calculés), export CSV par la plateforme. Aucune clé n'est stockée dans le code.

## Limites connues

- Prix et loyers sont indicatifs tant que DVF et un observatoire des loyers n'ont pas été importés.
- DVF est mis à jour deux fois par an : ce n'est pas du temps réel.
- Le lecteur d'alertes SeLoger a été écrit d'après la structure observée de leurs e-mails ; un changement de format demande une mise à jour de `connectors/seloger-alert.js`.
- Le connecteur DVF n'a été testé que sur des fichiers d'exemple (réseau indisponible pendant le développement).
