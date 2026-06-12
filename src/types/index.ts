export type AppStage =
  | 'ENTRY'
  | 'CAMERA_PERMISSION'
  | 'TUTORIAL'
  | 'QUESTION'
  | 'SHUFFLE'
  | 'DRAW'
  | 'REVEAL'
  | 'RESULT';

export interface Card {
  id: number;
  name_zh: string;
  name_en: string;
  image: string;
  keywords: string[];
  meaning: string;
}

export interface Position {
  id: number;
  label: string;
  fullName: string;
  description: string;
}

export interface SelectedCard {
  position: number;
  positionLabel: string;
  card: Card;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureState {
  handsTogether: boolean;
  handsTogetherProgress: number; // 0–1, 2s fill
  pinchTriggered: boolean;
  hoveredCardIndex: number | null;
  handsDetected: number;
  /** 食指伸出状态（用于 DRAW 选牌） */
  isPointing: boolean;
  /** 食指尖归一化坐标 [0,1]，isPointing 为 true 时有值 */
  fingerTipNorm: { x: number; y: number } | null;
}

export interface AppError {
  type:
    | 'NO_CAMERA'
    | 'HAND_LOST'
    | 'API_FAILED'
    | 'BROWSER_UNSUPPORTED'
    | 'MODEL_LOAD_FAILED';
  recoverable: boolean;
}

export interface AppState {
  stage: AppStage;
  question: string;
  selectedCards: SelectedCard[];
  drawnDeck: Card[];
  interpretation: string;
  isInterpreting: boolean;
  error: AppError | null;
  gestureState: GestureState;
  handLandmarks: HandLandmark[][] | null;
  isHandTrackingReady: boolean;
  isMuted: boolean;
  resultCardDataUrl: string | null;
}
