import { useAppStore } from '../../hooks/useAppState';
import styles from './ErrorOverlay.module.css';
import copy from '../../data/copy.json';

export default function ErrorOverlay() {
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);
  const setStage = useAppStore((s) => s.setStage);

  if (!error) return null;

  const errorMap = {
    NO_CAMERA: copy.errors.noCamera,
    HAND_LOST: copy.errors.handLost,
    API_FAILED: copy.errors.apiFailed,
    BROWSER_UNSUPPORTED: copy.errors.browserUnsupported,
    MODEL_LOAD_FAILED: { title: copy.errors.modelLoadFailed.title, body: '' },
  };

  const content = errorMap[error.type];

  const handleRetry = () => {
    setError(null);
    if (error.type === 'NO_CAMERA') {
      window.location.reload();
    } else if (error.type === 'API_FAILED') {
      setError(null);
    } else if (error.type === 'HAND_LOST') {
      setStage('TUTORIAL');
      setError(null);
    }
  };

  return (
    <div className={`${styles.overlay} ${error.recoverable ? styles.soft : styles.full}`}>
      <p className={styles.title}>{content.title}</p>
      {content.body && <p className={styles.body}>{content.body}</p>}
      {error.recoverable && (
        <button className={styles.retryBtn} onClick={handleRetry}>
          重新尝试
        </button>
      )}
    </div>
  );
}
