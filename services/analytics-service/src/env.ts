/**
 * Environment Loader
 * MUST be imported FIRST before any other modules
 */
import dotenv from 'dotenv';
import path from 'path';

const envPath = path.resolve(__dirname, '../../../.env');
dotenv.config({ path: envPath, override: true });

console.log('✓ Analytics Service: Environment loaded');

export const ENV_LOADED = true;
