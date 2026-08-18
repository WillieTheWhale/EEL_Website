import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const DEFAULT_DURATION_MS = 6000;

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const value = process.argv.find((arg) => arg.startsWith(prefix));
    return value ? value.slice(prefix.length) : fallback;
}

const targetUrl = readArg('url', 'http://127.0.0.1:3000/');
const label = readArg('label', 'benchmark');
const outputDir = path.resolve(readArg('output', './performance-results'));
const durationMs = Number(readArg('duration', DEFAULT_DURATION_MS));

const profiles = [
    {
        name: 'desktop',
        cpuThrottle: 4,
        viewport: {
            width: 1440,
            height: 900,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
        },
    },
    {
        name: 'mobile',
        cpuThrottle: 6,
        viewport: {
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
        },
    },
];

function metricsToObject(result) {
    return Object.fromEntries(result.metrics.map(({ name, value }) => [name, value]));
}

function metricDelta(before, after, name) {
    return (after[name] || 0) - (before[name] || 0);
}

function summarizeMetricWindow(before, after, elapsedMs) {
    const elapsedSeconds = elapsedMs / 1000;
    const taskDuration = metricDelta(before, after, 'TaskDuration');
    return {
        elapsedMs,
        taskDurationMs: taskDuration * 1000,
        mainThreadUtilization: taskDuration / elapsedSeconds,
        scriptDurationMs: metricDelta(before, after, 'ScriptDuration') * 1000,
        layoutDurationMs: metricDelta(before, after, 'LayoutDuration') * 1000,
        recalcStyleDurationMs: metricDelta(before, after, 'RecalcStyleDuration') * 1000,
        layoutCount: metricDelta(before, after, 'LayoutCount'),
        recalcStyleCount: metricDelta(before, after, 'RecalcStyleCount'),
    };
}

async function installDeterministicEnvironment(page) {
    await page.evaluateOnNewDocument(() => {
        let seed = 0x00E311AB;
        Math.random = () => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };

        localStorage.setItem('eel-has-visited', 'true');
        localStorage.setItem('eel-theme', 'dark');
        localStorage.setItem('eel-theme-manually-set', 'true');

        window.__eelPerf = {
            cls: 0,
            lcp: 0,
            longTasks: [],
        };

        try {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    window.__eelPerf.longTasks.push({
                        duration: entry.duration,
                        startTime: entry.startTime,
                    });
                }
            }).observe({ type: 'longtask', buffered: true });
        } catch (_) {}

        try {
            new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (!entry.hadRecentInput) window.__eelPerf.cls += entry.value;
                }
            }).observe({ type: 'layout-shift', buffered: true });
        } catch (_) {}

        try {
            new PerformanceObserver((list) => {
                const entries = list.getEntries();
                if (entries.length) {
                    window.__eelPerf.lcp = entries[entries.length - 1].startTime;
                }
            }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (_) {}
    });
}

async function sampleFrames(page, sampleDurationMs) {
    return page.evaluate((duration) => new Promise((resolve) => {
        const intervals = [];
        let previous;
        const started = performance.now();

        function finish() {
            const sorted = intervals.slice().sort((a, b) => a - b);
            const percentile = (fraction) => {
                if (!sorted.length) return 0;
                return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
            };
            const total = intervals.reduce((sum, value) => sum + value, 0);
            resolve({
                frames: intervals.length,
                elapsedMs: performance.now() - started,
                averageFrameMs: intervals.length ? total / intervals.length : 0,
                averageFps: total > 0 ? (intervals.length * 1000) / total : 0,
                p50FrameMs: percentile(0.50),
                p95FrameMs: percentile(0.95),
                p99FrameMs: percentile(0.99),
                framesOver20ms: intervals.filter((value) => value > 20).length,
                framesOver33ms: intervals.filter((value) => value > 33.34).length,
                framesOver50ms: intervals.filter((value) => value > 50).length,
            });
        }

        function onFrame(timestamp) {
            if (previous !== undefined) intervals.push(timestamp - previous);
            previous = timestamp;
            if (performance.now() - started >= duration) finish();
            else requestAnimationFrame(onFrame);
        }

        requestAnimationFrame(onFrame);
    }), sampleDurationMs);
}

async function collectPageState(page) {
    return page.evaluate(() => {
        const selectors = [
            'body',
            '#siteTitle',
            '#siteSubtitle',
            '#siteTagline',
            '#centralMedallion',
            '#panel-projects',
            '#panel-people',
            '#panel-about',
            '#panel-join',
            '#themeToggle',
            '#three-canvas',
            '#engineeringNetwork',
        ];

        const elementState = Object.fromEntries(selectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return [selector, null];
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return [selector, {
                rect: {
                    x: Number(rect.x.toFixed(3)),
                    y: Number(rect.y.toFixed(3)),
                    width: Number(rect.width.toFixed(3)),
                    height: Number(rect.height.toFixed(3)),
                },
                style: {
                    animationName: style.animationName,
                    animationDuration: style.animationDuration,
                    backdropFilter: style.backdropFilter,
                    backgroundColor: style.backgroundColor,
                    backgroundImage: style.backgroundImage,
                    borderColor: style.borderColor,
                    borderRadius: style.borderRadius,
                    boxShadow: style.boxShadow,
                    color: style.color,
                    filter: style.filter,
                    fontFamily: style.fontFamily,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight,
                    display: style.display,
                    opacity: style.opacity,
                    transform: style.transform,
                    visibility: style.visibility,
                },
            }];
        }));

        const resources = performance.getEntriesByType('resource');
        const navigation = performance.getEntriesByType('navigation')[0];
        const paints = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
        const canvas = document.querySelector('#three-canvas');

        let rendererInfo = null;
        try {
            rendererInfo = {
                memory: { ...renderer.info.memory },
                render: { ...renderer.info.render },
                programs: renderer.info.programs ? renderer.info.programs.length : null,
                pixelRatio: renderer.getPixelRatio(),
                drawingBuffer: {
                    width: renderer.domElement.width,
                    height: renderer.domElement.height,
                },
            };
        } catch (_) {}

        return {
            url: location.href,
            bodyClass: document.body.className,
            theme: document.body.dataset.theme,
            dom: {
                elements: document.querySelectorAll('*').length,
                svgElements: document.querySelectorAll('svg *').length,
                circuitPackets: document.querySelectorAll('.circuit-packet, .circuit-packet-glow').length,
                circuitJunctions: document.querySelectorAll('.circuit-junction').length,
            },
            canvas: canvas ? {
                cssWidth: canvas.clientWidth,
                cssHeight: canvas.clientHeight,
                width: canvas.width,
                height: canvas.height,
            } : null,
            rendererInfo,
            elements: elementState,
            loading: {
                domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd : null,
                loadMs: navigation ? navigation.loadEventEnd : null,
                firstPaintMs: paints['first-paint'] || null,
                firstContentfulPaintMs: paints['first-contentful-paint'] || null,
                requestCount: resources.length,
                transferBytes: resources.reduce((sum, resource) => sum + (resource.transferSize || 0), 0),
                decodedBytes: resources.reduce((sum, resource) => sum + (resource.decodedBodySize || 0), 0),
            },
            observed: {
                cls: window.__eelPerf.cls,
                lcpMs: window.__eelPerf.lcp,
                longTaskCount: window.__eelPerf.longTasks.length,
                longTaskTotalMs: window.__eelPerf.longTasks.reduce((sum, task) => sum + task.duration, 0),
                longestTaskMs: window.__eelPerf.longTasks.reduce((max, task) => Math.max(max, task.duration), 0),
            },
        };
    });
}

async function runProfile(browser, profile) {
    const page = await browser.newPage();
    const client = await page.createCDPSession();
    const errors = [];
    const failedRequests = [];

    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => {
        failedRequests.push({
            url: request.url(),
            error: request.failure()?.errorText || 'unknown',
        });
    });

    await page.setViewport(profile.viewport);
    await page.setCacheEnabled(false);
    await installDeterministicEnvironment(page);
    await client.send('Performance.enable');
    await client.send('Emulation.setCPUThrottlingRate', { rate: profile.cpuThrottle });

    const navigationStarted = performance.now();
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 60000 });
    const navigationWallTimeMs = performance.now() - navigationStarted;
    await new Promise((resolve) => setTimeout(resolve, 2600));

    const readyPanels = await page.$$eval('.nav-panel.ready', (panels) => panels.length);
    const initialScreenshot = path.join(outputDir, `${label}-${profile.name}-initial.png`);
    await page.screenshot({ path: initialScreenshot, fullPage: profile.name === 'mobile' });

    const idleBefore = metricsToObject(await client.send('Performance.getMetrics'));
    const idleFrames = await sampleFrames(page, durationMs);
    const idleAfter = metricsToObject(await client.send('Performance.getMetrics'));

    const interactionBefore = metricsToObject(await client.send('Performance.getMetrics'));
    const interactionFramesPromise = sampleFrames(page, durationMs);
    const interactionStarted = performance.now();
    const moves = Math.max(60, Math.round(durationMs / 20));
    for (let index = 0; index < moves; index++) {
        const progress = index / (moves - 1);
        const x = Math.round(20 + progress * (profile.viewport.width - 40));
        const y = Math.round(profile.viewport.height * (0.5 + Math.sin(progress * Math.PI * 6) * 0.35));
        await page.mouse.move(x, y);
        await new Promise((resolve) => setTimeout(resolve, 16));
    }
    const interactionFrames = await interactionFramesPromise;
    const interactionElapsedMs = performance.now() - interactionStarted;
    const interactionAfter = metricsToObject(await client.send('Performance.getMetrics'));

    const expansionBefore = metricsToObject(await client.send('Performance.getMetrics'));
    await page.click('#panel-projects');
    await page.waitForSelector('#expandedOverlay.active');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const expandedScreenshot = path.join(outputDir, `${label}-${profile.name}-expanded.png`);
    await page.screenshot({ path: expandedScreenshot, fullPage: false });
    const expansionAfter = metricsToObject(await client.send('Performance.getMetrics'));

    await page.click('#closeBtn');
    await page.waitForFunction(() => !document.querySelector('#expandedOverlay')?.classList.contains('active'));
    const finalState = await collectPageState(page);
    const finalMetrics = metricsToObject(await client.send('Performance.getMetrics'));

    const assertions = {
        noRuntimeErrors: errors.length === 0,
        noFailedRequests: failedRequests.length === 0,
        allPanelsReady: readyPanels === 4,
        correctMobileMode: profile.name === 'mobile'
            ? finalState.bodyClass.split(/\s+/).includes('mobile-portrait')
            : !finalState.bodyClass.split(/\s+/).includes('mobile-portrait'),
        canvasStateCorrect: profile.name === 'mobile'
            ? finalState.elements['#three-canvas']?.style.display === 'none' && !finalState.rendererInfo
            : Boolean(finalState.rendererInfo && finalState.canvas?.width && finalState.canvas?.height),
        panelCollapseCompleted: true,
    };

    await page.close();

    return {
        profile: profile.name,
        cpuThrottle: profile.cpuThrottle,
        viewport: profile.viewport,
        navigationWallTimeMs,
        assertions,
        errors,
        failedRequests,
        idle: {
            frames: idleFrames,
            mainThread: summarizeMetricWindow(idleBefore, idleAfter, idleFrames.elapsedMs),
        },
        interaction: {
            frames: interactionFrames,
            mainThread: summarizeMetricWindow(interactionBefore, interactionAfter, interactionElapsedMs),
        },
        expansion: summarizeMetricWindow(expansionBefore, expansionAfter, 1200),
        page: finalState,
        memory: {
            jsHeapUsedBytes: finalMetrics.JSHeapUsedSize,
            jsHeapTotalBytes: finalMetrics.JSHeapTotalSize,
            nodes: finalMetrics.Nodes,
            documents: finalMetrics.Documents,
            listeners: finalMetrics.JSEventListeners,
        },
        screenshots: {
            initial: initialScreenshot,
            expanded: expandedScreenshot,
        },
    };
}

await fs.mkdir(outputDir, { recursive: true });

const browser = await puppeteer.launch({
    headless: true,
    args: [
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--no-sandbox',
    ],
});

try {
    const results = [];
    for (const profile of profiles) {
        results.push(await runProfile(browser, profile));
    }

    const result = {
        label,
        targetUrl,
        capturedAt: new Date().toISOString(),
        durationMs,
        profiles: results,
    };
    const outputPath = path.join(outputDir, `${label}-metrics.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ outputPath, profiles: results.map(({ profile, assertions, idle, interaction }) => ({
        profile,
        assertions,
        idleFps: idle.frames.averageFps,
        idleMainThreadUtilization: idle.mainThread.mainThreadUtilization,
        interactionFps: interaction.frames.averageFps,
        interactionMainThreadUtilization: interaction.mainThread.mainThreadUtilization,
    })) }, null, 2));
} finally {
    await browser.close();
}
