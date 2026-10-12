import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { Script } from 'node:vm';

const base = new URL('../dist/', import.meta.url);
const modules = ['config', 'rules', 'simulation', 'input', 'audio', 'renderer', 'ranking', 'main'];
const parts = [];
for (const name of modules) {
  const source = await readFile(new URL(`game/${name}.js`, base), 'utf8');
  const converted = source
    .replace(/^import\s+[^\n]+\n/gm, '')
    .replace(/^export\s+(?=(?:const|function|class)\b)/gm, '');
  if (/^\s*(?:import|export)\s/m.test(converted)) throw new Error(`Unsupported module declaration in ${name}`);
  parts.push(converted);
}
const code = '(function(){\n"use strict";\n' + parts.join('\n') + '\n})();';
new Script(code);

const css = await readFile(new URL('style.css', base), 'utf8');
const icon = await readFile(new URL('icon.svg', base));
let html = await readFile(new URL('index.html', base), 'utf8');
html = html.replace('<link rel="stylesheet" href="./style.css">', () => '<style>\n' + css + '\n</style>');
html = html.replace('href="./icon.svg"', 'href="data:image/svg+xml;base64,' + icon.toString('base64') + '"');
html = html.replace('<script type="module" src="./game/main.js"></script>', () => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>');
if (/(?:src|href)="\.\//.test(html)) throw new Error('Standalone file still depends on another file');

await mkdir(new URL('../release/', import.meta.url), { recursive: true });
await writeFile(new URL('../release/snake-garden.html', import.meta.url), html);
console.log('Standalone browser file: release/snake-garden.html');
