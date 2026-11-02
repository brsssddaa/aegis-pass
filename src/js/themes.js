// ==============================================================================
// AEGIS PASS // BESPOKE THEMES, GLASSMORPHISM & CYBERNETIC SOUND ENGINE
// ==============================================================================

(function() {
  'use strict';

  const THEMES = {
    emerald: {
      name: 'Emerald Matrix',
      primary: '#10b981',
      primaryGlow: 'rgba(16, 185, 129, 0.45)',
      primaryLight: '#34d399',
      borderGlow: 'rgba(16, 185, 129, 0.35)',
      bgCore: '#05080c'
    },
    amethyst: {
      name: 'Obsidian Amethyst',
      primary: '#a855f7',
      primaryGlow: 'rgba(168, 85, 247, 0.45)',
      primaryLight: '#c084fc',
      borderGlow: 'rgba(168, 85, 247, 0.35)',
      bgCore: '#08060e'
    },
    amber: {
      name: 'Cyberpunk Gold',
      primary: '#f59e0b',
      primaryGlow: 'rgba(245, 158, 11, 0.45)',
      primaryLight: '#fbbf24',
      borderGlow: 'rgba(245, 158, 11, 0.35)',
      bgCore: '#090805'
    },
    cyan: {
      name: 'Polar Cyber Cyan',
      primary: '#06b6d4',
      primaryGlow: 'rgba(6, 182, 212, 0.45)',
      primaryLight: '#38bdf8',
      borderGlow: 'rgba(6, 182, 212, 0.35)',
      bgCore: '#05090d'
    },
    ruby: {
      name: 'Crimson Aegis',
      primary: '#f43f5e',
      primaryGlow: 'rgba(244, 63, 94, 0.45)',
      primaryLight: '#fb7185',
      borderGlow: 'rgba(244, 63, 94, 0.35)',
      bgCore: '#0b0608'
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
        osc.frequency.setValueAtTime(850, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(420, this.ctx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.045);
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
        osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        osc2.frequency.setValueAtTime(1040, now);
        osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now + 0.04);
        osc1.stop(now + 0.22);
        osc2.stop(now + 0.22);
      } catch (e) {}
    }

    playLock() {
      if (!this.enabled) return;
      try {
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) {}
    }
  }

  class ThemeEngine {
    constructor() {
      this.currentTheme = 'emerald';
      this.glassBlur = 18;
      this.glassOpacity = 0.22;
      this.sounds = new SoundEngine();
    }

    applyTheme(themeKey, bgEngine) {
      if (!THEMES[themeKey]) themeKey = 'emerald';
      this.currentTheme = themeKey;
      const theme = THEMES[themeKey];
      const root = document.documentElement;

      root.style.setProperty('--accent-primary', theme.primary);
      root.style.setProperty('--accent-glow', theme.primaryGlow);
      root.style.setProperty('--accent-light', theme.primaryLight);
      root.style.setProperty('--border-glow', theme.borderGlow);
      root.style.setProperty('--bg-core', theme.bgCore);

      if (bgEngine) {
        bgEngine.setColors(theme.primary, theme.primaryGlow, theme.primaryLight);
      }
    }

    setGlassBlur(px) {
      this.glassBlur = Math.max(0, Math.min(px, 32));
      document.documentElement.style.setProperty('--glass-blur', `${this.glassBlur}px`);
    }

    setGlassOpacity(val) {
      this.glassOpacity = Math.max(0.05, Math.min(val, 0.9));
      document.documentElement.style.setProperty('--glass-opacity', `${this.glassOpacity}`);
    }
  }

  window.ThemeEngine = ThemeEngine;
  window.THEMES_MAP = THEMES;
})();
