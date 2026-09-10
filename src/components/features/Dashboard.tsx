import { Award, Clock, Mic, Music, Play, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AIClient } from '../../ai/AIClient';
import { formatStudioTime, getStudioSeconds } from '../../lib/studioTime';
import { Button } from '../ui/button';
import type { SavedPatternEntry } from './Sequencer';

const PATTERN_LIBRARY_KEY = 'beataddicts_saved_patterns';

type DashboardProps = {
  onNavigate: (tab: 'dashboard' | 'sequencer' | 'ai' | 'mixer' | 'tutorials') => void;
};

const formatRelativeTime = (iso?: string): string => {
  if (!iso) return 'a while ago';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'a while ago';
  const diffMs = Date.now() - then;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const loadSavedPatterns = (): SavedPatternEntry[] => {
  try {
    const raw = localStorage.getItem(PATTERN_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const Dashboard = ({ onNavigate }: DashboardProps) => {
  const [savedPatterns, setSavedPatterns] = useState<SavedPatternEntry[]>([]);
  const [studioSeconds, setStudioSeconds] = useState(0);
  const [generationCount, setGenerationCount] = useState<number | null>(null);
  const [generationCountError, setGenerationCountError] = useState(false);

  useEffect(() => {
    setSavedPatterns(loadSavedPatterns());
    setStudioSeconds(getStudioSeconds());

    let cancelled = false;
    AIClient.getGenerationCount()
      .then((data) => {
        if (!cancelled) setGenerationCount(typeof data?.count === 'number' ? data.count : null);
      })
      .catch(() => {
        if (!cancelled) setGenerationCountError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recentPatterns = savedPatterns.slice(0, 4);

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-7xl mx-auto">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl mb-8 h-80">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url(https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1200&h=400&fit=crop&auto=format)',
              filter: 'brightness(0.4)'
            }}
          />
          <div className="relative h-full flex flex-col justify-center px-12">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center shadow-lg shadow-neon-purple/50">
                <Music className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-5xl font-bold neon-glow mb-2">Beat Addicts</h1>
                <p className="text-xl text-gray-300">Professional Web-Based Music Production</p>
              </div>
            </div>
            <p className="text-lg text-gray-300 max-w-2xl mb-6">
              Create studio-quality music with AI-powered beat generation, professional sequencer,
              and intelligent assistant. Your creative journey starts here.
            </p>
            <div className="flex gap-3">
              <Button
                size="lg"
                className="bg-gradient-to-r from-neon-purple to-neon-cyan hover:shadow-xl hover:shadow-neon-purple/50 text-lg h-12 px-8"
                onClick={() => onNavigate('ai')}
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Generate with AI
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 border-white/30 text-white hover:bg-white/10 text-lg h-12 px-8"
                onClick={() => onNavigate('sequencer')}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Creating
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Music className="w-6 h-6 text-neon-purple" />
            </div>
            <div className="text-3xl font-bold mb-1">{savedPatterns.length}</div>
            <div className="text-sm text-muted-foreground">Saved Patterns</div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Sparkles className="w-6 h-6 text-neon-cyan" />
            </div>
            <div className="text-3xl font-bold mb-1">
              {generationCount !== null ? generationCount : generationCountError ? '—' : '···'}
            </div>
            <div className="text-sm text-muted-foreground">AI Generations</div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-6 h-6 text-neon-pink" />
            </div>
            <div className="text-3xl font-bold mb-1">{formatStudioTime(studioSeconds)}</div>
            <div className="text-sm text-muted-foreground">Studio Time</div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="text-3xl font-bold mb-1">Free</div>
            <div className="text-sm text-muted-foreground">Membership</div>
          </div>
        </div>

        {/* Quick Start Cards */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="glass-panel rounded-xl p-6 hover:border-neon-purple transition-all cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neon-purple to-neon-purple/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI Generator</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Let AI create beats, melodies, and full tracks based on your preferences
            </p>
            <Button
              variant="outline"
              className="w-full border-studio-border hover:border-neon-purple hover:bg-neon-purple/10"
              onClick={() => onNavigate('ai')}
            >
              Start Generating
            </Button>
          </div>

          <div className="glass-panel rounded-xl p-6 hover:border-neon-cyan transition-all cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-cyan/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Music className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Step Sequencer</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create patterns with our professional step sequencer and sample library
            </p>
            <Button
              variant="outline"
              className="w-full border-studio-border hover:border-neon-cyan hover:bg-neon-cyan/10"
              onClick={() => onNavigate('sequencer')}
            >
              Open Sequencer
            </Button>
          </div>

          <div className="glass-panel rounded-xl p-6 hover:border-neon-pink transition-all cursor-pointer group">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-neon-pink to-neon-pink/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Voice Cloning</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add professional AI-generated vocals to your tracks (Premium)
            </p>
            <Button
              variant="outline"
              disabled
              title="Coming soon — billing isn't set up yet"
              className="w-full border-neon-pink/50 text-neon-pink hover:bg-neon-pink/10 disabled:opacity-50"
            >
              Upgrade to Pro
            </Button>
          </div>
        </div>

        {/* Recent Patterns */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Recent Patterns</h2>
            {savedPatterns.length > 0 && (
              <Button variant="ghost" className="text-neon-purple hover:bg-neon-purple/10" onClick={() => onNavigate('sequencer')}>
                Open Sequencer
              </Button>
            )}
          </div>
          {recentPatterns.length === 0 ? (
            <div className="glass-panel rounded-lg p-8 text-center text-muted-foreground">
              No patterns saved yet — head to the Sequencer and hit Save to build your library.
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {recentPatterns.map((entry) => (
                <div
                  key={entry.id}
                  className="glass-panel rounded-lg p-4 hover:border-neon-purple/50 transition-all cursor-pointer"
                  onClick={() => onNavigate('sequencer')}
                >
                  <div className="w-full h-24 bg-gradient-to-br from-neon-purple/20 to-neon-cyan/20 rounded-lg mb-3 flex items-center justify-center">
                    <Play className="w-8 h-8 text-neon-purple" />
                  </div>
                  <h4 className="font-semibold mb-1 truncate">{entry.name}</h4>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{entry.genre}</span>
                    <span>{formatRelativeTime(entry.savedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
