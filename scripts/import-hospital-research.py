import argparse
import json
import re
import unicodedata
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "backend" / "app" / "data" / "hospitalResearch.json"

HOSPITAL_COLUMNS = {
    "Programme / NGO": "programme",
    "Hospital / Network": "hospitalOrNetwork",
    "City / State": "cityState",
    "Relationship evidence": "relationshipEvidence",
    "Assistance type / indicative cap": "assistanceType",
    "Patient eligibility / conditions": "eligibilityConditions",
    "How hospital facilitates access": "hospitalAccessSteps",
    "Evidence confidence": "evidenceConfidence",
    "Primary source URL": "primarySourceUrl",
    "Important caveat / next verification": "caveat",
}

RULE_COLUMNS = {
    "Programme": "programme",
    "Programme type": "programmeType",
    "Published benefit / amount": "publishedBenefit",
    "Hospital access rule": "hospitalAccessRule",
    "Who helps patient apply": "whoHelpsApply",
    "Critical caution": "criticalCaution",
    "Official source": "officialSource",
}


def programme_keys(value):
    normalized = unicodedata.normalize("NFKD", str(value or "").casefold())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    key = re.sub(r"[^a-z0-9]+", " ", normalized).strip()

    if "indian cancer society" in key and "cancer cure" in key:
        return ["ics-cancer-cure"]
    if "cuddles" in key:
        return ["cuddles-foundation"]
    if "cankids" in key:
        return ["cankids"]
    if "st jude" in key:
        return ["st-jude"]
    if "pm jay" in key or "ab pmjay" in key:
        return ["pmjay"]
    if "ntr vaidya seva" in key:
        return ["ntr-vaidya-seva"]
    if "hmcpf" in key or re.search(r"\bran\b", key):
        return ["hmcpf"]
    if "tata trusts" in key or "tata trust medical" in key:
        return ["tata-trusts"]
    if "cpaa" in key or "cancer patients aid association" in key:
        return ["cpaa"]
    if "cansupport" in key:
        return ["cansupport"]
    if "pallium" in key:
        return ["pallium-india"]
    if "dhanvantari" in key:
        return ["dhanvantari-cancer-foundation"]
    if "bengal cancer foundation" in key and ("kdfcc" in key or "kalpana datta" in key):
        return [
            "bengal-cancer-foundation",
            "kdfcc",
            "garia-welfare-society",
            "hitaishini",
        ]
    if "kamlesh cancer foundation" in key and ("ganga prem" in key or "him samvad" in key):
        return [
            "kamlesh-cancer-foundation",
            "ganga-prem-hospice",
            "can-protect-foundation",
            "him-samvad",
        ]
    if "bengal cancer foundation" in key:
        return ["bengal-cancer-foundation"]
    if "kalpana datta" in key or "kdfcc" in key:
        return ["kdfcc"]
    if "garia welfare society" in key:
        return ["garia-welfare-society"]
    if "hitaishini" in key:
        return ["hitaishini"]
    if "kamlesh cancer foundation" in key:
        return ["kamlesh-cancer-foundation"]
    if "ganga prem" in key:
        return ["ganga-prem-hospice"]
    if "can protect" in key:
        return ["can-protect-foundation"]
    if "him samvad" in key:
        return ["him-samvad"]
    if "delhi arogya kosh" in key:
        return ["delhi-arogya-kosh"]
    if "hmdg" in key or ("health minister" in key and "discretionary" in key):
        return ["hmdg"]
    if "pmnrf" in key or ("prime minister" in key and "national relief" in key):
        return ["pmnrf"]
    if "cghs" in key or "central government health scheme" in key:
        return ["cghs"]
    return []


def read_records(sheet, columns):
    rows = sheet.iter_rows(values_only=True)
    headers = [str(value).strip() if value is not None else "" for value in next(rows)]
    missing = set(columns) - set(headers)
    if missing:
        raise ValueError(f"{sheet.title} is missing required columns: {', '.join(sorted(missing))}")

    records = []
    for row_number, row in enumerate(rows, start=2):
        values = dict(zip(headers, row))
        if not any(value is not None and str(value).strip() for value in values.values()):
            continue
        record = {
            target: str(values[source]).strip()
            for source, target in columns.items()
            if values.get(source) is not None and str(values[source]).strip()
        }
        record["sourceSheet"] = sheet.title
        record["sourceRow"] = row_number
        record["programmeKeys"] = programme_keys(record["programme"])
        records.append(record)
    return records


def main():
    parser = argparse.ArgumentParser(
        description="Import hospital and programme access research from the supplied workbook."
    )
    parser.add_argument("--workbook", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    if not args.workbook.is_file():
        parser.error(f"Workbook does not exist: {args.workbook}")

    workbook = load_workbook(args.workbook, read_only=True, data_only=True)
    try:
        required_sheets = {"Hospital Mapping", "Programme Rules"}
        missing_sheets = required_sheets - set(workbook.sheetnames)
        if missing_sheets:
            raise ValueError(f"Workbook is missing sheets: {', '.join(sorted(missing_sheets))}")
        hospital_mappings = read_records(workbook["Hospital Mapping"], HOSPITAL_COLUMNS)
        programme_rules = read_records(workbook["Programme Rules"], RULE_COLUMNS)
    finally:
        workbook.close()

    if not hospital_mappings or not programme_rules:
        raise ValueError("Workbook hospital mappings and programme rules must not be empty.")
    if any(not record["programmeKeys"] for record in hospital_mappings + programme_rules):
        unmatched = sorted({
            record["programme"]
            for record in hospital_mappings + programme_rules
            if not record["programmeKeys"]
        })
        raise ValueError(f"Unmapped programme names: {', '.join(unmatched)}")

    data = {
        "sourceWorkbook": args.workbook.name,
        "hospitalMappings": hospital_mappings,
        "programmeRules": programme_rules,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {len(hospital_mappings)} hospital mappings and "
        f"{len(programme_rules)} programme access rules to {args.output}"
    )


if __name__ == "__main__":
    main()
