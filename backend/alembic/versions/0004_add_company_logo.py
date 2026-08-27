"""Add logo_url to companies.

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("logo_url", sa.String(500)))


def downgrade() -> None:
    op.drop_column("companies", "logo_url")
