import * as vscode from 'vscode';

interface CachedEntry<T> {
    savedAt: number;
    data: T;
}

export interface Cache<T> {
    read(key: string, context: vscode.ExtensionContext): T | undefined;
    store(key: string, data: T, context: vscode.ExtensionContext): Promise<void>;
}

export function createCache<T>(ttlMs: number): Cache<T> {
    const memoryCache = new Map<string, CachedEntry<T>>();

    function read(key: string, context: vscode.ExtensionContext): T | undefined {
        const now = Date.now();

        const memoryCached = memoryCache.get(key);
        if (memoryCached && now - memoryCached.savedAt <= ttlMs) {
            return memoryCached.data;
        }

        const persisted = context.globalState.get<CachedEntry<T>>(key);
        if (persisted && now - persisted.savedAt <= ttlMs) {
            memoryCache.set(key, persisted);
            return persisted.data;
        }

        return undefined;
    }

    async function store(key: string, data: T, context: vscode.ExtensionContext): Promise<void> {
        const entry: CachedEntry<T> = { savedAt: Date.now(), data };
        memoryCache.set(key, entry);
        await context.globalState.update(key, entry);
    }

    return { read, store };
}
