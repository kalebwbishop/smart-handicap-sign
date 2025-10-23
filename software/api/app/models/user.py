from sqlalchemy import Column, String, Integer, ARRAY, Boolean, text
from sqlalchemy.dialects.postgresql import UUID
import uuid
from sqlalchemy.orm import Mapped, mapped_column
from .base import BaseModel

class User(BaseModel):
    __tablename__: str = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email = Column(String, unique=True, nullable=False)
    email_is_active = Column(Boolean, server_default=text("true"), nullable=False)
    name = Column(String, nullable=False)
