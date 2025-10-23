from sqlalchemy import Column, String, Integer, ARRAY
from .base import BaseModel

class TestData(BaseModel):
    __tablename__: str = "test_data"
    
    classification = Column(String, nullable=False)
    values = Column(ARRAY(Integer), nullable=False)