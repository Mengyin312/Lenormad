import { useEffect, useRef } from 'react';
import { useAppStore } from '../hooks/useAppState';
import { useHandTracking } from '../hooks/useHandTracking';
import { startAmbience, setMuted } from '../utils/audio';
import EntryStage from './stages/EntryStage';
import CameraPermissionStage from './stages/CameraPermissionStage';
import TutorialStage from './stages/TutorialStage';
import QuestionStage from './stages/QuestionStage';
import ShuffleStage from './stages/ShuffleStage';
import DrawStage from './stages/DrawStage';
import RevealStage from './stages/RevealStage';
import ResultStage from './stages/ResultStage';
import ParticleBackground from './shared/ParticleBackground';
import ClickParticles from './shared/ClickParticles';
import HaloRing from './shared/HaloRing';
import ErrorOverlay from './shared/ErrorOverlay';
import styles from './App.module.css';

const TRACKING_STAGES = new Set(['TUTORIAL', 'QUESTION', 'SHUFFLE', 'DRAW', 'REVEAL', 'RESULT']);
const PARTICLE_STAGES = new Set(['TUTORIAL', 'QUESTION', 'SHUFFLE', 'DRAW', 'REVEAL', 'RESULT']);

export default function App() {
  const stage      = useAppStore((s) => s.stage);
  const setStage   = useAppStore((s) => s.setStage);
  const isMuted    = useAppStore((s) => s.isMuted);
  const toggleMute = useAppStore((s) => s.toggleMute);
  const videoRef   = useRef<HTMLVideoElement>(null);

  useHandTracking(videoRef, TRACKING_STAGES.has(stage));

  // TUTORIAL 开始时启动 BGM + 粒子环境音
  useEffect(() => {
    if (stage === 'TUTORIAL') startAmbience();
  }, [stage]);

  // isMuted 变化时同步到 Howler
  useEffect(() => { setMuted(isMuted); }, [isMuted]);

  const handleStreamReady = async (stream: MediaStream) => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
    setStage('TUTORIAL');
  };

  const renderStage = () => {
    switch (stage) {
      case 'ENTRY':             return <EntryStage />;
      case 'CAMERA_PERMISSION': return <CameraPermissionStage onStreamReady={handleStreamReady} />;
      case 'TUTORIAL':          return <TutorialStage />;
      case 'QUESTION':          return <QuestionStage />;
      case 'SHUFFLE':           return <ShuffleStage />;
      case 'DRAW':              return <DrawStage />;
      case 'REVEAL':            return <RevealStage />;
      case 'RESULT':            return <ResultStage />;
    }
  };

  const showCamera = TRACKING_STAGES.has(stage);

  return (
    <div className={styles.app}>
      {/* 摄像头预览：HUD 小窗 */}
      <div className={`${styles.cameraWrap} ${showCamera ? styles.cameraWrapVisible : ''}`}>
        <video ref={videoRef} className={styles.camera} playsInline muted />
      </div>

      {/* 粒子背景 */}
      {PARTICLE_STAGES.has(stage) && <ParticleBackground />}

      {/* 主内容 */}
      <div className={styles.stageWrapper}>
        {renderStage()}
      </div>

      {/* 全局叠层 */}
      <ClickParticles />
      {/* TUTORIAL 阶段用内置进度环，全局 HaloRing 只在其他阶段显示 */}
      {stage !== 'TUTORIAL' && <HaloRing />}
      <ErrorOverlay />

      {/* 静音按钮（右上角，悬停才显示） */}
      {PARTICLE_STAGES.has(stage) && (
        <button
          className={styles.muteBtn}
          onClick={toggleMute}
          aria-label={isMuted ? '取消静音' : '静音'}
        >
          {isMuted ? '♪̶' : '♪'}
        </button>
      )}
    </div>
  );
}
