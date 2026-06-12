import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import { useGestureDetection } from '../../hooks/useGestureDetection';
import { playSound } from '../../utils/audio';
import styles from './ShuffleStage.module.css';
import copy from '../../data/copy.json';
import cardsData from '../../data/cards.json';
import type { Card } from '../../types';

/** 洗牌动画时长（毫秒） */
const SHUFFLE_DURATION = 3500;

type ShufflePhase = 'waiting' | 'shuffling' | 'spreading';

export default function ShuffleStage() {
  const setStage      = useAppStore((s) => s.setStage);
  const setDrawnDeck  = useAppStore((s) => s.setDrawnDeck);
  const isHandTrackingReady = useAppStore((s) => s.isHandTrackingReady);

  const [phase, setPhase] = useState<ShufflePhase>('waiting');
  const phaseRef = useRef<ShufflePhase>('waiting');
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const containerRef  = useRef<HTMLDivElement>(null);
  const deckRef       = useRef<HTMLDivElement>(null);
  const promptRef     = useRef<HTMLParagraphElement>(null);

  // 淡入
  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1, ease: 'power2.out' }
    ).fromTo(deckRef.current,
      { opacity: 0, scale: 0.8 },
      { opacity: 1, scale: 1, duration: 1, ease: 'power3.out' },
      '-=0.3'
    );
  }, []);

  // 握拳触发洗牌
  useGestureDetection({
    onHandsTogether: () => {
      if (phaseRef.current !== 'waiting') return;
      startShuffle();
    },
    enabled: isHandTrackingReady,
  });

  const startShuffle = () => {
    setPhase('shuffling');
    playSound('handTogether'); // 握拳填满音
    playSound('shuffle');      // 洗牌音（3.5s）

    // 提示文字淡出
    gsap.to(promptRef.current, { opacity: 0, duration: 0.4 });

    // 牌堆漂浮 + 旋转 + 发光
    const tl = gsap.timeline();
    tl.to(deckRef.current, {
      y: -20, rotation: -8, duration: 0.6, ease: 'power2.out',
    })
    .to(deckRef.current, {
      y: 10, rotation: 12, duration: 0.8, ease: 'power2.inOut',
    })
    .to(deckRef.current, {
      y: -15, rotation: -5, duration: 0.7, ease: 'power2.inOut',
    })
    .to(deckRef.current, {
      y: 0, rotation: 0, duration: 0.6, ease: 'power3.out',
      filter: 'drop-shadow(0 0 24px rgba(123,97,255,0.8))',
    })
    // 发光消退 + 推进到散牌
    .to(deckRef.current, {
      filter: 'drop-shadow(0 0 0px rgba(123,97,255,0))',
      duration: 0.5,
      onComplete: () => {
        // 洗完：生成随机牌序，存入 store
        const shuffled = shuffleArray([...cardsData] as Card[]);
        setDrawnDeck(shuffled);
        setPhase('spreading');
        spreadCards();
      },
    });
  };

  const spreadCards = () => {
    // 牌堆缩小淡出后切换到 DRAW
    gsap.to(deckRef.current, {
      scale: 0.6, opacity: 0, duration: 0.6, ease: 'power2.in',
      onComplete: () => {
        gsap.to(containerRef.current, {
          opacity: 0, duration: 0.6, ease: 'power2.in',
          onComplete: () => setStage('DRAW'),
        });
      },
    });
  };

  return (
    <div ref={containerRef} className={styles.container}>
      {/* 牌堆（多层叠放的虚拟卡片） */}
      <div ref={deckRef} className={styles.deckWrap}>
        <DeckVisual />
      </div>

      {/* 底部提示（等待握拳时显示） */}
      {phase === 'waiting' && (
        <p ref={promptRef} className={styles.prompt}>
          {copy.shuffle.prompt}
        </p>
      )}
    </div>
  );
}

/** 视觉牌堆：多层 div 叠放，营造厚度感 */
function DeckVisual() {
  return (
    <div className={styles.deck}>
      {[4, 3, 2, 1, 0].map((offset) => (
        <div
          key={offset}
          className={styles.deckCard}
          style={{
            transform: `translate(${offset * 1.5}px, ${-offset * 1.5}px)`,
            zIndex: 5 - offset,
            opacity: 1 - offset * 0.12,
          }}
        />
      ))}
    </div>
  );
}

/** Fisher-Yates 洗牌 */
function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
