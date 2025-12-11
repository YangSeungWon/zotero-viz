/* ===========================================
   Authentication Module
   =========================================== */

const AUTH_KEY = 'app_api_key';

// Check if user is authenticated
async function checkAuth() {
  const key = localStorage.getItem(AUTH_KEY);
  if (!key) {
    return false;
  }

  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return true;
    } else {
      // Invalid key, clear it
      localStorage.removeItem(AUTH_KEY);
      return false;
    }
  } catch (e) {
    console.error('Auth check failed:', e);
    return false;
  }
}

// Verify API key
async function verifyApiKey(key) {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'X-API-Key': key,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (response.ok && data.success) {
      localStorage.setItem(AUTH_KEY, key);
      return { success: true };
    } else {
      return { success: false, error: data.error || 'Invalid API key' };
    }
  } catch (e) {
    return { success: false, error: 'Server connection failed' };
  }
}

// Logout
function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

// Initialize login UI
function initLoginUI() {
  const overlay = document.getElementById('loginOverlay');
  const form = document.getElementById('loginForm');
  const input = document.getElementById('loginApiKey');
  const btn = document.getElementById('loginBtn');
  const errorEl = document.getElementById('loginError');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const key = input.value.trim();
    if (!key) return;

    btn.disabled = true;
    btn.textContent = 'Verifying...';
    errorEl.textContent = '';

    const result = await verifyApiKey(key);

    if (result.success) {
      overlay.classList.add('hidden');
      // Initialize the app after successful login
      if (typeof initApp === 'function') {
        initApp();
      }
    } else {
      errorEl.textContent = result.error;
      btn.disabled = false;
      btn.textContent = 'Login';
      input.select();
    }
  });

  // Focus input
  input.focus();
}

// Main auth flow
async function initAuth() {
  const overlay = document.getElementById('loginOverlay');

  const isAuthenticated = await checkAuth();

  if (isAuthenticated) {
    // Already authenticated, hide overlay and init app
    overlay.classList.add('hidden');
    if (typeof initApp === 'function') {
      initApp();
    }
  } else {
    // Show login form
    initLoginUI();
  }
}

// Run auth check on page load
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons immediately
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  initAuth();
});
