// Global test setup - runs once before all test files
// This ensures JWT_SECRET is set before any modules are loaded
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';

console.log('[TEST SETUP] JWT_SECRET set:', process.env.JWT_SECRET);
console.log('[TEST SETUP] NODE_ENV set:', process.env.NODE_ENV);
