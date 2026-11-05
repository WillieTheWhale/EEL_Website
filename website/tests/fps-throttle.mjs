// Frame-rate test under CPU throttling (and optionally without a GPU).
//
// Measures requestAnimationFrame cadence (main thread) and Chrome's frame
// presentation trace while idle, scrolling, and hovering/opening/closing
// each panel.
//
//   node tests/fps-throttle.mjs --url=http://127.0.0.1:3000/ --cpu=6|20 \
//        --gpu=on|off --profile=desktop|mobile --scenario=idle|scroll|open|all
//
// Note: DevTools CPU throttling slows only the page's main thread, not Web
// Workers; the ambient renderer's own per-frame cost is reported separately
// by EELAmbientHost.workerStats().
// FPS harness: measures main-thread rAF cadence and compositor-presented frames
// under CPU throttling, for idle and panel open/close scenarios.
import puppeteer from 'puppeteer';
import fs from 'node:fs';

const arg = (n, d) => { const p = process.argv.find(a => a.startsWith(`--${n}=`)); return p ? p.slice(n.length + 3) : d; };
const url = arg('url', 'http://127.0.0.1:3000/');
const profile = arg('profile', 'desktop');
const throttle = Number(arg('cpu', '6'));
const gpu = arg('gpu', 'on');               // on | off (software compositing + SwiftShader)
const scenario = arg('scenario', 'idle');   // idle | open | all
const theme = arg('theme', 'dark');
const seconds = Number(arg('seconds', '6'));
const out = arg('out', '');
const headless = arg('headless', 'new');

const profiles = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  laptop: { width: 1366, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  retina: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const args = gpu === 'on'
  ? ['--enable-gpu', '--use-angle=metal', '--ignore-gpu-blocklist']
  : ['--disable-gpu', '--disable-gpu-compositing', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
args.push('--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${profiles[profile].width},${profiles[profile].height + 120}`);

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || (fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  headless: headless === 'false' ? false : headless, args, defaultViewport: null,
});
const page = await browser.newPage();
await page.setViewport(profiles[profile]);
if (profiles[profile].isMobile) {
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
}
await page.evaluateOnNewDocument((t) => {
  localStorage.setItem('eel-has-visited', 'true');
  localStorage.setItem('eel-theme', t);
  localStorage.setItem('eel-theme-manually-set', 'true');
  window.__frames = [];
  window.__recording = false;
  const loop = (ts) => { if (window.__recording) window.__frames.push(ts); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
}, theme);
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const cdp = await page.createCDPSession();
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, Number(arg('settle', '2500'))));
const injectCss = arg('css', '');
if (injectCss) await page.addStyleTag({ content: injectCss });
const injectJs = arg('js', '');
if (injectJs) await page.evaluate(injectJs);
if (injectCss || injectJs) await new Promise(r => setTimeout(r, 500));
await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
await new Promise(r => setTimeout(r, 1000));

function stats(ts) {
  const d = []; for (let i = 1; i < ts.length; i++) d.push(ts[i] - ts[i - 1]);
  if (!d.length) return { frames: 0 };
  const total = ts[ts.length - 1] - ts[0];
  const sorted = [...d].sort((a, b) => a - b);
  const pct = p => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return {
    fps: +(d.length / (total / 1000)).toFixed(1),
    p50: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), p99: +pct(0.99).toFixed(1), max: +sorted[sorted.length - 1].toFixed(1),
    over20ms: d.filter(x => x > 20).length, over34ms: d.filter(x => x > 34).length, intervals: d.length,
  };
}

async function measure(label, action) {
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['disabled-by-default-devtools.timeline.frame', 'devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'benchmark'] }, transferMode: 'ReturnAsStream' });
  const before = await cdp.send('Performance.getMetrics').catch(() => null);
  await page.evaluate(() => { window.__frames = []; window.__recording = true; });
  const t0 = Date.now();
  await action();
  const elapsed = Date.now() - t0;
  const frames = await page.evaluate(() => { window.__recording = false; return window.__frames; });
  const done = new Promise(res => cdp.once('Tracing.tracingComplete', res));
  await cdp.send('Tracing.end');
  const { stream } = await done;
  let data = '';
  for (;;) { const r = await cdp.send('IO.read', { handle: stream }); data += r.base64Encoded ? Buffer.from(r.data, 'base64').toString() : r.data; if (r.eof) break; }
  await cdp.send('IO.close', { handle: stream });
  const events = JSON.parse(data).traceEvents || JSON.parse(data);
  // PipelineReporter top-level events carry the presentation state per frame.
  const states = {};
  let mainBusy = 0;
  for (const e of events) {
    if (e.name === 'PipelineReporter' && e.ph === 'b' && (e.args?.frame_reporter || e.args?.chrome_frame_reporter)) {
      const fr = e.args.frame_reporter || e.args.chrome_frame_reporter; const s = fr.state || 'UNKNOWN';
      states[s] = (states[s] || 0) + 1;
    }
    if (e.name === 'RunTask' && e.ph === 'X' && e.dur && e.cat?.includes('devtools.timeline')) mainBusy += e.dur;
  }
  const presented = (states.STATE_PRESENTED_ALL || 0) + (states.STATE_PRESENTED_PARTIAL || 0);
  const totalReported = Object.values(states).reduce((a, b) => a + b, 0);
  return {
    label, elapsedMs: elapsed, raf: stats(frames),
    compositor: { states, presentedFps: +(presented / (elapsed / 1000)).toFixed(1), droppedPct: totalReported ? +(100 * (states.STATE_DROPPED || 0) / totalReported).toFixed(1) : null },
  };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const results = [];

if (scenario === 'idle' || scenario === 'all') {
  results.push(await measure('idle', () => sleep(seconds * 1000)));
}
if (scenario === 'scroll' || scenario === 'all') {
  const vp = profiles[profile];
  results.push(await measure('scroll-down', () => cdp.send('Input.synthesizeScrollGesture', { x: Math.round(vp.width / 2), y: Math.round(vp.height * 0.7), yDistance: -1800, speed: 1500, gestureSourceType: vp.isMobile ? 'touch' : 'mouse' }).then(() => sleep(300))));
  results.push(await measure('scroll-up', () => cdp.send('Input.synthesizeScrollGesture', { x: Math.round(vp.width / 2), y: Math.round(vp.height * 0.3), yDistance: 1800, speed: 1500, gestureSourceType: vp.isMobile ? 'touch' : 'mouse' }).then(() => sleep(300))));
}
if (scenario === 'open' || scenario === 'all') {
  const ids = (arg('panels', 'panel-projects,panel-people,panel-about,panel-join')).split(',');
  for (const id of ids) {
    const isMobile = profiles[profile].isMobile;
    let box;
    results.push(await measure('hover:' + id, async () => {
      if (isMobile) {
        await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
        await sleep(300);
      }
      box = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
      if (!isMobile) { await page.mouse.move(box.x - 40, box.y - 40); await page.mouse.move(box.x, box.y, { steps: 8 }); }
      await sleep(500);
    }));
    results.push(await measure('open:' + id, async () => {
      if (isMobile) await page.touchscreen.tap(box.x, box.y);
      else { await page.mouse.down(); await sleep(40); await page.mouse.up(); }
      await sleep(1600);
    }));
    results.push(await measure('close:' + id, async () => {
      await page.keyboard.press('Escape');
      await sleep(1600);
    }));
  }
}

const summary = { url, profile, throttle, gpu, theme, errors, results };
if (out) fs.writeFileSync(out, JSON.stringify(summary, null, 2));
for (const r of results) {
  console.log(`${profile} cpu${throttle}x gpu:${gpu} ${r.label.padEnd(20)} rAF ${String(r.raf.fps).padStart(5)}fps p95 ${String(r.raf.p95).padStart(5)}ms max ${String(r.raf.max).padStart(6)}ms >20ms:${String(r.raf.over20ms).padStart(3)}/${r.raf.intervals} | presented ${r.compositor.presentedFps}fps dropped ${r.compositor.droppedPct}%`);
}
if (errors.length) console.log('ERRORS', errors);
await browser.close();
