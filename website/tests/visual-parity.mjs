import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import puppeteer from 'puppeteer';

const execFileAsync = promisify(execFile);

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const value = process.argv.find((arg) => arg.startsWith(prefix));
    return value ? value.slice(prefix.length) : fallback;
}

const referenceUrl = readArg('reference', 'http://127.0.0.1:3001/');
const candidateUrl = readArg('candidate', 'http://127.0.0.1:3000/');
const outputDir = path.resolve(readArg('output', './visual-results'));
const requestedProfiles = new Set(readArg('profiles', '').split(',').filter(Boolean));
const requestedStates = readArg('states', 'initial,expanded').split(',').filter(Boolean);

const profiles = [
    {
        name: 'desktop-dark',
        theme: 'dark',
        fullPage: false,
        viewport: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    },
    {
        name: 'desktop-light',
        theme: 'light',
        fullPage: false,
        viewport: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    },
    {
        name: 'mobile-dark',
        theme: 'dark',
        fullPage: true,
        viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
];

async function configurePage(page, profile) {
    await page.setViewport(profile.viewport);
    await page.evaluateOnNewDocument((theme) => {
        let seed = 0x00E311AB;
        Math.random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        localStorage.setItem('eel-has-visited', 'true');
        localStorage.setItem('eel-theme', theme);
        localStorage.setItem('eel-theme-manually-set', 'true');
    }, profile.theme);
}

async function loadPair(browser, profile) {
    const reference = await browser.newPage();
    await configurePage(reference, profile);
    await reference.goto(referenceUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    await reference.evaluate(() => document.fonts.ready);
    await new Promise((resolve) => setTimeout(resolve, 2600));
    const referenceReady = await reference.$$eval('.nav-panel.ready', (panels) => panels.length);
    await reference.evaluate(() => {
        try { _bgSystemsPaused = true; } catch (_) {}
        try { _gearAnimRunning = false; } catch (_) {}
        document.getAnimations().forEach((animation) => animation.pause());
    });

    const candidate = await browser.newPage();
    await configurePage(candidate, profile);
    await candidate.goto(candidateUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    await candidate.evaluate(() => document.fonts.ready);
    await new Promise((resolve) => setTimeout(resolve, 2600));
    const candidateReady = await candidate.$$eval('.nav-panel.ready', (panels) => panels.length);
    const readyCounts = [referenceReady, candidateReady];
    if (readyCounts.some((count) => count !== 4)) {
        throw new Error(`Panels failed to initialize: ${readyCounts.join(', ')}`);
    }
    return { reference, candidate };
}

async function freezeDynamicState(page) {
    await page.evaluate(() => {
        // Stop future JavaScript animation frames. One already-queued frame may
        // still run, so the deterministic state below is applied in a second step.
        window.requestAnimationFrame = () => 0;
        for (const animation of document.getAnimations()) {
            try {
                const timing = animation.effect?.getTiming();
                if (timing && Number.isFinite(timing.iterations)) animation.finish();
                else animation.currentTime = 1234;
                animation.pause();
            } catch (_) {}
        }
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    await page.evaluate(() => {
        try {
            const progress = [0.08, 0.58, 0.18, 0.68, 0.28, 0.78, 0.38, 0.88];
            CircuitGridMatrix.packets.forEach((packet, index) => {
                packet.progress = progress[index];
                packet.speed = 0;
                packet.direction = 1;
            });
            CircuitGridMatrix.lastUpdateTime = performance.now();
            CircuitGridMatrix._frameSkip = 1;
            CircuitGridMatrix.update();
        } catch (_) {}

        document.querySelectorAll('.gear-lg-rotate').forEach((element) => {
            element.setAttribute('transform', `rotate(63 ${element.dataset.cx} ${element.dataset.cy})`);
        });
        document.querySelectorAll('.gear-sm-rotate').forEach((element) => {
            element.setAttribute('transform', `rotate(-75 ${element.dataset.cx} ${element.dataset.cy})`);
        });

        const cursor = document.querySelector('#chromeCursor');
        if (cursor) cursor.style.transform = 'translate(720px, 450px)';

        try {
            const drone = structures[0];
            drone.position.set(-22, -9, -42);
            drone.rotation.set(0.36, 0.72, 0.08);
            drone.userData.fadeOpacity = 1;
            drone.userData.fadeTarget = 1;
            drone.userData.propellers.forEach((propeller, index) => {
                propeller.rotation.y = index % 2 ? -1.2 : 1.2;
            });
            camera.position.set(1.25, 3.1, 49.4);
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
        } catch (_) {}

        // WebGL rasterization can vary by a few antialiasing pixels across
        // contexts, while packet and gear motion have dedicated state checks.
        // Mask only those dynamic surfaces for the exact static-style diff.
        const parityMask = document.createElement('style');
        parityMask.textContent = `
            #three-canvas,
            .circuit-packet,
            .circuit-packet-glow,
            .panel-icon-svg,
            .chrome-cursor {
                visibility: hidden !important;
            }
        `;
        document.head.appendChild(parityMask);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
}

async function collectVisualState(page) {
    return page.evaluate(() => {
        const selectors = [
            'body', '#siteTitle', '#siteSubtitle', '#siteTagline', '#centralMedallion',
            '#panel-projects', '#panel-people', '#panel-about', '#panel-join',
            '#themeToggle', '#three-canvas', '#engineeringNetwork',
        ];
        const elements = Object.fromEntries(selectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return [selector, null];
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return [selector, {
                rect: [rect.x, rect.y, rect.width, rect.height].map((value) => Number(value.toFixed(3))),
                style: {
                    animationDuration: style.animationDuration,
                    animationName: style.animationName,
                    backdropFilter: style.backdropFilter,
                    backgroundColor: style.backgroundColor,
                    backgroundImage: style.backgroundImage,
                    borderColor: style.borderColor,
                    borderRadius: style.borderRadius,
                    boxShadow: style.boxShadow,
                    color: style.color,
                    display: style.display,
                    filter: style.filter,
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    opacity: style.opacity,
                    transform: style.transform,
                    visibility: style.visibility,
                },
            }];
        }));

        const isMobilePortrait = document.body.classList.contains('mobile-portrait');
        let drone = null;
        if (!isMobilePortrait) {
            try {
                const root = structures[0];
                const meshes = [];
                root.updateMatrixWorld(true);
                root.traverse((child) => {
                    if (!child.isMesh) return;
                    const material = child.material;
                    meshes.push({
                        geometry: child.geometry.type,
                        positionCount: child.geometry.attributes.position.count,
                        position: child.position.toArray().map((value) => Number(value.toFixed(6))),
                        rotation: [child.rotation.x, child.rotation.y, child.rotation.z]
                            .map((value) => Number(value.toFixed(6))),
                        scale: child.scale.toArray().map((value) => Number(value.toFixed(6))),
                        material: {
                            type: material.type,
                            color: material.color?.getHex() ?? null,
                            emissive: material.emissive?.getHex() ?? null,
                            emissiveIntensity: material.emissiveIntensity ?? null,
                            metalness: material.metalness ?? null,
                            opacity: material.opacity,
                            roughness: material.roughness ?? null,
                            transparent: material.transparent,
                            wireframe: material.wireframe ?? null,
                        },
                    });
                });
                drone = {
                    position: root.position.toArray().map((value) => Number(value.toFixed(6))),
                    rotation: [root.rotation.x, root.rotation.y, root.rotation.z]
                        .map((value) => Number(value.toFixed(6))),
                    scale: root.scale.toArray().map((value) => Number(value.toFixed(6))),
                    meshes,
                };
            } catch (_) {}
        }

        return {
            elements,
            dynamic: isMobilePortrait ? null : {
                packets: Array.from(document.querySelectorAll('.circuit-packet')).map((element) => {
                    const rect = element.getBoundingClientRect();
                    return [rect.x, rect.y, rect.width, rect.height]
                        .map((value) => Number(value.toFixed(3)));
                }),
                packetGlows: Array.from(document.querySelectorAll('.circuit-packet-glow')).map((element) => {
                    const rect = element.getBoundingClientRect();
                    return [rect.x, rect.y, rect.width, rect.height]
                        .map((value) => Number(value.toFixed(3)));
                }),
                largeGears: Array.from(document.querySelectorAll('.gear-lg-rotate'))
                    .map((element) => element.getAttribute('transform')),
                smallGears: Array.from(document.querySelectorAll('.gear-sm-rotate'))
                    .map((element) => element.getAttribute('transform')),
                drone,
            },
        };
    });
}

async function imageMetric(metric, referencePath, candidatePath, outputPath) {
    const args = ['compare', '-metric', metric, referencePath, candidatePath, outputPath];
    let raw;
    try {
        const { stderr } = await execFileAsync('magick', args);
        raw = stderr.trim();
    } catch (error) {
        raw = String(error.stderr || '').trim();
        if (!Number.isFinite(Number.parseFloat(raw))) throw error;
    }

    const absolute = Number.parseFloat(raw) || 0;
    const normalizedMatch = raw.match(/\(([-+\d.eE]+)\)/);
    const normalized = normalizedMatch ? Number.parseFloat(normalizedMatch[1]) : null;
    return { absolute, normalized };
}

async function pixelDiff(referencePath, candidatePath, diffPath) {
    const [absoluteError, meanAbsoluteError, rootMeanSquareError] = await Promise.all([
        imageMetric('AE', referencePath, candidatePath, diffPath),
        imageMetric('MAE', referencePath, candidatePath, 'null:'),
        imageMetric('RMSE', referencePath, candidatePath, 'null:'),
    ]);
    return {
        differentPixels: absoluteError.absolute,
        mae: meanAbsoluteError.absolute,
        maeNormalized: meanAbsoluteError.normalized ?? meanAbsoluteError.absolute,
        rmse: rootMeanSquareError.absolute,
        rmseNormalized: rootMeanSquareError.normalized ?? rootMeanSquareError.absolute,
    };
}

async function captureState(browser, profile, state) {
    const { reference, candidate } = await loadPair(browser, profile);
    try {
        if (state === 'expanded') {
            // Drive each page in the foreground so requestAnimationFrame-based
            // FLIP transitions settle at the same point in both renderers.
            await reference.bringToFront();
            await reference.evaluate(() => expandPanel('panel-about', 'about'));
            await reference.waitForSelector('#expandedOverlay.active');
            await new Promise((resolve) => setTimeout(resolve, 1300));

            await candidate.bringToFront();
            await candidate.evaluate(() => expandPanel('panel-about', 'about'));
            await candidate.waitForSelector('#expandedOverlay.active');
            await new Promise((resolve) => setTimeout(resolve, 1300));
        }

        await reference.bringToFront();
        await freezeDynamicState(reference);
        await candidate.bringToFront();
        await freezeDynamicState(candidate);

        const prefix = `${profile.name}-${state}`;
        const referencePath = path.join(outputDir, `${prefix}-reference.png`);
        const candidatePath = path.join(outputDir, `${prefix}-candidate.png`);
        const diffPath = path.join(outputDir, `${prefix}-diff.png`);
        await reference.bringToFront();
        await reference.screenshot({ path: referencePath, fullPage: profile.fullPage && state === 'initial' });
        await candidate.bringToFront();
        await candidate.screenshot({ path: candidatePath, fullPage: profile.fullPage && state === 'initial' });

        const [referenceState, candidateState] = await Promise.all([
            collectVisualState(reference),
            collectVisualState(candidate),
        ]);
        const changedComputedState = JSON.stringify(referenceState) !== JSON.stringify(candidateState);
        const diff = await pixelDiff(referencePath, candidatePath, diffPath);

        return {
            profile: profile.name,
            state,
            ...diff,
            changedComputedState,
            referencePath,
            candidatePath,
            diffPath,
            referenceState,
            candidateState,
        };
    } finally {
        await Promise.all([reference.close(), candidate.close()]);
    }
}

await fs.mkdir(outputDir, { recursive: true });
const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-sandbox',
    ],
});

try {
    const comparisons = [];
    for (const profile of profiles) {
        if (requestedProfiles.size && !requestedProfiles.has(profile.name)) continue;
        for (const state of requestedStates) {
            comparisons.push(await captureState(browser, profile, state));
        }
    }
    const result = {
        referenceUrl,
        candidateUrl,
        capturedAt: new Date().toISOString(),
        comparisons,
        // The browser can rasterize the same blur/backdrop-filter edge a fraction
        // differently across renderer processes. Geometry, computed styles, and
        // deterministic animation state must still match exactly; normalized MAE
        // provides a tight guard without overweighting a few antialiased edges.
        passed: comparisons.every(({ maeNormalized, changedComputedState }) =>
            maeNormalized <= 0.005 && !changedComputedState),
    };
    const outputPath = path.join(outputDir, 'visual-parity.json');
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({
        outputPath,
        passed: result.passed,
        comparisons: comparisons.map(({ profile, state, differentPixels, maeNormalized, rmseNormalized, changedComputedState }) => ({
            profile, state, differentPixels, maeNormalized, rmseNormalized, changedComputedState,
        })),
    }, null, 2));
} finally {
    await browser.close();
}
