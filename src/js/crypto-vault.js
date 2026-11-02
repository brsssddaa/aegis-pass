// ==============================================================================
// AEGIS PASS // ZERO-KNOWLEDGE CRYPTOGRAPHIC CORE (AES-256-GCM & PBKDF2)
// ==============================================================================

(function() {
  'use strict';

  class CryptoVaultEngine {
    constructor() {
      this.activeKey = null;
      this.salt = null;
      this.isUnlocked = false;
    }

    // Convert Buffer to Base64 and vice-versa
    bufToBase64(buf) {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }

    base64ToBuf(str) {
      const binary = window.atob(str);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }

    // Derive AES-256-GCM key from Master Password & Salt via PBKDF2 (150,000 iterations)
    async deriveKey(masterPassword, saltBuf) {
      const enc = new TextEncoder();
      const pwKey = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(masterPassword),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      return await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: saltBuf,
          iterations: 150000,
          hash: 'SHA-256'
        },
        pwKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    }

    // Initialize new vault with Master Password
    async initNewVault(masterPassword) {
      // 16-byte random salt
      const salt = window.crypto.getRandomValues(new Uint8Array(16));
      this.salt = salt;
      this.activeKey = await this.deriveKey(masterPassword, salt);
      this.isUnlocked = true;

      return {
        salt: this.bufToBase64(salt)
      };
    }

    // Unlock existing vault
    async unlock(masterPassword, saltBase64, encryptedBlob) {
      const saltBuf = this.base64ToBuf(saltBase64);
      const key = await this.deriveKey(masterPassword, saltBuf);

      // Verify and decrypt test blob
      const decryptedJson = await this.decrypt(encryptedBlob, key);
      this.activeKey = key;
      this.salt = new Uint8Array(saltBuf);
      this.isUnlocked = true;

      return JSON.parse(decryptedJson);
    }

    // Encrypt plaintext data (JSON string) using active key
    async encrypt(plainText, key = this.activeKey) {
      if (!key) throw new Error('Vault is locked. No encryption key available.');
      const enc = new TextEncoder();
      // 12-byte IV for AES-GCM
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        enc.encode(plainText)
      );

      return {
        iv: this.bufToBase64(iv),
        ciphertext: this.bufToBase64(ciphertext)
      };
    }

    // Decrypt ciphertext using active or provided key
    async decrypt(encryptedObj, key = this.activeKey) {
      if (!key) throw new Error('Vault is locked. No encryption key available.');
      const iv = this.base64ToBuf(encryptedObj.iv);
      const ciphertext = this.base64ToBuf(encryptedObj.ciphertext);

      try {
        const decryptedBuf = await window.crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: new Uint8Array(iv) },
          key,
          ciphertext
        );
        const dec = new TextDecoder();
        return dec.decode(decryptedBuf);
      } catch (err) {
        throw new Error('Неверный мастер-пароль или повреждённые данные.');
      }
    }

    // Lock Vault and securely wipe key from memory
    lock() {
      this.activeKey = null;
      this.isUnlocked = false;
    }
  }

  window.CryptoVaultEngine = CryptoVaultEngine;
})();
