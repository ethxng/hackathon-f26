// Sanity check: open the webcam via Presage and print metrics to the terminal.
//   npm run metrics            one compact line per metrics event
//   npm run metrics -- --raw   also dump the first decoded payload in full
import 'dotenv/config';
import { inspect } from 'node:util';
import { decodeMetrics, ValidationCode } from '@smartspectra/node-sdk';
import { createPresage, createSecondSampler, extractTraces, normalize, validationName, statusName } from '../src/presage.js';

const apiKey = process.env.PRESAGE_API_KEY;
if (!apiKey) {
  console.error('Missing PRESAGE_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}
const RAW = process.argv.includes('--raw');

const fmt = (v, digits = 1) => (v == null ? '—' : Number(v).toFixed(digits));
const flag = (v) => (v == null ? '?' : v ? '✓' : '✗');

const sdk = createPresage({ apiKey });
let validationCode = null;
let dumpedRaw = false;

// Chart points received per series since the last printed line.
let tracePoints = {};

const sampler = createSecondSampler((m, events) => {
  console.log(
    [
      new Date().toLocaleTimeString(),
      `pulse ${fmt(m.pulse)} (conf ${fmt(m.pulseConfidence, 2)})`,
      `breath ${fmt(m.breathing)}`,
      `hrv ${fmt(m.hrv)}`,
      `face ${flag(m.faceDetected)}`,
      `centered ${flag(m.faceCentered)}`,
      `forward ${flag(m.faceForward)}`,
      `talking ${flag(m.talking)}`,
      `blink ${flag(m.blinking)}`,
      `expr ${m.expression ?? '—'}`,
      `(${events} events; points: ${Object.entries(tracePoints).map(([k, n]) => `${k} ${n}`).join(', ')})`,
    ].join('  ')
  );
  tracePoints = {};
});

sdk.on('processingStatus', (s) => console.log(`[status] ${statusName(s)}`));

sdk.on('validationStatus', (code, _ts, hint) => {
  if (code === validationCode) return;
  validationCode = code;
  const tag = code === ValidationCode.kOk ? 'ok' : 'warn';
  console.log(`[validation:${tag}] ${validationName(code)}${hint ? ` — ${hint}` : ''}`);
});

sdk.on('error', (code, message, retryable) =>
  console.error(`[error] ${code}: ${message}${retryable ? ' (retryable)' : ''}`)
);

sdk.on('metrics', (buf, timestampUs) => {
  const decoded = decodeMetrics(buf);
  if (Buffer.isBuffer(decoded)) {
    console.log(`[metrics] undecoded buffer, ${decoded.length} bytes`);
    return;
  }
  if (RAW && !dumpedRaw) {
    dumpedRaw = true;
    console.log(inspect(decoded.toJSON?.() ?? decoded, { depth: 6, colors: true }));
  }

  for (const [key, points] of Object.entries(extractTraces(decoded))) {
    tracePoints[key] = (tracePoints[key] ?? 0) + points.length;
  }
  sampler.push(normalize(decoded, { timestampUs, validationCode }));
});

process.on('SIGINT', async () => {
  console.log('\nstopping…');
  sampler.stop();
  await sdk.stopAsync();
  process.exit(0);
});

console.log('Starting Presage (first readings can take ~10–20s)… Ctrl+C to stop.');
sdk.start();
