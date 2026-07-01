import { execSync } from 'node:child_process';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

const repoRoot = path.resolve(__dirname, '..');
const envPath = path.resolve(__dirname, '../../backend/.env');
const schemaPath = path.join(repoRoot, 'prisma', 'schema.prisma');
console.log(`Loading environment from: ${envPath}`);
dotenv.config({ path: envPath });

const connectionString =
    process.env.POSTGRES_CONNECTION_STRING ??
    process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ POSTGRES_CONNECTION_STRING environment variable is not set');
    process.exit(1);
}

if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Prisma schema file not found: ${schemaPath}`);
    process.exit(1);
}

process.env.POSTGRES_CONNECTION_STRING = connectionString;
process.env.DATABASE_URL = connectionString;

try {
    console.log('🔌 Applying Prisma migrations...');
    execSync(`npx prisma migrate deploy --schema "${schemaPath}"`, {
        cwd: repoRoot,
        env: process.env,
        stdio: 'inherit',
        shell: true,
    });
    console.log('✅ Prisma migrations applied successfully');
} catch (error) {
    console.error('❌ Prisma migration failed:', error);
    process.exit(1);
}
