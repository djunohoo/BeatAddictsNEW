import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Project, Track } from '../types';

interface ProjectStore {
  currentProject: Project | null;
  isPlaying: boolean;
  currentStep: number;
  setProject: (project: Project) => void;
  togglePlay: () => void;
  stop: () => void;
  setCurrentStep: (step: number) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  toggleStep: (trackId: string, rowIndex: number, stepIndex: number) => void;
  addTrack: (track: Track) => void;
  deleteTrack: (trackId: string) => void;
  setBPM: (bpm: number) => void;
}

const createDefaultProject = (): Project => ({
  id: '1',
  name: 'Untitled Project',
  bpm: 128,
  tracks: [
    {
      id: 'track-1',
      name: 'Kick',
      type: 'drums',
      volume: 0.8,
      pan: 0,
      muted: false,
      solo: false,
      color: '#a855f7',
      pattern: [Array(16).fill(false)]
    },
    {
      id: 'track-2',
      name: 'Snare',
      type: 'drums',
      volume: 0.7,
      pan: 0,
      muted: false,
      solo: false,
      color: '#06b6d4',
      pattern: [Array(16).fill(false)]
    },
    {
      id: 'track-3',
      name: 'Hi-Hat',
      type: 'drums',
      volume: 0.6,
      pan: 0,
      muted: false,
      solo: false,
      color: '#ec4899',
      pattern: [Array(16).fill(false)]
    },
    {
      id: 'track-4',
      name: 'Bass',
      type: 'bass',
      volume: 0.75,
      pan: 0,
      muted: false,
      solo: false,
      color: '#10b981',
      pattern: [Array(16).fill(false)]
    }
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const touch = (project: Project): Project => ({
  ...project,
  updatedAt: new Date().toISOString()
});

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set) => ({
      currentProject: createDefaultProject(),
      isPlaying: false,
      currentStep: 0,

      setProject: (project) => set({ currentProject: project }),

      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

      stop: () => set({ isPlaying: false, currentStep: 0 }),

      setCurrentStep: (step) => set({ currentStep: step }),

      updateTrack: (trackId, updates) => set((state) => ({
        currentProject: state.currentProject ? touch({
          ...state.currentProject,
          tracks: state.currentProject.tracks.map(track =>
            track.id === trackId ? { ...track, ...updates } : track
          )
        }) : null
      })),

      toggleStep: (trackId, rowIndex, stepIndex) => set((state) => ({
        currentProject: state.currentProject ? touch({
          ...state.currentProject,
          tracks: state.currentProject.tracks.map(track => {
            if (track.id === trackId) {
              const newPattern = [...track.pattern];
              newPattern[rowIndex] = [...newPattern[rowIndex]];
              newPattern[rowIndex][stepIndex] = !newPattern[rowIndex][stepIndex];
              return { ...track, pattern: newPattern };
            }
            return track;
          })
        }) : null
      })),

      addTrack: (track) => set((state) => ({
        currentProject: state.currentProject ? touch({
          ...state.currentProject,
          tracks: [...state.currentProject.tracks, track]
        }) : null
      })),

      deleteTrack: (trackId) => set((state) => ({
        currentProject: state.currentProject ? touch({
          ...state.currentProject,
          tracks: state.currentProject.tracks.filter(t => t.id !== trackId)
        }) : null
      })),

      setBPM: (bpm) => set((state) => {
        if (!state.currentProject || !Number.isFinite(bpm)) return {};
        const clamped = Math.min(200, Math.max(60, Math.round(bpm)));
        return { currentProject: touch({ ...state.currentProject, bpm: clamped }) };
      })
    }),
    {
      name: 'beataddicts.project',
      // Only persist the project itself — isPlaying/currentStep are
      // transient playback state that shouldn't resume on page load.
      partialize: (state) => ({ currentProject: state.currentProject })
    }
  )
);
