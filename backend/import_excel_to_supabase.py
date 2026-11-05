"""Create tables and import all 6 sheets from Neravu_India_Cancer_Support_Directory.xlsx into Supabase."""

import sys
import openpyxl
from datetime import datetime, date
from sqlalchemy import text
from app.db.config import get_database_engine

sys.stdout.reconfigure(encoding="utf-8")

SCHEMA_SQL = """
-- 1. Directory Governance & Guidelines
CREATE TABLE IF NOT EXISTS public.directory_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. NGO & Charitable Organizations Directory
CREATE TABLE IF NOT EXISTS public.ngo_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_name TEXT NOT NULL,
    organization_type TEXT NOT NULL,
    state_coverage TEXT NOT NULL,
    city_district TEXT,
    support_type TEXT NOT NULL,
    what_support_offered TEXT,
    direct_financial_aid TEXT,
    aid_amount_limit TEXT,
    eligibility TEXT,
    hospital_restrictions TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    address TEXT,
    website_url TEXT,
    application_route TEXT,
    verification_status TEXT DEFAULT 'Unverified',
    last_checked DATE,
    source_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Government & Public Financial Assistance Schemes
CREATE TABLE IF NOT EXISTS public.government_schemes_directory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_name TEXT NOT NULL,
    government_level TEXT NOT NULL,
    state_coverage TEXT NOT NULL,
    benefit_type TEXT NOT NULL,
    published_benefit_limit TEXT,
    cancer_covered TEXT,
    eligibility_summary TEXT,
    documents_required TEXT,
    application_route TEXT,
    official_link TEXT,
    helpline_contact TEXT,
    verification_status TEXT DEFAULT 'Official government portal',
    last_checked DATE,
    source_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 28-State Research & Verification Tracker
CREATE TABLE IF NOT EXISTS public.state_research_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_name TEXT UNIQUE NOT NULL,
    local_ngo_records TEXT,
    known_national_ngo_coverage TEXT,
    state_government_scheme_lead TEXT,
    research_completeness TEXT,
    next_action_notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Official Evidence Source Register
CREATE TABLE IF NOT EXISTS public.source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_publisher TEXT NOT NULL,
    source_type TEXT NOT NULL,
    url TEXT NOT NULL,
    what_it_supports TEXT,
    checked_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Controlled Taxonomies / Dropdown Values
CREATE TABLE IF NOT EXISTS public.controlled_taxonomies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (category, value)
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.directory_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngo_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_schemes_directory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_research_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controlled_taxonomies ENABLE ROW LEVEL SECURITY;

-- Allow public read access (drop old policies if exist, then re-create)
DROP POLICY IF EXISTS "Allow public read access" ON public.directory_metadata;
CREATE POLICY "Allow public read access" ON public.directory_metadata FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.ngo_directory;
CREATE POLICY "Allow public read access" ON public.ngo_directory FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.government_schemes_directory;
CREATE POLICY "Allow public read access" ON public.government_schemes_directory FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.state_research_tracker;
CREATE POLICY "Allow public read access" ON public.state_research_tracker FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.source_registry;
CREATE POLICY "Allow public read access" ON public.source_registry FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON public.controlled_taxonomies;
CREATE POLICY "Allow public read access" ON public.controlled_taxonomies FOR SELECT USING (true);

NOTIFY pgrst, 'reload schema';
"""

def clean_val(val):
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.strftime("%Y-%m-%d")
    s = str(val).strip()
    return s if s != "" else None

def parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    try:
        return datetime.strptime(str(val).strip()[:10], "%Y-%m-%d").date()
    except Exception:
        return None

def main():
    engine = get_database_engine()
    print("1. Creating tables in Supabase PostgreSQL...")
    with engine.begin() as conn:
        for stmt in SCHEMA_SQL.split(";"):
            statement = stmt.strip()
            if statement:
                conn.execute(text(statement))
    print("Schema created successfully!")

    print("\n2. Loading Excel workbook: Neravu_India_Cancer_Support_Directory.xlsx ...")
    wb = openpyxl.load_workbook("Neravu_India_Cancer_Support_Directory.xlsx", data_only=True)

    with engine.begin() as conn:
        # Clear existing imported directory data for clean idempotent import
        conn.execute(text("TRUNCATE TABLE public.directory_metadata, public.ngo_directory, public.government_schemes_directory, public.state_research_tracker, public.source_registry, public.controlled_taxonomies CASCADE"))

        # Sheet 1: Read Me
        ws = wb["Read Me"]
        readme_rows = list(ws.iter_rows(values_only=True))
        readme_count = 0
        for r in readme_rows[2:]:
            k, v = clean_val(r[0]), clean_val(r[1])
            if k and v:
                conn.execute(text("""
                    INSERT INTO public.directory_metadata (key, value, category)
                    VALUES (:key, :value, 'guideline')
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
                """), {"key": k, "value": v})
                readme_count += 1
        print(f"-> Inserted {readme_count} records into directory_metadata.")

        # Sheet 2: NGO Directory
        ws = wb["NGO Directory"]
        ngo_rows = list(ws.iter_rows(values_only=True))
        ngo_count = 0
        for r in ngo_rows[4:]:
            name = clean_val(r[0])
            if not name:
                continue
            conn.execute(text("""
                INSERT INTO public.ngo_directory (
                    organization_name, organization_type, state_coverage, city_district,
                    support_type, what_support_offered, direct_financial_aid, aid_amount_limit,
                    eligibility, hospital_restrictions, contact_phone, contact_email,
                    address, website_url, application_route, verification_status,
                    last_checked, source_notes
                ) VALUES (
                    :org_name, :org_type, :state_cov, :city,
                    :supp_type, :what_offered, :direct_aid, :aid_limit,
                    :eligibility, :hosp_restr, :phone, :email,
                    :address, :website, :app_route, :ver_status,
                    :last_checked, :notes
                )
            """), {
                "org_name": name,
                "org_type": clean_val(r[1]) or "NGO",
                "state_cov": clean_val(r[2]) or "All India",
                "city": clean_val(r[3]),
                "supp_type": clean_val(r[4]) or "Patient Support",
                "what_offered": clean_val(r[5]),
                "direct_aid": clean_val(r[6]),
                "aid_limit": clean_val(r[7]),
                "eligibility": clean_val(r[8]),
                "hosp_restr": clean_val(r[9]),
                "phone": clean_val(r[10]),
                "email": clean_val(r[11]),
                "address": clean_val(r[12]),
                "website": clean_val(r[13]),
                "app_route": clean_val(r[14]),
                "ver_status": clean_val(r[15]) or "Official source checked",
                "last_checked": parse_date(r[16]),
                "notes": clean_val(r[17]),
            })
            ngo_count += 1
        print(f"-> Inserted {ngo_count} records into ngo_directory.")

        # Sheet 3: Government Schemes
        ws = wb["Government Schemes"]
        gov_rows = list(ws.iter_rows(values_only=True))
        gov_count = 0
        for r in gov_rows[4:]:
            scheme_name = clean_val(r[0])
            if not scheme_name:
                continue
            conn.execute(text("""
                INSERT INTO public.government_schemes_directory (
                    scheme_name, government_level, state_coverage, benefit_type,
                    published_benefit_limit, cancer_covered, eligibility_summary,
                    documents_required, application_route, official_link,
                    helpline_contact, verification_status, last_checked, source_notes
                ) VALUES (
                    :name, :gov_level, :state_cov, :benefit_type,
                    :benefit_limit, :cancer_cov, :eligibility,
                    :docs, :app_route, :link,
                    :helpline, :ver_status, :last_checked, :notes
                )
            """), {
                "name": scheme_name,
                "gov_level": clean_val(r[1]) or "Central",
                "state_cov": clean_val(r[2]) or "All India",
                "benefit_type": clean_val(r[3]) or "Medical Assistance",
                "benefit_limit": clean_val(r[4]),
                "cancer_cov": clean_val(r[5]),
                "eligibility": clean_val(r[6]),
                "docs": clean_val(r[7]),
                "app_route": clean_val(r[8]),
                "link": clean_val(r[9]),
                "helpline": clean_val(r[10]),
                "ver_status": clean_val(r[11]) or "Official government portal",
                "last_checked": parse_date(r[12]),
                "notes": clean_val(r[13]),
            })
            gov_count += 1
        print(f"-> Inserted {gov_count} records into government_schemes_directory.")

        # Sheet 4: State Tracker
        ws = wb["State Tracker"]
        state_rows = list(ws.iter_rows(values_only=True))
        state_count = 0
        for r in state_rows[4:]:
            state_name = clean_val(r[0])
            if not state_name:
                continue
            conn.execute(text("""
                INSERT INTO public.state_research_tracker (
                    state_name, local_ngo_records, known_national_ngo_coverage,
                    state_government_scheme_lead, research_completeness, next_action_notes
                ) VALUES (
                    :state, :local_ngo, :national_ngo,
                    :scheme_lead, :completeness, :notes
                )
                ON CONFLICT (state_name) DO UPDATE SET
                    local_ngo_records = EXCLUDED.local_ngo_records,
                    known_national_ngo_coverage = EXCLUDED.known_national_ngo_coverage,
                    state_government_scheme_lead = EXCLUDED.state_government_scheme_lead,
                    research_completeness = EXCLUDED.research_completeness,
                    next_action_notes = EXCLUDED.next_action_notes,
                    updated_at = now()
            """), {
                "state": state_name,
                "local_ngo": clean_val(r[1]),
                "national_ngo": clean_val(r[2]),
                "scheme_lead": clean_val(r[3]),
                "completeness": clean_val(r[4]),
                "notes": clean_val(r[5]),
            })
            state_count += 1
        print(f"-> Inserted {state_count} records into state_research_tracker.")

        # Sheet 5: Source Register
        ws = wb["Source Register"]
        src_rows = list(ws.iter_rows(values_only=True))
        src_count = 0
        for r in src_rows[4:]:
            pub = clean_val(r[0])
            if not pub:
                continue
            conn.execute(text("""
                INSERT INTO public.source_registry (
                    source_publisher, source_type, url, what_it_supports, checked_date, notes
                ) VALUES (
                    :pub, :stype, :url, :supports, :cdate, :notes
                )
            """), {
                "pub": pub,
                "stype": clean_val(r[1]) or "Official portal",
                "url": clean_val(r[2]) or "",
                "supports": clean_val(r[3]),
                "cdate": parse_date(r[4]),
                "notes": clean_val(r[5]),
            })
            src_count += 1
        print(f"-> Inserted {src_count} records into source_registry.")

        # Sheet 6: Dropdown Values
        ws = wb["Dropdown Values"]
        dd_rows = list(ws.iter_rows(values_only=True))
        headers = [clean_val(c) for c in dd_rows[3] if clean_val(c)]
        dd_count = 0
        for r in dd_rows[4:]:
            for i, cat in enumerate(headers):
                if i < len(r):
                    val = clean_val(r[i])
                    if val:
                        conn.execute(text("""
                            INSERT INTO public.controlled_taxonomies (category, value)
                            VALUES (:cat, :val)
                            ON CONFLICT (category, value) DO NOTHING
                        """), {"cat": cat, "val": val})
                        dd_count += 1
        print(f"-> Inserted {dd_count} values into controlled_taxonomies.")

    print("\n>>> ALL 6 SHEETS SUCCESSFULLY IMPORTED INTO SUPABASE! <<<")

if __name__ == "__main__":
    main()

