import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveSimulatorScriptsLocation } from '../deploy/simulatorPath';
import { getInstallerOutputChannel } from './outputChannel';
import { createCache } from './cache';

interface ThemeEntry {
    download: string;
    version?: string;
}

type ThemeCatalog = Record<string, ThemeEntry>;

interface ThemeQuickPickItem extends vscode.QuickPickItem {
    themeName: string;
    installAll?: boolean;
}

const THEMES_LIST_URL = 'https://github.com/flyingeek/ethos-themes/releases/latest/download/themes.json';
const THEMES_CACHE_KEY = 'themesCatalog';
const THEMES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const themeCache = createCache<ThemeCatalog>(THEMES_CACHE_TTL_MS);

async function fetchThemesCatalog(): Promise<ThemeCatalog> {
    const response = await fetch(THEMES_LIST_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as ThemeCatalog;
    if (typeof data !== 'object' || data === null) {
        throw new Error('Invalid themes catalog format');
    }
    return data;
}

function compareVersions(a: string, b: string): number {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function readInstalledThemeVersion(scriptsPath: string, themeName: string): Promise<string | undefined> {
    const manifestPath = path.join(scriptsPath, themeName, 'ethos_lua_manifest.json');
    try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const parsed = JSON.parse(raw) as { version?: unknown };
        if (typeof parsed.version === 'string' && parsed.version.trim() !== '') {
            return parsed.version.trim();
        }
    } catch {
        // Not installed or invalid manifest.
    }
    return undefined;
}

function sanitizeZipEntry(entryName: string, themeName: string): string {
    const normalized = path.posix.normalize(entryName).replace(/^\/+/, '');
    if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw new Error(`Unsafe zip entry path: ${entryName}`);
    }

    const parts = normalized.split('/').filter(Boolean);
    const trimmed = parts[0] === themeName ? parts.slice(1) : parts;
    const relativePath = trimmed.join('/');
    if (!relativePath) {
        return '';
    }

    const relativeNormalized = path.posix.normalize(relativePath);
    if (relativeNormalized === '..' || relativeNormalized.startsWith('../')) {
        throw new Error(`Unsafe zip entry path after trimming: ${entryName}`);
    }

    return relativeNormalized;
}

async function installThemeFromZip(zipBytes: Buffer, themeName: string, targetDir: string): Promise<number> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipBytes);
    const targetRoot = path.resolve(targetDir);
    let copiedCount = 0;

    for (const entry of Object.values(zip.files)) {
        if (entry.dir) {
            continue;
        }

        const relPath = sanitizeZipEntry(entry.name, themeName);
        if (!relPath) {
            continue;
        }

        const absolutePath = path.resolve(targetDir, relPath);
        if (absolutePath !== targetRoot && !absolutePath.startsWith(targetRoot + path.sep)) {
            throw new Error(`Blocked zip entry outside target directory: ${entry.name}`);
        }

        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        const content = await entry.async('nodebuffer');
        await fs.writeFile(absolutePath, content);
        copiedCount++;
    }

    return copiedCount;
}

async function downloadAndInstallTheme(themeName: string, downloadUrl: string, targetDir: string): Promise<number> {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
        throw new Error(`download failed: HTTP ${response.status}`);
    }

    const zipBytes = Buffer.from(await response.arrayBuffer());
    await fs.mkdir(targetDir, { recursive: true });
    return installThemeFromZip(zipBytes, themeName, targetDir);
}

export async function installThemeCommand(context: vscode.ExtensionContext): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('Ethos Themes: no workspace folder open.');
        return;
    }

    const channel = getInstallerOutputChannel();
    channel.show(true);
    channel.appendLine(`\n--- Ethos Themes: ${new Date().toLocaleTimeString()} ---`);

    let catalog: ThemeCatalog;
    const cachedCatalog = themeCache.read(THEMES_CACHE_KEY, context);
    if (cachedCatalog) {
        catalog = cachedCatalog;
        channel.appendLine('  cache   : hit');
    } else {
        try {
            catalog = await fetchThemesCatalog();
            await themeCache.store(THEMES_CACHE_KEY, catalog, context);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Ethos Themes: could not load themes list (${message}).`);
            return;
        }
    }

    const themeNames = Object.keys(catalog)
        .filter(name => name.startsWith('theme-'))
        .sort((a, b) => a.localeCompare(b));

    if (themeNames.length === 0) {
        vscode.window.showWarningMessage('Ethos Themes: no theme-* entries found in catalog.');
        return;
    }

    const simulatorLocation = resolveSimulatorScriptsLocation(workspaceRoot, 'Ethos Themes');
    if (!simulatorLocation) {
        return;
    }

    const pickItems: ThemeQuickPickItem[] = await Promise.all(
        themeNames.map(async (themeName) => {
            const availableVersion = catalog[themeName]?.version;
            const installedVersion = await readInstalledThemeVersion(simulatorLocation.scriptsPath, themeName);

            let description: string | undefined;
            if (!installedVersion) {
                description = availableVersion ? `Install v${availableVersion}` : 'Install';
            } else if (availableVersion && compareVersions(installedVersion, availableVersion) < 0) {
                description = `Update ${installedVersion} -> v${availableVersion}`;
            } else {
                description = `Already installed ${installedVersion}`;
            }

            return {
                label: themeName,
                themeName,
                description,
            };
        })
    );

    const allThemesItem: ThemeQuickPickItem = {
        label: 'Install all themes',
        themeName: '__all__',
        installAll: true,
        description: `${themeNames.length} theme(s)`,
    };

    const picked = await vscode.window.showQuickPick(
        [allThemesItem, ...pickItems],
        {
            title: 'Ethos DevTools: Install Theme',
            placeHolder: 'Select a theme to install (reload simulator after installation)',
            matchOnDescription: true,
        }
    );

    if (!picked) {
        return;
    }

    if (picked.installAll) {
        const existingThemes: string[] = [];
        for (const themeName of themeNames) {
            const themeDir = path.join(simulatorLocation.scriptsPath, themeName);
            try {
                await fs.access(themeDir);
                existingThemes.push(themeName);
            } catch {
                // Not installed.
            }
        }

        let replaceExisting = false;
        if (existingThemes.length > 0) {
            const selection = await vscode.window.showWarningMessage(
                `Ethos Themes: ${existingThemes.length} theme(s) already exist. How should install all handle them?`,
                { modal: true },
                'Replace existing',
                'Skip existing'
            );

            if (!selection) {
                return;
            }

            replaceExisting = selection === 'Replace existing';
        }

        let installedCount = 0;
        let skippedCount = 0;
        const failedThemes: string[] = [];

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Ethos Themes: Installing all themes...',
                cancellable: false,
            },
            async (progress) => {
                for (let i = 0; i < themeNames.length; i++) {
                    const themeName = themeNames[i];
                    const theme = catalog[themeName];
                    const targetDir = path.join(simulatorLocation.scriptsPath, themeName);

                    const increment = i === 0 ? 0 : (100 / themeNames.length);
                    progress.report({
                        increment,
                        message: `Installing ${themeName} (${i + 1}/${themeNames.length})...`,
                    });

                    if (!theme?.download) {
                        channel.appendLine(`  theme   : ${themeName}`);
                        channel.appendLine('  status  : skipped (no download URL)');
                        failedThemes.push(`${themeName} (no download URL)`);
                        continue;
                    }

                    let exists = false;
                    try {
                        await fs.access(targetDir);
                        exists = true;
                    } catch {
                        // Missing, install fresh.
                    }

                    if (exists && !replaceExisting) {
                        channel.appendLine(`  theme   : ${themeName}`);
                        channel.appendLine('  status  : skipped (already installed)');
                        skippedCount++;
                        continue;
                    }

                    try {
                        if (exists) {
                            await fs.rm(targetDir, { recursive: true, force: true });
                        }

                        channel.appendLine(`  theme   : ${themeName}`);
                        channel.appendLine(`  source  : ${theme.download}`);
                        channel.appendLine(`  target  : ${targetDir}`);

                        const copiedCount = await downloadAndInstallTheme(themeName, theme.download, targetDir);
                        channel.appendLine(`  copied  : ${copiedCount} file(s)`);
                        installedCount++;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        channel.appendLine(`  status  : failed (${message})`);
                        failedThemes.push(`${themeName} (${message})`);
                    }
                }

                progress.report({ increment: 100 / themeNames.length });
            }
        );

        const summary = `Ethos Themes: installed ${installedCount}, skipped ${skippedCount}, failed ${failedThemes.length}.`;
        if (failedThemes.length > 0) {
            vscode.window.showWarningMessage(summary);
            channel.appendLine(`  failed  : ${failedThemes.join(', ')}`);
        } else {
            vscode.window.showInformationMessage(summary);
        }
        return;
    }

    const themeName = picked.themeName;
    const theme = catalog[themeName];
    if (!theme?.download) {
        vscode.window.showErrorMessage(`Ethos Themes: selected theme "${themeName}" has no download URL.`);
        return;
    }

    const targetDir = path.join(simulatorLocation.scriptsPath, themeName);
    try {
        await fs.access(targetDir);
        const overwrite = await vscode.window.showWarningMessage(
            `Ethos Themes: "${themeName}" already exists. Replace it?`,
            { modal: true },
            'Replace'
        );
        if (overwrite !== 'Replace') {
            return;
        }

        await fs.rm(targetDir, { recursive: true, force: true });
    } catch {
        // Destination does not exist yet.
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Ethos Themes: Installing ${themeName}...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ message: 'Downloading theme archive...' });
            channel.appendLine(`  theme   : ${themeName}`);
            channel.appendLine(`  source  : ${theme.download}`);
            channel.appendLine(`  target  : ${targetDir}`);
            progress.report({ message: 'Extracting files...' });
            const copiedCount = await downloadAndInstallTheme(themeName, theme.download, targetDir);
            channel.appendLine(`  copied  : ${copiedCount} file(s)`);
        }
    );

    vscode.window.showInformationMessage(
        `Ethos Themes: Installed ${themeName} to ${path.relative(simulatorLocation.destBase, targetDir)}`
    );
}
