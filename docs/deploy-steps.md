# Deploy Steps

Deploy steps are custom scripts that run before or after the copy process. They can be used for extra processing, validation, or cleanup.

Deploy steps are only available in a single app layout. See [Project Structure](./deploy-simulator.md#project-structure).

Each entry in `stageSteps` or `steps` is either a **string** or an **object**. A non-zero exit code aborts remaining steps and shows an error notification. All stdout/stderr is streamed to the **Ethos Deploy** output channel.

## Timing

| Step list | When it runs | `DEST_PATH` |
| --- | --- | --- |
| `stageSteps` | Before any simulator or radio copy | Temporary staged app folder |
| `steps` | After files are copied to the final target | Final simulator or radio app folder |

When `stageSteps` is present, the source app is first copied to a temporary staging folder, the stage steps run against it, and then the staged output is deployed.

## Environment variables

The following environment variables are set for every step process:

| Variable | Value |
| --- | --- |
| `DEST_PATH` | Absolute path to the staged app folder for `stageSteps`, or the final deployed app folder for `steps` |
| `SOURCE_PATH` | Absolute path to the source app folder |
| `WORKSPACE_ROOT` | Absolute path to the workspace root |
| `DEPLOY_TARGET` | `"simulator"`, `"radio"`, `"radio-lua"`, or `"radio-fast"` |

## Variable substitution

The following variables are expanded at step execution time:

| Variable | Expands to | Where |
| --- | --- | --- |
| `${pythonInterpreterPath}` | The resolved Python interpreter path from the Python extension, or `python.defaultInterpreterPath` or `python` if unavailable. | `script` (exec) |
| `${destPath}` | Absolute path to the destination app folder | `script` (exec), `args` |
| `${sourcePath}` | Absolute path to the source app folder | `script` (exec), `args` |
| `${workspaceFolder}` | Absolute path to the workspace root | `args`, `env` values |
| `${workspaceRoot}` | Same as `${workspaceFolder}` (deprecated alias) | `args`, `env` values |
| `${config:section.key}` | Value of a VS Code setting (e.g. `${config:python.defaultInterpreterPath}`) | `args`, `env` values |

Unknown `${config:…}` keys resolve to an empty string.

## String step

A plain string is either a `.js`/`.mjs` path (run via `fork()`) or a shell command (run via `exec()`). Detection is based on the first token ending in `.js` or `.mjs`.

```json
"stageSteps": [
    "docs/deploy-themes.mjs",
    ".venv/bin/python scripts/post-deploy.py",
    "echo Done: ${destPath}"
]
```

## Object step

An object step gives full control over the script, arguments, and extra environment variables:

```json
"steps": [
    {
        "script": "docs/deploy-themes.mjs",
        "args": ["/path/to/EFC-themes/lua/themes"],
        "env": { "ETHOS_VERSION": "26.0" }
    }
]
```

| Property | Type | Description |
| --- | --- | --- |
| `script` | `string` | **Required.** A `.js`/`.mjs` path or a shell command. |
| `args` | `string[]` | Extra arguments. Passed to `fork()` for Node scripts; appended to the command string for exec. Supports [variable substitution](#variable-substitution). |
| `env` | `object` | Extra environment variables merged on top of the base env for this step only. Values support [variable substitution](#variable-substitution). |

## Bundled post-deploy scripts

| Script | Description |
| --- | --- |
| [`./step-script-examples/deploy-sensors.mjs`](./step-script-examples/deploy-sensors.mjs) | Copies `.vscode/sensors.json` to the simulator root (skipped if already present, skipped on radio target). |
| [`./step-script-examples/deploy-themes.mjs`](./step-script-examples/deploy-themes.mjs) | Mirrors `theme-*` directories from a sibling `EFC-themes` repo into the simulator's `scripts/` directory. Skipped when `ETHOS_VERSION` major < 26, skipped on radio target. The source directory can be overridden via `args[0]` or the `ETHOS_THEMES_DIR` env var. |
