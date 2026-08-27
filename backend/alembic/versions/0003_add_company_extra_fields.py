"""Add GST/PAN/address/locations to companies.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("gst_number", sa.String(20)))
    op.add_column("companies", sa.Column("pan_number", sa.String(20)))
    op.add_column("companies", sa.Column("address", sa.String(300)))
    op.add_column("companies", sa.Column("locations", sa.String(300)))


def downgrade() -> None:
    op.drop_column("companies", "locations")
    op.drop_column("companies", "address")
    op.drop_column("companies", "pan_number")
    op.drop_column("companies", "gst_number")
