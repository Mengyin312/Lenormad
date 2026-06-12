import { useAppStore } from '../../hooks/useAppState';
import styles from './HandIndicator.module.css';

// 根据检测到的手数量显示小圆点指示
export default function HandIndicator() {
  const handsDetected = useAppStore((s) => s.gestureState.handsDetected);
  const isReady = useAppStore((s) => s.isHandTrackingReady);

  return (
    <div className={styles.container}>
      <div className={`${styles.dot} ${isReady && handsDetected > 0 ? styles.active : ''}`} />
    </div>
  );
}
