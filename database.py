import os
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Any, Optional

class Database:
    def __init__(self, base_dir: Optional[str] = None):
        if base_dir is None:
            base_dir = os.path.dirname(os.path.abspath(__file__))
        self.base_dir = base_dir
        self.data_dir = os.path.join(self.base_dir, "data")
        os.makedirs(self.data_dir, exist_ok=True)
        
        self.json_path = os.path.join(self.data_dir, "boms.json")
        self.stock_json_path = os.path.join(self.data_dir, "warehouse_stock.json")
        self.db_path = os.path.join(self.data_dir, "bom_database.db")
        self.history_path = os.path.join(self.data_dir, "sync_history.json")
        self.config_path = os.path.join(self.base_dir, "config.json")
        
        self.excluded_sections = set()
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    self.excluded_sections = set(cfg.get("excluded_sections", []))
            except Exception:
                self.excluded_sections = set()
        else:
            self.excluded_sections = set()
        
        self._init_sqlite()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self):
        """Initializes tables and indexes in SQLite database."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            # BOMs table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS boms (
                bom_no TEXT PRIMARY KEY,
                product_name TEXT,
                item_code TEXT,
                section TEXT,
                output_quantity REAL DEFAULT 1.0,
                output_unit TEXT,
                bom_date TEXT,
                status TEXT,
                entry_by TEXT,
                edit_by TEXT,
                approved_by TEXT,
                company TEXT,
                raw_materials_count INTEGER DEFAULT 0,
                overhead_count INTEGER DEFAULT 0,
                rejected_count INTEGER DEFAULT 0,
                raw_data_json TEXT,
                last_updated_at TEXT
            )
            """)

            # Raw Materials table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS bom_raw_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bom_no TEXT,
                sl TEXT,
                category TEXT,
                item_code TEXT,
                item_description TEXT,
                unit TEXT,
                quantity REAL,
                status TEXT,
                FOREIGN KEY (bom_no) REFERENCES boms(bom_no) ON DELETE CASCADE
            )
            """)

            # Factory Overhead table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS bom_overhead (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bom_no TEXT,
                sl TEXT,
                ledger_group TEXT,
                ledger_name TEXT,
                amount REAL,
                FOREIGN KEY (bom_no) REFERENCES boms(bom_no) ON DELETE CASCADE
            )
            """)

            # Rejected / By Product table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS bom_rejected_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bom_no TEXT,
                sl TEXT,
                category TEXT,
                item_code TEXT,
                item_description TEXT,
                unit TEXT,
                ratio TEXT,
                quantity REAL,
                status TEXT,
                FOREIGN KEY (bom_no) REFERENCES boms(bom_no) ON DELETE CASCADE
            )
            """)

            # Warehouse Stock table (Report 91223)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS warehouse_stock (
                item_code TEXT PRIMARY KEY,
                item_name TEXT,
                category TEXT,
                unit TEXT,
                store_qty REAL DEFAULT 0.0,
                section_qty REAL DEFAULT 0.0,
                total_qty REAL DEFAULT 0.0,
                rate REAL DEFAULT 0.0,
                stock_amount REAL DEFAULT 0.0,
                last_updated_at TEXT
            )
            """)

            # Sync History table
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sync_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_time TEXT,
                duration_seconds REAL,
                total_boms INTEGER,
                total_stock_items INTEGER DEFAULT 0,
                added_count INTEGER,
                updated_count INTEGER,
                deleted_count INTEGER,
                status TEXT,
                report_json TEXT
            )
            """)

            # Upgrade sync_history if column is missing
            cursor.execute("PRAGMA table_info(sync_history)")
            cols = [r["name"] for r in cursor.fetchall()]
            if "total_stock_items" not in cols:
                cursor.execute("ALTER TABLE sync_history ADD COLUMN total_stock_items INTEGER DEFAULT 0")

            # Create search indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_boms_section ON boms(section)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_boms_item_code ON boms(item_code)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rm_item_code ON bom_raw_materials(item_code)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rm_bom_no ON bom_raw_materials(bom_no)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_rm_category ON bom_raw_materials(category)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_item_code ON warehouse_stock(item_code)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_stock_category ON warehouse_stock(category)")
            
            conn.commit()

    # -------------------------------------------------------------
    # BOM Persistence Methods
    # -------------------------------------------------------------
    def load_json_boms(self) -> List[Dict[str, Any]]:
        """Loads BOMs from JSON file."""
        if os.path.exists(self.json_path):
            try:
                with open(self.json_path, "r", encoding="utf-8") as f:
                    boms = json.load(f)
                    if self.excluded_sections:
                        boms = [b for b in boms if b.get("section", "").strip() not in self.excluded_sections]
                    for b in boms:
                        b["raw_materials"] = [rm for rm in b.get("raw_materials", []) if str(rm.get("status", "Active")).strip().lower() == "active"]
                    return boms
            except Exception:
                return []
        return []

    def save_all_boms(self, boms: List[Dict[str, Any]], sync_report: Optional[Dict[str, Any]] = None):
        """Saves BOM list to both JSON file and SQLite database."""
        if self.excluded_sections:
            boms = [b for b in boms if b.get("section", "").strip() not in self.excluded_sections]

        # Filter raw materials to only active items and renumber SL
        for b in boms:
            active_rms = []
            for i, rm in enumerate(b.get("raw_materials", [])):
                if str(rm.get("status", "Active")).strip().lower() == "active":
                    rm_copy = dict(rm)
                    rm_copy["sl"] = str(len(active_rms) + 1)
                    rm_copy["status"] = "Active"
                    active_rms.append(rm_copy)
            b["raw_materials"] = active_rms

        with open(self.json_path, "w", encoding="utf-8") as f:
            json.dump(boms, f, indent=2, ensure_ascii=False)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM bom_raw_materials")
            cursor.execute("DELETE FROM bom_overhead")
            cursor.execute("DELETE FROM bom_rejected_items")
            cursor.execute("DELETE FROM boms")

            for b in boms:
                bom_no = str(b.get("bom_no", "")).strip()
                if not bom_no:
                    continue

                rm_list = b.get("raw_materials", [])
                ov_list = b.get("overhead", [])
                rej_list = b.get("rejected_by_product", [])

                out_qty = 1.0
                try:
                    q_str = str(b.get("output_quantity", "1.0")).split()[0].replace(",", "")
                    out_qty = float(q_str)
                except Exception:
                    out_qty = 1.0

                cursor.execute("""
                INSERT OR REPLACE INTO boms (
                    bom_no, product_name, item_code, section, output_quantity, output_unit,
                    bom_date, status, entry_by, edit_by, approved_by, company,
                    raw_materials_count, overhead_count, rejected_count, raw_data_json, last_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    bom_no,
                    b.get("product_name", ""),
                    b.get("item_code", ""),
                    b.get("section", ""),
                    out_qty,
                    b.get("output_unit", "Pcs"),
                    b.get("bom_date", ""),
                    b.get("status", "APPROVED"),
                    b.get("entry_by", ""),
                    b.get("edit_by", ""),
                    b.get("approved_by", ""),
                    b.get("company", "MEP FAN LIMITED."),
                    len(rm_list),
                    len(ov_list),
                    len(rej_list),
                    json.dumps(b, ensure_ascii=False),
                    b.get("last_updated_at", now_str)
                ))

                for rm in rm_list:
                    rm_qty = 0.0
                    try:
                        rm_qty = float(str(rm.get("quantity", "0")).replace(",", ""))
                    except Exception:
                        rm_qty = 0.0

                    cursor.execute("""
                    INSERT INTO bom_raw_materials (
                        bom_no, sl, category, item_code, item_description, unit, quantity, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        bom_no,
                        str(rm.get("sl", "")),
                        rm.get("category", ""),
                        rm.get("item_code", ""),
                        rm.get("item_description", ""),
                        rm.get("unit", ""),
                        rm_qty,
                        rm.get("status", "Active")
                    ))

                for ov in ov_list:
                    ov_amt = 0.0
                    try:
                        ov_amt = float(str(ov.get("amount", "0")).replace(",", ""))
                    except Exception:
                        ov_amt = 0.0

                    cursor.execute("""
                    INSERT INTO bom_overhead (
                        bom_no, sl, ledger_group, ledger_name, amount
                    ) VALUES (?, ?, ?, ?, ?)
                    """, (
                        bom_no,
                        str(ov.get("sl", "")),
                        ov.get("ledger_group", ""),
                        ov.get("ledger_name", ""),
                        ov_amt
                    ))

                for rj in rej_list:
                    rj_qty = 0.0
                    try:
                        rj_qty = float(str(rj.get("quantity", "0")).replace(",", ""))
                    except Exception:
                        rj_qty = 0.0

                    cursor.execute("""
                    INSERT INTO bom_rejected_items (
                        bom_no, sl, category, item_code, item_description, unit, ratio, quantity, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        bom_no,
                        str(rj.get("sl", "")),
                        rj.get("category", ""),
                        rj.get("item_code", ""),
                        rj.get("item_description", ""),
                        rj.get("unit", ""),
                        rj.get("ratio", ""),
                        rj_qty,
                        rj.get("status", "Active")
                    ))

            if sync_report:
                cursor.execute("""
                INSERT INTO sync_history (
                    sync_time, duration_seconds, total_boms, total_stock_items, added_count, updated_count, deleted_count, status, report_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    sync_report.get("sync_time", now_str),
                    sync_report.get("duration_seconds", 0.0),
                    sync_report.get("total_boms", len(boms)),
                    sync_report.get("total_stock_items", 0),
                    sync_report.get("added_count", 0),
                    sync_report.get("updated_count", 0),
                    sync_report.get("deleted_count", 0),
                    sync_report.get("status", "SUCCESS"),
                    json.dumps(sync_report, ensure_ascii=False)
                ))

            conn.commit()

        if sync_report:
            history = self.get_sync_history()
            history.insert(0, sync_report)
            history = history[:50]
            with open(self.history_path, "w", encoding="utf-8") as f:
                json.dump(history, f, indent=2, ensure_ascii=False)

    # -------------------------------------------------------------
    # Warehouse Stock Persistence Methods
    # -------------------------------------------------------------
    def save_warehouse_stock(self, stock_items: List[Dict[str, Any]]):
        """Saves warehouse stock list to both JSON file and SQLite database."""
        with open(self.stock_json_path, "w", encoding="utf-8") as f:
            json.dump(stock_items, f, indent=2, ensure_ascii=False)

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM warehouse_stock")
            for item in stock_items:
                cursor.execute("""
                INSERT OR REPLACE INTO warehouse_stock (
                    item_code, item_name, category, unit, store_qty, section_qty, total_qty, rate, stock_amount, last_updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    item.get("item_code", ""),
                    item.get("item_name", ""),
                    item.get("category", ""),
                    item.get("unit", ""),
                    item.get("store_qty", 0.0),
                    item.get("section_qty", 0.0),
                    item.get("total_qty", 0.0),
                    item.get("rate", 0.0),
                    item.get("stock_amount", 0.0),
                    item.get("last_updated_at", now_str)
                ))
            conn.commit()

    def get_warehouse_stock(self) -> List[Dict[str, Any]]:
        """Returns all warehouse stock items."""
        if os.path.exists(self.stock_json_path):
            try:
                with open(self.stock_json_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM warehouse_stock ORDER BY item_name ASC")
            return [dict(r) for r in cursor.fetchall()]

    def get_stock_dict(self) -> Dict[str, Dict[str, Any]]:
        """Returns a fast lookup dictionary keyed by item_code."""
        items = self.get_warehouse_stock()
        stock_map = {}
        for it in items:
            code = it.get("item_code", "").strip()
            if code:
                stock_map[code] = it
        return stock_map

    # -------------------------------------------------------------
    # Production Feasibility Checker Engine
    # -------------------------------------------------------------
    def calculate_feasibility(self, bom_no: str, target_qty: float = 1.0) -> Optional[Dict[str, Any]]:
        """
        Calculates production feasibility and material shortage for a specific BOM.
        Excludes INACTIVE raw material items from feasibility, shortage and bottleneck calculations.
        """
        bom = self.get_bom_by_no(bom_no)
        if not bom:
            return None

        stock_map = self.get_stock_dict()
        raw_materials = bom.get("raw_materials", [])

        if target_qty <= 0:
            target_qty = 1.0

        material_analysis = []
        possible_quantities = []

        for rm in raw_materials:
            rm_code = str(rm.get("item_code", "")).strip()
            rm_desc = str(rm.get("item_description", "")).strip()
            rm_cat = str(rm.get("category", "")).strip()
            rm_unit = str(rm.get("unit", "")).strip()
            rm_status = str(rm.get("status", "Active")).strip()
            
            # Skip any item that is not Active
            if rm_status.lower() != "active":
                continue

            try:
                req_per_unit = float(str(rm.get("quantity", 0)).replace(",", ""))
            except ValueError:
                req_per_unit = 0.0

            stock_record = stock_map.get(rm_code)
            if not stock_record and rm_desc:
                for sc, sitem in stock_map.items():
                    if sitem.get("item_name", "").strip().lower() == rm_desc.lower():
                        stock_record = sitem
                        break

            store_qty = stock_record["store_qty"] if stock_record else 0.0
            section_qty = stock_record["section_qty"] if stock_record else 0.0
            available_qty = stock_record["total_qty"] if stock_record else 0.0

            if req_per_unit > 0:
                possible_units = available_qty / req_per_unit
            else:
                possible_units = 999999999.0

            possible_quantities.append((possible_units, rm_code, rm_desc, req_per_unit, store_qty, section_qty, available_qty, rm_unit))

            target_required = target_qty * req_per_unit
            shortage = max(0.0, target_required - available_qty)

            if available_qty <= 0.000001:
                status_flag = "OUT_OF_STOCK"
                status_label = "Out of Stock"
            elif available_qty < target_required:
                status_flag = "SHORTAGE"
                status_label = "Insufficient Stock"
            elif possible_units < (target_qty * 1.5):
                status_flag = "LIMITED"
                status_label = "Limited Stock"
            else:
                status_flag = "SUFFICIENT"
                status_label = "Sufficient Stock"

            material_analysis.append({
                "sl": str(len(material_analysis) + 1),
                "item_code": rm_code,
                "item_description": rm_desc,
                "category": rm_cat,
                "unit": rm_unit,
                "status": "Active",
                "is_active": True,
                "required_per_unit": req_per_unit,
                "target_required": round(target_required, 6),
                "store_qty": round(store_qty, 6),
                "section_qty": round(section_qty, 6),
                "available_qty": round(available_qty, 6),
                "shortage": round(shortage, 6),
                "possible_build_units": int(possible_units) if possible_units < 1e8 else 999999,
                "possible_build_exact": round(possible_units, 2),
                "status_flag": status_flag,
                "status_label": status_label,
                "is_in_warehouse": stock_record is not None
            })

        if possible_quantities:
            possible_quantities.sort(key=lambda x: x[0])
            min_possible = possible_quantities[0][0]
            max_buildable_units = int(min_possible) if min_possible < 1e8 else 0
        else:
            max_buildable_units = 0

        bottlenecks = []
        if possible_quantities:
            min_val = possible_quantities[0][0]
            for p_tuple in possible_quantities:
                if abs(p_tuple[0] - min_val) < 0.001 or (min_val == 0 and p_tuple[0] == 0):
                    bottlenecks.append({
                        "item_code": p_tuple[1],
                        "item_description": p_tuple[2],
                        "required_per_unit": p_tuple[3],
                        "store_qty": p_tuple[4],
                        "section_qty": p_tuple[5],
                        "available_qty": p_tuple[6],
                        "unit": p_tuple[7],
                        "limiting_limit": round(p_tuple[0], 2)
                    })

        bottleneck_codes = {b["item_code"] for b in bottlenecks}
        for ma in material_analysis:
            if ma["is_active"]:
                ma["is_bottleneck"] = ma["item_code"] in bottleneck_codes
            else:
                ma["is_bottleneck"] = False

        can_produce = max_buildable_units > 0
        can_produce_target = max_buildable_units >= target_qty

        active_materials = [m for m in material_analysis if m["is_active"]]
        inactive_materials = [m for m in material_analysis if not m["is_active"]]

        sufficient_count = sum(1 for m in active_materials if m["status_flag"] == "SUFFICIENT")
        limited_count = sum(1 for m in active_materials if m["status_flag"] == "LIMITED")
        shortage_count = sum(1 for m in active_materials if m["status_flag"] in ("SHORTAGE", "OUT_OF_STOCK"))
        out_of_stock_count = sum(1 for m in active_materials if m["status_flag"] == "OUT_OF_STOCK")

        return {
            "bom_no": bom_no,
            "product_name": bom.get("product_name", ""),
            "item_code": bom.get("item_code", ""),
            "section": bom.get("section", ""),
            "output_quantity": bom.get("output_quantity", 1.0),
            "output_unit": bom.get("output_unit", "Pcs"),
            "target_quantity": target_qty,
            "max_buildable_units": max_buildable_units,
            "can_produce": can_produce,
            "can_produce_target": can_produce_target,
            "primary_bottleneck": bottlenecks[0] if bottlenecks else None,
            "all_bottlenecks": bottlenecks,
            "material_analysis": material_analysis,
            "summary_counts": {
                "total_materials": len(material_analysis),
                "active_materials": len(active_materials),
                "inactive_materials": len(inactive_materials),
                "sufficient_count": sufficient_count,
                "limited_count": limited_count,
                "shortage_count": shortage_count,
                "out_of_stock_count": out_of_stock_count
            },
            "last_calculated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    def get_all_feasibility_matrix(self) -> List[Dict[str, Any]]:
        """Calculates high-speed feasibility overview for all BOMs in the database."""
        boms = self.get_all_boms()
        stock_map = self.get_stock_dict()

        matrix = []
        for b in boms:
            bom_no = b.get("bom_no", "")
            pname = b.get("product_name", "")
            icode = b.get("item_code", "")
            sec = b.get("section", "")
            rms = b.get("raw_materials", [])

            # Filter active RMs
            active_rms = [rm for rm in rms if str(rm.get("status", "Active")).strip().lower() == "active"]

            if not active_rms:
                matrix.append({
                    "bom_no": bom_no,
                    "product_name": pname,
                    "item_code": icode,
                    "section": sec,
                    "rm_count": len(rms),
                    "active_rm_count": 0,
                    "max_buildable_units": 0,
                    "can_produce": False,
                    "bottleneck_name": "No Active Raw Materials",
                    "bottleneck_code": "",
                    "bottleneck_available": 0.0,
                    "bottleneck_unit": ""
                })
                continue

            possible_list = []
            for rm in active_rms:
                rm_code = str(rm.get("item_code", "")).strip()
                rm_desc = str(rm.get("item_description", "")).strip()
                try:
                    req = float(str(rm.get("quantity", 0)).replace(",", ""))
                except ValueError:
                    req = 0.0

                stock_item = stock_map.get(rm_code)
                avail = stock_item["total_qty"] if stock_item else 0.0

                if req > 0:
                    poss = avail / req
                else:
                    poss = 999999999.0

                possible_list.append((poss, rm_desc, rm_code, avail, rm.get("unit", "")))

            possible_list.sort(key=lambda x: x[0])
            min_poss = possible_list[0][0]
            max_units = int(min_poss) if min_poss < 1e8 else 0
            bottleneck = possible_list[0]

            matrix.append({
                "bom_no": bom_no,
                "product_name": pname,
                "item_code": icode,
                "section": sec,
                "rm_count": len(rms),
                "active_rm_count": len(active_rms),
                "max_buildable_units": max_units,
                "can_produce": max_units > 0,
                "bottleneck_name": bottleneck[1],
                "bottleneck_code": bottleneck[2],
                "bottleneck_available": round(bottleneck[3], 4),
                "bottleneck_unit": bottleneck[4]
            })

        matrix.sort(key=lambda x: (-1 if x["can_produce"] else 1, -x["max_buildable_units"]))
        return matrix

    # -------------------------------------------------------------
    # Query & Stats Helpers
    # -------------------------------------------------------------
    def get_all_boms(self, enrich_stock: bool = True) -> List[Dict[str, Any]]:
        """Returns all BOM objects, automatically enriched with stock feasibility calculations."""
        boms = self.load_json_boms()
        if not boms:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT raw_data_json FROM boms ORDER BY bom_no DESC")
                rows = cursor.fetchall()
                boms = []
                for r in rows:
                    if r["raw_data_json"]:
                        boms.append(json.loads(r["raw_data_json"]))

        if enrich_stock:
            stock_map = self.get_stock_dict()
            for b in boms:
                rms = b.get("raw_materials", [])
                active_rms = [rm for rm in rms if str(rm.get("status", "Active")).strip().lower() == "active"]
                
                b["active_rm_count"] = len(active_rms)
                b["total_rm_count"] = len(rms)

                # Attach stock into each RM object
                possible_list = []
                for rm in rms:
                    rm_code = str(rm.get("item_code", "")).strip()
                    rm_desc = str(rm.get("item_description", "")).strip()
                    is_active = str(rm.get("status", "Active")).strip().lower() == "active"
                    rm["is_active"] = is_active

                    try:
                        req = float(str(rm.get("quantity", 0)).replace(",", ""))
                    except ValueError:
                        req = 0.0

                    stock_item = stock_map.get(rm_code)
                    store_qty = stock_item["store_qty"] if stock_item else 0.0
                    section_qty = stock_item["section_qty"] if stock_item else 0.0
                    avail = stock_item["total_qty"] if stock_item else 0.0
                    poss = avail / req if req > 0 else 999999999.0

                    rm["store_qty"] = store_qty
                    rm["section_qty"] = section_qty
                    rm["available_stock"] = avail
                    rm["possible_build"] = int(poss) if (is_active and poss < 1e8) else None

                    if is_active:
                        possible_list.append((poss, rm_desc, rm_code, avail, rm.get("unit", "")))

                if not possible_list:
                    b["max_buildable_units"] = 0
                    b["can_produce"] = False
                    b["bottleneck_name"] = "No Active Raw Materials"
                    b["bottleneck_code"] = ""
                    b["bottleneck_available"] = 0.0
                    b["bottleneck_unit"] = ""
                else:
                    possible_list.sort(key=lambda x: x[0])
                    min_poss = possible_list[0][0]
                    b["max_buildable_units"] = int(min_poss) if min_poss < 1e8 else 0
                    b["can_produce"] = b["max_buildable_units"] > 0
                    b["bottleneck_name"] = possible_list[0][1]
                    b["bottleneck_code"] = possible_list[0][2]
                    b["bottleneck_available"] = round(possible_list[0][3], 4)
                    b["bottleneck_unit"] = possible_list[0][4]

        return boms

    def get_bom_by_no(self, bom_no: str) -> Optional[Dict[str, Any]]:
        """Returns single full BOM object by BOM number with stock details."""
        clean_no = str(bom_no).strip()
        all_boms = self.get_all_boms(enrich_stock=True)
        for b in all_boms:
            if str(b.get("bom_no", "")).strip() == clean_no:
                return b
        return None

    def get_stats(self) -> Dict[str, Any]:
        """Calculates rich metrics and aggregations for dashboard."""
        boms = self.get_all_boms(enrich_stock=True)
        total_boms = len(boms)
        
        unique_product_codes = len({b.get("item_code") for b in boms if b.get("item_code")})
        unique_rms = len({rm.get("item_code") for b in boms for rm in b.get("raw_materials", []) if rm.get("item_code")})
        
        # Section breakdown
        sec_counts = {}
        for b in boms:
            sec = b.get("section", "Unknown")
            sec_counts[sec] = sec_counts.get(sec, 0) + 1
            
        section_breakdown = [{"section": s, "count": c} for s, c in sorted(sec_counts.items(), key=lambda x: x[1], reverse=True)]

        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM warehouse_stock")
            total_stock_items = cursor.fetchone()[0]

            cursor.execute("SELECT * FROM sync_history ORDER BY id DESC LIMIT 1")
            last_sync = cursor.fetchone()
            last_sync_info = dict(last_sync) if last_sync else None

        ready_to_produce_count = sum(1 for b in boms if b.get("can_produce", False))

        return {
            "total_boms": total_boms,
            "total_products": unique_product_codes,
            "unique_raw_materials": unique_rms,
            "total_stock_items": total_stock_items,
            "ready_to_produce_count": ready_to_produce_count,
            "section_breakdown": section_breakdown,
            "last_sync": last_sync_info
        }

    def get_raw_materials_reverse_lookup(self, query: str = "") -> List[Dict[str, Any]]:
        """Reverse Lookup: Finds which BOMs use specific raw materials with live stock."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            
            sql = """
            SELECT 
                rm.item_code,
                rm.item_description,
                rm.category,
                rm.unit,
                COUNT(DISTINCT rm.bom_no) as bom_usage_count,
                SUM(rm.quantity) as total_allocated_quantity,
                GROUP_CONCAT(rm.bom_no || ':' || rm.quantity || ' ' || rm.unit || ' (' || b.product_name || ')') as usage_details
            FROM bom_raw_materials rm
            JOIN boms b ON rm.bom_no = b.bom_no
            """
            params = []
            if query:
                sql += " WHERE rm.item_code LIKE ? OR rm.item_description LIKE ? OR rm.category LIKE ?"
                like_str = f"%{query.strip()}%"
                params = [like_str, like_str, like_str]

            sql += " GROUP BY rm.item_code, rm.item_description ORDER BY bom_usage_count DESC, rm.item_description ASC"
            
            cursor.execute(sql, params)
            rows = cursor.fetchall()
            
            stock_map = self.get_stock_dict()
            results = []
            for r in rows:
                code = r["item_code"]
                st = stock_map.get(code)
                results.append({
                    "item_code": code,
                    "item_description": r["item_description"],
                    "category": r["category"],
                    "unit": r["unit"],
                    "store_qty": st["store_qty"] if st else 0.0,
                    "section_qty": st["section_qty"] if st else 0.0,
                    "available_stock": st["total_qty"] if st else 0.0,
                    "bom_usage_count": r["bom_usage_count"],
                    "total_allocated_quantity": round(r["total_allocated_quantity"], 6) if r["total_allocated_quantity"] else 0.0,
                    "usage_details": r["usage_details"]
                })
            return results

    def get_sync_history(self) -> List[Dict[str, Any]]:
        """Returns list of past sync records."""
        if os.path.exists(self.history_path):
            try:
                with open(self.history_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def load_physical_entry_sheet(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """Reads 'Entry Sheet Physical' tab from BOT/ALL REPORT.xlsx with fast JSON caching and auto file-change detection."""
        cache_path = os.path.join(self.data_dir, "physical_entry_sheet.json")
        excel_path = os.path.join(self.base_dir, "BOT", "ALL REPORT.xlsx")
        
        # Fast Path: Return from cache file ONLY if Excel hasn't been modified since cache creation
        if not force_refresh and os.path.exists(cache_path):
            try:
                cache_valid = True
                if os.path.exists(excel_path):
                    excel_mtime = os.path.getmtime(excel_path)
                    cache_mtime = os.path.getmtime(cache_path)
                    if excel_mtime > cache_mtime:
                        cache_valid = False
                if cache_valid:
                    with open(cache_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if data:
                            return data
            except Exception:
                pass

        # Slow Path: Read live from Excel file
        if os.path.exists(excel_path):
            try:
                import tempfile, shutil, openpyxl
                from datetime import datetime
                
                temp_dir = tempfile.gettempdir()
                temp_file = os.path.join(temp_dir, f"temp_all_report_{os.getpid()}.xlsx")
                shutil.copy2(excel_path, temp_file)
                wb = openpyxl.load_workbook(temp_file, data_only=True, read_only=True)
                
                sheet_name = "Entry Sheet Physical" if "Entry Sheet Physical" in wb.sheetnames else None
                if not sheet_name:
                    for name in wb.sheetnames:
                        if "physical" in name.lower() and "entry" in name.lower():
                            sheet_name = name
                            break
                            
                if sheet_name:
                    ws = wb[sheet_name]
                    entries = []
                    for row in ws.iter_rows(min_row=2, values_only=True):
                        if not any(row):
                            continue
                        day_val = row[0] if len(row) > 0 else None
                        date_val = row[1] if len(row) > 1 else None
                        item_code = row[2] if len(row) > 2 else None
                        item_name = row[3] if len(row) > 3 else None
                        qty = row[4] if len(row) > 4 else None
                        month = row[5] if len(row) > 5 else None
                        types = row[6] if len(row) > 6 else None
                        model_num = row[7] if len(row) > 7 else None
                        part_type = row[8] if len(row) > 8 else None
                        year = row[9] if len(row) > 9 else None

                        if not item_code and not item_name and not qty:
                            continue
                        if item_code is None and item_name is None:
                            continue

                        if isinstance(date_val, datetime):
                            date_str = date_val.strftime("%Y-%m-%d")
                        elif isinstance(day_val, datetime):
                            date_str = day_val.strftime("%Y-%m-%d")
                        elif date_val is not None:
                            date_str = str(date_val).split(" ")[0]
                        else:
                            date_str = ""

                        clean_part = str(part_type or "").strip().lower()
                        if not clean_part:
                            if "{body}" in str(item_name).lower():
                                clean_part = "body"
                            elif "{blade}" in str(item_name).lower() or "(bl)" in str(item_code).lower():
                                clean_part = "blade"
                            else:
                                clean_part = "unit"

                        entries.append({
                            "id": len(entries) + 1,
                            "date": date_str,
                            "item_code": str(item_code or "").strip(),
                            "item_name": str(item_name or "").strip(),
                            "qty": int(qty or 0) if isinstance(qty, (int, float)) else 0,
                            "month": str(month or "").strip(),
                            "type": str(types or "Ceiling Fan").strip(),
                            "model_num": str(model_num or "").strip(),
                            "part_type": clean_part,
                            "year": int(year or 2026) if isinstance(year, (int, float)) else 2026
                        })
                        
                    wb.close()
                    try:
                        if os.path.exists(temp_file):
                            os.remove(temp_file)
                    except Exception:
                        pass

                    if entries:
                        with open(cache_path, "w", encoding="utf-8") as f:
                            json.dump(entries, f, indent=2, ensure_ascii=False)
                        return entries
            except Exception:
                pass
                
        # Final Fallback to cached json
        if os.path.exists(cache_path):
            try:
                with open(cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def get_physical_matrix(self, part_type: str = 'body', force_refresh: bool = False) -> Dict[str, Any]:
        """Calculates Day and Model Wise Production Matrix matching Excel 'Per Day Production' tab."""
        entries = self.load_physical_entry_sheet(force_refresh=force_refresh)
        clean_part = part_type.lower().strip()
        filtered_entries = [e for e in entries if e.get("part_type") == clean_part]

        # Model columns order
        if clean_part == "blade":
            models_order = ["5601 BL", "5602 BL", "5603 BL", "5606 BL", "5607 BL", "4801 BL", "3601 BL", "2401 BL"]
            monthly_target = 45500
            daily_target = 1750
        else:
            models_order = ["5601", "5602", "5603", "5606", "5607", "4801", "3601", "2401"]
            monthly_target = 45500
            daily_target = 1750

        # Unique models from dataset
        found_models = {e.get("model_num") for e in filtered_entries if e.get("model_num")}
        # Merge preserving order
        models = [m for m in models_order if m in found_models or any(m.startswith(x) for x in found_models)]
        for m in sorted(found_models):
            if m not in models:
                models.append(m)

        # Date mapping
        date_map = {}
        for e in filtered_entries:
            d = e.get("date")
            m = e.get("model_num")
            q = e.get("qty", 0)
            if d:
                if d not in date_map:
                    date_map[d] = {}
                date_map[d][m] = date_map[d].get(m, 0) + q

        # Days of August (1 to 31)
        dates = [f"2026-08-{i:02d}" for i in range(1, 32)]
        daily_rows = []
        total_prod = 0
        model_totals = {m: 0 for m in models}

        for d in dates:
            row_models = {}
            row_total = 0
            try:
                dt = datetime.strptime(d, "%Y-%m-%d")
                day_name = dt.strftime("%A")
            except Exception:
                day_name = ""

            for m in models:
                val = date_map.get(d, {}).get(m, 0)
                row_models[m] = val
                row_total += val
                model_totals[m] += val

            has_prod = row_total > 0
            variance = row_total - daily_target if has_prod else 0
            loss = daily_target - row_total if has_prod else 0

            total_prod += row_total
            daily_rows.append({
                "date": d,
                "day_name": day_name,
                "models": row_models,
                "total": row_total,
                "target": daily_target if has_prod else 0,
                "variance": variance,
                "loss": loss,
                "has_production": has_prod
            })

        achieve_pct = round((total_prod / monthly_target) * 100, 1) if monthly_target else 0

        # Model shares
        model_shares = []
        for m in models:
            m_qty = model_totals.get(m, 0)
            m_pct = round((m_qty / total_prod) * 100, 1) if total_prod > 0 else 0
            model_shares.append({
                "model": m,
                "quantity": m_qty,
                "percentage": m_pct
            })

        model_shares.sort(key=lambda x: x["quantity"], reverse=True)

        active_days = sum(1 for r in daily_rows if r["has_production"])
        avg_output = round(total_prod / max(1, active_days))
        peak_day = max(daily_rows, key=lambda x: x["total"]) if daily_rows else None

        result = {
            "part": clean_part,
            "part_label": "Ceiling Fan Blade Stamping & Balancing" if clean_part == "blade" else "Ceiling Fan Body Assembly",
            "models": models,
            "model_totals": model_totals,
            "model_shares": model_shares,
            "total_production": total_prod,
            "monthly_target": monthly_target,
            "achievement_pct": achieve_pct,
            "daily_target": daily_target,
            "daily_rows": daily_rows,
            "active_days_count": active_days,
            "average_daily_output": avg_output,
            "peak_day": peak_day,
            "raw_entries": filtered_entries
        }

        # Cache matrix JSON
        matrix_cache_path = os.path.join(self.data_dir, f"physical_matrix_{clean_part}.json")
        try:
            with open(matrix_cache_path, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

        return result
