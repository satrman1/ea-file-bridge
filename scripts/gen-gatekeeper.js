// gen-gatekeeper.js — regeneruje src/AICodeBridge.FB_Gatekeeper.js z src/gatekeeper.ps1.
// FB_Gatekeeper (operace modelu) je jen textovy nosic PS kanonu vratneho;
// editovatelny zdroj = gatekeeper.ps1. Po zmene PS spust:  node scripts/gen-gatekeeper.js
// Deterministicke (zadny timestamp) -> git diff ukaze jen skutecne zmeny.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src', 'gatekeeper.ps1'), 'utf8');
const bad = [...src].filter(c => c.charCodeAt(0) > 127);
if (bad.length) { console.error('CHYBA: gatekeeper.ps1 obsahuje non-ASCII znaky:', bad.slice(0,5)); process.exit(1); }
const lines = src.replace(/\r\n/g, '\n').replace(/\n+$/,'').split('\n');
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const out = [
  '// AICodeBridge.FB_Gatekeeper()',
  '// KANON VRATNEHO (AI import rezim, iterace 4) - vraci PowerShell zdroj',
  '// jako text. Jediny kanon PS kodu vratneho = tato metoda v modelu',
  '// (zrcadlo: src/AICodeBridge.FB_Gatekeeper.js). Vratny NIKDY nelezi na',
  '// disku jako skript - FB_GatekeeperLaunch ho materializuje inline:',
  '// powershell.exe -EncodedCommand <bootstrap iex([Console]::In.ReadToEnd())>',
  '// + plny kod rourou StdIn (nosic schvalen 2026-08-19; command line ma',
  '// strop 32767 znaku a kanon se do nej nevejde - red team W2 potvrzen).',
  '// Cisty JS (zadny COM) - kompiluje se bez chyb v obou runtime (par. 1a).',
  '// Radky zacinajici # a prazdne radky launcher pri materializaci vypousti.',
  '// UDRZBA: NEEDITUJ tento soubor rucne - je generovany z src/gatekeeper.ps1',
  '// prikazem: node scripts/gen-gatekeeper.js',
  'var L = ['
];
for (const ln of lines) out.push("'" + esc(ln) + "',");
out.push("''];");
out.push('return L.join("\\n");');
const js = out.join('\n') + '\n';
fs.writeFileSync(path.join(root, 'src', 'AICodeBridge.FB_Gatekeeper.js'), js);
console.log('OK: FB_Gatekeeper.js regenerovan (' + lines.length + ' PS radku, ' + js.length + ' znaku)');
