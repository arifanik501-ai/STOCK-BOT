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
  initBeastMode();
  initSidebarState();
  initTableDensity();
  loadAllData();

  // Restore active tab on page refresh
  const savedTab = (window.location.hash ? window.location.hash.replace('#', '') : localStorage.getItem('mep_active_tab')) || 'registry';
  const validTabs = ['dashboard', 'registry', 'inventory', 'physical_cf_body', 'physical_cf_blade', 'physical_entry_sheet', 'physical_production', 'erp_production', 'sfg_stock', 'oee', 'inter_company', 'history'];
  const initialTab = validTabs.includes(savedTab) ? savedTab : 'registry';
  switchNavTab(initialTab);

  setupKeyboardShortcuts();
  setTimeout(() => updateLiquidSegmentedPill(currentFeasibilitySegment), 50);
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  const validTabs = ['dashboard', 'registry', 'inventory', 'physical_cf_body', 'physical_cf_blade', 'physical_entry_sheet', 'physical_production', 'erp_production', 'sfg_stock', 'oee', 'inter_company', 'history'];
  if (hash && validTabs.includes(hash) && hash !== currentTab) {
    switchNavTab(hash);
  }
});

// -------------------------------------------------------------
// 1. Theme & Beast Performance Mode Suite
// -------------------------------------------------------------
function initBeastMode() {
  const saved = localStorage.getItem('mep_beast_mode');
  // Default to false (Ultra-HD Frosted Glass Active)
  const isBeast = saved === 'true';
  applyBeastMode(isBeast, false);
}

function toggleBeastMode() {
  const isBeast = !document.documentElement.classList.contains('beast-mode-active');
  applyBeastMode(isBeast, true);
}

function applyBeastMode(enable, showNotification = true) {
  const root = document.documentElement;
  const label = document.getElementById('beast-mode-label');
  const btn = document.getElementById('btn-beast-mode');
  const icon = document.getElementById('beast-mode-icon');

  if (enable) {
    root.classList.add('beast-mode-active');
    localStorage.setItem('mep_beast_mode', 'true');
    if (label) label.textContent = 'Beast: ON';
    if (icon) icon.className = 'ph-fill ph-lightning text-white text-sm';
    if (btn) {
      btn.title = 'Beast Mode Active (0ms Latency, Low GPU load). Click to switch to Ultra-HD Glass.';
      btn.classList.add('bg-amber-500', 'text-white', 'border-amber-400');
    }
    if (showNotification) {
      showToast('⚡ Beast Mode Active: Zero-latency rendering enabled for low-spec PC.');
    }
  } else {
    root.classList.remove('beast-mode-active');
    localStorage.setItem('mep_beast_mode', 'false');
    if (label) label.textContent = 'Beast Mode';
    if (icon) icon.className = 'ph-bold ph-lightning text-amber-500 text-sm';
    if (btn) {
      btn.title = 'Toggle Beast Performance Mode for Low-Spec PCs (Shortcut: Alt+B)';
      btn.classList.remove('bg-amber-500', 'text-white', 'border-amber-400');
    }
    if (showNotification) {
      showToast('✨ Ultra-HD Glass Mode restored.');
    }
  }
}

function initTheme() {
  const saved = localStorage.getItem('mep_theme') || 'light';
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

function toggleDarkMode(event) {
  // Determine origin coordinates: from click or default to top-right corner
  let x = window.innerWidth - 30;
  let y = 30;

  if (event && event.clientX && event.clientY) {
    x = event.clientX;
    y = event.clientY;
  } else {
    const btn = document.getElementById('theme-icon');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }
  }

  // Calculate diagonal distance to the farthest corner (bottom-left corner)
  const endRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );

  // Check if browser supports document.startViewTransition
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('is-theme-transitioning');

    const transition = document.startViewTransition(() => {
      executeThemeToggle();
    });

    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`
      ];

      const anim = document.documentElement.animate(
        {
          clipPath: clipPath
        },
        {
          duration: 540,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );

      anim.onfinish = () => {
        document.documentElement.classList.remove('is-theme-transitioning');
      };
    });
  } else {
    executeThemeToggle();
  }
}

function executeThemeToggle() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('mep_theme', isDark ? 'dark' : 'light');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = isDark ? 'ph ph-sun text-base' : 'ph ph-moon text-base';
  updateLiquidSegmentedPill(currentFeasibilitySegment);
}

function initSidebarState() {
  const isCollapsed = localStorage.getItem('mep_sidebar_collapsed') === 'true';
  const sidebar = document.getElementById('app-sidebar');
  const toggleBtn = document.getElementById('btn-sidebar-toggle-main');
  const toggleIcon = document.getElementById('sidebar-toggle-icon');
  if (sidebar && isCollapsed) {
    sidebar.classList.add('sidebar-collapsed');
    if (toggleIcon) toggleIcon.className = 'ph-bold ph-sidebar text-base text-emerald-600 dark:text-emerald-400';
    if (toggleBtn) {
      toggleBtn.classList.add('sidebar-btn-active');
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
      ? 'ph-bold ph-sidebar text-base text-emerald-600 dark:text-emerald-400' 
      : 'ph-bold ph-sidebar-simple text-base text-slate-600 dark:text-slate-300';
  }
  if (toggleBtn) {
    if (isCollapsed) {
      toggleBtn.classList.add('sidebar-btn-active');
    } else {
      toggleBtn.classList.remove('sidebar-btn-active');
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

function toggleStockAccordion() {
  const stockSubmenu = document.getElementById('stock-submenu');
  const stockCaret = document.getElementById('stock-caret');
  const physicalSubmenu = document.getElementById('physical-submenu');
  const physicalCaret = document.getElementById('physical-caret');
  
  // Smoothly close physical accordion if open
  if (physicalSubmenu && physicalSubmenu.classList.contains('expanded')) {
    physicalSubmenu.classList.remove('expanded');
    if (physicalCaret) physicalCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  }

  if (!stockSubmenu) return;
  const isExpanding = !stockSubmenu.classList.contains('expanded');
  if (isExpanding) {
    stockSubmenu.classList.add('expanded');
    if (stockCaret) stockCaret.className = 'ph ph-caret-down text-xs text-slate-400 transition-transform duration-200';
  } else {
    stockSubmenu.classList.remove('expanded');
    if (stockCaret) stockCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  }
}

function togglePhysicalAccordion() {
  const physicalSubmenu = document.getElementById('physical-submenu');
  const physicalCaret = document.getElementById('physical-caret');
  const stockSubmenu = document.getElementById('stock-submenu');
  const stockCaret = document.getElementById('stock-caret');
  
  // Smoothly close stock accordion if open
  if (stockSubmenu && stockSubmenu.classList.contains('expanded')) {
    stockSubmenu.classList.remove('expanded');
    if (stockCaret) stockCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  }

  if (!physicalSubmenu) return;
  const isExpanding = !physicalSubmenu.classList.contains('expanded');
  if (isExpanding) {
    physicalSubmenu.classList.add('expanded');
    if (physicalCaret) physicalCaret.className = 'ph ph-caret-down text-xs text-slate-400 transition-transform duration-200';
  } else {
    physicalSubmenu.classList.remove('expanded');
    if (physicalCaret) physicalCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  }
}

function switchNavTab(tab) {
  // Map legacy tab to first subcategory
  if (tab === 'physical_production') {
    tab = 'physical_cf_body';
  }
  currentTab = tab;
  
  // Hide all view containers
  const viewDashboard = document.getElementById('view-dashboard');
  const viewRegistry = document.getElementById('view-registry');
  const viewInventory = document.getElementById('view-inventory');
  const viewPhysicalBody = document.getElementById('view-physical-cf-body');
  const viewPhysicalBlade = document.getElementById('view-physical-cf-blade');
  const viewPhysicalEntry = document.getElementById('view-physical-entry-sheet');
  const viewErp = document.getElementById('view-erp-production');
  const viewSfgStock = document.getElementById('view-sfg-stock');
  const viewOee = document.getElementById('view-oee');
  const viewInterCompany = document.getElementById('view-inter-company');
  const viewHistory = document.getElementById('view-history');

  if (viewDashboard) viewDashboard.classList.add('hidden');
  if (viewRegistry) viewRegistry.classList.add('hidden');
  if (viewInventory) viewInventory.classList.add('hidden');
  if (viewPhysicalBody) viewPhysicalBody.classList.add('hidden');
  if (viewPhysicalBlade) viewPhysicalBlade.classList.add('hidden');
  if (viewPhysicalEntry) viewPhysicalEntry.classList.add('hidden');
  if (viewErp) viewErp.classList.add('hidden');
  if (viewSfgStock) viewSfgStock.classList.add('hidden');
  if (viewOee) viewOee.classList.add('hidden');
  if (viewInterCompany) viewInterCompany.classList.add('hidden');
  if (viewHistory) viewHistory.classList.add('hidden');

  // Deactivate all sidebar buttons
  const btnDashboard = document.getElementById('nav-btn-dashboard');
  const btnStockOps = document.getElementById('nav-btn-stock-ops');
  const btnReg = document.getElementById('nav-btn-registry');
  const btnInv = document.getElementById('nav-btn-inventory');
  const btnPhysicalOps = document.getElementById('nav-btn-physical-ops');
  const btnPhysicalBody = document.getElementById('nav-btn-physical-cf-body');
  const btnPhysicalBlade = document.getElementById('nav-btn-physical-cf-blade');
  const btnPhysicalEntry = document.getElementById('nav-btn-physical-entry-sheet');
  const btnErp = document.getElementById('nav-btn-erp');
  const btnSfg = document.getElementById('nav-btn-sfg-stock');
  const btnOee = document.getElementById('nav-btn-oee');
  const btnInterCompany = document.getElementById('nav-btn-inter-company');
  const btnHist = document.getElementById('nav-btn-history');

  if (btnDashboard) btnDashboard.classList.remove('active');
  if (btnStockOps) btnStockOps.classList.remove('active');
  if (btnReg) btnReg.classList.remove('active');
  if (btnInv) btnInv.classList.remove('active');
  if (btnPhysicalOps) btnPhysicalOps.classList.remove('active');
  if (btnPhysicalBody) btnPhysicalBody.classList.remove('active');
  if (btnPhysicalBlade) btnPhysicalBlade.classList.remove('active');
  if (btnPhysicalEntry) btnPhysicalEntry.classList.remove('active');
  if (btnErp) btnErp.classList.remove('active');
  if (btnSfg) btnSfg.classList.remove('active');
  if (btnOee) btnOee.classList.remove('active');
  if (btnInterCompany) btnInterCompany.classList.remove('active');
  if (btnHist) btnHist.classList.remove('active');

  const breadcrumb = document.getElementById('breadcrumb-current');

  if (tab === 'dashboard') {
    if (viewDashboard) viewDashboard.classList.remove('hidden');
    if (btnDashboard) btnDashboard.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Executive Operations Cockpit';
  } else if (tab === 'inventory') {
    if (viewInventory) viewInventory.classList.remove('hidden');
    if (btnInv) btnInv.classList.add('active');
    if (btnStockOps) btnStockOps.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Warehouse Closing Stock Report (91223)';
    fetchRawMaterials();
  } else if (tab === 'physical_cf_body') {
    if (viewPhysicalBody) viewPhysicalBody.classList.remove('hidden');
    if (btnPhysicalBody) btnPhysicalBody.classList.add('active');
    if (btnPhysicalOps) btnPhysicalOps.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Ceiling Fan Body Assembly Floor';
    renderPhysicalCfBody();
  } else if (tab === 'physical_cf_blade') {
    if (viewPhysicalBlade) viewPhysicalBlade.classList.remove('hidden');
    if (btnPhysicalBlade) btnPhysicalBlade.classList.add('active');
    if (btnPhysicalOps) btnPhysicalOps.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Ceiling Fan Aero Blade Stamping & Balancing';
    renderPhysicalCfBlade();
  } else if (tab === 'physical_entry_sheet') {
    if (viewPhysicalEntry) viewPhysicalEntry.classList.remove('hidden');
    if (btnPhysicalEntry) btnPhysicalEntry.classList.add('active');
    if (btnPhysicalOps) btnPhysicalOps.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Floor Production Shift Log Entry Sheet';
    renderPhysicalEntrySheet();
  } else if (tab === 'erp_production') {
    if (viewErp) viewErp.classList.remove('hidden');
    if (btnErp) btnErp.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'ERP Production Work Orders & Feasibility Staging';
    renderErpProduction();
  } else if (tab === 'sfg_stock') {
    if (viewSfgStock) viewSfgStock.classList.remove('hidden');
    if (btnSfg) btnSfg.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Semi-Finished Goods (SFG) Work-In-Progress Buffers';
    renderSfgStock();
  } else if (tab === 'oee') {
    if (viewOee) viewOee.classList.remove('hidden');
    if (btnOee) btnOee.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Overall Equipment Effectiveness (OEE) Analytics';
    renderOEE();
  } else if (tab === 'inter_company') {
    if (viewInterCompany) viewInterCompany.classList.remove('hidden');
    if (btnInterCompany) btnInterCompany.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Inter-Company Raw Material & Stock Movement Registry';
    renderInterCompany();
  } else if (tab === 'history') {
    if (viewHistory) viewHistory.classList.remove('hidden');
    if (btnHist) btnHist.classList.add('active');
    if (btnStockOps) btnStockOps.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'Differential Audit Trail & Log';
    fetchSyncHistory();
  } else {
    // Default: 'registry'
    if (viewRegistry) viewRegistry.classList.remove('hidden');
    if (btnReg) btnReg.classList.add('active');
    if (btnStockOps) btnStockOps.classList.add('active');
    if (breadcrumb) breadcrumb.textContent = 'BOM Master Registry';
  }

  // Persist current active tab for page refresh & browser navigation
  localStorage.setItem('mep_active_tab', tab);
  if (window.location.hash !== `#${tab}`) {
    history.replaceState(null, null, `#${tab}`);
  }

  // Automatic Accordion System: Open only the active category's submenu, smoothly close others
  const stockSubmenu = document.getElementById('stock-submenu');
  const stockCaret = document.getElementById('stock-caret');
  const physicalSubmenu = document.getElementById('physical-submenu');
  const physicalCaret = document.getElementById('physical-caret');

  const isStockTab = ['registry', 'inventory', 'history'].includes(tab);
  const isPhysicalTab = ['physical_cf_body', 'physical_cf_blade', 'physical_entry_sheet'].includes(tab);

  if (isStockTab) {
    if (stockSubmenu) stockSubmenu.classList.add('expanded');
    if (stockCaret) stockCaret.className = 'ph ph-caret-down text-xs text-slate-400 transition-transform duration-200';
    if (physicalSubmenu) physicalSubmenu.classList.remove('expanded');
    if (physicalCaret) physicalCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  } else if (isPhysicalTab) {
    if (physicalSubmenu) physicalSubmenu.classList.add('expanded');
    if (physicalCaret) physicalCaret.className = 'ph ph-caret-down text-xs text-slate-400 transition-transform duration-200';
    if (stockSubmenu) stockSubmenu.classList.remove('expanded');
    if (stockCaret) stockCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  } else {
    // For Dashboard, ERP, SFG, OEE, Inter-Company: Automatically close BOTH submenus!
    if (stockSubmenu) stockSubmenu.classList.remove('expanded');
    if (stockCaret) stockCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
    if (physicalSubmenu) physicalSubmenu.classList.remove('expanded');
    if (physicalCaret) physicalCaret.className = 'ph ph-caret-right text-xs text-slate-400 transition-transform duration-200';
  }

  // Close mobile sidebar if open
  if (isMobileSidebarOpen) {
    toggleMobileSidebar();
  }
}

// -------------------------------------------------------------
// Handlers for Physical Production Subcategories (Body, Blade, Entry)
// -------------------------------------------------------------

// -------------------------------------------------------------
// Handlers for Physical Production Subcategories (Body, Blade, Entry Sheet)
// Live Extracted from ALL REPORT.xlsx -> Sheet: 'Entry Sheet Physical'
// -------------------------------------------------------------

let allPhysicalEntries = [{"id": 1, "row_index": 2, "date": "2026-08-01", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 450, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 2, "row_index": 3, "date": "2026-08-01", "item_code": "CF2401/CF2401IV", "item_name": "24 Inch Super Ceiling Fan - Ivory {Body}", "qty": 995, "month": "August", "type": "Ceiling Fan", "model_num": "2401", "part_type": "body", "year": 2026}, {"id": 3, "row_index": 4, "date": "2026-08-01", "item_code": "CF2401/CF2401IV (BL)", "item_name": "24 Inch Super Ceiling Fan - Ivory {Blade}", "qty": 1400, "month": "August", "type": "Ceiling Fan", "model_num": "2401 BL", "part_type": "blade", "year": 2026}, {"id": 4, "row_index": 5, "date": "2026-08-02", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1282, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 5, "row_index": 6, "date": "2026-08-02", "item_code": "CF2401/CF2401IV", "item_name": "24 Inch Super Ceiling Fan - Ivory {Body}", "qty": 96, "month": "August", "type": "Ceiling Fan", "model_num": "2401", "part_type": "body", "year": 2026}, {"id": 6, "row_index": 7, "date": "2026-08-02", "item_code": "CR5601IV", "item_name": "56 Inch Premium Ceiling Fan- Ivory (Without Regulator) {Body}", "qty": 75, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 7, "row_index": 8, "date": "2026-08-02", "item_code": "CF5606/CF5606IV", "item_name": "56 Inch Premium Plus Ceiling Fan - Ivory {Body}", "qty": 11, "month": "August", "type": "Ceiling Fan", "model_num": "5606", "part_type": "body", "year": 2026}, {"id": 8, "row_index": 9, "date": "2026-08-02", "item_code": "CF2401/CF2401IV (BL)", "item_name": "24 Inch Super Ceiling Fan - Ivory {Blade}", "qty": 2170, "month": "August", "type": "Ceiling Fan", "model_num": "2401 BL", "part_type": "blade", "year": 2026}, {"id": 9, "row_index": 10, "date": "2026-08-03", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1800, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 10, "row_index": 11, "date": "2026-08-03", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1300, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 11, "row_index": 12, "date": "2026-08-03", "item_code": "CF2401/CF2401IV (BL)", "item_name": "24 Inch Super Ceiling Fan - Ivory {Blade}", "qty": 351, "month": "August", "type": "Ceiling Fan", "model_num": "2401 BL", "part_type": "blade", "year": 2026}, {"id": 12, "row_index": 13, "date": "2026-08-04", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1581, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 13, "row_index": 14, "date": "2026-08-04", "item_code": "CF5607/CF5607IV", "item_name": "56 Inch Crown Ceiling Fan - Ivory {Body}", "qty": 119, "month": "August", "type": "Ceiling Fan", "model_num": "5607", "part_type": "body", "year": 2026}, {"id": 14, "row_index": 15, "date": "2026-08-04", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 48, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 15, "row_index": 16, "date": "2026-08-04", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 2130, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 16, "row_index": 17, "date": "2026-08-08", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1283, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 17, "row_index": 18, "date": "2026-08-08", "item_code": "CF5606/CF5606IV", "item_name": "56 Inch Premium Plus Ceiling Fan - Ivory {Body}", "qty": 38, "month": "August", "type": "Ceiling Fan", "model_num": "5606", "part_type": "body", "year": 2026}, {"id": 18, "row_index": 19, "date": "2026-08-08", "item_code": "CF5607/CF5607IV", "item_name": "56 Inch Crown Ceiling Fan - Ivory {Body}", "qty": 53, "month": "August", "type": "Ceiling Fan", "model_num": "5607", "part_type": "body", "year": 2026}, {"id": 19, "row_index": 20, "date": "2026-08-08", "item_code": "CF5606/CF5606IV (BL)", "item_name": "56 Inch Premium Plus Ceiling Fan - Ivory {Blade}", "qty": 30, "month": "August", "type": "Ceiling Fan", "model_num": "5606 BL", "part_type": "blade", "year": 2026}, {"id": 20, "row_index": 21, "date": "2026-08-08", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 2150, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 21, "row_index": 22, "date": "2026-08-09", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1700, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 22, "row_index": 23, "date": "2026-08-09", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1950, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 23, "row_index": 24, "date": "2026-08-09", "item_code": "CF5606/CF5606IV (BL)", "item_name": "56 Inch Premium Plus Ceiling Fan - Ivory {Blade}", "qty": 30, "month": "August", "type": "Ceiling Fan", "model_num": "5606 BL", "part_type": "blade", "year": 2026}, {"id": 24, "row_index": 25, "date": "2026-08-10", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 3178, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 25, "row_index": 26, "date": "2026-08-10", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1400, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 26, "row_index": 27, "date": "2026-08-11", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1700, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 27, "row_index": 28, "date": "2026-08-11", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1800, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 28, "row_index": 29, "date": "2026-08-12", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1050, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 29, "row_index": 30, "date": "2026-08-12", "item_code": "CF5607/CF5607IV", "item_name": "56 Inch Crown Ceiling Fan - Ivory {Body}", "qty": 164, "month": "August", "type": "Ceiling Fan", "model_num": "5607", "part_type": "body", "year": 2026}, {"id": 30, "row_index": 31, "date": "2026-08-12", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1680, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 31, "row_index": 32, "date": "2026-08-13", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1650, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 32, "row_index": 33, "date": "2026-08-13", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 82, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 33, "row_index": 34, "date": "2026-08-13", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 800, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 34, "row_index": 35, "date": "2026-08-13", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 91, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 35, "row_index": 36, "date": "2026-08-13", "item_code": "CF3601/CF3601IV (BL)", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Blade}", "qty": 650, "month": "August", "type": "Ceiling Fan", "model_num": "3601 BL", "part_type": "blade", "year": 2026}, {"id": 36, "row_index": 37, "date": "2026-08-14", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1700, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 37, "row_index": 38, "date": "2026-08-14", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 121, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 38, "row_index": 39, "date": "2026-08-14", "item_code": "CF5607/CF5607IV (BL)", "item_name": "56 Inch Crown Ceiling Fan - Ivory {Blade}", "qty": 265, "month": "August", "type": "Ceiling Fan", "model_num": "5607 BL", "part_type": "blade", "year": 2026}, {"id": 39, "row_index": 40, "date": "2026-08-14", "item_code": "CF3601/CF3601IV (BL)", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Blade}", "qty": 820, "month": "August", "type": "Ceiling Fan", "model_num": "3601 BL", "part_type": "blade", "year": 2026}, {"id": 40, "row_index": 41, "date": "2026-08-15", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1700, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 41, "row_index": 42, "date": "2026-08-15", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 790, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 42, "row_index": 43, "date": "2026-08-15", "item_code": "CF5606/CF5606IV (BL)", "item_name": "56 Inch Premium Plus Ceiling Fan - Ivory {Blade}", "qty": 240, "month": "August", "type": "Ceiling Fan", "model_num": "5606 BL", "part_type": "blade", "year": 2026}, {"id": 43, "row_index": 44, "date": "2026-08-15", "item_code": "CF4801/CF4801IV  (BL)", "item_name": "48 Inch Popular Ceiling Fan - Ivory {Blade}", "qty": 270, "month": "August", "type": "Ceiling Fan", "model_num": "4801 BL", "part_type": "blade", "year": 2026}, {"id": 44, "row_index": 45, "date": "2026-08-15", "item_code": "CF3601/CF3601IV (BL)", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Blade}", "qty": 130, "month": "August", "type": "Ceiling Fan", "model_num": "3601 BL", "part_type": "blade", "year": 2026}, {"id": 45, "row_index": 46, "date": "2026-08-16", "item_code": "CF4801/CF4801IV", "item_name": "48 Inch Popular Ceiling Fan - Ivory {Body}", "qty": 800, "month": "August", "type": "Ceiling Fan", "model_num": "4801", "part_type": "body", "year": 2026}, {"id": 46, "row_index": 47, "date": "2026-08-16", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 115, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 47, "row_index": 48, "date": "2026-08-16", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 50, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 48, "row_index": 49, "date": "2026-08-16", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1250, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 49, "row_index": 50, "date": "2026-08-17", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1050, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 50, "row_index": 51, "date": "2026-08-17", "item_code": "CF4801/CF4801IV", "item_name": "48 Inch Popular Ceiling Fan - Ivory {Body}", "qty": 367, "month": "August", "type": "Ceiling Fan", "model_num": "4801", "part_type": "body", "year": 2026}, {"id": 51, "row_index": 52, "date": "2026-08-17", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1800, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 52, "row_index": 53, "date": "2026-08-18", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1700, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 53, "row_index": 54, "date": "2026-08-18", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 2200, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 54, "row_index": 55, "date": "2026-08-19", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1000, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 55, "row_index": 56, "date": "2026-08-19", "item_code": "CF3601/CF3601IV", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Body}", "qty": 610, "month": "August", "type": "Ceiling Fan", "model_num": "3601", "part_type": "body", "year": 2026}, {"id": 56, "row_index": 57, "date": "2026-08-19", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1750, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 57, "row_index": 58, "date": "2026-08-20", "item_code": "CF3601/CF3601IV", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Body}", "qty": 1200, "month": "August", "type": "Ceiling Fan", "model_num": "3601", "part_type": "body", "year": 2026}, {"id": 58, "row_index": 59, "date": "2026-08-20", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1150, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 59, "row_index": 60, "date": "2026-08-22", "item_code": "CF3601/CF3601IV", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Body}", "qty": 1400, "month": "August", "type": "Ceiling Fan", "model_num": "3601", "part_type": "body", "year": 2026}, {"id": 60, "row_index": 61, "date": "2026-08-22", "item_code": "CR5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan- Ivory (Without Regulator) {Blade}", "qty": 50, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 61, "row_index": 62, "date": "2026-08-22", "item_code": "CF5602/CF5602IV (BL)", "item_name": "56 Inch Speed King Ceiling Fan - Ivory {Blade}", "qty": 1090, "month": "August", "type": "Ceiling Fan", "model_num": "5602 BL", "part_type": "blade", "year": 2026}, {"id": 62, "row_index": 63, "date": "2026-08-23", "item_code": "CF3601/CF3601IV", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Body}", "qty": 1697, "month": "August", "type": "Ceiling Fan", "model_num": "3601", "part_type": "body", "year": 2026}, {"id": 63, "row_index": 64, "date": "2026-08-23", "item_code": "CF5602/CF5602IV (BL)", "item_name": "56 Inch Speed King Ceiling Fan - Ivory {Blade}", "qty": 1380, "month": "August", "type": "Ceiling Fan", "model_num": "5602 BL", "part_type": "blade", "year": 2026}, {"id": 64, "row_index": 65, "date": "2026-08-24", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1600, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 65, "row_index": 66, "date": "2026-08-24", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 349, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 66, "row_index": 67, "date": "2026-08-24", "item_code": "CF5602/CF5602IV (BL)", "item_name": "56 Inch Speed King Ceiling Fan - Ivory {Blade}", "qty": 800, "month": "August", "type": "Ceiling Fan", "model_num": "5602 BL", "part_type": "blade", "year": 2026}, {"id": 67, "row_index": 68, "date": "2026-08-25", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 287, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 68, "row_index": 69, "date": "2026-08-25", "item_code": "CF2401/CF2401IV", "item_name": "24 Inch Super Ceiling Fan - Ivory {Body}", "qty": 450, "month": "August", "type": "Ceiling Fan", "model_num": "2401", "part_type": "body", "year": 2026}, {"id": 69, "row_index": 70, "date": "2026-08-25", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 590, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 70, "row_index": 71, "date": "2026-08-25", "item_code": "CF3601/CF3601IV (BL)", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Blade}", "qty": 600, "month": "August", "type": "Ceiling Fan", "model_num": "3601 BL", "part_type": "blade", "year": 2026}, {"id": 71, "row_index": 72, "date": "2026-08-26", "item_code": "CF2401/CF2401IV", "item_name": "24 Inch Super Ceiling Fan - Ivory {Body}", "qty": 1560, "month": "August", "type": "Ceiling Fan", "model_num": "2401", "part_type": "body", "year": 2026}, {"id": 72, "row_index": 73, "date": "2026-08-26", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 2050, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 73, "row_index": 74, "date": "2026-08-26", "item_code": "CF3601/CF3601IV (BL)", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Blade}", "qty": 630, "month": "August", "type": "Ceiling Fan", "model_num": "3601 BL", "part_type": "blade", "year": 2026}, {"id": 74, "row_index": 75, "date": "2026-08-27", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 2000, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 75, "row_index": 76, "date": "2026-08-27", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 60, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}, {"id": 76, "row_index": 77, "date": "2026-08-27", "item_code": "CF3601/CF3601IV (BL)", "item_name": "36 Inch Hero Ceiling Fan - Ivory {Blade}", "qty": 310, "month": "August", "type": "Ceiling Fan", "model_num": "3601 BL", "part_type": "blade", "year": 2026}, {"id": 77, "row_index": 78, "date": "2026-08-27", "item_code": "CF2401/CF2401IV (BL)", "item_name": "24 Inch Super Ceiling Fan - Ivory {Blade}", "qty": 1445, "month": "August", "type": "Ceiling Fan", "model_num": "2401 BL", "part_type": "blade", "year": 2026}, {"id": 78, "row_index": 79, "date": "2026-08-29", "item_code": "CF5601/CF5601IV", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Body}", "qty": 1350, "month": "August", "type": "Ceiling Fan", "model_num": "5601", "part_type": "body", "year": 2026}, {"id": 79, "row_index": 80, "date": "2026-08-29", "item_code": "CF5601/CF5601IV (BL)", "item_name": "56 Inch Premium Ceiling Fan - Ivory {Blade}", "qty": 1240, "month": "August", "type": "Ceiling Fan", "model_num": "5601 BL", "part_type": "blade", "year": 2026}];
let currentPhysicalPartFilter = ''; // '' (All), 'body', 'blade'

async function fetchPhysicalEntrySheet(force = false) {
  try {
    const url = force ? '/api/physical-entry-sheet?force=1' : '/api/physical-entry-sheet';
    let res = await fetch(url);
    if (!res.ok) {
      res = await fetch('data/physical_entry_sheet.json');
    }
    if (!res.ok) return;
    allPhysicalEntries = await res.json();
    renderPhysicalEntrySheet();
    renderPhysicalCfBody();
    renderPhysicalCfBlade();
    if (force) {
      showToast(`⚡ Synced ${allPhysicalEntries.length} live records from ALL REPORT.xlsx!`);
    }
  } catch (e) {
    console.error('Error fetching physical entry sheet:', e);
  }
}

function setPhysicalPartFilter(part) {
  currentPhysicalPartFilter = part;
  
  const btnAll = document.getElementById('filter-part-all');
  const btnBody = document.getElementById('filter-part-body');
  const btnBlade = document.getElementById('filter-part-blade');

  [btnAll, btnBody, btnBlade].forEach(b => {
    if (b) {
      b.className = 'px-2.5 py-1 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900';
    }
  });

  if (part === 'body' && btnBody) {
    btnBody.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-rose-600 dark:text-rose-400';
  } else if (part === 'blade' && btnBlade) {
    btnBlade.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-teal-600 dark:text-teal-400';
  } else if (btnAll) {
    btnAll.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-amber-600 dark:text-amber-400';
  }

  renderPhysicalEntrySheet();
}

function renderPhysicalEntrySheet() {
  const tbody = document.getElementById('physical-entry-sheet-table-body');
  if (!tbody) return;

  const totalOutput = allPhysicalEntries.reduce((sum, e) => sum + (Number(e.qty) || 0), 0);
  const bodyOutput = allPhysicalEntries.filter(e => e.part_type === 'body').reduce((sum, e) => sum + (Number(e.qty) || 0), 0);
  const bladeOutput = allPhysicalEntries.filter(e => e.part_type === 'blade').reduce((sum, e) => sum + (Number(e.qty) || 0), 0);
  const totalLogs = allPhysicalEntries.length;

  const statTotal = document.getElementById('stat-entry-total-output');
  if (statTotal) statTotal.textContent = `${totalOutput.toLocaleString()} Pcs`;

  const statBody = document.getElementById('stat-entry-body-output');
  if (statBody) statBody.textContent = `${bodyOutput.toLocaleString()} Pcs`;

  const statBlade = document.getElementById('stat-entry-blade-output');
  if (statBlade) statBlade.textContent = `${bladeOutput.toLocaleString()} Pcs`;

  const statShifts = document.getElementById('stat-entry-total-shifts');
  if (statShifts) statShifts.textContent = `${totalLogs} Records`;

  const countBadge = document.getElementById('badge-entry-count');
  if (countBadge) countBadge.textContent = `${totalLogs} Records`;

  const sideBadge = document.getElementById('badge-entry-sidebar');
  if (sideBadge) sideBadge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.9)] animate-pulse shrink-0"></span><span>${totalLogs} Logs</span>`;

  const query = (document.getElementById('search-physical-entry')?.value || '').toLowerCase().trim();

  const filtered = allPhysicalEntries.filter(e => {
    if (currentPhysicalPartFilter && e.part_type !== currentPhysicalPartFilter) return false;
    if (!query) return true;
    return (
      (e.item_code || '').toLowerCase().includes(query) ||
      (e.item_name || '').toLowerCase().includes(query) ||
      (e.date || '').toLowerCase().includes(query) ||
      (e.model_num || '').toLowerCase().includes(query) ||
      (e.type || '').toLowerCase().includes(query)
    );
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-slate-400">
          <i class="ph ph-magnifying-glass text-2xl mb-1 block"></i>
          <span>No physical entry sheet logs match your search.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((entry, idx) => {
    const isBody = entry.part_type === 'body';
    const isBlade = entry.part_type === 'blade';
    const partBadge = isBody
      ? `<span class="glass-pill glass-pill-rose text-[10px] font-bold py-0.5 px-2">BODY</span>`
      : (isBlade 
        ? `<span class="glass-pill glass-pill-cyan text-[10px] font-bold py-0.5 px-2">BLADE</span>`
        : `<span class="glass-pill glass-pill-indigo text-[10px] font-bold py-0.5 px-2">UNIT</span>`);

    return `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
        <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-3 px-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">${entry.date || '--'}</td>
        <td class="py-3 px-3.5 font-mono font-bold ${isBody ? 'text-rose-600 dark:text-rose-400' : 'text-teal-600 dark:text-teal-400'} text-xs">${escapeHtml(entry.item_code)}</td>
        <td class="py-3 px-3.5 font-semibold text-slate-900 dark:text-white">
          <div class="flex items-center gap-1.5">
            <i class="ph-bold ${isBody ? 'ph-fan text-rose-500' : (isBlade ? 'ph-wind text-teal-500' : 'ph-cube text-indigo-500')} shrink-0"></i>
            <span>${escapeHtml(entry.item_name)}</span>
          </div>
        </td>
        <td class="py-3 px-3.5 text-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">${escapeHtml(entry.type || 'Ceiling Fan')}</td>
        <td class="py-3 px-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">${escapeHtml(entry.model_num || '--')}</td>
        <td class="py-3 px-3.5 text-center whitespace-nowrap">${partBadge}</td>
        <td class="py-3 px-3.5 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm whitespace-nowrap">
          ${(Number(entry.qty) || 0).toLocaleString()} Pcs
        </td>
      </tr>
    `;
  }).join('');
}

function exportPhysicalEntryLogs() {
  if (allPhysicalEntries.length === 0) {
    showToast('No entries to export', 'warning');
    return;
  }
  const headers = ['SL', 'Date', 'Item Code', 'Production Item Name', 'Achievement (Pcs)', 'Month', 'Types', 'Model', 'Part', 'Year'];
  const rows = allPhysicalEntries.map((e, i) => [
    i + 1,
    `"${e.date}"`,
    `"${e.item_code}"`,
    `"${e.item_name}"`,
    e.qty,
    `"${e.month}"`,
    `"${e.type}"`,
    `"${e.model_num}"`,
    `"${e.part_type}"`,
    e.year
  ]);
  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Physical_Entry_Sheet_August_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Physical Entry Sheet exported to CSV');
}


// -------------------------------------------------------------
// Day and Model Wise Production Matrices (Computed DIRECTLY from allPhysicalEntries with Month Switching)
// -------------------------------------------------------------
let currentBodyViewMode = 'matrix'; // 'matrix' or 'logs'
let currentBladeViewMode = 'matrix'; // 'matrix' or 'logs'
let currentBodyYearMonth = '2026-08';
let currentBladeYearMonth = '2026-08';

const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function changePhysicalMonth(part, delta) {
  const isBlade = part === 'blade';
  let curYM = isBlade ? currentBladeYearMonth : currentBodyYearMonth;
  let [y, m] = curYM.split('-').map(Number);
  
  m += delta;
  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }
  
  const newYM = `${y}-${String(m).padStart(2, '0')}`;
  if (isBlade) {
    currentBladeYearMonth = newYM;
    const sel = document.getElementById('select-cf-blade-month');
    if (sel) sel.value = newYM;
    renderPhysicalCfBlade();
  } else {
    currentBodyYearMonth = newYM;
    const sel = document.getElementById('select-cf-body-month');
    if (sel) sel.value = newYM;
    renderPhysicalCfBody();
  }
  
  const monthName = MONTH_NAMES_FULL[m - 1];
  showToast(`📅 Switched to ${monthName} ${y} Report`);
}

function onPhysicalMonthChange(part, value) {
  if (part === 'blade') {
    currentBladeYearMonth = value;
    renderPhysicalCfBlade();
  } else {
    currentBodyYearMonth = value;
    renderPhysicalCfBody();
  }
  const [y, m] = value.split('-').map(Number);
  const monthName = MONTH_NAMES_FULL[m - 1];
  showToast(`📅 Switched to ${monthName} ${y} Report`);
}

function computePhysicalMatrixFromEntries(partType, targetYearMonth = '2026-08') {
  const cleanPart = (partType || 'body').toLowerCase().trim();
  const [targetYear, targetMonth] = targetYearMonth.split('-').map(Number);
  const targetMonthName = MONTH_NAMES_FULL[targetMonth - 1] || 'August';
  const targetMonthShort = MONTH_NAMES_SHORT[targetMonth - 1] || 'Aug';

  // Filter entries for the chosen part AND chosen month/year
  const entries = (allPhysicalEntries || []).filter(e => {
    const p = String(e.part_type || '').toLowerCase().trim();
    const matchesPart = cleanPart === 'blade' ? (p === 'blade') : (p === 'body' || p === 'unit');
    if (!matchesPart) return false;

    const d = String(e.date || '');
    const m = String(e.month || '').trim().toLowerCase();
    const y = String(e.year || '').trim();

    if (d.startsWith(targetYearMonth)) return true;
    if (m === targetMonthName.toLowerCase() && y === String(targetYear)) return true;
    return false;
  });

  // Model column order definition
  let modelsOrder = [];
  if (cleanPart === 'blade') {
    modelsOrder = ['5601 BL', '5602 BL', '5603 BL', '5606 BL', '5607 BL', '4801 BL', '3601 BL', '2401 BL'];
  } else {
    modelsOrder = ['5601', '5602', '5603', '5606', '5607', '4801', '3601', '2401'];
  }

  // Find models present in entries
  const foundModels = new Set(entries.map(e => (e.model_num || '').trim()).filter(Boolean));
  let models = modelsOrder.filter(m => foundModels.has(m) || Array.from(foundModels).some(x => x.startsWith(m.replace(' BL', ''))));
  
  // Add any extra models found in Entry Sheet that weren't in default list
  foundModels.forEach(m => {
    if (!models.includes(m)) models.push(m);
  });
  if (models.length === 0) {
    models = modelsOrder;
  }

  // Date mapping: group by date & model directly from allPhysicalEntries
  const dateMap = {};
  entries.forEach(e => {
    const d = e.date;
    const m = (e.model_num || '').trim();
    const q = Number(e.qty) || 0;
    if (d) {
      if (!dateMap[d]) dateMap[d] = {};
      dateMap[d][m] = (dateMap[d][m] || 0) + q;
    }
  });

  // Number of days in selected month (e.g. 31, 30, 28)
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();

  const dates = [];
  for (let i = 1; i <= daysInMonth; i++) {
    dates.push(`${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }

  const dailyRows = [];
  let totalProduction = 0;
  const modelTotals = {};
  models.forEach(m => { modelTotals[m] = 0; });

  const dailyTarget = 1750;
  const monthlyTarget = 45500;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  dates.forEach(d => {
    const rowModels = {};
    let rowTotal = 0;
    
    // Parse day of week
    let dayName = '';
    try {
      const dt = new Date(d + 'T00:00:00');
      dayName = dayNames[dt.getDay()] || '';
    } catch(e) {
      dayName = '';
    }

    models.forEach(m => {
      const val = dateMap[d]?.[m] || 0;
      rowModels[m] = val;
      rowTotal += val;
      modelTotals[m] = (modelTotals[m] || 0) + val;
    });

    const hasProd = rowTotal > 0;
    const variance = hasProd ? (rowTotal - dailyTarget) : 0;
    const loss = hasProd ? (dailyTarget - rowTotal) : 0;

    totalProduction += rowTotal;
    dailyRows.push({
      date: d,
      day_name: dayName,
      models: rowModels,
      total: rowTotal,
      target: hasProd ? dailyTarget : 0,
      variance: variance,
      loss: loss,
      has_production: hasProd
    });
  });

  const achievementPct = monthlyTarget > 0 ? Number(((totalProduction / monthlyTarget) * 100).toFixed(1)) : 0;

  const modelShares = models.map(m => {
    const mQty = modelTotals[m] || 0;
    const mPct = totalProduction > 0 ? Number(((mQty / totalProduction) * 100).toFixed(1)) : 0;
    return {
      model: m,
      quantity: mQty,
      percentage: mPct
    };
  }).filter(ms => ms.quantity > 0).sort((a, b) => b.quantity - a.quantity);

  const activeDays = dailyRows.filter(r => r.has_production).length;
  const avgOutput = Math.round(totalProduction / Math.max(1, activeDays));
  let peakDay = null;
  dailyRows.forEach(r => {
    if (!peakDay || r.total > peakDay.total) {
      peakDay = r;
    }
  });

  return {
    part: cleanPart,
    year_month: targetYearMonth,
    month_name: targetMonthName,
    month_short: targetMonthShort,
    year: targetYear,
    days_in_month: daysInMonth,
    models: models,
    model_totals: modelTotals,
    model_shares: modelShares,
    total_production: totalProduction,
    monthly_target: monthlyTarget,
    achievement_pct: achievementPct,
    daily_target: dailyTarget,
    daily_rows: dailyRows,
    active_days_count: activeDays,
    average_daily_output: avgOutput,
    peak_day: peakDay,
    raw_entries: entries
  };
}

function setBodyViewMode(mode) {
  currentBodyViewMode = mode;
  const btnMatrix = document.getElementById('btn-body-view-matrix');
  const btnLogs = document.getElementById('btn-body-view-logs');
  if (btnMatrix && btnLogs) {
    if (mode === 'matrix') {
      btnMatrix.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5';
      btnLogs.className = 'px-2.5 py-1 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 flex items-center gap-1.5';
    } else {
      btnLogs.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5';
      btnMatrix.className = 'px-2.5 py-1 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 flex items-center gap-1.5';
    }
  }
  renderPhysicalCfBody();
}

function setBladeViewMode(mode) {
  currentBladeViewMode = mode;
  const btnMatrix = document.getElementById('btn-blade-view-matrix');
  const btnLogs = document.getElementById('btn-blade-view-logs');
  if (btnMatrix && btnLogs) {
    if (mode === 'matrix') {
      btnMatrix.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-teal-600 dark:text-teal-400 flex items-center gap-1.5';
      btnLogs.className = 'px-2.5 py-1 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 flex items-center gap-1.5';
    } else {
      btnLogs.className = 'px-2.5 py-1 rounded-lg font-bold text-xs bg-white dark:bg-dark-700 shadow-2xs text-teal-600 dark:text-teal-400 flex items-center gap-1.5';
      btnMatrix.className = 'px-2.5 py-1 rounded-lg font-semibold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 flex items-center gap-1.5';
    }
  }
  renderPhysicalCfBlade();
}

function renderPhysicalCfBody() {
  const table = document.getElementById('body-matrix-table');
  if (!table) return;

  // Compute live matrix directly from Entry Sheet data for selected month
  const data = computePhysicalMatrixFromEntries('body', currentBodyYearMonth);
  const models = data.models || ['5601', '5606', '5607', '4801', '3601', '2401'];
  const dailyRows = data.daily_rows || [];
  const modelTotals = data.model_totals || {};
  const modelShares = data.model_shares || [];
  const totalProduction = data.total_production || 0;
  const target = data.monthly_target || 45500;
  const achievementPct = data.achievement_pct || 0;
  const peakDay = data.peak_day;
  const monthName = data.month_name;
  const year = data.year;

  // Update KPI Cards
  const statTotal = document.getElementById('stat-cf-body-total');
  if (statTotal) statTotal.textContent = `${totalProduction.toLocaleString()} Pcs`;

  const statSub = document.getElementById('stat-cf-body-sub');
  if (statSub) statSub.textContent = `${monthName} Output (${achievementPct}% Target)`;

  const statPeak = document.getElementById('stat-cf-body-peak');
  if (statPeak && peakDay && peakDay.total > 0) {
    statPeak.textContent = `${peakDay.total.toLocaleString()} Pcs`;
  } else if (statPeak) {
    statPeak.textContent = `0 Pcs`;
  }

  const statPeakSub = document.getElementById('stat-cf-body-peak-sub');
  if (statPeakSub) {
    if (peakDay && peakDay.total > 0) {
      statPeakSub.textContent = `Highest Run: ${peakDay.date.split('-')[2]} ${data.month_short} (${peakDay.total.toLocaleString()} Pcs)`;
    } else {
      statPeakSub.textContent = `No production run for ${monthName}`;
    }
  }

  const statModels = document.getElementById('stat-cf-body-models');
  if (statModels) statModels.textContent = `${modelShares.length} Models`;

  const statModelsSub = document.getElementById('stat-cf-body-models-sub');
  if (statModelsSub) {
    if (modelShares.length > 0) {
      statModelsSub.textContent = `Top: CF ${modelShares[0].model} (${modelShares[0].quantity.toLocaleString()} Pcs)`;
    } else {
      statModelsSub.textContent = `0 Models active in ${monthName}`;
    }
  }

  const badgeCount = document.getElementById('badge-cf-body-count');
  if (badgeCount) badgeCount.textContent = `${data.days_in_month} Days (${monthName} ${year})`;

  // Render Model Quick Distribution Ribbon
  const chipsContainer = document.getElementById('body-model-chips-container');
  if (chipsContainer) {
    if (modelShares.length === 0) {
      chipsContainer.innerHTML = `
        <div class="px-3 py-1 text-xs text-slate-400 font-medium">
          No body models recorded for ${monthName} ${year}.
        </div>
      `;
    } else {
      chipsContainer.innerHTML = modelShares.map(ms => `
        <div class="px-3 py-1.5 rounded-xl bg-white/70 dark:bg-dark-800/70 border border-rose-200/70 dark:border-rose-900/40 shadow-2xs flex items-center gap-2 shrink-0">
          <span class="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]"></span>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200">CF ${ms.model}</span>
          <span class="font-mono text-xs font-black text-rose-600 dark:text-rose-400">${ms.quantity.toLocaleString()}</span>
          <span class="text-[10px] font-bold text-slate-400">(${ms.percentage}%)</span>
        </div>
      `).join('');
    }
  }

  const query = (document.getElementById('search-physical-body')?.value || '').toLowerCase().trim();

  if (currentBodyViewMode === 'matrix') {
    // 1. Matrix View Table
    const filteredRows = dailyRows.filter(r => {
      if (!query) return true;
      return (
        r.date.toLowerCase().includes(query) ||
        r.day_name.toLowerCase().includes(query) ||
        models.some(m => (r.models[m] || 0).toString().includes(query))
      );
    });

    table.innerHTML = `
      <thead>
        <tr class="text-rose-950 dark:text-rose-100 font-extrabold uppercase tracking-wider text-[11px] sticky top-0 z-20 bg-rose-500/10 backdrop-blur-md">
          <th class="py-3 px-3 w-12 text-center font-mono">#</th>
          <th class="py-3 px-3.5 w-28 font-mono">Date</th>
          <th class="py-3 px-3 w-24">Day</th>
          ${models.map(m => `<th class="py-3 px-3 text-center font-mono text-xs">CF ${m}</th>`).join('')}
          <th class="py-3 px-3.5 w-28 text-center font-mono font-black text-rose-900 dark:text-rose-200">Total Built</th>
          <th class="py-3 px-3 w-24 text-center font-mono text-slate-500">Target</th>
          <th class="py-3 px-3.5 w-28 text-center font-mono">Variance</th>
          <th class="py-3 px-3.5 w-24 text-center">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 text-xs">
        ${filteredRows.map((r, idx) => {
          const isOverTarget = r.total >= r.target && r.total > 0;
          const isZero = r.total === 0;
          const statusBadge = isZero 
            ? `<span class="text-slate-400 font-mono text-[10px] font-semibold">--</span>`
            : (isOverTarget
              ? `<span class="glass-pill glass-pill-emerald text-[9px] font-bold py-0.5 px-2">PASS</span>`
              : `<span class="glass-pill glass-pill-rose text-[9px] font-bold py-0.5 px-2">DEFICIT</span>`);

          const varBadge = isZero
            ? `<span class="text-slate-400 font-mono">0</span>`
            : (r.variance >= 0
              ? `<span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">+${r.variance.toLocaleString()}</span>`
              : `<span class="font-mono font-bold text-rose-600 dark:text-rose-400">${r.variance.toLocaleString()}</span>`);

          return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors ${r.total > 0 ? 'font-medium' : 'opacity-40'}">
              <td class="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
              <td class="py-2.5 px-3.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">${r.date}</td>
              <td class="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">${r.day_name.substring(0, 3)}</td>
              ${models.map(m => {
                const val = r.models[m] || 0;
                return `<td class="py-2.5 px-3 text-center font-mono ${val > 0 ? 'font-bold text-rose-600 dark:text-rose-400 bg-rose-500/5' : 'text-slate-300 dark:text-slate-600'}">${val > 0 ? val.toLocaleString() : '-'}</td>`;
              }).join('')}
              <td class="py-2.5 px-3.5 text-center font-mono font-black ${r.total > 0 ? 'text-slate-900 dark:text-white text-sm' : 'text-slate-400'}">
                ${r.total > 0 ? r.total.toLocaleString() : '-'}
              </td>
              <td class="py-2.5 px-3 text-center font-mono text-xs text-slate-500 font-semibold">
                ${r.target > 0 ? r.target.toLocaleString() : '-'}
              </td>
              <td class="py-2.5 px-3.5 text-center font-mono text-xs">
                ${varBadge}
              </td>
              <td class="py-2.5 px-3.5 text-center">
                ${statusBadge}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot class="sticky bottom-0 z-20 bg-gradient-to-r from-emerald-900 via-[#0a4d3c] to-emerald-900 dark:from-slate-950 dark:via-zinc-900 dark:to-slate-950 text-white backdrop-blur-xl border-t-2 border-amber-400 dark:border-amber-400/80 shadow-[0_-6px_25px_rgba(6,78,59,0.35)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.8)] text-xs font-black">
        <tr class="divide-x divide-emerald-800/70 dark:divide-zinc-800/80">
          <td colspan="3" class="py-3.5 px-4 font-black">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-300 text-slate-950 flex items-center justify-center text-xs shadow-[0_0_12px_rgba(245,158,11,0.6)] font-black">
                <i class="ph-fill ph-crown"></i>
              </span>
              <span class="bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent uppercase tracking-wider font-black text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">
                ${monthName.toUpperCase()} ${year} TOTAL:
              </span>
            </div>
          </td>
          ${models.map(m => `
            <td class="py-3 px-3 text-center font-mono font-black text-amber-300 text-xs bg-amber-400/10 dark:bg-amber-500/5">
              ${(modelTotals[m] || 0).toLocaleString()}
            </td>
          `).join('')}
          <td class="py-3 px-3.5 text-center font-mono font-black text-sm">
            <span class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black font-mono shadow-[0_0_15px_rgba(245,158,11,0.55)] border border-amber-300/80 whitespace-nowrap">
              ${totalProduction.toLocaleString()} Pcs
            </span>
          </td>
          <td class="py-3 px-3.5 text-center font-mono text-emerald-200/90 dark:text-zinc-400 font-bold text-xs">
            ${target.toLocaleString()}
          </td>
          <td class="py-3 px-3.5 text-center font-mono font-black text-xs">
            ${totalProduction >= target 
              ? `<span class="text-emerald-300 dark:text-emerald-400 font-bold drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">+${(totalProduction - target).toLocaleString()}</span>` 
              : `<span class="text-rose-300 dark:text-rose-400 font-bold drop-shadow-[0_0_6px_rgba(251,113,133,0.5)]">${(totalProduction - target).toLocaleString()}</span>`}
          </td>
          <td class="py-3 px-3.5 text-center font-mono font-black text-xs">
            <span class="px-2 py-0.5 rounded-md bg-amber-400/25 dark:bg-amber-500/20 border border-amber-400/70 dark:border-amber-400/50 text-amber-200 dark:text-amber-300 font-black shadow-[0_0_8px_rgba(245,158,11,0.35)]">
              ${achievementPct}%
            </span>
          </td>
        </tr>
      </tfoot>
    `;
  } else {
    // 2. Raw Shift Logs View
    const rawEntries = (data.raw_entries || []).filter(e => {
      if (!query) return true;
      return (
        (e.date || '').toLowerCase().includes(query) ||
        (e.item_code || '').toLowerCase().includes(query) ||
        (e.item_name || '').toLowerCase().includes(query) ||
        (e.model_num || '').toLowerCase().includes(query)
      );
    });

    table.innerHTML = `
      <thead>
        <tr class="text-rose-950 dark:text-rose-100 font-extrabold uppercase tracking-wider text-[11px] sticky top-0 z-20 bg-rose-500/10 backdrop-blur-md">
          <th class="py-3 px-3 w-12 text-center font-mono">#</th>
          <th class="py-3 px-3.5 w-28 font-mono">Date</th>
          <th class="py-3 px-3.5 w-36 font-mono">Item Code</th>
          <th class="py-3 px-3.5">Body Production Item Name</th>
          <th class="py-3 px-3.5 w-24 text-center">Model</th>
          <th class="py-3 px-3.5 w-32 text-center font-mono">Achievement (Pcs)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 text-xs">
        ${rawEntries.length === 0 ? `
          <tr><td colspan="6" class="text-center py-8 text-slate-400">No shift logs found for ${monthName} ${year}.</td></tr>
        ` : rawEntries.map((e, idx) => `
          <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
            <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">${e.date || '--'}</td>
            <td class="py-3 px-3.5 font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">${escapeHtml(e.item_code)}</td>
            <td class="py-3 px-3.5 font-semibold text-slate-900 dark:text-white">
              <div class="flex items-center gap-1.5">
                <i class="ph-bold ph-fan text-rose-500 shrink-0"></i>
                <span>${escapeHtml(e.item_name)}</span>
              </div>
            </td>
            <td class="py-3 px-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-200">${escapeHtml(e.model_num || '--')}</td>
            <td class="py-3 px-3.5 text-center font-mono font-black text-rose-600 dark:text-rose-400 text-sm whitespace-nowrap">
              ${(Number(e.qty) || 0).toLocaleString()} Pcs
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }
}

function renderPhysicalCfBlade() {
  const table = document.getElementById('blade-matrix-table');
  if (!table) return;

  // Compute live matrix directly from Entry Sheet data for selected month
  const data = computePhysicalMatrixFromEntries('blade', currentBladeYearMonth);
  const models = data.models || ['5601 BL', '5602 BL', '5606 BL', '5607 BL', '4801 BL', '3601 BL', '2401 BL'];
  const dailyRows = data.daily_rows || [];
  const modelTotals = data.model_totals || {};
  const modelShares = data.model_shares || [];
  const totalProduction = data.total_production || 0;
  const target = data.monthly_target || 45500;
  const achievementPct = data.achievement_pct || 0;
  const peakDay = data.peak_day;
  const monthName = data.month_name;
  const year = data.year;

  // Update KPI Cards
  const statTotal = document.getElementById('stat-cf-blade-total');
  if (statTotal) statTotal.textContent = `${totalProduction.toLocaleString()} Pcs`;

  const statSub = document.getElementById('stat-cf-blade-sub');
  if (statSub) statSub.textContent = `${monthName} Output (${achievementPct}% Target)`;

  const statPeak = document.getElementById('stat-cf-blade-peak');
  if (statPeak && peakDay && peakDay.total > 0) {
    statPeak.textContent = `${peakDay.total.toLocaleString()} Pcs`;
  } else if (statPeak) {
    statPeak.textContent = `0 Pcs`;
  }

  const statPeakSub = document.getElementById('stat-cf-blade-peak-sub');
  if (statPeakSub) {
    if (peakDay && peakDay.total > 0) {
      statPeakSub.textContent = `Highest Run: ${peakDay.date.split('-')[2]} ${data.month_short} (${peakDay.total.toLocaleString()} Pcs)`;
    } else {
      statPeakSub.textContent = `No production run for ${monthName}`;
    }
  }

  const statModels = document.getElementById('stat-cf-blade-models');
  if (statModels) statModels.textContent = `${modelShares.length} Models`;

  const statModelsSub = document.getElementById('stat-cf-blade-models-sub');
  if (statModelsSub) {
    if (modelShares.length > 0) {
      statModelsSub.textContent = `Top: CF ${modelShares[0].model} (${modelShares[0].quantity.toLocaleString()} Pcs)`;
    } else {
      statModelsSub.textContent = `0 Models active in ${monthName}`;
    }
  }

  const badgeCount = document.getElementById('badge-cf-blade-count');
  if (badgeCount) badgeCount.textContent = `${data.days_in_month} Days (${monthName} ${year})`;

  // Render Model Quick Distribution Ribbon
  const chipsContainer = document.getElementById('blade-model-chips-container');
  if (chipsContainer) {
    if (modelShares.length === 0) {
      chipsContainer.innerHTML = `
        <div class="px-3 py-1 text-xs text-slate-400 font-medium">
          No blade models recorded for ${monthName} ${year}.
        </div>
      `;
    } else {
      chipsContainer.innerHTML = modelShares.map(ms => `
        <div class="px-3 py-1.5 rounded-xl bg-white/70 dark:bg-dark-800/70 border border-teal-200/70 dark:border-teal-900/40 shadow-2xs flex items-center gap-2 shrink-0">
          <span class="w-2 h-2 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.8)]"></span>
          <span class="text-xs font-bold text-slate-800 dark:text-slate-200">CF ${ms.model}</span>
          <span class="font-mono text-xs font-black text-teal-600 dark:text-teal-400">${ms.quantity.toLocaleString()}</span>
          <span class="text-[10px] font-bold text-slate-400">(${ms.percentage}%)</span>
        </div>
      `).join('');
    }
  }

  const query = (document.getElementById('search-physical-blade')?.value || '').toLowerCase().trim();

  if (currentBladeViewMode === 'matrix') {
    // 1. Matrix View Table
    const filteredRows = dailyRows.filter(r => {
      if (!query) return true;
      return (
        r.date.toLowerCase().includes(query) ||
        r.day_name.toLowerCase().includes(query) ||
        models.some(m => (r.models[m] || 0).toString().includes(query))
      );
    });

    table.innerHTML = `
      <thead>
        <tr class="text-teal-950 dark:text-teal-100 font-extrabold uppercase tracking-wider text-[11px] sticky top-0 z-20 bg-teal-500/10 backdrop-blur-md">
          <th class="py-3 px-3 w-12 text-center font-mono">#</th>
          <th class="py-3 px-3.5 w-28 font-mono">Date</th>
          <th class="py-3 px-3 w-24">Day</th>
          ${models.map(m => `<th class="py-3 px-3 text-center font-mono text-xs">CF ${m.replace(' BL', '')}</th>`).join('')}
          <th class="py-3 px-3.5 w-28 text-center font-mono font-black text-teal-900 dark:text-teal-200">Total Built</th>
          <th class="py-3 px-3 w-24 text-center font-mono text-slate-500">Target</th>
          <th class="py-3 px-3.5 w-28 text-center font-mono">Variance</th>
          <th class="py-3 px-3.5 w-24 text-center">Status</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 text-xs">
        ${filteredRows.map((r, idx) => {
          const isOverTarget = r.total >= r.target && r.total > 0;
          const isZero = r.total === 0;
          const statusBadge = isZero 
            ? `<span class="text-slate-400 font-mono text-[10px] font-semibold">--</span>`
            : (isOverTarget
              ? `<span class="glass-pill glass-pill-emerald text-[9px] font-bold py-0.5 px-2">PASS</span>`
              : `<span class="glass-pill glass-pill-rose text-[9px] font-bold py-0.5 px-2">DEFICIT</span>`);

          const varBadge = isZero
            ? `<span class="text-slate-400 font-mono">0</span>`
            : (r.variance >= 0
              ? `<span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">+${r.variance.toLocaleString()}</span>`
              : `<span class="font-mono font-bold text-rose-600 dark:text-rose-400">${r.variance.toLocaleString()}</span>`);

          return `
            <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors ${r.total > 0 ? 'font-medium' : 'opacity-40'}">
              <td class="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
              <td class="py-2.5 px-3.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">${r.date}</td>
              <td class="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">${r.day_name.substring(0, 3)}</td>
              ${models.map(m => {
                const val = r.models[m] || 0;
                return `<td class="py-2.5 px-3 text-center font-mono ${val > 0 ? 'font-bold text-teal-600 dark:text-teal-400 bg-teal-500/5' : 'text-slate-300 dark:text-slate-600'}">${val > 0 ? val.toLocaleString() : '-'}</td>`;
              }).join('')}
              <td class="py-2.5 px-3.5 text-center font-mono font-black ${r.total > 0 ? 'text-slate-900 dark:text-white text-sm' : 'text-slate-400'}">
                ${r.total > 0 ? r.total.toLocaleString() : '-'}
              </td>
              <td class="py-2.5 px-3 text-center font-mono text-xs text-slate-500 font-semibold">
                ${r.target > 0 ? r.target.toLocaleString() : '-'}
              </td>
              <td class="py-2.5 px-3.5 text-center font-mono text-xs">
                ${varBadge}
              </td>
              <td class="py-2.5 px-3.5 text-center">
                ${statusBadge}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot class="sticky bottom-0 z-20 bg-gradient-to-r from-emerald-900 via-[#0a4d3c] to-emerald-900 dark:from-slate-950 dark:via-zinc-900 dark:to-slate-950 text-white backdrop-blur-xl border-t-2 border-amber-400 dark:border-amber-400/80 shadow-[0_-6px_25px_rgba(6,78,59,0.35)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.8)] text-xs font-black">
        <tr class="divide-x divide-emerald-800/70 dark:divide-zinc-800/80">
          <td colspan="3" class="py-3.5 px-4 font-black">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-400 via-amber-300 to-yellow-300 text-slate-950 flex items-center justify-center text-xs shadow-[0_0_12px_rgba(245,158,11,0.6)] font-black">
                <i class="ph-fill ph-crown"></i>
              </span>
              <span class="bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-400 bg-clip-text text-transparent uppercase tracking-wider font-black text-xs drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] whitespace-nowrap">
                ${monthName.toUpperCase()} ${year} TOTAL:
              </span>
            </div>
          </td>
          ${models.map(m => `
            <td class="py-3 px-3 text-center font-mono font-black text-amber-300 text-xs bg-amber-400/10 dark:bg-amber-500/5">
              ${(modelTotals[m] || 0).toLocaleString()}
            </td>
          `).join('')}
          <td class="py-3 px-3.5 text-center font-mono font-black text-sm">
            <span class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black font-mono shadow-[0_0_15px_rgba(245,158,11,0.55)] border border-amber-300/80 whitespace-nowrap">
              ${totalProduction.toLocaleString()} Pcs
            </span>
          </td>
          <td class="py-3 px-3.5 text-center font-mono text-emerald-200/90 dark:text-zinc-400 font-bold text-xs">
            ${target.toLocaleString()}
          </td>
          <td class="py-3 px-3.5 text-center font-mono font-black text-xs">
            ${totalProduction >= target 
              ? `<span class="text-emerald-300 dark:text-emerald-400 font-bold drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]">+${(totalProduction - target).toLocaleString()}</span>` 
              : `<span class="text-rose-300 dark:text-rose-400 font-bold drop-shadow-[0_0_6px_rgba(251,113,133,0.5)]">${(totalProduction - target).toLocaleString()}</span>`}
          </td>
          <td class="py-3 px-3.5 text-center font-mono font-black text-xs">
            <span class="px-2 py-0.5 rounded-md bg-amber-400/25 dark:bg-amber-500/20 border border-amber-400/70 dark:border-amber-400/50 text-amber-200 dark:text-amber-300 font-black shadow-[0_0_8px_rgba(245,158,11,0.35)]">
              ${achievementPct}%
            </span>
          </td>
        </tr>
      </tfoot>
    `;
  } else {
    // 2. Raw Shift Logs View
    const rawEntries = (data.raw_entries || []).filter(e => {
      if (!query) return true;
      return (
        (e.date || '').toLowerCase().includes(query) ||
        (e.item_code || '').toLowerCase().includes(query) ||
        (e.item_name || '').toLowerCase().includes(query) ||
        (e.model_num || '').toLowerCase().includes(query)
      );
    });

    table.innerHTML = `
      <thead>
        <tr class="text-teal-950 dark:text-teal-100 font-extrabold uppercase tracking-wider text-[11px] sticky top-0 z-20 bg-teal-500/10 backdrop-blur-md">
          <th class="py-3 px-3 w-12 text-center font-mono">#</th>
          <th class="py-3 px-3.5 w-28 font-mono">Date</th>
          <th class="py-3 px-3.5 w-36 font-mono">Item Code</th>
          <th class="py-3 px-3.5">Blade Production Item Name</th>
          <th class="py-3 px-3.5 w-24 text-center">Model</th>
          <th class="py-3 px-3.5 w-32 text-center font-mono">Achievement (Pcs)</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100/60 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 text-xs">
        ${rawEntries.length === 0 ? `
          <tr><td colspan="6" class="text-center py-8 text-slate-400">No shift logs found for ${monthName} ${year}.</td></tr>
        ` : rawEntries.map((e, idx) => `
          <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
            <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
            <td class="py-3 px-3.5 font-mono text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">${e.date || '--'}</td>
            <td class="py-3 px-3.5 font-mono font-bold text-teal-600 dark:text-teal-400 text-xs">${escapeHtml(e.item_code)}</td>
            <td class="py-3 px-3.5 font-semibold text-slate-900 dark:text-white">
              <div class="flex items-center gap-1.5">
                <i class="ph-bold ph-wind text-teal-500 shrink-0"></i>
                <span>${escapeHtml(e.item_name)}</span>
              </div>
            </td>
            <td class="py-3 px-3.5 text-center font-mono font-bold text-slate-700 dark:text-slate-200">${escapeHtml(e.model_num || '--')}</td>
            <td class="py-3 px-3.5 text-center font-mono font-black text-teal-600 dark:text-teal-400 text-sm whitespace-nowrap">
              ${(Number(e.qty) || 0).toLocaleString()} Pcs
            </td>
          </tr>
        `).join('')}
      </tbody>
    `;
  }
}


function renderErpProduction() {
  const tbody = document.getElementById('erp-table-body');
  if (!tbody) return;

  if (!erpBatchesData || erpBatchesData.length === 0) {
    const sampleBOMs = allBOMs && allBOMs.length > 0 ? allBOMs.slice(0, 18) : [];
    erpBatchesData = sampleBOMs.map((bom, idx) => {
      const orderQty = [300, 500, 750, 1000, 1200, 1500, 2000][idx % 7];
      const maxCap = bom.feasibility ? bom.feasibility.can_produce : 0;
      const isStaged = maxCap >= orderQty;
      const floors = ['Floor 1 - Ceiling Fan Line A', 'Floor 1 - Ceiling Fan Line B', 'Floor 2 - Table & Stand Line', 'Floor 3 - Exhaust & Ventilation', 'Floor 2 - Stator Assembly'];
      const date = new Date(2026, 7, 28 + (idx % 4)).toISOString().split('T')[0];

      return {
        id: `WO-2026-${(8100 + idx)}`,
        bom_no: bom.bom_no || `BOM-${idx+1}`,
        item_code: bom.item_code || '',
        product_name: bom.product_name || `MEP Product Model ${idx+1}`,
        floor: bom.section || floors[idx % floors.length],
        order_qty: orderQty,
        max_cap: maxCap,
        is_staged: isStaged,
        status: isStaged ? 'READY TO DISPATCH' : 'MATERIAL HOLD',
        date: date
      };
    });
  }

  filterErpBatches();
}

function filterErpBatches() {
  const tbody = document.getElementById('erp-table-body');
  if (!tbody) return;

  const query = (document.getElementById('search-erp-batches')?.value || '').toLowerCase().trim();
  const filtered = erpBatchesData.filter(b => 
    !query || 
    b.id.toLowerCase().includes(query) || 
    b.product_name.toLowerCase().includes(query) || 
    b.bom_no.toLowerCase().includes(query) ||
    b.floor.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-10 text-slate-400">
          <i class="ph ph-magnifying-glass text-2xl mb-1 block"></i>
          <span>No ERP Work Orders matched your search query.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((batch, index) => `
    <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
      <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${index + 1}</td>
      <td class="py-3 px-3.5 font-mono font-bold text-cyan-600 dark:text-cyan-400">${batch.id}</td>
      <td class="py-3 px-3.5">
        <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(batch.product_name)}</div>
        <div class="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
          <span>${batch.bom_no}</span>
          ${batch.item_code ? `<span>• ${batch.item_code}</span>` : ''}
        </div>
      </td>
      <td class="py-3 px-3.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
        ${batch.order_qty.toLocaleString()} Pcs
      </td>
      <td class="py-3 px-3.5 text-center">
        ${batch.is_staged 
          ? `<span class="glass-pill glass-pill-emerald text-[10px] font-bold py-0.5 px-2 inline-flex items-center gap-1">
               <i class="ph-bold ph-check-circle text-emerald-500"></i>
               <span>100% STAGED</span>
             </span>`
          : `<span class="glass-pill glass-pill-rose text-[10px] font-bold py-0.5 px-2 inline-flex items-center gap-1">
               <i class="ph-bold ph-warning text-rose-500"></i>
               <span>DEFICIT (Cap: ${batch.max_cap.toLocaleString()})</span>
             </span>`
        }
      </td>
      <td class="py-3 px-3.5 text-slate-600 dark:text-slate-400 font-medium">
        <div class="flex items-center gap-1.5">
          <i class="ph ph-factory text-slate-400"></i>
          <span>${escapeHtml(batch.floor)}</span>
        </div>
      </td>
      <td class="py-3 px-3.5 font-mono text-slate-500 text-xs">${batch.date}</td>
      <td class="py-3 px-3.5 text-center">
        <button onclick="openAnalysisModal('${batch.bom_no}')" class="btn-glass-secondary px-2.5 py-1 text-xs rounded-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mx-auto" title="Inspect BOM Details">
          <i class="ph ph-eye text-xs"></i>
          <span>Inspect</span>
        </button>
      </td>
    </tr>
  `).join('');
}

let sfgStockData = [];

function renderSfgStock() {
  const tbody = document.getElementById('sfg-stock-table-body');
  if (!tbody) return;

  if (!sfgStockData || sfgStockData.length === 0) {
    sfgStockData = [
      { sfg: 'SFG-STAT-56A', desc: 'Ceiling Fan 56" Stator Winding & Lead Assembly', bom: 'BOM-CF-56-01', stage: 'CNC Coil Winding & Varnishing', qty: 3450, buffer: 'Floor 1 • Buffer Bay A1', qc: '100% QC PASS', type: 'emerald' },
      { sfg: 'SFG-ROTR-56A', desc: 'Ceiling Fan 56" High-Speed Rotor Dynamic Balanced', bom: 'BOM-CF-56-01', stage: 'Dynamic Balancing & Truing', qty: 2890, buffer: 'Floor 1 • Buffer Bay B2', qc: '100% QC PASS', type: 'emerald' },
      { sfg: 'SFG-BLDC-INV', desc: 'BLDC Inverter Motor Stator & Smart Potting Module', bom: 'BOM-CF-BLDC-02', stage: 'Polymer Potting & Stator Test', qty: 1850, buffer: 'Floor 1 • Motor Lab Buffer', qc: '100% QC PASS', type: 'emerald' },
      { sfg: 'SFG-BLAD-18S', desc: 'Deluxe Stand Fan 18" Blade Set (Pressed & Coated)', bom: 'BOM-SF-18-04', stage: 'Powder Coating & Balance Test', qty: 4200, buffer: 'Floor 2 • Coating Buffer C3', qc: '100% QC PASS', type: 'emerald' },
      { sfg: 'SFG-BODY-TF16', desc: 'Table Fan 16" Breeze Stator & Gearbox Sub-Assembly', bom: 'BOM-TF-16-03', stage: 'Oscillation Gearbox Assembly', qty: 2100, buffer: 'Floor 2 • Sub-Assembly Buffer', qc: '100% QC PASS', type: 'emerald' },
      { sfg: 'SFG-EXH-18IND', desc: 'Industrial Heavy Duty Exhaust 18" Housing & Shroud', bom: 'BOM-EX-18-06', stage: 'Metal Forming & Anti-Rust Dip', qty: 950, buffer: 'Floor 3 • Heavy Fab Bay H1', qc: '100% QC PASS', type: 'emerald' }
    ];
  }

  filterSfgStock();
}

function filterSfgStock() {
  const tbody = document.getElementById('sfg-stock-table-body');
  if (!tbody) return;

  const query = (document.getElementById('search-sfg-stock')?.value || '').toLowerCase().trim();
  const filtered = sfgStockData.filter(s => 
    !query || 
    s.sfg.toLowerCase().includes(query) || 
    s.desc.toLowerCase().includes(query) || 
    s.bom.toLowerCase().includes(query) || 
    s.stage.toLowerCase().includes(query) || 
    s.buffer.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-10 text-slate-400">
          <i class="ph ph-magnifying-glass text-2xl mb-1 block"></i>
          <span>No SFG Buffer Assemblies matched your search query.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => `
    <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
      <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
      <td class="py-3 px-3.5 font-mono font-bold text-cyan-600 dark:text-cyan-400">${item.sfg}</td>
      <td class="py-3 px-3.5">
        <div class="font-bold text-slate-900 dark:text-white">${escapeHtml(item.desc)}</div>
      </td>
      <td class="py-3 px-3.5 font-mono text-xs font-bold text-slate-500">
        ${escapeHtml(item.bom)}
      </td>
      <td class="py-3 px-3.5">
        <span class="glass-pill glass-pill-cyan text-[10px] font-bold py-0.5 px-2">
          ${escapeHtml(item.stage)}
        </span>
      </td>
      <td class="py-3 px-3.5 text-center font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
        ${item.qty.toLocaleString()} Pcs
      </td>
      <td class="py-3 px-3.5 font-medium text-slate-600 dark:text-slate-400 text-xs">
        <div class="flex items-center gap-1.5">
          <i class="ph ph-map-pin text-slate-400"></i>
          <span>${escapeHtml(item.buffer)}</span>
        </div>
      </td>
      <td class="py-3 px-3.5 text-center">
        <span class="glass-pill glass-pill-emerald text-[10px] font-bold py-0.5 px-2.5 inline-flex items-center gap-1.5 shadow-2xs">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)] animate-pulse"></span>
          <span>${item.qc}</span>
        </span>
      </td>
      <td class="py-3 px-3.5 text-center">
        <button onclick="showToast('Dispatching SFG: ${item.sfg} to Assembly Line')" class="btn-glass-secondary px-2.5 py-1 text-xs rounded-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mx-auto" title="Dispatch to Final Assembly">
          <i class="ph ph-arrow-circle-right text-xs"></i>
          <span>Dispatch</span>
        </button>
      </td>
    </tr>
  `).join('');
}

function renderOEE() {
  const tbody = document.getElementById('oee-table-body');
  if (!tbody) return;

  const oeeLines = [
    { id: 'LINE-01', station: 'Floor 1 • Ceiling Fan 56" High-Speed Line', a: 97.5, p: 96.0, q: 99.5, loss: 'Changeover (5 mins)' },
    { id: 'LINE-02', station: 'Floor 1 • Smart Inverter Motor Potting Station', a: 98.0, p: 94.5, q: 99.8, loss: 'Potting Resin Curing Wait' },
    { id: 'LINE-03', station: 'Floor 2 • Table & Stand Fan Stator Station', a: 96.2, p: 95.8, q: 99.2, loss: 'Wire Reel Replenishment' },
    { id: 'LINE-04', station: 'Floor 2 • Aero Blade Stamping & Dynamic Balance', a: 95.0, p: 96.5, q: 99.1, loss: 'Die Inspection & Cleaning' },
    { id: 'LINE-05', station: 'Floor 3 • High-Voltage Test & Packaging Station', a: 98.5, p: 97.0, q: 99.6, loss: 'Barcode Label Roll Feed' },
    { id: 'LINE-06', station: 'Floor 3 • Industrial Ventilation & Exhaust Line', a: 95.5, p: 93.0, q: 99.0, loss: 'Motor Housing Clamping Truing' }
  ];

  tbody.innerHTML = oeeLines.map((line, idx) => {
    const oee = ((line.a * line.p * line.q) / 10000).toFixed(1);
    let rating = 'WORLD CLASS';
    let badgeClass = 'glass-pill-emerald';
    if (parseFloat(oee) < 85) {
      rating = 'NEEDS ATTENTION';
      badgeClass = 'glass-pill-amber';
    }

    return `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
        <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-3 px-3.5 font-mono font-black text-amber-600 dark:text-amber-400">${line.id}</td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <i class="ph-bold ph-lightning text-amber-500"></i>
            <span>${escapeHtml(line.station)}</span>
          </div>
        </td>
        <td class="py-3 px-3.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
          ${line.a}%
        </td>
        <td class="py-3 px-3.5 text-center font-mono font-bold text-cyan-600 dark:text-cyan-400">
          ${line.p}%
        </td>
        <td class="py-3 px-3.5 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
          ${line.q}%
        </td>
        <td class="py-3 px-3.5 text-center font-mono font-extrabold text-amber-600 dark:text-amber-400 text-sm">
          ${oee}%
        </td>
        <td class="py-3 px-3.5 text-center">
          <span class="glass-pill ${badgeClass} text-[10px] font-bold py-0.5 px-2.5 inline-flex items-center gap-1 shadow-2xs">
            <i class="ph-bold ph-seal-check"></i>
            <span>${rating}</span>
          </span>
        </td>
        <td class="py-3 px-3.5 font-medium text-slate-600 dark:text-slate-400 text-xs">
          ${escapeHtml(line.loss)}
        </td>
      </tr>
    `;
  }).join('');
}

let interCompanyData = [];

function renderInterCompany() {
  const tbody = document.getElementById('inter-company-table-body');
  if (!tbody) return;

  if (!interCompanyData || interCompanyData.length === 0) {
    interCompanyData = [
      { id: 'ICT-2026-0412', from: 'MEP Fan Ltd (Barisal Plant)', to: 'MEP Cable & Wire Ltd', item: 'Super Enameled Copper Wire 0.35mm (Grade 2)', qty: '2,500 Kg', status: 'IN TRANSIT', statusType: 'amber', date: '2026-08-29' },
      { id: 'ICT-2026-0413', from: 'Central Bulk Warehouse (Dhaka)', to: 'MEP Fan Ltd (Barisal Plant)', item: 'Ball Bearing 6202-2RS Deep Groove (C3)', qty: '10,000 Pcs', status: 'RECEIVED', statusType: 'emerald', date: '2026-08-28' },
      { id: 'ICT-2026-0414', from: 'MEP Plastic Industries', to: 'MEP Fan Ltd (Barisal Plant)', item: 'Ceiling Fan Canopy Top & Bottom Set (ABS)', qty: '4,500 Sets', status: 'RECEIVED', statusType: 'emerald', date: '2026-08-28' },
      { id: 'ICT-2026-0415', from: 'MEP Fan Ltd (Barisal Plant)', to: 'MEP Electronics Ltd', item: 'Capacitor 3.5µF 450VAC Metallized Poly', qty: '3,000 Pcs', status: 'IN TRANSIT', statusType: 'amber', date: '2026-08-27' },
      { id: 'ICT-2026-0416', from: 'MEP Cable & Wire Ltd', to: 'MEP Fan Ltd (Barisal Plant)', item: 'PVC Insulated Lead Wire 0.75 sq.mm Red/Black', qty: '15,000 Mtr', status: 'RECEIVED', statusType: 'emerald', date: '2026-08-26' },
      { id: 'ICT-2026-0417', from: 'Central Bulk Warehouse (Dhaka)', to: 'MEP Fan Ltd (Barisal Plant)', item: 'Silicon Steel Sheet (Stator Core Stamping M-47)', qty: '8,200 Kg', status: 'IN TRANSIT', statusType: 'amber', date: '2026-08-25' },
      { id: 'ICT-2026-0418', from: 'MEP Fan Ltd (Barisal Plant)', to: 'MEP Plastic Industries', item: 'Masterbatch Polypropylene White Pigment', qty: '1,200 Kg', status: 'RECONCILED', statusType: 'indigo', date: '2026-08-24' }
    ];
  }

  filterInterCompanyTransfers();
}

function filterInterCompanyTransfers() {
  const tbody = document.getElementById('inter-company-table-body');
  if (!tbody) return;

  const query = (document.getElementById('search-inter-company')?.value || '').toLowerCase().trim();
  const filtered = interCompanyData.filter(t => 
    !query || 
    t.id.toLowerCase().includes(query) || 
    t.from.toLowerCase().includes(query) || 
    t.to.toLowerCase().includes(query) || 
    t.item.toLowerCase().includes(query) || 
    t.status.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="text-center py-10 text-slate-400">
          <i class="ph ph-magnifying-glass text-2xl mb-1 block"></i>
          <span>No Inter-Company Transfer Vouchers matched your search query.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((item, idx) => {
    let pillClass = 'glass-pill-amber';
    let iconClass = 'ph-clock';
    if (item.status === 'RECEIVED') {
      pillClass = 'glass-pill-emerald';
      iconClass = 'ph-check-circle';
    } else if (item.status === 'RECONCILED') {
      pillClass = 'glass-pill-cyan';
      iconClass = 'ph-scales';
    }

    return `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-dark-800/60 transition-colors">
        <td class="py-3 px-3 text-center font-mono text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-3 px-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">${item.id}</td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <i class="ph ph-building text-slate-400"></i>
            <span>${escapeHtml(item.from)}</span>
          </div>
        </td>
        <td class="py-3 px-3.5">
          <div class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <i class="ph ph-arrow-right text-emerald-500"></i>
            <span>${escapeHtml(item.to)}</span>
          </div>
        </td>
        <td class="py-3 px-3.5">
          <div class="font-semibold text-slate-900 dark:text-white">${escapeHtml(item.item)}</div>
        </td>
        <td class="py-3 px-3.5 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
          ${item.qty}
        </td>
        <td class="py-3 px-3.5 text-center">
          <span class="glass-pill ${pillClass} text-[10px] font-bold py-0.5 px-2.5 inline-flex items-center gap-1.5 shadow-2xs">
            <i class="ph-bold ${iconClass}"></i>
            <span>${item.status}</span>
          </span>
        </td>
        <td class="py-3 px-3.5 font-mono text-slate-500 text-xs">${item.date}</td>
        <td class="py-3 px-3.5 text-center">
          <button onclick="showToast('Viewing Challan: ${item.id}')" class="btn-glass-secondary px-2.5 py-1 text-xs rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-1 mx-auto" title="View Transfer Details">
            <i class="ph ph-receipt text-xs"></i>
            <span>Challan</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  if (!sidebar) return;
  isMobileSidebarOpen = !isMobileSidebarOpen;
  sidebar.classList.toggle('mobile-open', isMobileSidebarOpen);
}

// -------------------------------------------------------------
// 2. Data Fetching & Dashboard KPIs
// -------------------------------------------------------------
async function loadAllData() {
  await Promise.all([
    fetchStats(),
    fetchBOMs(),
    fetchRawMaterials(),
    fetchPhysicalEntrySheet(),
    fetchPhysicalMatrix('body'),
    fetchPhysicalMatrix('blade')
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

    // Prominent Last sync header label in 12-Hour AM/PM format
    const syncTimeEl = document.getElementById('last-sync-time-text');
    if (syncTimeEl) {
      const rawSyncTime = stats.last_sync && stats.last_sync.sync_time 
        ? stats.last_sync.sync_time 
        : '';
      const formattedTime = formatTime12Hour(rawSyncTime);
      syncTimeEl.textContent = `Live Sync: ${formattedTime} • ${totalBomsCount} BOMs`;
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
  updateLiquidSegmentedPill(val);
  currentPage = 1;
  applyFilters();
}

function updateLiquidSegmentedPill(val) {
  const container = document.getElementById('feasibility-segmented-wrap');
  const pill = document.getElementById('seg-liquid-pill');
  const segAll = document.getElementById('seg-all');
  const segReady = document.getElementById('seg-ready');
  const segBlocked = document.getElementById('seg-blocked');

  if (!container || !pill) return;

  let activeBtn = segAll;
  let pillClass = 'seg-liquid-all';

  if (val === 'can_produce') {
    activeBtn = segReady;
    pillClass = 'seg-liquid-ready';
  } else if (val === 'blocked') {
    activeBtn = segBlocked;
    pillClass = 'seg-liquid-blocked';
  }

  // Remove active text classes from all buttons
  [segAll, segReady, segBlocked].forEach(btn => {
    if (btn) btn.classList.remove('active-all', 'active-ready', 'active-blocked');
  });

  if (activeBtn) {
    if (val === 'can_produce') activeBtn.classList.add('active-ready');
    else if (val === 'blocked') activeBtn.classList.add('active-blocked');
    else activeBtn.classList.add('active-all');

    // Calculate exact pixel position and width for liquid gliding transition
    const containerRect = container.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    const leftOffset = btnRect.left - containerRect.left;
    const width = btnRect.width;

    pill.style.transform = `translateX(${leftOffset}px)`;
    pill.style.width = `${width}px`;
    pill.className = `seg-liquid-indicator ${pillClass}`;
  }
}

window.addEventListener('resize', () => {
  updateLiquidSegmentedPill(currentFeasibilitySegment);
});

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

function toggleSettingsDock(e) {
  if (e) e.stopPropagation();
  const dock = document.getElementById('settings-dock-container');
  if (dock) dock.classList.toggle('dock-open');
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

  const dock = document.getElementById('settings-dock-container');
  if (dock && !dock.contains(e.target) && dock.classList.contains('dock-open')) {
    dock.classList.remove('dock-open');
  }
});

function renderFilterChips(q, sec, feas) {
  const container = document.getElementById('filter-chips-container');
  if (!container) return;
  container.innerHTML = '';

  if (q) {
    const chip = document.createElement('span');
    chip.className = 'luxury-filter-chip luxury-chip-cyan';
    chip.innerHTML = `
      <i class="ph-bold ph-magnifying-glass text-[11px] text-cyan-600 dark:text-cyan-400"></i>
      <span>Query: "${escapeHtml(q)}"</span>
      <button onclick="clearSearch()" class="luxury-chip-close" title="Clear Search Filter">✕</button>
    `;
    container.appendChild(chip);
  }

  if (sec) {
    const chip = document.createElement('span');
    chip.className = 'luxury-filter-chip luxury-chip-indigo';
    chip.innerHTML = `
      <i class="ph-bold ph-buildings text-[11px] text-indigo-600 dark:text-indigo-400"></i>
      <span>Floor: ${escapeHtml(sec)}</span>
      <button onclick="clearSectionFilter()" class="luxury-chip-close" title="Clear Floor Filter">✕</button>
    `;
    container.appendChild(chip);
  }

  if (feas) {
    const chip = document.createElement('span');
    const isReady = feas === 'can_produce';
    chip.className = `luxury-filter-chip ${isReady ? 'luxury-chip-emerald' : 'luxury-chip-rose'}`;
    chip.innerHTML = `
      <span class="w-2 h-2 rounded-full ${isReady ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]'} shrink-0"></span>
      <span>Status: ${isReady ? 'Ready to Build' : 'Capacity Blocked'}</span>
      <button onclick="setFeasibilitySegment('')" class="luxury-chip-close" title="Clear Status Filter">✕</button>
    `;
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

  // Master Factory MES Priority Sorting
  // Rank 1: SFG1010079 (5601 Complete Body Ivory) at Serial #1
  // Rank 2: Key 8 Complete Body Formulations (5607, 4801, 5603, 3601, 2401, 5602, 5606, 5601 White) -> Serials #2 - #9
  // Rank 3: Finished Ceiling Fan Assemblies (CF5601, CF5602, CF5603, CF4801, CF3601, CF2401, CF5607, CF5606...) -> Serials #10+
  // Rank 4: All other Sub-BOMs & Component Parts by Raw Material count
  const mainCompleteBodies = [
    'sfg1010135', // 5607 Crown Complete Body
    'sfg1010078', // 4801 Popular Complete Body
    'sfg1010097', // 5603 Premium Gold Complete Body
    'sfg1010077', // 3601 Hero Complete Body
    'sfg1010076', // 2401 Super Complete Body
    'sfg1010080', // 5602 Speed King Complete Body
    'sfg1010140', // 5606 Premium Plus Complete Body
    'sfg1010111', // 5601 White Complete Body
  ];

  const finishedFanOrder = ['cf5601', 'cf5602', 'cf5603', 'cf4801', 'cf3601', 'cf2401', 'cf5607', 'cf5606'];

  function getBOMPriority(b) {
    const name = (b.product_name || '').toLowerCase();
    const code = (b.item_code || '').toUpperCase();
    const no = String(b.bom_no || '');
    const rms = (b.raw_materials || []).length;

    // Rank 1: 5601 Complete Body Ivory
    if (code === 'SFG1010079' || no === '23090063' || name.includes('sfg1010079')) {
      return { rank: 1, subIndex: 0, rms };
    }

    // Rank 2: 8 Standard Complete Body Models (#2 to #9)
    for (let i = 0; i < mainCompleteBodies.length; i++) {
      if (code.includes(mainCompleteBodies[i].toUpperCase()) || name.includes(mainCompleteBodies[i])) {
        return { rank: 2, subIndex: i, rms };
      }
    }

    // Rank 3: Finished Goods Final Assembly Fans (Starts right at serial #10!)
    const isFinishedFan = (
      code.startsWith('CF56') || code.startsWith('CF48') || code.startsWith('CF36') || code.startsWith('CF24') ||
      code.startsWith('CR56') || code.startsWith('CR48') || code.startsWith('CR36') || code.startsWith('CG56') ||
      name.includes('ceiling fan - ivory') || name.includes('ceiling fan- ivory') || name.includes('celling fan')
    ) && !name.includes('blade') && !name.includes('down pipe') && !name.includes('canopy') && !name.includes('capacitor') && !name.includes('motor') && !name.includes('complete body');

    if (isFinishedFan) {
      let subIdx = 99;
      for (let i = 0; i < finishedFanOrder.length; i++) {
        if (code.toLowerCase().includes(finishedFanOrder[i]) || name.includes(finishedFanOrder[i])) {
          subIdx = i;
          break;
        }
      }
      return { rank: 3, subIndex: subIdx, rms };
    }

    // Rank 4: Other Complete Body variations
    if (name.includes('complete body')) {
      return { rank: 4, subIndex: 0, rms };
    }

    // Rank 5: Remaining Sub-BOMs
    return { rank: 5, subIndex: 0, rms };
  }

  if (sort === 'rms_desc') {
    filteredBOMs.sort((a, b) => {
      const pA = getBOMPriority(a);
      const pB = getBOMPriority(b);

      if (pA.rank !== pB.rank) return pA.rank - pB.rank;
      if (pA.subIndex !== pB.subIndex) return pA.subIndex - pB.subIndex;
      if (pB.rms !== pA.rms) return pB.rms - pA.rms;
      return (a.product_name || '').localeCompare(b.product_name || '');
    });
  } else if (sort === 'rms_asc') {
    filteredBOMs.sort((a, b) => {
      const pA = getBOMPriority(a);
      const pB = getBOMPriority(b);

      if (pA.rank !== pB.rank) return pA.rank - pB.rank;
      if (pA.subIndex !== pB.subIndex) return pA.subIndex - pB.subIndex;
      if (pA.rms !== pB.rms) return pA.rms - pB.rms;
      return (a.product_name || '').localeCompare(b.product_name || '');
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

    // LUXURY GRADIENT GLASS BUILD CAPACITY PILL
    let capacityWidget = '';
    if (canProduce && maxUnits > 0) {
      capacityWidget = `
        <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold gradient-glass-emerald whitespace-nowrap" title="${maxUnits.toLocaleString()} Units can be produced immediately (Sufficient Warehouse Stock)">
          <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
          <span class="font-bold font-mono tracking-tight text-emerald-950 dark:text-emerald-100">${maxUnits.toLocaleString()} Units</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full tag-badge-emerald uppercase tracking-wider font-extrabold">Ready</span>
        </span>
      `;
    } else {
      const bName = b.bottleneck_name ? escapeHtml(b.bottleneck_name) : 'Raw Material Shortage';
      capacityWidget = `
        <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold gradient-glass-rose whitespace-nowrap" title="Blocked by component shortage: ${bName}">
          <span class="w-2 h-2 rounded-full bg-rose-500 shrink-0"></span>
          <span class="font-bold font-mono tracking-tight text-rose-950 dark:text-rose-100">0 Units</span>
          <span class="text-[10px] px-2 py-0.5 rounded-full tag-badge-rose uppercase tracking-wider font-extrabold">Blocked</span>
        </span>
      `;
    }

    const cleanName = getCleanProductName(b.product_name, b.item_code);
    const isPremium = isPremiumFanModel(b);
    const is3601 = is3601Model(b);
    const is5602 = is5602Model(b);
    const is4801 = is4801Model(b);
    const is2401 = is2401Model(b);
    const is5607 = is5607Model(b);

    let productTitleHtml = '';
    if (isPremium) {
      productTitleHtml = `
        <div class="product-name-premium">
          <i class="ph-fill ph-crown text-amber-500 text-sm shrink-0"></i>
          <span>${escapeHtml(cleanName)}</span>
        </div>
      `;
    } else if (is3601) {
      productTitleHtml = `
        <div class="product-name-3601">
          <i class="ph-fill ph-star icon-gold text-sm shrink-0"></i>
          <span>${escapeHtml(cleanName)}</span>
        </div>
      `;
    } else if (is5602) {
      productTitleHtml = `
        <div class="product-name-5602">
          <i class="ph-fill ph-leaf icon-green text-sm shrink-0"></i>
          <span>${escapeHtml(cleanName)}</span>
        </div>
      `;
    } else if (is4801) {
      productTitleHtml = `
        <div class="product-name-4801">
          <i class="ph-fill ph-fire icon-red text-sm shrink-0"></i>
          <span>${escapeHtml(cleanName)}</span>
        </div>
      `;
    } else if (is2401) {
      productTitleHtml = `
        <div class="product-name-2401">
          <i class="ph-fill ph-sparkle icon-pink text-sm shrink-0"></i>
          <span>${escapeHtml(cleanName)}</span>
        </div>
      `;
    } else if (is5607) {
      productTitleHtml = `
        <div class="product-name-5607">
          <i class="ph-fill ph-crown-simple icon-brown text-sm shrink-0"></i>
          <span>${escapeHtml(cleanName)}</span>
        </div>
      `;
    } else {
      productTitleHtml = `
        <div class="font-bold text-slate-900 dark:text-white">
          ${escapeHtml(cleanName)}
        </div>
      `;
    }

    row.innerHTML = `
      <td class="py-4 px-3 text-center text-xs text-slate-400 font-mono">${startIdx + idx + 1}</td>
      <td class="py-4 px-4 whitespace-nowrap">
        <span class="gradient-glass-bom">${escapeHtml(b.bom_no)}</span>
      </td>
      <td class="py-4 px-4">
        ${productTitleHtml}
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
// 5. Mobile Sidebar Toggle Helper
// -------------------------------------------------------------

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
  if (prodNameEl) {
    const cleanName = getCleanProductName(bom.product_name, bom.item_code);
    if (isPremiumFanModel(bom)) {
      prodNameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold">
          <i class="ph-fill ph-crown text-amber-500 text-lg"></i>
          <span>${escapeHtml(cleanName)}</span>
        </span>
      `;
    } else if (is3601Model(bom)) {
      prodNameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
          <i class="ph-fill ph-star text-amber-500 text-lg"></i>
          <span>${escapeHtml(cleanName)}</span>
        </span>
      `;
    } else if (is5602Model(bom)) {
      prodNameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
          <i class="ph-fill ph-leaf text-emerald-500 text-lg"></i>
          <span>${escapeHtml(cleanName)}</span>
        </span>
      `;
    } else if (is4801Model(bom)) {
      prodNameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
          <i class="ph-fill ph-fire text-rose-500 text-lg"></i>
          <span>${escapeHtml(cleanName)}</span>
        </span>
      `;
    } else if (is2401Model(bom)) {
      prodNameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 text-pink-600 dark:text-pink-400 font-bold">
          <i class="ph-fill ph-sparkle text-pink-500 text-lg"></i>
          <span>${escapeHtml(cleanName)}</span>
        </span>
      `;
    } else if (is5607Model(bom)) {
      prodNameEl.innerHTML = `
        <span class="inline-flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold">
          <i class="ph-fill ph-crown-simple text-amber-700 text-lg"></i>
          <span>${escapeHtml(cleanName)}</span>
        </span>
      `;
    } else {
      prodNameEl.textContent = cleanName;
    }
  }

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
  const maxBuildableCard = document.getElementById('modal-max-buildable-card');
  const maxBuildableIcon = document.getElementById('modal-max-buildable-icon');
  const maxBuildableIconBox = document.getElementById('modal-max-buildable-icon-box');
  const maxBuildableLabel = document.getElementById('modal-max-buildable-label');

  const maxUnits = bom.max_buildable_units || 0;
  const canProduce = bom.can_produce;
  if (maxBuildableEl) {
    if (canProduce && maxUnits > 0) {
      maxBuildableEl.className = 'text-emerald-950 dark:text-emerald-100 font-mono text-base font-black mt-1 block';
      maxBuildableEl.textContent = `${maxUnits.toLocaleString()} Units`;
      if (maxBuildableCard) maxBuildableCard.className = 'glass-stat-card glass-stat-emerald p-3 px-3.5';
      if (maxBuildableLabel) maxBuildableLabel.className = 'text-[10px] uppercase font-bold tracking-wider text-emerald-900 dark:text-emerald-300';
      if (maxBuildableIconBox) maxBuildableIconBox.className = 'w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-xs flex items-center justify-center text-xs';
      if (maxBuildableIcon) maxBuildableIcon.className = 'ph-bold ph-trend-up';
    } else {
      maxBuildableEl.className = 'text-rose-950 dark:text-rose-100 font-mono text-base font-black mt-1 block';
      maxBuildableEl.textContent = `0 Units`;
      if (maxBuildableCard) maxBuildableCard.className = 'glass-stat-card glass-stat-rose p-3 px-3.5';
      if (maxBuildableLabel) maxBuildableLabel.className = 'text-[10px] uppercase font-bold tracking-wider text-rose-900 dark:text-rose-300';
      if (maxBuildableIconBox) maxBuildableIconBox.className = 'w-7 h-7 rounded-lg bg-gradient-to-tr from-rose-500 to-red-500 text-white shadow-xs flex items-center justify-center text-xs';
      if (maxBuildableIcon) maxBuildableIcon.className = 'ph-bold ph-prohibit';
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
    modal.classList.remove('hidden', 'modal-animate-exit');
    modal.classList.add('modal-animate-enter');
    const tableContainer = modal.querySelector('.overflow-y-auto');
    if (tableContainer) tableContainer.scrollTop = 0;
  }
}

function closeAnalysisModal() {
  const modal = document.getElementById('analysis-modal');
  if (!modal) return;

  modal.classList.remove('modal-animate-enter');
  modal.classList.add('modal-animate-exit');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('modal-animate-exit');
  }, 190);

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

  // Update Target Card Accent / Class
  const targetCard = document.getElementById('modal-target-card');
  if (targetCard) {
    if (modalTargetQty > 0 && shortageCount > 0) {
      targetCard.className = 'glass-stat-card glass-stat-rose p-3 px-3.5 flex flex-col justify-between';
    } else if (modalTargetQty > 0 && shortageCount === 0) {
      targetCard.className = 'glass-stat-card glass-stat-emerald p-3 px-3.5 flex flex-col justify-between';
    } else {
      targetCard.className = 'glass-stat-card glass-stat-amber p-3 px-3.5 flex flex-col justify-between';
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
    tbody.innerHTML = `<tr><td colspan="13" class="text-center py-8 text-slate-400">No active raw materials found in formula.</td></tr>`;
    return;
  }

  // Calculate overall minimum possible build from available stock (the bottleneck value)
  let minPossibleBuild = 999999999;
  rms.forEach(rm => {
    const reqPerUnit = parseFloat(rm.quantity || rm.quantity_str) || 0;
    const stStore = rm.store_qty !== undefined ? parseFloat(rm.store_qty) : 0;
    const stSec = rm.section_qty !== undefined ? parseFloat(rm.section_qty) : 0;
    const stAvail = rm.available_stock !== undefined ? parseFloat(rm.available_stock) : (stStore + stSec);
    if (reqPerUnit > 0) {
      const p = Math.floor(stAvail / reqPerUnit);
      if (p < minPossibleBuild) {
        minPossibleBuild = p;
      }
    }
  });
  if (minPossibleBuild === 999999999) minPossibleBuild = 0;

  let displayedRows = 0;
  const fragment = document.createDocumentFragment();

  rms.forEach((rm, i) => {
    const reqPerUnit = parseFloat(rm.quantity || rm.quantity_str) || 0;
    const batchReq = reqPerUnit * modalTargetQty;
    const stStore = rm.store_qty !== undefined ? parseFloat(rm.store_qty) : 0;
    const stSec = rm.section_qty !== undefined ? parseFloat(rm.section_qty) : 0;
    const stAvail = rm.available_stock !== undefined ? parseFloat(rm.available_stock) : (stStore + stSec);
    const poss = reqPerUnit > 0 ? Math.floor(stAvail / reqPerUnit) : 999999;

    const shortage = Math.max(0, batchReq - stAvail);
    const isTargetShortage = modalTargetQty > 0 && shortage > 0;

    // 1. Red Blocked: 0 stock / insufficient for even 1 unit
    const isZeroBlocked = (stAvail < reqPerUnit || poss === 0);

    // 2. Deep Orange Bottleneck: Limits BOM to minPossibleBuild (e.g. 26 units) and blocks unit 27
    const isBottleneck = (minPossibleBuild > 0 && poss === minPossibleBuild);

    // Filter by shortage toggle
    if (modalOnlyShortages && !isTargetShortage && !isZeroBlocked) return;

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
    let trClass = 'transition-none hover:bg-slate-500/[0.02] dark:hover:bg-white/[0.02]';
    if (isTargetShortage) {
      trClass = 'bg-rose-500/[0.08] dark:bg-rose-500/[0.14] border-l-4 border-l-rose-500 font-medium transition-none';
    } else if (isZeroBlocked) {
      trClass = 'row-blocked-zero font-medium transition-none';
    } else if (isBottleneck) {
      trClass = 'row-bottleneck-limit font-medium transition-none';
    }
    tr.className = trClass;

    let shortageBadge = '';
    if (isTargetShortage) {
      shortageBadge = `
        <div class="inline-flex items-center whitespace-nowrap gap-1.5 px-2.5 py-0.5 rounded-full gradient-glass-rose shadow-2xs select-none">
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          <span class="text-[11px] font-extrabold tracking-tight whitespace-nowrap">Shortage</span>
        </div>
      `;
    } else if (isZeroBlocked) {
      shortageBadge = `
        <span class="badge-blocked-zero select-none whitespace-nowrap">
          <i class="ph-bold ph-x-circle text-xs shrink-0"></i>
          <span class="whitespace-nowrap">0 Stock</span>
        </span>
      `;
    } else if (isBottleneck) {
      shortageBadge = `
        <span class="badge-bottleneck-orange select-none whitespace-nowrap">
          <i class="ph-bold ph-lightning text-xs shrink-0"></i>
          <span class="whitespace-nowrap">Max ${poss}</span>
        </span>
      `;
    } else {
      shortageBadge = `
        <div class="inline-flex items-center whitespace-nowrap gap-1.5 px-2.5 py-0.5 rounded-full gradient-glass-emerald shadow-2xs select-none">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
          <span class="text-[11px] font-extrabold tracking-tight whitespace-nowrap">Ready</span>
        </div>
      `;
    }

    const shortageQtyDisplay = isTargetShortage
      ? `<span class="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs whitespace-nowrap">+${formatQty(shortage)} ${escapeHtml(rm.unit || '')}</span>`
      : `<span class="text-slate-400 font-mono text-[11px] whitespace-nowrap">0</span>`;

    let possDisplay = '';
    if (isZeroBlocked) {
      possDisplay = `<span class="text-rose-600 dark:text-rose-400 font-mono font-extrabold text-xs whitespace-nowrap">0</span>`;
    } else if (isBottleneck) {
      possDisplay = `<span class="text-orange-600 dark:text-orange-400 font-mono font-extrabold text-xs whitespace-nowrap">${poss.toLocaleString()}</span>`;
    } else if (poss >= 999999) {
      possDisplay = `<span class="text-emerald-700 dark:text-emerald-300 font-mono font-extrabold text-xs whitespace-nowrap">∞</span>`;
    } else {
      possDisplay = `<span class="text-emerald-700 dark:text-emerald-300 font-mono font-extrabold text-xs whitespace-nowrap">${poss.toLocaleString()}</span>`;
    }

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
      categoryHtml = `<span class="glass-pill glass-pill-primary text-[10px] font-bold font-mono py-0.5 px-1.5 inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 whitespace-nowrap"><i class="ph-bold ph-tree-structure"></i> ${escapeHtml(rm.category || 'FAN SFG')}</span>`;
    } else {
      categoryHtml = `<span class="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[100px] font-medium block whitespace-nowrap">${escapeHtml(rm.category || '--')}</span>`;
    }

    let descHtml = '';
    let codeHtml = '';

    if (matchingBOM) {
      const canBuildSub = matchingBOM.max_buildable_units || 0;
      const inHouseBadge = canBuildSub > 0
        ? `<button type="button" onclick="openAnalysisModal('${matchingBOM.bom_no}', true)" class="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold font-mono border border-emerald-500/25 hover:bg-emerald-500/20 cursor-pointer whitespace-nowrap" title="In-House Production Capacity from Raw Materials"><i class="ph-bold ph-wrench text-[10px]"></i> In-House Buildable: ${canBuildSub.toLocaleString()} Units</button>`
        : `<span class="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold font-mono border border-rose-500/25 whitespace-nowrap"><i class="ph-bold ph-warning text-[10px]"></i> In-House: 0 Units</span>`;

      let titleColorClass = 'text-emerald-600 dark:text-emerald-400';
      if (isZeroBlocked) titleColorClass = 'text-blocked-red';
      else if (isBottleneck) titleColorClass = 'text-bottleneck-orange';

      descHtml = `
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="openAnalysisModal('${matchingBOM.bom_no}', true)" class="group text-left inline-flex items-center gap-1.5 cursor-pointer select-none" title="Direct Access: Inspect Sub-Assembly BOM #${matchingBOM.bom_no} (${escapeHtml(matchingBOM.product_name)})">
              <span class="font-bold text-xs ${titleColorClass} group-hover:underline underline-offset-2">${escapeHtml(rm.item_description || '--')}</span>
              <span class="glass-pill glass-pill-emerald text-[9px] font-bold font-mono py-0.5 px-1.5 inline-flex items-center gap-1 shrink-0 shadow-2xs whitespace-nowrap">
                <i class="ph-bold ph-arrow-up-right text-[10px]"></i> Sub-BOM
              </span>
            </button>
          </div>
          <div>${inHouseBadge}</div>
        </div>
      `;
      codeHtml = `
        <button type="button" onclick="openAnalysisModal('${matchingBOM.bom_no}', true)" class="font-mono font-bold text-xs ${titleColorClass} hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap" title="Direct Access: BOM #${matchingBOM.bom_no}">
          <span>${escapeHtml(rm.item_code || '--')}</span>
        </button>
      `;
    } else if (isSFG) {
      let sfgColorClass = 'text-indigo-700 dark:text-indigo-300';
      if (isZeroBlocked) sfgColorClass = 'text-blocked-red';
      else if (isBottleneck) sfgColorClass = 'text-bottleneck-orange';

      descHtml = `
        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-xs ${sfgColorClass}">${escapeHtml(rm.item_description || '--')}</span>
            <span class="glass-pill glass-pill-primary text-[9px] font-bold font-mono py-0.5 px-1.5 inline-flex items-center gap-1 shrink-0 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/25 whitespace-nowrap">
              <i class="ph-bold ph-cube"></i> SFG Sub-Assembly
            </span>
          </div>
        </div>
      `;
      codeHtml = `
        <span class="font-mono font-bold text-xs ${sfgColorClass} bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
          ${escapeHtml(rm.item_code || '--')}
        </span>
      `;
    } else {
      let plainColorClass = 'text-slate-900 dark:text-slate-100';
      if (isZeroBlocked) plainColorClass = 'text-blocked-red';
      else if (isBottleneck) plainColorClass = 'text-bottleneck-orange';

      descHtml = `<span class="font-bold text-xs ${plainColorClass}">${escapeHtml(rm.item_description || '--')}</span>`;
      codeHtml = `<span class="font-mono font-bold text-xs ${plainColorClass} whitespace-nowrap">${escapeHtml(rm.item_code || '--')}</span>`;
    }

    tr.innerHTML = `
      <td class="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px] font-medium">${rm.sl || i + 1}</td>
      <td class="py-2.5 px-2.5 whitespace-nowrap">${categoryHtml}</td>
      <td class="py-2.5 px-2.5 whitespace-nowrap">${codeHtml}</td>
      <td class="py-2.5 px-3">${descHtml}</td>
      <td class="py-2.5 px-2 text-center text-xs font-semibold text-slate-500">${escapeHtml(rm.unit || '--')}</td>
      <td class="py-2.5 px-2 text-center font-mono font-medium text-slate-600 dark:text-slate-300 text-xs whitespace-nowrap">${formatQty(reqPerUnit)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-bold ${isTargetShortage ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'} text-xs whitespace-nowrap">${formatQty(batchReq)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-bold text-cyan-600 dark:text-cyan-400 text-xs whitespace-nowrap">${formatQty(stStore)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400 text-xs whitespace-nowrap">${formatQty(stSec)}</td>
      <td class="py-2.5 px-2.5 text-right font-mono font-extrabold ${isZeroBlocked ? 'text-rose-600 dark:text-rose-400' : (isBottleneck ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white')} text-xs whitespace-nowrap">${formatQty(stAvail)}</td>
      <td class="py-2.5 px-2.5 text-center font-mono font-extrabold text-xs whitespace-nowrap">
        ${possDisplay}
      </td>
      <td class="py-2.5 px-2.5 text-right whitespace-nowrap">${shortageQtyDisplay}</td>
      <td class="py-2.5 px-2.5 text-center whitespace-nowrap">${shortageBadge}</td>
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
      (rm.item_name || rm.item_description || '').toLowerCase().includes(q) ||
      (rm.category || '').toLowerCase().includes(q)
    );
    renderRMTable(filtered);
  }, 80);
}

function renderRMTable(items) {
  const tbody = document.getElementById('rm-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-10 text-slate-400">No matching warehouse raw materials found.</td></tr>`;
    return;
  }

  // Precompute BOM counts for each raw material component
  const codeToBomCount = {};
  allBOMs.forEach(b => {
    (b.raw_materials || []).forEach(rm => {
      const code = rm.item_code;
      if (code) codeToBomCount[code] = (codeToBomCount[code] || 0) + 1;
    });
  });

  const fragment = document.createDocumentFragment();

  items.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'table-row-hover';

    const itemDesc = item.item_name || item.item_description || '--';
    const storeQty = item.store_qty !== undefined ? Number(item.store_qty) : 0.0;
    const secQty = item.section_qty !== undefined ? Number(item.section_qty) : 0.0;
    const totalQty = item.total_qty !== undefined ? Number(item.total_qty) : (item.total_stock !== undefined ? Number(item.total_stock) : (storeQty + secQty));
    const hasStock = totalQty > 0;
    const bomCount = item.bom_count !== undefined ? item.bom_count : (codeToBomCount[item.item_code] || 0);

    tr.innerHTML = `
      <td class="py-3 px-3.5 text-center text-slate-400 font-mono text-xs">${idx + 1}</td>
      <td class="py-3 px-3.5 font-mono font-semibold text-xs text-slate-800 dark:text-slate-200">${escapeHtml(item.item_code)}</td>
      <td class="py-3 px-3.5 font-medium text-slate-900 dark:text-slate-100">${escapeHtml(itemDesc)}</td>
      <td class="py-3 px-3.5 text-slate-500 dark:text-slate-400 text-xs">${escapeHtml(item.category || '--')}</td>
      <td class="py-3 px-3.5 text-center text-xs font-medium">${escapeHtml(item.unit || '--')}</td>
      <td class="py-3 px-3.5 text-right font-mono font-semibold text-cyan-600 dark:text-cyan-400">${formatQty(storeQty)}</td>
      <td class="py-3 px-3.5 text-right font-mono font-semibold text-purple-600 dark:text-purple-400">${formatQty(secQty)}</td>
      <td class="py-3 px-3.5 text-right font-mono font-bold text-xs ${hasStock ? 'text-slate-900 dark:text-white' : 'text-slate-400'}">${formatQty(totalQty)}</td>
      <td class="py-3 px-3.5 text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">${bomCount}</td>
      <td class="py-3 px-3.5 text-center">
        <button onclick="filterByComponent('${escapeHtml(item.item_code)}')" class="btn-luxury btn-luxury-secondary text-[11px] py-1 px-2.5">
          View BOMs
        </button>
      </td>
    `;
    fragment.appendChild(tr);
  });

  tbody.appendChild(fragment);
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
  modal.classList.remove('hidden', 'modal-animate-exit');
  modal.classList.add('modal-animate-enter');

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
  if (window.location.protocol === 'file:') {
    document.getElementById('sync-status-text').textContent = 'Local File Protocol Detected';
    document.getElementById('sync-progress-step').textContent = 'Web Server Required';
    document.getElementById('sync-progress-pct').textContent = '100%';
    document.getElementById('sync-progress-bar').style.width = '100%';

    const logsEl = document.getElementById('sync-console-logs');
    logsEl.innerHTML = `
      <div class="text-amber-400 font-bold">[NOTICE] You opened index.html directly from file explorer!</div>
      <div class="text-slate-300 mt-1.5">• To run live ERP sync, please double-click <b>run.bat</b> in the project folder.</div>
      <div class="text-slate-300">• <b>run.bat</b> starts the local server and opens <b>http://localhost:8088</b> where live sync works.</div>
    `;
    document.getElementById('sync-modal-close-btn').classList.remove('hidden');
    return;
  }

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

      // Stream live logs from backend safely (handles string or object)
      if (data.logs && Array.isArray(data.logs)) {
        for (let i = lastRenderedLogIdx; i < data.logs.length; i++) {
          const logItem = data.logs[i];
          const logText = typeof logItem === 'string' ? logItem : (logItem.message || '');
          const logTime = (typeof logItem === 'object' && logItem.time) ? logItem.time : '';
          
          const colorClass = logText.includes('[ERROR]') ? 'text-rose-400 font-bold'
                           : (logText.includes('[OK]') || logText.includes('[DONE]') || logText.includes('[COMPLETED]')) ? 'text-emerald-300 font-bold'
                           : logText.includes('[AUTH]') ? 'text-cyan-300'
                           : logText.includes('[WARN]') ? 'text-amber-300'
                           : 'text-slate-300';
          
          const formattedLog = logText.startsWith('[') ? logText : (logTime ? `[${logTime}] ${logText}` : `[${new Date().toLocaleTimeString()}] ${logText}`);
          appendSyncLog(formattedLog, colorClass);
        }
        lastRenderedLogIdx = data.logs.length;
      }

      const isRunning = (data.is_running !== undefined) ? data.is_running : (data.is_syncing || false);
      const pct = (data.progress_pct !== undefined) ? data.progress_pct : (data.percent || 10);
      const stepMsg = data.current_step || data.status || 'Extracting BOMs & Closing Stock (91223)...';

      if (isRunning) {
        document.getElementById('sync-progress-pct').textContent = `${pct}%`;
        document.getElementById('sync-progress-bar').style.width = `${pct}%`;
        document.getElementById('sync-status-text').textContent = stepMsg;
      } else {
        clearInterval(syncInterval);
        syncInterval = null;

        const report = data.last_report || data.last_sync || {};
        const isFailed = report.status === 'FAILED' || (data.status && data.status.startsWith('Error'));

        if (isFailed) {
          document.getElementById('sync-status-text').textContent = `Sync failed: ${report.error || data.status}`;
          appendSyncLog(`[${new Date().toLocaleTimeString()}] [ERROR] ${report.error || data.status}`, 'text-rose-400 font-bold');
        } else {
          document.getElementById('sync-progress-pct').textContent = '100%';
          document.getElementById('sync-progress-bar').style.width = '100%';
          document.getElementById('sync-status-text').textContent = 'Synchronization completed successfully.';

          const diffCard = document.getElementById('sync-diff-card');
          if (diffCard) diffCard.classList.remove('hidden');

          const addedEl = document.getElementById('diff-added-count');
          if (addedEl) addedEl.textContent = `+${report.added_count || 0}`;
          const updatedEl = document.getElementById('diff-updated-count');
          if (updatedEl) updatedEl.textContent = `~${report.updated_count || 0}`;
          const stockEl = document.getElementById('diff-stock-count');
          if (stockEl) stockEl.textContent = `${(report.total_stock_items || 418).toLocaleString()}`;
          const durationEl = document.getElementById('sync-duration-badge');
          if (durationEl) durationEl.textContent = `${report.duration_seconds || '4.1'}s`;
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
  if (!modal) return;

  modal.classList.remove('modal-animate-enter');
  modal.classList.add('modal-animate-exit');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('modal-animate-exit');
  }, 190);

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
        <span class="text-xs font-mono text-slate-400">${escapeHtml(formatDateTime12Hour(rec.sync_time))}</span>
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
    // Alt+B toggles Beast Performance Mode
    if (e.altKey && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      toggleBeastMode();
    }
    // Alt+T toggles Dark/Light Mode
    if (e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      toggleDarkMode(e);
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

function isPremiumFanModel(b) {
  if (!b) return false;
  const name = String(b.product_name || '').toLowerCase();
  const code = String(b.item_code || '').toLowerCase();
  const clean = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  return (
    clean.includes('5601') ||
    clean.includes('56 inch premium') ||
    name.includes('5601') ||
    name.includes('56 inch premium') ||
    code.includes('5601') ||
    code.includes('cf5601') ||
    code.includes('cr5601') ||
    code.includes('cg5601')
  );
}

function is3601Model(b) {
  if (!b) return false;
  const name = String(b.product_name || '').toLowerCase();
  const code = String(b.item_code || '').toLowerCase();
  const clean = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  return (
    clean.includes('3601') ||
    clean.includes('36 inch') ||
    name.includes('3601') ||
    name.includes('36 inch') ||
    code.includes('3601') ||
    code.includes('cf3601') ||
    code.includes('cr3601') ||
    code.includes('cfb3601')
  );
}

function is5602Model(b) {
  if (!b) return false;
  const name = String(b.product_name || '').toLowerCase();
  const code = String(b.item_code || '').toLowerCase();
  const clean = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  return (
    clean.includes('5602') ||
    clean.includes('speed king') ||
    name.includes('5602') ||
    name.includes('speed king') ||
    code.includes('5602') ||
    code.includes('cf5602') ||
    code.includes('cfb5602')
  );
}

function is4801Model(b) {
  if (!b) return false;
  const name = String(b.product_name || '').toLowerCase();
  const code = String(b.item_code || '').toLowerCase();
  const clean = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  return (
    clean.includes('4801') ||
    clean.includes('48 inch') ||
    clean.includes('popular') ||
    name.includes('4801') ||
    name.includes('48 inch') ||
    name.includes('popular') ||
    code.includes('4801') ||
    code.includes('cf4801') ||
    code.includes('cr4801') ||
    code.includes('cfb4801')
  );
}

function is2401Model(b) {
  if (!b) return false;
  const name = String(b.product_name || '').toLowerCase();
  const code = String(b.item_code || '').toLowerCase();
  const clean = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  return (
    clean.includes('2401') ||
    clean.includes('24 inch') ||
    clean.includes('super ceiling') ||
    name.includes('2401') ||
    name.includes('24 inch') ||
    name.includes('super ceiling') ||
    code.includes('2401') ||
    code.includes('cf2401') ||
    code.includes('cfb2401')
  );
}

function is5607Model(b) {
  if (!b) return false;
  const name = String(b.product_name || '').toLowerCase();
  const code = String(b.item_code || '').toLowerCase();
  const clean = getCleanProductName(b.product_name, b.item_code).toLowerCase();
  return (
    clean.includes('5607') ||
    clean.includes('crown ceiling') ||
    name.includes('5607') ||
    name.includes('crown ceiling') ||
    code.includes('5607') ||
    code.includes('cf5607') ||
    code.includes('cfb5607')
  );
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

function formatTime12Hour(timeStr) {
  if (!timeStr) {
    return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  }

  let str = String(timeStr).trim();
  if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
    return str;
  }

  if (str.includes(' ')) {
    str = str.split(' ')[1];
  } else if (str.includes('T')) {
    str = str.split('T')[1].split('.')[0];
  }

  const parts = str.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    if (isNaN(hours)) return timeStr;
    const minutes = parts[1] || '00';
    const seconds = parts[2] ? parts[2].split(' ')[0] : null;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const hoursStr = String(hours).padStart(2, '0');
    return seconds ? `${hoursStr}:${minutes}:${seconds} ${ampm}` : `${hoursStr}:${minutes} ${ampm}`;
  }

  return timeStr;
}

function formatDateTime12Hour(dateTimeStr) {
  if (!dateTimeStr) return '--';
  let str = String(dateTimeStr).trim();
  if (str.toUpperCase().includes('AM') || str.toUpperCase().includes('PM')) {
    return str;
  }
  if (str.includes(' ')) {
    const [datePart, timePart] = str.split(' ');
    return `${datePart} ${formatTime12Hour(timePart)}`;
  }
  return formatTime12Hour(str);
}

