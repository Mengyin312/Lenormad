import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import { streamInterpretation } from '../../utils/apiClient';
import { playSound } from '../../utils/audio';
import styles from './RevealStage.module.css';
import copy from '../../data/copy.json';

const CARD_BACK      = '/cardback.jpg';
const FLIP_DURATION  = 0.8;
const FLIP_STAGGER   = 1.5;
const POST_FLIP_WAIT = 1200;

export default function RevealStage() {
  const setStage             = useAppStore((s) => s.setStage);
  const selectedCards        = useAppStore((s) => s.selectedCards);
  const question             = useAppStore((s) => s.question);
  const setInterpretation    = useAppStore((s) => s.setInterpretation);
  const appendInterpretation = useAppStore((s) => s.appendInterpretation);
  const setIsInterpreting    = useAppStore((s) => s.setIsInterpreting);
  const setError             = useAppStore((s) => s.setError);

  const [showInterpret, setShowInterpret] = useState(false);
  const [interpretText, setInterpretText] = useState('');
  const [interpretDone, setInterpretDone] = useState(false);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [retryNonce, setRetryNonce]       = useState(0);

  const containerRef    = useRef<HTMLDivElement>(null);
  const cardRefs        = useRef<(HTMLDivElement | null)[]>([]);
  const nameRefs        = useRef<(HTMLSpanElement | null)[]>([]);
  const interpretRef    = useRef<HTMLDivElement>(null);
  const interpretBodyRef = useRef<HTMLParagraphElement>(null);

  // 淡入
  useEffect(() => {
    gsap.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1, ease: 'power2.out' }
    );
  }, []);

  // 逐张翻牌
  useEffect(() => {
    if (selectedCards.length < 5) return;
    const tl = gsap.timeline();
    selectedCards.forEach((_, i) => {
      const cardEl = cardRefs.current[i];
      const nameEl = nameRefs.current[i];
      if (!cardEl || !nameEl) return;
      tl.to(cardEl, {
        rotateY: 90, duration: FLIP_DURATION / 2, ease: 'power2.in',
        onComplete: () => {
          cardEl.classList.add(styles.cardFront);
          playSound('cardFlip'); // 每张翻开时播放
        },
      }, i * FLIP_STAGGER)
        .to(cardEl, { rotateY: 0, duration: FLIP_DURATION / 2, ease: 'power2.out' })
        .fromTo(nameEl,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' },
          `-=${FLIP_DURATION / 4}`
        );
    });
    tl.call(() => {
      playSound('revealBell'); // 全部翻完后播放钟声
      setTimeout(() => setShowInterpret(true), POST_FLIP_WAIT);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 解读区域淡入 + 调用 AI
  useEffect(() => {
    if (!showInterpret || !interpretRef.current) return;
    gsap.fromTo(interpretRef.current,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }
    );

    let cancelled = false;
    setInterpretation('');
    setIsInterpreting(true);
    setInterpretText('');
    setApiError(null);

    (async () => {
      try {
        for await (const chunk of streamInterpretation(question, selectedCards)) {
          if (cancelled) break;
          setInterpretText((prev) => prev + chunk);
          appendInterpretation(chunk);
        }
        if (!cancelled) { setInterpretDone(true); setIsInterpreting(false); }
      } catch (err) {
        if (!cancelled) {
          setApiError(err instanceof Error ? err.message : String(err));
          setIsInterpreting(false);
          setError({ type: 'API_FAILED', recoverable: true });
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInterpret, retryNonce]);

  // 重新加载解读
  const handleRetry = () => {
    setApiError(null);
    setInterpretText('');
    setInterpretDone(false);
    setRetryNonce((n) => n + 1);
  };

  // 流式输出时自动滚到底部，确保最新文字始终可见
  useEffect(() => {
    const el = interpretBodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [interpretText]);

  // 解读完成后 2.5 秒进入 RESULT
  useEffect(() => {
    if (!interpretDone) return;
    const t = setTimeout(() => {
      gsap.to(containerRef.current, {
        opacity: 0, duration: 0.8, ease: 'power2.in',
        onComplete: () => setStage('RESULT'),
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [interpretDone, setStage]);

  return (
    <div ref={containerRef} className={styles.container}>
      {/* 5 张牌 */}
      <div className={styles.cardsRow}>
        {selectedCards.map((sc, i) => (
          <div key={i} className={styles.cardWrap}>
            <div ref={(el) => { cardRefs.current[i] = el; }} className={styles.card}>
              <img src={CARD_BACK} className={styles.cardBackImg} draggable={false} alt="" />
              <div className={styles.cardFaceContent}>
                <img src={sc.card.image} className={styles.cardFrontImg} draggable={false} alt={sc.card.name_zh} />
              </div>
            </div>
            <span ref={(el) => { nameRefs.current[i] = el; }} className={styles.cardLabel}>
              {copy.reveal.shortLabels[i]}　{sc.card.name_zh}
            </span>
          </div>
        ))}
      </div>

      {/* AI 解读区域 */}
      {showInterpret && (
        <div ref={interpretRef} className={styles.interpretation}>
          <h2 className={styles.interpretTitle}>{copy.reveal.interpretationTitle}</h2>
          {apiError ? (
            <div className={styles.errorWrap}>
              <p className={styles.errorText}>{copy.errors.apiFailed.title}</p>
              <p className={styles.errorBody}>{copy.errors.apiFailed.body}</p>
              <button className={styles.retryBtn} onClick={handleRetry}>
                重新加载解读
              </button>
            </div>
          ) : (
            <p ref={interpretBodyRef} className={styles.interpretBody}>
              {interpretText || (
                <span className={styles.placeholder}>{copy.reveal.generatingPlaceholder}</span>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
