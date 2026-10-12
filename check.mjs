import { access, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await access(new URL('./dist/index.html', import.meta.url));
for (const file of await readdir(new URL('./dist/game/', import.meta.url))) {
  if (file.endsWith('.js')) execFileSync(process.execPath, ['--check', `dist/game/${file}`], { stdio: 'inherit' });
}
await import('./scripts/build-standalone.mjs');
console.log('Static game ready: dist/ (no dependency installation required)');
