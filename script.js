(function () {
      'use strict';

      // --- Constants & Configuration ---
      const MAX_BALLS = 1000;
      const SPAWN_MULTIPLIER = 3;
      const GAP_ANGLE = Math.PI / 4; // 45-degree open gap in radians
      const TRAIL_LENGTH = 8;        // Comet trail positions per ball
      const SUBSTEPS = 2;            // Physics sub-steps per frame for stable high-speed collisions

      // Vibrant Neon Palette (HSL hues & hexes)
      const NEON_HUES = [184, 325, 110, 52, 275, 16, 198, 345, 145, 295];

      // --- DOM Elements ---
      const stageContainer = document.getElementById('stageContainer');
      const canvas = document.getElementById('simCanvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      const ballCounterEl = document.getElementById('ballCounter');
      const progressFillEl = document.getElementById('progressFill');
      const audioToggleBtn = document.getElementById('audioToggleBtn');
      const audioStatusText = document.getElementById('audioStatusText');
      const fpsBadge = document.getElementById('fpsBadge');
      const pauseBtn = document.getElementById('pauseBtn');
      const spawnBoostBtn = document.getElementById('spawnBoostBtn');
      const spawn50Btn = document.getElementById('spawn50Btn');
      const finaleTestBtn = document.getElementById('finaleTestBtn');
      const resetBtn = document.getElementById('resetBtn');
      const finaleBanner = document.getElementById('finaleBanner');
      const bannerRestartBtn = document.getElementById('bannerRestartBtn');

      // --- Web Audio API Synthesizer ---
      class NeonSoundEngine {
        constructor() {
          this.ctx = null;
          this.muted = false;
          this.unlocked = false;
          this.lastBounceSoundTime = 0;
          this.lastEscapeSoundTime = 0;
          // Harmonic pentatonic frequencies for pleasant pitch-shifted pops
          this.scaleFreqs = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00];
        }

        unlock() {
          if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
              this.ctx = new AudioCtx();
            }
          }
          if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
          }
          this.unlocked = Boolean(this.ctx);
          this.updateUI();
        }

        toggleMute() {
          if (!this.unlocked) {
            this.unlock();
            this.muted = false;
          } else {
            this.muted = !this.muted;
          }
          this.updateUI();
        }

        updateUI() {
          if (this.unlocked && !this.muted) {
            audioToggleBtn.classList.add('active');
            audioStatusText.textContent = 'Sound On';
          } else if (this.unlocked && this.muted) {
            audioToggleBtn.classList.remove('active');
            audioStatusText.textContent = 'Muted';
          } else {
            audioToggleBtn.classList.remove('active');
            audioStatusText.textContent = 'Tap for Sound';
          }
        }

        playBouncePop(speedRatio = 0.5, ballCount = 1) {
          if (!this.unlocked || this.muted || !this.ctx) return;
          const now = performance.now();
          // Adaptive throttle so 1,000 balls don't saturate audio channels
          const minInterval = ballCount > 300 ? 32 : ballCount > 80 ? 22 : 12;
          if (now - this.lastBounceSoundTime < minInterval) return;
          this.lastBounceSoundTime = now;

          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          const baseNote = this.scaleFreqs[Math.floor(Math.random() * this.scaleFreqs.length)];
          const pitchShift = 0.85 + Math.min(speedRatio, 1.5) * 0.45 + (Math.random() * 0.12 - 0.06);
          const startFreq = baseNote * pitchShift;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(startFreq, t);
          osc.frequency.exponentialRampToValueAtTime(startFreq * 1.45, t + 0.045);

          const peakGain = Math.min(0.14, 0.22 / Math.pow(Math.max(1, ballCount), 0.28));
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(peakGain, t + 0.005);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + 0.06);
        }

        playEscapeChirp() {
          if (!this.unlocked || this.muted || !this.ctx) return;
          const now = performance.now();
          if (now - this.lastEscapeSoundTime < 45) return;
          this.lastEscapeSoundTime = now;

          const t = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          const baseFreq = 520 + Math.random() * 240;
          osc.frequency.setValueAtTime(baseFreq, t);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.85, t + 0.09);

          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.linearRampToValueAtTime(0.12, t + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(t);
          osc.stop(t + 0.1);
        }

        playFinaleExplosion() {
          if (!this.unlocked || this.muted || !this.ctx) return;
          const t = this.ctx.currentTime;
          const chord = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.5];

          chord.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            const start = t + idx * 0.03;
            osc.frequency.setValueAtTime(freq * 0.5, start);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, start + 0.45);

            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(start);
            osc.stop(start + 0.68);
          });
        }
      }

      const sound = new NeonSoundEngine();

      // --- Spatial Hash Grid for O(N) Collisions at 1,000 Balls ---
      class SpatialGrid {
        constructor(maxEntities) {
          this.cellSize = 24;
          this.cols = 1;
          this.rows = 1;
          this.heads = new Int32Array(4096);
          this.next = new Int32Array(maxEntities);
        }

        configure(width, height, cellSize) {
          this.cellSize = Math.max(10, cellSize);
          this.cols = Math.max(1, Math.ceil(width / this.cellSize) + 2);
          this.rows = Math.max(1, Math.ceil(height / this.cellSize) + 2);
          const totalCells = this.cols * this.rows;
          if (this.heads.length < totalCells) {
            this.heads = new Int32Array(totalCells);
          }
          this.heads.fill(-1, 0, totalCells);
        }

        insert(index, x, y) {
          const cx = Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize) + 1));
          const cy = Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize) + 1));
          const cellIndex = cy * this.cols + cx;
          this.next[index] = this.heads[cellIndex];
          this.heads[cellIndex] = index;
        }
      }

      const spatialGrid = new SpatialGrid(MAX_BALLS + 32);

      // --- Simulation State ---
      let width = 450;
      let height = 800;
      let dpr = 1;
      let centerX = width / 2;
      let centerY = height / 2;
      let ringRadius = 160;
      let ringThickness = 8;

      let ringAngle = -Math.PI / 4;       // Center angle of the 45-degree open gap
      const ringRotSpeed = 1.45;          // Continuous rotation speed (rad/sec)
      let ringHue = 184;                  // Current neon hue of the ring
      let ringGlowPulse = 0;              // Extra glow intensity on impact
      let ringDestroyed = false;          // True once 1,000 balls reached

      let gravity = 520;                  // Downward gravity (px/sec^2)
      let paused = false;
      let displayedCount = 1;

      // Active balls & shatter fragments
      let balls = [];
      let ringShards = [];
      let shockwaves = [];

      // Dynamic ball radius scaling slightly with ball count so 1,000 balls fit inside the ring cleanly
      function getTargetBallRadius(count) {
        const baseScale = Math.min(width, height) / 420;
        if (count < 25) return 7.5 * baseScale;
        if (count < 100) return 6.2 * baseScale;
        if (count < 350) return 5.0 * baseScale;
        return 4.1 * baseScale;
      }

      function normalizeAngleSigned(angle) {
        let a = (angle + Math.PI) % (2 * Math.PI);
        if (a < 0) a += 2 * Math.PI;
        return a - Math.PI;
      }

      function createBall(x, y, vx, vy) {
        const hue = NEON_HUES[Math.floor(Math.random() * NEON_HUES.length)] + (Math.random() * 16 - 8);
        const color = `hsl(${hue.toFixed(1)}, 100%, 60%)`;
        const glowColor = `hsl(${hue.toFixed(1)}, 100%, 55%)`;
        const r = getTargetBallRadius(balls.length + 1);

        const trailX = new Float32Array(TRAIL_LENGTH);
        const trailY = new Float32Array(TRAIL_LENGTH);
        trailX.fill(x);
        trailY.fill(y);

        return {
          x,
          y,
          vx,
          vy,
          r,
          hue,
          color,
          glowColor,
          escaped: false,
          trailX,
          trailY,
          trailHead: 0
        };
      }

      function spawnBallsAtCenter(count) {
        if (ringDestroyed) return;
        const availableSlots = MAX_BALLS - balls.length;
        const toSpawn = Math.min(count, availableSlots);

        for (let i = 0; i < toSpawn; i++) {
          const angle = Math.random() * Math.PI * 2;
          const jitter = Math.random() * Math.min(24, ringRadius * 0.16);
          const sx = centerX + Math.cos(angle) * jitter;
          const sy = centerY + Math.sin(angle) * jitter;

          const speed = 130 + Math.random() * 150;
          const dir = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
          const vx = Math.cos(dir) * speed;
          const vy = Math.sin(dir) * speed;

          balls.push(createBall(sx, sy, vx, vy));
        }

        updateCounterUI();

        // Check if we hit the 1,000-ball finale cap!
        if (balls.length >= MAX_BALLS && !ringDestroyed) {
          triggerThousandBallFinale();
        }
      }

      function triggerThousandBallFinale() {
        if (ringDestroyed) return;
        ringDestroyed = true;

        // Top up to exactly 1,000 balls if triggered via test button or last escape
        while (balls.length < MAX_BALLS) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * (ringRadius * 0.85);
          balls.push(
            createBall(
              centerX + Math.cos(a) * d,
              centerY + Math.sin(a) * d,
              (Math.random() - 0.5) * 200,
              (Math.random() - 0.5) * 200
            )
          );
        }

        updateCounterUI(true);
        sound.playFinaleExplosion();

        // Create glowing ring shatter shards
        ringShards = [];
        const shardCount = 42;
        const arcSpan = (Math.PI * 2 - GAP_ANGLE) / shardCount;
        const startArc = ringAngle + GAP_ANGLE / 2;

        for (let i = 0; i < shardCount; i++) {
          const a = startArc + (i + 0.5) * arcSpan;
          const sx = centerX + Math.cos(a) * ringRadius;
          const sy = centerY + Math.sin(a) * ringRadius;
          const outSpeed = 240 + Math.random() * 340;
          const hue = (ringHue + i * 7) % 360;
          ringShards.push({
            x: sx,
            y: sy,
            vx: Math.cos(a) * outSpeed + (Math.random() - 0.5) * 80,
            vy: Math.sin(a) * outSpeed + (Math.random() - 0.5) * 80,
            angle: a,
            vAngle: (Math.random() - 0.5) * 10,
            length: (ringRadius * arcSpan) * 1.15,
            hue,
            alpha: 1.0
          });
        }

        // Expanding neon shockwave
        shockwaves.push({
          x: centerX,
          y: centerY,
          r: ringRadius * 0.9,
          maxR: Math.max(width, height) * 1.2,
          alpha: 1.0,
          hue: ringHue
        });

        // Explode all 1,000 balls outward off-screen!
        for (let i = 0; i < balls.length; i++) {
          const b = balls[i];
          b.escaped = true;
          const dx = b.x - centerX;
          const dy = b.y - centerY;
          const dist = Math.hypot(dx, dy) || 1;
          const nx = dx / dist;
          const ny = dy / dist;
          const burstSpeed = 320 + Math.random() * 560;
          b.vx = nx * burstSpeed + (Math.random() - 0.5) * 180;
          b.vy = ny * burstSpeed + (Math.random() - 0.5) * 180;
        }

        finaleBanner.classList.add('visible');
      }

      function updateCounterUI(forceFinale = false) {
        const count = forceFinale ? MAX_BALLS : balls.length;
        if (count !== displayedCount) {
          displayedCount = count;
          ballCounterEl.textContent = count.toLocaleString();
          ballCounterEl.classList.remove('bump');
          void ballCounterEl.offsetWidth;
          ballCounterEl.classList.add('bump');
        } else {
          ballCounterEl.textContent = count.toLocaleString();
        }

        if (ringDestroyed || count >= MAX_BALLS) {
          ballCounterEl.classList.add('finale-reached');
          progressFillEl.style.width = '100%';
        } else {
          ballCounterEl.classList.remove('finale-reached');
          const pct = Math.min(100, Math.max(0.5, (count / MAX_BALLS) * 100));
          progressFillEl.style.width = `${pct.toFixed(1)}%`;
        }
      }

      function resetSimulation() {
        ringDestroyed = false;
        ringAngle = -Math.PI / 4;
        ringHue = 184;
        ringGlowPulse = 0;
        balls = [];
        ringShards = [];
        shockwaves = [];
        finaleBanner.classList.remove('visible');

        // Start with 1 ball at the center with a slight lively offset
        const startSpeed = 140;
        const startAngle = -Math.PI * 0.38;
        balls.push(
          createBall(
            centerX + 4,
            centerY - 6,
            Math.cos(startAngle) * startSpeed,
            Math.sin(startAngle) * startSpeed
          )
        );
        updateCounterUI();
      }

      // --- Resize & Responsive Geometry ---
      function handleResize() {
        const rect = stageContainer.getBoundingClientRect();
        width = Math.max(240, rect.width);
        height = Math.max(420, rect.height);
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        centerX = width / 2;
        centerY = height * 0.46; // Centered comfortably between top headline and bottom counter
        ringRadius = Math.min(width * 0.41, height * 0.235);
        ringThickness = Math.max(6, Math.min(width, height) * 0.019);
        gravity = height * 0.68;
      }

      // --- Physics Step ---
      function stepPhysics(dt) {
        if (paused) return;

        // Rotate ring continuously
        if (!ringDestroyed) {
          ringAngle = (ringAngle + ringRotSpeed * dt) % (Math.PI * 2);
        }
        if (ringGlowPulse > 0) {
          ringGlowPulse = Math.max(0, ringGlowPulse - dt * 3.5);
        }

        const targetRadius = getTargetBallRadius(balls.length);
        const subDt = dt / SUBSTEPS;
        const innerRingBoundary = ringRadius - ringThickness * 0.5;
        const outerRingBoundary = ringRadius + ringThickness * 0.5;

        for (let step = 0; step < SUBSTEPS; step++) {
          // 1. Integrate positions, gravity, and ring boundary collisions
          for (let i = 0; i < balls.length; i++) {
            const b = balls[i];
            // Smoothly adapt radius as ball population grows
            b.r += (targetRadius - b.r) * 0.08;

            b.vy += gravity * subDt;
            b.x += b.vx * subDt;
            b.y += b.vy * subDt;

            if (!ringDestroyed && !b.escaped) {
              const dx = b.x - centerX;
              const dy = b.y - centerY;
              const dist = Math.hypot(dx, dy);

              // Check if ball reaches the ring wall
              if (dist + b.r >= innerRingBoundary) {
                const ballAngle = Math.atan2(dy, dx);
                const angleDiff = Math.abs(normalizeAngleSigned(ballAngle - ringAngle));
                const effectiveHalfGap = (GAP_ANGLE * 0.5) - (b.r / ringRadius) * 0.65;

                if (angleDiff < effectiveHalfGap) {
                  // Ball is passing through the 45-degree open gap!
                  if (dist > outerRingBoundary) {
                    b.escaped = true;
                    sound.playEscapeChirp();
                  }
                } else if (dist > 0.0001) {
                  // Elastic collision with the rotating ring
                  const nx = dx / dist;
                  const ny = dy / dist;

                  // Push ball inside ring boundary
                  const overlap = (dist + b.r) - innerRingBoundary;
                  b.x -= nx * overlap;
                  b.y -= ny * overlap;

                  // Reflect velocity across normal + slight tangential kick from rotating ring
                  const vn = b.vx * nx + b.vy * ny;
                  if (vn > 0) {
                    const restitution = 1.008; // Keeps bounces energetic against gravity
                    b.vx -= (1 + restitution) * vn * nx;
                    b.vy -= (1 + restitution) * vn * ny;

                    // Tangential velocity transfer from rotating ring
                    const tx = -ny;
                    const ty = nx;
                    const ringTangentialBoost = ringRotSpeed * ringRadius * 0.08;
                    b.vx += tx * ringTangentialBoost;
                    b.vy += ty * ringTangentialBoost;

                    // Clamp extreme velocities so balls don't tunnel
                    const maxSpeed = height * 1.15;
                    const spd = Math.hypot(b.vx, b.vy);
                    if (spd > maxSpeed) {
                      const scale = maxSpeed / spd;
                      b.vx *= scale;
                      b.vy *= scale;
                    }

                    // Shift ring neon color & pulse on impact
                    ringHue = (ringHue + 14 + Math.random() * 18) % 360;
                    ringGlowPulse = 1.0;
                    sound.playBouncePop(spd / maxSpeed, balls.length);
                  }
                }
              }
            }
          }

          // 2. Spatial Partitioning for Elastic Ball-to-Ball Collisions
          if (!ringDestroyed && balls.length > 1) {
            const cellSize = Math.max(10, targetRadius * 2.4);
            spatialGrid.configure(width, height, cellSize);

            for (let i = 0; i < balls.length; i++) {
              spatialGrid.insert(i, balls[i].x, balls[i].y);
            }

            const cols = spatialGrid.cols;
            const rows = spatialGrid.rows;
            const heads = spatialGrid.heads;
            const next = spatialGrid.next;

            for (let cy = 0; cy < rows; cy++) {
              const rowOffset = cy * cols;
              for (let cx = 0; cx < cols; cx++) {
                const cellIdx = rowOffset + cx;
                let i = heads[cellIdx];

                while (i !== -1) {
                  const bi = balls[i];

                  // Check against remaining balls in the same cell
                  let j = next[i];
                  while (j !== -1) {
                    resolveBallCollision(bi, balls[j]);
                    j = next[j];
                  }

                  // Check 4 neighboring cells: Right, Bottom-Left, Bottom, Bottom-Right
                  if (cx + 1 < cols) {
                    j = heads[cellIdx + 1];
                    while (j !== -1) {
                      resolveBallCollision(bi, balls[j]);
                      j = next[j];
                    }
                  }
                  if (cy + 1 < rows) {
                    const nextRow = cellIdx + cols;
                    if (cx > 0) {
                      j = heads[nextRow - 1];
                      while (j !== -1) {
                        resolveBallCollision(bi, balls[j]);
                        j = next[j];
                      }
                    }
                    j = heads[nextRow];
                    while (j !== -1) {
                      resolveBallCollision(bi, balls[j]);
                      j = next[j];
                    }
                    if (cx + 1 < cols) {
                      j = heads[nextRow + 1];
                      while (j !== -1) {
                        resolveBallCollision(bi, balls[j]);
                        j = next[j];
                      }
                    }
                  }

                  i = next[i];
                }
              }
            }
          }
        }

        // 3. Record comet trails & check off-screen escaped balls
        let escapedOffScreenCount = 0;
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          b.trailHead = (b.trailHead + 1) % TRAIL_LENGTH;
          b.trailX[b.trailHead] = b.x;
          b.trailY[b.trailHead] = b.y;

          const margin = b.r * 3 + 20;
          const isOffScreen =
            b.x < -margin ||
            b.x > width + margin ||
            b.y < -margin ||
            b.y > height + margin;

          if (isOffScreen) {
            if (!ringDestroyed) {
              // Remove off-screen ball and queue 3 new balls at center
              balls.splice(i, 1);
              escapedOffScreenCount++;
            } else {
              // During 1,000-ball finale, remove once far off-screen
              balls.splice(i, 1);
            }
          }
        }

        if (!ringDestroyed && escapedOffScreenCount > 0) {
          spawnBallsAtCenter(escapedOffScreenCount * SPAWN_MULTIPLIER);
        }

        // Safety fallback: if all balls somehow left before finale, ensure simulation continues
        if (!ringDestroyed && balls.length === 0) {
          spawnBallsAtCenter(SPAWN_MULTIPLIER);
        }

        // 4. Update shatter shards & shockwaves during finale
        for (let i = ringShards.length - 1; i >= 0; i--) {
          const s = ringShards[i];
          s.vy += gravity * 0.35 * dt;
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.angle += s.vAngle * dt;
          s.alpha -= dt * 0.65;
          if (s.alpha <= 0) ringShards.splice(i, 1);
        }

        for (let i = shockwaves.length - 1; i >= 0; i--) {
          const sw = shockwaves[i];
          sw.r += (sw.maxR - sw.r) * dt * 4.5;
          sw.alpha -= dt * 1.4;
          if (sw.alpha <= 0) shockwaves.splice(i, 1);
        }
      }

      function resolveBallCollision(b1, b2) {
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const minDist = b1.r + b2.r;
        const distSq = dx * dx + dy * dy;

        if (distSq >= minDist * minDist || distSq < 0.00001) return;

        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        // Separate overlapping balls equally
        const overlap = (minDist - dist) * 0.5;
        b1.x -= nx * overlap;
        b1.y -= ny * overlap;
        b2.x += nx * overlap;
        b2.y += ny * overlap;

        // Relative velocity along normal
        const rvx = b2.vx - b1.vx;
        const rvy = b2.vy - b1.vy;
        const velAlongNormal = rvx * nx + rvy * ny;

        if (velAlongNormal > 0) return;

        // Elastic restitution
        const e = 0.98;
        const impulse = -(1 + e) * velAlongNormal * 0.5;
        const ix = impulse * nx;
        const iy = impulse * ny;

        b1.vx -= ix;
        b1.vy -= iy;
        b2.vx += ix;
        b2.vy += iy;

        // Occasional subtle pop sound on high-energy ball-to-ball hits when count is low
        if (balls.length < 60 && Math.abs(velAlongNormal) > 140) {
          sound.playBouncePop(0.4, balls.length);
        }
      }

      // --- Rendering ---
      function render() {
        // Pure black background fill
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        const ballCount = balls.length;

        // 1. Draw Fading Comet Trails
        // Adjust trail step density dynamically so 1,000 balls stay locked at 60 FPS
        const trailStep = ballCount > 500 ? 2 : 1;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 0;

        for (let i = 0; i < ballCount; i++) {
          const b = balls[i];
          ctx.beginPath();
          let idx = b.trailHead;
          ctx.moveTo(b.x, b.y);
          for (let t = 0; t < TRAIL_LENGTH - 1; t += trailStep) {
            const prevIdx = (idx - trailStep + TRAIL_LENGTH) % TRAIL_LENGTH;
            ctx.lineTo(b.trailX[prevIdx], b.trailY[prevIdx]);
            idx = prevIdx;
          }
          ctx.strokeStyle = `hsla(${b.hue.toFixed(0)}, 100%, 60%, ${ballCount > 400 ? 0.26 : 0.42})`;
          ctx.lineWidth = Math.max(1.5, b.r * 0.95);
          ctx.stroke();
        }

        // 2. Draw Glowing Neon Balls with shadowBlur
        // Scale shadowBlur smoothly so visual glow stays vibrant while maintaining 60 FPS at 1,000 balls
        const dynamicShadowBlur = ballCount > 600 ? 6 : ballCount > 250 ? 10 : 16;
        for (let i = 0; i < ballCount; i++) {
          const b = balls[i];
          ctx.save();
          ctx.shadowBlur = dynamicShadowBlur;
          ctx.shadowColor = b.glowColor;
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 3. Draw Rotating Ring with 45-Degree Open Gap
        if (!ringDestroyed) {
          const startArc = ringAngle + GAP_ANGLE * 0.5;
          const endArc = ringAngle + Math.PI * 2 - GAP_ANGLE * 0.5;
          const ringColor = `hsl(${ringHue.toFixed(1)}, 100%, ${58 + ringGlowPulse * 18}%)`;
          const ringShadowColor = `hsl(${ringHue.toFixed(1)}, 100%, 55%)`;

          ctx.save();
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, startArc, endArc, false);
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = ringThickness;
          ctx.lineCap = 'round';
          ctx.shadowBlur = 22 + ringGlowPulse * 20;
          ctx.shadowColor = ringShadowColor;
          ctx.stroke();

          // Inner bright core for extra neon pop
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, startArc, endArc, false);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = Math.max(1.5, ringThickness * 0.28);
          ctx.shadowBlur = 0;
          ctx.stroke();
          ctx.restore();
        }

        // 4. Draw Finale Ring Shards & Shockwaves
        if (ringShards.length > 0) {
          for (let i = 0; i < ringShards.length; i++) {
            const s = ringShards[i];
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.shadowBlur = 14;
            ctx.shadowColor = `hsl(${s.hue}, 100%, 55%)`;
            ctx.strokeStyle = `hsla(${s.hue}, 100%, 65%, ${Math.max(0, s.alpha)})`;
            ctx.lineWidth = ringThickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-s.length * 0.5, 0);
            ctx.lineTo(s.length * 0.5, 0);
            ctx.stroke();
            ctx.restore();
          }
        }

        if (shockwaves.length > 0) {
          for (let i = 0; i < shockwaves.length; i++) {
            const sw = shockwaves[i];
            ctx.save();
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
            ctx.strokeStyle = `hsla(${sw.hue}, 100%, 65%, ${Math.max(0, sw.alpha)})`;
            ctx.lineWidth = 4;
            ctx.shadowBlur = 20;
            ctx.shadowColor = `hsl(${sw.hue}, 100%, 60%)`;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // --- Main Animation Loop & FPS Tracker ---
      let lastFrameTime = performance.now();
      let fpsFrames = 0;
      let fpsTimer = performance.now();

      function loop(now) {
        const rawDt = (now - lastFrameTime) / 1000;
        lastFrameTime = now;
        const dt = Math.min(rawDt, 0.033); // Cap delta time to prevent spiral of death on tab switch

        fpsFrames++;
        if (now - fpsTimer >= 500) {
          const currentFps = Math.min(60, Math.round((fpsFrames * 1000) / (now - fpsTimer)));
          fpsBadge.textContent = `${currentFps} FPS`;
          fpsFrames = 0;
          fpsTimer = now;
        }

        stepPhysics(dt);
        render();
        requestAnimationFrame(loop);
      }

      // --- Event Listeners & Controls ---
      stageContainer.addEventListener('pointerdown', (e) => {
        if (!sound.unlocked) {
          sound.unlock();
        }
        // If user clicks directly on the canvas arena (not a control button), give a subtle impulse or spawn
        if (e.target === canvas && !ringDestroyed && !paused) {
          sound.playBouncePop(0.7, balls.length);
        }
      });

      audioToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.toggleMute();
      });

      pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.unlock();
        paused = !paused;
        pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      });

      spawnBoostBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.unlock();
        sound.playEscapeChirp();
        spawnBallsAtCenter(3);
      });

      spawn50Btn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.unlock();
        sound.playEscapeChirp();
        spawnBallsAtCenter(50);
      });

      finaleTestBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.unlock();
        triggerThousandBallFinale();
      });

      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.unlock();
        paused = false;
        pauseBtn.textContent = 'Pause';
        resetSimulation();
      });

      bannerRestartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.unlock();
        paused = false;
        pauseBtn.textContent = 'Pause';
        resetSimulation();
      });

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
          e.preventDefault();
          paused = !paused;
          pauseBtn.textContent = paused ? 'Resume' : 'Pause';
        } else if (e.key === 'r' || e.key === 'R') {
          paused = false;
          pauseBtn.textContent = 'Pause';
          resetSimulation();
        } else if (e.key === 'm' || e.key === 'M') {
          sound.toggleMute();
        }
      });

      window.addEventListener('resize', () => {
        handleResize();
        render();
      });

      window.onload = function () {
        handleResize();
        resetSimulation();
        requestAnimationFrame(loop);
      };
    })();
