# Manifest Sync

Manifest mode activates when `ethos-devtools.deploy.manifest` is set to a non-empty string in `ethos-devtools.deploy`.

It is an attempt to match the behavior of Ethos Suite's "Lua App Manifest" feature. It uses an `ethos_lua_manifest.json` file at the root of your workspace:

```json
{
    "manifestVersion": 1,
    "folder": "gps-qrcode",
    "files": [
        "gps-qrcode/main.lua",
        "gps-qrcode/gps-qrcode.png",
        "gps-qrcode/i18n/*",
        "gps-qrcode/lib/*"
    ]
}
```

See [manifest-examples/ethos_lua_manifest.json](./manifest-examples/ethos_lua_manifest.json) and the [manifest spec](./manifest-examples/ethos_lua_manifest_specs_V1.md) for reference.

Manifest sync is only available in a single app layout. See [Project Structure](./deploy-simulator.md#project-structure).

## Behavior

- Only files matching the `files` patterns are copied. Glob patterns (`dir/*`, `dir/**/*`) are supported.
- The `manifest.folder` prefix is stripped from each pattern to derive the path relative to `app`.
- The manifest itself is copied to the destination so subsequent deploys can clean up stale files.
- If an existing manifest is found in the destination, all files it listed are deleted before copying.

## Errors

The command aborts if:

- the manifest file is unreadable
- `manifestVersion` is not `1`

## Configuration

```json
"ethos-devtools.deploy": {
    "app": "gps-qrcode",
    "manifest": "ethos_lua_manifest.json"
}
```

The `manifest` property is a workspace-relative path to the manifest file. When set to a non-empty string, manifest mode is active for both **Deploy to Simulator** and **Deploy to Radio**.
