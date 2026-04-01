/**
 * Integration tests for login flow app lifecycle
 * Tests the integration between auth.js, loginRenderer.js, and main.js IPC events
 */

const fs = require('fs');
const path = require('path');

// Mock localStorage for testing
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

// Mock window.electronAPI for testing
global.window = {
  electronAPI: {
    loginSuccess: jest.fn(),
    logout: jest.fn()
  }
};

// Import auth module
const auth = require('../src/auth');

describe('Login Flow Integration', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    global.localStorage.clear();
    
    // Clear mock calls
    global.window.electronAPI.loginSuccess.mockClear();
    global.window.electronAPI.logout.mockClear();
    
    // Reset fetch mock
    global.fetch = jest.fn();
  });

  describe('Negative Tests - Malformed inputs', () => {
    test('Corrupted token in localStorage → validateToken returns null → login screen shown', async () => {
      // Set corrupted token
      localStorage.setItem('authToken', 'corrupted.invalid.token');
      
      // Mock 401 response
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ error: 'Invalid token' })
      });
      
      const result = await auth.validateToken();
      
      expect(result).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull(); // Token should be cleared
    });

    test('Token deleted from localStorage while app running → next authenticatedFetch returns 401 → logout triggered', async () => {
      // Set valid token initially
      localStorage.setItem('authToken', 'valid.jwt.token');
      
      // Mock 401 response for authenticated request
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' })
      });
      
      // Make authenticated request
      await auth.authenticatedFetch('/api/some-endpoint');
      
      // Verify logout was called
      expect(window.electronAPI.logout).toHaveBeenCalled();
      expect(localStorage.getItem('authToken')).toBeNull();
    });

    test('403 response triggers logout', async () => {
      // Set valid token
      localStorage.setItem('authToken', 'valid.jwt.token');
      
      // Mock 403 response
      global.fetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' })
      });
      
      // Make authenticated request
      await auth.authenticatedFetch('/api/protected');
      
      // Verify logout was called
      expect(window.electronAPI.logout).toHaveBeenCalled();
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });

  describe('Negative Tests - Error paths', () => {
    test('validateToken throws error (network timeout) → login screen shown after retry', async () => {
      // Set token
      localStorage.setItem('authToken', 'valid.jwt.token');
      
      // Mock network error
      global.fetch.mockRejectedValue(new Error('Network request failed'));
      
      const result = await auth.validateToken();
      
      expect(result).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull(); // Token cleared on error
    });

    test('authenticatedFetch without token throws error', async () => {
      // No token in localStorage
      localStorage.clear();
      
      await expect(auth.authenticatedFetch('/api/test')).rejects.toThrow('Not authenticated');
    });
  });

  describe('Logout functionality', () => {
    test('logout() clears token and triggers IPC event', () => {
      // Set token
      localStorage.setItem('authToken', 'valid.jwt.token');
      
      // Call logout
      auth.logout();
      
      // Verify token cleared
      expect(localStorage.getItem('authToken')).toBeNull();
      
      // Verify IPC event triggered
      expect(window.electronAPI.logout).toHaveBeenCalled();
    });

    test('logout() works even if electronAPI is not available', () => {
      // Set token
      localStorage.setItem('authToken', 'valid.jwt.token');
      
      // Temporarily remove electronAPI
      const originalAPI = global.window.electronAPI;
      delete global.window.electronAPI;
      
      // Call logout - should not throw
      expect(() => auth.logout()).not.toThrow();
      
      // Verify token still cleared
      expect(localStorage.getItem('authToken')).toBeNull();
      
      // Restore API
      global.window.electronAPI = originalAPI;
    });
  });

  describe('Successful login flow', () => {
    test('Successful login stores token and does NOT trigger loginSuccess (handled by loginRenderer)', async () => {
      // Mock successful login response
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: 'new.jwt.token',
          userId: 123,
          username: 'testuser'
        })
      });
      
      const result = await auth.login('testuser', 'password123');
      
      expect(result).toEqual({
        userId: 123,
        username: 'testuser'
      });
      
      expect(localStorage.getItem('authToken')).toBe('new.jwt.token');
      
      // loginSuccess should be called by loginRenderer, not auth module
      expect(window.electronAPI.loginSuccess).not.toHaveBeenCalled();
    });

    test('Valid token on startup → validateToken returns user', async () => {
      localStorage.setItem('authToken', 'valid.jwt.token');
      
      // Mock successful validation
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: 456,
          username: 'existinguser'
        })
      });
      
      const result = await auth.validateToken();
      
      expect(result).toEqual({
        userId: 456,
        username: 'existinguser'
      });
    });
  });
});
