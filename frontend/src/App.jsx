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

// Colorful palette mapping matching the StackFlow reference screenshot
// Top: Vibrant Orange, 2nd: Vibrant Blue, 3rd: Vibrant Green, 4th: Vibrant Purple, 5th: Vibrant Pink/Teal
const BLOCK_COLORS = [
  { bg: 'bg-[#f97316]', text: 'text-white', border: 'border-[#ea580c]', shadow: 'shadow-orange-500/20' }, // 1st (TOP)
  { bg: 'bg-[#2563eb]', text: 'text-white', border: 'border-[#1d4ed8]', shadow: 'shadow-blue-500/20' },   // 2nd
  { bg: 'bg-[#10b981]', text: 'text-white', border: 'border-[#059669]', shadow: 'shadow-emerald-500/20' },// 3rd
  { bg: 'bg-[#8b5cf6]', text: 'text-white', border: 'border-[#7c3aed]', shadow: 'shadow-purple-500/20' }, // 4th
  { bg: 'bg-[#ec4899]', text: 'text-white', border: 'border-[#db2777]', shadow: 'shadow-pink-500/20' }    // 5th
];

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  const [showWelcome, setShowWelcome] = useState(() => {
    return !sessionStorage.getItem('hasSeenWelcome');
  });

  const [stackData, setStackData] = useState({
    status: 'READY',
    message: 'C++ Engine Initialized',
    capacity: 5,
    size: 0,
    undoCount: 0,
    redoCount: 0,
    stack: [],
    logs: []
  });

  const [lastOperation, setLastOperation] = useState({
    action: 'INIT',
    message: 'Push an element below to begin stack operations.',
    status: 'READY',
    time: 'Just now'
  });
  
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [alertInfo, setAlertInfo] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState('telemetry'); // 'telemetry' | 'memory' | 'diff'
  const [showDocModal, setShowDocModal] = useState(false);
  const [mobileTab, setMobileTab] = useState('playground'); // 'playground' | 'telemetry'

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
        if (data.stack && data.stack.length > 0) {
          const topVal = data.stack[data.stack.length - 1];
          setLastOperation({
            action: 'STATE',
            message: `Current stack active with ${data.stack.length} elements (Top: ${topVal}).`,
            status: 'SUCCESS',
            time: 'Loaded'
          });
        }
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

  const handlePush = async (overrideVal) => {
    const rawVal = overrideVal !== undefined ? overrideVal : inputValue;
    const val = parseInt(rawVal, 10);
    if (isNaN(val)) {
      showAlert('ERROR', 'Please enter a valid integer to push');
      return;
    }

    if (stackData.size >= (stackData.capacity || 5)) {
      showAlert('OVERFLOW', '⚠️ Stack Overflow! Maximum capacity (5) reached.');
      setLastOperation({
        action: 'PUSH',
        message: 'Stack Overflow! Maximum capacity (5) reached — element rejected.',
        status: 'OVERFLOW',
        time: new Date().toLocaleTimeString()
      });
      return;
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
        setLastOperation({
          action: 'PUSH',
          message: 'Stack Overflow! Maximum capacity (5) reached — element rejected.',
          status: 'OVERFLOW',
          time: new Date().toLocaleTimeString()
        });
      } else if (data.status === 'SUCCESS') {
        showAlert('SUCCESS', `Pushed ${val} to top of stack`);
        setLastOperation({
          action: 'PUSH',
          message: `Push operation successful — ${val} added to the stack.`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });
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
      setLastOperation({
        action: 'POP',
        message: 'Stack Underflow! Cannot pop from an empty stack.',
        status: 'UNDERFLOW',
        time: new Date().toLocaleTimeString()
      });
      return;
    }

    setLoading(true);
    try {
      const poppedVal = stackData.stack && stackData.stack.length > 0 ? stackData.stack[stackData.stack.length - 1] : '';
      const res = await fetch(`${API_BASE}/pop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setStackData(data);
      if (data.status === 'UNDERFLOW') {
        showAlert('UNDERFLOW', '⚠️ Stack Underflow! Cannot pop from empty stack.');
        setLastOperation({
          action: 'POP',
          message: 'Stack Underflow! Cannot pop from an empty stack.',
          status: 'UNDERFLOW',
          time: new Date().toLocaleTimeString()
        });
      } else if (data.status === 'SUCCESS') {
        showAlert('SUCCESS', data.message);
        setLastOperation({
          action: 'POP',
          message: `Pop operation successful — deleted element ${poppedVal} from the stack.`,
          status: 'SUCCESS',
          time: new Date().toLocaleTimeString()
        });
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
      setLastOperation({
        action: 'UNDO',
        message: 'Undo operation successful — reverted to previous stack state.',
        status: 'SUCCESS',
        time: new Date().toLocaleTimeString()
      });
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
      setLastOperation({
        action: 'REDO',
        message: 'Redo operation successful — reapplied forward stack state.',
        status: 'SUCCESS',
        time: new Date().toLocaleTimeString()
      });
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
      setLastOperation({
        action: 'RESET',
        message: 'Stack reset successful — all elements cleared.',
        status: 'SUCCESS',
        time: new Date().toLocaleTimeString()
      });
    } catch (err) {
      showAlert('ERROR', 'Failed to reset stack');
    } finally {
      setLoading(false);
    }
  };

  const capacity = stackData.capacity || 5;
  const currentSize = stackData.stack ? stackData.stack.length : 0;
  const freeSlots = Math.max(0, capacity - currentSize);

  // Stack elements in display order: Top at index (size-1) down to Bottom at index 0
  const stackElements = [...(stackData.stack || [])];

  /* =========================================================================
     1. WELCOME / LANDING PAGE VIEW
     ========================================================================= */
  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200">
        {/* Welcome Top Navbar */}
        <header className="h-16 shrink-0 w-full bg-white/80 dark:bg-[#131b2e]/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <span className="material-symbols-outlined text-[24px]">layers</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                StackFlow
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Stack Operations Playground
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800"
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            <button
              onClick={handleGetStarted}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <span>Get Started</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </header>

        {/* Central Viewport Content */}
        <main className="flex-1 flex flex-col justify-center items-center px-4 py-8 max-w-4xl mx-auto w-full gap-5">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
            <span>Data Structures &amp; Algorithms Engine</span>
            <span>•</span>
            <span className="font-bold">O(1) C++ Core</span>
          </div>

          <div className="text-center max-w-2xl">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Memory-Efficient <br/>
              <span className="text-blue-600 dark:text-blue-400">StackFlow Engine</span>
            </h1>
            <p className="mt-3 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Interactive visualization of reversible state management. Built on contiguous C++ stack logic 
              with $O(1)$ operations, dual history branches, and strict 5-slot capacity bounds.
            </p>
          </div>

          {/* Quick Preview Card */}
          <div className="w-full max-w-md bg-white dark:bg-[#131b2e] rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">Interactive Stack Tube</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                Ready
              </span>
            </div>

            <div className="space-y-2">
              <div className="p-3.5 rounded-xl bg-[#f97316] text-white flex items-center justify-between font-bold text-lg shadow-sm">
                <span>30</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded uppercase">TOP</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#2563eb] text-white font-bold text-lg shadow-sm">
                <span>20</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#10b981] text-white font-bold text-lg shadow-sm">
                <span>10</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-center font-semibold text-xs border border-slate-200 dark:border-slate-700">
                Bottom of stack
              </div>
            </div>

            <button
              onClick={handleGetStarted}
              className="w-full mt-3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md shadow-blue-500/25 transition-all cursor-pointer"
            >
              Open StackFlow Dashboard
            </button>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-600 border-t border-slate-200 dark:border-slate-800">
          Memory-Efficient Undo–Redo Engine • React + Node.js + C++
        </footer>
      </div>
    );
  }

  /* =========================================================================
     2. REUSABLE MODAL
     ========================================================================= */
  function renderDocModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-pop-in">
        <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">layers</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">StackFlow Architecture</h3>
            </div>
            <button
              onClick={() => setShowDocModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          
          <div className="py-5 space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong>Data Structure:</strong> Native C++ Vector Stack with dual history stacks for state preservation.
            </p>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="text-blue-600 dark:text-blue-400 font-bold mb-1">C++ Core Data Structures:</div>
              <div>• vector&lt;int&gt; s; // Capacity = 5</div>
              <div>• stack&lt;vector&lt;int&gt;&gt; undoStack;</div>
              <div>• stack&lt;vector&lt;int&gt;&gt; redoStack;</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900">
                <div className="text-blue-700 dark:text-blue-300 font-bold">Push: O(1)</div>
                <div className="text-slate-500">Amortized vector push</div>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <div className="text-emerald-700 dark:text-emerald-300 font-bold">Pop: O(1)</div>
                <div className="text-slate-500">Instant vector pop</div>
              </div>
              <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl border border-purple-200 dark:border-purple-900">
                <div className="text-purple-700 dark:text-purple-300 font-bold">Undo: O(1)</div>
                <div className="text-slate-500">Vector swap restore</div>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900">
                <div className="text-amber-700 dark:text-amber-300 font-bold">Redo: O(1)</div>
                <div className="text-slate-500">Forward branch swap</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => setShowDocModal(false)}
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     3. STACKFLOW MAIN DASHBOARD
     ========================================================================= */
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200">
      
      {/* Top Navbar */}
      <header className="h-16 shrink-0 w-full bg-white/90 dark:bg-[#131b2e]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        {/* Left Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <span className="material-symbols-outlined text-[24px]">layers</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                StackFlow
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Ready
              </span>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
              Stack Operations Playground • C++ Core
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setMobileTab('playground')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                mobileTab === 'playground'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Playground
            </button>
            <button
              onClick={() => setMobileTab('telemetry')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                mobileTab === 'telemetry'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Telemetry
            </button>
          </div>

          {/* Quick Reset Stack Button */}
          <button
            onClick={handleReset}
            title="Reset Stack to Initial Clean State"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors border border-slate-200 dark:border-slate-800 text-xs font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Docs Modal Button */}
          <button
            onClick={() => setShowDocModal(true)}
            title="View DSA Architecture"
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">menu_book</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        
        {/* Toast Alert */}
        {alertInfo && (
          <div
            className={`mb-5 flex items-center justify-between px-4 py-3 rounded-2xl border animate-slide-down shadow-md ${
              alertInfo.type === 'OVERFLOW' || alertInfo.type === 'UNDERFLOW' || alertInfo.type === 'ERROR'
                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[22px]">
                {alertInfo.type === 'OVERFLOW' || alertInfo.type === 'UNDERFLOW' ? 'warning' : 'check_circle'}
              </span>
              <span className="text-sm font-semibold">{alertInfo.message}</span>
            </div>
            <button
              onClick={() => setAlertInfo(null)}
              className="opacity-70 hover:opacity-100 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* =================================================================
              PRIMARY COLUMN: The StackFlow Playground (Matches Reference Screenshot)
              ================================================================= */}
          <div className={`lg:col-span-7 flex flex-col gap-6 ${mobileTab !== 'playground' ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Top 3 Statistic Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              
              {/* Card 1: Stack Size */}
              <div className="bg-[#eff6ff] dark:bg-[#1e293b]/80 border border-[#dbeafe] dark:border-[#334155] rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all">
                <div className="text-blue-600 dark:text-blue-400 mb-2">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">layers</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-4xl font-extrabold text-[#1d4ed8] dark:text-[#93c5fd] tracking-tight">
                    {currentSize}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-blue-700 dark:text-blue-300 mt-1">
                    Stack Size
                  </div>
                </div>
              </div>

              {/* Card 2: Undo Available */}
              <div className="bg-[#f0fdf4] dark:bg-[#064e3b]/40 border border-[#bbf7d0] dark:border-[#065f46] rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all">
                <div className="text-emerald-600 dark:text-emerald-400 mb-2">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">undo</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-4xl font-extrabold text-[#15803d] dark:text-[#86efac] tracking-tight">
                    {stackData.undoCount}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                    Undo Available
                  </div>
                </div>
              </div>

              {/* Card 3: Redo Available */}
              <div className="bg-[#faf5ff] dark:bg-[#3b0764]/40 border border-[#f3e8ff] dark:border-[#581c87] rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-all">
                <div className="text-purple-600 dark:text-purple-400 mb-2">
                  <span className="material-symbols-outlined text-[24px] sm:text-[28px]">redo</span>
                </div>
                <div>
                  <div className="text-2xl sm:text-4xl font-extrabold text-[#7e22ce] dark:text-[#d8b4fe] tracking-tight">
                    {stackData.redoCount}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-purple-700 dark:text-purple-300 mt-1">
                    Redo Available
                  </div>
                </div>
              </div>

            </div>

            {/* Stack Visualization Card */}
            <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                    Stack<br/>Visualization
                  </h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-xs font-bold tracking-wider">
                  LIFO
                </span>
              </div>

              {/* Stack Elements Container */}
              <div className="flex flex-col gap-2.5 min-h-[160px] justify-end">
                
                {/* Empty State */}
                {currentSize === 0 ? (
                  <div className="py-8 px-4 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[36px] mb-2 text-slate-300 dark:text-slate-600">layers_clear</span>
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Stack is empty</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Use the Push button below to add elements (up to 5)</span>
                  </div>
                ) : (
                  /* Render Stack Blocks from TOP to BOTTOM */
                  stackElements.slice().reverse().map((val, revIdx) => {
                    const isTop = revIdx === 0;
                    const colorScheme = BLOCK_COLORS[revIdx % BLOCK_COLORS.length];

                    return (
                      <div
                        key={`stack-node-${revIdx}-${val}`}
                        className={`w-full py-3.5 px-5 rounded-2xl ${colorScheme.bg} ${colorScheme.text} ${colorScheme.shadow} flex items-center justify-between font-bold text-xl sm:text-2xl transition-all shadow-md transform hover:-translate-y-0.5`}
                      >
                        <span className="tracking-tight font-extrabold">{val}</span>
                        {isTop && (
                          <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white/95 bg-black/15 px-2.5 py-1 rounded-lg">
                            TOP
                          </span>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Bottom of Stack Label */}
                <div className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-center font-bold text-xs sm:text-sm border border-slate-200/60 dark:border-slate-700/60 mt-1">
                  Bottom of stack
                </div>

                {/* Caption Underneath */}
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium mt-2">
                  Elements are displayed from top to bottom.
                </p>
              </div>
            </div>

            {/* Perform an operation Card */}
            <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Perform an operation
              </h3>

              {/* Push Integer Input */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                  <span className="material-symbols-outlined text-slate-400 text-[20px] mr-2.5">terminal</span>
                  <input
                    type="number"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePush();
                    }}
                    placeholder="Enter an integer to push (e.g. 30)..."
                    className="w-full bg-transparent text-sm sm:text-base font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                  />
                  {inputValue && (
                    <button
                      onClick={() => setInputValue('')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                      title="Clear"
                    >
                      <span className="material-symbols-outlined text-[18px]">cancel</span>
                    </button>
                  )}
                </div>

                {/* Quick Integer Presets */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] uppercase tracking-wider text-slate-400">Quick:</span>
                  {[10, 20, 30, 42, 99].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePush(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2-Column Grid of Large Action Buttons (Exact Reference Match) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-1">
                
                {/* 1. Push Button (Vibrant Blue) */}
                <button
                  onClick={() => handlePush()}
                  disabled={loading}
                  className="bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white rounded-2xl py-4 sm:py-5 flex flex-col items-center justify-center font-bold text-base sm:text-lg shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="text-2xl font-bold leading-none mb-1">+</span>
                  <span>Push</span>
                </button>

                {/* 2. Pop Button (Vibrant Red) */}
                <button
                  onClick={handlePop}
                  disabled={loading || currentSize === 0}
                  className="bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white rounded-2xl py-4 sm:py-5 flex flex-col items-center justify-center font-bold text-base sm:text-lg shadow-md shadow-red-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl font-bold leading-none mb-1">−</span>
                  <span>Pop</span>
                </button>

                {/* 3. Undo Button (Vibrant Emerald Green) */}
                <button
                  onClick={handleUndo}
                  disabled={loading || stackData.undoCount === 0}
                  className="bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white rounded-2xl py-4 sm:py-5 flex flex-col items-center justify-center font-bold text-base sm:text-lg shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[24px] leading-none mb-1">undo</span>
                  <span>Undo</span>
                </button>

                {/* 4. Redo Button (Vibrant Purple) */}
                <button
                  onClick={handleRedo}
                  disabled={loading || stackData.redoCount === 0}
                  className="bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] text-white rounded-2xl py-4 sm:py-5 flex flex-col items-center justify-center font-bold text-base sm:text-lg shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[24px] leading-none mb-1">redo</span>
                  <span>Redo</span>
                </button>

              </div>
            </div>

            {/* Last Operation Panel */}
            <div className="bg-[#eff6ff] dark:bg-[#172554]/40 border border-[#bfdbfe] dark:border-[#1e3a8a] rounded-3xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-base sm:text-lg font-bold text-[#1d4ed8] dark:text-[#93c5fd]">
                  Last operation
                </h4>
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                  {lastOperation.time}
                </span>
              </div>
              <p className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200">
                {lastOperation.message}
              </p>
            </div>

          </div>

          {/* =================================================================
              SECONDARY COLUMN: Real-Time Telemetry, Memory Stats & Diff Audit (Preserved)
              ================================================================= */}
          <div className={`lg:col-span-5 flex flex-col gap-6 ${mobileTab !== 'telemetry' ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Telemetry Panel Container */}
            <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col">
              
              {/* Header with Switcher Tabs */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setRightPanelTab('telemetry')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      rightPanelTab === 'telemetry'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Telemetry Log
                  </button>
                  <button
                    onClick={() => setRightPanelTab('memory')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      rightPanelTab === 'memory'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Memory Stats
                  </button>
                  <button
                    onClick={() => setRightPanelTab('diff')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      rightPanelTab === 'diff'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Diff Audit
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="hidden sm:inline">LIVE</span>
                </div>
              </div>

              {/* TAB 1: Telemetry Log */}
              {rightPanelTab === 'telemetry' && (
                <div className="flex flex-col">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2.5">
                    <span>Events ({stackData.logs?.length || 0})</span>
                    <span>O(1) C++ Native</span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                    {stackData.logs && stackData.logs.length > 0 ? (
                      stackData.logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-400 shrink-0">{log.time}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 ${
                              log.type === 'PUSH' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                              log.type === 'POP' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                              log.type === 'UNDO' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                              log.type === 'REDO' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' :
                              'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {log.type}
                            </span>
                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                              {log.message}
                            </span>
                          </div>
                          <span className="text-slate-500 font-bold shrink-0 ml-2">
                            {log.metric}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs font-mono">
                        <span className="material-symbols-outlined text-[28px] mb-1">history</span>
                        <span>No telemetry events yet.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: Memory Profiler */}
              {rightPanelTab === 'memory' && (
                <div className="flex flex-col space-y-3 text-xs font-mono max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                    <div className="text-blue-600 dark:text-blue-400 font-bold text-sm mb-2">Vector Stack (`std::vector&lt;int&gt;`)</div>
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <div>• Capacity: <strong className="text-slate-900 dark:text-white">5 slots</strong></div>
                      <div>• Active Count: <strong className="text-slate-900 dark:text-white">{currentSize}</strong></div>
                      <div>• Free Slots: <strong className="text-slate-900 dark:text-white">{freeSlots}</strong></div>
                      <div>• Contiguous Buffer: <strong className="text-emerald-600 dark:text-emerald-400">O(1) access</strong></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm mb-2">Dual Snapshot Stack Memory</div>
                    <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                      <div>• Undo Stack: <strong className="text-slate-900 dark:text-white">{stackData.undoCount} vectors</strong></div>
                      <div>• Redo Stack: <strong className="text-slate-900 dark:text-white">{stackData.redoCount} vectors</strong></div>
                      <div>• Restoration Speed: <strong className="text-slate-900 dark:text-white">&lt; 0.05 ms</strong></div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                    <div className="text-purple-600 dark:text-purple-400 font-bold text-sm mb-2">Raw Stack Vector</div>
                    <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold">
                      [{stackElements.join(', ')}]
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Diff Audit */}
              {rightPanelTab === 'diff' && (
                <div className="flex flex-col space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                  {stackData.logs && stackData.logs.length > 0 ? (
                    stackData.logs.map((log) => (
                      <div
                        key={`diff-${log.id}`}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 text-xs font-mono"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-slate-400">{log.time}</span>
                          <span className="font-bold text-slate-500">{log.metric}</span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">{log.message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs font-mono">
                      No diff audit logs yet.
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Quick Engine Architecture Summary */}
            <div className="bg-slate-100 dark:bg-[#131b2e]/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 font-bold">
                <span>C++ Native Engine</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono">Capacity: 5</span>
              </div>
              <p>
                Strict bounds enforcement prevent buffer overflows and ensure constant time $O(1)$ operations with zero garbage collection pauses.
              </p>
            </div>

          </div>

        </div>

      </main>

      {/* Reusable Modals */}
      {showDocModal && renderDocModal()}
    </div>
  );
}
