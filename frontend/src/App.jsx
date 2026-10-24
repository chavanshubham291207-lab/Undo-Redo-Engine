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
// Top: Vibrant Orange, 2nd: Vibrant Blue, 3rd: Vibrant Green, 4th: Vibrant Purple, 5th: Vibrant Pink
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
    message: 'C++ Engine ready — push an element to begin.',
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
    }, 4000);
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
  /* =========================================================================
     1. REDESIGNED STACKFLOW LANDING PAGE VIEW
     ========================================================================= */
  if (showWelcome) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200">
        
        {/* Top Navbar */}
        <header className="h-16 shrink-0 w-full bg-white/85 dark:bg-[#131b2e]/85 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
              <span className="material-symbols-outlined text-[22px]">layers</span>
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

            {/* Top Get Started Button */}
            <button
              onClick={handleGetStarted}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <span>Get Started</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </header>

        {/* Central Content: Hero + Compact Features */}
        <main className="flex-1 flex flex-col justify-center max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-10 gap-10">
          
          {/* Balanced Two-Column Hero Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Column: Headline, Subtitle, Badges & Action CTAs */}
            <div className="lg:col-span-7 flex flex-col items-start gap-4 sm:gap-5 text-left">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-bold tracking-wider uppercase shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></span>
                <span>DSA ENGINE • C++ CORE • O(1) STACK OPERATIONS</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]">
                Every Action. <br/>
                <span className="text-blue-600 dark:text-blue-400">Reversible.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                Explore stack operations, undo-redo history, and memory-efficient state management powered by a C++ engine.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {/* Primary Button */}
                <button
                  onClick={handleGetStarted}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-base shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                >
                  <span>Launch Playground</span>
                  <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                </button>

                {/* Secondary Button: Smoothly scrolls to features */}
                <button
                  onClick={() => {
                    const el = document.getElementById('features-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="flex items-center gap-1.5 px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] text-slate-700 dark:text-slate-200 font-bold text-base border border-slate-200 dark:border-slate-700 shadow-xs transition-all cursor-pointer"
                >
                  <span>Explore Features</span>
                  <span className="material-symbols-outlined text-[20px]">expand_more</span>
                </button>
              </div>

              {/* Highlights List */}
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-1 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
                  Contiguous 5-Slot Capacity
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-500 text-[18px]">check_circle</span>
                  Bidirectional State Reversal
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-purple-500 text-[18px]">check_circle</span>
                  Native C++ Execution
                </span>
              </div>

            </div>

            {/* Right Column: Live-Style Stack Preview Card */}
            <div className="lg:col-span-5 flex flex-col items-center w-full">
              <div className="w-full max-w-md bg-white dark:bg-[#131b2e] rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3.5">
                
                {/* Preview Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-[20px]">layers</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-sm">Stack Buffer Preview</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-bold font-mono">
                    Capacity: 3 / 5
                  </span>
                </div>

                {/* Mini Status Cards */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Undo Avail</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">2</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/60 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300">Redo Avail</span>
                    <span className="text-base font-extrabold text-purple-600 dark:text-purple-400 font-mono">1</span>
                  </div>
                </div>

                {/* Colorful Stack Blocks in Live Order (TOP to BOTTOM) */}
                <div className="space-y-2 pt-1">
                  {/* Top Block (Orange) */}
                  <div className="py-2.5 px-4 rounded-xl bg-[#f97316] text-white flex items-center justify-between font-bold text-base shadow-xs">
                    <span className="tracking-tight font-mono font-extrabold text-lg">30</span>
                    <span className="text-[10px] bg-black/20 text-white px-2 py-0.5 rounded-md uppercase font-extrabold tracking-wider">
                      TOP
                    </span>
                  </div>

                  {/* 2nd Block (Blue) */}
                  <div className="py-2.5 px-4 rounded-xl bg-[#2563eb] text-white font-bold text-base shadow-xs flex items-center justify-between">
                    <span className="tracking-tight font-mono font-extrabold text-lg">20</span>
                  </div>

                  {/* 3rd Block (Green) */}
                  <div className="py-2.5 px-4 rounded-xl bg-[#10b981] text-white font-bold text-base shadow-xs flex items-center justify-between">
                    <span className="tracking-tight font-mono font-extrabold text-lg">10</span>
                  </div>

                  {/* Bottom of Stack Label */}
                  <div className="py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-center font-bold text-xs border border-slate-200/70 dark:border-slate-700/70">
                    Bottom of stack
                  </div>
                </div>

                {/* Caption Underneath */}
                <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                  Elements are displayed from top to bottom.
                </p>

                {/* Direct CTA */}
                <button
                  onClick={handleGetStarted}
                  className="w-full mt-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  Interactive Playground →
                </button>
              </div>
            </div>

          </div>

          {/* Compact Features Section with 3 Cards */}
          <div id="features-section" className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="text-center mb-6">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                Engine Capabilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight">
                Built on High-Performance DSA Architecture
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
              
              {/* Feature 1: Stack Operations */}
              <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3.5">
                    <span className="material-symbols-outlined text-[22px]">layers</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                    Stack Operations
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Constant-time O(1) Push and Pop operations operating on a contiguous vector buffer with strict capacity bounding (5 slots) and underflow/overflow protection.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
                  <span>Push / Pop</span>
                  <span>Amortized O(1)</span>
                </div>
              </div>

              {/* Feature 2: Undo & Redo History */}
              <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3.5">
                    <span className="material-symbols-outlined text-[22px]">history</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                    Undo &amp; Redo History
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Dual-stack architecture preserves state snapshots, enabling instant state reversion and forward branching without memory leaks or state corruption.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Snapshots</span>
                  <span>&lt; 0.02 ms Restore</span>
                </div>
              </div>

              {/* Feature 3: Memory-Efficient C++ Core */}
              <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3.5">
                    <span className="material-symbols-outlined text-[22px]">memory</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">
                    Memory-Efficient C++ Core
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Powered by a native compiled C++ engine (<code className="font-mono text-purple-600 dark:text-purple-300">engine.cpp</code>), communicating via high-performance pipes with zero runtime garbage collection pauses.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                  <span>Binary</span>
                  <span>Zero GC Overhead</span>
                </div>
              </div>

            </div>
          </div>

        </main>

        {/* Footer */}
        <footer className="py-4 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800">
          Memory-Efficient Undo–Redo Engine • React + Node.js Express + Native C++
        </footer>
      </div>
    );
  }

  /* =========================================================================
     2. ARCHITECTURE MODAL
     ========================================================================= */
  function renderDocModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-pop-in">
        <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">layers</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">StackFlow Architecture</h3>
            </div>
            <button
              onClick={() => setShowDocModal(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
          
          <div className="py-4 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              <strong>Data Structure:</strong> Native C++ Vector Stack with dual history stacks for reversible snapshots.
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
              <div className="text-blue-600 dark:text-blue-400 font-bold">C++ Core Data Structures:</div>
              <div>• vector&lt;int&gt; s; // Capacity = 5</div>
              <div>• stack&lt;vector&lt;int&gt;&gt; undoStack;</div>
              <div>• stack&lt;vector&lt;int&gt;&gt; redoStack;</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900">
                <div className="text-blue-700 dark:text-blue-300 font-bold">Push: O(1)</div>
                <div className="text-slate-500">Amortized vector push</div>
              </div>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <div className="text-emerald-700 dark:text-emerald-300 font-bold">Pop: O(1)</div>
                <div className="text-slate-500">Instant vector pop</div>
              </div>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-900">
                <div className="text-purple-700 dark:text-purple-300 font-bold">Undo: O(1)</div>
                <div className="text-slate-500">Vector swap restore</div>
              </div>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900">
                <div className="text-amber-700 dark:text-amber-300 font-bold">Redo: O(1)</div>
                <div className="text-slate-500">Forward branch swap</div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => setShowDocModal(false)}
              className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =========================================================================
     3. NO-SCROLL DESKTOP DASHBOARD (100vh Fits Viewport)
     ========================================================================= */
  return (
    <div className="h-screen max-h-screen overflow-y-auto lg:overflow-hidden flex flex-col bg-slate-50 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 antialiased transition-colors duration-200">
      
      {/* 1. Slim Top Navbar (50px) */}
      <header className="h-[50px] shrink-0 w-full bg-white/90 dark:bg-[#131b2e]/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 flex items-center justify-between z-30 shadow-xs">
        {/* Left Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <span className="material-symbols-outlined text-[20px]">layers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              StackFlow
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Ready
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium hidden md:inline ml-1 border-l border-slate-200 dark:border-slate-700 pl-2">
              C++ Stack Engine • Capacity: 5
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {/* Mobile Tab Switcher */}
          <div className="flex lg:hidden bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg mr-1">
            <button
              onClick={() => setMobileTab('playground')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                mobileTab === 'playground'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500'
              }`}
            >
              Playground
            </button>
            <button
              onClick={() => setMobileTab('telemetry')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors border border-slate-200 dark:border-slate-800 text-[11px] font-bold cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">refresh</span>
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Docs Modal Button */}
          <button
            onClick={() => setShowDocModal(true)}
            title="View DSA Architecture"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">menu_book</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200 dark:border-slate-800 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[17px]">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>
      </header>

      {/* 2. Main Body Container (fits exactly in remaining height on desktop) */}
      <main className="flex-1 flex flex-col p-2.5 sm:p-3.5 lg:p-3 gap-2.5 max-w-[1500px] mx-auto w-full overflow-hidden">
        
        {/* Toast Alert Banner (Compact) */}
        {alertInfo && (
          <div
            className={`shrink-0 flex items-center justify-between px-3.5 py-1.5 rounded-xl border animate-slide-down shadow-xs text-xs font-semibold ${
              alertInfo.type === 'OVERFLOW' || alertInfo.type === 'UNDERFLOW' || alertInfo.type === 'ERROR'
                ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">
                {alertInfo.type === 'OVERFLOW' || alertInfo.type === 'UNDERFLOW' ? 'warning' : 'check_circle'}
              </span>
              <span>{alertInfo.message}</span>
            </div>
            <button
              onClick={() => setAlertInfo(null)}
              className="opacity-70 hover:opacity-100 p-0.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        {/* 3. Top Statistics Row: 4 Aligned Cards (Height ~64px) */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          
          {/* Stat 1: Stack Size */}
          <div className="bg-[#eff6ff] dark:bg-[#1e293b]/80 border border-[#dbeafe] dark:border-[#334155] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">layers</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Stack Size
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  {freeSlots} free slots
                </span>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#1d4ed8] dark:text-[#93c5fd] font-mono tracking-tight mr-1">
              {currentSize}<span className="text-xs text-slate-400 font-normal">/5</span>
            </div>
          </div>

          {/* Stat 2: Undo Available */}
          <div className="bg-[#f0fdf4] dark:bg-[#064e3b]/30 border border-[#bbf7d0] dark:border-[#065f46] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">undo</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  Undo Avail
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Reversible
                </span>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#15803d] dark:text-[#86efac] font-mono tracking-tight mr-1">
              {stackData.undoCount}
            </div>
          </div>

          {/* Stat 3: Redo Available */}
          <div className="bg-[#faf5ff] dark:bg-[#3b0764]/30 border border-[#f3e8ff] dark:border-[#581c87] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">redo</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  Redo Avail
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  Forward steps
                </span>
              </div>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-[#7e22ce] dark:text-[#d8b4fe] font-mono tracking-tight mr-1">
              {stackData.redoCount}
            </div>
          </div>

          {/* Stat 4: Memory Buffer & Capacity */}
          <div className="bg-slate-100 dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">memory</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Engine Core
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  O(1) Constant
                </span>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 mr-1 text-right">
              <div>{currentSize * 4} B</div>
              <div className="text-[10px] text-slate-400 font-normal">Active int32</div>
            </div>
          </div>

        </div>

        {/* 4. Balanced Grid: LEFT (Stack & Controls) | RIGHT (Telemetry/Memory/Diff) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2.5 sm:gap-3 items-stretch min-h-0">
          
          {/* =================================================================
              LEFT COLUMN (6 or 7 cols): Stack Visualization + Command Controls
              ================================================================= */}
          <div className={`lg:col-span-6 xl:col-span-7 flex flex-col gap-2.5 min-h-0 ${mobileTab !== 'playground' ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Top Card in Left Column: Stack Visualization */}
            <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col justify-between shrink-0">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800/80 mb-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">view_column</span>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Stack Visualization
                  </h2>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px] font-bold tracking-wider">
                    LIFO • {currentSize} / {capacity}
                  </span>
                </div>
              </div>

              {/* Vertical Stack Elements Display */}
              <div className="flex flex-col gap-1.5 min-h-[125px] justify-end">
                {currentSize === 0 ? (
                  <div className="py-5 px-3 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[26px] mb-1 text-slate-300 dark:text-slate-600">layers_clear</span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Stack is currently empty</span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">Enter a number below and click Push</span>
                  </div>
                ) : (
                  stackElements.slice().reverse().map((val, revIdx) => {
                    const isTop = revIdx === 0;
                    const colorScheme = BLOCK_COLORS[revIdx % BLOCK_COLORS.length];

                    return (
                      <div
                        key={`stack-node-${revIdx}-${val}`}
                        className={`w-full py-2 px-4 rounded-xl ${colorScheme.bg} ${colorScheme.text} ${colorScheme.shadow} flex items-center justify-between font-bold text-base sm:text-lg transition-all shadow-xs`}
                      >
                        <span className="tracking-tight font-extrabold font-mono">{val}</span>
                        {isTop && (
                          <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white bg-black/20 px-2 py-0.5 rounded-md">
                            TOP
                          </span>
                        )}
                      </div>
                    );
                  })
                )}

                {/* Bottom of Stack Label */}
                <div className="w-full py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-center font-bold text-[11px] border border-slate-200/60 dark:border-slate-700/60">
                  Bottom of stack
                </div>

                <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                  Elements are displayed from top to bottom.
                </p>
              </div>
            </div>

            {/* Bottom Card in Left Column: Command Controls + Last Operation */}
            <div className="bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col gap-2 shrink-0">
              
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Perform an operation
                </h3>
                
                {/* Quick Integer Presets */}
                <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {[10, 20, 30, 42, 99].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePush(preset)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-950 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 text-[10px] font-bold"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Field */}
              <div className="flex items-center px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
                <span className="material-symbols-outlined text-slate-400 text-[17px] mr-2">terminal</span>
                <input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handlePush();
                  }}
                  placeholder="Enter integer payload (e.g. 30)..."
                  className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none"
                />
                {inputValue && (
                  <button
                    onClick={() => setInputValue('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                    title="Clear"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                  </button>
                )}
              </div>

              {/* 2-Column Grid of 4 Equal Action Buttons (Height: 48px) */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                
                {/* Push */}
                <button
                  onClick={() => handlePush()}
                  disabled={loading}
                  className="h-12 sm:h-13 bg-[#2563eb] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xs shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="text-xl font-bold leading-none">+</span>
                  <span>Push</span>
                </button>

                {/* Pop */}
                <button
                  onClick={handlePop}
                  disabled={loading || currentSize === 0}
                  className="h-12 sm:h-13 bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xs shadow-red-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="text-xl font-bold leading-none">−</span>
                  <span>Pop</span>
                </button>

                {/* Undo */}
                <button
                  onClick={handleUndo}
                  disabled={loading || stackData.undoCount === 0}
                  className="h-12 sm:h-13 bg-[#10b981] hover:bg-[#059669] active:bg-[#047857] text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xs shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[19px] leading-none">undo</span>
                  <span>Undo</span>
                </button>

                {/* Redo */}
                <button
                  onClick={handleRedo}
                  disabled={loading || stackData.redoCount === 0}
                  className="h-12 sm:h-13 bg-[#8b5cf6] hover:bg-[#7c3aed] active:bg-[#6d28d9] text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm sm:text-base shadow-xs shadow-purple-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-[19px] leading-none">redo</span>
                  <span>Redo</span>
                </button>

              </div>

              {/* Compact Last Operation Bar */}
              <div className="bg-[#eff6ff] dark:bg-[#172554]/40 border border-[#bfdbfe] dark:border-[#1e3a8a] rounded-xl px-3 py-2 flex items-center justify-between text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-bold text-[#1d4ed8] dark:text-[#93c5fd] shrink-0">Last op:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {lastOperation.message}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 shrink-0 ml-2">
                  {lastOperation.time}
                </span>
              </div>

            </div>

          </div>

          {/* =================================================================
              RIGHT COLUMN (6 or 5 cols): Real-Time Telemetry / Memory / Diff Panels
              ================================================================= */}
          <div className={`lg:col-span-6 xl:col-span-5 flex flex-col h-full min-h-0 bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 sm:p-3.5 shadow-xs ${mobileTab !== 'telemetry' ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Header Tabs */}
            <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setRightPanelTab('telemetry')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rightPanelTab === 'telemetry'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Telemetry Log
                </button>
                <button
                  onClick={() => setRightPanelTab('memory')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rightPanelTab === 'memory'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Memory Stats
                </button>
                <button
                  onClick={() => setRightPanelTab('diff')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    rightPanelTab === 'diff'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Diff Audit
                </button>
              </div>

              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>STREAM</span>
              </div>
            </div>

            {/* Content Body: Scrollable only inside this panel */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-0.5">
              
              {/* TAB 1: Telemetry Log */}
              {rightPanelTab === 'telemetry' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pb-1">
                    <span>Events ({stackData.logs?.length || 0})</span>
                    <span>O(1) Engine Stream</span>
                  </div>

                  {stackData.logs && stackData.logs.length > 0 ? (
                    stackData.logs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 text-[11px] font-mono"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-slate-400 shrink-0 text-[10px]">{log.time}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
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
                        <span className="text-slate-400 font-bold shrink-0 ml-1.5 text-[10px]">
                          {log.metric}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 text-xs font-mono">
                      <span className="material-symbols-outlined text-[24px] mb-1">history</span>
                      <span>No telemetry events yet.</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Memory Profiler */}
              {rightPanelTab === 'memory' && (
                <div className="flex flex-col space-y-2 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                    <div className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-1.5">Vector Memory (`std::vector&lt;int&gt;`)</div>
                    <div className="space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                      <div>• Capacity: <strong className="text-slate-900 dark:text-white">5 slots</strong></div>
                      <div>• Active Count: <strong className="text-slate-900 dark:text-white">{currentSize}</strong></div>
                      <div>• Free Slots: <strong className="text-slate-900 dark:text-white">{freeSlots}</strong></div>
                      <div>• Memory Footprint: <strong className="text-emerald-600 dark:text-emerald-400">{currentSize * 4} Bytes</strong></div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                    <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs mb-1.5">Dual History Stack Snapshots</div>
                    <div className="space-y-1 text-slate-600 dark:text-slate-300 text-[11px]">
                      <div>• Undo Stack: <strong className="text-slate-900 dark:text-white">{stackData.undoCount} states</strong></div>
                      <div>• Redo Stack: <strong className="text-slate-900 dark:text-white">{stackData.redoCount} states</strong></div>
                      <div>• Pointer Swapping: <strong className="text-slate-900 dark:text-white">&lt; 0.02 ms</strong></div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
                    <div className="text-purple-600 dark:text-purple-400 font-bold text-xs mb-1">Active Vector Snapshot</div>
                    <div className="bg-white dark:bg-slate-950 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-[11px]">
                      [{stackElements.join(', ')}]
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Diff Audit */}
              {rightPanelTab === 'diff' && (
                <div className="flex flex-col space-y-1.5 text-xs font-mono">
                  {stackData.logs && stackData.logs.length > 0 ? (
                    stackData.logs.map((log) => (
                      <div
                        key={`diff-${log.id}`}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800 text-[11px]"
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-slate-400 text-[10px]">{log.time}</span>
                          <span className="font-bold text-slate-500 text-[10px]">{log.metric}</span>
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-semibold">{log.message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs font-mono">
                      No diff audit logs yet.
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Bottom Status Footer in Right Column */}
            <div className="shrink-0 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>C++ Engine Bridge Active</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">O(1) OPT</span>
            </div>

          </div>

        </div>

      </main>

      {/* Architecture Modal */}
      {showDocModal && renderDocModal()}
    </div>
  );
}
