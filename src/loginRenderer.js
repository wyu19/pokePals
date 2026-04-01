/**
 * loginRenderer.js
 * Client-side form validation and mode toggle logic for login/register UI
 */

// Form mode state
let currentMode = 'login'; // 'login' or 'register'

// DOM elements
const form = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitButton = document.querySelector('.submit-button');
const submitText = document.getElementById('submit-text');
const modeToggleLink = document.getElementById('mode-toggle-link');
const errorContainer = document.getElementById('error-message');
const modeLabel = document.getElementById('auth-mode-label');
const togglePrompt = document.querySelector('.toggle-prompt');

// Validation patterns
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/;
const PASSWORD_MIN_LENGTH = 8;

/**
 * Initialize event listeners
 */
function init() {
  form.addEventListener('submit', handleSubmit);
  modeToggleLink.addEventListener('click', handleModeToggle);
  
  // Real-time validation feedback
  usernameInput.addEventListener('input', validateUsername);
  passwordInput.addEventListener('input', validatePassword);
  
  // Clear error on input change
  usernameInput.addEventListener('input', clearError);
  passwordInput.addEventListener('input', clearError);
  
  console.log('[Auth UI] Login form initialized in login mode');
}

/**
 * Handle form submission
 * @param {Event} e - Submit event
 */
function handleSubmit(e) {
  e.preventDefault();
  
  console.log(`[Auth UI] Form submission attempted in ${currentMode} mode`);
  
  clearError();
  
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  
  // Validate username
  if (!username) {
    showError('Trainer ID is required');
    console.log('[Auth UI] Validation failed: empty username');
    return;
  }
  
  if (!USERNAME_PATTERN.test(username)) {
    showError('Trainer ID must be 3-20 characters (letters, numbers, underscore only)');
    console.log('[Auth UI] Validation failed: invalid username pattern');
    return;
  }
  
  // Validate password
  if (!password) {
    showError('Access code is required');
    console.log('[Auth UI] Validation failed: empty password');
    return;
  }
  
  if (password.length < PASSWORD_MIN_LENGTH) {
    showError(`Access code must be at least ${PASSWORD_MIN_LENGTH} characters`);
    console.log('[Auth UI] Validation failed: password too short');
    return;
  }
  
  // All validation passed
  console.log(`[Auth UI] Validation passed for ${currentMode} mode`);
  console.log(`[Auth UI] Username: ${username}, Password length: ${password.length}`);
  
  // In T02, this will call the actual auth API
  // For now, just log success
  showSuccess(`${currentMode === 'login' ? 'Login' : 'Registration'} validation successful!`);
}

/**
 * Validate username field
 */
function validateUsername() {
  const username = usernameInput.value.trim();
  
  if (username && !USERNAME_PATTERN.test(username)) {
    usernameInput.setCustomValidity('Invalid trainer ID format');
  } else {
    usernameInput.setCustomValidity('');
  }
}

/**
 * Validate password field
 */
function validatePassword() {
  const password = passwordInput.value;
  
  if (password && password.length < PASSWORD_MIN_LENGTH) {
    passwordInput.setCustomValidity('Password too short');
  } else {
    passwordInput.setCustomValidity('');
  }
}

/**
 * Handle mode toggle between login and register
 * @param {Event} e - Click event
 */
function handleModeToggle(e) {
  e.preventDefault();
  
  currentMode = currentMode === 'login' ? 'register' : 'login';
  
  console.log(`[Auth UI] Mode toggled to: ${currentMode}`);
  
  // Update UI labels
  if (currentMode === 'register') {
    submitText.textContent = 'REGISTER';
    modeLabel.textContent = 'CREATE NEW PROFILE';
    modeToggleLink.textContent = 'Already registered? Login';
    togglePrompt.textContent = 'Have access?';
    passwordInput.setAttribute('autocomplete', 'new-password');
  } else {
    submitText.textContent = 'LOGIN';
    modeLabel.textContent = 'INITIALIZE CONNECTION';
    modeToggleLink.textContent = 'Create new profile';
    togglePrompt.textContent = 'Need access?';
    passwordInput.setAttribute('autocomplete', 'current-password');
  }
  
  // Clear form and errors
  form.reset();
  clearError();
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  errorContainer.textContent = `⚠ ${message}`;
  errorContainer.classList.add('visible');
  errorContainer.setAttribute('aria-live', 'assertive');
  
  console.log(`[Auth UI] Error displayed: ${message}`);
}

/**
 * Show success message (temporary, for testing)
 * @param {string} message - Success message
 */
function showSuccess(message) {
  errorContainer.textContent = `✓ ${message}`;
  errorContainer.classList.add('visible');
  errorContainer.style.background = 'rgba(0, 255, 136, 0.1)';
  errorContainer.style.borderColor = 'rgba(0, 255, 136, 0.3)';
  errorContainer.style.color = 'var(--success-green)';
  
  console.log(`[Auth UI] Success: ${message}`);
}

/**
 * Clear error message
 */
function clearError() {
  errorContainer.classList.remove('visible');
  errorContainer.textContent = '';
  errorContainer.style.background = '';
  errorContainer.style.borderColor = '';
  errorContainer.style.color = '';
  errorContainer.setAttribute('aria-live', 'polite');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
