// ==============================================================================
// AEGIS PASS // HOLOGRAPHIC 3D QUANTUM CUBE & CYBERNETIC CANVAS ENGINE
// ==============================================================================

(function() {
  'use strict';

  class CyberBackgroundEngine {
    constructor() {
      this.canvas = document.getElementById('bg-canvas');
      if (!this.canvas) return;
      this.ctx = this.canvas.getContext('2d');

      this.mode = 'quantum-cube'; // 'quantum-cube' | 'cyber-grid' | 'stardust' | 'frosted-clean'
      this.primaryColor = '#10b981'; // Emerald
      this.glowColor = 'rgba(16, 185, 129, 0.45)';
      this.accentColor = '#34d399';
      this.speed = 1.0;
      this.glowEnabled = true;
      this.interactiveEnabled = true;

      this.width = 0;
      this.height = 0;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Rotation angles for 3D cube
      this.rotX = 0.5;
      this.rotY = 0.5;
      this.rotZ = 0.2;
      this.innerRotX = 0.2;
      this.innerRotY = -0.4;

      // Mouse inertia tracking
      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.focalLength = 480;

      // 3D Particles
      this.particleCount = 50;
      this.particles = [];

      // Anime / Cyber Hologram Companion Background
      this.animeImg = new Image();
      this.animeImg.src = 'assets/wallpaper_anime.jpg';
      this.animeImgLoaded = false;
      this.animeImg.onload = () => { this.animeImgLoaded = true; };

      this.initEvents();
      this.resize();
      this.initParticles();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    initEvents() {
      window.addEventListener('resize', () => this.resize(), { passive: true });
      window.addEventListener('mousemove', (e) => {
        if (!this.interactiveEnabled) return;
        const cx = this.width / 2;
        const cy = this.height / 2;
        this.mouse.targetX = (e.clientX - cx) / cx; // -1.0 to 1.0
        this.mouse.targetY = (e.clientY - cy) / cy; // -1.0 to 1.0
      }, { passive: true });
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    initParticles() {
      this.particles = [];
      for (let i = 0; i < this.particleCount; i++) {
        this.particles.push({
          x: (Math.random() - 0.5) * this.width * 1.4,
          y: (Math.random() - 0.5) * this.height * 1.4,
          z: Math.random() * 800 - 400,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          vz: (Math.random() - 0.5) * 0.6,
          radius: Math.random() * 2.2 + 0.8,
          alpha: Math.random() * 0.6 + 0.2
        });
      }
    }

    setMode(mode) {
      this.mode = mode;
    }

    setColors(primary, glow, accent) {
      this.primaryColor = primary;
      this.glowColor = glow;
      this.accentColor = accent || primary;
    }

    setSpeed(speed) {
      this.speed = Math.max(0.1, Math.min(speed, 3.0));
    }

    setGlow(enabled) {
      this.glowEnabled = enabled;
    }

    setInteractive(enabled) {
      this.interactiveEnabled = enabled;
      if (!enabled) {
        this.mouse.targetX = 0;
        this.mouse.targetY = 0;
      }
    }

    // 3D Point Projection Helper
    project(p, cx, cy) {
      const scale = this.focalLength / (this.focalLength + p.z);
      return {
        x: cx + p.x * scale,
        y: cy + p.y * scale,
        scale: scale,
        visible: (this.focalLength + p.z) > 10
      };
    }

    rotateX(p, a) {
      const cos = Math.cos(a), sin = Math.sin(a);
      return { x: p.x, y: p.y * cos - p.z * sin, z: p.y * sin + p.z * cos };
    }

    rotateY(p, a) {
      const cos = Math.cos(a), sin = Math.sin(a);
      return { x: p.x * cos + p.z * sin, y: p.y, z: -p.x * sin + p.z * cos };
    }

    rotateZ(p, a) {
      const cos = Math.cos(a), sin = Math.sin(a);
      return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos, z: p.z };
    }

    transformPoint(pt, rx, ry, rz) {
      let p = this.rotateX(pt, rx);
      p = this.rotateY(p, ry);
      p = this.rotateZ(p, rz);
      return p;
    }

    renderQuantumCube(cx, cy) {
      const ctx = this.ctx;

      // Update rotation with speed and mouse damping
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.05;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.05;

      const baseSpeed = 0.006 * this.speed;
      this.rotX += baseSpeed + this.mouse.y * 0.01;
      this.rotY += baseSpeed * 1.3 + this.mouse.x * 0.012;
      this.rotZ += baseSpeed * 0.5;

      this.innerRotX -= baseSpeed * 1.8;
      this.innerRotY -= baseSpeed * 2.2;

      // Outer Cube Geometry (size = 130)
      const S = 135;
      const outerVertices = [
        { x: -S, y: -S, z: -S }, { x: S, y: -S, z: -S },
        { x: S, y: S, z: -S },   { x: -S, y: S, z: -S },
        { x: -S, y: -S, z: S },  { x: S, y: -S, z: S },
        { x: S, y: S, z: S },    { x: -S, y: S, z: S }
      ];

      // Inner Core Geometry (size = 65)
      const s = 65;
      const innerVertices = [
        { x: -s, y: -s, z: -s }, { x: s, y: -s, z: -s },
        { x: s, y: s, z: -s },   { x: -s, y: s, z: -s },
        { x: -s, y: -s, z: s },  { x: s, y: -s, z: s },
        { x: s, y: s, z: s },    { x: -s, y: s, z: s }
      ];

      const edges = [
        [0, 1], [1, 2], [2, 3], [3, 0], // Back face
        [4, 5], [5, 6], [6, 7], [7, 4], // Front face
        [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting edges
      ];

      // Project Outer Vertices
      const projectedOuter = outerVertices.map(v => {
        const trans = this.transformPoint(v, this.rotX, this.rotY, this.rotZ);
        return this.project(trans, cx, cy);
      });

      // Project Inner Vertices
      const projectedInner = innerVertices.map(v => {
        const trans = this.transformPoint(v, this.innerRotX, this.innerRotY, this.rotZ * 1.5);
        return this.project(trans, cx, cy);
      });

      // 1. Draw connecting tesseract links between outer and inner cubes
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = this.glowEnabled ? this.glowColor : 'rgba(255,255,255,0.12)';
      for (let i = 0; i < 8; i++) {
        const p1 = projectedOuter[i];
        const p2 = projectedInner[i];
        if (p1.visible && p2.visible) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }

      // 2. Draw Outer Edges
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = this.primaryColor;
      if (this.glowEnabled) {
        ctx.shadowColor = this.primaryColor;
        ctx.shadowBlur = 14;
      } else {
        ctx.shadowBlur = 0;
      }

      edges.forEach(([i, j]) => {
        const p1 = projectedOuter[i];
        const p2 = projectedOuter[j];
        if (p1.visible && p2.visible) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // 3. Draw Inner Core Edges
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = this.accentColor;
      if (this.glowEnabled) {
        ctx.shadowColor = this.accentColor;
        ctx.shadowBlur = 8;
      }

      edges.forEach(([i, j]) => {
        const p1 = projectedInner[i];
        const p2 = projectedInner[j];
        if (p1.visible && p2.visible) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });

      // 4. Draw Glowing Vertex Dots
      ctx.shadowBlur = this.glowEnabled ? 16 : 0;
      projectedOuter.forEach(p => {
        if (!p.visible) return;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      projectedInner.forEach(p => {
        if (!p.visible) return;
        ctx.fillStyle = this.accentColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2 * p.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      // Reset shadow
      ctx.shadowBlur = 0;
    }

    renderCyberGrid(cx, cy) {
      const ctx = this.ctx;
      const horizonY = cy - 20;
      const step = 45;
      const time = Date.now() * 0.001 * this.speed;
      const offset = (time * 60) % step;

      ctx.lineWidth = 1;
      ctx.strokeStyle = this.glowColor;

      // Perspective horizontal grid lines
      for (let y = horizonY + 10; y < this.height; y += step) {
        const dy = y + offset;
        if (dy > this.height) continue;
        const alpha = Math.min(1, (dy - horizonY) / 250);
        ctx.strokeStyle = `rgba(16, 185, 129, ${alpha * 0.35})`;
        ctx.beginPath();
        ctx.moveTo(0, dy);
        ctx.lineTo(this.width, dy);
        ctx.stroke();
      }

      // Vanishing vertical grid lines
      const count = 28;
      for (let i = -count; i <= count; i++) {
        const xBottom = cx + i * 65;
        ctx.beginPath();
        ctx.moveTo(cx, horizonY);
        ctx.lineTo(xBottom, this.height);
        ctx.stroke();
      }
    }

    renderAnimeHologram(cx, cy) {
      const ctx = this.ctx;
      if (!this.animeImgLoaded) return;

      // Parallax mouse tilt
      const maxShift = 25;
      const offsetX = this.mouse.x * maxShift;
      const offsetY = this.mouse.y * maxShift;

      // Calculate cover dimensions
      const imgRatio = this.animeImg.width / this.animeImg.height;
      const screenRatio = this.width / this.height;
      let drawW, drawH;

      if (screenRatio > imgRatio) {
        drawW = this.width * 1.06;
        drawH = drawW / imgRatio;
      } else {
        drawH = this.height * 1.06;
        drawW = drawH * imgRatio;
      }

      const drawX = cx - drawW / 2 + offsetX;
      const drawY = cy - drawH / 2 + offsetY;

      ctx.save();
      // Smooth ambient blend
      ctx.globalAlpha = 0.38;
      ctx.drawImage(this.animeImg, drawX, drawY, drawW, drawH);

      // Cyber hologram scanlines
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = this.primaryColor;
      for (let y = 0; y < this.height; y += 4) {
        ctx.fillRect(0, y, this.width, 1.5);
      }
      ctx.restore();
    }

    renderParticles(cx, cy) {
      const ctx = this.ctx;
      this.particles.forEach(p => {
        p.x += p.vx * this.speed;
        p.y += p.vy * this.speed;
        p.z += p.vz * this.speed;

        if (p.x < -this.width) p.x = this.width;
        if (p.x > this.width) p.x = -this.width;
        if (p.y < -this.height) p.y = this.height;
        if (p.y > this.height) p.y = -this.height;
        if (p.z < -400) p.z = 400;
        if (p.z > 400) p.z = -400;

        const proj = this.project(p, cx, cy);
        if (proj.visible) {
          ctx.fillStyle = this.primaryColor;
          ctx.globalAlpha = p.alpha * Math.min(1, proj.scale);
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, p.radius * proj.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0;
    }

    loop() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      const cx = this.width / 2;
      const cy = this.height / 2;

      // Render Ambient Floating Particles
      if (this.mode !== 'frosted-clean') {
        this.renderParticles(cx, cy);
      }

      // Render Active Mode
      if (this.mode === 'quantum-cube') {
        this.renderQuantumCube(cx, cy);
      } else if (this.mode === 'cyber-grid') {
        this.renderCyberGrid(cx, cy);
      } else if (this.mode === 'anime-companion') {
        this.renderAnimeHologram(cx, cy);
      } else if (this.mode === 'stardust') {
        // Particles already rendered above with enhanced alpha
      }

      requestAnimationFrame(this.loop);
    }
  }

  window.CyberBackgroundEngine = CyberBackgroundEngine;
})();
