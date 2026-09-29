import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const healthUrl = 'http://127.0.0.1:8000/health';
const viteCli = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
let backendProcess;
let frontendProcess;
let shuttingDown = false;

async function isBackendReady() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

function stopProcess(child) {
  if (child && child.exitCode === null) child.kill();
}

function stopAll(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  stopProcess(frontendProcess);
  stopProcess(backendProcess);
}

async function startBackend() {
  if (await isBackendReady()) {
    console.log('Nowcast API is already healthy at http://localhost:8000.');
    return true;
  }

  console.log('Starting the nowcast API...');
  backendProcess = spawn(process.env.PYTHON || 'python', [
    '-m', 'uvicorn', 'backend.nowcast_engine:app', '--host', '0.0.0.0', '--port', '8000',
  ], { stdio: 'inherit' });

  backendProcess.on('error', (error) => {
    console.error(`Could not start the Python backend: ${error.message}`);
    stopAll(1);
  });
  backendProcess.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`The Python backend exited before startup completed (${signal || code}).`);
      stopAll(code || 1);
    }
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (shuttingDown) return false;
    if (await isBackendReady()) {
      console.log('Nowcast API is healthy at http://localhost:8000.');
      return true;
    }
    if (backendProcess.exitCode !== null) break;
    await delay(1000);
  }

  if (!shuttingDown) {
    console.error('The API did not become healthy. Install backend/requirements.txt and run npm run dev again.');
    stopAll(1);
  }
  return false;
}

process.on('SIGINT', () => stopAll(130));
process.on('SIGTERM', () => stopAll(143));

if (await startBackend()) {
  frontendProcess = spawn(process.execPath, [viteCli, '--port=3000', '--host=0.0.0.0'], { stdio: 'inherit' });
  frontendProcess.on('error', (error) => {
    console.error(`Could not start Vite: ${error.message}`);
    stopAll(1);
  });
  frontendProcess.on('exit', (code, signal) => {
    if (!shuttingDown) stopAll(code ?? (signal ? 1 : 0));
  });
}