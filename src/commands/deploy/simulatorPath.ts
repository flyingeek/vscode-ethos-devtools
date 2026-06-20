import * as vscode from 'vscode';
import * as path from 'path';
import { resolvePath } from './utils';

export interface SimulatorScriptsLocation {
    destBase: string;
    scriptsPath: string;
}

export function resolveSimulatorScriptsLocation(
    workspaceRoot: string,
    errorPrefix = 'Ethos Deploy'
): SimulatorScriptsLocation | undefined {
    const ethosConfig = vscode.workspace.getConfiguration('ethos');
    const simulatorsFolder = ethosConfig.get<string>('simulatorsFolder');
    const board = ethosConfig.get<string>('board');
    const protocol = ethosConfig.get<string>('protocol');
    const release = ethosConfig.get<string>('release');

    const missing: string[] = [];
    if (!simulatorsFolder) { missing.push('ethos.simulatorsFolder'); }
    if (!board)            { missing.push('ethos.board'); }
    if (!protocol)         { missing.push('ethos.protocol'); }
    if (!release)          { missing.push('ethos.release'); }
    if (missing.length > 0) {
        vscode.window.showErrorMessage(`${errorPrefix}: missing settings: ${missing.join(', ')}`);
        return undefined;
    }

    const destBase = resolvePath(simulatorsFolder!, workspaceRoot);
    const scriptsPath = path.join(destBase, `${board!}_${protocol!}@${release!}`, 'scripts');
    return { destBase, scriptsPath };
}
