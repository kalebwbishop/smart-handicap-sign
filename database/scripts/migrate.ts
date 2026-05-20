console.error(
    '❌ scripts/migrate.ts is deprecated because it used to apply every schema file in database/schemas destructively.\n' +
    'Use `npm run migrate` (or `npm run migrate:v2`) instead.'
);
process.exit(1);
