import {
  SmartSpectraSDK,
  CameraSelection,
  ValidationCode,
  ProcessingStatus,
  PixelFormat,
  breathingMetrics,
  cardioMetrics,
  faceMetrics,
} from '@smartspectra/node-sdk';
import { presage } from '@smartspectra/node-sdk/messages';

const EXPRESSION_NAMES = Object.fromEntries(
  Object.entries(presage.smartspectra.ExpressionType).map(([name, id]) => [id, name.toLowerCase()])
);
const VALIDATION_NAMES = Object.fromEntries(Object.entries(ValidationCode).map(([k, v]) => [v, k]));
const STATUS_NAMES = Object.fromEntries(Object.entries(ProcessingStatus).map(([k, v]) => [v, k]));

export const validationName = (code) => VALIDATION_NAMES[code] ?? `code ${code}`;
export const statusName = (code) => STATUS_NAMES[code] ?? `status ${code}`;

export function createPresage({ apiKey }) {
  const sdk = new SmartSpectraSDK({
    apiKey,
    requestedMetrics: [...cardioMetrics, ...breathingMetrics, ...faceMetrics],
  });
  sdk.useCamera(CameraSelection.default);
  return sdk;
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const latest = (arr) => (arr?.length ? arr[arr.length - 1] : undefined);

// Maps a decoded Presage Metrics message onto the 'metrics' message of our
// WebSocket contract. This is the only place that knows Presage field names.
// `validationCode` is the most recent validationStatus code; Presage reports
// "no face" there rather than in the metrics payload.
export function normalize(m, { timestampUs, validationCode } = {}) {
  const pulse = latest(m.cardio?.pulseRate);
  const breathing = latest(m.breathing?.rate);
  const hrv = latest(m.cardio?.hrv);
  const topExpression = latest(m.face?.expression)?.scores?.reduce(
    (best, s) => (s.confidence > (best?.confidence ?? -1) ? s : best),
    undefined
  );

  // All Presage confidences are percentages, 0–100.
  const conf = (v) => (v == null ? null : Math.round(v));

  return {
    type: 'metrics',
    t: timestampUs != null ? Math.round(Number(timestampUs) / 1000) : Date.now(),
    pulse: round1(pulse?.value),
    pulseConfidence: conf(pulse?.confidence),
    pulseStable: pulse?.stable ?? null,
    breathing: round1(breathing?.value),
    breathingConfidence: conf(breathing?.confidence),
    breathingStable: breathing?.stable ?? null,
    hrv: round1(hrv?.rmssd),
    validation: validationCode == null ? null : validationName(validationCode),
    faceDetected:
      validationCode == null ? null : validationCode !== ValidationCode.kNoFaceFound,
    faceCentered:
      validationCode == null ? null : validationCode !== ValidationCode.kFaceNotCentered,
    talking: latest(m.face?.talking)?.detected ?? null,
    blinking: latest(m.face?.blinking)?.detected ?? null,
    expression: topExpression ? EXPRESSION_NAMES[topExpression.type] : null,
    expressionConfidence: conf(topExpression?.confidence),
  };
}

// Measurement timestamps are microseconds, as a number, bigint or protobufjs Long.
const toMs = (ts) => Number(typeof ts?.toNumber === 'function' ? ts.toNumber() : ts ?? 0) / 1000;
const points = (arr) => (arr ?? []).map((p) => [toMs(p.timestamp), p.value]);
const ratePoints = (arr) => (arr ?? []).map((p) => [toMs(p.timestamp), round1(p.value), Math.round(p.confidence ?? 0)]);

// Every measurement in one Presage metrics event, at full rate, for the live
// charts (the 'trace' message of the WebSocket contract). Each event carries
// only the slice since the previous one, so the client appends. Returns null
// when the event has nothing to plot.
export function extractTraces(m) {
  const trace = {
    type: 'trace',
    pulse: points(m.cardio?.arterialPressureTrace),
    breathing: points(m.breathing?.upperTrace),
    pulseRate: ratePoints(m.cardio?.pulseRate),
    breathingRate: ratePoints(m.breathing?.rate),
  };
  const empty = !trace.pulse.length && !trace.breathing.length && !trace.pulseRate.length && !trace.breathingRate.length;
  return empty ? null : trace;
}

const ANY_TRUE_FIELDS = new Set(['talking', 'blinking']);

// Presage emits many metrics events per second. This merges them into one
// sample per interval: latest non-null value per field, except instantaneous
// flags (blinking, talking), which are true if any event in the interval was.
// Calls onSample(sample, eventCount); skips intervals with no events.
export function createSecondSampler(onSample, intervalMs = 1000) {
  let bucket = null;
  let count = 0;

  const timer = setInterval(() => {
    if (!bucket) return;
    onSample({ ...bucket, t: Date.now() }, count);
    bucket = null;
    count = 0;
  }, intervalMs);

  return {
    push(sample) {
      bucket ??= {};
      count++;
      for (const [key, value] of Object.entries(sample)) {
        if (ANY_TRUE_FIELDS.has(key) && bucket[key] === true) continue;
        if (value != null || !(key in bucket)) bucket[key] = value;
      }
    },
    stop() {
      clearInterval(timer);
    },
  };
}

const FRAME_LAYOUTS = {
  [PixelFormat.kRGB]: { bpp: 3, bgr: false },
  [PixelFormat.kBGR]: { bpp: 3, bgr: true },
  [PixelFormat.kRGBA]: { bpp: 4, bgr: false },
  [PixelFormat.kBGRA]: { bpp: 4, bgr: true },
};

// Downscales a Presage videoOutput frame for the browser preview. Output is a
// binary WS message: uint16 width, uint16 height (little-endian), then RGB bytes.
// Returns null for pixel formats we don't handle.
export function encodePreviewFrame(buf, width, height, stride, pixelFormat, targetWidth = 640) {
  const layout = FRAME_LAYOUTS[pixelFormat];
  if (!layout) return null;
  const factor = Math.max(1, Math.round(width / targetWidth));
  const w = Math.floor(width / factor);
  const h = Math.floor(height / factor);
  const out = Buffer.allocUnsafe(4 + w * h * 3);
  out.writeUInt16LE(w, 0);
  out.writeUInt16LE(h, 2);
  const step = factor * layout.bpp;
  const [r, b] = layout.bgr ? [2, 0] : [0, 2];
  let o = 4;
  for (let y = 0; y < h; y++) {
    for (let x = 0, i = y * factor * stride; x < w; x++, i += step) {
      out[o++] = buf[i + r];
      out[o++] = buf[i + 1];
      out[o++] = buf[i + b];
    }
  }
  return out;
}
