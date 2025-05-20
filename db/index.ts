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
const connectionOptions = {
  connectionString: process.env.DATABASE_URL,
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