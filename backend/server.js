const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Path to compiled C++ binary (cross-platform Linux/Windows)
const isWindows = process.platform === 'win32';
const cppBinaryName = isWindows ? 'engine.exe' : 'engine';
const cppBinary = path.join(__dirname, 'cpp', cppBinaryName);
const cppSource = path.join(__dirname, 'cpp', 'engine.cpp');

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

// Ensure the C++ engine binary is compiled and executable on this platform
function ensureCppBinaryCompiled() {
  if (!fs.existsSync(cppBinary)) {
    console.log(`[C++ Engine] Binary not found at: ${cppBinary}`);
    console.log(`[C++ Engine] Compiling ${cppSource} -> ${cppBinary}...`);
    try {
      execSync(`g++ -O2 "${cppSource}" -o "${cppBinary}"`, { stdio: 'inherit' });
      if (!isWindows && fs.existsSync(cppBinary)) {
        try {
          fs.chmodSync(cppBinary, 0o755);
        } catch (chmodErr) {
          console.warn(`[C++ Engine] Warning: Could not chmod binary:`, chmodErr.message);
        }
      }
      console.log(`[C++ Engine] ✓ Successfully compiled ${cppBinaryName}`);
    } catch (err) {
      console.error(`[C++ Engine Compilation Error]:`, err.message);
    }
  } else {
    // Ensure executable permissions on Linux/macOS
    if (!isWindows) {
      try {
        fs.chmodSync(cppBinary, 0o755);
      } catch (chmodErr) {
        // ignore
      }
    }
  }
}

// Start C++ persistent engine process
function initCppEngine() {
  ensureCppBinaryCompiled();
  console.log(`[C++ Engine] Spawning executable at: ${cppBinary}`);
  try {
    const spawnOptions = {
      cwd: path.join(__dirname, 'cpp')
    };
    if (isWindows) {
      spawnOptions.windowsHide = true;
    }

    cppProcess = spawn(cppBinary, [], spawnOptions);

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
      console.warn(`[C++ Engine] Process exited with code ${code}, signal ${signal}. Restarting in 1s...`);
      setTimeout(initCppEngine, 1000);
    });

    cppProcess.on('error', (err) => {
      console.error('[C++ Engine Spawn Error]:', err.message);
    });

    addTelemetryLog('INIT', 'C++ Engine instance running (O(1) Memory-Efficient Core)');
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

// ==========================================
// Root Status Endpoint (GET /)
// ==========================================
app.get('/', (req, res) => {
  const wantsJson = req.xhr || 
    req.query.format === 'json' || 
    (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html'));

  const statusData = {
    status: 'online',
    project: 'Undo-Redo Engine',
    message: 'Undo-Redo Engine backend is running',
    version: '1.0.0',
    platform: process.platform,
    engineRunning: !!cppProcess && !cppProcess.killed,
    engineBinary: cppBinaryName,
    capacity: 5,
    stackSize: currentState.size,
    uptimeSeconds: Math.floor(process.uptime()),
    endpoints: {
      health: '/api/health',
      state: '/api/state',
      push: 'POST /api/push',
      pop: 'POST /api/pop',
      undo: 'POST /api/undo',
      redo: 'POST /api/redo',
      reset: 'POST /api/reset'
    }
  };

  if (wantsJson) {
    return res.json(statusData);
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Undo–Redo Engine | Backend Status</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text-main: #f0f6fc;
      --text-muted: #8b949e;
      --cyan: #00e5ff;
      --purple: #8a2be2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 640px;
      width: 100%;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .title-group h1 {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title-group p {
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      background: rgba(35, 134, 54, 0.15);
      color: #3fb950;
      border: 1px solid rgba(63, 185, 80, 0.3);
    }
    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #3fb950;
      box-shadow: 0 0 10px #3fb950;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
    }
    .stat-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .stat-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 15px;
      font-weight: 600;
      color: var(--cyan);
    }
    .endpoints-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }
    .endpoint-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .endpoint-item a {
      color: #e6edf3;
      text-decoration: none;
    }
    .endpoint-item a:hover {
      color: var(--cyan);
      text-decoration: underline;
    }
    .method {
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    .get { background: rgba(56, 139, 253, 0.2); color: #58a6ff; }
    .post { background: rgba(163, 113, 247, 0.2); color: #bc8cff; }
    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid var(--border);
      padding-top: 18px;
      font-size: 13px;
    }
    .footer a {
      color: var(--cyan);
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="title-group">
        <h1>Undo–Redo Engine</h1>
        <p>High-Performance Native C++ DSA Backend</p>
      </div>
      <span class="badge">
        <span class="badge-dot"></span>
        Running
      </span>
    </div>

    <div class="grid">
      <div class="stat-box">
        <div class="stat-label">C++ Engine Core</div>
        <div class="stat-val">${statusData.engineRunning ? '✓ Active & Ready' : 'Initializing...'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Binary Executable</div>
        <div class="stat-val">${statusData.engineBinary}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Environment</div>
        <div class="stat-val">${process.platform} (Node ${process.version})</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Stack Capacity</div>
        <div class="stat-val">5 Elements [O(1)]</div>
      </div>
    </div>

    <div class="endpoints-title">Active API Endpoints</div>
    <div class="endpoint-list">
      <div class="endpoint-item">
        <a href="/api/health">/api/health</a>
        <span class="method get">GET</span>
      </div>
      <div class="endpoint-item">
        <a href="/api/state">/api/state</a>
        <span class="method get">GET</span>
      </div>
      <div class="endpoint-item">
        <span>/api/push <span style="color:var(--text-muted);font-size:11px;">(body: { value: int })</span></span>
        <span class="method post">POST</span>
      </div>
      <div class="endpoint-item">
        <span>/api/pop</span>
        <span class="method post">POST</span>
      </div>
      <div class="endpoint-item">
        <span>/api/undo</span>
        <span class="method post">POST</span>
      </div>
      <div class="endpoint-item">
        <span>/api/redo</span>
        <span class="method post">POST</span>
      </div>
      <div class="endpoint-item">
        <span>/api/reset</span>
        <span class="method post">POST</span>
      </div>
    </div>

    <div class="footer">
      <span style="color:var(--text-muted);">Uptime: ${statusData.uptimeSeconds}s</span>
      <a href="/?format=json">View JSON Format →</a>
    </div>
  </div>
</body>
</html>`);
});

// ==========================================
// Existing API Routes
// ==========================================
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` DSA Undo-Redo Backend running on port ${PORT}`);
  console.log(` Host: 0.0.0.0 (process.env.PORT = ${process.env.PORT || 'default ' + PORT})`);
  console.log(` Connecting to native C++ engine at:`);
  console.log(` ${cppBinary}`);
  console.log(`===============================================`);
});
