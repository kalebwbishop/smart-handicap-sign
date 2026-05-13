# Hazard Hero

An IoT accessibility system for smart handicap parking sign management, built with React Native, FastAPI, PostgreSQL, WorkOS, and Azure.

## Features

- 🔐 **Authentication**: WorkOS OAuth with multiple providers
- 👤 **User Profiles**: Customizable profiles with bio, images, location
- ❤️ **Social Following**: Follow/unfollow users, view followers and following
- 📝 **Posts**: Create posts with images, like/unlike
- 📰 **Feed**: Personalized feed from followed users
- 💬 **Real-time Messaging**: Live chat with Socket.IO and Redis
- 📸 **Image Uploads**: Profile, cover, and post images via Azure Blob Storage
- 💪 **TypeScript**: Full type safety across frontend and backend

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- WorkOS account
- Azure account (Storage + Redis)
- Expo CLI for mobile development

### Setup

1. **Clone and Install**
   ```bash
   cd smart-handicap-sign
   npm install # Root dependencies
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure Environment Variables**
   
   Copy `.env.example` files and update with your credentials:
   - `backend/.env` - WorkOS, Azure Storage, Azure Redis
   - `frontend/.env` - API URL

   See `WORKOS_SETUP.md` and `AZURE_SETUP.md` for detailed configuration.

3. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

4. **Run Backend**
   ```bash
   cd backend
   npm run dev
   ```

5. **Run Frontend**
   ```bash
   cd frontend
   npm start
   ```

## Device Registration (QR Code Claim Flow)

Signs are headless IoT devices with no keyboard or screen for login. Each device ships with a QR code label containing a unique serial number and one-time claim ID. Field installers scan the QR code with the mobile app to register and activate the device.

### Serial Number Format

```
SHS-YYMM-MDL-BBB-SSSSS-C
 │    │    │   │    │    └─ check digit
 │    │    │   │    └────── sequential unit (00001-99999)
 │    │    │   └─────────── batch code (3 chars)
 │    │    └─────────────── model code
 │    └──────────────────── manufacture year-month
 └───────────────────────── product prefix
```

### Device Lifecycle

```
manufactured → unclaimed → claiming → active → lost / revoked / retired
```

| State | Description |
|-------|-------------|
| `manufactured` | Provisioned in factory, not yet shipped |
| `unclaimed` | Shipped and available for claim |
| `claiming` | Claim validation passed, assignment in progress |
| `active` | Installed and operational |
| `lost` | Reported lost or unresponsive |
| `revoked` | Admin-revoked (security or policy) |
| `retired` | End-of-life, decommissioned |

### Database Schema

The v2 schema (`database/schemas/shs_schema_v2.sql`) replaces the v1 signs-centric layout with a full device lifecycle model. Key tables:

- **devices** — hardware units with serial number, lifecycle status, hashed claim IDs
- **organizations** — customer accounts with billing and subscription tiers
- **organization_members** — role-based membership (owner, admin, installer, member)
- **sites** — physical locations (lots, garages) belonging to an organization
- **parking_spaces** — individual accessible spaces with ADA type classification
- **installations** — records of device-to-space assignments with photos and notes
- **device_events** — telemetry and lifecycle events
- **audit_logs** — immutable audit trail for all state changes

## Project Structure

```
smart-handicap-sign/
├── backend/
│   ├── app/
│   │   ├── config/          # Database, Azure, WorkOS configuration
│   │   ├── middleware/      # Auth, rate limiting middleware
│   │   ├── routes/          # API endpoints (FastAPI routers)
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Logging, helpers
│   │   └── main.py          # FastAPI application entry point
│   ├── tests/               # Pytest test suite
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/            # REST client (deviceClaims.ts, etc.)
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript definitions
│   │   └── screens/        # React Native screens (QRScan, Claim flow, etc.)
│   └── package.json
├── database/
│   └── schemas/
│       ├── shs_schema.sql      # v1 schema (legacy)
│       └── shs_schema_v2.sql   # v2 schema (device lifecycle)
├── docker-compose.yml
├── DESIGN.md
├── WORKOS_SETUP.md
└── AZURE_SETUP.md
```

## API Endpoints

### Authentication
- `GET /api/v1/auth/login` - Initiate OAuth
- `GET /api/v1/auth/callback` - OAuth callback
- `GET /api/v1/auth/me` - Current user
- `POST /api/v1/auth/logout` - Logout

### Profiles
- `GET /api/v1/profiles/:userId` - Get profile
- `PUT /api/v1/profiles/:userId` - Update profile
- `GET /api/v1/profiles/:userId/followers` - List followers
- `POST /api/v1/profiles/:userId/follow` - Follow user

### Posts
- `POST /api/v1/posts` - Create post
- `GET /api/v1/posts/feed/timeline` - Get feed
- `GET /api/v1/posts/user/:userId` - User posts
- `POST /api/v1/posts/:postId/like` - Like post

### Messages
- `GET /api/v1/messages` - Get conversations
- `GET /api/v1/messages/:id/messages` - Message history
- `POST /api/v1/messages/:id/messages` - Send message

### Uploads
- `POST /api/v1/uploads/profile-image` - Upload profile pic
- `POST /api/v1/uploads/post-image` - Upload post image

### Device Claims
- `POST /api/v1/device-claims/validate` - Validate serial + claim ID before committing
- `POST /api/v1/device-claims/claim` - Execute claim: assign device to org/site/space

### Devices
- `GET /api/v1/devices` - List devices (filter by org, lifecycle status)
- `GET /api/v1/devices/:serial` - Get device by serial number
- `POST /api/v1/devices/:serial/revoke` - Revoke a device (admin/owner)
- `POST /api/v1/devices/:serial/transfer` - Transfer to new site/space (admin/owner)
- `POST /api/v1/devices/:serial/release` - Release back to unclaimed (admin/owner)
- `POST /api/v1/devices/:serial/regenerate-claim` - Generate new claim ID (admin/owner)

### Sites
- `GET /api/v1/sites` - List sites (filter by org)
- `POST /api/v1/sites` - Create a site (admin/owner)
- `GET /api/v1/sites/:siteId` - Get site by ID

### Parking Spaces
- `GET /api/v1/sites/:siteId/parking-spaces` - List spaces for a site
- `POST /api/v1/sites/:siteId/parking-spaces` - Create a parking space
- `GET /api/v1/parking-spaces/:spaceId` - Get space by ID

## Technologies

**Backend:**
- Express.js
- TypeScript
- PostgreSQL
- WorkOS (Auth)
- Azure Blob Storage
- Azure Cache for Redis
- Socket.IO
- Multer (file uploads)

**Frontend:**
- React Native
- Expo
- TypeScript
- Zustand (state)
- React Navigation
- Axios
- Socket.IO Client

**Infrastructure:**
- Docker
- PostgreSQL
- Azure Cloud Services

## Running Tests

The backend test suite uses `pytest` and covers device claims, serial validation, lifecycle transitions, and security (IDOR, rate limiting, open redirect).

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```

Key test modules:

| File | Coverage |
|------|----------|
| `test_device_claims.py` | Claim validation and execution flow |
| `test_device_lifecycle.py` | State transitions (active → revoked, etc.) |
| `test_serial_validation.py` | Serial number format and check digit |
| `test_claim_id.py` | Claim ID hashing and one-time-use |
| `test_idor_events.py` | IDOR protection on event endpoints |
| `test_idor_notifications.py` | IDOR protection on notification endpoints |
| `test_idor_signs.py` | IDOR protection on sign/device endpoints |
| `test_inference_security.py` | AI inference endpoint security |
| `test_nginx_headers.py` | Security header validation |
| `test_open_redirect.py` | Open redirect prevention |

## Next Steps

The backend is fully implemented. To complete the application:

1. Implement frontend screens (Feed, Profile, Chat, etc.)
2. Add your actual WorkOS and Azure credentials
3. Test authentication flow
4. Test image uploads
5. Test real-time messaging

See `walkthrough.md` for detailed implementation guide.

## License

Proprietary
