import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const value = process.argv.find((arg) => arg.startsWith(prefix));
    return value ? value.slice(prefix.length) : fallback;
}

const url = readArg('url', 'http://127.0.0.1:3000/');
const outputPath = path.resolve(readArg('output', './smoke-results.json'));

async function configure(page, viewport) {
    await page.setViewport(viewport);
    await page.evaluateOnNewDocument(() => {
        localStorage.setItem('eel-has-visited', 'true');
        localStorage.setItem('eel-theme', 'dark');
        localStorage.setItem('eel-theme-manually-set', 'true');
    });
}

function monitor(page) {
    const errors = [];
    const failedRequests = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('requestfailed', (request) => {
        failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'unknown' });
    });
    return { errors, failedRequests };
}

async function waitUntilReady(page) {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForFunction(() =>
        document.querySelectorAll('.nav-panel.ready').length === 4 &&
        typeof radialPanelPhysics !== 'undefined' && radialPanelPhysics.initialized,
    { timeout: 15000 });
}

async function exercisePanel(page, panelId, expectedTitle) {
    await page.click(`#${panelId}`);
    await page.waitForFunction((title) =>
        document.querySelector('#expandedOverlay')?.classList.contains('active') &&
        document.querySelector('.expanded-title')?.textContent === title,
    { timeout: 5000 }, expectedTitle);
    await page.waitForFunction(() =>
        document.querySelector('.expanded-glass-container')?.classList.contains('blur-active'),
    { timeout: 3000 });
    await page.click('#closeBtn');
    await page.waitForFunction(() =>
        !document.querySelector('#expandedOverlay')?.classList.contains('active') &&
        typeof isExpanded !== 'undefined' && !isExpanded && !isCollapsing,
    { timeout: 5000 });
}

const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 120000,
    args: ['--no-sandbox'],
});

const result = { url, capturedAt: new Date().toISOString(), desktop: {}, mobile: {} };

try {
    const desktop = await browser.newPage();
    const desktopMonitor = monitor(desktop);
    await configure(desktop, {
        width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false,
    });
    await waitUntilReady(desktop);
    await desktop.waitForFunction(() => typeof renderer !== 'undefined' && !!renderer, { timeout: 15000 });

    for (const [panelId, title] of [
        ['panel-projects', 'Research Projects'],
        ['panel-people', 'Our Team'],
        ['panel-about', 'About the Experimental Engineering Lab'],
        ['panel-join', 'Join Our Lab'],
    ]) {
        await exercisePanel(desktop, panelId, title);
    }

    const initialTheme = await desktop.$eval('body', (body) => body.dataset.theme);
    await desktop.click('#themeToggle');
    const toggledTheme = await desktop.$eval('body', (body) => body.dataset.theme);
    await desktop.click('#themeToggle');
    const restoredTheme = await desktop.$eval('body', (body) => body.dataset.theme);

    const panelBox = await desktop.$eval('#panel-projects', (element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    const startX = panelBox.x + panelBox.width / 2;
    const startY = panelBox.y + panelBox.height / 2;
    await desktop.mouse.move(startX, startY);
    await desktop.mouse.down();
    await desktop.mouse.move(startX + 36, startY + 24, { steps: 5 });
    await desktop.mouse.up();
    const dragState = await desktop.evaluate(() => {
        const panel = radialPanelPhysics.panels.get('panel-projects');
        return {
            hasBeenMoved: panel.hasBeenMoved,
            anchorMatchesPosition:
                Math.abs(panel.anchorX - panel.position.x) < 0.001 &&
                Math.abs(panel.anchorY - panel.position.y) < 0.001,
        };
    });

    result.desktop = {
        panelsExercised: 4,
        theme: { initialTheme, toggledTheme, restoredTheme },
        dragState,
        renderer: await desktop.evaluate(() => ({
            geometries: renderer.info.memory.geometries,
            drawCalls: renderer.info.render.calls,
        })),
        ...desktopMonitor,
    };
    await desktop.close();

    const mobile = await browser.newPage();
    const mobileMonitor = monitor(mobile);
    await configure(mobile, {
        width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    });
    await waitUntilReady(mobile);
    await mobile.waitForFunction(() => document.body.classList.contains('mobile-portrait'));

    const portraitBefore = await mobile.evaluate(() => ({
        rendererCreated: typeof renderer !== 'undefined' && !!renderer,
        circuitInitialized: CircuitGridMatrix.initialized,
        circuitPackets: document.querySelectorAll('.circuit-packet').length,
        threeRequested: performance.getEntriesByType('resource')
            .some((entry) => entry.name.includes('three.min.js')),
    }));
    await exercisePanel(mobile, 'panel-about', 'About the Experimental Engineering Lab');

    await mobile.setViewport({
        width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    });
    await mobile.waitForFunction(() =>
        !document.body.classList.contains('mobile-portrait') &&
        typeof renderer !== 'undefined' && !!renderer &&
        CircuitGridMatrix.initialized,
    { timeout: 20000 });
    const landscape = await mobile.evaluate(() => ({
        rendererCreated: !!renderer,
        circuitInitialized: CircuitGridMatrix.initialized,
        circuitPackets: document.querySelectorAll('.circuit-packet').length,
        canvasDisplay: getComputedStyle(document.querySelector('#three-canvas')).display,
        threeRequested: performance.getEntriesByType('resource')
            .some((entry) => entry.name.includes('three.min.js')),
    }));

    await mobile.setViewport({
        width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    });
    await mobile.waitForFunction(() => document.body.classList.contains('mobile-portrait'));
    const portraitAfter = await mobile.evaluate(() => ({
        canvasDisplay: getComputedStyle(document.querySelector('#three-canvas')).display,
        networkDisplay: getComputedStyle(document.querySelector('#engineeringNetwork')).display,
    }));

    result.mobile = { portraitBefore, landscape, portraitAfter, ...mobileMonitor };
    await mobile.close();

    result.assertions = {
        noRuntimeErrors: result.desktop.errors.length === 0 && result.mobile.errors.length === 0,
        noFailedRequests:
            result.desktop.failedRequests.length === 0 && result.mobile.failedRequests.length === 0,
        allPanelsAndTheme:
            result.desktop.panelsExercised === 4 &&
            result.desktop.theme.initialTheme === 'dark' &&
            result.desktop.theme.toggledTheme === 'light' &&
            result.desktop.theme.restoredTheme === 'dark',
        dragPhysics: result.desktop.dragState.hasBeenMoved && result.desktop.dragState.anchorMatchesPosition,
        mobileStartsLean:
            !result.mobile.portraitBefore.rendererCreated &&
            !result.mobile.portraitBefore.circuitInitialized &&
            result.mobile.portraitBefore.circuitPackets === 0 &&
            !result.mobile.portraitBefore.threeRequested,
        landscapeRestoresVisualSystems:
            result.mobile.landscape.rendererCreated &&
            result.mobile.landscape.circuitInitialized &&
            result.mobile.landscape.circuitPackets === 8 &&
            result.mobile.landscape.canvasDisplay === 'block' &&
            result.mobile.landscape.threeRequested,
        portraitHidesVisualSystems:
            result.mobile.portraitAfter.canvasDisplay === 'none' &&
            result.mobile.portraitAfter.networkDisplay === 'none',
    };
    result.passed = Object.values(result.assertions).every(Boolean);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ outputPath, passed: result.passed, assertions: result.assertions }, null, 2));
} finally {
    await browser.close();
}
