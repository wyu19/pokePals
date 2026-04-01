/**
 * tests/auth.test.js
 * Unit tests for auth module - token storage, validation, expiration
 */

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store = {};
  
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;

// Mock fetch for testing
global.fetch = jest.fn();

// Import auth module
const auth = require('../src/auth');

describe('Auth Module', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Clear fetch mock
    fetch.mockClear();
  });
  
  describe('register()', () => {
    test('should call /api/auth/register with username and password', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 1, username: 'testuser' }),
      });
      
      const result = await auth.register('testuser', 'password123');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'password123' }),
        })
      );
      
      expect(result).toEqual({ userId: 1, username: 'testuser' });
    });
    
    test('should throw error when registration fails with 409 (username taken)', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Username already taken' }),
      });
      
      await expect(auth.register('existinguser', 'password123'))
        .rejects.toThrow('Username already taken');
    });
    
    test('should throw error when registration fails with 400 (invalid input)', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Username must be 3-20 alphanumeric characters or underscores' }),
      });
      
      await expect(auth.register('ab', 'password123'))
        .rejects.toThrow('Username must be 3-20 alphanumeric characters or underscores');
    });
  });
  
  describe('login()', () => {
    test('should store JWT token in localStorage on successful login', async () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          token: mockToken, 
          userId: 1, 
          username: 'testuser' 
        }),
      });
      
      const result = await auth.login('testuser', 'password123');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'testuser', password: 'password123' }),
        })
      );
      
      expect(result).toEqual({ userId: 1, username: 'testuser' });
      expect(localStorage.getItem('authToken')).toBe(mockToken);
    });
    
    test('should throw error when login fails with 401 (invalid credentials)', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid username or password' }),
      });
      
      await expect(auth.login('testuser', 'wrongpassword'))
        .rejects.toThrow('Invalid username or password');
      
      expect(localStorage.getItem('authToken')).toBeNull();
    });
    
    test('should throw error on network timeout', async () => {
      fetch.mockRejectedValueOnce(new Error('Network request failed'));
      
      await expect(auth.login('testuser', 'password123'))
        .rejects.toThrow('Network request failed');
      
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });
  
  describe('validateToken()', () => {
    test('should return user object if token is valid', async () => {
      const mockToken = 'valid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ userId: 1, username: 'testuser' }),
      });
      
      const result = await auth.validateToken();
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/auth/me',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Authorization': `Bearer ${mockToken}` },
        })
      );
      
      expect(result).toEqual({ userId: 1, username: 'testuser' });
      expect(localStorage.getItem('authToken')).toBe(mockToken); // Token not removed
    });
    
    test('should return null and clear token if no token in localStorage', async () => {
      const result = await auth.validateToken();
      
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
    
    test('should return null and clear token on 401 response (expired token)', async () => {
      const mockToken = 'expired.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Access token required' }),
      });
      
      const result = await auth.validateToken();
      
      expect(result).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull(); // Token cleared
    });
    
    test('should return null and clear token on 403 response (invalid token)', async () => {
      const mockToken = 'invalid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Invalid or expired token' }),
      });
      
      const result = await auth.validateToken();
      
      expect(result).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull(); // Token cleared
    });
    
    test('should return null and clear token on malformed response', async () => {
      const mockToken = 'valid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockRejectedValueOnce(new Error('Invalid JSON'));
      
      const result = await auth.validateToken();
      
      expect(result).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull(); // Token cleared on error
    });
  });
  
  describe('logout()', () => {
    test('should clear token from localStorage', () => {
      localStorage.setItem('authToken', 'some.jwt.token');
      
      auth.logout();
      
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });
  
  describe('authenticatedFetch()', () => {
    test('should add Bearer token header to requests', async () => {
      const mockToken = 'valid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });
      
      await auth.authenticatedFetch('/friends');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/friends',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });
    
    test('should handle full URLs (not relative)', async () => {
      const mockToken = 'valid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });
      
      await auth.authenticatedFetch('http://example.com/api/test');
      
      expect(fetch).toHaveBeenCalledWith(
        'http://example.com/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
          }),
        })
      );
    });
    
    test('should throw error if no token available', async () => {
      await expect(auth.authenticatedFetch('/friends'))
        .rejects.toThrow('Not authenticated');
    });
    
    test('should clear token on 401 response (token expired during request)', async () => {
      const mockToken = 'expired.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Access token required' }),
      });
      
      const response = await auth.authenticatedFetch('/friends');
      
      expect(response.status).toBe(401);
      expect(localStorage.getItem('authToken')).toBeNull(); // Token cleared
    });
    
    test('should clear token on 403 response (invalid token)', async () => {
      const mockToken = 'invalid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Invalid or expired token' }),
      });
      
      const response = await auth.authenticatedFetch('/friends');
      
      expect(response.status).toBe(403);
      expect(localStorage.getItem('authToken')).toBeNull(); // Token cleared
    });
    
    test('should preserve custom headers', async () => {
      const mockToken = 'valid.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'test' }),
      });
      
      await auth.authenticatedFetch('/friends', {
        headers: {
          'X-Custom-Header': 'value',
        },
      });
      
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/friends',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`,
            'X-Custom-Header': 'value',
          }),
        })
      );
    });
  });
  
  describe('getToken()', () => {
    test('should return token from localStorage', () => {
      const mockToken = 'test.jwt.token';
      localStorage.setItem('authToken', mockToken);
      
      expect(auth.getToken()).toBe(mockToken);
    });
    
    test('should return null if no token stored', () => {
      expect(auth.getToken()).toBeNull();
    });
  });
});
