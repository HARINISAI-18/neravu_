import argparse
import json
import re
import unicodedata
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook


def text_key(value):
    normalized = unicodedata.normalize("NFKD", str(value or "").casefold())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def programme_id(name):
    key = text_key(name)
    if "cancer cure" in key and ("indian cancer society" in key or "ics" in key):
        return "ics-cancer-cure"
    if "central government health scheme" in key or key == "cghs":
        return "cghs"
    if "pmjay" in key or "pm jay" in key or "jan arogya" in key:
        return "pmjay"
    if "health minister" in key and "cancer patient fund" in key or "hmcpf" in key:
        return "hmcpf"
    if "health minister" in key and "discretionary" in key or "hmdg" in key:
        return "hmdg"
    if "prime minister" in key and "national relief" in key or "pmnrf" in key:
        return "pmnrf"
    if "delhi arogya kosh" in key:
        return "delhi-arogya-kosh"
    if "aas" in key and ("aggarwal" in key or "cancer care" in key):
        return "aas"
    if "youwecan" in key:
        return "youwecan"
    if "cankids" in key:
        return "cankids"
    if "tata trusts" in key:
        return "tata-trusts"
    if "cancer patients aid association" in key or key == "cpaa":
        return "cpaa"
    if "indian cancer society" in key or key == "ics":
        return "ics-parent"
    if "west bengal chief minister" in key or "wbcmrf" in key:
        return "wb-cmrf"
    if "swasthya sathi" in key:
        return "swasthya-sathi"
    if "uttarakhand chief minister" in key:
        return "uttarakhand-cmrf"
    if "atal ayushman" in key:
        return "atal-ayushman-uttarakhand"
    if "governor welfare fund" in key:
        return "wb-governor-welfare"
    if "treatment for major ailments" in key:
        return "major-ailments"
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", key).strip("-")) or "unknown"


def serializable(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def table_records(sheet, header_row, first_data_row):
    rows = list(sheet.iter_rows(values_only=True))
    headers = [str(value).strip() if value is not None else "" for value in rows[header_row - 1]]
    records = []
    for row in rows[first_data_row - 1:]:
        if not any(value is not None for value in row):
            continue
        record = {
            headers[index]: serializable(value)
            for index, value in enumerate(row)
            if index < len(headers) and headers[index] and value is not None
        }
        if record:
            records.append(record)
    return records


def localized_table_records(source_sheet, translated_sheet, header_row, first_data_row):
    source_records = table_records(source_sheet, header_row, first_data_row)
    source_rows = list(source_sheet.iter_rows(values_only=True))
    translated_rows = list(translated_sheet.iter_rows(values_only=True))
    translated_headers = [
        str(value).strip() if value is not None else ""
        for value in next(translated_sheet.iter_rows(min_row=header_row, max_row=header_row, values_only=True))
    ]
    translated_records = table_records(translated_sheet, header_row, first_data_row)
    if len(source_records) != len(translated_records):
        raise ValueError(
            f"Translated sheet {translated_sheet.title!r} has {len(translated_records)} data rows; "
            f"expected {len(source_records)} from {source_sheet.title!r}."
        )
    source_headers = [
        str(value).strip() if value is not None else ""
        for value in next(source_sheet.iter_rows(min_row=header_row, max_row=header_row, values_only=True))
    ]
    if len(source_headers) != len(translated_headers):
        raise ValueError(f"Translated sheet {translated_sheet.title!r} has a different number of columns.")
    records = []
    for row_index in range(first_data_row - 1, max(len(source_rows), len(translated_rows))):
        source_row = source_rows[row_index] if row_index < len(source_rows) else ()
        translated_row = translated_rows[row_index] if row_index < len(translated_rows) else ()
        source_has_values = any(value is not None for value in source_row)
        translated_has_values = any(value is not None for value in translated_row)
        if source_has_values != translated_has_values:
            raise ValueError(
                f"Translated sheet {translated_sheet.title!r} does not match the source row layout "
                f"at row {row_index + 1}."
            )
        if not source_has_values:
            continue
        translated_values = {
            source_headers[column].strip(): serializable(value.strip() if isinstance(value, str) else value)
            for column, value in enumerate(translated_row)
            if column < len(source_headers) and source_headers[column] and value is not None
        }
        source_values = {
            source_headers[column].strip(): serializable(value)
            for column, value in enumerate(source_row)
            if column < len(source_headers) and source_headers[column] and value is not None
        }
        if not source_values:
            if translated_values:
                raise ValueError(
                    f"Translated sheet {translated_sheet.title!r} has data without matching source fields "
                    f"at row {row_index + 1}."
                )
            continue
        if not translated_values:
            raise ValueError(
                f"Translated row {row_index + 1} is empty in {translated_sheet.title!r}."
            )
        records.append(translated_values)
    if len(records) != len(source_records):
        raise ValueError(
            f"Translated sheet {translated_sheet.title!r} has {len(records)} aligned rows; "
            f"expected {len(source_records)} from {source_sheet.title!r}."
        )
    return records, translated_headers


def add_records(index, records, name_field, target_field, only_existing=False):
    for record in records:
        name = record.get(name_field, "")
        if not name:
            continue
        identifier = programme_id(name)
        if only_existing and identifier not in index:
            continue
        entry = index.setdefault(identifier, {"id": identifier, "aliases": []})
        if name not in entry["aliases"]:
            entry["aliases"].append(name)
        entry.setdefault(target_field, []).append(record)


def collect_urls(value):
    urls = []
    seen = set()

    def visit(item):
        if isinstance(item, dict):
            for nested in item.values():
                visit(nested)
        elif isinstance(item, list):
            for nested in item:
                visit(nested)
        elif isinstance(item, str):
            for match in re.findall(r"https?://[^\s<>|]+", item):
                url = match.rstrip(".,;:!?)\"]}")
                if url not in seen:
                    seen.add(url)
                    urls.append(url)

    visit(value)
    return urls


def add_localized_rows(
    scheme_translations,
    source_records,
    translated_records,
    name_field,
    target_field,
):
    if len(source_records) != len(translated_records):
        raise ValueError(f"Row count mismatch for translated catalogue field {target_field!r}.")
    for source_record, translated_record in zip(source_records, translated_records):
        identifier = programme_id(source_record.get(name_field, ""))
        if not identifier or identifier not in scheme_translations:
            continue
        scheme_translations[identifier][target_field].append(translated_record)


def main():
    parser = argparse.ArgumentParser(
        description="Build the offline scheme guidance catalogue from Neravu Excel workbooks."
    )
    parser.add_argument("--journeys", required=True, type=Path, help="Workbook with journeys and scheme research")
    parser.add_argument("--directory", required=True, type=Path, help="Workbook with schemes and support directory")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "src" / "platform" / "schemeGuidance",
        help="Output directory for per-programme JSON files",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "src" / "platform" / "schemeCatalog.json",
        help="Output path for the compact scheme-card index",
    )
    parser.add_argument(
        "--locale",
        action="append",
        default=[],
        metavar="CODE=PATH",
        help="Translated workbook for a supported locale; repeat for mr, bn, kn, hi, te, ur, pa",
    )
    args = parser.parse_args()

    locale_paths = {}
    supported_locales = {"mr", "bn", "kn", "hi", "te", "ur", "pa"}
    for value in args.locale:
        locale, separator, path = value.partition("=")
        if not separator or locale not in supported_locales or locale in locale_paths:
            parser.error(f"Invalid or duplicate --locale {value!r}; use a supported code=path pair.")
        locale_path = Path(path)
        if not locale_path.is_file():
            parser.error(f"Translated workbook does not exist: {locale_path}")
        locale_paths[locale] = locale_path

    journeys = load_workbook(args.journeys, read_only=True, data_only=True)
    directory = load_workbook(args.directory, read_only=True, data_only=True)
    translated_workbooks = {
        locale: load_workbook(path, read_only=True, data_only=True)
        for locale, path in locale_paths.items()
    }
    try:
        journey_summary = table_records(journeys["Journey Summary"], 4, 5)
        application_journeys = table_records(journeys["Application Journey"], 4, 5)
        patient_checklist = table_records(journeys["Patient Document Checklist"], 4, 5)
        research_records = table_records(journeys["Sheet2"], 1, 2)
        legacy_records = table_records(journeys["Sheet1"], 1, 2)
        verifications = table_records(journeys["Source Verification"], 1, 2)
        research_audit = [
            record
            for record in table_records(journeys["Research Audit"], 1, 2)
            if isinstance(record.get("Total question columns"), (int, float))
        ]
        read_me_rows = sum(
            1
            for row in directory["Read Me"].iter_rows(values_only=True)
            if any(value is not None for value in row)
        )
        government_records = table_records(directory["Government Schemes"], 4, 5)
        ngo_records = table_records(directory["NGO Directory"], 4, 5)
        state_records = table_records(directory["State Tracker"], 4, 5)
        source_records = table_records(directory["Source Register"], 4, 5)
        dropdown_records = table_records(directory["Dropdown Values"], 4, 5)

        schemes = {}
        add_records(schemes, journey_summary, "Programme", "journeySummary")
        add_records(schemes, research_records, "Scheme/Fund", "researchRecords")
        add_records(schemes, government_records, "Scheme Name", "governmentRecords")
        add_records(schemes, legacy_records, "Name of the insurance", "legacyRecords", only_existing=True)
        add_records(schemes, verifications, "Programme / organization", "sourceVerifications", only_existing=True)
        add_records(schemes, research_audit, "Programme", "researchAudits", only_existing=True)

        for step in application_journeys:
            identifier = programme_id(step.get("Programme", ""))
            entry = schemes.setdefault(identifier, {"id": identifier, "aliases": []})
            name = step.get("Programme", "")
            if name and name not in entry["aliases"]:
                entry["aliases"].append(name)
            entry.setdefault("applicationSteps", []).append(step)

        for organization in ngo_records:
            identifier = programme_id(organization.get("Organisation Name", ""))
            if identifier in schemes:
                schemes[identifier].setdefault("relatedOrganizations", []).append(organization)

        localized_checklists = {}
        for locale, workbook in translated_workbooks.items():
            if len(workbook.worksheets) != len(journeys.worksheets):
                raise ValueError(f"Translated workbook for {locale} has a different number of sheets.")
            for index, source_sheet in enumerate(journeys.worksheets):
                translated_sheet = workbook.worksheets[index]
                source_rows = sum(any(value is not None for value in row) for row in source_sheet.iter_rows(values_only=True))
                translated_rows = sum(any(value is not None for value in row) for row in translated_sheet.iter_rows(values_only=True))
                if source_rows != translated_rows:
                    raise ValueError(
                        f"Translated {locale} sheet {translated_sheet.title!r} has {translated_rows} "
                        f"populated rows; expected {source_rows}."
                    )

            def localized_rows(sheet_name, header_row, first_data_row):
                source_sheet = journeys[sheet_name]
                translated_sheet = workbook.worksheets[journeys.sheetnames.index(sheet_name)]
                return localized_table_records(source_sheet, translated_sheet, header_row, first_data_row)

            translated_summary, summary_headers = localized_rows("Journey Summary", 4, 5)
            translated_steps, step_headers = localized_rows("Application Journey", 4, 5)
            translated_checklist, checklist_headers = localized_rows("Patient Document Checklist", 4, 5)
            translated_research, research_headers = localized_rows("Sheet2", 1, 2)
            translated_legacy, legacy_headers = localized_rows("Sheet1", 1, 2)
            translated_verifications, verification_headers = localized_rows("Source Verification", 1, 2)
            all_translated_audits, audit_headers = localized_rows("Research Audit", 1, 2)
            translated_audits = [
                record
                for record in all_translated_audits
                if isinstance(record.get("Total question columns"), (int, float))
            ]
            localized_checklists[locale] = translated_checklist

            locale_schemes = {
                identifier: {
                    "journeySummary": [],
                    "applicationSteps": [],
                    "researchRecords": [],
                    "legacyRecords": [],
                    "sourceVerifications": [],
                    "researchAudits": [],
                    "labels": {
                        "summary": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Journey Summary"].iter_rows(min_row=4, max_row=4, values_only=True))],
                            summary_headers,
                        )),
                        "applicationSteps": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Application Journey"].iter_rows(min_row=4, max_row=4, values_only=True))],
                            step_headers,
                        )),
                        "patientChecklist": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Patient Document Checklist"].iter_rows(min_row=4, max_row=4, values_only=True))],
                            checklist_headers,
                        )),
                        "researchDetails": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Sheet2"].iter_rows(min_row=1, max_row=1, values_only=True))],
                            research_headers,
                        )),
                        "legacyRecords": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Sheet1"].iter_rows(min_row=1, max_row=1, values_only=True))],
                            legacy_headers,
                        )),
                        "sourceVerifications": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Source Verification"].iter_rows(min_row=1, max_row=1, values_only=True))],
                            verification_headers,
                        )),
                        "researchAudits": dict(zip(
                            [str(value).strip() if value is not None else "" for value in next(journeys["Research Audit"].iter_rows(min_row=1, max_row=1, values_only=True))],
                            audit_headers,
                        )),
                    },
                }
                for identifier in schemes
            }
            add_localized_rows(locale_schemes, journey_summary, translated_summary, "Programme", "journeySummary")
            add_localized_rows(locale_schemes, application_journeys, translated_steps, "Programme", "applicationSteps")
            add_localized_rows(locale_schemes, research_records, translated_research, "Scheme/Fund", "researchRecords")
            add_localized_rows(locale_schemes, legacy_records, translated_legacy, "Name of the insurance", "legacyRecords")
            add_localized_rows(
                locale_schemes,
                verifications,
                translated_verifications,
                "Programme / organization",
                "sourceVerifications",
            )
            add_localized_rows(locale_schemes, research_audit, translated_audits, "Programme", "researchAudits")

            research_column_names = [
                str(value).strip() if value is not None else ""
                for value in next(journeys["Sheet2"].iter_rows(min_row=1, max_row=1, values_only=True))
            ]
            for identifier, localized in locale_schemes.items():
                localized_research = (localized.pop("researchRecords") or [{}])[0]
                localized_summary = (localized["journeySummary"] or [{}])[0]
                localized["name"] = localized_summary.get("Programme") or localized_research.get("Scheme/Fund")
                localized["programmeType"] = (
                    localized_summary.get("Programme Type")
                    or localized_research.get("What type of programme is it?")
                    or ""
                )
                localized["researchDetails"] = [
                    {
                        "question": question,
                        "localizedQuestion": research_headers[index] if index < len(research_headers) else question,
                        "answer": answer,
                    }
                    for index, question in enumerate(research_column_names)
                    for answer in [localized_research.get(question)]
                    if question and question != "Scheme/Fund"
                    and answer is not None
                ]
                schemes[identifier].setdefault("translations", {})[locale] = localized

        for scheme in schemes.values():
            summary = (scheme.get("journeySummary") or [{}])[0]
            research = (scheme.get("researchRecords") or [{}])[0]
            government = (scheme.get("governmentRecords") or [{}])[0]
            scheme["name"] = (
                summary.get("Programme")
                or government.get("Scheme Name")
                or research.get("Scheme/Fund")
                or scheme["aliases"][0]
            )
            questions = [
                {"question": question, "answer": answer}
                for question, answer in research.items()
                if question != "Scheme/Fund"
            ]
            scheme["researchDetails"] = questions
            scheme["programmeType"] = (
                summary.get("Programme Type")
                or government.get("Benefit Type")
                or next(
                    (
                        item["answer"]
                        for item in questions
                        if item["question"] == "What type of programme is it?"
                    ),
                    "",
                )
            )
            scheme["officialLinks"] = collect_urls(scheme)

        counts = {
            "applicationJourneys": len(application_journeys),
            "journeyProgrammes": len(journey_summary),
            "governmentDirectoryEntries": len(government_records),
            "researchProgrammes": len(research_records),
            "schemes": len(schemes),
        }
        source_sheet_counts = {
            "schemeJourneys": {
                "Journey Summary": len(journey_summary),
                "Application Journey": len(application_journeys),
                "Patient Document Checklist": len(patient_checklist),
                "Sheet2": len(research_records),
                "Sheet1": len(legacy_records),
                "Source Verification": len(verifications),
                "Research Audit": len(research_audit),
            },
            "supportDirectory": {
                "Read Me": read_me_rows,
                "NGO Directory": len(ngo_records),
                "Government Schemes": len(government_records),
                "State Tracker": len(state_records),
                "Source Register": len(source_records),
                "Dropdown Values": len(dropdown_records),
            },
        }
        state_scheme_coverage = {
            "delhi-arogya-kosh": "Delhi",
            "wb-cmrf": "West Bengal",
            "swasthya-sathi": "West Bengal",
            "uttarakhand-cmrf": "Uttarakhand",
            "atal-ayushman-uttarakhand": "Uttarakhand",
            "wb-governor-welfare": "West Bengal",
        }
        catalog = {
            "formatVersion": 1,
            "sourceWorkbooks": [args.journeys.name, args.directory.name],
            "sourceSnapshot": "2026-11",
            "counts": counts,
            "sourceSheetCounts": source_sheet_counts,
            "ngoDirectory": ngo_records,
            "stateTracker": state_records,
            "patientDocumentChecklist": patient_checklist,
            "patientDocumentChecklistByLanguage": localized_checklists,
            "schemes": [
                {
                    "id": scheme["id"],
                    "name": scheme["name"],
                    "aliases": scheme["aliases"],
                    "programmeType": scheme["programmeType"],
                    "description": (
                        (scheme.get("journeySummary") or [{}])[0].get("Who May Apply / Eligibility Snapshot")
                        or (scheme.get("governmentRecords") or [{}])[0].get("Eligibility Summary")
                        or ""
                    ),
                    "eligibilitySummary": (
                        (scheme.get("journeySummary") or [{}])[0].get("Who May Apply / Eligibility Snapshot")
                        or (scheme.get("governmentRecords") or [{}])[0].get("Eligibility Summary")
                        or ""
                    ),
                    "documentsToPrepare": (
                        (scheme.get("journeySummary") or [{}])[0].get("Documents to Prepare")
                        or (scheme.get("governmentRecords") or [{}])[0].get("Documents Commonly Required")
                        or ""
                    ),
                    "stateCoverage": (
                        (scheme.get("governmentRecords") or [{}])[0].get("State / UT Coverage")
                        or state_scheme_coverage.get(scheme["id"], "")
                    ),
                    "governmentLevel": (
                        (scheme.get("governmentRecords") or [{}])[0].get("Government Level")
                        or ("State" if scheme["id"] in state_scheme_coverage else "")
                    ),
                    "officialLinks": scheme["officialLinks"],
                    "applicationStepCount": len(scheme.get("applicationSteps", [])),
                    "verificationStatus": (
                        (scheme.get("sourceVerifications") or [{}])[0].get("Verification status")
                        or (scheme.get("governmentRecords") or [{}])[0].get("Verification Status")
                        or ""
                    ),
                    "translations": {
                        locale: {
                            "name": scheme.get("translations", {}).get(locale, {}).get("name") or scheme["name"],
                            "programmeType": scheme.get("translations", {}).get(locale, {}).get("programmeType") or scheme["programmeType"],
                            "description": (scheme.get("translations", {}).get(locale, {}).get("journeySummary") or [{}])[0].get("Who May Apply / Eligibility Snapshot", ""),
                        }
                        for locale in locale_paths
                    },
                }
                for scheme in schemes.values()
            ],
        }
    finally:
        for workbook in translated_workbooks.values():
            workbook.close()
        journeys.close()
        directory.close()

    args.output.mkdir(parents=True, exist_ok=True)
    for scheme in schemes.values():
        target = args.output / f"{scheme['id']}.json"
        target.write_text(json.dumps(scheme, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    args.catalog.parent.mkdir(parents=True, exist_ok=True)
    args.catalog.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(schemes)} programme files, {len(application_journeys)} steps, and the index to {args.catalog}")


if __name__ == "__main__":
    main()
