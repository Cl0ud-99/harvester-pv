import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

/* usage:
   node tools/shot.mjs --out shots/x.png --eval "__cinema.jump(0,0.4)" --w 1600 --h 900 --wait 1400 [--swift] [--url ...]
*/
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const OUT = arg('out', 'shots/shot.png');
const EVAL = arg('eval', '');
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const WAIT = Number(arg('wait', 1400));
const SETTLE = Number(arg('settle', 900));
const URL_ = arg('url', 'http://localhost:5199/');
const swift = has('swift');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const args = [
  '--no-sandbox', '--disable-dev-shm-usage', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--font-render-hinting=none',
  '--enable-webgl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
  '--enable-features=Vulkan', '--disable-frame-rate-limit',
];
if (swift) args.push('--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader');
else args.push('--use-angle=d3d11', '--enable-gpu');

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args, defaultViewport: { width: W, height: H } });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e.message}`));

await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 120000 });

try {
  await page.waitForFunction('window.__ready === true', { timeout: 180000, polling: 250 });
} catch (e) {
  logs.push('[warn] __ready never became true');
}
await new Promise((r) => setTimeout(r, SETTLE));

let evalResult = null;
if (EVAL) {
  try { evalResult = await page.evaluate(EVAL); } catch (e) { logs.push('[evalerror] ' + e.message); }
  await new Promise((r) => setTimeout(r, WAIT));
}

const info = await page.evaluate(() => {
  const r = window.__renderInfo;
  return r ? r() : null;
});

fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
await page.screenshot({ path: path.resolve(OUT), type: 'png' });

console.log(JSON.stringify({
  out: path.resolve(OUT),
  eval: evalResult,
  info,
  logs: logs.slice(-40),
}, null, 2));

await browser.close();
