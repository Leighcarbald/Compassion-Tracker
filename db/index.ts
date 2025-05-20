import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// This is the correct way neon config - DO NOT change this
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection options with proper SSL handling for production environments
// Add validation and logging for database URL
const dbUrl = process.env.DATABASE_URL;

// Validate database URL format
if (!dbUrl || !dbUrl.includes('://')) {
  // Create a more helpful error message for debugging
  const partialUrl = dbUrl ? dbUrl.substring(0, Math.min(10, dbUrl.length)) + '...' : 'empty';
  console.error(`[DATABASE ERROR] Invalid DATABASE_URL format detected: ${partialUrl}`);
  
  if (process.env.NODE_ENV === 'production') {
    console.error('[DATABASE ERROR] In production, make sure the complete PostgreSQL connection string is set as DATABASE_URL');
    console.error('[DATABASE ERROR] Format should be: postgresql://username:password@hostname:port/database');
  } else {
    console.error('[DATABASE ERROR] For local development, check your environment variables');
  }
  
  // Throw a clear error
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
}

// Log database connection attempt (without sensitive info)
const dbUrlParts = new URL(dbUrl);
console.log(`Attempting to connect to database at ${dbUrlParts.host} (${dbUrlParts.protocol})`);

const connectionOptions = {
  connectionString: dbUrl,
  // Enable SSL for production environment (typically needed for Render and other cloud platforms)
  ...(process.env.NODE_ENV === 'production' && {
    ssl: {
      rejectUnauthorized: false // Required for many cloud database providers
    }
  })
};

console.log(`Connecting to database in ${process.env.NODE_ENV || 'development'} mode`);

export const pool = new Pool(connectionOptions);
export const db = drizzle({ client: pool, schema });