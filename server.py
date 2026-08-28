import os
import sys
import json
import time
import io
import csv
import threading
import mimetypes
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs, unquote
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

from database import Database
from diff_engine import DiffEngine
from scraper import BOMScraper

class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

class SyncManager:
    """Thread-safe manager for coordinating live ERP scraping and progress broadcasting."""
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.db = Database(base_dir)
        self.is_syncing = False
        self.progress_pct = 0
        self.current_status = "Idle"
        self.logs: list[dict] = []
        self.last_report: dict = {}
        self.lock = threading.Lock()

    def add_log(self, pct: int, msg: str, log_line: str):
        with self.lock:
            self.progress_pct = pct
            self.current_status = msg
            self.logs.append({
                "time": datetime.now().strftime("%H:%M:%S"),
                "percent": pct,
                "message": log_line
            })
            if len(self.logs) > 500:
                self.logs.pop(0)

    def trigger_sync(self, config: dict) -> dict:
        with self.lock:
            if self.is_syncing:
                return {"status": "ALREADY_RUNNING", "message": "Sync is already in progress."}
            self.is_syncing = True
            self.progress_pct = 0
            self.current_status = "Starting..."
            self.logs = []
            self.last_report = {}

        thread = threading.Thread(target=self._run_sync_worker, args=(config,), daemon=True)
        thread.start()
        return {"status": "STARTED", "message": "Sync initiated successfully."}

    def _run_sync_worker(self, config: dict):
        start_time = time.time()
        sync_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.add_log(1, "Starting Unified ERP Sync...", f"[START] Sync initiated at {sync_time_str}")

        try:
            # 1. Load existing BOMs for differential comparison
            old_boms = self.db.get_all_boms()
            self.add_log(3, "Loaded current local store.", f"[DB] Loaded {len(old_boms)} existing records for diff comparison.")

            # 2. Run Scraper for BOMs and Warehouse Stock
            scraper = BOMScraper(config, progress_callback=self.add_log)
            scrape_res = scraper.run_full_scrape()

            new_boms = scrape_res.get("boms", [])
            warehouse_stock = scrape_res.get("stock", [])

            if not new_boms:
                raise Exception("No BOMs could be retrieved from ERP.")

            # 3. Calculate Differential on BOMs
            self.add_log(96, "Calculating differences...", "[DIFF] Comparing newly scraped data with local database...")
            duration = time.time() - start_time
            diff_report = DiffEngine.calculate_diff(old_boms, new_boms, duration_seconds=duration, sync_time_str=sync_time_str)
            diff_report["total_stock_items"] = len(warehouse_stock)

            # 4. Save BOMs and Warehouse Stock to Database
            self.add_log(98, "Saving to SQLite & JSON...", "[SAVE] Writing updated BOMs and Warehouse Stock datasets...")
            self.db.save_all_boms(new_boms, sync_report=diff_report)
            if warehouse_stock:
                self.db.save_warehouse_stock(warehouse_stock)

            # 5. Complete
            summary_msg = f"+{diff_report['added_count']} Added, ~{diff_report['updated_count']} Updated (Total: {diff_report['total_boms']} BOMs & {len(warehouse_stock)} Stock Items)"
            self.add_log(100, "Sync Complete!", f"[DONE] {summary_msg} in {duration:.2f}s.")
            
            with self.lock:
                self.last_report = diff_report
                self.progress_pct = 100
                self.current_status = "Completed"

        except Exception as e:
            err_msg = str(e)
            self.add_log(100, f"Sync Failed: {err_msg}", f"[ERROR] {err_msg}")
            with self.lock:
                self.progress_pct = 100
                self.current_status = f"Error: {err_msg}"
                self.last_report = {
                    "status": "FAILED",
                    "error": err_msg,
                    "sync_time": sync_time_str
                }
        finally:
            with self.lock:
                self.is_syncing = False

    def get_progress(self) -> dict:
        with self.lock:
            return {
                "is_syncing": self.is_syncing,
                "percent": self.progress_pct,
                "status": self.current_status,
                "logs": list(self.logs),
                "last_report": self.last_report
            }


class BOMRequestHandler(BaseHTTPRequestHandler):
    sync_mgr: SyncManager = None
    config: dict = {}
    base_dir: str = ""

    def log_message(self, format, *args):
        pass

    def _send_json(self, data: Any, status_code: int = 200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, message: str, status_code: int = 400):
        self._send_json({"error": message, "success": False}, status_code=status_code)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/sync":
            res = self.sync_mgr.trigger_sync(self.config)
            self._send_json(res)
            return

        self._send_error("Endpoint not found", 404)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query_params = parse_qs(parsed.query)

        # -------------------------------------------------------------
        # REST API Endpoints
        # -------------------------------------------------------------
        if path == "/api/stats":
            stats = self.sync_mgr.db.get_stats()
            self._send_json(stats)
            return

        if path == "/api/stock":
            stock = self.sync_mgr.db.get_warehouse_stock()
            self._send_json(stock)
            return

        if path == "/api/feasibility/matrix":
            matrix = self.sync_mgr.db.get_all_feasibility_matrix()
            self._send_json(matrix)
            return

        if path.startswith("/api/feasibility/"):
            bom_no = path.replace("/api/feasibility/", "").strip()
            try:
                target_qty = float(query_params.get("target_qty", ["1.0"])[0])
            except ValueError:
                target_qty = 1.0
                
            feasibility = self.sync_mgr.db.calculate_feasibility(bom_no, target_qty=target_qty)
            if feasibility:
                self._send_json(feasibility)
            else:
                self._send_error(f"BOM #{bom_no} not found for feasibility check", 404)
            return

        if path == "/api/boms":
            boms = self.sync_mgr.db.get_all_boms()
            
            q = query_params.get("q", [""])[0].lower().strip()
            section = query_params.get("section", [""])[0].strip()
            status = query_params.get("status", [""])[0].strip()

            filtered = boms
            if section:
                filtered = [b for b in filtered if b.get("section") == section]
            if status:
                filtered = [b for b in filtered if b.get("status") == status]
            if q:
                filtered = [
                    b for b in filtered
                    if q in str(b.get("bom_no", "")).lower()
                    or q in str(b.get("product_name", "")).lower()
                    or q in str(b.get("item_code", "")).lower()
                    or q in str(b.get("section", "")).lower()
                    or any(q in str(rm.get("item_description", "")).lower() or q in str(rm.get("item_code", "")).lower() for rm in b.get("raw_materials", []))
                ]

            self._send_json(filtered)
            return

        if path.startswith("/api/boms/"):
            bom_no = path.replace("/api/boms/", "").strip()
            bom = self.sync_mgr.db.get_bom_by_no(bom_no)
            if bom:
                self._send_json(bom)
            else:
                self._send_error(f"BOM #{bom_no} not found", 404)
            return

        if path == "/api/raw-materials":
            q = query_params.get("q", [""])[0].strip()
            rm_data = self.sync_mgr.db.get_raw_materials_reverse_lookup(q)
            self._send_json(rm_data)
            return

        if path in ("/api/sync/progress", "/api/sync/status"):
            progress = self.sync_mgr.get_progress()
            self._send_json(progress)
            return

        if path in ("/api/sync/history", "/api/history"):
            history = self.sync_mgr.db.get_sync_history()
            self._send_json(history)
            return

        if path == "/api/export/csv":
            self._export_csv()
            return

        if path == "/api/export/json":
            boms = self.sync_mgr.db.get_all_boms()
            self._send_json(boms)
            return

        # -------------------------------------------------------------
        # Static Files Serving
        # -------------------------------------------------------------
        self._serve_static(path)

    def _export_csv(self):
        """Generates a complete flat CSV of all BOMs with itemized Raw Materials."""
        boms = self.sync_mgr.db.get_all_boms()
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "BOM No", "BOM Date", "Product Name", "Product Code", "Section / Floor",
            "Output Qty", "Output Unit", "Status", "Edit By", "Approved By",
            "RM SL", "RM Category", "RM Item Code", "RM Description", "RM Unit", "RM Quantity", "RM Status"
        ])

        for b in boms:
            b_no = b.get("bom_no", "")
            b_date = b.get("bom_date", "")
            p_name = b.get("product_name", "")
            p_code = b.get("item_code", "")
            sec = b.get("section", "")
            out_qty = b.get("output_quantity", 1.0)
            out_unit = b.get("output_unit", "Pcs")
            st = b.get("status", "APPROVED")
            eb = b.get("edit_by", "")
            ab = b.get("approved_by", "")

            rms = b.get("raw_materials", [])
            if not rms:
                writer.writerow([b_no, b_date, p_name, p_code, sec, out_qty, out_unit, st, eb, ab, "", "", "", "", "", "", ""])
            else:
                for rm in rms:
                    writer.writerow([
                        b_no, b_date, p_name, p_code, sec, out_qty, out_unit, st, eb, ab,
                        rm.get("sl", ""),
                        rm.get("category", ""),
                        rm.get("item_code", ""),
                        rm.get("item_description", ""),
                        rm.get("unit", ""),
                        rm.get("quantity", ""),
                        rm.get("status", "")
                    ])

        csv_bytes = output.getvalue().encode("utf-8-sig")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="MEP_BOM_Master_Dump_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv"')
        self.send_header("Content-Length", str(len(csv_bytes)))
        self.end_headers()
        self.wfile.write(csv_bytes)

    def _serve_static(self, req_path: str):
        if req_path == "/" or req_path == "":
            req_path = "/index.html"

        clean_path = unquote(req_path.lstrip("/"))
        file_path = os.path.normpath(os.path.join(self.base_dir, clean_path))

        if not file_path.startswith(self.base_dir) or not os.path.isfile(file_path):
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"404 Not Found")
            return

        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"

        try:
            with open(file_path, "rb") as f:
                content = f.read()

            self.send_response(200)
            self.send_header("Content-Type", mime_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(str(e).encode("utf-8"))


def run_server(base_dir: str, port: int = 8088, config: dict = None):
    """Starts the multi-threaded web server with automatic port fallback."""
    if config is None:
        cfg_path = os.path.join(base_dir, "config.json")
        if os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                config = json.load(f)
        else:
            config = {}

    sync_mgr = SyncManager(base_dir)
    BOMRequestHandler.sync_mgr = sync_mgr
    BOMRequestHandler.config = config
    BOMRequestHandler.base_dir = base_dir

    httpd = None
    active_port = port
    for p in [port, port + 1, port + 2, 8080, 8090]:
        try:
            server_address = ("0.0.0.0", p)
            httpd = ThreadingHTTPServer(server_address, BOMRequestHandler)
            active_port = p
            break
        except OSError:
            continue

    if not httpd:
        print(f"[ERROR] Could not bind web server to port {port} or fallback ports.")
        return

    print(f"[*] BOM Collector Web Server running on http://localhost:{active_port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Shutting down server.")
        httpd.server_close()

if __name__ == "__main__":
    dir_path = os.path.dirname(os.path.abspath(__file__))
    run_server(dir_path, port=8088)
