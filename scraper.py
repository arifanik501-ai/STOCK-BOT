import os
import re
import ssl
import json
import time
import urllib.request
import urllib.parse
import http.cookiejar
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Any, Optional, Callable

class BOMScraper:
    def __init__(self, config: Dict[str, Any], progress_callback: Optional[Callable[[int, str, Optional[str]], None]] = None):
        self.config = config
        self.progress_cb = progress_callback or (lambda pct, msg, log: None)
        
        self.login_url = config.get("login_url", "https://mepgrouperp.com/1027/login/pages/main/index.php")
        self.cid = config.get("cid", "mep")
        self.uid = config.get("uid", "15387")
        self.password = config.get("pass", "anikanik556")
        self.db_name = config.get("db", "erpcombd")
        self.max_workers = config.get("max_workers", 24)
        self.timeout = config.get("timeout", 45)
        self.excluded_sections = set(config.get("excluded_sections", []))

        # SSL setup
        self.ctx = ssl.create_default_context()
        self.ctx.check_hostname = False
        self.ctx.verify_mode = ssl.CERT_NONE

        self.cookie_jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookie_jar),
            urllib.request.HTTPSHandler(context=self.ctx)
        )
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }

    def _log(self, pct: int, msg: str, log_line: Optional[str] = None):
        self.progress_cb(pct, msg, log_line or msg)

    def _make_request(self, url: str, data: Optional[Dict[str, str]] = None, referer: Optional[str] = None, max_retries: int = 3) -> str:
        req_headers = dict(self.headers)
        if referer:
            req_headers["Referer"] = referer

        post_bytes = None
        if data is not None:
            post_bytes = urllib.parse.urlencode(data).encode("utf-8")
            req_headers["Content-Type"] = "application/x-www-form-urlencoded"

        for attempt in range(1, max_retries + 1):
            try:
                req = urllib.request.Request(url, data=post_bytes, headers=req_headers)
                with self.opener.open(req, timeout=self.timeout) as resp:
                    return resp.read().decode("utf-8", errors="ignore")
            except Exception as e:
                if attempt == max_retries:
                    raise e
                time.sleep(1.0 * attempt)
        return ""

    def authenticate(self) -> bool:
        """Authenticates with MEP ERP portal."""
        self._log(5, "Connecting to ERP login portal...", "[AUTH] Initiating handshake with MEP ERP...")
        
        # Initial GET
        self._make_request(self.login_url)

        # POST Credentials
        post_data = {
            "db": self.db_name,
            "cid": self.cid,
            "uid": self.uid,
            "ibssignin": "",
            "pass": self.password,
            "submit": "Log in"
        }

        self._log(8, "Authenticating user credentials...", f"[AUTH] Submitting credentials for User ID: {self.uid} (CID: {self.cid})")
        resp_html = self._make_request(self.login_url, data=post_data, referer=self.login_url)

        if "Production Module" not in resp_html and "oe_app" not in resp_html and "mhafuz" not in resp_html:
            self._log(8, "Authentication failed!", "[ERROR] Authentication failed. Please verify credentials.")
            raise Exception("ERP Authentication failed. Please check credentials in config.json.")

        self._log(12, "Authentication successful!", f"[AUTH] Authenticated successfully as User {self.uid}.")
        return True

    def fetch_bom_master_list(self) -> List[Dict[str, Any]]:
        """Fetches the complete BOM master list from bom_status.php."""
        self._log(16, "Accessing Production Module BOM Status...", "[BOM] Requesting master list from bom_status.php...")
        
        bom_status_url = "https://mepgrouperp.com/1027/production_mod/pages/BOM/bom_status.php"
        referer_url = "https://mepgrouperp.com/1027/production_mod/pages/main/home.php"

        post_form = {
            "group_for": "",
            "section_id": "",
            "item_id": "",
            "master_fg_id": "",
            "fdate": "2000-01-01",
            "tdate": "2035-12-31",
            "submitit": "VIEW DETAIL"
        }

        html_content = self._make_request(bom_status_url, data=post_form, referer=referer_url)
        tr_list = re.findall(r'<tr[^>]*>(.*?)</tr>', html_content, re.I | re.DOTALL)

        if not tr_list or len(tr_list) <= 1:
            self._log(20, "No BOM records returned.", "[WARN] No BOM records found in ERP master table.")
            return []

        master_boms = []
        for tr in tr_list[1:]:  # skip header row
            cells = [
                re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ')
                for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.I | re.DOTALL)
            ]
            if len(cells) >= 8:
                bom_link = re.search(r'bom_print_view\.php\?bom_no=([0-9a-zA-Z_-]+)', tr)
                bom_no = bom_link.group(1) if bom_link else cells[1].strip()
                sec = cells[3].strip()

                if self.excluded_sections and sec in self.excluded_sections:
                    continue

                master_boms.append({
                    "sl": cells[0].strip(),
                    "bom_no": bom_no,
                    "bom_date": cells[2].strip(),
                    "section": sec,
                    "item_code": cells[4].strip(),
                    "product_name": cells[5].strip(),
                    "entry_by": cells[6].strip(),
                    "status": cells[7].strip()
                })

        self._log(22, f"Found {len(master_boms)} BOMs in target sections.", f"[BOM] Filtered master list returned {len(master_boms)} BOMs (excluded: {', '.join(self.excluded_sections)}).")
        return master_boms

    def fetch_bom_details(self, master_bom: Dict[str, Any]) -> Dict[str, Any]:
        """Fetches full breakdown (Raw materials, overhead, rejected) for a single BOM."""
        bom_no = master_bom["bom_no"]
        detail_url = f"https://mepgrouperp.com/1027/production_mod/pages/BOM/bom_print_view.php?bom_no={bom_no}"
        referer = "https://mepgrouperp.com/1027/production_mod/pages/BOM/bom_status.php"

        html_content = self._make_request(detail_url, referer=referer)

        item = dict(master_bom)
        now_iso = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        item["last_updated_at"] = now_iso

        # 1. Header attributes
        pname_m = re.search(r'Product Name\s*</strong>\s*</td>\s*<td[^>]*><strong>:\s*</strong></td>\s*<td[^>]*>(.*?)</td>', html_content, re.I | re.DOTALL)
        if pname_m:
            item["product_name"] = re.sub(r'<[^>]+>', '', pname_m.group(1)).strip()

        qty_m = re.search(r'Quantity\s*</strong>\s*</td>\s*<td[^>]*><strong>:\s*</strong></td>\s*<td[^>]*>(.*?)</td>', html_content, re.I | re.DOTALL)
        if qty_m:
            qty_raw = re.sub(r'<[^>]+>', '', qty_m.group(1)).strip()
            parts = qty_raw.split()
            item["output_quantity"] = float(parts[0].replace(",", "")) if parts else 1.0
            item["output_unit"] = parts[1] if len(parts) > 1 else "Pcs"
        else:
            item["output_quantity"] = 1.0
            item["output_unit"] = "Pcs"

        floor_m = re.search(r'Floor\s*</strong>\s*</td>\s*<td[^>]*><strong>:\s*</strong></td>\s*<td[^>]*>(.*?)</td>', html_content, re.I | re.DOTALL)
        if floor_m:
            floor_val = re.sub(r'<[^>]+>', '', floor_m.group(1)).strip()
            if floor_val:
                item["section"] = floor_val

        edit_m = re.search(r'Edit BY\s*</strong>\s*</td>\s*<td[^>]*><strong>:\s*</strong></td>\s*<td[^>]*>(.*?)</td>', html_content, re.I | re.DOTALL)
        if edit_m:
            item["edit_by"] = re.sub(r'<[^>]+>', '', edit_m.group(1)).strip()

        appr_m = re.search(r'Approved By\s*</strong>\s*</td>\s*<td[^>]*><strong>:\s*</strong></td>\s*<td[^>]*>(.*?)</td>', html_content, re.I | re.DOTALL)
        if appr_m:
            item["approved_by"] = re.sub(r'<[^>]+>', '', appr_m.group(1)).strip()

        # 2. Raw Materials Required Table
        raw_materials = []
        for table_match in re.finditer(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL | re.I):
            t_html = table_match.group(1)
            if "Raw Materials Required" in t_html:
                rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t_html, re.DOTALL | re.I)
                for r in rows[2:]:  # skip header rows
                    raw_cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.DOTALL | re.I)
                    cells = [
                        re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ')
                        for c in raw_cells
                    ]
                    if len(cells) >= 6:
                        status_val = cells[6].strip() if len(cells) > 6 else "Active"
                        # Completely exclude Inactive items from BOM
                        if status_val.lower() != "active":
                            continue

                        qty_val = 0.0
                        try:
                            qty_val = float(cells[5].replace(",", ""))
                        except ValueError:
                            qty_val = 0.0

                        # Extract direct Sub-BOM link from HTML cell if present
                        sub_bom_link = None
                        for rc in raw_cells:
                            m = re.search(r'bom_print_view\.php\?bom_no=([0-9a-zA-Z_-]+)', rc)
                            if m:
                                sub_bom_link = m.group(1).strip()
                                break

                        rm_entry = {
                            "sl": str(len(raw_materials) + 1),
                            "category": cells[1] if len(cells) > 1 else "",
                            "item_code": cells[2] if len(cells) > 2 else "",
                            "item_description": cells[3] if len(cells) > 3 else "",
                            "unit": cells[4] if len(cells) > 4 else "",
                            "quantity": qty_val,
                            "quantity_str": cells[5] if len(cells) > 5 else "0",
                            "status": "Active"
                        }

                        if sub_bom_link:
                            rm_entry["sub_bom_no"] = sub_bom_link
                            rm_entry["is_sub_bom"] = True

                        raw_materials.append(rm_entry)
        item["raw_materials"] = raw_materials

        # 3. Factory Overhead Cost Table
        overhead = []
        for table_match in re.finditer(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL | re.I):
            t_html = table_match.group(1)
            if "Factory Overhead Cost" in t_html:
                rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t_html, re.DOTALL | re.I)
                for r in rows[2:]:
                    cells = [
                        re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ')
                        for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.DOTALL | re.I)
                    ]
                    if len(cells) >= 3 and cells[0] != "Total:":
                        amt_val = 0.0
                        try:
                            amt_val = float(cells[3].replace(",", "")) if len(cells) > 3 else 0.0
                        except ValueError:
                            amt_val = 0.0

                        overhead.append({
                            "sl": cells[0],
                            "ledger_group": cells[1] if len(cells) > 1 else "",
                            "ledger_name": cells[2] if len(cells) > 2 else "",
                            "amount": amt_val
                        })
        item["overhead"] = overhead

        # 4. Rejected / By Product Table
        rejected = []
        for table_match in re.finditer(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL | re.I):
            t_html = table_match.group(1)
            if "Rejected/By Product" in t_html:
                rows = re.findall(r'<tr[^>]*>(.*?)</tr>', t_html, re.DOTALL | re.I)
                for r in rows[2:]:
                    cells = [
                        re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ')
                        for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.DOTALL | re.I)
                    ]
                    if len(cells) >= 6:
                        qty_val = 0.0
                        try:
                            qty_val = float(cells[6].replace(",", "")) if len(cells) > 6 else 0.0
                        except ValueError:
                            qty_val = 0.0

                        rejected.append({
                            "sl": cells[0],
                            "category": cells[1] if len(cells) > 1 else "",
                            "item_code": cells[2] if len(cells) > 2 else "",
                            "item_description": cells[3] if len(cells) > 3 else "",
                            "unit": cells[4] if len(cells) > 4 else "",
                            "ratio": cells[5] if len(cells) > 5 else "",
                            "quantity": qty_val,
                            "status": cells[7] if len(cells) > 7 else "Active"
                        })
        item["rejected_by_product"] = rejected

        return item

    def fetch_warehouse_stock(self) -> List[Dict[str, Any]]:
        """
        Fetches current stock from Warehouse Module -> Stock Position Report Detail (Closing) (Report 91223)
        Company: FAN (group_for = 3)
        """
        self._log(75, "Accessing Warehouse Closing Stock Report (91223)...", "[WAREHOUSE] Fetching Stock Position Report Detail (Closing)...")
        
        wh_form_url = "https://mepgrouperp.com/1027/warehouse_mod/pages/report/work_order_report.php"
        wh_report_url = "https://mepgrouperp.com/1027/warehouse_mod/pages/report/master_report.php"

        now = datetime.now()
        f_date = now.strftime("%Y-%m-01")
        t_date = now.strftime("%Y-%m-%d")

        post_data = {
            "report": "91223",
            "group_for": "3",  # Company: FAN
            "f_date": f_date,
            "t_date": t_date,
            "submit": "Show"
        }

        try:
            html_content = self._make_request(wh_report_url, data=post_data, referer=wh_form_url)
        except Exception as e:
            self._log(80, "Failed to retrieve stock report", f"[ERROR] Warehouse stock report request failed: {e}")
            return []

        stock_items = []
        for table_match in re.finditer(r'<table[^>]*>(.*?)</table>', html_content, re.DOTALL | re.I):
            table_html = table_match.group(1)
            rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table_html, re.DOTALL | re.I)
            for r in rows[2:]:  # skip title and headers
                cells = [
                    re.sub(r'<[^>]+>', '', c).strip().replace('&nbsp;', ' ')
                    for c in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', r, re.DOTALL | re.I)
                ]
                if len(cells) >= 11:
                    item_code = cells[6].strip()
                    item_name = cells[7].strip()
                    unit = cells[8].strip()
                    category = cells[4].strip()

                    try:
                        store_qty = float(cells[9].replace(',', '')) if cells[9] else 0.0
                    except ValueError:
                        store_qty = 0.0
                    try:
                        sec_qty = float(cells[10].replace(',', '')) if cells[10] else 0.0
                    except ValueError:
                        sec_qty = 0.0

                    total_qty = store_qty + sec_qty
                    rate_val = 0.0
                    if len(cells) > 11 and cells[11]:
                        try:
                            rate_val = float(cells[11].replace(',', ''))
                        except ValueError:
                            rate_val = 0.0

                    stock_amt_val = 0.0
                    if len(cells) > 12 and cells[12]:
                        try:
                            stock_amt_val = float(cells[12].replace(',', ''))
                        except ValueError:
                            stock_amt_val = 0.0

                    stock_items.append({
                        "item_code": item_code,
                        "item_name": item_name,
                        "category": category,
                        "unit": unit,
                        "store_qty": store_qty,
                        "section_qty": sec_qty,
                        "total_qty": total_qty,
                        "rate": rate_val,
                        "stock_amount": stock_amt_val,
                        "last_updated_at": now.strftime("%Y-%m-%d %H:%M:%S")
                    })

        self._log(88, f"Retrieved {len(stock_items)} Warehouse Stock items.", f"[WAREHOUSE] Stock Position Report (91223) parsed {len(stock_items)} active inventory items.")
        return stock_items

    def resolve_sub_boms(self, boms: List[Dict[str, Any]]) -> None:
        """
        Builds recursive multi-level Sub-BOM links across all branches and sections.
        Tags raw materials that are Sub-BOMs with their sub_bom_no, sub_bom_name, and section.
        """
        code_map = {}
        name_map = {}
        for b in boms:
            code = (b.get("item_code") or "").strip().upper()
            if code:
                code_map[code] = b
            pname = (b.get("product_name") or "").strip().lower()
            if pname:
                name_map[pname] = b
                if "-" in pname:
                    clean = pname.split("-", 1)[1].strip()
                    if clean:
                        name_map[clean] = b

        for b in boms:
            sub_boms_found = []
            for rm in b.get("raw_materials", []):
                rm_code = (rm.get("item_code") or "").strip().upper()
                rm_desc = (rm.get("item_description") or "").strip().lower()

                matched_bom = None
                if rm_code and rm_code in code_map:
                    matched_bom = code_map[rm_code]
                elif rm_desc and rm_desc in name_map:
                    matched_bom = name_map[rm_desc]
                else:
                    for name_key, target_bom in name_map.items():
                        if len(rm_desc) >= 6 and (rm_desc in name_key or name_key in rm_desc):
                            if str(target_bom.get("bom_no")) != str(b.get("bom_no")):
                                matched_bom = target_bom
                                break

                if matched_bom and str(matched_bom.get("bom_no")) != str(b.get("bom_no")):
                    rm["is_sub_bom"] = True
                    rm["sub_bom_no"] = matched_bom["bom_no"]
                    rm["sub_bom_name"] = matched_bom["product_name"]
                    rm["sub_bom_section"] = matched_bom.get("section", "")
                    rm["sub_bom_output_qty"] = matched_bom.get("output_quantity", 1.0)
                    rm["sub_bom_output_unit"] = matched_bom.get("output_unit", "Pcs")

                    sub_boms_found.append({
                        "bom_no": matched_bom["bom_no"],
                        "item_code": matched_bom.get("item_code", ""),
                        "product_name": matched_bom.get("product_name", ""),
                        "section": matched_bom.get("section", ""),
                        "required_qty": rm.get("quantity", 0.0),
                        "unit": rm.get("unit", "")
                    })
            b["sub_boms"] = sub_boms_found

    def run_full_scrape(self) -> Dict[str, Any]:
        """Executes full automated scraping workflow for all branches, Sub-BOMs, and Warehouse Stock."""
        start_time = time.time()
        self.authenticate()

        # 1. Scrape BOM Master List across ALL sections
        master_boms = self.fetch_bom_master_list()
        total_items = len(master_boms)

        detailed_boms = []
        if total_items > 0:
            self._log(25, f"Scraping details for {total_items} BOMs across all branches...", f"[FETCH] Starting parallel detail extraction across all branches using {self.max_workers} worker threads...")

            completed = 0
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                future_to_bom = {executor.submit(self.fetch_bom_details, mb): mb for mb in master_boms}
                
                for future in as_completed(future_to_bom):
                    completed += 1
                    mb = future_to_bom[future]
                    try:
                        detailed_item = future.result()
                        detailed_boms.append(detailed_item)
                        
                        pct = 25 + int((completed / total_items) * 45)
                        rm_count = len(detailed_item.get("raw_materials", []))
                        
                        if completed % 15 == 0 or completed == total_items:
                            self._log(
                                pct,
                                f"Fetched {completed}/{total_items} BOMs ({pct}%)",
                                f"  [{completed:03d}/{total_items:03d}] BOM #{detailed_item['bom_no']} - {detailed_item['product_name'][:32]} ({rm_count} RMs)"
                            )
                    except Exception as e:
                        self._log(
                            pct,
                            f"Error fetching BOM #{mb['bom_no']}",
                            f"  [ERROR] Failed to fetch BOM #{mb['bom_no']}: {e}"
                        )

            # Sort detailed BOMs back into order of master list
            order_map = {mb["bom_no"]: idx for idx, mb in enumerate(master_boms)}
            detailed_boms.sort(key=lambda x: order_map.get(x["bom_no"], 999999))

            # 2. Recursive Deep Multi-Level Sub-BOM Discovery Engine
            visited_bom_nos = {b["bom_no"] for b in detailed_boms}
            depth = 1
            while True:
                unfetched_sub_boms = set()
                for b in detailed_boms:
                    for rm in b.get("raw_materials", []):
                        sub_no = rm.get("sub_bom_no")
                        if sub_no and sub_no not in visited_bom_nos:
                            unfetched_sub_boms.add(sub_no)

                if not unfetched_sub_boms:
                    break

                self._log(
                    70,
                    f"Level {depth}: Crawling {len(unfetched_sub_boms)} nested Sub-BOMs...",
                    f"[RECURSIVE SUB-BOM L{depth}] Scraping {len(unfetched_sub_boms)} unlisted nested child BOMs: {', '.join(sorted(unfetched_sub_boms))}"
                )

                with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                    future_to_sub = {
                        executor.submit(self.fetch_bom_details, {
                            "bom_no": sno,
                            "sl": "",
                            "status": "APPROVED",
                            "bom_date": "",
                            "section": "Dhalai and Die Casting Section"
                        }): sno
                        for sno in unfetched_sub_boms
                    }
                    for future in as_completed(future_to_sub):
                        sno = future_to_sub[future]
                        try:
                            sub_item = future.result()
                            if sub_item and sub_item.get("product_name"):
                                detailed_boms.append(sub_item)
                        except Exception as e:
                            pass

                for sno in unfetched_sub_boms:
                    visited_bom_nos.add(sno)
                depth += 1

            # 3. Resolve Multi-Level Sub-BOMs across all branches
            self._log(75, f"Linking {len(detailed_boms)} multi-level Sub-BOMs...", "[SUB-BOM] Performing multi-level sub-assembly resolution...")
            self.resolve_sub_boms(detailed_boms)

        # 4. Scrape Warehouse Stock Position Detail (Closing)
        warehouse_stock = self.fetch_warehouse_stock()

        duration = time.time() - start_time
        self._log(95, f"Extraction finished in {duration:.1f}s.", f"[COMPLETED] Extracted {len(detailed_boms)} BOMs & {len(warehouse_stock)} Stock items in {duration:.2f}s.")
        
        return {
            "boms": detailed_boms,
            "stock": warehouse_stock
        }
