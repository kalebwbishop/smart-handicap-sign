from __future__ import annotations
from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import declared_attr, Mapped, mapped_column
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from app.db import db

class BaseModel(db.Model):
    """Common columns & helpers for all models."""
    __abstract__ = True

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    @declared_attr.directive
    def __tablename__(cls) -> str:  # auto: "user_account" -> "user_account"
        return cls.__name__.lower()

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} id={self.id}>"
