# Ethos DevTools Extension

Ethos DevTools `flyingeek.ethos-devtools` is a VS Code extension that complements the [bsongis.ethos](https://marketplace.visualstudio.com/items?itemName=bsongis.ethos) extension.

The extension is only activated in workspaces where the [bsongis.ethos](https://marketplace.visualstudio.com/items?itemName=bsongis.ethos) extension is active. It requires `bsongis.ethos` to be installed.

## Main Features

### Deploy to Simulator

This is the main feature of the extension, it makes working on your project easier by copying a Lua app folder from the workspace into the Ethos simulator's scripts directory, with optional manifest-driven selective copy and pre/post-deploy steps. See [Deploy to Simulator](./docs/deploy-simulator.md).

### Telemetry Playback

Replay a CSV telemetry log (Ethos or EdgeTX format) into the running simulator and pin a status label. Inject individual sensor values on demand. See [Telemetry Commands](./docs/telemetry-commands.md).

### Deploy to Radio

Deploy a Lua app folder to a connected radio over USB, in several sync modes. See [Deploy to Radio](./docs/deploy-radio.md). This can be useful for testing on a real radio at the last stage of development.

### Other Features

- Colorizes Ethos log files — errors, warnings, Lua script errors, `Lua::method` calls, and simulator start/stop events are each highlighted distinctly. See [Log Colorization](./docs/log-colorization.md).
- Scaffold a new Lua project from a GitHub template repository, with interactive prompts and template variable substitution. See [Project Scaffolding](./docs/scaffolding-project.md).
- Set Telemetry values in the running simulator on demand, with a quick pick list of all sensors declared.
- Icon to open ethos_lua_manifest specs when editing a manifest file
- Icon to install in the current simulator a theme or an audio pack
- Icon to quickly reload the simulator (stop/deploy/start)

## Main commands

| Command | Description |
| --- | --- |
| **Ethos DevTools: Play Telemetry CSV** | Replay a CSV telemetry log into the running simulator |
| **Ethos DevTools: Stop Telemetry** | Stop playback and clear the pinned status label |
| **Ethos DevTools: Set Telemetry Value** | Inject a single sensor value into the running simulator |
| **Ethos DevTools: Deploy to Simulator** | Copy a Lua app to the simulator scripts directory |
| **Ethos DevTools: Deploy to Radio** | Deploy a Lua app to a connected radio |
| **Ethos DevTools: Scaffold New Project** | Scaffold a new Lua project from a GitHub template |

## Installation

Install the extension from the VS Code marketplace: [flyingeek.ethos-devtools](https://marketplace.visualstudio.com/items?itemName=flyingeek.ethos-devtools)

The extension uses native dependencies for radio connection features, so platform-specific VSIX files are provided for Windows (x64), Linux (x64), and macOS (arm64 and x64). The Linux version has not been fully tested — raise an issue if you encounter problems.

For other platforms, a universal build is available without native dependencies; radio connection features will not work, but everything else will.

VSIX files can also be downloaded from the releases page of the GitHub repository. To install a VSIX file, open the Extensions view, click the three-dot menu, select **Install from VSIX…**, and choose the file (or drag and drop it into the Extensions view).

## Main Configuration

| Setting | Type | Description |
| --- | --- | --- |
| `ethos-devtools.deploy` | `object` | Configuration for Deploy to Simulator and Deploy to Radio. See [Deploy to Simulator](./docs/deploy-simulator.md). |
| `ethos-devtools.reload` | `object` | Configuration for **Ethos DevTools: Reload Simulator**. Same syntax as `ethos-menu.json`. Defaults to `{ "command": ["ethos.stop", "ethos-devtools.deploySimulator", "ethos.start"] }`. |

The minimum deploy configuration to add to your `.vscode/settings.json` file is:

```json
"ethos-devtools.deploy": {
    "app": "appname"
}
```

But that is only valid for a single app layout. See [Project Structure](./docs/deploy-simulator.md#project-structure) for more information.

## ethos-menu.json

To integrate with the Ethos extension's menu, add entries to your project's `ethos-menu.json`:

```json
[
    {
        "label": "📊 Telemetry playback",
        "command": "ethos-devtools.playTelemetry"
    },
    {
        "label": "✏️ Set telemetry value",
        "command": "ethos-devtools.setTelemetry"
    },
    {
        "label": "🚀 Deploy to simulator",
        "command": "ethos-devtools.deploySimulator"
    },
    {
        "label": "📻 Deploy to radio",
        "command": "ethos-devtools.deployRadio"
    },
    {
        "label": "$(debug-start)Deploy & Launch SIM",
        "command": "ethos-devtools.reload"
    }
]
```

## Documentation

| Topic | File |
| --- | --- |
| Log Colorization | [docs/log-colorization.md](./docs/log-colorization.md) |
| Telemetry Commands & Settings | [docs/telemetry-commands.md](./docs/telemetry-commands.md) |
| Telemetry Internals (simulator) | [docs/telemetry-internals.md](./docs/telemetry-internals.md) |
| Deploy to Simulator | [docs/deploy-simulator.md](./docs/deploy-simulator.md) |
| Manifest Sync | [docs/deploy-manifest.md](./docs/deploy-manifest.md) |
| Deploy Steps | [docs/deploy-steps.md](./docs/deploy-steps.md) |
| Deploy to Radio | [docs/deploy-radio.md](./docs/deploy-radio.md) |
| Radio Debug | [docs/radio-debug.md](./docs/radio-debug.md) |
| Radio Settings | [docs/radio-settings.md](./docs/radio-settings.md) |
| Project Scaffolding | [docs/scaffolding-project.md](./docs/scaffolding-project.md) |
