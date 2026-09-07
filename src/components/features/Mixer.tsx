import { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  Headphones,
  RefreshCw,
  Shuffle,
  Save,
  FolderOpen,
  Waves,
  SlidersHorizontal,
  ShieldCheck,
  Disc3
} from 'lucide-react';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';
import { useMixStore } from '../../stores/mixStore';

type TrackId =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'openhat'
  | 'clap'
  | 'perc1'
  | 'bass'
  | 'lead';

const TRACKS: { id: TrackId; label: string; accent: string; emoji: string }[] = [
  { id: 'kick', label: 'Kick', accent: 'from-red-500 to-orange-500', emoji: '🥁' },
  { id: 'snare', label: 'Snare', accent: 'from-cyan-400 to-blue-500', emoji: '🎯' },
  { id: 'hihat', label: 'Hi-Hat', accent: 'from-yellow-400 to-amber-500', emoji: '✨' },
  { id: 'openhat', label: 'Open Hat', accent: 'from-purple-400 to-fuchsia-500', emoji: '🔊' },
  { id: 'clap', label: 'Clap', accent: 'from-orange-400 to-pink-500', emoji: '👏' },
  { id: 'perc1', label: 'Perc', accent: 'from-emerald-400 to-teal-500', emoji: '🪘' },
  { id: 'bass', label: 'Bass', accent: 'from-indigo-400 to-blue-500', emoji: '🎸' },
  { id: 'lead', label: 'Lead', accent: 'from-pink-500 to-purple-500', emoji: '🎹' }
];

export const Mixer = () => {
  const { toast } = useToast();
  const {
    tracks,
    masterVolume,
    stereoWidth,
    limiter,
    headphones,
    setHeadphones,
    setMasterVolume,
    setStereoWidth,
    setLimiter,
    updateTrack,
    randomize,
    reset,
    anySolo,
    saveSnapshot: saveSnapshotToStore,
    loadSnapshot,
    hasSnapshot
  } = useMixStore();
  const [meters, setMeters] = useState<Record<TrackId, number>>(() => {
    const m: Record<TrackId, number> = {} as Record<TrackId, number>;
    TRACKS.forEach((t) => (m[t.id] = 0));
    return m;
  });

  // Animate level meters to give visual feedback while tweaking
  useEffect(() => {
    const timer = setInterval(() => {
      setMeters((prev) => {
        const next: Record<TrackId, number> = { ...prev };
        TRACKS.forEach((t) => {
          const strip = tracks[t.id];
          const active = !strip.mute && (!anySolo() || strip.solo);
          const dynamic = active ? strip.volume * (0.4 + Math.random() * 0.6) : 0;
          next[t.id] = Math.min(100, Math.round(dynamic));
        });
        return next;
      });
    }, 600);
    return () => clearInterval(timer);
  }, [anySolo, tracks]);

  const handleSaveSnapshot = () => {
    saveSnapshotToStore();
    if (hasSnapshot()) {
      toast({
        title: 'Snapshot saved',
        description: 'Mix settings saved to this browser — use Load Snapshot to recall them.'
      });
    } else {
      toast({
        title: 'Snapshot not saved',
        description: "Couldn't write to local storage (private browsing or storage full?).",
        variant: 'destructive'
      });
    }
  };

  const handleLoadSnapshot = () => {
    if (loadSnapshot()) {
      toast({ title: 'Snapshot loaded', description: 'Restored your last saved mix settings.' });
    } else {
      toast({
        title: 'No snapshot found',
        description: 'Save a snapshot first before trying to load one.',
        variant: 'destructive'
      });
    }
  };

  const renderMeter = (value: number, accent: string) => (
    <div className="h-2 w-full bg-studio-surface rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full bg-gradient-to-r', accent)}
        style={{ width: `${value}%`, transition: 'width 200ms ease' }}
      />
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="w-4 h-4" />
              Studio Mixer
            </div>
            <h1 className="text-3xl font-bold">Balance, glue, and polish your beat</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { reset(); toast({ title: 'Mixer reset', description: 'All channels returned to defaults.' }); }}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button variant="outline" onClick={() => { randomize(); toast({ title: 'Random mix applied', description: 'Great for inspiration - tweak as needed.' }); }}>
              <Shuffle className="w-4 h-4 mr-2" />
              Randomize
            </Button>
            <Button variant="outline" onClick={handleLoadSnapshot}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Load Snapshot
            </Button>
            <Button className="bg-gradient-to-r from-neon-purple to-neon-cyan" onClick={handleSaveSnapshot}>
              <Save className="w-4 h-4 mr-2" />
              Save Snapshot
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center">
              <Volume2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Master Level</p>
              <p className="text-xl font-semibold">{masterVolume}%</p>
            </div>
          </div>
          <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
              <Waves className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Stereo Width</p>
              <p className="text-xl font-semibold">{stereoWidth}%</p>
            </div>
          </div>
          <div className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Limiter</p>
              <p className="text-xl font-semibold">{limiter ? 'On' : 'Off'}</p>
            </div>
          </div>
        </div>

        {/* Master controls */}
        <div className="glass-panel rounded-xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-studio-panel flex items-center justify-center">
                <SlidersHorizontal className="w-5 h-5 text-neon-cyan" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Master Bus</p>
                <p className="text-lg font-semibold">Glue & Safety</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Limiter</span>
                <Switch checked={limiter} onCheckedChange={setLimiter} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Headphones</span>
                <Switch checked={headphones} onCheckedChange={setHeadphones} />
                <Headphones className={cn('w-4 h-4', headphones ? 'text-neon-cyan' : 'text-muted-foreground')} />
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Master Volume</span>
                <span className="text-sm font-semibold">{masterVolume}%</span>
              </div>
              <Slider
                value={[masterVolume]}
                max={100}
                step={1}
                onValueChange={([v]) => setMasterVolume(v)}
                className="w-full"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Stereo Width</span>
                <span className="text-sm font-semibold">{stereoWidth}%</span>
              </div>
              <Slider
                value={[stereoWidth]}
                max={150}
                step={1}
                onValueChange={([v]) => setStereoWidth(v)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <Separator className="bg-studio-border" />

        {/* Channel strips */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TRACKS.map((track) => {
            const strip = tracks[track.id];
            const inactive = anySolo() && !strip.solo;
            return (
              <div
                key={track.id}
                className={cn(
                  'glass-panel rounded-xl p-4 flex flex-col gap-4 border border-transparent transition-colors',
                  strip.solo ? 'border-neon-cyan/50' : strip.mute ? 'border-red-500/50' : 'hover:border-neon-purple/30',
                  inactive ? 'opacity-50' : ''
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center text-xl',
                        track.accent
                      )}
                    >
                      {track.emoji}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Channel</p>
                      <p className="text-lg font-semibold">{track.label}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={strip.solo ? 'default' : 'outline'}
                      onClick={() => updateTrack(track.id, { solo: !strip.solo, mute: strip.solo ? strip.mute : false })}
                    >
                      <Headphones className="w-4 h-4 mr-1" />
                      Solo
                    </Button>
                    <Button
                      size="sm"
                      variant={strip.mute ? 'destructive' : 'outline'}
                      onClick={() => updateTrack(track.id, { mute: !strip.mute, solo: false })}
                    >
                      {strip.mute ? <VolumeX className="w-4 h-4 mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
                      Mute
                    </Button>
                  </div>
                </div>

                {renderMeter(meters[track.id] ?? 0, track.accent)}

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-muted-foreground">Volume</span>
                      <span className="font-semibold">{strip.volume}%</span>
                    </div>
                    <Slider
                      value={[strip.volume]}
                      max={100}
                      step={1}
                      onValueChange={([v]) => updateTrack(track.id, { volume: v })}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-muted-foreground">Pan</span>
                      <span className="font-semibold">
                        {strip.pan > 0 ? `R${strip.pan}` : strip.pan < 0 ? `L${Math.abs(strip.pan)}` : 'Center'}
                      </span>
                    </div>
                    <Slider
                      value={[strip.pan]}
                      min={-50}
                      max={50}
                      step={1}
                      onValueChange={([v]) => updateTrack(track.id, { pan: v })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>Reverb</span>
                        <span className="font-semibold text-foreground">{strip.reverb}%</span>
                      </div>
                      <Slider
                        value={[strip.reverb]}
                        max={60}
                        step={1}
                        onValueChange={([v]) => updateTrack(track.id, { reverb: v })}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>Delay</span>
                        <span className="font-semibold text-foreground">{strip.delay}%</span>
                      </div>
                      <Slider
                        value={[strip.delay]}
                        max={60}
                        step={1}
                        onValueChange={([v]) => updateTrack(track.id, { delay: v })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>High-Pass</span>
                        <span className="font-semibold text-foreground">{strip.highpass}%</span>
                      </div>
                      <Slider
                        value={[strip.highpass]}
                        max={80}
                        step={1}
                        onValueChange={([v]) => updateTrack(track.id, { highpass: v })}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                        <span>Low-Pass</span>
                        <span className="font-semibold text-foreground">{strip.lowpass}%</span>
                      </div>
                      <Slider
                        value={[strip.lowpass]}
                        min={40}
                        max={100}
                        step={1}
                        onValueChange={([v]) => updateTrack(track.id, { lowpass: v })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-studio-border">
                  <div className="flex items-center gap-1">
                    <Disc3 className="w-4 h-4 text-neon-cyan" />
                    <span>{strip.solo ? 'Soloing' : strip.mute ? 'Muted' : 'Active'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Waves className="w-4 h-4 text-neon-purple" />
                    <span>{meters[track.id] ?? 0}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
