# Enums for the logistics application

import enum

class SignStatus(enum.Enum):
	READY = "ready"
	DISCONNECTED = "disconnected"
	ERROR = "error"
	AWAITING_ASSISTANCE = "awaiting_assistance"