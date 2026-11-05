"""Seed official sources, evidence claims, rules, and documents for Neravu schemes,
and run the publication and sync worker pipeline.
"""

import json
from datetime import date, datetime, timezone
from uuid import UUID

from sqlalchemy import text
from app.db.config import get_database_engine
from app.workers.sync_worker import process_one_job


def seed_and_publish():
    engine = get_database_engine()
    admin_id = "00000000-0000-0000-0000-000000000001"
    today = date.today()
    expiry = date(2028, 12, 31)

    print("Connecting to database...")
    with engine.begin() as conn:
        # 1. PM-JAY Scheme
        pmjay_id = conn.execute(
            text("SELECT id FROM public.programmes WHERE programme_code = 'CSV-F64FDF5C58ACCF8E2112'")
        ).scalar()
        if not pmjay_id:
            raise RuntimeError("PM-JAY programme record not found")
        pmjay_uuid = str(pmjay_id)

        # Clear any existing draft sources/claims for PM-JAY to ensure clean idempotent seed
        conn.execute(text("DELETE FROM public.published_knowledge_chunks WHERE programme_id = :p"), {"p": pmjay_uuid})
        conn.execute(text("DELETE FROM public.scheme_sync_jobs WHERE programme_id = :p"), {"p": pmjay_uuid})
        conn.execute(text("DELETE FROM public.scheme_publication_versions WHERE programme_id = :p"), {"p": pmjay_uuid})
        conn.execute(text("DELETE FROM public.scheme_evidence_claims WHERE programme_id = :p"), {"p": pmjay_uuid})
        conn.execute(text("DELETE FROM public.eligibility_rules WHERE programme_id = :p"), {"p": pmjay_uuid})
        conn.execute(text("DELETE FROM public.document_requirements WHERE programme_id = :p"), {"p": pmjay_uuid})
        conn.execute(text("DELETE FROM public.programme_sources WHERE programme_id = :p"), {"p": pmjay_uuid})

        # Insert Sources
        s1 = conn.execute(text("""
            INSERT INTO public.programme_sources (
                programme_id, source_title, source_url, issuing_body, page_reference,
                effective_date, evidence_status, reviewed_by, reviewed_at, review_expires_at, verified_at
            ) VALUES (
                :pid, 'NHA FAQs on PM-JAY Benefits for Senior Citizens (70+)',
                'https://nha.gov.in/img/resources/English_FAQs_related_to_the_benefits_for_senior_citizens.pdf',
                'National Health Authority, Ministry of Health and Family Welfare',
                'FAQs 1-18: Age 70+ universal eligibility and senior top-up cover',
                '2024-10-29', 'approved', :admin, now(), :exp, now()
            ) RETURNING id
        """), {"pid": pmjay_uuid, "admin": admin_id, "exp": expiry}).scalar()

        s2 = conn.execute(text("""
            INSERT INTO public.programme_sources (
                programme_id, source_title, source_url, issuing_body, page_reference,
                effective_date, evidence_status, reviewed_by, reviewed_at, review_expires_at, verified_at
            ) VALUES (
                :pid, 'National Health Authority - Ayushman Bharat PM-JAY Guidelines',
                'https://pmjay.gov.in',
                'National Health Authority, Government of India',
                'Benefit Cover: Cashless INR 5,00,000 per family per year in empanelled hospitals',
                '2018-09-23', 'approved', :admin, now(), :exp, now()
            ) RETURNING id
        """), {"pid": pmjay_uuid, "admin": admin_id, "exp": expiry}).scalar()

        s3 = conn.execute(text("""
            INSERT INTO public.programme_sources (
                programme_id, source_title, source_url, issuing_body, page_reference,
                effective_date, evidence_status, reviewed_by, reviewed_at, review_expires_at, verified_at
            ) VALUES (
                :pid, 'NHA Beneficiary Enrollment & Document Policy',
                'https://beneficiary.nha.gov.in',
                'National Health Authority, Government of India',
                'Document Requirements: Aadhaar e-KYC for 70+; Ration Card for SECC families; No bank details required',
                '2024-10-29', 'approved', :admin, now(), :exp, now()
            ) RETURNING id
        """), {"pid": pmjay_uuid, "admin": admin_id, "exp": expiry}).scalar()

        # Insert Evidence Claims
        conn.execute(text("""
            INSERT INTO public.scheme_evidence_claims (
                programme_id, source_id, field_path, claim_text, structured_value,
                source_locator, is_critical, review_status, created_by, reviewed_by, reviewed_at
            ) VALUES
            (
                :pid, :s2, 'coverage.financial_limit',
                'Ayushman Bharat PM-JAY provides health assurance cover of up to INR 500,000 (5 Lakh) per eligible family per year for secondary and tertiary care hospitalization across empanelled public and private hospitals across India. For senior citizens aged 70 or older, an additional distinct annual top-up of INR 500,000 is provided exclusively for the seniors in the family.',
                CAST(:val1 AS jsonb), 'NHA Benefit Guidelines & Senior Citizen FAQ 1', true, 'approved', :admin, :admin, now()
            ),
            (
                :pid, :s1, 'eligibility.age_criteria',
                'All Indian citizens aged 70 or older are eligible for PM-JAY under the universal senior citizen expansion (Ayushman Vay Vandana card), regardless of household socioeconomic status or income. The age criterion applies to individual members aged 70 or above verified through Aadhaar e-KYC. This is an age threshold of 70 years, not a household size of 70 members.',
                CAST(:val2 AS jsonb), 'NHA Senior Citizen FAQ 1, 3, 5', true, 'approved', :admin, :admin, now()
            ),
            (
                :pid, :s2, 'coverage.cancer_treatment_scope',
                'PM-JAY covers approved cancer care including surgical oncology, medical oncology (chemotherapy), radiation oncology, and palliative care packages when preauthorized at empanelled healthcare providers. Cancer treatment is completely cashless within approved package tariffs with no out-of-pocket payment required.',
                CAST(:val3 AS jsonb), 'PM-JAY Health Benefit Packages Oncology Section', true, 'approved', :admin, :admin, now()
            ),
            (
                :pid, :s3, 'documents.required_documents',
                'For individuals aged 70 or older applying via the universal senior expansion, an Aadhaar card with biometric or OTP e-KYC is the sole mandatory document. For standard SECC beneficiaries, an approved family identity proof (such as a Ration Card or family ID) along with a government photo ID is required. Bank account documents, bank passbooks, and cancelled cheques are never required to enroll or receive cashless treatment.',
                CAST(:val4 AS jsonb), 'NHA Beneficiary Enrollment & FAQ 14', true, 'approved', :admin, :admin, now()
            ),
            (
                :pid, :s2, 'application.workflow_steps',
                'Step 1: Verify beneficiary entitlement online at beneficiary.nha.gov.in or at an empanelled hospital helpdesk. Step 2: Complete e-KYC using Aadhaar to generate the Ayushman card. Step 3: Present the card at an empanelled hospital PM-JAY Arogya Mitra (PMAM) desk. Step 4: The treating oncologist submits clinical diagnosis and treatment package preauthorization. Step 5: Receive cashless cancer treatment upon preauthorization approval. Step 6: Post-discharge follow-up care and medicines are covered up to 15 days.',
                CAST(:val5 AS jsonb), 'PM-JAY Hospital Workflow Guide', true, 'approved', :admin, :admin, now()
            )
        """), {
            "pid": pmjay_uuid, "s1": str(s1), "s2": str(s2), "s3": str(s3), "admin": admin_id,
            "val1": json.dumps({"family_annual_limit_inr": 500000, "senior_70plus_topup_inr": 500000, "cashless": True}),
            "val2": json.dumps({"min_age_years": 70, "universal_senior_route": True}),
            "val3": json.dumps({"modalities": ["surgical_oncology", "medical_oncology", "radiation_oncology", "palliative_care"]}),
            "val4": json.dumps({"senior_mandatory_document": "Aadhaar Card", "banking_documents_required": False}),
            "val5": json.dumps({"steps_count": 6, "first_step": "verify_entitlement", "desk": "PMAM"}),
        })

        # Insert Eligibility Rules
        conn.execute(text("""
            INSERT INTO public.eligibility_rules (
                programme_id, source_id, rule_type, rule_definition, explanation, source_reference, verification_status
            ) VALUES
            (
                :pid, :s1, 'age_senior_route',
                CAST(:rule1 AS jsonb),
                'Indian citizens aged 70 years or older qualify under the universal Ayushman Vay Vandana expansion regardless of household income.',
                'NHA Senior Citizen FAQ 1', 'verified'
            ),
            (
                :pid, :s2, 'income_socioeconomic_route',
                CAST(:rule2 AS jsonb),
                'Families listed in SECC deprivation criteria or possessing an eligible BPL ration card qualify for standard PM-JAY family cover.',
                'NHA Beneficiary Inclusion Criteria', 'verified'
            )
        """), {
            "pid": pmjay_uuid, "s1": str(s1), "s2": str(s2),
            "rule1": json.dumps({
                "all": [
                    {"field": "age", "operator": "gte", "value": 70},
                    {"field": "citizenship", "operator": "eq", "value": "IN"}
                ]
            }),
            "rule2": json.dumps({
                "any": [
                    {"field": "has_ration_card_bpl", "operator": "eq", "value": True},
                    {"field": "secc_eligible", "operator": "eq", "value": True}
                ]
            }),
        })

        # Insert Document Requirements
        conn.execute(text("""
            INSERT INTO public.document_requirements (
                programme_id, source_id, document_name, required_when, accepted_alternatives, source_reference
            ) VALUES
            (
                :pid, :s3, 'Aadhaar Card',
                CAST(:req1 AS jsonb),
                CAST(:alt1 AS jsonb),
                'NHA Senior Citizen FAQ 3: Aadhaar e-KYC is mandatory for 70+ route'
            ),
            (
                :pid, :s3, 'Ration Card',
                CAST(:req2 AS jsonb),
                CAST(:alt2 AS jsonb),
                'NHA Beneficiary Enrollment guidelines for family linkage'
            ),
            (
                :pid, :s2, 'Oncologist Clinical Summary',
                NULL,
                CAST(:alt3 AS jsonb),
                'PM-JAY Oncology Preauthorization Protocol'
            )
        """), {
            "pid": pmjay_uuid, "s2": str(s2), "s3": str(s3),
            "req1": json.dumps({"field": "age", "operator": "gte", "value": 70}),
            "alt1": json.dumps([]),
            "req2": json.dumps({"field": "age", "operator": "lt", "value": 70}),
            "alt2": json.dumps(["Parivar Pehchan Patra", "Family Identity Certificate"]),
            "alt3": json.dumps(["Biopsy Histopathology Report", "Hospital Staging and Treatment Plan"]),
        })

        # Update Programme details
        conn.execute(text("""
            UPDATE public.programmes
            SET version = 1,
                review_status = 'under_review',
                pending_publication_version = 1,
                coverage = jsonb_build_object(
                    'annual_cover_inr', 500000,
                    'senior_cover_inr', 500000,
                    'cashless', true,
                    'pan_india_portability', true
                ),
                updated_at = now()
            WHERE id = :pid
        """), {"pid": pmjay_uuid})

        # Build snapshot
        sources = [dict(r) for r in conn.execute(text("SELECT * FROM public.programme_sources WHERE programme_id = :pid"), {"pid": pmjay_uuid}).mappings().all()]
        claims = [dict(r) for r in conn.execute(text("SELECT * FROM public.scheme_evidence_claims WHERE programme_id = :pid"), {"pid": pmjay_uuid}).mappings().all()]
        rules = [dict(r) for r in conn.execute(text("SELECT * FROM public.eligibility_rules WHERE programme_id = :pid"), {"pid": pmjay_uuid}).mappings().all()]
        docs = [dict(r) for r in conn.execute(text("SELECT * FROM public.document_requirements WHERE programme_id = :pid"), {"pid": pmjay_uuid}).mappings().all()]
        prog = dict(conn.execute(text("SELECT * FROM public.programmes WHERE id = :pid"), {"pid": pmjay_uuid}).mappings().one())

        snapshot_dict = {
            "programme": {
                "id": str(prog["id"]),
                "programme_code": prog["programme_code"],
                "organization_id": str(prog["organization_id"]) if prog["organization_id"] else None,
                "official_name": prog["official_name"],
                "programme_type": prog["programme_type"],
                "description": prog["description"],
                "coverage": prog["coverage"],
                "details": prog["details"],
                "version": 1,
            },
            "sources": [{
                "id": str(s["id"]),
                "programme_id": str(s["programme_id"]),
                "source_title": s["source_title"],
                "source_url": s["source_url"],
                "issuing_body": s["issuing_body"],
                "page_reference": s["page_reference"],
                "effective_date": str(s["effective_date"]) if s["effective_date"] else None,
                "evidence_status": s["evidence_status"],
                "reviewed_by": s["reviewed_by"],
                "reviewed_at": s["reviewed_at"].isoformat() if s["reviewed_at"] else None,
                "review_expires_at": str(s["review_expires_at"]) if s["review_expires_at"] else None,
            } for s in sources],
            "evidence_claims": [{
                "id": str(c["id"]),
                "programme_id": str(c["programme_id"]),
                "source_id": str(c["source_id"]),
                "field_path": c["field_path"],
                "claim_text": c["claim_text"],
                "structured_value": c["structured_value"],
                "source_locator": c["source_locator"],
                "is_critical": c["is_critical"],
                "review_status": c["review_status"],
            } for c in claims],
            "eligibility_rules": [{
                "id": str(r["id"]),
                "source_id": str(r["source_id"]),
                "rule_type": r["rule_type"],
                "rule_definition": r["rule_definition"],
                "explanation": r["explanation"],
                "source_reference": r["source_reference"],
            } for r in rules],
            "document_requirements": [{
                "id": str(d["id"]),
                "source_id": str(d["source_id"]),
                "document_name": d["document_name"],
                "required_when": d["required_when"],
                "accepted_alternatives": d["accepted_alternatives"],
                "source_reference": d["source_reference"],
            } for d in docs],
        }

        # Create Publication Version
        pub_id = conn.execute(text("""
            INSERT INTO public.scheme_publication_versions (
                programme_id, version_number, snapshot, published_by, index_status
            ) VALUES (
                :pid, 1, CAST(:snapshot AS jsonb), :admin, 'pending'
            ) RETURNING id
        """), {
            "pid": pmjay_uuid,
            "snapshot": json.dumps(snapshot_dict),
            "admin": admin_id,
        }).scalar()

        # Enqueue Sync Job
        conn.execute(text("""
            INSERT INTO public.scheme_sync_jobs (
                programme_id, version_number, job_type, status
            ) VALUES (:pid, 1, 'rag', 'pending')
        """), {"pid": pmjay_uuid})

        print(f"PM-JAY publication version 1 created (ID: {pub_id}) with sync job queued.")

    # 2. Run sync worker to process indexing
    print("Running sync worker to generate embeddings and index chunks...")
    processed = process_one_job()
    print(f"Sync worker processed job: {processed}")

    # Check publication status
    with engine.connect() as conn:
        status_row = conn.execute(text("""
            SELECT p.id, p.official_name, p.review_status, p.current_published_version,
                   v.index_status, (SELECT count(*) FROM public.published_knowledge_chunks WHERE programme_id = p.id) as chunk_count
            FROM public.programmes p
            JOIN public.scheme_publication_versions v ON v.programme_id = p.id AND v.version_number = 1
            WHERE p.id = :pid
        """), {"pid": pmjay_uuid}).mappings().one()
        print("PM-JAY Publication Status:", dict(status_row))


if __name__ == "__main__":
    seed_and_publish()

