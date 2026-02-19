import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const POSTGRES_CONNECTION_STRING = process.env.POSTGRES_CONNECTION_STRING;

if (!POSTGRES_CONNECTION_STRING) {
    console.error('❌ POSTGRES_CONNECTION_STRING environment variable is not set');
    process.exit(1);
}

async function runSeeds() {
    const client = new Client({
        connectionString: POSTGRES_CONNECTION_STRING,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected to database');

        // Get all seed files from the seeds directory
        const seedsDir = path.join(__dirname, '../../seeds');
        const seedFiles = fs
            .readdirSync(seedsDir)
            .filter(file => file.endsWith('.sql'))
            .sort(); // Sort to ensure seeds run in order

        console.log(`📁 Found ${seedFiles.length} seed file(s)`);

        // Warn if running in production
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️  WARNING: You are running seeds in production environment!');
            console.warn('⚠️  This should only be done if you are certain this is safe.');
        }

        // Run each seed file
        for (const seedFile of seedFiles) {
            const seedPath = path.join(seedsDir, seedFile);
            const seedSQL = fs.readFileSync(seedPath, 'utf-8');

            console.log(`⏳ Running seed: ${seedFile}...`);

            await client.query(seedSQL);

            console.log(`✅ Seed completed: ${seedFile}`);
        }

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
