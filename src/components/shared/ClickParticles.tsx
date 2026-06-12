import { useEffect } from 'react';
import { gsap } from 'gsap';

const PARTICLE_COUNT = 16;
const GOLD_RATIO = 0.60; // 60% 金色，40% 紫色

function spawnBurst(x: number, y: number) {
  // ── 冲击波环 ──────────────────────────────────────────────────
  const ring = document.createElement('div');
  ring.style.cssText = `
    position: fixed;
    left: ${x}px; top: ${y}px;
    width: 6px; height: 6px;
    border-radius: 50%;
    border: 1.5px solid rgba(124,92,252,0.90);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 99998;
  `;
  document.body.appendChild(ring);
  gsap.to(ring, {
    width: 72, height: 72,
    borderColor: 'rgba(124,92,252,0)',
    opacity: 0,
    duration: 0.55,
    ease: 'power2.out',
    onComplete: () => ring.remove(),
  });

  // 第二个更大的金色环（稍微慢一点）
  const ring2 = document.createElement('div');
  ring2.style.cssText = `
    position: fixed;
    left: ${x}px; top: ${y}px;
    width: 6px; height: 6px;
    border-radius: 50%;
    border: 1px solid rgba(232,191,124,0.70);
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 99997;
  `;
  document.body.appendChild(ring2);
  gsap.to(ring2, {
    width: 52, height: 52,
    borderColor: 'rgba(232,191,124,0)',
    opacity: 0,
    duration: 0.45,
    ease: 'power2.out',
    delay: 0.04,
    onComplete: () => ring2.remove(),
  });

  // ── 散射粒子 ──────────────────────────────────────────────────
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const isGold  = Math.random() < GOLD_RATIO;
    const size    = isGold ? 3 + Math.random() * 3.5 : 2 + Math.random() * 2.5;
    // 均匀分布角度 + 随机扰动
    const angle   = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist    = 45 + Math.random() * 85;
    const dur     = 0.50 + Math.random() * 0.45;
    const delay   = Math.random() * 0.06;

    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      left: ${x}px; top: ${y}px;
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle at 38% 32%,
        ${isGold
          ? 'rgba(255,235,160,1), rgba(232,191,124,0.9)'
          : 'rgba(196,181,253,1), rgba(124,92,252,0.9)'
        });
      box-shadow: 0 0 ${isGold ? '5px 2px rgba(232,191,124,0.85)' : '4px 1.5px rgba(124,92,252,0.80)'};
    `;
    document.body.appendChild(el);

    gsap.to(el, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      opacity: 0,
      scale: 0,
      duration: dur,
      ease: 'power2.out',
      delay,
      onComplete: () => el.remove(),
    });
  }

  // ── 几颗"火花"：速度更快、飞得更远 ─────────────────────────────
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 100 + Math.random() * 60;
    const el    = document.createElement('div');
    el.style.cssText = `
      position: fixed;
      left: ${x}px; top: ${y}px;
      width: 2px; height: 2px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      background: rgba(255,240,180,1);
      box-shadow: 0 0 4px 1px rgba(255,230,140,0.9);
    `;
    document.body.appendChild(el);
    gsap.to(el, {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      opacity: 0,
      duration: 0.7 + Math.random() * 0.3,
      ease: 'power3.out',
      delay: Math.random() * 0.04,
      onComplete: () => el.remove(),
    });
  }
}

export default function ClickParticles() {
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      // 只响应鼠标左键点击（忽略右键/中键）
      if (e.button !== 0) return;
      spawnBurst(e.clientX, e.clientY);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return null;
}
