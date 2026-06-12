import { useEffect, useRef } from 'react';
import { useAppStore } from './useAppState';

/** 手掌张开需持续的最短时长（ms），达到后才触发 onPalmOpen；供 UI 进度条使用 */
export const PALM_HOLD_MS = 700;

interface GestureOptions {
  onHandsTogether?: () => void;
  onPinch?: () => void;
  onPalmOpen?: () => void;
  enabled?: boolean;
}

export function useGestureDetection({
  onHandsTogether,
  onPinch,
  onPalmOpen,
  enabled = true,
}: GestureOptions) {
  const onHTRef      = useRef(onHandsTogether);
  const onPinchRef   = useRef(onPinch);
  const onPalmRef    = useRef(onPalmOpen);

  // 防止同一手势重复触发
  const htFiredRef   = useRef(false);
  const palmFiredRef = useRef(false);
  const palmStartRef = useRef<number | null>(null);

  useEffect(() => { onHTRef.current    = onHandsTogether; });
  useEffect(() => { onPinchRef.current = onPinch; });
  useEffect(() => { onPalmRef.current  = onPalmOpen; });

  useEffect(() => {
    if (!enabled) return;
    htFiredRef.current   = false;
    palmFiredRef.current = false;
    palmStartRef.current = null;

    const unsub = useAppStore.subscribe((state) => {
      const gs = state.gestureState;

      // ── 握拳：progress 到 1 时只触发一次 ──────────────────────
      if (gs.handsTogetherProgress >= 1 && !htFiredRef.current) {
        htFiredRef.current = true;
        onHTRef.current?.();
      }
      if (gs.handsTogetherProgress < 1) {
        htFiredRef.current = false;
      }

      // ── 捏合：pinchTriggered 为 true 的那一帧 ──────────────────
      if (gs.pinchTriggered) {
        onPinchRef.current?.();
      }

      // ── 手掌张开：持续 PALM_HOLD_MS 后触发一次，松手后重置 ──────
      if (gs.isPointing) {
        if (palmStartRef.current === null) {
          palmStartRef.current = Date.now();
        }
        if (
          !palmFiredRef.current &&
          Date.now() - palmStartRef.current >= PALM_HOLD_MS
        ) {
          palmFiredRef.current = true;
          onPalmRef.current?.();
        }
      } else {
        palmStartRef.current = null;
        palmFiredRef.current = false;
      }
    });

    return unsub;
  }, [enabled]);
}
