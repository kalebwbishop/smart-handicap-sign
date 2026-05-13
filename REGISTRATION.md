# Device Registration Process

## Overview

The Smart Handicap Sign (SHS) uses QR-code-based device registration to allow installers to claim and activate headless devices. Each physical sign has a printed QR code — no screen or on-device interaction is required.

---

## QR Code

### What's Encoded

Each device ships with a printed QR code containing a deep-link URL:

```
smartsign://setup?serial=SHS-2605-S01-A7K-00482-R&claim=9Q7M-2KD8
```

For production, the QR code uses a universal link:

```
https://app.example.com/setup?serial=SHS-2605-S01-A7K-00482-R&claim=9Q7M-2KD8
```

Both formats route to the same claim validation flow in the mobile app.

| Parameter | Purpose |
|-----------|---------|
| `serial`  | Permanent device serial number |
| `claim`   | One-time-use claim code (temporary, revocable) |

### Security Constraints

The QR code **never** contains:
- Private keys or certificates
- Admin tokens or API keys
- Wi-Fi credentials
- Customer data

---

## Serial Number Format

```
SHS-YYMM-MDL-BBB-SSSSS-C
```

| Segment | Meaning | Example |
|---------|---------|---------|
| `SHS`   | Product prefix (Smart Handicap Sign) | SHS |
| `YYMM`  | Manufacture year/month | 2605 (May 2026) |
| `MDL`   | Model code | S01 |
| `BBB`   | Batch/lot code | A7K |
| `SSSSS` | Unit sequence (00001–99999) | 00482 |
| `C`     | Check character | R |

The check character is computed from the serial body to detect transcription errors.

---

## Claim ID

Format: `XXXX-XXXX` (8 characters from an unambiguous alphabet)

```
Alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
```

Characters excluded: `0`, `1`, `I`, `O` (easily confused)

### Properties
- **Random** — cryptographically generated
- **One-time-use** — cannot be reused after a successful claim
- **Revocable** — admins can invalidate a claim ID
- **Expirable** — optional TTL for security
- **Stored hashed** — backend stores only `SHA-256(salt + claim_id)`, never plaintext

---

## Registration Flow

### Step-by-Step

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTALLER MOBILE APP                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. SCAN QR CODE                                                │
│     ├── Camera opens, scans QR                                  │
│     ├── Extracts serial number + claim ID from URL              │
│     └── (Also supports deep link: smartsign://setup?...)        │
│                                                                 │
│  2. AUTHENTICATE                                                │
│     ├── If not logged in → redirect to login                    │
│     └── Must have device-claim permission                       │
│                                                                 │
│  3. VALIDATE CLAIM (POST /api/v1/device-claims/validate)        │
│     ├── Backend checks:                                         │
│     │   • Device exists with this serial number                 │
│     │   • Device lifecycle is "manufactured" or "unclaimed"     │
│     │   • Claim ID hash matches stored hash                     │
│     │   • Claim status is "unused"                              │
│     │   • Not expired or revoked                                │
│     ├── Returns device info (model, hardware rev, status)       │
│     └── If invalid → show error with specific reason            │
│                                                                 │
│  4. ASSIGN DEVICE                                               │
│     ├── Select or create organization (customer)                │
│     ├── Select or create site (location/address)                │
│     ├── Select or create parking space                          │
│     └── Confirm accessible parking type:                        │
│         • Standard accessible                                   │
│         • Van-accessible                                        │
│         • Temporary                                             │
│         • Reserved                                              │
│                                                                 │
│  5. INSTALLATION PHOTOS                                         │
│     ├── Capture/upload installation photos                      │
│     ├── Add optional installation notes                         │
│     └── (May skip with documented reason)                       │
│                                                                 │
│  6. CONFIRM & ACTIVATE (POST /api/v1/device-claims/claim)       │
│     ├── Review summary of all selections                        │
│     ├── Press "Confirm & Activate"                              │
│     └── Backend atomically:                                     │
│         • Marks claim ID as "used"                              │
│         • Sets device lifecycle → "active"                      │
│         • Assigns device → customer, site, parking space        │
│         • Creates installation record                           │
│         • Creates device event: "claimed"                       │
│         • Creates audit log entry                               │
│                                                                 │
│  7. SUCCESS                                                     │
│     ├── Shows confirmation with serial, site, space             │
│     └── Device is now operational                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Validate Claim

```
POST /api/v1/device-claims/validate
```

**Request:**
```json
{
  "serial_number": "SHS-2605-S01-A7K-00482-R",
  "claim_id": "9Q7M-2KD8"
}
```

**Success Response (200):**
```json
{
  "valid": true,
  "device": {
    "serial_number": "SHS-2605-S01-A7K-00482-R",
    "model_code": "S01",
    "hardware_revision": "A",
    "lifecycle_status": "unclaimed"
  }
}
```

**Error Response (400/404/409):**
```json
{
  "valid": false,
  "error_code": "CLAIM_ALREADY_USED",
  "message": "This claim code has already been used."
}
```

### Execute Claim

```
POST /api/v1/device-claims/claim
```

**Request:**
```json
{
  "serial_number": "SHS-2605-S01-A7K-00482-R",
  "claim_id": "9Q7M-2KD8",
  "customer_id": "uuid-here",
  "site_id": "uuid-here",
  "parking_space_id": "uuid-here",
  "accessible_type": "van_accessible",
  "installation_photos": ["photo_url_1", "photo_url_2"],
  "install_notes": "Installed at north lot near entrance."
}
```

**Success Response (200):**
```json
{
  "success": true,
  "device": {
    "serial_number": "SHS-2605-S01-A7K-00482-R",
    "lifecycle_status": "active",
    "customer_id": "uuid-here",
    "site_id": "uuid-here",
    "parking_space_id": "uuid-here"
  }
}
```

---

## Device Lifecycle

```
manufactured ──► unclaimed ──► claiming ──► active
                     ▲                        │
                     │                        ▼
                  released              lost / revoked / retired
```

| Status | Meaning |
|--------|---------|
| `manufactured` | Exists in system, hasn't shipped |
| `unclaimed` | Shipped, ready to be claimed by installer |
| `claiming` | Temporary state during registration (prevents races) |
| `active` | Assigned to a customer/site/space, fully operational |
| `lost` | Reported missing |
| `revoked` | Credentials or claim disabled |
| `retired` | Permanently out of service |

---

## Security Model

| Measure | Implementation |
|---------|---------------|
| Claim ID storage | Salted SHA-256 hash only — never plaintext |
| One-time use | Claim status set to "used" atomically during claim |
| Race condition prevention | `SELECT ... FOR UPDATE` locks device row during claim |
| Rate limiting | Sliding window: 20/IP, 10/serial, 5/user+serial per 15 min |
| Authorization | User must be authenticated + authorized for target org |
| Double-claim prevention | Device must be "unclaimed" — active devices cannot be re-claimed |
| Audit trail | Every claim, transfer, revoke logged with actor + timestamp |
| No secrets in QR | QR contains only serial + temporary claim code |

---

## Error Cases

| Error | Cause | User Sees |
|-------|-------|-----------|
| Invalid QR code | Malformed URL or unrecognized format | "Invalid QR code scanned" |
| Serial not found | Device not in database | "Device not recognized" |
| Wrong claim ID | Hash doesn't match | "Invalid claim code" |
| Claim already used | Someone already claimed this device | "Device already registered" |
| Claim expired | TTL exceeded | "Claim code expired — contact admin" |
| Device already active | Trying to claim an active device | "Device already registered" |
| Device revoked | Device was disabled | "Device has been revoked" |
| Not authorized | User lacks permission for this org | "You don't have permission" |
| Rate limited | Too many attempts | "Too many attempts — try again later" |

---

## Admin Operations

Admins can manage devices after registration:

| Action | Endpoint | Effect |
|--------|----------|--------|
| **Revoke** | `POST /api/v1/devices/:serial/revoke` | Disables device, sets status to "revoked" |
| **Transfer** | `POST /api/v1/devices/:serial/transfer` | Moves device to new site/space with audit log |
| **Release** | `POST /api/v1/devices/:serial/release` | Returns device to "unclaimed" for re-registration |
| **Regenerate claim** | `POST /api/v1/devices/:serial/regenerate-claim` | Issues new claim ID for an unclaimed device |
| **View events** | `GET /api/v1/devices/:serial/events` | Full event history for the device |

---

## What Happens on the Device

The physical sign itself does **nothing** during registration. It:
- Has no screen
- Does not display codes
- Does not participate in the claim handshake

After the backend marks the device as "active," the device's next status poll will receive an active response and begin normal operation (sensor readings, LED status updates).

---

## Summary

1. **QR code** identifies the device (serial) and provides a one-time claim ticket (claim ID)
2. **Installer app** handles the user-facing flow (scan → validate → assign → confirm)
3. **Backend** owns all security (hashing, rate limiting, atomic operations, authorization)
4. **Device** is passive — it just needs to be physically installed and powered on
