// ==============================================================================
// AEGIS PASS // CRYPTOGRAPHIC PASSWORD GENERATOR & ENTROPY AUDITOR
// ==============================================================================

(function() {
  'use strict';

  const CHAR_POOLS = {
    uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    uppercase_all: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijkmnopqrstuvwxyz',
    lowercase_all: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '23456789',
    numbers_all: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  };

  const WORDS = [
    'quantum', 'cipher', 'stellar', 'matrix', 'orbital', 'obsidian', 'shield',
    'enclave', 'horizon', 'vector', 'vertex', 'emerald', 'sapphire', 'titan',
    'aurora', 'nexus', 'prism', 'vortex', 'falcon', 'nebula', 'glacier', 'phantom'
  ];

  class PasswordGenerator {
    static generate(options = {}) {
      const {
        length = 18,
        uppercase = true,
        lowercase = true,
        numbers = true,
        symbols = true,
        excludeAmbiguous = true
      } = options;

      let pool = '';
      if (uppercase) pool += excludeAmbiguous ? CHAR_POOLS.uppercase : CHAR_POOLS.uppercase_all;
      if (lowercase) pool += excludeAmbiguous ? CHAR_POOLS.lowercase : CHAR_POOLS.lowercase_all;
      if (numbers) pool += excludeAmbiguous ? CHAR_POOLS.numbers : CHAR_POOLS.numbers_all;
      if (symbols) pool += CHAR_POOLS.symbols;

      if (!pool) pool = CHAR_POOLS.lowercase_all + CHAR_POOLS.numbers_all;

      const randomBytes = new Uint32Array(length);
      window.crypto.getRandomValues(randomBytes);

      let password = '';
      for (let i = 0; i < length; i++) {
        password += pool[randomBytes[i] % pool.length];
      }

      return password;
    }

    static generatePassphrase(wordCount = 4, separator = '-') {
      const bytes = new Uint32Array(wordCount);
      window.crypto.getRandomValues(bytes);
      const selected = [];
      for (let i = 0; i < wordCount; i++) {
        selected.push(WORDS[bytes[i] % WORDS.length]);
      }
      return selected.join(separator);
    }

    static calculateEntropy(password) {
      if (!password) return { entropy: 0, score: 0, label: 'Пусто', color: '#6b7280' };

      let poolSize = 0;
      if (/[a-z]/.test(password)) poolSize += 26;
      if (/[A-Z]/.test(password)) poolSize += 26;
      if (/[0-9]/.test(password)) poolSize += 10;
      if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

      if (poolSize === 0) poolSize = 10;

      const entropy = Math.round(password.length * Math.log2(poolSize));

      let score = 0;
      let label = 'Очень слабый';
      let color = '#ef4444'; // Red

      if (entropy >= 80) {
        score = 100;
        label = 'Криптостойкий';
        color = '#10b981'; // Emerald
      } else if (entropy >= 60) {
        score = 80;
        label = 'Надёжный';
        color = '#10b981';
      } else if (entropy >= 45) {
        score = 55;
        label = 'Средний';
        color = '#f59e0b'; // Amber
      } else if (entropy >= 28) {
        score = 30;
        label = 'Слабый';
        color = '#f97316';
      } else {
        score = 15;
        label = 'Очень слабый';
        color = '#ef4444';
      }

      return {
        entropy,
        score,
        label,
        color
      };
    }

    static auditVault(items = []) {
      let weakCount = 0;
      let reusedCount = 0;
      const seenPasswords = {};

      items.forEach(item => {
        if (!item.password) return;
        const pass = item.password;
        const { entropy } = this.calculateEntropy(pass);
        if (entropy < 50 || pass.length < 10) {
          weakCount++;
        }
        seenPasswords[pass] = (seenPasswords[pass] || 0) + 1;
      });

      Object.values(seenPasswords).forEach(count => {
        if (count > 1) reusedCount += count;
      });

      const total = items.length;
      let healthScore = 100;
      if (total > 0) {
        const penalties = (weakCount * 15) + (reusedCount * 12);
        healthScore = Math.max(10, Math.min(100, 100 - Math.round(penalties / total)));
      }

      return {
        total,
        weakCount,
        reusedCount,
        healthScore
      };
    }
  }

  window.PasswordGenerator = PasswordGenerator;
})();
