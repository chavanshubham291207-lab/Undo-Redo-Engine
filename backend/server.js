const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Path to compiled C++ binary
const cppBinary = path.join(__dirname, 'cpp', 'engine.exe');

let cppProcess = null;
let rl = null;
let currentPendingResolver = null;
let commandQueue = [];
let isProcessingQueue = false;

// In-memory telemetry log buffer
let telemetryLogs = [];
let currentState = {
  status: 'READY',
  message: 'C++ Engine Initialized',
  action: 'INIT',
  capacity: 5,
  size: 0,
  undoCount: 0,
  redoCount: 0,
  stack: []
};

function formatTime(date = new Date()) {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0')
  ].join(':');
}

function addTelemetryLog(action, message, status = 'SUCCESS') {
  let badgeClass = 'bg-primary/20 text-primary';
  let metricClass = 'text-secondary';
  let metric = '+32 B [O(1)]';

  if (action === 'PUSH') {
    badgeClass = 'bg-primary/20 text-primary';
    metric = '+48 B [O(1)]';
    metricClass = 'text-secondary';
  } else if (action === 'POP') {
    badgeClass = 'bg-error-container text-on-error-container';
    metric = '-48 B [O(1)]';
    metricClass = 'text-error';
  } else if (action === 'UNDO') {
    badgeClass = 'bg-secondary/20 text-secondary';
    metric = '0.02 ms';
    metricClass = 'text-outline';
  } else if (action === 'REDO') {
    badgeClass = 'bg-tertiary-container/30 text-tertiary';
    metric = '0.01 ms';
    metricClass = 'text-outline';
  } else if (status === 'OVERFLOW' || status === 'UNDERFLOW' || status === 'ERROR') {
    badgeClass = 'bg-error-container text-on-error-container';
    metric = 'Blocked';
    metricClass = 'text-error';
  }

  const newLog = {
    id: Date.now() + Math.random(),
    time: formatTime(),
    type: status === 'OVERFLOW' || status === 'UNDERFLOW' ? status : action,
    message,
    status,
    metric,
    badgeClass,
    metricClass
  };

  telemetryLogs.unshift(newLog);
  if (telemetryLogs.length > 25) {
    telemetryLogs.pop();
  }
}

// Start C++ persistent engine process
function initCppEngine() {
  console.log(`[C++ Engine] Spawning executable at: ${cppBinary}`);
  try {
    cppProcess = spawn(cppBinary, [], {
      cwd: path.join(__dirname, 'cpp'),
      windowsHide: true
    });

    rl = readline.createInterface({
      input: cppProcess.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed = JSON.parse(trimmed);
        currentState = parsed;

        if (currentPendingResolver) {
          const resolve = currentPendingResolver;
          currentPendingResolver = null;
          resolve(parsed);
        }
      } catch (err) {
        console.error('[C++ Output Error]: Failed to parse JSON:', trimmed);
        if (currentPendingResolver) {
          const resolve = currentPendingResolver;
          currentPendingResolver = null;
          resolve({ status: 'ERROR', message: trimmed, ...currentState });
        }
      }
    });

    cppProcess.stderr.on('data', (data) => {
      console.error(`[C++ Stderr]: ${data.toString()}`);
    });

    cppProcess.on('exit', (code, signal) => {
      console.warn(`[C++ Engine] Process exited with code ${code}, signal ${signal}. Restarting...`);
      setTimeout(initCppEngine, 1000);
    });

    cppProcess.on('error', (err) => {
      console.error('[C++ Engine Spawn Error]:', err.message);
    });

    addTelemetryLog('INIT', 'C++ Engine instance running (MinGW O(1) OPT)');
  } catch (err) {
    console.error('[C++ Init Failed]:', err);
  }
}

// Process command queue sequentially
function sendCommand(cmdString) {
  return new Promise((resolve) => {
    commandQueue.push({ cmd: cmdString, resolve });
    processNextCommand();
  });
}

function processNextCommand() {
  if (isProcessingQueue || commandQueue.length === 0) return;
  isProcessingQueue = true;

  const item = commandQueue.shift();
  currentPendingResolver = (result) => {
    isProcessingQueue = false;
    item.resolve(result);
    processNextCommand();
  };

  if (!cppProcess || cppProcess.killed) {
    isProcessingQueue = false;
    item.resolve({ status: 'ERROR', message: 'C++ Engine not running' });
    processNextCommand();
    return;
  }

  // Timeout guard (2 seconds)
  const timer = setTimeout(() => {
    if (currentPendingResolver) {
      const resolve = currentPendingResolver;
      currentPendingResolver = null;
      isProcessingQueue = false;
      resolve({ status: 'TIMEOUT', message: 'C++ Engine response timed out', ...currentState });
      processNextCommand();
    }
  }, 2000);

  const prevResolver = currentPendingResolver;
  currentPendingResolver = (result) => {
    clearTimeout(timer);
    prevResolver(result);
  };

  cppProcess.stdin.write(item.cmd + '\n');
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engineRunning: !!cppProcess && !cppProcess.killed,
    capacity: 5
  });
});

app.get('/api/state', (req, res) => {
  res.json({
    ...currentState,
    logs: telemetryLogs
  });
});

app.post('/api/push', async (req, res) => {
  const { value } = req.body;
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'Value must be a valid integer',
      ...currentState
    });
  }

  const result = await sendCommand(`PUSH ${num}`);
  addTelemetryLog('PUSH', result.message, result.status);
  res.json({ ...result, logs: telemetryLogs });
});

app.post('/api/pop', async (req, res) => {
  const result = await sendCommand('POP');
  addTelemetryLog('POP', result.message, result.status);
  res.json({ ...result, logs: telemetryLogs });
});

app.post('/api/undo', async (req, res) => {
  const result = await sendCommand('UNDO');
  addTelemetryLog('UNDO', result.message, result.status);
  res.json({ ...result, logs: telemetryLogs });
});

app.post('/api/redo', async (req, res) => {
  const result = await sendCommand('REDO');
  addTelemetryLog('REDO', result.message, result.status);
  res.json({ ...result, logs: telemetryLogs });
});

app.post('/api/reset', async (req, res) => {
  const result = await sendCommand('RESET');
  telemetryLogs = [];
  addTelemetryLog('RESET', 'Stack reset to initial clean state');
  res.json({ ...result, logs: telemetryLogs });
});

// Launch server & C++ core
initCppEngine();

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` DSA Undo-Redo Backend running on port ${PORT}`);
  console.log(` Connecting to native C++ engine at:`);
  console.log(` ${cppBinary}`);
  console.log(`===============================================`);
});
