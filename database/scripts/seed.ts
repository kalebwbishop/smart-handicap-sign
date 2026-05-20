import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const envPath = path.resolve(__dirname, '../../backend/.env');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const POSTGRES_CONNECTION_STRING =
    process.env.POSTGRES_CONNECTION_STRING ??
    process.env.DATABASE_URL;
const seedPath = path.join(__dirname, '../seeds/dev_data_v2.sql');

if (!POSTGRES_CONNECTION_STRING) {
    console.error('❌ POSTGRES_CONNECTION_STRING environment variable is not set');
    process.exit(1);
}

async function runSeeds() {
    const client = new Client({
        connectionString: POSTGRES_CONNECTION_STRING,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        // Warn if running in production
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: You are running seeds in production environment!');
            console.warn('⚠️  This should only be done if you are certain this is safe.');
        }

        if (!fs.existsSync(seedPath)) {
            throw new Error(`Seed file not found: ${seedPath}`);
        }

        const seedSQL = fs.readFileSync(seedPath, 'utf-8');

        console.log(`⏳ Running seed: ${path.basename(seedPath)}...`);

        await client.query(seedSQL);

        console.log(`✅ Seed completed: ${path.basename(seedPath)}`);

        console.log('🎉 All seeds completed successfully!');
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

// Run seeds
runSeeds();
