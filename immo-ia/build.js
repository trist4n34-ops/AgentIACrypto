'use strict';
// Génère standalone.html : une page unique (données + moteur d'analyse + interface), sans serveur.
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
const html = read('public/index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script src="app.js">')).trim();
const mod = (name, src) => `__mods[${JSON.stringify(name)}]=function(module,exports,require){${src}\n};`;
const out = `<title>ImmoIA</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${read('public/styles.css')}
body{background:var(--bg);color:var(--ink);padding-block:0}
</style>
${body}
<script>
(function(){
var __mods={},__cache={};
function __req(n){n=n.replace(/^\\.\\//,'').replace(/\\.js$/,'');if(!__cache[n]){var m={exports:{}};__cache[n]=m;__mods[n](m,m.exports,__req);}return __cache[n].exports;}
${mod('data', read('data.js'))}
${mod('analyzer', read('analyzer.js'))}
${mod('api', read('api.js'))}
${fs.existsSync(path.join(__dirname, 'data/market.json')) ? '__mods["market"]=function(module){module.exports=' + read('data/market.json') + ';};' : ''}
var api=__req('api');
window.fetch=function(u){var x=new URL(u,'http://x');var r=api.route(x.pathname,x.searchParams);
  return Promise.resolve({ok:r.status<400,status:r.status,json:function(){return Promise.resolve(r.body);}});};
})();
</script>
<script>
${read('public/app.js')}
</script>
`;
fs.writeFileSync(path.join(__dirname, 'standalone.html'), out);
console.log('standalone.html', Math.round(out.length / 1024) + ' KB');
