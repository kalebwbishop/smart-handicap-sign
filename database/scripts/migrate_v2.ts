import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../../backend/.env');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const POSTGRES_CONNECTION_STRING =
    process.env.POSTGRES_CONNECTION_STRING ??
    process.env.DATABASE_URL ??
    'postgresql://localhost:5432/smart_handicap_sign';

const schemaPath = path.join(__dirname, '../schemas/shs_schema_v2.sql');

async function migrateToV2() {
    const client = new Client({
        connectionString: POSTGRES_CONNECTION_STRING,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema file not found: ${schemaPath}`);
        }

        const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

        console.log('⚠️  Applying canonical schema reset (destructive bootstrap)...');
        await client.query(schemaSQL);

        console.log('✅ Schema applied successfully');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

migrateToV2();
