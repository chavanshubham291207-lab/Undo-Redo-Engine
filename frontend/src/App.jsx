import React, { useState, useEffect } from 'react';

// Dynamic API Base URL configuration:
// - Uses VITE_API_URL or VITE_API_BASE_URL environment variable if set (configured in Vercel).
// - Automatically normalizes URLs whether provided with or without '/api'.
// - In local development, uses '/api' (proxied by Vite).
// - If deployed separately (e.g., Vercel), defaults to 'https://undo-redo-engine.onrender.com/api'.
const getApiBase = () => {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env)
    ? (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL)
    : null;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, '');
    if (!clean.endsWith('/api')) {
      clean += '/api';
    }
    return clean;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.includes('undo-redo-engine.onrender.com')) {
      return '/api';
    }
  }

  return 'https://undo-redo-engine.onrender.com/api';
};

const API_BASE = getApiBase();

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem('hasSeenWelcome');
  });

  const [stackData, setStackData] = useState({
    status: 'READY',
    message: 'Initializing...',
    capacity: 5,
    size: 0,
    undoCount: 0,
    redoCount: 0,
    stack: [],
    logs: []
  });
  
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState('telemetry'); // 'telemetry' | 'memory' | 'diff'
  const [diffMode, setDiffMode] = useState(true);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Sync theme with HTML class and localStorage
  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleGetStarted = () => {
    sessionStorage.setItem('hasSeenWelcome', 'true');
    setShowWelcome(false);
  };

  // Fetch initial state
  useEffect(() => {
    fetchState();
  }, []);

  const fetchState = async () => {
    try {
      const res = await fetch(`${API_BASE}/state`);
      if (res.ok) {
        const data = await res.json();
        setStackData(data);
      }
    } catch (err) {
      console.warn('Backend not responding yet, will retry:', err);
    }
  };

  const showAlert = (type, message) => {
    setAlertInfo({ type, message });
    setTimeout(() => {
      setAlertInfo(null);
    }, 4500);
  };

  const handlePush = async () => {
    const val = parseInt(inputValue, 10);
    if (isNaN(val)) {
      showAlert('ERROR', 'Please enter a valid integer to push');
      return;
    }

    if (stackData.size >= stackData.capacity) {
      showAlert('OVERFLOW', '⚠️ Stack Overflow! Maximum capacity (5) reached.');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: val })
      });
      const data = await res.json();
      setStackData(data);
      if (data.status === 'OVERFLOW') {
        showAlert('OVERFLOW', '⚠️ Stack Overflow! Element rejected by C++ Engine.');
      } else if (data.status === 'SUCCESS') {
        showAlert('SUCCESS', `Pushed ${val} to top of stack`);
        setInputValue('');
      }
    } catch (err) {
      showAlert('ERROR', 'Failed to communicate with backend server');
    } finally {
      setLoading(false);
    }
  };

  const handlePop = async () => {
    if (stackData.size === 0) {
      showAlert('UNDERFLOW', '⚠️ Stack Underflow! Stack is already empty.');
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/pop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setStackData(data);
      if (data.status === 'UNDERFLOW') {
        showAlert('UNDERFLOW', '⚠️ Stack Underflow! Cannot pop from empty stack.');
      } else if (data.status === 'SUCCESS') {
        showAlert('SUCCESS', data.message);
      }
    } catch (err) {
      showAlert('ERROR', 'Failed to communicate with backend server');
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = async () => {
    if (stackData.undoCount === 0) {
      showAlert('INFO', 'Nothing to undo (Undo stack is empty)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setStackData(data);
      showAlert('UNDO', '⏪ Undo performed successfully');
    } catch (err) {
      showAlert('ERROR', 'Failed to execute undo');
    } finally {
      setLoading(false);
    }
  };

  const handleRedo = async () => {
    if (stackData.redoCount === 0) {
      showAlert('INFO', 'Nothing to redo (Redo stack is empty)');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/redo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setStackData(data);
      showAlert('REDO', '⏩ Redo performed successfully');
    } catch (err) {
      showAlert('ERROR', 'Failed to execute redo');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setStackData(data);
      showAlert('SUCCESS', 'Stack and history reset to initial state');
    } catch (err) {
      showAlert('ERROR', 'Failed to reset stack');
    } finally {
      setLoading(false);
    }
  };

  const capacity = stackData.capacity || 5;
  const currentSize = stackData.stack ? stackData.stack.length : 0;
  const freeSlots = Math.max(0, capacity - currentSize);
  const loadPercentage = Math.round((currentSize / capacity) * 100);
  const memSavingsPercentage = ((freeSlots / capacity) * 100).toFixed(1);

  // Stack elements in display order: Top at index (size-1) down to Bottom at index 0
  const stackElements = [...(stackData.stack || [])];

  /* =========================================================================
     1. WELCOME / LANDING PAGE VIEW
     ========================================================================= */
  if (showWelcome) {
    return (
      <div className="h-screen max-h-screen flex flex-col justify-between overflow-y-auto md:overflow-hidden bg-surface text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container transition-colors duration-200">
        {/* Welcome Top Navbar */}
        <header className="h-16 shrink-0 w-full bg-surface-dim backdrop-blur-xl border-b border-surface-container-high/70 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-container via-primary to-secondary flex items-center justify-center shadow-md shrink-0">
              <span className="material-symbols-outlined text-surface-dim font-bold text-[24px]">layers</span>
            </div>
            <div className="flex flex-col">
              <span className="font-code-lg text-[18px] md:text-[20px] text-primary font-bold tracking-tight">
                Undo–Redo Engine
              </span>
              <span className="font-body-md text-[13px] md:text-[14px] text-on-surface-variant font-medium">
                DSA Project • C++ Stack Core
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-[22px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              onClick={handleGetStarted}
              className="hidden sm:flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-code-sm text-[15px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span>Get Started</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </header>

        {/* Central Viewport Content */}
        <main className="flex-1 flex flex-col justify-center items-center px-4 md:px-8 py-4 max-w-4xl mx-auto w-full gap-4 my-auto">
          {/* Top Project Tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-high/80 border border-primary/30 text-primary font-mono text-[13px] md:text-[14px] font-semibold tracking-wider uppercase shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_#0891b2] animate-pulse"></span>
            <span>Data Structures &amp; Algorithms Project</span>
            <span className="text-outline">•</span>
            <span className="text-secondary font-mono font-bold">O(1) OPT</span>
          </div>

          {/* Title & Short Description */}
          <div className="text-center max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface leading-tight">
              Memory-Efficient <br className="hidden sm:inline"/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-secondary to-primary">
                Undo–Redo Engine
              </span>
            </h1>
            <p className="mt-3 text-[16px] sm:text-[17px] md:text-[18px] text-on-surface-variant leading-relaxed font-body-md">
              Interactive visualization of reversible state management. Built on contiguous C++ stack logic 
              with $O(1)$ operations, dual history branches, and strict capacity bounds.
            </p>
          </div>

          {/* Stack Illustration Container */}
          <div className="w-full max-w-xl bg-surface-container rounded-2xl p-4 md:p-5 border border-surface-container-high shadow-lg relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-secondary to-primary"></div>
            
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">account_tree</span>
                <span className="font-code-lg text-[16px] md:text-[17px] font-bold text-on-surface">
                  Contiguous Stack Illustration
                </span>
              </div>
              <span className="text-[13px] font-mono px-3 py-1 rounded-md bg-surface-container-highest text-primary font-bold">
                CAPACITY = 5
              </span>
            </div>

            {/* Visual Stack Graphic */}
            <div className="grid grid-cols-3 gap-3.5 items-center">
              {/* Left Column: PUSH Inflow */}
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-center">
                <span className="material-symbols-outlined text-primary text-[28px]">add_circle</span>
                <span className="font-code-sm text-[14px] font-bold text-on-surface mt-1">PUSH(x)</span>
                <span className="font-label-xs text-[12px] text-on-surface-variant font-mono mt-0.5">Clears redo</span>
                <div className="mt-2 flex items-center gap-1.5 text-primary text-[12px] font-mono font-bold">
                  <span>Inflow</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </div>
              </div>

              {/* Center Column: Stack Tube */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-surface-container-lowest border border-dashed border-outline-variant">
                <div className="flex items-center justify-between px-2.5 py-1 rounded bg-surface-container-high/40 text-outline text-[12px] font-mono border border-dashed border-outline-variant font-medium">
                  <span>Slot #4..5 Free</span>
                  <span>2 free</span>
                </div>

                {/* Top Node */}
                <div className="flex flex-col px-3 py-2 rounded-lg bg-surface-container-high shadow-sm border-2 border-primary/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono text-primary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
                      TOP [idx=2]
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">ACTIVE</span>
                  </div>
                  <span className="font-mono text-[14px] font-bold text-on-surface mt-0.5">Node #3 (42)</span>
                </div>

                {/* Middle Node */}
                <div className="px-3 py-1.5 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-[13px] text-on-surface-variant font-medium">
                  Node #2 (25)
                </div>

                {/* Bottom Node */}
                <div className="flex flex-col px-3 py-2 rounded-lg bg-surface-container-high border-2 border-secondary/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono text-secondary font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">arrow_drop_up</span>
                      BOTTOM
                    </span>
                    <span className="text-[10px] font-mono text-outline">Anchor</span>
                  </div>
                  <span className="font-mono text-[14px] font-bold text-on-surface mt-0.5">Node #1 (10)</span>
                </div>
              </div>

              {/* Right Column: Dual Reversible Stacks */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-low border border-secondary/30">
                  <span className="material-symbols-outlined text-secondary text-[22px]">undo</span>
                  <div className="flex flex-col text-left">
                    <span className="font-code-sm text-[13px] font-bold text-on-surface">undoStack</span>
                    <span className="text-[11px] font-mono text-on-surface-variant">Reversible history</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-container-low border border-tertiary/30">
                  <span className="material-symbols-outlined text-tertiary text-[22px]">redo</span>
                  <div className="flex flex-col text-left">
                    <span className="font-code-sm text-[13px] font-bold text-on-surface">redoStack</span>
                    <span className="text-[11px] font-mono text-on-surface-variant">Forward branch</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA "Get Started" Button */}
          <div className="flex flex-col items-center gap-2 mt-1">
            <button
              onClick={handleGetStarted}
              className="flex items-center justify-center gap-2 px-10 py-4 rounded-xl bg-primary text-on-primary font-code-sm text-[17px] font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span>Get Started</span>
              <span className="material-symbols-outlined text-[22px]">rocket_launch</span>
            </button>
            <span className="text-[13px] md:text-[14px] font-mono text-outline">
              Fixed Capacity = 5 • Protected against Overflow &amp; Underflow
            </span>
          </div>
        </main>

        {/* Footer */}
        <footer className="h-10 shrink-0 flex items-center justify-center text-[13px] font-mono text-outline border-t border-surface-container-high/50">
          <span>DSA Project — Memory-Efficient Undo–Redo Engine (React + Node.js + C++)</span>
        </footer>

        {/* Modals */}
        {showDocModal && renderDocModal()}
      </div>
    );
  }

  /* =========================================================================
     2. REUSABLE MODALS
     ========================================================================= */
  function renderDocModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-pop-in">
        <div className="bg-surface-container border border-surface-container-high rounded-2xl max-w-xl w-full p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-primary text-[26px]">menu_book</span>
              <h3 className="text-[22px] font-bold text-on-surface">DSA Project Architecture</h3>
            </div>
            <button
              onClick={() => setShowDocModal(false)}
              className="text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>
          
          <div className="py-5 space-y-4 font-mono text-[15px] md:text-[16px] text-on-surface-variant leading-relaxed max-h-[60vh] overflow-y-auto">
            <p>
              <strong>Engine:</strong> Memory-Efficient Undo–Redo Engine using contiguous C++ <code className="text-primary font-bold">vector&lt;int&gt;</code> and dual <code className="text-secondary font-bold">stack&lt;vector&lt;int&gt;&gt;</code>.
            </p>
            <div className="p-4 bg-surface-container-low rounded-xl border border-surface-container-high text-[14px] md:text-[15px] space-y-1.5">
              <div className="text-primary font-bold mb-2">C++ Core Data Structures:</div>
              <div>• Main Stack: <span className="text-on-surface font-semibold">vector&lt;int&gt; s;</span> (Capacity = 5)</div>
              <div>• Undo History: <span className="text-on-surface font-semibold">stack&lt;vector&lt;int&gt;&gt; undoStack;</span></div>
              <div>• Redo Branch: <span className="text-on-surface font-semibold">stack&lt;vector&lt;int&gt;&gt; redoStack;</span></div>
            </div>
            <p>
              <strong>Time Complexities:</strong>
              <br/>• Push: <span className="text-secondary font-bold">O(1)</span> amortized
              <br/>• Pop: <span className="text-secondary font-bold">O(1)</span>
              <br/>• Undo / Redo: <span className="text-secondary font-bold">O(1)</span> state restore
            </p>
          </div>

          <div className="pt-4 border-t border-surface-container-high flex justify-end">
            <button
              onClick={() => setShowDocModal(false)}
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-code-sm text-[16px] font-bold"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSettingsModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-pop-in">
        <div className="bg-surface-container border border-surface-container-high rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[26px]">settings</span>
              <h3 className="text-[22px] font-bold text-on-surface">Engine Settings</h3>
            </div>
            <button
              onClick={() => setShowSettingsModal(false)}
              className="text-on-surface-variant hover:text-on-surface p-1"
            >
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          </div>

          <div className="py-5 space-y-4 font-mono text-[15px] md:text-[16px]">
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
              <span>Theme Mode</span>
              <button
                onClick={toggleTheme}
                className="px-3.5 py-1.5 rounded-lg bg-surface-container-high text-primary font-bold flex items-center gap-2 text-[15px]"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                </span>
                <span className="capitalize">{theme} Mode</span>
              </button>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
              <span>Stack Capacity</span>
              <span className="px-3 py-1 rounded bg-surface-container-high text-primary font-bold">5 Elements</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
              <span>C++ Engine</span>
              <span className="text-secondary font-bold">engine.exe (MinGW)</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low">
              <span>Backend Endpoint</span>
              <span className="text-on-surface-variant">http://localhost:5000</span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  handleReset();
                  setShowSettingsModal(false);
                }}
                className="w-full py-3.5 rounded-xl bg-error-container text-on-error-container font-bold text-[16px] hover:bg-error-container/80 transition-colors"
              >
                Reset C++ Engine State
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-surface-container-high flex justify-end">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="px-6 py-2.5 rounded-xl bg-surface-container-high text-on-surface font-code-sm text-[16px] font-bold"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     3. HIGH READABILITY DASHBOARD (Side-by-Side: Left Controls | Right Telemetry)
     ========================================================================= */
  return (
    <div className="min-h-screen flex flex-col bg-surface font-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container transition-colors duration-200">
      
      {/* Top Navigation Bar */}
      <header className="h-16 shrink-0 w-full bg-surface-dim backdrop-blur-xl shadow-sm border-b border-surface-container-high px-4 md:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-container via-primary to-secondary flex items-center justify-center shadow-md shrink-0">
            <span className="material-symbols-outlined text-surface-dim font-bold text-[24px]">layers</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="font-code-lg text-[19px] md:text-[22px] text-primary font-bold tracking-tight">
              Undo–Redo Engine
            </span>
            <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-surface-container-high text-secondary font-mono text-[12px] font-bold uppercase tracking-wider">
              C++ Stack Core (O(1))
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick Engine Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-container-low text-on-surface-variant font-mono text-[14px] border border-surface-container-high font-medium mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary shadow-[0_0_8px_#0891b2] animate-pulse"></span>
            <span>Capacity Limit: <strong className="text-on-surface">5 Slots</strong></span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[22px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          <button
            onClick={() => setShowDocModal(true)}
            title="DSA Documentation & C++ Code"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-secondary hover:bg-surface-container-high transition-colors border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[22px]">menu_book</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            title="Engine Settings & Reset"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[22px]">settings</span>
          </button>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 gap-5 max-w-[1600px] mx-auto w-full">
        
        {/* Top Alert Toast Notification */}
        {alertInfo && (
          <div
            className={`shrink-0 flex items-center justify-between px-4 py-3 rounded-xl border animate-slide-down shadow-md ${
              alertInfo.type === 'OVERFLOW' || alertInfo.type === 'UNDERFLOW' || alertInfo.type === 'ERROR'
                ? 'bg-error-container text-on-error-container border-error/50 font-semibold text-[15px]'
                : alertInfo.type === 'UNDO' || alertInfo.type === 'REDO'
                ? 'bg-secondary/15 border-secondary/40 text-secondary text-[15px] font-semibold'
                : 'bg-primary/15 border-primary/40 text-primary text-[15px] font-semibold'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[24px]">
                {alertInfo.type === 'OVERFLOW' || alertInfo.type === 'UNDERFLOW' ? 'warning' : 'info'}
              </span>
              <span className="font-code-sm text-[16px]">{alertInfo.message}</span>
            </div>
            <button
              onClick={() => setAlertInfo(null)}
              className="text-current opacity-70 hover:opacity-100 p-1"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* Prominent Statistics Row (4 Bento Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Stack Load */}
          <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[14px] uppercase font-bold text-on-surface-variant tracking-wider">
                Stack Load
              </span>
              <span className="material-symbols-outlined text-primary text-[22px]">layers</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] md:text-[34px] font-extrabold text-primary font-mono leading-none">
                {currentSize}
              </span>
              <span className="text-[16px] md:text-[18px] text-outline font-mono">/ {capacity} slots</span>
            </div>
            <div className="w-full bg-surface-container-high rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  currentSize === capacity ? 'bg-error' : 'bg-primary'
                }`}
                style={{ width: `${loadPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Card 2: Buffer Free */}
          <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[14px] uppercase font-bold text-on-surface-variant tracking-wider">
                Buffer Free
              </span>
              <span className="material-symbols-outlined text-secondary text-[22px]">compress</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] md:text-[34px] font-extrabold text-secondary font-mono leading-none">
                {memSavingsPercentage}%
              </span>
              <span className="text-[15px] md:text-[16px] text-outline font-mono font-medium">({freeSlots} free)</span>
            </div>
            <span className="text-[14px] text-on-surface-variant font-mono mt-2 font-medium truncate">
              {freeSlots > 0 ? `${freeSlots} unallocated slots` : 'Stack capacity reached'}
            </span>
          </div>

          {/* Card 3: Undo Depth */}
          <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[14px] uppercase font-bold text-on-surface-variant tracking-wider">
                Undo Depth
              </span>
              <span className="material-symbols-outlined text-tertiary text-[22px]">undo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] md:text-[34px] font-extrabold text-on-surface font-mono leading-none">
                {stackData.undoCount}
              </span>
              <span className="text-[15px] md:text-[16px] text-on-surface-variant font-medium">states stored</span>
            </div>
            <span className="text-[14px] text-tertiary font-mono mt-2 font-medium">
              {stackData.undoCount > 0 ? 'Reversible snapshots' : 'Genesis baseline state'}
            </span>
          </div>

          {/* Card 4: Redo Branch */}
          <div className="flex flex-col p-4 md:p-5 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[14px] uppercase font-bold text-on-surface-variant tracking-wider">
                Redo Branch
              </span>
              <span className="material-symbols-outlined text-outline text-[22px]">redo</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[28px] md:text-[34px] font-extrabold text-on-surface font-mono leading-none">
                {stackData.redoCount}
              </span>
              <span className="text-[15px] md:text-[16px] text-on-surface-variant font-medium">forward cached</span>
            </div>
            <span className="text-[14px] text-outline font-mono mt-2 font-medium">
              {stackData.redoCount > 0 ? 'Forward steps available' : 'No forward state cached'}
            </span>
          </div>
        </div>

        {/* Split Section: LEFT (Stack Visualizer & Controls) | RIGHT (Telemetry Log) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* =========================================================
              LEFT COLUMN: Stack Visualizer + Command Controls (7 cols)
              ========================================================= */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            
            {/* Contiguous Stack Visualizer Card */}
            <div className="flex flex-col p-5 md:p-6 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm relative">
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-surface-container-high">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-[24px]">account_tree</span>
                  <span className="text-[22px] md:text-[24px] text-on-surface font-bold tracking-tight">
                    Contiguous Stack Tube
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-high text-primary font-mono text-[13px] font-bold">
                  <span>PTR:</span>
                  <span className="text-on-surface">0x03FF{currentSize ? currentSize.toString(16).toUpperCase() : '0'}B</span>
                </div>
              </div>

              {/* The Vertical Stack Elements Tube */}
              <div className="flex flex-col gap-2.5 p-2">
                {/* Empty Buffer Slot Indicator */}
                {freeSlots > 0 && (
                  <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-outline text-[14px] font-mono font-medium">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      <span>[Slot #{currentSize + 1}..{capacity}] Unallocated Capacity Buffer</span>
                    </div>
                    <span className="font-bold text-[14px]">{freeSlots} free slots</span>
                  </div>
                )}

                {/* Empty Stack State */}
                {currentSize === 0 && (
                  <div className="flex flex-col items-center justify-center p-10 text-center rounded-xl bg-surface-container-low/50 border border-dashed border-outline-variant">
                    <span className="material-symbols-outlined text-outline text-[42px] mb-2">layers_clear</span>
                    <span className="text-[18px] text-on-surface font-bold">Stack is currently empty</span>
                    <span className="text-[15px] text-on-surface-variant mt-1">Enter an integer in the Command Dispatcher below and click Push</span>
                  </div>
                )}

                {/* Render Stack Blocks from TOP (idx = size - 1) to BOTTOM (0) */}
                {stackElements.slice().reverse().map((val, revIdx) => {
                  const actualIdx = stackElements.length - 1 - revIdx;
                  const isTop = actualIdx === stackElements.length - 1;
                  const isBottom = actualIdx === 0;

                  return (
                    <React.Fragment key={`node-${actualIdx}-${val}`}>
                      {revIdx > 0 && (
                        <div className="flex justify-center -my-1 z-10">
                          <div className="w-1 h-3 bg-primary/40 rounded-full"></div>
                        </div>
                      )}

                      <div className="relative group">
                        {/* TOP Pointer Label */}
                        {isTop && (
                          <div className="flex items-center gap-2 mb-1.5 pl-1">
                            <span className="text-primary font-bold uppercase tracking-wider flex items-center font-mono text-[14px]">
                              <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
                              TOP [Head Pointer: idx={actualIdx}]
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-primary/20 text-primary font-mono text-[12px] font-bold">
                              ACTIVE
                            </span>
                          </div>
                        )}

                        {/* Large, Substantial Stack Block */}
                        <div
                          className={`flex items-center justify-between p-4 md:p-5 rounded-xl transition-all border-2 ${
                            isTop
                              ? 'bg-surface-container-high shadow-md border-primary/70'
                              : isBottom
                              ? 'bg-surface-container-high border-secondary/60 shadow-sm'
                              : 'bg-surface-container-low border-surface-container-high'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span
                              className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                                isTop ? 'bg-primary shadow-[0_0_10px_#7c3aed]' : isBottom ? 'bg-secondary shadow-[0_0_8px_#0891b2]' : 'bg-outline'
                              }`}
                            ></span>
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className={`text-[17px] md:text-[19px] font-bold ${
                                  isTop ? 'text-primary' : isBottom ? 'text-secondary' : 'text-on-surface'
                                }`}>
                                  Node #{actualIdx + 1}
                                </span>
                                <span className="text-[12px] font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded font-semibold border border-surface-container-high">
                                  {isBottom ? 'Baseline' : 'Delta'}
                                </span>
                              </div>
                              <div className="text-[18px] md:text-[20px] font-mono text-on-surface font-semibold mt-0.5">
                                val = <strong className="text-secondary font-black text-[20px] md:text-[22px]">{val}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1 text-[13px] md:text-[14px] font-mono text-outline shrink-0">
                            <span>HASH: {((val * 7919) % 65535).toString(16).toUpperCase().padStart(4, '0')}</span>
                            <span className="text-secondary font-bold">{isBottom ? '1.2 KB full' : '+48 B [O(1)]'}</span>
                          </div>
                        </div>

                        {/* BOTTOM Anchor Label */}
                        {isBottom && (
                          <div className="flex items-center justify-between mt-1.5 pl-1">
                            <span className="text-secondary font-bold uppercase tracking-wider flex items-center font-mono text-[14px]">
                              <span className="material-symbols-outlined text-[18px]">arrow_drop_up</span>
                              BOTTOM [Base Anchor: idx=0]
                            </span>
                            <span className="text-[13px] font-mono text-outline font-medium">Immutable Genesis Base</span>
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Command Dispatcher Controls */}
            <div className="p-5 md:p-6 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-[18px] md:text-[20px] font-bold text-on-surface tracking-tight">
                  Command Dispatcher
                </span>
                
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setDiffMode(!diffMode)}
                    className={`px-3 py-1 rounded-lg font-mono text-[13px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      diffMode
                        ? 'bg-secondary/15 text-secondary border border-secondary/40'
                        : 'bg-surface-container-high text-outline'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${diffMode ? 'bg-secondary' : 'bg-outline'}`}></span>
                    <span>Diff: {diffMode ? 'ON' : 'OFF'}</span>
                  </button>

                  <button
                    onClick={handleReset}
                    className="px-3 py-1 rounded-lg bg-error-container text-on-error-container font-mono text-[13px] font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                    title="Reset Stack"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Reset Stack</span>
                  </button>
                </div>
              </div>

              {/* Large Input Box */}
              <div className="flex items-center px-4 py-3 rounded-xl bg-surface-container-low border border-surface-container-high focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <span className="material-symbols-outlined text-outline text-[22px] mr-3">terminal</span>
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePush();
                  }}
                  placeholder="Enter integer payload to push (e.g., 42)..."
                  className="w-full bg-transparent text-[16px] md:text-[18px] text-on-surface placeholder:text-outline outline-none font-mono font-medium"
                />
                {inputValue && (
                  <button
                    onClick={() => setInputValue('')}
                    className="text-outline hover:text-on-surface p-1 cursor-pointer"
                    title="Clear"
                  >
                    <span className="material-symbols-outlined text-[20px]">cancel</span>
                  </button>
                )}
              </div>

              {/* Tactile Action Button Matrix (Large, Easy to Click) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* PUSH */}
                <button
                  onClick={handlePush}
                  disabled={loading}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-primary text-on-primary text-[16px] md:text-[17px] font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[22px]">add_circle</span>
                  <span>Push{inputValue ? ` (${inputValue})` : ''}</span>
                </button>

                {/* POP */}
                <button
                  onClick={handlePop}
                  disabled={loading || currentSize === 0}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-error-container text-on-error-container text-[16px] md:text-[17px] font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[22px]">delete_sweep</span>
                  <span>Pop</span>
                </button>

                {/* UNDO */}
                <button
                  onClick={handleUndo}
                  disabled={loading || stackData.undoCount === 0}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-secondary/15 text-secondary border border-secondary/40 text-[16px] md:text-[17px] font-bold hover:bg-secondary/25 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[22px]">undo</span>
                  <span>Undo ({stackData.undoCount})</span>
                </button>

                {/* REDO */}
                <button
                  onClick={handleRedo}
                  disabled={loading || stackData.redoCount === 0}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-tertiary-container/20 text-tertiary border border-tertiary/40 text-[16px] md:text-[17px] font-bold hover:bg-tertiary-container/30 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[22px]">redo</span>
                  <span>Redo ({stackData.redoCount})</span>
                </button>
              </div>
            </div>

          </div>

          {/* =========================================================
              RIGHT COLUMN: Telemetry Log & Engine State (5 cols)
              ========================================================= */}
          <div className="lg:col-span-5 flex flex-col p-5 md:p-6 rounded-2xl bg-surface-container border border-surface-container-high shadow-sm">
            
            {/* Right Panel Tabs Header */}
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-surface-container-high shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRightPanelTab('telemetry')}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[14px] md:text-[15px] font-bold transition-colors cursor-pointer ${
                    rightPanelTab === 'telemetry'
                      ? 'bg-secondary/15 text-secondary border border-secondary/40'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Telemetry Log
                </button>
                <button
                  onClick={() => setRightPanelTab('memory')}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[14px] md:text-[15px] font-bold transition-colors cursor-pointer ${
                    rightPanelTab === 'memory'
                      ? 'bg-primary/15 text-primary border border-primary/40'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Memory Stats
                </button>
                <button
                  onClick={() => setRightPanelTab('diff')}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[14px] md:text-[15px] font-bold transition-colors cursor-pointer ${
                    rightPanelTab === 'diff'
                      ? 'bg-tertiary/15 text-tertiary border border-tertiary/40'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Diff Audit
                </button>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-secondary text-[13px] font-bold">
                <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_#0891b2] animate-pulse"></span>
                <span>STREAM ACTIVE</span>
              </div>
            </div>

            {/* TAB 1: Live Telemetry Event Log */}
            {rightPanelTab === 'telemetry' && (
              <div className="flex flex-col">
                <div className="flex items-center justify-between text-[14px] font-mono text-outline pb-3 shrink-0 font-medium">
                  <span>Recent Events ({stackData.logs?.length || 0} recorded)</span>
                  <span>O(1) Engine Stream</span>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[580px] overflow-y-auto pr-1.5 custom-scrollbar">
                  {stackData.logs && stackData.logs.length > 0 ? (
                    stackData.logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high/60 transition-colors border border-surface-container-high text-[14px] font-mono"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-outline text-[13px] shrink-0 font-medium">{log.time}</span>
                          <span className={`px-2 py-0.5 rounded text-[12px] font-bold shrink-0 ${log.badgeClass}`}>
                            {log.type}
                          </span>
                          <span className="text-on-surface text-[14px] md:text-[15px] font-medium truncate">
                            {log.message}
                          </span>
                        </div>
                        <span className={`text-[13px] shrink-0 ml-2 font-bold ${log.metricClass}`}>
                          {log.metric}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-10 text-center text-outline text-[15px] font-mono">
                      <span className="material-symbols-outlined text-[32px] mb-2">history</span>
                      <span>No events recorded yet</span>
                      <span className="text-[13px] text-outline/80 mt-1">Perform a Push or Pop to view live operations</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Memory Breakdown Stats */}
            {rightPanelTab === 'memory' && (
              <div className="flex flex-col space-y-4 text-[15px] font-mono max-h-[580px] overflow-y-auto pr-1.5 custom-scrollbar">
                <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                  <div className="text-primary font-bold text-[16px] mb-2">Vector Stack Memory (`s`)</div>
                  <div className="space-y-2 text-on-surface-variant text-[14px] md:text-[15px]">
                    <div>• Maximum Capacity: <strong className="text-on-surface">5 items</strong></div>
                    <div>• Allocated Elements: <strong className="text-on-surface">{currentSize}</strong></div>
                    <div>• Memory per Node: <strong className="text-on-surface">4 Bytes (int32)</strong></div>
                    <div>• Active Footprint: <strong className="text-on-surface">{currentSize * 4} Bytes</strong></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                  <div className="text-secondary font-bold text-[16px] mb-2">Undo/Redo Subsystem</div>
                  <div className="space-y-2 text-on-surface-variant text-[14px] md:text-[15px]">
                    <div>• Undo History Depth: <strong className="text-on-surface">{stackData.undoCount} states</strong></div>
                    <div>• Redo Branch Depth: <strong className="text-on-surface">{stackData.redoCount} states</strong></div>
                    <div>• State Snapshot Complexity: <strong className="text-on-surface">O(k) copy</strong></div>
                    <div>• Traversal Operation: <strong className="text-on-surface">O(1) pointer swap</strong></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high">
                  <div className="text-tertiary font-bold text-[16px] mb-2">Current Vector State Buffer</div>
                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high text-[15px] text-on-surface font-bold">
                    [{stackElements.join(', ')}]
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Diff Audit Log */}
            {rightPanelTab === 'diff' && (
              <div className="flex flex-col space-y-2.5 max-h-[580px] overflow-y-auto pr-1.5 custom-scrollbar">
                {stackData.logs && stackData.logs.length > 0 ? (
                  stackData.logs.map((log) => (
                    <div
                      key={`diff-${log.id}`}
                      className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high font-mono text-[14px]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-outline text-[13px]">{log.time}</span>
                          <span className={`px-2 py-0.5 rounded text-[12px] font-bold ${log.badgeClass}`}>{log.type}</span>
                        </div>
                        <span className={`text-[13px] font-bold ${log.metricClass}`}>{log.metric}</span>
                      </div>
                      <div className="text-on-surface font-medium text-[15px]">{log.message}</div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center p-8 text-outline font-mono text-[15px]">
                    No diff audit logs available.
                  </div>
                )}
              </div>
            )}

            {/* Right Panel Footer */}
            <div className="pt-3.5 mt-4 border-t border-surface-container-high flex items-center justify-between text-[13px] font-mono text-outline shrink-0">
              <span>C++ Engine Subsystem Active</span>
              <span className="text-secondary font-bold">O(1) OPT</span>
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      {showDocModal && renderDocModal()}
      {showSettingsModal && renderSettingsModal()}
    </div>
  );
}
