// ==============================================================================
// AEGIS PASS // CLOUD & MOBILE VAULT APP CONTROLLER
// Supports: Google Sign-In & Google Cloud Sync (Zero-Knowledge AES-256-GCM)
//           Cloud Server Sync (Node.js API / Render / SSE)
//           Offline PWA mode with encrypted cache
// ==============================================================================

(function() {
  'use strict';

  const DEFAULT_GOOGLE_CLIENT_ID = '348808136485-2hf1oc4n57v0m5gdoth2arb5qmvqs27m.apps.googleusercontent.com';
  
  // State
  let vaultItems = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let masterPin = localStorage.getItem('aegis_master_pin') || '2026';
  let authToken = localStorage.getItem('aegis_token') || '';
  let serverUrl = localStorage.getItem('aegis_server_url') || '';
  let googleClientId = localStorage.getItem('aegis_google_client_id') || DEFAULT_GOOGLE_CLIENT_ID;
  let googleAccessToken = localStorage.getItem('aegis_google_token') || '';
  let googleUser = null;
  let googleDriveFileId = localStorage.getItem('aegis_gdrive_file_id') || '';
  let syncMode = 'server'; // 'google' | 'server' | 'offline'
  let cryptoEngine = new window.CryptoVaultEngine();
  let sseSource = null;

  try {
    const rawUser = localStorage.getItem('aegis_google_user');
    if (rawUser) googleUser = JSON.parse(rawUser);
  } catch (_) {}

  const deviceId = 'device_' + (localStorage.getItem('aegis_device_id') || Math.random().toString(36).substring(2, 9));
  localStorage.setItem('aegis_device_id', deviceId);

  // DOM Elements
  const authScreen = document.getElementById('auth-screen');
  const pinForm = document.getElementById('pin-form');
  const pinInput = document.getElementById('pin-input');
  const authError = document.getElementById('auth-error');
  const btnGoogleLogin = document.getElementById('btn-google-login');
  const googleUserBadge = document.getElementById('google-user-badge');
  const googleUserAvatar = document.getElementById('google-user-avatar');
  const googleUserName = document.getElementById('google-user-name');
  const googleUserEmail = document.getElementById('google-user-email');
  const btnGoogleSignout = document.getElementById('btn-google-signout');
  const btnToggleSettings = document.getElementById('btn-toggle-settings');
  const cloudSettingsPanel = document.getElementById('cloud-settings-panel');
  const serverUrlInput = document.getElementById('server-url-input');
  const googleClientIdInput = document.getElementById('google-client-id-input');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Topbar Elements
  const headerCloudMode = document.getElementById('header-cloud-mode');
  const topbarUser = document.getElementById('topbar-user');
  const topbarAvatar = document.getElementById('topbar-avatar');
  const topbarUsername = document.getElementById('topbar-username');
  const syncStatus = document.getElementById('sync-status');
  const syncDot = syncStatus?.querySelector('.sync-dot');
  const syncLabel = syncStatus?.querySelector('.sync-label');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const vaultGrid = document.getElementById('vault-grid');
  const emptyState = document.getElementById('empty-state');

  // Modals
  const itemModal = document.getElementById('item-modal');
  const itemForm = document.getElementById('item-form');
  const modalTitle = document.getElementById('modal-title');
  const genModal = document.getElementById('gen-modal');
  const genOutput = document.getElementById('gen-output');
  const genLength = document.getElementById('gen-length');
  const genLengthVal = document.getElementById('gen-length-val');
  const genStrengthBar = document.getElementById('gen-strength-bar');
  const genOptUpper = document.getElementById('gen-opt-upper');
  const genOptLower = document.getElementById('gen-opt-lower');
  const genOptDigits = document.getElementById('gen-opt-digits');
  const genOptSymbols = document.getElementById('gen-opt-symbols');

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', async () => {
    registerServiceWorker();
    setupEventListeners();
    updateGoogleBadge();

    if (serverUrlInput) serverUrlInput.value = serverUrl;
    if (googleClientIdInput) googleClientIdInput.value = googleClientId;

    // Check if previously logged into Google
    if (googleAccessToken && googleUser) {
      syncMode = 'google';
      updateHeaderMode();
    }

    await checkAuthAndLoad();
  });

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  }

  function getApiUrl(path) {
    if (serverUrl) {
      return serverUrl.replace(/\/+$/, '') + path;
    }
    return path;
  }

  function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      'X-Device-Name': navigator.userAgent.includes('Mobile') ? 'Poco X7 Pro' : 'Web Browser'
    };
    if (authToken) {
      headers['Authorization'] = 'Bearer ' + authToken;
    }
    return headers;
  }

  // --------------------------------------------------------------------------
  // AUTHENTICATION & LOAD FLOW
  // --------------------------------------------------------------------------

  async function checkAuthAndLoad() {
    // If Google Account is active, sync with Google Cloud
    if (syncMode === 'google' && googleAccessToken) {
      try {
        setSyncState('syncing', 'Google Cloud...');
        const ok = await syncFromGoogleDrive();
        if (ok) {
          hideAuthScreen();
          renderVault();
          updateCounts();
          return;
        }
      } catch (err) {
        console.warn('[AUTH] Google cloud sync failed, fallback to pin', err);
      }
    }

    // Attempt Server Sync
    try {
      const res = await fetch(getApiUrl('/api/status'), {
        headers: getAuthHeaders()
      });
      const data = await res.json();

      if (data.authRequired && !data.isAuthenticated) {
        showAuthScreen();
      } else {
        hideAuthScreen();
        await loadVaultFromServer();
        connectSse();
      }
    } catch (e) {
      // Offline fallback: load local cache
      const cached = localStorage.getItem('aegis_vault_cache');
      if (cached) {
        try {
          vaultItems = JSON.parse(cached);
          renderVault();
          updateCounts();
          setSyncState('online', 'Офлайн режим');
        } catch (_) {}
      }
      showAuthScreen();
    }
  }

  function showAuthScreen() {
    if (authScreen) authScreen.classList.remove('hidden');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  }

  function hideAuthScreen() {
    if (authScreen) authScreen.classList.add('hidden');
    if (authError) authError.textContent = '';
  }

  function updateGoogleBadge() {
    if (googleUser && googleAccessToken) {
      if (googleUserBadge) googleUserBadge.classList.remove('hidden');
      if (googleUserAvatar) googleUserAvatar.src = googleUser.picture || './assets/icons/icon.png';
      if (googleUserName) googleUserName.textContent = googleUser.name || 'Пользователь Google';
      if (googleUserEmail) googleUserEmail.textContent = googleUser.email || '';

      if (topbarUser) topbarUser.classList.remove('hidden');
      if (topbarAvatar) topbarAvatar.src = googleUser.picture || './assets/icons/icon.png';
      if (topbarUsername) topbarUsername.textContent = googleUser.name ? googleUser.name.split(' ')[0] : 'Google';
    } else {
      if (googleUserBadge) googleUserBadge.classList.add('hidden');
      if (topbarUser) topbarUser.classList.add('hidden');
    }
  }

  function updateHeaderMode() {
    if (headerCloudMode) {
      if (syncMode === 'google') {
        headerCloudMode.textContent = 'GOOGLE CLOUD';
      } else if (syncMode === 'server') {
        headerCloudMode.textContent = serverUrl ? 'CLOUD SERVER' : 'LOCAL SERVER';
      } else {
        headerCloudMode.textContent = 'OFFLINE';
      }
    }
  }

  // --------------------------------------------------------------------------
  // GOOGLE IDENTITY & DRIVE APP DATA SYNC
  // --------------------------------------------------------------------------

  async function handleGoogleLoginClick() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      showToast('Загрузка Google SDK... Подождите секунду');
      return;
    }

    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            googleAccessToken = tokenResponse.access_token;
            localStorage.setItem('aegis_google_token', googleAccessToken);

            // Fetch user profile
            try {
              const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${googleAccessToken}` }
              });
              googleUser = await uRes.json();
              localStorage.setItem('aegis_google_user', JSON.stringify(googleUser));
            } catch (_) {}

            syncMode = 'google';
            updateGoogleBadge();
            updateHeaderMode();
            showToast(`Вход выполнен: ${googleUser ? googleUser.email : 'Google Account'}`);

            // Download or initialize vault from Google Cloud
            await syncFromGoogleDrive();
            hideAuthScreen();
            renderVault();
            updateCounts();
          } else if (tokenResponse && tokenResponse.error) {
            showToast('Ошибка Google Auth: ' + tokenResponse.error);
          }
        }
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error('[GOOGLE] Auth initialization error:', err);
      showToast('Ошибка запуска Google OAuth');
    }
  }

  function handleGoogleSignout() {
    googleAccessToken = '';
    googleUser = null;
    googleDriveFileId = '';
    localStorage.removeItem('aegis_google_token');
    localStorage.removeItem('aegis_google_user');
    localStorage.removeItem('aegis_gdrive_file_id');
    syncMode = 'server';
    updateGoogleBadge();
    updateHeaderMode();
    showToast('Вы вышли из Google аккаунта');
    showAuthScreen();
  }

  // Find or Create aegis_vault.enc in Google Drive AppData
  async function syncFromGoogleDrive() {
    if (!googleAccessToken) return false;
    setSyncState('syncing', 'Загрузка из облака...');

    try {
      // 1. Search for existing vault file in appDataFolder
      const searchUrl = 'https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,name,modifiedTime)&q=name=%27aegis_vault.enc%27';
      const searchRes = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${googleAccessToken}` }
      });

      if (!searchRes.ok) {
        if (searchRes.status === 401) {
          localStorage.removeItem('aegis_google_token');
          googleAccessToken = '';
          return false;
        }
        throw new Error('Search failed: ' + searchRes.status);
      }

      const searchData = await searchRes.json();
      const files = searchData.files || [];

      if (files.length > 0) {
        googleDriveFileId = files[0].id;
        localStorage.setItem('aegis_gdrive_file_id', googleDriveFileId);

        // Download file content
        const downloadUrl = `https://www.googleapis.com/drive/v3/files/${googleDriveFileId}?alt=media`;
        const fileRes = await fetch(downloadUrl, {
          headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });

        if (fileRes.ok) {
          const rawEnc = await fileRes.json();
          // Decrypt with Master PIN
          if (rawEnc.salt && rawEnc.iv && rawEnc.ciphertext) {
            try {
              const decrypted = await cryptoEngine.unlock(masterPin, rawEnc.salt, rawEnc);
              vaultItems = Array.isArray(decrypted) ? decrypted : (decrypted.items || []);
              localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
              setSyncState('online', 'Google Cloud Синхронизировано');
              return true;
            } catch (decErr) {
              console.warn('[CRYPTO] Decryption with default PIN failed:', decErr.message);
              // Store encrypted blob to decrypt upon PIN entry
              sessionStorage.setItem('aegis_pending_cloud_enc', JSON.stringify(rawEnc));
              showToast('Введите мастер-PIN для расшифровки облачного хранилища');
              showAuthScreen();
              return false;
            }
          }
        }
      } else {
        // No file yet: initialize new cloud vault from local items
        await saveToGoogleDrive();
        return true;
      }
    } catch (e) {
      console.error('[GDRIVE] Sync error:', e);
      setSyncState('offline', 'Ошибка облака');
      return false;
    }
    return true;
  }

  // Encrypt and upload vault to Google Drive AppData
  async function saveToGoogleDrive() {
    if (!googleAccessToken) return;
    setSyncState('syncing', 'Сохранение в Google Cloud...');

    try {
      // 1. Encrypt vault using Master PIN
      let saltB64 = cryptoEngine.salt ? cryptoEngine.bufToBase64(cryptoEngine.salt) : null;
      if (!cryptoEngine.isUnlocked || !saltB64) {
        const initRes = await cryptoEngine.initNewVault(masterPin);
        saltB64 = initRes.salt;
      }
      const plainJson = JSON.stringify(vaultItems);
      const encrypted = await cryptoEngine.encrypt(plainJson);
      const payload = {
        version: 2,
        updatedAt: Date.now(),
        salt: saltB64,
        iv: encrypted.iv,
        ciphertext: encrypted.ciphertext
      };

      const fileContent = JSON.stringify(payload);

      if (googleDriveFileId) {
        // Update existing file
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${googleDriveFileId}?uploadType=media`;
        await fetch(uploadUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        });
      } else {
        // Create new file in appDataFolder
        const metadata = {
          name: 'aegis_vault.enc',
          parents: ['appDataFolder']
        };

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          fileContent +
          close_delim;

        const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartRequestBody
        });

        if (createRes.ok) {
          const createdData = await createRes.json();
          googleDriveFileId = createdData.id;
          localStorage.setItem('aegis_gdrive_file_id', googleDriveFileId);
        }
      }

      localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
      setSyncState('online', 'Google Cloud: Сохранено');
    } catch (e) {
      console.error('[GDRIVE] Save failed:', e);
      setSyncState('offline', 'Ошибка сохранения');
    }
  }

  // --------------------------------------------------------------------------
  // SERVER SYNC (NODE.JS API & SSE)
  // --------------------------------------------------------------------------

  async function loadVaultFromServer() {
    setSyncState('syncing', 'Синхронизация...');
    try {
      const res = await fetch(getApiUrl('/api/vault'), {
        headers: getAuthHeaders()
      });

      if (res.status === 401) {
        showAuthScreen();
        return;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        vaultItems = data.items;
        localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
        renderVault();
        updateCounts();
        setSyncState('online', 'Синхронизировано');
      }
    } catch (e) {
      console.error('[SERVER] Load vault error:', e);
      setSyncState('offline', 'Офлайн режим');
    }
  }

  function connectSse() {
    if (sseSource) {
      sseSource.close();
      sseSource = null;
    }

    try {
      const sseUrl = getApiUrl(`/api/vault/events?token=${encodeURIComponent(authToken)}&deviceId=${encodeURIComponent(deviceId)}`);
      sseSource = new EventSource(sseUrl);

      sseSource.addEventListener('vault_update', (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.senderDeviceId !== deviceId && Array.isArray(payload.items)) {
            vaultItems = payload.items;
            localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
            renderVault();
            updateCounts();
            showToast('Хранилище обновлено с другого устройства');
          }
        } catch (_) {}
      });

      sseSource.addEventListener('heartbeat', () => {
        setSyncState('online', 'Синхронизировано');
      });

      sseSource.onerror = () => {
        setSyncState('offline', 'Переподключение...');
      };
    } catch (_) {}
  }

  // Save vault item to Server or Google Cloud
  async function persistItem(item, isNew = false) {
    if (syncMode === 'google') {
      if (isNew) {
        vaultItems.unshift(item);
      } else {
        const idx = vaultItems.findIndex(i => i.id === item.id);
        if (idx !== -1) vaultItems[idx] = item;
      }
      renderVault();
      updateCounts();
      await saveToGoogleDrive();
      return true;
    }

    // Server mode
    try {
      const url = isNew ? getApiUrl('/api/vault/items') : getApiUrl(`/api/vault/items/${encodeURIComponent(item.id)}`);
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method: method,
        headers: getAuthHeaders(),
        body: JSON.stringify(item)
      });

      if (res.ok) {
        const data = await res.json();
        if (isNew && data.item) {
          vaultItems.unshift(data.item);
        } else {
          const idx = vaultItems.findIndex(i => i.id === item.id);
          if (idx !== -1) vaultItems[idx] = item;
        }
        localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
        renderVault();
        updateCounts();
        setSyncState('online', 'Синхронизировано');
        return true;
      }
    } catch (e) {
      console.warn('[SAVE] Fallback to local cache:', e);
      if (isNew) vaultItems.unshift(item);
      else {
        const idx = vaultItems.findIndex(i => i.id === item.id);
        if (idx !== -1) vaultItems[idx] = item;
      }
      localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
      renderVault();
      updateCounts();
      return true;
    }
  }

  async function deleteItemById(id) {
    if (syncMode === 'google') {
      vaultItems = vaultItems.filter(i => i.id !== id);
      renderVault();
      updateCounts();
      await saveToGoogleDrive();
      showToast('Запись удалена');
      return;
    }

    // Server mode
    try {
      const res = await fetch(getApiUrl(`/api/vault/items/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        vaultItems = vaultItems.filter(i => i.id !== id);
        localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
        renderVault();
        updateCounts();
        showToast('Запись удалена');
      }
    } catch (e) {
      vaultItems = vaultItems.filter(i => i.id !== id);
      localStorage.setItem('aegis_vault_cache', JSON.stringify(vaultItems));
      renderVault();
      updateCounts();
      showToast('Запись удалена');
    }
  }

  // --------------------------------------------------------------------------
  // UI EVENT LISTENERS
  // --------------------------------------------------------------------------

  function setupEventListeners() {
    // Google Sign-In button
    if (btnGoogleLogin) {
      btnGoogleLogin.addEventListener('click', handleGoogleLoginClick);
    }

    if (btnGoogleSignout) {
      btnGoogleSignout.addEventListener('click', handleGoogleSignout);
    }

    // Settings Toggle
    if (btnToggleSettings) {
      btnToggleSettings.addEventListener('click', () => {
        if (cloudSettingsPanel) cloudSettingsPanel.classList.toggle('hidden');
      });
    }

    // Save Settings
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        serverUrl = (serverUrlInput?.value || '').trim();
        googleClientId = (googleClientIdInput?.value || '').trim() || DEFAULT_GOOGLE_CLIENT_ID;
        localStorage.setItem('aegis_server_url', serverUrl);
        localStorage.setItem('aegis_google_client_id', googleClientId);
        showToast('Параметры сохранены');
        if (cloudSettingsPanel) cloudSettingsPanel.classList.add('hidden');
        checkAuthAndLoad();
      });
    }

    // PIN Form Submit
    if (pinForm) {
      pinForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = (pinInput?.value || '').trim();
        if (!pin) return;

        masterPin = pin;
        localStorage.setItem('aegis_master_pin', pin);

        // Check pending encrypted blob
        const pendingBlob = sessionStorage.getItem('aegis_pending_cloud_enc');
        if (pendingBlob) {
          try {
            const rawEnc = JSON.parse(pendingBlob);
            const decrypted = await cryptoEngine.unlock(pin, rawEnc.salt, rawEnc);
            vaultItems = Array.isArray(decrypted) ? decrypted : (decrypted.items || []);
            sessionStorage.removeItem('aegis_pending_cloud_enc');
            hideAuthScreen();
            renderVault();
            updateCounts();
            showToast('Облачное хранилище успешно расшифровано');
            return;
          } catch (decErr) {
            if (authError) authError.textContent = 'Неверный мастер-PIN шифрования';
            return;
          }
        }

        // Server verify
        try {
          const res = await fetch(getApiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pin })
          });

          const data = await res.json();
          if (data.ok && data.token) {
            authToken = data.token;
            localStorage.setItem('aegis_token', authToken);
            hideAuthScreen();
            await loadVaultFromServer();
            connectSse();
            showToast('Вход выполнен');
          } else {
            if (authError) authError.textContent = data.message || 'Неверный PIN';
          }
        } catch (err) {
          // Offline fallback unlock
          hideAuthScreen();
          renderVault();
          updateCounts();
          showToast('Вход в офлайн-режиме');
        }
      });
    }

    // Lock button
    const btnLock = document.getElementById('btn-lock');
    if (btnLock) {
      btnLock.addEventListener('click', () => {
        authToken = '';
        localStorage.removeItem('aegis_token');
        showAuthScreen();
      });
    }

    // Search input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        if (searchClear) {
          if (searchQuery) searchClear.classList.remove('hidden');
          else searchClear.classList.add('hidden');
        }
        renderVault();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.classList.add('hidden');
        renderVault();
      });
    }

    // Category Filter Pills
    document.querySelectorAll('.cat-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentCategory = pill.dataset.cat;
        renderVault();
      });
    });

    // Add Item Buttons
    const btnAddItem = document.getElementById('btn-add-item');
    const mobileBtnAdd = document.getElementById('mobile-btn-add');
    if (btnAddItem) btnAddItem.addEventListener('click', () => openItemModal());
    if (mobileBtnAdd) mobileBtnAdd.addEventListener('click', () => openItemModal());

    // Modal Close
    const modalClose = document.getElementById('modal-close');
    const modalCancel = document.getElementById('modal-cancel');
    if (modalClose) modalClose.addEventListener('click', closeItemModal);
    if (modalCancel) modalCancel.addEventListener('click', closeItemModal);

    // Item Form Submit
    if (itemForm) {
      itemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('item-id').value;
        const title = document.getElementById('item-name').value.trim();
        const username = document.getElementById('item-username').value.trim();
        const password = document.getElementById('item-password').value;
        const url = document.getElementById('item-url').value.trim();
        const notes = document.getElementById('item-notes').value.trim();
        const selectedCat = document.querySelector('input[name="item-cat"]:checked')?.value || 'accounts';

        if (!title) return;

        const isNew = !id;
        const item = {
          id: id || ('item_' + Date.now()),
          title: title,
          category: selectedCat,
          username: username,
          password: password,
          url: url,
          notes: notes,
          favorite: false,
          createdAt: isNew ? Date.now() : undefined
        };

        const existing = vaultItems.find(i => i.id === id);
        if (existing) {
          item.favorite = existing.favorite;
          item.createdAt = existing.createdAt || Date.now();
        }

        await persistItem(item, isNew);
        closeItemModal();
        showToast(isNew ? 'Запись добавлена' : 'Запись обновлена');
      });
    }

    // Password Generator Triggers
    const btnOpenGen = document.getElementById('btn-open-generator');
    const mobileBtnGen = document.getElementById('mobile-btn-gen');
    const btnModalGen = document.getElementById('btn-modal-generate');
    const genClose = document.getElementById('gen-close');

    if (btnOpenGen) btnOpenGen.addEventListener('click', openGenModal);
    if (mobileBtnGen) mobileBtnGen.addEventListener('click', openGenModal);
    if (btnModalGen) {
      btnModalGen.addEventListener('click', () => {
        const pw = generatePassword();
        const pwInput = document.getElementById('item-password');
        if (pwInput) pwInput.value = pw;
        showToast('Пароль сгенерирован');
      });
    }
    if (genClose) genClose.addEventListener('click', closeGenModal);

    // Generator Controls
    if (genLength) {
      genLength.addEventListener('input', (e) => {
        if (genLengthVal) genLengthVal.textContent = e.target.value;
        updateGeneratedPassword();
      });
    }

    [genOptUpper, genOptLower, genOptDigits, genOptSymbols].forEach(el => {
      if (el) el.addEventListener('change', updateGeneratedPassword);
    });

    const genRefresh = document.getElementById('gen-refresh');
    if (genRefresh) genRefresh.addEventListener('click', updateGeneratedPassword);

    const genCopy = document.getElementById('gen-copy');
    if (genCopy) {
      genCopy.addEventListener('click', () => {
        if (genOutput) {
          copyToClipboard(genOutput.value);
          showToast('Пароль скопирован');
        }
      });
    }

    // Backup / Export
    const mobileBtnBackup = document.getElementById('mobile-btn-backup');
    if (mobileBtnBackup) {
      mobileBtnBackup.addEventListener('click', exportVaultBackup);
    }
  }

  // --------------------------------------------------------------------------
  // VAULT RENDERING
  // --------------------------------------------------------------------------

  function renderVault() {
    if (!vaultGrid) return;
    vaultGrid.innerHTML = '';

    const filtered = vaultItems.filter(item => {
      // Category filter
      if (currentCategory === 'favorites' && !item.favorite) return false;
      if (currentCategory !== 'all' && currentCategory !== 'favorites' && item.category !== currentCategory) return false;

      // Search filter
      if (searchQuery) {
        const matchTitle = (item.title || '').toLowerCase().includes(searchQuery);
        const matchUser = (item.username || '').toLowerCase().includes(searchQuery);
        const matchUrl = (item.url || '').toLowerCase().includes(searchQuery);
        const matchNotes = (item.notes || '').toLowerCase().includes(searchQuery);
        return matchTitle || matchUser || matchUrl || matchNotes;
      }
      return true;
    });

    if (filtered.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = `vault-card glass-panel ${item.favorite ? 'is-fav' : ''}`;

      const iconPath = getCategoryIcon(item.category);
      const maskedPw = '•'.repeat(Math.min(item.password?.length || 8, 12));

      card.innerHTML = `
        <div class="card-header">
          <div class="card-identity">
            <div class="card-icon cat-${item.category || 'accounts'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconPath}</svg>
            </div>
            <div class="card-title-group">
              <div class="card-title">${escapeHtml(item.title || 'Без названия')}</div>
              <div class="card-cat-badge">${getCategoryName(item.category)}</div>
            </div>
          </div>
          <button class="btn-fav ${item.favorite ? 'active' : ''}" data-id="${item.id}" title="В избранное">
            <svg viewBox="0 0 24 24" fill="${item.favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
        </div>

        <div class="card-body">
          ${item.username ? `
            <div class="card-field">
              <span class="field-label">Логин</span>
              <div class="field-value-row">
                <span class="field-value mono">${escapeHtml(item.username)}</span>
                <button class="btn-copy-field" data-copy="${escapeHtml(item.username)}" title="Копировать логин">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          ` : ''}

          <div class="card-field">
            <span class="field-label">Пароль</span>
            <div class="field-value-row">
              <span class="field-value mono pw-masked" id="pw-text-${item.id}">${maskedPw}</span>
              <div class="pw-actions">
                <button class="btn-toggle-pw" data-id="${item.id}" title="Показать/Скрыть">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn-copy-field" data-copy="${escapeHtml(item.password || '')}" title="Копировать пароль">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>

          ${item.notes ? `
            <div class="card-notes">
              <span class="notes-text">${escapeHtml(item.notes)}</span>
            </div>
          ` : ''}
        </div>

        <div class="card-footer">
          <div class="card-actions">
            <button class="btn-card-action btn-edit" data-id="${item.id}">Редактировать</button>
            <button class="btn-card-action btn-delete" data-id="${item.id}">Удалить</button>
          </div>
        </div>
      `;

      // Card event listeners
      const btnFav = card.querySelector('.btn-fav');
      btnFav?.addEventListener('click', async (e) => {
        e.stopPropagation();
        item.favorite = !item.favorite;
        await persistItem(item, false);
      });

      const btnTogglePw = card.querySelector('.btn-toggle-pw');
      const pwText = card.querySelector(`#pw-text-${item.id}`);
      let isVisible = false;
      btnTogglePw?.addEventListener('click', (e) => {
        e.stopPropagation();
        isVisible = !isVisible;
        if (isVisible) {
          pwText.textContent = item.password || '';
          pwText.classList.remove('pw-masked');
        } else {
          pwText.textContent = maskedPw;
          pwText.classList.add('pw-masked');
        }
      });

      card.querySelectorAll('.btn-copy-field').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = btn.dataset.copy;
          if (val) {
            copyToClipboard(val);
            showToast('Скопировано в буфер обмена');
          }
        });
      });

      const btnEdit = card.querySelector('.btn-edit');
      btnEdit?.addEventListener('click', (e) => {
        e.stopPropagation();
        openItemModal(item);
      });

      const btnDelete = card.querySelector('.btn-delete');
      btnDelete?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Удалить запись "${item.title}"?`)) {
          await deleteItemById(item.id);
        }
      });

      vaultGrid.appendChild(card);
    });
  }

  function updateCounts() {
    const counts = {
      all: vaultItems.length,
      accounts: 0,
      games: 0,
      cards: 0,
      notes: 0,
      favorites: 0
    };

    vaultItems.forEach(i => {
      if (counts[i.category] !== undefined) counts[i.category]++;
      if (i.favorite) counts.favorites++;
    });

    ['all', 'accounts', 'games', 'cards', 'notes', 'favorites'].forEach(cat => {
      const el = document.getElementById(`count-${cat}`);
      if (el) el.textContent = counts[cat] || 0;
    });
  }

  // --------------------------------------------------------------------------
  // MODALS & ACTIONS
  // --------------------------------------------------------------------------

  function openItemModal(item = null) {
    if (!itemModal) return;
    const isEdit = Boolean(item);
    if (modalTitle) modalTitle.textContent = isEdit ? 'Редактировать запись' : 'Новая запись';

    document.getElementById('item-id').value = item?.id || '';
    document.getElementById('item-name').value = item?.title || '';
    document.getElementById('item-username').value = item?.username || '';
    document.getElementById('item-password').value = item?.password || '';
    document.getElementById('item-url').value = item?.url || '';
    document.getElementById('item-notes').value = item?.notes || '';

    const catVal = item?.category || 'accounts';
    const catRadio = document.querySelector(`input[name="item-cat"][value="${catVal}"]`);
    if (catRadio) catRadio.checked = true;

    itemModal.classList.remove('hidden');
    document.getElementById('item-name').focus();
  }

  function closeItemModal() {
    if (itemModal) itemModal.classList.add('hidden');
  }

  function openGenModal() {
    if (!genModal) return;
    updateGeneratedPassword();
    genModal.classList.remove('hidden');
  }

  function closeGenModal() {
    if (genModal) genModal.classList.add('hidden');
  }

  function updateGeneratedPassword() {
    const pw = generatePassword();
    if (genOutput) genOutput.value = pw;
    if (genStrengthBar) {
      const strength = calculateStrength(pw);
      genStrengthBar.style.width = strength.pct + '%';
      genStrengthBar.style.backgroundColor = strength.color;
    }
  }

  function generatePassword() {
    const len = parseInt(genLength?.value || '20', 10);
    const upper = genOptUpper?.checked !== false;
    const lower = genOptLower?.checked !== false;
    const digits = genOptDigits?.checked !== false;
    const symbols = genOptSymbols?.checked !== false;

    let chars = '';
    if (upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (lower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (digits) chars += '0123456789';
    if (symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    const randArr = new Uint32Array(len);
    window.crypto.getRandomValues(randArr);
    let pw = '';
    for (let i = 0; i < len; i++) {
      pw += chars[randArr[i] % chars.length];
    }
    return pw;
  }

  function calculateStrength(pw) {
    if (!pw) return { pct: 0, color: '#ff3366' };
    let score = 0;
    if (pw.length >= 12) score += 30;
    if (pw.length >= 20) score += 20;
    if (/[A-Z]/.test(pw)) score += 15;
    if (/[a-z]/.test(pw)) score += 15;
    if (/[0-9]/.test(pw)) score += 10;
    if (/[^A-Za-z0-9]/.test(pw)) score += 10;

    let color = '#ff3366';
    if (score >= 80) color = '#00ff88';
    else if (score >= 50) color = '#00e5ff';
    else if (score >= 30) color = '#ffaa00';

    return { pct: Math.min(score, 100), color };
  }

  function exportVaultBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(vaultItems, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `aegis_vault_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Бэкап сохранён в файл');
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  function setSyncState(state, text) {
    if (!syncStatus) return;
    syncStatus.className = 'sync-badge ' + state;
    if (syncLabel) syncLabel.textContent = text;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function getCategoryName(cat) {
    const map = {
      accounts: 'Аккаунт',
      games: 'Игра',
      cards: 'Карта',
      notes: 'Заметка'
    };
    return map[cat] || 'Аккаунт';
  }

  function getCategoryIcon(cat) {
    switch (cat) {
      case 'games':
        return '<path d="M6 12h4m-2-2v4m10-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4-5H2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>';
      case 'cards':
        return '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>';
      case 'notes':
        return '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>';
      default:
        return '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>';
    }
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

})();
