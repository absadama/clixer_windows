// Jest setup - Set environment variables before tests
process.env.JWT_SECRET = 'test-jwt-secret-must-be-at-least-32-characters-long';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-ok';
