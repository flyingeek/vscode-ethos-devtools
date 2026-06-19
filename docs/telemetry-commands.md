# Telemetry Commands

## Commands

| Command | ID |
| --- | --- |
| **Ethos DevTools: Play Telemetry CSV** | `ethos-devtools.playTelemetry` |
| **Ethos DevTools: Stop Telemetry** | `ethos-devtools.stopTelemetry` |
| **Ethos DevTools: Set Telemetry Value** | `ethos-devtools.setTelemetry` |

## Settings

| Setting | Type | Description |
| --- | --- | --- |
| `ethos-devtools.telemetryReplaySpeeds` | `number[]` | Replay speed multipliers shown during telemetry playback. Defaults to `[1, 2, 5, 10]`. |

## Play Telemetry CSV

**Ethos DevTools: Play Telemetry CSV** replays a flight log into the running Ethos simulator via the `ethos.injectTelemetry` API.

Telemetry frame discovery uses `sensors.json` from the simulator root.

1. Pick a CSV file from the workspace (or browse the file system).
2. Select a replay speed. The default options are `1×`, `2×`, `5×`, and `10×`, configurable via `ethos-devtools.telemetryReplaySpeeds`.
3. Choose **Play once** or **Loop**.

Supported formats:

- **Ethos log** — columns such as `Altitude(m)`, `RxBatt(V)`, `ESC voltage(V)`, `RSSI 2.4G(dB)`, `GPS` (space-separated lat lon), …
- **EdgeTX log** — columns such as `Alt(m)`, `RxBt(V)`, `1RSS(dB)`, `RQly(%)`, `Curr(A)`, `GPS` (space-separated lat lon), …

Only frames listed in `sensors.json` (as returned by `ethos.getSensors`) are injected — extra CSV columns are silently ignored. The progress notification shows the current row, percentage, and the frame names sent on each tick. Playback can be cancelled via the notification's cancel button or the **Ethos DevTools: Stop Telemetry** command.

> **Note:** For the inner workings of telemetry in the simulator (sensors.json, CSV injection mechanics, custom frames), see [Telemetry Internals](./telemetry-internals.md).

### CSV samples

- [EdgeTx Log](./csv-examples/DemoEdgeTxTelemetry.csv)
- [Ethos Log](./csv-examples/DemoEthosTelemetry.csv)

## Stop Telemetry

**Ethos DevTools: Stop Telemetry** stops the current telemetry playback and clears the pinned status label.

## Set Telemetry Value

**Ethos DevTools: Set Telemetry Value** lets you inject a single value into any sensor frame of the running Ethos simulator:

1. Pick a frame from the list returned by `ethos.getSensors` (e.g. `Altitude`, `VSpeed`, `RSSI`).
2. Enter the value in human-readable units (e.g. `150` for 150 m).

The simulator is updated immediately. The command requires the Ethos simulator to be running.

## Ethos Menu Integration

As reminder, you can define custom entries to set telemetry values in your project's `ethos-menu.json` using the `ethos.injectTelemetry` command. For example, to set the `Altitude` frame to 100 m:

```json
[
    {
        "label": "Set Altitude to 100m",
        "command": { "id": "ethos.injectTelemetry", "args": [[{"name": "Altitude", "value": 100}], true] }
    }
]

This is only valid with bsongis.extension version > v0.6.1
