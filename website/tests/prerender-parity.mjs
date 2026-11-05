// Pre-rendered visuals: side-by-side pixel parity test.
//
// Loads a reference build (--a, default :3001) and a candidate build (--b,
// default :3000) on a deterministic virtual clock (requestAnimationFrame,
// performance.now, Date.now, Math.random and every CSS animation/transition
// are stepped together), advances both to the same animation times, and
// diffs the screenshots. The ambient renderer runs on the main thread under
// this clock (window.__EEL_TEST__), so the comparison is frame-exact.
//
//   node tests/prerender-parity.mjs --profile=desktop|retina|laptop|wide|mobile \
//        --theme=dark|light --times=3,11,29 --state=home|panel-people|scroll-900
// Deterministic side-by-side pixel comparison of two builds of the site.
// Both pages run on a virtual clock (rAF/performance.now/Math.random/CSS animations),
// are stepped to identical animation times, then screenshotted and diffed.
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from './lib/png.mjs';

// System Chrome gives real GPU rendering; set CHROME_PATH to override.
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);

const arg = (n, d) => { const p = process.argv.find(a => a.startsWith(`--${n}=`)); return p ? p.slice(n.length + 3) : d; };
const urlA = arg('a', 'http://127.0.0.1:3001/');
const urlB = arg('b', 'http://127.0.0.1:3000/');
const profile = arg('profile', 'desktop');
const theme = arg('theme', 'dark');
const times = arg('times', '4').split(',').map(Number);   // seconds of virtual time
const state = arg('state', 'home');                         // home | panel-<id> | scroll-<px>
const outDir = arg('out', path.resolve('./test-results/parity'));
const tag = arg('tag', `${profile}-${theme}-${state}`);
const gpu = arg('gpu', 'on');
const cssA = arg('cssA', ''), cssB = arg('cssB', '');
fs.mkdirSync(outDir, { recursive: true });

const profiles = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  laptop: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  retina: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  wide: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  mobileland: { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const vp = profiles[profile];

const launchOpts = {
  executablePath: CHROME,
  headless: 'new',
  args: gpu === 'on' ? ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist', '--force-color-profile=srgb', '--hide-scrollbars']
    : ['--disable-gpu', '--force-color-profile=srgb', '--hide-scrollbars'],
  protocolTimeout: 600000,
};
const browsers = [];

function installClock(theme) {
  // ---- virtual clock -------------------------------------------------------
  let vnow = 0;
  const realRaf = window.requestAnimationFrame.bind(window);
  performance.now = () => vnow;
  const dateBase = 1767225600000;
  Date.now = () => dateBase + vnow;
  let seed = 0x00E311AB;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let q = [];
  let id = 0;
  window.requestAnimationFrame = (cb) => { q.push({ id: ++id, cb }); return id; };
  window.cancelAnimationFrame = (h) => { q = q.filter(e => e.id !== h); };
  window.__vclock = {
    get now() { return vnow; },
    step(n, dt = 1000 / 60) {
      for (let i = 0; i < n; i++) {
        vnow += dt;
        const run = q; q = [];
        for (const e of run) { try { e.cb(vnow); } catch (err) { console.error(err); } }
        window.__vclock.syncCss();
      }
      return vnow;
    },
    // Finite CSS animations/transitions are frozen when they appear and later
    // advanced by virtual elapsed time, so both builds see identical states.
    capture() {
      for (const a of document.getAnimations()) {
        if (a.__vstart !== undefined) continue;
        let it = 1; try { it = a.effect.getTiming().iterations; } catch (e) { }
        a.__vstart = it === Infinity ? 0 : vnow;
        try { a.pause(); if (it !== Infinity) a.currentTime = 0; } catch (e) { }
      }
    },
    syncCss() {
      window.__vclock.capture();
      for (const a of document.getAnimations()) {
        try { a.pause(); a.currentTime = Math.max(0, vnow - (a.__vstart || 0)); } catch (e) { }
      }
    },
    realFrame() { return Promise.race([new Promise(r => realRaf(() => realRaf(r))), new Promise(r => setTimeout(r, 800))]); },
  };
  window.__EEL_TEST__ = { virtualClock: true };
  localStorage.setItem('eel-has-visited', 'true');
  localStorage.setItem('eel-theme', theme);
  localStorage.setItem('eel-theme-manually-set', 'true');
}

async function openPage(url) {
  const browser = await puppeteer.launch(launchOpts); browsers.push(browser);
  const [page] = await browser.pages();
  await page.setViewport(vp);
  if (vp.isMobile) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  const logs = [];
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') logs.push(m.type() + ': ' + m.text()); });
  await page.evaluateOnNewDocument(installClock, theme);
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => Promise.all(['100', '200', '300', '400', '500'].map((w) => document.fonts.load(w + ' 16px Inter'))).then(() => document.fonts.ready));
  await new Promise(r => setTimeout(r, 300));
  // Let init timers (three.js polling, reveal) run with a few virtual frames.
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.__vclock.step(1, 0.0001));
    await new Promise(r => setTimeout(r, 25));
  }
  page.__logs = logs;
  return page;
}

async function advanceTo(page, seconds) {
  const target = seconds * 1000;
  // Step in 1/60 s increments so integrators (drone smoothing) see identical dt sequences.
  await page.evaluate(async (target) => {
    const c = window.__vclock;
    while (c.now + 1e-6 < target - 1000 / 60 * 0.5) c.step(1);
  }, target);
  await page.evaluate(() => window.__vclock.syncCss());
  await page.evaluate(() => window.__vclock.realFrame());
  await new Promise(r => setTimeout(r, 400));
  await page.evaluate(() => window.__vclock.realFrame());
}

async function applyState(page) {
  if (state.startsWith('panel-')) {
    const id = state.slice(6);
    await page.evaluate((id) => { const p = document.getElementById(id); expandPanel(id, p.dataset.contentType); }, 'panel-' + id);
    // let rAF-driven expand code run, then let CSS transitions finish in real time
    for (let i = 0; i < 90; i++) { await page.evaluate(() => { window.__vclock.step(1); window.__vclock.syncCss(); }); await new Promise(r => setTimeout(r, 12)); }
    await new Promise(r => setTimeout(r, 1000));
    for (let i = 0; i < 6; i++) { await page.evaluate(() => { window.__vclock.step(1); window.__vclock.syncCss(); }); await new Promise(r => setTimeout(r, 30)); }
  } else if (state.startsWith('scroll-')) {
    const y = Number(state.slice(7));
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await new Promise(r => setTimeout(r, 300));
  }
}

function diff(a, b, outPath) {
  const w = a.width, h = a.height;
  const out = new PNG(w, h);
  let n = 0, n1 = 0, n3 = 0, n8 = 0, n32 = 0, max = 0, sum = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    const d = Math.max(Math.abs(a.data[i] - b.data[i]), Math.abs(a.data[i + 1] - b.data[i + 1]), Math.abs(a.data[i + 2] - b.data[i + 2]));
    n++; sum += d; if (d > max) max = d;
    if (d > 0) n1++; if (d > 2) n3++; if (d > 7) n8++; if (d > 31) n32++;
    const g = Math.round(a.data[i] * 0.3 + a.data[i + 1] * 0.59 + a.data[i + 2] * 0.11) * 0.25;
    if (d === 0) { out.data[i] = out.data[i + 1] = out.data[i + 2] = g; }
    else if (d <= 2) { out.data[i] = g; out.data[i + 1] = 120 + g; out.data[i + 2] = g; }
    else if (d <= 7) { out.data[i] = 255; out.data[i + 1] = 200; out.data[i + 2] = 0; }
    else { out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 60; }
    out.data[i + 3] = 255;
  }
  fs.writeFileSync(outPath, PNG.encode(out));
  return { pixels: n, identical: +(100 * (n - n1) / n).toFixed(3), within2: +(100 * (n - n3) / n).toFixed(3), over2: n3, over7: n8, over31: n32, max, mean: +(sum / n).toFixed(4) };
}

const pa = await openPage(urlA);
const pb = await openPage(urlB);
if (cssA) await pa.addStyleTag({ content: cssA });
if (cssB) await pb.addStyleTag({ content: cssB });
await applyState(pa); await applyState(pb);
const results = [];
for (const t of times) {
  await advanceTo(pa, t); await advanceTo(pb, t);
  const fa = path.join(outDir, `${tag}-t${t}-A.png`), fb = path.join(outDir, `${tag}-t${t}-B.png`), fd = path.join(outDir, `${tag}-t${t}-diff.png`);
  await pa.screenshot({ path: fa }); await pb.screenshot({ path: fb });
  const A = PNG.decode(fs.readFileSync(fa)), B = PNG.decode(fs.readFileSync(fb));
  const r = diff(A, B, fd);
  results.push({ t, ...r });
  console.log(`${tag} t=${t}s identical ${r.identical}% | within±2 ${r.within2}% | >2: ${r.over2}px >7: ${r.over7}px >31: ${r.over31}px | max ${r.max} mean ${r.mean}`);
}
const logs = { A: pa.__logs, B: pb.__logs };
if (logs.A.length || logs.B.length) console.log('logs', JSON.stringify(logs).slice(0, 2000));
fs.writeFileSync(path.join(outDir, `${tag}.json`), JSON.stringify({ urlA, urlB, profile, theme, state, results, logs }, null, 2));
for (const b of browsers) await b.close();
