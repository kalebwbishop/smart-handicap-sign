from uuid import uuid4
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

class InputDevice(db.Model):
    __tablename__ = 'input_devices'
    
    id = db.Column(db.UUID, primary_key=True, default=uuid4, nullable=False)
    name = db.Column(db.String, nullable=False)

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.UUID, primary_key=True, default=uuid4, nullable=False)
    name = db.Column(db.String, nullable=False)

class OutputDevice(db.Model):
    __tablename__ = 'output_devices'
    
    id = db.Column(db.UUID, primary_key=True, default=uuid4, nullable=False)
    token = db.Column(db.String, nullable=False)

class UsersMMInputDevices(db.Model):
    __tablename__ = 'users_mm_input_devices'
    
    user_id = db.Column(db.UUID, db.ForeignKey('users.id'), primary_key=True, nullable=False)
    input_device_id = db.Column(db.UUID, db.ForeignKey('input_devices.id'), primary_key=True, nullable=False)

class UsersMMOutputDevices(db.Model):
    __tablename__ = 'users_mm_output_devices'
    
    user_id = db.Column(db.UUID, db.ForeignKey('users.id'), primary_key=True, nullable=False)
    output_device_id = db.Column(db.UUID, db.ForeignKey('output_devices.id'), primary_key=True, nullable=False)
