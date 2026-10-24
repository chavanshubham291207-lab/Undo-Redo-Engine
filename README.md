# Memory-Efficient Undo–Redo Engine (DSA Project)

A simple, fully functional web application demonstrating an **Undo–Redo Engine** with contiguous stack visualization, built using **React.js**, **Node.js + Express.js**, and native **C++** using the exact Data Structure & Algorithms (DSA) stack logic.

---

## 📸 Design & UI Reference
The frontend directly replicates the Google Stitch Dark Cyberpunk design specification with:
- **Single-Screen Dashboard**: Fits cleanly within a single viewport without vertical scrolling on desktop.
- **Side-by-Side Ergonomic Layout**:
  - **Left Section**: Stack Visualizer tube (`TOP` & `BOTTOM` pointer nodes, unallocated capacity buffer) and Command Dispatcher (custom integer input with Push, Pop, Undo, Redo, and Reset Stack).
  - **Right Section**: Dedicated Telemetry Log with internal scrolling, live `STREAM ACTIVE` pulse, and tab switchers for **Telemetry Log**, **Memory Stats**, and **Diff Audit**.
- **Compact Bento Metric Bar**: 4-card header overview tracking **Stack Load** (`x / 5`), **Buffer Free** (`%`), **Undo Depth** (reversible states), and **Redo Branch** (cached forward states).
- **Default Light Mode & Dynamic Theme Toggle**: Clean white background (`#ffffff`), light-grey cards (`#f8fafc`), readable dark text (`#0f172a`), with vibrant purple (`#7c3aed`) and cyan (`#0891b2`) accents, plus navbar toggle for the original cyberpunk Dark Mode.
- **Single-Screen Welcome Page**: First-launch overview with an architectural stack illustration and **Get Started** button (remembered per session via `sessionStorage`).
- **Underflow & Overflow Protection**: Real-time visual banners when attempting to push beyond capacity (5 elements) or pop an empty stack.

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

## 🧪 Testing Checklist
1. **Push**: Enter any integer into the input field and click **Push** (or press Enter). The node appears with a glowing **TOP** label.
2. **Multiple Pushes**: Push up to 5 elements. The bottom node receives the **BOTTOM** anchor label.
3. **Stack Overflow**: Try to push a 6th element. An alert banner appears and the operation is rejected.
4. **Undo**: Click **Undo**. The previous state is restored and the Redo counter increments.
5. **Redo**: Click **Redo**. The reverted state is re-applied forward.
6. **Pop**: Click **Pop** until empty.
7. **Stack Underflow**: Click **Pop** when the stack is empty to test underflow rejection.
8. **Tabs**: Click **Diff Log** or **Memory Stats** in the bottom navigation bar to inspect execution history and memory allocations.
