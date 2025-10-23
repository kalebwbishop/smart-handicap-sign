from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Enum as SAEnum
import uuid
from .base import BaseModel
from .enums import SignStatus

class Sign(BaseModel):
    __tablename__: str = "signs"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True)
    status: Mapped[SignStatus] = mapped_column(SAEnum(SignStatus, name="sign_status"), nullable=False, server_default=SignStatus.DISCONNECTED.name)