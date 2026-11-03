import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'dist/app.js'), 'utf8');

let out = html;

out = out.replace(/<link[^>]*href="\.?\/?style\.css"[^>]*>/i, `<style>\n${css}\n</style>`);

const safe = js.replace(/<\/script>/gi, '<\\/script>');
out = out.replace(/<script[^>]*src="\.?\/?dist\/app\.js"[^>]*>\s*<\/script>/i, `<script>\n${safe}\n</script>`);

if (out.includes('dist/app.js') || out.includes('href="./style.css"')) {
  console.error('[pack] external refs still present');
  process.exit(1);
}

const dest = path.join(root, 'HARVESTER-PV.html');
fs.writeFileSync(dest, out, 'utf8');
console.log('[pack] wrote', dest, (fs.statSync(dest).size / 1024 / 1024).toFixed(2) + ' MB');
