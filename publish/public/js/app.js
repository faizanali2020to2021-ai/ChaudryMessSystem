/**
 * Chaudry Mess System - Single Page Application Client
 * Replicating Mobile Application Functionality, Business Logic, and Reports
 */

// Application State
const state = {
  user: null,
  persons: [],
  expenses: [],
  activeView: 'dashboard',
  activeReportTab: 'total-expense',
  currentReportData: null,
  selectedCategory: null
};

// Formatting utilities
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return 'Rs. ' + num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'number' ? new Date(dateInput) : new Date(dateInput);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateLong(dateInput) {
  if (!dateInput) return '';
  const d = typeof dateInput === 'number' ? new Date(dateInput) : new Date(dateInput);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function toInputDate(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonthDate() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  return toInputDate(firstDay);
}

// -----------------------------------------------------------------------------
// Prevent mouse scroll wheel from changing number input values
document.addEventListener('wheel', () => {
  if (document.activeElement && document.activeElement.type === 'number') {
    document.activeElement.blur();
  }
}, { passive: true });

// App Initialization
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initSidebar();
  setupDefaultDates();
  await loadPublicSystemInfo();

  // Session & Page Restore Logic on Refresh
  const savedUser = localStorage.getItem('chaudry_mess_user');
  if (savedUser) {
    try {
      state.user = JSON.parse(savedUser);
      applyUserIdentity();
      hideLoginModal();
      await loadPersons();
      await populateBatchFilter();

      // Restore active page/tab from URL hash or localStorage
      const hashView = window.location.hash ? window.location.hash.replace('#', '') : '';
      const savedView = hashView || localStorage.getItem('chaudry_mess_active_view') || 'dashboard';
      switchView(savedView);
    } catch (err) {
      console.warn('Session restore notice:', err);
      showLoginModal();
    }
  } else {
    showLoginModal();
  }
});

async function loadPublicSystemInfo() {
  try {
    const res = await fetch('/api/auth/system-info');
    const data = await res.json();
    if (data.success) {
      if (data.shopName) {
        document.getElementById('login-shop-name').textContent = data.shopName;
        document.getElementById('app-shop-name').textContent = data.shopName;
      }
      if (data.shopAddress) {
        document.getElementById('login-shop-address').textContent = data.shopAddress || 'Food Expense Manager & Reports';
        document.getElementById('app-shop-address').textContent = data.shopAddress || 'Mess Expense Manager';
      }
    }
  } catch (err) {
    console.warn('System info notice:', err.message);
  }
}

function initTheme() {
  const saved = localStorage.getItem('chaudry_mess_theme') || 'light';
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-text').textContent = 'Light Mode';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-text').textContent = 'Dark Mode';
  }
}

function initSidebar() {
  const isCollapsed = localStorage.getItem('chaudry_mess_sidebar_collapsed') === 'true';
  if (isCollapsed && window.innerWidth > 900) {
    document.body.classList.add('sidebar-collapsed');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  if (current === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('chaudry_mess_theme', 'light');
    document.getElementById('theme-text').textContent = 'Dark Mode';
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('chaudry_mess_theme', 'dark');
    document.getElementById('theme-text').textContent = 'Light Mode';
  }
}

function setupDefaultDates() {
  const todayStr = toInputDate(new Date());
  const startMonthStr = startOfMonthDate();

  const fromEl = document.getElementById('report-from-date');
  const toEl = document.getElementById('report-to-date');
  const expDateEl = document.getElementById('expense-input-date');

  if (fromEl) fromEl.value = startMonthStr;
  if (toEl) toEl.value = todayStr;
  if (expDateEl) expDateEl.value = todayStr;
}

function toggleSidebar() {
  const isMobile = window.innerWidth <= 900;
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if (isMobile) {
    const isOpen = sidebar.classList.toggle('open');
    if (backdrop) {
      backdrop.classList.toggle('active', isOpen);
    }
  } else {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('chaudry_mess_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

// -----------------------------------------------------------------------------
// Authentication & Roles
// -----------------------------------------------------------------------------
function showLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'flex';
  const pwInput = document.getElementById('login-password');
  if (pwInput) {
    pwInput.value = '';
    setTimeout(() => pwInput.focus(), 150);
  }
}

function hideLoginModal() {
  const modal = document.getElementById('login-modal');
  if (modal) modal.style.display = 'none';
}

function handleUserTypeChange() {
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
  const pwInput = document.getElementById('login-password');
  if (pwInput) {
    pwInput.value = '';
    pwInput.focus();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      state.user = data.user;
      localStorage.setItem('chaudry_mess_user', JSON.stringify(data.user));
      applyUserIdentity();
      hideLoginModal();
      await loadPersons();
      const hashView = window.location.hash ? window.location.hash.replace('#', '') : '';
      const savedView = hashView || localStorage.getItem('chaudry_mess_active_view') || 'dashboard';
      switchView(savedView);
    } else {
      errorEl.textContent = data.message || 'Invalid password';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    errorEl.textContent = 'Connection error: ' + err.message;
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  openLogoutModal();
}

function openLogoutModal() {
  const modal = document.getElementById('logout-dialog-modal');
  if (state.user && state.user.shopName) {
    document.getElementById('logout-shop-title').textContent = state.user.shopName;
  }
  modal.style.display = 'flex';
}

function closeLogoutModal() {
  const modal = document.getElementById('logout-dialog-modal');
  if (modal) modal.style.display = 'none';
}

function handleLogoutOverlayClick(e) {
  if (e.target && e.target.id === 'logout-dialog-modal') {
    closeLogoutModal();
  }
}

function confirmLogout() {
  closeLogoutModal();
  state.user = null;
  localStorage.removeItem('chaudry_mess_user');
  localStorage.removeItem('chaudry_mess_active_view');
  try {
    history.replaceState(null, '', window.location.pathname);
  } catch (_) {}
  const pwInput = document.getElementById('login-password');
  if (pwInput) pwInput.value = '';
  const errEl = document.getElementById('login-error');
  if (errEl) errEl.style.display = 'none';
  showLoginModal();
}


function applyUserIdentity() {
  if (!state.user) return;
  const name = state.user.shopName || 'Chaudry Mess System';
  const addr = state.user.shopAddress || '';
  const role = (state.user.role || 'user').toLowerCase();
  const isAdmin = role === 'admin';

  document.getElementById('app-shop-name').textContent = name;
  document.getElementById('app-shop-address').textContent = addr || 'Mess Expense Manager';
  document.getElementById('report-doc-shop-name').textContent = name;
  document.getElementById('report-doc-address').textContent = addr;
  document.getElementById('settings-shop-name').value = name;
  document.getElementById('settings-shop-address').value = addr;
  const compIdEl = document.getElementById('settings-company-id');
  if (compIdEl) compIdEl.value = state.user.companyId || 1;
  const logoChar = name.trim().charAt(0).toUpperCase() || 'C';
  document.getElementById('report-logo-char').textContent = logoChar;
  const logoEl = document.querySelector('.sidebar-logo');
  if (logoEl) logoEl.textContent = logoChar;
  const loginLogoEl = document.querySelector('#login-modal div[style*="border-radius: 50%"]');
  if (loginLogoEl) loginLogoEl.textContent = logoChar;
  const loginShopNameEl = document.getElementById('login-shop-name');
  if (loginShopNameEl) loginShopNameEl.textContent = name;
  const loginShopAddrEl = document.getElementById('login-shop-address');
  if (loginShopAddrEl) loginShopAddrEl.textContent = addr || 'Food Expense Manager & Reports';

  // Role badge in top-bar
  const roleBadge = document.getElementById('user-role-badge');
  if (roleBadge) {
    if (isAdmin) {
      roleBadge.className = 'badge badge-green';
      roleBadge.textContent = '👑 Admin (Full Access)';
    } else {
      roleBadge.className = 'badge badge-blue';
      roleBadge.textContent = '👤 User (Data Entry Only)';
    }
  }

  // Role display in sidebar
  const sidebarRole = document.getElementById('sidebar-user-role');
  if (sidebarRole) {
    sidebarRole.textContent = isAdmin ? '👑 Admin (Full Access)' : '👤 User (Data Entry Only)';
  }

  // Restrict Settings & Database Backup for standard user
  const navSettings = document.getElementById('nav-settings');
  if (navSettings) {
    navSettings.style.display = isAdmin ? 'flex' : 'none';
  }

  // Refresh active views so delete buttons update according to role
  if (state.activeView === 'expenses') loadExpenses();
  if (state.activeView === 'persons') loadPersonsTable();

  // Load active batch details
  loadActiveBatch();
}

// -----------------------------------------------------------------------------
// Navigation / View Switching
// -----------------------------------------------------------------------------
function switchView(viewName) {
  state.activeView = viewName;
  localStorage.setItem('chaudry_mess_active_view', viewName);
  try {
    if (window.location.hash !== `#${viewName}`) {
      history.replaceState(null, '', `#${viewName}`);
    }
  } catch (_) {}

  // Update navigation highlights
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  const viewTitles = {
    'dashboard': 'Dashboard',
    'expenses': 'Expenses List',
    'persons': 'Persons',
    'reports': 'Reports',
    'settings': 'Settings & Backup'
  };

  const currentNav = Array.from(navItems).find(item => item.textContent.trim().toLowerCase().includes(viewName));
  if (currentNav) currentNav.classList.add('active');

  document.getElementById('page-title').textContent = viewTitles[viewName] || 'Dashboard';

  // Toggle sections
  document.querySelectorAll('.app-view').forEach(v => v.style.display = 'none');
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.style.display = 'block';

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Trigger loads
  if (viewName === 'dashboard') loadDashboard();
  if (viewName === 'expenses') {
    populateBatchFilter().then(() => loadExpenses());
  }
  if (viewName === 'persons') loadPersonsTable();
  if (viewName === 'reports') {
    populateBatchFilter().then(() => switchReportTab(state.activeReportTab || 'total-expense'));
  }
  if (viewName === 'settings') loadDatabaseStatus();
}


// -----------------------------------------------------------------------------
// Dashboard
// -----------------------------------------------------------------------------
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();
    if (!data.success) return;

    // Stat cards
    document.getElementById('dash-total-expense').textContent = formatCurrency(data.overallSummary.totalExpense);
    document.getElementById('dash-total-paid').textContent = formatCurrency(data.overallSummary.totalPaid);

    // Person summary boxes
    const grid = document.getElementById('dashboard-persons-grid');
    grid.innerHTML = '';

    if (!data.personBalances || data.personBalances.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 30px; text-align: center; color: var(--text-muted);">No members found. Click "+ Add Person" to get started.</div>`;
      return;
    }

    data.personBalances.forEach(b => {
      const isPositive = b.remainingBalance >= 0;
      const cardClass = isPositive ? 'receivable' : 'payable';
      const arrowIcon = isPositive ? '▲' : '▼';
      const balanceLabel = isPositive ? 'Receivable' : 'Payable';

      const card = document.createElement('div');
      card.className = `person-card ${cardClass}`;
      card.onclick = () => {
        // Direct link to individual ledger report matching selected batch on dashboard
        const currentBatch = document.getElementById('dashboard-batch-select')?.value || '';
        switchView('reports');
        switchReportTab('person-detail-ledger');
        if (currentBatch && document.getElementById('report-batch-select')) {
          document.getElementById('report-batch-select').value = currentBatch;
        }
        document.getElementById('report-person-select').value = b.personId;
        generateActiveReport();
      };
      card.style.cursor = 'pointer';

      card.innerHTML = `
        <div class="person-card-name" title="${b.personName}">${b.personName}</div>
        <div class="person-card-row">
          <span>Expense:</span>
          <strong>${formatCurrency(b.totalShare)}</strong>
        </div>
        <div class="person-card-row">
          <span>Paid:</span>
          <strong>${formatCurrency(b.totalPaid)}</strong>
        </div>
        <div class="person-card-balance">
          <span>${arrowIcon}</span>
          <span>${formatCurrency(Math.abs(b.remainingBalance))}</span>
          <span style="font-size: 11px; font-weight: normal; margin-left: auto;">${balanceLabel}</span>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

// -----------------------------------------------------------------------------
// Persons Management
// -----------------------------------------------------------------------------
async function loadPersons() {
  try {
    const res = await fetch('/api/persons');
    const data = await res.json();
    if (data.success) {
      state.persons = data.persons || [];
      populatePersonSelects();
    }
  } catch (err) {
    console.error('Failed to load persons:', err);
  }
}

function populatePersonSelects() {
  const expenseFilter = document.getElementById('expense-filter-person');
  const paidBy = document.getElementById('expense-input-paid-by');
  const reportPerson = document.getElementById('report-person-select');
  const paymentPaidBy = document.getElementById('payment-input-paid-by');
  const paymentReceivedBy = document.getElementById('payment-input-received-by');
  const adjPaidBy = document.getElementById('adj-input-paid-by');
  const adjReceivedBy = document.getElementById('adj-input-received-by');

  // Preserve selections if possible
  const currentPaid = paidBy ? paidBy.value : '';
  const currentReport = reportPerson ? reportPerson.value : '';
  const currentPayPaid = paymentPaidBy ? paymentPaidBy.value : '';
  const currentPayRecv = paymentReceivedBy ? paymentReceivedBy.value : '';
  const currentAdjPaid = adjPaidBy ? adjPaidBy.value : '';
  const currentAdjRecv = adjReceivedBy ? adjReceivedBy.value : '';

  const optionsHtml = state.persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  if (expenseFilter) {
    expenseFilter.innerHTML = `<option value="">All Persons</option>` + optionsHtml;
  }

  if (paidBy) {
    paidBy.innerHTML = optionsHtml;
    if (currentPaid) paidBy.value = currentPaid;
  }

  updateReportPersonSelect(state.activeReportTab === 'day-wise');

  if (paymentPaidBy) {
    paymentPaidBy.innerHTML = optionsHtml;
    if (currentPayPaid) paymentPaidBy.value = currentPayPaid;
  }

  if (paymentReceivedBy) {
    paymentReceivedBy.innerHTML = optionsHtml;
    if (currentPayRecv) {
      paymentReceivedBy.value = currentPayRecv;
    } else if (state.persons.length > 1) {
      paymentReceivedBy.value = state.persons[1].id;
    }
  }

  if (adjPaidBy) {
    adjPaidBy.innerHTML = optionsHtml;
    if (currentAdjPaid) adjPaidBy.value = currentAdjPaid;
  }

  if (adjReceivedBy) {
    adjReceivedBy.innerHTML = optionsHtml;
    if (currentAdjRecv) {
      adjReceivedBy.value = currentAdjRecv;
    } else if (state.persons.length > 1) {
      adjReceivedBy.value = state.persons[1].id;
    }
  }
}

function updateReportPersonSelect(isAllAllowed) {
  const select = document.getElementById('report-person-select');
  if (!select) return;
  const currentVal = select.value;

  if (isAllAllowed) {
    let html = `<option value="">All (تمام ممبرز / سب)</option>`;
    html += state.persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    select.innerHTML = html;
    select.value = (currentVal && state.persons.some(p => String(p.id) === String(currentVal))) ? currentVal : '';
  } else {
    let html = state.persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    select.innerHTML = html;
    if (currentVal && state.persons.some(p => String(p.id) === String(currentVal))) {
      select.value = currentVal;
    } else if (state.persons.length > 0) {
      select.value = state.persons[0].id;
    }
  }
}

async function populateBatchFilter() {
  const batchSelect = document.getElementById('expense-filter-batch');
  const reportBatchSelect = document.getElementById('report-batch-select');
  if (!batchSelect && !reportBatchSelect) return;

  try {
    const res = await fetch('/api/batches');
    const data = await res.json();
    if (!data.success) return;

    const batches = data.batches || [];
    const activeBatch = batches.find(b => b.status === 'active');
    const defaultBatchId = (state.activeBatch && state.activeBatch.id)
      ? String(state.activeBatch.id)
      : (activeBatch ? String(activeBatch.id) : (batches[0] ? String(batches[0].id) : ''));

    const optionsHtml = '<option value="">All Batches (تمام بیچز)</option>' +
      batches.map(b => {
        const active = b.status === 'active' ? ' ✅' : ' 🔒';
        return `<option value="${b.id}">${b.name}${active}</option>`;
      }).join('');

    if (batchSelect) {
      const currentVal = batchSelect.value;
      batchSelect.innerHTML = optionsHtml;
      if (currentVal && batches.find(b => String(b.id) === currentVal)) {
        batchSelect.value = currentVal;
      } else if (defaultBatchId) {
        batchSelect.value = defaultBatchId;
      }
    }

    if (reportBatchSelect) {
      const currentVal = reportBatchSelect.value;
      reportBatchSelect.innerHTML = optionsHtml;
      if (currentVal && batches.find(b => String(b.id) === currentVal)) {
        reportBatchSelect.value = currentVal;
      } else if (defaultBatchId) {
        reportBatchSelect.value = defaultBatchId;
      }
    }
  } catch (err) {
    console.warn('Failed to populate batch filter:', err);
  }
}

async function loadPersonsTable() {
  await loadPersons();
  const tbody = document.getElementById('persons-table-body');
  tbody.innerHTML = '';

  if (state.persons.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No active members. Click "+ Add New Person" above.</td></tr>`;
    return;
  }

  const isAdmin = state.user && state.user.role === 'admin';
  state.persons.forEach((p, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.mobileNumber ? `<a href="https://wa.me/${p.mobileNumber.replace('+', '')}" target="_blank" style="color: var(--whatsapp-green); text-decoration: none; font-weight: 600;">${p.mobileNumber} 💬</a>` : '<span style="color: var(--text-muted); font-size: 12px;">Not set</span>'}</td>
      <td><span class="badge badge-green">Active</span></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-sm" onclick="openPersonModal('${p.id}')">Edit</button>
        ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deletePerson('${p.id}', '${p.name.replace(/'/g, "\\'")}')">Delete</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function openPersonModal(personId = null) {
  const modal = document.getElementById('person-modal');
  const title = document.getElementById('person-modal-title');
  const editIdInput = document.getElementById('person-edit-id');
  const nameInput = document.getElementById('person-input-name');
  const mobileInput = document.getElementById('person-input-mobile');

  if (personId !== null && personId !== undefined && String(personId).trim() !== '') {
    const person = state.persons.find(p => String(p.id) === String(personId));
    if (!person) {
      console.warn('Person not found for id:', personId);
      return;
    }
    title.textContent = 'Edit Person';
    editIdInput.value = person.id;
    nameInput.value = person.name;
    mobileInput.value = person.mobileNumber || '';
  } else {
    title.textContent = 'Add Person';
    editIdInput.value = '';
    nameInput.value = '';
    mobileInput.value = '';
  }

  modal.style.display = 'flex';
}

function closePersonModal() {
  document.getElementById('person-modal').style.display = 'none';
}

let isSavingPerson = false;
async function savePerson(e) {
  e.preventDefault();
  if (isSavingPerson) return;

  const id = document.getElementById('person-edit-id').value;
  const name = document.getElementById('person-input-name').value.trim();
  const mobileNumber = document.getElementById('person-input-mobile').value.trim();

  const form = document.getElementById('person-form');
  const btn = form ? form.querySelector('button[type="submit"]') : null;
  const origText = btn ? btn.textContent : 'Save Member';

  isSavingPerson = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const url = id ? `/api/persons/${id}` : '/api/persons';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mobileNumber })
    });
    const data = await res.json();

    if (data.success) {
      closePersonModal();
      await loadPersons();
      if (state.activeView === 'persons') loadPersonsTable();
      if (state.activeView === 'dashboard') loadDashboard();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to save person: ' + err.message);
  } finally {
    isSavingPerson = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

// -----------------------------------------------------------------------------
// Centered Beautiful Delete Dialog Handling
// -----------------------------------------------------------------------------
function closeDeleteModal() {
  const modal = document.getElementById('delete-dialog-modal');
  modal.style.display = 'none';
}

function handleDeleteOverlayClick(e) {
  if (e.target && e.target.id === 'delete-dialog-modal') {
    closeDeleteModal();
  }
}

async function deletePerson(id, name) {
  if (state.user && state.user.role === 'user') {
    alert('Permission denied: Users cannot delete members. Only Admin can delete.');
    return;
  }
  const modal = document.getElementById('delete-dialog-modal');
  const iconWrapper = document.getElementById('dialog-icon-wrapper');
  const titleEl = document.getElementById('dialog-title');
  const subtitleEl = document.getElementById('dialog-person-name');
  const msgEl = document.getElementById('dialog-message');
  const infoCard = document.getElementById('dialog-info-card');
  const paidCountEl = document.getElementById('dialog-paid-count');
  const shareCountEl = document.getElementById('dialog-share-count');
  const actionsEl = document.getElementById('dialog-actions');

  // Initial centered modal loading state
  iconWrapper.className = 'dialog-icon-circle warning';
  iconWrapper.textContent = '⏳';
  titleEl.textContent = 'Checking Records...';
  subtitleEl.textContent = name;
  msgEl.textContent = 'Checking database for existing expenses and member transaction history...';
  infoCard.style.display = 'none';
  actionsEl.innerHTML = `<button class="btn btn-secondary" onclick="closeDeleteModal()">Cancel</button>`;
  modal.style.display = 'flex';

  try {
    const res = await fetch(`/api/persons/${id}/check-delete`);
    const data = await res.json();

    if (!data.success) {
      iconWrapper.className = 'dialog-icon-circle danger';
      iconWrapper.textContent = '❌';
      titleEl.textContent = 'Error';
      msgEl.textContent = data.message || 'Could not verify member records.';
      actionsEl.innerHTML = `<button class="btn btn-primary" onclick="closeDeleteModal()">Close</button>`;
      return;
    }

    if (data.hasData) {
      // DATA EXISTS: DO NOT DELETE!
      iconWrapper.className = 'dialog-icon-circle warning';
      iconWrapper.textContent = '🛑';
      titleEl.textContent = 'Cannot Delete Member';
      subtitleEl.textContent = data.name;
      msgEl.textContent = 'This member cannot be deleted because active financial transaction data exists in the database. Deleting this member would corrupt report calculations and account balances.';
      
      paidCountEl.textContent = `${data.paidCount} transaction(s)`;
      shareCountEl.textContent = `${data.shareCount} shared expense(s)`;
      infoCard.style.display = 'block';

      actionsEl.innerHTML = `
        <button class="btn btn-primary" style="min-width: 170px;" onclick="closeDeleteModal()">Understood / Keep Records</button>
      `;
    } else {
      // ZERO DATA: SAFE TO DELETE
      iconWrapper.className = 'dialog-icon-circle danger';
      iconWrapper.textContent = '🗑️';
      titleEl.textContent = 'Delete Member?';
      subtitleEl.textContent = data.name;
      msgEl.textContent = 'This member has zero transaction history in the system. Are you sure you want to permanently delete this member?';
      infoCard.style.display = 'none';

      actionsEl.innerHTML = `
        <button class="btn btn-secondary" onclick="closeDeleteModal()">Cancel</button>
        <button class="btn btn-danger" onclick="executeDeletePerson(${id})">Yes, Delete Member</button>
      `;
    }
  } catch (err) {
    iconWrapper.className = 'dialog-icon-circle danger';
    iconWrapper.textContent = '❌';
    titleEl.textContent = 'Connection Error';
    msgEl.textContent = err.message;
    actionsEl.innerHTML = `<button class="btn btn-primary" onclick="closeDeleteModal()">Close</button>`;
  }
}

async function executeDeletePerson(id) {
  try {
    const res = await fetch(`/api/persons/${id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': state.user?.role || '' }
    });
    const data = await res.json();

    if (data.success) {
      closeDeleteModal();
      await loadPersons();
      if (state.activeView === 'persons') loadPersonsTable();
      if (state.activeView === 'dashboard') loadDashboard();
    } else {
      const iconWrapper = document.getElementById('dialog-icon-wrapper');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const actionsEl = document.getElementById('dialog-actions');
      
      iconWrapper.className = 'dialog-icon-circle warning';
      iconWrapper.textContent = '🛑';
      titleEl.textContent = 'Cannot Delete';
      msgEl.textContent = data.message;
      actionsEl.innerHTML = `<button class="btn btn-primary" onclick="closeDeleteModal()">Close</button>`;
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// Expenses (List, Add, Edit, Delete)
// -----------------------------------------------------------------------------
let filterTimer = null;
function debounceFilterExpenses() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(loadExpenses, 300);
}

function clearExpenseDateFilter() {
  const fromEl = document.getElementById('expense-from-date');
  const toEl = document.getElementById('expense-to-date');
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  loadExpenses();
}

async function loadExpenses() {
  const search = document.getElementById('expense-search').value.trim();
  const personId = document.getElementById('expense-filter-person').value;
  const batchId = document.getElementById('expense-filter-batch')?.value || '';
  const sortBy = document.getElementById('expense-sort-by').value;
  const fromStr = document.getElementById('expense-from-date')?.value || '';
  const toStr = document.getElementById('expense-to-date')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('searchQuery', search);
  if (personId) params.append('personId', personId);
  if (batchId) params.append('batchId', batchId);
  if (sortBy) params.append('sortBy', sortBy);
  if (fromStr) {
    const fromMillis = new Date(fromStr + 'T00:00:00').getTime();
    params.append('fromMillis', fromMillis);
  }
  if (toStr) {
    const toMillis = new Date(toStr + 'T23:59:59.999').getTime();
    params.append('toMillis', toMillis);
  }

  try {
    const res = await fetch(`/api/expenses?${params.toString()}`);
    const data = await res.json();
    if (!data.success) return;

    state.expenses = data.expenses || [];
    const tbody = document.getElementById('expenses-table-body');
    tbody.innerHTML = '';

    if (state.expenses.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">No expenses found matching the criteria.</td></tr>`;
      return;
    }

    const isAdmin = state.user && state.user.role === 'admin';
    const selectedPersonFilter = Number(document.getElementById('expense-filter-person')?.value) || 0;

    state.expenses.forEach(e => {
      const tr = document.createElement('tr');
      const isPayment = e.category === 'Payment';
      const isAdjustment = e.category === 'Opening Adjustment';
      const catBadge = isPayment
        ? `<span class="badge" style="background-color: #d1fae5; color: #065f46; font-weight: 600;">💳 Payment</span>`
        : (isAdjustment
        ? `<span class="badge" style="background-color: #fef3c7; color: #92400e; font-weight: 600;">⚖️ Opening Adj</span>`
        : (e.category ? `<span class="badge badge-primary">${e.category}</span>` : '<span style="color: var(--text-muted); font-size: 12px;">—</span>'));
      
      const batchLabel = e.batchName ? `<div style="font-size: 11px; color: var(--text-muted); font-weight: normal;">🏷️ ${e.batchName}</div>` : '';

      // Multi-payer and individual paid amounts resolution
      const payers = Array.isArray(e.payers) && e.payers.length > 0 ? e.payers : [];
      const isMultiPayer = payers.length > 1;

      let paidByHtml = e.paidByName;
      let displayAmount = e.amount;
      let amountSubHtml = '';

      if (selectedPersonFilter > 0) {
        // When filtered by a specific person, show only what that person paid!
        const myPayer = payers.find(p => Number(p.personId) === selectedPersonFilter);
        if (myPayer) {
          displayAmount = myPayer.amountPaid;
          paidByHtml = `<span style="font-weight: 600;">${myPayer.name}</span>`;
          if (isMultiPayer) {
            paidByHtml += ` <span class="badge" style="background:#e0e7ff; color:#3730a3; font-size:10px; padding:2px 6px; margin-left:4px;">👥 Multi</span>`;
            amountSubHtml = `<div style="font-size: 10px; color: var(--text-muted); font-weight: normal;">Total: ${formatCurrency(e.amount)}</div>`;
          }
        }
      } else if (isMultiPayer) {
        // When viewing all persons, show each payer with their exact amount!
        paidByHtml = `
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span class="badge" style="background:#e0e7ff; color:#3730a3; font-size:10px; padding:2px 6px; width:fit-content; margin-bottom:2px;">👥 Multi-Payer (${payers.length})</span>
            ${payers.map(p => `
              <div style="font-size:12.5px; white-space:nowrap;">
                <strong>${p.name}:</strong> <span style="color:#059669; font-weight:600;">${formatCurrency(p.amountPaid)}</span>
              </div>
            `).join('')}
          </div>
        `;
        amountSubHtml = `<div style="font-size: 10px; color: var(--text-muted); font-weight: normal;">Total Expense</div>`;
      }

      tr.innerHTML = `
        <td>${formatDate(Number(e.date))}</td>
        <td><strong>${e.description}</strong>${batchLabel}</td>
        <td>${catBadge}</td>
        <td>${paidByHtml}</td>
        <td style="text-align: right; font-weight: 700; ${isPayment ? 'color: #10B981;' : (isAdjustment ? 'color: #F59E0B;' : '')}">
          ${formatCurrency(displayAmount)}
          ${amountSubHtml}
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm" onclick="openExpenseModal(${e.id})">Edit</button>
          ${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="deleteExpense(${e.id})">Delete</button>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load expenses:', err);
  }
}

// -----------------------------------------------------------------------------
// Payment Modal & Actions (Member to Member Settlement)
// -----------------------------------------------------------------------------
function openPaymentModal() {
  const modal = document.getElementById('payment-modal');
  const dateInput = document.getElementById('payment-input-date');
  const amountInput = document.getElementById('payment-input-amount');
  const descInput = document.getElementById('payment-input-desc');

  populatePersonSelects();

  dateInput.value = toInputDate(new Date());
  amountInput.value = '';
  descInput.value = '';

  modal.style.display = 'flex';
}

function closePaymentModal() {
  const modal = document.getElementById('payment-modal');
  if (modal) modal.style.display = 'none';
}

let isSavingPayment = false;
async function savePayment(e) {
  e.preventDefault();
  if (isSavingPayment) return;

  const dateStr = document.getElementById('payment-input-date').value;
  const paidByPersonId = parseInt(document.getElementById('payment-input-paid-by').value, 10);
  const receivedByPersonId = parseInt(document.getElementById('payment-input-received-by').value, 10);
  const amount = parseFloat(document.getElementById('payment-input-amount').value);
  const description = document.getElementById('payment-input-desc').value.trim();

  if (!paidByPersonId) {
    alert('Please select who paid (Paid By).');
    return;
  }
  if (!receivedByPersonId) {
    alert('Please select who received (Received By).');
    return;
  }
  if (paidByPersonId === receivedByPersonId) {
    alert('Paid By and Received By cannot be the same person! Please select different members.');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid payment amount.');
    return;
  }

  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateMillis = dateObj.getTime();

  const payload = {
    dateMillis,
    paidByPersonId,
    receivedByPersonId,
    amount,
    description
  };

  const btn = document.getElementById('payment-submit-btn');
  const origText = btn ? btn.textContent : 'Save Payment';
  isSavingPayment = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const res = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closePaymentModal();
      if (state.activeView === 'expenses') loadExpenses();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'reports') generateActiveReport();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to record payment: ' + err.message);
  } finally {
    isSavingPayment = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

// Payer mode: 'single' or 'multi'
let currentPayerMode = 'single';

function setPayerMode(mode) {
  currentPayerMode = mode;
  document.getElementById('payer-mode-single-btn').classList.toggle('active', mode === 'single');
  document.getElementById('payer-mode-multi-btn').classList.toggle('active', mode === 'multi');
  document.getElementById('payer-single-section').style.display = mode === 'single' ? '' : 'none';
  document.getElementById('payer-multi-section').style.display = mode === 'multi' ? '' : 'none';
  // Remove "required" from single dropdown when in multi mode
  document.getElementById('expense-input-paid-by').required = (mode === 'single');
  if (mode === 'multi') renderMultiPayerInputs({});
}

function renderMultiPayerInputs(existingPayers) {
  // existingPayers: { personId: amountPaid }
  const container = document.getElementById('multi-payer-list');
  container.innerHTML = '';
  const total = parseFloat(document.getElementById('expense-input-amount').value) || 0;

  state.persons.forEach(p => {
    const existing = existingPayers[Number(p.id)];
    const row = document.createElement('div');
    row.className = 'split-person-row custom';
    row.innerHTML = `
      <span style="font-size:14px;">${p.name}</span>
      <input type="number" step="0.01" min="0" placeholder="0.00"
        class="multi-payer-input" data-person-id="${p.id}"
        value="${existing != null ? existing : ''}"
        oninput="updateMultiPayerSummary()">
    `;
    container.appendChild(row);
  });
  updateMultiPayerSummary();
}

function updateMultiPayerSummary() {
  const total = parseFloat(document.getElementById('expense-input-amount').value) || 0;
  let entered = 0;
  document.querySelectorAll('.multi-payer-input').forEach(inp => {
    entered += parseFloat(inp.value) || 0;
  });
  entered = Math.round(entered * 100) / 100;
  const remaining = Math.round((total - entered) * 100) / 100;

  document.getElementById('multi-payer-total-expense').textContent = formatCurrency(total);
  document.getElementById('multi-payer-entered').textContent = formatCurrency(entered);
  const remEl = document.getElementById('multi-payer-remaining');
  if (Math.abs(remaining) < 0.01) {
    remEl.style.color = 'var(--success, #22c55e)';
    remEl.textContent = '✓ ' + formatCurrency(0);
  } else if (remaining < 0) {
    remEl.style.color = 'var(--danger)';
    remEl.textContent = `Over by ${formatCurrency(Math.abs(remaining))}`;
  } else {
    remEl.style.color = 'var(--danger)';
    remEl.textContent = formatCurrency(remaining);
  }
}

function openExpenseModal(expenseId = null) {
  const modal = document.getElementById('expense-modal');
  const title = document.getElementById('expense-modal-title');
  const editId = document.getElementById('expense-edit-id');
  const dateInput = document.getElementById('expense-input-date');
  const descInput = document.getElementById('expense-input-desc');
  const amountInput = document.getElementById('expense-input-amount');
  const paidByInput = document.getElementById('expense-input-paid-by');

  populatePersonSelects();

  if (expenseId) {
    title.textContent = 'Edit Expense';
    editId.value = expenseId;
    fetch(`/api/expenses/${expenseId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) return;
        const exp = data.expense;
        dateInput.value = toInputDate(Number(exp.date));
        descInput.value = exp.description;
        amountInput.value = exp.amount;

        // Set category chip
        state.selectedCategory = exp.category || null;
        updateCategoryChips();

        // Restore payer mode from saved payers
        const payers = data.payers || [];
        if (payers.length > 1) {
          // Multi-payer
          setPayerMode('multi');
          const existingMap = {};
          payers.forEach(p => { existingMap[Number(p.personId)] = parseFloat(p.amountPaid); });
          renderMultiPayerInputs(existingMap);
        } else {
          setPayerMode('single');
          paidByInput.value = exp.paidByPersonId;
        }

        // Render split checkboxes with selected person IDs
        const sharedPersonIds = new Set(data.shares.map(s => Number(s.personId)));
        renderSplitCheckboxes(sharedPersonIds);
        updateLiveSplitCalculation();
      });
  } else {
    title.textContent = 'Add Expense';
    editId.value = '';
    dateInput.value = toInputDate(new Date());
    descInput.value = '';
    amountInput.value = '';
    state.selectedCategory = null;
    updateCategoryChips();

    // Default: select all active members for split
    renderSplitCheckboxes(new Set(state.persons.map(p => Number(p.id))));
    updateLiveSplitCalculation();
  }

  // Always reset payer mode to single when opening modal (unless set above in edit)
  if (!expenseId) {
    setPayerMode('single');
  }

  // Always reset to equal split mode when opening modal
  currentSplitMode = 'equal';
  document.getElementById('split-mode-equal-btn').classList.add('active');
  document.getElementById('split-mode-custom-btn').classList.remove('active');
  document.getElementById('split-select-all-row').style.display = 'flex';
  document.getElementById('live-split-preview').style.display = 'flex';
  document.getElementById('custom-split-summary').style.display = 'none';

  modal.style.display = 'flex';
}

function closeExpenseModal() {
  document.getElementById('expense-modal').style.display = 'none';
}


function toggleCategoryChip(btn) {
  const cat = btn.getAttribute('data-category');
  if (state.selectedCategory === cat) {
    state.selectedCategory = null;
  } else {
    state.selectedCategory = cat;
  }
  updateCategoryChips();
}

function updateCategoryChips() {
  document.querySelectorAll('.category-chip').forEach(btn => {
    const cat = btn.getAttribute('data-category');
    if (state.selectedCategory === cat) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Split mode: 'equal' or 'custom'
let currentSplitMode = 'equal';

function setSplitMode(mode) {
  currentSplitMode = mode;
  document.getElementById('split-mode-equal-btn').classList.toggle('active', mode === 'equal');
  document.getElementById('split-mode-custom-btn').classList.toggle('active', mode === 'custom');

  // Toggle visibility of controls
  document.getElementById('split-select-all-row').style.display = mode === 'equal' ? 'flex' : 'none';
  document.getElementById('live-split-preview').style.display = mode === 'equal' ? 'flex' : 'none';
  document.getElementById('custom-split-summary').style.display = mode === 'custom' ? 'block' : 'none';

  // Re-render persons list in new mode
  if (mode === 'equal') {
    // Keep current checked state from custom mode — collect which persons had non-zero amounts
    const customInputs = document.querySelectorAll('.custom-split-input');
    const selectedIds = new Set();
    customInputs.forEach(inp => {
      if (parseFloat(inp.value) > 0) selectedIds.add(Number(inp.dataset.personId));
    });
    renderSplitCheckboxes(selectedIds.size > 0 ? selectedIds : new Set(state.persons.map(p => Number(p.id))));
    updateLiveSplitCalculation();
  } else {
    // Switch to custom: carry over checked persons from equal mode
    const checkedIds = new Set(
      Array.from(document.querySelectorAll('.split-checkbox:checked')).map(cb => Number(cb.value))
    );
    renderCustomSplitInputs(checkedIds);
    updateCustomSplitSummary();
  }
}

function renderSplitCheckboxes(selectedIds) {
  const container = document.getElementById('split-persons-list');
  container.className = 'split-persons-box split-persons-grid';
  container.innerHTML = '';

  state.persons.forEach(p => {
    const isChecked = selectedIds.has(Number(p.id));
    const label = document.createElement('label');
    label.className = 'split-person-row';
    label.innerHTML = `
      <input type="checkbox" class="split-checkbox" value="${p.id}" ${isChecked ? 'checked' : ''} onchange="updateLiveSplitCalculation()">
      <span>${p.name}</span>
    `;
    container.appendChild(label);
  });
}

function renderCustomSplitInputs(selectedIds) {
  const container = document.getElementById('split-persons-list');
  container.className = 'split-persons-box';
  container.innerHTML = '';
  const totalAmount = parseFloat(document.getElementById('expense-input-amount').value) || 0;
  const count = selectedIds.size || state.persons.length;
  const defaultShare = count > 0 ? Math.round((totalAmount / count) * 100) / 100 : 0;

  state.persons.forEach(p => {
    const included = selectedIds.size === 0 || selectedIds.has(Number(p.id));
    const row = document.createElement('div');
    row.className = 'split-person-row custom';
    row.innerHTML = `
      <span style="font-size:14px;">${p.name}</span>
      <input type="number" step="0.01" min="0" placeholder="0.00"
        class="custom-split-input" data-person-id="${p.id}"
        value="${included && defaultShare > 0 ? defaultShare : ''}"
        oninput="updateCustomSplitSummary()">
    `;
    container.appendChild(row);
  });
}

function selectAllSplit(select) {
  document.querySelectorAll('.split-checkbox').forEach(cb => {
    cb.checked = select;
  });
  updateLiveSplitCalculation();
}

function updateLiveSplitCalculation() {
  const amount = parseFloat(document.getElementById('expense-input-amount').value) || 0;
  const checkedBoxes = document.querySelectorAll('.split-checkbox:checked');
  const count = checkedBoxes.length;

  const displayEl = document.getElementById('live-split-amount');
  if (count === 0 || amount <= 0) {
    displayEl.textContent = 'Rs. 0.00';
  } else {
    const perPerson = Math.round((amount / count) * 100) / 100;
    displayEl.textContent = `${formatCurrency(perPerson)} / person (${count} members)`;
  }
}

function updateCustomSplitSummary() {
  const total = parseFloat(document.getElementById('expense-input-amount').value) || 0;
  let entered = 0;
  document.querySelectorAll('.custom-split-input').forEach(inp => {
    entered += parseFloat(inp.value) || 0;
  });
  entered = Math.round(entered * 100) / 100;
  const remaining = Math.round((total - entered) * 100) / 100;

  document.getElementById('custom-split-total-expense').textContent = formatCurrency(total);
  document.getElementById('custom-split-entered').textContent = formatCurrency(entered);
  const remEl = document.getElementById('custom-split-remaining');
  remEl.textContent = formatCurrency(Math.abs(remaining));
  if (Math.abs(remaining) < 0.01) {
    remEl.style.color = 'var(--success, #22c55e)';
    remEl.textContent = '✓ ' + formatCurrency(0);
  } else if (remaining < 0) {
    remEl.style.color = 'var(--danger)';
    remEl.textContent = `Over by ${formatCurrency(Math.abs(remaining))}`;
  } else {
    remEl.style.color = 'var(--danger)';
    remEl.textContent = formatCurrency(remaining);
  }
}

let isSavingExpense = false;
async function saveExpense(e) {
  e.preventDefault();
  if (isSavingExpense) return;

  const id = document.getElementById('expense-edit-id').value;
  const dateStr = document.getElementById('expense-input-date').value;
  const description = document.getElementById('expense-input-desc').value.trim();
  const amount = parseFloat(document.getElementById('expense-input-amount').value);
  const category = state.selectedCategory;

  // Parse local date string to epoch millis at noon to prevent TZ rollbacks
  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateMillis = dateObj.getTime();

  // --- Resolve payers ---
  let payerPayload = {};
  if (currentPayerMode === 'multi') {
    const multiPayers = [];
    document.querySelectorAll('.multi-payer-input').forEach(inp => {
      const val = parseFloat(inp.value);
      if (val > 0) multiPayers.push({ personId: parseInt(inp.dataset.personId, 10), amountPaid: val });
    });
    if (multiPayers.length === 0) {
      alert('Please enter at least one payer amount in Multi-Payer mode.');
      return;
    }
    const payerTotal = multiPayers.reduce((s, p) => s + p.amountPaid, 0);
    const diff = Math.abs(amount - Math.round(payerTotal * 100) / 100);
    if (diff > 0.02) {
      alert(`Payer amounts (${formatCurrency(Math.round(payerTotal*100)/100)}) must equal the total expense (${formatCurrency(amount)}).\nDifference: ${formatCurrency(diff)}`);
      return;
    }
    payerPayload = { multiPayers };
  } else {
    const paidByPersonId = parseInt(document.getElementById('expense-input-paid-by').value, 10);
    if (!paidByPersonId) { alert('Please select who paid.'); return; }
    payerPayload = { paidByPersonId };
  }

  // --- Resolve split ---
  let splitPayload = {};
  if (currentSplitMode === 'custom') {
    const customSplits = [];
    document.querySelectorAll('.custom-split-input').forEach(inp => {
      const val = parseFloat(inp.value);
      if (val > 0) customSplits.push({ personId: parseInt(inp.dataset.personId, 10), shareAmount: val });
    });
    if (customSplits.length === 0) {
      alert('Please enter at least one person\'s amount in the Custom Split.');
      return;
    }
    const entered = customSplits.reduce((sum, s) => sum + s.shareAmount, 0);
    const diff = Math.abs(amount - Math.round(entered * 100) / 100);
    if (diff > 0.02) {
      alert(`Custom split amounts (${formatCurrency(Math.round(entered*100)/100)}) must equal the total expense (${formatCurrency(amount)}).\nDifference: ${formatCurrency(diff)}`);
      return;
    }
    splitPayload = { splitMode: 'custom', customSplits };
  } else {
    const checked = document.querySelectorAll('.split-checkbox:checked');
    const selectedPersonIds = Array.from(checked).map(cb => parseInt(cb.value, 10));
    if (selectedPersonIds.length === 0) {
      alert('Please select at least one person to split this expense with.');
      return;
    }
    splitPayload = { splitMode: 'equal', selectedPersonIds };
  }

  const payload = { dateMillis, description, amount, category, ...payerPayload, ...splitPayload };

  const btn = document.getElementById('expense-submit-btn');
  const origText = btn ? btn.textContent : 'Save Expense';
  isSavingExpense = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const url = id ? `/api/expenses/${id}` : '/api/expenses';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeExpenseModal();
      if (state.activeView === 'expenses') loadExpenses();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'reports') generateActiveReport();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to save expense: ' + err.message);
  } finally {
    isSavingExpense = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}



function deleteExpense(id) {
  if (state.user && state.user.role === 'user') {
    alert('Permission denied: Users cannot delete expenses. Only Admin can delete.');
    return;
  }
  const exp = state.expenses.find(e => e.id == id);
  const desc = exp ? exp.description : 'this expense';
  const amt = exp ? formatCurrency(exp.amount) : '';

  const modal = document.getElementById('delete-dialog-modal');
  const iconWrapper = document.getElementById('dialog-icon-wrapper');
  const titleEl = document.getElementById('dialog-title');
  const subtitleEl = document.getElementById('dialog-person-name');
  const msgEl = document.getElementById('dialog-message');
  const infoCard = document.getElementById('dialog-info-card');
  const actionsEl = document.getElementById('dialog-actions');

  iconWrapper.className = 'dialog-icon-circle danger';
  iconWrapper.textContent = '🗑️';
  titleEl.textContent = 'Delete Expense?';
  subtitleEl.textContent = desc;
  msgEl.textContent = `Are you sure you want to delete this expense${amt ? ' (' + amt + ')' : ''}? The expense and all associated split shares will be removed.`;
  infoCard.style.display = 'none';

  actionsEl.innerHTML = `
    <button class="btn btn-secondary" onclick="closeDeleteModal()">Cancel</button>
    <button class="btn btn-danger" onclick="executeDeleteExpense(${id})">Yes, Delete Expense</button>
  `;

  modal.style.display = 'flex';
}

async function executeDeleteExpense(id) {
  try {
    const res = await fetch(`/api/expenses/${id}`, {
      method: 'DELETE',
      headers: { 'x-user-role': state.user?.role || '' }
    });
    const data = await res.json();
    if (data.success) {
      closeDeleteModal();
      if (state.activeView === 'expenses') loadExpenses();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'reports') generateActiveReport();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to delete expense: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// The 6 Reports (Matching Mobile App Exactly)
// -----------------------------------------------------------------------------
async function switchReportTab(tabName) {
  state.activeReportTab = tabName;

  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(tabName)) btn.classList.add('active');
  });

  const dateGroup = document.getElementById('filter-date-group');
  const personGroup = document.getElementById('filter-person-group');
  const batchGroup = document.getElementById('filter-batch-group');
  const waBtn = document.getElementById('report-wa-share-btn');
  const repBatchEl = document.getElementById('report-batch-select');

  if (repBatchEl && repBatchEl.options.length <= 1) {
    await populateBatchFilter();
  }

  // Update person dropdown options (Day-Wise and Total Expense allow "All")
  updateReportPersonSelect(tabName === 'day-wise' || tabName === 'total-expense');

  // Adjust filters visibility per report type
  // Batch selector is available for all reports to scope data matching Dashboard
  if (batchGroup) batchGroup.style.display = 'flex';

  const personLabel = document.getElementById('report-person-label');

  if (tabName === 'total-expense') {
    dateGroup.style.display = 'flex';
    personGroup.style.display = 'flex';
    if (personLabel) personLabel.textContent = 'Paid By:';
    waBtn.style.display = 'none';
  } else if (tabName === 'paid-by-person') {
    dateGroup.style.display = 'flex';
    personGroup.style.display = 'none';
    waBtn.style.display = 'none';
  } else if (tabName === 'person-ledger' || tabName === 'person-detail-ledger') {
    dateGroup.style.display = 'none';
    personGroup.style.display = 'flex';
    if (personLabel) personLabel.textContent = 'Member:';
    waBtn.style.display = 'inline-flex';
  } else if (tabName === 'account-ledger') {
    const isAll = repBatchEl && !repBatchEl.value;
    dateGroup.style.display = isAll ? 'flex' : 'none';
    personGroup.style.display = 'flex';
    if (personLabel) personLabel.textContent = 'Member:';
    waBtn.style.display = 'inline-flex';
  } else if (tabName === 'day-wise') {
    dateGroup.style.display = 'flex';
    personGroup.style.display = 'flex';
    if (personLabel) personLabel.textContent = 'Member:';
    waBtn.style.display = 'none';
  } else if (tabName === 'group-summary') {
    dateGroup.style.display = 'none';
    personGroup.style.display = 'none';
    waBtn.style.display = 'none';
  }

  generateActiveReport();
}

function onReportBatchChange() {
  const repBatchEl = document.getElementById('report-batch-select');
  const dateGroup = document.getElementById('filter-date-group');
  if (state.activeReportTab === 'account-ledger' && dateGroup && repBatchEl) {
    dateGroup.style.display = !repBatchEl.value ? 'flex' : 'none';
  }
  generateActiveReport();
}

async function generateActiveReport() {
  const tab = state.activeReportTab;
  const fromStr = document.getElementById('report-from-date').value;
  const toStr = document.getElementById('report-to-date').value;
  const personId = document.getElementById('report-person-select').value;
  const batchId = document.getElementById('report-batch-select')?.value || '';

  const fromMillis = new Date(fromStr + 'T00:00:00').getTime();
  const toMillis = new Date(toStr + 'T23:59:59.999').getTime();

  document.getElementById('report-doc-date').textContent = `Generated: ${new Date().toLocaleString('en-GB')}`;

  if (tab === 'total-expense') {
    await renderTotalExpenseReport(fromMillis, toMillis, batchId, personId);
  } else if (tab === 'paid-by-person') {
    await renderPaidByPersonReport(fromMillis, toMillis, batchId);
  } else if (tab === 'person-ledger') {
    await renderPersonLedgerReport(personId, batchId);
  } else if (tab === 'person-detail-ledger') {
    await renderPersonDetailLedgerReport(personId, batchId);
  } else if (tab === 'account-ledger') {
    await renderAccountLedgerReport(personId, fromMillis, toMillis, batchId);
  } else if (tab === 'day-wise') {
    await renderDayWiseReport(fromMillis, toMillis, personId, batchId);
  } else if (tab === 'group-summary') {
    await renderGroupSummaryReport(batchId);
  }
}

// 1. Total Expense Report
async function renderTotalExpenseReport(fromMillis, toMillis, batchId, personId) {
  let url = `/api/reports/total-expense?fromMillis=${fromMillis}&toMillis=${toMillis}`;
  if (batchId !== undefined && batchId !== null) {
    url += `&batchId=${batchId === '' ? 'all' : encodeURIComponent(batchId)}`;
  }
  if (personId) {
    url += `&personId=${encodeURIComponent(personId)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const bTitle = data.batchName ? ` [${data.batchName}]` : '';
  const pTitle = data.personName ? ` - Paid By: ${data.personName}` : '';
  const subtitle = `Total Expense Report (${formatDate(fromMillis)} – ${formatDate(toMillis)})${bTitle}${pTitle}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const body = document.getElementById('report-content-body');
  body.innerHTML = `
    <div class="stat-cards-grid">
      <div class="stat-card blue">
        <span class="stat-label">Total Transactions</span>
        <span class="stat-value">${data.totalTransactions}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-label">Total Expense</span>
        <span class="stat-value">${formatCurrency(data.totalExpense)}</span>
      </div>
    </div>

    <div class="table-container">
      <table class="app-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Paid By</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${(data.expenses || []).map(e => {
            const isPayment = e.category === 'Payment';
            const isAdjustment = e.category === 'Opening Adjustment';
            const catBadge = isPayment
              ? ` <span class="badge" style="background-color: #d1fae5; color: #065f46; font-size: 11px;">💳 Payment</span>`
              : (isAdjustment
              ? ` <span class="badge" style="background-color: #fef3c7; color: #92400e; font-size: 11px;">⚖️ Opening Adj</span>`
              : (e.category ? ` <span class="badge badge-primary" style="font-size: 11px;">${e.category}</span>` : ''));

            let paidByHtml = e.paidByName;
            if (e.payers && e.payers.length > 1 && !personId) {
              paidByHtml = `
                <div style="font-size: 12.5px;">
                  ${e.payers.map(p => `<div><strong>${p.name}:</strong> ${formatCurrency(p.amountPaid)}</div>`).join('')}
                </div>
              `;
            } else if (personId && e.totalExpenseAmount && Number(e.totalExpenseAmount) > Number(e.amount)) {
              paidByHtml = `${e.paidByName} <span style="font-size: 10px; color: var(--text-muted);">(Multi-Payer)</span>`;
            }

            return `
              <tr>
                <td>${formatDate(Number(e.date))}</td>
                <td><strong>${e.description}</strong>${catBadge}</td>
                <td>${paidByHtml}</td>
                <td style="text-align: right; font-weight: 700; ${isPayment ? 'color: #10B981;' : (isAdjustment ? 'color: #F59E0B;' : '')}">
                  ${formatCurrency(e.amount)}
                  ${personId && e.totalExpenseAmount && Number(e.totalExpenseAmount) > Number(e.amount) ? `<div style="font-size: 10px; color: var(--text-muted); font-weight: normal;">Total: ${formatCurrency(e.totalExpenseAmount)}</div>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <div style="text-align: right; margin-top: 18px; font-size: 16px; font-weight: 800;">
      Grand Total: ${formatCurrency(data.totalExpense)}
    </div>
  `;
}

// 2. Paid by Person Report
async function renderPaidByPersonReport(fromMillis, toMillis, batchId) {
  let url = `/api/reports/paid-by-person?fromMillis=${fromMillis}&toMillis=${toMillis}`;
  if (batchId !== undefined && batchId !== null) {
    url += `&batchId=${batchId === '' ? 'all' : encodeURIComponent(batchId)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const bTitle = data.batchName ? ` [${data.batchName}]` : '';
  const subtitle = `Paid by Person Report (${formatDate(fromMillis)} – ${formatDate(toMillis)})${bTitle}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const body = document.getElementById('report-content-body');
  body.innerHTML = `
    <div class="stat-cards-grid">
      <div class="stat-card blue">
        <span class="stat-label">Total Members</span>
        <span class="stat-value">${data.totalMembers}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-label">Grand Total Paid</span>
        <span class="stat-value">${formatCurrency(data.grandTotal)}</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px;">
      ${data.totals.map(t => `
        <div class="person-card receivable" style="background: #fff; border-color: var(--card-border); color: var(--text-dark);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong style="font-size: 16px;">${t.personName}</strong>
            <span style="font-size: 18px; font-weight: 800; color: var(--green-text);">${formatCurrency(t.totalPaid)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// 3. Person Ledger Report (Summary Card)
async function renderPersonLedgerReport(personId, batchId) {
  if (!personId) return;
  let url = `/api/reports/person-ledger?personId=${personId}`;
  if (batchId !== undefined && batchId !== null) {
    url += `&batchId=${batchId === '' ? 'all' : encodeURIComponent(batchId)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const b = data.balance;
  const bTitle = data.batchName ? ` [${data.batchName}]` : '';
  const subtitle = `Ledger Report: ${b.personName}${bTitle}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const isPositive = b.remainingBalance >= 0;
  const cardClass = isPositive ? 'receivable' : 'payable';
  const label = isPositive ? 'Amount Receivable' : 'Amount Payable';
  const arrow = isPositive ? '▲' : '▼';

  const body = document.getElementById('report-content-body');
  body.innerHTML = `
    <div class="stat-cards-grid">
      <div class="stat-card blue">
        <span class="stat-label">Total Paid</span>
        <span class="stat-value">${formatCurrency(b.totalPaid)}</span>
      </div>
      <div class="stat-card blue">
        <span class="stat-label">Total Allocated</span>
        <span class="stat-value">${formatCurrency(b.totalShare)}</span>
      </div>
    </div>

    <div class="person-card ${cardClass}" style="padding: 24px; text-align: center; margin: 20px 0; border-radius: var(--radius-lg);">
      <div style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">${arrow} ${label}</div>
      <div style="font-size: 36px; font-weight: 800;">${formatCurrency(Math.abs(b.remainingBalance))}</div>
    </div>
  `;
}

// 4. Person Detail Ledger Report
async function renderPersonDetailLedgerReport(personId, batchId) {
  if (!personId) return;
  let url = `/api/reports/person-detail-ledger?personId=${personId}`;
  if (batchId !== undefined && batchId !== null) {
    url += `&batchId=${batchId === '' ? 'all' : encodeURIComponent(batchId)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const bTitle = data.batchName ? ` [${data.batchName}]` : '';
  const subtitle = `Detail Ledger Report: ${data.personName}${bTitle}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const isPositive = data.remainingBalance >= 0;
  const balanceLabel = isPositive ? 'Total Receivable Amount' : 'Total Payable Amount';
  const balanceColor = isPositive ? 'var(--green-text)' : 'var(--red-text)';

  const body = document.getElementById('report-content-body');
  body.innerHTML = `
    <div class="stat-cards-grid">
      <div class="stat-card blue">
        <span class="stat-label">Total Entries</span>
        <span class="stat-value">${data.totalEntries}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-label">Your Total Expense</span>
        <span class="stat-value">${formatCurrency(data.yourTotalExpense)}</span>
      </div>
    </div>

    <div class="table-container">
      <table class="app-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Exp Detail</th>
            <th style="text-align: right;">Amount</th>
            <th style="text-align: right;">Persons</th>
            <th style="text-align: right;">Your Exp</th>
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(r => `
            <tr>
              <td>${formatDate(Number(r.date))}</td>
              <td>${r.description}</td>
              <td style="text-align: right;">${formatCurrency(r.totalAmount)}</td>
              <td style="text-align: right;">${r.dividedByCount}</td>
              <td style="text-align: right; font-weight: 700; color: var(--green-text);">${formatCurrency(r.yourShare)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div style="text-align: right; margin-top: 24px; font-size: 15px; line-height: 1.8;">
      <div>Total Amount = <strong>${formatCurrency(data.yourTotalExpense)}</strong></div>
      <div>Total Paid Amount = <strong>${formatCurrency(data.totalPaid)}</strong></div>
      <div style="font-size: 18px; font-weight: 800; color: ${balanceColor}; margin-top: 6px;">
        ${balanceLabel} = ${formatCurrency(Math.abs(data.remainingBalance))}
      </div>
    </div>
  `;
}

// 4b. Person Account Ledger Report (Opening Balance -> Expenses [Debit] -> Payments [Credit] -> Net Balance)
async function renderAccountLedgerReport(personId, fromMillis, toMillis, batchId) {
  if (!personId) return;

  let url = `/api/reports/account-ledger?personId=${personId}`;
  if (batchId) {
    url += `&batchId=${batchId}`;
  } else {
    url += `&batchId=all`;
    if (fromMillis) url += `&fromMillis=${fromMillis}`;
    if (toMillis) url += `&toMillis=${toMillis}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const batchNameStr = data.batchName ? ` [${data.batchName}]` : '';
  const subtitle = `Account Ledger (کھاتہ): ${data.personName}${batchNameStr}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const isNetReceivable = data.netClosingBalance >= 0;
  const balanceLabel = isNetReceivable ? 'Net Receivable (لینے ہیں)' : 'Net Payable (دینے ہیں)';
  const balanceColor = isNetReceivable ? 'var(--green-text)' : 'var(--red-text)';

  const opBal = data.openingBalance || 0;
  const isOpPos = opBal >= 0;

  const body = document.getElementById('report-content-body');
  body.innerHTML = `
    <!-- Top Summary Statistics -->
    <div class="stat-cards-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
      <div class="stat-card" style="border-left: 4px solid #6366f1;">
        <span class="stat-label">Opening Balance</span>
        <span class="stat-value" style="color: ${isOpPos ? 'var(--green-text)' : 'var(--red-text)'};">
          ${formatCurrency(Math.abs(opBal))} <small style="font-size: 11px;">(${isOpPos ? 'Cr / Receivable' : 'Dr / Payable'})</small>
        </span>
      </div>
      <div class="stat-card" style="border-left: 4px solid #ef4444;">
        <span class="stat-label">Total Expenses (Debit)</span>
        <span class="stat-value" style="color: var(--red-text);">${formatCurrency(data.periodTotalDebit)}</span>
      </div>
      <div class="stat-card" style="border-left: 4px solid #10b981;">
        <span class="stat-label">Total Payments (Credit)</span>
        <span class="stat-value" style="color: var(--green-text);">${formatCurrency(data.periodTotalCredit)}</span>
      </div>
      <div class="stat-card" style="border-left: 4px solid ${isNetReceivable ? '#10b981' : '#ef4444'};">
        <span class="stat-label">${balanceLabel}</span>
        <span class="stat-value" style="color: ${balanceColor};">${formatCurrency(Math.abs(data.netClosingBalance))}</span>
      </div>
    </div>

    <!-- Ledger Transactions Table -->
    <div class="table-container" style="margin-top: 16px;">
      <table class="app-table">
        <thead>
          <tr style="background: var(--table-header-bg, #f1f5f9);">
            <th style="width: 110px;">Date</th>
            <th>Description & Category</th>
            <th style="width: 110px;">Batch</th>
            <th style="text-align: right; width: 120px; color: #b91c1c;">Debit (Expenses)</th>
            <th style="text-align: right; width: 120px; color: #047857;">Credit (Payments)</th>
            <th style="text-align: right; width: 130px;">Net Balance</th>
          </tr>
        </thead>
        <tbody>
          <!-- 1. Opening Balance Row -->
          <tr style="background: rgba(99, 102, 241, 0.08); font-weight: 700;">
            <td>${formatDate(data.batchFromDate || fromMillis || Date.now())}</td>
            <td><strong>🏁 Opening Balance B/F (سابقہ بقایا)</strong></td>
            <td>${data.batchName || '—'}</td>
            <td style="text-align: right; color: #b91c1c;">${opBal < 0 ? formatCurrency(Math.abs(opBal)) : '—'}</td>
            <td style="text-align: right; color: #047857;">${opBal > 0 ? formatCurrency(opBal) : '—'}</td>
            <td style="text-align: right; font-weight: 800; color: ${isOpPos ? 'var(--green-text)' : 'var(--red-text)'};">
              ${formatCurrency(Math.abs(opBal))} ${isOpPos ? 'Cr' : 'Dr'}
            </td>
          </tr>

          <!-- 2. Transactions Rows -->
          ${data.rows.length === 0 ? `
            <tr>
              <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No transactions recorded in this period.</td>
            </tr>
          ` : data.rows.map(r => {
            const isPmt = r.credit > 0 && r.debit === 0;
            const isBalPos = r.netBalance >= 0;
            const badge = isPmt
              ? `<span class="badge" style="background-color: #d1fae5; color: #065f46; font-size: 10px;">💳 Payment</span>`
              : (r.category ? `<span class="badge badge-primary" style="font-size: 10px;">${r.category}</span>` : '');

            return `
              <tr>
                <td>${formatDate(Number(r.date))}</td>
                <td>
                  <strong>${r.description}</strong>
                  <div style="margin-top: 2px;">${badge}</div>
                </td>
                <td><span style="font-size: 11px; color: var(--text-muted);">${r.batchName || '—'}</span></td>
                <td style="text-align: right; font-weight: 600; color: ${r.debit > 0 ? '#b91c1c' : 'var(--text-muted)'};">
                  ${r.debit > 0 ? formatCurrency(r.debit) : '—'}
                </td>
                <td style="text-align: right; font-weight: 600; color: ${r.credit > 0 ? '#047857' : 'var(--text-muted)'};">
                  ${r.credit > 0 ? formatCurrency(r.credit) : '—'}
                </td>
                <td style="text-align: right; font-weight: 700; color: ${isBalPos ? 'var(--green-text)' : 'var(--red-text)'};">
                  ${formatCurrency(Math.abs(r.netBalance))} ${isBalPos ? 'Cr' : 'Dr'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background: var(--table-header-bg, #f8fafc); font-weight: 800; border-top: 2px solid var(--border-color);">
            <td colspan="3" style="text-align: right;">Total Period Activity:</td>
            <td style="text-align: right; color: #b91c1c;">${formatCurrency(data.periodTotalDebit)}</td>
            <td style="text-align: right; color: #047857;">${formatCurrency(data.periodTotalCredit)}</td>
            <td style="text-align: right; color: ${balanceColor}; font-size: 15px;">
              ${formatCurrency(Math.abs(data.netClosingBalance))} ${isNetReceivable ? 'Cr' : 'Dr'}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Final Net Balance Box -->
    <div style="text-align: right; margin-top: 24px; font-size: 15px; line-height: 1.8;">
      <div>Opening Balance: <strong>${formatCurrency(Math.abs(opBal))} ${isOpPos ? 'Cr' : 'Dr'}</strong></div>
      <div>Total Expenses (Debit): <strong style="color: #b91c1c;">${formatCurrency(data.periodTotalDebit)}</strong></div>
      <div>Total Payments (Credit): <strong style="color: #047857;">${formatCurrency(data.periodTotalCredit)}</strong></div>
      <div style="font-size: 20px; font-weight: 800; color: ${balanceColor}; margin-top: 8px;">
        ${balanceLabel} = ${formatCurrency(Math.abs(data.netClosingBalance))}
      </div>
    </div>
  `;
}

// 5. Day-Wise Expense Report
async function renderDayWiseReport(fromMillis, toMillis, personId, batchId) {
  let url = `/api/reports/day-wise?fromMillis=${fromMillis}&toMillis=${toMillis}`;
  if (personId) url += `&personId=${personId}`;
  if (batchId !== undefined && batchId !== null) {
    url += `&batchId=${batchId === '' ? 'all' : encodeURIComponent(batchId)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const bTitle = data.batchName ? ` [${data.batchName}]` : '';
  const pTitle = data.personName ? ` — ${data.personName}` : ' — All Members (تمام ممبران)';
  const subtitle = `Day-Wise Expense Report (${formatDate(fromMillis)} – ${formatDate(toMillis)})${pTitle}${bTitle}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const body = document.getElementById('report-content-body');

  let groupsHtml = '';
  if (!data.groups || data.groups.length === 0) {
    groupsHtml = `<div style="padding: 30px; text-align: center; color: var(--text-muted);">No tagged expenses found in this date range.</div>`;
  } else {
    groupsHtml = data.groups.map(g => `
      <div class="day-wise-group">
        <div class="day-wise-header">
          <span>${formatDateLong(g.dateMillis)}</span>
          <span>Day Total: ${formatCurrency(g.dayTotal)}</span>
        </div>
        <table class="day-wise-table">
          <tbody>
            ${g.categories.map(c => {
              if (data.personName) {
                return `
                  <tr>
                    <td style="font-weight: 700; width: 140px;">${c.category}</td>
                    <td style="text-align: right; color: var(--green-text); font-weight: 600;">
                      Total ${formatCurrency(c.totalAmount)} &divide; ${c.effectivePersons} = <strong>${formatCurrency(c.calculatedShare)}</strong>
                    </td>
                  </tr>
                `;
              } else {
                return `
                  <tr>
                    <td style="font-weight: 700; width: 140px;">${c.category}</td>
                    <td style="text-align: right; color: var(--green-text); font-weight: 600;">
                      Total <strong>${formatCurrency(c.totalAmount)}</strong> <small style="color: var(--text-muted); font-size: 12px;">(Split across ${c.effectivePersons} members)</small>
                    </td>
                  </tr>
                `;
              }
            }).join('')}
          </tbody>
        </table>
      </div>
    `).join('');
  }

  let personFooter = '';
  if (data.personName) {
    const isPositive = data.remainingBalance >= 0;
    const balanceLabel = isPositive ? 'Total Receivable Amount' : 'Total Payable Amount';
    const balanceColor = isPositive ? 'var(--green-text)' : 'var(--red-text)';

    personFooter = `
      <div style="text-align: right; margin-top: 14px; font-size: 15px; line-height: 1.8;">
        <div>Your Total Expense = <strong>${formatCurrency(data.yourTotalExpense)}</strong></div>
        <div>Total Paid Amount = <strong>${formatCurrency(data.totalPaid)}</strong></div>
        <div style="font-size: 18px; font-weight: 800; color: ${balanceColor}; margin-top: 6px;">
          ${balanceLabel} = ${formatCurrency(Math.abs(data.remainingBalance))}
        </div>
      </div>
    `;
  }

  body.innerHTML = `
    <div class="stat-cards-grid">
      <div class="stat-card blue">
        <span class="stat-label">Days With Data</span>
        <span class="stat-value">${data.daysWithData}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-label">Grand Total</span>
        <span class="stat-value">${formatCurrency(data.grandTotal)}</span>
      </div>
    </div>

    <div>${groupsHtml}</div>

    <div style="text-align: right; margin-top: 20px; font-size: 16px; font-weight: 800;">
      Grand Total = ${formatCurrency(data.grandTotal)}
    </div>

    ${personFooter}
  `;
}

// 6. Group Summary & Settlement Report
async function renderGroupSummaryReport(batchId) {
  let url = '/api/reports/group-summary';
  if (batchId !== undefined && batchId !== null) {
    url += `?batchId=${batchId === '' ? 'all' : encodeURIComponent(batchId)}`;
  }

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const batchNameStr = data.batchName ? ` [${data.batchName}]` : '';
  const subtitle = `Group Expense Summary & Debt Settlement${batchNameStr}`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const body = document.getElementById('report-content-body');

  const settlementsHtml = (!data.settlements || data.settlements.length === 0)
    ? `<div style="padding: 16px; color: var(--text-muted); font-size: 14px;">Everyone is settled up. No payments needed.</div>`
    : data.settlements.map(s => `
        <div class="settlement-card">
          <span><strong>${s.fromName}</strong> <span class="settlement-arrow">&rarr;</span> <strong>${s.toName}</strong></span>
          <span style="font-size: 16px; font-weight: 800;">${formatCurrency(s.amount)}</span>
        </div>
      `).join('');

  body.innerHTML = `
    <div class="stat-cards-grid">
      <div class="stat-card blue">
        <span class="stat-label">Total Members</span>
        <span class="stat-value">${data.totalMembers}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-label">Total Expense</span>
        <span class="stat-value">${formatCurrency(data.totalExpense)}</span>
      </div>
      <div class="stat-card green">
        <span class="stat-label">Total Paid</span>
        <span class="stat-value">${formatCurrency(data.totalPaid)}</span>
      </div>
    </div>

    <h3 style="font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">Member Balances</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; margin-bottom: 24px;">
      ${data.balances.map(b => {
        const isPositive = b.remainingBalance >= 0;
        const cardClass = isPositive ? 'receivable' : 'payable';
        const arrow = isPositive ? '▲' : '▼';
        return `
          <div class="person-card ${cardClass}" style="background: #fff; border-color: var(--card-border); color: var(--text-dark);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="font-size: 15px;">${b.personName}</strong>
                <div style="font-size: 12px; color: var(--text-muted);">Paid ${formatCurrency(b.totalPaid)} &bull; Share ${formatCurrency(b.totalShare)}</div>
              </div>
              <div class="badge ${isPositive ? 'badge-green' : 'badge-red'}" style="font-size: 13px; font-weight: 800;">
                ${arrow} ${formatCurrency(Math.abs(b.remainingBalance))}
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <h3 style="font-size: 16px; font-weight: 700; margin: 24px 0 12px 0;">Settlement Summary (Minimum Transactions)</h3>
    <div style="max-width: 650px;">
      ${settlementsHtml}
    </div>
  `;
}

// -----------------------------------------------------------------------------
// Report Actions: Print, CSV, WhatsApp
// -----------------------------------------------------------------------------
function printReport() {
  const isLandscape = state.activeReportTab === 'account-ledger' || state.activeReportTab === 'person-detail-ledger';

  // Inject or update dynamic @page print style
  let printStyle = document.getElementById('dynamic-print-page-style');
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = 'dynamic-print-page-style';
    document.head.appendChild(printStyle);
  }

  if (isLandscape) {
    document.body.classList.add('print-landscape');
    printStyle.textContent = '@media print { @page { size: A4 landscape !important; margin: 0.8cm !important; } }';
  } else {
    document.body.classList.remove('print-landscape');
    printStyle.textContent = '@media print { @page { size: A4 portrait !important; margin: 1cm !important; } }';
  }

  window.print();
}

function exportReportCSV() {
  const d = state.currentReportData;
  if (!d) return alert('No report data to export');

  let csvContent = 'data:text/csv;charset=utf-8,';
  const tab = state.activeReportTab;

  if (tab === 'total-expense') {
    csvContent += 'Date,Description,Paid By,Amount\n';
    d.expenses.forEach(e => {
      csvContent += `"${formatDate(Number(e.date))}","${e.description.replace(/"/g, '""')}","${e.paidByName}",${e.amount}\n`;
    });
  } else if (tab === 'paid-by-person') {
    csvContent += 'Person Name,Total Paid\n';
    d.totals.forEach(t => {
      csvContent += `"${t.personName}",${t.totalPaid}\n`;
    });
  } else if (tab === 'person-detail-ledger') {
    csvContent += 'Date,Description,Total Amount,Split Persons,Your Share\n';
    d.rows.forEach(r => {
      csvContent += `"${formatDate(Number(r.date))}","${r.description.replace(/"/g, '""')}",${r.totalAmount},${r.dividedByCount},${r.yourShare}\n`;
    });
  } else if (tab === 'account-ledger') {
    csvContent += 'Date,Description,Category,Batch,Debit (Expense),Credit (Payment),Net Balance\n';
    csvContent += `"Opening Balance","Opening Balance B/F","Opening","—",${d.openingBalance < 0 ? Math.abs(d.openingBalance) : 0},${d.openingBalance > 0 ? d.openingBalance : 0},${d.openingBalance}\n`;
    d.rows.forEach(r => {
      csvContent += `"${formatDate(Number(r.date))}","${r.description.replace(/"/g, '""')}","${r.category || ''}","${r.batchName || ''}",${r.debit},${r.credit},${r.netBalance}\n`;
    });
  } else if (tab === 'group-summary') {
    csvContent += 'Person Name,Total Paid,Total Share,Remaining Balance\n';
    d.balances.forEach(b => {
      csvContent += `"${b.personName}",${b.totalPaid},${b.totalShare},${b.remainingBalance}\n`;
    });
  } else if (tab === 'day-wise') {
    csvContent += 'Date,Category,Total Amount,Effective Persons,Calculated Share\n';
    (d.groups || []).forEach(g => {
      (g.categories || []).forEach(c => {
        csvContent += `"${formatDate(Number(g.dateMillis))}","${c.category}",${c.totalAmount},${c.effectivePersons},${c.calculatedShare}\n`;
      });
    });
  } else {
    alert('CSV export ready for this report view.');
    return;
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `${tab}_report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function shareReportWhatsApp() {
  const d = state.currentReportData;
  if (!d) return;

  const mobile = d.mobileNumber || (d.balance && d.balance.mobileNumber);
  if (!mobile) {
    alert('This member has no mobile number registered. Please edit the person to set a valid WhatsApp number.');
    return;
  }

  const tab = state.activeReportTab;
  const personName = d.personName || (d.balance && d.balance.personName);

  let message = '';
  if (tab === 'account-ledger') {
    const opBal = d.openingBalance || 0;
    const isOpRec = opBal >= 0;
    const isRec = d.isReceivable;

    message = `*${state.user?.shopName || 'Chaudry Mess System'} - Account Ledger (کھاتہ)*\n` +
      `Member: *${personName}*\n` +
      `-----------------------------------\n` +
      `Opening Balance: ${formatCurrency(Math.abs(opBal))} (${isOpRec ? 'Cr' : 'Dr'})\n` +
      `Total Expenses (Debit): ${formatCurrency(d.periodTotalDebit)}\n` +
      `Total Payments (Credit): ${formatCurrency(d.periodTotalCredit)}\n` +
      `*${isRec ? 'Net Receivable (لینے ہیں)' : 'Net Payable (دینے ہیں)'}:* ${formatCurrency(Math.abs(d.netClosingBalance))}\n` +
      `-----------------------------------\n` +
      `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  } else {
    const totalPaid = d.totalPaid ?? (d.balance && d.balance.totalPaid);
    const totalExp = d.yourTotalExpense ?? (d.balance && d.balance.totalShare);
    const remaining = d.remainingBalance ?? (d.balance && d.balance.remainingBalance);
    const isReceivable = remaining >= 0;

    message = `*${state.user?.shopName || 'Chaudry Mess System'} - Expense Ledger Report*\n` +
      `Member: *${personName}*\n` +
      `-----------------------------------\n` +
      `Total Expense: ${formatCurrency(totalExp)}\n` +
      `Total Paid: ${formatCurrency(totalPaid)}\n` +
      `*${isReceivable ? 'Receivable Amount' : 'Payable Amount'}:* ${formatCurrency(Math.abs(remaining))}\n` +
      `-----------------------------------\n` +
      `Generated on: ${new Date().toLocaleDateString('en-GB')}`;
  }

  const cleanMobile = mobile.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// -----------------------------------------------------------------------------
// Settings & Database Backup
// -----------------------------------------------------------------------------
async function saveShopIdentity() {
  const shopName = document.getElementById('settings-shop-name').value.trim();
  const address = document.getElementById('settings-shop-address').value.trim();
  const compIdInput = document.getElementById('settings-company-id');
  const companyId = compIdInput ? parseInt(compIdInput.value, 10) || 1 : 1;
  const msgEl = document.getElementById('settings-identity-msg');
  if (msgEl) msgEl.textContent = '';

  if (!shopName) {
    alert('Company / Shop Name cannot be empty.');
    return;
  }

  try {
    const res = await fetch('/api/auth/shop-identity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-role': state.user?.role || ''
      },
      body: JSON.stringify({ shopName, address, companyId })
    });
    const data = await res.json();
    if (data.success) {
      if (state.user) {
        state.user.shopName = data.shopName;
        state.user.shopAddress = data.shopAddress;
        state.user.companyId = data.companyId || companyId;
      }
      applyUserIdentity();
      if (msgEl) {
        msgEl.innerHTML = '<span style="color: var(--green-text); font-weight: 700;">✔ Company name and address saved successfully!</span>';
      }
      alert('Company / Shop details saved successfully!');
    } else {
      if (msgEl) msgEl.innerHTML = `<span style="color: var(--red-text);">✘ ${data.message}</span>`;
      alert('Error: ' + data.message);
    }
  } catch (err) {
    if (msgEl) msgEl.innerHTML = `<span style="color: var(--red-text);">✘ Error: ${err.message}</span>`;
    alert('Failed to update company details: ' + err.message);
  }
}

function saveShopAddress() {
  saveShopIdentity();
}

async function loadDatabaseStatus() {
  try {
    const res = await fetch('/api/database/status');
    const data = await res.json();
    if (data.success) {
      const c = data.counts;
      document.getElementById('sql-table-counts').innerHTML = `
        <div><strong>Persons:</strong> ${c.personCount} | <strong>Expenses:</strong> ${c.expenseCount} | <strong>Shares:</strong> ${c.shareCount}</div>
      `;
    }
  } catch (err) {
    console.error('Failed to load DB status:', err);
  }
}

async function createDatabaseBackup() {
  const btn = event.target;
  const msgEl = document.getElementById('backup-result-msg');
  btn.disabled = true;
  btn.textContent = 'Backing up...';
  msgEl.textContent = '';

  try {
    const res = await fetch('/api/database/backup', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      msgEl.innerHTML = `<span style="color: var(--green-text); font-weight: bold;">✔ ${data.message}</span><br><code style="font-size: 11px;">${data.fullPath}</code>`;
    } else {
      msgEl.innerHTML = `<span style="color: var(--red-text);">✘ Backup failed: ${data.message}</span>`;
    }
  } catch (err) {
    msgEl.innerHTML = `<span style="color: var(--red-text);">✘ Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Database Backup (.bak)';
  }
}

// -----------------------------------------------------------------------------
// Change Password Modal
// -----------------------------------------------------------------------------
function openChangePasswordModal() {
  document.getElementById('pw-current').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('pw-error').style.display = 'none';
  document.getElementById('password-modal').style.display = 'flex';
}

function closeChangePasswordModal() {
  document.getElementById('password-modal').style.display = 'none';
}

async function saveNewPassword(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('pw-current').value;
  const newPassword = document.getElementById('pw-new').value;
  const confirmPassword = document.getElementById('pw-confirm').value;
  const errEl = document.getElementById('pw-error');
  errEl.style.display = 'none';

  if (newPassword !== confirmPassword) {
    errEl.textContent = 'New password and confirmation do not match.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: state.user?.username || 'admin',
        currentPassword,
        newPassword
      })
    });
    const data = await res.json();

    if (data.success) {
      alert('Password updated successfully!');
      closeChangePasswordModal();
    } else {
      errEl.textContent = data.message || 'Failed to update password';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'Error: ' + err.message;
    errEl.style.display = 'block';
  }
}

// =============================================================================
// AI VOICE ASSISTANT ENGINE (Zero-Install Web Speech & NLP Action Dispatcher)
// =============================================================================
let aiRecognition = null;
let isAILocalListening = false;
let shouldBeListening = false;
let speechSilenceTimer = null;
let lastRecognizedText = '';
let aiCurrentLanguage = 'ur-PK'; // 'ur-PK' or 'en-US'

function initAISpeechEngine() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    console.log('Web Speech API is not supported in this browser.');
    return null;
  }
  const rec = new SpeechRec();
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  rec.lang = aiCurrentLanguage;

  rec.onstart = () => {
    isAILocalListening = true;
    updateAIModalState();
  };

  rec.onresult = (event) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const trans = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += trans;
      } else {
        interim += trans;
      }
    }
    const current = (final || interim || '').trim();
    if (current) {
      lastRecognizedText = current;
      const liveTextEl = document.getElementById('ai-live-text');
      if (liveTextEl) {
        liveTextEl.textContent = `"${current}"`;
      }
      const statusEl = document.getElementById('ai-status-text');
      if (statusEl) statusEl.textContent = '⚡ سن رہا ہوں... (Listening)';

      // Auto-trigger command after 1.2s of silence after speech
      clearTimeout(speechSilenceTimer);
      speechSilenceTimer = setTimeout(() => {
        if (lastRecognizedText && shouldBeListening) {
          executeAICommand(lastRecognizedText);
          lastRecognizedText = '';
        }
      }, 1300);
    }
  };

  rec.onerror = (event) => {
    console.warn('AI Speech recognition error:', event.error);
    const statusEl = document.getElementById('ai-status-text');

    if (event.error === 'network') {
      // If network error occurred on ur-PK (often Google speech server connection restriction), auto-switch to en-US
      if (aiCurrentLanguage === 'ur-PK') {
        console.log('Network error on ur-PK, auto-switching to en-US fallback...');
        aiCurrentLanguage = 'en-US';
        const btn = document.getElementById('ai-lang-btn');
        if (btn) btn.textContent = '🇬🇧 English / Roman Urdu';
        if (statusEl) statusEl.textContent = '🔄 وائس سرور سوئچ ہو گیا (English/Roman Urdu)';
        try { rec.stop(); } catch (_) {}
        setTimeout(() => {
          if (shouldBeListening) {
            aiRecognition = null;
            startVoiceListening();
          }
        }, 400);
        return;
      }
    }

    if (event.error === 'not-allowed') {
      shouldBeListening = false;
      isAILocalListening = false;
      updateAIModalState();
      if (statusEl) statusEl.textContent = '❌ مائیکروفون کی اجازت نہیں ملی۔ براؤزر سیٹنگ سے مائیک Allow کریں۔';
      return;
    }

    if (event.error === 'no-speech') {
      // Normal silence pause, keep listening smoothly
      return;
    }

    if (statusEl) {
      statusEl.textContent = `مائیک آن ہے، بولتے رہیں... (${event.error})`;
    }
  };

  rec.onend = () => {
    // If modal is open and user wants to continue listening, seamlessly restart
    const modal = document.getElementById('ai-assistant-modal');
    if (shouldBeListening && modal && modal.style.display === 'flex') {
      try {
        rec.start();
        return;
      } catch (e) {
        // Handled below
      }
    }
    isAILocalListening = false;
    updateAIModalState();
  };

  return rec;
}

function toggleAIAssistant() {
  const modal = document.getElementById('ai-assistant-modal');
  if (!modal) return;
  if (modal.style.display === 'flex') {
    closeAIAssistant();
  } else {
    openAIAssistant();
  }
}

function openAIAssistant() {
  const modal = document.getElementById('ai-assistant-modal');
  if (modal) modal.style.display = 'flex';
  const input = document.getElementById('ai-manual-command-input');
  if (input) input.value = '';
  const feedback = document.getElementById('ai-feedback-banner');
  if (feedback) feedback.style.display = 'none';
  const statusEl = document.getElementById('ai-status-text');
  if (statusEl) statusEl.textContent = 'مائیک آن ہے، روانی سے بولیں... (Listening)';
  const liveEl = document.getElementById('ai-live-text');
  if (liveEl) liveEl.textContent = '"بولنے کا انتظار ہے..."';
  
  // Start continuous listening on open
  setTimeout(() => startVoiceListening(), 150);
}

function closeAIAssistant() {
  stopVoiceListening();
  const modal = document.getElementById('ai-assistant-modal');
  if (modal) modal.style.display = 'none';
}

function handleAIOverlayClick(e) {
  if (e.target && e.target.id === 'ai-assistant-modal') {
    closeAIAssistant();
  }
}

function toggleAILanguage() {
  aiCurrentLanguage = (aiCurrentLanguage === 'ur-PK') ? 'en-US' : 'ur-PK';
  const btn = document.getElementById('ai-lang-btn');
  if (btn) {
    btn.textContent = (aiCurrentLanguage === 'ur-PK') ? '🇵🇰 Urdu / EN' : '🇬🇧 English / Roman Urdu';
  }
  if (shouldBeListening) {
    stopVoiceListening();
    aiRecognition = null;
    setTimeout(() => startVoiceListening(), 250);
  }
}

function toggleVoiceListening() {
  if (isAILocalListening) {
    stopVoiceListening();
  } else {
    startVoiceListening();
  }
}

function startVoiceListening() {
  shouldBeListening = true;
  lastRecognizedText = '';
  clearTimeout(speechSilenceTimer);
  try {
    if (!aiRecognition) {
      aiRecognition = initAISpeechEngine();
    }
    if (aiRecognition) {
      aiRecognition.lang = aiCurrentLanguage;
      aiRecognition.start();
    } else {
      const statusEl = document.getElementById('ai-status-text');
      if (statusEl) statusEl.textContent = 'براؤزر وائس سپورٹ نہیں کرتا۔ نیچے ٹیکسٹ ٹائپ کریں۔';
    }
  } catch (err) {
    console.warn('Voice start notice:', err);
  }
}

function stopVoiceListening() {
  shouldBeListening = false;
  clearTimeout(speechSilenceTimer);
  if (aiRecognition) {
    try { aiRecognition.stop(); } catch (_) {}
  }
  isAILocalListening = false;
  updateAIModalState();
}

function updateAIModalState() {
  const micBtn = document.getElementById('ai-big-mic-btn');
  const vis = document.getElementById('ai-visualizer');
  const box = document.getElementById('ai-transcript-box');
  const hint = document.getElementById('ai-mic-hint');
  const statusEl = document.getElementById('ai-status-text');

  if (isAILocalListening) {
    if (micBtn) micBtn.classList.add('active');
    if (vis) vis.classList.add('ai-listening');
    if (box) box.classList.add('listening');
    if (hint) hint.textContent = '🎙️ بولیں، میں سن رہا ہوں... (Listening)';
    if (statusEl) statusEl.textContent = 'Listening... بولیں...';
  } else {
    if (micBtn) micBtn.classList.remove('active');
    if (vis) vis.classList.remove('ai-listening');
    if (box) box.classList.remove('listening');
    if (hint) hint.textContent = 'مائیک پر کلک کر کے بولنا شروع کریں';
  }
}

function handleManualAICommand(e) {
  e.preventDefault();
  const input = document.getElementById('ai-manual-command-input');
  if (!input) return;
  const cmd = input.value.trim();
  if (cmd) {
    executeAICommand(cmd);
    input.value = '';
  }
}

function showAIFeedback(msg, isSuccess = true) {
  const fb = document.getElementById('ai-feedback-banner');
  if (fb) {
    fb.style.display = 'block';
    fb.style.background = isSuccess ? '#DFF5E4' : '#FBE1E1';
    fb.style.color = isSuccess ? '#0F5C25' : '#8A1616';
    fb.style.borderColor = isSuccess ? '#bcebc5' : '#f5c4c4';
    fb.innerHTML = msg;
  }
  const statusEl = document.getElementById('ai-status-text');
  if (statusEl) statusEl.textContent = isSuccess ? '⚡ Action Completed!' : '⚠️ Could not execute command';
}

// Convert Urdu/Arabic digits and spoken words to standard numbers
function parseSpokenAmount(rawText) {
  if (!rawText) return null;
  let text = rawText.toString().toLowerCase();

  // Convert Urdu/Arabic numerals
  const urduNums = { '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };
  text = text.replace(/[۰-۹]/g, c => urduNums[c] || c);

  // Check word numbers
  let wordAmount = 0;
  if (text.includes('ہزار') || text.includes('thousand')) {
    const match = text.match(/(\d+)\s*(ہزار|thousand)/);
    if (match) wordAmount += parseInt(match[1], 10) * 1000;
    else wordAmount += 1000;
  }
  if (text.includes('پانچ سو') || text.includes('panch sau') || text.includes('500')) return 500;
  if (text.includes('ڈیڑھ سو') || text.includes('dedh sau') || text.includes('150')) return 150;
  if (text.includes('ڈھائی سو') || text.includes('dhai sau') || text.includes('250')) return 250;
  if (text.includes('تین سو') || text.includes('teen sau') || text.includes('300')) return 300;
  if (text.includes('چار سو') || text.includes('char sau') || text.includes('400')) return 400;
  if (text.includes('چھ سو') || text.includes('che sau') || text.includes('600')) return 600;
  if (text.includes('سات سو') || text.includes('sat sau') || text.includes('700')) return 700;
  if (text.includes('آٹھ سو') || text.includes('aath sau') || text.includes('800')) return 800;
  if (text.includes('نو سو') || text.includes('nau sau') || text.includes('900')) return 900;
  if (text.includes('ایک سو') || text.includes('ek sau') || text.includes('100')) return 100;
  if (text.includes('دو سو') || text.includes('do sau') || text.includes('200')) return 200;

  if (wordAmount > 0) return wordAmount;

  // Standard regex number extraction
  const numMatch = text.match(/(\d+(\.\d+)?)/);
  if (numMatch) {
    return parseFloat(numMatch[1]);
  }
  return null;
}

// Find matching person from state.persons
function matchPerson(text) {
  if (!text || !state.persons || state.persons.length === 0) return null;
  const clean = text.toLowerCase();

  for (const p of state.persons) {
    const pName = (p.name || '').toLowerCase();
    if (clean.includes(pName)) return p;
    // Split multi-word names
    const parts = pName.split(/\s+/);
    for (const part of parts) {
      if (part.length >= 3 && clean.includes(part)) return p;
    }
  }
  return null;
}

// NLP Action Dispatcher
function executeAICommand(rawCommand) {
  if (!rawCommand || !rawCommand.trim()) return;
  const cmd = rawCommand.trim().toLowerCase();
  const originalText = rawCommand.trim();

  const liveTextEl = document.getElementById('ai-live-text');
  if (liveTextEl) liveTextEl.textContent = `"${originalText}"`;

  // 1. NAVIGATION COMMANDS
  // Dashboard
  if (cmd.includes('dashboard') || cmd.includes('ڈیش بورڈ') || cmd.includes('home') || cmd.includes('ہوم') || cmd.includes('مین پیج')) {
    switchView('dashboard');
    showAIFeedback('✅ Dashboard opened!');
    setTimeout(() => closeAIAssistant(), 1000);
    return;
  }

  // Reports
  if (cmd.includes('report') || cmd.includes('رپورٹ') || cmd.includes('رپورٹس') || cmd.includes('لیجر')) {
    if (cmd.includes('print') || cmd.includes('پرنٹ')) {
      switchView('reports');
      setTimeout(() => {
        printReport();
        showAIFeedback('🖨️ Printing Report...');
        setTimeout(() => closeAIAssistant(), 1000);
      }, 500);
      return;
    }
    if (cmd.includes('whatsapp') || cmd.includes('واٹس ایپ') || cmd.includes('شیئر')) {
      switchView('reports');
      setTimeout(() => {
        shareReportWhatsApp();
        showAIFeedback('💬 Opening WhatsApp share...');
        setTimeout(() => closeAIAssistant(), 1000);
      }, 500);
      return;
    }
    if (cmd.includes('summary') || cmd.includes('سمری') || cmd.includes('group') || cmd.includes('گروپ')) {
      switchView('reports');
      switchReportTab('group-summary');
      showAIFeedback('📊 Group Summary Report opened!');
      setTimeout(() => closeAIAssistant(), 1000);
      return;
    }
    if (cmd.includes('day') || cmd.includes('دن') || cmd.includes('روزانہ') || cmd.includes('روز')) {
      switchView('reports');
      switchReportTab('day-wise');
      showAIFeedback('📅 Day-Wise Report opened!');
      setTimeout(() => closeAIAssistant(), 1000);
      return;
    }
    switchView('reports');
    showAIFeedback('📑 Reports opened!');
    setTimeout(() => closeAIAssistant(), 1000);
    return;
  }

  // Persons / Members
  if (cmd.includes('person') || cmd.includes('member') || cmd.includes('ممبر') || cmd.includes('افراد') || cmd.includes('پرسن')) {
    if (cmd.includes('add') || cmd.includes('نیا') || cmd.includes('شامل')) {
      openPersonModal();
      showAIFeedback('👥 Add Member form opened!');
      setTimeout(() => closeAIAssistant(), 1000);
      return;
    }
    switchView('persons');
    showAIFeedback('👥 Members list opened!');
    setTimeout(() => closeAIAssistant(), 1000);
    return;
  }

  // Settings & Theme
  if (cmd.includes('theme') || cmd.includes('dark') || cmd.includes('light') || cmd.includes('ڈارک') || cmd.includes('نائٹ')) {
    toggleTheme();
    showAIFeedback('🌓 Theme toggled!');
    setTimeout(() => closeAIAssistant(), 1000);
    return;
  }

  if (cmd.includes('password') || cmd.includes('پاس ورڈ')) {
    openChangePasswordModal();
    showAIFeedback('🔒 Change Password opened!');
    setTimeout(() => closeAIAssistant(), 1000);
    return;
  }

  if (cmd.includes('setting') || cmd.includes('سیٹنگ') || cmd.includes('backup') || cmd.includes('بیک اپ')) {
    switchView('settings');
    showAIFeedback('⚙️ Settings opened!');
    setTimeout(() => closeAIAssistant(), 1000);
    return;
  }

  // 2. PAYMENT RECEIVE COMMANDS
  if (cmd.includes('payment') || cmd.includes('پیمنٹ') || cmd.includes('وصولی') || cmd.includes('receive') || cmd.includes('ادائیگی')) {
    openPaymentModal();
    const amt = parseSpokenAmount(cmd);
    if (amt) {
      const amtInput = document.getElementById('payment-input-amount');
      if (amtInput) amtInput.value = amt;
    }

    // Try finding paid by and received by persons
    const foundPersons = [];
    if (state.persons && state.persons.length > 0) {
      for (const p of state.persons) {
        if (cmd.includes((p.name || '').toLowerCase())) {
          foundPersons.push(p);
        }
      }
    }
    if (foundPersons.length >= 1) {
      const paidBySel = document.getElementById('payment-input-paid-by');
      if (paidBySel) paidBySel.value = foundPersons[0].id;
    }
    if (foundPersons.length >= 2) {
      const recBySel = document.getElementById('payment-input-received-by');
      if (recBySel) recBySel.value = foundPersons[1].id;
    }

    showAIFeedback('💳 Payment Receive Form opened' + (amt ? ` with Rs. ${amt}` : '') + '!');
    setTimeout(() => closeAIAssistant(), 1200);
    return;
  }

  // 3. OPENING ADJUSTMENT COMMANDS
  if (cmd.includes('opening') || cmd.includes('ابتدائی') || cmd.includes('adjustment') || cmd.includes('ایڈجسٹمنٹ')) {
    openOpeningAdjustmentModal();
    const amt = parseSpokenAmount(cmd);
    if (amt) {
      const amtInput = document.getElementById('adj-input-amount');
      if (amtInput) amtInput.value = amt;
    }
    showAIFeedback('⚖️ Opening Adjustment Form opened' + (amt ? ` with Rs. ${amt}` : '') + '!');
    setTimeout(() => closeAIAssistant(), 1200);
    return;
  }

  // 4. BATCHES MANAGEMENT COMMANDS
  if (cmd.includes('transfer batch') || cmd.includes('close batch') || cmd.includes('بیچ ٹرانسفر') || cmd.includes('بیچ بند')) {
    triggerCloseTransferCurrent();
    showAIFeedback('🔄 Batch Close & Transfer opened!');
    setTimeout(() => closeAIAssistant(), 1200);
    return;
  }
  if (cmd.includes('batch') || cmd.includes('بیچ')) {
    openBatchesModal();
    showAIFeedback('📅 Batches Management opened!');
    setTimeout(() => closeAIAssistant(), 1200);
    return;
  }

  // 5. EXPENSE SMART AUTO-FILL COMMANDS
  // Check if speech contains expense keywords, amounts, categories or names
  const amt = parseSpokenAmount(cmd);
  const matchedPerson = matchPerson(cmd);

  let detectedCategory = 'Other';
  let detectedDesc = '';

  if (cmd.includes('ناشتہ') || cmd.includes('breakfast') || cmd.includes('paratha') || cmd.includes('انڈا') || cmd.includes('چائے') || cmd.includes('chai') || cmd.includes('روٹی') || cmd.includes('roti')) {
    detectedCategory = 'Breakfast';
    detectedDesc = 'Breakfast (ناشتہ)';
  } else if (cmd.includes('دوپہر') || cmd.includes('lunch') || cmd.includes('بریانی') || cmd.includes('biryani') || cmd.includes('دال') || cmd.includes('سبزی')) {
    detectedCategory = 'Lunch';
    detectedDesc = 'Lunch (دوپہر کا کھانا)';
  } else if (cmd.includes('رات') || cmd.includes('dinner') || cmd.includes('کڑاہی') || cmd.includes('karahi') || cmd.includes('گوشت') || cmd.includes('chicken') || cmd.includes('مرغی')) {
    detectedCategory = 'Dinner';
    detectedDesc = 'Dinner (رات کا کھانا)';
  } else if (cmd.includes('دودھ') || cmd.includes('milk') || cmd.includes('پھل') || cmd.includes('fruit') || cmd.includes('سودا') || cmd.includes('grocery')) {
    detectedCategory = 'Other';
    detectedDesc = 'Grocery / Items';
  } else {
    detectedDesc = 'Daily Mess Expense';
  }

  // If specific item word exists, use it in description
  if (cmd.includes('روٹی') || cmd.includes('roti')) detectedDesc = 'Khameri Roti / Naan';
  if (cmd.includes('چائے') || cmd.includes('chai')) detectedDesc = 'Chai / Tea';
  if (cmd.includes('انڈے') || cmd.includes('eggs')) detectedDesc = 'Eggs / Omelette';
  if (cmd.includes('بریانی') || cmd.includes('biryani')) detectedDesc = 'Biryani';
  if (cmd.includes('کڑاہی') || cmd.includes('karahi')) detectedDesc = 'Chicken Karahi';
  if (cmd.includes('دودھ') || cmd.includes('milk')) detectedDesc = 'Milk / Doodh';

  // If the command asks to open expense form or contains data
  if (cmd.includes('expense') || cmd.includes('خرچہ') || cmd.includes('کھولو') || cmd.includes('add') || amt || matchedPerson) {
    openExpenseModal();

    if (amt) {
      const amtInput = document.getElementById('expense-input-amount');
      if (amtInput) {
        amtInput.value = amt;
        amtInput.dispatchEvent(new Event('input'));
      }
    }

    if (detectedDesc) {
      const descInput = document.getElementById('expense-input-desc');
      if (descInput) descInput.value = detectedDesc;
    }

    if (detectedCategory) {
      setCategory(detectedCategory);
    }

    if (matchedPerson) {
      const payerSel = document.getElementById('expense-input-paid-by');
      if (payerSel) payerSel.value = matchedPerson.id;
    }

    let summaryText = '➕ Expense Form opened';
    if (amt) summaryText += ` (Rs. ${amt})`;
    if (matchedPerson) summaryText += ` for ${matchedPerson.name}`;
    if (detectedCategory) summaryText += ` [${detectedCategory}]`;

    showAIFeedback(summaryText + ' ✨');
    setTimeout(() => closeAIAssistant(), 1200);
    return;
  }

  // Fallback: Show understanding message
  showAIFeedback(`🤖 Command: "${originalText}" (کمانڈ واضح نہیں، دوبارہ بولیں)`, false);
}

// -----------------------------------------------------------------------------
// Opening Adjustment Modal & Actions
// -----------------------------------------------------------------------------
function openOpeningAdjustmentModal() {
  const modal = document.getElementById('opening-adjustment-modal');
  const dateInput = document.getElementById('adj-input-date');
  const amountInput = document.getElementById('adj-input-amount');
  const descInput = document.getElementById('adj-input-desc');

  populatePersonSelects();

  dateInput.value = toInputDate(new Date());
  amountInput.value = '';
  descInput.value = 'Opening Balance';

  modal.style.display = 'flex';
}

function closeOpeningAdjustmentModal() {
  const modal = document.getElementById('opening-adjustment-modal');
  if (modal) modal.style.display = 'none';
}

let isSavingOpeningAdjustment = false;
async function saveOpeningAdjustment(e) {
  e.preventDefault();
  if (isSavingOpeningAdjustment) return;

  const dateStr = document.getElementById('adj-input-date').value;
  const paidByPersonId = parseInt(document.getElementById('adj-input-paid-by').value, 10);
  const receivedByPersonId = parseInt(document.getElementById('adj-input-received-by').value, 10);
  const amount = parseFloat(document.getElementById('adj-input-amount').value);
  const description = document.getElementById('adj-input-desc').value.trim() || 'Opening Balance';

  if (!paidByPersonId) {
    alert('Please select who paid / brought forward opening balance (Paid By / Adjusted By).');
    return;
  }
  if (!receivedByPersonId) {
    alert('Please select who received / adjusted for (Received By / Adjusted For).');
    return;
  }
  if (paidByPersonId === receivedByPersonId) {
    alert('Paid By and Received By cannot be the same member! Please select different members.');
    return;
  }
  if (isNaN(amount) || amount <= 0) {
    alert('Please enter a valid adjustment amount.');
    return;
  }

  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateMillis = dateObj.getTime();

  const payload = {
    dateMillis,
    paidByPersonId,
    receivedByPersonId,
    amount,
    description
  };

  const btn = document.getElementById('adj-submit-btn');
  const origText = btn ? btn.textContent : 'Save Opening Adjustment';
  isSavingOpeningAdjustment = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const res = await fetch('/api/opening-adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      closeOpeningAdjustmentModal();
      if (state.activeView === 'expenses') loadExpenses();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'reports') generateActiveReport();
      alert('Opening Adjustment saved successfully!');
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to record opening adjustment: ' + err.message);
  } finally {
    isSavingOpeningAdjustment = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

// -----------------------------------------------------------------------------
// Batch Management
// -----------------------------------------------------------------------------
// Helper to display friendly batch dates (e.g. 08 Oct 2026)
function formatBatchDisplayDate(val) {
  if (!val) return '';
  const num = Number(val);
  const d = !isNaN(num) && num > 100000 ? new Date(num) : new Date(val);
  if (isNaN(d.getTime())) return String(val);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadActiveBatch() {
  try {
    const res = await fetch('/api/batches/active');
    const data = await res.json();
    const batchPill = document.getElementById('active-batch-pill');
    const bannerCard = document.getElementById('active-batch-banner-card');
    const bannerName = document.getElementById('active-batch-banner-name');
    const bannerDates = document.getElementById('active-batch-banner-dates');

    if (data.success && data.batch) {
      state.activeBatch = data.batch;
      const rawFrom = data.batch.fromDate ?? data.batch.FROMDate ?? data.batch.fromdate;
      const rawTo = data.batch.toDate ?? data.batch.TODate ?? data.batch.todate;
      const fromStr = formatBatchDisplayDate(rawFrom);
      const toStr = formatBatchDisplayDate(rawTo);
      const dateRangeText = (fromStr && toStr) ? ` <span style="font-size: 10px; opacity: 0.85; margin-left: 2px;">(${fromStr} to ${toStr})</span>` : '';

      if (batchPill) {
        batchPill.innerHTML = `📅 <strong>${data.batch.name}</strong>${dateRangeText}`;
        batchPill.title = `Current active batch: ${data.batch.name}. Click to manage.`;
      }

      if (bannerCard && bannerName) {
        bannerCard.style.display = 'flex';
        bannerName.textContent = data.batch.name;
        if (bannerDates) {
          bannerDates.textContent = (fromStr && toStr) ? `Batch Period: ${fromStr} to ${toStr}` : '';
        }
      }
    } else {
      state.activeBatch = null;
      if (batchPill) {
        batchPill.innerHTML = `📅 <strong>No Active Batch</strong>`;
        batchPill.title = 'No active batch set. Click to create or activate a batch.';
      }
      if (bannerCard) {
        bannerCard.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Failed to load active batch:', err);
  }
}

function openBatchesModal() {
  resetBatchForm();
  loadBatchesTable();
  const modal = document.getElementById('batches-modal');
  if (modal) modal.style.display = 'flex';
}

function closeBatchesModal() {
  const modal = document.getElementById('batches-modal');
  if (modal) modal.style.display = 'none';
}

function resetBatchForm() {
  document.getElementById('batch-edit-id').value = '';
  document.getElementById('batch-input-name').value = '';
  document.getElementById('batch-input-from').value = '';
  document.getElementById('batch-input-to').value = '';
  document.getElementById('batch-input-status').value = 'active';
  const title = document.getElementById('batch-form-title');
  if (title) title.textContent = '➕ Add / Edit Batch';
  const btn = document.getElementById('batch-submit-btn');
  if (btn) btn.textContent = 'Save Batch';
}

async function loadBatchesTable() {
  const tbody = document.getElementById('batches-table-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading batches...</td></tr>';

  try {
    const res = await fetch('/api/batches');
    const data = await res.json();
    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">Failed to load batches: ${data.message}</td></tr>`;
      return;
    }

    const batches = data.batches || [];
    if (batches.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No batches created yet.</td></tr>';
      return;
    }

    tbody.innerHTML = batches.map(b => {
      const isActive = b.status === 'active';
      const statusBadge = isActive
        ? '<span class="badge badge-green">Active (Current)</span>'
        : '<span class="badge" style="background:#e2e8f0; color:#475569;">Closed</span>';
      
      const actionButtons = isActive
        ? `
            <button class="btn btn-sm" onclick="openCloseTransferModal(${b.id})" style="background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; margin-right: 4px;" title="Close this batch and transfer balances to next batch">🔄 Close & Transfer</button>
            <button class="btn btn-secondary btn-sm" onclick='editBatch(${JSON.stringify(b).replace(/'/g, "&#39;")})' style="font-size: 11px; padding: 4px 8px;">Edit</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleBatchStatus(${b.id}, 'closed')" style="font-size: 11px; padding: 4px 8px;">Close Only</button>
          `
        : `
            <button class="btn btn-sm" onclick="openCloseTransferModal(${b.id})" style="background: rgba(16,185,129,0.12); color: #059669; border: 1px solid #10b981; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 4px; margin-right: 4px;" title="Transfer balances from this batch">🔄 Transfer Balances</button>
            <button class="btn btn-secondary btn-sm" onclick='editBatch(${JSON.stringify(b).replace(/'/g, "&#39;")})' style="font-size: 11px; padding: 4px 8px;">Edit</button>
            <button class="btn btn-primary btn-sm" onclick="toggleBatchStatus(${b.id}, 'active')" style="font-size: 11px; padding: 4px 8px;">Set Active</button>
          `;

      const rawFrom = b.fromDate ?? b.FROMDate ?? b.fromdate;
      const rawTo = b.toDate ?? b.TODate ?? b.todate;
      const displayFrom = formatBatchDisplayDate(rawFrom);
      const displayTo = formatBatchDisplayDate(rawTo);

      return `
        <tr>
          <td><strong>${escapeHtml(b.name)}</strong></td>
          <td>${displayFrom}</td>
          <td>${displayTo}</td>
          <td>${statusBadge}</td>
          <td style="text-align: right;">${b.totalEntries || b.entryCount || 0}</td>
          <td style="text-align: right; font-weight: 700;">${formatCurrency(b.totalExpense || 0)}</td>
          <td style="text-align: center; white-space: nowrap;">
            ${actionButtons}
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">${err.message}</td></tr>`;
  }
}

function editBatch(batch) {
  const rawFrom = batch.fromDate ?? batch.FROMDate ?? batch.fromdate;
  const rawTo = batch.toDate ?? batch.TODate ?? batch.todate;
  document.getElementById('batch-edit-id').value = batch.id;
  document.getElementById('batch-input-name').value = batch.name;
  document.getElementById('batch-input-from').value = toInputDate(rawFrom);
  document.getElementById('batch-input-to').value = toInputDate(rawTo);
  document.getElementById('batch-input-status').value = batch.status || 'active';
  const title = document.getElementById('batch-form-title');
  if (title) title.textContent = `✏️ Edit Batch #${batch.id}`;
  const btn = document.getElementById('batch-submit-btn');
  if (btn) btn.textContent = 'Update Batch';
}

async function saveBatch(e) {
  e.preventDefault();
  const id = document.getElementById('batch-edit-id').value;
  const name = document.getElementById('batch-input-name').value.trim();
  const fromDate = document.getElementById('batch-input-from').value;
  const toDate = document.getElementById('batch-input-to').value;
  const status = document.getElementById('batch-input-status').value;

  if (!name || !fromDate || !toDate) {
    alert('Please fill out batch name, from date, and to date.');
    return;
  }

  const payload = { name, fromDate, toDate, status };
  const btn = document.getElementById('batch-submit-btn');
  const origText = btn ? btn.textContent : 'Save Batch';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const url = id ? `/api/batches/${id}` : '/api/batches';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      resetBatchForm();
      await loadBatchesTable();
      await loadActiveBatch();
      await populateBatchFilter();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'expenses') loadExpenses();
      alert('Batch saved successfully!');
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to save batch: ' + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = origText;
    }
  }
}

async function toggleBatchStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/batches/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      await loadBatchesTable();
      await loadActiveBatch();
      await populateBatchFilter();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'expenses') loadExpenses();
    } else {
      alert('Error: ' + data.message);
    }
  } catch (err) {
    alert('Failed to change batch status: ' + err.message);
  }
}

// -----------------------------------------------------------------------------
// BATCH CLOSING & AUTOMATIC BALANCE TRANSFER
// -----------------------------------------------------------------------------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function triggerCloseTransferCurrent() {
  if (state.activeBatch && state.activeBatch.id) {
    openCloseTransferModal(state.activeBatch.id);
  } else {
    alert('No active batch currently set to close.');
  }
}

async function openCloseTransferModal(batchId) {
  const modal = document.getElementById('close-transfer-modal');
  if (!modal) return;

  document.getElementById('ct-batch-id').value = batchId;
  modal.style.display = 'flex';

  const loadingEl = document.getElementById('ct-loading');
  const contentEl = document.getElementById('ct-content-area');
  const confirmBtn = document.getElementById('ct-confirm-btn');

  if (loadingEl) loadingEl.style.display = 'block';
  if (contentEl) contentEl.style.display = 'none';
  if (confirmBtn) confirmBtn.disabled = true;

  try {
    const res = await fetch(`/api/batches/${batchId}/closing-preview`);
    const data = await res.json();

    if (!data.success) {
      alert('Failed to load batch preview: ' + data.message);
      closeCloseTransferModal();
      return;
    }

    // 1. Header info
    document.getElementById('ct-old-batch-name').textContent = data.batch.name;
    const fromStr = formatBatchDisplayDate(data.batch.fromDate);
    const toStr = formatBatchDisplayDate(data.batch.toDate);
    document.getElementById('ct-old-batch-dates').textContent = (fromStr && toStr) ? `Period: ${fromStr} to ${toStr}` : '';
    document.getElementById('ct-total-transferred-stat').textContent = formatCurrency(data.totalTransferredAmount || 0);
    document.getElementById('ct-members-stat').textContent = `${data.totalCreditors || 0} Creditors · ${data.totalDebtors || 0} Debtors`;

    // 2. Member Balances Preview Table
    const balTbody = document.getElementById('ct-balances-tbody');
    if (balTbody) {
      const balances = data.personBalances || [];
      if (balances.length === 0) {
        balTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:14px; color:var(--text-muted);">No members recorded in this batch.</td></tr>';
      } else {
        balTbody.innerHTML = balances.map(p => {
          const bal = p.remainingBalance || 0;
          let statusBadge = '<span class="badge" style="background:#e2e8f0; color:#475569;">Settled (0.00)</span>';
          let balColor = 'var(--text-main)';
          let balPrefix = '';

          if (bal > 0.01) {
            statusBadge = '<span class="badge badge-green">Advance / Creditor (+ Credit)</span>';
            balColor = '#059669';
            balPrefix = '+';
          } else if (bal < -0.01) {
            statusBadge = '<span class="badge badge-red">Payable / Debtor (- Due)</span>';
            balColor = '#dc2626';
          }

          return `
            <tr>
              <td><strong>${escapeHtml(p.personName)}</strong></td>
              <td style="text-align: right;">${formatCurrency(p.totalPaid || 0)}</td>
              <td style="text-align: right;">${formatCurrency(p.totalShare || 0)}</td>
              <td style="text-align: right; font-weight: 700; color: ${balColor};">${balPrefix}${formatCurrency(bal)}</td>
              <td style="text-align: center;">${statusBadge}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // 3. Opening Adjustment Entries Table
    const settTbody = document.getElementById('ct-settlements-tbody');
    if (settTbody) {
      const settlements = data.settlements || [];
      if (settlements.length === 0) {
        settTbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:14px; color:var(--text-muted);">All member balances are zero. No adjustment entries needed.</td></tr>';
      } else {
        settTbody.innerHTML = settlements.map((s, idx) => `
          <tr>
            <td><strong>#${idx + 1}</strong></td>
            <td><strong style="color: #059669;">${escapeHtml(s.creditorName)}</strong> <span style="font-size: 10px; color: var(--text-muted);">(Payer)</span></td>
            <td><strong style="color: #dc2626;">${escapeHtml(s.debtorName)}</strong> <span style="font-size: 10px; color: var(--text-muted);">(Share)</span></td>
            <td style="text-align: right; font-weight: 700; color: #10b981;">${formatCurrency(s.amount)}</td>
            <td style="font-size: 11px; color: var(--text-muted);">Auto Opening Balance B/F from ${escapeHtml(data.batch.name)}</td>
          </tr>
        `).join('');
      }
    }

    // 4. Next Batch Suggestion
    const sug = data.suggestedNextBatch || {};
    const nameInput = document.getElementById('ct-new-batch-name');
    const fromInput = document.getElementById('ct-new-batch-from');
    const toInput = document.getElementById('ct-new-batch-to');
    if (nameInput) nameInput.value = sug.name || '';
    if (fromInput) fromInput.value = sug.fromDate || '';
    if (toInput) toInput.value = sug.toDate || '';

    // 5. Existing batches dropdown
    const existSelect = document.getElementById('ct-existing-batch-select');
    if (existSelect) {
      const others = data.otherBatches || [];
      if (others.length === 0) {
        existSelect.innerHTML = '<option value="">(No other batches available)</option>';
      } else {
        existSelect.innerHTML = others.map(ob => `<option value="${ob.id}">${escapeHtml(ob.name)} (${ob.status})</option>`).join('');
      }
    }

    // Reset radio button to "new"
    const newRadio = document.querySelector('input[name="ct-target-mode"][value="new"]');
    if (newRadio) newRadio.checked = true;
    handleTargetBatchModeChange();

    // Reset checkbox
    const tfCheck = document.getElementById('ct-transfer-checkbox');
    if (tfCheck) tfCheck.checked = true;
    toggleTransferOptions();

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    alert('Error loading closing preview: ' + err.message);
    closeCloseTransferModal();
  }
}

function closeCloseTransferModal() {
  const modal = document.getElementById('close-transfer-modal');
  if (modal) modal.style.display = 'none';
}

function handleTargetBatchModeChange() {
  const mode = document.querySelector('input[name="ct-target-mode"]:checked')?.value || 'new';
  const newFields = document.getElementById('ct-new-batch-fields');
  const existFields = document.getElementById('ct-existing-batch-fields');
  if (mode === 'new') {
    if (newFields) newFields.style.display = 'grid';
    if (existFields) existFields.style.display = 'none';
  } else {
    if (newFields) newFields.style.display = 'none';
    if (existFields) existFields.style.display = 'block';
  }
}

function toggleTransferOptions() {
  const checked = document.getElementById('ct-transfer-checkbox')?.checked;
  const settTbody = document.getElementById('ct-settlements-tbody');
  if (settTbody) {
    settTbody.style.opacity = checked ? '1' : '0.35';
  }
}

async function submitCloseAndTransfer() {
  const batchId = document.getElementById('ct-batch-id').value;
  if (!batchId) return;

  const transferBalances = document.getElementById('ct-transfer-checkbox')?.checked ?? true;
  const mode = document.querySelector('input[name="ct-target-mode"]:checked')?.value || 'new';

  let nextBatch = null;
  let nextBatchId = null;

  if (mode === 'new') {
    const name = document.getElementById('ct-new-batch-name').value.trim();
    const fromDate = document.getElementById('ct-new-batch-from').value;
    const toDate = document.getElementById('ct-new-batch-to').value;
    if (!name || !fromDate || !toDate) {
      alert('Please fill out Next Batch Name, From Date, and To Date.');
      return;
    }
    nextBatch = { name, fromDate, toDate };
  } else {
    nextBatchId = document.getElementById('ct-existing-batch-select').value;
    if (!nextBatchId) {
      alert('Please select an existing batch or choose to create a new one.');
      return;
    }
  }

  const confirmMsg = transferBalances
    ? `Are you sure you want to close this batch and carry forward balances into the next batch?\n\nThis will automatically generate opening adjustment entries in the new batch.`
    : `Are you sure you want to close this batch without transferring balances?`;

  if (!confirm(confirmMsg)) return;

  const confirmBtn = document.getElementById('ct-confirm-btn');
  const origText = confirmBtn ? confirmBtn.textContent : 'Confirm & Transfer Balances';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Processing Transfer...';
  }

  try {
    const res = await fetch(`/api/batches/${batchId}/close-and-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transferBalances,
        nextBatchId,
        nextBatch
      })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Success!\n\n${data.message}`);
      closeCloseTransferModal();
      closeBatchesModal();
      await loadActiveBatch();
      await loadBatchesTable();
      await populateBatchFilter();
      if (state.activeView === 'dashboard') loadDashboard();
      if (state.activeView === 'expenses') loadExpenses();
    } else {
      alert('Failed to close and transfer batch: ' + data.message);
    }
  } catch (err) {
    alert('Error during batch transfer: ' + err.message);
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = origText;
    }
  }
}



