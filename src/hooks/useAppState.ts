import { create } from 'zustand';
import type { AppState, AppStage, Card, SelectedCard, GestureState, AppError, HandLandmark } from '../types';

interface AppActions {
  setStage: (stage: AppStage) => void;
  setQuestion: (question: string) => void;
  setDrawnDeck: (deck: Card[]) => void;
  addSelectedCard: (card: SelectedCard) => void;
  setInterpretation: (text: string) => void;
  appendInterpretation: (chunk: string) => void;
  setIsInterpreting: (value: boolean) => void;
  setError: (error: AppError | null) => void;
  setGestureState: (gs: Partial<GestureState>) => void;
  setHandLandmarks: (landmarks: HandLandmark[][] | null) => void;
  setHandTrackingReady: (ready: boolean) => void;
  toggleMute: () => void;
  setResultCardDataUrl: (url: string) => void;
  reset: () => void;
}

const initialGestureState: GestureState = {
  handsTogether: false,
  handsTogetherProgress: 0,
  pinchTriggered: false,
  hoveredCardIndex: null,
  handsDetected: 0,
  isPointing: false,
  fingerTipNorm: null,
};

const initialState: AppState = {
  stage: 'ENTRY',
  question: '',
  selectedCards: [],
  drawnDeck: [],
  interpretation: '',
  isInterpreting: false,
  error: null,
  gestureState: initialGestureState,
  handLandmarks: null,
  isHandTrackingReady: false,
  isMuted: false,
  resultCardDataUrl: null,
};

export const useAppStore = create<AppState & AppActions>((set) => ({
  ...initialState,

  setStage: (stage) => set({ stage }),
  setQuestion: (question) => set({ question }),
  setDrawnDeck: (drawnDeck) => set({ drawnDeck }),
  addSelectedCard: (card) =>
    set((s) => ({ selectedCards: [...s.selectedCards, card] })),
  setInterpretation: (interpretation) => set({ interpretation }),
  appendInterpretation: (chunk) =>
    set((s) => ({ interpretation: s.interpretation + chunk })),
  setIsInterpreting: (isInterpreting) => set({ isInterpreting }),
  setError: (error) => set({ error }),
  setGestureState: (gs) =>
    set((s) => ({ gestureState: { ...s.gestureState, ...gs } })),
  setHandLandmarks: (handLandmarks) => set({ handLandmarks }),
  setHandTrackingReady: (isHandTrackingReady) => set({ isHandTrackingReady }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setResultCardDataUrl: (resultCardDataUrl) => set({ resultCardDataUrl }),

  reset: () =>
    set({
      stage: 'QUESTION',
      question: '',
      selectedCards: [],
      drawnDeck: [],
      interpretation: '',
      isInterpreting: false,
      error: null,
      gestureState: initialGestureState,
      handLandmarks: null,
      resultCardDataUrl: null,
      // isHandTrackingReady 不重置，手部追踪持续运行
    }),
}));
