/* ═══════════════════════════════════════════════════════════════
   HANDY sQUAD — app.js
   Full role-based field management system
   Supabase backend · White & Blue design
═══════════════════════════════════════════════════════════════ */

// ─── SUPABASE INIT ─────────────────────────────────────────────
const SUPABASE_URL = 'https://zkzehotlgoroxdwwsjfx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpremVob3RsZ29yb3hkd3dzamZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjgwNzIsImV4cCI6MjA5MTUwNDA3Mn0.JFkI_Lk5ReZDIht5yRsE57ALc-PRGobGxmJ67i48cSI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── APP STATE ──────────────────────────────────────────────────
let STATE = {
  user: null,
  profile: null,
  role: null,
  currentPage: 'dashboard',
  data: {
    leads: [], jobs: [], quotations: [], payments: [],
    expenses: [], advances: [], fundReleases: [],
    dailyPlans: [], dailyReports: [], reworkRequests: [], siteVisits: [],
    allUsers: []
  }
};

// ─── BOOT ───────────────────────────────────────────────────────
async function boot() {
  const safetyTimer = setTimeout(() => { hideLoading(); showAuth(); }, 6000);
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    clearTimeout(safetyTimer);
    if (error || !session) {
      // Stale/invalid token — wipe it so user gets a clean login screen
      await sb.auth.signOut();
      showAuth();
    } else {
      STATE.user = session.user;
      await loadProfile();
      showApp();
    }
  } catch (e) {
    clearTimeout(safetyTimer);
    console.error('Boot error:', e);
    await sb.auth.signOut();
    showAuth();
  }
  hideLoading();
}

window.addEventListener('DOMContentLoaded', boot);

// Handle post-boot auth events (user-triggered login / logout)
sb.auth.onAuthStateChange(async (event, session) => {
  // SIGNED_IN during boot is handled by boot() directly — skip it
  // Only act on SIGNED_OUT (logout button) here
  if (event === 'SIGNED_OUT') {
    STATE.user = null; STATE.profile = null; STATE.role = null;
    showAuth();
  }
});

// ─── AUTH HELPERS ───────────────────────────────────────────────
function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}
function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').classList.remove('visible');
}
function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  buildSidebar();
  renderPage('dashboard');
  loadAllData();
}

async function loadProfile() {
  try {
    // Query by auth UUID (id) — more reliable than email
    const { data, error } = await sb.from('users').select('*').eq('id', STATE.user.id).maybeSingle();

    if (data) {
      STATE.profile = data;
      STATE.role = data.role;
      return;
    }

    // No row found — upsert so we never get a 409 conflict
    const name = STATE.user.user_metadata?.name || STATE.user.email.split('@')[0];
    const role = STATE.user.user_metadata?.role || 'sales';
    const { data: upserted, error: upsertError } = await sb.from('users').upsert({
      id: STATE.user.id,
      name,
      role,
      email: STATE.user.email,
      phone: STATE.user.user_metadata?.phone || null
    }, { onConflict: 'id' }).select().single();

    if (upserted) {
      STATE.profile = upserted;
      STATE.role = upserted.role;
    } else {
      console.warn('Upsert failed:', upsertError?.message);
      // Still set a valid in-memory profile with the real auth id
      STATE.role = role;
      STATE.profile = { id: STATE.user.id, name, role, email: STATE.user.email };
    }
  } catch (e) {
    console.error('loadProfile error:', e);
    STATE.role = 'sales';
    STATE.profile = { id: STATE.user?.id, name: STATE.user.email?.split('@')[0] || 'User', role: 'sales', email: STATE.user.email };
  }
}

function resetLoginBtn() {
  const btn = document.getElementById('login-btn');
  const btnTxt = document.getElementById('login-btn-text');
  if (btn) btn.disabled = false;
  if (btnTxt) btnTxt.textContent = 'Sign In';
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const btnTxt = document.getElementById('login-btn-text');
  document.getElementById('auth-error').style.display = 'none';
  if (!email || !pass) { showAuthError('Please enter email and password.'); return; }
  btn.disabled = true;
  btnTxt.innerHTML = '<div class="spinner"></div>';

  // Safety: always re-enable button after 10 seconds
  const loginSafety = setTimeout(() => {
    resetLoginBtn();
    showAuthError('Request timed out. Check your connection and try again.');
  }, 10000);

  try {
    const loginPromise = sb.auth.signInWithPassword({ email, password: pass });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 9000)
    );
    const { data, error } = await Promise.race([loginPromise, timeoutPromise]);
    clearTimeout(loginSafety);

    if (error) {
      showAuthError(error.message);
      resetLoginBtn();
      return;
    }
    if (data?.session) {
      STATE.user = data.session.user;
      await loadProfile();
      showApp();
      hideLoading();
    } else {
      showAuthError('No session returned. Try again.');
      resetLoginBtn();
    }
  } catch (e) {
    clearTimeout(loginSafety);
    if (e.message === 'timeout') {
      showAuthError('Connection timed out. Check your internet and try again.');
    } else {
      showAuthError('Login failed: ' + e.message);
    }
    resetLoginBtn();
  }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}

async function handleLogout() {
  await sb.auth.signOut();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') handleLogin();
});


// ─── MOBILE SIDEBAR ─────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('mob-overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('mob-overlay')?.classList.remove('open');
}

// ─── MANAGER BOTTOM NAV ──────────────────────────────────────────
function updateBottomNav(pageId) {
  if (STATE.role !== 'manager') return;
  const nav = document.getElementById('manager-bottom-nav');
  if (!nav) return;
  nav.style.display = 'flex';
  // Map pages to bottom nav ids
  const map = {
    'dashboard':'bnav-dashboard','jobs':'bnav-jobs',
    'daily-reports':'bnav-report','expenses':'bnav-expense',
    'quotations':'bnav-quote'
  };
  nav.querySelectorAll('.bnav-item').forEach(el => el.classList.remove('active'));
  const activeId = map[pageId];
  if (activeId) document.getElementById(activeId)?.classList.add('active');
}
