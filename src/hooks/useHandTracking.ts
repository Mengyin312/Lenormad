import { useEffect } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useAppStore } from './useAppState';
import { isFist, getPinchDistance, isPalmOpen } from '../utils/gestureHelpers';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const SMOOTH_FRAMES = 3;
type LandmarkBuffer = { x: number; y: number; z: number }[][];
const landmarkBuffers: LandmarkBuffer[] = [];

function smoothLandmarks(current: LandmarkBuffer): LandmarkBuffer {
  landmarkBuffers.push(current);
  if (landmarkBuffers.length > SMOOTH_FRAMES) landmarkBuffers.shift();
  if (landmarkBuffers.length < SMOOTH_FRAMES) return current;

  return current.map((hand, hi) =>
    hand.map((_pt, pi) => {
      let x = 0, y = 0, z = 0;
      for (const frame of landmarkBuffers) {
        const p = frame[hi]?.[pi];
        if (p) { x += p.x; y += p.y; z += p.z; }
      }
      return { x: x / SMOOTH_FRAMES, y: y / SMOOTH_FRAMES, z: z / SMOOTH_FRAMES };
    })
  );
}

export function useHandTracking(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  active: boolean
) {
  const setHandLandmarks = useAppStore((s) => s.setHandLandmarks);
  const setGestureState = useAppStore((s) => s.setGestureState);
  const setHandTrackingReady = useAppStore((s) => s.setHandTrackingReady);
  const setError = useAppStore((s) => s.setError);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let rafId = 0;
    let landmarker: HandLandmarker | null = null;

    // 手势状态（在闭包内维护，不走 store）
    let handsTogetherStart: number | null = null;
    let lastPinchDist = 1;
    let pinchCooldownUntil = 0;

    const detect = () => {
      const video = videoRef.current;
      if (!video || !landmarker || video.readyState < 2) {
        rafId = requestAnimationFrame(detect);
        return;
      }

      const now = performance.now();
      const results = landmarker.detectForVideo(video, now);
      const smoothed = smoothLandmarks(results.landmarks as LandmarkBuffer);
      setHandLandmarks(smoothed);

      const count = smoothed.length;
      const wallNow = Date.now();

      // 握拳进度（取第一只手，单手即可）
      let handsTogetherProgress = 0;
      const together = count >= 1 && isFist(smoothed[0]);
      if (together) {
        if (handsTogetherStart === null) handsTogetherStart = wallNow;
        handsTogetherProgress = Math.min((wallNow - handsTogetherStart) / 2000, 1);
      } else {
        handsTogetherStart = null;
      }

      // 张开手掌检测（用于 DRAW 瞄准）
      const palmOpen = count >= 1 && isPalmOpen(smoothed[0]);
      // 掌心坐标 = 四个 MCP 关节平均值（比指尖稳定）
      const fingerTipNorm = palmOpen ? (() => {
        const h = smoothed[0];
        return {
          x: (h[5].x + h[9].x + h[13].x + h[17].x) / 4,
          y: (h[5].y + h[9].y + h[13].y + h[17].y) / 4,
        };
      })() : null;

      // 捏合（瞬时事件，1 秒冷却；非张掌状态时重置）
      let pinchTriggered = false;
      if (count >= 1) {
        const pinchDist = getPinchDistance(smoothed[0]);
        if (!palmOpen) {
          lastPinchDist = 1; // 非张掌状态重置，避免误触
        } else {
          if (import.meta.env.DEV) {
            console.log('[pinch] dist:', pinchDist.toFixed(4), '| last:', lastPinchDist.toFixed(4));
          }
          if (wallNow >= pinchCooldownUntil && lastPinchDist > 0.09 && pinchDist < 0.07) {
            pinchTriggered = true;
            pinchCooldownUntil = wallNow + 1000;
          }
          lastPinchDist = pinchDist;
        }
      }

      setGestureState({
        handsDetected: count,
        handsTogether: together,
        handsTogetherProgress,
        pinchTriggered,
        isPointing: palmOpen,
        fingerTipNorm,
      });

      rafId = requestAnimationFrame(detect);
    };

    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        if (cancelled) return;

        landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        if (cancelled) { landmarker.close(); return; }

        setHandTrackingReady(true);
        rafId = requestAnimationFrame(detect);
      } catch {
        if (!cancelled) setError({ type: 'MODEL_LOAD_FAILED', recoverable: false });
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      landmarker?.close();
      setHandTrackingReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
