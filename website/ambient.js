/*
 * EEL ambient renderer
 * --------------------
 * Replays the site's purely decorative background animation from
 * pre-rendered sprites instead of recomputing it live every frame.
 *
 *   - Nebula:   each CSS-blurred blob is pre-rendered once into a float
 *               sprite (exact Gaussian of the original gradient disc), and
 *               the five sprites are composited into one small canvas that
 *               the compositor upscales. The blur radius is ~200px, so a
 *               coarse grid reproduces it to within rounding.
 *   - Glow:     the medallion's animated box-shadow, drawn with the same
 *               Skia shadow path the browser uses for box-shadow.
 *   - Gears:    the panel gear icons, drawn from the original SVG paths.
 *   - Drone:    the original Three.js quadcopter scene, unchanged.
 *
 * The engine has no DOM access. It runs inside a Web Worker on
 * OffscreenCanvas when the browser supports that (so none of this costs
 * main-thread time), and falls back to running on the main thread.
 */
(function(root) {
    'use strict';

    const PHI = 1.618033988749;
    const PHI_INV = 0.618033988749;

    // ------------------------------------------------------------------
    // CSS timing functions (port of Blink/WebKit UnitBezier)
    // ------------------------------------------------------------------
    function UnitBezier(p1x, p1y, p2x, p2y) {
        this.cx = 3 * p1x;
        this.bx = 3 * (p2x - p1x) - this.cx;
        this.ax = 1 - this.cx - this.bx;
        this.cy = 3 * p1y;
        this.by = 3 * (p2y - p1y) - this.cy;
        this.ay = 1 - this.cy - this.by;
    }
    UnitBezier.prototype.sampleX = function(t) { return ((this.ax * t + this.bx) * t + this.cx) * t; };
    UnitBezier.prototype.sampleY = function(t) { return ((this.ay * t + this.by) * t + this.cy) * t; };
    UnitBezier.prototype.sampleDX = function(t) { return (3 * this.ax * t + 2 * this.bx) * t + this.cx; };
    UnitBezier.prototype.solveX = function(x) {
        let t = x;
        for (let i = 0; i < 8; i++) {
            const err = this.sampleX(t) - x;
            if (Math.abs(err) < 1e-7) return t;
            const d = this.sampleDX(t);
            if (Math.abs(d) < 1e-6) break;
            t -= err / d;
        }
        let lo = 0, hi = 1;
        t = x;
        for (let i = 0; i < 64; i++) {
            const v = this.sampleX(t);
            if (Math.abs(v - x) < 1e-7) return t;
            if (x > v) lo = t; else hi = t;
            t = (lo + hi) / 2;
        }
        return t;
    };
    UnitBezier.prototype.solve = function(x) {
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        return this.sampleY(this.solveX(x));
    };

    const NAMED_EASINGS = {
        'linear': null,
        'ease': [0.25, 0.1, 0.25, 1],
        'ease-in': [0.42, 0, 1, 1],
        'ease-out': [0, 0, 0.58, 1],
        'ease-in-out': [0.42, 0, 0.58, 1]
    };

    function makeEasing(spec) {
        if (!spec) return function(x) { return x; };
        let p = NAMED_EASINGS[spec];
        if (p === undefined) {
            const m = /cubic-bezier\(([^)]+)\)/.exec(spec);
            p = m ? m[1].split(',').map(Number) : null;
        }
        if (!p) return function(x) { return x; };
        const b = new UnitBezier(p[0], p[1], p[2], p[3]);
        return function(x) { return b.solve(x); };
    }

    // ------------------------------------------------------------------
    // Keyframe sampling with CSS Animation semantics (delay 0, infinite).
    // kf: [{ offset, v: [numbers...] }] sorted by offset, all same length.
    // ------------------------------------------------------------------
    function sampleKeyframes(anim, timeMs, out) {
        const iter = timeMs / anim.duration;
        let p = iter - Math.floor(iter);
        if (anim.direction === 'reverse') p = 1 - p;
        else if (anim.direction === 'alternate' && (Math.floor(iter) & 1)) p = 1 - p;
        else if (anim.direction === 'alternate-reverse' && !(Math.floor(iter) & 1)) p = 1 - p;

        const kf = anim.keyframes;
        let i = 0;
        while (i < kf.length - 2 && p >= kf[i + 1].offset) i++;
        const a = kf[i], b = kf[i + 1];
        const span = b.offset - a.offset;
        let local = span > 0 ? (p - a.offset) / span : 0;
        local = anim.ease(local);
        for (let k = 0; k < a.v.length; k++) out[k] = a.v[k] + (b.v[k] - a.v[k]) * local;
        return out;
    }

    function prepAnim(spec) {
        return {
            duration: spec.duration,
            direction: spec.direction || 'normal',
            ease: makeEasing(spec.easing),
            keyframes: spec.keyframes
        };
    }

    // ------------------------------------------------------------------
    // NEBULA
    // ------------------------------------------------------------------
    // A blob is a circle (border-radius 50%) filled with a radial gradient,
    // blurred by `filter: blur(sigma)`, then transformed by its keyframes
    // about its centre. Sprites hold premultiplied RGBA floats (0..1).
    function buildBlobSprite(blob, hs) {
        const pad = Math.ceil(3 * blob.sigma);
        const nx = Math.ceil((blob.width + 2 * pad) / hs);
        const ny = Math.ceil((blob.height + 2 * pad) / hs);
        const n = nx * ny;
        const src = new Float32Array(n * 4);

        const g = blob.gradient;
        const gcx = g.cx * blob.width, gcy = g.cy * blob.height;
        // circle with no explicit size => farthest-corner
        const corners = [[0, 0], [blob.width, 0], [0, blob.height], [blob.width, blob.height]];
        let gr = 0;
        for (const c of corners) gr = Math.max(gr, Math.hypot(c[0] - gcx, c[1] - gcy));
        const stops = g.stops;
        const rx = blob.width / 2, ry = blob.height / 2;
        const ccx = rx, ccy = ry;

        const SS = 4;
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                let r = 0, gg = 0, b = 0, a = 0;
                for (let sy = 0; sy < SS; sy++) {
                    const y = -pad + (j + (sy + 0.5) / SS) * hs;
                    for (let sx = 0; sx < SS; sx++) {
                        const x = -pad + (i + (sx + 0.5) / SS) * hs;
                        const ex = (x - ccx) / rx, ey = (y - ccy) / ry;
                        if (ex * ex + ey * ey > 1) continue;
                        const t = Math.hypot(x - gcx, y - gcy) / gr;
                        // premultiplied stop interpolation
                        let s = 0;
                        while (s < stops.length - 1 && t > stops[s + 1].pos) s++;
                        let ca, cb, f;
                        if (t <= stops[0].pos) { ca = cb = stops[0]; f = 0; }
                        else if (s >= stops.length - 1) { ca = cb = stops[stops.length - 1]; f = 0; }
                        else {
                            ca = stops[s]; cb = stops[s + 1];
                            const span = cb.pos - ca.pos;
                            f = span > 0 ? (t - ca.pos) / span : 1;
                        }
                        const pa = ca.a + (cb.a - ca.a) * f;
                        r += ca.r * ca.a + (cb.r * cb.a - ca.r * ca.a) * f;
                        gg += ca.g * ca.a + (cb.g * cb.a - ca.g * ca.a) * f;
                        b += ca.b * ca.a + (cb.b * cb.a - ca.b * ca.a) * f;
                        a += pa;
                    }
                }
                const o = (j * nx + i) * 4;
                const inv = 1 / (SS * SS);
                src[o] = r * inv / 255; src[o + 1] = gg * inv / 255; src[o + 2] = b * inv / 255; src[o + 3] = a * inv;
            }
        }

        // separable Gaussian, sigma in texels
        const st = blob.sigma / hs;
        const rad = Math.ceil(3 * st);
        const kern = new Float32Array(2 * rad + 1);
        let ks = 0;
        for (let k = -rad; k <= rad; k++) { const w = Math.exp(-(k * k) / (2 * st * st)); kern[k + rad] = w; ks += w; }
        for (let k = 0; k < kern.length; k++) kern[k] /= ks;

        const tmp = new Float32Array(n * 4);
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                let r = 0, gg = 0, b = 0, a = 0;
                const k0 = Math.max(-rad, -i), k1 = Math.min(rad, nx - 1 - i);
                for (let k = k0; k <= k1; k++) {
                    const w = kern[k + rad], o = (j * nx + i + k) * 4;
                    r += src[o] * w; gg += src[o + 1] * w; b += src[o + 2] * w; a += src[o + 3] * w;
                }
                const o = (j * nx + i) * 4;
                tmp[o] = r; tmp[o + 1] = gg; tmp[o + 2] = b; tmp[o + 3] = a;
            }
        }
        const out = new Float32Array(n * 4);
        for (let j = 0; j < ny; j++) {
            const k0 = Math.max(-rad, -j), k1 = Math.min(rad, ny - 1 - j);
            for (let i = 0; i < nx; i++) {
                let r = 0, gg = 0, b = 0, a = 0;
                for (let k = k0; k <= k1; k++) {
                    const w = kern[k + rad], o = ((j + k) * nx + i) * 4;
                    r += tmp[o] * w; gg += tmp[o + 1] * w; b += tmp[o + 2] * w; a += tmp[o + 3] * w;
                }
                const o = (j * nx + i) * 4;
                out[o] = r; out[o + 1] = gg; out[o + 2] = b; out[o + 3] = a;
            }
        }
        return { data: out, nx: nx, ny: ny, pad: pad, hs: hs };
    }

    function NebulaRenderer(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true });
        this.blobs = [];
        this.grid = null;
        this.image = null;
        this.acc = null;
        this._kv = [0, 0, 0, 0];
    }

    NebulaRenderer.prototype.configure = function(cfg) {
        // cfg.grid: { h, cols, rows, x0, y0 } texel size (css px), canvas size, top-left texel edge (css px)
        this.grid = cfg.grid;
        if (this.canvas.width !== cfg.grid.cols) this.canvas.width = cfg.grid.cols;
        if (this.canvas.height !== cfg.grid.rows) this.canvas.height = cfg.grid.rows;
        this.image = this.ctx.createImageData(cfg.grid.cols, cfg.grid.rows);
        this.acc = new Float32Array(cfg.grid.cols * cfg.grid.rows * 4);
        const hs = cfg.spriteTexel;
        this.blobs = cfg.blobs.map(function(b) {
            return {
                spec: b,
                sprite: buildBlobSprite(b, hs),
                anim: prepAnim(b.anim),
                ox: b.left + b.width / 2,
                oy: b.top + b.height / 2
            };
        });
        this._lastKey = null;
    };

    NebulaRenderer.prototype.render = function(timeMs) {
        if (!this.grid) return;
        const g = this.grid, cols = g.cols, rows = g.rows, h = g.h;
        const acc = this.acc;
        acc.fill(0);
        const kv = this._kv;

        for (let bi = 0; bi < this.blobs.length; bi++) {
            const B = this.blobs[bi];
            const spec = B.spec, sp = B.sprite;
            sampleKeyframes(B.anim, timeMs, kv);   // [tx, ty, scale, rotDeg]
            const tx = kv[0], ty = kv[1], s = kv[2], th = kv[3] * Math.PI / 180;
            const cos = Math.cos(th), sin = Math.sin(th);
            // inverse map: p = O + R(-th) (q - O - T) / s ; sprite coords u = (p.x - left + pad)/hs - 0.5
            const ox = B.ox, oy = B.oy;
            const inv = 1 / (s * sp.hs);
            // q(i,j) = (x0 + (i + .5) h, y0 + (j + .5) h)
            const qx0 = g.x0 + 0.5 * h - ox - tx, qy0 = g.y0 + 0.5 * h - oy - ty;
            // d = R(-th) * (qx, qy) => dx = cos*qx + sin*qy ; dy = -sin*qx + cos*qy
            const baseU = (ox - spec.left + sp.pad) / sp.hs - 0.5;
            const baseV = (oy - spec.top + sp.pad) / sp.hs - 0.5;
            const duI = cos * h * inv, dvI = -sin * h * inv;
            const duJ = sin * h * inv, dvJ = cos * h * inv;
            let u0 = baseU + (cos * qx0 + sin * qy0) * inv;
            let v0 = baseV + (-sin * qx0 + cos * qy0) * inv;
            const nx = sp.nx, ny = sp.ny, d = sp.data;
            const op = spec.opacity;
            for (let j = 0; j < rows; j++) {
                let u = u0, v = v0;
                let o = j * cols * 4;
                for (let i = 0; i < cols; i++, o += 4, u += duI, v += dvI) {
                    if (u <= -1 || v <= -1 || u >= nx || v >= ny) continue;
                    const iu = Math.floor(u), iv = Math.floor(v);
                    const fu = u - iu, fv = v - iv;
                    let r = 0, gg = 0, b = 0, a = 0;
                    // bilinear with zero border
                    if (iv >= 0) {
                        if (iu >= 0) { const w = (1 - fu) * (1 - fv), k = (iv * nx + iu) * 4; r += d[k] * w; gg += d[k + 1] * w; b += d[k + 2] * w; a += d[k + 3] * w; }
                        if (iu + 1 < nx) { const w = fu * (1 - fv), k = (iv * nx + iu + 1) * 4; r += d[k] * w; gg += d[k + 1] * w; b += d[k + 2] * w; a += d[k + 3] * w; }
                    }
                    if (iv + 1 < ny) {
                        if (iu >= 0) { const w = (1 - fu) * fv, k = ((iv + 1) * nx + iu) * 4; r += d[k] * w; gg += d[k + 1] * w; b += d[k + 2] * w; a += d[k + 3] * w; }
                        if (iu + 1 < nx) { const w = fu * fv, k = ((iv + 1) * nx + iu + 1) * 4; r += d[k] * w; gg += d[k + 1] * w; b += d[k + 2] * w; a += d[k + 3] * w; }
                    }
                    if (a <= 0) continue;
                    r *= op; gg *= op; b *= op; a *= op;
                    const k1 = 1 - a;
                    acc[o] = r + acc[o] * k1;
                    acc[o + 1] = gg + acc[o + 1] * k1;
                    acc[o + 2] = b + acc[o + 2] * k1;
                    acc[o + 3] = a + acc[o + 3] * k1;
                }
                u0 += duJ; v0 += dvJ;
            }
        }

        // premultiplied float -> ImageData (straight alpha, chosen so that the
        // canvas' internal premultiplication lands on the nearest value)
        const px = this.image.data;
        for (let o = 0, n = cols * rows * 4; o < n; o += 4) {
            const a = acc[o + 3];
            const a8 = Math.round(a * 255);
            if (a8 <= 0) { px[o] = px[o + 1] = px[o + 2] = px[o + 3] = 0; continue; }
            const k = 255 * 255 / a8;
            px[o] = Math.min(255, Math.round(acc[o] * k));
            px[o + 1] = Math.min(255, Math.round(acc[o + 1] * k));
            px[o + 2] = Math.min(255, Math.round(acc[o + 2] * k));
            px[o + 3] = a8;
        }
        this.ctx.putImageData(this.image, 0, 0);
    };


    // ------------------------------------------------------------------
    // CANVAS HELPERS
    // ------------------------------------------------------------------
    function makeCanvas(w, h) {
        if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(Math.max(1, w), Math.max(1, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, w); c.height = Math.max(1, h);
        return c;
    }

    function rgbaString(c) {
        return 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + c.a + ')';
    }

    // Outer box-shadow of a circle, clipped to outside the border circle,
    // drawn with the canvas shadow path (same Skia blur as box-shadow).
    // All arguments in canvas (device) pixels.
    function drawCircleShadow(ctx, w, h, cx, cy, r, sh) {
        if (!(sh.a > 0)) return;
        const FAR = 20000;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
        ctx.clip('evenodd');
        if (!(sh.blur > 0)) {
            // Unblurred (spread-only) shadow: a plain anti-aliased fill.
            ctx.fillStyle = rgbaString(sh);
            ctx.beginPath();
            ctx.arc(cx + sh.x, cy + sh.y, Math.max(0, r + sh.spread), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            return;
        }
        ctx.shadowColor = rgbaString(sh);
        ctx.shadowBlur = sh.blur;
        ctx.shadowOffsetX = sh.x + FAR;
        ctx.shadowOffsetY = sh.y;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx - FAR, cy, Math.max(0, r + sh.spread), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ------------------------------------------------------------------
    // MEDALLION GLOW (animated box-shadow)
    // ------------------------------------------------------------------
    // cfg: { width, height (device px), cx, cy, r (device px), dpr,
    //        shadows: per keyframe list of {r,g,b,a,x,y,blur,spread} (css px),
    //        anim: { duration, easing, keyframes:[{offset, v}] } }
    function GlowRenderer(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cfg = null;
        this.visible = true;
        this._v = null;
        this._static = null;
    }

    GlowRenderer.prototype.configure = function(cfg) {
        this.cfg = cfg;
        if (this.canvas.width !== cfg.width) this.canvas.width = cfg.width;
        if (this.canvas.height !== cfg.height) this.canvas.height = cfg.height;
        this.anim = prepAnim(cfg.anim);
        this._v = new Array(cfg.anim.keyframes[0].v.length).fill(0);
        // Shadows whose values never change across keyframes are drawn once.
        const n = cfg.shadowCount;
        const kf = cfg.anim.keyframes;
        this._animated = [];
        for (let s = 0; s < n; s++) {
            let changes = false;
            for (let k = 1; k < kf.length; k++) {
                for (let j = 0; j < 8; j++) if (kf[k].v[s * 8 + j] !== kf[0].v[s * 8 + j]) changes = true;
            }
            this._animated.push(changes);
        }
        // Group consecutive static shadows (in paint order: last listed is bottom).
        this._layers = [];
        let cur = null;
        for (let s = n - 1; s >= 0; s--) {
            if (this._animated[s]) { cur = null; this._layers.push({ animated: true, index: s }); }
            else {
                if (!cur) { cur = { animated: false, list: [] }; this._layers.push(cur); }
                cur.list.push(s);
            }
        }
        // Shadows the host leaves to the browser (the static ones, painted as
        // a plain box-shadow on the glass) are not drawn here.
        if (cfg.staticByHost) this._layers = this._layers.filter(function(L) { return L.animated; });
        for (const L of this._layers) {
            if (L.animated) continue;
            L.bitmap = makeCanvas(cfg.width, cfg.height);
            const c = L.bitmap.getContext('2d');
            for (const s of L.list) drawCircleShadow(c, cfg.width, cfg.height, cfg.cx, cfg.cy, cfg.r, this.shadowAt(kf[0].v, s));
        }
        this._lastKey = null;
    };

    GlowRenderer.prototype.shadowAt = function(v, s) {
        const o = s * 8, d = this.cfg.dpr, a = v[o + 3];
        // colour components are stored premultiplied for interpolation
        return {
            r: a > 0 ? v[o] / a : 0, g: a > 0 ? v[o + 1] / a : 0, b: a > 0 ? v[o + 2] / a : 0, a: a,
            x: v[o + 4] * d, y: v[o + 5] * d, blur: v[o + 6] * d, spread: v[o + 7] * d
        };
    };

    GlowRenderer.prototype.render = function(timeMs) {
        if (!this.cfg || !this.visible) return;
        const cfg = this.cfg, ctx = this.ctx;
        const v = sampleKeyframes(this.anim, timeMs, this._v);
        const key = v.join(',');
        if (key === this._lastKey) return;
        this._lastKey = key;
        ctx.clearRect(0, 0, cfg.width, cfg.height);
        for (const L of this._layers) {
            if (L.animated) drawCircleShadow(ctx, cfg.width, cfg.height, cfg.cx, cfg.cy, cfg.r, this.shadowAt(v, L.index));
            else ctx.drawImage(L.bitmap, 0, 0);
        }
    };

    // ------------------------------------------------------------------
    // GEAR ICONS (same geometry as the original inline SVG)
    // ------------------------------------------------------------------
    const GEAR_CONFIG = (function() {
        const m = 4;
        const lgTeeth = 12, smTeeth = 10;
        const lgPitch = m * lgTeeth / 2;
        const smPitch = m * smTeeth / 2;
        const addendum = 0.75 * m;
        const dedendum = 1.25 * m;
        const centerDist = lgPitch + smPitch;
        const lgOuterR = lgPitch + addendum;
        const lgRootR = lgPitch - dedendum;
        const smOuterR = smPitch + addendum;
        const smRootR = smPitch - dedendum;
        const lgCx = 31, lgCy = 30;
        const meshAngle = Math.atan2(3, 4);
        const smCx = lgCx + centerDist * Math.cos(meshAngle);
        const smCy = lgCy + centerDist * Math.sin(meshAngle);
        const lgSector = (2 * Math.PI) / lgTeeth;
        const smSector = (2 * Math.PI) / smTeeth;
        const lgGap0 = -Math.PI / 2 + lgSector / 2;
        const lgGapIdx = Math.round((meshAngle - lgGap0) / lgSector);
        const lgPhase = meshAngle - (lgGap0 + lgGapIdx * lgSector);
        const smMesh = meshAngle + Math.PI;
        const smTooth0 = -Math.PI / 2;
        const smToothIdx = Math.round((smMesh - smTooth0) / smSector);
        const smPhase = smMesh - (smTooth0 + smToothIdx * smSector);
        const lgDur = 20;
        const smDur = lgDur * smTeeth / lgTeeth;
        return {
            lg: { cx: lgCx, cy: lgCy, outerR: lgOuterR, rootR: lgRootR, ringR: 16, holeR: 11, teeth: lgTeeth, phase: lgPhase },
            sm: { cx: smCx, cy: smCy, outerR: smOuterR, rootR: smRootR, ringR: 12, holeR: 8, teeth: smTeeth, phase: smPhase },
            lgDur: lgDur, smDur: smDur
        };
    })();

    function buildGearPaths(g) {
        const sector = (2 * Math.PI) / g.teeth;
        const rootHalf = 0.26;
        const tipHalf = 0.16;
        const pts = [];
        for (let i = 0; i < g.teeth; i++) {
            const c = i * sector - Math.PI / 2 + g.phase;
            const a1 = c - rootHalf * sector;
            const a2 = c - tipHalf * sector;
            const a3 = c + tipHalf * sector;
            const a4 = c + rootHalf * sector;
            pts.push([g.rootR * Math.cos(a1), g.rootR * Math.sin(a1)]);
            pts.push([g.outerR * Math.cos(a2), g.outerR * Math.sin(a2)]);
            pts.push([g.outerR * Math.cos(a3), g.outerR * Math.sin(a3)]);
            pts.push([g.rootR * Math.cos(a4), g.rootR * Math.sin(a4)]);
        }
        let full = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
        for (let i = 1; i < pts.length; i++) full += ' L' + pts[i][0].toFixed(2) + ',' + pts[i][1].toFixed(2);
        full += ' Z';
        full += ' M' + g.holeR.toFixed(2) + ',0';
        full += ' A' + g.holeR + ',' + g.holeR + ' 0 0 0 ' + (-g.holeR).toFixed(2) + ',0';
        full += ' A' + g.holeR + ',' + g.holeR + ' 0 0 0 ' + g.holeR.toFixed(2) + ',0 Z';
        let teeth = '';
        for (let i = 0; i < g.teeth; i++) {
            const c = i * sector - Math.PI / 2 + g.phase;
            const a1 = c - rootHalf * sector;
            const a2 = c - tipHalf * sector;
            const a3 = c + tipHalf * sector;
            const a4 = c + rootHalf * sector;
            teeth += 'M' + (g.rootR * Math.cos(a1)).toFixed(2) + ',' + (g.rootR * Math.sin(a1)).toFixed(2);
            teeth += ' L' + (g.outerR * Math.cos(a2)).toFixed(2) + ',' + (g.outerR * Math.sin(a2)).toFixed(2);
            teeth += ' L' + (g.outerR * Math.cos(a3)).toFixed(2) + ',' + (g.outerR * Math.sin(a3)).toFixed(2);
            teeth += ' L' + (g.rootR * Math.cos(a4)).toFixed(2) + ',' + (g.rootR * Math.sin(a4)).toFixed(2);
            teeth += ' Z ';
        }
        return { full: full, teeth: teeth.trim() };
    }

    function gearViewBox() {
        const sm = GEAR_CONFIG.sm;
        return { w: Math.ceil(sm.cx + sm.outerR + 3), h: Math.ceil(sm.cy + sm.outerR + 3) };
    }

    // cfg: { icons: [{ width, height (device px), cssW, cssH, dpr }] }
    function GearRenderer(canvases) {
        this.canvases = canvases;
        this.ctxs = canvases.map(function(c) { return c.getContext('2d'); });
        this.cfg = null;
        this.frameSkip = 0;
        this.lastKey = null;
        const lg = buildGearPaths(GEAR_CONFIG.lg), sm = buildGearPaths(GEAR_CONFIG.sm);
        this.paths = {
            lgFull: new Path2D(lg.full), lgTeeth: new Path2D(lg.teeth), smFull: new Path2D(sm.full)
        };
    }

    GearRenderer.prototype.configure = function(cfg) {
        this.cfg = cfg;
        for (let i = 0; i < this.canvases.length && i < cfg.icons.length; i++) {
            const ic = cfg.icons[i], c = this.canvases[i];
            if (c.width !== ic.width) c.width = ic.width;
            if (c.height !== ic.height) c.height = ic.height;
        }
        this.lastKey = null;
        if (this.lastAngles) this.draw(this.lastAngles[0], this.lastAngles[1]);
    };

    // Mirrors updatePanelGears(): integer-degree angles, refreshed every
    // third animation frame.
    GearRenderer.prototype.tick = function(timeMs) {
        this.frameSkip++;
        if (this.frameSkip % 3 !== 0) return;
        const t = timeMs / 1000;
        const lgAngle = ((t / GEAR_CONFIG.lgDur) * 360) | 0;
        const smAngle = (-(t / GEAR_CONFIG.smDur) * 360) | 0;
        this.draw(lgAngle, smAngle);
    };

    GearRenderer.prototype.draw = function(lgAngle, smAngle) {
        this.lastAngles = [lgAngle, smAngle];
        if (!this.cfg) return;
        const key = lgAngle + ':' + smAngle;
        if (key === this.lastKey) return;
        this.lastKey = key;
        const lg = GEAR_CONFIG.lg, sm = GEAR_CONFIG.sm, vb = gearViewBox(), P = this.paths;
        for (let i = 0; i < this.ctxs.length && i < this.cfg.icons.length; i++) {
            const ic = this.cfg.icons[i], ctx = this.ctxs[i];
            // viewBox with preserveAspectRatio="xMidYMid meet"
            const s = Math.min(ic.cssW / vb.w, ic.cssH / vb.h);
            const tx = (ic.cssW - vb.w * s) / 2, ty = (ic.cssH - vb.h * s) / 2;
            const d = ic.dpr;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, ic.width, ic.height);
            const base = function() { ctx.setTransform(d * s, 0, 0, d * s, d * (tx + (ic.offX || 0)), d * (ty + (ic.offY || 0))); };
            const rot = function(g, deg) { ctx.translate(g.cx, g.cy); ctx.rotate(deg * Math.PI / 180); ctx.translate(-g.cx, -g.cy); };
            // Layer 1: large gear
            base(); rot(lg, lgAngle);
            ctx.save(); ctx.translate(lg.cx, lg.cy); ctx.fillStyle = '#6B7B8D'; ctx.fill(P.lgFull, 'evenodd'); ctx.restore();
            ctx.beginPath(); ctx.arc(lg.cx, lg.cy, lg.ringR, 0, Math.PI * 2); ctx.lineWidth = 2.5; ctx.strokeStyle = '#A8C5B8'; ctx.stroke();
            // Layer 2: small gear
            base(); rot(sm, smAngle);
            ctx.save(); ctx.translate(sm.cx, sm.cy); ctx.fillStyle = '#6B7B8D'; ctx.fill(P.smFull, 'evenodd'); ctx.restore();
            ctx.beginPath(); ctx.arc(sm.cx, sm.cy, sm.ringR, 0, Math.PI * 2); ctx.lineWidth = 2; ctx.strokeStyle = '#A8C5B8'; ctx.stroke();
            // Layer 3: large-gear teeth clipped to the small gear zone
            base();
            ctx.save();
            ctx.beginPath(); ctx.arc(+sm.cx.toFixed(2), +sm.cy.toFixed(2), sm.outerR + 1, 0, Math.PI * 2); ctx.clip();
            rot(lg, lgAngle);
            ctx.translate(lg.cx, lg.cy); ctx.fillStyle = '#6B7B8D'; ctx.fill(P.lgTeeth);
            ctx.restore();
        }
    };

    // ------------------------------------------------------------------
    // DRONE (the original Three.js quadcopter scene, unchanged)
    // ------------------------------------------------------------------
    function DroneRenderer(THREE, canvas, opts) {
        this.THREE = THREE;
        this.canvas = canvas;
        this.structures = [];
        this.isDark = opts.theme === 'dark';
        this.width = opts.width;
        this.height = opts.height;
        this.ok = false;
        try {
            this.init(opts);
            this.ok = true;
        } catch (e) {
            this.renderer = null;
            this.error = e;
        }
    }

    DroneRenderer.prototype.init = function(opts) {
        const THREE = this.THREE;
        this.clock = new THREE.Clock();
        const scene = this.scene = new THREE.Scene();
        scene.fog = new THREE.Fog(this.isDark ? 0x0a0b0f : 0xd0d2d4, 50, 200);
        const camera = this.camera = new THREE.PerspectiveCamera(PHI * 45, opts.width / opts.height, PHI_INV, 1000);
        camera.position.set(0, 0, PHI * 30);
        const renderer = this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas, alpha: true, antialias: opts.dpr === 1,
            powerPreference: 'high-performance', stencil: false, depth: true,
            premultipliedAlpha: false
        });
        renderer.setSize(opts.width, opts.height, false);
        renderer.setPixelRatio(Math.min(opts.dpr, 1.5));
        renderer.setSize(opts.width, opts.height, false);
        renderer.autoClear = true;

        scene.add(new THREE.AmbientLight(0xffffff, PHI_INV));
        const dirLight = new THREE.DirectionalLight(0x7ec8e3, 1);
        dirLight.position.set(PHI * 5, PHI * 5, PHI * 5);
        scene.add(dirLight);
        const pointLight = new THREE.PointLight(0xa8d5e8, 0.8, 100);
        pointLight.position.set(-30, -30, 30);
        scene.add(pointLight);

        this.createEngineeringStructures();
    };

    DroneRenderer.prototype.createIridescentMaterial = function(hueOffset) {
        const THREE = this.THREE;
        hueOffset = hueOffset || 0;
        const themeHueShift = this.isDark ? 0.7 : 0;
        const adjustedHue = (hueOffset + themeHueShift) % 1;
        const material = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color().setHSL(adjustedHue, 0.8, 0.6),
            metalness: 0.6, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.0, reflectivity: 0.8,
            emissive: new THREE.Color().setHSL((adjustedHue + 0.5) % 1, 1, 0.2),
            emissiveIntensity: this.isDark ? 0.4 : 0.3, side: THREE.DoubleSide
        });
        material.userData = { hueOffset: hueOffset };
        return material;
    };

    DroneRenderer.prototype.createWireframeMaterial = function(color) {
        const THREE = this.THREE;
        return new THREE.MeshBasicMaterial({
            color: color || 0x7ec8e3, wireframe: true, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending
        });
    };

    DroneRenderer.prototype.createEngineeringStructures = function() {
        const THREE = this.THREE;
        const quadcopter = this.createQuadcopter();
        quadcopter.position.set(-70, 0, -40);
        quadcopter.rotation.x = 0.4;
        quadcopter.rotation.z = 0.15;
        quadcopter.userData.baseTilt = { x: 0.4, z: 0.15 };
        this.scene.add(quadcopter);
        this.structures.push(quadcopter);
        const z = -40;
        const waypoints = [
            new THREE.Vector3(-70, 0, z),
            new THREE.Vector3(-55, -35, z - 5),
            new THREE.Vector3(0, -45, z),
            new THREE.Vector3(55, -35, z - 5),
            new THREE.Vector3(70, 0, z),
            new THREE.Vector3(55, 25, z - 5),
            new THREE.Vector3(70, 40, z),
            new THREE.Vector3(-70, 40, z),
            new THREE.Vector3(-55, 25, z - 5),
            new THREE.Vector3(-70, 0, z)
        ];
        waypoints.forEach(function(wp) { quadcopter.userData.waypoints.push(wp); });
        quadcopter.userData.waypointSpeed = 0.12;
    };

    DroneRenderer.prototype.createQuadcopter = function() {
        const THREE = this.THREE;
        const group = new THREE.Group();
        const bodyGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const bodyMat = this.createIridescentMaterial(0.5);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);
        const domeGeo = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const domeMat = new THREE.MeshPhysicalMaterial({ color: 0x111122, metalness: 0.9, roughness: 0.1, clearcoat: 1.0 });
        const dome = new THREE.Mesh(domeGeo, domeMat);
        dome.position.y = -0.8;
        dome.rotation.x = Math.PI;
        group.add(dome);
        const propellers = [];
        const armMat = this.createIridescentMaterial(0.6);
        const armGeo = new THREE.BoxGeometry(5, 0.3, 0.5);
        const motorGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.6, 12);
        const propMat = this.createWireframeMaterial(0x88ccff);
        const blade1Geo = new THREE.BoxGeometry(3.5, 0.08, 0.4);
        const blade2Geo = new THREE.BoxGeometry(0.4, 0.08, 3.5);
        propMat.wireframe = false;
        propMat.opacity = 0.7;
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const arm = new THREE.Mesh(armGeo, armMat);
            arm.position.x = Math.cos(angle) * 2.5;
            arm.position.z = Math.sin(angle) * 2.5;
            arm.position.y = 0.2;
            arm.rotation.y = -angle;
            group.add(arm);
            const motor = new THREE.Mesh(motorGeo, bodyMat);
            motor.position.x = Math.cos(angle) * 5;
            motor.position.z = Math.sin(angle) * 5;
            motor.position.y = 0.5;
            group.add(motor);
            const propGroup = new THREE.Group();
            propGroup.add(new THREE.Mesh(blade1Geo, propMat));
            propGroup.add(new THREE.Mesh(blade2Geo, propMat));
            propGroup.position.x = Math.cos(angle) * 5;
            propGroup.position.z = Math.sin(angle) * 5;
            propGroup.position.y = 0.9;
            propGroup.userData.spinDirection = i % 2 === 0 ? 1 : -1;
            group.add(propGroup);
            propellers.push(propGroup);
        }
        const skidMat = new THREE.MeshPhysicalMaterial({ color: 0x333344, metalness: 0.8, roughness: 0.3 });
        const skidGeo = new THREE.CylinderGeometry(0.1, 0.1, 6, 8);
        const supportGeo = new THREE.CylinderGeometry(0.08, 0.08, 1, 6);
        skidGeo.rotateZ(Math.PI / 2);
        for (let side = -1; side <= 1; side += 2) {
            const skid = new THREE.Mesh(skidGeo, skidMat);
            skid.position.set(0, -1.5, side * 2);
            group.add(skid);
            for (let x = -1; x <= 1; x += 2) {
                const support = new THREE.Mesh(supportGeo, skidMat);
                support.position.set(x * 1.5, -1, side * 2);
                group.add(support);
            }
        }
        group.userData.type = 'quadcopter';
        group.userData.propellers = propellers;
        group.userData.waypoints = [];
        group.userData.currentWaypoint = 0;
        group.userData.waypointProgress = 0;
        group.userData.waypointSpeed = 0.3;
        group.userData.fadeOpacity = 1;
        group.userData.fadeTarget = 1;
        const uniqueMaterials = new Set();
        group.traverse(function(child) {
            if (child.isMesh && child.material) {
                child.material.transparent = true;
                child.material.userData.baseOpacity = child.material.opacity;
                uniqueMaterials.add(child.material);
            }
        });
        group.userData.allMaterials = Array.from(uniqueMaterials);
        return group;
    };

    DroneRenderer.prototype.setTheme = function(isDark) {
        this.isDark = isDark;
        this.structures.forEach(function(structure) {
            structure.traverse(function(child) {
                const material = child.material;
                if (!material || !material.userData || material.userData.hueOffset === undefined) return;
                const hueShift = isDark ? 0.7 : 0;
                const hueOffset = (material.userData.hueOffset + hueShift) % 1;
                if (material.color) material.color.setHSL(hueOffset, 0.8, 0.6);
                if (material.emissive) {
                    material.emissive.setHSL((hueOffset + 0.5) % 1, 1, 0.2);
                    material.emissiveIntensity = isDark ? 0.4 : 0.3;
                }
                material.needsUpdate = true;
            });
        });
        if (this.scene && this.scene.fog) this.scene.fog.color.set(isDark ? 0x0a0b0f : 0xd0d2d4);
    };

    DroneRenderer.prototype.resize = function(width, height) {
        if (!this.renderer) return;
        this.width = width; this.height = height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
    };

    DroneRenderer.prototype.fade = function(target) {
        this.structures.forEach(function(s) {
            if (s.userData.type === 'quadcopter') s.userData.fadeTarget = target;
        });
    };

    // Port of animateThreeJS() minus the parts that live on the main thread
    // (panel physics) or in other renderers (gears).
    DroneRenderer.prototype.tick = function(state) {
        if (!this.renderer) return;
        const THREE = this.THREE;
        const clock = this.clock, structures = this.structures, camera = this.camera;
        if (state.hidden) { clock.getDelta(); return; }
        const deltaTime = clock.getDelta();
        if (state.mobilePortrait) return;
        const time = clock.getElapsedTime();

        if (state.bgPaused) {
            let droneStillFading = false;
            for (let _si = 0; _si < structures.length; _si++) {
                const s = structures[_si];
                if (s.userData.type === 'quadcopter') {
                    const target = s.userData.fadeTarget;
                    const current = s.userData.fadeOpacity;
                    if (target === undefined) continue;
                    const diff = target - current;
                    if (Math.abs(diff) > 0.005) {
                        droneStillFading = true;
                        const fadeSmoothFactor = 1 - Math.pow(0.00001, deltaTime);
                        s.userData.fadeOpacity = current + diff * fadeSmoothFactor;
                        const mats = s.userData.allMaterials;
                        const opacity = s.userData.fadeOpacity;
                        for (let mi = 0; mi < mats.length; mi++) {
                            const mat = mats[mi];
                            mat.opacity = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity * opacity : opacity;
                        }
                        if (s.userData.propellers) {
                            s.userData.propellers.forEach(function(prop) {
                                prop.rotation.y += deltaTime * 30 * prop.userData.spinDirection;
                            });
                        }
                        if (s.userData.waypoints && s.userData.waypoints.length > 1) {
                            if (!s.userData.basePosition) s.userData.basePosition = new THREE.Vector3();
                            s.userData.waypointProgress = (s.userData.waypointProgress || 0) + deltaTime * s.userData.waypointSpeed;
                            if (s.userData.waypointProgress >= 1) {
                                s.userData.waypointProgress -= 1;
                                s.userData.currentWaypoint = (s.userData.currentWaypoint + 1) % s.userData.waypoints.length;
                            }
                            const currentIdx = s.userData.currentWaypoint || 0;
                            const nextIdx = (currentIdx + 1) % s.userData.waypoints.length;
                            const t = s.userData.waypointProgress;
                            const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                            s.userData.basePosition.lerpVectors(s.userData.waypoints[currentIdx], s.userData.waypoints[nextIdx], easeT);
                            const hoverOffset = Math.sin(time * 6) * 0.01;
                            s.position.copy(s.userData.basePosition);
                            s.position.y += hoverOffset;
                        }
                    } else if (current !== target) {
                        s.userData.fadeOpacity = target;
                        const mats = s.userData.allMaterials;
                        for (let mi = 0; mi < mats.length; mi++) {
                            const mat = mats[mi];
                            mat.opacity = mat.userData.baseOpacity !== undefined ? mat.userData.baseOpacity * target : target;
                        }
                        droneStillFading = true;
                    }
                }
            }
            if (droneStillFading) this.renderer.render(this.scene, camera);
            return;
        }

        for (let _si = 0; _si < structures.length; _si++) {
            const structure = structures[_si];
            if (!structure.visible) continue;
            if (structure.userData.type !== 'quadcopter') continue;

            if (structure.userData.propellers) {
                const props = structure.userData.propellers;
                const propSpeed = deltaTime * 30;
                for (let pi = 0; pi < props.length; pi++) props[pi].rotation.y += propSpeed * props[pi].userData.spinDirection;
            }

            if (structure.userData.waypoints && structure.userData.waypoints.length > 1) {
                const waypoints = structure.userData.waypoints;
                if (!structure.userData.basePosition) structure.userData.basePosition = new THREE.Vector3();
                structure.userData.waypointProgress = (structure.userData.waypointProgress || 0) + deltaTime * structure.userData.waypointSpeed;
                if (structure.userData.waypointProgress >= 1) {
                    structure.userData.waypointProgress -= 1;
                    structure.userData.currentWaypoint = (structure.userData.currentWaypoint + 1) % waypoints.length;
                }
                const currentIdx = structure.userData.currentWaypoint || 0;
                const nextIdx = (currentIdx + 1) % waypoints.length;
                const t = structure.userData.waypointProgress;
                const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                const startPos = waypoints[currentIdx];
                const endPos = waypoints[nextIdx];
                structure.userData.basePosition.lerpVectors(startPos, endPos, easeT);

                if (!structure.userData._dirVec) structure.userData._dirVec = new THREE.Vector3();
                const dirVec = structure.userData._dirVec.subVectors(endPos, startPos);
                const dirLen = dirVec.length();
                if (dirLen > 0.01) {
                    dirVec.divideScalar(dirLen);
                    if (!structure.userData.smoothDir) structure.userData.smoothDir = { x: dirVec.x, z: dirVec.z };
                    const smoothFactor = 1 - Math.pow(1 - 0.03, deltaTime * 60);
                    structure.userData.smoothDir.x += (dirVec.x - structure.userData.smoothDir.x) * smoothFactor;
                    structure.userData.smoothDir.z += (dirVec.z - structure.userData.smoothDir.z) * smoothFactor;
                    const sd = structure.userData.smoothDir;
                    const baseTilt = structure.userData.baseTilt || { x: 0, z: 0 };
                    const targetRoll = -sd.x * 0.25 + baseTilt.z;
                    const targetPitch = sd.z * 0.15 + baseTilt.x;
                    const targetYaw = Math.atan2(sd.x, sd.z);
                    const rotSmoothFactor = 1 - Math.pow(1 - 0.02, deltaTime * 60);
                    structure.rotation.z += (targetRoll - structure.rotation.z) * rotSmoothFactor;
                    structure.rotation.x += (targetPitch - structure.rotation.x) * rotSmoothFactor;
                    let yawDiff = targetYaw - structure.rotation.y;
                    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
                    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
                    structure.rotation.y += yawDiff * rotSmoothFactor;
                }
                const hoverOffset = Math.sin(time * 6) * 0.01;
                structure.position.copy(structure.userData.basePosition);
                structure.position.y += hoverOffset;
            }

            if (structure.userData.fadeTarget !== undefined) {
                const target = structure.userData.fadeTarget;
                const current = structure.userData.fadeOpacity;
                const diff = target - current;
                if (Math.abs(diff) > 0.001) {
                    const fadeSmoothFactor = 1 - Math.pow(0.00001, deltaTime);
                    structure.userData.fadeOpacity = current + diff * fadeSmoothFactor;
                    const mats = structure.userData.allMaterials;
                    const opacity = structure.userData.fadeOpacity;
                    for (let mi = 0; mi < mats.length; mi++) {
                        const m = mats[mi];
                        m.opacity = m.userData.baseOpacity !== undefined ? m.userData.baseOpacity * opacity : opacity;
                    }
                } else if (current !== target) {
                    structure.userData.fadeOpacity = target;
                    const mats = structure.userData.allMaterials;
                    for (let mi = 0; mi < mats.length; mi++) {
                        const m = mats[mi];
                        m.opacity = m.userData.baseOpacity !== undefined ? m.userData.baseOpacity * target : target;
                    }
                }
            }
        }

        const camTime = time * PHI_INV * 0.1;
        camera.position.x = Math.sin(camTime) * PHI * 2;
        camera.position.y = Math.cos(camTime * 0.8) * PHI + 2;
        camera.position.z = PHI * 30 + Math.sin(camTime * 0.5) * PHI * 3;
        camera.lookAt(0, 0, 0);
        this.renderer.render(this.scene, camera);
    };

    DroneRenderer.prototype.dispose = function() {
        if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
        if (this.scene) {
            this.scene.traverse(function(obj) {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) [].concat(obj.material).forEach(function(m) { m.dispose(); });
            });
        }
    };

    // ------------------------------------------------------------------
    // CIRCUIT NETWORK (animated part: dashed traces, nodes, packets)
    // ------------------------------------------------------------------
    // The routes are computed on the main thread from the panel positions;
    // everything that animates is simulated and drawn here, with the same
    // maths and the same CSS transition/animation timing as the SVG had.

    // CSS transition emulation (with the spec's reversing-shortening rule)
    // for numbers or [r,g,b,a] colours.
    const EASE = makeEasing('ease');
    const EASE_OUT = makeEasing('ease-out');

    function Transition(value) {
        this.from = value; this.to = value; this.start = 0; this.dur = 0;
        this.ra = value; this.sf = 1; this.ease = EASE;
    }
    Transition.equal = function(a, b) {
        if (Array.isArray(a)) { for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-9) return false; return true; }
        return Math.abs(a - b) < 1e-9;
    };
    Transition.lerp = function(a, b, t) {
        if (Array.isArray(a)) {
            const aa = a[3] + (b[3] - a[3]) * t;
            if (aa <= 0) return [0, 0, 0, 0];
            return [0, 1, 2].map(function(i) { return (a[i] * a[3] + (b[i] * b[3] - a[i] * a[3]) * t) / aa; }).concat([aa]);
        }
        return a + (b - a) * t;
    };
    Transition.prototype.get = function(now) {
        if (!this.dur) return this.to;
        const p = (now - this.start) / this.dur;
        if (p >= 1) return this.to;
        if (p <= 0) return this.from;
        return Transition.lerp(this.from, this.to, this.ease(p));
    };
    Transition.prototype.set = function(target, now, dur, ease) {
        if (Transition.equal(target, this.to)) return;
        const cur = this.get(now);
        const running = this.dur && now < this.start + this.dur;
        this.ease = ease || EASE;
        if (!dur) { this.from = this.to = this.ra = target; this.dur = 0; this.sf = 1; return; }
        if (running && Transition.equal(target, this.ra)) {
            const p = this.ease(Math.min(1, Math.max(0, (now - this.start) / this.dur)));
            const sf = Math.min(1, Math.max(0, Math.abs(p * this.sf + 1 - this.sf)));
            this.ra = this.to; this.sf = sf;
            this.from = cur; this.to = target; this.start = now; this.dur = dur * sf;
        } else {
            this.ra = cur; this.sf = 1;
            this.from = cur; this.to = target; this.start = now; this.dur = dur;
        }
    };

    function rgbaArr(c, mul) {
        return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (c[3] * (mul === undefined ? 1 : mul)) + ')';
    }

    function roundRectPath(ctx, x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    function CircuitRenderer(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.dpr = 1;
        this.styles = null;
        this.theme = null;
        this.connections = [];
        this.packets = [];
        this.lastUpdateTime = 0;
        this.visible = true;
        this.fadeUntil = 0;
        this.pendingStyle = false;
        this.dirtyRect = null;
        this.frameCount = 0;
        this.autoTick = false;
        this.glowScratch = null;
    }

    CircuitRenderer.prototype.configure = function(cfg) {
        this.dpr = cfg.dpr;
        if (this.canvas.width !== cfg.width) this.canvas.width = cfg.width;
        if (this.canvas.height !== cfg.height) this.canvas.height = cfg.height;
        this.dirtyRect = [0, 0, cfg.width, cfg.height];
        this.connections.forEach(function(c) { c.junctions.forEach(function(n) { n.cache = null; }); });
    };

    CircuitRenderer.prototype.setPackets = function(list, now) {
        // list: [{ conn, progress, speed, direction }]
        this.packets = list.map(function(p) { return { conn: p.conn, progress: p.progress, speed: p.speed, direction: p.direction || 1, x: 0, y: 0, placed: false }; });
        this.lastUpdateTime = now;
    };

    CircuitRenderer.prototype.setStyles = function(styles, now) {
        const first = !this.styles;
        this.styles = styles;
        if (first) {
            this.theme = {
                traceStroke: new Transition(styles.trace.stroke),
                traceOpacity: new Transition(styles.trace.opacity),
                glowFill: new Transition(styles.glow.fill)
            };
            return;
        }
        // Theme change: same 0.4s CSS transitions as the SVG had.
        this.theme.traceStroke.set(styles.trace.stroke, now, 400, EASE);
        this.theme.traceOpacity.set(styles.trace.opacity, now, 400, EASE);
        this.theme.glowFill.set(styles.glow.fill, now, 400, EASE);
        const self = this;
        this.connections.forEach(function(c) { c.junctions.forEach(function(n) { self.applyNodeTargets(n, now, false); n.cache = null; }); });
        this.dirtyRect = [0, 0, this.canvas.width, this.canvas.height];
    };

    // routes: array (per connection) of point lists, or null for "unchanged"
    CircuitRenderer.prototype.setRoutes = function(routes, now) {
        for (let i = 0; i < routes.length; i++) {
            const pts = routes[i];
            if (!pts) continue;
            let conn = this.connections[i];
            if (!conn) conn = this.connections[i] = { points: [], seg: [], total: 0, path2d: null, junctions: [] };
            conn.points = pts;
            conn.seg = [];
            let total = 0;
            for (let k = 1; k < pts.length; k++) {
                const L = Math.sqrt((pts[k].x - pts[k - 1].x) * (pts[k].x - pts[k - 1].x) + (pts[k].y - pts[k - 1].y) * (pts[k].y - pts[k - 1].y));
                conn.seg.push(L); total += L;
            }
            conn.total = total;
            let d = 'M ' + pts[0].x + ' ' + pts[0].y;
            for (let k = 1; k < pts.length; k++) d += ' L ' + pts[k].x + ' ' + pts[k].y;
            conn.path2d = new Path2D(d);
            if (conn.junctions.length === pts.length) {
                for (let k = 0; k < pts.length; k++) { conn.junctions[k].x = pts[k].x; conn.junctions[k].y = pts[k].y; conn.junctions[k].cache = null; }
            } else {
                conn.junctions = [];
                for (let k = 0; k < pts.length; k++) {
                    const kind = k === 0 ? 'port' : k === pts.length - 1 ? 'endpoint' : 'junction';
                    const node = { kind: kind, x: pts[k].x, y: pts[k].y, pulseIntensity: 0, pulsing: false, committed: false, cache: null };
                    this.applyNodeTargets(node, now, true);
                    conn.junctions.push(node);
                }
            }
        }
        this.dirtyRect = [0, 0, this.canvas.width, this.canvas.height];
    };

    CircuitRenderer.prototype.applyNodeTargets = function(node, now, instant) {
        const s = this.styles;
        let fill, opacity, opDur = 400;
        const on = node.committed;
        if (node.kind === 'junction') {
            fill = on ? s.junction.pulseFill : s.junction.fill;
            opacity = on ? s.junction.pulseOpacity : s.junction.opacity;
            opDur = 200;
        } else if (node.kind === 'port') {
            fill = on ? s.port.pulseFill : s.port.fill;
            opacity = on ? s.port.pulseOpacity : s.port.opacity;
        } else {
            fill = s.endpoint.fill;
            opacity = s.endpoint.opacity;
        }
        // Leaving the pulse removes the pulse keyframe animation in the same
        // style change; Blink starts no transition for properties that
        // animation drove (opacity), so opacity snaps while fill still eases.
        if (!on && node.kind !== 'endpoint') opDur = 0;
        if (instant || !node.fill) {
            node.fill = new Transition(fill);
            node.opacity = new Transition(opacity);
        } else {
            node.fill.set(fill, now, 400, EASE);
            node.opacity.set(opacity, now, opDur, EASE);
        }
    };

    CircuitRenderer.prototype.pointAt = function(conn, progress, out) {
        const pts = conn.points;
        if (pts.length < 2) { out.x = pts[0].x; out.y = pts[0].y; return out; }
        const target = progress * conn.total;
        let cur = 0;
        for (let i = 1; i < pts.length; i++) {
            const L = conn.seg[i - 1];
            if (cur + L >= target) {
                const t = L > 0 ? (target - cur) / L : 0;
                out.x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t;
                out.y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t;
                return out;
            }
            cur += L;
        }
        out.x = pts[pts.length - 1].x; out.y = pts[pts.length - 1].y;
        return out;
    };

    // One simulation step (the old CircuitGridMatrix.update packet loop).
    CircuitRenderer.prototype.update = function(now) {
        const deltaTime = (now - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = now;
        const pos = { x: 0, y: 0 };
        for (let i = 0; i < this.packets.length; i++) {
            const packet = this.packets[i];
            const conn = this.connections[packet.conn];
            if (!conn || conn.points.length < 2) continue;
            packet.progress += packet.speed * deltaTime * packet.direction;
            if (packet.progress >= 1) { packet.progress = 1; packet.direction = -1; }
            else if (packet.progress <= 0) { packet.progress = 0; packet.direction = 1; }
            this.pointAt(conn, packet.progress, pos);
            packet.x = pos.x; packet.y = pos.y; packet.placed = true;
            this.pulseNearby(pos, conn.junctions);
        }
    };

    CircuitRenderer.prototype.pulseNearby = function(p, junctions) {
        for (let i = 0; i < junctions.length; i++) {
            const j = junctions[i];
            const dx = p.x - j.x, dy = p.y - j.y, distSq = dx * dx + dy * dy;
            if (distSq < 900) {
                const intensity = 1 - (Math.sqrt(distSq) * 0.033333);
                if (intensity > j.pulseIntensity) {
                    j.pulseIntensity = intensity;
                    if (!j.pulsing) { j.pulsing = true; this.pendingStyle = true; }
                }
            } else {
                j.pulseIntensity *= 0.9;
                if (j.pulseIntensity < 0.1 && j.pulsing) { j.pulsing = false; this.pendingStyle = true; }
            }
        }
    };

    // Class changes take effect at the next style update, so an off/on
    // toggle within one frame is a no-op (as it was with the CSS class).
    CircuitRenderer.prototype.commitStyles = function(now) {
        if (!this.pendingStyle) return;
        this.pendingStyle = false;
        for (let i = 0; i < this.connections.length; i++) {
            const nodes = this.connections[i].junctions;
            for (let n = 0; n < nodes.length; n++) {
                const node = nodes[n];
                if (node.pulsing === node.committed) continue;
                node.committed = node.pulsing;
                node.pulseStart = node.committed && node.kind !== 'endpoint' ? now : undefined;
                this.applyNodeTargets(node, now, false);
            }
        }
    };

    // junction-pulse / medallion-port-pulse keyframes (0.3s ease-out)
    CircuitRenderer.prototype.nodeAnimation = function(node, now) {
        if (node.pulseStart === undefined) return null;
        const t = (now - node.pulseStart) / 300;
        if (t < 0 || t >= 1) return null;
        const half = t < 0.5;
        const local = EASE_OUT(half ? t * 2 : (t - 0.5) * 2);
        if (node.kind === 'junction') {
            return half ? { scale: 1 + 0.5 * local, opacity: 1 - 0.2 * local } : { scale: 1.5 - 0.5 * local, opacity: 0.8 - 0.2 * local };
        }
        return half ? { r: 5 + 3 * local, opacity: 1 - 0.2 * local } : { r: 8 - 3 * local, opacity: 0.8 + 0.1 * local };
    };

    // Rasterise one node (opaque, before its opacity) at its exact sub-pixel
    // position; cached until its fill, pulse or position changes.
    CircuitRenderer.prototype.nodeBitmap = function(node, fill, anim) {
        const d = this.dpr, s = this.styles;
        const fx = node.x * d - Math.floor(node.x * d), fy = node.y * d - Math.floor(node.y * d);
        const key = fill.join(',') + '|' + (anim ? (anim.scale || anim.r) : '') + '|' + fx + ',' + fy + '|' + d + '|' + s.port.shadow + '|' + s.port.shadowColor.join(',');
        if (node.cache && node.cache.key === key) return node.cache;
        const half = Math.ceil(22 * d);
        let c = node.cache ? node.cache.canvas : null;
        if (!c || c.width !== half * 2) c = makeCanvas(half * 2, half * 2);
        const sc = c.getContext('2d');
        sc.setTransform(1, 0, 0, 1, 0, 0);
        sc.clearRect(0, 0, c.width, c.height);
        const cx = half + fx, cy = half + fy;
        sc.fillStyle = rgbaArr(fill);
        if (node.kind === 'junction') {
            const scale = anim ? anim.scale : 1;
            sc.setTransform(d, 0, 0, d, cx, cy);
            sc.rotate(Math.PI / 4);
            sc.scale(scale, scale);
            roundRectPath(sc, -5, -5, 10, 10, 2);
            sc.fill();
        } else if (node.kind === 'port') {
            const r = anim ? anim.r : 5;
            sc.shadowColor = rgbaArr(s.port.shadowColor);
            // filter: drop-shadow()'s blur length is a standard deviation;
            // canvas shadowBlur is twice the standard deviation.
            sc.shadowBlur = 2 * s.port.shadow * d;
            sc.beginPath();
            sc.arc(cx, cy, r * d, 0, Math.PI * 2);
            sc.fill();
        } else {
            sc.shadowColor = rgbaArr(fill);
            sc.shadowBlur = 3 * d; // feGaussianBlur stdDeviation 1.5, merged under the source
            sc.beginPath();
            sc.arc(cx, cy, 6 * d, 0, Math.PI * 2);
            sc.fill();
        }
        sc.shadowBlur = 0;
        sc.shadowColor = 'rgba(0,0,0,0)';
        node.cache = { key: key, canvas: c, half: half };
        return node.cache;
    };

    CircuitRenderer.prototype.tick = function(now) {
        // Worker mode keeps the original cadence on its own: the packets were
        // advanced on every fourth animation frame.
        if (this.autoTick && this.visible) {
            this.frameCount++;
            if (this.frameCount % 4 === 0) this.update(now);
        }
        this.render(now);
    };

    CircuitRenderer.prototype.render = function(now) {
        if (!this.styles) return;
        if (!this.visible && now > this.fadeUntil) return;
        this.commitStyles(now);
        const ctx = this.ctx, d = this.dpr, s = this.styles;
        const W = this.canvas.width, H = this.canvas.height;
        const dr = this.dirtyRect || [0, 0, W, H];
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(dr[0], dr[1], dr[2] - dr[0], dr[3] - dr[1]);
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const grow = function(x, y, r) { if (x - r < minX) minX = x - r; if (y - r < minY) minY = y - r; if (x + r > maxX) maxX = x + r; if (y + r > maxY) maxY = y + r; };

        // 1. Dashed traces (stroke-dashoffset: 0 -> -24 over 1s, linear)
        ctx.setTransform(d, 0, 0, d, 0, 0);
        ctx.lineWidth = s.trace.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash(s.trace.dash);
        ctx.lineDashOffset = -24 * ((now % 1000) / 1000);
        ctx.strokeStyle = rgbaArr(this.theme.traceStroke.get(now));
        ctx.globalAlpha = this.theme.traceOpacity.get(now);
        for (let i = 0; i < this.connections.length; i++) {
            const conn = this.connections[i];
            if (!conn || !conn.path2d) continue;
            ctx.stroke(conn.path2d);
            for (let k = 0; k < conn.points.length; k++) grow(conn.points[k].x * d, conn.points[k].y * d, 30 * d);
        }
        ctx.globalAlpha = 1;
        ctx.setLineDash([]);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // 2. Nodes, each composited with its own opacity (SVG group opacity)
        for (let i = 0; i < this.connections.length; i++) {
            const conn = this.connections[i];
            if (!conn) continue;
            const nodes = conn.junctions;
            for (let n = 0; n < nodes.length; n++) {
                const node = nodes[n];
                const anim = this.nodeAnimation(node, now);
                const opacity = anim ? anim.opacity : node.opacity.get(now);
                if (!(opacity > 0)) continue;
                const bmp = this.nodeBitmap(node, node.fill.get(now), anim);
                ctx.globalAlpha = opacity;
                ctx.drawImage(bmp.canvas, Math.floor(node.x * d) - bmp.half, Math.floor(node.y * d) - bmp.half);
            }
        }
        ctx.globalAlpha = 1;

        // 3. Packets in order: glow (group opacity), then diamond
        const glowFill = this.theme.glowFill.get(now);
        const half = Math.ceil(20 * d);
        if (!this.glowScratch || this.glowScratch.width !== half * 2) this.glowScratch = makeCanvas(half * 2, half * 2);
        const gs = this.glowScratch, gc = gs.getContext('2d');
        for (let i = 0; i < this.packets.length; i++) {
            const packet = this.packets[i];
            if (!packet.placed) continue;
            const px = packet.x * d, py = packet.y * d;
            const ix = Math.floor(px), iy = Math.floor(py);
            gc.setTransform(1, 0, 0, 1, 0, 0);
            gc.clearRect(0, 0, gs.width, gs.height);
            gc.fillStyle = rgbaArr(glowFill);
            gc.shadowColor = rgbaArr(glowFill);
            gc.shadowBlur = 6 * d; // stdDeviation 3, merged under the source
            gc.setTransform(d, 0, 0, d, half + (px - ix), half + (py - iy));
            roundRectPath(gc, -6, -6, 12, 12, 2);
            gc.fill();
            gc.shadowBlur = 0;
            gc.shadowColor = 'rgba(0,0,0,0)';
            ctx.globalAlpha = s.glow.opacity;
            ctx.drawImage(gs, ix - half, iy - half);
            ctx.globalAlpha = s.packet.opacity;
            ctx.fillStyle = rgbaArr(s.packet.fill);
            ctx.setTransform(d, 0, 0, d, px, py);
            ctx.rotate(Math.PI / 4);
            roundRectPath(ctx, -4, -4, 8, 8, 1);
            ctx.fill();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.globalAlpha = 1;
            grow(px, py, half);
        }

        this.dirtyRect = minX < maxX
            ? [Math.max(0, Math.floor(minX)), Math.max(0, Math.floor(minY)), Math.min(W, Math.ceil(maxX)), Math.min(H, Math.ceil(maxY))]
            : null;
    };

    // ------------------------------------------------------------------
    // ENGINE
    // ------------------------------------------------------------------
    function Engine(options) {
        this.options = options || {};
        this.inWorker = !!this.options.inWorker;
        this.nebula = null;
        this.glow = null;
        this.gears = null;
        this.drone = null;
        this.circuits = null;
        this.droneCanvas = null;
        this.droneOpts = null;
        this.pendingFade = null;
        this.bgPaused = false;
        this.pauseStart = 0;
        this.pauseAccum = 0;
        this.timeOffset = 0;      // this thread's clock -> document clock
        this.hidden = false;
        this.mobilePortrait = false;
        this.theme = 'light';
        this.running = false;
        this.stats = { frames: 0, busyMs: 0, maxMs: 0 };
    }

    Engine.prototype.docNow = function() {
        return performance.now() + this.timeOffset;
    };

    Engine.prototype.bgTime = function(now) {
        if (this.bgPaused) return this.pauseStart - this.pauseAccum;
        return now - this.pauseAccum;
    };

    Engine.prototype.post = function(msg) {
        if (this.inWorker) root.postMessage(msg);
        else if (this.options.onMessage) this.options.onMessage(msg);
    };

    Engine.prototype.loadThree = function() {
        if (root.THREE) return Promise.resolve(root.THREE);
        if (this.inWorker && this.options.threeUrl) {
            try { root.importScripts(this.options.threeUrl); } catch (e) { return Promise.reject(e); }
            return root.THREE ? Promise.resolve(root.THREE) : Promise.reject(new Error('THREE missing'));
        }
        if (this.options.loadThree) return this.options.loadThree();
        return Promise.reject(new Error('THREE unavailable'));
    };

    Engine.prototype.startDrone = function() {
        if (this.drone || this._droneLoading || !this.droneCanvas || !this.droneOpts || this.mobilePortrait) return;
        this._droneLoading = true;
        const self = this;
        this.loadThree().then(function(THREE) {
            self._droneLoading = false;
            const opts = Object.assign({}, self.droneOpts, { theme: self.theme });
            const drone = new DroneRenderer(THREE, self.droneCanvas, opts);
            if (!drone.ok) { self.post({ type: 'droneFailed', message: String(drone.error) }); return; }
            self.drone = drone;
            if (self.pendingFade !== null) { drone.fade(self.pendingFade); self.pendingFade = null; }
            self.post({ type: 'droneReady' });
        }, function(err) {
            self._droneLoading = false;
            self.post({ type: 'droneFailed', message: String(err) });
        });
    };

    Engine.prototype.handle = function(msg) {
        switch (msg.type) {
            case 'init': {
                if (msg.mainTimeOrigin !== undefined && performance.timeOrigin !== undefined) {
                    this.timeOffset = performance.timeOrigin - msg.mainTimeOrigin;
                }
                if (msg.threeUrl) this.options.threeUrl = msg.threeUrl;
                this.theme = msg.theme || this.theme;
                this.mobilePortrait = !!msg.mobilePortrait;
                const c = msg.canvases || {};
                if (c.nebula) this.nebula = new NebulaRenderer(c.nebula);
                if (c.glow) this.glow = new GlowRenderer(c.glow);
                if (c.gears && c.gears.length) this.gears = new GearRenderer(c.gears);
                if (c.drone) this.droneCanvas = c.drone;
                break;
            }
            case 'nebula': if (this.nebula) this.nebula.configure(msg.config); break;
            case 'glow': if (this.glow) this.glow.configure(msg.config); break;
            case 'glowVisible': if (this.glow) this.glow.visible = !!msg.visible; break;
            case 'gears': if (this.gears) this.gears.configure(msg.config); break;
            case 'drone':
                this.droneOpts = msg.config;
                if (this.drone) this.drone.resize(msg.config.width, msg.config.height);
                else this.startDrone();
                break;
            case 'droneFade':
                if (this.drone) this.drone.fade(msg.target); else this.pendingFade = msg.target;
                break;
            case 'theme':
                this.theme = msg.theme;
                if (this.drone) this.drone.setTheme(msg.theme === 'dark');
                break;
            case 'mobilePortrait':
                this.mobilePortrait = !!msg.value;
                if (!this.mobilePortrait) this.startDrone();
                break;
            case 'bgPaused': {
                const now = msg.time !== undefined ? msg.time : this.docNow();
                if (msg.paused && !this.bgPaused) { this.bgPaused = true; this.pauseStart = now; }
                else if (!msg.paused && this.bgPaused) { this.bgPaused = false; this.pauseAccum += now - this.pauseStart; }
                break;
            }
            case 'visibility': this.hidden = !!msg.hidden; break;
            case 'debugDisable': this.disabled = msg.names || {}; break;
            case 'debugFreeze': this.frozenTime = msg.time; break;
            case 'circuitsInit':
                this.circuits = new CircuitRenderer(msg.canvas);
                this.circuits.autoTick = !!msg.autoTick;
                this.circuits.configure(msg.size);
                this.circuits.setStyles(msg.styles, msg.time);
                this.circuits.setPackets(msg.packets, msg.time);
                break;
            case 'circuitSize': if (this.circuits) this.circuits.configure(msg.size); break;
            case 'circuitStyles': if (this.circuits) this.circuits.setStyles(msg.styles, msg.time !== undefined ? msg.time : this.docNow()); break;
            case 'circuitRoutes': if (this.circuits) this.circuits.setRoutes(msg.routes, msg.time !== undefined ? msg.time : this.docNow()); break;
            case 'circuitTick': if (this.circuits) this.circuits.update(msg.time); break;
            case 'circuitVisible':
                if (this.circuits) {
                    this.circuits.visible = !!msg.visible;
                    if (!msg.visible) this.circuits.fadeUntil = (msg.time !== undefined ? msg.time : this.docNow()) + 550;
                }
                break;
            case 'stats':
                this.post({ type: 'stats', stats: this.stats });
                this.stats = { frames: 0, busyMs: 0, maxMs: 0 };
                break;
        }
    };

    Engine.prototype.frame = function(now) {
        const t0 = performance.now();
        if (now === undefined) now = this.docNow();
        if (this.frozenTime !== undefined) now = this.frozenTime;
        const state = { hidden: this.hidden, mobilePortrait: this.mobilePortrait, bgPaused: this.bgPaused };
        const off = this.disabled || {};
        if (this.drone && !off.drone) this.drone.tick(state);
        if (!this.hidden) {
            if (this.nebula && !this.bgPaused && !off.nebula) this.nebula.render(this.bgTime(now));
            if (this.glow && !off.glow) this.glow.render(now);
            if (this.gears && !this.bgPaused && !off.gears) this.gears.tick(now);
            if (this.circuits && !this.mobilePortrait && !off.circuits) this.circuits.tick(now);
        }
        const dt = performance.now() - t0;
        this.stats.frames++; this.stats.busyMs += dt; if (dt > this.stats.maxMs) this.stats.maxMs = dt;
    };

    Engine.prototype.startLoop = function() {
        if (this.running) return;
        this.running = true;
        const self = this;
        const raf = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root)
            : function(cb) { return setTimeout(function() { cb(performance.now()); }, 1000 / 60); };
        function tick() {
            raf(tick);
            self.frame();
        }
        raf(tick);
    };

    root.EELAmbient = {
        Engine: Engine,
        NebulaRenderer: NebulaRenderer,
        GlowRenderer: GlowRenderer,
        GearRenderer: GearRenderer,
        DroneRenderer: DroneRenderer,
        CircuitRenderer: CircuitRenderer,
        Transition: Transition,
        GEAR_CONFIG: GEAR_CONFIG,
        buildGearPaths: buildGearPaths,
        sampleKeyframes: sampleKeyframes,
        makeEasing: makeEasing
    };

    // Worker bootstrap
    if (typeof root.document === 'undefined' && typeof root.importScripts === 'function') {
        let engine = null;
        root.onmessage = function(e) {
            const msg = e.data;
            if (msg.type === 'init') {
                engine = new Engine({ inWorker: true, threeUrl: msg.threeUrl });
                engine.handle(msg);
                engine.startLoop();
                root.postMessage({ type: 'ready' });
            } else if (engine) {
                engine.handle(msg);
            }
        };
    }
})(typeof self !== 'undefined' ? self : this);
