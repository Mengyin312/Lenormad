import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import { initAudio } from '../../utils/audio';
import styles from './EntryStage.module.css';
import copy from '../../data/copy.json';

export default function EntryStage() {
  const setStage = useAppStore((s) => s.setStage);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(
      titleRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 1.5, ease: 'power2.out' }
    ).fromTo(
      btnRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1, ease: 'power2.out' },
      '+=0.5'
    );
    return () => { tl.kill(); };
  }, []);

  const handleEnter = () => {
    // 首次用户交互：预加载所有音频（浏览器要求）
    initAudio();
    gsap.to([titleRef.current, btnRef.current], {
      opacity: 0,
      duration: 0.8,
      ease: 'power2.in',
      onComplete: () => setStage('CAMERA_PERMISSION'),
    });
  };

  return (
    <div className={styles.container}>
      <div ref={titleRef} className={styles.titleBlock}>
        <p className={styles.titleLine1}>{copy.entry.welcomeLine1}</p>
        <p className={styles.titleLine2}>{copy.entry.welcomeLine2}</p>
      </div>
      <button
        ref={btnRef}
        className={styles.enterBtn}
        onClick={handleEnter}
      >
        {copy.entry.enterButton}
      </button>
    </div>
  );
}
