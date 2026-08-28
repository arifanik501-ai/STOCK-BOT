import os
import sys
import json
import time
import ctypes
import webbrowser
import argparse
import threading
from datetime import datetime

from database import Database
from diff_engine import DiffEngine
from scraper import BOMScraper
from server import run_server

# Universal UTF-8 encoding support & ANSI escape sequences
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
    sys.stderr.reconfigure(encoding="utf-8", errors="replace", line_buffering=True)
except Exception:
    pass

if sys.platform == "win32":
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)
        mode = ctypes.c_ulong()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)
    except Exception:
        pass

class Style:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    RED = "\033[91m"
    WHITE = "\033[97m"
    GRAY = "\033[90m"

def print_banner():
    banner = f"""
{Style.CYAN}{Style.BOLD}╔══════════════════════════════════════════════════════════════════════════════════╗
║             MEP GROUP • BOM COLLECTOR & PRODUCTION FEASIBILITY BOT               ║
║       Production BOMs & Warehouse Stock Intelligence with Bottleneck Analyzer    ║
╚══════════════════════════════════════════════════════════════════════════════════╝{Style.RESET}"""
    print(banner)

def run_sync_cli(base_dir: str, config: dict):
    """Executes a full CLI sync with beautiful terminal progress."""
    db = Database(base_dir)
    old_boms = db.get_all_boms()
    
    print(f"  ├─ Local Database Records: {Style.YELLOW}{len(old_boms)} BOMs{Style.RESET}")
    print(f"  ├─ Initiating live scrape from Production & Warehouse Modules...")
    
    start_time = time.time()
    sync_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def progress_handler(pct, msg, log_line):
        bar_len = 30
        filled = int((pct / 100) * bar_len)
        bar = "█" * filled + "░" * (bar_len - filled)
        sys.stdout.write(f"\r  ├─ [{Style.GREEN}{bar}{Style.RESET}] {pct:3d}% : {msg[:45]:<45}")
        sys.stdout.flush()

    scraper = BOMScraper(config, progress_callback=progress_handler)
    try:
        scrape_res = scraper.run_full_scrape()
        new_boms = scrape_res.get("boms", [])
        warehouse_stock = scrape_res.get("stock", [])
        print()  # newline after progress bar
    except Exception as e:
        print(f"\n  └─ {Style.RED}[ERROR] Scraping failed: {e}{Style.RESET}")
        return False

    duration = time.time() - start_time
    print(f"  ├─ {Style.GREEN}[OK] Scraped {len(new_boms)} BOMs & {len(warehouse_stock)} Stock items in {duration:.2f}s.{Style.RESET}")
    
    # Calculate Diff
    diff = DiffEngine.calculate_diff(old_boms, new_boms, duration_seconds=duration, sync_time_str=sync_time_str)
    diff["total_stock_items"] = len(warehouse_stock)
    
    # Save BOMs and Warehouse Stock
    db.save_all_boms(new_boms, sync_report=diff)
    if warehouse_stock:
        db.save_warehouse_stock(warehouse_stock)

    print(f"  ├─ Saved to {Style.CYAN}data/boms.json{Style.RESET}, {Style.CYAN}data/warehouse_stock.json{Style.RESET} & {Style.CYAN}data/bom_database.db{Style.RESET}")
    
    # Print Diff Summary
    print(f"\n{Style.BOLD}┌─ SYNC SUMMARY REPORT ──────────────────────────────────────────────────────────┐{Style.RESET}")
    print(f"│  • Total BOMs In ERP  : {Style.BOLD}{diff['total_boms']}{Style.RESET}")
    print(f"│  • Warehouse Items    : {Style.BOLD}{len(warehouse_stock)}{Style.RESET}")
    print(f"│  • Newly Added BOMs   : {Style.GREEN}+{diff['added_count']}{Style.RESET}")
    print(f"│  • Modified BOMs      : {Style.YELLOW}~{diff['updated_count']}{Style.RESET}")
    print(f"│  • Removed BOMs       : {Style.RED}-{diff['deleted_count']}{Style.RESET}")
    print(f"│  • Unchanged BOMs     : {Style.GRAY}{diff['unchanged_count']}{Style.RESET}")
    print(f"│  • Total Sync Time    : {duration:.2f}s")
    print(f"└───────────────────────────────────────────────────────────────────────────────┘\n")

    return True

def main():
    parser = argparse.ArgumentParser(description="BOM Collector Bot & Live Web Dashboard")
    parser.add_argument("--sync", action="store_true", help="Run standalone sync only and exit")
    parser.add_argument("--serve", action="store_true", help="Start web server only without browser")
    parser.add_argument("--port", type=int, default=None, help="Port to run the web server on")
    parser.add_argument("--no-browser", action="store_true", help="Do not automatically open browser")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(base_dir, "config.json")
    
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    else:
        config = {
            "login_url": "https://mepgrouperp.com/1027/login/pages/main/index.php",
            "cid": "mep",
            "uid": "15387",
            "pass": "anikanik556",
            "db": "erpcombd",
            "port": 8088,
            "auto_open_browser": True
        }

    # Environment variable overrides for GitHub Actions / Cloud deployments
    env_uid = (os.environ.get("ERP_UID") or "").strip()
    env_pass = (os.environ.get("ERP_PASS") or "").strip()
    env_cid = (os.environ.get("ERP_CID") or "").strip()
    env_db = (os.environ.get("ERP_DB") or "").strip()
    env_url = (os.environ.get("ERP_LOGIN_URL") or "").strip()

    if env_uid: config["uid"] = env_uid
    if env_pass: config["pass"] = env_pass
    if env_cid: config["cid"] = env_cid
    if env_db: config["db"] = env_db
    if env_url: config["login_url"] = env_url

    # Safe fallbacks if any field is empty or template dummy
    if not config.get("uid") or config.get("uid") == "YOUR_USER_ID":
        config["uid"] = "15387"
    if not config.get("pass") or config.get("pass") == "YOUR_PASSWORD":
        config["pass"] = "anikanik556"
    if not config.get("cid"):
        config["cid"] = "mep"
    if not config.get("db"):
        config["db"] = "erpcombd"
    if not config.get("login_url"):
        config["login_url"] = "https://mepgrouperp.com/1027/login/pages/main/index.php"
    if not config.get("max_workers"):
        config["max_workers"] = 24

    port = args.port or config.get("port", 8088)

    print_banner()

    if args.sync:
        print(f"{Style.BOLD}[1/1] EXECUTING HEADLESS BOM & WAREHOUSE SYNC{Style.RESET}")
        run_sync_cli(base_dir, config)
        return

    # Check if initial data exists
    db = Database(base_dir)
    existing_boms = db.get_all_boms()
    existing_stock = db.get_warehouse_stock()
    
    if not existing_boms or not existing_stock:
        print(f"{Style.BOLD}[1/2] INITIAL DATA EXTRACTION{Style.RESET}")
        print("  └─ Running first-time sync from Production & Warehouse Modules...")
        run_sync_cli(base_dir, config)
    else:
        print(f"  ├─ Found {Style.GREEN}{len(existing_boms)} BOMs{Style.RESET} & {Style.GREEN}{len(existing_stock)} Stock Items{Style.RESET} in local database cache.")

    # Launch Web Server
    print(f"\n{Style.BOLD}[2/2] STARTING LIVE WEB DASHBOARD{Style.RESET}")
    print(f"  ├─ Server URL : {Style.CYAN}http://localhost:{port}{Style.RESET}")
    print(f"  ├─ Feasibility API : {Style.CYAN}http://localhost:{port}/api/feasibility/matrix{Style.RESET}")
    print(f"  └─ Press {Style.RED}Ctrl + C{Style.RESET} to stop the server anytime.\n")

    if not args.no_browser and config.get("auto_open_browser", True):
        def open_browser():
            time.sleep(1.2)
            webbrowser.open(f"http://localhost:{port}")
        threading.Thread(target=open_browser, daemon=True).start()

    run_server(base_dir, port=port, config=config)

if __name__ == "__main__":
    main()
