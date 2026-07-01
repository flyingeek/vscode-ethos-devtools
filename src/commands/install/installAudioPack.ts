import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveSimulatorScriptsLocation } from '../deploy/simulatorPath';
import { getInstallerOutputChannel } from './outputChannel';
import { createCache } from './cache';

interface GitHubReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface GitHubReleaseResponse {
    assets?: GitHubReleaseAsset[];
}

interface AudioPackItem extends vscode.QuickPickItem {
    name: string;
    downloadUrl: string;
}

const AUDIO_PACK_CACHE_KEY_PREFIX = 'audioPackCatalog:';
const AUDIO_PACK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const audioPackCache = createCache<AudioPackItem[]>(AUDIO_PACK_CACHE_TTL_MS);

function extractLocaleFromAudioPackName(name: string): string | undefined {
    const match = /^audio-([a-z0-9-]+)\.zip$/i.exec(name);
    return match?.[1]?.toLowerCase();
}

function formatAudioPackLabel(name: string): string {
    return name.replace(/\.zip$/i, '');
}

function sanitizeZipEntry(entryName: string): string {
    const normalized = path.posix.normalize(entryName).replace(/^\/+/, '');
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw new Error(`Unsafe zip entry path: ${entryName}`);
    }
    return normalized;
}

function mapAudioZipEntryToAudioRelativePath(entryName: string, expectedLocale: string): string {
    const normalized = sanitizeZipEntry(entryName);
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length < 2) {
        return '';
    }

    const rootLocale = parts[0].toLowerCase();
    if (rootLocale !== expectedLocale) {
        return '';
    }

    const relPath = parts.join('/');
    const relNormalized = path.posix.normalize(relPath);
    if (!relNormalized || relNormalized === '.' || relNormalized === '..' || relNormalized.startsWith('../')) {
        throw new Error(`Unsafe audio pack entry path: ${entryName}`);
    }

    return relNormalized;
}

async function fetchAudioPackAssetsByReleaseTag(releaseTag: string): Promise<AudioPackItem[]> {
    const apiUrl = `https://api.github.com/repos/FrSkyRC/ETHOS-Feedback-Community/releases/tags/${encodeURIComponent(releaseTag)}`;
    const response = await fetch(apiUrl, {
        headers: {
            Accept: 'application/vnd.github+json',
        },
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`release tag not found: ${releaseTag}`);
        }
        throw new Error(`GitHub API error: HTTP ${response.status}`);
    }

    const payload = await response.json() as GitHubReleaseResponse;
    const assets = payload.assets ?? [];

    return assets
        .filter((asset) => /^audio-.*\.zip$/i.test(asset.name))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((asset) => ({
            label: formatAudioPackLabel(asset.name),
            name: asset.name,
            downloadUrl: asset.browser_download_url,
        }));
}

function getAudioPackCacheKey(releaseTag: string): string {
    return `${AUDIO_PACK_CACHE_KEY_PREFIX}${releaseTag}`;
}

async function installAudioPackFromZip(zipBytes: Buffer, targetAudioDir: string, expectedLocale: string): Promise<number> {
    const { unzipSync } = await import('fflate');
    const entries = unzipSync(new Uint8Array(zipBytes));
    const targetRoot = path.resolve(targetAudioDir);
    let copiedCount = 0;

    for (const [entryName, content] of Object.entries(entries)) {
        if (entryName.endsWith('/')) {
            continue;
        }

        const relPath = mapAudioZipEntryToAudioRelativePath(entryName, expectedLocale);
        if (!relPath) {
            continue;
        }

        const absolutePath = path.resolve(targetAudioDir, relPath);
        if (absolutePath !== targetRoot && !absolutePath.startsWith(targetRoot + path.sep)) {
            throw new Error(`Blocked zip entry outside target directory: ${entryName}`);
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, content);
        copiedCount++;
    }

    return copiedCount;
}

export async function installAudioPackCommand(context: vscode.ExtensionContext): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Ethos Audio: no workspace folder open.');
        return;
    }

    const releaseTag = vscode.workspace.getConfiguration('ethos').get<string>('release');
    if (!releaseTag) {
        vscode.window.showErrorMessage('Ethos Audio: missing setting ethos.release.');
        return;
    }

    const simulatorLocation = resolveSimulatorScriptsLocation(workspaceRoot, 'Ethos Audio');
    if (!simulatorLocation) {
        return;
    }

    const channel = getInstallerOutputChannel();
    channel.show(true);
    channel.appendLine(`\n--- Ethos Audio Packs: ${new Date().toLocaleTimeString()} ---`);

    let audioPacks: AudioPackItem[];
    const cacheKey = getAudioPackCacheKey(releaseTag);
    const cachedAudioPacks = audioPackCache.read(cacheKey, context);
    if (cachedAudioPacks) {
        audioPacks = cachedAudioPacks;
        channel.appendLine(`  cache   : hit (${releaseTag})`);
    } else {
        try {
            audioPacks = await fetchAudioPackAssetsByReleaseTag(releaseTag);
            await audioPackCache.store(cacheKey, audioPacks, context);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Ethos Audio: could not fetch assets (${message}).`);
            return;
        }
    }

    if (audioPacks.length === 0) {
        vscode.window.showWarningMessage(`Ethos Audio: no audio-*.zip assets found for release ${releaseTag}.`);
        return;
    }

    const targetAudioDir = path.join(path.dirname(simulatorLocation.scriptsPath), 'audio');
    const audioPacksWithStatus: AudioPackItem[] = await Promise.all(
        audioPacks.map(async (pack) => {
            const locale = extractLocaleFromAudioPackName(pack.name);
            if (!locale) {
                return pack;
            }

            const targetLocaleDir = path.join(targetAudioDir, locale);
            try {
                await fs.access(targetLocaleDir);
                return {
                    ...pack,
                    description: 'Already installed',
                };
            } catch {
                return pack;
            }
        })
    );

    const picked = await vscode.window.showQuickPick(audioPacksWithStatus, {
        title: 'Ethos DevTools: Install Audio Pack',
        placeHolder: `Select an audio pack for ${releaseTag} (reload the sim after installing)`,
    });

    if (!picked) {
        return;
    }

    const locale = extractLocaleFromAudioPackName(picked.name);
    if (!locale) {
        vscode.window.showErrorMessage(`Ethos Audio: could not infer locale from ${picked.name}.`);
        return;
    }

    const targetLocaleDir = path.join(targetAudioDir, locale);
    try {
        await fs.access(targetLocaleDir);
        const overwrite = await vscode.window.showWarningMessage(
            `Ethos Audio: existing audio/${locale} folder found. Replace it?`,
            { modal: true },
            'Replace'
        );
        if (overwrite !== 'Replace') {
            return;
        }

        await fs.rm(targetLocaleDir, { recursive: true, force: true });
    } catch {
        // audio/<locale> does not exist yet.
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Ethos Audio: Installing ${picked.name}...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Downloading audio pack...' });
            channel.appendLine(`  pack    : ${picked.name}`);
            channel.appendLine(`  release : ${releaseTag}`);
            channel.appendLine(`  target  : ${targetAudioDir}`);

            const response = await fetch(picked.downloadUrl);
            if (!response.ok) {
                throw new Error(`download failed: HTTP ${response.status}`);
            }

            const zipBytes = Buffer.from(await response.arrayBuffer());
            progress.report({ message: 'Extracting audio files...' });
            await fs.mkdir(targetAudioDir, { recursive: true });
            const copiedCount = await installAudioPackFromZip(zipBytes, targetAudioDir, locale);
            channel.appendLine(`  copied  : ${copiedCount} file(s)`);

            if (copiedCount === 0) {
                throw new Error(`No ${locale}/* files found in selected audio pack.`);
            }
        }
    );

    vscode.window.showInformationMessage(
        `Ethos Audio: Installed ${picked.name} to ${path.relative(simulatorLocation.destBase, targetAudioDir)}`
    );
}
