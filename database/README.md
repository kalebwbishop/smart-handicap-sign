# Database Documentation

## Overview
PostgreSQL database for the Mobile Stack application.

## Connection Details

### Development
- **Host**: localhost
- **Port**: 5432
- **Database**: mobile_stack_dev
- **User**: devuser
- **Password**: devpassword

### Access via Docker
```bash
# Start database
npm run db:up

# Connect with psql
docker exec -it mobile-stack-postgres psql -U devuser -d mobile_stack_dev

# Or use pgAdmin
# Open http://localhost:5050
# Email: admin@admin.com
# Password: admin
```

## Schema

### Tables

#### users
Stores user account information.
- `id` (UUID): Primary key
- `email` (VARCHAR): Unique email address
- `password_hash` (VARCHAR): Bcrypt hashed password
- `name` (VARCHAR): User's display name
- `avatar_url` (VARCHAR): Profile picture URL
- `is_verified` (BOOLEAN): Email verification status
- `created_at` (TIMESTAMP): Account creation time
- `updated_at` (TIMESTAMP): Last update time (auto-updated)

#### refresh_tokens
JWT refresh token storage for authentication.
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to users table
- `token` (VARCHAR): Refresh token (unique)
- `expires_at` (TIMESTAMP): Token expiration time
- `created_at` (TIMESTAMP): Token creation time
- `revoked` (BOOLEAN): Token revocation status

## Migrations

Migrations are stored in `migrations/` directory and should be run in order.

### Running Migrations
```bash
npm run db:migrate
```

### Creating New Migration
1. Create a new file: `migrations/00X_description.sql`
2. Write your SQL changes
3. Run migration command

## Seeding

Seed data for development is in `seeds/dev_data.sql`.

### Running Seeds
```bash
npm run db:seed
```

## Backup and Restore

### Backup
```bash
docker exec mobile-stack-postgres pg_dump -U devuser mobile_stack_dev > backup.sql
```

### Restore
```bash
cat backup.sql | docker exec -i mobile-stack-postgres psql -U devuser -d mobile_stack_dev
```

## Security Notes

⚠️ **Never commit production credentials!**
- Development credentials are in `.env.example`
- Production should use environment variables
- Use strong passwords in production
- Enable SSL for production connections

## Troubleshooting

### Cannot connect to database
1. Ensure Docker is running: `docker ps`
2. Check if container is healthy: `docker logs mobile-stack-postgres`
3. Verify connection string in backend `.env`

### Reset database
```bash
docker-compose down -v  # Remove volumes
docker-compose up -d postgres
npm run db:migrate
npm run db:seed
```
