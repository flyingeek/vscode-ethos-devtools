import * as vscode from 'vscode';
import { installThemeCommand } from './installTheme';
import { installAudioPackCommand } from './installAudioPack.js';

export async function openInstallerCommand(extensionUri: vscode.Uri, context: vscode.ExtensionContext): Promise<void> {
    const action = await vscode.window.showQuickPick(
        [
            {
                label: 'Install Theme',
                description: 'Download a theme archive and install it to the simulator scripts folder',
            },
            {
                label: 'Install Audio Pack',
                description: 'Install an audio-*.zip asset from the ETHOS community release selected by ethos.release',
            },
        ],
        {
            title: 'Ethos DevTools: Installer',
            placeHolder: 'Select an action',
        }
    );

    if (!action) {
        return;
    }

    if (action.label === 'Install Theme') {
        await installThemeCommand(context);
        return;
    }

    if (action.label === 'Install Audio Pack') {
        await installAudioPackCommand(context);
    }
}
