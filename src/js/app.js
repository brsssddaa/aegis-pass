// ==============================================================================
// AEGIS PASS // MASTER APPLICATION CONTROLLER & REACTIVE UI LOGIC
// ==============================================================================

(function() {
  'use strict';

  // State Management
  let bgEngine = null;
  let vaultEngine = null;
  let themeEngine = null;

  let vaultItems = [];
  let currentCategory = 'all';
  let selectedItemId = null;
  let isPasswordRevealed = false;

  let settings = {
    theme: 'emerald',
    bgMode: 'quantum-cube',
    bgSpeed: 10,
    glassBlur: 16,
    glassOpacity: 22,
    mouseTilt: true,
    neonGlow: true,
    cyberSfx: true,
    clipboardTimer: 30,
    autolockTimer: 5
  };

  let autolockTimeout = null;

  // Initialize Application
  document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Engines
    bgEngine = new window.CyberBackgroundEngine();
    vaultEngine = new window.CryptoVaultEngine();
    themeEngine = new window.ThemeEngine();

    // 2. Load Persisted Settings
    if (window.aegis) {
      const savedSettings = await window.aegis.readSettings();
      if (savedSettings) {
        settings = Object.assign(settings, savedSettings);
      }
    }
    applyLoadedSettings();

    // 3. Setup Window Controls
    setupWindowControls();

    // 4. Setup Tabs
    setupTabNavigation();

    // 5. Setup Vault & Modal Logic
    setupVaultControls();

    // 6. Setup Generator Tab
    setupGeneratorControls();

    // 7. Setup Customization Controls
    setupCustomizationControls();

    // 8. Setup Lock Screen & Vault Loading
    setupLockScreen();

    // 9. Setup Inactivity Timer
    resetInactivityTimer();
    ['mousemove', 'keydown', 'mousedown', 'touchstart'].forEach(evt => {
      window.addEventListener(evt, resetInactivityTimer, { passive: true });
    });
  });

  function applyLoadedSettings() {
    themeEngine.sounds.enabled = settings.cyberSfx;
    themeEngine.applyTheme(settings.theme, bgEngine);
    themeEngine.setGlassBlur(settings.glassBlur);
    themeEngine.setGlassOpacity(settings.glassOpacity / 100);

    bgEngine.setMode(settings.bgMode);
    bgEngine.setSpeed(settings.bgSpeed / 10);
    bgEngine.setInteractive(settings.mouseTilt);
    bgEngine.setGlow(settings.neonGlow);

    // Reflect in UI controls
    document.querySelectorAll('.theme-card').forEach(c => {
      c.classList.toggle('active', c.getAttribute('data-theme') === settings.theme);
    });

    const modeBtnMap = {
      'quantum-cube': 'btn-mode-cube',
      'cyber-grid': 'btn-mode-grid',
      'stardust': 'btn-mode-stardust',
      'frosted-clean': 'btn-mode-clean'
    };
    Object.entries(modeBtnMap).forEach(([mode, btnId]) => {
      const el = document.getElementById(btnId);
      if (el) el.classList.toggle('active', mode === settings.bgMode);
    });

    const sSpeed = document.getElementById('slider-bg-speed');
    if (sSpeed) sSpeed.value = settings.bgSpeed;
    const sBlur = document.getElementById('slider-glass-blur');
    if (sBlur) sBlur.value = settings.glassBlur;
    const sOpacity = document.getElementById('slider-glass-opacity');
    if (sOpacity) sOpacity.value = settings.glassOpacity;

    const tTilt = document.getElementById('toggle-mouse-tilt');
    if (tTilt) tTilt.checked = settings.mouseTilt;
    const tGlow = document.getElementById('toggle-neon-glow');
    if (tGlow) tGlow.checked = settings.neonGlow;
    const tSfx = document.getElementById('toggle-cyber-sfx');
    if (tSfx) tSfx.checked = settings.cyberSfx;

    const selClip = document.getElementById('select-clipboard-timer');
    if (selClip) selClip.value = settings.clipboardTimer;
    const selLock = document.getElementById('select-autolock-timer');
    if (selLock) selLock.value = settings.autolockTimer;
  }

  function saveSettings() {
    if (window.aegis) {
      window.aegis.saveSettings(settings);
    }
  }

  // ==============================================================================
  // WINDOW CONTROLS
  // ==============================================================================
  function setupWindowControls() {
    if (!window.aegis) return;

    document.getElementById('btn-win-min').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      window.aegis.minimize();
    });

    document.getElementById('btn-win-max').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      window.aegis.maximize();
    });

    document.getElementById('btn-win-close').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      window.aegis.close();
    });

    window.aegis.onClipboardCleared(() => {
      showToast('Буфер обмена безопасно очищен');
    });
  }

  // ==============================================================================
  // TAB NAVIGATION
  // ==============================================================================
  function setupTabNavigation() {
    const tabButtons = document.querySelectorAll('.nav-tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const tabTarget = btn.getAttribute('data-tab');

        tabButtons.forEach(b => b.classList.remove('active'));
        tabPanes.forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetPane = document.getElementById(tabTarget);
        if (targetPane) targetPane.classList.add('active');

        if (tabTarget === 'tab-audit') {
          updateAuditTab();
        }
      });
    });
  }

  // ==============================================================================
  // VAULT & ITEM MANAGEMENT
  // ==============================================================================
  function setupVaultControls() {
    // Categories filter click
    document.querySelectorAll('.cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-category');
        renderVaultList();
      });
    });

    // Search input
    document.getElementById('search-vault-input').addEventListener('input', () => {
      renderVaultList();
    });

    // Add item modal
    document.getElementById('btn-open-add-modal').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      openItemModal(null);
    });

    document.getElementById('btn-modal-close').addEventListener('click', closeItemModal);
    document.getElementById('btn-modal-cancel').addEventListener('click', closeItemModal);

    // Modal submit
    document.getElementById('item-form').addEventListener('submit', (e) => {
      e.preventDefault();
      saveItemFromForm();
    });

    // Quick pass generation in modal
    document.getElementById('btn-form-gen-quick').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      const generated = window.PasswordGenerator.generate({ length: 18 });
      document.getElementById('form-password').value = generated;
    });

    // Detail Pane Buttons
    document.getElementById('btn-toggle-pass-reveal').addEventListener('click', togglePasswordReveal);

    document.getElementById('btn-copy-username').addEventListener('click', () => {
      const item = getSelectedItem();
      if (item && item.username) {
        copyToClipboard(item.username, 'Логин скопирован');
      }
    });

    document.getElementById('btn-copy-password').addEventListener('click', () => {
      const item = getSelectedItem();
      if (item && item.password) {
        copyToClipboard(item.password, 'Пароль скопирован');
      }
    });

    document.getElementById('btn-copy-url').addEventListener('click', () => {
      const item = getSelectedItem();
      if (item && item.url) {
        copyToClipboard(item.url, 'URL скопирован');
      }
    });

    document.getElementById('btn-detail-edit').addEventListener('click', () => {
      const item = getSelectedItem();
      if (item) openItemModal(item);
    });

    document.getElementById('btn-detail-delete').addEventListener('click', () => {
      if (confirm('Удалить эту запись из защищённого сейфа?')) {
        deleteSelectedItem();
      }
    });
  }

  function getSelectedItem() {
    return vaultItems.find(i => i.id === selectedItemId);
  }

  function renderVaultList() {
    const container = document.getElementById('vault-items-container');
    const searchQuery = (document.getElementById('search-vault-input').value || '').toLowerCase().trim();

    let filtered = vaultItems.filter(item => {
      // Category filter
      if (currentCategory === 'favorites' && !item.favorite) return false;
      if (currentCategory !== 'all' && currentCategory !== 'favorites' && item.category !== currentCategory) return false;

      // Search filter
      if (searchQuery) {
        const title = (item.title || '').toLowerCase();
        const user = (item.username || '').toLowerCase();
        const url = (item.url || '').toLowerCase();
        return title.includes(searchQuery) || user.includes(searchQuery) || url.includes(searchQuery);
      }
      return true;
    });

    // Update Counts
    updateCounts();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 40px 10px; font-size: 0.8rem;">
          ${searchQuery ? 'Ничего не найдено по запросу' : 'В этой категории пока нет записей'}
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const isActive = item.id === selectedItemId;
      const iconSvg = getCategoryIconSvg(item.category);

      return `
        <div class="vault-item-card ${isActive ? 'active' : ''}" data-id="${item.id}">
          <div class="item-icon-box">
            ${iconSvg}
          </div>
          <div class="item-content-box">
            <div class="item-card-title">${escapeHtml(item.title)}</div>
            <div class="item-card-sub">${escapeHtml(item.username || item.url || '••••••••')}</div>
          </div>
          ${item.favorite ? '<span style="color: #fbbf24; font-size: 0.75rem;">⭐</span>' : ''}
        </div>
      `;
    }).join('');

    // Attach click listeners to cards
    container.querySelectorAll('.vault-item-card').forEach(card => {
      card.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        const id = card.getAttribute('data-id');
        selectVaultItem(id);
      });
    });
  }

  function selectVaultItem(id) {
    selectedItemId = id;
    isPasswordRevealed = false;
    renderVaultList();
    renderDetailPane();
  }

  function renderDetailPane() {
    const emptyView = document.getElementById('detail-empty-view');
    const activeView = document.getElementById('detail-active-view');
    const item = getSelectedItem();

    if (!item) {
      emptyView.style.display = 'flex';
      activeView.style.display = 'none';
      return;
    }

    emptyView.style.display = 'none';
    activeView.style.display = 'block';

    document.getElementById('detail-title-text').innerText = item.title;
    document.getElementById('detail-category-badge').innerText = item.category ? item.category.toUpperCase() : 'САЙТЫ';
    document.getElementById('detail-username-val').innerText = item.username || '—';
    document.getElementById('detail-url-val').innerText = item.url || '—';
    document.getElementById('detail-notes-val').innerText = item.notes || 'Нет заметок';

    const passField = document.getElementById('detail-password-val');
    passField.innerText = isPasswordRevealed ? item.password : '••••••••••••••••';
  }

  function togglePasswordReveal() {
    themeEngine.sounds.playClick();
    isPasswordRevealed = !isPasswordRevealed;
    const item = getSelectedItem();
    if (item) {
      document.getElementById('detail-password-val').innerText = isPasswordRevealed ? item.password : '••••••••••••••••';
    }
  }

  function updateCounts() {
    document.getElementById('count-all').innerText = vaultItems.length;
    document.getElementById('count-favorites').innerText = vaultItems.filter(i => i.favorite).length;
    document.getElementById('count-logins').innerText = vaultItems.filter(i => i.category === 'logins').length;
    document.getElementById('count-cards').innerText = vaultItems.filter(i => i.category === 'cards').length;
    document.getElementById('count-notes').innerText = vaultItems.filter(i => i.category === 'notes').length;
  }

  function getCategoryIconSvg(cat) {
    if (cat === 'cards') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
    }
    if (cat === 'notes') {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
  }

  // Modal Open/Close/Save
  function openItemModal(item = null) {
    const modal = document.getElementById('item-modal');
    modal.classList.add('active');

    if (item) {
      document.getElementById('modal-heading-text').innerText = 'Редактировать запись';
      document.getElementById('form-item-id').value = item.id;
      document.getElementById('form-title').value = item.title || '';
      document.getElementById('form-category').value = item.category || 'logins';
      document.getElementById('form-username').value = item.username || '';
      document.getElementById('form-password').value = item.password || '';
      document.getElementById('form-url').value = item.url || '';
      document.getElementById('form-notes').value = item.notes || '';
      document.getElementById('form-favorite').checked = !!item.favorite;
    } else {
      document.getElementById('modal-heading-text').innerText = 'Новая запись в сейф';
      document.getElementById('item-form').reset();
      document.getElementById('form-item-id').value = '';
      document.getElementById('form-category').value = currentCategory !== 'all' && currentCategory !== 'favorites' ? currentCategory : 'logins';
    }
  }

  function closeItemModal() {
    themeEngine.sounds.playClick();
    document.getElementById('item-modal').classList.remove('active');
  }

  async function saveItemFromForm() {
    const id = document.getElementById('form-item-id').value || 'item_' + Date.now();
    const itemData = {
      id,
      title: document.getElementById('form-title').value.trim() || 'Без названия',
      category: document.getElementById('form-category').value,
      username: document.getElementById('form-username').value.trim(),
      password: document.getElementById('form-password').value,
      url: document.getElementById('form-url').value.trim(),
      notes: document.getElementById('form-notes').value.trim(),
      favorite: document.getElementById('form-favorite').checked,
      updated_at: new Date().toISOString()
    };

    const idx = vaultItems.findIndex(i => i.id === id);
    if (idx >= 0) {
      vaultItems[idx] = itemData;
    } else {
      vaultItems.unshift(itemData);
    }

    closeItemModal();
    selectedItemId = id;
    renderVaultList();
    renderDetailPane();
    themeEngine.sounds.playSuccess();
    showToast('Запись надёжно сохранена и зашифрована');
    await persistVaultToDisk();
  }

  async function deleteSelectedItem() {
    if (!selectedItemId) return;
    vaultItems = vaultItems.filter(i => i.id !== selectedItemId);
    selectedItemId = null;
    renderVaultList();
    renderDetailPane();
    themeEngine.sounds.playClick();
    showToast('Запись удалена');
    await persistVaultToDisk();
  }

  // ==============================================================================
  // GENERATOR TAB CONTROLS
  // ==============================================================================
  function setupGeneratorControls() {
    const slider = document.getElementById('gen-slider-length');
    const lengthVal = document.getElementById('gen-length-val');

    function refreshGen() {
      const len = parseInt(slider.value, 10);
      lengthVal.innerText = `${len} символов`;

      const options = {
        length: len,
        uppercase: document.getElementById('gen-opt-uppercase').checked,
        lowercase: document.getElementById('gen-opt-lowercase').checked,
        numbers: document.getElementById('gen-opt-numbers').checked,
        symbols: document.getElementById('gen-opt-symbols').checked,
        excludeAmbiguous: document.getElementById('gen-opt-noambig').checked
      };

      const pass = window.PasswordGenerator.generate(options);
      document.getElementById('generator-password-output').innerText = pass;

      const { score, label, color } = window.PasswordGenerator.calculateEntropy(pass);
      const fill = document.getElementById('generator-strength-fill');
      const lbl = document.getElementById('generator-strength-label');
      fill.style.width = `${score}%`;
      fill.style.backgroundColor = color;
      lbl.innerText = label;
      lbl.style.color = color;
    }

    slider.addEventListener('input', refreshGen);
    ['gen-opt-uppercase', 'gen-opt-lowercase', 'gen-opt-numbers', 'gen-opt-symbols', 'gen-opt-noambig'].forEach(id => {
      document.getElementById(id).addEventListener('change', refreshGen);
    });

    document.getElementById('btn-refresh-gen').addEventListener('click', () => {
      themeEngine.sounds.playClick();
      refreshGen();
    });

    document.getElementById('btn-copy-gen-pass').addEventListener('click', () => {
      const pass = document.getElementById('generator-password-output').innerText;
      copyToClipboard(pass, 'Пароль скопирован');
    });

    refreshGen();
  }

  // ==============================================================================
  // SECURITY AUDIT TAB
  // ==============================================================================
  function updateAuditTab() {
    const audit = window.PasswordGenerator.auditVault(vaultItems);
    document.getElementById('audit-score-num').innerText = `${audit.healthScore}%`;
    document.getElementById('audit-weak-count').innerText = audit.weakCount;
    document.getElementById('audit-reused-count').innerText = audit.reusedCount;

    const summary = document.getElementById('audit-summary-text');
    if (audit.weakCount > 0 || audit.reusedCount > 0) {
      summary.innerText = `Внимание: обнаружено ${audit.weakCount} слабых паролей и ${audit.reusedCount} повторов. Рекомендуется заменить их на уникальные.`;
      summary.style.color = '#f59e0b';
    } else {
      summary.innerText = 'Все пароли в сейфе имеют криптостойкую энтропию и не повторяются.';
      summary.style.color = 'var(--text-muted)';
    }
  }

  // ==============================================================================
  // CUSTOMIZATION & SETTINGS CONTROLS
  // ==============================================================================
  function setupCustomizationControls() {
    // Theme switching
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        themeEngine.sounds.playClick();
        document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const themeKey = card.getAttribute('data-theme');
        settings.theme = themeKey;
        themeEngine.applyTheme(themeKey, bgEngine);
        saveSettings();
      });
    });

    // 3D Background Mode
    const modeBtnMap = [
      { id: 'btn-mode-cube', mode: 'quantum-cube' },
      { id: 'btn-mode-grid', mode: 'cyber-grid' },
      { id: 'btn-mode-stardust', mode: 'stardust' },
      { id: 'btn-mode-clean', mode: 'frosted-clean' }
    ];

    modeBtnMap.forEach(({ id, mode }) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          themeEngine.sounds.playClick();
          modeBtnMap.forEach(m => document.getElementById(m.id).classList.remove('active'));
          btn.classList.add('active');
          settings.bgMode = mode;
          bgEngine.setMode(mode);
          saveSettings();
        });
      }
    });

    // 3D Speed Slider
    const sSpeed = document.getElementById('slider-bg-speed');
    sSpeed.addEventListener('input', () => {
      settings.bgSpeed = parseInt(sSpeed.value, 10);
      document.getElementById('bg-speed-val').innerText = `${(settings.bgSpeed / 10).toFixed(1)}x`;
      bgEngine.setSpeed(settings.bgSpeed / 10);
      saveSettings();
    });

    // Glass Blur Slider
    const sBlur = document.getElementById('slider-glass-blur');
    sBlur.addEventListener('input', () => {
      settings.glassBlur = parseInt(sBlur.value, 10);
      document.getElementById('glass-blur-val').innerText = `${settings.glassBlur}px`;
      themeEngine.setGlassBlur(settings.glassBlur);
      saveSettings();
    });

    // Glass Opacity Slider
    const sOpacity = document.getElementById('slider-glass-opacity');
    sOpacity.addEventListener('input', () => {
      settings.glassOpacity = parseInt(sOpacity.value, 10);
      document.getElementById('glass-opacity-val').innerText = `${settings.glassOpacity}%`;
      themeEngine.setGlassOpacity(settings.glassOpacity / 100);
      saveSettings();
    });

    // Mouse Tilt Toggle
    document.getElementById('toggle-mouse-tilt').addEventListener('change', (e) => {
      settings.mouseTilt = e.target.checked;
      bgEngine.setInteractive(settings.mouseTilt);
      saveSettings();
    });

    // Neon Glow Toggle
    document.getElementById('toggle-neon-glow').addEventListener('change', (e) => {
      settings.neonGlow = e.target.checked;
      bgEngine.setGlow(settings.neonGlow);
      saveSettings();
    });

    // SFX Toggle
    document.getElementById('toggle-cyber-sfx').addEventListener('change', (e) => {
      settings.cyberSfx = e.target.checked;
      themeEngine.sounds.enabled = settings.cyberSfx;
      saveSettings();
    });

    // Settings Tab Timers
    document.getElementById('select-clipboard-timer').addEventListener('change', (e) => {
      settings.clipboardTimer = parseInt(e.target.value, 10);
      saveSettings();
    });

    document.getElementById('select-autolock-timer').addEventListener('change', (e) => {
      settings.autolockTimer = parseInt(e.target.value, 10);
      saveSettings();
    });

    // Export & Import Vault Backups
    document.getElementById('btn-export-vault').addEventListener('click', async () => {
      if (!window.aegis) return;
      themeEngine.sounds.playClick();
      const rawEncrypted = await window.aegis.readVault();
      if (!rawEncrypted) {
        showToast('Сейф пуст');
        return;
      }
      const blob = new Blob([rawEncrypted], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `aegis_vault_backup_${Date.now()}.aegis`;
      a.click();
      showToast('Зашифрованный бэкап выгружен');
    });

    document.getElementById('btn-import-vault').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.aegis,.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        if (window.aegis) {
          await window.aegis.saveVault(text);
          showToast('Бэкап импортирован. Перезапустите или введите пароль.');
          lockVault();
        }
      };
      input.click();
    });
  }

  // ==============================================================================
  // LOCK SCREEN & ZERO-KNOWLEDGE AUTH
  // ==============================================================================
  function setupLockScreen() {
    const lockScreen = document.getElementById('lock-screen');
    const lockForm = document.getElementById('lock-form');
    const passInput = document.getElementById('master-password-input');
    const errMsg = document.getElementById('lock-error-msg');

    // Lock button in header
    document.getElementById('btn-lock-vault').addEventListener('click', () => {
      lockVault();
    });

    lockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      errMsg.style.display = 'none';
      const masterPassword = passInput.value;
      if (!masterPassword) return;

      try {
        let rawVault = null;
        if (window.aegis) {
          rawVault = await window.aegis.readVault();
        }

        if (!rawVault) {
          // Initialize fresh vault for first-time use
          const initRes = await vaultEngine.initNewVault(masterPassword);
          vaultItems = [
            {
              id: 'sample_1',
              title: 'Steam',
              category: 'logins',
              username: 'Motewj',
              password: window.PasswordGenerator.generate({ length: 20 }),
              url: 'https://store.steampowered.com',
              notes: 'Основной аккаунт',
              favorite: true
            },
            {
              id: 'sample_2',
              title: 'Discord',
              category: 'logins',
              username: 'Motewj@gmail.com',
              password: window.PasswordGenerator.generate({ length: 18 }),
              url: 'https://discord.com',
              notes: '',
              favorite: false
            }
          ];
          await persistVaultToDisk();
        } else {
          // Decrypt existing vault
          const vaultPayload = JSON.parse(rawVault);
          const decryptedItems = await vaultEngine.unlock(masterPassword, vaultPayload.salt, vaultPayload.encrypted);
          vaultItems = decryptedItems || [];
        }

        // Successfully unlocked
        passInput.value = '';
        lockScreen.classList.add('unlocked');
        themeEngine.sounds.playSuccess();
        showToast('Сейф успешно расшифрован');
        renderVaultList();
      } catch (err) {
        themeEngine.sounds.playLock();
        errMsg.innerText = err.message || 'Неверный мастер-пароль';
        errMsg.style.display = 'block';
      }
    });
  }

  function lockVault() {
    vaultEngine.lock();
    themeEngine.sounds.playLock();
    selectedItemId = null;
    isPasswordRevealed = false;
    document.getElementById('lock-screen').classList.remove('unlocked');
    document.getElementById('master-password-input').value = '';
    document.getElementById('lock-error-msg').style.display = 'none';
    renderDetailPane();
  }

  async function persistVaultToDisk() {
    if (!vaultEngine.isUnlocked || !window.aegis) return;
    try {
      const plainText = JSON.stringify(vaultItems);
      const encrypted = await vaultEngine.encrypt(plainText);
      const payload = {
        version: '1.0',
        salt: vaultEngine.bufToBase64(vaultEngine.salt),
        encrypted: encrypted,
        updated_at: new Date().toISOString()
      };
      await window.aegis.saveVault(JSON.stringify(payload, null, 2));
    } catch (err) {
      console.error('Failed to persist vault:', err);
    }
  }

  // ==============================================================================
  // HELPERS (Clipboard, Toast, Inactivity)
  // ==============================================================================
  function copyToClipboard(text, msg = 'Скопировано') {
    if (!text) return;
    if (window.aegis) {
      window.aegis.copySecure({ text, clearSeconds: settings.clipboardTimer });
    } else {
      navigator.clipboard.writeText(text);
    }
    themeEngine.sounds.playSuccess();
    showToast(msg);
  }

  let toastTimer = null;
  function showToast(msg) {
    const box = document.getElementById('toast-box');
    const txt = document.getElementById('toast-text');
    txt.innerText = msg;
    box.classList.add('show');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      box.classList.remove('show');
    }, 2500);
  }

  function resetInactivityTimer() {
    if (autolockTimeout) clearTimeout(autolockTimeout);
    if (!settings.autolockTimer || settings.autolockTimer <= 0) return;

    autolockTimeout = setTimeout(() => {
      if (vaultEngine && vaultEngine.isUnlocked) {
        lockVault();
        showToast('Сейф автоматически заблокирован');
      }
    }, settings.autolockTimer * 60 * 1000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
})();
