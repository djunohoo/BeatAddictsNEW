import { FlipVertical, Save, Shuffle, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { AIWorkflow } from '../../ai/AIWorkflow';
import { formatDuration, isSupportedAudioFile, loadAudioFile, type LoadedSample } from '../../audio/sampleManager';
import { useToast } from '../../hooks/use-toast';
import { useMixStore } from '../../stores/mixStore';
import { useProjectStore } from '../../stores/projectStore';
import { runSystemHealthCheck, type HealthCheckResult } from '../../system/healthCheck';
import { Button } from '../ui/button';

const INSTRUMENTS = [
  { id: 'kick', name: 'Kick', emoji: '😈', color: 'border-red-500', accentColor: 'bg-red-500' },
  { id: 'snare', name: 'Snare', emoji: '😈', color: 'border-cyan-400', accentColor: 'bg-cyan-400' },
  { id: 'hihat', name: 'Hi-Hat', emoji: '🎵', color: 'border-yellow-400', accentColor: 'bg-yellow-400' },
  { id: 'openhat', name: 'Open Hat', emoji: '🎵', color: 'border-purple-400', accentColor: 'bg-purple-400' },
  { id: 'clap', name: 'Clap', emoji: '👏', color: 'border-orange-400', accentColor: 'bg-orange-400' },
  { id: 'crash', name: 'Crash', emoji: '💥', color: 'border-red-400', accentColor: 'bg-red-400' },
  { id: 'perc1', name: 'Perc 1', emoji: '🎶', color: 'border-purple-500', accentColor: 'bg-purple-500' },
];

type Pattern = Record<string, boolean[]>;

type SequencerSession = {
  pattern: Pattern;
  currentPattern: number;
  selectedGenre: string;
  selectedMood: string;
  selectedStyle: string;
  complexity: number;
  density: number;
};

const SESSION_KEY = 'beataddicts_sequencer_session';

const buildDefaultPattern = (): Pattern => {
  const initialPattern: Pattern = {};
  INSTRUMENTS.forEach(inst => {
    initialPattern[inst.id] = Array(16).fill(false);
  });
  return initialPattern;
};

const isValidPattern = (value: unknown): value is Pattern =>
  !!value && typeof value === 'object' &&
  INSTRUMENTS.every((inst) => Array.isArray((value as Pattern)[inst.id]));

const loadSession = (): Partial<SequencerSession> => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return isValidPattern(parsed.pattern) ? parsed : { ...parsed, pattern: undefined };
  } catch {
    return {};
  }
};

export const Sequencer = () => {
  const { toast } = useToast();
  const [savedSession] = useState(loadSession);
  const [currentPattern, setCurrentPattern] = useState(savedSession.currentPattern ?? 1);
  const [patterns] = useState([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const [selectedGenre, setSelectedGenre] = useState(savedSession.selectedGenre ?? 'Tech House');
  const [selectedMood, setSelectedMood] = useState(savedSession.selectedMood ?? 'Energetic');
  const [selectedStyle, setSelectedStyle] = useState(savedSession.selectedStyle ?? 'Topline Tech House');
  const [complexity, setComplexity] = useState(savedSession.complexity ?? 60);
  const [density, setDensity] = useState(savedSession.density ?? 70);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  // isPlaying/bpm/currentStep live in projectStore, not local state, so
  // Header's transport controls and Sequencer's own Play/Stop button share
  // one real playback state instead of two disconnected ones.
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const togglePlay = useProjectStore((s) => s.togglePlay);
  const stopStore = useProjectStore((s) => s.stop);
  const bpm = useProjectStore((s) => s.currentProject?.bpm ?? 124);
  const setBpm = useProjectStore((s) => s.setBPM);
  const currentStep = useProjectStore((s) => s.currentStep);
  const setCurrentStep = useProjectStore((s) => s.setCurrentStep);
  const [savedPatterns, setSavedPatterns] = useState<Array<{ id: string; name: string; genre: string; mood: string; style: string; pattern: Pattern }>>([]);
  const [selectedSavedPatternId, setSelectedSavedPatternId] = useState('');
  const [loadedSamples, setLoadedSamples] = useState<LoadedSample[]>([]);
  const [sampleLoadError, setSampleLoadError] = useState('');
  const [healthResults, setHealthResults] = useState<HealthCheckResult[] | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<number | null>(null);
  const patternRef = useRef<Pattern>();

  const PATTERN_LIBRARY_KEY = 'beataddicts_saved_patterns';
  const genreOptions = ['Tech House', 'Deep House', 'Techno', 'Minimal', 'Progressive', 'Acid', 'Electro', 'House', 'Bass House / Hybrid Trap', 'Trap', 'Lo-Fi', 'Ambient'];
  const moodOptions = ['Energetic', 'Chill', 'Dark', 'Uplifting', 'Minimal', 'Epic'];
  const styleOptions = ['Topline Tech House', 'Progressive House', 'Melodic Electro', 'Bass House Groove', 'Trap Punch', 'Lo-Fi Pocket', 'Ambient Pulse'];

  const tracks = useMixStore(state => state.tracks);
  const updateTrack = useMixStore(state => state.updateTrack);

  // Initialize pattern with 16 steps for each instrument, restoring the
  // last session from localStorage if one was saved.
  const [pattern, setPattern] = useState<Pattern>(() => savedSession.pattern ?? buildDefaultPattern());
  patternRef.current = pattern;

  // Autosave the current session so a refresh doesn't lose in-progress work.
  useEffect(() => {
    try {
      const session: SequencerSession = {
        pattern,
        currentPattern,
        selectedGenre,
        selectedMood,
        selectedStyle,
        complexity,
        density
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.) —
      // autosave silently no-ops rather than breaking the editor.
    }
  }, [pattern, currentPattern, selectedGenre, selectedMood, selectedStyle, complexity, density]);

  const toggleStep = (instrumentId: string, stepIndex: number) => {
    setPattern((prev) => ({
      ...prev,
      [instrumentId]: prev[instrumentId].map((val, idx) =>
        idx === stepIndex ? !val : val
      )
    }));
  };

  const getActiveNotes = () => {
    let count = 0;
    Object.values(pattern).forEach(steps => {
      count += steps.filter(Boolean).length;
    });
    return count;
  };

  const randomizePattern = () => {
    const newPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      newPattern[inst.id] = Array(16).fill(false).map(() => Math.random() > 0.7);
    });
    setPattern(newPattern);
    toast({
      title: 'Pattern Randomized',
      description: 'New random beat pattern generated'
    });
  };

  const persistSavedPatterns = (nextPatterns: Array<{ id: string; name: string; genre: string; mood: string; style: string; pattern: Pattern }>) => {
    setSavedPatterns(nextPatterns);
    localStorage.setItem(PATTERN_LIBRARY_KEY, JSON.stringify(nextPatterns));
  };

  const loadSavedPatterns = () => {
    try {
      const raw = localStorage.getItem(PATTERN_LIBRARY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Drop any entry whose pattern doesn't have every instrument key —
        // loading a malformed one via loadSavedPattern() would crash the
        // grid render (pattern[instrument.id].map(...) with no guard).
        const valid = Array.isArray(parsed)
          ? parsed.filter((entry): entry is { id: string; name: string; genre: string; mood: string; style: string; pattern: Pattern } =>
              !!entry && typeof entry === 'object' && typeof entry.id === 'string' && isValidPattern(entry.pattern)
            )
          : [];
        setSavedPatterns(valid);
      }
    } catch {
      setSavedPatterns([]);
    }
  };

  const toggleTrackMute = (instrumentId: string) => {
    const track = tracks[instrumentId as keyof typeof tracks];
    if (!track) return;
    updateTrack(instrumentId as any, { mute: !track.mute });
    toast({
      title: track.mute ? 'Track Unmuted' : 'Track Muted',
      description: `${instrumentId} is now ${track.mute ? 'active' : 'muted'}`
    });
  };

  const ensureAudioContext = async (): Promise<AudioContext | null> => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch (error: any) {
      toast({
        title: 'Audio Context Error',
        description: error?.message || 'Unable to initialize audio playback.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const handleSampleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) {
      return;
    }

    const ctx = await ensureAudioContext();
    if (!ctx) return;

    const nextSamples: LoadedSample[] = [];
    const errorMessages: string[] = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!isSupportedAudioFile(file)) {
        errorMessages.push(`${file.name} is not a supported audio file.`);
        continue;
      }

      try {
        const loaded = await loadAudioFile(ctx, file);
        nextSamples.push(loaded);
      } catch (error: any) {
        errorMessages.push(`${file.name} could not be decoded: ${error?.message || 'invalid audio file'}`);
      }
    }

    if (nextSamples.length > 0) {
      setLoadedSamples((existing) => [...existing, ...nextSamples]);
      toast({
        title: 'Sample Loaded',
        description: `${nextSamples.length} audio sample${nextSamples.length > 1 ? 's' : ''} added to the library.`
      });
    }

    if (errorMessages.length > 0) {
      const combinedMessage = errorMessages.join(' ');
      setSampleLoadError(combinedMessage);
      toast({
        title: errorMessages.length > 1 ? `${errorMessages.length} Sample Load Warnings` : 'Sample Load Warning',
        description: combinedMessage,
        variant: 'destructive'
      });
    }
  };

  const playSample = (sampleId: string) => {
    const sample = loadedSamples.find((item) => item.id === sampleId);
    if (!sample || !audioCtxRef.current) {
      toast({
        title: 'Playback Error',
        description: 'Sample is not available or audio context is not ready.',
        variant: 'destructive'
      });
      return;
    }

    const source = audioCtxRef.current.createBufferSource();
    const gain = audioCtxRef.current.createGain();
    const panner = audioCtxRef.current.createStereoPanner();

    source.buffer = sample.buffer;
    gain.gain.setValueAtTime(0.9, audioCtxRef.current.currentTime);
    panner.pan.value = 0;

    source.connect(gain);
    gain.connect(panner);
    panner.connect(audioCtxRef.current.destination);
    source.start();
  };

  const removeSample = (sampleId: string) => {
    setLoadedSamples((existing) => existing.filter((item) => item.id !== sampleId));
  };

  const runHealthCheckAction = async () => {
    setIsHealthChecking(true);
    setHealthResults(null);
    try {
      const results = await runSystemHealthCheck(audioCtxRef.current);
      setHealthResults(results);
      const errors = results.filter((result) => result.status !== 'ok');
      toast({
        title: errors.length ? 'System health issues detected' : 'System health is good',
        description: errors.length
          ? errors.map((result) => `${result.name}: ${result.details}`).join(' | ')
          : 'All core systems are ready for playback and local AI generation.',
        variant: errors.length ? 'destructive' : 'default'
      });
    } finally {
      setIsHealthChecking(false);
    }
  };

  const savePattern = () => {
    const id = `${selectedGenre}-${selectedMood}-${Date.now()}`;
    const entry = {
      id,
      name: `${selectedStyle} (${selectedGenre} / ${selectedMood})`,
      genre: selectedGenre,
      mood: selectedMood,
      style: selectedStyle,
      pattern
    };
    const next = [entry, ...savedPatterns].slice(0, 12);
    persistSavedPatterns(next);
    setSelectedSavedPatternId(id);
    toast({
      title: 'Pattern Saved',
      description: `Saved ${entry.name} to your library.`
    });
  };

  const saveToLibrary = () => {
    savePattern();
  };

  const loadSavedPattern = (patternId: string) => {
    const entry = savedPatterns.find(item => item.id === patternId);
    if (!entry) return;
    setPattern(entry.pattern);
    setSelectedGenre(entry.genre);
    setSelectedMood(entry.mood);
    setSelectedStyle(entry.style);
    setSelectedSavedPatternId(entry.id);
    toast({
      title: 'Pattern Loaded',
      description: `Loaded ${entry.name}.`
    });
  };

  const clearAll = () => {
    clearPattern();
    setSelectedGenre('Tech House');
    setSelectedMood('Energetic');
    setSelectedStyle('Topline Tech House');
  };

  const stopPlayback = () => {
    stopStore();
  };

  const playHit = (instrumentId: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;

    const mixState = useMixStore.getState();
    const track = mixState.tracks[instrumentId as keyof typeof mixState.tracks];
    if (!track) return;
    const soloActive = mixState.anySolo();
    if (track.mute || (soloActive && !track.solo)) return;

    const masterGain = (mixState.masterVolume ?? 100) / 100;
    const trackGain = (track.volume ?? 100) / 100;
    const volume = masterGain * trackGain;

    const widthFactor = mixState.stereoWidth / 100;
    const pan = (track.pan / 50) * widthFactor;

    switch (instrumentId) {
      case 'kick':
        playKickDrum(ctx, now, volume, pan);
        break;
      case 'snare':
        playSnareDrum(ctx, now, volume, pan);
        break;
      case 'hihat':
        playHiHat(ctx, now, volume * 0.6, pan);
        break;
      case 'openhat':
        playOpenHat(ctx, now, volume * 0.8, pan);
        break;
      case 'clap':
        playClap(ctx, now, volume, pan);
        break;
      case 'crash':
        playCrash(ctx, now, volume * 0.7, pan);
        break;
      default:
        playPercussion(ctx, now, volume, pan);
        break;
    }
  };

  // Professional kick drum synthesis
  const playKickDrum = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    // Main oscillator for body
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(150, time);
    osc1.frequency.exponentialRampToValueAtTime(45, time + 0.15);

    gain1.gain.setValueAtTime(volume * 0.8, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    // Sub oscillator for low end
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(60, time);
    osc2.frequency.exponentialRampToValueAtTime(30, time + 0.2);

    gain2.gain.setValueAtTime(volume * 0.6, time);
    gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

    // Click transient
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'square';
    osc3.frequency.setValueAtTime(800, time);
    osc3.frequency.exponentialRampToValueAtTime(200, time + 0.05);

    gain3.gain.setValueAtTime(volume * 0.3, time);
    gain3.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);
    gain1.connect(panner);
    gain2.connect(panner);
    gain3.connect(panner);
    panner.connect(ctx.destination);

    osc1.start(time);
    osc2.start(time);
    osc3.start(time);
    osc1.stop(time + 0.5);
    osc2.stop(time + 0.5);
    osc3.stop(time + 0.5);
  };

  // Professional snare drum synthesis
  const playSnareDrum = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    // Tone oscillators
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(200, time);
    osc1.frequency.exponentialRampToValueAtTime(150, time + 0.1);

    gain1.gain.setValueAtTime(volume * 0.4, time);
    gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    // Noise for snap
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 2000;
    noiseGain.gain.setValueAtTime(volume * 0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc1.connect(gain1);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    gain1.connect(panner);
    noiseGain.connect(panner);
    panner.connect(ctx.destination);

    osc1.start(time);
    noiseSource.start(time);
    osc1.stop(time + 0.3);
    noiseSource.stop(time + 0.3);
  };

  // Hi-hat synthesis
  const playHiHat = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
    }

    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 7000;
    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(panner);
    panner.connect(ctx.destination);

    noiseSource.start(time);
    noiseSource.stop(time + 0.1);
  };

  // Open hi-hat synthesis
  const playOpenHat = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * (1 - i / noiseData.length);
    }

    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 6000;
    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(panner);
    panner.connect(ctx.destination);

    noiseSource.start(time);
    noiseSource.stop(time + 0.25);
  };

  // Clap synthesis
  const playClap = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.1);
    }

    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1500;
    noiseFilter.Q.value = 2;
    noiseGain.gain.setValueAtTime(volume * 0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(panner);
    panner.connect(ctx.destination);

    noiseSource.start(time);
    noiseSource.stop(time + 0.15);
  };

  // Crash cymbal synthesis
  const playCrash = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.8, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseData.length * 0.3));
    }

    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 3000;
    noiseGain.gain.setValueAtTime(volume, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(panner);
    panner.connect(ctx.destination);

    noiseSource.start(time);
    noiseSource.stop(time + 0.8);
  };

  // Percussion synthesis
  const playPercussion = (ctx: AudioContext, time: number, volume: number, pan: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(320, time);
    osc.frequency.exponentialRampToValueAtTime(160, time + 0.1);

    gain.gain.setValueAtTime(volume * 0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.2);
  };

  // Pure step advance only -- setState updaters can be invoked more than
  // once (React 18 StrictMode does this deliberately to catch impure
  // updaters), which would double-fire drum hits if the audio side effect
  // lived inside this updater. Reads live step from the store via
  // getState() rather than closing over `currentStep`, since this callback
  // is captured once per scheduleTicks() call and would otherwise go stale
  // exactly like the old pattern-closure bug this file already fixed once.
  const scheduleTicks = (tickBpm: number) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    const stepMs = (60_000 / tickBpm) / 4;
    intervalRef.current = window.setInterval(() => {
      const next = (useProjectStore.getState().currentStep + 1) % 16;
      setCurrentStep(next);
    }, stepMs);
  };

  // Play the active hits for the current step as a real side effect,
  // separate from the pure step-advance above.
  useEffect(() => {
    if (!isPlaying) return;
    const livePattern = patternRef.current;
    INSTRUMENTS.forEach((inst) => {
      if (livePattern?.[inst.id]?.[currentStep]) {
        playHit(inst.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const startPlayback = () => {
    if (isPlaying) return;
    const hasNotes = Object.values(pattern).some((row) => row.some(Boolean));
    if (!hasNotes) {
      toast({
        title: 'No notes to play',
        description: 'Add at least one step before starting playback.',
        variant: 'destructive'
      });
      return;
    }
    togglePlay();
  };

  // The actual playback engine, driven by isPlaying from the shared store
  // rather than a local flag -- this is what makes Header's transport
  // controls (which only flip the store's isPlaying) actually start/stop
  // real audio, instead of toggling a boolean nobody reads.
  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const hasNotes = Object.values(patternRef.current ?? {}).some((row) => row.some(Boolean));
    if (!hasNotes) {
      toast({
        title: 'No notes to play',
        description: 'Add at least one step before starting playback.',
        variant: 'destructive'
      });
      stopStore();
      return;
    }

    let cancelled = false;
    ensureAudioContext().then((ctx) => {
      if (cancelled || !ctx) return;
      scheduleTicks(bpm);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Restart the tick interval at the new tempo when BPM changes mid-playback,
  // instead of leaving a stale-closure interval running at the old rate.
  // Guarded on intervalRef so this doesn't race the async start-up above.
  useEffect(() => {
    if (isPlaying && intervalRef.current) {
      scheduleTicks(bpm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  useEffect(() => {
    return () => {
      stopPlayback();
      audioCtxRef.current?.close();
    };
  }, []);

  useEffect(() => {
    loadSavedPatterns();
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.pattern) {
        setPattern(detail.pattern);
      }
      if (detail?.bpm) {
        setBpm(detail.bpm);
      }
    };

    window.addEventListener('ai:pattern', handler);
    return () => window.removeEventListener('ai:pattern', handler);
  }, []);

  const clearPattern = () => {
    const newPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      newPattern[inst.id] = Array(16).fill(false);
    });
    setPattern(newPattern);
    toast({
      title: 'Pattern Cleared',
      description: 'All steps have been cleared'
    });
  };

  const invertAll = () => {
    const newPattern: Pattern = {};
    INSTRUMENTS.forEach(inst => {
      newPattern[inst.id] = pattern[inst.id].map(val => !val);
    });
    setPattern(newPattern);
    toast({
      title: 'Pattern Inverted',
      description: 'All steps have been toggled'
    });
  };

  const randomizePreset = () => {
    const randomGenre = genreOptions[Math.floor(Math.random() * genreOptions.length)];
    const randomComplexity = Math.floor(Math.random() * 100);
    const randomDensity = Math.floor(Math.random() * 100);

    setSelectedGenre(randomGenre);
    setComplexity(randomComplexity);
    setDensity(randomDensity);

    toast({
      title: 'Preset Randomized',
      description: `${randomGenre} - Complexity: ${randomComplexity}% - Density: ${randomDensity}%`
    });
  };

  const generateAIBeat = async () => {
    setIsGenerating(true);

    try {
      const result = await AIWorkflow.generateDrums({
        genre: selectedGenre,
        mood: selectedMood,
        style: selectedStyle,
        complexity,
        density
      });

      setPattern(result.pattern);
      if (result.bpm) {
        setBpm(result.bpm);
      }

      if (result.isFallback) {
        toast({
          title: 'Beat generated offline',
          description: 'The AI backend was unreachable, so this is a local placeholder pattern, not real AI output.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'AI Beat Generated!',
          description: `${selectedGenre} pattern created with ${complexity}% complexity`
        });
      }
    } catch (error: any) {
      console.error('AI beat generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 bg-[#0f0f1e]">
      <div className="max-w-[1600px] mx-auto">
        {/* Top Controls */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            {/* Pattern Selector */}
            <div className="flex items-center gap-4">
              <div className="bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 min-w-[260px]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-cyan-400 rounded"></div>
                  <div>
                    <div className="font-semibold text-white">Pattern {currentPattern}</div>
                    <div className="text-xs text-gray-400">{getActiveNotes()} notes - {INSTRUMENTS.length} tracks</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Transport */}
            <div className="flex items-center gap-3 bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 flex-1 min-w-[320px]">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">BPM</span>
                <input
                  type="range"
                  min="90"
                  max="140"
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-36 h-2 bg-[#16162a] rounded-lg appearance-none cursor-pointer slider-purple"
                />
                <span className="w-12 text-right text-sm font-semibold text-purple-400">{bpm}</span>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <Button
                  onClick={isPlaying ? stopPlayback : startPlayback}
                  className="bg-gradient-to-r from-neon-purple to-neon-cyan hover:shadow-neon-purple/40 min-w-[96px]"
                >
                  {isPlaying ? 'Stop' : 'Play'}
                </Button>
                <div className="text-xs text-gray-400">
                  Step <span className="font-semibold text-white">{currentStep + 1}</span> / 16
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={randomizePattern}
                variant="outline"
                className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface"
              >
                <Shuffle className="w-4 h-4 mr-2" />
                Random
              </Button>
              <Button
                onClick={clearPattern}
                variant="outline"
                className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
              <Button
                onClick={savePattern}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Sample Loader and System Health */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="glass-panel rounded-lg p-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">Sample Library</div>
                <div className="text-xs text-muted-foreground">Load audio samples locally for playback and testing.</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="sample-upload"
                  type="file"
                  accept="audio/*"
                  multiple
                  onChange={handleSampleFiles}
                  className="hidden"
                />
                <label htmlFor="sample-upload" className="inline-flex items-center justify-center rounded-lg border border-studio-border bg-[#1a1a2e] px-4 py-3 text-sm text-white hover:bg-studio-surface cursor-pointer">
                  Load Samples
                </label>
                <Button onClick={runHealthCheckAction} variant="outline" className="h-12 px-4">
                  {isHealthChecking ? 'Checking...' : 'Run System Health'}
                </Button>
              </div>
            </div>

            {loadedSamples.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {loadedSamples.map((sample) => (
                  <div key={sample.id} className="rounded-lg border border-[#22263b] bg-[#0f111f] p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="font-semibold text-white">{sample.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDuration(sample.duration)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => playSample(sample.id)} variant="outline" size="sm">
                          Play
                        </Button>
                        <Button onClick={() => removeSample(sample.id)} variant="ghost" size="sm">
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {healthResults?.length ? (
              <div className="rounded-lg border border-studio-border bg-[#11141f] p-4">
                <div className="text-sm font-semibold text-white mb-3">Health Check Results</div>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {healthResults.map((result) => (
                    <div key={result.name} className={`rounded-md p-3 ${result.status === 'ok' ? 'bg-emerald-950/40' : result.status === 'warn' ? 'bg-yellow-950/40' : 'bg-rose-950/40'}`}>
                      <div className="font-medium text-white">{result.name}</div>
                      <div>{result.details}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : sampleLoadError ? (
              <div className="rounded-lg border border-rose-500 bg-rose-950/10 p-4 text-sm text-rose-200">
                {sampleLoadError}
              </div>
            ) : null}
          </div>
        </div>

        {/* Pattern Tabs */}
        <div className="flex gap-2 mb-6">
          {patterns.map(num => (
            <button
              key={num}
              onClick={() => setCurrentPattern(num)}
              className={`
                w-12 h-12 rounded-lg border font-semibold transition-all
                ${currentPattern === num
                  ? 'bg-cyan-400 border-cyan-400 text-black'
                  : 'bg-[#1a1a2e] border-studio-border text-white hover:border-cyan-400/50'
                }
              `}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Step Sequencer Grid */}
        <div className="glass-panel rounded-lg p-6 mb-6">
          {/* Header */}
          <div className="grid grid-cols-[180px_repeat(16,1fr)] gap-2 mb-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Track</div>
            {Array.from({ length: 16 }, (_, i) => (
              <div key={i} className="text-center text-xs font-semibold text-gray-400">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Instrument Rows */}
          <div className="space-y-3">
            {INSTRUMENTS.map(instrument => (
              <div key={instrument.id} className="flex items-center gap-2">
                {/* Accent Bar */}
                <div className={`w-1 h-12 rounded-full ${instrument.accentColor}`} />

                {/* Instrument Label */}
                <div className="grid grid-cols-[180px_repeat(16,1fr)] gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleTrackMute(instrument.id)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${tracks[instrument.id]?.mute ? 'bg-red-500 border-red-400 text-black' : 'bg-[#1a1a2e] border border-studio-border hover:bg-studio-surface text-white'}`}
                      title={tracks[instrument.id]?.mute ? 'Unmute track' : 'Mute track'}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{instrument.emoji}</span>
                      <span className="font-semibold text-white">{instrument.name}</span>
                    </div>
                  </div>

                  {/* Step Buttons */}
                  {pattern[instrument.id].map((active, stepIndex) => (
                    <button
                      key={stepIndex}
                      onClick={() => toggleStep(instrument.id, stepIndex)}
                      className={`
                        h-12 rounded-lg border-2 transition-all
                        ${active
                          ? `${instrument.color} bg-opacity-20`
                          : 'border-[#1a1a2e] bg-[#16162a] hover:border-studio-border'
                        }
                        ${stepIndex % 4 === 0 ? 'border-l-4' : ''}
                        ${isPlaying && currentStep === stepIndex ? 'ring-2 ring-neon-cyan ring-offset-1 ring-offset-[#0f0f1e]' : ''}
                      `}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Beat Generator Section */}
        <div className="grid grid-cols-[1fr_auto] gap-4">
          {/* Generator Controls */}
          <div className="glass-panel rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🤖</span>
              <h3 className="text-lg font-bold text-purple-400 uppercase tracking-wider">AI Beat Generator</h3>
            </div>

            <div className="grid grid-cols-[180px_1fr_1fr_1fr_auto] gap-4 items-center">
              {/* Genre Selector */}
              <div>
                <select
                  aria-label="Select genre"
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                >
                  {genreOptions.map(genre => (
                    <option key={genre} value={genre}>{genre}</option>
                  ))}
                </select>
              </div>

              {/* Mood Selector */}
              <div>
                <select
                  aria-label="Select mood"
                  value={selectedMood}
                  onChange={(e) => setSelectedMood(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
                >
                  {moodOptions.map(mood => (
                    <option key={mood} value={mood}>{mood}</option>
                  ))}
                </select>
              </div>

              {/* Style Selector */}
              <div>
                <select
                  aria-label="Select style"
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan"
                >
                  {styleOptions.map(style => (
                    <option key={style} value={style}>{style}</option>
                  ))}
                </select>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateAIBeat}
                disabled={isGenerating}
                className="bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 h-12 px-6"
              >
                {isGenerating ? (
                  <>
                    <div className="flex gap-1 mr-2">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1 h-4 bg-white rounded-full animate-waveform"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate AI Beat
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="glass-panel rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-2">Saved Patterns</div>
            <div className="flex items-center gap-3">
              <select
                aria-label="Select saved pattern"
                value={selectedSavedPatternId}
                onChange={(e) => loadSavedPattern(e.target.value)}
                className="flex-1 bg-[#1a1a2e] border border-studio-border rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Choose saved pattern</option>
                {savedPatterns.map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              <Button
                onClick={() => {
                  if (selectedSavedPatternId) loadSavedPattern(selectedSavedPatternId);
                }}
                variant="outline"
                className="h-12 px-4"
              >
                Load
              </Button>
            </div>
          </div>

          {/* Action Buttons Grid */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={saveToLibrary}
              className="bg-purple-600 hover:bg-purple-700 h-[calc(50%-6px)]"
            >
              <Save className="w-4 h-4 mr-2" />
              Save to Library
            </Button>
            <Button
              onClick={randomizePreset}
              variant="outline"
              className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface h-[calc(50%-6px)]"
            >
              <Shuffle className="w-4 h-4 mr-2" />
              Randomize (Preset)
            </Button>
            <Button
              onClick={clearAll}
              variant="outline"
              className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface h-[calc(50%-6px)]"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
            <Button
              onClick={invertAll}
              variant="outline"
              className="bg-[#1a1a2e] border-studio-border hover:bg-studio-surface h-[calc(50%-6px)]"
            >
              <FlipVertical className="w-4 h-4 mr-2" />
              Invert All
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        input[type="range"].slider-purple::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #9333ea;
          cursor: pointer;
        }

        input[type="range"].slider-cyan::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #06b6d4;
          cursor: pointer;
        }

        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #9333ea;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};
