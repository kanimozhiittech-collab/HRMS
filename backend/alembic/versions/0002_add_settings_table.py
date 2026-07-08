"""Add settings table (Global Settings module).

Revision ID: 0002
Revises: 0001
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("setting_key", sa.String(100), nullable=False, unique=True),
        sa.Column("setting_value", sa.String(255)),
        sa.Column("description", sa.String(255)),
        sa.Column("updated_at", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("settings")
