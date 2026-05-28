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
const signSeedPath = path.join(__dirname, '../seeds/dev_data_v2.sql');

if (!POSTGRES_CONNECTION_STRING) {
    console.error('❌ POSTGRES_CONNECTION_STRING environment variable is not set');
    process.exit(1);
}

async function loadPilotSign() {
    const client = new Client({
        connectionString: POSTGRES_CONNECTION_STRING,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        if (!fs.existsSync(signSeedPath)) {
            throw new Error(`Pilot sign SQL file not found: ${signSeedPath}`);
        }

        const seedSQL = fs.readFileSync(signSeedPath, 'utf-8');

        console.log(`⏳ Loading pilot sign: ${path.basename(signSeedPath)}...`);

        await client.query(seedSQL);

        console.log(`✅ Pilot sign loaded: ${path.basename(signSeedPath)}`);

        console.log('🎉 Pilot sign load completed successfully!');
    } catch (error) {
        console.error('❌ Pilot sign load failed:', error);
        process.exit(1);
    } finally {
        await client.end();
        console.log('🔌 Database connection closed');
    }
}

loadPilotSign();
