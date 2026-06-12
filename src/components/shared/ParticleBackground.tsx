import { useEffect, useRef } from 'react';
import styles from './ParticleBackground.module.css';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  opacity: number;
  type: 0 | 1; // 0=金色, 1=紫色
  phase: number;
  phaseSpeed: number;
}

interface ShootingStar {
  x: number; y: number;
  angle: number;
  speed: number;
  length: number;
  opacity: number;
  life: number;
  maxLife: number;
}

function makeParticle(w: number, h: number): Particle {
  const type = Math.random() < 0.65 ? 0 : 1;
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.30,
    vy: (Math.random() - 0.5) * 0.30,
    size:    type === 0 ? Math.random() * 2.0 + 0.8  : Math.random() * 1.2 + 0.4,
    opacity: type === 0 ? Math.random() * 0.60 + 0.20 : Math.random() * 0.35 + 0.10,
    type,
    phase:      Math.random() * Math.PI * 2,
    phaseSpeed: Math.random() * 0.020 + 0.005,
  };
}

function makeShootingStar(w: number, h: number): ShootingStar {
  const angle = (Math.PI / 4) + (Math.random() - 0.5) * (Math.PI / 5);
  return {
    x:       Math.random() * w * 0.65,
    y:       Math.random() * h * 0.35,
    angle,
    speed:   5 + Math.random() * 7,
    length:  70 + Math.random() * 130,
    opacity: 0.55 + Math.random() * 0.45,
    life:    0,
    maxLife: 40 + Math.random() * 35,
  };
}

export default function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext('2d')!;
    let rafId    = 0;
    let particles: Particle[]         = [];
    let shootingStars: ShootingStar[] = [];
    let frameCount = 0;
    let nextShoot  = 180 + Math.random() * 240;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.max(100, Math.min(160, Math.floor((canvas.width * canvas.height) / 8500)));
      particles = Array.from({ length: count }, () => makeParticle(canvas.width, canvas.height));
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frameCount++;

      // ── 流星生成 ──────────────────────────────────────────────
      if (frameCount >= nextShoot) {
        shootingStars.push(makeShootingStar(canvas.width, canvas.height));
        nextShoot = frameCount + 200 + Math.random() * 320;
      }

      // ── 绘制流星 ──────────────────────────────────────────────
      shootingStars = shootingStars.filter(s => s.life < s.maxLife);
      for (const s of shootingStars) {
        const t     = s.life / s.maxLife;
        const alpha = t < 0.2 ? t / 0.2 : t > 0.8 ? (1 - t) / 0.2 : 1.0;
        const ao    = s.opacity * alpha;

        const tx = s.x - Math.cos(s.angle) * s.length;
        const ty = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
        grad.addColorStop(0,   `rgba(255,200,120,0)`);
        grad.addColorStop(0.5, `rgba(255,215,140,${ao * 0.45})`);
        grad.addColorStop(1,   `rgba(255,245,200,${ao})`);

        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = grad;
        ctx.lineWidth   = 1.6;
        ctx.stroke();

        // 流星头部亮点
        const hg = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 5);
        hg.addColorStop(0, `rgba(255,245,180,${ao})`);
        hg.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.beginPath();
        ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = hg;
        ctx.fill();

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.life++;
      }

      // ── 绘制粒子 ──────────────────────────────────────────────
      for (const p of particles) {
        p.x     += p.vx;
        p.y     += p.vy;
        p.phase += p.phaseSpeed;

        if (p.x < -4) p.x = canvas.width  + 4;
        else if (p.x > canvas.width  + 4) p.x = -4;
        if (p.y < -4) p.y = canvas.height + 4;
        else if (p.y > canvas.height + 4) p.y = -4;

        const flicker = 0.65 + 0.35 * Math.sin(p.phase);
        const ao      = p.opacity * flicker;

        if (p.type === 0) {
          // 金色粒子：外层光晕 + 亮核
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5.5);
          glow.addColorStop(0, `rgba(232,191,122,${ao * 0.75})`);
          glow.addColorStop(1, 'rgba(232,191,122,0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 5.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,225,155,${Math.min(ao * 1.7, 1)})`;
          ctx.fill();
        } else {
          // 紫色微粒
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(158,127,255,${ao})`;
          ctx.fill();
        }
      }

      rafId = requestAnimationFrame(animate);
    };

    resize();
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} />;
}
