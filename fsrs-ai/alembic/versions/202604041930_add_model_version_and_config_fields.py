"""add fsrs model version and config training fields

Revision ID: 202604041930
Revises:
Create Date: 2026-04-04 19:30:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202604041930"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "fsrs_config",
        sa.Column("lastTrainedAt", sa.DateTime(timezone=True), nullable=True),
        schema="fsrs",
    )
    op.add_column(
        "fsrs_config",
        sa.Column(
            "currentModelVersion",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        schema="fsrs",
    )

    op.create_table(
        "fsrs_model_version",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("userId", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("weights", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("requestRetention", sa.Float(), nullable=False),
        sa.Column("sampleSize", sa.Integer(), nullable=False),
        sa.Column("metricType", sa.String(), nullable=False),
        sa.Column("metricBaseline", sa.Float(), nullable=True),
        sa.Column("metricCandidate", sa.Float(), nullable=True),
        sa.Column("improvementPct", sa.Float(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("trainedAt", sa.DateTime(timezone=True), nullable=False),
        sa.Column("createdAt", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("userId", "version", name="uq_fsrs_model_user_version"),
        schema="fsrs",
    )

    op.create_index(
        "ix_fsrs_model_user_status",
        "fsrs_model_version",
        ["userId", "status"],
        unique=False,
        schema="fsrs",
    )
    op.create_index(
        op.f("ix_fsrs_fsrs_model_version_userId"),
        "fsrs_model_version",
        ["userId"],
        unique=False,
        schema="fsrs",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_fsrs_fsrs_model_version_userId"),
        table_name="fsrs_model_version",
        schema="fsrs",
    )
    op.drop_index(
        "ix_fsrs_model_user_status",
        table_name="fsrs_model_version",
        schema="fsrs",
    )
    op.drop_table("fsrs_model_version", schema="fsrs")

    op.drop_column("fsrs_config", "currentModelVersion", schema="fsrs")
    op.drop_column("fsrs_config", "lastTrainedAt", schema="fsrs")
