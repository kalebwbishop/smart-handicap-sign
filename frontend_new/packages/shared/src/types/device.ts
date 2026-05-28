export type DeviceLifecycleStatus =
  | "manufactured"
  | "unclaimed"
  | "claiming"
  | "active"
  | "lost"
  | "revoked"
  | "retired";

export type DeviceOperationalStatus =
  | "available"
  | "assistance_requested"
  | "assistance_in_progress"
  | "offline"
  | "error";

export type ClaimStatus = "unused" | "used" | "revoked" | "expired";

export type AccessibleParkingType = "standard" | "van_accessible" | "temporary" | "reserved";

export interface Device {
  id: string;
  serial_number: string;
  model_code: string | null;
  hardware_revision: string | null;
  firmware_version: string | null;
  manufacture_batch: string | null;
  lifecycle_status: DeviceLifecycleStatus;
  operational_status: DeviceOperationalStatus | null;
  claim_status: ClaimStatus | null;
  claimed_at: string | null;
  organization_id: string | null;
  current_site_id: string | null;
  current_parking_space_id: string | null;
  name: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  organization_id: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  jurisdiction: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteCreate {
  organization_id: string;
  name: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  jurisdiction?: string;
}

export interface ParkingSpace {
  id: string;
  site_id: string;
  label: string;
  accessible_type: AccessibleParkingType;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  current_device_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParkingSpaceCreate {
  site_id: string;
  label: string;
  accessible_type: AccessibleParkingType;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

export interface Installation {
  id: string;
  device_id: string;
  organization_id: string;
  site_id: string;
  parking_space_id: string;
  installer_user_id: string;
  installation_photos: string[];
  install_notes: string | null;
  installed_at: string;
  activation_status: string;
  created_at: string;
  updated_at: string;
}

export interface ClaimValidateRequest {
  serial_number: string;
  claim_id: string;
}

export interface ClaimValidateResponse {
  valid: boolean;
  device?: {
    serial_number: string;
    model_code: string;
    hardware_revision: string;
    lifecycle_status: DeviceLifecycleStatus;
  };
  error?: string;
  error_code?: ClaimErrorCode;
}

export type ClaimErrorCode =
  | "invalid_serial"
  | "device_not_found"
  | "invalid_claim_id"
  | "claim_already_used"
  | "claim_expired"
  | "claim_revoked"
  | "device_already_active"
  | "device_revoked"
  | "device_retired"
  | "device_not_claimable"
  | "no_claim_configured"
  | "unauthorized"
  | "rate_limited";

export interface ClaimRequest {
  serial_number: string;
  claim_id: string;
  customer_id: string;
  site_id: string;
  parking_space_id: string;
  accessible_type: AccessibleParkingType;
  installation_photos: string[];
  install_notes?: string;
}

export interface ClaimResponse {
  success: boolean;
  device?: {
    serial_number: string;
    lifecycle_status: DeviceLifecycleStatus;
    customer_id: string;
    site_id: string;
    parking_space_id: string;
  };
  error?: string;
  error_code?: ClaimErrorCode;
}

export interface TransferRequest {
  new_site_id: string;
  new_parking_space_id: string;
  accessible_type: AccessibleParkingType;
  notes?: string;
}

export interface RevokeRequest {
  reason: string;
}

export interface QRCodePayload {
  serial_number: string;
  claim_id: string;
}

export interface DeviceEvent {
  id: string;
  device_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
