import hashlib
import json
from typing import Dict, List, Any, Tuple

class DiffEngine:
    @staticmethod
    def _compute_bom_signature(bom: Dict[str, Any]) -> str:
        """Computes a deterministic hash of a BOM's core content."""
        # Include product info and full raw materials & overhead content
        core = {
            "bom_no": str(bom.get("bom_no", "")).strip(),
            "product_name": str(bom.get("product_name", "")).strip(),
            "item_code": str(bom.get("item_code", "")).strip(),
            "section": str(bom.get("section", "")).strip(),
            "output_quantity": str(bom.get("output_quantity", "1.0")).strip(),
            "output_unit": str(bom.get("output_unit", "")).strip(),
            "raw_materials": [
                {
                    "item_code": str(rm.get("item_code", "")).strip(),
                    "unit": str(rm.get("unit", "")).strip(),
                    "quantity": str(rm.get("quantity", "0")).strip(),
                    "category": str(rm.get("category", "")).strip()
                }
                for rm in bom.get("raw_materials", [])
            ],
            "overhead": [
                {
                    "ledger_name": str(ov.get("ledger_name", "")).strip(),
                    "amount": str(ov.get("amount", "0")).strip()
                }
                for ov in bom.get("overhead", [])
            ]
        }
        serialized = json.dumps(core, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    @classmethod
    def calculate_diff(
        cls, 
        old_boms: List[Dict[str, Any]], 
        new_boms: List[Dict[str, Any]],
        duration_seconds: float = 0.0,
        sync_time_str: str = ""
    ) -> Dict[str, Any]:
        """Compares previous BOM database against newly scraped BOM dataset."""
        old_map = {str(b.get("bom_no", "")).strip(): b for b in old_boms if b.get("bom_no")}
        new_map = {str(b.get("bom_no", "")).strip(): b for b in new_boms if b.get("bom_no")}

        old_keys = set(old_map.keys())
        new_keys = set(new_map.keys())

        added_keys = new_keys - old_keys
        deleted_keys = old_keys - new_keys
        common_keys = new_keys & old_keys

        added_list = []
        for k in sorted(added_keys):
            b = new_map[k]
            added_list.append({
                "bom_no": b.get("bom_no"),
                "product_name": b.get("product_name"),
                "item_code": b.get("item_code"),
                "section": b.get("section"),
                "raw_materials_count": len(b.get("raw_materials", []))
            })

        deleted_list = []
        for k in sorted(deleted_keys):
            b = old_map[k]
            deleted_list.append({
                "bom_no": b.get("bom_no"),
                "product_name": b.get("product_name"),
                "item_code": b.get("item_code"),
                "section": b.get("section")
            })

        updated_list = []
        unchanged_count = 0

        for k in sorted(common_keys):
            old_b = old_map[k]
            new_b = new_map[k]
            
            old_sig = cls._compute_bom_signature(old_b)
            new_sig = cls._compute_bom_signature(new_b)

            if old_sig != new_sig:
                # Detect specific changes
                old_rm_count = len(old_b.get("raw_materials", []))
                new_rm_count = len(new_b.get("raw_materials", []))
                changes = []
                if old_rm_count != new_rm_count:
                    changes.append(f"Raw materials count: {old_rm_count} → {new_rm_count}")
                if old_b.get("output_quantity") != new_b.get("output_quantity"):
                    changes.append(f"Output Qty: {old_b.get('output_quantity')} → {new_b.get('output_quantity')}")
                if old_b.get("product_name") != new_b.get("product_name"):
                    changes.append(f"Product Name updated")
                if not changes:
                    changes.append("Formula / Material specifications updated")

                updated_list.append({
                    "bom_no": new_b.get("bom_no"),
                    "product_name": new_b.get("product_name"),
                    "item_code": new_b.get("item_code"),
                    "section": new_b.get("section"),
                    "changes": changes
                })
            else:
                unchanged_count += 1

        return {
            "sync_time": sync_time_str,
            "duration_seconds": round(duration_seconds, 2),
            "total_boms": len(new_boms),
            "added_count": len(added_list),
            "updated_count": len(updated_list),
            "deleted_count": len(deleted_list),
            "unchanged_count": unchanged_count,
            "added": added_list,
            "updated": updated_list,
            "deleted": deleted_list,
            "status": "SUCCESS"
        }
