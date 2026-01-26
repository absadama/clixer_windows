/**
 * Environment Loader
 * MUST be imported FIRST before any other modules
 * that depend on environment variables
 */
import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
const envPath = path.resolve(__dirname, '../../../.env');

// IMPORTANT: override: true ensures .env values take precedence over existing env vars
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('Failed to load .env file from:', envPath);
  console.error('Error:', result.error.message);
} else {
  console.log('✓ Auth Service: Environment loaded from:', envPath);
}

// Export for verification
export const ENV_LOADED = true;
