// EEL - Experimental Engineering Lab
// Golden Ratio Cybercore System with Radial Panel Layout

const PHI = 1.618033988749;
const PHI_INV = 0.618033988749;

// Mobile portrait CSS hides the WebGL canvas and circuit network completely.
// Keep their state available for orientation changes, but do not spend every
// frame rendering elements that cannot contribute a pixel to the page.
const _initialTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const _initialNarrowViewport = window.innerWidth <= 768;
const _initialMobileDevice =
    (_initialTouchDevice && window.matchMedia('(pointer: coarse)').matches &&
        window.matchMedia('(hover: none)').matches) ||
    (_initialTouchDevice && _initialNarrowViewport);

const RuntimeVisibility = {
    // Match MobileHandler's existing device test synchronously so hidden work
    // never starts during the handler's short initialization delay.
    mobilePortrait: _initialMobileDevice && window.innerHeight > window.innerWidth,

    setMobilePortrait: function(isMobilePortrait) {
        const wasHidden = this.mobilePortrait;
        this.mobilePortrait = isMobilePortrait;

        // The circuit network is skipped during an initial mobile-portrait
        // load. Create it lazily if an orientation change makes it visible.
        if (wasHidden && !isMobilePortrait &&
            radialPanelPhysics && radialPanelPhysics.initialized &&
            !CircuitGridMatrix.initialized) {
            TetherSystem.init();
            TetherSystem.update();
        }

        if (wasHidden !== isMobilePortrait) startVisualRuntime();
    }
};

window.EELRuntime = RuntimeVisibility;

// ============================================
// AMBIENT RENDERER HOST
// ============================================
// Feeds the pre-rendered background engine (ambient.js) with the geometry,
// colours and keyframes it needs. Everything is read from the live CSS, so
// styles.css stays the single source of truth for how the scene looks.

const AmbientHost = {
    engine: null,          // engine instance when running on this thread
    worker: null,          // worker running the engine, when supported
    droneEngine: null,     // main-thread drone fallback if the worker has no WebGL
    mode: 'off',           // 'worker' | 'main' | 'off'
    nebulaCanvas: null,
    glowCanvas: null,
    droneCanvas: null,
    gearCanvases: [],
    droneState: 'idle',    // idle | loading | ready | failed
    _droneWaiters: [],
    _probe: null,
    _resizeTimer: 0,
    _mobilePortrait: null,
    _statsResolvers: [],

    THREE_URL: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',

    supported: function() {
        return typeof window.EELAmbient !== 'undefined' && !!document.createElement('canvas').getContext;
    },

    testMode: function() {
        return !!window.__EEL_TEST__ || /[?&]ambient=main\b/.test(location.search);
    },

    init: function() {
        if (this.mode !== 'off' || !this.supported()) return;

        const nebula = document.querySelector('.organic-nebula');
        if (nebula) {
            this.nebulaCanvas = document.createElement('canvas');
            this.nebulaCanvas.className = 'nebula-canvas';
            this.nebulaCanvas.setAttribute('aria-hidden', 'true');
            nebula.appendChild(this.nebulaCanvas);
        }
        const medallion = document.getElementById('centralMedallion');
        if (medallion) {
            this.glowCanvas = document.createElement('canvas');
            this.glowCanvas.className = 'medallion-shadow-canvas';
            this.glowCanvas.setAttribute('aria-hidden', 'true');
            // Painted after the glass so it stays out of the glass's
            // backdrop-filter input, like the box-shadow it replaces.
            medallion.appendChild(this.glowCanvas);
        }
        this.droneCanvas = document.getElementById('three-canvas');
        this.createGearIcons(document.querySelectorAll('.panel-icon'));

        const canWorker = !this.testMode() &&
            typeof Worker !== 'undefined' &&
            typeof OffscreenCanvas !== 'undefined' &&
            typeof HTMLCanvasElement.prototype.transferControlToOffscreen === 'function';

        const theme = document.body.getAttribute('data-theme') || 'light';
        const base = { type: 'init', theme: theme, mobilePortrait: RuntimeVisibility.mobilePortrait };

        if (canWorker) {
            try {
                const scriptEl = document.querySelector('script[src$="ambient.js"]');
                this.worker = new Worker(scriptEl ? scriptEl.src : 'ambient.js');
                const transfer = [];
                const off = (c) => { if (!c) return null; const o = c.transferControlToOffscreen(); transfer.push(o); return o; };
                const msg = Object.assign({}, base, {
                    mainTimeOrigin: performance.timeOrigin,
                    threeUrl: this.THREE_URL,
                    canvases: {
                        nebula: off(this.nebulaCanvas),
                        glow: off(this.glowCanvas),
                        gears: this.gearCanvases.map(off),
                        drone: off(this.droneCanvas)
                    }
                });
                this.worker.onmessage = (e) => this.onEngineMessage(e.data);
                this.worker.onerror = () => this.fallbackToMain();
                this.worker.postMessage(msg, transfer);
                this.mode = 'worker';
                // If the worker never comes up, render on this thread instead.
                this._readyTimer = setTimeout(() => { if (!this._workerReady) this.fallbackToMain(); }, 4000);
            } catch (e) {
                console.warn('Ambient worker unavailable; rendering on the main thread.', e);
                this.worker = null;
            }
        }

        if (this.mode !== 'worker') this.startMainEngine();

        this.whenStylesReady(() => {
            this.configureNebula();
            this.configureGlow();
            this.configureGears();
        });
        // The medallion and panels are positioned/revealed asynchronously;
        // refresh the pixel alignment once layout has settled.
        window.addEventListener('load', () => setTimeout(() => this.configureLayout(), 50));

        window.addEventListener('themechange', (e) => {
            this.post({ type: 'theme', theme: e.detail.theme });
            this.configureNebula();
            this.configureGlow();
        });
        window.addEventListener('resize', () => {
            clearTimeout(this._resizeTimer);
            this._resizeTimer = setTimeout(() => {
                this.configureLayout();
                this.post({ type: 'drone', config: this.droneConfig() });
            }, 100);
        }, { passive: true });
        document.addEventListener('visibilitychange', () => {
            this.post({ type: 'visibility', hidden: document.hidden });
        });
    },

    startMainEngine: function() {
        this.engine = new window.EELAmbient.Engine({
            onMessage: (m) => this.onEngineMessage(m),
            loadThree: () => window.EELLoadThree ? window.EELLoadThree() : Promise.reject(new Error('no loader'))
        });
        this.engine.handle({
            type: 'init',
            theme: document.body.getAttribute('data-theme') || 'light',
            mobilePortrait: RuntimeVisibility.mobilePortrait,
            canvases: { nebula: this.nebulaCanvas, glow: this.glowCanvas, gears: this.gearCanvases, drone: this.droneCanvas }
        });
        this.mode = 'main';
    },

    // The worker failed (script error, or it never started): its canvases
    // cannot be taken back, so swap in fresh ones and render here.
    fallbackToMain: function() {
        if (this.mode !== 'worker' || this._fellBack) return;
        this._fellBack = true;
        console.warn('Ambient worker failed; rendering on the main thread.');
        clearTimeout(this._readyTimer);
        if (this.droneEngine) {
            if (this.droneEngine.drone) this.droneEngine.drone.dispose();
            this.droneEngine = null;
        }
        try { this.worker.terminate(); } catch (e) { /* already gone */ }
        this.worker = null;
        const swap = (c) => {
            if (!c || !c.parentNode) return c;
            const fresh = document.createElement('canvas');
            fresh.className = c.className;
            if (c.id) fresh.id = c.id;
            fresh.style.cssText = c.style.cssText;
            fresh.setAttribute('aria-hidden', 'true');
            c.parentNode.replaceChild(fresh, c);
            return fresh;
        };
        this.nebulaCanvas = swap(this.nebulaCanvas);
        this.glowCanvas = swap(this.glowCanvas);
        this.droneCanvas = swap(this.droneCanvas);
        this.gearCanvases = this.gearCanvases.map(swap);
        if (typeof _cachedThreeCanvas !== 'undefined') _cachedThreeCanvas = null;
        this.startMainEngine();
        if (this._bgPausedState) this.engine.handle({ type: 'bgPaused', paused: true, time: performance.now() });
        this.configureLayout();
        if (this.droneState !== 'idle') { this.droneState = 'loading'; this.post({ type: 'drone', config: this.droneConfig() }); }
        if (this._circuitPayload) {
            const canvas = swap(this._circuitCanvas);
            if (CircuitGridMatrix.canvas === this._circuitCanvas) CircuitGridMatrix.canvas = canvas;
            this.initCircuits(canvas, this._circuitPayload);
        }
        wakeScene();
    },

    configureLayout: function() {
        this.configureNebula();
        this.configureGlow();
        this.configureGears();
    },

    post: function(msg) {
        if (this.worker) this.worker.postMessage(msg);
        else if (this.engine) this.engine.handle(msg);
        if (this.droneEngine && /^(drone|droneFade|theme|bgPaused|visibility|mobilePortrait)$/.test(msg.type)) {
            this.droneEngine.handle(msg);
        }
    },

    // Called every frame by the main scene loop.
    mainFrame: function(now) {
        if (this.engine) this.engine.frame(now);
        if (this.droneEngine) this.droneEngine.frame(now);
    },

    onEngineMessage: function(msg) {
        if (msg.type === 'ready') {
            this._workerReady = true;
            clearTimeout(this._readyTimer);
            return;
        }
        if (msg.type === 'droneReady') {
            this.droneState = 'ready';
            renderer = true;
            this.flushDroneWaiters();
        } else if (msg.type === 'droneFailed') {
            if (this.mode === 'worker' && !this.droneEngine) {
                this.startMainThreadDrone();
            } else {
                this.droneState = 'failed';
                document.documentElement.classList.add('no-webgl');
                console.warn('WebGL background unavailable; continuing with the static background.');
                this.flushDroneWaiters();
            }
        } else if (msg.type === 'stats') {
            const r = this._statsResolvers.shift();
            if (r) r(msg.stats);
        }
    },

    // The worker could not create a WebGL context (e.g. no WebGL in
    // workers): swap in a fresh canvas and render the drone on this thread.
    startMainThreadDrone: function() {
        const old = this.droneCanvas;
        const fresh = document.createElement('canvas');
        fresh.id = old.id;
        fresh.className = old.className;
        old.parentNode.replaceChild(fresh, old);
        this.droneCanvas = fresh;
        if (typeof _cachedThreeCanvas !== 'undefined') _cachedThreeCanvas = null;
        this.droneEngine = new window.EELAmbient.Engine({
            onMessage: (m) => {
                if (m.type === 'droneFailed') { this.droneEngine = null; this.onEngineMessage(m); }
                else this.onEngineMessage(m);
            },
            loadThree: () => window.EELLoadThree ? window.EELLoadThree() : Promise.reject(new Error('no loader'))
        });
        this.droneEngine.handle({
            type: 'init', theme: document.body.getAttribute('data-theme') || 'light',
            mobilePortrait: RuntimeVisibility.mobilePortrait, canvases: { drone: fresh }
        });
        if (this._bgPausedState) this.droneEngine.handle({ type: 'bgPaused', paused: true, time: performance.now() });
        this.droneEngine.handle({ type: 'drone', config: this.droneConfig() });
    },

    initCircuits: function(canvas, payload) {
        this._circuitCanvas = canvas;
        this._circuitPayload = payload;
        const msg = {
            type: 'circuitsInit', size: payload.size, styles: payload.styles, time: payload.time,
            packets: payload.packets.map((p) => ({ conn: p.conn, progress: p.progress, speed: p.speed, direction: p.direction }))
        };
        if (this.worker) {
            msg.canvas = canvas.transferControlToOffscreen();
            msg.autoTick = true;
            this.worker.postMessage(msg, [msg.canvas]);
        } else if (this.engine) {
            msg.canvas = canvas;
            msg.autoTick = false;
            this.engine.handle(msg);
        }
    },

    // On the main thread the packets advance exactly when the old code
    // advanced them; in a worker the engine keeps that cadence itself.
    circuitTick: function(now) {
        if (!this.worker && this.engine) this.engine.handle({ type: 'circuitTick', time: now });
    },

    droneConfig: function() {
        return { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 };
    },

    startDrone: function() {
        if (this.mode === 'off') return;
        if (this.droneState === 'idle') this.droneState = 'loading';
        this.post({ type: 'drone', config: this.droneConfig() });
    },

    // Test clock only: mirror the old start order (loop starts with the drone).
    waitForDroneBeforeLoop: function() {
        if (!this.testMode() || RuntimeVisibility.mobilePortrait) return false;
        if (this.droneState === 'ready' || this.droneState === 'failed') return false;
        this._droneWaiters.push(startSceneLoop);
        return true;
    },

    flushDroneWaiters: function() {
        const w = this._droneWaiters;
        this._droneWaiters = [];
        w.forEach((fn) => fn());
    },

    setMobilePortrait: function(value) {
        if (this._mobilePortrait === value) return;
        this._mobilePortrait = value;
        this.post({ type: 'mobilePortrait', value: value });
        clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this.configureLayout(), 100);
    },

    setBgPaused: function(paused) {
        this._bgPausedState = paused;
        this.post({ type: 'bgPaused', paused: paused, time: performance.now() });
    },

    // Worker frame-time statistics (for performance testing).
    workerStats: function() {
        return new Promise((resolve) => {
            if (this.worker) { this._statsResolvers.push(resolve); this.worker.postMessage({ type: 'stats' }); }
            else if (this.engine) { const s = this.engine.stats; this.engine.stats = { frames: 0, busyMs: 0, maxMs: 0 }; resolve(s); }
            else resolve(null);
        });
    },

    dispose: function() {
        if (this.worker) this.worker.terminate();
        [this.engine, this.droneEngine].forEach((e) => { if (e && e.drone) e.drone.dispose(); });
    },

    // styles.css is loaded asynchronously; wait until its rules apply.
    stylesReady: function() {
        const blob = document.querySelector('.nebula-blob');
        if (!blob) return true;
        const container = blob.parentNode;
        const had = container.classList.contains('eel-prerendered');
        if (had) container.classList.remove('eel-prerendered');
        const ready = /blur\(/.test(getComputedStyle(blob).filter);
        if (had) container.classList.add('eel-prerendered');
        return ready;
    },

    whenStylesReady: function(cb) {
        if (this.stylesReady()) { cb(); return; }
        const started = Date.now();
        const check = () => {
            if (this.stylesReady()) cb();
            else if (Date.now() - started < 15000) setTimeout(check, 30);
        };
        setTimeout(check, 30);
    },

    // ---- CSS reading helpers ------------------------------------------
    probe: function() {
        if (!this._probe) {
            const p = document.createElement('div');
            p.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;';
            document.body.appendChild(p);
            this._probe = p;
        }
        return this._probe;
    },

    lengthPx: function(expr) {
        const p = this.probe();
        p.style.marginLeft = expr;
        const v = parseFloat(getComputedStyle(p).marginLeft);
        p.style.marginLeft = '';
        return isFinite(v) ? v : 0;
    },

    splitTopLevel: function(str, sep) {
        const parts = [];
        let depth = 0, cur = '';
        for (let i = 0; i < str.length; i++) {
            const ch = str[i];
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
            if (depth === 0 && (sep === ' ' ? /\s/.test(ch) : ch === sep)) {
                if (cur.trim()) parts.push(cur.trim());
                cur = '';
            } else {
                cur += ch;
            }
        }
        if (cur.trim()) parts.push(cur.trim());
        return parts;
    },

    parseColor: function(str) {
        const m = /rgba?\(([^)]+)\)/.exec(str);
        if (!m) return { r: 0, g: 0, b: 0, a: 0 };
        const v = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
        return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 };
    },

    parseRadialGradient: function(str) {
        const m = /radial-gradient\((.*)\)\s*$/.exec(str.trim());
        if (!m) return null;
        const parts = this.splitTopLevel(m[1], ',');
        let cx = 0.5, cy = 0.5;
        if (!/^(rgb|#|transparent)/.test(parts[0])) {
            const at = /at\s+([-\d.]+)%\s+([-\d.]+)%/.exec(parts[0]);
            if (at) { cx = parseFloat(at[1]) / 100; cy = parseFloat(at[2]) / 100; }
            parts.shift();
        }
        const stops = parts.map((p) => {
            const colorEnd = p.lastIndexOf(')') + 1;
            const color = this.parseColor(p.slice(0, colorEnd));
            const rest = p.slice(colorEnd).trim();
            color.pos = rest ? parseFloat(rest) / 100 : null;
            return color;
        });
        if (stops.length && stops[0].pos === null) stops[0].pos = 0;
        if (stops.length && stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
        for (let i = 1; i < stops.length; i++) {
            if (stops[i].pos === null) {
                let j = i;
                while (stops[j].pos === null) j++;
                const a = stops[i - 1].pos, b = stops[j].pos;
                for (let k = i; k < j; k++) stops[k].pos = a + (b - a) * (k - i + 1) / (j - i + 1);
            }
            if (stops[i].pos < stops[i - 1].pos) stops[i].pos = stops[i - 1].pos;
        }
        return { cx: cx, cy: cy, stops: stops };
    },

    findKeyframes: function(name) {
        for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try { rules = sheet.cssRules; } catch (e) { continue; }
            if (!rules) continue;
            for (const rule of Array.from(rules)) {
                if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === name) return rule;
            }
        }
        return null;
    },

    // translate/scale/rotate keyframes -> [{offset, v:[tx, ty, scale, deg]}]
    transformKeyframes: function(name) {
        const rule = this.findKeyframes(name);
        if (!rule) return null;
        const frames = [];
        for (const kf of Array.from(rule.cssRules)) {
            const v = [0, 0, 1, 0];
            const text = kf.style.getPropertyValue('transform');
            const fnRe = /([a-zA-Z]+)\(/g;
            let m;
            while ((m = fnRe.exec(text))) {
                let depth = 1, i = fnRe.lastIndex;
                while (i < text.length && depth > 0) { if (text[i] === '(') depth++; else if (text[i] === ')') depth--; i++; }
                const args = this.splitTopLevel(text.slice(fnRe.lastIndex, i - 1), ',');
                fnRe.lastIndex = i;
                if (m[1] === 'translate') { v[0] = this.lengthPx(args[0]); v[1] = args[1] ? this.lengthPx(args[1]) : 0; }
                else if (m[1] === 'scale') v[2] = parseFloat(args[0]);
                else if (m[1] === 'rotate') v[3] = parseFloat(args[0]);
            }
            kf.keyText.split(',').forEach((k) => {
                k = k.trim();
                const off = k === 'from' ? 0 : k === 'to' ? 1 : parseFloat(k) / 100;
                frames.push({ offset: off, v: v.slice() });
            });
        }
        frames.sort((a, b) => a.offset - b.offset);
        return frames;
    },

    configureNebula: function() {
        if (!this.nebulaCanvas) return;
        const container = this.nebulaCanvas.parentNode;
        const W = container.clientWidth, H = container.clientHeight;
        if (!W || !H) return;

        // Read the original (un-overridden) blob styles.
        container.classList.remove('eel-prerendered');
        const blobs = [];
        container.querySelectorAll('.nebula-blob').forEach((el) => {
            const cs = getComputedStyle(el);
            const blur = /blur\(([\d.]+)px\)/.exec(cs.filter);
            const kf = this.transformKeyframes(cs.animationName);
            const grad = this.parseRadialGradient(cs.backgroundImage);
            if (!blur || !kf || !grad) return;
            blobs.push({
                left: parseFloat(cs.left), top: parseFloat(cs.top),
                width: parseFloat(cs.width), height: parseFloat(cs.height),
                sigma: parseFloat(blur[1]),
                opacity: parseFloat(cs.opacity),
                gradient: grad,
                anim: {
                    duration: parseFloat(cs.animationDuration) * (cs.animationDuration.indexOf('ms') > 0 ? 1 : 1000),
                    direction: cs.animationDirection,
                    easing: cs.animationTimingFunction,
                    keyframes: kf
                }
            });
        });
        container.classList.add('eel-prerendered');
        if (!blobs.length) return;

        const sigma = Math.min.apply(null, blobs.map((b) => b.sigma));
        const h = sigma / 8;
        const grid = { h: h, x0: -h, y0: -h, cols: Math.ceil(W / h) + 2, rows: Math.ceil(H / h) + 2 };
        const c = this.nebulaCanvas;
        c.style.left = grid.x0 + 'px';
        c.style.top = grid.y0 + 'px';
        c.style.width = (grid.cols * h) + 'px';
        c.style.height = (grid.rows * h) + 'px';
        this.post({ type: 'nebula', config: { grid: grid, spriteTexel: sigma / 12, blobs: blobs } });
    },

    // ---- medallion glow: the animated box-shadow ------------------------
    parseShadowList: function(text) {
        const p = this.probe();
        p.style.boxShadow = text;
        const computed = getComputedStyle(p).boxShadow;
        p.style.boxShadow = '';
        if (!computed || computed === 'none') return [];
        return this.splitTopLevel(computed, ',').map((sh) => {
            const colorEnd = sh.indexOf(')') + 1;
            const c = this.parseColor(sh.slice(0, colorEnd));
            const nums = sh.slice(colorEnd).trim().split(/\s+/).map(parseFloat);
            return { r: c.r, g: c.g, b: c.b, a: c.a, x: nums[0] || 0, y: nums[1] || 0, blur: nums[2] || 0, spread: nums[3] || 0 };
        });
    },

    configureGlow: function() {
        if (!this.glowCanvas) return;
        const medallion = this.glowCanvas.parentNode;
        const glass = medallion.querySelector('.medallion-glass-container');
        if (!glass) return;
        medallion.classList.remove('eel-prerendered');
        const cs = getComputedStyle(glass);
        const name = cs.animationName;
        const duration = parseFloat(cs.animationDuration) * (cs.animationDuration.indexOf('ms') > 0 ? 1 : 1000);
        const easing = cs.animationTimingFunction, direction = cs.animationDirection;
        medallion.classList.add('eel-prerendered');
        const rule = name && name !== 'none' ? this.findKeyframes(name) : null;
        if (!rule) return;

        const frames = [];
        let count = 0;
        for (const kf of Array.from(rule.cssRules)) {
            const list = this.parseShadowList(kf.style.getPropertyValue('box-shadow'));
            count = Math.max(count, list.length);
            const v = [];
            list.forEach((sh) => v.push(sh.r * sh.a, sh.g * sh.a, sh.b * sh.a, sh.a, sh.x, sh.y, sh.blur, sh.spread));
            kf.keyText.split(',').forEach((k) => {
                k = k.trim();
                frames.push({ offset: k === 'from' ? 0 : k === 'to' ? 1 : parseFloat(k) / 100, v: v.slice() });
            });
        }
        if (!frames.length || frames.some((f) => f.v.length !== count * 8)) return;
        frames.sort((a, b) => a.offset - b.offset);

        // Shadows that never change across the keyframes stay a real
        // box-shadow on the glass (painted by the browser, so their sharp
        // edges sit exactly where they always did); only the animated glow
        // is drawn on the canvas.
        const staticList = [];
        for (let sIdx = 0; sIdx < count; sIdx++) {
            const v0 = frames[0].v.slice(sIdx * 8, sIdx * 8 + 8);
            const constant = frames.every((f) => f.v.slice(sIdx * 8, sIdx * 8 + 8).every((x, j) => Math.abs(x - v0[j]) < 1e-9));
            if (!constant) continue;
            const a = v0[3];
            const col = 'rgba(' + [0, 1, 2].map((j) => Math.round(a > 0 ? v0[j] / a : 0)).join(', ') + ', ' + a + ')';
            staticList.push(col + ' ' + v0[4] + 'px ' + v0[5] + 'px ' + v0[6] + 'px ' + v0[7] + 'px');
        }
        glass.style.boxShadow = staticList.length ? staticList.join(', ') : 'none';

        let pad = 4;
        frames.forEach((f) => {
            for (let s = 0; s < count; s++) {
                const o = s * 8;
                pad = Math.max(pad, 1.5 * f.v[o + 6] + Math.max(0, f.v[o + 7]) + Math.max(Math.abs(f.v[o + 4]), Math.abs(f.v[o + 5])) + 4);
            }
        });

        // Geometry in the medallion's own (pre-transform) layout space. Blink
        // paints box decorations on a pixel-snapped border box, and snaps the
        // canvas' layout position; the medallion's fractional translate(-50%)
        // then applies to both alike.
        const dpr = window.devicePixelRatio || 1;
        const rect = glass.getBoundingClientRect();
        const mrect = medallion.getBoundingClientRect();
        if (!rect.width) return;
        const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(medallion).transform);
        const mt = m ? m[1].split(',').map(parseFloat) : [1, 0, 0, 1, 0, 0];
        const Mx = mrect.left - mt[4], My = mrect.top - mt[5];
        const gx = Mx + (rect.left - mrect.left), gy = My + (rect.top - mrect.top);
        const GL = Math.round(gx * dpr), GR = Math.round((gx + rect.width) * dpr);
        const GT = Math.round(gy * dpr), GB = Math.round((gy + rect.height) * dpr);
        const originX = Math.floor((gx - pad) * dpr), originY = Math.floor((gy - pad) * dpr);
        const width = Math.ceil((gx + rect.width + pad) * dpr) - originX;
        const height = Math.ceil((gy + rect.height + pad) * dpr) - originY;
        const c = this.glowCanvas;
        c.style.left = (originX / dpr - Mx) + 'px';
        c.style.top = (originY / dpr - My) + 'px';
        c.style.width = (width / dpr) + 'px';
        c.style.height = (height / dpr) + 'px';
        this.post({
            type: 'glow',
            config: {
                width: width, height: height, dpr: dpr,
                cx: (GL + GR) / 2 - originX,
                cy: (GT + GB) / 2 - originY,
                r: (GR - GL) / 2,
                shadowCount: count,
                staticByHost: true,
                anim: { duration: duration, easing: easing, direction: direction, keyframes: frames }
            }
        });
    },

    // ---- gear icons -------------------------------------------------------
    createGearIcons: function(iconEls) {
        if (this.gearCanvases.length || !iconEls.length) return;
        iconEls.forEach((el) => {
            const c = document.createElement('canvas');
            c.className = 'panel-icon-canvas';
            c.setAttribute('aria-hidden', 'true');
            el.textContent = '';
            el.appendChild(c);
            this.gearCanvases.push(c);
        });
    },

    configureGears: function() {
        if (!this.gearCanvases.length) return;
        const dpr = window.devicePixelRatio || 1;
        const icons = this.gearCanvases.map((c) => {
            const box = c.parentNode;
            const cssW = box.clientWidth, cssH = box.clientHeight;
            return { cssW: cssW, cssH: cssH, dpr: dpr, width: Math.max(1, Math.round(cssW * dpr)), height: Math.max(1, Math.round(cssH * dpr)) };
        });
        this.post({ type: 'gears', config: { icons: icons } });
    }
};

window.EELAmbientHost = AmbientHost;

// ============================================
// THEME MANAGER
// ============================================

const ThemeManager = {
    init: function() {
        const hasVisited = localStorage.getItem('eel-has-visited');
        const savedTheme = localStorage.getItem('eel-theme');
        const userHasSetTheme = localStorage.getItem('eel-theme-manually-set') === 'true';
        
        let systemPrefersDark = false;
        if (window.matchMedia) {
            systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        let initialTheme;
        
        if (!hasVisited) {
            initialTheme = systemPrefersDark ? 'dark' : 'light';
            localStorage.setItem('eel-has-visited', 'true');
            localStorage.setItem('eel-theme', initialTheme);
            localStorage.setItem('eel-theme-manually-set', 'false');
        } else if (userHasSetTheme && savedTheme) {
            initialTheme = savedTheme;
        } else {
            initialTheme = systemPrefersDark ? 'dark' : (savedTheme || 'light');
            localStorage.setItem('eel-theme', initialTheme);
        }
        
        this.setTheme(initialTheme, false);
        
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleTheme());
            toggleBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.toggleTheme();
                }
            });
        }
        
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                const manuallySet = localStorage.getItem('eel-theme-manually-set') === 'true';
                if (!manuallySet) {
                    this.setTheme(e.matches ? 'dark' : 'light', true);
                }
            });
        }
        
               console.log('%cTheme initialized: ' + initialTheme + ' mode',
            'color: ' + (initialTheme === 'dark' ? '#9482ff' : '#7ec8e3') + '; font-weight: bold;');
    },
    
    setTheme: function(theme, animate, isManual) {
        animate = animate !== false;
        const body = document.body;
        const toggleBtn = document.getElementById('themeToggle');
        
        if (animate && toggleBtn) {
            toggleBtn.classList.add('toggling');
            setTimeout(() => toggleBtn.classList.remove('toggling'), 600);
        }
        
        body.setAttribute('data-theme', theme);
        localStorage.setItem('eel-theme', theme);
        
        if (isManual) {
            localStorage.setItem('eel-theme-manually-set', 'true');
        }
        
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = theme === 'dark' ? '#0a0b0f' : '#f0f0f0';
        }
        
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode');
        }
        
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    },
    
    toggleTheme: function() {
        const currentTheme = document.body.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme, true, true);
    },
    
};

// ============================================
// MEDALLION SYSTEM
// ============================================

const MedallionSystem = {
    element: null,
    position: { x: 0, y: 0 },
    
    init: function() {
        this.element = document.getElementById('centralMedallion');
        this.updatePosition();
        window.addEventListener('resize', () => this.updatePosition());
    },
    
    updatePosition: function() {
        this.position.x = window.innerWidth / 2;
        this.position.y = window.innerHeight / 2;
    },
    
    getCenter: function() {
        return this.position;
    }
};

// ============================================
// CIRCUIT GRID MATRIX SYSTEM
// ============================================

const CircuitGridMatrix = {
    svg: null,
    gridGroup: null,
    tracesGroup: null,
    canvas: null,
    initialized: false,
    cachedMedallionEl: null,
    cachedMedallionRadius: 100,

    // Grid configuration
    gridSize: 40, // Grid cell size in pixels
    gridOpacity: 0.08,

    // Connection data
    connections: new Map(),
    connectionList: [],
    packets: [],

    packetSpeed: 0.2, // Progress per second (reduced by 50%)

    // The grid pattern and the trace glows are static SVG. The dashed traces,
    // nodes and data packets animate, so they are simulated and drawn by the
    // ambient engine (ambient.js) on a canvas, off the main thread when the
    // browser supports it. This object only computes the routes.
    init: function() {
        const container = document.getElementById('engineeringNetwork');
        if (!container || this.initialized) return;

        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('class', 'circuit-grid-svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'defs'));

        this.gridGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.gridGroup.setAttribute('class', 'circuit-grid-layer');
        this.svg.appendChild(this.gridGroup);

        this.tracesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.tracesGroup.setAttribute('class', 'circuit-traces-layer');
        this.svg.appendChild(this.tracesGroup);

        this.createGridBackground();

        const panels = ['projects', 'people', 'about', 'join'];
        panels.forEach((id, index) => {
            const connection = { panelId: 'panel-' + id, index: index, pathPoints: [], glowElement: null };
            this.connections.set(connection.panelId, connection);
            this.connectionList.push(connection);
            for (let p = 0; p < 2; p++) {
                this.packets.push({
                    conn: index,
                    progress: (p * 0.5) + (index * 0.1), // Stagger packet positions
                    direction: 1,
                    speed: this.packetSpeed * (0.8 + Math.random() * 0.4)
                });
            }
        });

        container.appendChild(this.svg);

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'circuit-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        container.appendChild(this.canvas);
        const size = this.canvasSize();

        this.initialized = true;
        this.cachedMedallionEl = document.getElementById('centralMedallion');
        if (this.cachedMedallionEl) {
            this.cachedMedallionRadius = this.cachedMedallionEl.offsetWidth / 2;
        }

        AmbientHost.initCircuits(this.canvas, {
            size: size,
            styles: this.readStyles(),
            packets: this.packets,
            time: performance.now()
        });
        window.addEventListener('themechange', () => {
            AmbientHost.post({ type: 'circuitStyles', styles: this.readStyles(), time: performance.now() });
        });

        console.log('%cCircuit Grid Matrix initialized', 'color: #7ec8e3; font-weight: bold;');
    },

    canvasSize: function() {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.round(window.innerWidth * dpr), h = Math.round(window.innerHeight * dpr);
        this.canvas.style.width = (w / dpr) + 'px';
        this.canvas.style.height = (h / dpr) + 'px';
        return { width: w, height: h, dpr: dpr };
    },

    createGridBackground: function() {
        while (this.gridGroup.firstChild) {
            this.gridGroup.removeChild(this.gridGroup.firstChild);
        }

        const width = window.innerWidth;
        const height = window.innerHeight;
        const gridSize = this.gridSize;
        const ns = 'http://www.w3.org/2000/svg';
        const defs = this.svg.querySelector('defs');

        const oldPattern = defs.querySelector('#circuitGridPattern');
        if (oldPattern) oldPattern.remove();

        const pattern = document.createElementNS(ns, 'pattern');
        pattern.setAttribute('id', 'circuitGridPattern');
        pattern.setAttribute('width', gridSize);
        pattern.setAttribute('height', gridSize);
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');

        const pathD = 'M ' + gridSize + ' 0 L ' + gridSize + ' ' + gridSize + ' M 0 ' + gridSize + ' L ' + gridSize + ' ' + gridSize;
        const pathEl = document.createElementNS(ns, 'path');
        pathEl.setAttribute('d', pathD);
        pathEl.setAttribute('class', 'circuit-grid-line');
        pathEl.setAttribute('fill', 'none');
        pattern.appendChild(pathEl);
        defs.appendChild(pattern);

        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', 'url(#circuitGridPattern)');
        this.gridGroup.appendChild(rect);
    },

    readStyles: function() {
        const ns = 'http://www.w3.org/2000/svg';
        if (!this._probeSvg) {
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('class', 'circuit-style-probe');
            svg.setAttribute('aria-hidden', 'true');
            const mk = (tag, cls) => { const el = document.createElementNS(ns, tag); el.setAttribute('class', cls); svg.appendChild(el); return el; };
            this._probes = {
                trace: mk('path', 'circuit-trace'),
                junction: mk('rect', 'circuit-junction'),
                junctionP: mk('rect', 'circuit-junction pulsing'),
                port: mk('circle', 'circuit-medallion-port'),
                portP: mk('circle', 'circuit-medallion-port pulsing'),
                endpoint: mk('circle', 'circuit-endpoint'),
                packet: mk('rect', 'circuit-packet'),
                glow: mk('rect', 'circuit-packet-glow')
            };
            document.getElementById('engineeringNetwork').appendChild(svg);
            this._probeSvg = svg;
        }
        const P = this._probes;
        const color = (v) => { const m = /rgba?\(([^)]+)\)/.exec(v); if (!m) return [0, 0, 0, 0]; const a = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1]; };
        const shadowBlur = (f) => { const m = /drop-shadow\((.*)\)/.exec(f || ''); if (!m) return 0; const nums = m[1].replace(/rgba?\([^)]*\)/, '').match(/[-\d.]+px/g) || []; return nums.length >= 3 ? parseFloat(nums[2]) : 0; };
        const cs = (el) => getComputedStyle(el);
        const t = cs(P.trace), j = cs(P.junction), jp = cs(P.junctionP), p = cs(P.port), pp = cs(P.portP), e = cs(P.endpoint), k = cs(P.packet), g = cs(P.glow);
        return ({
            trace: { stroke: color(t.stroke), opacity: +t.opacity, width: parseFloat(t.strokeWidth), dash: t.strokeDasharray.split(/[\s,]+/).map(parseFloat) },
            junction: { fill: color(j.fill), opacity: +j.opacity, pulseFill: color(jp.fill), pulseOpacity: +jp.opacity },
            port: { fill: color(p.fill), opacity: +p.opacity, shadow: shadowBlur(p.filter), shadowColor: color((/drop-shadow\((rgba?\([^)]*\))/.exec(p.filter) || [])[1] || p.fill), pulseFill: color(pp.fill), pulseOpacity: +pp.opacity },
            endpoint: { fill: color(e.fill), opacity: +e.opacity },
            packet: { fill: color(k.fill), opacity: +k.opacity },
            glow: { fill: color(g.fill), opacity: +g.opacity }
        });
    },

    snapToGrid: function(x, y) {
        return { x: this._snapVal(x), y: this._snapVal(y) };
    },

    _snapVal: function(v) {
        const gs = this.gridSize;
        return Math.round(v / gs) * gs;
    },

    // Calculate Manhattan/orthogonal route from medallion edge to panel edge
    calculateRoute: function(medallionCenter, medallionRadius, panelRect, panelAngle) {
        const points = [];
        const gridSize = this.gridSize;
        const panelCenterX = panelRect.x + panelRect.width / 2;
        const panelCenterY = panelRect.y + panelRect.height / 2;
        const actualAngle = Math.atan2(panelCenterY - medallionCenter.y, panelCenterX - medallionCenter.x);
        const startX = medallionCenter.x + Math.cos(actualAngle) * medallionRadius;
        const startY = medallionCenter.y + Math.sin(actualAngle) * medallionRadius;
        const start = { x: startX, y: startY };
        const leadOutDistance = gridSize * 1.5;
        const leadOutX = medallionCenter.x + Math.cos(actualAngle) * (medallionRadius + leadOutDistance);
        const leadOutY = medallionCenter.y + Math.sin(actualAngle) * (medallionRadius + leadOutDistance);
        const leadOut = this.snapToGrid(leadOutX, leadOutY);
        const dx = panelCenterX - medallionCenter.x;
        const dy = panelCenterY - medallionCenter.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        let endX, endY;
        const horizontalBias = (absDx / panelRect.width) > (absDy / panelRect.height);

        if (horizontalBias) {
            if (dx > 0) {
                endX = panelRect.x;
                const t = (panelRect.x - medallionCenter.x) / dx;
                endY = medallionCenter.y + t * dy;
                endY = Math.max(panelRect.y + 10, Math.min(endY, panelRect.y + panelRect.height - 10));
            } else {
                endX = panelRect.x + panelRect.width;
                const t = (panelRect.x + panelRect.width - medallionCenter.x) / dx;
                endY = medallionCenter.y + t * dy;
                endY = Math.max(panelRect.y + 10, Math.min(endY, panelRect.y + panelRect.height - 10));
            }
        } else {
            if (dy > 0) {
                endY = panelRect.y;
                const t = (panelRect.y - medallionCenter.y) / dy;
                endX = medallionCenter.x + t * dx;
                endX = Math.max(panelRect.x + 10, Math.min(endX, panelRect.x + panelRect.width - 10));
            } else {
                endY = panelRect.y + panelRect.height;
                const t = (panelRect.y + panelRect.height - medallionCenter.y) / dy;
                endX = medallionCenter.x + t * dx;
                endX = Math.max(panelRect.x + 10, Math.min(endX, panelRect.x + panelRect.width - 10));
            }
        }

        const end = { x: endX, y: endY };
        const preEndX = horizontalBias ? (dx > 0 ? endX - gridSize * 2 : endX + gridSize * 2) : endX;
        const preEndY = horizontalBias ? endY : (dy > 0 ? endY - gridSize * 2 : endY + gridSize * 2);
        const preEnd = this.snapToGrid(preEndX, preEndY);

        points.push(start);
        points.push(leadOut);

        const isRightOfCenter = dx > 0;
        const isAboveCenter = dy < 0;

        if (horizontalBias) {
            const xSign = isRightOfCenter ? 1 : -1;
            const turn1X = this._snapVal(leadOut.x + xSign * gridSize * 2);
            const yForTurn2 = isAboveCenter ? Math.min(leadOut.y, preEnd.y) - gridSize : Math.max(leadOut.y, preEnd.y) + gridSize;
            const turn2Y = this._snapVal(yForTurn2);
            points.push({ x: turn1X, y: leadOut.y });
            points.push({ x: turn1X, y: turn2Y });
            points.push({ x: preEnd.x, y: turn2Y });
            points.push({ x: preEnd.x, y: end.y });
        } else {
            const ySign = isAboveCenter ? -1 : 1;
            const turn1Y = this._snapVal(leadOut.y + ySign * gridSize * 2);
            const xForTurn2 = isRightOfCenter ? Math.max(leadOut.x, preEnd.x) + gridSize : Math.min(leadOut.x, preEnd.x) - gridSize;
            const turn2X = this._snapVal(xForTurn2);
            points.push({ x: leadOut.x, y: turn1Y });
            points.push({ x: turn2X, y: turn1Y });
            points.push({ x: turn2X, y: preEnd.y });
            points.push({ x: end.x, y: preEnd.y });
        }

        points.push(end);
        return points;
    },

    createPathFromPoints: function(points) {
        if (points.length < 2) return '';
        const parts = ['M', points[0].x, points[0].y];
        for (let i = 1; i < points.length; i++) {
            parts.push('L', points[i].x, points[i].y);
        }
        return parts.join(' ');
    },

    calculatePathLength: function(points, segmentLengths) {
        let length = 0;
        let prevX = points[0].x, prevY = points[0].y;
        for (let i = 1, len = points.length; i < len; i++) {
            const px = points[i].x, py = points[i].y;
            const dx = px - prevX, dy = py - prevY;
            const segmentLength = Math.sqrt(dx * dx + dy * dy);
            if (segmentLengths) segmentLengths[i - 1] = segmentLength;
            length += segmentLength;
            prevX = px;
            prevY = py;
        }
        return length;
    },

    _tempPoint: { x: 0, y: 0 },

    getPointAtProgress: function(points, segmentLengths, progress, precomputedLength) {
        if (points.length < 2) {
            const p = points[0] || this._tempPoint;
            this._tempPoint.x = p.x;
            this._tempPoint.y = p.y;
            return this._tempPoint;
        }
        const totalLength = precomputedLength || this.calculatePathLength(points);
        const targetLength = progress * totalLength;
        let currentLength = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const segmentLength = segmentLengths[i - 1];
            if (currentLength + segmentLength >= targetLength) {
                const t = segmentLength > 0 ? (targetLength - currentLength) / segmentLength : 0;
                this._tempPoint.x = points[i - 1].x + dx * t;
                this._tempPoint.y = points[i - 1].y + dy * t;
                return this._tempPoint;
            }
            currentLength += segmentLength;
        }
        const last = points[points.length - 1];
        this._tempPoint.x = last.x;
        this._tempPoint.y = last.y;
        return this._tempPoint;
    },

    _tempRect: { x: 0, y: 0, width: 0, height: 0 },
    _frameSkip: 0,

    // Same cadence as before (every other call); routes are recomputed only
    // when a panel moved, and sent to the renderer.
    update: function() {
        if (!this.initialized || !radialPanelPhysics) return;

        this._frameSkip++;
        if (this._frameSkip & 1) return;

        const now = performance.now();
        const center = MedallionSystem.getCenter();
        const medallionRadius = this.cachedMedallionRadius;
        const tempRect = this._tempRect;
        let routes = null;

        for (let connectionIndex = 0; connectionIndex < this.connectionList.length; connectionIndex++) {
            const conn = this.connectionList[connectionIndex];
            const panelData = radialPanelPhysics.panels.get(conn.panelId);
            if (!panelData) continue;

            tempRect.x = panelData.position.x;
            tempRect.y = panelData.position.y;
            tempRect.width = panelData.width || 180;
            tempRect.height = panelData.height || 240;

            const posKey = tempRect.x | 0;
            const posKeyY = tempRect.y | 0;
            if (conn._lastPosX === posKey && conn._lastPosY === posKeyY && conn.pathPoints.length > 0) continue;
            conn._lastPosX = posKey;
            conn._lastPosY = posKeyY;
            if (conn._cachedAngle === undefined) {
                conn._cachedAngle = parseFloat(panelData.element.dataset.angle) || 0;
            }
            const points = this.calculateRoute(center, medallionRadius, tempRect, conn._cachedAngle);
            conn.pathPoints = points;
            if (!conn.glowElement) {
                conn.glowElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                conn.glowElement.setAttribute('class', 'circuit-trace-glow');
                this.tracesGroup.appendChild(conn.glowElement);
            }
            conn.glowElement.setAttribute('d', this.createPathFromPoints(points));
            if (!routes) routes = new Array(this.connectionList.length).fill(null);
            routes[connectionIndex] = points.map((p) => ({ x: p.x, y: p.y }));
        }

        if (routes) AmbientHost.post({ type: 'circuitRoutes', routes: routes, time: now });
        AmbientHost.circuitTick(now);
    },

    onResize: function() {
        if (!this.initialized) return;
        this.createGridBackground();
        AmbientHost.post({ type: 'circuitSize', size: this.canvasSize() });
        if (this.cachedMedallionEl) {
            this.cachedMedallionRadius = this.cachedMedallionEl.offsetWidth / 2;
        }
    },

    // The whole network (static SVG + canvas) fades as one group.
    fadeOut: function() {
        const el = document.getElementById('engineeringNetwork');
        if (el) {
            el.style.transition = 'opacity 0.5s ease-out';
            el.style.opacity = '0';
        }
        AmbientHost.post({ type: 'circuitVisible', visible: false, time: performance.now() });
    },

    fadeIn: function() {
        const el = document.getElementById('engineeringNetwork');
        if (el) {
            el.style.transition = 'opacity 0.5s ease-in';
            el.style.opacity = '1';
        }
        AmbientHost.post({ type: 'circuitVisible', visible: true, time: performance.now() });
    }
};

// Legacy alias for compatibility
const EngineeringNetwork = CircuitGridMatrix;

// ============================================
// TETHER SYSTEM (Now uses CircuitGridMatrix)
// ============================================

const TetherSystem = {
    initialized: false,
    
    init: function() {
        // Hide the old SVG tethers container - we're using CircuitGridMatrix instead
        const oldContainer = document.getElementById('tethersContainer');
        if (oldContainer) {
            oldContainer.style.display = 'none';
        }
        
        // Initialize the Circuit Grid Matrix
        CircuitGridMatrix.init();
        this.initialized = true;
    },
    
    update: function() {
        // Update the Circuit Grid Matrix
        CircuitGridMatrix.update();
    },
    
    fadeOut: function() {
        CircuitGridMatrix.fadeOut();
    },
    
    fadeIn: function() {
        CircuitGridMatrix.fadeIn();
    }
};

// ============================================
// RADIAL PANEL PHYSICS WITH COLLISION
// ============================================

class RadialPanelPhysics {
    constructor() {
        this.panels = new Map();
        this.draggedPanel = null;
        this.initialized = false;
        this.frameCounter = 0;
        this.updateFrequency = 2;
        
        this.dragState = {
            offsetX: 0, offsetY: 0, velocityTracking: [],
            mouseDownTime: 0, mouseDownX: 0, mouseDownY: 0, hasMoved: false
        };
        
        this.springConstants = {
            stiffness: PHI_INV * 0.08,
            damping: PHI_INV * 0.9,
            minVelocity: 0.01
        };
        
        this.collisionSettings = {
            enabled: true,
            repulsionStrength: 0.5,
            iterations: 3,
            minDistance: 20
        };
        
        this.setupDocumentHandlers();
        
        // Use requestAnimationFrame for better timing to ensure DOM is ready
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.initializePanels());
        });
    }
    
    // Calculate separate horizontal and vertical distances for elliptical 2x2 grid layout
    calculateDistances() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Get panel dimensions (use CSS values as fallback)
        const panelWidth = Math.max(vw * 0.15, 180);
        const panelHeight = Math.max(vh * 0.30, 240);
        
        // Calculate available space from center to edge (minus panel size and padding)
        const padding = 20;
        const availableX = (vw / 2) - (panelWidth / 2) - padding;
        const availableY = (vh / 2) - (panelHeight / 2) - padding;
        
        // Reserve space for medallion and title
        const medallionClearanceY = vh * 0.14;
        
        // Calculate distances - increased multipliers for more spacing
        // Horizontal distance - use more of the available horizontal space
        const distanceX = Math.min(availableX * 1.0, vw * 0.42);
        // Vertical distance - increased for more vertical separation
        const distanceY = Math.min(availableY * 0.95, vh * 0.38);
        
        return {
            x: Math.max(distanceX, panelWidth * 0.85),
            y: Math.max(distanceY, medallionClearanceY + panelHeight * 0.45)
        };
    }
    
    setupDocumentHandlers() {
        // Flag to batch tether updates into the next rAF instead of per-mousemove
        let _dragTetherDirty = false;
        
        document.addEventListener('mousemove', (e) => {
            if (!this.draggedPanel) return;
            const panelData = this.panels.get(this.draggedPanel);
            if (!panelData || !panelData.isDragging) return;
            
            const dx = e.clientX - this.dragState.mouseDownX;
            const dy = e.clientY - this.dragState.mouseDownY;
            if (dx * dx + dy * dy > 25) this.dragState.hasMoved = true; // avoid sqrt
            
            const newX = e.clientX - this.dragState.offsetX;
            const newY = e.clientY - this.dragState.offsetY;
            
            this.dragState.velocityTracking.push({ x: newX - panelData.position.x, y: newY - panelData.position.y });
            if (this.dragState.velocityTracking.length > 5) this.dragState.velocityTracking.shift();
            
            panelData.position.x = newX;
            panelData.position.y = newY;
            panelData.element.style.transform = 'translate3d(' + newX + 'px, ' + newY + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
            
            // Batch tether update to rAF (avoids multiple SVG reflows per frame during drag)
            if (!_dragTetherDirty) {
                _dragTetherDirty = true;
                requestAnimationFrame(() => {
                    _dragTetherDirty = false;
                    TetherSystem.update();
                });
            }
        }, { passive: true });
        
        document.addEventListener('mouseup', (e) => {
            if (!this.draggedPanel) return;
            const panelId = this.draggedPanel;
            const panelData = this.panels.get(panelId);
            if (!panelData) return;
            
            panelData.element.classList.remove('dragging');
            panelData.isDragging = false;
            
            const clickDuration = Date.now() - this.dragState.mouseDownTime;
            const isClick = !this.dragState.hasMoved && clickDuration < 200;
            
            if (isClick) {
                const contentType = panelData.element.dataset.contentType;
                if (contentType && !isExpanded && !isCollapsing) {
                    expandPanel(panelId, contentType);
                }
            } else if (this.dragState.hasMoved) {
                // Panel was dragged - update anchor position to current position
                // so it stays where the user placed it
                panelData.anchorX = panelData.position.x;
                panelData.anchorY = panelData.position.y;
                panelData.hasBeenMoved = true;
                
                // Apply throw velocity for natural feel
                if (this.dragState.velocityTracking.length > 0) {
                    const avgVel = this.dragState.velocityTracking.reduce((acc, vel) => ({ x: acc.x + vel.x, y: acc.y + vel.y }), { x: 0, y: 0 });
                    panelData.velocity.x = (avgVel.x / this.dragState.velocityTracking.length) * PHI_INV * 0.3;
                    panelData.velocity.y = (avgVel.y / this.dragState.velocityTracking.length) * PHI_INV * 0.3;
                    panelData.angularVelocity = panelData.velocity.x * (1 / PHI) * 0.05;
                }
            }
            
            this.draggedPanel = null;
            this.dragState.velocityTracking = [];
            wakeScene();
        }, { passive: true });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isExpanded) collapsePanel();
        });
    }
    
    initializePanels() {
        if (this.initialized) return;
        this.initialized = true;
        
        MedallionSystem.init();
        if (!RuntimeVisibility.mobilePortrait) EngineeringNetwork.init();
        
        const center = MedallionSystem.getCenter();
        const distances = this.calculateDistances();
        
        document.querySelectorAll('.nav-panel').forEach((panel) => {
            const angle = parseFloat(panel.dataset.angle) || 0;
            const angleRad = (angle * Math.PI) / 180;
            
            // Use separate distances for X and Y (elliptical distribution)
            const panelWidth = panel.offsetWidth || Math.max(window.innerWidth * 0.15, 180);
            const panelHeight = panel.offsetHeight || Math.max(window.innerHeight * 0.30, 240);
            
            let x = center.x + Math.cos(angleRad) * distances.x - panelWidth / 2;
            let y = center.y + Math.sin(angleRad) * distances.y - panelHeight / 2;
            
            // Boundary checking to ensure panels stay within viewport
            const padding = 10;
            x = Math.max(padding, Math.min(x, window.innerWidth - panelWidth - padding));
            y = Math.max(padding, Math.min(y, window.innerHeight - panelHeight - padding));
            
            const panelData = {
                element: panel,
                position: { x: x, y: y },
                velocity: { x: 0, y: 0 },
                anchorAngle: angle,
                anchorDistanceX: distances.x,
                anchorDistanceY: distances.y,
                anchorX: x,  // Explicit anchor position - can be updated when dragged
                anchorY: y,  // Explicit anchor position - can be updated when dragged
                hasBeenMoved: false,  // Track if user has manually repositioned this panel
                angle: 0,
                angularVelocity: 0,
                isDragging: false,
                isMoving: false,
                physicsDisabled: false,
                mass: PHI,
                width: panelWidth,
                height: panelHeight
            };
            
            this.panels.set(panel.id, panelData);
            
            panel.style.left = '0px';
            panel.style.top = '0px';
            panel.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
            panel.style.willChange = 'transform';
            
            panel.setAttribute('tabindex', '0');
            panel.setAttribute('role', 'button');
            panel.setAttribute('aria-expanded', 'false');
            const title = panel.querySelector('.panel-title');
            panel.setAttribute('aria-label', (title ? title.textContent : 'Navigation') + ' panel');
            
            this.addPanelListeners(panel);
        });
                      if (!RuntimeVisibility.mobilePortrait) {
            TetherSystem.init();
            TetherSystem.update();
        }

        this.revealPositionedElements();
        EELRouteManager.init();
    }
    
    revealPositionedElements() {
        document.querySelectorAll('.js-positioned').forEach(el => el.classList.add('ready'));
               console.log('%cElements positioned and revealed', 'color: #7ec8e3; font-weight: bold;');
    }
    
       addPanelListeners(panel) {
        const preview = () => {
            if (panel.dataset.contentType) PagePrerender.preview(panel.dataset.contentType);
        };
        panel.addEventListener('pointerenter', preview, { passive: true });
        panel.addEventListener('touchstart', preview, { passive: true });
        panel.addEventListener('focus', preview);

        panel.addEventListener('mousedown', (e) => {
            const panelData = this.panels.get(panel.id);
            if (!panelData) return;
            
            this.dragState.mouseDownTime = Date.now();
            this.dragState.mouseDownX = e.clientX;
            this.dragState.mouseDownY = e.clientY;
            this.dragState.hasMoved = false;
            
            this.draggedPanel = panel.id;
            panelData.isDragging = true;
            panelData.isMoving = true;
            panel.classList.add('dragging');
            wakeScene();
            
            const rect = panel.getBoundingClientRect();
            this.dragState.offsetX = e.clientX - rect.left;
            this.dragState.offsetY = e.clientY - rect.top;
            this.dragState.velocityTracking = [];
            
            panelData.velocity.x = 0;
            panelData.velocity.y = 0;
            panelData.angularVelocity = 0;
            e.preventDefault();
        });
        
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const contentType = panel.dataset.contentType;
                if (contentType && !isExpanded && !isCollapsing) {
                    expandPanel(panel.id, contentType);
                }
            }
        });
    }
    
    isActive() {
        if (!this.initialized) return true;
        if (this.draggedPanel) return true;
        for (const panelData of this.panels.values()) {
            if (panelData.isDragging || (panelData.isMoving && !panelData.physicsDisabled)) return true;
        }
        return false;
    }

    detectAndResolveCollisions() {
        if (!this.collisionSettings.enabled) return;
        
        // Rebuild cached array only when panel count changes (rare)
        if (!this._panelArray || this._panelArray.length !== this.panels.size) {
            this._panelArray = Array.from(this.panels.values());
        }
        const panelArray = this._panelArray;

        // Skip if no panels are moving
        let anyMoving = false;
        for (let i = 0; i < panelArray.length; i++) {
            if (panelArray[i].isMoving && !panelArray[i].isDragging && !panelArray[i].physicsDisabled) {
                anyMoving = true;
                break;
            }
        }
        if (!anyMoving) return;

        for (let iteration = 0; iteration < this.collisionSettings.iterations; iteration++) {
            for (let i = 0; i < panelArray.length; i++) {
                for (let j = i + 1; j < panelArray.length; j++) {
                    const panelA = panelArray[i];
                    const panelB = panelArray[j];
                    
                    if (panelA.isDragging || panelB.isDragging || panelA.physicsDisabled || panelB.physicsDisabled) continue;
                    
                    const ax = panelA.position.x, ay = panelA.position.y;
                    const aw = panelA.width;
                    const ah = panelA.height;
                    const bx = panelB.position.x, by = panelB.position.y;
                    const bw = panelB.width;
                    const bh = panelB.height;
                    const buffer = this.collisionSettings.minDistance;
                    
                    const overlapX = Math.min(ax + aw + buffer, bx + bw + buffer) - Math.max(ax - buffer, bx - buffer);
                    const overlapY = Math.min(ay + ah + buffer, by + bh + buffer) - Math.max(ay - buffer, by - buffer);
                    
                    if (overlapX > 0 && overlapY > 0) {
                        const dx = (bx + bw / 2) - (ax + aw / 2);
                        const dy = (by + bh / 2) - (ay + ah / 2);
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const nx = dx / dist, ny = dy / dist;
                        const repulsion = Math.min(overlapX, overlapY) * this.collisionSettings.repulsionStrength;
                        
                        if (!panelA.isDragging && panelA.isMoving) {
                            panelA.velocity.x -= nx * repulsion / panelA.mass;
                            panelA.velocity.y -= ny * repulsion / panelA.mass;
                        }
                        if (!panelB.isDragging && panelB.isMoving) {
                            panelB.velocity.x += nx * repulsion / panelB.mass;
                            panelB.velocity.y += ny * repulsion / panelB.mass;
                        }
                    }
                }
            }
        }
    }
    
    update(deltaTime) {
        if (!this.initialized) return;
        this.frameCounter++;
        if (this.frameCounter % this.updateFrequency !== 0) return;
        
        deltaTime = Math.min(deltaTime * this.updateFrequency, 1 / 30);

        if (!this._panelArray || this._panelArray.length !== this.panels.size) {
            this._panelArray = Array.from(this.panels.values());
        }
        const panelArray = this._panelArray;
        let needsPhysics = false;
        for (let i = 0; i < panelArray.length; i++) {
            const panelData = panelArray[i];
            if (!panelData.physicsDisabled && (panelData.isDragging || panelData.isMoving)) {
                needsPhysics = true;
                break;
            }
        }

        if (needsPhysics) this.detectAndResolveCollisions();

        for (let i = 0; needsPhysics && i < panelArray.length; i++) {
            const panelData = panelArray[i];
            if (panelData.isDragging || panelData.physicsDisabled || !panelData.isMoving) continue;
            
            // Use stored anchor positions (these are updated when user drags panels)
            let anchorX = panelData.anchorX;
            let anchorY = panelData.anchorY;
            
            // Boundary checking for anchor positions
            const padding = 10;
            const panelWidth = panelData.width;
            const panelHeight = panelData.height;
            anchorX = Math.max(padding, Math.min(anchorX, window.innerWidth - panelWidth - padding));
            anchorY = Math.max(padding, Math.min(anchorY, window.innerHeight - panelHeight - padding));
            
            const dx = anchorX - panelData.position.x;
            const dy = anchorY - panelData.position.y;
            
            if (dx * dx + dy * dy > 25) {
                panelData.velocity.x += dx * this.springConstants.stiffness / panelData.mass;
                panelData.velocity.y += dy * this.springConstants.stiffness / panelData.mass;
            }
            
            panelData.velocity.x *= this.springConstants.damping;
            panelData.velocity.y *= this.springConstants.damping;
            
            if (Math.abs(panelData.velocity.x) < this.springConstants.minVelocity && 
                Math.abs(panelData.velocity.y) < this.springConstants.minVelocity) {
                panelData.velocity.x = 0;
                panelData.velocity.y = 0;
                panelData.isMoving = false;
                panelData.angularVelocity = 0;
                panelData.angle = 0;
                continue;
            }
            
            panelData.position.x += panelData.velocity.x;
            panelData.position.y += panelData.velocity.y;
            panelData.angularVelocity *= PHI_INV;
            panelData.angle += panelData.angularVelocity;
            panelData.angle *= (1 + PHI_INV) / 2;
            
            panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
        }
        
        TetherSystem.update();
    }
    
    updateBounds() {
        wakeScene();
        const center = MedallionSystem.getCenter();
        const distances = this.calculateDistances();
        const padding = 10;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Phase 1: Read all layout properties (no DOM writes — avoids layout thrashing)
        this.panels.forEach((panelData) => {
            panelData.anchorDistanceX = distances.x;
            panelData.anchorDistanceY = distances.y;
            panelData.width = panelData.element.offsetWidth;
            panelData.height = panelData.element.offsetHeight;
        });
        
        // Phase 2: Calculate positions and write transforms (all writes batched)
        this.panels.forEach((panelData) => {
            if (panelData.hasBeenMoved) {
                panelData.anchorX = Math.max(padding, Math.min(panelData.anchorX, vw - panelData.width - padding));
                panelData.anchorY = Math.max(padding, Math.min(panelData.anchorY, vh - panelData.height - padding));
                
                if (!panelData.isDragging) {
                    panelData.position.x = panelData.anchorX;
                    panelData.position.y = panelData.anchorY;
                    panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
                }
            } else {
                const angleRad = (panelData.anchorAngle * Math.PI) / 180;
                let anchorX = center.x + Math.cos(angleRad) * distances.x - panelData.width / 2;
                let anchorY = center.y + Math.sin(angleRad) * distances.y - panelData.height / 2;
                
                anchorX = Math.max(padding, Math.min(anchorX, vw - panelData.width - padding));
                anchorY = Math.max(padding, Math.min(anchorY, vh - panelData.height - padding));
                
                panelData.anchorX = anchorX;
                panelData.anchorY = anchorY;
                
                if (!panelData.isDragging) {
                    panelData.position.x = anchorX;
                    panelData.position.y = anchorY;
                    panelData.element.style.transform = 'translate3d(' + panelData.position.x + 'px, ' + panelData.position.y + 'px, 0) rotateZ(' + panelData.angle + 'deg)';
                }
            }
        });
        TetherSystem.update();
    }
}

let radialPanelPhysics;

// ============================================
// SCENE RUNTIME
// ============================================
// The drone, nebula, medallion glow and gear icons are drawn by the ambient
// engine (ambient.js), in a worker when the browser allows it. The main
// thread keeps only what reacts to the user: panel physics and the circuit
// network that follows the panels.

let renderer = null; // set once the drone renderer is running (compat flag)
let _visualRuntimeStarted = false;
let _sceneLoopRunning = false;
let _sceneLastTime = 0;
let _sceneIdleFrames = 0;
let _sceneRaf = 0;

function startVisualRuntime() {
    AmbientHost.setMobilePortrait(RuntimeVisibility.mobilePortrait);

    if (!RuntimeVisibility.mobilePortrait) {
        if (!_visualRuntimeStarted) {
            _visualRuntimeStarted = true;
            document.addEventListener('mousemove', onMouseMove, { passive: true });
            window.addEventListener('resize', onWindowResize, { passive: true });
        }
        AmbientHost.startDrone();
    }

    startSceneLoop();
}

function startSceneLoop() {
    if (_sceneLoopRunning) return;
    // Under the deterministic test clock the loop starts when the drone is
    // ready, exactly where the old animateThreeJS() loop used to start.
    if (AmbientHost.waitForDroneBeforeLoop()) return;
    _sceneLoopRunning = true;
    if (!_sceneRaf) {
        _sceneLastTime = performance.now();
        _sceneRaf = requestAnimationFrame(animateScene);
    }
}

function animateScene() {
    _sceneRaf = 0;
    if (!_sceneLoopRunning) return;
    _sceneRaf = requestAnimationFrame(animateScene);

    const now = performance.now();
    const deltaTime = (now - _sceneLastTime) / 1000;
    _sceneLastTime = now;

    if (!document.hidden && !RuntimeVisibility.mobilePortrait && !_bgSystemsPaused && radialPanelPhysics) {
        radialPanelPhysics.update(deltaTime);
    }

    AmbientHost.mainFrame(now);

    // With the renderer in a worker, this loop only has panel physics left;
    // let it sleep while nothing moves (RadialPanelPhysics wakes it).
    if (AmbientHost.mode === 'worker' && !AmbientHost.droneEngine && !radialPanelPhysics.isActive()) {
        _sceneIdleFrames++;
        if (_sceneIdleFrames > 8) _sceneLoopRunning = false;
    } else {
        _sceneIdleFrames = 0;
    }
}

function wakeScene() {
    _sceneIdleFrames = 0;
    if (_visualRuntimeStarted || RuntimeVisibility.mobilePortrait) startSceneLoop();
}

let cachedCursorEl = null;
let _cursorRafPending = false;
let _cursorX = 0, _cursorY = 0;

function onMouseMove(event) {
    _cursorX = event.clientX;
    _cursorY = event.clientY;

    // Batch cursor DOM write to next animation frame to avoid multiple writes per frame
    if (!_cursorRafPending) {
        _cursorRafPending = true;
        requestAnimationFrame(_updateCursorPosition);
    }
}

function _updateCursorPosition() {
    _cursorRafPending = false;
    if (!cachedCursorEl) cachedCursorEl = document.getElementById('chromeCursor');
    if (cachedCursorEl) {
        cachedCursorEl.style.transform = 'translate(' + _cursorX + 'px, ' + _cursorY + 'px)';
    }
}

let resizeTimeout;
function onWindowResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        MedallionSystem.updatePosition();
        if (radialPanelPhysics) radialPanelPhysics.updateBounds();
        if (CircuitGridMatrix.initialized) CircuitGridMatrix.onResize();
    }, 100);
}

function fadeDrone(targetOpacity) {
    AmbientHost.post({ type: 'droneFade', target: targetOpacity });
}

// ============================================
// PANEL EXPANSION SYSTEM
// ============================================

let currentExpandedPanel = null;
let isExpanded = false;
let isCollapsing = false;
let previousFocus = null;

// ============================================
// DIRECT URL + PAGE METADATA ROUTING
// ============================================

const EELRouteManager = {
    initialized: false,

    pages: {
        home: {
            title: 'EEL - Experimental Engineering Lab',
            description: 'The Experimental Engineering Lab at UNC-Chapel Hill connects undergraduate research, applied engineering, fabrication, immersive technology, and cross-campus collaboration.'
        },

        projects: {
            panelId: 'panel-projects',
            contentType: 'projects',
            route: 'research-teaching',
            title: 'Research & Teaching | EEL',
            description: 'Explore current EEL research projects, developing ideas, courses, and past work at UNC-Chapel Hill.'
        },

        people: {
            panelId: 'panel-people',
            contentType: 'people',
            route: 'members-collaborators',
            title: 'Members & Collaborators | EEL',
          description: 'Meet the EEL undergraduate research engineers, alumni, academic partners, and collaborators at UNC-Chapel Hill.'
        },

        about: {
            panelId: 'panel-about',
            contentType: 'about',
            route: 'eel-at-a-glance',
            title: 'EEL at a Glance | Experimental Engineering Lab',
            description: 'See the Experimental Engineering Lab’s impact, capabilities, history, and campus-wide research-engineering role at UNC-Chapel Hill.'
        },

               join: {
            panelId: 'panel-join',
            contentType: 'join',
            route: 'join-our-lab',
                        title: 'Get Involved | EEL',
           description: 'Join the EEL, collaborate on a research or engineering project, or support undergraduate research and lab development.'
        },

        currentProjects: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Current Projects | EEL',
            description: 'Explore current undergraduate research and engineering projects in the Experimental Engineering Lab at UNC-Chapel Hill.'
        },

        developingProjects: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Projects in Development | EEL',
            description: 'Explore research and engineering projects currently being developed in the Experimental Engineering Lab at UNC-Chapel Hill.'
        },

        courses: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Courses & Academic Opportunities | EEL',
            description: 'Explore EEL courses and academic opportunities connecting hands-on engineering, undergraduate research, and research leadership at UNC-Chapel Hill.'
        },

        pastWork: {
            panelId: 'panel-projects',
            contentType: 'projects',
            title: 'Selected Past Work | EEL',
            description: 'Explore selected past research, engineering, and teaching projects from the Experimental Engineering Lab at UNC-Chapel Hill.'
        }
    },

    hashToPage: {
        'research-teaching': 'projects',
        'projects': 'projects',

        'current-projects': 'currentProjects',
        'projects-in-development': 'developingProjects',
        'courses': 'courses',
        'past-work': 'pastWork',

        'members-collaborators': 'people',
        'people': 'people',

        'eel-at-a-glance': 'about',
        'about': 'about',

        'join-our-lab': 'join',
        'join': 'join'
    },

    panelToHash: {
        'panel-projects': 'research-teaching',
        'panel-people': 'members-collaborators',
        'panel-about': 'eel-at-a-glance',
        'panel-join': 'join-our-lab'
    },

             init: function() {
        if (this.initialized) return;

        this.initialized = true;

        // Research & Teaching jump links navigate only inside the already-open
        // Projects panel. They should not go through the full panel router.
        document.addEventListener('click', (event) => {
            var link = event.target.closest('.research-jump-nav a[href^="#"]');

            if (!link) return;

            var hash = link.getAttribute('href').replace(/^#/, '').toLowerCase();
            var pageKey = this.getPageKeyForHash(hash);

            if (!pageKey) return;

            event.preventDefault();

            if (this.getHash() !== hash) {
                history.pushState(
                    { eelSection: hash },
                    '',
                    '#' + hash
                );
            }

            this.updateMetadata(pageKey);
            this.scrollToCurrentHash(hash);
        });

        // Handle browser Back/Forward navigation.
        window.addEventListener('popstate', () => this.handleLocation());

        this.handleLocation();
    },
       getHash: function() {
        var rawHash = window.location.hash.replace(/^#/, '');

        try {
            return decodeURIComponent(rawHash).toLowerCase();
        } catch (error) {
            return rawHash.toLowerCase();
        }
    },

    getPageKeyForHash: function(hash) {
        return this.hashToPage[hash] || null;
    },

    setMetaContent: function(selector, value) {
        var element = document.querySelector(selector);

        if (element) {
            element.setAttribute('content', value);
        }
    },

    updateMetadata: function(pageKey) {
        var page = this.pages[pageKey] || this.pages.home;

        document.title = page.title;

        this.setMetaContent(
            'meta[name="description"]',
            page.description
        );

        this.setMetaContent(
            'meta[property="og:title"]',
            page.title
        );

        this.setMetaContent(
            'meta[property="og:description"]',
            page.description
        );

        this.setMetaContent(
            'meta[property="og:url"]',
            window.location.href
        );

        this.setMetaContent(
            'meta[name="twitter:title"]',
            page.title
        );

        this.setMetaContent(
            'meta[name="twitter:description"]',
            page.description
        );
    },

    updateMetadataForCurrentHash: function() {
        var hash = this.getHash();
        var pageKey = this.getPageKeyForHash(hash);

        this.updateMetadata(pageKey || 'home');
    },

    setPanelRoute: function(panelId) {
        var hash = this.panelToHash[panelId];

        if (!hash) return;

        if (this.getHash() !== hash) {
            history.pushState(
                { eelPanel: panelId },
                '',
                '#' + hash
            );
        }

        this.updateMetadata(
            this.getPageKeyForHash(hash)
        );
    },

    clearRoute: function() {
        history.replaceState(
            { eelPanel: null },
            '',
            window.location.pathname + window.location.search
        );

        this.updateMetadata('home');
    },

           scrollToCurrentHash: function(hash) {
        hash = hash || this.getHash();

        requestAnimationFrame(function() {
            _getExpandedEls();

            if (!_cachedExpandedContent) return;

            // Main Research & Teaching route returns to the top.
            if (!hash || hash === 'research-teaching' || hash === 'projects') {
                _cachedExpandedContent.scrollTop = 0;
                return;
            }

            var target = document.getElementById(hash);

            if (!target || !_cachedExpandedContent.contains(target)) return;

            // Calculate the target position inside #expandedContent without
            // scrollIntoView(), which can also move outer ancestors/viewport.
            var targetTop = 0;
            var node = target;

            while (node && node !== _cachedExpandedContent) {
                targetTop += node.offsetTop || 0;
                node = node.offsetParent;
            }

            // Fallback if the offsetParent chain does not reach the scroll box.
            if (node !== _cachedExpandedContent) {
                var contentRect = _cachedExpandedContent.getBoundingClientRect();
                var targetRect = target.getBoundingClientRect();

                targetTop =
                    _cachedExpandedContent.scrollTop +
                    targetRect.top -
                    contentRect.top;
            }

            var jumpNav =
                _cachedExpandedContent.querySelector('.research-jump-nav');

            var stickyOffset =
                jumpNav ? jumpNav.offsetHeight + 16 : 16;

            _cachedExpandedContent.scrollTo({
                top: Math.max(0, targetTop - stickyOffset),
                behavior: 'auto'
            });
        });
    },


    handleLocation: function() {
        var hash = this.getHash();
        var pageKey = this.getPageKeyForHash(hash);

        if (!pageKey) {
            this.updateMetadata('home');

            if (isExpanded && !isCollapsing) {
                collapsePanel(true);
            }

            return;
        }

        var page = this.pages[pageKey];

        this.updateMetadata(pageKey);

        if (isCollapsing) {
            setTimeout(
                () => this.handleLocation(),
                950
            );

            return;
        }

        if (!isExpanded) {
            expandPanel(
                page.panelId,
                page.contentType,
                { fromRoute: true }
            );

            this.scrollToCurrentHash();

            return;
        }

        if (currentExpandedPanel === page.panelId) {
            this.scrollToCurrentHash();
            return;
        }

        collapsePanel(true);

        setTimeout(
            () => this.handleLocation(),
            950
        );
    }
};

// Content cache — generate HTML once, reuse on subsequent opens
const _contentCache = {};
const EELStats = {
    studentCount: 0,
    projectCount: 0,
    courseCount: 0,
    collaboratorCount: 0,
    majorCounts: []
};

// Use the same records that populate the content panels.
function updateCardStats() {
    if (!_contentCache.projects) {
        _contentCache.projects = getProjectsContent();
    }

    if (!_contentCache.people) {
        _contentCache.people = getPeopleContent();
    }

    const counts = {
        projects: EELStats.projectCount,
        courses: EELStats.courseCount,
        students: EELStats.studentCount,
        majors: EELStats.majorCounts.length
    };

    document.querySelectorAll('[data-eel-count]').forEach(function(element) {
        const key = element.getAttribute('data-eel-count');

        if (Object.prototype.hasOwnProperty.call(counts, key)) {
            element.textContent = String(counts[key]);
        }
    });
}
// Cached nav panel NodeList (set once after DOM ready)
let _cachedNavPanels = null;
function getCachedNavPanels() {
    if (!_cachedNavPanels) _cachedNavPanels = document.querySelectorAll('.nav-panel');
    return _cachedNavPanels;
}

// Cache expanded panel DOM elements
let _cachedExpandedOverlay = null;
let _cachedExpandedContainer = null;
let _cachedExpandedContent = null;
let _cachedGlassContainer = null;
let _cachedCloseBtn = null;

function _getExpandedEls() {
    if (!_cachedExpandedOverlay) {
        _cachedExpandedOverlay = document.getElementById('expandedOverlay');
        _cachedExpandedContainer = document.getElementById('expandedContainer');
        _cachedExpandedContent = document.getElementById('expandedContent');
        _cachedGlassContainer = _cachedExpandedContainer.querySelector('.expanded-glass-container');
        _cachedCloseBtn = document.getElementById('closeBtn');
    }
}

// Pause/resume background animation systems during panel expansion
// to free up CPU/GPU for the morph transition
let _bgSystemsPaused = false;
let _cachedBgAnimEls = null;

function _getBgAnimEls() {
    if (!_cachedBgAnimEls) {
        _cachedBgAnimEls = document.querySelectorAll('.chrome-title, .subtitle, .tagline, .central-medallion, .blob-primary, .blob-secondary, .blob-tertiary, .blob-accent-1, .blob-accent-2, .chrome-grid');
    }
    return _cachedBgAnimEls;
}

function _pauseBackgroundSystems() {
    _bgSystemsPaused = true;
    AmbientHost.setBgPaused(true);
    var bgEls = _getBgAnimEls();
    for (var i = 0; i < bgEls.length; i++) bgEls[i].style.animationPlayState = 'paused';
}

function _resumeBackgroundSystems() {
    _bgSystemsPaused = false;
    AmbientHost.setBgPaused(false);
    wakeScene();
    var bgEls = _getBgAnimEls();
    for (var i = 0; i < bgEls.length; i++) bgEls[i].style.animationPlayState = '';
}

// Compute the final expanded rectangle inside the currently visible viewport.
function _getExpandedTargetRect() {
    var viewport = window.visualViewport;

    var vw = viewport ? viewport.width : window.innerWidth;
    var vh = viewport ? viewport.height : window.innerHeight;

    // A zoomed visual viewport can be offset inside the layout viewport.
    // Fixed-position coordinates must include these offsets.
    var viewportLeft = viewport ? viewport.offsetLeft : 0;
    var viewportTop = viewport ? viewport.offsetTop : 0;

    var isMobile =
        document.body.classList.contains('mobile-portrait') ||
        vw <= 768;

    if (isMobile) {
        return {
            left: viewportLeft + 8,
            top: viewportTop + 8,
            width: Math.max(0, vw - 16),
            height: Math.max(0, vh - 16)
        };
    }

    return {
        left: viewportLeft + (vw * 0.055),
        top: viewportTop + (vh * 0.055),
        width: vw * 0.89,
        height: vh * 0.89
    };
}

// Recenter and resize an already-open panel whenever browser zoom,
// viewport size, or the visible viewport position changes.
var _expandedViewportRaf = 0;

function _syncExpandedPanelToViewport() {
    if (
        !isExpanded ||
        isCollapsing ||
        !_cachedExpandedContainer ||
        !_cachedExpandedContainer.classList.contains('expanded')
    ) {
        return;
    }

    if (_expandedViewportRaf) {
        cancelAnimationFrame(_expandedViewportRaf);
    }

    _expandedViewportRaf = requestAnimationFrame(function() {
        _expandedViewportRaf = 0;

        if (
            !isExpanded ||
            isCollapsing ||
            !_cachedExpandedContainer
        ) {
            return;
        }

        var target = _getExpandedTargetRect();

        _cachedExpandedContainer.style.left = target.left + 'px';
        _cachedExpandedContainer.style.top = target.top + 'px';
        _cachedExpandedContainer.style.width = target.width + 'px';
        _cachedExpandedContainer.style.height = target.height + 'px';
        _cachedExpandedContainer.style.transform =
            'translate3d(0, 0, 0) scale(1, 1)';
    });
}

window.addEventListener(
    'resize',
    _syncExpandedPanelToViewport,
    { passive: true }
);

if (window.visualViewport) {
    window.visualViewport.addEventListener(
        'resize',
        _syncExpandedPanelToViewport,
        { passive: true }
    );

    window.visualViewport.addEventListener(
        'scroll',
        _syncExpandedPanelToViewport,
        { passive: true }
    );
}

function expandPanel(panelId, contentType, routeOptions) {
    if (isExpanded || isCollapsing) return;

    routeOptions = routeOptions || {};

    isExpanded = true;
    currentExpandedPanel = panelId;
    previousFocus = document.activeElement;

    if (!routeOptions.fromRoute) {
        EELRouteManager.setPanelRoute(panelId);
    } else {
        EELRouteManager.updateMetadataForCurrentHash();
    }

    _getExpandedEls();
    var panel = document.getElementById(panelId);
    var expandedOverlay = _cachedExpandedOverlay;
    var expandedContainer = _cachedExpandedContainer;
    var expandedContent = _cachedExpandedContent;
    var glassContainer = _cachedGlassContainer;

    var panelRect = panel.getBoundingClientRect();
    var panelData = radialPanelPhysics.panels.get(panelId);
    if (panelData) panelData.physicsDisabled = true;

    // FLIP technique: compute target rect, then use transform to animate
    var target = _getExpandedTargetRect();

    expandedContainer.removeAttribute('aria-hidden');

    // Set the container to the target final size/position (no transition yet)
    expandedContainer.style.left = target.left + 'px';
    expandedContainer.style.top = target.top + 'px';
    expandedContainer.style.width = target.width + 'px';
    expandedContainer.style.height = target.height + 'px';
    expandedContainer.style.opacity = '1';

        var isMobileExpand =
        document.body.classList.contains('mobile-portrait') ||
        window.innerWidth <= 768;

    if (isMobileExpand) {
        // On mobile, open directly at the final expanded size.
        // Avoid displaying page content inside the small navigation-card
        // dimensions during the desktop FLIP animation.
        expandedContainer.style.transform =
            'translate3d(0, 0, 0) scale(1, 1)';
    } else {
        // Desktop FLIP animation: transform from the final target
        // back to the originating navigation panel.
        var scaleX = panelRect.width / target.width;
        var scaleY = panelRect.height / target.height;
        var translateX = panelRect.left - target.left;
        var translateY = panelRect.top - target.top;

        expandedContainer.style.transform =
            'translate3d(' + translateX + 'px, ' +
            translateY + 'px, 0) scale(' +
            scaleX + ', ' + scaleY + ')';
    }

     // Load the selected panel content.
    loadContent(contentType, expandedContent);

    // Every newly opened main panel must begin at its first line.
    expandedContent.scrollTop = 0;

    // Reset it again after the newly inserted content has been laid out.
    // Section routes may deliberately reposition it afterward.
    requestAnimationFrame(function() {
        expandedContent.scrollTop = 0;
    });
    TetherSystem.fadeOut();
    fadeDrone(0);

    expandedOverlay.style.pointerEvents = '';
    expandedOverlay.classList.add('active');
    expandedContainer.style.pointerEvents = '';

    // Pause background CSS animations to free CPU/GPU during morph
    _pauseBackgroundSystems();

    // Commit the inverted position so the browser has a "from" state
    expandedContainer.offsetHeight;

    // Enable transform transition
    expandedContainer.classList.add('morphing');

    requestAnimationFrame(function() {
        // Animate to identity transform (the final expanded position)
        expandedContainer.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';
        expandedContainer.classList.add('expanded');

        // Fade out background elements simultaneously with the morph
        fadeOutElements();
        panel.classList.add('hidden');
        panel.setAttribute('aria-expanded', 'true');
    });

    // Use transitionend for reliable timing instead of setTimeout
    var _expandCleanedUp = false;
    function _onExpandEnd(e) {
        if (_expandCleanedUp || e.target !== expandedContainer) return;
        _expandCleanedUp = true;
        expandedContainer.removeEventListener('transitionend', _onExpandEnd);
        if (_cachedCloseBtn) _cachedCloseBtn.focus();
        glassContainer.classList.add('blur-active');
    }
    expandedContainer.addEventListener('transitionend', _onExpandEnd);
    // Fallback timeout in case transitionend doesn't fire (e.g. tab hidden)
    setTimeout(function() {
        if (!_expandCleanedUp) {
            _expandCleanedUp = true;
            expandedContainer.removeEventListener('transitionend', _onExpandEnd);
            if (_cachedCloseBtn) _cachedCloseBtn.focus();
            glassContainer.classList.add('blur-active');
        }
    }, 900);

    getCachedNavPanels().forEach(function(p) { p.style.pointerEvents = 'none'; });
}

function collapsePanel(fromRoute) {
    if (!isExpanded || isCollapsing) return;
    isCollapsing = true;

    // A user-initiated close returns the URL to the homepage.
    // Router-initiated collapses keep the destination hash intact.
    if (!fromRoute) {
        EELRouteManager.clearRoute();
    }

    _getExpandedEls();
    var expandedOverlay = _cachedExpandedOverlay;
    var expandedContainer = _cachedExpandedContainer;
    var panel = document.getElementById(currentExpandedPanel);
    var glassContainer = _cachedGlassContainer;

    if (!panel || !expandedOverlay || !expandedContainer) {
        isExpanded = false;
        isCollapsing = false;
        currentExpandedPanel = null;
        getCachedNavPanels().forEach(function(p) {
            p.style.pointerEvents = '';
            p.classList.remove('hidden');
        });
        return;
    }

    var collapsedPanelId = currentExpandedPanel;

    if (radialPanelPhysics && radialPanelPhysics.panels) {
        radialPanelPhysics.panels.forEach(function(panelData, panelId) {
            if (radialPanelPhysics.draggedPanel !== panelId) panelData.isDragging = false;
        });
        radialPanelPhysics.draggedPanel = null;
    }

    // Remove blur immediately — don't run backdrop-filter during collapse morph
    glassContainer.classList.remove('blur-active');

    // FLIP reverse: compute the panel's current position, then transform to it
    var panelRect = panel.getBoundingClientRect();
    var containerRect = expandedContainer.getBoundingClientRect();

    // The container is at its expanded position. Compute transform to shrink to panel.
    var scaleX = panelRect.width / containerRect.width;
    var scaleY = panelRect.height / containerRect.height;
    var translateX = panelRect.left - containerRect.left;
    var translateY = panelRect.top - containerRect.top;

    expandedContainer.classList.remove('expanded');

    requestAnimationFrame(function() {
        // Animate transform from identity to the panel's position
        expandedContainer.style.transform = 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale(' + scaleX + ', ' + scaleY + ')';

        // Resume background systems so Three.js renders during fade-in
        _resumeBackgroundSystems();

        fadeInElements();
        panel.classList.remove('hidden');
        panel.setAttribute('aria-expanded', 'false');
        TetherSystem.fadeIn();
        fadeDrone(1);

        setTimeout(function() {
            getCachedNavPanels().forEach(function(p) { p.style.pointerEvents = ''; });
        }, 50);
    });

    // Cleanup after transition completes
    var _collapseCleanedUp = false;
    function _onCollapseEnd(e) {
        if (_collapseCleanedUp || e.target !== expandedContainer) return;
        _collapseCleanedUp = true;
        expandedContainer.removeEventListener('transitionend', _onCollapseEnd);
        _collapseCleanup();
    }
    expandedContainer.addEventListener('transitionend', _onCollapseEnd);

    function _collapseCleanup() {
        expandedOverlay.classList.remove('active');
        expandedContainer.classList.remove('morphing');
        expandedContainer.style.opacity = '0';
        expandedContainer.style.transform = '';
        expandedOverlay.style.pointerEvents = 'none';
        expandedContainer.style.pointerEvents = 'none';
        // Park the page (its layout stays cached for the next open).
        PagePrerender.parkAll();

        var panelData = radialPanelPhysics.panels.get(collapsedPanelId);
        if (panelData) {
            panelData.physicsDisabled = false;
            panelData.isDragging = false;
        }

        if (previousFocus && previousFocus.focus) previousFocus.focus();
        previousFocus = null;

        isExpanded = false;
        isCollapsing = false;
        currentExpandedPanel = null;

        // Keep the (transparent, pointer-transparent) container in place for the next open.
        _sizeClosedExpandedContainer();
    }

    // Fallback timeout in case transitionend doesn't fire
    setTimeout(function() {
        if (!_collapseCleanedUp) {
            _collapseCleanedUp = true;
            expandedContainer.removeEventListener('transitionend', _onCollapseEnd);
            _collapseCleanup();
        }
    }, 900);
}

// Cache frequently accessed elements for fade operations
let _cachedSiteTitle = null;
let _cachedSiteSubtitle = null;
let _cachedSiteTagline = null;
let _cachedMedallion = null;
let _cachedThreeCanvas = null;
let _cachedNebula = null;
let _cachedChromeGrid = null;

function _getFadeEls() {
    if (!_cachedSiteTitle) {
        _cachedSiteTitle = document.getElementById('siteTitle');
        _cachedSiteSubtitle = document.getElementById('siteSubtitle');
        _cachedSiteTagline = document.getElementById('siteTagline');
        _cachedMedallion = document.getElementById('centralMedallion');
        _cachedThreeCanvas = document.getElementById('three-canvas');
        _cachedNebula = document.querySelector('.organic-nebula');
        _cachedChromeGrid = document.querySelector('.chrome-grid');
    }
}

function fadeOutElements() {
    _getFadeEls();
    // Fade out the UI elements (title, subtitle, tagline, medallion, panels)
    _cachedSiteTitle.classList.add('hidden');
    _cachedSiteSubtitle.classList.add('hidden');
    if (_cachedSiteTagline) _cachedSiteTagline.classList.add('hidden');
    _cachedMedallion.classList.add('hidden');
    getCachedNavPanels().forEach(panel => {
        if (panel.id !== currentExpandedPanel) panel.classList.add('hidden');
    });
    // Fade out the full background scene (canvas, nebula blobs, chrome grid)
    if (_cachedThreeCanvas) _cachedThreeCanvas.classList.add('bg-hidden');
    if (_cachedNebula) _cachedNebula.classList.add('bg-hidden');
    if (_cachedChromeGrid) _cachedChromeGrid.classList.add('bg-hidden');
}

function fadeInElements() {
    _getFadeEls();
    _cachedSiteTitle.classList.remove('hidden');
    _cachedSiteSubtitle.classList.remove('hidden');
    if (_cachedSiteTagline) _cachedSiteTagline.classList.remove('hidden');
    _cachedMedallion.classList.remove('hidden');
    getCachedNavPanels().forEach(panel => {
        panel.style.opacity = '';
        panel.style.pointerEvents = '';
        panel.classList.remove('hidden');
    });
    // Restore background scene
    if (_cachedThreeCanvas) _cachedThreeCanvas.classList.remove('bg-hidden');
    if (_cachedNebula) _cachedNebula.classList.remove('bg-hidden');
    if (_cachedChromeGrid) _cachedChromeGrid.classList.remove('bg-hidden');
}

function _contentHtml(contentType) {
    if (!_contentCache[contentType]) {
        switch(contentType) {
            case 'projects': _contentCache[contentType] = getProjectsContent(); break;
            case 'people': _contentCache[contentType] = getPeopleContent(); break;
            case 'about': _contentCache[contentType] = getAboutContent(); break;
            case 'join': _contentCache[contentType] = getJoinContent(); break;
            default: _contentCache[contentType] = '<p>Content coming soon...</p>';
        }
    }
    return _contentCache[contentType];
}

// ============================================
// PRE-RENDERED PAGES
// ============================================
// Each expanded page is built and laid out ahead of time (while the site is
// idle), then parked with content-visibility: hidden, which keeps its layout
// cached. Opening a page only un-parks it, so the morph animation is not
// preceded by a long HTML build + layout on the main thread.

const PagePrerender = {
    pages: {},
    order: ['projects', 'people', 'about', 'join'],
    active: null,
    _scheduled: false,

    container: function() {
        _getExpandedEls();
        return _cachedExpandedContent;
    },

    build: function(contentType, warm) {
        if (this.pages[contentType]) return this.pages[contentType];
        const container = this.container();
        if (!container) return null;
        const page = document.createElement('div');
        page.className = 'expanded-page';
        page.dataset.page = contentType;
        page.innerHTML = _contentHtml(contentType);
        if (!warm) page.classList.add('is-parked');
        container.appendChild(page);
        if (warm) {
            // Lay it out (invisibly: the closed container is transparent and
            // off-screen) and run one park/unpark cycle, after which Blink
            // keeps the parked subtree's layout and un-parking is ~free.
            void page.offsetHeight;
            page.classList.add('is-parked');
            void container.offsetHeight;
            page.classList.remove('is-parked');
            void page.offsetHeight;
            page.classList.add('is-parked');
        }
        this.pages[contentType] = page;
        return page;
    },

    // Un-park a page while the user is pointing at its panel, so the
    // browser paints it before the click.
    preview: function(contentType) {
        if (isExpanded || isCollapsing || this.active === contentType) return;
        _sizeClosedExpandedContainer();
        this.lockFocus(this.activate(contentType));
    },

    // While a page is previewed in the closed (invisible) container, its
    // links must not be reachable with Tab. Only tabindex changes here, which
    // no style depends on, so restoring it at open costs no restyle/repaint.
    FOCUSABLE: 'a[href], button, input, select, textarea, [tabindex]',

    lockFocus: function(page) {
        if (!page || page._focusLocked) return;
        page._focusLocked = true;
        page.querySelectorAll(this.FOCUSABLE).forEach(function(el) {
            if (el.hasAttribute('data-eel-tabindex')) return;
            el.setAttribute('data-eel-tabindex', el.getAttribute('tabindex') === null ? '' : el.getAttribute('tabindex'));
            el.setAttribute('tabindex', '-1');
        });
    },

    unlockFocus: function(page) {
        if (!page || !page._focusLocked) return;
        page._focusLocked = false;
        page.querySelectorAll('[data-eel-tabindex]').forEach(function(el) {
            const v = el.getAttribute('data-eel-tabindex');
            if (v === '') el.removeAttribute('tabindex'); else el.setAttribute('tabindex', v);
            el.removeAttribute('data-eel-tabindex');
        });
    },

    activate: function(contentType) {
        const page = this.build(contentType, false);
        for (const key in this.pages) {
            this.pages[key].classList.toggle('is-parked', key !== contentType);
        }
        this.active = contentType;
        return page;
    },

    parkAll: function() {
        for (const key in this.pages) this.pages[key].classList.add('is-parked');
        this.active = null;
    },

    idle: function(cb) {
        if (window.requestIdleCallback) window.requestIdleCallback(cb, { timeout: 4000 });
        else setTimeout(cb, 300);
    },

    // Let each page paint once while the closed container is transparent,
    // so first-time paint work (glyph rasterisation etc.) happens now rather
    // than on the first click.
    paintWarm: function() {
        const queue = this.order.slice();
        const next = () => {
            if (!queue.length) { if (!isExpanded && !isCollapsing) this.parkAll(); return; }
            if (isExpanded || isCollapsing) return;
            this.preview(queue.shift());
            requestAnimationFrame(() => requestAnimationFrame(() => this.idle(next)));
        };
        this.idle(next);
    },

    // Font loads, theme switches and resizes invalidate the parked layouts;
    // redo that work in idle time (one page per idle period) rather than at
    // the moment a page is opened.
    rewarm: function() {
        clearTimeout(this._rewarmTimer);
        this._rewarmTimer = setTimeout(() => {
            const queue = Object.keys(this.pages);
            const next = () => {
                if (!queue.length) return;
                if (isExpanded || isCollapsing) { setTimeout(() => this.idle(next), 1000); return; }
                const key = queue.shift();
                const page = this.pages[key];
                const container = this.container();
                page.classList.remove('is-parked');
                void container.offsetHeight;
                page.classList.add('is-parked');
                this.idle(next);
            };
            this.idle(next);
        }, 200);
    },

    // Touch screens have no hover: pre-paint the page of the panel that is
    // scrolled into view instead (it is the one about to be tapped).
    watchVisiblePanels: function() {
        if (this._observer || typeof IntersectionObserver === 'undefined') return;
        let pending = null;
        this._observer = new IntersectionObserver((entries) => {
            if (!RuntimeVisibility.mobilePortrait) return;
            let best = null;
            entries.forEach((e) => { if (e.isIntersecting && e.intersectionRatio >= 0.6 && (!best || e.intersectionRatio > best.intersectionRatio)) best = e; });
            if (!best) return;
            pending = best.target.dataset.contentType;
            this.idle(() => { if (pending) this.preview(pending); pending = null; });
        }, { threshold: [0.6, 0.9] });
        document.querySelectorAll('.nav-panel').forEach((panel) => this._observer.observe(panel));
    },

    // Build the remaining pages one per idle period, only while closed,
    // once the web fonts are in (they change text metrics).
    scheduleIdleBuild: function() {
        if (this._scheduled) return;
        this._scheduled = true;
        const next = () => {
            const missing = this.order.find((t) => !this.pages[t]);
            if (!missing) { this.paintWarm(); this.watchVisiblePanels(); return; }
            if (isExpanded || isCollapsing) { setTimeout(() => this.idle(next), 1000); return; }
            _sizeClosedExpandedContainer();
            this.build(missing, true);
            this.idle(next);
        };
        const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        fontsReady.then(() => this.idle(next));
        if (document.fonts && document.fonts.addEventListener) {
            document.fonts.addEventListener('loadingdone', () => this.rewarm());
        }
        window.addEventListener('themechange', () => this.rewarm());
    }
};

// Keep the closed container where and how big it will open, so pre-built
// pages are laid out at their final width and a previewed page is already
// painted. It stays fully transparent, ignores the pointer, is hidden from
// assistive technology, and its previewed page is taken out of the tab order.
function _sizeClosedExpandedContainer() {
    _getExpandedEls();
    if (!_cachedExpandedContainer || isExpanded || isCollapsing) return;
    const c = _cachedExpandedContainer;
    const target = _getExpandedTargetRect();
    c.style.left = target.left + 'px';
    c.style.top = target.top + 'px';
    c.style.width = target.width + 'px';
    c.style.height = target.height + 'px';
    c.setAttribute('aria-hidden', 'true');
}

window.addEventListener('resize', () => {
    clearTimeout(_sizeClosedExpandedContainer._t);
    _sizeClosedExpandedContainer._t = setTimeout(() => {
        _sizeClosedExpandedContainer();
        PagePrerender.rewarm();
    }, 150);
}, { passive: true });

function loadContent(contentType, container) {
    PagePrerender.unlockFocus(PagePrerender.activate(contentType));
}

function getProjectsContent() {
    const currentProjects = [
        {
            title: 'Boundary-Aware Redirected Walking in Virtual Reality',
                                   image: 'images/RedirectedWalkingNepal.webp',
                      imageAlt: 'Student testing the EEL redirected-walking virtual reality system',
            body: [
                `Redirected walking allows someone to explore a virtual environment larger than the physical room around them. The EEL system uses translation, rotation, and curvature gains to subtly adjust a participant’s virtual path while boundary-aware software keeps the participant safely inside the laboratory.`,
                `Students have implemented redirected-walking systems in Unity and Unreal Engine for the Meta Quest 3. Initial testing allowed participants to explore a roughly 50-meter virtual temple environment while remaining within a physical space approximately two meters wide. The next phase will improve path planning, obstacle avoidance, and the integration of multiple large-scale environments captured in Nepal.`
            ],
            collaboration: 'Religious Studies'
        },
        {
            title: 'Scalable 3D Environment Optimization',
                        image: 'images/3DEnvironment.webp',
            imageAlt: 'Large-scale three-dimensional environment captured in Nepal',
            body: [
                `Fieldwork at Swayambhu in Nepal produced more than 500 gigabytes of photographs, laser-scanned point clouds, and aerial imagery. The resulting photogrammetry model contains approximately 2.7 billion triangles, making it far too large for conventional computers or VR headsets to display directly.`,
                `Students are comparing photogrammetry, Neural Radiance Fields, and 3D Gaussian Splatting to determine how very large environments can be represented efficiently without losing their essential visual detail. Preliminary results suggest that a hybrid workflow may provide the best combination of image quality, real-time performance, and portability across VR and conventional computing platforms.`
            ],
                       collaboration: 'Religious Studies',
            link: 'https://research.unc.edu/story/blueprints-for-preservation/',
            linkText: 'Read the UNC Research feature, “Blueprints for Preservation”',
            secondLink: 'https://www.unc.edu/discover/tar-heel-team-begins-preservation-of-ancient-nepal-temple/',
            secondLinkText: 'Read the Carolina story about the Nepal fieldwork'
        },
             {
            title: 'Interactive 3D Heritage Explorer',
            image: 'images/HeritageExplorer.webp',
            imageAlt: 'Interactive 3D Heritage Explorer environment based on the Swayambhu heritage site in Nepal',
            body: [
                `This project is developing an Unreal Engine application that allows students, researchers, and the public to explore the EEL’s detailed 3D models of Swayambhu and other culturally significant locations in Nepal. The viewer will bring together optimized models, contextual information, photographs, and other field data in an accessible interactive environment.`,
                `The goal is to make these extensive datasets useful beyond the VR laboratory while preserving the spatial relationships that are difficult to communicate through conventional photographs, maps, and videos.`
            ],
            collaboration: 'Religious Studies'
        },
        {
            title: 'PAWS: SPOT Assistive Navigation Robot',
                        image: 'images/SPOT.webp',
            imageAlt: 'Boston Dynamics SPOT robot used for the PAWS assistive navigation project',
            body: [
                `PAWS, or Personal Autonomous Walking Support, explores how a Boston Dynamics SPOT robot could assist people who need additional support while walking. The current system combines spoken commands, GPS-independent GraphNav localization, LiDAR sensing, stored waypoints, and a specially designed support handle.`,
                `The robot can guide a user to a selected location, monitor its surroundings, and stop automatically if the user releases the handle. Future work will explore capacitive sensing, improved user controls, and integration with more detailed building maps.`
            ]
        },
        {
            title: 'Recreating Fred Brooks’s Office in Virtual Reality',
                        image: 'images/BrooksVR.webp',
            imageAlt: 'Photogrammetry reconstruction of Frederick P. Brooks Jr.’s office',
            body: [
                `This project is preserving the office of pioneering computer scientist Frederick P. Brooks Jr. as an interactive virtual environment. Students created a detailed photogrammetry model from photographs, processed the resulting geometry through RealityScan, Instant Meshes, and Blender, and brought the optimized environment into Unity for VR.`,
                `The work has reduced the geometric complexity of individual objects by approximately 89 to nearly 100 percent while maintaining the recognizable appearance of the original office. Continuing research will investigate automated model-processing tools, standardized photography methods, and level-of-detail systems that adjust model complexity according to the viewer’s location.`
            ]
        },
        {
            title: 'Finger-Position Optimization for Swimming',
                        image: 'images/SwimmerHand.webp',
            imageAlt: 'Experimental hand models used to study swimming performance',
            body: [
                `Small changes in finger spacing and hand position can affect the forces produced by a swimmer moving through the water. Students are using 3D-printed hand models, pressure measurements, pitot tubes, and flow visualization to study how finger spacing, wrist angle, and hand orientation influence useful propulsive force.`,
                `The project combines experimental design, fabrication, instrumentation, and data analysis with the goal of producing findings that can be translated into practical guidance for competitive swimmers.`
            ],
            collaboration: 'Applied Mathematics, Exercise and Sport Science, and the U.S. Olympic Swim Team',
            link: 'https://www.unc.edu/posts/2024/08/06/tar-heel-experts-unlock-science-behind-swimming/',
            linkText: 'Read the Carolina story about the science behind swimming'
        },
        {
            title: 'Hand-Position Tracking Glove',
                        image: 'images/SwimmerGlove.webp',
            imageAlt: 'Hand-position tracking glove with flex sensors and embedded electronics',
            body: [
                `Originally developed as a second phase of the swimming project, this low-cost sensing glove measures the positions of a user’s fingers and displays a corresponding hand model in Unity. The system uses flex sensors, an Arduino Nano 33, a multiplexed circuit, and MATLAB-based calibration to translate physical hand movements into a live digital representation.`,
                `The glove could eventually provide real-time feedback that helps swimmers maintain an optimal hand position. Its broader potential includes physical therapy, rehabilitation, and guided home-exercise applications. Current work is focused on improving calibration, reducing sensor drift, adding more complete thumb tracking, and developing a custom circuit board.`
            ],
            collaboration: 'Applied Mathematics, Exercise and Sport Science, and the U.S. Olympic Swim Team'
        },
        {
            title: 'Biologically Driven Autonomous Vehicle Research',
                       image: 'images/AutonomousVehicle.webp',
            imageAlt: 'Biologically controlled autonomous vehicle developed in the EEL',
            body: [
                `This project investigates how biological movement and other human or animal signals can be used to control autonomous systems. In the initial prototype, a camera and computer-vision system track the movement of a goldfish within different regions of its tank. Those movements are translated into steering and throttle commands for a small robotic vehicle.`,
                `LiDAR and infrared sensors provide independent safety overrides to prevent collisions. Although the prototype uses a fish, the underlying control architecture could be adapted to eye movement, muscle signals, gestures, or other biological inputs.`
            ]
        },
        {
            title: 'Acoustic Communication for an Underwater Manta Ray Robot Swarm',
                        image: 'images/MantaRay.webp',
            imageAlt: 'CAD rendering of an underwater manta ray robot design',
            body: [
                `Students are developing low-cost underwater robots inspired by manta rays that could eventually work together to map the seafloor or collect environmental measurements. The current research focuses on underwater acoustic communication using piezoelectric transducers and communication protocols designed for a swarm of robots.`,
                `The project also includes the design and fabrication of PETG bodies, flexible TPU fins, servo-driven propulsion, adjustable buoyancy systems, and waterproof electronics. Future versions could carry cameras, water-quality sensors, or other scientific instruments.`
            ]
        },
        {
            title: 'Mixed-Reality Motorcycle Assembly Training',
                        image: 'images/MotorcycleAR.webp',
            imageAlt: 'Mixed-reality instructions guiding a motorcycle assembly task',
            body: [
                `This project explores how mixed reality can guide someone through a complex mechanical assembly task. Built in Unity for the Meta Quest 3, the system uses reference markers, environmental depth sensing, and context-aware overlays to show users which tools and components are needed and where each part belongs.`,
                `Users can confirm steps through hand gestures while the system provides instructions in the order required to complete the task. Initial testing demonstrated accurate alignment between virtual instructions and physical motorcycle components while reducing uncertainty during assembly.`
            ]
        },
        {
            title: 'Augmented Aurality',
                        image: 'images/AugmentedAurality.webp',
            imageAlt: 'Wearable augmented-hearing prototype developed in the EEL',
            body: [
                `Augmented Aurality explores whether wearable technology can help users focus on a particular speaker in a noisy environment. The prototype uses an array of eight microphones, a Teensy processor, beamforming, and a signal-processing method called imaginary boosting to isolate and amplify sound coming from a selected direction.`,
                `Students designed custom glasses, electronics, and circuit boards to create a compact wearable prototype. The work addresses the familiar “cocktail party problem” and could contribute to future assistive-listening and augmented-hearing systems.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
                            {
            title: '30-Channel Wavemaker Control Interface',
            image: 'images/Wavemaker.webp',
            imageAlt: 'Thirty-channel wavemaker used for fluid-dynamics research in the EEL',
            body: [
                `The EEL previously designed and constructed a 30-channel wavemaker for fluid-dynamics research. The current student project is creating a new software interface that allows researchers to control the individual wave channels, construct repeatable wave patterns, and coordinate more complex experimental sequences.`,
                `The interface will make the existing system easier to operate while allowing researchers to design experiments that would be difficult to conduct through manual control.`
            ],
            collaboration: 'Applied Mathematics'
        },
        {
                       title: 'RAMPA: Robotic Augmented Reality for Machine Programming by Demonstration',
            image: 'images/RAMPA.webp',
            imageAlt: 'RAMPA augmented-reality interface used to demonstrate and visualize a robotic arm trajectory',
            body: [
                `RAMPA is an augmented-reality framework that allows users to teach tasks to industrial robotic arms by demonstration. Using a Meta Quest 3 headset, users can demonstrate, record, and visualize robotic trajectories directly within the physical environment without manually moving the robot hardware.`,
                `The system combines real-time hand mimicry, in-situ simulation, machine-learning model training, and editable virtual waypoints before deploying trained skills to a Universal Robots UR10 arm. In a study involving 20 participants, RAMPA was evaluated against traditional kinesthetic teaching methods across three manipulation tasks, with results showing improvements in operational safety, task efficiency, trajectory smoothness, and user experience.`
            ],
            collaboration: 'CoLoRs Lab, Boğaziçi University',
            link: 'https://github.com/dogadogan/rampa',
            linkText: 'View the published RAMPA version',
            secondLink: 'https://github.com/nilzerendogan/rampaextended',
            secondLinkText: 'View the active RAMPA development version'
        }
    ];
    const developmentProjects = [
                {
            title: 'AI Research Discovery Platform',
            body: [
                `This project will create an interactive map of research at UNC, beginning with Computer Science. It will connect faculty, research topics, publications, and projects so users can explore related work and discover opportunities for collaboration.`,
                `A faculty portal will help researchers find collaborators, assemble teams for major proposals, and identify relevant calls for papers and grant opportunities. A separate portal for campus leaders will show research strengths, emerging areas, gaps, overlap, and potential duplication to support planning and investment.`
            ]
        },
        {
            title: 'Dorsiflexion and Corticomuscular Coherence Measurement System',
            body: [
                `This project will study the connection between brain activity and lower-extremity muscle activity during a dorsiflexion task. Neural oscillations will be measured through electroencephalography while electromyography records the corresponding muscle activity.`,
                `Students will design and fabricate an adjustable device that safely secures a participant’s foot during a sustained dorsiflexion hold while supporting reliable EMG data collection.`
            ],
            collaboration: 'Physical Therapy'
        },
        {
            title: 'Virtual Chemistry Lab',
            body: [
                `The Virtual Chemistry project will combine physical laboratory containers with virtual chemicals in augmented reality. Students could handle real beakers, test tubes, and other laboratory equipment while inexpensive and comparatively safe substances such as water stand in for dangerous, rare, or costly chemicals.`,
                `Augmented reality would provide the expected colors, reactions, measurements, and other visual effects. The project could expand access to laboratory experiences while allowing students to repeat experiments that would otherwise be unsafe or impractical.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: 'Floating Holographic Display',
            body: [
                `This project will combine a mirascope with a spatial light modulator to create an interactive floating-image display. The work will require optical experimentation, mechanical design, fabrication, software development, and system calibration.`,
                `Students will also investigate whether a machine-learning model can adjust the spatial light modulator’s output to compensate for warping, blur, and other distortions produced by the optical system.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: 'Generative AI for Immersive 360° Environments',
            body: [
                `This project will investigate generative AI systems capable of creating immersive environments from text prompts. Rather than producing a single flat image or conventional video, the long-term goal is to generate a three-dimensional experience through which a user can move, view the scene from different directions, and interact with objects.`,
                `The first phase will focus on creating a large training dataset using synchronized 360-degree video, high-resolution narrow-field imagery, LiDAR, and other available sensors.`
            ],
            collaboration: 'Visual Computing and Augmented Intelligence Lab, Computer Science'
        },
        {
            title: 'Remote PIV System for Measuring Iceberg Melt',
            body: [
                `This project will develop a remotely operated system that can attach itself rigidly to an iceberg using remotely controlled ice drills. Once secured, the system will use particle-image velocimetry to measure fluid motion at the boundary between cold meltwater and the surrounding seawater.`,
                `The research will require the integration of underwater robotics, mechanical design, fabrication, cameras, lighting, instrumentation, and remote-control systems capable of operating in a difficult environment.`
            ],
            collaboration: 'Earth, Marine and Environmental Sciences'
        },
               {
            title: 'Low-Cost CTD Sensors for Oceanography',
            body: [
                `Conductivity, temperature, and depth sensors are essential tools in oceanographic research, but commercial CTD systems can be expensive. This project will use OpenCTD, a low-cost, open-source platform whose software, circuit boards, and 3D-printable components are publicly available under an MIT license.`,
                `Students will fabricate, assemble, calibrate, and test OpenCTD instruments while exploring modifications for specific research applications.`
            ],
            collaboration: 'Earth, Marine and Environmental Sciences'
        },
        {
            title: 'FloodLens',
            body: [
                `FloodLens is a flood-visualization project that helps homeowners better understand flood risk by turning abstract elevation and storm-surge data into a visual preview on their own home. Users can enter an address or upload an image of a home, and the system uses Street View imagery, computer vision, and reference-object detection to estimate where flood water could reach on the property.`,
                `Future work will move beyond a two-dimensional overlay by using photogrammetry from a short video or multiple photographs submitted by the homeowner. This would allow the system to reconstruct a rough 3D model of the property and generate a more realistic visualization of flood water around the structure.`
            ]
        },
               {
            title: 'RC Vehicle Dynamics',
            body: [
                `This project will develop a low-cost experimental platform for studying vehicle dynamics using a hobby-grade RC car. The vehicle will be instrumented with an inertial measurement unit, wheel-speed sensor, and steering-angle sensor to collect synchronized measurements of steering input and vehicle response during controlled driving experiments.`,
                `Straight-line, steady-state cornering, and transient steering tests will be used to characterize the vehicle and compare its measured behavior with simple vehicle-dynamics models. The platform will also support controlled changes to parameters such as weight distribution to investigate how vehicle setup influences handling and dynamic response.`
            ]
        },
              {
            title: 'Ocular Response Impairment Screening',
            body: [
                `This project explores how consumer camera technology could help physical therapists screen for concussion and traumatic brain injury. The current system combines computer vision-based pupil tracking, standardized oculomotor tests including smooth pursuit, saccades, and convergence, and validated clinical benchmarks from the Vestibular/Ocular Motor Screening assessment (VOMS) to identify movement patterns associated with concussion.`,
                `The system tracks a user’s eye movements as they follow a visual stimulus, compares the results with clinician-administered reference scores, and provides physical therapists with objective, repeatable oculomotor metrics at the point of care. Future work will explore pupillary light reflex testing, a wearable headset-based form factor, and integration with vestibular and balance assessment.`
            ],
            collaboration: 'Physical Therapy'
        },
        {
            title: 'Multi-Camera Court Line Calling System',
            body: [
                `This project is developing a portable line-calling system for pickleball and tennis using multiple cameras positioned around the court. Computer-vision software will track the ball from several angles and use the court markings to calibrate the cameras and combine their views into an estimate of the ball’s three-dimensional position.`,
                `The system will compare bounce locations with court boundaries to determine whether a shot is in or out. The goal is to create an affordable, easy-to-deploy system that can provide audio feedback and allow players to review close calls through replay on their phones.`
                       ]
        },
        {
            title: 'Heatmapping Car Buffing',
            body: [
                `This project builds a system that tracks a car buffer’s movement and gives users feedback on their technique. A fiducial marker on the back of the buffer is tracked by an Intel RealSense depth camera on a tripod. The data is turned into a heatmap in Unity that shows missed areas, spots that got too much attention, and overall coverage.`,
                `We will record a reference dataset of correct technique using an experienced professional detailer, then test the system with beginners to see whether visual feedback helps them learn to buff more evenly.`
            ]
        }
    
    ];
    EELStats.projectCount =
        currentProjects.length + developmentProjects.length;
    const courses = [
              {
            title: 'COMP 290: Introduction to Applied Engineering',
            body: [
                `Introduction to Applied Engineering is a hands-on course taught by Jim Mahaney in the Computer Science machine shop. Students personally operate metal lathes, milling machines, welding equipment, and related tools while learning traditional fabrication methods, shop safety, materials, tolerances, and mechanical design.`,
                `One of the course’s central themes is the use of applied engineering to support research. Student projects are connected to research in Computer Science and in collaborating departments across campus. Based on a review of UNC’s published course offerings, this appears to be the University’s first undergraduate credit-bearing course centered on students operating this range of traditional machine-shop equipment.`
            ],
            link: 'https://www.unc.edu/posts/2026/10/20/these-students-solve-research-problems-with-their-hands/',
            linkText: 'Read The Well feature on COMP 290'
        },
        {
            title: 'COMP 293: Internship in Computer Science',
            body: [
             `In the EEL, COMP 293 is taught by Jim Mahaney and gives experienced undergraduate research engineers the opportunity to lead a research team. Student leaders help define project goals, organize the team’s work, mentor newer undergraduate research engineers, guide technical decisions, and address problems as they arise.`,
                `The course allows students to develop leadership, project-management, communication, and mentoring skills while continuing to contribute directly to active research.`
            ]
        },
        {
            title: 'COMP 495: Mentored Research in Computer Science',
            body: [
                `In the EEL, COMP 495 is taught by Jim Mahaney and allows students to pursue focused research projects using the lab’s facilities, equipment, and technical resources. Each section is tailored to the individual student and project, so the research topic, methods, and deliverables vary.`,
                `Students take greater responsibility for defining the problem, selecting appropriate methods, designing and conducting experiments, documenting their work, and presenting their results.`
            ]
        },
        {
            title: 'RELI 283: The Buddhist Tradition: India, Nepal, and Tibet',
            body: [
               `RELI 283 is taught by Lauren Leve in Religious Studies. Working with Leve, Jim Mahaney and EEL undergraduate research engineers have developed the 3D models, optimized datasets, VR environments, and redirected-walking system used in the course.`,
                `During VR labs, students explore accurately scaled models of Swayambhu and other locations discussed in class. Redirected walking allows them to move naturally through a life-size virtual environment much larger than the physical laboratory, giving them a stronger understanding of scale, spatial relationships, and the embodied experience of a religious site.`,
                    `More than a dozen undergraduate research engineers have contributed to the models and VR system. The course demonstrates a direct connection between field research and teaching while bringing together Computer Science and the humanities in a way that would not be possible through conventional two-dimensional classroom materials alone.`
                                ],
                       collaboration: 'Religious Studies',
            link: 'https://dailytarheel.com/480769/lifestyle/religious-studies-class-transports-students-to-nepal-through-virtual-reality/',
            linkText: 'Read The Daily Tar Heel story about RELI 283 and virtual reality'
        }
    ];
        EELStats.courseCount = courses.length;

    const pastProjects = [
        {
            title: 'Magnetohydrodynamic Drive',
            image: 'images/MagnetohydrodynamicDrive.png',
            imageAlt: 'Magnetohydrodynamic drive developed and tested in the EEL',
            body: [
                `This project investigated propulsion systems that use magnetic and electric fields to move electrically conductive seawater without conventional propellers. Students designed and fabricated both circular and Halbach-array magnetohydrodynamic drives and evaluated them using high-speed 4K video and particle-image velocimetry.`,
                `Testing showed that the Halbach-array design produced a higher exhaust velocity and approximately 50 percent greater normalized efficiency than the circular configuration.`
            ],
            collaboration: 'Applied Mathematics'
        },
        {
            title: 'Smart Irrigation System',
            image: 'images/SmartIrrigationSystem.png',
            imageAlt: 'Sensor-based smart irrigation system developed in the EEL',
            body: [
                `Students developed a sensor-based irrigation system designed to monitor environmental conditions and provide water only when needed. The project integrated sensors, control electronics, software, and a physical watering system into a working prototype.`,
                `The project demonstrated how relatively inexpensive hardware and intelligent control could reduce unnecessary water use while giving students experience with a complete system spanning measurement, computation, and mechanical design.`
            ]
        },
        {
            title: 'Modular WebAR Experiences',
                        image: 'images/ModularAR.webp',
            imageAlt: 'Browser-based augmented-reality experience displayed in the EEL',
            body: [
                `This project developed a reusable toolkit for creating browser-based augmented-reality experiences without requiring users to install a specialized application. The system uses natural images as tracking targets rather than QR codes or AprilTags and was built with A-Frame and MindAR.`,
                `An administrative dashboard and configuration files allow new experiences to be created and updated without rewriting the underlying software. The system was deployed through GitHub Pages for projects in the EEL and the SN020 makerspace, demonstrating a scalable approach to delivering accessible augmented-reality content.`
            ]
        }
    ];

    function renderBody(item) {
        return item.body.map(paragraph => `<p>${paragraph}</p>`).join('');
    }

    function renderDetails(item) {
        const parts = [];

        if (item.collaboration) {
            parts.push(`<p class="research-collaboration"><strong>Collaboration:</strong> ${item.collaboration}</p>`);
        }

               if (item.link) {
            parts.push(`<a class="research-link" href="${item.link}" target="_blank" rel="noopener noreferrer">${item.linkText}</a>`);
        }

        if (item.secondLink) {
            parts.push(`<br><a class="research-link" href="${item.secondLink}" target="_blank" rel="noopener noreferrer">${item.secondLinkText}</a>`);
        }

        return parts.join('');
    }

    function renderFeatureEntry(item) {
        const entryClass = item.image
            ? 'research-entry research-entry--with-image'
            : 'research-entry research-entry--text-only';

        const parts = [`<article class="${entryClass}">`];

        if (item.image) {
            parts.push(
                '<div class="research-entry-media">',
                `<img src="${item.image}" alt="${item.imageAlt || item.title}" loading="lazy" decoding="async">`,
                '</div>'
            );
        }

        parts.push(
            '<div class="research-entry-content">',
            `<h3>${item.title}</h3>`,
            '<div class="research-entry-copy">',
            renderBody(item),
            '</div>',
            renderDetails(item),
            '</div>',
            '</article>'
        );

        return parts.join('');
    }

    function renderTextEntry(item) {
        return [
            '<article class="research-text-entry">',
            `<h3>${item.title}</h3>`,
            '<div class="research-text-entry-content">',
            '<div class="research-entry-copy">',
            renderBody(item),
            '</div>',
            renderDetails(item),
            '</div>',
            '</article>'
        ].join('');
    }

    function renderSection(id, title, items, layout) {
        const renderer = layout === 'feature'
            ? renderFeatureEntry
            : renderTextEntry;

        const listClass = layout === 'feature'
            ? 'research-feature-list'
            : 'research-text-list';

        return [
            `<section class="research-section" id="${id}">`,
            `<h2 class="research-section-title">${title}</h2>`,
            `<div class="${listClass}">`,
            items.map(renderer).join(''),
            '</div>',
            '</section>'
        ].join('');
    }

    return [
        '<div class="research-page">',
        '<h1 class="expanded-title">Research &amp; Teaching</h1>',
        '<p class="research-intro">The EEL gives undergraduate students opportunities to participate in research that crosses traditional departmental boundaries and connects computing, engineering, fabrication, immersive technology, and scientific inquiry. Projects range from student-generated ideas to collaborations with faculty across campus. The lab also brings this work into credit-bearing courses in which students learn specialized technical skills, conduct mentored research, and lead research teams.</p>',
        '<nav class="research-jump-nav" aria-label="Research and teaching sections">',
        '<a href="#current-projects">Current Projects</a>',
        '<span aria-hidden="true">·</span>',
        '<a href="#projects-in-development">In Development</a>',
        '<span aria-hidden="true">·</span>',
        '<a href="#courses">Courses</a>',
        '<span aria-hidden="true">·</span>',
        '<a href="#past-work">Past Work</a>',
        '</nav>',
        renderSection('current-projects', 'Current Projects', currentProjects, 'feature'),
        renderSection('projects-in-development', 'Projects in Development', developmentProjects, 'text'),
        renderSection('courses', 'Courses and Academic Opportunities', courses, 'text'),
               renderSection('past-work', 'Selected Past Projects', pastProjects, 'feature'),
        '</div>'
    ].join('');
}

function getPeopleContent() {
    function linkedinLink(url) {
        if (!url) return '';

        return '<a href="' + url + '" class="linkedin-link" target="_blank" ' +
            'rel="noopener noreferrer" aria-label="LinkedIn Profile">' +
            '<svg class="linkedin-icon" viewBox="0 0 24 24" ' +
            'xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-' +
            '3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667' +
            'H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 ' +
            '3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 ' +
            '2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 ' +
            '13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 ' +
            '0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 ' +
            '24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>' +
            '</svg></a>';
    }
    function getStudentStatus(graduation, fallbackStatus) {
        if (!graduation) return fallbackStatus || 'Undergraduate';

        const yearMatch = graduation.match(/\b(20\d{2})\b/);
        if (!yearMatch) return fallbackStatus || 'Undergraduate';

        let graduationYear = parseInt(yearMatch[1], 10);

        // December/Fall graduates belong to the same academic cohort
        // as students graduating the following spring.
        if (/December|Fall/i.test(graduation)) {
            graduationYear += 1;
        }

        const now = new Date();

        // Academic year rolls over in July.
        const currentGraduationYear =
            now.getMonth() >= 6
                ? now.getFullYear() + 1
                : now.getFullYear();

        const yearsRemaining = graduationYear - currentGraduationYear;

        if (yearsRemaining <= 0) return 'Senior';
        if (yearsRemaining === 1) return 'Junior';
        if (yearsRemaining === 2) return 'Sophomore';
        if (yearsRemaining === 3) return 'Freshman';

        return fallbackStatus || 'Undergraduate';
    }
    const labDirector = {
        name: 'Jim Mahaney',
        role: 'Director of Engineering and Research'
    };

    const foundingEngineers = new Set([
        'Ethan DeRosa',
        'Siera Gashi',
        'Darwin Lemus',
        'Matias Magallanes',
        'Sofia Morais',
        'Sanskriti Negi',
        'Tate Semone',
        'Elyssa Snively',
        'Alexander Yevchenko',
        'Andy Choe',
        'Meghan Parker'
    ]);

    var boltSVG =
        '<svg class="founding-bolt" viewBox="0 0 72 90" ' +
        'xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M 36.34375 45.226562 L 45.222656 41.386719 ' +
        'L 38.742188 80.746094 L 38.261719 80.390625 ' +
        'L 35.863281 51.945312 C 32.554688 52.140625 ' +
        '29.253906 55.304688 26.019531 55.664062 ' +
        'L 33.941406 21.824219 C 33.671875 21.53125 ' +
        '28.269531 24.589844 27.945312 24.707031 ' +
        'L 36.582031 8.746094 L 39.941406 27.464844 ' +
        'L 36.699219 24.347656 L 36.34375 25.1875 Z" ' +
        'fill="currentColor"/></svg>';

    function foundingBadge(name) {
        if (!foundingEngineers.has(name)) return '';

        return '<div class="founding-badge">' +
            boltSVG +
            '<span>Founding Engineer</span></div>' +
            '<p class="founding-subtitle">' +
            'Member of the first EEL Undergraduate Cohort</p>';
    }

        const specialAccolades = {
        'Lily Foo': {
            badge: 'Best Aluminum TIG Welder',
                        subtitle: 'Fall 2025 & Spring 2026'
        },
             'Siera Gashi': {
            badge: 'Social Media Coordinator',
            subtitle: 'Experimental Engineering Lab'
        },
        'Yuxin Tian': {
            badge: 'Social Media Coordinator',
            subtitle: 'Experimental Engineering Lab'
        }
    };

    function accoladeBadge(name) {
        var accolade = specialAccolades[name];

        if (!accolade) return '';

        return '<div class="accolade-badge">' +
            boltSVG +
            '<span>' + accolade.badge + '</span></div>' +
            '<p class="accolade-subtitle">' +
            accolade.subtitle + '</p>';
    }

    const featuredMembers = [
                {
            name: 'Yuxin Tian',
            major: 'Economics',
            status: 'Senior',
            graduation: 'May 2027',
            headshot: 'headshots/yuxin-tian.png',
            linkedin: 'https://www.linkedin.com/in/yuxin-tian-aa0799306'
        },
        {
            name: 'Markandeya Yalamanchi',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'May 2028',
            project: 'Developing redirected walking (RDW) techniques for Meta Quest 3 VR, enabling users to navigate large virtual environments within smaller physical spaces. Currently building predictive models to anticipate reset frequency based on virtual environment topology, moving beyond implementing existing algorithms to discovering novel relationships between environment design and RDW effectiveness.',
            headshot: 'headshots/markandeya-yalamanchi.jpg',
            linkedin: 'https://www.linkedin.com/in/markyala'
        },
        {
            name: 'Tate Semone',
            major: 'Physics',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'My project tests magnetic-field orientations to maximize flow efficiency in a magnetohydrodynamic drive. Model 1 uses a circularly oriented B-field with a radially outward electric field; Model 2 utilizes a Halbach array to concentrate flux in the channel. Efficiency is evaluated using Particle Image Velocimetry (PIV) flow measurements.',
            headshot: 'headshots/tate-semone.jpeg',
            linkedin: 'https://www.linkedin.com/in/tate-semone-105905268'
        },
        {
            name: 'Sofia Morais',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'Designing a glove to track finger position for sports and physical therapy applications by integrating flex sensors with Arduino microcontrollers to measure finger bending and separation, while showing real-time hand movement on a hand model in Unity. She also enjoys learning fabrication skills such as welding and milling.',
            headshot: 'headshots/sofia-morais.jpeg',
            linkedin: 'https://www.linkedin.com/in/sofia-morais-486ba3277'
        },
        {
            name: 'Elyssa Snively',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'My project reprograms the Boston Dynamics Spot robot to operate as an autonomous guide dog, using AI-driven navigation, mapping, localization, obstacle detection, and voice-based destination commands. The system integrates perception, decision-making, and a custom physical handle interface to provide safe, timely guidance for visually impaired users on campus.',
            headshot: 'headshots/elyssa-snively.jpg',
            linkedin: 'https://www.linkedin.com/in/elyssa-snively'
        },
        {
            name: 'Ishi Varshney',
            major: 'Computer Science',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'My current project reprograms the Boston Dynamics Spot robot to act as an autonomous guide dog, enabling safe, intuitive navigation for visually impaired users. Initially focused on the UNC campus, the system uses AI-driven perception and voice commands to support scalable, location-independent mobility beyond environments where traditional guide dogs can be trained.',
            headshot: 'headshots/ishi-varshney.jpeg',
            linkedin: 'https://www.linkedin.com/in/ishi-varshney'
        },
        {
            name: 'Alexa Tinajero',
            major: 'Computer Science',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'This project involves developing the software that allows the Boston Dynamics Spot robot to navigate a campus environment independently as a guide for visually impaired users. I focus on how the robot interprets its surroundings through mapping, localization, and obstacle detection, makes navigation decisions using AI-based planning, and responds to voice-based destination commands. These components work together with a physical guidance handle to support safe, timely movement through real-world campus spaces.',
            headshot: 'headshots/alexa-tinajero.jpeg',
            linkedin: 'https://www.linkedin.com/in/alexatinajero'
        },
        {
            name: 'Lily Foo',
            major: 'Physics',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'Studying the dynamics of drag on hand position in fluids for swimmers.',
            headshot: 'headshots/lily-foo.png',
            linkedin: null
        },
        {
            name: 'Riley Goodwin',
            major: 'Biomedical Engineering',
            status: 'Sophomore',
            graduation: 'May 2029',
            project: 'I\'m currently helping code a fish-operated vehicle that uses a camera to track the movement of a fish, allowing it to accelerate and change directions. I\'m also working on a waterproof movement-tracking glove used to find the optimal hand positioning for swimmers.',
            headshot: 'headshots/riley-goodwin.jpg',
            linkedin: 'https://www.linkedin.com/in/riley-goodwinq'
        },
        {
            name: 'Ethan DeRosa',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'Assisting with the hardware components of the fish-operated vehicle.',
            headshot: 'headshots/ethan-derosa.jpg',
            linkedin: 'https://www.linkedin.com/in/ethandre'
        },
        {
            name: 'Coleman Stephens',
            major: 'Biomedical Engineering',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'My project involves utilizing a Boston Dynamics Spot robot to act as a seeing-eye dog. AI-driven navigation, mapping, localization, collision avoidance, and voice commands are implemented to use Spot as a guide. The system combines perception, decision-making, and a custom physical handle interface to deliver safe, timely guidance for visually impaired users navigating campus.',
            headshot: 'headshots/coleman-stephens.jfif',
            linkedin: 'https://www.linkedin.com/in/coleman-stephens'
        },
        {
            name: 'Mihika Tyagi',
            major: 'Data Science & Computer Science',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'My current focus is the Nepal VR project, in which we are implementing redirected walking to create a better experience navigating the temple model.',
            headshot: 'headshots/mihika-tyagi.jpg',
            linkedin: 'https://www.linkedin.com/in/mihika-tyagi'
        },
               {
            name: 'Siera Gashi',
            major: 'Biomedical Engineering',
            status: 'Junior',
            graduation: 'May 2028',
            
                        headshot: 'headshots/siera-gashi.png',
            linkedin: 'https://www.linkedin.com/in/siera-gashi-2a991422b'
        },
        {
            name: 'William Keffer',
            major: 'Computer Science & Math',
            status: 'Junior',
            graduation: 'May 2028',
            project: 'Developed and deployed the EEL website frontend and backend.',
            headshot: 'headshots/william-keffer.jpg',
            linkedin: 'https://www.linkedin.com/in/williamkeffer'
        },
        {
            name: 'Alexander Yevchenko',
            major: 'Computer Science, Business & Physics',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Alexander co-developed a real-time flex-sensor glove with Sofia Morais to study swimmer hand positioning, with applications in sports, rehabilitation, and virtual reality.',
            headshot: 'headshots/alexander-yevchenko.png',
            linkedin: 'https://www.linkedin.com/in/alexanderyevchenko'
        },
        {
            name: 'Darwin Lemus',
            major: 'Computer Science & Physics',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Darwin is an Honors Carolina computer science and physics student at UNC and a Gates and Williamson Scholar.',
            headshot: 'headshots/darwin-lemus.jpeg',
            linkedin: 'https://www.linkedin.com/in/dlemus89'
        },
        {
            name: 'Toluwani Ilesanmi',
            major: 'Computer Science',
            status: 'Sophomore',
            graduation: 'May 2029',
            project: 'Toluwani contributes to swarm robotics research through robot construction, testing, prototyping, schematic design, wiring, and hardware integration.',
            headshot: 'headshots/toluwani-ilesanmi.jpeg',
            linkedin: 'https://www.linkedin.com/in/toluwaniile'
        },
        {
            name: 'David Majernik',
            major: 'Computer Science',
            status: 'Senior',
            graduation: 'May 2027',
            project: 'David is a computer science student at UNC and a software engineering intern at Wells Fargo.',
            headshot: 'headshots/david-majernik.png',
            linkedin: 'https://www.linkedin.com/in/davidmajernik'
        },
        {
            name: 'Matthew Czar',
            major: 'Biochemistry & Statistics',
            status: 'Sophomore',
            graduation: 'May 2029',
                      project: 'Matthew researches swimming hydrodynamics in the Experimental Engineering Lab and Joint Mathematics and Marine Science Fluid Laboratories to optimize body position for elite athletes.',
            headshot: 'headshots/matthew-czar.png',
            linkedin: 'https://www.linkedin.com/in/meczar'
        },
        {
            name: 'Noah Butler',
            major: 'Computer Science',
            status: 'Undergraduate',
                       graduation: 'May 2028',
            project: 'Noah is a computer science student at UNC working on XR, computer graphics, redirected walking, and mixed-reality simulation systems.',
            headshot: 'headshots/noah-butler.png',
            linkedin: 'https://www.linkedin.com/in/n-rock'
        },
        {
            name: 'Matias Magallanes',
                        major: 'Biomedical Engineering',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Matias is a UNC undergraduate and a member of the EEL research team.',
            headshot: 'headshots/matias-magallanes.jpeg',
            linkedin: 'https://www.linkedin.com/in/matias-magallanes-8194872a9'
        },
        {
            name: 'Sanskriti Negi',
            major: 'Biomedical Engineering & Computer Science',
            status: 'Junior',
            graduation: 'December 2027',
            project: 'Sanskriti is a biomedical engineering and computer science student at UNC pursuing a career in robotics.',
            headshot: 'headshots/sanskriti-negi.jpeg',
            linkedin: 'https://www.linkedin.com/in/sanskriti-negi-unc'
        },
       
    ];

    const otherMembers = [
                            {
            name: 'Matthew Rastovski',
            major: 'Chemistry with a Focus in Analytical Chemistry',
            graduation: 'May 2027',
            headshot: 'headshots/matthew-alexander.png',
            linkedin: 'https://www.linkedin.com/in/matthew-rastovski-9a48552b7/'
        },
                {
            name: 'Adrian Hito',
            major: 'Computer Science & Biomedical Engineering',
            graduation: 'May 2029',
            headshot: 'headshots/adrian-hito.png',
            linkedin: 'https://www.linkedin.com/in/adrian-hito'
        },
                       {
            name: 'Adam Qaimari',
            major: 'Biomedical Engineering',
            graduation: 'May 2029',
            headshot: 'headshots/adam-qaimari.png',
            linkedin: 'https://www.linkedin.com/in/adamqaimari'
        },
                     {
            name: 'Alex Salinas',
            major: 'Computer Science',
            graduation: 'December 2026',
            headshot: 'headshots/alex-salinas.png',
            linkedin: 'https://www.linkedin.com/in/alex-a-salinas'
        },
                       {
            name: 'Alexander Caza',
            major: 'Computer Science',
            graduation: 'May 2030',
            headshot: 'headshots/alexander-caza.png',
            linkedin: 'https://www.linkedin.com/in/alex-caza-3464b821b/'
        },
                            {
            name: 'Allen Solomon',
            major: 'Computer Science',
            graduation: 'December 2026',
            headshot: 'headshots/allen-solomon.png',
            linkedin: 'https://www.linkedin.com/in/allen-solomon-68b8a3267/'
        },
       
                     {
            name: 'Joseph Sabo',
            major: 'Computer Science and Mathematics',
            graduation: 'May 2029',
            headshot: 'headshots/joseph-sabo.png',
            linkedin: 'https://www.linkedin.com/in/josephsabo29'
        },
               {
            name: 'Karthik Dundigalla',
            major: 'Computer Science',
            graduation: 'May 2027',
            headshot: 'headshots/karthik-dundigalla.png',
            linkedin: 'https://www.linkedin.com/in/karthik-dundigalla-a92332251'
        },
                     {
            name: 'Lillian Gann',
            major: 'Applied Sciences with Track in Materials Engineering',
            graduation: 'May 2028',
            headshot: 'headshots/lillian-gann.png',
            linkedin: 'https://www.linkedin.com/in/lillian-gann-unc'
        },
               {
            name: 'Luke Hyatt',
            major: 'Computer Science',
            graduation: 'May 2028',
            headshot: 'headshots/luke-hyatt.png',
            linkedin: 'https://www.linkedin.com/in/luke-hyatt-49a168288/'
        },
                             {
            name: 'Nichola Wells',
            major: 'Applied Mathematics and Engineering Physics',
            graduation: 'May 2028',
            headshot: 'headshots/nichola-wells.png',
            linkedin: 'https://www.linkedin.com/in/nichola-wells-872178262/'
        },
               {
            name: 'Agastya Maheshwari',
            major: 'Computer Science',
            graduation: 'May 2029',
            headshot: 'headshots/agastya-maheshwari.png',
            linkedin: 'https://www.linkedin.com/in/agastyamaheshwari22'
        },
                               {
            name: 'Vedh Krishnan',
            major: 'Data Science & Computer Science',
            graduation: 'May 2030',
            headshot: 'headshots/vedh-krishnan.png',
            linkedin: 'https://www.linkedin.com/in/vedh-krishnan-595252436'
        },
        {
            name: 'Kevin Xie',
            major: 'Computer Science',
            graduation: 'May 2030',
            headshot: 'headshots/kevin-xie.png'
        },
        {
                          
                       name: 'Nil Zeren Dogan',
            major: 'Computer Engineering',
            affiliation: 'Boğaziçi University · Non-degree Exchange Student at UNC',
            graduation: '2029',
            headshot: 'headshots/nil-dogan.png',
            linkedin: 'https://www.linkedin.com/in/nilzerendogan/'
        },
        {
            name: 'Jesvitha Maria Jayakaran',
            major: 'Biomedical Engineering',
            graduation: 'May 2030',
            headshot: 'headshots/jesvitha-jayakaran.png',
            linkedin: 'https://www.linkedin.com/in/jesvitha-jayakaran-0b554a27b'
        },
                       {
            name: 'Avery Yurui Yang',
            major: 'Mathematics',
            graduation: 'May 2030',
            headshot: 'headshots/avery-yang.png',
            linkedin: 'https://www.linkedin.com/in/avery-yang-561625397/'
        },
        {
            name: 'Samantha Chang',
            major: 'Computer Science',
            graduation: 'May 2027',
            headshot: 'headshots/samantha-chang.png',
            linkedin: 'https://www.linkedin.com/in/samantha-chang-2bb947348/'
        },
               {
            name: 'Muhammad Zain Zeeshan Malik',
            major: 'Computer Science and Economics',
            graduation: 'May 2028',
            headshot: 'headshots/muhammad-malik.png',
            linkedin: 'https://www.linkedin.com/in/mzzmalik/'
        },
              {
            name: 'Avneesh Nikhil Tamhankar',
            major: 'Computer Science & Data Science',
            graduation: 'May 2029',
            headshot: 'headshots/nikhil-tamhankar.png',
            linkedin: 'https://www.linkedin.com/in/avneesh-tamhankar/'
        },
               {
            name: 'Jason Robert Gergler Jr.',
            major: 'Biomedical Engineering',
            graduation: 'May 2027',
            linkedin: 'https://www.linkedin.com/in/jason-gergler-359203183'
        },
        {
            name: 'Brandon Ge',
            major: 'Computer Science and Data Science',
            graduation: 'May 2028',
            headshot: 'headshots/brandon-ge.png',
            linkedin: 'https://www.linkedin.com/in/brandonyge/'
        }
       ];

    const highSchoolInterns = [
               {
            name: 'Griffin Schultz',
            role: 'High School Research Intern',
            graduation: 'June 2027',
            headshot: 'headshots/griffin-schultz.png'
        },
        {
            name: 'Prisha Maheshwary',
            role: 'High School Research Intern',
            graduation: '2029',
            headshot: 'headshots/prisha-maheshwary.png',
            linkedin: 'https://www.linkedin.com/in/prisha-maheshwary/'
        }
    ];

       const projectCatalog = {
        redirectedWalking: 'Boundary-Aware Redirected Walking in Virtual Reality',
        magnetohydrodynamic: 'Magnetohydrodynamic Drive',
        handTracking: 'Hand-Position Tracking Glove',
        spot: 'PAWS: SPOT Assistive Navigation Robot',
        swimmerHand: 'Finger-Position Optimization for Swimming',
        fishCar: 'Biologically Driven Autonomous Vehicle Research',
        mantaRay: 'Acoustic Communication for an Underwater Manta Ray Robot Swarm',
        modularWebAR: 'Modular WebAR Experiences',
        motorcycleAR: 'Mixed-Reality Motorcycle Assembly Training',
        brooksVR: 'Recreating Fred Brooks’s Office in Virtual Reality',
        wavemaker: '30-Channel Wavemaker Control Interface',
        icePIV: 'Remote PIV System for Measuring Iceberg Melt',
        openCTD: 'Low-Cost CTD Sensors for Oceanography',
        hologram: 'Floating Holographic Display',
        immersive360AI: 'Generative AI for Immersive 360° Environments',
                   aiResearchDiscovery: 'AI Research Discovery Platform',
        dorsiflexion: 'Dorsiflexion and Corticomuscular Coherence Measurement System',
        nepalModel: 'Scalable 3D Environment Optimization',
        eelWebsite: 'EEL Website Development',
        augmentedAurality: 'Augmented Aurality',
                heritageExplorer: 'Interactive 3D Heritage Explorer',
        reliable3D: 'Reliable 3D Reconstruction with Radiance Fields',
        floodLens: 'FloodLens',
                             rcVehicleDynamics: 'RC Vehicle Dynamics',
        ocularScreening: 'Ocular Response Impairment Screening',
              courtLineCalling: 'Multi-Camera Court Line Calling System',
        rampa: 'RAMPA: Robotic Augmented Reality for Machine Programming by Demonstration',
              virtualChemistry: 'Virtual Chemistry Lab',
        carBuffingHeatmap: 'Heatmapping Car Buffing'
    };

    const projectPosters = {
        redirectedWalking: 'images/NepalVR.pdf',
        magnetohydrodynamic: 'images/Magnetohydrodynamic.pdf',
        handTracking: 'images/HandTracking.pdf',
        spot: 'images/SPOT.pdf',
        swimmerHand: 'images/SwimmerHand.pdf',
        fishCar: 'images/AutonomousVehicle.pdf',
        mantaRay: 'images/MantaRay.pdf',
        modularWebAR: 'images/ModularWebAR.pdf',
        motorcycleAR: 'images/MotorcycleAR.pdf',
        brooksVR: 'images/BrooksVR.pdf',
        augmentedAurality: 'images/AugmentedAurality.pdf',
        reliable3D: 'images/NepalModels.pdf'
    };

    const memberProjects = {
        'Markandeya Yalamanchi': [
            { key: 'redirectedWalking', poster: true }
        ],
        'Tate Semone': [
            { key: 'magnetohydrodynamic', poster: true }
        ],
        'Sofia Morais': [
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'Elyssa Snively': [
            { key: 'spot', poster: true }
        ],
        'Ishi Varshney': [
            { key: 'spot', poster: true },
            { key: 'immersive360AI' }
        ],
        'Alexa Tinajero': [
            { key: 'spot', poster: true }
        ],
               'Lily Foo': [
            { key: 'swimmerHand', poster: true },
            { key: 'rcVehicleDynamics' }
        ],
                'Riley Goodwin': [
            { key: 'fishCar', poster: true },
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' },
            { key: 'ocularScreening' }
        ],
        'Ethan DeRosa': [
            { key: 'fishCar', poster: true }
        ],
        'Coleman Stephens': [
            { key: 'spot', poster: true }
        ],
        'Mihika Tyagi': [
            { key: 'redirectedWalking', poster: true },
            { key: 'immersive360AI' }
        ],
        'Siera Gashi': [
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'William Keffer': [
            { key: 'eelWebsite' }
        ],
        'Alexander Yevchenko': [
            { key: 'handTracking', poster: true },
            { key: 'dorsiflexion' }
        ],
        'Darwin Lemus': [
            { key: 'modularWebAR', poster: true }
        ],
        'Toluwani Ilesanmi': [
            { key: 'mantaRay', poster: true }
        ],
        'David Majernik': [
            { key: 'redirectedWalking', poster: true }
        ],
        'Matthew Czar': [
            { key: 'swimmerHand', poster: true }
        ],
        'Noah Butler': [
            { key: 'motorcycleAR', poster: true },
            { key: 'redirectedWalking', poster: true }
        ],
        'Matias Magallanes': [
            { key: 'fishCar', poster: true }
        ],
        'Sanskriti Negi': [
            { key: 'mantaRay', poster: true },
            { key: 'icePIV' }
        ],
       
                'Matthew Rastovski': [
            { key: 'fishCar', poster: true },
            { key: 'openCTD' }
        ],
        'Adrian Hito': [
            { key: 'wavemaker' }
        ],
        'Adam Qaimari': [
            { key: 'fishCar' },
            { key: 'dorsiflexion' }
        ],
        'Alex Salinas': [
            { key: 'hologram' },
            { key: 'brooksVR', poster: true }
        ],
        'Alexander Caza': [
            { key: 'wavemaker' }
        ],
               'Allen Solomon': [
            { key: 'hologram' },
            { key: 'brooksVR', poster: true }
        ],
               'Brandon Ge': [
            { key: 'immersive360AI' }
        ],
        'Jason Robert Gergler Jr.': [
            { key: 'fishCar' }
        ],
                'Joseph Sabo': [
            { key: 'fishCar', poster: true },
            { key: 'ocularScreening' }
        ],
                'Karthik Dundigalla': [
            { key: 'floodLens' }
        ],
        'Lillian Gann': [
            { key: 'icePIV' }
        ],
               'Luke Hyatt': [
            { key: 'spot', poster: true },
            { key: 'nepalModel' }
        ],
                              'Nichola Wells': [
            { key: 'rcVehicleDynamics' }
        ],
        'Agastya Maheshwari': [
            { key: 'courtLineCalling' }
        ],
               'Vedh Krishnan': [
            { key: 'courtLineCalling' }
        ],
        'Kevin Xie': [
            { key: 'courtLineCalling' }
        ],
                'Nil Zeren Dogan': [
            { key: 'rampa' }
        ],
               'Jesvitha Maria Jayakaran': [
            { key: 'virtualChemistry' }
        ],
        'Avery Yurui Yang': [
            { key: 'augmentedAurality' }
        ],
        'Samantha Chang': [
            { key: 'heritageExplorer' }
        ],
                'Muhammad Zain Zeeshan Malik': [
            { key: 'aiResearchDiscovery' }
        ],
                'Avneesh Nikhil Tamhankar': [
            { key: 'aiResearchDiscovery' }
        ],
               'Griffin Schultz': [
            { key: 'carBuffingHeatmap' }
        ],
        'Prisha Maheshwary': [
            { key: 'virtualChemistry' }
        ],
        'Andy Choe': [
            { key: 'augmentedAurality', poster: true }
        ],
        'Meghan Parker': [
            { key: 'augmentedAurality', poster: true }
        ],
        'Fletcher Stuart': [
                       {
                key: 'heritageExplorer',
                resourceUrl: 'https://swayambhu-stories.vercel.app/',
                resourceText: 'View Online Presentation'
            }
        ],
        'Ethan Hernandez': [
            { key: 'brooksVR', poster: true }
        ],
        'Ansh Aryan': [
            { key: 'reliable3D', poster: true }
        ]
    };

    function renderMemberProjects(name) {
        const assignments = memberProjects[name];

        if (!assignments || assignments.length === 0) return '';

        const output = [
            '<div class="member-projects">',
            '<p class="person-role">Projects</p>'
        ];

        assignments.forEach(function(assignment) {
            const title = projectCatalog[assignment.key];

            if (!title) return;

            output.push(
                '<div class="member-project-entry">',
                '<p class="person-bio">', title, '</p>'
            );

            if (assignment.poster && projectPosters[assignment.key]) {
                output.push(
                    '<a class="research-link" href="',
                    projectPosters[assignment.key],
                    '" target="_blank" rel="noopener noreferrer">',
                    '2026 Celebration of Undergraduate Research Poster',
                    '</a>'
                );
            }
            if (assignment.resourceUrl) {
                output.push(
                    '<a class="research-link" href="',
                    assignment.resourceUrl,
                    '" target="_blank" rel="noopener noreferrer">',
                    assignment.resourceText || 'View Project Resource',
                    '</a>'
                );
            }
            output.push('</div>');
        });

        output.push('</div>');
        return output.join('');
    }

    const alumni = [
        {
            name: 'Andy Choe',
            major: 'Biomedical Engineering',
            graduation: 'May 2026',
            project: 'Augmented Aurality',
            headshot: 'headshots/andy-choe.jpg',
            linkedin: 'https://www.linkedin.com/in/seungchoe'
        },
        {
            name: 'Meghan Parker',
            major: 'Biomedical Engineering',
            graduation: 'May 2026',
            project: 'Augmented Aurality',
            headshot: 'headshots/meghan-parker.jpg',
            linkedin: 'https://www.linkedin.com/in/meghan-parker-2746ba303'
        },
        {
            name: 'Fletcher Stuart',
            major: 'Computer Science',
            graduation: 'May 2026',
            project: '',
            headshot: 'headshots/fletcher-stuart.jpg',
            linkedin: 'https://www.linkedin.com/in/fletcher-stuart-931695126'
        },
        {
            name: 'Ethan Hernandez',
            major: 'Computer Science',
            graduation: 'May 2026',
            project: 'Recreating Fred Brooks’s Office in Virtual Reality',
            headshot: 'headshots/ethan-hernandez.jpg',
            linkedin: 'https://www.linkedin.com/in/ethan-hernandez-3aa509236'
        },
        {
            name: 'Ansh Aryan',
            major: 'Computer Science',
            graduation: 'May 2026',
            project: 'Reliable 3D Reconstruction with Radiance Fields',
            headshot: 'headshots/ansh-aryan.jpeg',
            linkedin: 'https://www.linkedin.com/in/ansh-aryan03'
        }
    ];

       const collaboratingAreas = [
        {
            name: 'Computer Science',
            url: 'https://cs.unc.edu/'
        },
        {
            name: 'Applied Mathematics',
            url: 'https://amath.unc.edu/'
        },
        {
            name: 'Exercise and Sport Science',
            url: 'https://exss.unc.edu/'
        },
        {
            name: 'Earth, Marine and Environmental Sciences',
            url: 'https://emes.unc.edu/'
        },
        {
            name: 'Physical Therapy',
            url: 'https://www.med.unc.edu/healthsciences/physical/'
        },
        {
            name: 'Religious Studies',
            url: 'https://religion.unc.edu/'
        }
    ];

   
 

    alumni.sort(function(a, b) {
        return a.name
            .split(' ')
            .pop()
            .toLowerCase()
            .localeCompare(
                b.name.split(' ').pop().toLowerCase()
            );
    });

    const parts = [];

    parts.push(
        '<h1 class="expanded-title">Members &amp; Collaborators</h1>',
        '<div class="people-section">',
        '<h2 class="people-section-title">Lab Director</h2>',
        '<div class="people-grid director-grid">',
        '<div class="person-card director-card">',
        '<img class="person-image person-headshot" ',
        'src="headshots/Jim_Mahaney_Headshot.jpg" ',
        'alt="Jim Mahaney" loading="lazy" decoding="async">',
        '<h3 class="person-name">', labDirector.name, '</h3>',
        '<p class="person-role">', labDirector.role, '</p>',
               '<p class="person-bio director-bio">',
        '<strong>Jim Mahaney is the Director of Engineering and Research ',
        'for the Department of Computer Science at the University of ',
        'North Carolina at Chapel Hill.</strong> Since first joining ',
        'Carolina as a student assistant in 1997, he has designed and ',
        'fabricated experimental systems across areas including robotics ',
        'and medical devices, augmented and virtual reality, sensing ',
        'technologies, fluid dynamics, and large-scale 3D capture and ',
        'reconstruction. He later returned to lead the facility, bringing ',
        'his career at Carolina full circle. ',
        'In fall 2025, he launched the EEL’s undergraduate research ',
        'program, creating opportunities that combine faculty ',
        'collaborations, student-led research, specialized technical ',
        'training, and credit-bearing courses. His experience across these ',
        'fields allows him to support the wide range of projects and ',
        'student interests found in the EEL. His current work focuses ',
        'on hands-on engineering education and helping undergraduate ',
        'research engineers develop practical skills in electronics, machining, ',
        'welding, fabrication, and rapid prototyping while building ',
        'systems for active research projects.',
        '</p>',
        '<a class="research-link" href="https://research.unc.edu/2025/09/03/rooted-jim-mahaney/" target="_blank" rel="noopener noreferrer">Read the UNC Research profile, “Rooted: Jim Mahaney”</a>',
        '</div>',
        '</div>',
        '</div>'
    );

    parts.push(
        '<div class="people-section">',
        '<h2 class="people-section-title">',
       'Current Undergraduate Research Engineers',
        '</h2>',
        '<div class="people-grid featured-grid current-researchers-grid">'
    );

          const currentMembers = featuredMembers
        .concat(otherMembers)
        .sort(function(a, b) {
            const aHasHeadshot = Boolean(a.headshot);
            const bHasHeadshot = Boolean(b.headshot);

            // Students with headshots always come first.
            if (aHasHeadshot !== bHasHeadshot) {
                return aHasHeadshot ? -1 : 1;
            }

            // Within each group, alphabetize by last name.
            const aParts = a.name.trim().split(/\s+/);
            const bParts = b.name.trim().split(/\s+/);
            const aLast = aParts[aParts.length - 1];
            const bLast = bParts[bParts.length - 1];

            const lastNameComparison = aLast.localeCompare(bLast);

            if (lastNameComparison !== 0) {
                return lastNameComparison;
            }

            // Tie-breaker if two people have the same last name.
            return a.name.localeCompare(b.name);
        });
             const majorAliases = {
        'Math': 'Mathematics',
        'Business': 'Business Administration',
        'Statistics': 'Statistics and Analytics',
        'Biochemistry': 'Chemistry – Biochemistry Track',
        'Applied Mathematics': 'Mathematics – Applied Option',
        'Engineering Physics': 'Physics – Engineering Physics Option',
        'Chemistry with a Focus in Analytical Chemistry': 'Chemistry',
        'Applied Sciences with Track in Materials Engineering': 'APS – Materials Engineering Track'
    };
    const majorCounts = {};

    currentMembers.forEach(function(member) {
        if (!member.major) return;

        member.major
            .split(/\s*(?:,|&|\band\b)\s*/i)
            .map(function(major) {
                return major.trim();
            })
            .filter(Boolean)
            .forEach(function(major) {
                const normalizedMajor = majorAliases[major] || major;

                majorCounts[normalizedMajor] =
                    (majorCounts[normalizedMajor] || 0) + 1;
            });
    });

    EELStats.studentCount = currentMembers.length;
    EELStats.collaboratorCount = collaboratingAreas.length;

       EELStats.majorCounts = Object.entries(majorCounts).sort(function(a, b) {
        return a[0].localeCompare(b[0]);
    });
    for (let i = 0; i < currentMembers.length; i++) {
        const member = currentMembers[i];

        parts.push('<div class="person-card featured-card">');

        if (member.headshot) {
            parts.push(
                '<img class="person-image person-headshot" src="',
                member.headshot,
                '" alt="',
                member.name,
                '" loading="lazy" decoding="async">'
            );
        } else {
            const initials = member.name
                .split(' ')
                .map(function(namePart) {
                    return namePart[0];
                })
                .join('');

            parts.push(
                '<div class="person-image placeholder-image" aria-hidden="true">',
                '<span>', initials, '</span>',
                '</div>'
            );
        }

        parts.push(
            '<div class="person-name-row">',
            '<h3 class="person-name">', member.name, '</h3>',
            linkedinLink(member.linkedin),
            '</div>'
        );

        if (member.major) {
            parts.push(
                '<p class="person-details">',
                member.major
            );

            if (member.graduation) {
                parts.push(
                    ' · ',
                    getStudentStatus(member.graduation, member.status)
                );
            }

            parts.push('</p>');
        } else {
            parts.push('<p class="person-role">Research Team</p>');
        }

                    if (member.affiliation) {
            parts.push(
                '<p class="person-graduation">',
                member.affiliation,
                '</p>'
            );
        }

        if (member.graduation) {
            parts.push(
                '<p class="person-graduation">',
                'Expected Graduation: ',
                member.graduation,
                '</p>'
            );
        }

       
        parts.push(
            accoladeBadge(member.name),
            foundingBadge(member.name),
            renderMemberProjects(member.name),
            '</div>'
        );
    }
                                      parts.push('</div>', '</div>');

    parts.push(
        '<div class="people-section">',
        '<h2 class="people-section-title">High School Research Interns</h2>',
        '<p class="people-section-intro">',
        'High school students contributing to active EEL research and engineering projects.',
        '</p>',
        '<div class="people-grid featured-grid">'
    );

    for (let i = 0; i < highSchoolInterns.length; i++) {
        const intern = highSchoolInterns[i];

        parts.push('<div class="person-card featured-card">');

        if (intern.headshot) {
            parts.push(
                '<img class="person-image person-headshot" src="',
                intern.headshot,
                '" alt="',
                intern.name,
                '" loading="lazy" decoding="async">'
            );
        } else {
            const initials = intern.name
                .split(' ')
                .map(function(namePart) {
                    return namePart[0];
                })
                .join('');

            parts.push(
                '<div class="person-image placeholder-image" aria-hidden="true">',
                '<span>', initials, '</span>',
                '</div>'
            );
        }

        parts.push(
            '<div class="person-name-row">',
            '<h3 class="person-name">', intern.name, '</h3>',
            linkedinLink(intern.linkedin),
            '</div>',
            '<p class="person-role">', intern.role, '</p>'
        );

        if (intern.graduation) {
            parts.push(
                '<p class="person-graduation">',
                'High School Graduation: ',
                intern.graduation,
                '</p>'
            );
        }

        parts.push(
            renderMemberProjects(intern.name),
            '</div>'
        );
    }

    parts.push('</div>', '</div>');

    parts.push(
        '<div class="people-section collaborators-section">',
        '<h2 class="people-section-title">',
        'Collaborating Academic Areas',
        '</h2>',
        '<div class="collaborator-grid">'
    );

    for (let i = 0; i < collaboratingAreas.length; i++) {
        const area = collaboratingAreas[i];

        parts.push(
            '<a class="person-card collaborator-card" href="',
            area.url,
            '" target="_blank" rel="noopener noreferrer">',
            '<h3 class="person-name">', area.name, '</h3>',
            '<span class="collaborator-link-label">',
            'Visit department website ',
            '<span aria-hidden="true">↗</span>',
            '</span>',
            '</a>'
        );
    }

    parts.push('</div>', '</div>');

    parts.push(
        '<div class="people-section">',
        '<h2 class="people-section-title">EEL Alumni</h2>',
        '<p class="people-section-intro">',
       'Recognizing former undergraduate research engineers who contributed to the ',
        'EEL and graduated from UNC-Chapel Hill.',
        '</p>',
        '<div class="people-grid featured-grid alumni-grid">'
    );

    for (let i = 0; i < alumni.length; i++) {
        const member = alumni[i];

        parts.push(
            '<div class="person-card featured-card alumni-card">',
            '<img class="person-image person-headshot" src="',
            member.headshot,
            '" alt="',
            member.name,
            '" loading="lazy" decoding="async">',
            '<div class="person-name-row">',
            '<h3 class="person-name">', member.name, '</h3>',
            linkedinLink(member.linkedin),
            '</div>',
            '<p class="person-details">',
            member.major,
            '</p>',
            '<p class="person-graduation">',
            'Graduated: ',
            member.graduation,
            '</p>',
            foundingBadge(member.name),
            renderMemberProjects(member.name),
            '</div>'
        );
    }

    parts.push('</div>', '</div>');

    return parts.join('');
}
           

function getAboutContent() {
    if (!_contentCache.projects) {
        _contentCache.projects = getProjectsContent();
    }

    if (!_contentCache.people) {
        _contentCache.people = getPeopleContent();
    }

    const majorList = EELStats.majorCounts.map(function(item) {
        return '<li><strong>' + item[0] + ':</strong> ' + item[1] + '</li>';
    }).join('');

    return `
               <h1 class="expanded-title">EEL at a Glance</h1>
        <div class="content-section">
            <p class="about-text">The Experimental Engineering Lab sits at the intersection of engineering and undergraduate research. Students build equipment for faculty research, develop their own prototypes, and learn to work through the unknowns that make research different from a classroom assignment. Based in UNC’s Department of Computer Science, the lab brings together students and researchers from across campus.</p>
            <p class="about-text" style="text-align: center; margin: 40px 0;">
                <em>“I want to use research to impact students, not use students to impact my research.”</em>
                <span style="display: block; margin-top: 12px;">— Jim Mahaney</span>
            </p>
            <div class="about-stats">
                <div class="about-stat">
                    <strong class="about-stat-number">${EELStats.studentCount}</strong>
                   <span class="about-stat-label">Current Undergraduate Research Engineers</span>
                </div>
                <div class="about-stat">
                    <strong class="about-stat-number">${EELStats.projectCount}</strong>
                    <span class="about-stat-label">Current and Developing Projects</span>
                </div>
                <div class="about-stat">
                    <strong class="about-stat-number">${EELStats.collaboratorCount}</strong>
                    <span class="about-stat-label">Collaborating Academic Areas</span>
                </div>
            </div>

             <h2 class="section-title" style="text-align: center;">Student Majors</h2>
                      <p class="about-text" style="text-align: center;">EEL undergraduate research engineers represent a broad range of academic programs across Carolina.</p>
                                                           <ul class="requirements-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); column-gap: 80px; max-width: 760px; margin: 0 auto; padding-left: 0; text-align: left;">
                ${majorList}
            </ul>

            <div class="research-entry-media" style="max-width:1200px; margin:28px auto 42px;">
                             <img src="images/CarDemo.webp" alt="Students demonstrating an autonomous vehicle project to visitors during an EEL open house" width="1600" height="1000" loading="lazy" decoding="async">
            </div>
            <h2 class="section-title">Research Engineering for Carolina</h2>
            <p class="about-text">The Experimental Engineering Lab provides the engineering expertise, facilities, and technical support needed to turn research ideas into working systems. Based in the Department of Computer Science at UNC-Chapel Hill, the EEL works with faculty and students across campus to design, fabricate, integrate, and test specialized equipment and experimental systems that often cannot be purchased off the shelf.</p>
            <p class="about-text">The lab brings together hardware, software, fabrication, and experimental design in one facility. This allows projects to move quickly from an initial concept to a system that can be tested and used in actual research. It also makes specialized equipment and technical expertise available across projects and departments, extending the value of resources that already exist at Carolina.</p>

            <h2 class="section-title">Undergraduate Research and Engineering Education</h2>
            <p class="about-text">In fall 2025, under the direction of Jim Mahaney, Director of Engineering and Research, the Applied Engineering Lab was renamed the Experimental Engineering Lab and its mission was expanded to include a structured undergraduate research and engineering-training program. By the end of its first two semesters, the program had grown from an idea into a community of 35 undergraduate research engineers working across 14 active projects. It now supports ${EELStats.projectCount} current and developing research projects.</p>
            <p class="about-text">Students in the EEL do more than observe research or perform routine laboratory tasks. They help define problems, design components, fabricate parts, develop software, integrate systems, collect data, troubleshoot failures, and present their results. Some projects begin with the needs of faculty researchers, while others originate with students who bring their own ideas to the lab.</p>
            <p class="about-text">This approach gives students experience with the complete process of research engineering: moving from a question or idea to a working system, testing it, learning from what fails, and improving the design. Along the way, students develop practical skills in machining, welding, electronics, rapid prototyping, robotics, sensing, programming, 3D modeling, and immersive technologies.</p>
            <p class="about-text">Research opportunities are complemented by credit-bearing courses and independent studies, allowing students to develop technical skills while contributing to active research. These experiences help prepare students for careers, graduate study, entrepreneurship, and future work in laboratories where progress depends on being able to build something that has never existed before.</p>
            <div class="research-entry-media" style="max-width:1200px; margin:28px auto 42px;">
                              <img src="images/GloveDemo.webp" alt="EEL students demonstrating a hand-position tracking glove during an open house" width="1600" height="1000" loading="lazy" decoding="async">
            </div>
            <h2 class="section-title">Collaboration Across Carolina</h2>
            <p class="about-text">The EEL currently supports work involving Computer Science, Applied Mathematics, Earth, Marine and Environmental Sciences, Exercise and Sport Science, Physical Therapy, and Religious Studies.</p>
            <p class="about-text">These collaborations span robotics, accessibility, human movement, rehabilitation, fluid dynamics, environmental sensing, artificial intelligence, virtual and augmented reality, and the documentation and interpretation of cultural sites. By bringing students and researchers from different fields together around a shared problem, the EEL helps create connections that might not develop within the boundaries of a single department.</p>
            <p class="about-text">The lab’s work with Religious Studies is a particularly strong example of this approach. Fieldwork in Nepal has produced detailed 3D records of Buddhist sites, while EEL students have helped develop the models, virtual environments, and redirected-walking technology needed to use that research in immersive educational settings. The collaboration brings together humanities scholarship, computer science, engineering, cultural documentation, and new approaches to teaching.</p>
            <div class="research-entry-media" style="max-width:1200px; margin:28px auto 42px;">
                               <img src="images/VR.webp" alt="An EEL student guiding a visitor through a virtual reality demonstration" width="1600" height="1000" loading="lazy" decoding="async">
                        </div>

            <h2 class="section-title">Follow the EEL</h2>
            <p class="about-text">Follow the Experimental Engineering Lab on Instagram for project updates, student work, and life in the lab.</p>
            <a class="research-link" href="https://www.instagram.com/experimentalengineeringlab/" target="_blank" rel="noopener noreferrer">Follow @experimentalengineeringlab on Instagram</a>

                        <h2 class="section-title">In the News</h2>
            <p class="about-text"><strong>The Well</strong> | October 20, 2026</p>
            <p class="about-text"><em>These students solve research problems with their hands</em></p>
            <p class="about-text">UNC-Chapel Hill features COMP 290 and the EEL, where students learn machining, welding, and fabrication while building equipment for research across campus.</p>
            <a class="research-link" href="https://www.unc.edu/posts/2026/10/20/these-students-solve-research-problems-with-their-hands/" target="_blank" rel="noopener noreferrer">Read the UNC-Chapel Hill article</a>

                       <p class="about-text" style="margin-top: 40px;"><strong>The Daily Tar Heel</strong> | September 9, 2026</p>
            <p class="about-text"><em>Religious studies class transports students to Nepal through virtual reality</em></p>
            <p class="about-text">The Daily Tar Heel looks at how 3D models and virtual reality developed through the EEL are being used in RELI 283 to bring field research from Nepal into the classroom.</p>
            <a class="research-link" href="https://dailytarheel.com/480769/lifestyle/religious-studies-class-transports-students-to-nepal-through-virtual-reality/" target="_blank" rel="noopener noreferrer">Read the Daily Tar Heel article</a>
            <h2 class="section-title">Facilities and Technical Capabilities</h2>
            <p class="about-text">The EEL continues a long tradition of maintaining the ability to design and build specialized research systems within Computer Science. Its facilities include an electronics laboratory, machine shop, rapid-fabrication space, wet lab, and shielded room.</p>
            <p class="about-text">Current capabilities include:</p>
            <ul class="requirements-list">
                <li>Precision machining and metal fabrication</li>
                <li>Welding</li>
                <li>Electronics design and assembly</li>
                <li>Rapid prototyping and 3D printing</li>
                <li>Robotics and autonomous systems</li>
                <li>Sensors and experimental instrumentation</li>
                <li>Virtual and augmented reality</li>
                <li>Redirected walking and immersive simulation</li>
                <li>Large-scale 3D capture and reconstruction</li>
                <li>Custom research-system design and integration</li>
            </ul>
            <p class="about-text">Bringing these capabilities together allows researchers and students to develop complete experimental systems on site rather than distributing the work among unrelated facilities or relying entirely on commercial equipment.</p>
            <div class="research-entry-media" style="max-width:1200px; margin:28px auto 42px;">
                              <img src="images/Soldering.webp" alt="An EEL student assembling electronics at a laboratory workbench" width="1600" height="1000" loading="lazy" decoding="async">
            </div>
            <h2 class="section-title">Four Decades of Research Engineering</h2>
            <p class="about-text">The EEL continues a four-decade tradition of building innovative research systems within UNC Computer Science. The facility traces its origins to the Microelectronics Systems Laboratory, established in the 1980s to support research requiring specialized computing hardware.</p>
            <p class="about-text">Among the best-known systems developed through this tradition were the Pixel-Planes and PixelFlow graphics engines. These were among the fastest real-time rendering systems of their era and were widely recognized for their innovative, massively parallel architectures. Their designs explored concepts such as per-pixel processing and scalable rendering pipelines that later became central to modern graphics processors.</p>
            <p class="about-text">More recently, the facility was known as the Applied Engineering Lab. In the fall of 2025, Mahaney renamed it the Experimental Engineering Lab to reflect its expanded mission in undergraduate research, hands-on engineering education, and collaboration across campus. The new name also recognizes the lab’s continuing role in designing and building the experimental systems needed to support research at Carolina.</p>
            <p class="about-text">The technology has changed, but the underlying purpose of the lab remains the same: important research often requires the ability to engineer and build new systems in-house. Today, the EEL combines that research-engineering tradition with a growing undergraduate program, giving a new generation of students the opportunity to participate directly in creating the tools and technologies that make discovery possible.</p>

            <h2 class="section-title">Building a Sustainable Campus Resource</h2>
            <p class="about-text">The EEL’s growth demonstrates what can be accomplished by combining existing University facilities with experienced research-engineering leadership, undergraduate talent, faculty collaboration, and outside support.</p>
            <p class="about-text">Fundraising has already provided additional resources for student research and lab development. As the program grows, the EEL will continue expanding collaborations across Carolina while maintaining the close technical mentoring, practical training, and project support that make its work effective.</p>
            <p class="about-text">The goal is not simply to complete more projects. It is to create a sustainable research-engineering resource that helps faculty pursue ambitious ideas, gives students meaningful roles in discovery, and strengthens the connections among research, teaching, engineering, and the liberal arts at Carolina.</p>
        </div>
    `;
}

function getJoinContent() {
    return `
        <h1 class="expanded-title">Get Involved</h1>
        <div class="content-section">
            <div class="join-poster">
                <img src="images/jointhelab.png" alt="Experimental Engineering Lab" class="join-poster-img" loading="lazy" decoding="async">
            </div>

            <div class="get-involved-options">
                <div class="get-involved-column">
                    <h2 class="get-involved-title">Join</h2>
                    <p class="get-involved-description">
                        UNC students can contribute directly to active EEL research and engineering projects while developing practical technical and research skills.
                    </p>
                    <a href="application.html" class="apply-now-btn">
                        <span class="btn-text">JOIN</span>
                        <span class="btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </span>
                    </a>
                </div>

                <div class="get-involved-column">
                    <h2 class="get-involved-title">Collaborate</h2>
                    <p class="get-involved-description">
                        Faculty, research groups, departments, and external partners can work with the EEL on research, prototyping, experimental systems, and undergraduate research projects.
                    </p>
                    <a href="collaboration.html" class="apply-now-btn">
                        <span class="btn-text">COLLABORATE</span>
                        <span class="btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </span>
                    </a>
                </div>

                <div class="get-involved-column">
                    <h2 class="get-involved-title">Support</h2>
                    <p class="get-involved-description">
                        Individuals and organizations can support undergraduate research, equipment, materials, student projects, and continued development of the lab.
                    </p>
                    <a href="support.html" class="apply-now-btn">
                        <span class="btn-text">SUPPORT</span>
                        <span class="btn-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </span>
                    </a>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// INTERLOCKING GEARS - Panel Icons
// ============================================
// The gear icons are drawn by the ambient engine from the same geometry
// (EELAmbient.GEAR_CONFIG / buildGearPaths): large gear, small gear, then
// the large gear's teeth clipped to the small gear so the teeth interlock.

function initPanelGearIcons() {
    AmbientHost.createGearIcons(document.querySelectorAll('.panel-icon'));
}

// ============================================
// INITIALIZATION
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        ThemeManager.init();
        AmbientHost.init();
                updateCardStats();
        initPanelGearIcons();
        radialPanelPhysics = new RadialPanelPhysics();
        startVisualRuntime();

        setTimeout(() => {
            document.querySelectorAll('.js-positioned:not(.ready)').forEach(el => el.classList.add('ready'));
        }, 2000);

    });
} else {
    ThemeManager.init();
    AmbientHost.init();
        updateCardStats();
    initPanelGearIcons();
    radialPanelPhysics = new RadialPanelPhysics();
    startVisualRuntime();
}

// Build the expanded pages ahead of time once the page has loaded.
(function() {
    const start = () => { if (!window.__EEL_TEST__) PagePrerender.scheduleIdleBuild(); };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
})();

// Release the renderer (and its GPU resources) on page unload
window.addEventListener('beforeunload', function() {
    AmbientHost.dispose();
});
