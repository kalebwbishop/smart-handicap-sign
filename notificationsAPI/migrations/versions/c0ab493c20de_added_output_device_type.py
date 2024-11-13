from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c0ab493c20de'
down_revision = None
branch_labels = None
depends_on = None

# Define the Enum type for PostgreSQL
output_device_type_enum = sa.Enum('IPHONE_APP', 'ANDROID_APP', 'TEXT_MESSAGE', name='outputdevicetype')

def upgrade():
    # Create the enum type in the database
    output_device_type_enum.create(op.get_bind())

    # Add new column and rename existing column
    with op.batch_alter_table('output_devices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('identifier_type', output_device_type_enum, nullable=False, server_default='TEXT_MESSAGE'))
        batch_op.alter_column('token', new_column_name='identifier_value')

def downgrade():
    # Revert the column rename and remove the new column
    with op.batch_alter_table('output_devices', schema=None) as batch_op:
        batch_op.alter_column('identifier_value', new_column_name='token')
        batch_op.drop_column('identifier_type')

    # Drop the enum type in the database
    output_device_type_enum.drop(op.get_bind())
