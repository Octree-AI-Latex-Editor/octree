const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i += 1) {
  const [key, value] = args[i].includes('=') ? args[i].split('=') : [args[i], args[i + 1]];
  if (key.startsWith('--')) {
    const normalizedKey = key.replace(/^--/, '');
    if (value && !value.startsWith('--')) {
      options[normalizedKey] = value;
      if (!args[i].includes('=') && i + 1 < args.length) {
        i += 1;
      }
    } else {
      options[normalizedKey] = true;
    }
  }
}

const targetUrl = options.url || 'http://localhost:3001/compile';
const totalRequests = parseInt(options.requests || options.r || '20', 10);
const concurrency = Math.max(1, parseInt(options.concurrency || options.c || '5', 10));
const latexFile = options.file || options.f;
const timeoutMs = parseInt(options.timeout || '45000', 10);

const defaultLatex = `\\documentclass{article}
\\begin{document}
Hello from the load test!\\\
\\end{document}`;

let payload = defaultLatex;
if (latexFile) {
  const absolutePath = path.resolve(latexFile);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Cannot find LaTeX file at ${absolutePath}`);
    process.exit(1);
  }
  payload = fs.readFileSync(absolutePath, 'utf8');
}

let inFlight = 0;
let completed = 0;
let success = 0;
let failures = 0;
const durations = [];
let started = Date.now();
let nextRequestId = 0;

async function issueRequest(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
      signal: controller.signal
    });

    const duration = Date.now() - start;
    durations.push(duration);

    if (response.ok) {
      success += 1;
      // Drain body to avoid keeping the connection alive
      await response.arrayBuffer();
    } else {
      failures += 1;
      const errorPayload = await response.text();
      console.error(`Request ${id} failed with status ${response.status}: ${errorPayload.substring(0, 200)}`);
    }
  } catch (error) {
    failures += 1;
    console.error(`Request ${id} encountered an error:`, error.message);
  } finally {
    clearTimeout(timer);
    completed += 1;
    inFlight -= 1;
    scheduleNext();
  }
}

function scheduleNext() {
  while (inFlight < concurrency && nextRequestId < totalRequests) {
    const currentId = nextRequestId;
    nextRequestId += 1;
    inFlight += 1;
    issueRequest(currentId).catch((error) => {
      failures += 1;
      console.error(`Unhandled error for request ${currentId}:`, error.message);
    });
  }

  if (completed === totalRequests) {
    summarize();
  }
}

function summarize() {
  const elapsed = Date.now() - started;
  const avg = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);

  console.log('==== Load Test Summary ====');
  console.log(`Target URL: ${targetUrl}`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`Success: ${success}`);
  console.log(`Failures: ${failures}`);
  console.log(`Total duration: ${elapsed} ms`);
  console.log(`Average latency: ${avg.toFixed(2)} ms`);
  console.log(`p95 latency: ${p95.toFixed(2)} ms`);
  console.log(`p99 latency: ${p99.toFixed(2)} ms`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

function percentile(values, percentileRank) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentileRank / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

console.log('Starting load test...');
console.log(`Target: ${targetUrl}`);
console.log(`Requests: ${totalRequests}, Concurrency: ${concurrency}`);

scheduleNext();
