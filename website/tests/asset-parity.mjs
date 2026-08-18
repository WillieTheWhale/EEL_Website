import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function readArg(name, fallback) {
    const prefix = `--${name}=`;
    const value = process.argv.find((arg) => arg.startsWith(prefix));
    return value ? value.slice(prefix.length) : fallback;
}

const referenceRoot = path.resolve(readArg('reference', '.'));
const candidateRoot = path.resolve(readArg('candidate', '.'));
const outputPath = path.resolve(readArg('output', './asset-parity.json'));
const extensions = new Set(['.jpg', '.jpeg', '.jfif', '.png']);

async function listAssets(root) {
    const assets = [];
    for (const directory of ['images', 'headshots']) {
        const directoryPath = path.join(root, directory);
        for (const entry of await fs.readdir(directoryPath, { withFileTypes: true })) {
            if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
                assets.push(path.join(directory, entry.name));
            }
        }
    }
    return assets.sort();
}

async function identify(filePath) {
    const { stdout } = await execFileAsync('magick', [
        'identify', '-format', '%wx%h|%[interlace]', filePath,
    ]);
    const [dimensions, interlace] = stdout.trim().split('|');
    return { dimensions, interlace };
}

async function absolutePixelError(referencePath, candidatePath) {
    try {
        const { stderr } = await execFileAsync('magick', [
            'compare', '-metric', 'AE', referencePath, candidatePath, 'null:',
        ]);
        return Number.parseFloat(stderr) || 0;
    } catch (error) {
        const parsed = Number.parseFloat(String(error.stderr || ''));
        if (Number.isFinite(parsed)) return parsed;
        throw error;
    }
}

const assets = await listAssets(referenceRoot);
const comparisons = [];

for (const relativePath of assets) {
    const referencePath = path.join(referenceRoot, relativePath);
    const candidatePath = path.join(candidateRoot, relativePath);
    const [referenceStat, candidateStat, referenceInfo, candidateInfo, pixelError] = await Promise.all([
        fs.stat(referencePath),
        fs.stat(candidatePath),
        identify(referencePath),
        identify(candidatePath),
        absolutePixelError(referencePath, candidatePath),
    ]);
    comparisons.push({
        relativePath,
        referenceBytes: referenceStat.size,
        candidateBytes: candidateStat.size,
        savedBytes: referenceStat.size - candidateStat.size,
        dimensionsMatch: referenceInfo.dimensions === candidateInfo.dimensions,
        interlaceMatch: referenceInfo.interlace === candidateInfo.interlace,
        absolutePixelError: pixelError,
    });
}

const totals = comparisons.reduce((result, comparison) => {
    result.referenceBytes += comparison.referenceBytes;
    result.candidateBytes += comparison.candidateBytes;
    result.savedBytes += comparison.savedBytes;
    if (comparison.savedBytes > 0) result.optimizedAssets++;
    return result;
}, { referenceBytes: 0, candidateBytes: 0, savedBytes: 0, optimizedAssets: 0 });

const result = {
    referenceRoot,
    candidateRoot,
    capturedAt: new Date().toISOString(),
    totals,
    comparisons,
    passed: comparisons.every((comparison) =>
        comparison.absolutePixelError === 0 &&
        comparison.dimensionsMatch &&
        comparison.interlaceMatch),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, passed: result.passed, totals }, null, 2));
