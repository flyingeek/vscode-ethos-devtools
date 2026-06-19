# Deploy to Radio

**Ethos DevTools: Deploy to Radio** (`ethos-devtools.deployRadio`) copies a Lua app folder from your workspace to a connected radio. The radio can be connected in **Ethos Suite** mode or **Serial** mode.

## Prerequisites

- The platform-specific VSIX installed (the universal build does not include native radio support).
- Project structure is a **single app layout**. See [Project Structure](./deploy-simulator.md#project-structure).
- The [radio settings](./radio-settings.md) configured correctly (vendor ID, product ID, storage priority), defaults should be sufficient for most users.
- A radio connected via USB.

## Destination path

```text
RADIO:/scripts/<appname>
```

`RADIO:` is the first available storage key (`sdcard` or `radio`) that contains a `scripts/` folder on the connected radio. The priority order can be changed via `ethos-devtools.radio.storageTargetPriority`.

`<appname>` is:

- `manifest.folder` when `ethos-devtools.deploy.manifest` is set to a non-empty string
- `path.basename(ethos-devtools.deploy.app)` otherwise

## Sync modes

Four commands are available depending on the desired sync strategy:

| Command | ID | Description |
| --- | --- | --- |
| **Deploy to Radio** | `ethos-devtools.deployRadio` | Manifest mode when a manifest is configured; otherwise Ultra Safe mode. |
| **Deploy to Radio (Fast)** | `ethos-devtools.deployRadioFast` | rsync-like mode, manifest is skipped. |
| **Deploy to Radio (Lua only)** | `ethos-devtools.deployRadioLua` | Copies only `.lua` files. Useful for quick iterations on large projects. |

### Ultra Safe mode

The default when no manifest is present. Extra steps ensure a safe deployment. Ported from Rob Thomson's deploy scripts.

### Fast mode

Uses an rsync-like algorithm. Faster than Ultra Safe mode, skips the manifest even if one is configured.

### Lua mode

Only `.lua` files are copied. Useful for quick iterations when the project is large.

### Manifest mode

Active when `ethos-devtools.deploy.manifest` is set. Behaves like Fast mode but uses the manifest to determine which files to copy and delete. See [Manifest Sync](./deploy-manifest.md).

## Configuration

The same `ethos-devtools.deploy` configuration used for Deploy to Simulator applies here. See [Deploy to Simulator — Configuration](./deploy-simulator.md#configuration) for the full property reference.

Radio-specific settings (vendor ID, baud rate, storage priority, etc.) are configured under `ethos-devtools.radio`. See [Radio Settings](./radio-settings.md).

## Serial Console

**Ethos DevTools: Radio Serial Console** tails the radio's serial console output into the **Ethos Deploy** output channel. The radio must be connected in **Serial** mode. After a deploy to radio, the console is automatically started. To stop the console, simply unplug the radio.

## Related

- [Radio Settings](./radio-settings.md)
- [Radio Debug](./radio-debug.md)
- [Manifest Sync](./deploy-manifest.md)
- [Deploy Steps](./deploy-steps.md)
