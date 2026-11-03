import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const opts = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  target: 'chrome110',
  outfile: 'dist/app.js',
  minify: !watch,
  sourcemap: watch,
  legalComments: 'none',
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('[build] watching src/ …');
} else {
  const t0 = Date.now();
  await esbuild.build(opts);
  console.log(`[build] dist/app.js  ${Date.now() - t0}ms`);
}
