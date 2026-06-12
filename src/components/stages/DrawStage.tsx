import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import { playSound } from '../../utils/audio';
import styles from './DrawStage.module.css';
import positionsData from '../../data/positions.json';

const CARD_BACK = '/cardback.jpg';

// ── 牌局布局常量 ───────────────────────────────────────────────
const CARD_W   = 110;
const CARD_H   = 185;
const X_STEP   = 30;   // 同排牌左边缘间距
const ROW_GAP  = 32;   // 两排之间的垂直间距
const GRID_W   = X_STEP * 17 + CARD_W;      // 620
const GRID_H   = CARD_H * 2 + ROW_GAP;      // 402
const SLOT_GAP = 24;

// ── 预计算每张牌的位置和可见区域 ──────────────────────────────────
interface CardLayout {
  deckIndex: number;
  x: number; y: number;
  zIndex: number;
  /** 实际可见的矩形（grid 内坐标） */
  vis: { x: number; y: number; w: number; h: number };
}

const CARD_LAYOUTS: CardLayout[] = (() => {
  const out: CardLayout[] = [];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 18; col++) {
      const deckIndex = row * 18 + col;
      const x        = col * X_STEP;
      const y        = row === 0 ? 0 : CARD_H + ROW_GAP; // 0 or 217
      const zIndex   = row === 0 ? 100 + col : col;
      const visW     = col === 17 ? CARD_W : X_STEP;
      out.push({
        deckIndex, x, y, zIndex,
        vis: { x, y, w: visW, h: CARD_H }, // 两排不重叠，无需裁剪
      });
    }
  }
  return out;
})();

// 按 zIndex 降序排列，用于悬停检测
const LAYOUTS_BY_Z = [...CARD_LAYOUTS].sort((a, b) => b.zIndex - a.zIndex);

function findHovered(gx: number, gy: number, pickedSet: Set<number>): number | null {
  for (const layout of LAYOUTS_BY_Z) {
    if (pickedSet.has(layout.deckIndex)) continue;
    const { x, y, w, h } = layout.vis;
    if (gx >= x && gx < x + w && gy >= y && gy < y + h) return layout.deckIndex;
  }
  return null;
}

// ── 主组件 ───────────────────────────────────────────────────
export default function DrawStage() {
  const setStage        = useAppStore((s) => s.setStage);
  const drawnDeck       = useAppStore((s) => s.drawnDeck);
  const selectedCards   = useAppStore((s) => s.selectedCards);
  const addSelectedCard = useAppStore((s) => s.addSelectedCard);

  const [pickedSet, setPickedSet]   = useState<Set<number>>(new Set());
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [dotPos, setDotPos]         = useState<{ x: number; y: number } | null>(null);

  const containerRef  = useRef<HTMLDivElement>(null);
  const gridRef       = useRef<HTMLDivElement>(null);
  const gridRectRef   = useRef<DOMRect | null>(null);
  const cardEls       = useRef<Map<number, HTMLDivElement>>(new Map());
  const slotEls       = useRef<(HTMLDivElement | null)[]>([null, null, null, null, null]);
  const animatingRef  = useRef(false);
  /** 平滑缓冲区：8 帧移动平均，消除光点抖动 */
  const dotBufRef     = useRef<{ x: number; y: number }[]>([]);

  // ── 淡入 ────────────────────────────────────────────────────
  useEffect(() => {
    gsap.fromTo(containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1, ease: 'power2.out' }
    );
  }, []);

  // ── 缓存 grid 的 DOMRect ────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (gridRef.current) gridRectRef.current = gridRef.current.getBoundingClientRect();
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── 订阅 store：tracking 手指位置 + 悬停检测 ──────────────────
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      const { isPointing, fingerTipNorm } = state.gestureState;
      if (!isPointing || !fingerTipNorm) {
        dotBufRef.current = [];   // 重置平滑缓冲
        setDotPos(null);
        setHoveredIdx(null);
        return;
      }

      // ── 坐标重映射 ──────────────────────────────────────────
      // 假设手在摄像头画面中的常用范围：
      //   x: [0.10, 0.90]（左右各留 10% 余量）
      //   y: [0.05, 0.75]（手通常不会到画面最底部，上方也有余量）
      // 将此范围拉伸到全屏，解决「需要移动很远才能到达下方牌」的问题
      const X_LO = 0.10, X_HI = 0.90;
      const Y_LO = 0.05, Y_HI = 0.75;
      const xFrac = Math.max(0, Math.min(1, (1 - fingerTipNorm.x - X_LO) / (X_HI - X_LO)));
      const yFrac = Math.max(0, Math.min(1, (fingerTipNorm.y    - Y_LO) / (Y_HI - Y_LO)));
      const rawX  = xFrac * window.innerWidth;
      const rawY  = yFrac * window.innerHeight;

      // ── 8 帧移动平均，消抖 ──────────────────────────────────
      const buf = dotBufRef.current;
      buf.push({ x: rawX, y: rawY });
      if (buf.length > 8) buf.shift();
      const sx = buf.reduce((s, p) => s + p.x, 0) / buf.length;
      const sy = buf.reduce((s, p) => s + p.y, 0) / buf.length;

      setDotPos({ x: sx, y: sy });

      // 转为 grid 内坐标进行悬停检测
      const rect = gridRectRef.current;
      if (!rect) return;
      setHoveredIdx(findHovered(sx - rect.left, sy - rect.top, pickedSet));
    });
    return unsub;
  }, [pickedSet]);

  // ── 悬停动画（上浮 + 发光描边） ───────────────────────────────
  const prevHoveredRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevHoveredRef.current;
    if (prev !== null && prev !== hoveredIdx) {
      const el = cardEls.current.get(prev);
      if (el) gsap.to(el, { y: 0, boxShadow: 'none', duration: 0.3, ease: 'power2.out' });
    }
    if (hoveredIdx !== null) {
      const el = cardEls.current.get(hoveredIdx);
      if (el) gsap.to(el, {
        y: -12,
        boxShadow: `0 0 0 1px var(--color-accent), 0 0 16px var(--color-accent-glow), 0 0 40px var(--color-accent-glow-sm)`,
        duration: 0.3, ease: 'power2.out',
      });
    }
    prevHoveredRef.current = hoveredIdx;
  }, [hoveredIdx]);

  // ── 捏合选牌 ──────────────────────────────────────────────────
  const handlePinch = useCallback(() => {
    if (animatingRef.current) return;
    if (hoveredIdx === null) return;
    if (pickedSet.has(hoveredIdx)) return;

    const slotIdx = pickedSet.size; // 下一个空槽位索引（0-4）
    if (slotIdx >= 5) return;

    const cardEl = cardEls.current.get(hoveredIdx);
    const slotEl = slotEls.current[slotIdx];
    if (!cardEl || !slotEl) return;

    animatingRef.current = true;

    const cardRect = cardEl.getBoundingClientRect();
    const slotRect = slotEl.getBoundingClientRect();
    const dx = slotRect.left - cardRect.left;
    const dy = slotRect.top  - cardRect.top;
    const dw = slotRect.width  / cardRect.width;
    const dh = slotRect.height / cardRect.height;

    // 重置当前悬停状态
    setHoveredIdx(null);
    prevHoveredRef.current = null;

    // 选牌音效
    playSound('cardFlip');

    // 飞牌动画
    gsap.to(cardEl, {
      x: dx, y: dy,
      scaleX: dw, scaleY: dh,
      zIndex: 999,
      duration: 0.8,
      ease: 'power2.inOut',
      onComplete: () => {
        // 存入 store
        addSelectedCard({
          position: slotIdx + 1,
          positionLabel: positionsData[slotIdx].label,
          card: drawnDeck[hoveredIdx],
        });
        // 标记已选
        setPickedSet((prev) => new Set(prev).add(hoveredIdx));
        // 槽位发光
        if (slotEl) gsap.fromTo(slotEl,
          { boxShadow: `0 0 20px var(--color-accent-glow)` },
          { boxShadow: 'none', duration: 0.8 }
        );
        animatingRef.current = false;
      },
    });
  }, [hoveredIdx, pickedSet, drawnDeck, addSelectedCard]);

  // ── 订阅 pinchTriggered ────────────────────────────────────
  useEffect(() => {
    const unsub = useAppStore.subscribe((state) => {
      if (state.gestureState.pinchTriggered && state.gestureState.isPointing) {
        handlePinch();
      }
    });
    return unsub;
  }, [handlePinch]);

  // ── 5 张选完 → 过渡到 REVEAL ─────────────────────────────────
  useEffect(() => {
    if (selectedCards.length < 5) return;
    const timer = setTimeout(() => {
      gsap.to(containerRef.current, {
        opacity: 0, duration: 0.8, ease: 'power2.in',
        onComplete: () => setStage('REVEAL'),
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [selectedCards.length, setStage]);

  // ── 当前已选数量 ───────────────────────────────────────────
  const pickedCount = pickedSet.size;
  const slotWidth   = CARD_W;
  const totalSlots  = slotWidth * 5 + SLOT_GAP * 4;

  return (
    <div ref={containerRef} className={styles.container}>

      {/* ── 5 个槽位 ── */}
      <div className={styles.slots} style={{ width: totalSlots }}>
        {positionsData.map((pos, i) => (
          <div key={pos.id} className={styles.slotWrap}>
            <div
              ref={(el) => { slotEls.current[i] = el; }}
              className={`${styles.slot} ${i < pickedCount ? styles.slotFilled : ''}`}
              style={{ width: CARD_W, height: CARD_H }}
            >
              {i < pickedCount && selectedCards[i] && (
                <img
                  src={selectedCards[i].card.image}
                  className={styles.slotCardImg}
                  draggable={false}
                  alt={selectedCards[i].card.name_zh}
                />
              )}
            </div>
            <span className={styles.slotLabel}>{pos.label}</span>
          </div>
        ))}
      </div>

      {/* ── 36 张牌网格 ── */}
      <div
        ref={gridRef}
        className={styles.grid}
        style={{ width: GRID_W, height: GRID_H }}
      >
        {CARD_LAYOUTS.map(({ deckIndex, x, y, zIndex }) => {
          const isPicked = pickedSet.has(deckIndex);
          return (
            <div
              key={deckIndex}
              ref={(el) => { if (el) cardEls.current.set(deckIndex, el); }}
              className={`${styles.card} ${isPicked ? styles.cardGhost : ''}`}
              style={{ left: x, top: y, width: CARD_W, height: CARD_H, zIndex }}
            >
              {!isPicked && (
                <img
                  src={CARD_BACK}
                  className={styles.cardImg}
                  draggable={false}
                  alt=""
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ── 底部提示 ── */}
      <p className={styles.hint}>
        {pickedCount < 5
          ? `第 ${pickedCount + 1} / 5 张　伸出食指瞄准 · 捏合选中`
          : ''}
      </p>

      {/* ── 食指光点 ── */}
      {dotPos && (
        <div
          className={styles.fingerDot}
          style={{ left: dotPos.x, top: dotPos.y }}
        />
      )}
    </div>
  );
}
