"""Import Neravu questionnaire rows into Supabase as unverified drafts.

Dry run: python import_neravu_csv.py "path/to/file.csv"
Write:   python import_neravu_csv.py "path/to/file.csv" --apply

Requires sqlalchemy, psycopg, python-dotenv. Reads SUPABASE_DATABASE_URL
from the project-root .env. Does not modify DATABASE_URL.
"""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / '.env')


def normalized(value):
    return (value or '').strip()


def load_rows(path):
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        columns = reader.fieldnames or []
        if len(columns) != 66 or columns[0] != 'Scheme/Fund' or len(set(columns)) != len(columns):
            raise ValueError('Expected 66 unique columns beginning with Scheme/Fund; inspect CSV headings.')
        rows = list(reader)
    return columns, rows


def programme_code(name):
    # Stable identifier across reruns; does not rely on nonunique numeric questionnaire IDs.
    return 'CSV-' + hashlib.sha256(name.casefold().encode('utf-8')).hexdigest()[:20].upper()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('csv_file', type=Path)
    parser.add_argument('--apply', action='store_true', help='Write drafts to Supabase')
    args = parser.parse_args()
    columns, rows = load_rows(args.csv_file)
    candidates = []
    print(f'CSV: {len(rows)} rows; {len(columns)} columns')
    for index, row in enumerate(rows, 2):
        name = normalized(row.get('Scheme/Fund'))
        filled_answers = sum(bool(normalized(row.get(c))) for c in columns[1:])
        if not name:
            print(f'Row {index}: SKIP — missing programme name')
        elif filled_answers < 10:
            print(f'Row {index}: SKIP — {name} ({filled_answers}/65 answers; incomplete)')
        else:
            code = programme_code(name)
            print(f'Row {index}: READY — {name} ({filled_answers}/65 answers; {code})')
            candidates.append((name, code, row))
    if not args.apply:
        print('DRY RUN ONLY: No database changes. Add --apply after reviewing.')
        return
    if not candidates:
        print('Nothing eligible for draft import.')
        return
    url = os.getenv('SUPABASE_DATABASE_URL')
    if not url:
        raise RuntimeError('SUPABASE_DATABASE_URL missing from environment')
    host = (make_url(url).host or '').lower()
    if not host.endswith('.supabase.com'):
        raise RuntimeError('Refusing to write: URL host is not Supabase')
    engine = create_engine(url, pool_pre_ping=True, connect_args={'connect_timeout': 10})
    try:
        with engine.begin() as conn:
            for name, code, row in candidates:
                exists = conn.execute(text('SELECT id FROM public.programmes WHERE programme_code = :code'), {'code': code}).scalar_one_or_none()
                if exists:
                    print(f'EXISTS: {name} — skipped (no overwrite)')
                    continue
                org_name = normalized(row.get('Which organization implements the programme?')) or 'Organization pending verification'
                org_id = conn.execute(text('SELECT id FROM public.organizations WHERE name = :name ORDER BY created_at LIMIT 1'), {'name': org_name}).scalar_one_or_none()
                if org_id is None:
                    org_id = conn.execute(text('''INSERT INTO public.organizations (name, organization_type)
                        VALUES (:name, 'unverified') RETURNING id'''), {'name': org_name}).scalar_one()
                details = {
                    'import_origin': 'Neravu 65-question CSV',
                    'import_review_note': 'Automated CSV import; NOT independently verified',
                    'questionnaire_answers': {c: normalized(row.get(c)) or None for c in columns[1:]},
                }
                official_name = normalized(row.get('What is the official programme name?')) or name
                ptype = normalized(row.get('What type of programme is it?')) or 'unknown'
                conn.execute(text('''INSERT INTO public.programmes
                    (programme_code, organization_id, official_name, programme_type, description, details, review_status)
                    VALUES (:code, :org_id, :official_name, :ptype, :description, CAST(:details AS jsonb), 'draft')'''), {
                        'code': code, 'org_id': org_id, 'official_name': official_name,
                        'ptype': ptype,
                        'description': normalized(row.get('Which expenses or services are eligible for support?')) or None,
                        'details': json.dumps(details, ensure_ascii=False),
                    })
                print(f'INSERTED DRAFT: {name}')
        print('Transaction committed. Review records in Supabase Table Editor.')
    finally:
        engine.dispose()


if __name__ == '__main__':
    main()
