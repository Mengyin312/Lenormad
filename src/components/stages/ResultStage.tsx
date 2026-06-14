import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { toPng } from 'html-to-image';
import QRCode from 'qrcode';
import { useAppStore } from '../../hooks/useAppState';
import { useGestureDetection } from '../../hooks/useGestureDetection';
import type { SelectedCard } from '../../types';
import { stripMarkdown } from '../../utils/format';
import styles from './ResultStage.module.css';
import copy from '../../data/copy.json';

export default function ResultStage() {
  const reset               = useAppStore((s) => s.reset);
  const question            = useAppStore((s) => s.question);
  const selectedCards       = useAppStore((s) => s.selectedCards);
  const interpretation      = useAppStore((s) => s.interpretation);
  const isHandTrackingReady = useAppStore((s) => s.isHandTrackingReady);

  const containerRef = useRef<HTMLDivElement>(null);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const [qrDataUrl,  setQrDataUrl]  = useState('');
  const [isSharing,  setIsSharing]  = useState(false);
  const [shareLabel, setShareLabel] = useState('分享这次占卜');
  const [fading,     setFading]     = useState(false);

  // 生成 QR 码
  useEffect(() => {
    QRCode.toDataURL(window.location.origin, {
      color: { dark: '#9E7FFF', light: '#00000000' },
      width: 160,
      margin: 0,
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, []);

  // 页面淡入
  useEffect(() => {
    gsap.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1.2, ease: 'power2.out' }
    );
  }, []);

  // 淡出 + reset
  const doReset = useCallback(() => {
    if (fading) return;
    setFading(true);
    gsap.to(containerRef.current, {
      opacity: 0, duration: 0.8, ease: 'power2.in',
      onComplete: reset,
    });
  }, [fading, reset]);

  // 握拳触发「再来一次」
  useGestureDetection({
    onHandsTogether: doReset,
    enabled: isHandTrackingReady && !fading,
  });

  // 分享
  const handleShare = async () => {
    if (isSharing || !shareCardRef.current) return;
    setIsSharing(true);
    setShareLabel('生成中…');
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#04040C',
      });

      let shared = false;
      if (typeof navigator.share === 'function') {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'lenormand-reading.png', { type: 'image/png' });
          if (navigator.canShare?.({ files: [file] })) {
            await navigator.share({ files: [file], title: '一次雷诺曼占卜' });
            shared = true;
          }
        } catch { /* 用户取消，fallback 下载 */ }
      }
      if (!shared) {
        const a = document.createElement('a');
        a.download = 'lenormand-reading.png';
        a.href = dataUrl;
        a.click();
      }
      setShareLabel('已保存 ✓');
      setTimeout(() => setShareLabel('分享这次占卜'), 2500);
    } catch (err) {
      console.error('share error', err);
      setShareLabel('分享这次占卜');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div ref={containerRef} className={styles.container}>

      {/* ── 顶部固定：问题 + 5张牌缩略图 ── */}
      <div className={styles.header}>
        <p className={styles.eyebrow}>{copy.result.title}</p>
        <h1 className={styles.question}>「{question}」</h1>
        <div className={styles.thumbRow}>
          {selectedCards.map((sc, i) => (
            <div key={i} className={styles.thumbItem}>
              <div className={styles.thumbWrap}>
                <img src={sc.card.image} className={styles.thumbImg}
                     alt={sc.card.name_zh} draggable={false} />
              </div>
              <span className={styles.thumbPos}>{copy.reveal.shortLabels[i]}</span>
              <span className={styles.thumbName}>{sc.card.name_zh}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 滚动主体 ── */}
      <div className={styles.scrollBody}>

        {/* ── 单牌含义 ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionLine} />
            每张牌说的是
            <span className={styles.sectionLine} />
          </h2>

          <div className={styles.cardMeanings}>
            {selectedCards.map((sc, i) => (
              <div key={i} className={styles.cm}>
                {/* 图片 */}
                <div className={styles.cmImgWrap}>
                  <img src={sc.card.image} className={styles.cmImg}
                       alt={sc.card.name_zh} draggable={false} />
                  <span className={styles.cmPosTag}>{copy.reveal.shortLabels[i]}</span>
                </div>
                {/* 文字 */}
                <div className={styles.cmBody}>
                  <div className={styles.cmNameRow}>
                    <span className={styles.cmNameZh}>{sc.card.name_zh}</span>
                    <span className={styles.cmNameEn}>{sc.card.name_en}</span>
                  </div>
                  <p className={styles.cmKeywords}>
                    {sc.card.keywords.join('　·　')}
                  </p>
                  <p className={styles.cmMeaning}>{sc.card.meaning}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 牌阵整体解读 ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionLine} />
            牌阵整体解读
            <span className={styles.sectionLine} />
          </h2>
          <p className={styles.interpretText}>{stripMarkdown(interpretation)}</p>
        </section>

        {/* 底部留白，让内容不贴着操作栏 */}
        <div className={styles.scrollPad} />
      </div>

      {/* ── 底部固定：操作 ── */}
      <div className={styles.actions}>
        <button className={styles.shareBtn} onClick={handleShare} disabled={isSharing}>
          <ShareIcon />
          {shareLabel}
        </button>
        <button className={styles.againBtn} onClick={doReset} disabled={fading}>
          {copy.result.againPrompt}
        </button>
      </div>

      {/* ── 离屏分享卡片 ── */}
      <ShareCard
        ref={shareCardRef}
        question={question}
        selectedCards={selectedCards}
        interpretation={interpretation}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}

/* ─── 分享卡片（离屏渲染，供 html-to-image 截图） ─────────────── */
interface ShareCardProps {
  question: string;
  selectedCards: SelectedCard[];
  interpretation: string;
  qrDataUrl: string;
}

const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  ({ question, selectedCards, interpretation, qrDataUrl }, ref) => (
    <div ref={ref} className={styles.shareCard}>
      {/* 品牌头 */}
      <div className={styles.scHeader}>
        <span className={styles.scBrand}>LENORMAND</span>
        <span className={styles.scDeco}>✦</span>
      </div>

      {/* 问题 */}
      <div className={styles.scQuestion}>
        <span className={styles.scQuestionMark}>问：</span>
        <span className={styles.scQuestionText}>{question}</span>
      </div>

      <div className={styles.scDivider} />

      {/* 5张牌（图+位置+牌名） */}
      <div className={styles.scCards}>
        {selectedCards.map((sc, i) => (
          <div key={i} className={styles.scCardItem}>
            <img src={sc.card.image} className={styles.scCardImg}
                 alt={sc.card.name_zh} crossOrigin="anonymous" />
            <span className={styles.scCardPos}>{copy.reveal.shortLabels[i]}</span>
            <span className={styles.scCardName}>{sc.card.name_zh}</span>
          </div>
        ))}
      </div>

      <div className={styles.scDivider} />

      {/* 每张牌的关键词（紧凑版） */}
      <div className={styles.scKeywordRows}>
        {selectedCards.map((sc, i) => (
          <div key={i} className={styles.scKwRow}>
            <span className={styles.scKwPos}>{copy.reveal.shortLabels[i]} · {sc.card.name_zh}</span>
            <span className={styles.scKwWords}>{sc.card.keywords.join(' · ')}</span>
          </div>
        ))}
      </div>

      <div className={styles.scDivider} />

      {/* AI 解读 */}
      <p className={styles.scReading}>{stripMarkdown(interpretation)}</p>

      <div className={styles.scDivider} />

      {/* QR + 召唤语 */}
      <div className={styles.scFooter}>
        {qrDataUrl && <img src={qrDataUrl} className={styles.scQr} alt="QR" />}
        <div className={styles.scCallout}>
          <p className={styles.scCalloutMain}>{copy.result.qrCallout}</p>
          <p className={styles.scCalloutUrl}>{window.location.origin}</p>
        </div>
      </div>
    </div>
  )
);
ShareCard.displayName = 'ShareCard';

/* ─── 图标 ──────────────────────────────────────────────────────── */
function ShareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}
