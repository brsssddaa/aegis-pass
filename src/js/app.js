// ==============================================================================
// AEGIS PASS // MASTER APPLICATION CONTROLLER & KASPERSKY-STYLE UI
// ==============================================================================

(function() {
  'use strict';

  let vaultEngine = null;
  let themeEngine = null;

  let vaultItems = [];
  let currentCategory = 'accounts'; // 'all' | 'accounts' | 'cards' | 'files' | 'addresses' | 'notes' | 'dashboard'
  let currentFilter = 'all'; // 'all' | 'recent' | 'favorites'
  let currentSearchQuery = '';
  let isGridView = true;

  let settings = {
    theme: 'emerald',
    activeWallpaperId: 'anime_companion.jpg',
    wallpaperOpacity: 25,
    wallpaperBlur: 10,
    autolockTimer: 5
  };

  let autolockTimeout = null;

  // Initialize App
  document.addEventListener('DOMContentLoaded', async () => {
    vaultEngine = new window.CryptoVaultEngine();
    themeEngine = new window.ThemeEngine();

    // Load persisted settings
    if (window.aegis) {
      const saved = await window.aegis.readSettings();
      if (saved) {
        settings = Object.assign(settings, saved);
      }
    }

    applySettingsToUi();
    setupNavigation();
    setupTopBar();
    setupVaultCardActions();
    setupWallpapersManager();
    setupAuthenticator();
    setupSecurityCheck();
    setupGenerator();
    setupSettingsTab();
    setupModal();
    setupLockScreen();
    resetInactivityTimer();
  });

  // Apply visual settings
  function applySettingsToUi() {
    themeEngine.applyPalette(settings.theme || 'emerald');

    // Update active swatch
    document.querySelectorAll('.kpm-swatch-circle').forEach(sw => {
      sw.classList.toggle('active', sw.getAttribute('data-color') === settings.theme);
    });

    // Wallpaper layer settings
    const root = document.documentElement;
    root.style.setProperty('--bg-wallpaper-opacity', (settings.wallpaperOpacity / 100).toString());
    root.style.setProperty('--bg-wallpaper-blur', settings.wallpaperBlur + 'px');

    const sOp = document.getElementById('slider-bg-opacity');
    if (sOp) sOp.value = settings.wallpaperOpacity;
    const vOp = document.getElementById('val-bg-opacity');
    if (vOp) vOp.textContent = settings.wallpaperOpacity + '%';

    const sBl = document.getElementById('slider-bg-blur');
    if (sBl) sBl.value = settings.wallpaperBlur;
    const vBl = document.getElementById('val-bg-blur');
    if (vBl) vBl.textContent = settings.wallpaperBlur + 'px';

    const sLock = document.getElementById('select-autolock-timer');
    if (sLock) sLock.value = settings.autolockTimer;

    applyWallpaperBackground(settings.activeWallpaperId);
  }

  function applyWallpaperBackground(wallpaperId) {
    const bgImg = document.getElementById('kpm-bg-img');
    if (!bgImg) return;

    if (!wallpaperId || wallpaperId === 'none') {
      bgImg.classList.remove('active');
      bgImg.src = '';
    } else {
      // In electron, files from userData/wallpapers are file:/// URLs
      if (window.aegis) {
        window.aegis.listWallpapers().then(list => {
          const found = list.find(w => w.id === wallpaperId || w.fileName === wallpaperId);
          if (found) {
            bgImg.src = found.fileUrl;
            bgImg.classList.add('active');
          } else {
            bgImg.classList.remove('active');
          }
        });
      }
    }
  }

  async function saveCurrentSettings() {
    if (window.aegis) {
      await window.aegis.saveSettings(settings);
    }
  }

  // ==============================================================================
  // NAVIGATION & VIEW SWITCHER
  // ==============================================================================
  const CATEGORY_NAMES = {
    'dashboard': 'Главная',
    'all': 'Все записи',
    'accounts': 'Аккаунты',
    'cards': 'Банковские карты',
    'files': 'Файлы',
    'addresses': 'Адреса',
    'notes': 'Заметки',
    'authenticator': 'Аутентификатор (2FA)',
    'passkeys': 'Ключи доступа',
    'security-check': 'Проверка паролей',
    'generator': 'Генератор паролей',
    'wallpapers': 'Обои и Темы',
    'settings': 'Настройки'
  };

  function setupNavigation() {
    const menuItems = document.querySelectorAll('.kpm-menu-item');
    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const view = item.getAttribute('data-view');
        switchMainView(view);
      });
    });

    document.getElementById('btn-nav-wallpapers').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      switchMainView('wallpapers');
    });

    document.getElementById('btn-nav-settings').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      switchMainView('settings');
    });

    document.getElementById('btn-nav-lock').addEventListener('click', () => {
      lockVault();
    });
  }

  function switchMainView(viewKey) {
    // Highlight sidebar items
    document.querySelectorAll('.kpm-menu-item').forEach(i => {
      i.classList.toggle('active', i.getAttribute('data-view') === viewKey);
    });

    const isWallpapers = (viewKey === 'wallpapers');
    const isSettings = (viewKey === 'settings');
    document.getElementById('btn-nav-wallpapers').classList.toggle('active', isWallpapers);
    document.getElementById('btn-nav-settings').classList.toggle('active', isSettings);

    // Update section title in topbar
    const titleEl = document.getElementById('view-title');
    if (titleEl) {
      titleEl.textContent = CATEGORY_NAMES[viewKey] || 'Записи';
    }

    // Toggle add button text
    const addLabel = document.getElementById('btn-add-entry-label');
    const addBtn = document.getElementById('btn-add-entry');
    const filterBar = document.getElementById('filter-pills-bar');

    if (viewKey === 'wallpapers' || viewKey === 'settings' || viewKey === 'generator') {
      if (addBtn) addBtn.style.display = 'none';
      if (filterBar) filterBar.style.display = 'none';
    } else {
      if (addBtn) addBtn.style.display = 'inline-flex';
      if (filterBar) filterBar.style.display = 'flex';
      if (addLabel) {
        if (viewKey === 'cards') addLabel.textContent = 'Добавить карту';
        else if (viewKey === 'notes') addLabel.textContent = 'Добавить заметку';
        else addLabel.textContent = 'Добавить аккаунт';
      }
    }

    // Hide all view panes
    document.querySelectorAll('.kpm-view-pane').forEach(p => p.classList.remove('active'));

    // Show selected pane
    if (viewKey === 'authenticator') {
      document.getElementById('pane-authenticator').classList.add('active');
      renderAuthenticatorList();
    } else if (viewKey === 'passkeys') {
      document.getElementById('pane-passkeys').classList.add('active');
      renderPasskeysList();
    } else if (viewKey === 'security-check') {
      document.getElementById('pane-security-check').classList.add('active');
      renderSecurityCheck();
    } else if (viewKey === 'generator') {
      document.getElementById('pane-generator').classList.add('active');
      refreshGenerator();
    } else if (viewKey === 'wallpapers') {
      document.getElementById('pane-wallpapers').classList.add('active');
      renderWallpapersGallery();
    } else if (viewKey === 'settings') {
      document.getElementById('pane-settings').classList.add('active');
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
    'google': { bg: 'rgba(234,67,53,0.16)', color: '#ea4335' },
    'github': { bg: 'rgba(255,255,255,0.12)', color: '#ffffff' },
    'yandex': { bg: 'rgba(252,63,29,0.18)', color: '#fc3f1d' },
    'telegram': { bg: 'rgba(36,161,222,0.18)', color: '#24A1DE' },
    'vk': { bg: 'rgba(0,119,255,0.18)', color: '#0077ff' },
    'bank': { bg: 'rgba(16,185,129,0.18)', color: '#10b981' }
  };

  function getServiceColor(title) {
    const t = (title || '').toLowerCase();
    for (const [key, val] of Object.entries(SERVICE_COLORS)) {
      if (t.includes(key)) return val;
    }
    return { bg: 'rgba(255,255,255,0.08)', color: '#ffffff' };
  }

  function renderCardsGrid() {
    const container = document.getElementById('kpm-cards-container');
    if (!container) return;

    // Filter items
    let items = vaultItems.slice();

    // 1. Category Filter
    if (currentCategory !== 'all' && currentCategory !== 'dashboard') {
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
      container.innerHTML = `
        <div class="kpm-empty-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div class="kpm-empty-title">Записей не найдено</div>
          <div class="kpm-empty-subtitle">Нажмите кнопку «Добавить аккаунт», чтобы сохранить новый пароль.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const servColor = getServiceColor(item.title);
      const isWeak = !item.password || item.password.length < 10;
      const initial = (item.title || 'A').charAt(0).toUpperCase();

      return `
        <div class="kpm-card" data-id="${item.id}">
          <div class="kpm-card-header">
            <div class="kpm-card-service">
              <div class="kpm-service-icon" style="background: ${servColor.bg}; color: ${servColor.color};">
                ${initial}
              </div>
              <div class="kpm-card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
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
            <div class="kpm-field-row">
              <div class="kpm-field-mono" title="${escapeHtml(item.username)}">${escapeHtml(item.username)}</div>
              <button class="kpm-field-copy-btn" data-action="copy-user" data-id="${item.id}" title="Скопировать логин">
                <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>

            <div class="kpm-field-row">
              <div class="kpm-field-mono kpm-pass-masked" id="pass-field-${item.id}">••••••••••••••••</div>
              <div class="kpm-field-buttons">
                <button class="kpm-field-reveal-btn" data-action="reveal-pass" data-id="${item.id}" title="Показать пароль">
                  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="kpm-field-copy-btn" data-action="copy-pass" data-id="${item.id}" title="Скопировать пароль">
                  <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="kpm-card-footer">
            ${isWeak ? `
              <div class="kpm-card-status warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Проблемы с паролем</span>
              </div>
            ` : `
              <div class="kpm-card-status good">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                <span>Криптостойкий</span>
              </div>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  function updateSidebarCounters() {
    const badgeAll = document.getElementById('badge-count-all');
    if (badgeAll) badgeAll.textContent = vaultItems.length;

    const badgeAcc = document.getElementById('badge-count-accounts');
    if (badgeAcc) badgeAcc.textContent = vaultItems.filter(i => i.category === 'accounts').length;

    const badgeCards = document.getElementById('badge-count-cards');
    if (badgeCards) badgeCards.textContent = vaultItems.filter(i => i.category === 'cards').length;

    // Security alert dot if any weak password exists
    const hasWeak = vaultItems.some(i => !i.password || i.password.length < 10);
    const dot = document.getElementById('dot-security-alert');
    if (dot) dot.style.display = hasWeak ? 'inline-block' : 'none';
  }

  // Card Event Delegations
  function setupVaultCardActions() {
    const container = document.getElementById('kpm-cards-container');
    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      const item = vaultItems.find(it => it.id === id);
      if (!item) return;

      // 1. Star / Favorite Toggle
      if (action === 'toggle-star') {
        themeEngine.sounds.playClick();
        item.favorite = !item.favorite;
        await persistVaultToDisk();
        renderCardsGrid();
        showToast(item.favorite ? 'Добавлено в избранное' : 'Удалено из избранного');
      }

      // 2. Copy Username
      else if (action === 'copy-user') {
        themeEngine.sounds.playCopy();
        if (window.aegis) {
          window.aegis.copyText(item.username);
        } else {
          navigator.clipboard.writeText(item.username);
        }
        showToast('Логин скопирован');
      }

      // 3. Copy Password
      else if (action === 'copy-pass') {
        themeEngine.sounds.playCopy();
        if (window.aegis) {
          window.aegis.copyText(item.password);
        } else {
          navigator.clipboard.writeText(item.password);
        }
        showToast('Пароль скопирован');
      }

      // 4. Reveal Password Toggle
      else if (action === 'reveal-pass') {
        themeEngine.sounds.playClick();
        const passEl = document.getElementById(`pass-field-${id}`);
        if (passEl) {
          if (passEl.classList.contains('revealed')) {
            passEl.classList.remove('revealed');
            passEl.textContent = '••••••••••••••••';
          } else {
            passEl.classList.add('revealed');
            passEl.textContent = item.password;
          }
        }
      }

      // 5. Card Menu (Edit / Delete)
      else if (action === 'card-menu') {
        themeEngine.sounds.playClick();
        openEditModal(item);
      }
    });
  }

  // ==============================================================================
  // WALLPAPERS & PROFILES MANAGER (like in C:\Scripts\minecraft-ai-bot)
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

    // Sliders
    const sliderOp = document.getElementById('slider-bg-opacity');
    sliderOp.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      settings.wallpaperOpacity = val;
      document.getElementById('val-bg-opacity').textContent = val + '%';
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

    // Color Swatches (without names)
    document.querySelectorAll('.kpm-swatch-circle').forEach(sw => {
      sw.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const colorKey = sw.getAttribute('data-color');
        document.querySelectorAll('.kpm-swatch-circle').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
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
  // COOL EXTRA: 2FA AUTHENTICATOR (TOTP SIMULATOR)
  // ==============================================================================
  let totpInterval = null;
  const DEMO_TOTP = [
    { id: 'totp_1', service: 'Discord', account: 'hddfi@yandex.ru', secret: 'JBSWY3DPEHPK3PXP' },
    { id: 'totp_2', service: 'Steam Guard', account: 'Motewj', secret: 'KRSXG5CTMVRXEZLU' },
    { id: 'totp_3', service: 'GitHub', account: 'brsssddaa', secret: 'MZXW633PN5XW6MZX' },
    { id: 'totp_4', service: 'Epic Games', account: 'genius.pro@mail.ru', secret: 'NBSWY3DPEHPK3PXP' }
  ];

  function setupAuthenticator() {
    if (totpInterval) clearInterval(totpInterval);
    totpInterval = setInterval(() => {
      updateTotpTimer();
    }, 1000);
  }

  function getPseudoTotp(secret, epoch30) {
    let hash = 0;
    const str = secret + epoch30;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    const code = Math.abs(hash % 1000000).toString().padStart(6, '0');
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }

  function updateTotpTimer() {
    const epochSec = Math.floor(Date.now() / 1000);
    const remaining = 30 - (epochSec % 30);
    const epochStep = Math.floor(epochSec / 30);

    document.querySelectorAll('.kpm-totp-timer').forEach(el => {
      el.textContent = remaining;
    });

    document.querySelectorAll('.kpm-totp-code').forEach(el => {
      const secret = el.getAttribute('data-secret');
      if (secret) {
        el.textContent = getPseudoTotp(secret, epochStep);
      }
    });
  }

  function renderAuthenticatorList() {
    const list = document.getElementById('kpm-totp-list');
    if (!list) return;

    const epochSec = Math.floor(Date.now() / 1000);
    const remaining = 30 - (epochSec % 30);
    const epochStep = Math.floor(epochSec / 30);

    list.innerHTML = DEMO_TOTP.map(t => `
      <div class="kpm-totp-card">
        <div>
          <div style="font-weight: 700; font-size: 14.5px; color: #fff;">${t.service}</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">${t.account}</div>
          <div class="kpm-totp-code" data-secret="${t.secret}" style="margin-top: 8px;">
            ${getPseudoTotp(t.secret, epochStep)}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="kpm-totp-timer">${remaining}</div>
          <button class="kpm-btn-secondary btn-copy-totp" data-secret="${t.secret}">Скопировать код</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.btn-copy-totp').forEach(btn => {
      btn.addEventListener('click', () => {
        themeEngine.sounds.playCopy();
        const sec = btn.getAttribute('data-secret');
        const epoch = Math.floor(Math.floor(Date.now() / 1000) / 30);
        const code = getPseudoTotp(sec, epoch).replace(/\s/g, '');
        if (window.aegis) window.aegis.copyText(code);
        else navigator.clipboard.writeText(code);
        showToast('Код 2FA скопирован');
      });
    });
  }

  // ==============================================================================
  // COOL EXTRA: PASSKEYS LIST
  // ==============================================================================
  const DEMO_PASSKEYS = [
    { title: 'Google Account', user: 'MatveYchampege138@gmail.com', type: 'Windows Hello / TPM 2.0', created: '14.10.2026' },
    { title: 'GitHub Security', user: 'brsssddaa', type: 'FIDO2 Security Key', created: '20.09.2026' },
    { title: 'Microsoft Account', user: 'hddfi@live.com', type: 'Passkey PIN Auth', created: '02.11.2026' }
  ];

  function renderPasskeysList() {
    const list = document.getElementById('kpm-passkeys-list');
    if (!list) return;

    list.innerHTML = DEMO_PASSKEYS.map(pk => `
      <div class="kpm-field-row" style="padding: 14px 18px; margin-bottom: 10px;">
        <div>
          <div style="font-weight: 700; color: #fff; font-size: 14px;">${pk.title}</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 2px;">${pk.user} · ${pk.type}</div>
        </div>
        <span style="font-size: 11px; font-weight: 700; color: var(--accent-light); background: rgba(0,214,143,0.12); padding: 4px 10px; border-radius: 12px;">Активен</span>
      </div>
    `).join('');
  }

  // ==============================================================================
  // SECURITY CHECK
  // ==============================================================================
  function renderSecurityCheck() {
    const container = document.getElementById('security-issues-list');
    const badge = document.getElementById('security-score-badge');
    if (!container) return;

    const weakItems = vaultItems.filter(i => !i.password || i.password.length < 10);
    const total = vaultItems.length;
    const score = total === 0 ? 100 : Math.round(((total - weakItems.length) / total) * 100);

    if (badge) badge.textContent = `${score}%`;

    if (weakItems.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--accent-primary);">
          <div style="font-size: 16px; font-weight: 700; margin-bottom: 6px;">Все пароли надежны</div>
          <div style="font-size: 12.5px; color: var(--text-dim);">Никаких уязвимых паролей в базе не обнаружено.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = weakItems.map(it => `
      <div class="kpm-field-row" style="padding: 12px 16px; margin-bottom: 10px;">
        <div>
          <div style="font-weight: 700; color: #fff;">${escapeHtml(it.title)}</div>
          <div style="font-size: 12px; color: var(--color-danger); margin-top: 2px;">Пароль короче 10 символов</div>
        </div>
        <button class="kpm-btn-primary btn-fix-pass" data-id="${it.id}" style="padding: 5px 12px; font-size: 12px;">
          Сгенерировать надежный
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-fix-pass').forEach(btn => {
      btn.addEventListener('click', async () => {
        themeEngine.sounds.playSuccess();
        const id = btn.getAttribute('data-id');
        const item = vaultItems.find(i => i.id === id);
        if (item) {
          item.password = window.PasswordGenerator.generate({ length: 20 });
          await persistVaultToDisk();
          renderSecurityCheck();
          showToast('Пароль обновлен на криптостойкий');
        }
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
  // SETTINGS & BACKUP
  // ==============================================================================
  function setupSettingsTab() {
    // Autolock timer
    const selectTimer = document.getElementById('select-autolock-timer');
    selectTimer.addEventListener('change', (e) => {
      settings.autolockTimer = parseInt(e.target.value, 10);
      saveCurrentSettings();
      resetInactivityTimer();
      showToast('Настройки сохранены');
    });

    // Change Master Password
    document.getElementById('form-change-master').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('input-new-master');
      const newPass = input.value;
      if (newPass.length < 8) {
        showToast('Пароль должен содержать минимум 8 символов');
        return;
      }

      await vaultEngine.initNewVault(newPass);
      await persistVaultToDisk();
      input.value = '';
      showToast('Мастер-пароль успешно изменен');
    });

    // Export Backup
    document.getElementById('btn-export-backup').addEventListener('click', async () => {
      if (!window.aegis) return;
      const rawEnc = await window.aegis.readVault();
      if (!rawEnc) {
        showToast('Хранилище пусто');
        return;
      }
      const blob = new Blob([rawEnc], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `aegis_vault_backup_${Date.now()}.aegis`;
      a.click();
      showToast('Зашифрованная резервная копия выгружена');
    });

    // Import Backup
    document.getElementById('btn-import-backup').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.aegis,.json';
      inp.onchange = async (ev) => {
        const file = ev.target.files[0];
        if (!file) return;
        const text = await file.text();
        if (window.aegis) {
          await window.aegis.saveVault(text);
          showToast('База импортирована. Выполните вход.');
          lockVault();
        }
      };
      inp.click();
    });
  }

  // ==============================================================================
  // MODAL WINDOW (ADD / EDIT ENTRY)
  // ==============================================================================
  function setupModal() {
    const modal = document.getElementById('item-modal');
    const form = document.getElementById('item-form');
    const btnCancel = document.getElementById('btn-form-cancel');
    const btnClose = document.getElementById('btn-modal-close');
    const btnGenPass = document.getElementById('btn-form-gen-pass');

    const closeModal = () => {
      modal.classList.remove('active');
      form.reset();
    };

    btnCancel.addEventListener('click', closeModal);
    btnClose.addEventListener('click', closeModal);

    btnGenPass.addEventListener('click', () => {
      themeEngine.sounds.playClick();
      const pass = window.PasswordGenerator.generate({ length: 18 });
      document.getElementById('form-password').value = pass;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      themeEngine.sounds.playSuccess();

      const editId = document.getElementById('form-item-id').value;
      const title = document.getElementById('form-title').value.trim();
      const category = document.getElementById('form-category').value;
      const username = document.getElementById('form-username').value.trim();
      const password = document.getElementById('form-password').value;
      const url = document.getElementById('form-url').value.trim();
      const notes = document.getElementById('form-notes').value.trim();

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
        showToast('Аккаунт добавлен');
      }

      await persistVaultToDisk();
      closeModal();
      renderCardsGrid();
    });
  }

  function openAddModal() {
    document.getElementById('form-item-id').value = '';
    document.getElementById('modal-heading-text').textContent = 'Новая запись';
    document.getElementById('item-form').reset();
    document.getElementById('form-category').value = currentCategory === 'all' ? 'accounts' : currentCategory;
    document.getElementById('item-modal').classList.add('active');
  }

  function openEditModal(item) {
    document.getElementById('form-item-id').value = item.id;
    document.getElementById('modal-heading-text').textContent = 'Редактировать запись';
    document.getElementById('form-title').value = item.title || '';
    document.getElementById('form-category').value = item.category || 'accounts';
    document.getElementById('form-username').value = item.username || '';
    document.getElementById('form-password').value = item.password || '';
    document.getElementById('form-url').value = item.url || '';
    document.getElementById('form-notes').value = item.notes || '';
    document.getElementById('item-modal').classList.add('active');
  }

  // ==============================================================================
  // LOCK SCREEN & ZERO-KNOWLEDGE AUTH
  // ==============================================================================
  function setupLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    const lockForm = document.getElementById('lock-form');
    const passInput = document.getElementById('master-password-input');
    const errMsg = document.getElementById('lock-error-msg');

    const updateLockUi = async () => {
      try {
        if (window.aegis) {
          const raw = await window.aegis.readVault();
          const sub = document.getElementById('lock-subtitle');
          const btn = document.getElementById('btn-unlock');
          if (!raw) {
            if (sub) sub.textContent = 'Первый запуск: придумайте мастер-пароль (минимум 8 символов)';
            if (btn) btn.textContent = 'Создать и войти';
          } else {
            if (sub) sub.textContent = 'Введите мастер-пароль';
            if (btn) btn.textContent = 'Разблокировать';
          }
        }
      } catch (e) {}
    };
    updateLockUi();

    lockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errMsg.style.display = 'none';
      const masterPassword = passInput.value;
      if (!masterPassword || masterPassword.length < 8) {
        errMsg.textContent = 'Мастер-пароль должен содержать минимум 8 символов';
        errMsg.style.display = 'block';
        themeEngine.sounds.playError();
        return;
      }

      try {
        let rawVault = null;
        if (window.aegis) {
          rawVault = await window.aegis.readVault();
        }

        if (!rawVault) {
          // Initialize fresh vault with seed demo accounts
          await vaultEngine.initNewVault(masterPassword);
          vaultItems = [
            {
              id: 'demo_1',
              title: 'Discord',
              category: 'accounts',
              username: 'hddfi@yandex.ru',
              password: window.PasswordGenerator.generate({ length: 18 }),
              url: 'https://discord.com',
              notes: 'Основной аккаунт',
              favorite: true
            },
            {
              id: 'demo_2',
              title: 'Epic Games Launcher',
              category: 'accounts',
              username: 'genius.pro@mail.ru',
              password: window.PasswordGenerator.generate({ length: 8 }), // will show warning
              url: 'https://epicgames.com',
              notes: 'Игровой профиль',
              favorite: false
            }
          ];
          await persistVaultToDisk();
        } else {
          const payload = JSON.parse(rawVault);
          const decrypted = await vaultEngine.unlock(masterPassword, payload.salt, payload.encrypted);
          vaultItems = decrypted || [];
        }

        // Successfully unlocked
        passInput.value = '';
        lockScreen.classList.add('unlocked');
        themeEngine.sounds.playSuccess();
        showToast('Хранилище успешно разблокировано');
        renderCardsGrid();
      } catch (err) {
        themeEngine.sounds.playError();
        errMsg.textContent = 'Неверный мастер-пароль';
        errMsg.style.display = 'block';
      }
    });
  }

  function lockVault() {
    vaultEngine.lock();
    themeEngine.sounds.playClick();
    document.getElementById('lock-screen').classList.remove('unlocked');
    document.getElementById('master-password-input').value = '';
    document.getElementById('lock-error-msg').style.display = 'none';
  }

  async function persistVaultToDisk() {
    if (!vaultEngine.isUnlocked) return;
    try {
      const encryptedData = await vaultEngine.encryptVault(vaultItems);
      const payload = JSON.stringify({
        salt: vaultEngine.salt,
        encrypted: encryptedData,
        version: 1,
        savedAt: Date.now()
      }, null, 2);

      if (window.aegis) {
        await window.aegis.saveVault(payload);
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
    }, 2500);
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
