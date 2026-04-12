/* ═══════════════════════════════════════════════════════════════
   HANDY sQUAD — DIAGNOSTIC VERSION (logs everything)
═══════════════════════════════════════════════════════════════ */

console.log('🚀 app.js starting...');

// Failsafe: hide loading after 5 seconds
setTimeout(() => {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
  console.log('⏰ Failsafe: loading overlay hidden after 5s');
}, 5000);

// ─── SUPABASE INIT ─────────────────────────────────────────────
const SUPABASE_URL = 'https://zkzehotlgoroxdwwsjfx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpremVob3RsZ29yb3hkd3dzamZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MjgwNzIsImV4cCI6MjA5MTUwNDA3Mn0.JFkI_Lk5ReZDIht5yRsE57ALc-PRGobGxmJ67i48cSI';

let sb;
try {
  console.log('🔌 Creating Supabase client...');
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  console.log('✅ Supabase client created');
} catch (e) {
  console.error('❌ Supabase init failed:', e);
  document.getElementById('loading-overlay').style.display = 'none';
  alert('Failed to connect to backend. Check console for details.');
  throw e;
}

// ─── APP STATE ──────────────────────────────────────────────────
let STATE = {
  user: null,
  profile: null,
  role: null,
  currentPage: 'dashboard',
  data: {
    leads: [], jobs: [], quotations: [], payments: [],
    expenses: [], advances: [], fundReleases: [],
    dailyPlans: [], dailyReports: [], reworkRequests: [], siteVisits: []
  }
};
console.log('📦 STATE initialized');

// ─── HELPER FUNCTIONS ───────────────────────────────────────────
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    console.log('🔽 hideLoading() called');
  } else {
    console.warn('⚠️ #loading-overlay not found');
  }
}

function showAuth() {
  console.log('🔐 showAuth()');
  const authScreen = document.getElementById('auth-screen');
  const app = document.getElementById('app');
  console.log('authScreen element:', authScreen);
  console.log('app element:', app);
  if (authScreen) authScreen.style.display = 'flex';
  if (app) app.classList.remove('visible');
}

function showApp() {
  console.log('🏠 showApp()');
  const authScreen = document.getElementById('auth-screen');
  const app = document.getElementById('app');
  console.log('authScreen element:', authScreen);
  console.log('app element:', app);
  if (authScreen) authScreen.style.display = 'none';
  if (app) app.classList.add('visible');
  console.log('App visibility toggled');
  buildSidebar();
  renderPage('dashboard');
  loadAllData();
}

// ─── BOOT ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  console.log('📄 DOMContentLoaded fired');
  try {
    console.log('🔍 Checking Supabase session...');
    const { data: { session } } = await sb.auth.getSession();
    console.log('Session:', session);
    if (session) {
      STATE.user = session.user;
      console.log('👤 User found:', STATE.user.email);
      await loadProfile();
      showApp();
    } else {
      console.log('🚪 No session, showing auth');
      showAuth();
    }
  } catch (e) {
    console.error('❌ Boot error:', e);
    showAuth();
  } finally {
    hideLoading();
  }
});

sb.auth.onAuthStateChange(async (event, session) => {
  console.log('🔄 Auth state change:', event);
  if (event === 'SIGNED_IN' && session) {
    STATE.user = session.user;
    await loadProfile();
    showApp();
  } else if (event === 'SIGNED_OUT') {
    STATE.user = null; STATE.profile = null; STATE.role = null;
    showAuth();
  }
});

async function loadProfile() {
  console.log('👤 loadProfile() called');
  try {
    const { data, error } = await sb.from('users').select('*').eq('email', STATE.user.email).single();
    if (data && !error) {
      STATE.profile = data;
      STATE.role = data.role;
      console.log('✅ Profile loaded from DB:', STATE.role);
    } else {
      STATE.role = STATE.user.user_metadata?.role || 'sales';
      STATE.profile = {
        id: STATE.user.id,
        name: STATE.user.email.split('@')[0],
        role: STATE.role,
        email: STATE.user.email
      };
      console.warn('⚠️ Users table not found – using fallback. Role:', STATE.role);
    }
  } catch (e) {
    console.error('❌ Profile load error:', e);
    STATE.role = 'sales';
    STATE.profile = { name: STATE.user.email?.split('@')[0] || 'User', role: 'sales', email: STATE.user.email };
  }
}

async function handleLogin() {
  console.log('🔑 handleLogin()');
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const errEl = document.getElementById('auth-error');
  const btn = document.getElementById('login-btn');
  const btnTxt = document.getElementById('login-btn-text');
  errEl.style.display = 'none';
  if (!email || !pass) { showAuthError('Please enter email and password.'); return; }
  btn.disabled = true;
  btnTxt.innerHTML = '<div class="spinner"></div>';
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { showAuthError(error.message); btn.disabled = false; btnTxt.textContent = 'Sign In'; }
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg; el.style.display = 'block';
}

async function handleLogout() {
  console.log('🚪 handleLogout()');
  await sb.auth.signOut();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('auth-screen').style.display !== 'none') handleLogin();
});

// ─── DATA LOADING (simplified) ──────────────────────────────────
async function loadAllData() {
  console.log('📥 loadAllData()');
  // For diagnostic, just load essential data or skip if tables missing
  try {
    const { data: leads } = await sb.from('sales_leads').select('*').limit(10);
    STATE.data.leads = leads || [];
    console.log('Leads loaded:', STATE.data.leads.length);
  } catch (e) {
    console.warn('⚠️ sales_leads table missing or error:', e.message);
  }
  // Similar for other tables...
  renderPage(STATE.currentPage);
}

// ─── SIDEBAR & RENDER STUBS ─────────────────────────────────────
const NAV_CONFIG = {
  sales: [{ section: 'Overview', items: [{ id: 'dashboard', icon: '◈', label: 'Dashboard' }] }],
  scheduling: [{ section: 'Overview', items: [{ id: 'dashboard', icon: '◈', label: 'Dashboard' }] }],
  manager: [{ section: 'Overview', items: [{ id: 'dashboard', icon: '◈', label: 'Dashboard' }] }],
  accounts: [{ section: 'Overview', items: [{ id: 'dashboard', icon: '◈', label: 'Dashboard' }] }]
};

function buildSidebar() {
  console.log('📋 buildSidebar()');
  const role = STATE.role || 'sales';
  const nav = NAV_CONFIG[role] || NAV_CONFIG.sales;
  let html = '';
  nav.forEach(sec => {
    html += `<div class="nav-section-label">${sec.section}</div>`;
    sec.items.forEach(item => {
      html += `<div class="nav-item" onclick="renderPage('${item.id}')">
        <span class="nav-icon">${item.icon}</span><span>${item.label}</span>
      </div>`;
    });
  });
  document.getElementById('sidebar-nav').innerHTML = html;
  document.getElementById('sb-name').textContent = STATE.profile?.name || 'User';
  document.getElementById('sb-role').textContent = (role || 'sales').charAt(0).toUpperCase() + (role || 'sales').slice(1);
  document.getElementById('sb-avatar').textContent = (STATE.profile?.name || 'U').substring(0, 2).toUpperCase();
  document.getElementById('topbar-role').textContent = (role || 'sales').charAt(0).toUpperCase() + (role || 'sales').slice(1);
}

function renderPage(pageId) {
  console.log('📄 renderPage:', pageId);
  STATE.currentPage = pageId;
  buildSidebar();
  const el = document.getElementById('page-content');
  const titleEl = document.getElementById('topbar-title');
  titleEl.textContent = pageId.charAt(0).toUpperCase() + pageId.slice(1);
  el.innerHTML = `<div style="padding:20px"><h2>${pageId}</h2><p>This is the ${pageId} page.</p></div>`;
}

function renderDashboard() {
  return `<div style="padding:20px"><h2>Dashboard</h2><p>Welcome, ${STATE.profile?.name || 'User'}!</p></div>`;
}

// Stub functions for other renderers (to prevent errors)
const renderLeads = renderDashboard, renderJobs = renderDashboard, renderQuotations = renderDashboard;
const renderPayments = renderDashboard, renderPaymentHistory = renderDashboard, renderExpenses = renderDashboard;
const renderAdvances = renderDashboard, renderFundReleases = renderDashboard, renderRework = renderDashboard;
const renderSiteVisits = renderDashboard, renderDailyPlans = renderDashboard, renderDailyReports = renderDashboard;
const renderAdvanceBalance = renderDashboard, renderDelayedJobs = renderDashboard, renderFinalReports = renderDashboard;
const renderProfitOverview = renderDashboard, renderJobFinancials = renderDashboard;

// Placeholder functions for modals/actions
function openModal() { console.log('openModal called'); }
function openJobDetail() { console.log('openJobDetail called'); }
function showToast(msg, type) { console.log(`🔔 ${type}: ${msg}`); }

console.log('✅ app.js loaded completely');
