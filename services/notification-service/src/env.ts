/**
 * Environment Loader
 * MUST be imported FIRST before any other modules
 * that depend on environment variables
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from project root
const envPath = path.resolve(__dirname, '../../../.env');

// Debug: Check if file exists and read JWT_SECRET directly
console.log('🔍 Checking env file at:', envPath);
console.log('🔍 File exists:', fs.existsSync(envPath));

// IMPORTANT: override: true ensures .env values take precedence over existing env vars
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('Failed to load .env file from:', envPath);
  console.error('Error:', result.error.message);
} else {
  console.log('✓ Environment loaded from:', envPath);
  // Debug: Show JWT_SECRET details
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret) {
    console.log('✓ JWT_SECRET: SET');
    console.log('  - Length:', jwtSecret.length, 'chars');
    console.log('  - First 5:', jwtSecret.substring(0, 5));
    console.log('  - Last 5:', jwtSecret.substring(jwtSecret.length - 5));
  } else {
    console.log('✗ JWT_SECRET: NOT SET!');
  }
}

// Export for verification
export const ENV_LOADED = true;
