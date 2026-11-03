
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    organization_type: Mapped[str] = mapped_column(Text, nullable=False)
    official_website: Mapped[str | None] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(Text)
    contact_phone: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    programmes: Mapped[list["Programme"]] = relationship(
        back_populates="organization"
    )


class Programme(Base):
    __tablename__ = "programmes"

    __table_args__ = (
        CheckConstraint(
            "review_status IN ('draft', 'under_review', "
            "'verified', 'expired', 'superseded')",
            name="ck_programmes_review_status",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_programmes_version",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    programme_code: Mapped[str] = mapped_column(
        Text, unique=True, nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )
    official_name: Mapped[str] = mapped_column(Text, nullable=False)
    programme_type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    coverage: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    details: Mapped[dict] = mapped_column(
        JSONB,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    review_status: Mapped[str] = mapped_column(
        Text, default="draft", server_default="draft"
    )
    version: Mapped[int] = mapped_column(
        Integer, default=1, server_default="1"
    )
    last_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    organization: Mapped["Organization"] = relationship(
        back_populates="programmes"
    )
    sources: Mapped[list["ProgrammeSource"]] = relationship(
        back_populates="programme"
    )
    eligibility_rules: Mapped[list["EligibilityRule"]] = relationship(
        back_populates="programme"
    )
    documents: Mapped[list["DocumentRequirement"]] = relationship(
        back_populates="programme"
    )


class ProgrammeSource(Base):
    __tablename__ = "programme_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    programme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programmes.id", ondelete="CASCADE"),
        nullable=False,
    )
    source_title: Mapped[str] = mapped_column(Text, nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    storage_path: Mapped[str | None] = mapped_column(Text)
    page_reference: Mapped[str | None] = mapped_column(Text)
    effective_date: Mapped[date | None] = mapped_column(Date)
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    programme: Mapped["Programme"] = relationship(
        back_populates="sources"
    )


class EligibilityRule(Base):
    __tablename__ = "eligibility_rules"

    __table_args__ = (
        CheckConstraint(
            "verification_status IN "
            "('unverified', 'verified', 'requires_review')",
            name="ck_eligibility_rules_verification",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    programme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programmes.id", ondelete="CASCADE"),
        nullable=False,
    )
    rule_type: Mapped[str] = mapped_column(Text, nullable=False)
    rule_definition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    source_reference: Mapped[str | None] = mapped_column(Text)
    verification_status: Mapped[str] = mapped_column(
        Text, default="unverified", server_default="unverified"
    )

    programme: Mapped["Programme"] = relationship(
        back_populates="eligibility_rules"
    )


class DocumentRequirement(Base):
    __tablename__ = "document_requirements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    programme_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("programmes.id", ondelete="CASCADE"),
        nullable=False,
    )
    document_name: Mapped[str] = mapped_column(Text, nullable=False)
    required_when: Mapped[dict | None] = mapped_column(JSONB)
    accepted_alternatives: Mapped[dict | None] = mapped_column(JSONB)
    source_reference: Mapped[str | None] = mapped_column(Text)

    programme: Mapped["Programme"] = relationship(
        back_populates="documents"
    )
