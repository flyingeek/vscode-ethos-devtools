# Deploy to Simulator

**Ethos DevTools: Deploy to Simulator** (`ethos-devtools.deploySimulator`) copies a Lua app folder from your workspace into the correct simulator scripts directory.

## Destination path

```text
<ethos.simulatorsFolder>/<ethos.board>_<ethos.protocol>@<ethos.release>/scripts/<appname>
```

`<appname>` is:

- `manifest.folder` when `ethos-devtools.deploy.manifest` is set to a non-empty string
- `path.basename(ethos-devtools.deploy.app)` otherwise

The following settings from the `bsongis.ethos` extension determine the destination:

| Setting | Description |
| --- | --- |
| `ethos.simulatorsFolder` | Root folder containing simulator installations. Supports `~`. |
| `ethos.board` | Board identifier (e.g. `X18RS`). |
| `ethos.protocol` | Protocol identifier (e.g. `FCC`). |
| `ethos.release` | Ethos release identifier (e.g. `1.6.5`). |

## Project structure

Ethos DevTools supports the following project layouts:

| Directory tree | `ethos-devtools.deploy` config |
| --- | --- |
| **Single app at root level** <br><pre>workspace/<br>└── app/<br>    └── main.lua</pre> | `{ "app": "app" }` |
| **App nested under a subdirectory** <br><pre>workspace/<br>└── src/<br>    └── app/<br>        └── main.lua</pre> | `{ "app": "src/app" }` |
| **Multiple apps at root level** <br><pre>workspace/<br>├── app1/<br>│   └── main.lua<br>├── app2/<br>│   └── main.lua<br>└── app3/<br>    └── main.lua</pre> | `{ "app": ".", "multiApp": true }` |
| **Multiple apps under a common parent** <br><pre>workspace/<br>└── scripts/<br>    ├── app1/<br>    │   └── main.lua<br>    └── app2/<br>        └── main.lua</pre> | `{ "app": "scripts", "multiApp": true }` |

Limitations with `multiApp`:

- no manifest support
- no staging steps
- no post-deploy steps
- deploy to simulator only

## Configuration

Configure the command via `ethos-devtools.deploy` in your workspace settings. The minimum required setting is:

```json
"ethos-devtools.deploy": {
    "app": "appname"
}
```

Full configuration reference:

| Property | Type | Default | Description |
| --- | --- | --- | --- |
| `app` | `string` | — | **Required.** Workspace-relative path to the source app folder. |
| `manifest` | `string` | `""` | Workspace-relative path to the Ethos Lua manifest file. See [Manifest Sync](./deploy-manifest.md). |
| `stageSteps` | `(string \| object)[]` | `[]` | Pre-copy deploy steps. See [Deploy Steps](./deploy-steps.md). |
| `steps` | `(string \| object)[]` | `[]` | Post-copy deploy steps. See [Deploy Steps](./deploy-steps.md). |
| `multiApp` | `boolean` | `false` | When true, `app` is treated as a container directory. Each immediate subdirectory containing a top-level `main.lua` is deployed independently. Incompatible with manifest, stageSteps, steps, and radio targets. |
