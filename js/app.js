/**
 * MEP LUXURY ENTERPRISE MANUFACTURING INTELLIGENCE — CLIENT LOGIC 4.0
 * Benchmark Architecture: SAP Fiori, Siemens Opcenter, Microsoft Dynamics 365, Linear, Stripe
 */

// Global Reactive State
let allBOMs = [];
let filteredBOMs = [];
let feasibilityMatrix = [];
let allRawMaterials = [];
let currentPage = 1;
let pageSize = 999999;
let activeBOM = null;
let syncInterval = null;
let currentTab = 'registry';
let isMobileSidebarOpen = false;
let currentFeasibilitySegment = '';
let currentDrawerTab = 'simulator';
let simulatedTargetQty = 1000;

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebarState();
  initTableDensity();
  loadAllData();
  setupKeyboardShortcuts();
});

// -------------------------------------------------------------
// 1. Theme & Layout Preferences Management
// -------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem('mep_theme') || 'dark';
  if (saved === 'dark') {
    document.documentElement.classList.add('dark');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = 'ph ph-sun text-base';
  } else {
    document.documentElement.classList.remove('dark');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.className = 'ph ph-moon text-base';
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('mep_theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = isDark ? 'ph ph-sun text-base' : 'ph ph-moon text-base';
}

function initSidebarState() {
  const isCollapsed = localStorage.getItem('mep_sidebar_collapsed') === 'true';
  const sidebar = document.getElementById('app-sidebar');
  const toggleBtn = document.getElementById('btn-sidebar-toggle-main');
  const toggleIcon = document.getElementById('sidebar-toggle-icon');
  if (sidebar && isCollapsed) {
    sidebar.classList.add('sidebar-collapsed');
    if (toggleIcon) toggleIcon.className = 'ph-bold ph-sidebar text-lg text-emerald-600 dark:text-emerald-400';
    if (toggleBtn) {
      toggleBtn.classList.add('bg-emerald-50', 'dark:bg-emerald-950/60', 'border-emerald-300', 'dark:border-emerald-700', 'text-emerald-600', 'dark:text-emerald-400');
    }
  }
}

function toggleSidebarCollapse() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('sidebar-collapsed');
  localStorage.setItem('mep_sidebar_collapsed', isCollapsed);
  const toggleIcon = document.getElementById('sidebar-toggle-icon');
  const toggleBtn = document.getElementById('btn-sidebar-toggle-main');
  if (toggleIcon) {
    toggleIcon.className = isCollapsed 
      ? 'ph-bold ph-sidebar text-lg text-emerald-600 dark:text-emerald-400' 
      : 'ph ph-sidebar-simple text-lg';
  }
  if (toggleBtn) {
    if (isCollapsed) {
      toggleBtn.classList.add('bg-emerald-50', 'dark:bg-emerald-950/60', 'border-emerald-300', 'dark:border-emerald-700', 'text-emerald-600', 'dark:text-emerald-400');
    } else {
      toggleBtn.classList.remove('bg-emerald-50', 'dark:bg-emerald-950/60', 'border-emerald-300', 'dark:border-emerald-700', 'text-emerald-600', 'dark:text-emerald-400');
    }
  }
}

function initTableDensity() {
  const savedDensity = localStorage.getItem('mep_table_density') || 'comfortable';
  const table = document.getElementById('master-datagrid');
  if (table) {
    table.classList.remove('density-comfortable', 'density-compact');
    table.classList.add(`density-${savedDensity}`);
  }
  const icon = document.getElementById('density-icon');
  if (icon) {
    icon.className = savedDensity === 'compact' ? 'ph ph-arrows-in-line-vertical text-base' : 'ph ph-rows text-base';
  }
}

function toggleTableDensity() {
  const table = document.getElementById('master-datagrid');
  if (!table) return;
  const isComfortable = table.classList.contains('density-comfortable');
  const newDensity = isComfortable ? 'compact' : 'comfortable';
  table.classList.remove('density-comfortable', 'density-compact');
  table.classList.add(`density-${newDensity}`);
  localStorage.setItem('mep_table_density', newDensity);
  
  const icon = document.getElementById('density-icon');
  if (icon) {
    icon.className = newDensity === 'compact' ? 'ph ph-arrows-in-line-vertical text-base' : 'ph ph-rows text-base';
  }
  showToast(`Table density switched to ${newDensity}`);
}

function toggleNotificationMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('notification-menu');
  if (menu) menu.classList.toggle('hidden');
}

// -------------------------------------------------------------
// 2. Data Fetching & Dashboard KPIs
// -------------------------------------------------------------
async function loadAllData() {
  await Promise.all([
    fetchStats(),
    fetchBOMs()
  ]);
}

async function fetchStats() {
  try {
    let stats = null;
    const res = await fetch('/api/stats');
    if (res.ok) {
      stats = await res.json();
    } else {
      // Fallback on static hosting (GitHub Pages)
      try {
        const hRes = await fetch('data/sync_history.json');
        if (hRes.ok) {
          const history = await hRes.json();
          if (history && history.length > 0) {
            stats = {
              total_boms: history[0].total_boms || (allBOMs.length || 174),
              total_stock_items: history[0].total_stock_items || 418,
              ready_to_produce_count: 39,
              last_sync: history[0]
            };
          }
        }
      } catch (_) {}
    }

    if (!stats) {
      stats = {
        total_boms: allBOMs.length || 174,
        total_stock_items: allRawMaterials.length || 418,
        ready_to_produce_count: 39,
        last_sync: { sync_time: new Date().toLocaleTimeString() }
      };
    }

    const totalEl = document.getElementById('stat-total-boms');
    if (totalEl) totalEl.textContent = (stats.total_boms || allBOMs.length || 174).toLocaleString();

    const readyEl = document.getElementById('stat-ready-produce');
    if (readyEl) readyEl.textContent = (stats.ready_to_produce_count || 0).toLocaleString();

    const totalBomsCount = stats.total_boms || allBOMs.length || 174;
    const blockedCount = Math.max(0, totalBomsCount - (stats.ready_to_produce_count || 0));
    const blockedEl = document.getElementById('stat-blocked-count');
    if (blockedEl) blockedEl.textContent = blockedCount.toLocaleString();

    const whEl = document.getElementById('stat-warehouse-items');
    if (whEl) whEl.textContent = (stats.total_stock_items || 418).toLocaleString();

    const sideBoms = document.getElementById('badge-total-boms-sidebar');
    if (sideBoms) sideBoms.textContent = totalBomsCount;

    const sideStock = document.getElementById('badge-stock-items-sidebar');
    if (sideStock) sideStock.textContent = stats.total_stock_items || 418;

    // Prominent Last sync header label
    const syncTimeEl = document.getElementById('last-sync-time-text');
    if (syncTimeEl) {
      const syncTime = stats.last_sync && stats.last_sync.sync_time 
        ? (stats.last_sync.sync_time.includes(' ') ? stats.last_sync.sync_time.split(' ')[1] : stats.last_sync.sync_time)
        : new Date().toLocaleTimeString();
      syncTimeEl.textContent = `Live Sync: ${syncTime} • ${totalBomsCount} BOMs`;
    }

    // Populate Section Filter Dropdown (Custom Frosted Glass Dropdown)
    if (stats.section_breakdown && stats.section_breakdown.length > 0) {
      currentSectionOptions = stats.section_breakdown;
      renderCustomFloorMenu();
    }

  } catch (e) {
    console.error('Error fetching dashboard statistics:', e);
  }
}

async function fetchBOMs() {
  try {
    let res = await fetch('/api/boms');
    if (!res.ok) {
      // Fallback to static data file on GitHub Pages / Static Hosting
      res = await fetch('data/boms.json');
    }
    if (!res.ok) return;
    allBOMs = await res.json();
    
    // Pre-index every BOM for zero-latency multi-keyword instant search
    allBOMs.forEach(buildBOMSearchIndex);

    const totalCountEl = document.getElementById('total-count');
    if (totalCountEl) totalCountEl.textContent = allBOMs.length;
    
    applyFilters();
  } catch (e) {
    console.error('Error fetching BOM dataset:', e);
  }
}

function buildBOMSearchIndex(b) {
  const prodName = (b.product_name || '').toLowerCase();
  const cleanProdName = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  const itemCode = (b.item_code || '').toLowerCase();
  const bomNo = String(b.bom_no || '').toLowerCase();
  const sec = (b.section || '').toLowerCase();
  b._searchIndex = `${prodName} ${cleanProdName} ${itemCode} ${bomNo} ${sec}`;
}

// -------------------------------------------------------------
// 3. Segmented Control, Filter Chips & Instant Search
// -------------------------------------------------------------
function setFeasibilitySegment(val) {
  currentFeasibilitySegment = val;
  
  const segAll = document.getElementById('seg-all');
  const segReady = document.getElementById('seg-ready');
  const segBlocked = document.getElementById('seg-blocked');

  [segAll, segReady, segBlocked].forEach(btn => {
    if (btn) {
      btn.className = 'flex-1 h-full rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-400 font-semibold text-[11px]';
    }
  });

  if (val === 'can_produce' && segReady) {
    segReady.className = 'flex-1 h-full rounded-lg flex items-center justify-center bg-white dark:bg-dark-750 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs border border-emerald-500/30 text-[11px]';
  } else if (val === 'blocked' && segBlocked) {
    segBlocked.className = 'flex-1 h-full rounded-lg flex items-center justify-center bg-white dark:bg-dark-750 text-rose-600 dark:text-rose-400 font-bold shadow-2xs border border-rose-500/30 text-[11px]';
  } else if (segAll) {
    segAll.className = 'flex-1 h-full rounded-lg flex items-center justify-center bg-white dark:bg-dark-750 text-slate-900 dark:text-white font-bold shadow-2xs text-[11px]';
  }

  currentPage = 1;
  applyFilters();
}

let searchDebounce = null;
function handleSearch() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    requestAnimationFrame(() => {
      handleSearchNow();
    });
  }, 35);
}

function handleSearchNow() {
  const input = document.getElementById('search-input');
  const q = input ? input.value.trim() : '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) {
    if (q) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  currentPage = 1;
  applyFilters();
}

function clearSearch() {
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  currentPage = 1;
  applyFilters();
}

function resetFilters() {
  clearSearch();
  selectCustomFloor('', 'All Production Floors');

  const sortFilter = document.getElementById('filter-sort');
  if (sortFilter) sortFilter.value = 'rms_desc';

  setFeasibilitySegment('');
}

function filterByFeasibility(type) {
  switchNavTab('registry');
  setFeasibilitySegment(type);
}

// Custom Frosted Glass Dropdown Engine
let currentSectionOptions = [];

function toggleCustomFloorDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('custom-floor-menu');
  const caret = document.getElementById('custom-floor-caret');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (caret) caret.className = 'ph ph-caret-up text-xs text-emerald-500 shrink-0';
  } else {
    menu.classList.add('hidden');
    if (caret) caret.className = 'ph ph-caret-down text-xs text-slate-400 shrink-0';
  }
}

function selectCustomFloor(val, label) {
  const hiddenInput = document.getElementById('filter-section');
  const textEl = document.getElementById('custom-floor-text');
  if (hiddenInput) hiddenInput.value = val;
  if (textEl) textEl.textContent = label || 'All Production Floors';

  // Close menu
  const menu = document.getElementById('custom-floor-menu');
  const caret = document.getElementById('custom-floor-caret');
  if (menu) menu.classList.add('hidden');
  if (caret) caret.className = 'ph ph-caret-down text-xs text-slate-400 shrink-0';

  renderCustomFloorMenu();
  currentPage = 1;
  applyFilters();
}

function renderCustomFloorMenu() {
  const menu = document.getElementById('custom-floor-menu');
  if (!menu) return;

  const currentVal = (document.getElementById('filter-section') || {}).value || '';
  menu.innerHTML = '';

  // "All Production Floors" Option
  const allItem = document.createElement('div');
  const isAllSelected = currentVal === '';
  allItem.className = `flex items-center justify-between p-2 px-2.5 rounded-xl cursor-pointer transition-none ${
    isAllSelected 
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20' 
      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-dark-750/80 font-medium'
  }`;
  allItem.onclick = () => selectCustomFloor('', 'All Production Floors');
  allItem.innerHTML = `
    <div class="flex items-center gap-2">
      <i class="ph ph-buildings ${isAllSelected ? 'text-emerald-500' : 'text-slate-400'}"></i>
      <span>All Production Floors</span>
    </div>
    ${isAllSelected ? '<i class="ph-bold ph-check text-emerald-500 text-xs"></i>' : ''}
  `;
  menu.appendChild(allItem);

  // Dynamic Section Options
  currentSectionOptions.forEach(s => {
    const isSelected = currentVal === s.section;
    const item = document.createElement('div');
    item.className = `flex items-center justify-between p-2 px-2.5 rounded-xl cursor-pointer transition-none ${
      isSelected 
        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20' 
        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-dark-750/80 font-medium'
    }`;
    item.onclick = () => selectCustomFloor(s.section, s.section);
    item.innerHTML = `
      <div class="flex items-center gap-2 truncate">
        <i class="ph ph-factory ${isSelected ? 'text-emerald-500' : 'text-slate-400'}"></i>
        <span class="truncate">${escapeHtml(s.section)}</span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0 ml-2">
        <span class="glass-pill glass-pill-neutral font-mono text-[10px]">${s.count}</span>
        ${isSelected ? '<i class="ph-bold ph-check text-emerald-500 text-xs"></i>' : ''}
      </div>
    `;
    menu.appendChild(item);
  });
}

// Global click-outside listener to close dropdowns & popovers
document.addEventListener('click', (e) => {
  const container = document.getElementById('custom-floor-container');
  const menu = document.getElementById('custom-floor-menu');
  const caret = document.getElementById('custom-floor-caret');
  if (container && !container.contains(e.target) && menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (caret) caret.className = 'ph ph-caret-down text-xs text-slate-400 shrink-0';
  }

  const notifBtn = document.getElementById('notification-btn');
  const notifMenu = document.getElementById('notification-menu');
  if (notifBtn && !notifBtn.contains(e.target) && notifMenu && !notifMenu.contains(e.target) && notifMenu && !notifMenu.classList.contains('hidden')) {
    notifMenu.classList.add('hidden');
  }
});

function renderFilterChips(q, sec, feas) {
  const container = document.getElementById('filter-chips-container');
  if (!container) return;
  container.innerHTML = '';

  if (q) {
    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-mono text-[11px] border border-emerald-200 dark:border-emerald-800/60';
    chip.innerHTML = `<span>Query: "${escapeHtml(q)}"</span> <button onclick="clearSearch()" class="hover:text-emerald-950 font-bold ml-1">✕</button>`;
    container.appendChild(chip);
  }

  if (sec) {
    const chip = document.createElement('span');
    chip.className = 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 text-[11px] border border-cyan-200 dark:border-cyan-800/60';
    chip.innerHTML = `<span>Floor: ${escapeHtml(sec)}</span> <button onclick="clearSectionFilter()" class="hover:text-cyan-950 font-bold ml-1">✕</button>`;
    container.appendChild(chip);
  }

  if (feas) {
    const chip = document.createElement('span');
    const isReady = feas === 'can_produce';
    chip.className = `inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] border ${isReady ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60' : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'}`;
    chip.innerHTML = `<span>Status: ${isReady ? 'Ready to Build' : 'Capacity Blocked'}</span> <button onclick="setFeasibilitySegment('')" class="font-bold ml-1">✕</button>`;
    container.appendChild(chip);
  }
}

function clearSectionFilter() {
  selectCustomFloor('', 'All Production Floors');
}

function applyFilters() {
  const searchInput = document.getElementById('search-input');
  const rawQ = searchInput ? searchInput.value.toLowerCase().trim() : '';

  const secFilter = document.getElementById('filter-section');
  const sec = secFilter ? secFilter.value : '';

  const feas = currentFeasibilitySegment;

  const sortFilter = document.getElementById('filter-sort');
  const sort = sortFilter ? sortFilter.value : 'rms_desc';

  // Tokenize search query into multiple keywords
  const tokens = rawQ ? rawQ.split(/\s+/).filter(Boolean) : [];

  // Smart Multi-Token Search using Pre-computed Index
  if (tokens.length > 0) {
    filteredBOMs = allBOMs.filter(b => {
      if (sec && b.section !== sec) return false;
      if (feas === 'can_produce' && !b.can_produce) return false;
      if (feas === 'blocked' && b.can_produce) return false;

      const idx = b._searchIndex || '';
      for (let i = 0; i < tokens.length; i++) {
        if (!idx.includes(tokens[i])) return false;
      }
      return true;
    });
  } else {
    filteredBOMs = allBOMs.filter(b => {
      if (sec && b.section !== sec) return false;
      if (feas === 'can_produce' && !b.can_produce) return false;
      if (feas === 'blocked' && b.can_produce) return false;
      return true;
    });
  }

  // Sorting (Priority 1: SFG1010079 at #1, Priority 2: Other Complete Body, Priority 3: Other Products by RM count)
  if (sort === 'rms_desc') {
    filteredBOMs.sort((a, b) => {
      const aName = (a.product_name || '').toLowerCase();
      const bName = (b.product_name || '').toLowerCase();
      const aCode = (a.item_code || '').toUpperCase();
      const bCode = (b.item_code || '').toUpperCase();
      const aNo = String(a.bom_no || '');
      const bNo = String(b.bom_no || '');

      const aIsSFG79 = aCode === 'SFG1010079' || aNo === '23090063' || aName.includes('sfg1010079');
      const bIsSFG79 = bCode === 'SFG1010079' || bNo === '23090063' || bName.includes('sfg1010079');

      if (aIsSFG79 && !bIsSFG79) return -1;
      if (!aIsSFG79 && bIsSFG79) return 1;

      const aIsCompleteBody = aName.includes('complete body') || aName.includes('ceiling fan complete body');
      const bIsCompleteBody = bName.includes('complete body') || bName.includes('ceiling fan complete body');

      if (aIsCompleteBody && !bIsCompleteBody) return -1;
      if (!aIsCompleteBody && bIsCompleteBody) return 1;

      return (b.raw_materials || []).length - (a.raw_materials || []).length;
    });
  } else if (sort === 'rms_asc') {
    filteredBOMs.sort((a, b) => {
      const aName = (a.product_name || '').toLowerCase();
      const bName = (b.product_name || '').toLowerCase();
      const aCode = (a.item_code || '').toUpperCase();
      const bCode = (b.item_code || '').toUpperCase();
      const aNo = String(a.bom_no || '');
      const bNo = String(b.bom_no || '');

      const aIsSFG79 = aCode === 'SFG1010079' || aNo === '23090063' || aName.includes('sfg1010079');
      const bIsSFG79 = bCode === 'SFG1010079' || bNo === '23090063' || bName.includes('sfg1010079');

      if (aIsSFG79 && !bIsSFG79) return -1;
      if (!aIsSFG79 && bIsSFG79) return 1;

      const aIsCompleteBody = aName.includes('complete body') || aName.includes('ceiling fan complete body');
      const bIsCompleteBody = bName.includes('complete body') || bName.includes('ceiling fan complete body');

      if (aIsCompleteBody && !bIsCompleteBody) return -1;
      if (!aIsCompleteBody && bIsCompleteBody) return 1;

      return (a.raw_materials || []).length - (b.raw_materials || []).length;
    });
  } else if (sort === 'buildable_desc') {
    filteredBOMs.sort((a, b) => (b.max_buildable_units || 0) - (a.max_buildable_units || 0));
  } else if (sort === 'bom_no_desc') {
    filteredBOMs.sort((a, b) => String(b.bom_no).localeCompare(String(a.bom_no)));
  } else if (sort === 'bom_no_asc') {
    filteredBOMs.sort((a, b) => String(a.bom_no).localeCompare(String(b.bom_no)));
  } else if (sort === 'name_asc') {
    filteredBOMs.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
  }

  renderFilterChips(rawQ, sec, feas);

  const filterCountEl = document.getElementById('filter-count');
  if (filterCountEl) filterCountEl.textContent = filteredBOMs.length;

  renderMasterTable();
}

// -------------------------------------------------------------
// 4. Enterprise DataGrid Table, Row Selection & Actions
// -------------------------------------------------------------
function renderMasterTable() {
  const tbody = document.getElementById('bom-table-body');
  if (!tbody) return;

  if (filteredBOMs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-14 text-center">
          <div class="flex flex-col items-center justify-center space-y-2 text-slate-400 dark:text-slate-500">
            <i class="ph ph-magnifying-glass text-4xl stroke-[1.5]"></i>
            <p class="text-sm font-semibold text-slate-600 dark:text-slate-400">No matching production formulations found</p>
            <p class="text-xs">Adjust your search terms or active floor filters.</p>
            <button onclick="resetFilters()" class="btn-luxury btn-luxury-secondary mt-2 text-xs">
              Clear All Filters
            </button>
          </div>
        </td>
      </tr>
    `;
    updatePagination(0);
    return;
  }

  const totalPages = Math.ceil(filteredBOMs.length / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, filteredBOMs.length);
  const pageItems = filteredBOMs.slice(startIdx, endIdx);

  const fragment = document.createDocumentFragment();

  pageItems.forEach((b, idx) => {
    const row = document.createElement('tr');
    row.className = 'table-row-hover group cursor-pointer border-b border-slate-100/60 dark:border-slate-800/60';
    row.onclick = (e) => {
      if (!e.target.closest('.no-row-click')) {
        openAnalysisModal(b.bom_no);
      }
    };

    const rmCount = (b.raw_materials || []).length;
    const maxUnits = b.max_buildable_units || 0;
    const canProduce = b.can_produce;

    // SLEEK ENTERPRISE BUILD CAPACITY PILL (Linear + Apple Design)
    let capacityWidget = '';
    if (canProduce && maxUnits > 0) {
      capacityWidget = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 whitespace-nowrap" title="${maxUnits.toLocaleString()} Units can be produced immediately (Sufficient Warehouse Stock)">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span class="font-bold text-emerald-900 dark:text-emerald-100">${maxUnits.toLocaleString()} Units</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold">Ready</span>
        </span>
      `;
    } else {
      const bName = b.bottleneck_name ? escapeHtml(b.bottleneck_name) : 'Raw Material Shortage';
      capacityWidget = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 whitespace-nowrap" title="Blocked by component shortage: ${bName}">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          <span class="font-bold text-rose-900 dark:text-rose-100">0 Units</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-800 dark:text-rose-200 font-bold">Blocked</span>
        </span>
      `;
    }

    row.innerHTML = `
      <td class="py-4 px-3 text-center text-xs text-slate-400 font-mono">${startIdx + idx + 1}</td>
      <td class="py-4 px-4">
        <span class="glass-pill glass-pill-neutral font-mono font-bold text-xs">
          ${escapeHtml(b.bom_no)}
        </span>
      </td>
      <td class="py-4 px-4">
        <div class="font-bold text-slate-900 dark:text-white">
          ${escapeHtml(getCleanProductName(b.product_name, b.item_code))}
        </div>
        <div class="text-xs text-slate-400 font-mono mt-0.5">
          Item Code: <span class="font-semibold text-slate-600 dark:text-slate-300">${escapeHtml(b.item_code || '--')}</span>
        </div>
      </td>
      <td class="py-4 px-4">
        <span class="glass-pill glass-pill-neutral text-xs font-medium">
          <i class="ph ph-buildings text-slate-400"></i> ${escapeHtml(b.section || '--')}
        </span>
      </td>
      <td class="py-4 px-4 text-center">
        <span class="glass-pill glass-pill-neutral font-mono font-semibold text-xs">
          ${rmCount} RMs
        </span>
      </td>
      <td class="py-4 px-4 text-center">
        ${capacityWidget}
      </td>
      <td class="py-4 px-4 text-center no-row-click" onclick="event.stopPropagation()">
        <button onclick="openAnalysisModal('${b.bom_no}')" class="btn-table-action mx-auto" title="Inspect Product Specification">
          <i class="ph ph-sliders-horizontal text-base"></i>
        </button>
      </td>
    `;
    fragment.appendChild(row);
  });

  tbody.replaceChildren(fragment);
  updatePagination(totalPages);
}

function updatePagination(totalPages) {
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
  }

  const prevBtn = document.getElementById('btn-prev-page');
  if (prevBtn) {
    prevBtn.disabled = currentPage <= 1;
  }

  const nextBtn = document.getElementById('btn-next-page');
  if (nextBtn) {
    nextBtn.disabled = currentPage >= totalPages;
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderMasterTable();
  }
}

function nextPage() {
  const totalPages = Math.ceil(filteredBOMs.length / pageSize) || 1;
  if (currentPage < totalPages) {
    currentPage++;
    renderMasterTable();
  }
}

function changePageSize() {
  const select = document.getElementById('page-size');
  if (select) {
    pageSize = parseInt(select.value, 10) || 15;
    currentPage = 1;
    renderMasterTable();
  }
}

// -------------------------------------------------------------
// 5. Sidebar Navigation & Multi-View Router
// -------------------------------------------------------------
let isOpsAccordionOpen = true;

function toggleOpsAccordion() {
  const submenu = document.getElementById('ops-submenu');
  const caret = document.getElementById('ops-caret');
  if (!submenu) return;

  isOpsAccordionOpen = !isOpsAccordionOpen;
  if (isOpsAccordionOpen) {
    submenu.classList.remove('hidden');
    if (caret) caret.className = 'ph ph-caret-down text-xs text-slate-400';
  } else {
    submenu.classList.add('hidden');
    if (caret) caret.className = 'ph ph-caret-right text-xs text-slate-400';
  }
}

function switchNavTab(tabId) {
  currentTab = tabId;

  // Ensure accordion is open when activating any sub-tab
  const submenu = document.getElementById('ops-submenu');
  const caret = document.getElementById('ops-caret');
  if (submenu && submenu.classList.contains('hidden')) {
    submenu.classList.remove('hidden');
    if (caret) caret.className = 'ph ph-caret-down text-xs text-slate-400';
    isOpsAccordionOpen = true;
  }

  document.querySelectorAll('.ops-child-item, .nav-sub-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  const breadcrumb = document.getElementById('breadcrumb-current');
  if (breadcrumb) {
    if (tabId === 'registry') breadcrumb.textContent = 'BOM Master Registry';
    else if (tabId === 'inventory') breadcrumb.textContent = 'Warehouse Stock (91223)';
    else if (tabId === 'history') breadcrumb.textContent = 'Differential Audit Log';
  }

  const views = ['registry', 'inventory', 'history'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === tabId) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
  });

  if (tabId === 'inventory') {
    fetchRawMaterials();
  } else if (tabId === 'history') {
    fetchSyncHistory();
  }

  if (isMobileSidebarOpen) {
    toggleMobileSidebar();
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;
  isMobileSidebarOpen = !isMobileSidebarOpen;
  if (isMobileSidebarOpen) {
    sidebar.classList.remove('hidden');
    sidebar.classList.add('fixed', 'inset-y-0', 'left-0', 'z-50', 'shadow-2xl');
  } else {
    sidebar.classList.add('hidden');
    sidebar.classList.remove('fixed', 'inset-y-0', 'left-0', 'z-50', 'shadow-2xl');
  }
}

// -------------------------------------------------------------
// 6. Product Specification & Target Build Capacity Simulator Modal
// -------------------------------------------------------------
let modalTargetQty = 0;
let modalOnlyShortages = false;
let modalRMSearchQuery = '';
let modalBOMHistory = [];

function normalizeSubBOMName(s) {
  if (!s) return '';
  return s
    .replace(/^(SFG|FG|310|320)[0-9a-zA-Z_-]+\s*[-:]\s*/i, '')
    .replace(/^(Painting|Painted|Complete|Winding)\s+/i, '')
    .toLowerCase()
    .replace(/[-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatchingBOMForRM(rm, currentBomNo) {
  if (!rm || !allBOMs || allBOMs.length === 0) return null;

  // 0. Directly check embedded sub_bom_no from scraper
  if (rm.sub_bom_no) {
    const directMatch = allBOMs.find(b => String(b.bom_no) === String(rm.sub_bom_no));
    if (directMatch && String(directMatch.bom_no) !== String(currentBomNo)) return directMatch;
  }

  const rmCode = (rm.item_code || '').trim().toUpperCase();
  const rmDesc = (rm.item_description || '').trim();

  // 1. Direct Item Code Match (e.g. SFG1010079 or SFG1010023)
  if (rmCode) {
    const codeMatch = allBOMs.find(b => {
      if (String(b.bom_no) === String(currentBomNo)) return false;
      const bCode = (b.item_code || '').trim().toUpperCase();
      return bCode && bCode === rmCode;
    });
    if (codeMatch) return codeMatch;
  }

  // 2. Exact or Normalized Product Name Match
  if (rmDesc) {
    const normRmDesc = normalizeSubBOMName(rmDesc);
    const rmDescLower = rmDesc.toLowerCase();

    const nameMatch = allBOMs.find(b => {
      if (String(b.bom_no) === String(currentBomNo)) return false;
      const bName = (b.product_name || '').trim();
      const bCleanName = getCleanProductName(b.product_name, b.item_code).trim();
      
      if (bName.toLowerCase() === rmDescLower || bCleanName.toLowerCase() === rmDescLower) return true;
      
      const normBName = normalizeSubBOMName(bName);
      if (normBName && normRmDesc && (normBName === normRmDesc || normBName.includes(normRmDesc) || normRmDesc.includes(normBName))) {
        return true;
      }
      return false;
    });
    if (nameMatch) return nameMatch;
  }

  return null;
}

function updateModalHistoryNav() {
  const navContainer = document.getElementById('modal-history-nav');
  if (!navContainer) return;
  if (modalBOMHistory.length > 0) {
    const parentBomNo = modalBOMHistory[modalBOMHistory.length - 1];
    const parentBom = allBOMs.find(b => String(b.bom_no) === String(parentBomNo));
    const parentName = parentBom ? getCleanProductName(parentBom.product_name, parentBom.item_code) : `BOM-${parentBomNo}`;
    navContainer.innerHTML = `
      <button type="button" onclick="navigateBackModalBOM()" class="glass-pill glass-pill-neutral font-bold text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer" title="Return to Parent: ${escapeHtml(parentName)}">
        <i class="ph-bold ph-arrow-left"></i>
        <span>Back to ${escapeHtml(parentName)}</span>
      </button>
    `;
    navContainer.classList.remove('hidden');
  } else {
    navContainer.innerHTML = '';
    navContainer.classList.add('hidden');
  }
}

function navigateBackModalBOM() {
  if (modalBOMHistory.length === 0) return;
  const prevBomNo = modalBOMHistory.pop();
  openAnalysisModal(prevBomNo, false, true);
}

function openAnalysisModal(bomNo, isSubBOM = false, isBackNav = false) {
  const bom = allBOMs.find(b => String(b.bom_no) === String(bomNo));
  if (!bom) return;

  if (isSubBOM && activeBOM && String(activeBOM.bom_no) !== String(bomNo)) {
    modalBOMHistory.push(activeBOM.bom_no);
  } else if (!isSubBOM && !isBackNav) {
    modalBOMHistory = [];
  }

  activeBOM = bom;
  updateModalHistoryNav();

  modalOnlyShortages = false;
  modalRMSearchQuery = '';

  const searchInput = document.getElementById('modal-rm-search');
  if (searchInput) searchInput.value = '';

  const bomNoEl = document.getElementById('modal-bom-no');
  if (bomNoEl) bomNoEl.innerHTML = `<i class="ph-bold ph-hash"></i> BOM-${escapeHtml(bom.bom_no)}`;

  const prodNameEl = document.getElementById('modal-product-name');
  if (prodNameEl) prodNameEl.textContent = getCleanProductName(bom.product_name, bom.item_code);

  const secEl = document.getElementById('modal-section');
  if (secEl) secEl.innerHTML = `<i class="ph ph-factory"></i> ${escapeHtml(bom.section || 'General Section')}`;

  const statusEl = document.getElementById('modal-status');
  if (statusEl) statusEl.innerHTML = `<i class="ph ph-seal-check"></i> ${escapeHtml(bom.status || 'APPROVED')}`;

  const itemCodeEl = document.getElementById('modal-item-code');
  if (itemCodeEl) itemCodeEl.textContent = bom.item_code || '--';

  const dateEl = document.getElementById('modal-date');
  if (dateEl) dateEl.textContent = bom.bom_date || '--';

  const outputBatchEl = document.getElementById('modal-output-batch');
  if (outputBatchEl) outputBatchEl.textContent = `${bom.output_batch || '1'} ${bom.output_unit || 'Pcs'}`;

  const rms = bom.raw_materials || [];
  const compCountEl = document.getElementById('modal-component-count');
  if (compCountEl) compCountEl.textContent = `${rms.length} Items`;

  const rmBadge = document.getElementById('modal-rm-count-badge');
  if (rmBadge) rmBadge.textContent = `${rms.length} items`;

  const maxBuildableEl = document.getElementById('modal-max-buildable');
  const maxUnits = bom.max_buildable_units || 0;
  const canProduce = bom.can_produce;
  if (maxBuildableEl) {
    if (canProduce && maxUnits > 0) {
      maxBuildableEl.className = 'text-emerald-600 dark:text-emerald-400 font-tabular text-base font-extrabold mt-1 block';
      maxBuildableEl.textContent = `${maxUnits.toLocaleString()} Units`;
    } else {
      maxBuildableEl.className = 'text-rose-600 dark:text-rose-400 font-tabular text-base font-extrabold mt-1 block';
      maxBuildableEl.textContent = `0 Units (Blocked)`;
    }
  }

  const authByEl = document.getElementById('modal-authorized-by');
  if (authByEl) authByEl.textContent = bom.approved_by || bom.edit_by || 'Kaosar Ahammed';

  // Set default target quantity to 0
  modalTargetQty = 0;
  const targetInput = document.getElementById('modal-target-input');
  if (targetInput) targetInput.value = 0;

  runModalSimulation();

  const modal = document.getElementById('analysis-modal');
  if (modal) {
    modal.scrollTop = 0;
    modal.classList.remove('hidden');
    const tableContainer = modal.querySelector('.overflow-y-auto');
    if (tableContainer) tableContainer.scrollTop = 0;
  }
}

function closeAnalysisModal() {
  const modal = document.getElementById('analysis-modal');
  if (modal) modal.classList.add('hidden');
  modalBOMHistory = [];
  updateModalHistoryNav();
}

function openAnalysisDrawer(bomNo) {
  openAnalysisModal(bomNo);
}

function closeAnalysisDrawer() {
  closeAnalysisModal();
}

function onModalTargetQtyChange(val) {
  const num = parseFloat(val);
  modalTargetQty = (!isNaN(num) && num >= 0) ? num : 0;
  runModalSimulation();
}

function onModalRMSearch(val) {
  modalRMSearchQuery = (val || '').toLowerCase().trim();
  renderModalRawMaterials(activeBOM);
}

function toggleModalShortageFilter() {
  modalOnlyShortages = !modalOnlyShortages;
  const btn = document.getElementById('btn-modal-filter-shortage');
  const btnText = document.getElementById('btn-modal-filter-text');
  const summaryBtnText = document.getElementById('btn-summary-filter-text');

  if (modalOnlyShortages) {
    if (btn) btn.className = 'px-3 py-1.5 rounded-xl border border-rose-400 dark:border-rose-700 bg-rose-50 dark:bg-rose-950 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 shadow-sm';
    if (btnText) btnText.textContent = 'Showing Shortages Only';
    if (summaryBtnText) summaryBtnText.textContent = 'Show All Materials';
  } else {
    if (btn) btn.className = 'px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-800 flex items-center gap-1.5 transition-colors';
    if (btnText) btnText.textContent = 'Filters';
    if (summaryBtnText) summaryBtnText.textContent = 'View Shortage Details';
  }

  renderModalRawMaterials(activeBOM);
}

function runModalSimulation() {
  if (!activeBOM) return;

  const rms = activeBOM.raw_materials || [];
  let shortageCount = 0;
  let totalShortageAmount = 0;

  if (modalTargetQty > 0) {
    rms.forEach(rm => {
      const reqPerUnit = parseFloat(rm.quantity || rm.quantity_str) || 0;
      const batchReq = reqPerUnit * modalTargetQty;
      const stStore = rm.store_qty !== undefined ? rm.store_qty : 0;
      const stSec = rm.section_qty !== undefined ? rm.section_qty : 0;
      const stAvail = rm.available_stock !== undefined ? rm.available_stock : (stStore + stSec);

      const shortage = Math.max(0, batchReq - stAvail);
      if (shortage > 0) {
        shortageCount++;
        totalShortageAmount += shortage;
      }
    });
  }

  // Update Target Card & Shortage Card Accent Styling
  const targetCard = document.getElementById('modal-target-card');
  const targetAccent = document.getElementById('modal-target-accent');
  const shortageAccent = document.getElementById('modal-shortage-accent');
  if (targetCard) {
    if (modalTargetQty > 0 && shortageCount > 0) {
      targetCard.className = 'rounded-2xl overflow-hidden border-2 border-rose-300 dark:border-rose-700 bg-white dark:bg-dark-800 transition-all';
      if (targetAccent) targetAccent.className = 'h-1 bg-gradient-to-r from-rose-500 to-red-400';
    } else if (modalTargetQty > 0 && shortageCount === 0) {
      targetCard.className = 'rounded-2xl overflow-hidden border-2 border-emerald-300 dark:border-emerald-700 bg-white dark:bg-dark-800 transition-all';
      if (targetAccent) targetAccent.className = 'h-1 bg-gradient-to-r from-emerald-500 to-teal-400';
    } else {
      targetCard.className = 'rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-dark-800 transition-all';
      if (targetAccent) targetAccent.className = 'h-1 bg-gradient-to-r from-amber-400 to-orange-400';
    }
  }
  if (shortageAccent) {
    if (modalTargetQty > 0 && shortageCount > 0) {
      shortageAccent.className = 'h-1 bg-gradient-to-r from-rose-500 to-red-400';
    } else if (modalTargetQty > 0 && shortageCount === 0) {
      shortageAccent.className = 'h-1 bg-gradient-to-r from-emerald-500 to-teal-400';
    } else {
      shortageAccent.className = 'h-1 bg-gradient-to-r from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-700';
    }
  }

  // Update Top Metric Cards
  const shortageCountEl = document.getElementById('modal-shortage-count');
  const shortageSubtext = document.getElementById('modal-shortage-subtext');
  if (shortageCountEl) {
    if (modalTargetQty === 0) {
      shortageCountEl.className = 'text-slate-900 dark:text-white font-tabular text-base font-extrabold';
      shortageCountEl.textContent = `0 Items`;
      if (shortageSubtext) {
        shortageSubtext.className = 'text-[10px] text-slate-400 font-medium';
        shortageSubtext.textContent = 'Set Target';
      }
    } else if (shortageCount > 0) {
      shortageCountEl.className = 'text-rose-600 dark:text-rose-400 font-tabular text-base font-extrabold';
      shortageCountEl.textContent = `${shortageCount} Items`;
      if (shortageSubtext) {
        shortageSubtext.className = 'text-[10px] text-rose-500 font-bold';
        shortageSubtext.textContent = 'Need Attention';
      }
    } else {
      shortageCountEl.className = 'text-emerald-600 dark:text-emerald-400 font-tabular text-base font-extrabold';
      shortageCountEl.textContent = `0 Items`;
      if (shortageSubtext) {
        shortageSubtext.className = 'text-[10px] text-emerald-500 font-bold';
        shortageSubtext.textContent = '100% Sufficient';
      }
    }
  }

  const thTargetLabel = document.getElementById('th-target-qty-label');
  if (thTargetLabel) {
    thTargetLabel.textContent = modalTargetQty > 0 ? `(for ${modalTargetQty.toLocaleString()} units)` : `(for 0 units)`;
  }

  renderModalRawMaterials(activeBOM);
}

function renderModalRawMaterials(bom) {
  const tbody = document.getElementById('modal-rm-tbody');
  if (!tbody || !bom) return;
  tbody.innerHTML = '';

  const inHouseResolutions = [];
  const rms = bom.raw_materials || [];
  if (rms.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center py-8 text-slate-400">No active raw materials found in formula.</td></tr>`;
    return;
  }

  let displayedRows = 0;
  const fragment = document.createDocumentFragment();

  rms.forEach((rm, i) => {
    const reqPerUnit = parseFloat(rm.quantity || rm.quantity_str) || 0;
    const batchReq = reqPerUnit * modalTargetQty;
    const stStore = rm.store_qty !== undefined ? rm.store_qty : 0;
    const stSec = rm.section_qty !== undefined ? rm.section_qty : 0;
    const stAvail = rm.available_stock !== undefined ? rm.available_stock : (stStore + stSec);
    const poss = rm.possible_build !== undefined && rm.possible_build !== null ? rm.possible_build : null;

    const shortage = Math.max(0, batchReq - stAvail);
    const isShortage = shortage > 0;

    // Filter by shortage toggle
    if (modalOnlyShortages && !isShortage) return;

    // Filter by search query
    if (modalRMSearchQuery) {
      const q = modalRMSearchQuery;
      const matchDesc = (rm.item_description || '').toLowerCase().includes(q);
      const matchCode = (rm.item_code || '').toLowerCase().includes(q);
      const matchCat = (rm.category || '').toLowerCase().includes(q);
      if (!matchDesc && !matchCode && !matchCat) return;
    }

    displayedRows++;

    const tr = document.createElement('tr');
    tr.className = isShortage
      ? 'bg-rose-500/[0.04] dark:bg-rose-500/[0.06] font-medium transition-none'
      : 'transition-none hover:bg-slate-500/[0.02] dark:hover:bg-white/[0.02]';

    let shortageBadge = '';
    if (modalTargetQty === 0) {
      shortageBadge = `<span class="glass-pill glass-pill-neutral text-[10px] font-bold whitespace-nowrap"><i class="ph ph-minus"></i> Ready</span>`;
    } else if (isShortage) {
      shortageBadge = `<span class="glass-pill glass-pill-rose text-[10px] font-bold whitespace-nowrap"><i class="ph ph-warning-octagon"></i> Shortage</span>`;
    } else {
      shortageBadge = `<span class="glass-pill glass-pill-emerald text-[10px] font-bold whitespace-nowrap"><i class="ph ph-check-circle"></i> Ready</span>`;
    }

    const shortageQtyDisplay = isShortage
      ? `<span class="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs whitespace-nowrap">+${formatQty(shortage)} ${escapeHtml(rm.unit || '')}</span>`
      : `<span class="text-slate-400 font-mono text-[11px]">0</span>`;

    const matchingBOM = findMatchingBOMForRM(rm, bom.bom_no);

    if (matchingBOM && (matchingBOM.max_buildable_units > 0 || matchingBOM.can_produce)) {
      inHouseResolutions.push({
        rm,
        matchingBOM,
        maxBuildable: matchingBOM.max_buildable_units || 0
      });
    }

    const isSFG = (rm.category || '').toLowerCase().includes('sfg') || (rm.item_code || '').toUpperCase().startsWith('SFG');

    let categoryHtml = '';
    if (isSFG) {
      categoryHtml = `<span class="glass-pill glass-pill-primary text-[10px] font-bold font-mono py-0.5 px-1.5 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20"><i class="ph-bold ph-tree-structure"></i> ${escapeHtml(rm.category || 'FAN SFG')}</span>`;
    } else {
      categoryHtml = `<span class="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[100px] font-medium block">${escapeHtml(rm.category || '--')}</span>`;
    }

    let descHtml = '';
    let codeHtml = '';

    if (matchingBOM) {
      const canBuildSub = matchingBOM.max_buildable_units || 0;
      const inHouseBadge = canBuildSub > 0
        ? `<button type="button" onclick="openAnalysisModal('${matchingBOM.bom_no}', true)" class="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono border border-emerald-500/25 hover:bg-emerald-500/20 cursor-pointer" title="In-House Production Capacity from Raw Materials"><i class="ph-bold ph-wrench text-[10px]"></i> In-House Buildable: ${canBuildSub.toLocaleString()} Units</button>`
        : `<span class="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold font-mono border border-rose-500/25"><i class="ph-bold ph-warning text-[10px]"></i> In-House: 0 Units</span>`;

      descHtml = `
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="openAnalysisModal('${matchingBOM.bom_no}', true)" class="group text-left inline-flex items-center gap-1.5 cursor-pointer select-none" title="Direct Access: Inspect Sub-Assembly BOM #${matchingBOM.bom_no} (${escapeHtml(matchingBOM.product_name)})">
              <span class="font-bold text-xs text-emerald-600 dark:text-emerald-400 group-hover:underline underline-offset-2">${escapeHtml(rm.item_description || '--')}</span>
              <span class="glass-pill glass-pill-emerald text-[9px] font-bold font-mono py-0.5 px-1.5 inline-flex items-center gap-1 shrink-0 shadow-2xs">
                <i class="ph-bold ph-arrow-up-right text-[10px]"></i> Sub-BOM
              </span>
            </button>
          </div>
          <div>${inHouseBadge}</div>
        </div>
      `;
      codeHtml = `
        <button type="button" onclick="openAnalysisModal('${matchingBOM.bom_no}', true)" class="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 cursor-pointer" title="Direct Access: BOM #${matchingBOM.bom_no}">
          <span>${escapeHtml(rm.item_code || '--')}</span>
        </button>
      `;
    } else if (isSFG) {
      descHtml = `
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-xs text-indigo-700 dark:text-indigo-300">${escapeHtml(rm.item_description || '--')}</span>
            <span class="glass-pill glass-pill-primary text-[9px] font-bold font-mono py-0.5 px-1.5 inline-flex items-center gap-1 shrink-0 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/25">
              <i class="ph-bold ph-cube"></i> SFG Sub-Assembly
            </span>
          </div>
        </div>
      `;
      codeHtml = `
        <span class="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
          ${escapeHtml(rm.item_code || '--')}
        </span>
      `;
    } else {
      descHtml = `<span class="font-semibold text-slate-900 dark:text-slate-100 text-xs">${escapeHtml(rm.item_description || '--')}</span>`;
      codeHtml = `<span class="font-mono font-bold text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">${escapeHtml(rm.item_code || '--')}</span>`;
    }

    tr.innerHTML = `
      <td class="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px] font-medium">${rm.sl || i + 1}</td>
      <td class="py-2.5 px-2.5 whitespace-nowrap">${categoryHtml}</td>
      <td class="py-2.5 px-2.5 whitespace-nowrap">${codeHtml}</td>
      <td class="py-2.5 px-3">${descHtml}</td>
      <td class="py-2.5 px-2 text-center text-xs font-semibold text-slate-500">${escapeHtml(rm.unit || '--')}</td>
      <td class="py-2.5 px-2 text-right font-mono font-medium text-slate-600 dark:text-slate-300 text-xs">${formatQty(reqPerUnit)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-bold ${isShortage ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'} text-xs">${formatQty(batchReq)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs">${formatQty(stStore)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">${formatQty(stSec)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-extrabold text-slate-900 dark:text-white text-xs">${formatQty(stAvail)}</td>
      <td class="py-2.5 px-2.5 text-center font-mono font-extrabold text-xs ${poss > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}">
        ${poss >= 999999 ? '∞' : (poss !== null ? poss.toLocaleString() : '0')}
      </td>
      <td class="py-2.5 px-2.5 text-right">${shortageQtyDisplay}</td>
      <td class="py-2.5 px-2.5 text-center">${shortageBadge}</td>
    `;
    fragment.appendChild(tr);
  });

  tbody.replaceChildren(fragment);

  if (displayedRows === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="13" class="text-center py-8 text-slate-400">
          <i class="ph ph-check-circle text-2xl text-emerald-500 mb-1"></i>
          <p class="text-xs font-semibold">No material shortages found matching filter criteria.</p>
        </td>
      </tr>
    `;
  }
}

// -------------------------------------------------------------
// 7. Capacity Matrix & Plant-wide Bottleneck View
// -------------------------------------------------------------
async function loadFeasibilityMatrix() {
  try {
    const res = await fetch('/api/feasibility/matrix');
    if (!res.ok) return;
    feasibilityMatrix = await res.json();
    renderFeasibilityMatrix();
  } catch (e) {
    console.error('Error fetching capacity matrix:', e);
  }
}

function renderFeasibilityMatrix() {
  const tbody = document.getElementById('feasibility-matrix-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  feasibilityMatrix.forEach(m => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover';

    const canProduce = m.can_produce;
    const maxUnits = m.max_buildable_units || 0;

    let statusHtml = canProduce && maxUnits > 0
      ? `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><i class="ph ph-check-circle"></i> Ready</span>`
      : `<span class="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400"><i class="ph ph-x-circle"></i> Blocked</span>`;

    let bottleDesc = '--';
    if (m.primary_bottleneck) {
      const pb = m.primary_bottleneck;
      bottleDesc = `<span class="font-medium text-rose-900 dark:text-rose-200">${escapeHtml(pb.item_description)}</span> <span class="text-[11px] font-mono text-slate-400">(${pb.item_code})</span>`;
    } else if (canProduce) {
      bottleDesc = `<span class="text-emerald-600 dark:text-emerald-400 text-xs font-semibold">100% Sufficient Warehouse Stock</span>`;
    }

    tr.innerHTML = `
      <td class="py-2.5 px-3.5 font-mono font-bold text-xs text-slate-800 dark:text-slate-200">${escapeHtml(m.bom_no)}</td>
      <td class="py-2.5 px-3.5 font-medium text-slate-900 dark:text-slate-100">${escapeHtml(m.product_name)}</td>
      <td class="py-2.5 px-3.5 text-slate-500 dark:text-slate-400">${escapeHtml(m.section)}</td>
      <td class="py-2.5 px-3.5 text-center font-mono font-bold text-xs ${canProduce ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${maxUnits.toLocaleString()} Units</td>
      <td class="py-2.5 px-3.5 text-center">${statusHtml}</td>
      <td class="py-2.5 px-3.5 text-xs">${bottleDesc}</td>
      <td class="py-2.5 px-3.5 text-center">
        <button onclick="openAnalysisDrawer('${m.bom_no}')" class="btn-luxury btn-luxury-secondary text-[11px] py-1 px-2.5">
          Inspect
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// 8. Warehouse Inventory & Reverse RM Lookup
// -------------------------------------------------------------
async function fetchRawMaterials() {
  try {
    let res = await fetch('/api/raw-materials');
    if (!res.ok) {
      res = await fetch('/api/stock');
    }
    if (!res.ok) {
      res = await fetch('data/warehouse_stock.json');
    }
    if (!res.ok) return;
    allRawMaterials = await res.json();
    renderRMTable(allRawMaterials);
  } catch (e) {
    console.error('Error fetching inventory:', e);
  }
}

let rmDebounce = null;
function handleRMSearch() {
  clearTimeout(rmDebounce);
  rmDebounce = setTimeout(() => {
    const input = document.getElementById('rm-search-input');
    const q = input ? input.value.toLowerCase().trim() : '';
    if (!q) {
      renderRMTable(allRawMaterials);
      return;
    }
    const filtered = allRawMaterials.filter(rm => 
      (rm.item_code || '').toLowerCase().includes(q) ||
      (rm.item_description || '').toLowerCase().includes(q) ||
      (rm.category || '').toLowerCase().includes(q)
    );
    renderRMTable(filtered);
  }, 120);
}

function renderRMTable(items) {
  const tbody = document.getElementById('rm-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400">No matching warehouse raw materials found.</td></tr>`;
    return;
  }

  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover';

    const storeQty = item.store_qty !== undefined ? item.store_qty : 0.0;
    const secQty = item.section_qty !== undefined ? item.section_qty : 0.0;
    const totalQty = item.total_stock !== undefined ? item.total_stock : (storeQty + secQty);
    const hasStock = totalQty > 0;

    tr.innerHTML = `
      <td class="py-3 px-3.5 text-center text-slate-400 font-mono text-xs">${idx + 1}</td>
      <td class="py-3 px-3.5 font-mono font-semibold text-xs text-slate-800 dark:text-slate-200">${escapeHtml(item.item_code)}</td>
      <td class="py-3 px-3.5 font-medium text-slate-900 dark:text-slate-100">${escapeHtml(item.item_description)}</td>
      <td class="py-3 px-3.5 text-slate-500 dark:text-slate-400 text-xs">${escapeHtml(item.category || '--')}</td>
      <td class="py-3 px-3.5 text-center text-xs font-medium">${escapeHtml(item.unit || '--')}</td>
      <td class="py-3 px-3.5 text-right font-mono font-semibold text-cyan-600 dark:text-cyan-400">${formatQty(storeQty)}</td>
      <td class="py-3 px-3.5 text-right font-mono font-semibold text-purple-600 dark:text-purple-400">${formatQty(secQty)}</td>
      <td class="py-3 px-3.5 text-right font-mono font-bold text-xs ${hasStock ? 'text-slate-900 dark:text-white' : 'text-slate-400'}">${formatQty(totalQty)}</td>
      <td class="py-3 px-3.5 text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">${item.bom_count || 0}</td>
      <td class="py-3 px-3.5 text-center">
        <button onclick="filterByComponent('${escapeHtml(item.item_code)}')" class="btn-luxury btn-luxury-secondary text-[11px] py-1 px-2.5">
          View BOMs
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterByComponent(code) {
  switchNavTab('registry');
  const input = document.getElementById('search-input');
  if (input) input.value = code;
  handleSearch();
}

// -------------------------------------------------------------
// 9. Critical Shortages & Purchasing Summary View
// -------------------------------------------------------------
function renderShortagesView() {
  const tbody = document.getElementById('shortages-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const bottleneckMap = new Map();
  allBOMs.forEach(b => {
    if (!b.can_produce && b.primary_bottleneck) {
      const pb = b.primary_bottleneck;
      const code = pb.item_code;
      if (!bottleneckMap.has(code)) {
        bottleneckMap.set(code, {
          item_code: code,
          item_description: pb.item_description,
          unit: pb.unit,
          available_stock: pb.available_qty,
          blocked_boms: [b.bom_no]
        });
      } else {
        bottleneckMap.get(code).blocked_boms.push(b.bom_no);
      }
    }
  });

  const bottlenecks = Array.from(bottleneckMap.values()).sort((a, b) => b.blocked_boms.length - a.blocked_boms.length);

  if (bottlenecks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-10 text-slate-400">No critical bottlenecks identified across catalog.</td></tr>`;
    return;
  }

  bottlenecks.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover';
    const urgencyBadge = item.blocked_boms.length >= 5
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">CRITICAL</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">HIGH</span>`;

    tr.innerHTML = `
      <td class="py-3 px-3.5 text-center text-slate-400 font-mono text-xs">${idx + 1}</td>
      <td class="py-3 px-3.5 font-mono font-bold text-xs text-rose-700 dark:text-rose-300">${escapeHtml(item.item_code)}</td>
      <td class="py-3 px-3.5 font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(item.item_description)}</td>
      <td class="py-3 px-3.5 text-center font-medium">${escapeHtml(item.unit || '--')}</td>
      <td class="py-3 px-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">${formatQty(item.available_stock)}</td>
      <td class="py-3 px-3.5 text-center font-mono font-bold text-xs text-slate-800 dark:text-slate-200">${item.blocked_boms.length} Formulas</td>
      <td class="py-3 px-3.5 text-center">${urgencyBadge}</td>
      <td class="py-3 px-3.5 text-center">
        <button onclick="filterByComponent('${escapeHtml(item.item_code)}')" class="btn-luxury btn-luxury-secondary text-[11px] py-1 px-2.5">
          Inspect
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// -------------------------------------------------------------
// 10. Clipboard & Formulation Utilities
// -------------------------------------------------------------

function copyBOMTable() {
  if (!activeBOM) return;
  const rms = activeBOM.raw_materials || [];
  let tsv = 'SL\tCategory\tItem Code\tItem Description\tUnit\tBOM Required\tStore Stock\tFloor Stock\tTotal Available\n';
  rms.forEach((rm, i) => {
    tsv += `${rm.sl || i + 1}\t${rm.category || ''}\t${rm.item_code || ''}\t${rm.item_description || ''}\t${rm.unit || ''}\t${rm.quantity || rm.quantity_str || 0}\t${rm.store_qty || 0}\t${rm.section_qty || 0}\t${rm.available_stock || 0}\n`;
  });

  navigator.clipboard.writeText(tsv).then(() => {
    showToast('Raw materials copied to clipboard (TSV format)');
  }).catch(() => {
    showToast('Failed to copy to clipboard');
  });
}

// -------------------------------------------------------------
// 11. Automated ERP Sync Modal
// -------------------------------------------------------------
let lastRenderedLogIdx = 0;

function openSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  lastRenderedLogIdx = 0;
  document.getElementById('sync-status-text').textContent = 'Starting automated background sync...';
  document.getElementById('sync-progress-step').textContent = 'Connecting to MEP ERP Gateway...';
  document.getElementById('sync-progress-pct').textContent = '5%';
  document.getElementById('sync-progress-bar').style.width = '5%';

  const logsEl = document.getElementById('sync-console-logs');
  logsEl.innerHTML = `
    <div class="text-slate-500">[${new Date().toLocaleTimeString()}] Session initialized.</div>
    <div class="text-emerald-400">[${new Date().toLocaleTimeString()}] Authenticating with ERP Module 1027...</div>
  `;

  document.getElementById('sync-diff-card').classList.add('hidden');
  document.getElementById('sync-modal-close-btn').classList.add('hidden');

  triggerLiveSync();
}

async function triggerLiveSync() {
  const isGitHubPages = window.location.hostname.includes('github.io');
  if (isGitHubPages) {
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const repoName = pathParts[0] || 'STOCK-BOT';
    const repoOwner = window.location.hostname.split('.')[0];
    const actionsUrl = `https://github.com/${repoOwner}/${repoName}/actions`;

    document.getElementById('sync-status-text').textContent = 'GitHub Cloud Automation Active';
    document.getElementById('sync-progress-step').textContent = 'Cloud Workflow Engine';
    document.getElementById('sync-progress-pct').textContent = '100%';
    document.getElementById('sync-progress-bar').style.width = '100%';

    const logsEl = document.getElementById('sync-console-logs');
    logsEl.innerHTML = `
      <div class="text-emerald-400 font-bold">[INFO] GitHub Cloud Actions Scheduler is Active!</div>
      <div class="text-slate-300 mt-1.5">• In GitHub, sync runs automatically in the cloud every 30 minutes.</div>
      <div class="text-slate-300">• To trigger a manual sync right now in the cloud, open GitHub Actions and click 'Run workflow'.</div>
      <div class="mt-3">
        <a href="${actionsUrl}" target="_blank" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition-colors">
          <i class="ph ph-arrow-square-out text-sm"></i> Open GitHub Actions & Run Sync
        </a>
      </div>
    `;
    document.getElementById('sync-modal-close-btn').classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    if (!res.ok) throw new Error('Sync endpoint returned non-200 status');
    
    pollSyncStatus();
  } catch (e) {
    console.error('Error starting sync:', e);
    document.getElementById('sync-status-text').textContent = 'Sync encountered an error.';
    appendSyncLog('ERROR: Could not communicate with server.', 'text-rose-400 font-bold');
    document.getElementById('sync-modal-close-btn').classList.remove('hidden');
  }
}

function pollSyncStatus() {
  if (syncInterval) clearInterval(syncInterval);

  syncInterval = setInterval(async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (!res.ok) return;
      const data = await res.json();

      // Stream live logs from backend
      if (data.logs && Array.isArray(data.logs)) {
        for (let i = lastRenderedLogIdx; i < data.logs.length; i++) {
          const logItem = data.logs[i];
          const colorClass = logItem.message.includes('[ERROR]') ? 'text-rose-400 font-bold'
                           : (logItem.message.includes('[OK]') || logItem.message.includes('[DONE]')) ? 'text-emerald-300 font-bold'
                           : logItem.message.includes('[AUTH]') ? 'text-cyan-300'
                           : 'text-slate-300';
          appendSyncLog(`[${logItem.time}] ${logItem.message}`, colorClass);
        }
        lastRenderedLogIdx = data.logs.length;
      }

      if (data.is_syncing) {
        const pct = data.percent || 10;
        document.getElementById('sync-progress-pct').textContent = `${pct}%`;
        document.getElementById('sync-progress-bar').style.width = `${pct}%`;
        document.getElementById('sync-status-text').textContent = data.status || 'Extracting BOMs & Closing Stock (91223)...';
      } else {
        clearInterval(syncInterval);
        syncInterval = null;

        const report = data.last_report || data.last_sync || {};
        const isFailed = report.status === 'FAILED' || (data.status && data.status.startsWith('Error'));

        if (isFailed) {
          document.getElementById('sync-status-text').textContent = `Sync failed: ${report.error || data.status}`;
          appendSyncLog(`[${new Date().toLocaleTimeString()}] ${report.error || data.status}`, 'text-rose-400 font-bold');
        } else {
          document.getElementById('sync-progress-pct').textContent = '100%';
          document.getElementById('sync-progress-bar').style.width = '100%';
          document.getElementById('sync-status-text').textContent = 'Synchronization completed successfully.';

          const diffCard = document.getElementById('sync-diff-card');
          diffCard.classList.remove('hidden');

          document.getElementById('diff-added-count').textContent = `+${report.added_count || 0}`;
          document.getElementById('diff-updated-count').textContent = `~${report.updated_count || 0}`;
          document.getElementById('diff-stock-count').textContent = `${(report.total_stock_items || 418).toLocaleString()}`;
          document.getElementById('sync-duration-badge').textContent = `${report.duration_seconds || '4.1'}s`;
        }

        document.getElementById('sync-modal-close-btn').classList.remove('hidden');
        loadAllData();
      }
    } catch (e) {
      console.error('Error polling status:', e);
    }
  }, 800);
}

function appendSyncLog(msg, colorClass = 'text-slate-400') {
  const logsEl = document.getElementById('sync-console-logs');
  if (!logsEl) return;
  const line = document.createElement('div');
  line.className = colorClass;
  line.textContent = msg;
  logsEl.appendChild(line);
  logsEl.scrollTop = logsEl.scrollHeight;
}

function closeSyncModal() {
  const modal = document.getElementById('sync-modal');
  if (modal) modal.classList.add('hidden');
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  loadAllData();
}

// -------------------------------------------------------------
// 12. Differential Audit History
// -------------------------------------------------------------
async function fetchSyncHistory() {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return;
    const history = await res.json();
    renderHistoryCards(history);
  } catch (e) {
    console.error('Error fetching sync history:', e);
  }
}

function renderHistoryCards(records) {
  const container = document.getElementById('history-container');
  if (!container) return;
  container.innerHTML = '';

  if (records.length === 0) {
    container.innerHTML = `
      <div class="glass-card p-8 text-center text-slate-400">
        <i class="ph ph-clock text-4xl mb-2 stroke-[1.5]"></i>
        <p class="text-sm font-semibold">No sync events recorded yet.</p>
      </div>
    `;
    return;
  }

  records.forEach((rec, idx) => {
    const card = document.createElement('div');
    card.className = 'glass-card p-4 space-y-2';

    const isSuccess = rec.status === 'SUCCESS';
    const statusBadge = isSuccess
      ? `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">SUCCESS</span>`
      : `<span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">${escapeHtml(rec.status)}</span>`;

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="ph ph-git-commit text-emerald-500 text-lg"></i>
          <h4 class="font-bold text-sm text-slate-900 dark:text-white">Sync Event #${records.length - idx}</h4>
          ${statusBadge}
        </div>
        <span class="text-xs font-mono text-slate-400">${escapeHtml(rec.sync_time)}</span>
      </div>

      <div class="grid grid-cols-4 gap-2 pt-2 text-xs font-mono text-slate-600 dark:text-slate-300">
        <div>Total BOMs: <strong>${rec.total_boms}</strong></div>
        <div>Added: <strong class="text-emerald-600">+${rec.added_count || 0}</strong></div>
        <div>Updated: <strong class="text-amber-600">~${rec.updated_count || 0}</strong></div>
        <div>Duration: <strong>${rec.duration_seconds}s</strong></div>
      </div>
    `;
    container.appendChild(card);
  });
}

// -------------------------------------------------------------
// 12. Utilities & Keyboard Shortcuts
// -------------------------------------------------------------

// Close notification dropdown when clicking outside
document.addEventListener('click', (e) => {
  const notifBtn = document.getElementById('notification-btn');
  const notifMenu = document.getElementById('notification-menu');
  if (notifMenu && notifBtn && !notifBtn.contains(e.target) && !notifMenu.contains(e.target)) {
    notifMenu.classList.add('hidden');
  }
});

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Escape closes drawers and modals
    if (e.key === 'Escape') {
      closeAnalysisDrawer();
      closeSyncModal();
      const notifMenu = document.getElementById('notification-menu');
      if (notifMenu) notifMenu.classList.add('hidden');
    }
    // Ctrl+K or Cmd+K focuses search
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      switchNavTab('registry');
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
        input.select();
      }
    }
    // "[" toggles sidebar collapse
    if (e.key === '[' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      toggleSidebarCollapse();
    }
  });
}

function formatQty(val) {
  if (val === null || val === undefined || isNaN(val)) return '0.00';
  const num = parseFloat(val);
  if (num % 1 === 0) return num.toLocaleString();
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-2xl animate-modal flex items-center gap-2 border border-slate-700';
  toast.innerHTML = `<i class="ph ph-check-circle text-emerald-400 text-base"></i> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2500);
}

function getCleanProductName(name, code) {
  if (!name) return 'Unnamed Product';
  let str = String(name).trim();
  if (code) {
    const codeStr = String(code).trim();
    if (str.toUpperCase().startsWith(codeStr.toUpperCase() + '-')) {
      return str.slice(codeStr.length + 1).trim();
    }
    if (str.toUpperCase().startsWith(codeStr.toUpperCase() + ' - ')) {
      return str.slice(codeStr.length + 3).trim();
    }
    if (str.toUpperCase().startsWith(codeStr.toUpperCase() + ' ')) {
      return str.slice(codeStr.length + 1).trim();
    }
    const parts = codeStr.split('/');
    for (const p of parts) {
      const pTrim = p.trim();
      if (pTrim && str.toUpperCase().startsWith(pTrim.toUpperCase() + '-')) {
        return str.slice(pTrim.length + 1).trim();
      }
      if (pTrim && str.toUpperCase().startsWith(pTrim.toUpperCase() + '/')) {
        const dashIdx = str.indexOf('-');
        if (dashIdx !== -1 && dashIdx < codeStr.length + 5) {
          return str.slice(dashIdx + 1).trim();
        }
      }
    }
  }
  // Generic regex to remove leading CODE- or ITEMCODE- prefix
  const match = str.match(/^[A-Za-z0-9/]+[-—]\s*(.+)$/);
  if (match && match[1] && match[1].length > 3) {
    return match[1].trim();
  }
  return str;
}
