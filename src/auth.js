/**
 * auth.js
 * Client-side authentication module for Electron renderer process
 * Handles login, registration, token storage, and authenticated API requests
 */

const AUTH_TOKEN_KEY = 'authToken';
const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Register a new user account
 * @param {string} username - Username (3-20 alphanumeric characters or underscore)
 * @param {string} password - Password (minimum 8 characters)
 * @returns {Promise<{userId: number, username: string}>} User object on success
 * @throws {Error} Registration error with message from backend
 */
async function register(username, password) {
  try {
    console.log(`[Auth] Registering user: ${username}`);
    
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`[Auth] Registration failed: ${data.error}`);
      throw new Error(data.error || 'Registration failed');
    }
    
    console.log(`[Auth] Registration successful for user: ${username} (ID: ${data.userId})`);
    
    // Registration endpoint doesn't return token - need to login separately
    // This matches the backend implementation
    return data;
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    throw error;
  }
}

/**
 * Login with existing credentials
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<{userId: number, username: string}>} User object on success
 * @throws {Error} Login error with message from backend
 */
async function login(username, password) {
  try {
    console.log(`[Auth] Logging in user: ${username}`);
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.log(`[Auth] Login failed: ${data.error}`);
      throw new Error(data.error || 'Login failed');
    }
    
    // Store JWT token in localStorage
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    console.log(`[Auth] Login successful for user: ${username} (ID: ${data.userId})`);
    console.log(`[Auth] Token stored in localStorage`);
    
    return {
      userId: data.userId,
      username: data.username,
    };
  } catch (error) {
    console.error('[Auth] Login error:', error);
    throw error;
  }
}

/**
 * Validate stored token and retrieve current user
 * @returns {Promise<{userId: number, username: string}|null>} User object if token valid, null if invalid/missing
 */
async function validateToken() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    
    if (!token) {
      console.log('[Auth] No token found in localStorage');
      return null;
    }
    
    console.log('[Auth] Validating token...');
    
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      console.log(`[Auth] Token validation failed: ${response.status} ${response.statusText}`);
      
      // Token invalid or expired - clear localStorage
      if (response.status === 401 || response.status === 403) {
        console.log('[Auth] Token expired or invalid, clearing localStorage');
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
      
      return null;
    }
    
    const data = await response.json();
    console.log(`[Auth] Token valid for user: ${data.username} (ID: ${data.userId})`);
    
    return {
      userId: data.userId,
      username: data.username,
    };
  } catch (error) {
    console.error('[Auth] Token validation error:', error);
    
    // On network error or malformed response, clear token and return null
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return null;
  }
}

/**
 * Logout current user - clear stored token
 */
function logout() {
  console.log('[Auth] Logging out, clearing token');
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Authenticated fetch wrapper that adds Bearer token to requests
 * Automatically clears token on 401/403 responses
 * @param {string} url - URL to fetch (relative to API_BASE_URL or absolute)
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If no token available or fetch fails
 */
async function authenticatedFetch(url, options = {}) {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  
  if (!token) {
    console.error('[Auth] No token available for authenticated request');
    throw new Error('Not authenticated');
  }
  
  // Add Authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };
  
  // Make full URL if relative
  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  
  console.log(`[Auth] Authenticated request to: ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
    });
    
    // Detect token expiration
    if (response.status === 401 || response.status === 403) {
      console.log('[Auth] Authentication failed (401/403), clearing token');
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    
    return response;
  } catch (error) {
    console.error('[Auth] Authenticated fetch error:', error);
    throw error;
  }
}

/**
 * Get current auth token from localStorage
 * @returns {string|null} JWT token or null if not logged in
 */
function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Export auth module functions
if (typeof module !== 'undefined' && module.exports) {
  // Node.js/CommonJS environment (for tests)
  module.exports = {
    register,
    login,
    validateToken,
    logout,
    authenticatedFetch,
    getToken,
  };
}

// Also expose globally for browser environment
if (typeof window !== 'undefined') {
  window.auth = {
    register,
    login,
    validateToken,
    logout,
    authenticatedFetch,
    getToken,
  };
}
