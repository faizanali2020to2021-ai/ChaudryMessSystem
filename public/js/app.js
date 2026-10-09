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
  showLoginModal();
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
      applyUserIdentity();
      hideLoginModal();
      await loadPersons();
      await loadDashboard();
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
}

// -----------------------------------------------------------------------------
// Navigation / View Switching
// -----------------------------------------------------------------------------
function switchView(viewName) {
  state.activeView = viewName;

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
  if (viewName === 'expenses') loadExpenses();
  if (viewName === 'persons') loadPersonsTable();
  if (viewName === 'reports') generateActiveReport();
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
        // Direct link to individual ledger report
        switchView('reports');
        switchReportTab('person-detail-ledger');
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

  // Preserve selections if possible
  const currentPaid = paidBy ? paidBy.value : '';
  const currentReport = reportPerson ? reportPerson.value : '';
  const currentPayPaid = paymentPaidBy ? paymentPaidBy.value : '';
  const currentPayRecv = paymentReceivedBy ? paymentReceivedBy.value : '';

  const optionsHtml = state.persons.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  if (expenseFilter) {
    expenseFilter.innerHTML = `<option value="">All Persons</option>` + optionsHtml;
  }

  if (paidBy) {
    paidBy.innerHTML = optionsHtml;
    if (currentPaid) paidBy.value = currentPaid;
  }

  if (reportPerson) {
    reportPerson.innerHTML = optionsHtml;
    if (currentReport) reportPerson.value = currentReport;
  }

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

async function savePerson(e) {
  e.preventDefault();
  const id = document.getElementById('person-edit-id').value;
  const name = document.getElementById('person-input-name').value.trim();
  const mobileNumber = document.getElementById('person-input-mobile').value.trim();

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

async function loadExpenses() {
  const search = document.getElementById('expense-search').value.trim();
  const personId = document.getElementById('expense-filter-person').value;
  const sortBy = document.getElementById('expense-sort-by').value;

  const params = new URLSearchParams();
  if (search) params.append('searchQuery', search);
  if (personId) params.append('personId', personId);
  if (sortBy) params.append('sortBy', sortBy);

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
    state.expenses.forEach(e => {
      const tr = document.createElement('tr');
      const isPayment = e.category === 'Payment';
      const catBadge = isPayment
        ? `<span class="badge" style="background-color: #d1fae5; color: #065f46; font-weight: 600;">💳 Payment</span>`
        : (e.category ? `<span class="badge badge-primary">${e.category}</span>` : '<span style="color: var(--text-muted); font-size: 12px;">—</span>');
      
      tr.innerHTML = `
        <td>${formatDate(Number(e.date))}</td>
        <td><strong>${e.description}</strong></td>
        <td>${catBadge}</td>
        <td>${e.paidByName}</td>
        <td style="text-align: right; font-weight: 700; ${isPayment ? 'color: #10B981;' : ''}">${formatCurrency(e.amount)}</td>
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

async function savePayment(e) {
  e.preventDefault();
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
  if (btn) btn.disabled = true;

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
    if (btn) btn.disabled = false;
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

async function saveExpense(e) {
  e.preventDefault();
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
function switchReportTab(tabName) {
  state.activeReportTab = tabName;

  document.querySelectorAll('.report-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(tabName)) btn.classList.add('active');
  });

  const dateGroup = document.getElementById('filter-date-group');
  const personGroup = document.getElementById('filter-person-group');
  const waBtn = document.getElementById('report-wa-share-btn');

  // Adjust filters visibility per report type
  if (tabName === 'total-expense' || tabName === 'paid-by-person') {
    dateGroup.style.display = 'flex';
    personGroup.style.display = 'none';
    waBtn.style.display = 'none';
  } else if (tabName === 'person-ledger' || tabName === 'person-detail-ledger') {
    dateGroup.style.display = 'none';
    personGroup.style.display = 'flex';
    waBtn.style.display = 'inline-flex';
  } else if (tabName === 'day-wise') {
    dateGroup.style.display = 'flex';
    personGroup.style.display = 'flex';
    waBtn.style.display = 'none';
  } else if (tabName === 'group-summary') {
    dateGroup.style.display = 'none';
    personGroup.style.display = 'none';
    waBtn.style.display = 'none';
  }

  generateActiveReport();
}

async function generateActiveReport() {
  const tab = state.activeReportTab;
  const fromStr = document.getElementById('report-from-date').value;
  const toStr = document.getElementById('report-to-date').value;
  const personId = document.getElementById('report-person-select').value;

  const fromMillis = new Date(fromStr + 'T00:00:00').getTime();
  const toMillis = new Date(toStr + 'T23:59:59.999').getTime();

  document.getElementById('report-doc-date').textContent = `Generated: ${new Date().toLocaleString('en-GB')}`;

  if (tab === 'total-expense') {
    await renderTotalExpenseReport(fromMillis, toMillis);
  } else if (tab === 'paid-by-person') {
    await renderPaidByPersonReport(fromMillis, toMillis);
  } else if (tab === 'person-ledger') {
    await renderPersonLedgerReport(personId);
  } else if (tab === 'person-detail-ledger') {
    await renderPersonDetailLedgerReport(personId);
  } else if (tab === 'day-wise') {
    await renderDayWiseReport(fromMillis, toMillis, personId);
  } else if (tab === 'group-summary') {
    await renderGroupSummaryReport();
  }
}

// 1. Total Expense Report
async function renderTotalExpenseReport(fromMillis, toMillis) {
  const subtitle = `Total Expense Report (${formatDate(fromMillis)} – ${formatDate(toMillis)})`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const res = await fetch(`/api/reports/total-expense?fromMillis=${fromMillis}&toMillis=${toMillis}`);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

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
          ${data.expenses.map(e => `
            <tr>
              <td>${formatDate(Number(e.date))}</td>
              <td>${e.description}</td>
              <td>${e.paidByName}</td>
              <td style="text-align: right; font-weight: 700;">${formatCurrency(e.amount)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div style="text-align: right; margin-top: 18px; font-size: 16px; font-weight: 800;">
      Grand Total: ${formatCurrency(data.totalExpense)}
    </div>
  `;
}

// 2. Paid by Person Report
async function renderPaidByPersonReport(fromMillis, toMillis) {
  const subtitle = `Paid by Person Report (${formatDate(fromMillis)} – ${formatDate(toMillis)})`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const res = await fetch(`/api/reports/paid-by-person?fromMillis=${fromMillis}&toMillis=${toMillis}`);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

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
async function renderPersonLedgerReport(personId) {
  if (!personId) return;
  const res = await fetch(`/api/reports/person-ledger?personId=${personId}`);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const b = data.balance;
  const subtitle = `Ledger Report: ${b.personName}`;
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
async function renderPersonDetailLedgerReport(personId) {
  if (!personId) return;
  const res = await fetch(`/api/reports/person-detail-ledger?personId=${personId}`);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const subtitle = `Detail Ledger Report: ${data.personName}`;
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

// 5. Day-Wise Expense Report
async function renderDayWiseReport(fromMillis, toMillis, personId) {
  let url = `/api/reports/day-wise?fromMillis=${fromMillis}&toMillis=${toMillis}`;
  if (personId) url += `&personId=${personId}`;

  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

  const pTitle = data.personName ? ` — ${data.personName}` : '';
  const subtitle = `Day-Wise Expense Report (${formatDate(fromMillis)} – ${formatDate(toMillis)})${pTitle}`;
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
            ${g.categories.map(c => `
              <tr>
                <td style="font-weight: 700; width: 140px;">${c.category}</td>
                <td style="text-align: right; color: var(--green-text); font-weight: 600;">
                  Total ${formatCurrency(c.totalAmount)} &divide; ${c.effectivePersons} = <strong>${formatCurrency(c.calculatedShare)}</strong>
                </td>
              </tr>
            `).join('')}
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
async function renderGroupSummaryReport() {
  const subtitle = `Group Expense Summary & Debt Settlement`;
  document.getElementById('report-doc-subtitle').textContent = subtitle;

  const res = await fetch('/api/reports/group-summary');
  const data = await res.json();
  if (!data.success) return;
  state.currentReportData = data;

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
  } else if (tab === 'group-summary') {
    csvContent += 'Person Name,Total Paid,Total Share,Remaining Balance\n';
    d.balances.forEach(b => {
      csvContent += `"${b.personName}",${b.totalPaid},${b.totalShare},${b.remainingBalance}\n`;
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

  const personName = d.personName || (d.balance && d.balance.personName);
  const totalPaid = d.totalPaid ?? (d.balance && d.balance.totalPaid);
  const totalExp = d.yourTotalExpense ?? (d.balance && d.balance.totalShare);
  const remaining = d.remainingBalance ?? (d.balance && d.balance.remainingBalance);
  const isReceivable = remaining >= 0;

  const message = `*Chaudry Mess System - Expense Ledger Report*\n` +
    `Member: *${personName}*\n` +
    `-----------------------------------\n` +
    `Total Expense: ${formatCurrency(totalExp)}\n` +
    `Total Paid: ${formatCurrency(totalPaid)}\n` +
    `*${isReceivable ? 'Receivable Amount' : 'Payable Amount'}:* ${formatCurrency(Math.abs(remaining))}\n` +
    `-----------------------------------\n` +
    `Generated on: ${new Date().toLocaleDateString('en-GB')}`;

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
      body: JSON.stringify({ shopName, address })
    });
    const data = await res.json();
    if (data.success) {
      if (state.user) {
        state.user.shopName = data.shopName;
        state.user.shopAddress = data.shopAddress;
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
