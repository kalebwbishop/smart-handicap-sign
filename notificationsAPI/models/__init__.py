import enum
from uuid import uuid4
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class InputDevice(db.Model):
    __tablename__ = 'input_devices'
    
    id = db.Column(db.UUID, primary_key=True, default=uuid4, nullable=False)
    name = db.Column(db.String, nullable=False)

    users = db.relationship('User', secondary='users_mm_input_devices', backref='input_devices')

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.UUID, primary_key=True, default=uuid4, nullable=False)
    name = db.Column(db.String, nullable=False)

class OutputDeviceType(enum.Enum):
    IPHONE_APP = "iphone_app"
    ANDROID_APP = "android_app"
    TEXT_MESSAGE = "text_message"

class OutputDevice(db.Model):
    __tablename__ = 'output_devices'
    
    id = db.Column(db.UUID, primary_key=True, default=uuid4, nullable=False)
    identifier_type = db.Column(db.Enum(OutputDeviceType), nullable=False)  # Type of identifier
    identifier_value = db.Column(db.String, nullable=False)   # The identifier value

    users = db.relationship('User', secondary='users_mm_output_devices', backref='output_devices')

class UsersMMInputDevices(db.Model):
    __tablename__ = 'users_mm_input_devices'
    
    user_id = db.Column(db.UUID, db.ForeignKey('users.id'), primary_key=True, nullable=False)
    input_device_id = db.Column(db.UUID, db.ForeignKey('input_devices.id'), primary_key=True, nullable=False)

class UsersMMOutputDevices(db.Model):
    __tablename__ = 'users_mm_output_devices'
    
    user_id = db.Column(db.UUID, db.ForeignKey('users.id'), primary_key=True, nullable=False)
    output_device_id = db.Column(db.UUID, db.ForeignKey('output_devices.id'), primary_key=True, nullable=False)
