// Database initialization script for deployment
// This script ensures tables exist in the production database
import { pool } from '../db/index.js';
import { execSync } from 'child_process';

async function initDatabase() {
  console.log('Checking database tables...');
  
  try {
    // Check if care_recipients table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = 'care_recipients'
      );
    `);
    
    const tableExists = checkResult.rows[0].exists;
    
    if (!tableExists) {
      console.log('Database tables missing. Creating schema...');
      
      try {
        // Run drizzle push to create the database schema
        console.log('Running drizzle-kit push to create schema...');
        execSync('npm run db:push', { stdio: 'inherit' });
        
        // Run the seed script
        console.log('Running database seed...');
        execSync('npm run db:seed', { stdio: 'inherit' });
        
        console.log('Database initialized successfully');
      } catch (execError) {
        console.error('Error running database commands:', execError);
        throw execError;
      }
    } else {
      console.log('Database tables already exist, skipping initialization');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Run database initialization
initDatabase()
  .then(() => {
    console.log('Database setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });