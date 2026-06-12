/**
 * 全局音频管理器（单例）
 * 在首次用户交互后调用 initAudio()，之后按需 play
 */
import { Howl, Howler } from 'howler';

export type SoundName =
  | 'bgm'
  | 'ambientParticles'
  | 'handDetected'
  | 'handTogether'
  | 'shuffle'
  | 'cardFlip'
  | 'revealBell'
  | 'resultCard';

let _ready = false;
const _sounds: Partial<Record<SoundName, Howl>> = {};

/** 预加载所有音频（首次用户点击后调用） */
export function initAudio() {
  if (_ready) return;
  _ready = true;

  _sounds.bgm = new Howl({
    src: ['/audio/bgm.mp3'],
    loop: true, volume: 0,
  });
  _sounds.ambientParticles = new Howl({
    src: ['/audio/ambient-particles.mp3'],
    loop: true, volume: 0,
  });
  _sounds.handDetected = new Howl({ src: ['/audio/hand-detected.mp3'],  volume: 0.6 });
  _sounds.handTogether = new Howl({ src: ['/audio/hand-together.mp3'],  volume: 0.7 });
  _sounds.shuffle      = new Howl({ src: ['/audio/shuffle.mp3'],        volume: 0.8 });
  _sounds.cardFlip     = new Howl({ src: ['/audio/card-flip.mp3'],      volume: 0.6 });
  _sounds.revealBell   = new Howl({ src: ['/audio/reveal-bell.mp3'],    volume: 0.5 });
  _sounds.resultCard   = new Howl({ src: ['/audio/result-card.mp3'],    volume: 0.6 });
}

/** 开始背景氛围（TUTORIAL 进入时调用） */
export function startAmbience() {
  const bgm = _sounds.bgm;
  const amb = _sounds.ambientParticles;
  if (!bgm || !amb) return;
  if (!bgm.playing()) { bgm.play(); bgm.fade(0, 0.4, 3000); }
  if (!amb.playing()) { amb.play(); amb.fade(0, 0.15, 3000); }
}

/** 播放单次音效 */
export function playSound(name: SoundName) {
  _sounds[name]?.play();
}

/** 全局静音 / 恢复 */
export function setMuted(muted: boolean) {
  Howler.mute(muted);
}

/** 是否已初始化 */
export function isAudioReady() { return _ready; }
