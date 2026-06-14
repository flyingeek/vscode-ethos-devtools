/**
 * Maps CSV column names to Ethos telemetry frame names.
 *
 * Ethos frame names (from ethos.getSensors / sensors.json):
 *   RSSI, RxBatt, ADC2, SWR, VFR, Rx VFR, Air speed,
 *   Altitude, VSpeed, Voltage, Current, RPM, Consumption, Temperature,
 *   Cell 0…N, Latitude, Longitude, Speed, Course, Sats
 */

export interface FrameEntry {
  name: string;
  label: string;
  appId?: number;
  parse: (value: string) => number | null;
}

export interface ColumnEntry {
  colIndex: number;
  frames: FrameEntry[];
}

// ---------------------------------------------------------------------------
// Unit stripping
// ---------------------------------------------------------------------------

/**
 * Strips a trailing `(unit)` suffix from a column name.
 * e.g. "Altitude(m)" → "Altitude", "RxBatt(V)" → "RxBatt"
 */
export function stripUnit(name: string): string {
  return name.replace(/\([^)]*\)$/, '').trim();
}

// ---------------------------------------------------------------------------
// EdgeTX → Ethos alias table  (applied after unit-stripping)
// ---------------------------------------------------------------------------

const EDGETX_ALIAS: Record<string, string> = {
  'Alt':   'Altitude',
  'RxBt':  'RxBatt',
  'VSpd':  'VSpeed',
  'GSpd':  'Speed',
  'Hdg':   'Course',
  '1RSS':  'RSSI',
  'RQly':  'VFR',
  'Curr':  'Current',
  // 2RSS is intentionally omitted → will be skipped
};

// ---------------------------------------------------------------------------
// Ethos log → frame alias table  (applied after unit-stripping)
// ---------------------------------------------------------------------------

const ETHOS_ALIAS: Record<string, string> = {
  'RSSI 2.4G':     'RSSI',
  'RSSI 900M':     'RSSI',    // secondary — dedup logic keeps only the first
  'VFR 2.4G':      'VFR',
  'VFR 900M':      'VFR',     // secondary
  'ESC voltage':   'Voltage',
  'ESC current':   'Current',
  'ESC RPM':       'RPM',
  'ESC Consumption': 'Consumption',
  'ESC consumption': 'Consumption', // lowercase variant in Ethos logs
  'ESC temp':      'Temperature',
  'GPS alt':       'Altitude',
  'GPS speed':     'Speed',
  'GPS course':    'Course',
  'GPS Satellites': 'Sats',
  'VFAS':          'Voltage',
  'LiPo1':         'Cell 0',
  'LiPo2':         'Cell 1',
  'LiPo3':         'Cell 2',
  'LiPo4':         'Cell 3',
  'LiPo5':         'Cell 4',
  'LiPo6':         'Cell 5',
  'LiPo7':         'Cell 6',
  'LiPo8':         'Cell 7',
  // RAW ESC consump is a raw wire value, not a human-readable frame
};

/** Column names to skip entirely (no frame mapping). */
const SKIP_COLUMNS = new Set(['2RSS', 'RAW ESC consump']);

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

/** EdgeTX-specific column names (after unit-strip). */
const EDGETX_MARKERS = new Set(['1RSS', '2RSS', 'RQly', 'RSNR', 'RxBt', 'TQly']);

export type CsvFormat = 'ethos' | 'edgetx';

export function detectFormat(headers: string[]): CsvFormat {
  for (const h of headers) {
    if (EDGETX_MARKERS.has(stripUnit(h))) {
      return 'edgetx';
    }
  }
  return 'ethos';
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises a raw CSV column name to an Ethos frame name (or null if it
 * cannot be mapped or should be skipped).
 *
 * Steps:
 * 1. Strip unit suffix
 * 2. Skip known-skip columns
 * 3. Apply EdgeTX alias if format is edgetx
 * 4. Return the result if it is in availableFrames, else null
 */
function normalise(
  raw: string,
  format: CsvFormat,
  availableFrames: Set<string>,
): string | null {
  const stripped = stripUnit(raw);
  if (SKIP_COLUMNS.has(stripped)) { return null; }
  const aliasTable = format === 'edgetx' ? EDGETX_ALIAS : ETHOS_ALIAS;
  const aliased = aliasTable[stripped] ?? stripped;
  return availableFrames.has(aliased) ? aliased : null;
}

// ---------------------------------------------------------------------------
// Hex appId extraction
// ---------------------------------------------------------------------------

/** Matches 0x followed by 1–4 hex digits anywhere in a column header. */
const HEX_IN_HEADER_RE = /0x([0-9a-fA-F]{1,4})/i;

/**
 * Returns the numeric appId encoded in a raw column header (e.g. "0x1234",
 * "Voltage(V)0x1234", "0x1234 Voltage"), or null if none is present.
 */
function extractHexAppId(raw: string): number | null {
  const m = HEX_IN_HEADER_RE.exec(raw);
  return m ? parseInt(m[1], 16) : null;
}

/**
 * Strips the hex token and all (unit) suffixes from a raw column header,
 * returning the trimmed remainder as a human-readable name hint.
 * e.g. "0x0B50 Voltage" → "Voltage", "Voltage(V)0x0B50" → "Voltage", "0x0B50" → ""
 */
function extractNameHint(raw: string): string {
  return raw.replace(HEX_IN_HEADER_RE, '').replace(/\([^)]*\)/g, '').trim();
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

/**
 * Returns the display label for a frame entry.
 * - forceHex=true (hex-mapped columns): always shows Name(0xappid)
 * - otherwise: shows Name(0xappid) only when the name is shared by multiple sensors
 */
function makeLabel(
  name: string,
  appId: number | undefined,
  nameCount: Map<string, number>,
  forceHex = false,
): string {
  return appId !== undefined && (forceHex || (nameCount.get(name) ?? 0) > 1)
    ? `${name}(0x${appId.toString(16)})`
    : name;
}

// ---------------------------------------------------------------------------
// Numeric parsing helpers
// ---------------------------------------------------------------------------

function parseFloat_(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function parseFirstToken(v: string): number | null {
  return parseFloat_(v.split(' ')[0] ?? '');
}

function parseSecondToken(v: string): number | null {
  return parseFloat_(v.split(' ')[1] ?? '');
}

// ---------------------------------------------------------------------------
// Column plan builder
// ---------------------------------------------------------------------------

/**
 * Builds the list of column→frame mappings to use when replaying rows.
 *
 * @param headers       Raw header row from the CSV (already deduplicated).
 * @param availableFrames  Frame names returned by ethos.getSensors.
 * @returns ColumnEntry[] — only columns that map to at least one available frame.
 */
export function buildColumnPlan(
  headers: string[],
  sensors: Array<{ name: string; appId?: number }>,
): ColumnEntry[] {
  const frameNames = sensors.map(s => s.name).filter(n => n !== '');
  const frameSet = new Set(frameNames);

  // Map name → all appIds (handles duplicate names like two 'Altitude' sensors)
  const appIdsByName = new Map<string, number[]>();
  for (const s of sensors) {
    if (s.name !== '' && s.appId !== undefined) {
      const list = appIdsByName.get(s.name);
      if (list) { list.push(s.appId); } else { appIdsByName.set(s.name, [s.appId]); }
    }
  }

  // Count how many sensors share each name (used to decide whether to show appId in label)
  const nameCount = new Map<string, number>();
  for (const s of sensors) {
    if (s.name) { nameCount.set(s.name, (nameCount.get(s.name) ?? 0) + 1); }
  }

  const appIdToSensors = new Map<number, Array<{ name: string; appId: number }>>();
  for (const s of sensors) {
    if (s.appId !== undefined) {
      const list = appIdToSensors.get(s.appId);
      if (list) { list.push({ name: s.name, appId: s.appId }); }
      else { appIdToSensors.set(s.appId, [{ name: s.name, appId: s.appId }]); }
    }
  }
  const format = detectFormat(headers);
  const plan: ColumnEntry[] = [];

  // Track which alias-target frame names we have already mapped (e.g. first 1RSS wins).
  const mappedFrames = new Set<string>();
  // Track which appIds have been claimed (hex path uses this to avoid collisions with name-based path).
  const mappedAppIds = new Set<number>();

  for (let i = 0; i < headers.length; i++) {
    const raw = headers[i];
    const stripped = stripUnit(raw);

    // ── GPS column: split into Latitude + Longitude ──────────────────────
    if (stripped === 'GPS') {
      const frames: FrameEntry[] = [];
      if (frameSet.has('Latitude') && !mappedFrames.has('Latitude')) {
        const latAppIds = appIdsByName.get('Latitude') ?? [];
        const latAppId = latAppIds[0];
        frames.push({ name: 'Latitude', label: makeLabel('Latitude', latAppId, nameCount), appId: latAppId, parse: parseFirstToken });
        mappedFrames.add('Latitude');
      }
      if (frameSet.has('Longitude') && !mappedFrames.has('Longitude')) {
        const lonAppIds = appIdsByName.get('Longitude') ?? [];
        const lonAppId = lonAppIds[0];
        frames.push({ name: 'Longitude', label: makeLabel('Longitude', lonAppId, nameCount), appId: lonAppId, parse: parseSecondToken });
        mappedFrames.add('Longitude');
      }
      if (frames.length > 0) {
        plan.push({ colIndex: i, frames });
      }
      continue;
    }

    // ── Hex appId: maps column to a sensor by appId, disambiguated by name hint ──
    const hexAppId = extractHexAppId(raw);
    if (hexAppId !== null) {
      const candidates = appIdToSensors.get(hexAppId);
      if (candidates) {
        let sensor: { name: string; appId: number } | undefined;
        if (candidates.length === 1) {
          sensor = candidates[0];
        } else {
          // Multiple sensors share this appId — use the name hint to disambiguate
          const hint = extractNameHint(raw).toLowerCase();
          if (hint !== '') {
            sensor = candidates.find(c => c.name.toLowerCase() === hint);
          }
          // If hint is empty or doesn't match any candidate, sensor stays undefined → skip
        }
        if (sensor && !mappedAppIds.has(sensor.appId)) {
          mappedAppIds.add(sensor.appId);
          plan.push({ colIndex: i, frames: [{ name: sensor.name, label: makeLabel(sensor.name, sensor.appId, nameCount, true), appId: sensor.appId, parse: parseFloat_ }] });
        }
      }
      continue; // skip name-based resolution whether or not we found a sensor
    }

    const frameName = normalise(raw, format, frameSet);
    if (frameName === null) { continue; }
    if (mappedFrames.has(frameName)) { continue; } // dedup (e.g. two 1RSS cols)

    mappedFrames.add(frameName);
    const appIds = appIdsByName.get(frameName) ?? [];
    let frames: FrameEntry[];
    if (appIds.length > 0) {
      // Filter out appIds already claimed by a hex column
      const usableIds = appIds.filter(id => !mappedAppIds.has(id));
      if (usableIds.length === 0) { continue; }
      usableIds.forEach(id => mappedAppIds.add(id));
      frames = usableIds.map(id => ({ name: frameName, label: makeLabel(frameName, id, nameCount), appId: id, parse: parseFloat_ }));
    } else {
      frames = [{ name: frameName, label: frameName, parse: parseFloat_ }];
    }
    plan.push({ colIndex: i, frames });
  }

  return plan;
}
