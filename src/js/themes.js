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

  // Helper Color Conversions
  function hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16)
    } : { r: 0, g: 229, b: 255 };
  }

  function rgbToHex(r, g, b) {
    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [clamp(r), clamp(g), clamp(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function hsvToRgb(h, s, v) {
    let r, g, b;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      case 5: r = v; g = p; b = q; break;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, v = max;
    const d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h, s, v };
  }

  class CyberColorPicker {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.getElementById(container) : container;
      if (!this.container) return;

      this.options = options;
      this.onChange = options.onChange || (() => {});
      this.onSave = options.onSave || (() => {});

      this.currentH = 0.52; // Cyan default
      this.currentS = 1.0;
      this.currentV = 1.0;

      this.isDraggingPoint = false;
      this.isDraggingSlider = false;

      this.buildDom();
      this.initEvents();
    }

    buildDom() {
      this.container.innerHTML = `
        <div class="kpm-picker-main">
          <!-- 2D Color Spectrum Box -->
          <div class="kpm-picker-spectrum-wrap">
            <div class="kpm-spectrum-box" data-role="spectrum-box">
              <canvas class="kpm-spectrum-canvas" data-role="spectrum-canvas" width="480" height="200"></canvas>
              <div class="kpm-picker-point" data-role="picker-point">
                <div class="kpm-point-center"></div>
                <div class="kpm-point-ring"></div>
                <div class="kpm-point-crosshair-h"></div>
                <div class="kpm-point-crosshair-v"></div>
              </div>
            </div>
            <div class="kpm-picker-hint">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              <span>Зажмите <b>ПКМ</b> или <b>ЛКМ</b> и водите курсором для выбора точки цвета</span>
            </div>
          </div>

          <!-- Vertical Brightness Slider -->
          <div class="kpm-picker-slider-col">
            <div class="kpm-slider-v-header">
              <span class="kpm-slider-v-title">ЯРКОСТЬ</span>
              <span class="kpm-slider-v-badge" data-role="brightness-badge">100%</span>
            </div>
            <div class="kpm-slider-v-track" data-role="brightness-track">
              <div class="kpm-slider-v-thumb" data-role="brightness-thumb">
                <div class="kpm-thumb-pip"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer / Readout / Quick Memory Dots -->
        <div class="kpm-picker-footer">
          <div class="kpm-picker-footer-left">
            <div class="kpm-picker-swatch-chip" data-role="swatch-chip" title="Активный цвет"></div>
            
            <div class="kpm-picker-hex-wrap">
              <span class="kpm-picker-hash">#</span>
              <input type="text" class="kpm-picker-hex-input" data-role="hex-input" value="00E5FF" maxlength="6" spellcheck="false">
            </div>

            <div class="kpm-picker-rgb-badge" data-role="rgb-badge">RGB(0, 229, 255)</div>
          </div>

          <div class="kpm-picker-footer-right">
            <span class="kpm-picker-quick-title">Быстрые неоны:</span>
            <div class="kpm-picker-dots-row">
              <div class="kpm-color-dot-preset" data-hex="#00e5ff" style="--dot-color: #00e5ff;" title="Кибер-циан"></div>
              <div class="kpm-color-dot-preset" data-hex="#00d68f" style="--dot-color: #00d68f;" title="Изумруд"></div>
              <div class="kpm-color-dot-preset" data-hex="#ffe600" style="--dot-color: #ffe600;" title="Cyberpunk Неон"></div>
              <div class="kpm-color-dot-preset" data-hex="#ff0055" style="--dot-color: #ff0055;" title="Неоновый Рубин"></div>
              <div class="kpm-color-dot-preset" data-hex="#a855f7" style="--dot-color: #a855f7;" title="Аметист"></div>
              <div class="kpm-color-dot-preset" data-hex="#38bdf8" style="--dot-color: #38bdf8;" title="Ледяной синий"></div>
              <div class="kpm-color-dot-preset" data-hex="#ffffff" style="--dot-color: #ffffff;" title="Чистый белый"></div>
              <div class="kpm-color-dot-preset" data-hex="#94a3b8" style="--dot-color: #94a3b8;" title="Графитовый"></div>
            </div>
          </div>
        </div>
      `;

      this.spectrumBox = this.container.querySelector('[data-role="spectrum-box"]');
      this.canvas = this.container.querySelector('[data-role="spectrum-canvas"]');
      this.point = this.container.querySelector('[data-role="picker-point"]');
      this.brightnessTrack = this.container.querySelector('[data-role="brightness-track"]');
      this.brightnessThumb = this.container.querySelector('[data-role="brightness-thumb"]');
      this.brightnessBadge = this.container.querySelector('[data-role="brightness-badge"]');
      this.swatchChip = this.container.querySelector('[data-role="swatch-chip"]');
      this.hexInput = this.container.querySelector('[data-role="hex-input"]');
      this.rgbBadge = this.container.querySelector('[data-role="rgb-badge"]');
      this.quickDots = this.container.querySelectorAll('.kpm-color-dot-preset');

      this.drawSpectrumCanvas();
    }

    drawSpectrumCanvas() {
      if (!this.canvas) return;
      const ctx = this.canvas.getContext('2d');
      const w = this.canvas.width;
      const h = this.canvas.height;

      // 1. Horizontal Rainbow Gradient across Hue (0..360)
      const gradH = ctx.createLinearGradient(0, 0, w, 0);
      gradH.addColorStop(0 / 6, '#ff0000');
      gradH.addColorStop(1 / 6, '#ffff00');
      gradH.addColorStop(2 / 6, '#00ff00');
      gradH.addColorStop(3 / 6, '#00ffff');
      gradH.addColorStop(4 / 6, '#0000ff');
      gradH.addColorStop(5 / 6, '#ff00ff');
      gradH.addColorStop(6 / 6, '#ff0000');

      ctx.fillStyle = gradH;
      ctx.fillRect(0, 0, w, h);

      // 2. Vertical Saturation Gradient (Top = 100% full vibrant color, Bottom = Desaturated white/light gray)
      const gradV = ctx.createLinearGradient(0, 0, 0, h);
      gradV.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradV.addColorStop(1, 'rgba(255, 255, 255, 1)');

      ctx.fillStyle = gradV;
      ctx.fillRect(0, 0, w, h);

      // 3. Brightness overlay on canvas if V < 1.0
      if (this.currentV < 1.0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${(1.0 - this.currentV) * 0.9})`;
        ctx.fillRect(0, 0, w, h);
      }
    }

    initEvents() {
      // Suppress native context menu on spectrum box & slider so RMB drag works seamlessly
      this.spectrumBox.addEventListener('contextmenu', (e) => e.preventDefault());
      this.brightnessTrack.addEventListener('contextmenu', (e) => e.preventDefault());

      // 2D Spectrum Drag (supports LMB button 0 and RMB button 2)
      const onSpectrumDown = (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        this.isDraggingPoint = true;
        this.updatePointFromEvent(e);

        const onMove = (ev) => {
          if (!this.isDraggingPoint) return;
          ev.preventDefault();
          this.updatePointFromEvent(ev);
        };

        const onUp = () => {
          if (this.isDraggingPoint) {
            this.isDraggingPoint = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            this.onSave(this.getHex(), this.currentV);
          }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      };

      this.spectrumBox.addEventListener('mousedown', onSpectrumDown);

      // Vertical Slider Drag (supports LMB button 0 and RMB button 2)
      const onSliderDown = (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        e.preventDefault();
        this.isDraggingSlider = true;
        this.updateSliderFromEvent(e);

        const onMove = (ev) => {
          if (!this.isDraggingSlider) return;
          ev.preventDefault();
          this.updateSliderFromEvent(ev);
        };

        const onUp = () => {
          if (this.isDraggingSlider) {
            this.isDraggingSlider = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            this.onSave(this.getHex(), this.currentV);
          }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      };

      this.brightnessTrack.addEventListener('mousedown', onSliderDown);

      // Hex Input Typing
      this.hexInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/[^0-9a-fA-F]/g, '');
        if (val.length === 6) {
          this.setColorFromHex('#' + val, true);
        }
      });

      this.hexInput.addEventListener('change', () => {
        this.onSave(this.getHex(), this.currentV);
      });

      // Quick Neon Presets
      this.quickDots.forEach(dot => {
        dot.addEventListener('click', () => {
          const hex = dot.getAttribute('data-hex');
          if (hex) {
            this.setColorFromHex(hex, true);
            this.onSave(this.getHex(), this.currentV);
          }
        });
      });
    }

    updatePointFromEvent(e) {
      const rect = this.spectrumBox.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const normX = x / rect.width;
      const normY = y / rect.height;

      this.currentH = Math.max(0, Math.min(0.999, normX));
      this.currentS = Math.max(0, Math.min(1.0, 1.0 - normY));

      this.updateUi(true);
    }

    updateSliderFromEvent(e) {
      const rect = this.brightnessTrack.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const normY = y / rect.height;

      // Top (y=0) = 1.0 (100%), Bottom (y=h) = 0.15 (15% min brightness for text legibility)
      const v = 1.0 - (normY * 0.85);
      this.currentV = Math.max(0.15, Math.min(1.0, v));

      this.drawSpectrumCanvas();
      this.updateUi(true);
    }

    updateUi(triggerChange = false) {
      // 1. Reticle Point Position
      const pctX = (this.currentH * 100);
      const pctY = ((1.0 - this.currentS) * 100);
      this.point.style.left = `${pctX}%`;
      this.point.style.top = `${pctY}%`;

      // 2. Brightness Slider Thumb Position & Value
      const normY = (1.0 - this.currentV) / 0.85;
      const pctThumb = Math.max(0, Math.min(100, normY * 100));
      this.brightnessThumb.style.top = `${pctThumb}%`;
      const bPct = Math.round(this.currentV * 100);
      this.brightnessBadge.textContent = `${bPct}%`;

      // 3. Dynamic Vertical Slider Gradient (pure color at top -> black at bottom)
      const pureRgb = hsvToRgb(this.currentH, this.currentS, 1.0);
      const pureHex = rgbToHex(pureRgb.r, pureRgb.g, pureRgb.b);
      this.brightnessTrack.style.background = `linear-gradient(to bottom, ${pureHex}, #000000)`;

      // 4. Current Color with Brightness Applied
      const rgb = hsvToRgb(this.currentH, this.currentS, this.currentV);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

      // 5. Update Swatch, Hex Input, RGB Badge
      this.swatchChip.style.backgroundColor = hex;
      this.swatchChip.style.boxShadow = `0 0 16px ${hex}88`;
      if (document.activeElement !== this.hexInput) {
        this.hexInput.value = hex.replace('#', '').toUpperCase();
      }
      this.rgbBadge.textContent = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;

      if (triggerChange) {
        this.onChange(hex, rgb, this.currentV);
      }
    }

    getHex() {
      const rgb = hsvToRgb(this.currentH, this.currentS, this.currentV);
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    setColorFromHex(hex, triggerChange = false) {
      if (!hex) return;
      const rgb = hexToRgb(hex);
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      this.currentH = hsv.h;
      this.currentS = hsv.s;
      this.currentV = Math.max(0.15, hsv.v);

      this.drawSpectrumCanvas();
      this.updateUi(triggerChange);
    }
  }

  class ThemeEngine {
    constructor() {
      this.currentTheme = 'monochrome';
      this.currentAccentColor = '#00e5ff';
      this.currentBrightness = 1.0;
      this.sounds = new SoundEngine();
    }

    applyCustomColor(hex, brightness = 1.0) {
      const rgb = hexToRgb(hex);
      this.currentAccentColor = hex;
      this.currentBrightness = brightness;

      const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`;
      const borderGlow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`;
      const light = rgbToHex(
        Math.min(255, rgb.r + 35),
        Math.min(255, rgb.g + 35),
        Math.min(255, rgb.b + 35)
      );

      const root = document.documentElement;
      root.style.setProperty('--accent-primary', hex);
      root.style.setProperty('--accent-glow', glow);
      root.style.setProperty('--accent-light', light);
      root.style.setProperty('--border-glow', borderGlow);
      root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);

      // Forward to background canvas if active
      if (window.bgEngine && typeof window.bgEngine.setColors === 'function') {
        window.bgEngine.setColors(hex, glow, light);
      }
    }

    applyPalette(themeKey) {
      if (themeKey && themeKey.startsWith('#')) {
        this.applyCustomColor(themeKey);
        return;
      }
      const palette = PALETTES[themeKey] || PALETTES.monochrome;
      this.currentTheme = themeKey;

      const rgbObj = hexToRgb(palette.primary);
      const root = document.documentElement;
      root.style.setProperty('--accent-primary', palette.primary);
      root.style.setProperty('--accent-glow', palette.primaryGlow);
      root.style.setProperty('--accent-light', palette.primaryLight);
      root.style.setProperty('--border-glow', palette.borderGlow);
      root.style.setProperty('--bg-app', palette.bgApp);
      root.style.setProperty('--bg-sidebar', palette.bgSidebar);
      root.style.setProperty('--bg-card', palette.bgCard);
      root.style.setProperty('--bg-card-hover', palette.bgCardHover);

      const sRgb = hexToRgb(palette.bgSidebar);
      const cRgb = hexToRgb(palette.bgCard);
      const aRgb = hexToRgb(palette.bgApp);

      root.style.setProperty('--bg-sidebar-rgb', `${sRgb.r}, ${sRgb.g}, ${sRgb.b}`);
      root.style.setProperty('--bg-card-rgb', `${cRgb.r}, ${cRgb.g}, ${cRgb.b}`);
      root.style.setProperty('--bg-topbar-rgb', `${aRgb.r}, ${aRgb.g}, ${aRgb.b}`);
      root.style.setProperty('--accent-rgb', `${rgbObj.r}, ${rgbObj.g}, ${rgbObj.b}`);

      this.currentAccentColor = palette.primary;
    }
  }

  window.ThemeEngine = ThemeEngine;
  window.CyberColorPicker = CyberColorPicker;
  window.AegisPalettes = PALETTES;
})();
