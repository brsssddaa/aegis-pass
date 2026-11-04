// ==============================================================================
// AEGIS PASS // PALETTES, DESIGN TOKENS & CYBERNETIC SOUND ENGINE
// ==============================================================================

(function() {
  'use strict';

  const PALETTES = {
    monochrome: {
      primary: '#e6edf3',
      primaryGlow: 'rgba(230, 237, 243, 0.2)',
      primaryLight: '#ffffff',
      borderGlow: 'rgba(230, 237, 243, 0.3)',
      bgApp: '#090b10',
      bgSidebar: '#0e1117',
      bgCard: '#161b22',
      bgCardHover: '#1f242c'
    },
    slate: {
      primary: '#94a3b8',
      primaryGlow: 'rgba(148, 163, 184, 0.2)',
      primaryLight: '#cbd5e1',
      borderGlow: 'rgba(148, 163, 184, 0.3)',
      bgApp: '#0a0d12',
      bgSidebar: '#10141a',
      bgCard: '#181e26',
      bgCardHover: '#202732'
    },
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

    // Modern haptic mechanical switch click
    playClick() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;

        // 1. High frequency tactile snap
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.018);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.Q.setValueAtTime(1.8, now);

        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.02);

        // 2. Subtle soft body tap (haptic low-end thud)
        const sub = this.ctx.createOscillator();
        const subGain = this.ctx.createGain();

        sub.type = 'sine';
        sub.frequency.setValueAtTime(160, now);
        sub.frequency.exponentialRampToValueAtTime(65, now + 0.025);

        subGain.gain.setValueAtTime(0.035, now);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

        sub.connect(subGain);
        subGain.connect(this.ctx.destination);

        sub.start(now);
        sub.stop(now + 0.028);
      } catch (e) {}
    }

    playSuccess() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        
        // Modern luxury dual chime (harmonic crystal tones without arcade swoops)
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        const gain2 = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3200, now);

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, now + 0.03); // E6 harmonic

        gain1.gain.setValueAtTime(0.03, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

        gain2.gain.setValueAtTime(0.0001, now);
        gain2.gain.setValueAtTime(0.025, now + 0.03);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        osc1.connect(gain1);
        osc2.connect(gain2);
        gain1.connect(filter);
        gain2.connect(filter);
        filter.connect(this.ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.23);
        osc2.start(now + 0.03);
        osc2.stop(now + 0.29);
      } catch (e) {}
    }

    playCopy() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;

        // Modern tactile double micro-tick (data capture haptic)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(1800, now);
        gain1.gain.setValueAtTime(0.025, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.018);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(2400, now + 0.025);
        gain2.gain.setValueAtTime(0.02, now + 0.025);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.025);
        osc2.stop(now + 0.048);
      } catch (e) {}
    }

    playError() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;

        // Muted tech rejection double-tap (subtle low-frequency haptic thud)
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(260, now);
        filter.connect(this.ctx.destination);

        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(95, now);
        gain1.gain.setValueAtTime(0.04, now);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
        osc1.connect(gain1);
        gain1.connect(filter);
        osc1.start(now);
        osc1.stop(now + 0.04);

        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(75, now + 0.05);
        gain2.gain.setValueAtTime(0.035, now + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc2.connect(gain2);
        gain2.connect(filter);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.095);
      } catch (e) {}
    }
  }

  class ThemeEngine {
    constructor() {
      this.currentTheme = 'monochrome';
      this.sounds = new SoundEngine();
    }

    applyPalette(themeKey) {
      const palette = PALETTES[themeKey] || PALETTES.monochrome;
      this.currentTheme = themeKey;

      function hexToRgb(hex) {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : '15, 20, 29';
      }

      const root = document.documentElement;
      root.style.setProperty('--accent-primary', palette.primary);
      root.style.setProperty('--accent-glow', palette.primaryGlow);
      root.style.setProperty('--accent-light', palette.primaryLight);
      root.style.setProperty('--border-glow', palette.borderGlow);
      root.style.setProperty('--bg-app', palette.bgApp);
      root.style.setProperty('--bg-sidebar', palette.bgSidebar);
      root.style.setProperty('--bg-card', palette.bgCard);
      root.style.setProperty('--bg-card-hover', palette.bgCardHover);

      root.style.setProperty('--bg-sidebar-rgb', hexToRgb(palette.bgSidebar));
      root.style.setProperty('--bg-card-rgb', hexToRgb(palette.bgCard));
      root.style.setProperty('--bg-topbar-rgb', hexToRgb(palette.bgApp));
    }
  }

  window.ThemeEngine = ThemeEngine;
  window.AegisPalettes = PALETTES;
})();
