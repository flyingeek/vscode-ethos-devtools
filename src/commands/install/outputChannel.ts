import * as vscode from 'vscode';

let installerOutputChannel: vscode.OutputChannel | undefined;

export function getInstallerOutputChannel(): vscode.OutputChannel {
    if (!installerOutputChannel) {
        installerOutputChannel = vscode.window.createOutputChannel('Ethos Installer');
    }
    return installerOutputChannel;
}
