import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import { useGestureDetection, PALM_HOLD_MS } from '../../hooks/useGestureDetection';
import { fistDebugRatios, getPinchDistance } from '../../utils/gestureHelpers';
import { playSound } from '../../utils/audio';
import HandIndicator from '../shared/HandIndicator';
import styles from './TutorialStage.module.css';
import copy from '../../data/copy.json';

const DEV = import.meta.env.DEV;

const STEP_MS  = 10_000;
const READY_MS =  2_000;

type Phase = 'step0' | 'step1' | 'step2' | 'ready';

const GESTURES = [
  { label: copy.tutorial.gesture1, hint: '握紧拳头，停留约 2 秒',        demo: 'fist'  },
  { label: copy.tutorial.gesture2, hint: '张开手掌，面向镜头，保持约 1 秒', demo: 'palm'  },
  { label: copy.tutorial.gesture3, hint: '四根手指并拢，再与大拇指捏合在一起', demo: 'pinch' },
];

export default function TutorialStage() {
  const setStage            = useAppStore((s) => s.setStage);
  const isHandTrackingReady = useAppStore((s) => s.isHandTrackingReady);
  const gestureState        = useAppStore((s) => s.gestureState);
  const handLandmarks       = useAppStore((s) => s.handLandmarks);

  const [phase, setPhase]               = useState<Phase>('step0');
  const [palmProgress, setPalmProgress] = useState(0);
  const [pinchFlash, setPinchFlash]     = useState(false);

  const phaseRef         = useRef<Phase>('step0');
  const transitioningRef = useRef(false);
  const containerRef     = useRef<HTMLDivElement>(null);
  const contentRef       = useRef<HTMLDivElement>(null);
  const readyRef         = useRef<HTMLParagraphElement>(null);
  const palmRafRef       = useRef<number>(0);
  const palmStartRef     = useRef<number | null>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── 整页淡入 ──────────────────────────────────────────────────
  useEffect(() => {
    gsap.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.5, ease: 'power2.out' }
    );
  }, []);

  // ── 首次检测到手时播放提示音 ───────────────────────────────────
  const handDetectedPlayedRef = useRef(false);
  useEffect(() => {
    if (!handDetectedPlayedRef.current && gestureState.handsDetected > 0) {
      handDetectedPlayedRef.current = true;
      playSound('handDetected');
    }
  }, [gestureState.handsDetected]);

  // ── 切换阶段时：内容淡入 ──────────────────────────────────────
  useEffect(() => {
    if (phase === 'ready') {
      gsap.fromTo(readyRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power2.out' }
      );
      return;
    }
    if (contentRef.current) {
      gsap.fromTo(contentRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }
      );
    }
  }, [phase]);

  // ── step1：rAF 跟踪手掌张开进度 ──────────────────────────────
  useEffect(() => {
    if (phase !== 'step1') { setPalmProgress(0); return; }
    const tick = () => {
      const gs = useAppStore.getState().gestureState;
      if (gs.isPointing) {
        if (palmStartRef.current === null) palmStartRef.current = Date.now();
        setPalmProgress(Math.min(1, (Date.now() - palmStartRef.current) / PALM_HOLD_MS));
      } else {
        palmStartRef.current = null;
        setPalmProgress(0);
      }
      palmRafRef.current = requestAnimationFrame(tick);
    };
    palmRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(palmRafRef.current);
      setPalmProgress(0);
      palmStartRef.current = null;
    };
  }, [phase]);

  // ── step2：捏合时满环闪光 ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'step2') { setPinchFlash(false); return; }
    const unsub = useAppStore.subscribe((s) => {
      if (s.gestureState.pinchTriggered) setPinchFlash(true);
    });
    return () => { unsub(); setPinchFlash(false); };
  }, [phase]);

  // ── 推进阶段 ──────────────────────────────────────────────────
  const doAdvance = useCallback((fromPhase: Phase) => {
    if (phaseRef.current !== fromPhase) return;
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    if (fromPhase !== 'ready') {
      const next: Phase =
        fromPhase === 'step0' ? 'step1' :
        fromPhase === 'step1' ? 'step2' : 'ready';
      if (fromPhase === 'step0') playSound('handTogether');
      gsap.to(contentRef.current, {
        opacity: 0, y: -10, duration: 0.4, ease: 'power2.in',
        onComplete: () => { transitioningRef.current = false; setPhase(next); },
      });
    } else {
      gsap.to(containerRef.current, {
        opacity: 0, duration: 0.8, ease: 'power2.in',
        onComplete: () => { transitioningRef.current = false; setStage('QUESTION'); },
      });
    }
  }, [setStage]);

  // ── 自动推进 ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => doAdvance(phase), phase === 'ready' ? READY_MS : STEP_MS);
    return () => clearTimeout(timer);
  }, [phase, doAdvance]);

  // ── 手势检测 ──────────────────────────────────────────────────
  useGestureDetection({
    onHandsTogether: () => doAdvance('step0'),
    onPalmOpen:      () => doAdvance('step1'),
    onPinch:         () => doAdvance('step2'),
    enabled: isHandTrackingReady,
  });

  const gestureIdx = phase === 'step0' ? 0 : phase === 'step1' ? 1 : 2;
  const fistProgress = gestureState.handsTogetherProgress;

  // 三个手势统一用一套进度环
  const currentProgress =
    phase === 'step0' ? fistProgress :
    phase === 'step1' ? palmProgress :
    pinchFlash ? 1 : 0;

  return (
    <div ref={containerRef} className={styles.container}>

      {phase !== 'ready' ? (
        <>
          <p className={styles.intro}>{copy.tutorial.intro}</p>

          {/* 演示区 */}
          <div ref={contentRef} className={styles.content}>

            {/* 进度环包裹手势图标 */}
            <GestureOrb progress={currentProgress}>
              {GESTURES[gestureIdx].demo === 'fist'  && <FistSVG  />}
              {GESTURES[gestureIdx].demo === 'palm'  && <PalmSVG  />}
              {GESTURES[gestureIdx].demo === 'pinch' && <PinchSVG />}
            </GestureOrb>

            <p className={styles.label}>{GESTURES[gestureIdx].label}</p>
          </div>

          {/* 手部指示器 */}
          <div className={styles.indicator}>
            <HandIndicator />
            {!isHandTrackingReady && (
              <span className={styles.hint}>正在准备识别系统…</span>
            )}
            {isHandTrackingReady && (
              <span className={styles.hint}>{GESTURES[gestureIdx].hint}</span>
            )}
          </div>
        </>
      ) : (
        <p ref={readyRef} className={styles.readyText}>{copy.tutorial.ready}</p>
      )}

      {/* DEV 调试 */}
      {DEV && (() => {
        const ratios    = handLandmarks?.[0] ? fistDebugRatios(handLandmarks[0]) : [];
        const pinchDist = handLandmarks?.[0] ? getPinchDistance(handLandmarks[0]) : null;
        return (
          <div className={styles.debug}>
            <span>阶段:{phase}</span>
            <span>手:{gestureState.handsDetected}</span>
            <span>握拳:{gestureState.handsTogether ? '✓' : '✗'}</span>
            <span>进度:{(fistProgress * 100).toFixed(0)}%</span>
            {pinchDist !== null && (
              <span>捏距:{pinchDist.toFixed(3)}{gestureState.pinchTriggered ? ' ✓' : ''}</span>
            )}
            {ratios.length > 0 && (
              <span>比值:{ratios.map(r => r.toFixed(2)).join(' ')}</span>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ── 进度环 + 图标一体 ──────────────────────────────────────────
function GestureOrb({ progress, children }: { progress: number; children: ReactNode }) {
  const SIZE = 160;
  const R    = 70;
  const CIRC = 2 * Math.PI * R;
  const CX   = SIZE / 2;

  const arcRef = useRef<SVGCircleElement>(null);
  const prevCompleteRef = useRef(false);

  // 完成时：弧线短暂爆发发光
  useEffect(() => {
    if (progress >= 1 && !prevCompleteRef.current && arcRef.current) {
      prevCompleteRef.current = true;
      gsap.fromTo(arcRef.current,
        { filter: 'drop-shadow(0 0 4px var(--color-accent))' },
        { filter: 'drop-shadow(0 0 20px var(--color-accent)) drop-shadow(0 0 40px rgba(124,92,252,0.6))',
          duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
    }
    if (progress < 1) prevCompleteRef.current = false;
  }, [progress >= 1]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.gestureOrb}>
      {/* SVG 圆环叠层 */}
      <svg
        className={styles.gestureOrbRing}
        width={SIZE} height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
      >
        {/* 轨道 */}
        <circle cx={CX} cy={CX} r={R}
          stroke="rgba(240,240,245,0.07)" strokeWidth="1.5" fill="none" />
        {/* 进度弧 */}
        <circle
          ref={arcRef}
          cx={CX} cy={CX} r={R}
          stroke="var(--color-accent)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: `${CX}px ${CX}px`,
            transition: 'stroke-dashoffset 0.06s linear, opacity 0.3s ease',
            opacity: progress > 0 ? 1 : 0,
            filter: progress > 0
              ? 'drop-shadow(0 0 5px var(--color-accent)) drop-shadow(0 0 10px rgba(124,92,252,0.35))'
              : 'none',
          }}
        />
      </svg>

      {/* 图标居中 */}
      <div className={styles.gestureOrbIcon}>
        {children}
      </div>
    </div>
  );
}

// ── 手掌 SVG ────────────────────────────────────────────────
function PalmSVG() {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.4 });
    tl.to(svgRef.current, { scale: 1.08, duration: 1.1, ease: 'power1.inOut' });
    return () => { tl.kill(); };
  }, []);
  return (
    <svg ref={svgRef} width="68" height="68" viewBox="0 0 96 96" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <g stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28 84 H68 C75 84 79 79 79 72 V31 C79 26 75 22 71 22 C67 22 64 25 64 29 V18 C64 13 60 10 56 10 C52 10 48 13 48 18 V15 C48 10 44 7 40 7 C36 7 32 10 32 15 V22 C32 17 28 14 24 14 C20 14 17 17 17 22 V37 C15 35 13 34 10 34 C6 34 4 37 4 41 V72 C4 79 9 84 16 84 H28 Z"/>
        <path d="M32 22V47"/>
        <path d="M48 15V47"/>
        <path d="M64 18V47"/>
        <path d="M30 58 C38 53 49 53 58 58"/>
        <path d="M31 70 C40 66 50 66 59 70"/>
      </g>
    </svg>
  );
}

// ── 握拳 SVG ────────────────────────────────────────────────
function FistSVG() {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.7 });
    tl.to(svgRef.current, { scale: 0.88, duration: 0.45, ease: 'power2.in' })
      .to(svgRef.current, { scale: 1.0,  duration: 0.55, ease: 'power2.out' });
    return () => { tl.kill(); };
  }, []);
  return (
    <svg ref={svgRef} width="68" height="68" viewBox="0 0 96 96" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <path d="M31 37V26C31 20.8 35.2 16.5 40.4 16.5C44.2 16.5 47.4 18.7 48.8 21.9C50.3 18.8 53.5 16.7 57.2 16.7C62.1 16.7 66.2 20.5 66.6 25.3C68.1 23.7 70.3 22.8 72.8 22.8C78 22.8 82 26.9 82 32.1V58.5C82 72.2 71.1 83 57.4 83H39.5C27.4 83 18 73.4 18 61.4V50.7C18 43.9 23.8 38.3 31 37Z"
            stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M31 38H42.8C49.7 38 55.2 43.5 55.2 50.2C55.2 55.1 51.3 59 46.4 59H32.5"
            stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M47 58C54.8 61.7 60.2 68.1 61.8 75"
            stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M49 23V39" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M66.5 28V42" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round"/>
      <path d="M40 25V39" stroke="var(--color-accent)" strokeWidth="4" strokeLinecap="round"/>
    </svg>
  );
}

// ── 捏合 SVG ────────────────────────────────────────────────
function PinchSVG() {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const tl = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 0.4 });
    tl.to(svgRef.current, { scale: 0.88, duration: 0.6, ease: 'power2.inOut' });
    return () => { tl.kill(); };
  }, []);
  return (
    <svg ref={svgRef} width="68" height="68" viewBox="0 0 96 96" fill="none"
         xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        fill="var(--color-accent)"
        d="M 5.19 21.32 L 5.19 21.65 L 4.86 22.14 L 4.86 24.41 L 5.84 26.35 L 7.78 28.14 L 10.54 29.43 L 13.46 30.24 L 15.89 30.57 L 16.05 30.73 L 16.86 30.73 L 17.03 30.89 L 19.62 31.05 L 19.78 31.22 L 22.05 31.22 L 24.81 32.03 L 27.24 32.35 L 27.41 32.51 L 28.22 32.51 L 28.38 32.68 L 29.19 32.68 L 29.35 32.84 L 36.16 33.49 L 36.32 33.97 L 35.51 35.76 L 35.51 38.35 L 35.68 38.51 L 35.68 39.16 L 36.49 41.11 L 38.11 43.38 L 39.08 44.35 L 40.22 45.97 L 45.89 52.95 L 45.89 53.43 L 45.73 53.59 L 40.54 53.59 L 40.38 53.43 L 37.62 53.27 L 36.81 52.95 L 34.38 52.62 L 34.22 52.46 L 33.41 52.46 L 33.24 52.30 L 32.43 52.30 L 31.46 51.97 L 28.22 51.81 L 28.05 51.65 L 25.95 51.65 L 25.78 51.81 L 24.00 51.81 L 23.84 51.97 L 22.05 52.14 L 17.19 53.59 L 14.11 55.05 L 12.32 56.19 L 11.35 57.00 L 10.22 58.30 L 9.41 59.76 L 8.92 61.38 L 9.08 63.49 L 9.89 65.11 L 11.03 66.08 L 12.16 66.57 L 13.14 66.57 L 13.30 66.73 L 21.08 66.73 L 21.24 66.89 L 22.86 66.89 L 23.03 67.05 L 24.00 67.05 L 24.16 67.22 L 26.43 67.54 L 27.73 68.03 L 28.38 68.03 L 29.03 68.35 L 30.32 68.51 L 30.49 68.68 L 31.30 68.68 L 32.43 69.00 L 33.41 69.00 L 33.57 69.16 L 34.38 69.16 L 35.51 69.49 L 36.49 69.49 L 36.65 69.65 L 37.46 69.65 L 38.59 69.97 L 39.57 69.97 L 39.73 70.14 L 42.49 70.46 L 43.30 70.78 L 43.95 70.78 L 44.11 70.95 L 46.86 71.43 L 48.00 71.92 L 48.49 71.92 L 50.43 72.57 L 53.84 74.19 L 54.16 74.19 L 56.11 75.16 L 57.41 75.49 L 58.38 75.97 L 58.86 75.97 L 59.51 76.30 L 60.00 76.30 L 61.95 76.95 L 62.76 76.95 L 62.92 77.11 L 63.73 77.11 L 65.35 77.59 L 66.49 77.59 L 66.65 77.76 L 67.62 77.76 L 67.78 77.92 L 69.73 77.92 L 69.89 78.08 L 83.68 78.08 L 83.84 77.92 L 84.49 77.92 L 86.11 77.43 L 87.24 76.78 L 89.35 74.84 L 90.49 72.89 L 90.97 71.27 L 90.97 51.16 L 90.81 51.00 L 90.81 50.03 L 90.32 48.57 L 88.22 44.35 L 87.89 44.03 L 86.92 41.92 L 86.59 41.59 L 86.59 41.27 L 85.14 38.84 L 84.97 38.19 L 83.68 36.08 L 83.68 35.76 L 83.35 35.43 L 83.19 34.78 L 82.05 33.00 L 82.05 32.68 L 81.73 32.35 L 77.35 23.76 L 76.05 21.97 L 74.27 20.35 L 72.16 19.22 L 71.03 19.05 L 70.22 18.73 L 67.14 18.73 L 66.97 18.89 L 63.57 19.22 L 63.41 19.38 L 59.84 19.54 L 59.68 19.38 L 57.89 19.38 L 57.73 19.22 L 55.95 19.22 L 55.78 19.05 L 54.49 19.05 L 54.32 18.89 L 47.35 18.41 L 47.19 18.24 L 46.05 18.24 L 45.89 18.08 L 44.76 18.08 L 44.59 17.92 L 42.81 17.92 L 42.65 17.76 L 37.62 17.76 L 37.46 17.92 L 34.70 18.08 L 34.54 18.24 L 33.57 18.24 L 33.41 18.41 L 32.43 18.41 L 32.27 18.57 L 30.97 18.57 L 30.81 18.73 L 29.51 18.73 L 29.35 18.89 L 27.24 18.89 L 27.08 19.05 L 9.24 19.05 L 8.43 19.38 L 7.78 19.38 L 6.65 19.86 L 6.00 20.35 Z
        M 38.92 33.81 L 42.81 34.95 L 45.41 35.27 L 45.57 35.43 L 47.03 35.43 L 47.19 35.59 L 52.38 35.59 L 52.54 35.76 L 53.03 37.22 L 54.16 38.84 L 54.00 39.65 L 53.35 40.14 L 52.38 40.46 L 51.24 40.46 L 45.89 38.84 L 45.08 39.16 L 44.92 39.49 L 45.08 40.30 L 45.57 40.62 L 46.05 40.62 L 49.78 41.92 L 51.73 42.08 L 51.89 42.24 L 51.89 42.57 L 50.92 44.51 L 50.92 45.00 L 50.43 46.46 L 50.43 47.27 L 50.27 47.43 L 50.27 48.73 L 51.08 49.38 L 51.57 49.22 L 52.05 48.73 L 52.05 47.59 L 52.22 47.43 L 52.22 46.78 L 52.38 46.62 L 52.70 45.00 L 53.51 43.22 L 54.32 42.08 L 56.43 40.46 L 57.41 40.62 L 58.05 40.95 L 58.05 41.43 L 57.73 41.92 L 57.41 43.38 L 56.43 45.49 L 56.43 45.97 L 56.11 46.46 L 56.11 46.78 L 55.30 48.41 L 53.84 50.51 L 52.54 51.81 L 49.95 53.11 L 48.97 53.11 L 48.49 52.78 L 46.54 50.84 L 40.70 43.38 L 39.08 41.59 L 38.27 40.46 L 37.46 38.84 L 37.46 38.19 L 37.30 38.03 L 37.30 36.57 L 37.62 35.43 L 38.11 34.62 Z
        M 6.81 22.30 L 7.62 21.49 L 9.24 21.00 L 26.27 21.00 L 26.43 20.84 L 28.70 20.84 L 28.86 20.68 L 32.11 20.51 L 32.27 20.35 L 33.57 20.35 L 33.73 20.19 L 34.86 20.19 L 35.03 20.03 L 36.16 20.03 L 36.32 19.86 L 37.78 19.86 L 37.95 19.70 L 44.59 19.86 L 44.76 20.03 L 46.05 20.03 L 46.22 20.19 L 47.51 20.19 L 47.68 20.35 L 49.30 20.35 L 49.46 20.51 L 52.70 20.68 L 52.86 20.84 L 54.32 20.84 L 54.49 21.00 L 56.27 21.00 L 56.43 21.16 L 57.89 21.16 L 58.05 21.32 L 63.24 21.32 L 63.41 21.16 L 66.81 20.84 L 66.97 20.68 L 70.05 20.68 L 70.22 20.84 L 71.51 21.00 L 72.81 21.65 L 74.92 23.59 L 75.73 24.73 L 79.95 33.00 L 80.27 33.32 L 84.49 41.59 L 84.81 41.92 L 86.11 44.68 L 86.43 45.00 L 87.57 47.43 L 87.89 47.76 L 87.89 48.08 L 88.54 49.05 L 88.70 50.03 L 89.03 50.51 L 89.03 51.32 L 89.19 51.49 L 89.19 70.95 L 88.54 72.73 L 87.73 73.86 L 86.59 75.00 L 85.46 75.65 L 84.00 76.14 L 69.24 76.14 L 69.08 75.97 L 67.78 75.97 L 67.62 75.81 L 66.32 75.81 L 66.16 75.65 L 64.38 75.49 L 64.22 75.32 L 63.57 75.32 L 63.41 75.16 L 60.65 74.68 L 55.95 73.05 L 54.16 72.08 L 53.84 72.08 L 53.03 71.59 L 52.70 71.59 L 51.89 71.11 L 50.27 70.62 L 49.78 70.30 L 49.30 70.30 L 48.81 69.97 L 48.32 69.97 L 44.92 69.00 L 44.27 69.00 L 44.11 68.84 L 43.46 68.84 L 43.30 68.68 L 42.65 68.68 L 41.68 68.35 L 40.86 68.35 L 40.70 68.19 L 39.73 68.19 L 39.57 68.03 L 38.59 68.03 L 38.43 67.86 L 37.62 67.86 L 36.49 67.54 L 33.57 67.22 L 33.41 67.05 L 31.14 66.89 L 27.24 65.76 L 26.43 65.76 L 25.62 65.43 L 24.00 65.27 L 23.84 65.11 L 22.86 65.11 L 22.70 64.95 L 21.08 64.95 L 20.92 64.78 L 12.97 64.78 L 12.00 64.46 L 11.03 63.49 L 10.86 63.00 L 10.86 61.22 L 11.84 59.27 L 12.97 58.14 L 14.76 56.84 L 17.03 55.70 L 20.76 54.41 L 21.24 54.41 L 22.05 54.08 L 22.86 54.08 L 23.03 53.92 L 25.30 53.76 L 25.46 53.59 L 28.54 53.59 L 28.70 53.76 L 31.30 53.92 L 31.46 54.08 L 32.27 54.08 L 33.24 54.41 L 34.22 54.41 L 34.38 54.57 L 35.19 54.57 L 35.35 54.73 L 37.95 55.05 L 38.11 55.22 L 39.08 55.22 L 39.24 55.38 L 45.24 55.54 L 45.41 55.38 L 47.03 55.38 L 47.19 55.22 L 49.62 55.05 L 52.70 53.92 L 53.51 53.43 L 54.97 52.14 L 56.59 49.86 L 58.38 45.97 L 58.86 44.19 L 59.19 43.70 L 60.65 39.32 L 61.14 37.22 L 60.32 36.57 L 59.68 36.73 L 59.19 37.22 L 58.86 38.68 L 58.54 39.00 L 58.05 39.00 L 56.27 38.19 L 54.81 36.73 L 54.32 35.59 L 54.49 34.30 L 54.16 33.81 L 53.51 33.49 L 51.08 33.65 L 50.92 33.81 L 46.54 33.65 L 46.38 33.49 L 44.27 33.32 L 42.81 32.84 L 41.51 32.68 L 38.59 31.54 L 34.70 31.54 L 34.54 31.38 L 31.30 31.22 L 31.14 31.05 L 30.16 31.05 L 30.00 30.89 L 29.03 30.89 L 28.86 30.73 L 26.27 30.41 L 25.46 30.08 L 23.51 29.76 L 22.22 29.27 L 19.46 29.27 L 19.30 29.11 L 16.70 28.95 L 16.54 28.78 L 15.73 28.78 L 15.57 28.62 L 14.92 28.62 L 14.76 28.46 L 14.11 28.46 L 13.95 28.30 L 12.16 27.97 L 9.89 27.16 L 9.57 26.84 L 8.76 26.51 L 7.30 25.22 L 6.65 24.08 L 6.65 22.78 Z"
      />
    </svg>
  );
}
