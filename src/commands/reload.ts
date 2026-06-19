import * as vscode from 'vscode';

interface CommandEntry {
    id: string;
    args?: unknown[];
}

interface ReloadAction {
    command?: string | CommandEntry | (string | CommandEntry)[];
    task?: string;
}

export async function reloadCommand(): Promise<void> {
    const action = vscode.workspace.getConfiguration('ethos-devtools').get<ReloadAction>('reload') ?? {};

    if (action.command) {
        const commands = Array.isArray(action.command) ? action.command : [action.command];
        for (const entry of commands) {
            const id = typeof entry === 'string' ? entry : entry.id;
            const args = typeof entry === 'string' ? [] : (entry.args ?? []);
            try {
                await vscode.commands.executeCommand(id, ...args);
            } catch (err) {
                console.error(`Ethos DevTools: command '${id}' failed:`, err);
            }
        }
    } else if (action.task) {
        vscode.commands
            .executeCommand('workbench.action.tasks.runTask', action.task)
            .then(undefined, (err) => console.error(`Ethos DevTools: task '${action.task}' failed:`, err));
    }
}
