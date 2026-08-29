import os
import sys
import json
import re
import html
import ssl
import time
import ctypes
import urllib.request
import urllib.parse
import http.cookiejar
from datetime import datetime

# Windows terminal UTF-8 encoding support & ANSI escape sequences
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
        sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)
    except Exception:
        pass
    try:
        kernel32 = ctypes.windll.kernel32
        handle = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
        mode = ctypes.c_ulong()
        if kernel32.GetConsoleMode(handle, ctypes.byref(mode)):
            kernel32.SetConsoleMode(handle, mode.value | 0x0004)  # ENABLE_VIRTUAL_TERMINAL_PROCESSING
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


# Win32 Virtual Key Constants
VK_ESCAPE = 0x1B
VK_CONTROL = 0x11
VK_F5 = 0x74
VK_RETURN = 0x0D
VK_V = 0x56
VK_S = 0x53
KEYEVENTF_KEYUP = 0x0002
KEYEVENTF_UNICODE = 0x0004

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32


def press_key(vk):
    user32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.05)
    user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.05)


def hotkey(mod, vk):
    user32.keybd_event(mod, 0, 0, 0)
    time.sleep(0.06)
    user32.keybd_event(vk, 0, 0, 0)
    time.sleep(0.06)
    user32.keybd_event(vk, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.06)
    user32.keybd_event(mod, 0, KEYEVENTF_KEYUP, 0)
    time.sleep(0.06)


def type_string(s):
    """Types any unicode string directly into active dialog with zero layout issues."""
    for char in s:
        user32.keybd_event(0, ord(char), KEYEVENTF_UNICODE, 0)
        time.sleep(0.015)
        user32.keybd_event(0, ord(char), KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0)
        time.sleep(0.015)


def focus_excel_window(excel_file):
    """Finds and brings the Excel window directly to the foreground."""
    excel_hwnds = []

    def enum_windows_proc(hwnd, lParam):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buf, length + 1)
                title = buf.value
                if 'ALL REPORT' in title or 'Excel' in title:
                    excel_hwnds.append((hwnd, title))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)
    user32.EnumWindows(WNDENUMPROC(enum_windows_proc), 0)

    if not excel_hwnds:
        if os.path.exists(excel_file):
            print(f"  ├─ {Style.CYAN}Opening '{os.path.basename(excel_file)}' in Microsoft Excel...{Style.RESET}")
            os.startfile(excel_file)
            time.sleep(3.5)
            user32.EnumWindows(WNDENUMPROC(enum_windows_proc), 0)

    if excel_hwnds:
        hwnd, title = excel_hwnds[0]
        # SW_MAXIMIZE = 3 (Forces Excel to open in FULL SCREEN / MAXIMIZED mode)
        user32.ShowWindow(hwnd, 3)
        user32.SetForegroundWindow(hwnd)
        user32.BringWindowToTop(hwnd)
        user32.SwitchToThisWindow(hwnd, True)
        time.sleep(0.5)
        return True
    return False


def set_windows_clipboard_html_and_text(html_content: str, plain_tsv_text: str) -> bool:
    """
    Sets the Windows Clipboard to native HTML Format (CF_HTML) and Unicode Text.
    This behaves 100% identically to pressing Ctrl+A -> Ctrl+C inside Google Chrome/Edge,
    allowing direct paste (Ctrl+V) into Excel.
    """
    try:
        kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
        kernel32.GlobalAlloc.restype = ctypes.c_void_p
        kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
        kernel32.GlobalLock.restype = ctypes.c_void_p
        kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
        user32.OpenClipboard.argtypes = [ctypes.c_void_p]
        user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
        user32.RegisterClipboardFormatW.argtypes = [ctypes.c_wchar_p]
        user32.RegisterClipboardFormatW.restype = ctypes.c_uint

        CF_HTML = user32.RegisterClipboardFormatW('HTML Format')
        CF_UNICODETEXT = 13
        GMEM_MOVEABLE = 0x0002

        # Extract table
        body_match = re.search(r'<table[^>]*id=[\'"]ExportTable[\'"][^>]*>(.*?)</table>', html_content, re.DOTALL | re.IGNORECASE)
        if body_match:
            fragment = f"<table border='1'>{body_match.group(1)}</table>"
        else:
            table_match = re.search(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL | re.IGNORECASE)
            fragment = f"<table border='1'>{table_match.group(1)}</table>" if table_match else html_content

        header_template = (
            'Version:0.9\r\n'
            'StartHTML:{:08d}\r\n'
            'EndHTML:{:08d}\r\n'
            'StartFragment:{:08d}\r\n'
            'EndFragment:{:08d}\r\n'
        )
        doc_template = '<html>\r\n<body>\r\n<!--StartFragment-->{}<!--EndFragment-->\r\n</body>\r\n</html>'
        doc = doc_template.format(fragment)
        header_dummy = header_template.format(0, 0, 0, 0)
        
        start_html = len(header_dummy.encode('utf-8'))
        start_fragment = start_html + len('<html>\r\n<body>\r\n<!--StartFragment-->'.encode('utf-8'))
        end_fragment = start_fragment + len(fragment.encode('utf-8'))
        end_html = start_html + len(doc.encode('utf-8'))
        
        header = header_template.format(start_html, end_html, start_fragment, end_fragment)
        raw_html_bytes = (header + doc).encode('utf-8') + b'\x00'
        raw_text_bytes = plain_tsv_text.encode('utf-16le') + b'\x00\x00'

        if not user32.OpenClipboard(None):
            return False
        user32.EmptyClipboard()

        # 1. Set CF_HTML
        h_html = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(raw_html_bytes))
        p_html = kernel32.GlobalLock(h_html)
        ctypes.memmove(p_html, raw_html_bytes, len(raw_html_bytes))
        kernel32.GlobalUnlock(h_html)
        user32.SetClipboardData(CF_HTML, h_html)

        # 2. Set CF_UNICODETEXT
        h_text = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(raw_text_bytes))
        p_text = kernel32.GlobalLock(h_text)
        ctypes.memmove(p_text, raw_text_bytes, len(raw_text_bytes))
        kernel32.GlobalUnlock(h_text)
        user32.SetClipboardData(CF_UNICODETEXT, h_text)

        user32.CloseClipboard()
        return True
    except Exception as e:
        print(f"  {Style.YELLOW}[!] Clipboard Notice: {e}{Style.RESET}")
        return False


def clean_text(raw_str):
    if raw_str is None:
        return ""
    no_tags = re.sub(r'<[^>]+>', ' ', str(raw_str))
    unescaped = html.unescape(no_tags)
    return ' '.join(unescaped.replace('\xa0', ' ').split())


def parse_html_table(html_content):
    """Extracts raw table cells exactly as presented on the webpage."""
    for table_match in re.finditer(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL | re.IGNORECASE):
        table_html = table_match.group(1)
        rows = []
        for row_match in re.finditer(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.IGNORECASE):
            row_html = row_match.group(1)
            cells = [clean_text(cm.group(1)) for cm in re.finditer(r'<t[dh][^>]*>(.*?)</t[dh]>', row_html, re.DOTALL | re.IGNORECASE)]
            if cells:
                rows.append(cells)
        if rows and len(rows) > 1:
            return rows
    return []


def execute_goto_paste_save(excel_file, sheet_name, table_rows, report_html):
    """Copies HTML to clipboard, navigates to sheet via Go-To (F5), Pastes (Ctrl+V) and Saves (Ctrl+S)."""
    tsv_lines = ["\t".join(row) for row in table_rows]
    tsv_content = "\n".join(tsv_lines)
    set_windows_clipboard_html_and_text(report_html, tsv_content)

    if not focus_excel_window(excel_file):
        print(f"  └─ {Style.RED}[ERROR] Could not focus Excel window.{Style.RESET}")
        return False

    # 1. Clear active edit state
    press_key(VK_ESCAPE)
    time.sleep(0.15)
    press_key(VK_ESCAPE)
    time.sleep(0.3)

    # 2. Go To (F5)
    press_key(VK_F5)
    time.sleep(0.6)

    # 3. Type target reference: 'SheetName'!A1 and press ENTER
    ref_target = f"'{sheet_name}'!A1"
    type_string(ref_target)
    time.sleep(0.3)
    press_key(VK_RETURN)
    time.sleep(0.8)

    # 4. Paste (Ctrl+V)
    hotkey(VK_CONTROL, VK_V)
    time.sleep(1.8)

    # 5. Save (Ctrl+S)
    hotkey(VK_CONTROL, VK_S)
    time.sleep(1.0)

    print(f"  └─ {Style.GREEN}[SUCCESS] Navigated via Go-To -> '{sheet_name}'!A1 -> Pasted & Saved.{Style.RESET}")
    return True


def make_request_with_retries(opener, req, max_retries=3, timeout=30):
    for attempt in range(1, max_retries + 1):
        try:
            resp = opener.open(req, timeout=timeout)
            return resp.read().decode("utf-8", errors="ignore")
        except Exception as e:
            if attempt == max_retries:
                raise e
            print(f"    {Style.YELLOW}[~] Network delay detected. Retrying ({attempt}/{max_retries})...{Style.RESET}")
            time.sleep(1.5)
    return ""


def print_banner():
    banner = f"""
{Style.CYAN}{Style.BOLD}╔══════════════════════════════════════════════════════════════════════════════════╗
║                     MEP GROUP • ENTERPRISE RPA BOT v5.5                          ║
║             Live In-Excel Go-To Automation for ALL REPORT.xlsx                   ║
╚══════════════════════════════════════════════════════════════════════════════════╝{Style.RESET}"""
    print(banner)


def print_sys_info(excel_name, cfg):
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    info_box = f"""{Style.GRAY}┌─ SYSTEM & CONFIGURATION ────────────────────────────────────────────────────────┐
│  {Style.WHITE}• Target Workbook :{Style.RESET} {Style.BOLD}{excel_name}.xlsx{Style.RESET}{Style.GRAY}                                            │
│  {Style.WHITE}• ERP Portal      :{Style.RESET} {Style.CYAN}{cfg.get('login_url', 'https://mepgrouperp.com')}{Style.RESET}{Style.GRAY}                │
│  {Style.WHITE}• Credentials     :{Style.RESET} Company ID: {Style.YELLOW}{cfg.get('cid')}{Style.RESET} | User ID: {Style.YELLOW}{cfg.get('uid')}{Style.RESET}{Style.GRAY}                            │
│  {Style.WHITE}• Automation Mode :{Style.RESET} {Style.GREEN}Live Win32 Go-To (F5) & Native Clipboard Paste{Style.RESET}{Style.GRAY}            │
│  {Style.WHITE}• Session Started :{Style.RESET} {now_str}                                             │
└─────────────────────────────────────────────────────────────────────────────────┘{Style.RESET}"""
    print(info_box)


def run_bot():
    start_time = time.time()
    print_banner()

    dir_path = os.path.dirname(__file__)
    excel_name = "ALL REPORT"
    excel_file = os.path.join(dir_path, f"{excel_name}.xlsx")

    # 1. Config & Credentials
    config_file = os.path.join(dir_path, "config.json")
    if os.path.exists(config_file):
        with open(config_file, "r", encoding="utf-8") as f:
            cfg = json.load(f)
    else:
        cfg = {
            "login_url": "https://mepgrouperp.com/1027/login/pages/main/index.php",
            "cid": "mep",
            "uid": "15387",
            "pass": "anikanik556",
            "db": "erpcombd"
        }

    print_sys_info(excel_name, cfg)

    # Ensure Excel is open on screen
    focus_excel_window(excel_file)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(cj),
        urllib.request.HTTPSHandler(context=ctx)
    )
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    summary_records = []

    # -------------------------------------------------------------
    # 2. LOGIN
    # -------------------------------------------------------------
    print(f"\n{Style.BOLD}[1/5] AUTHENTICATION{Style.RESET}")
    print(f"  ├─ Connecting to MEP ERP Secure Server...")
    login_url = cfg["login_url"]
    try:
        make_request_with_retries(opener, urllib.request.Request(login_url, headers=headers), max_retries=3, timeout=30)
    except Exception as e:
        print(f"  └─ {Style.RED}[ERROR] Failed to reach login page: {e}{Style.RESET}")
        return

    post_data = urllib.parse.urlencode({
        "db": cfg.get("db", "erpcombd"),
        "cid": cfg["cid"],
        "uid": cfg["uid"],
        "ibssignin": "",
        "pass": cfg["pass"],
        "submit": "Log in"
    }).encode("utf-8")

    login_req = urllib.request.Request(
        login_url,
        data=post_data,
        headers=dict(headers, **{
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": login_url
        })
    )

    try:
        login_html = make_request_with_retries(opener, login_req, max_retries=3, timeout=30)
    except Exception as e:
        print(f"  └─ {Style.RED}[ERROR] Login submission failed: {e}{Style.RESET}")
        return

    if "Production Module" not in login_html and "oe_app" not in login_html:
        print(f"  └─ {Style.RED}[ERROR] Authentication failed. Please verify CID, UID and Password.{Style.RESET}")
        return

    print(f"  └─ {Style.GREEN}[SUCCESS] Authenticated successfully as User ID: {cfg.get('uid')}{Style.RESET}")

    now = datetime.now()
    wh_report_url = "https://mepgrouperp.com/1027/warehouse_mod/pages/report/master_report.php"

    # -------------------------------------------------------------
    # 3. TASK 1: Production Module -> Inventory Movement Report (221023) -> 'ERP Entry FG'
    # -------------------------------------------------------------
    print(f"\n{Style.BOLD}[2/5] PRODUCTION MODULE{Style.RESET}")
    print(f"  ├─ Report : Inventory Movement Report (221023)")
    print(f"  ├─ Filter : Company: {Style.CYAN}FAN{Style.RESET} | Group: {Style.CYAN}Finished Goods{Style.RESET}")
    
    adv_prod_url = "https://mepgrouperp.com/1027/production_mod/pages/report/work_order_report.php"
    prod_form_html = make_request_with_retries(opener, urllib.request.Request(adv_prod_url, headers=headers), max_retries=3, timeout=30)

    f_date_match = re.search(r'name=[\'"]f_date[\'"][^>]*value=[\'"]([^\'"]*)[\'"]', prod_form_html, re.IGNORECASE)
    t_date_match = re.search(r'name=[\'"]t_date[\'"][^>]*value=[\'"]([^\'"]*)[\'"]', prod_form_html, re.IGNORECASE)

    f_date = f_date_match.group(1) if f_date_match and f_date_match.group(1) else now.strftime("%Y-%m-01")
    t_date = t_date_match.group(1) if t_date_match and t_date_match.group(1) else now.strftime("%Y-%m-%d")

    prod_report_url = "https://mepgrouperp.com/1027/production_mod/pages/report/master_report.php"
    prod_post_data = urllib.parse.urlencode({
        "report": "221023",
        "group_for": "3",            # FAN
        "item_group": "100000000",    # Finished Goods
        "item_sub_group": "",
        "item_id": "",
        "f_date": f_date,
        "t_date": t_date,
        "submit": "Show"
    }).encode("utf-8")

    prod_req = urllib.request.Request(
        prod_report_url,
        data=prod_post_data,
        headers=dict(headers, **{
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": adv_prod_url
        })
    )

    prod_html = make_request_with_retries(opener, prod_req, max_retries=3, timeout=35)
    prod_rows = parse_html_table(prod_html)

    if prod_rows:
        count = len(prod_rows)
        print(f"  ├─ {Style.GREEN}[OK] {count} records retrieved successfully.{Style.RESET}")
        print(f"  ├─ Navigating live in Excel to 'ERP Entry FG'!A1...")
        ok = execute_goto_paste_save(excel_file, "ERP Entry FG", prod_rows, prod_html)
        summary_records.append(("Inventory Movement (221023)", "ERP Entry FG", f"{count} Rows", "SUCCESS" if ok else "FAILED"))
        time.sleep(0.8)
    else:
        print(f"  └─ {Style.RED}[FAILED] No records found for Inventory Movement Report.{Style.RESET}")
        summary_records.append(("Inventory Movement (221023)", "ERP Entry FG", "0 Rows", "FAILED"))

    # -------------------------------------------------------------
    # 4. TASK 2: Warehouse Module -> Stock Position Report Detail (91223) -> 'ERP Entry Stock'
    # -------------------------------------------------------------
    print(f"\n{Style.BOLD}[3/5] WAREHOUSE MODULE (STOCK POSITION){Style.RESET}")
    print(f"  ├─ Report : Stock Position Report Detail (Closing) (91223)")
    print(f"  ├─ Filter : Company: {Style.CYAN}FAN{Style.RESET}")

    wh_url = "https://mepgrouperp.com/1027/warehouse_mod/pages/report/work_order_report.php"
    wh_form_html = make_request_with_retries(opener, urllib.request.Request(wh_url, headers=headers), max_retries=3, timeout=30)

    wh_fdate_m = re.search(r'name=[\'"]f_date[\'"][^>]*value=[\'"]([^\'"]*)[\'"]', wh_form_html, re.IGNORECASE)
    wh_tdate_m = re.search(r'name=[\'"]t_date[\'"][^>]*value=[\'"]([^\'"]*)[\'"]', wh_form_html, re.IGNORECASE)

    wh_fdate = wh_fdate_m.group(1) if wh_fdate_m and wh_fdate_m.group(1) else now.strftime("%Y-%m-01")
    wh_tdate = wh_tdate_m.group(1) if wh_tdate_m and wh_tdate_m.group(1) else now.strftime("%Y-%m-%d")

    wh_post_data = urllib.parse.urlencode({
        "report": "91223",
        "group_for": "3",  # FAN
        "f_date": wh_fdate,
        "t_date": wh_tdate,
        "submit": "Show"
    }).encode("utf-8")

    wh_req = urllib.request.Request(
        wh_report_url,
        data=wh_post_data,
        headers=dict(headers, **{
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": wh_url
        })
    )

    wh_html = make_request_with_retries(opener, wh_req, max_retries=3, timeout=35)
    wh_rows = parse_html_table(wh_html)

    if wh_rows:
        count = len(wh_rows)
        print(f"  ├─ {Style.GREEN}[OK] {count} records retrieved successfully.{Style.RESET}")
        print(f"  ├─ Navigating live in Excel to 'ERP Entry Stock'!A1...")
        ok = execute_goto_paste_save(excel_file, "ERP Entry Stock", wh_rows, wh_html)
        summary_records.append(("Stock Position Detail (91223)", "ERP Entry Stock", f"{count} Rows", "SUCCESS" if ok else "FAILED"))
        time.sleep(0.8)
    else:
        print(f"  └─ {Style.RED}[FAILED] No records found for Stock Position Report.{Style.RESET}")
        summary_records.append(("Stock Position Detail (91223)", "ERP Entry Stock", "0 Rows", "FAILED"))

    # -------------------------------------------------------------
    # 5. TASK 3: Warehouse Module -> Requisition Report (8524) [Sales: PnP] -> 'BSIC Entry'
    # -------------------------------------------------------------
    print(f"\n{Style.BOLD}[4/5] WAREHOUSE MODULE (REQUISITION - BSIC / PnP){Style.RESET}")
    print(f"  ├─ Report : Inter Sales Requisition Details Report (8524)")
    print(f"  ├─ Filter : Purchase: {Style.CYAN}MEP FAN LIMITED.{Style.RESET} | Sales: {Style.CYAN}MEP PRINTING & PACKAGING{Style.RESET}")

    req_page_url = "https://mepgrouperp.com/1027/warehouse_mod/pages/report/inter_sales_requisition_report.php"
    
    req_post_data_1 = urllib.parse.urlencode({
        "report": "8524",
        "company": "3",     # Purchase Company: MEP FAN LIMITED.
        "group_from": "1",  # Sales Company: MEP PRINTING AND PACKAGING INDUSTRIES
        "item_group": "",
        "item_sub_group": "",
        "item_id": "",
        "warehouse_id": "",
        "f_date": "2026-06-20",
        "t_date": now.strftime("%Y-%m-%d"),
        "submit": "Show"
    }).encode("utf-8")

    req_report_req_1 = urllib.request.Request(
        wh_report_url,
        data=req_post_data_1,
        headers=dict(headers, **{
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": req_page_url
        })
    )

    req_html_1 = make_request_with_retries(opener, req_report_req_1, max_retries=3, timeout=35)
    req_rows_1 = parse_html_table(req_html_1)

    if req_rows_1:
        count = len(req_rows_1)
        print(f"  ├─ {Style.GREEN}[OK] {count} records retrieved successfully.{Style.RESET}")
        print(f"  ├─ Navigating live in Excel to 'BSIC Entry'!A1...")
        ok = execute_goto_paste_save(excel_file, "BSIC Entry", req_rows_1, req_html_1)
        summary_records.append(("Inter Sales Req - PnP (8524)", "BSIC Entry", f"{count} Rows", "SUCCESS" if ok else "FAILED"))
        time.sleep(0.8)
    else:
        print(f"  └─ {Style.RED}[FAILED] No records found for BSIC Requisition Report.{Style.RESET}")
        summary_records.append(("Inter Sales Req - PnP (8524)", "BSIC Entry", "0 Rows", "FAILED"))

    # -------------------------------------------------------------
    # 6. TASK 4: Warehouse Module -> Requisition Report (8524) [Sales: Mohammadi/Plastic] -> 'Plastic Entry'
    # -------------------------------------------------------------
    print(f"\n{Style.BOLD}[5/5] WAREHOUSE MODULE (REQUISITION - PLASTIC){Style.RESET}")
    print(f"  ├─ Report : Inter Sales Requisition Details Report (8524)")
    print(f"  ├─ Filter : Purchase: {Style.CYAN}MEP FAN LIMITED.{Style.RESET} | Sales: {Style.CYAN}MOHAMMADI ELECTRIC / PLASTIC{Style.RESET}")

    req_post_data_2 = urllib.parse.urlencode({
        "report": "8524",
        "company": "3",     # Purchase Company: MEP FAN LIMITED.
        "group_from": "4",  # Sales Company: MOHAMMADI ELECTRIC WIRES & MULTI PRODUCTS (MEP) LTD.
        "item_group": "",
        "item_sub_group": "",
        "item_id": "",
        "warehouse_id": "",
        "f_date": "2026-06-20",
        "t_date": now.strftime("%Y-%m-%d"),
        "submit": "Show"
    }).encode("utf-8")

    req_report_req_2 = urllib.request.Request(
        wh_report_url,
        data=req_post_data_2,
        headers=dict(headers, **{
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": req_page_url
        })
    )

    req_html_2 = make_request_with_retries(opener, req_report_req_2, max_retries=3, timeout=35)
    req_rows_2 = parse_html_table(req_html_2)

    if req_rows_2:
        count = len(req_rows_2)
        print(f"  ├─ {Style.GREEN}[OK] {count} records retrieved successfully.{Style.RESET}")
        print(f"  ├─ Navigating live in Excel to 'Plastic Entry'!A1...")
        ok = execute_goto_paste_save(excel_file, "Plastic Entry", req_rows_2, req_html_2)
        summary_records.append(("Inter Sales Req - Plastic (8524)", "Plastic Entry", f"{count} Rows", "SUCCESS" if ok else "FAILED"))
    else:
        print(f"  └─ {Style.RED}[FAILED] No records found for Plastic Requisition Report.{Style.RESET}")
        summary_records.append(("Inter Sales Req - Plastic (8524)", "Plastic Entry", "0 Rows", "FAILED"))

    # -------------------------------------------------------------
    # 7. EXECUTION SUMMARY REPORT TABLE
    # -------------------------------------------------------------
    elapsed = time.time() - start_time
    print(f"\n{Style.CYAN}{Style.BOLD}╔══════════════════════════════════════════════════════════════════════════════════╗")
    print(f"║                          EXECUTION SUMMARY REPORT                                ║")
    print(f"╠═════╦══════════════════════════════════╦══════════════════╦══════════╦══════════╣")
    print(f"║  #  ║ Report Description               ║ Target Worksheet ║ Records  ║ Status   ║")
    print(f"╠═════╬══════════════════════════════════╬══════════════════╬══════════╬══════════╣{Style.RESET}")

    for idx, (rep_name, sheet, recs, status) in enumerate(summary_records, 1):
        status_colored = f"{Style.GREEN}[SUCCESS]{Style.RESET}" if status == "SUCCESS" else f"{Style.RED}[FAILED] {Style.RESET}"
        print(f"║  {idx}  ║ {rep_name:<32} ║ {sheet:<16} ║ {recs:>8} ║ {status_colored} ║")

    print(f"{Style.CYAN}{Style.BOLD}╚═════╩══════════════════════════════════╩══════════════════╩══════════╩══════════╝{Style.RESET}")
    print(f"\n  {Style.GREEN}{Style.BOLD}✨ All operations completed live in '{excel_name}.xlsx' in {elapsed:.1f}s!{Style.RESET}\n")


if __name__ == "__main__":
    run_bot()
