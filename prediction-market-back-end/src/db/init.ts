import { getDb, isDatabaseConfigured } from './client.js';
import { runMigrations } from './migrate.js';
import { logger } from '../utils/logger.js';

export async function initDatabase() {
  if (!isDatabaseConfigured()) {
    logger.warn('DATABASE_URL not configured, skipping database initialization');
    return;
  }

  const sql = getDb();

  try {
    // Test connection
    await sql`SELECT 1`;
    logger.info('Database connection established');

    // Run migrations
    await runMigrations();

    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database');
    throw error;
  }
}

export { runMigrations, getMigrationStatus } from './migrate.js';
