# Memory-Efficient Undo–Redo Engine (DSA Project)

A simple, fully functional web application demonstrating an **Undo–Redo Engine** with contiguous stack visualization, built using **React.js**, **Node.js + Express.js**, and native **C++** using the exact Data Structure & Algorithms (DSA) stack logic.

---

## 📸 Design & UI Reference: StackFlow Playground
The frontend implements the modern **StackFlow** UI specification:
- **Header**: StackFlow branding, live `Ready` status badge, theme toggle, and quick reset.
- **Top Statistic Cards**: 3 prominent cards tracking **Stack Size**, **Undo Available**, and **Redo Available** with custom color-coded styling.
- **Stack Visualization**:
  - Vertical stack blocks rendered top-to-bottom with vibrant colors:
    - **Top element**: Highlighted in vibrant **Orange** with an active **TOP** label.
    - **Middle elements**: Rendered in distinct **Blue**, **Green**, **Purple**, and **Pink** blocks.
    - **Bottom of Stack**: Anchored with a dedicated **Bottom of stack** label.
    - *"Elements are displayed from top to bottom."* caption.
- **Perform an Operation**:
  - Custom integer payload input with quick preset buttons (`+10`, `+20`, `+30`, `+42`, `+99`) and Enter key support.
  - Large, tactile 2-column action button grid: **Push** (Blue), **Pop** (Red), **Undo** (Green), **Redo** (Purple).
- **Last Operation Card**: Real-time status container displaying operation outcomes, timestamps, and C++ engine diagnostics.
- **Live Telemetry & Diagnostics**: Dedicated side panel for **Telemetry Log**, **Memory Profiler**, and **Diff Audit**.
- **Dual Themes**: Polished Light Theme matching the reference screenshot and high-contrast Dark Theme.

---

## 🏗️ Project Architecture

```
DSA Project/
├── backend/
│   ├── cpp/
│   │   ├── engine.cpp       # Native C++ stack, undoStack, redoStack DSA logic
│   │   └── engine.exe       # Compiled C++ binary (MinGW g++)
│   ├── server.js            # Node.js + Express server bridging React to C++
│   └── package.json         # Backend dependencies (express, cors)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # React component matching the Stitch design
│   │   ├── main.jsx         # React DOM mounting
│   │   └── index.css        # Smooth CSS keyframe animations
│   ├── index.html           # HTML5 template with Geist & JetBrains Mono fonts
│   ├── vite.config.js       # Vite configuration with /api reverse proxy
│   └── package.json         # Frontend dependencies (React, Vite)
├── package.json             # Root unified runner scripts
└── README.md                # Documentation and run instructions
```

---

## ⚙️ DSA C++ Logic Details

- **Capacity**: Fixed at `5` elements (`#define SIZE 5`).
- **Data Structures**:
  - Main Stack: `std::vector<int> s;`
  - Undo History: `std::stack<std::vector<int>> undoStack;`
  - Redo History: `std::stack<std::vector<int>> redoStack;`
- **Operations & Time Complexity**:
  - `push(x)`: $O(1)$ amortized. Saves state to `undoStack`, clears `redoStack`, appends $x$. Guarded against **Stack Overflow** when `size == 5`.
  - `pop()`: $O(1)$. Saves state to `undoStack`, removes top element. Guarded against **Stack Underflow** when `size == 0`.
  - `undo()`: $O(1)$ state swap. Pushes current state to `redoStack` and restores previous state from `undoStack`.
  - `redo()`: $O(1)$ state swap. Pushes current state to `undoStack` and restores state from `redoStack`.

---

## 🚀 How to Run Locally

### 1. Prerequisites
- **Node.js** (v18+) & **npm** installed.
- **MinGW g++** (already installed on Windows at `C:\MinGW\bin\g++.exe` or in your `PATH`).

---

### 2. Quick Start (Single Command)

From the project root (`c:\Users\chava\OneDrive\Desktop\DSA Project`):

```bash
# 1. Compile the C++ Engine
npm run build:cpp

# 2. Run both Backend & Frontend simultaneously
npm start
```

Open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

### 3. Step-by-Step Manual Execution (Optional)

If you prefer running the backend and frontend in separate terminals:

#### Terminal 1: Backend
```bash
# Compile C++ code
g++ -O2 backend/cpp/engine.cpp -o backend/cpp/engine.exe

# Start Node.js Express server
cd backend
npm install
node server.js
```
*Backend runs on `http://localhost:5000` and communicates with `backend/cpp/engine.exe` via high-performance bidirectional pipes.*

#### Terminal 2: Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000` and proxies `/api` calls to port 5000.*

---

## 🚀 Render Deployment Guide

- **Live URL**: [https://undo-redo-engine.onrender.com](https://undo-redo-engine.onrender.com)
- **Status Endpoint**: `GET /` (returns an HTML status page or JSON status confirming the backend is running)
- **API Health**: `GET /api/health`

### Render Configuration
- **Build Command**: `npm run build` (or `npm install`)
- **Start Command**: `npm start` (or `node backend/server.js`)
- **Environment**: Linux Native Web Service (`process.env.PORT` automatically bound to `0.0.0.0`)
- **C++ Engine**: Auto-compiled with `g++ -O2` on Linux (`backend/cpp/engine`) and Windows (`backend/cpp/engine.exe`).
- **Separate Frontend**: Set environment variable `VITE_API_BASE_URL=https://undo-redo-engine.onrender.com/api` on Vercel/Netlify.

---

## 🧪 Testing Checklist
1. **Status Page**: Visit `/` to see the live project and engine status dashboard.
2. **Push**: Enter any integer into the input field and click **Push** (or press Enter). The node appears with a glowing **TOP** label.
3. **Multiple Pushes**: Push up to 5 elements. The bottom node receives the **BOTTOM** anchor label.
4. **Stack Overflow**: Try to push a 6th element. An alert banner appears and the operation is rejected.
5. **Undo**: Click **Undo**. The previous state is restored and the Redo counter increments.
6. **Redo**: Click **Redo**. The reverted state is re-applied forward.
7. **Pop**: Click **Pop** until empty.
8. **Stack Underflow**: Click **Pop** when the stack is empty to test underflow rejection.
9. **Tabs**: Click **Diff Log** or **Memory Stats** in the bottom navigation bar to inspect execution history and memory allocations.
