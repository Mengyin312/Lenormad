import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import styles from './HaloRing.module.css';

const R = 98;
const CIRCUMFERENCE = 2 * Math.PI * R;

export default function HaloRing() {
  const progress = useAppStore((s) => s.gestureState.handsTogetherProgress);
  const ringRef = useRef<SVGCircleElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const prevProgressRef = useRef(0);

  useEffect(() => {
    if (!ringRef.current) return;
    const offset = CIRCUMFERENCE * (1 - progress);
    ringRef.current.style.strokeDashoffset = String(offset);

    // 填满时：发光 + 收缩消失
    if (progress >= 1 && prevProgressRef.current < 1) {
      gsap.fromTo(
        svgRef.current,
        { filter: 'drop-shadow(0 0 0px rgba(123,97,255,0))' },
        {
          filter: 'drop-shadow(0 0 20px rgba(123,97,255,0.95))',
          duration: 0.15,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            gsap.to(svgRef.current, {
              scale: 0.8,
              opacity: 0,
              duration: 0.3,
              ease: 'power2.in',
            });
          },
        }
      );
    }

    // 松开时重置
    if (progress === 0 && prevProgressRef.current > 0) {
      gsap.killTweensOf(svgRef.current);
      gsap.set(svgRef.current, { scale: 1, opacity: 1, filter: 'none' });
    }

    prevProgressRef.current = progress;
  }, [progress]);

  if (progress === 0) return null;

  return (
    <svg
      ref={svgRef}
      className={styles.ring}
      width={200}
      height={200}
      viewBox="0 0 200 200"
    >
      {/* 轨道 */}
      <circle
        cx={100} cy={100} r={R}
        stroke="rgba(240,240,245,0.08)"
        strokeWidth={2}
        fill="none"
      />
      {/* 填充弧 */}
      <circle
        ref={ringRef}
        cx={100} cy={100} r={R}
        stroke="var(--color-accent)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px', transition: 'stroke-dashoffset 0.05s linear' }}
      />
    </svg>
  );
}
