// ==============================================================================
// AEGIS PASS // MASTER APPLICATION CONTROLLER & KASPERSKY-STYLE UI
// ==============================================================================

(function() {
  'use strict';

  let vaultEngine = null;
  let themeEngine = null;

  let vaultItems = [];
  let currentCategory = 'accounts'; // 'all' | 'accounts' | 'games' | 'cards' | 'notes'
  let currentFilter = 'all'; // 'all' | 'recent' | 'favorites'
  let currentSearchQuery = '';
  let isGridView = true;

  let settings = {
    theme: 'monochrome',
    activeWallpaperId: 'anime_companion.jpg',
    wallpaperOpacity: 25,
    wallpaperBrightness: 100,
    wallpaperFit: 'cover',
    wallpaperBlur: 10,
    sidebarOpacity: 80,
    cardOpacity: 70,
    tabsOpacity: 70,
    glassBlur: 16,
    autolockTimer: 0,
    uiSounds: true
  };

  let autolockTimeout = null;
  let activeContextMenuId = null;

  // Initialize App
  document.addEventListener('DOMContentLoaded', async () => {
    vaultEngine = new window.CryptoVaultEngine();
    themeEngine = new window.ThemeEngine();

    // Load persisted settings
    if (window.aegis) {
      try {
        const saved = await window.aegis.readSettings();
        if (saved) {
          settings = Object.assign(settings, saved);
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }

    applySettingsToUi();
    setupNavigation();
    setupTopBar();
    setupVaultCardActions();
    setupWallpapersManager();
    setupGenerator();
    setupSettingsTab();
    setupModal();
    setupContextMenu();
    setupLockScreen();
    resetInactivityTimer();

    // Start directly unlocked without blocking
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) {
      lockScreen.classList.add('unlocked');
    }

    // Load vault data immediately
    await loadInitialVault();
    updateStorageStats();
  });

  async function loadInitialVault() {
    let loaded = false;
    if (window.aegis) {
      try {
        const raw = await window.aegis.readVault();
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            vaultItems = parsed;
            loaded = true;
          } else if (parsed && Array.isArray(parsed.items)) {
            vaultItems = parsed.items;
            loaded = true;
          }
        }
      } catch (e) {
        console.error('Failed to load raw vault:', e);
      }
    }

    if (!loaded || vaultItems.length === 0) {
      vaultItems = [
        {
          id: 'demo_1',
          title: 'Discord',
          category: 'accounts',
          username: 'hddfi@yandex.ru',
          password: window.PasswordGenerator.generate({ length: 18 }),
          url: 'https://discord.com',
          notes: 'Основной аккаунт',
          favorite: true,
          createdAt: Date.now() - 300000
        },
        {
          id: 'demo_2',
          title: 'Steam',
          category: 'games',
          username: 'Motewj',
          password: window.PasswordGenerator.generate({ length: 20 }),
          url: '',
          notes: 'Игровая библиотека Steam',
          favorite: true,
          createdAt: Date.now() - 200000
        },
        {
          id: 'demo_3',
          title: 'Roblox',
          category: 'games',
          username: 'Player_777',
          password: window.PasswordGenerator.generate({ length: 16 }),
          url: '',
          notes: 'Основной профиль',
          favorite: true,
          createdAt: Date.now() - 150000
        },
        {
          id: 'demo_4',
          title: 'Dota 2',
          category: 'games',
          username: 'MidOrFeed',
          password: window.PasswordGenerator.generate({ length: 14 }),
          url: '',
          notes: 'Рейтинговый аккаунт',
          favorite: false,
          createdAt: Date.now() - 100000
        },
        {
          id: 'demo_5',
          title: 'Т-Банк Black',
          category: 'cards',
          username: '2200 7000 1234 5678',
          password: '12/28 · CVV 452',
          url: '',
          notes: 'Основная дебетовая карта',
          favorite: false,
          createdAt: Date.now() - 80000
        },
        {
          id: 'demo_6',
          title: 'Секретная заметка',
          category: 'notes',
          username: 'Личные заметки',
          password: 'PIN 8891',
          url: '',
          notes: 'Коды резервного восстановления и ключи доступа к серверу',
          favorite: false,
          createdAt: Date.now() - 50000
        }
      ];
      await persistVaultToDisk();
    }

    renderCardsGrid();
  }

  // Apply visual settings
  function applySettingsToUi() {
    themeEngine.applyPalette(settings.theme || 'monochrome');
    themeEngine.sounds.enabled = settings.uiSounds !== false;

    // Update active swatch
    document.querySelectorAll('.kpm-swatch-circle').forEach(sw => {
      sw.classList.toggle('active', sw.getAttribute('data-color') === settings.theme);
    });

    const root = document.documentElement;

    if (typeof settings.wallpaperBrightness === 'undefined') settings.wallpaperBrightness = 100;
    if (!settings.wallpaperFit) settings.wallpaperFit = 'cover';

    // Wallpaper layer settings
    root.style.setProperty('--bg-wallpaper-opacity', (settings.wallpaperOpacity / 100).toString());
    root.style.setProperty('--bg-wallpaper-blur', settings.wallpaperBlur + 'px');
    root.style.setProperty('--bg-wallpaper-brightness', (settings.wallpaperBrightness / 100).toString());
    root.style.setProperty('--bg-wallpaper-fit', settings.wallpaperFit);

    const selFit = document.getElementById('select-wallpaper-fit');
    if (selFit) selFit.value = settings.wallpaperFit;
    const selFitSet = document.getElementById('select-wallpaper-fit-settings');
    if (selFitSet) selFitSet.value = settings.wallpaperFit;

    // Glass transparency & blur settings
    root.style.setProperty('--sidebar-opacity', (settings.sidebarOpacity / 100).toString());
    root.style.setProperty('--card-opacity', (settings.cardOpacity / 100).toString());
    root.style.setProperty('--tabs-opacity', (settings.tabsOpacity / 100).toString());
    root.style.setProperty('--topbar-opacity', (Math.min(100, settings.sidebarOpacity + 5) / 100).toString());
    root.style.setProperty('--glass-blur', settings.glassBlur + 'px');

    // Tabs opacity slider
    const sTabsOp = document.getElementById('slider-tabs-opacity');
    if (sTabsOp) sTabsOp.value = settings.tabsOpacity;
    const vTabsOp = document.getElementById('val-tabs-opacity');
    if (vTabsOp) vTabsOp.textContent = settings.tabsOpacity + '%';

    // Wallpaper pane sliders
    const sBright = document.getElementById('slider-bg-brightness');
    if (sBright) sBright.value = settings.wallpaperBrightness;
    const vBright = document.getElementById('val-bg-brightness');
    if (vBright) vBright.textContent = settings.wallpaperBrightness + '%';

    const sOp = document.getElementById('slider-bg-opacity');
    if (sOp) sOp.value = settings.wallpaperOpacity;
    const vOp = document.getElementById('val-bg-opacity');
    if (vOp) vOp.textContent = settings.wallpaperOpacity + '%';

    const sBl = document.getElementById('slider-bg-blur');
    if (sBl) sBl.value = settings.wallpaperBlur;
    const vBl = document.getElementById('val-bg-blur');
    if (vBl) vBl.textContent = settings.wallpaperBlur + 'px';

    const sSideOpW = document.getElementById('slider-sidebar-opacity-wallpapers');
    if (sSideOpW) sSideOpW.value = settings.sidebarOpacity;
    const vSideOpW = document.getElementById('val-sidebar-opacity-wallpapers');
    if (vSideOpW) vSideOpW.textContent = settings.sidebarOpacity + '%';

    const sTabsOpW = document.getElementById('slider-tabs-opacity-wallpapers');
    if (sTabsOpW) sTabsOpW.value = settings.tabsOpacity;
    const vTabsOpW = document.getElementById('val-tabs-opacity-wallpapers');
    if (vTabsOpW) vTabsOpW.textContent = settings.tabsOpacity + '%';

    const sCardOpW = document.getElementById('slider-card-opacity-wallpapers');
    if (sCardOpW) sCardOpW.value = settings.cardOpacity;
    const vCardOpW = document.getElementById('val-card-opacity-wallpapers');
    if (vCardOpW) vCardOpW.textContent = settings.cardOpacity + '%';

    // Settings appearance sliders
    const sSideOp = document.getElementById('slider-sidebar-opacity');
    if (sSideOp) sSideOp.value = settings.sidebarOpacity;
    const vSideOp = document.getElementById('val-sidebar-opacity');
    if (vSideOp) vSideOp.textContent = settings.sidebarOpacity + '%';

    const sCardOp = document.getElementById('slider-card-opacity');
    if (sCardOp) sCardOp.value = settings.cardOpacity;
    const vCardOp = document.getElementById('val-card-opacity');
    if (vCardOp) vCardOp.textContent = settings.cardOpacity + '%';

    const sGlassBl = document.getElementById('slider-glass-blur');
    if (sGlassBl) sGlassBl.value = settings.glassBlur;
    const vGlassBl = document.getElementById('val-glass-blur');
    if (vGlassBl) vGlassBl.textContent = settings.glassBlur + 'px';

    const sBgOpSet = document.getElementById('slider-bg-opacity-settings');
    if (sBgOpSet) sBgOpSet.value = settings.wallpaperOpacity;
    const vBgOpSet = document.getElementById('val-bg-opacity-settings');
    if (vBgOpSet) vBgOpSet.textContent = settings.wallpaperOpacity + '%';

    const sBrightSet = document.getElementById('slider-bg-brightness-settings');
    if (sBrightSet) sBrightSet.value = settings.wallpaperBrightness;
    const vBrightSet = document.getElementById('val-bg-brightness-settings');
    if (vBrightSet) vBrightSet.textContent = settings.wallpaperBrightness + '%';

    const sLock = document.getElementById('select-autolock-timer');
    if (sLock) sLock.value = settings.autolockTimer;

    const checkSounds = document.getElementById('check-ui-sounds');
    if (checkSounds) checkSounds.checked = settings.uiSounds !== false;

    applyWallpaperBackground(settings.activeWallpaperId);
  }

  function applyWallpaperBackground(wallpaperId) {
    const bgImg = document.getElementById('kpm-bg-img');
    if (!bgImg) return;

    if (!wallpaperId || wallpaperId === 'none') {
      bgImg.classList.remove('active');
      bgImg.src = '';
      return;
    }

    // Check if it exists in discovered list
    const found = cachedWallpapers.find(w => w.fileName === wallpaperId || w.id === wallpaperId);
    if (found) {
      bgImg.src = found.fileUrl;
      bgImg.classList.add('active');
    } else {
      bgImg.src = 'assets/wallpaper_anime.jpg';
      bgImg.classList.add('active');
    }
  }

  function saveCurrentSettings() {
    if (window.aegis) {
      window.aegis.saveSettings(settings);
    }
  }

  // ==============================================================================
  // NAVIGATION & VIEW SWITCHING
  // ==============================================================================
  function setupNavigation() {
    // Sidebar menu items
    document.querySelectorAll('.kpm-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const viewKey = item.getAttribute('data-view');
        switchView(viewKey);
      });
    });

    // Wallpapers button at sidebar bottom
    document.getElementById('btn-nav-wallpapers').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      switchView('wallpapers');
    });

    // Settings button at sidebar bottom
    document.getElementById('btn-nav-settings').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      switchView('settings');
    });

    // Subtab button to jump to wallpapers from settings
    const btnJumpWallpapers = document.getElementById('btn-jump-to-wallpapers');
    if (btnJumpWallpapers) {
      btnJumpWallpapers.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        switchView('wallpapers');
      });
    }
  }

  const VIEW_TITLES = {
    'all': 'Все записи',
    'accounts': 'Аккаунты',
    'games': 'Игры',
    'cards': 'Банковские карты',
    'notes': 'Заметки',
    'generator': 'Генератор паролей',
    'wallpapers': 'Обои и Темы',
    'settings': 'Настройки'
  };

  const ADD_BUTTON_LABELS = {
    'all': 'Добавить запись',
    'accounts': 'Добавить аккаунт',
    'games': 'Добавить игру',
    'cards': 'Добавить карту',
    'notes': 'Добавить заметку'
  };

  function switchView(viewKey) {
    // Update active class on menu items
    document.querySelectorAll('.kpm-menu-item').forEach(m => {
      m.classList.toggle('active', m.getAttribute('data-view') === viewKey);
    });

    // Bottom buttons active state
    document.getElementById('btn-nav-wallpapers').classList.toggle('active', viewKey === 'wallpapers');
    document.getElementById('btn-nav-settings').classList.toggle('active', viewKey === 'settings');

    // Title update
    const titleEl = document.getElementById('view-title');
    if (titleEl) {
      titleEl.textContent = VIEW_TITLES[viewKey] || 'Аккаунты';
    }

    // Toggle topbar add button and filter pills
    const addBtn = document.getElementById('btn-add-entry');
    const filterBar = document.getElementById('filter-pills-bar');
    const addLabel = document.getElementById('btn-add-entry-label');

    if (viewKey === 'generator' || viewKey === 'wallpapers' || viewKey === 'settings') {
      if (addBtn) addBtn.style.display = 'none';
      if (filterBar) filterBar.style.display = 'none';
    } else {
      if (addBtn) addBtn.style.display = 'inline-flex';
      if (filterBar) filterBar.style.display = 'flex';
      if (addLabel) {
        addLabel.textContent = ADD_BUTTON_LABELS[viewKey] || 'Добавить запись';
      }
    }

    // Hide all view panes
    document.querySelectorAll('.kpm-view-pane').forEach(p => p.classList.remove('active'));

    // Show selected pane
    if (viewKey === 'generator') {
      document.getElementById('pane-generator').classList.add('active');
      refreshGenerator();
    } else if (viewKey === 'wallpapers') {
      document.getElementById('pane-wallpapers').classList.add('active');
      renderWallpapersGallery();
    } else if (viewKey === 'settings') {
      document.getElementById('pane-settings').classList.add('active');
      updateStorageStats();
    } else {
      // Vault cards grid view
      currentCategory = viewKey;
      document.getElementById('pane-vault').classList.add('active');
      renderCardsGrid();
    }
  }

  // ==============================================================================
  // TOPBAR (SEARCH, FILTERS, VIEW TOGGLE, WINDOW CONTROLS)
  // ==============================================================================
  function setupTopBar() {
    // Window controls
    document.getElementById('btn-win-min').addEventListener('click', () => {
      if (window.aegis) window.aegis.minimize();
    });
    document.getElementById('btn-win-max').addEventListener('click', () => {
      if (window.aegis) window.aegis.maximize();
    });
    document.getElementById('btn-win-close').addEventListener('click', () => {
      if (window.aegis) window.aegis.close();
    });

    // View switcher (Grid vs List)
    const btnGrid = document.getElementById('btn-view-grid');
    const btnList = document.getElementById('btn-view-list');
    const gridContainer = document.getElementById('kpm-cards-container');

    btnGrid.addEventListener('click', () => {
      themeEngine.sounds.playClick();
      isGridView = true;
      btnGrid.classList.add('active');
      btnList.classList.remove('active');
      gridContainer.classList.remove('list-view');
    });

    btnList.addEventListener('click', () => {
      themeEngine.sounds.playClick();
      isGridView = false;
      btnList.classList.add('active');
      btnGrid.classList.remove('active');
      gridContainer.classList.add('list-view');
    });

    // Filter pills (Все, Недавние, Избранное)
    document.querySelectorAll('.kpm-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        document.querySelectorAll('.kpm-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentFilter = pill.getAttribute('data-filter');
        renderCardsGrid();
      });
    });

    // Search bar
    const searchInput = document.getElementById('kpm-search-input');
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      renderCardsGrid();
    });

    // Shortcut: Ctrl+F focuses search
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // Add entry button
    document.getElementById('btn-add-entry').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      openAddModal();
    });
  }

  // ==============================================================================
  // KASPERSKY-STYLE CARDS GRID RENDERING
  // ==============================================================================
  const SERVICE_COLORS = {
    'discord': { bg: 'rgba(88,101,242,0.18)', color: '#5865F2' },
    'steam': { bg: 'rgba(23,26,33,0.3)', color: '#66c0f4' },
    'epic': { bg: 'rgba(49,49,49,0.35)', color: '#ffffff' },
    'roblox': { bg: 'rgba(235,50,35,0.2)', color: '#ff4d4d' },
    'minecraft': { bg: 'rgba(78,148,79,0.25)', color: '#52b788' },
    'dota': { bg: 'rgba(180,40,40,0.22)', color: '#e63946' },
    'cs2': { bg: 'rgba(230,126,34,0.22)', color: '#f39c12' },
    'fortnite': { bg: 'rgba(155,89,182,0.22)', color: '#9b59b6' },
    'war thunder': { bg: 'rgba(211,84,0,0.22)', color: '#e67e22' },
    'genshin': { bg: 'rgba(52,152,219,0.22)', color: '#3498db' },
    'gta': { bg: 'rgba(46,204,113,0.22)', color: '#2ecc71' },
    'rust': { bg: 'rgba(192,57,43,0.22)', color: '#cd4632' },
    'apex': { bg: 'rgba(231,76,60,0.22)', color: '#e74c3c' },
    'lethal': { bg: 'rgba(243,156,18,0.22)', color: '#f1c40f' },
    'google': { bg: 'rgba(234,67,53,0.16)', color: '#ea4335' },
    'github': { bg: 'rgba(255,255,255,0.12)', color: '#ffffff' },
    'yandex': { bg: 'rgba(252,63,29,0.18)', color: '#fc3f1d' },
    'telegram': { bg: 'rgba(36,161,222,0.18)', color: '#24A1DE' },
    'vk': { bg: 'rgba(0,119,255,0.18)', color: '#0077ff' },
    'банк': { bg: 'rgba(16,185,129,0.18)', color: '#10b981' }
  };

  function getServiceColor(title) {
    const t = (title || '').toLowerCase();
    for (const [key, val] of Object.entries(SERVICE_COLORS)) {
      if (t.includes(key)) return val;
    }
    return { bg: 'rgba(255,255,255,0.08)', color: '#ffffff' };
  }

  const CATEGORY_NAMES = {
    'accounts': 'Аккаунт',
    'games': 'Игра',
    'cards': 'Карта',
    'notes': 'Заметка'
  };

  function renderCardsGrid() {
    const container = document.getElementById('kpm-cards-container');
    if (!container) return;

    let items = vaultItems.slice();

    // 1. Category Filter
    if (currentCategory !== 'all') {
      items = items.filter(it => it.category === currentCategory);
    }

    // 2. Pill Filter
    if (currentFilter === 'favorites') {
      items = items.filter(it => it.favorite);
    } else if (currentFilter === 'recent') {
      items = items.slice(-8).reverse();
    }

    // 3. Search Query Filter
    if (currentSearchQuery) {
      items = items.filter(it => {
        const titleMatch = (it.title || '').toLowerCase().includes(currentSearchQuery);
        const userMatch = (it.username || '').toLowerCase().includes(currentSearchQuery);
        const urlMatch = (it.url || '').toLowerCase().includes(currentSearchQuery);
        const noteMatch = (it.notes || '').toLowerCase().includes(currentSearchQuery);
        return titleMatch || userMatch || urlMatch || noteMatch;
      });
    }

    updateSidebarCounters();

    if (items.length === 0) {
      let emptyMsg = 'В этой категории пока нет записей.';
      if (currentCategory === 'games') emptyMsg = 'В категории «Игры» пока нет записей. Нажмите кнопку «Добавить игру».';
      else if (currentCategory === 'accounts') emptyMsg = 'В категории «Аккаунты» пока нет записей. Нажмите «Добавить аккаунт».';
      else if (currentCategory === 'cards') emptyMsg = 'В категории «Банковские карты» пока нет записей. Нажмите «Добавить карту».';
      else if (currentCategory === 'notes') emptyMsg = 'В категории «Заметки» пока нет записей. Нажмите «Добавить заметку».';

      container.innerHTML = `
        <div class="kpm-empty-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div class="kpm-empty-title">Записей не найдено</div>
          <div class="kpm-empty-subtitle">${emptyMsg}</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const servColor = getServiceColor(item.title);
      const isWeak = !item.password || item.password.length < 10;
      const initial = (item.title || 'A').charAt(0).toUpperCase();
      const catLabel = CATEGORY_NAMES[item.category] || 'Запись';

      return `
        <div class="kpm-card" data-id="${item.id}">
          <div class="kpm-card-header">
            <div class="kpm-card-service">
              <div class="kpm-service-icon" style="background: ${servColor.bg}; color: ${servColor.color};">
                ${initial}
              </div>
              <div style="display: flex; flex-direction: column; overflow: hidden; min-width: 0;">
                <div class="kpm-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                <div class="kpm-card-cat-label">${catLabel}</div>
              </div>
            </div>
            <div class="kpm-card-actions">
              <button class="kpm-card-star-btn ${item.favorite ? 'starred' : ''}" data-action="toggle-star" data-id="${item.id}" title="${item.favorite ? 'В избранном' : 'Добавить в избранное'}">
                <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
              <button class="kpm-card-menu-btn" data-action="card-menu" data-id="${item.id}" title="Опции">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
            </div>
          </div>

          <div class="kpm-card-body">
            <!-- Login row -->
            <div class="kpm-field-row">
              <span class="kpm-field-val" title="${escapeHtml(item.username)}">${escapeHtml(item.username)}</span>
              <button class="kpm-field-copy-btn" data-action="copy-login" data-id="${item.id}" title="Скопировать логин">
                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>

            <!-- Password row -->
            <div class="kpm-field-row">
              <span class="kpm-field-val monospace" id="pass-field-${item.id}">••••••••</span>
              <div class="kpm-field-buttons">
                <button class="kpm-field-copy-btn" data-action="reveal-pass" data-id="${item.id}" title="Показать/скрыть пароль">
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="kpm-field-copy-btn" data-action="copy-pass" data-id="${item.id}" title="Скопировать пароль">
                  <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Status indicator (only if weak) -->
          ${isWeak ? `
            <div class="kpm-card-footer">
              <div class="kpm-status-alert">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Короткий</span>
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  function updateSidebarCounters() {
    const totalAll = vaultItems.length;
    const countAccounts = vaultItems.filter(i => i.category === 'accounts').length;
    const countGames = vaultItems.filter(i => i.category === 'games').length;
    const countCards = vaultItems.filter(i => i.category === 'cards').length;
    const countNotes = vaultItems.filter(i => i.category === 'notes').length;

    const bAll = document.getElementById('badge-count-all');
    if (bAll) bAll.textContent = totalAll;

    const bAcc = document.getElementById('badge-count-accounts');
    if (bAcc) bAcc.textContent = countAccounts;

    const bGames = document.getElementById('badge-count-games');
    if (bGames) bGames.textContent = countGames;

    const bCards = document.getElementById('badge-count-cards');
    if (bCards) bCards.textContent = countCards;

    const bNotes = document.getElementById('badge-count-notes');
    if (bNotes) bNotes.textContent = countNotes;
  }

  // ==============================================================================
  // CARD ACTIONS (COPY, STAR, REVEAL, MENU)
  // ==============================================================================
  function setupVaultCardActions() {
    const container = document.getElementById('kpm-cards-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const item = vaultItems.find(it => it.id === id);
      if (!item) return;

      // 1. Toggle Favorite
      if (action === 'toggle-star') {
        themeEngine.sounds.playClick();
        item.favorite = !item.favorite;
        persistVaultToDisk();
        renderCardsGrid();
        showToast(item.favorite ? 'Добавлено в избранное' : 'Удалено из избранного');
      }

      // 2. Copy Login
      else if (action === 'copy-login') {
        themeEngine.sounds.playCopy();
        if (window.aegis) window.aegis.copyText(item.username);
        else navigator.clipboard.writeText(item.username);
        showToast('Логин скопирован');
      }

      // 3. Copy Password
      else if (action === 'copy-pass') {
        themeEngine.sounds.playCopy();
        if (window.aegis) window.aegis.copyText(item.password);
        else navigator.clipboard.writeText(item.password);
        showToast('Пароль скопирован');
      }

      // 4. Reveal Password Toggle
      else if (action === 'reveal-pass') {
        themeEngine.sounds.playClick();
        const passEl = document.getElementById(`pass-field-${id}`);
        if (passEl) {
          if (passEl.classList.contains('revealed')) {
            passEl.classList.remove('revealed');
            passEl.textContent = '••••••••';
          } else {
            passEl.classList.add('revealed');
            passEl.textContent = item.password;
          }
        }
      }

      // 5. Card Menu (Context popover)
      else if (action === 'card-menu') {
        themeEngine.sounds.playClick();
        showContextMenuForCard(btn, item);
      }
    });
  }

  // Context Menu for Cards
  function setupContextMenu() {
    const menu = document.getElementById('card-context-menu');
    if (!menu) return;

    menu.addEventListener('click', async (e) => {
      const itemEl = e.target.closest('.kpm-dropdown-item');
      if (!itemEl) return;

      const action = itemEl.getAttribute('data-action');
      const item = vaultItems.find(it => it.id === activeContextMenuId);
      hideContextMenu();

      if (!item) return;

      if (action === 'edit') {
        themeEngine.sounds.playClick();
        openEditModal(item);
      } else if (action === 'copy-login') {
        themeEngine.sounds.playCopy();
        if (window.aegis) window.aegis.copyText(item.username);
        else navigator.clipboard.writeText(item.username);
        showToast('Логин скопирован');
      } else if (action === 'copy-password') {
        themeEngine.sounds.playCopy();
        if (window.aegis) window.aegis.copyText(item.password);
        else navigator.clipboard.writeText(item.password);
        showToast('Пароль скопирован');
      } else if (action === 'delete') {
        themeEngine.sounds.playError();
        vaultItems = vaultItems.filter(it => it.id !== item.id);
        await persistVaultToDisk();
        renderCardsGrid();
        updateStorageStats();
        showToast('Запись удалена');
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#card-context-menu') && !e.target.closest('[data-action="card-menu"]')) {
        hideContextMenu();
      }
    });
  }

  function showContextMenuForCard(buttonEl, item) {
    const menu = document.getElementById('card-context-menu');
    if (!menu) return;

    activeContextMenuId = item.id;
    const rect = buttonEl.getBoundingClientRect();

    let top = rect.bottom + 4;
    let left = rect.right - 170;

    if (left < 10) left = 10;
    if (top + 160 > window.innerHeight) {
      top = rect.top - 150;
    }

    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.display = 'flex';
  }

  function hideContextMenu() {
    const menu = document.getElementById('card-context-menu');
    if (menu) menu.style.display = 'none';
    activeContextMenuId = null;
  }

  // ==============================================================================
  // WALLPAPERS & PROFILES MANAGER
  // ==============================================================================
  let cachedWallpapers = [];

  function setupWallpapersManager() {
    // Open Wallpapers Folder in Windows Explorer
    document.getElementById('btn-open-wallpapers-folder').addEventListener('click', async () => {
      themeEngine.sounds.playClick();
      if (window.aegis) {
        const res = await window.aegis.openWallpapersFolder();
        if (res.ok) {
          showToast('Папка с обоями открыта в проводнике');
        }
      }
    });

    // Add Image File Dialog
    document.getElementById('btn-add-wallpaper-file').addEventListener('click', async () => {
      themeEngine.sounds.playClick();
      if (window.aegis) {
        const res = await window.aegis.selectAndAddWallpaper();
        if (res.ok && res.fileName) {
          showToast('Фон успешно добавлен');
          settings.activeWallpaperId = res.fileName;
          applyWallpaperBackground(res.fileName);
          saveCurrentSettings();
          renderWallpapersGallery();
        }
      }
    });

    // Refresh List
    document.getElementById('btn-refresh-wallpapers').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      renderWallpapersGallery();
      showToast('Список фонов обновлен');
    });

    // Reset Wallpaper (Pure Dark)
    document.getElementById('btn-reset-wallpaper').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      settings.activeWallpaperId = 'none';
      applyWallpaperBackground('none');
      saveCurrentSettings();
      renderWallpapersGallery();
      showToast('Фон сброшен');
    });

    // Sliders in Wallpapers Pane
    const sliderOp = document.getElementById('slider-bg-opacity');
    sliderOp.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      settings.wallpaperOpacity = val;
      document.getElementById('val-bg-opacity').textContent = val + '%';
      const sBgSet = document.getElementById('slider-bg-opacity-settings');
      if (sBgSet) sBgSet.value = val;
      const vBgSet = document.getElementById('val-bg-opacity-settings');
      if (vBgSet) vBgSet.textContent = val + '%';

      document.documentElement.style.setProperty('--bg-wallpaper-opacity', (val / 100).toString());
      saveCurrentSettings();
    });

    const sliderBl = document.getElementById('slider-bg-blur');
    sliderBl.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      settings.wallpaperBlur = val;
      document.getElementById('val-bg-blur').textContent = val + 'px';
      document.documentElement.style.setProperty('--bg-wallpaper-blur', val + 'px');
      saveCurrentSettings();
    });

    // Scaling Mode in Wallpapers Pane
    const selFitW = document.getElementById('select-wallpaper-fit');
    if (selFitW) {
      selFitW.addEventListener('change', (e) => {
        const val = e.target.value;
        settings.wallpaperFit = val;
        const selFitSet = document.getElementById('select-wallpaper-fit-settings');
        if (selFitSet) selFitSet.value = val;
        document.documentElement.style.setProperty('--bg-wallpaper-fit', val);
        saveCurrentSettings();
      });
    }

    // Brightness Slider in Wallpapers Pane
    const sliderBright = document.getElementById('slider-bg-brightness');
    if (sliderBright) {
      sliderBright.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.wallpaperBrightness = val;
        const vEl = document.getElementById('val-bg-brightness');
        if (vEl) vEl.textContent = val + '%';
        const sBrightSet = document.getElementById('slider-bg-brightness-settings');
        if (sBrightSet) sBrightSet.value = val;
        const vBrightSet = document.getElementById('val-bg-brightness-settings');
        if (vBrightSet) vBrightSet.textContent = val + '%';

        document.documentElement.style.setProperty('--bg-wallpaper-brightness', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Sidebar Opacity Slider in Wallpapers Pane
    const sliderSideW = document.getElementById('slider-sidebar-opacity-wallpapers');
    if (sliderSideW) {
      sliderSideW.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.sidebarOpacity = val;
        const vEl = document.getElementById('val-sidebar-opacity-wallpapers');
        if (vEl) vEl.textContent = val + '%';
        const sSide = document.getElementById('slider-sidebar-opacity');
        if (sSide) sSide.value = val;
        const vSide = document.getElementById('val-sidebar-opacity');
        if (vSide) vSide.textContent = val + '%';

        document.documentElement.style.setProperty('--sidebar-opacity', (val / 100).toString());
        document.documentElement.style.setProperty('--topbar-opacity', (Math.min(100, val + 5) / 100).toString());
        saveCurrentSettings();
      });
    }

    // Tabs & Panels Opacity Slider in Wallpapers Pane
    const sliderTabsW = document.getElementById('slider-tabs-opacity-wallpapers');
    if (sliderTabsW) {
      sliderTabsW.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.tabsOpacity = val;
        const vEl = document.getElementById('val-tabs-opacity-wallpapers');
        if (vEl) vEl.textContent = val + '%';
        const sTabs = document.getElementById('slider-tabs-opacity');
        if (sTabs) sTabs.value = val;
        const vTabs = document.getElementById('val-tabs-opacity');
        if (vTabs) vTabs.textContent = val + '%';

        document.documentElement.style.setProperty('--tabs-opacity', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Card Opacity Slider in Wallpapers Pane
    const sliderCardW = document.getElementById('slider-card-opacity-wallpapers');
    if (sliderCardW) {
      sliderCardW.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.cardOpacity = val;
        const vEl = document.getElementById('val-card-opacity-wallpapers');
        if (vEl) vEl.textContent = val + '%';
        const sCard = document.getElementById('slider-card-opacity');
        if (sCard) sCard.value = val;
        const vCard = document.getElementById('val-card-opacity');
        if (vCard) vCard.textContent = val + '%';

        document.documentElement.style.setProperty('--card-opacity', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Color Swatches in Wallpapers Pane and Settings
    document.querySelectorAll('.kpm-swatch-circle').forEach(sw => {
      sw.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const colorKey = sw.getAttribute('data-color');
        document.querySelectorAll('.kpm-swatch-circle').forEach(s => s.classList.remove('active'));
        document.querySelectorAll(`.kpm-swatch-circle[data-color="${colorKey}"]`).forEach(s => s.classList.add('active'));
        settings.theme = colorKey;
        themeEngine.applyPalette(colorKey);
        saveCurrentSettings();
      });
    });
  }

  async function renderWallpapersGallery() {
    const container = document.getElementById('wallpapers-profiles-container');
    if (!container) return;

    if (window.aegis) {
      cachedWallpapers = await window.aegis.listWallpapers();
    }

    // Default "None" card
    const isNoneActive = (!settings.activeWallpaperId || settings.activeWallpaperId === 'none');
    let html = `
      <div class="kpm-profile-card ${isNoneActive ? 'active' : ''}" data-id="none">
        <div class="kpm-profile-default-fill">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="3" x2="21" y2="21"/>
          </svg>
        </div>
        ${isNoneActive ? '<div class="kpm-profile-badge">АКТИВЕН</div>' : ''}
        <div class="kpm-profile-footer">Касперский классик</div>
      </div>
    `;

    // Add each discovered wallpaper from folder
    cachedWallpapers.forEach(item => {
      const isActive = (settings.activeWallpaperId === item.id || settings.activeWallpaperId === item.fileName);
      html += `
        <div class="kpm-profile-card ${isActive ? 'active' : ''}" data-id="${item.fileName}">
          <img src="${item.fileUrl}" class="kpm-profile-thumb" alt="${item.name}">
          ${isActive ? '<div class="kpm-profile-badge">АКТИВЕН</div>' : ''}
          <div class="kpm-profile-footer" title="${item.name}">${item.name}</div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach card click handlers
    container.querySelectorAll('.kpm-profile-card').forEach(card => {
      card.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const id = card.getAttribute('data-id');
        settings.activeWallpaperId = id;
        applyWallpaperBackground(id);
        saveCurrentSettings();
        renderWallpapersGallery();
        showToast('Профиль фона активирован');
      });
    });
  }

  // ==============================================================================
  // GENERATOR
  // ==============================================================================
  function setupGenerator() {
    const slider = document.getElementById('gen-len-slider');
    const label = document.getElementById('gen-len-label');

    slider.addEventListener('input', (e) => {
      label.textContent = `${e.target.value} символов`;
      refreshGenerator();
    });

    ['gen-opt-upper', 'gen-opt-lower', 'gen-opt-nums', 'gen-opt-syms'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => refreshGenerator());
    });

    document.getElementById('btn-gen-refresh').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      refreshGenerator();
    });

    document.getElementById('btn-gen-copy').addEventListener('click', () => {
      themeEngine.sounds.playCopy();
      const code = document.getElementById('gen-output').textContent;
      if (window.aegis) window.aegis.copyText(code);
      else navigator.clipboard.writeText(code);
      showToast('Сгенерированный пароль скопирован');
    });
  }

  function refreshGenerator() {
    const len = parseInt(document.getElementById('gen-len-slider').value, 10);
    const upper = document.getElementById('gen-opt-upper').checked;
    const lower = document.getElementById('gen-opt-lower').checked;
    const nums = document.getElementById('gen-opt-nums').checked;
    const syms = document.getElementById('gen-opt-syms').checked;

    const pass = window.PasswordGenerator.generate({
      length: len,
      uppercase: upper,
      lowercase: lower,
      numbers: nums,
      symbols: syms
    });

    const out = document.getElementById('gen-output');
    if (out) out.textContent = pass;
  }

  // ==============================================================================
  // SETTINGS TAB WITH BEAUTIFUL SUBTABS & TRANSPARENCY CONTROLS
  // ==============================================================================
  function setupSettingsTab() {
    // Subtabs switcher
    document.querySelectorAll('.kpm-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const targetSubtab = btn.getAttribute('data-subtab');
        document.querySelectorAll('.kpm-subtab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.kpm-subtab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(`subtab-pane-${targetSubtab}`);
        if (pane) pane.classList.add('active');

        if (targetSubtab === 'settings-storage') {
          updateStorageStats();
        }
      });
    });

    // Tabs & panes opacity slider
    const sTabsOp = document.getElementById('slider-tabs-opacity');
    if (sTabsOp) {
      sTabsOp.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.tabsOpacity = val;
        const vTabsOp = document.getElementById('val-tabs-opacity');
        if (vTabsOp) vTabsOp.textContent = val + '%';
        const sTabsW = document.getElementById('slider-tabs-opacity-wallpapers');
        if (sTabsW) sTabsW.value = val;
        const vTabsW = document.getElementById('val-tabs-opacity-wallpapers');
        if (vTabsW) vTabsW.textContent = val + '%';

        document.documentElement.style.setProperty('--tabs-opacity', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Sidebar opacity slider
    const sSideOp = document.getElementById('slider-sidebar-opacity');
    if (sSideOp) {
      sSideOp.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.sidebarOpacity = val;
        const vSideOp = document.getElementById('val-sidebar-opacity');
        if (vSideOp) vSideOp.textContent = val + '%';
        const sSideW = document.getElementById('slider-sidebar-opacity-wallpapers');
        if (sSideW) sSideW.value = val;
        const vSideW = document.getElementById('val-sidebar-opacity-wallpapers');
        if (vSideW) vSideW.textContent = val + '%';

        document.documentElement.style.setProperty('--sidebar-opacity', (val / 100).toString());
        document.documentElement.style.setProperty('--topbar-opacity', (Math.min(100, val + 5) / 100).toString());
        saveCurrentSettings();
      });
    }

    // Card opacity slider
    const sCardOp = document.getElementById('slider-card-opacity');
    if (sCardOp) {
      sCardOp.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.cardOpacity = val;
        const vCardOp = document.getElementById('val-card-opacity');
        if (vCardOp) vCardOp.textContent = val + '%';
        const sCardW = document.getElementById('slider-card-opacity-wallpapers');
        if (sCardW) sCardW.value = val;
        const vCardW = document.getElementById('val-card-opacity-wallpapers');
        if (vCardW) vCardW.textContent = val + '%';

        document.documentElement.style.setProperty('--card-opacity', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Glass blur slider
    const sGlassBl = document.getElementById('slider-glass-blur');
    if (sGlassBl) {
      sGlassBl.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.glassBlur = val;
        document.getElementById('val-glass-blur').textContent = val + 'px';
        document.documentElement.style.setProperty('--glass-blur', val + 'px');
        saveCurrentSettings();
      });
    }

    // Wallpaper opacity slider in settings
    const sBgOpSet = document.getElementById('slider-bg-opacity-settings');
    if (sBgOpSet) {
      sBgOpSet.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.wallpaperOpacity = val;
        document.getElementById('val-bg-opacity-settings').textContent = val + '%';
        const sBg = document.getElementById('slider-bg-opacity');
        if (sBg) sBg.value = val;
        const vBg = document.getElementById('val-bg-opacity');
        if (vBg) vBg.textContent = val + '%';

        document.documentElement.style.setProperty('--bg-wallpaper-opacity', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Wallpaper brightness slider in settings
    const sBrightSet = document.getElementById('slider-bg-brightness-settings');
    if (sBrightSet) {
      sBrightSet.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        settings.wallpaperBrightness = val;
        document.getElementById('val-bg-brightness-settings').textContent = val + '%';
        const sBrightW = document.getElementById('slider-bg-brightness');
        if (sBrightW) sBrightW.value = val;
        const vBrightW = document.getElementById('val-bg-brightness');
        if (vBrightW) vBrightW.textContent = val + '%';

        document.documentElement.style.setProperty('--bg-wallpaper-brightness', (val / 100).toString());
        saveCurrentSettings();
      });
    }

    // Wallpaper Scaling Mode in Settings
    const selFitSet = document.getElementById('select-wallpaper-fit-settings');
    if (selFitSet) {
      selFitSet.addEventListener('change', (e) => {
        const val = e.target.value;
        settings.wallpaperFit = val;
        const selFitW = document.getElementById('select-wallpaper-fit');
        if (selFitW) selFitW.value = val;
        document.documentElement.style.setProperty('--bg-wallpaper-fit', val);
        saveCurrentSettings();
      });
    }

    // UI Sounds checkbox
    const checkSounds = document.getElementById('check-ui-sounds');
    if (checkSounds) {
      checkSounds.addEventListener('change', (e) => {
        settings.uiSounds = e.target.checked;
        themeEngine.sounds.enabled = settings.uiSounds;
        saveCurrentSettings();
        showToast(settings.uiSounds ? 'Звуки включены' : 'Звуки выключены');
      });
    }

    // Autolock timer
    const selectTimer = document.getElementById('select-autolock-timer');
    if (selectTimer) {
      selectTimer.addEventListener('change', (e) => {
        settings.autolockTimer = parseInt(e.target.value, 10);
        saveCurrentSettings();
        resetInactivityTimer();
        showToast('Параметры автоблокировки сохранены');
      });
    }

    // Export Backup
    document.getElementById('btn-export-backup').addEventListener('click', async () => {
      if (!window.aegis) return;
      themeEngine.sounds.playClick();
      const rawEnc = await window.aegis.readVault();
      if (!rawEnc) {
        showToast('Хранилище пусто');
        return;
      }
      const blob = new Blob([rawEnc], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `aegis_vault_backup_${Date.now()}.json`;
      a.click();
      showToast('Резервная копия сохранена');
    });

    // Import Backup
    document.getElementById('btn-import-backup').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,.aegis';
      inp.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          let itemsToSet = [];
          if (Array.isArray(parsed)) itemsToSet = parsed;
          else if (parsed && Array.isArray(parsed.items)) itemsToSet = parsed.items;

          if (itemsToSet.length > 0) {
            vaultItems = itemsToSet;
            await persistVaultToDisk();
            renderCardsGrid();
            updateStorageStats();
            showToast('База данных успешно импортирована');
          } else {
            showToast('Файл не содержит корректных записей');
          }
        } catch (err) {
          showToast('Ошибка при чтении файла');
        }
      };
      inp.click();
    });

    // Open Web Vault Server in browser
    const btnOpenServerWeb = document.getElementById('btn-open-server-web');
    if (btnOpenServerWeb) {
      btnOpenServerWeb.addEventListener('click', () => {
        if (themeEngine && themeEngine.sounds) themeEngine.sounds.playClick();
        if (window.aegis && window.aegis.openExternal) {
          window.aegis.openExternal('http://127.0.0.1:8088');
        } else {
          window.open('http://127.0.0.1:8088', '_blank');
        }
      });
    }
  }

  async function updateStorageStats() {
    const total = vaultItems.length;
    const games = vaultItems.filter(i => i.category === 'games').length;
    const accounts = vaultItems.filter(i => i.category === 'accounts').length;
    const cards = vaultItems.filter(i => i.category === 'cards').length;
    const notes = vaultItems.filter(i => i.category === 'notes').length;

    const sTotal = document.getElementById('stat-total-items');
    if (sTotal) sTotal.textContent = total;
    const sGames = document.getElementById('stat-games-items');
    if (sGames) sGames.textContent = games;
    const sAcc = document.getElementById('stat-accounts-items');
    if (sAcc) sAcc.textContent = accounts;
    const sCards = document.getElementById('stat-cards-items');
    if (sCards) sCards.textContent = cards;
    const sNotes = document.getElementById('stat-notes-items');
    if (sNotes) sNotes.textContent = notes;

    if (window.aegis && window.aegis.getStorageInfo) {
      try {
        const info = await window.aegis.getStorageInfo();
        if (info.ok) {
          const sPath = document.getElementById('storage-file-path');
          if (sPath) sPath.textContent = info.path;
          const sSize = document.getElementById('stat-storage-size');
          if (sSize) sSize.textContent = info.sizeFormatted;
        }
      } catch (e) {}
    }
  }

  // ==============================================================================
  // MODAL WINDOW (ADD / EDIT ENTRY & PC GAME PICKER)
  // ==============================================================================
  function setupModal() {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    const btnCancel = document.getElementById('btn-form-cancel');
    const btnClose = document.getElementById('btn-modal-close');
    const btnGenPass = document.getElementById('btn-form-gen-pass');
    const btnSelectExe = document.getElementById('btn-select-game-exe');

    const closeModal = () => {
      modal.classList.remove('active');
      form.reset();
    };

    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);

    // Escape key closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    // Clicking overlay backdrop closes modal
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    btnGenPass.addEventListener('click', () => {
      themeEngine.sounds.playClick();
      const pass = window.PasswordGenerator.generate({ length: 18 });
      document.getElementById('form-password').value = pass;
    });

    // Select game executable (.exe / .lnk) from disk
    if (btnSelectExe) {
      btnSelectExe.addEventListener('click', async () => {
        themeEngine.sounds.playClick();
        if (window.aegis && window.aegis.selectGameExe) {
          const res = await window.aegis.selectGameExe();
          if (res.ok && res.name) {
            document.getElementById('form-title').value = res.name;
            showToast('Выбрана игра: ' + res.name);
          }
        }
      });
    }

    // Popular game chips
    document.querySelectorAll('.kpm-game-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const title = chip.getAttribute('data-title');
        document.getElementById('form-title').value = title;
        showToast('Выбрана игра: ' + title);
      });
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const editId = document.getElementById('form-item-id').value;
      const title = document.getElementById('form-title').value.trim();
      const category = document.getElementById('form-item-category').value || 'accounts';
      const username = document.getElementById('form-username').value.trim();
      const password = document.getElementById('form-password').value;
      const url = document.getElementById('form-url').value.trim();
      const notes = document.getElementById('form-notes').value.trim();

      if (!title || !username) {
        showToast('Заполните обязательные поля');
        return;
      }

      themeEngine.sounds.playSuccess();

      if (editId) {
        const idx = vaultItems.findIndex(it => it.id === editId);
        if (idx !== -1) {
          vaultItems[idx] = Object.assign(vaultItems[idx], {
            title, category, username, password, url, notes, updatedAt: Date.now()
          });
        }
        showToast('Запись обновлена');
      } else {
        const newItem = {
          id: 'item_' + Date.now(),
          title, category, username, password, url, notes,
          favorite: false,
          createdAt: Date.now()
        };
        vaultItems.unshift(newItem);
        showToast('Запись сохранена');
      }

      await persistVaultToDisk();
      closeModal();
      renderCardsGrid();
      updateStorageStats();
    });
  }

  function openAddModal() {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    form.reset();

    document.getElementById('form-item-id').value = '';
    document.getElementById('modal-heading-text').textContent = 'Новая запись';

    // Target category is determined by the current view tab
    let targetCategory = (currentCategory === 'all') ? 'accounts' : currentCategory;
    configureModalForCategory(targetCategory);

    modal.classList.add('active');
    setTimeout(() => {
      document.getElementById('form-title').focus();
    }, 50);
  }

  function openEditModal(item) {
    const modal = document.getElementById('item-modal');
    document.getElementById('item-form').reset();

    document.getElementById('form-item-id').value = item.id;
    document.getElementById('modal-heading-text').textContent = 'Редактировать запись';

    configureModalForCategory(item.category || 'accounts');

    document.getElementById('form-title').value = item.title || '';
    document.getElementById('form-username').value = item.username || '';
    document.getElementById('form-password').value = item.password || '';
    document.getElementById('form-url').value = item.url || '';
    document.getElementById('form-notes').value = item.notes || '';

    modal.classList.add('active');
  }

  function configureModalForCategory(cat) {
    document.getElementById('form-item-category').value = cat;

    const badge = document.getElementById('modal-category-badge');
    const gameHelper = document.getElementById('modal-game-helper');
    const groupUrl = document.getElementById('group-form-url');
    const labelTitle = document.getElementById('label-form-title');
    const inputTitle = document.getElementById('form-title');
    const labelUser = document.getElementById('label-form-username');
    const inputUser = document.getElementById('form-username');
    const labelPass = document.getElementById('label-form-password');

    if (badge) {
      badge.textContent = CATEGORY_NAMES[cat] || 'Запись';
    }

    if (cat === 'games') {
      gameHelper.style.display = 'flex';
      groupUrl.style.display = 'none';
      labelTitle.textContent = 'Название игры';
      inputTitle.placeholder = 'Steam, Roblox, Dota 2, CS2, Cyberpunk 2077...';
      labelUser.textContent = 'Логин / Никнейм / Steam ID';
      inputUser.placeholder = 'Игровой логин или никнейм...';
      labelPass.textContent = 'Пароль к игре';
    } else if (cat === 'cards') {
      gameHelper.style.display = 'none';
      groupUrl.style.display = 'none';
      labelTitle.textContent = 'Название банка / карты';
      inputTitle.placeholder = 'Т-Банк, Сбербанк, Альфа-Банк, Mir...';
      labelUser.textContent = 'Номер карты';
      inputUser.placeholder = '0000 0000 0000 0000';
      labelPass.textContent = 'Срок и CVV код';
    } else if (cat === 'notes') {
      gameHelper.style.display = 'none';
      groupUrl.style.display = 'none';
      labelTitle.textContent = 'Заголовок заметки';
      inputTitle.placeholder = 'Секретный код, пароли от роутера, заметка...';
      labelUser.textContent = 'Метка / Тема';
      inputUser.placeholder = 'Личное, Работа, Сервер...';
      labelPass.textContent = 'Секретный код / PIN (необязательно)';
    } else {
      // Accounts & default
      gameHelper.style.display = 'none';
      groupUrl.style.display = 'flex';
      labelTitle.textContent = 'Название сервиса / сайта';
      inputTitle.placeholder = 'Discord, Google, Telegram, VK, GitHub...';
      labelUser.textContent = 'Логин / Email / Телефон';
      inputUser.placeholder = 'user@example.com';
      labelPass.textContent = 'Пароль';
    }
  }

  // ==============================================================================
  // LOCK SCREEN & INSTANT ACCESS AUTH (NO PASSWORD REQUIRED)
  // ==============================================================================
  function setupLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    const lockForm = document.getElementById('lock-form');
    const passInput = document.getElementById('master-password-input');
    const errMsg = document.getElementById('lock-error-msg');

    if (passInput) {
      passInput.removeAttribute('required');
      passInput.removeAttribute('minlength');
      passInput.placeholder = 'Нажмите «Разблокировать» или Enter...';
    }

    lockForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (errMsg) errMsg.style.display = 'none';
      if (passInput) passInput.value = '';
      lockScreen.classList.add('unlocked');
      themeEngine.sounds.playSuccess();
      showToast('Доступ открыт');
      renderCardsGrid();
    });
  }

  function lockVault() {
    themeEngine.sounds.playClick();
    const lockScreen = document.getElementById('lock-screen');
    if (lockScreen) lockScreen.classList.remove('unlocked');
    const passInput = document.getElementById('master-password-input');
    if (passInput) {
      passInput.value = '';
      passInput.focus();
    }
  }

  async function persistVaultToDisk() {
    try {
      if (window.aegis) {
        await window.aegis.saveVault(JSON.stringify(vaultItems, null, 2));
      }
    } catch (e) {
      console.error('Failed to save vault:', e);
    }
  }

  // Inactivity auto-lock
  function resetInactivityTimer() {
    if (autolockTimeout) clearTimeout(autolockTimeout);
    if (!settings.autolockTimer || settings.autolockTimer === 0) return;

    autolockTimeout = setTimeout(() => {
      lockVault();
    }, settings.autolockTimer * 60 * 1000);
  }

  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetInactivityTimer, { passive: true });
  });

  // Toast Helper
  let toastTimer = null;
  function showToast(text) {
    const toast = document.getElementById('toast-box');
    const toastText = document.getElementById('toast-text');
    if (!toast || !toastText) return;

    toastText.textContent = text;
    toast.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

})();