import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useAppStore } from '../../hooks/useAppState';
import styles from './CameraPermissionStage.module.css';
import copy from '../../data/copy.json';

const DEV = import.meta.env.DEV;

interface Props {
  onStreamReady: (stream: MediaStream) => void;
}

export default function CameraPermissionStage({ onStreamReady }: Props) {
  const setError = useAppStore((s) => s.setError);
  const setStage = useAppStore((s) => s.setStage);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      containerRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 1, ease: 'power2.out' }
    );
  }, []);

  const handleAllow = async () => {
    if (loading) return;

    // 检查浏览器支持
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({ type: 'BROWSER_UNSUPPORTED', recoverable: false });
      return;
    }

    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      onStreamReady(stream);
    } catch (err) {
      setLoading(false);
      const e = err as DOMException;
      if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setError({ type: 'NO_CAMERA', recoverable: true });
      } else {
        // NotAllowedError 或其他
        setError({ type: 'NO_CAMERA', recoverable: true });
      }
    }
  };

  const lines = copy.cameraPermission.explanation.split('\n');

  return (
    <div ref={containerRef} className={styles.container}>
      <div className={styles.textBlock}>
        {lines.map((line, i) =>
          line === '' ? (
            <br key={i} />
          ) : (
            <p key={i} className={styles.text}>{line}</p>
          )
        )}
      </div>
      <button
        className={styles.allowBtn}
        onClick={handleAllow}
        disabled={loading}
      >
        {loading ? '…' : copy.cameraPermission.allowButton}
      </button>

      {/* 开发模式：跳过摄像头，直接进入后续阶段（手势不可用，仅供预览 UI） */}
      {DEV && (
        <button
          className={styles.devSkipBtn}
          onClick={() => setStage('TUTORIAL')}
        >
          跳过摄像头（开发）
        </button>
      )}
    </div>
  );
}
