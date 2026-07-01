import { Client } from 'pg';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../../backend/.env');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const POSTGRES_CONNECTION_STRING =
    process.env.POSTGRES_CONNECTION_STRING ??
    process.env.DATABASE_URL;

if (!POSTGRES_CONNECTION_STRING) {
    console.error('POSTGRES_CONNECTION_STRING environment variable is not set');
    process.exit(1);
}

const connectionString = POSTGRES_CONNECTION_STRING;

function resolveSslConfig(connectionString: string) {
    if (process.env.NODE_ENV === 'production') {
        return { rejectUnauthorized: true };
    }

    if (connectionString.includes('azure.com')) {
        return { rejectUnauthorized: false };
    }

    return undefined;
}

async function migrateLastSeenAt() {
    const client = new Client({
        connectionString,
        ssl: resolveSslConfig(connectionString),
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected to database');

        await client.query(`
            DO $$
            BEGIN
                CREATE TYPE device_connectivity_status AS ENUM ('online', 'offline');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END
            $$;

            ALTER TABLE devices
            ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

            ALTER TABLE devices
            ADD COLUMN IF NOT EXISTS connectivity_status device_connectivity_status NOT NULL DEFAULT 'online';

            CREATE INDEX IF NOT EXISTS idx_devices_connectivity ON devices(connectivity_status);
        `);

        console.log('last_seen_at/connectivity_status migration applied successfully');
    } catch (error) {
        console.error('last_seen_at/connectivity_status migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('Database connection closed');
    }
}

migrateLastSeenAt();
