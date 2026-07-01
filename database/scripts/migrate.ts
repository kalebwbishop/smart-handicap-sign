console.error(
    '❌ scripts/migrate.ts is deprecated because it used to apply every schema file in database/schemas destructively.\n' +
    'Use `npm run migrate` for Prisma-managed migrations or `npm run migrate:reset` for the destructive bootstrap path.'
);
process.exit(1);
