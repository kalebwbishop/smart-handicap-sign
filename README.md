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

## Terraform Deployment

The `terraform/` stack now targets **Azure Container Apps** instead of the old VM-based deployment. Terraform manages:

- Resource group `res000_0_shs` in `eastus`
- Log Analytics + Container Apps environment
- Backend Azure Container App
- User-assigned managed identity
- Azure Key Vault for sensitive runtime secrets

Custom domain and DNS management are handled outside Terraform. Keep `domain_name`, `frontend_url`, `workos_redirect_uri`, and `cors_origin` parameterized for the target environment instead of hardcoding a hostname into the stack.

### Remote state backend

Terraform state is configured to use Azure Blob Storage via Azure CLI authentication:

- Storage account: `deployboxsaprod`
- Container: `deploy-box-iac-storage`
- Key: `hazard-hero/terraform.tfstate`

Before running Terraform, make sure you are logged in with Azure CLI and that the storage container already exists:

```bash
az login
az account set --subscription 3d5d1ab2-b17f-4c99-9bf1-db4fe0ad882e
```

Your Azure principal also needs blob data access on that storage account/container (for example `Storage Blob Data Contributor`) before `terraform init -reconfigure` can read or migrate the remote state.

### Secrets

The Terraform stack now reads sensitive runtime values from pre-existing Azure Key Vault secrets in the configured vault:

- `postgres-connection-string`
- `workos-api-key`
- `workos-client-id`

Legacy Terraform variables like `postgres_connection_string`, `workos_api_key`, and `workos_client_id` are accepted for compatibility but ignored. Existing local `terraform.tfvars` entries for those values can be removed when convenient.

Do not reuse an old local `terraform/terraform.tfvars` from the VM deployment. Older copies may still contain SSH and TLS certificate settings that are no longer used by the Container App stack. Start from `terraform/terraform.tfvars.example` instead.

### GitHub Actions apply via OIDC

The repository includes `.github/workflows/ci-cd.yml`, which builds the backend container image, runs the database migration against the Key Vault PostgreSQL connection string, and then applies the Terraform stack on pushes to `main` that touch `backend/**`, `database/**`, `terraform/**`, or the workflow itself. It can also be started manually from `main`.

Before enabling it:

1. Create an Azure Entra application or service principal with a federated credential for GitHub Actions using the subject `repo:kalebwbishop/smart-handicap-sign:ref:refs/heads/main`.
2. Grant that principal:
   - `Contributor` on the Terraform target scope. Use the existing resource group `res000_0_shs` if it already exists, or the subscription if Terraform must create the resource group.
   - `Storage Blob Data Contributor` on the state storage account `deployboxsaprod` (or the `deploy-box-iac-storage` container) so Terraform can read and update the remote backend.
   - `AcrPush` on the Azure Container Registry `deployboxcrprod` so the workflow can push backend images.
   - `User Access Administrator` or `Role Based Access Control Administrator` on `deployboxcrprod` so Terraform can grant the Container App managed identity `AcrPull`.
   - `User Access Administrator` or `Role Based Access Control Administrator` on `hhhazardherokv` so Terraform can grant the deployer identity and the Container App managed identity the `Key Vault Secrets User` role.
3. Add repository variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID`.
4. Seed the three runtime secrets in Azure Key Vault before the full stack can deploy. On a brand-new environment, the first apply creates the vault and RBAC assignments; after that, add the secrets and rerun apply.

The workflow builds `backend/dockerfile` against the public `Deploy-Box/deploy-box-python` repo, pushes both `latest` and `${GITHUB_SHA}` tags to `deployboxcrprod.azurecr.io/hazard-hero-backend`, and passes the SHA-tagged image into Terraform so the deployed Container App revision matches the commit that triggered the workflow.

### Initialize and review changes

```bash
cd terraform
terraform init -reconfigure
terraform plan -var-file="terraform.tfvars"
```

### Legacy VM cleanup

The previous VM, network, and public IP resources are no longer defined in the Terraform configuration. When you run the migration plan against the historical state, Terraform should destroy those legacy resources. The old resource group `res000_0_4e69310cb4464d47` is not managed by the new configuration, so delete that resource group separately after confirming the legacy resources are gone.

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

The v2 schema (`database/schemas/shs_schema_v2.sql`) is the canonical database schema. It introduces the device lifecycle model while retaining legacy `signs`/`events` compatibility objects for the remaining backend code paths that still depend on them. Key tables:

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
