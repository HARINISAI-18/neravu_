"""Seed official evidence sources, claims, rules, and document requirements
for the remaining 3 schemes: PMNRF, HMDG, and RAN/HMCPF, and publish them.
"""

import json
from datetime import date
from sqlalchemy import text
from app.db.config import get_database_engine
from app.workers.sync_worker import process_one_job


def seed_and_publish_remaining():
    engine = get_database_engine()
    admin_id = "00000000-0000-0000-0000-000000000001"
    expiry = date(2028, 12, 31)

    with engine.begin() as conn:
        schemes_data = [
            {
                "code": "CSV-2B7A96F21033618828C6",  # PMNRF
                "source": {
                    "title": "Prime Minister's National Relief Fund (PMNRF) Medical Assistance Portal",
                    "url": "https://pmnrf.gov.in",
                    "issuing_body": "Prime Minister's Office, Government of India",
                    "page_reference": "Medical Treatment Assistance Guidelines & FAQs",
                    "date": "2024-01-01",
                },
                "claims": [
                    {
                        "path": "coverage.grant_type",
                        "text": "The Prime Minister's National Relief Fund (PMNRF) provides discretionary financial assistance for life-threatening medical treatments including cancer surgeries and therapies in Government hospitals or empanelled hospitals. Sanctioned grants are disbursed directly to the hospital.",
                        "val": {"discretionary": True, "direct_hospital_disbursement": True},
                        "locator": "PMNRF FAQ Section 2",
                    },
                    {
                        "path": "eligibility.criteria",
                        "text": "Assistance under PMNRF is case-by-case and subject to discretionary approval by the Prime Minister's Office based on economic hardship and treatment cost estimates.",
                        "val": {"approval_authority": "Prime Minister's Office", "basis": "case_by_case"},
                        "locator": "PMO Assistance Guidelines",
                    },
                    {
                        "path": "application.workflow_steps",
                        "text": "Step 1: Obtain medical treatment estimate and diagnosis from treating Government or empanelled hospital. Step 2: Complete the PMNRF application form. Step 3: Attach income certificate and submit to Prime Minister's Office. Step 4: PMO evaluates the case. Step 5: Sanctioned grant is remitted directly to the hospital.",
                        "val": {"steps_count": 5},
                        "locator": "PMNRF Application Protocol",
                    },
                ],
                "rules": [
                    {
                        "type": "hospital_estimate_required",
                        "def": {"field": "has_hospital_treatment_estimate", "operator": "eq", "value": True},
                        "exp": "Application requires an official treatment estimate from a Government or empanelled hospital.",
                        "ref": "PMNRF Medical Guidance",
                    }
                ],
                "docs": [
                    {"name": "Hospital Treatment Cost Estimate", "when": None, "alt": ["Hospital Medical Certificate"], "ref": "PMNRF Application Guidelines"},
                    {"name": "Income Certificate", "when": None, "alt": ["Tehsildar Certificate", "BPL Certificate"], "ref": "PMNRF Income Proof Rule"},
                    {"name": "PMNRF Application Form", "when": None, "alt": [], "ref": "Official PMNRF Application Portal"},
                ],
                "coverage": {"type": "discretionary_grant", "direct_disbursement": True},
            },
            {
                "code": "CSV-19F71944D4F5A8A2577A",  # HMDG
                "source": {
                    "title": "Health Minister's Discretionary Grant (HMDG) Guidelines",
                    "url": "https://www.mohfw.gov.in/sites/default/files/guidelines%20of%20HMDG.pdf",
                    "issuing_body": "Ministry of Health and Family Welfare, Government of India",
                    "page_reference": "MoHFW HMDG Guidelines Clause 1-6",
                    "date": "2024-01-01",
                },
                "claims": [
                    {
                        "path": "coverage.financial_limit",
                        "text": "Health Minister's Discretionary Grant (HMDG) provides financial assistance up to INR 125,000 (1.25 Lakh) to poor patients suffering from major life-threatening diseases including cancer.",
                        "val": {"max_grant_inr": 125000, "currency": "INR"},
                        "locator": "HMDG Guidelines Clause 3",
                    },
                    {
                        "path": "eligibility.income_criteria",
                        "text": "Eligible patients must have an annual family income not exceeding INR 125,000 (1.25 Lakh). Treatment must be undertaken in a Government hospital; private hospital treatment is strictly excluded.",
                        "val": {"max_annual_income_inr": 125000, "hospital_type": "government_only"},
                        "locator": "HMDG Guidelines Clause 2",
                    },
                    {
                        "path": "application.workflow_steps",
                        "text": "Step 1: Obtain treatment certificate and cost estimate from treating Government hospital. Step 2: Obtain family income certificate from Tehsildar or revenue authority. Step 3: Complete HMDG application form countersigned by Medical Superintendent. Step 4: Submit application to Grants Section of MoHFW. Step 5: Approved grant is disbursed directly to Government hospital.",
                        "val": {"steps_count": 5},
                        "locator": "HMDG Workflow Guide",
                    },
                ],
                "rules": [
                    {
                        "type": "income_and_government_hospital",
                        "def": {
                            "all": [
                                {"field": "annual_income", "operator": "lte", "value": 125000},
                                {"field": "treatment_at_government_hospital", "operator": "eq", "value": True}
                            ]
                        },
                        "exp": "Annual family income must not exceed INR 1,25,000 and treatment must be at a Government hospital.",
                        "ref": "HMDG Eligibility Clause 2",
                    }
                ],
                "docs": [
                    {"name": "Government Hospital Medical Certificate", "when": None, "alt": ["Hospital Superintendent Estimate"], "ref": "HMDG Clause 4"},
                    {"name": "Income Certificate", "when": None, "alt": ["Tehsildar Income Certificate"], "ref": "HMDG Clause 4: Revenue authority certificate"},
                    {"name": "HMDG Application Form", "when": None, "alt": [], "ref": "MoHFW Application Portal"},
                ],
                "coverage": {"max_grant_inr": 125000, "government_hospital_only": True},
            },
            {
                "code": "CSV-1E72AE61911CD2FAE3DE",  # RAN / HMCPF
                "source": {
                    "title": "MoHFW Guidelines for Health Minister's Cancer Patient Fund (HMCPF) under RAN",
                    "url": "https://www.mohfw.gov.in/sites/default/files/2563214569875214.pdf",
                    "issuing_body": "Ministry of Health and Family Welfare, Government of India",
                    "page_reference": "HMCPF / RAN Guidelines Clauses 1-12 & PIB release",
                    "date": "2025-08-08",
                },
                "claims": [
                    {
                        "path": "coverage.financial_limit",
                        "text": "Under the Health Minister's Cancer Patient Fund (HMCPF) component of Rashtriya Arogya Nidhi (RAN), one-time financial assistance of up to INR 1,500,000 (15 Lakh) is provided for cancer treatment.",
                        "val": {"max_grant_inr": 1500000, "currency": "INR", "one_time": True},
                        "locator": "HMCPF Guidelines & PIB Release 2025",
                    },
                    {
                        "path": "eligibility.bpl_criteria",
                        "text": "Assistance is provided to cancer patients living below poverty line (BPL) receiving treatment in 27 Regional Cancer Centres (RCCs) or designated Tertiary Care Cancer Centres and AIIMS.",
                        "val": {"bpl_required": True, "hospital_category": "27_regional_cancer_centres"},
                        "locator": "HMCPF Clause 3",
                    },
                    {
                        "path": "application.workflow_steps",
                        "text": "Step 1: Present at an empanelled Regional Cancer Centre (RCC) or AIIMS. Step 2: Treating oncologist prepares cancer staging report and cost estimation. Step 3: Medical social worker verifies BPL ration card. Step 4: Hospital Nodal Officer submits HMCPF application to MoHFW. Step 5: Financial grant up to INR 15 Lakh is sanctioned for oncology treatment.",
                        "val": {"steps_count": 5},
                        "locator": "RAN/HMCPF Hospital Guide",
                    },
                ],
                "rules": [
                    {
                        "type": "bpl_and_rcc_treatment",
                        "def": {
                            "all": [
                                {"field": "is_bpl", "operator": "eq", "value": True},
                                {"field": "treatment_at_empanelled_rcc", "operator": "eq", "value": True}
                            ]
                        },
                        "exp": "Patient must hold valid BPL status and receive treatment at one of the 27 Regional Cancer Centres or empanelled institutes.",
                        "ref": "HMCPF Eligibility Clause 3",
                    }
                ],
                "docs": [
                    {"name": "BPL Ration Card", "when": None, "alt": ["Antyodaya Card", "NFSA Priority Card"], "ref": "HMCPF Clause 5"},
                    {"name": "RCC Oncology Treatment Plan", "when": None, "alt": ["Hospital Staging & Biopsy Report"], "ref": "HMCPF Clinical Protocol"},
                    {"name": "RAN Application Form", "when": None, "alt": [], "ref": "MoHFW Grants Portal"},
                ],
                "coverage": {"max_grant_inr": 1500000, "bpl_exclusive": True, "empanelled_rccs": True},
            },
        ]

        for sdata in schemes_data:
            prog_id = conn.execute(
                text("SELECT id FROM public.programmes WHERE programme_code = :c"),
                {"c": sdata["code"]},
            ).scalar()
            if not prog_id:
                print(f"Skipping {sdata['code']}: not found in programmes")
                continue
            pid = str(prog_id)

            # Clean any old drafts
            conn.execute(text("DELETE FROM public.published_knowledge_chunks WHERE programme_id = :p"), {"p": pid})
            conn.execute(text("DELETE FROM public.scheme_sync_jobs WHERE programme_id = :p"), {"p": pid})
            conn.execute(text("DELETE FROM public.scheme_publication_versions WHERE programme_id = :p"), {"p": pid})
            conn.execute(text("DELETE FROM public.scheme_evidence_claims WHERE programme_id = :p"), {"p": pid})
            conn.execute(text("DELETE FROM public.eligibility_rules WHERE programme_id = :p"), {"p": pid})
            conn.execute(text("DELETE FROM public.document_requirements WHERE programme_id = :p"), {"p": pid})
            conn.execute(text("DELETE FROM public.programme_sources WHERE programme_id = :p"), {"p": pid})

            # Insert Source
            src = sdata["source"]
            source_id = conn.execute(text("""
                INSERT INTO public.programme_sources (
                    programme_id, source_title, source_url, issuing_body, page_reference,
                    effective_date, evidence_status, reviewed_by, reviewed_at, review_expires_at, verified_at
                ) VALUES (
                    :pid, :title, :url, :body, :ref, :dt, 'approved', :admin, now(), :exp, now()
                ) RETURNING id
            """), {
                "pid": pid, "title": src["title"], "url": src["url"], "body": src["issuing_body"],
                "ref": src["page_reference"], "dt": src["date"], "admin": admin_id, "exp": expiry,
            }).scalar()

            # Insert Claims
            for claim in sdata["claims"]:
                conn.execute(text("""
                    INSERT INTO public.scheme_evidence_claims (
                        programme_id, source_id, field_path, claim_text, structured_value,
                        source_locator, is_critical, review_status, created_by, reviewed_by, reviewed_at
                    ) VALUES (
                        :pid, :sid, :path, :text, CAST(:val AS jsonb), :loc, true, 'approved', :admin, :admin, now()
                    )
                """), {
                    "pid": pid, "sid": str(source_id), "path": claim["path"], "text": claim["text"],
                    "val": json.dumps(claim["val"]), "loc": claim["locator"], "admin": admin_id,
                })

            # Insert Rules
            for rule in sdata["rules"]:
                conn.execute(text("""
                    INSERT INTO public.eligibility_rules (
                        programme_id, source_id, rule_type, rule_definition, explanation, source_reference, verification_status
                    ) VALUES (
                        :pid, :sid, :type, CAST(:rdef AS jsonb), :exp, :ref, 'verified'
                    )
                """), {
                    "pid": pid, "sid": str(source_id), "type": rule["type"],
                    "rdef": json.dumps(rule["def"]), "exp": rule["exp"], "ref": rule["ref"],
                })

            # Insert Documents
            for doc in sdata["docs"]:
                conn.execute(text("""
                    INSERT INTO public.document_requirements (
                        programme_id, source_id, document_name, required_when, accepted_alternatives, source_reference
                    ) VALUES (
                        :pid, :sid, :name, CAST(:when AS jsonb), CAST(:alt AS jsonb), :ref
                    )
                """), {
                    "pid": pid, "sid": str(source_id), "name": doc["name"],
                    "when": json.dumps(doc["when"]) if doc["when"] else None,
                    "alt": json.dumps(doc["alt"]), "ref": doc["ref"],
                })

            # Update Programme
            conn.execute(text("""
                UPDATE public.programmes
                SET version = 1,
                    review_status = 'under_review',
                    pending_publication_version = 1,
                    coverage = CAST(:cov AS jsonb),
                    updated_at = now()
                WHERE id = :pid
            """), {"pid": pid, "cov": json.dumps(sdata["coverage"])})

            # Snapshot
            sources = [dict(r) for r in conn.execute(text("SELECT * FROM public.programme_sources WHERE programme_id = :p"), {"p": pid}).mappings().all()]
            claims = [dict(r) for r in conn.execute(text("SELECT * FROM public.scheme_evidence_claims WHERE programme_id = :p"), {"p": pid}).mappings().all()]
            rules = [dict(r) for r in conn.execute(text("SELECT * FROM public.eligibility_rules WHERE programme_id = :p"), {"p": pid}).mappings().all()]
            docs = [dict(r) for r in conn.execute(text("SELECT * FROM public.document_requirements WHERE programme_id = :p"), {"p": pid}).mappings().all()]
            prog = dict(conn.execute(text("SELECT * FROM public.programmes WHERE id = :p"), {"p": pid}).mappings().one())

            snap = {
                "programme": {
                    "id": str(prog["id"]),
                    "programme_code": prog["programme_code"],
                    "official_name": prog["official_name"],
                    "programme_type": prog["programme_type"],
                    "description": prog["description"],
                    "coverage": prog["coverage"],
                    "details": prog["details"],
                    "version": 1,
                },
                "sources": [{
                    "id": str(s["id"]), "programme_id": str(s["programme_id"]),
                    "source_title": s["source_title"], "source_url": s["source_url"],
                    "issuing_body": s["issuing_body"], "evidence_status": s["evidence_status"],
                    "review_expires_at": str(s["review_expires_at"]) if s["review_expires_at"] else None,
                } for s in sources],
                "evidence_claims": [{
                    "id": str(c["id"]), "programme_id": str(c["programme_id"]),
                    "source_id": str(c["source_id"]), "field_path": c["field_path"],
                    "claim_text": c["claim_text"], "structured_value": c["structured_value"],
                    "source_locator": c["source_locator"], "is_critical": c["is_critical"],
                    "review_status": c["review_status"],
                } for c in claims],
                "eligibility_rules": [{
                    "id": str(r["id"]), "source_id": str(r["source_id"]),
                    "rule_type": r["rule_type"], "rule_definition": r["rule_definition"],
                    "explanation": r["explanation"], "source_reference": r["source_reference"],
                } for r in rules],
                "document_requirements": [{
                    "id": str(d["id"]), "source_id": str(d["source_id"]),
                    "document_name": d["document_name"], "required_when": d["required_when"],
                    "accepted_alternatives": d["accepted_alternatives"], "source_reference": d["source_reference"],
                } for d in docs],
            }

            conn.execute(text("""
                INSERT INTO public.scheme_publication_versions (
                    programme_id, version_number, snapshot, published_by, index_status
                ) VALUES (
                    :pid, 1, CAST(:snap AS jsonb), :admin, 'pending'
                )
            """), {"pid": pid, "snap": json.dumps(snap), "admin": admin_id})

            conn.execute(text("""
                INSERT INTO public.scheme_sync_jobs (
                    programme_id, version_number, job_type, status
                ) VALUES (:pid, 1, 'rag', 'pending')
            """), {"pid": pid})

            print(f"Queued publication for {prog['official_name']}")

    # Process all sync jobs
    print("Processing sync worker jobs...")
    while True:
        more = process_one_job()
        if not more:
            break
        print("Indexed a publication version successfully!")

    print("All schemes published and indexed!")


if __name__ == "__main__":
    seed_and_publish_remaining()

