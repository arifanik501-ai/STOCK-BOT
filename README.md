# MEP BOM Collector Bot & Production Feasibility Intelligence Dashboard

An enterprise automated Bill of Materials (BOM) scraper, Warehouse Stock analyzer, differential sync engine, and modern web dashboard for MEP ERP's **Production & Warehouse Modules**.

---

## Features

- **Automated Scraper Engine**: Parallel extraction of all BOM formulas from Production Module AND current Closing Inventory from Warehouse Module (`Report 91223 - Stock Position Report Detail`) in under 6 seconds.
- **Production Feasibility Checker**:
  - **Can Produce? Analysis**: Instantly compares BOM formulas against live warehouse stock.
  - **Max Buildable Units Calculation**: `Available Stock ÷ Required per Unit = Possible Units`, taking the minimum limiting ratio across all required raw materials.
  - **Bottleneck Identifier**: Identifies the critical material(s) blocking or capping production.
  - **Interactive Target Simulator**: Enter custom batch targets (e.g. 50, 100, 500 units) to see the exact shortage quantity needed for each raw material.
  - **Color-Coded Readiness**:
    - 🟢 Sufficient Stock (পর্যাপ্ত স্টক)
    - 🟡 Limited / Constrained Stock (সীমিত স্টক)
    - 🔴 Shortage / Out of Stock (ঘাটতি / শূন্য স্টক)
- **Differential Tracking**: Automatically detects newly **Added**, **Updated/Modified**, and **Deleted** BOMs on each sync.
- **Dual Persistent Storage**:
  - `data/boms.json` (Structured BOM dataset)
  - `data/warehouse_stock.json` (Warehouse closing stock dataset)
  - `data/bom_database.db` (SQLite relational database with high-speed indexes)
  - `data/sync_history.json` (Audit log of all sync operations)
- **Modern Web Dashboard**:
  - **Instant Search**: Real-time filtering across BOM numbers, product names, item codes, sections, and raw materials.
  - **Production Floor Filtering**: Segment BOMs by section (FAN Assemble, Auto Powder Coating, Armature Winding, Sada Shapla, etc.).
  - **BOM Details Drawer**: Comprehensive drill-down modal showing all raw materials with high decimal precision, overhead breakdown, and approvals.
  - **Raw Material Reverse Lookup**: Search any component or material to see every single BOM that consumes it.
  - **Auto Update ("Update BOM & Stock")**: One-click live synchronization with progress bar and streaming console logs.
  - **Dark / Light Mode**: Seamless theme switching with persistent local storage.
  - **Export & Print**: One-click Excel/CSV export, full JSON dump, and pixel-perfect print view.

---

## Project Structure

```
BOM_COLLECTOR_BOT/
├── config.json              # ERP Credentials & server settings
├── bot.py                  # Main CLI launcher & unified controller
├── scraper.py              # Multi-threaded BOM & Warehouse Stock scraper
├── diff_engine.py          # Differential comparison engine
├── database.py             # SQLite & JSON dual-storage + Feasibility engine
├── server.py               # Multi-threaded HTTP Server & REST API
│
├── index.html              # Modern Web Dashboard
├── css/style.css           # Premium styling & dark mode
├── js/app.js               # Client-side reactivity, feasibility & sync
│
├── data/
│   ├── boms.json           # Active BOM dataset (JSON)
│   ├── warehouse_stock.json # Warehouse Closing Stock (JSON)
│   ├── bom_database.db     # SQLite relational database
│   └── sync_history.json   # Historical sync logs
│
├── run.bat                 # One-click Windows runner
├── start_service.vbs       # Silent background service launcher
└── stop_service.bat        # Stop service script
```

---

## How to Run

### Method 1: One-Click Windows Launcher
Double click **`run.bat`** to start the server and automatically open the dashboard in your default web browser (`http://localhost:8088`).

### Method 2: Command Line (CLI)
- **Start Web Dashboard**:
  ```bash
  python bot.py
  ```
- **Run Headless Sync Only**:
  ```bash
  python bot.py --sync
  ```
- **Custom Port**:
  ```bash
  python bot.py --port 9000
  ```

---

## REST API Endpoints

- `GET /api/stats` : Dashboard KPI summary metrics.
- `GET /api/stock` : List current warehouse stock records.
- `GET /api/feasibility/<bom_no>?target_qty=N` : Detailed feasibility, shortage, and bottleneck analysis for a specific product.
- `GET /api/feasibility/matrix` : High-speed feasibility overview for all 128 products.
- `GET /api/boms` : List all BOMs with optional `?q=...` or `?section=...` filtering.
- `GET /api/boms/<bom_no>` : Get full details for a single BOM.
- `GET /api/raw-materials` : Reverse lookup for raw materials usage across BOMs.
- `POST /api/sync` : Trigger live background scrape and differential comparison.
- `GET /api/sync/progress` : Stream live sync progress percentage, status, and logs.
- `GET /api/sync/history` : Get audit log of past sync operations.
- `GET /api/export/csv` : Download flat CSV with full itemized BOM breakdown.
- `GET /api/export/json` : Download full raw JSON dataset.
