// ==============================================================================
// AEGIS PASS // PALETTES, DESIGN TOKENS & CYBERNETIC SOUND ENGINE
// ==============================================================================

(function() {
  'use strict';

  const PALETTES = {
    emerald: {
      primary: '#00d68f',
      primaryGlow: 'rgba(0, 214, 143, 0.35)',
      primaryLight: '#2ee8a6',
      borderGlow: 'rgba(0, 214, 143, 0.45)',
      bgApp: '#0c1017',
      bgSidebar: '#0f141d',
      bgCard: '#151c27',
      bgCardHover: '#1a2331'
    },
    cyan: {
      primary: '#06b6d4',
      primaryGlow: 'rgba(6, 182, 212, 0.35)',
      primaryLight: '#38bdf8',
      borderGlow: 'rgba(6, 182, 212, 0.45)',
      bgApp: '#0a1017',
      bgSidebar: '#0d151f',
      bgCard: '#131e2b',
      bgCardHover: '#192636'
    },
    amethyst: {
      primary: '#a855f7',
      primaryGlow: 'rgba(168, 85, 247, 0.35)',
      primaryLight: '#c084fc',
      borderGlow: 'rgba(168, 85, 247, 0.45)',
      bgApp: '#0e0b16',
      bgSidebar: '#130f1e',
      bgCard: '#1b152b',
      bgCardHover: '#231c36'
    },
    amber: {
      primary: '#f59e0b',
      primaryGlow: 'rgba(245, 158, 11, 0.35)',
      primaryLight: '#fbbf24',
      borderGlow: 'rgba(245, 158, 11, 0.45)',
      bgApp: '#120f0a',
      bgSidebar: '#17130d',
      bgCard: '#211c13',
      bgCardHover: '#2b2419'
    },
    ruby: {
      primary: '#f43f5e',
      primaryGlow: 'rgba(244, 63, 94, 0.35)',
      primaryLight: '#fb7185',
      borderGlow: 'rgba(244, 63, 94, 0.45)',
      bgApp: '#140a0e',
      bgSidebar: '#190e13',
      bgCard: '#24141c',
      bgCardHover: '#2e1a24'
    },
    slate: {
      primary: '#38bdf8',
      primaryGlow: 'rgba(56, 189, 248, 0.35)',
      primaryLight: '#7dd3fc',
      borderGlow: 'rgba(56, 189, 248, 0.45)',
      bgApp: '#0f172a',
      bgSidebar: '#111c34',
      bgCard: '#1e293b',
      bgCardHover: '#243247'
    }
  };

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playClick() {
      if (!this.enabled) return;
      try {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.035);
        gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.035);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.04);
      } catch (e) {}
    }

    playSuccess() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(520, now);
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1);
        osc2.frequency.setValueAtTime(1040, now);
        osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.15);
        osc2.stop(now + 0.15);
      } catch (e) {}
    }

    playCopy() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(900, now);
        osc.frequency.setValueAtTime(1200, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
      } catch (e) {}
    }

    playError() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.setValueAtTime(180, now + 0.06);

        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
      } catch (e) {}
    }
  }

  class ThemeEngine {
    constructor() {
      this.currentTheme = 'emerald';
      this.sounds = new SoundEngine();
    }

    applyPalette(themeKey) {
      const palette = PALETTES[themeKey] || PALETTES.emerald;
      this.currentTheme = themeKey;

      const root = document.documentElement;
      root.style.setProperty('--accent-primary', palette.primary);
      root.style.setProperty('--accent-glow', palette.primaryGlow);
      root.style.setProperty('--accent-light', palette.primaryLight);
      root.style.setProperty('--border-glow', palette.borderGlow);
      root.style.setProperty('--bg-app', palette.bgApp);
      root.style.setProperty('--bg-sidebar', palette.bgSidebar);
      root.style.setProperty('--bg-card', palette.bgCard);
      root.style.setProperty('--bg-card-hover', palette.bgCardHover);
    }
  }

  window.ThemeEngine = ThemeEngine;
  window.AegisPalettes = PALETTES;
})();
