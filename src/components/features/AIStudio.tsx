import { CheckCircle2, ChevronRight, Mic, Music2, Sparkles, Waves, Zap } from 'lucide-react';
import { useState } from 'react';
import { AIWorkflow } from '../../ai/AIWorkflow';
import { useToast } from '../../hooks/use-toast';
import { PluginManager } from '../../plugins/pluginManager';
import { AIGenerationStage, PluginChainItem, PluginHostSupport } from '../../types';
import { Button } from '../ui/button';

const stages: AIGenerationStage[] = [
  { id: '1', name: 'Beat Pattern', description: 'Generate rhythm foundation', icon: 'drum', completed: false },
  { id: '2', name: 'Bassline', description: 'Add low-end groove', icon: 'waves', completed: false },
  { id: '3', name: 'Melody', description: 'Create melodic hooks', icon: 'music', completed: false },
  { id: '4', name: 'Chords', description: 'Build harmonic support', icon: 'music', completed: false },
  { id: '5', name: 'Arrangement', description: 'Lay out the track timeline', icon: 'zap', completed: false }
];

export const AIStudio = () => {
  const { toast } = useToast();
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedMood, setSelectedMood] = useState('');
  const [selectedHost, setSelectedHost] = useState<PluginHostSupport>('Ableton');
  const [pluginChain, setPluginChain] = useState<PluginChainItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [generatedContent, setGeneratedContent] = useState<Record<string, string>>({});
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set());
  const [fallbackStages, setFallbackStages] = useState<Set<number>>(new Set());

  const genres = ['Electronic', 'Hip Hop', 'House', 'Trap', 'Lo-Fi', 'Ambient'];
  const moods = ['Energetic', 'Chill', 'Dark', 'Uplifting', 'Minimal', 'Epic'];
  const hostOptions: PluginHostSupport[] = ['Ableton', 'FL Studio', 'LocalHost'];

  const generateStage = async (stageIndex: number) => {
    const stage = stages[stageIndex];

    try {
      const data = await AIWorkflow.generateStage(stage.name, {
        genre: selectedGenre,
        mood: selectedMood,
        host: selectedHost
      });

      const chain = PluginManager.buildPluginChain(stage.name, {
        genre: selectedGenre,
        mood: selectedMood,
        host: selectedHost
      }, selectedHost);
      setPluginChain(chain);

      if (stage.name === 'Beat Pattern' && data?.pattern) {
        window.dispatchEvent(new CustomEvent('ai:pattern', { detail: data }));
      }

      setGeneratedContent(prev => ({
        ...prev,
        [stage.name]: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }));

      setCompletedStages(prev => new Set([...prev, stageIndex]));

      if (data?.isFallback) {
        setFallbackStages(prev => new Set([...prev, stageIndex]));
        toast({
          title: `${stage.name} generated offline`,
          description: 'The AI backend was unreachable, so this is a local placeholder sketch, not real AI output.',
          variant: 'destructive'
        });
      }

      return true;
    } catch (error: any) {
      console.error(`Stage ${stage.name} generation error:`, error);
      toast({
        title: `Failed to generate ${stage.name}`,
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
      return false;
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setCurrentStage(0);
    setCompletedStages(new Set());
    setFallbackStages(new Set());
    setGeneratedContent({});

    // Generate each stage sequentially
    for (let i = 0; i < stages.length; i++) {
      setCurrentStage(i);
      const success = await generateStage(i);

      if (!success) {
        setIsGenerating(false);
        return;
      }

      // Wait a bit between stages for better UX
      if (i < stages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    setIsGenerating(false);
    toast({
      title: 'Track Generated!',
      description: 'Your AI-powered music is ready. Check the stages below for details.'
    });
  };

  return (
    <div className="glass-panel rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">AI Music Generator</h2>
          <p className="text-sm text-muted-foreground">Collaborate with AI to create your track</p>
        </div>
      </div>

      {/* Genre Selection */}
      <div className="mb-6">
        <label className="text-sm font-semibold mb-2 block">Select Genre</label>
        <div className="grid grid-cols-3 gap-2">
          {genres.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`
                px-4 py-3 rounded-lg border transition-all
                ${selectedGenre === genre
                  ? 'bg-neon-purple border-neon-purple text-white'
                  : 'bg-studio-panel border-studio-border hover:border-neon-purple/50'
                }
              `}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Mood Selection */}
      <div className="mb-6">
        <label className="text-sm font-semibold mb-2 block">Select Mood</label>
        <div className="grid grid-cols-3 gap-2">
          {moods.map(mood => (
            <button
              key={mood}
              onClick={() => setSelectedMood(mood)}
              className={`
                px-4 py-3 rounded-lg border transition-all
                ${selectedMood === mood
                  ? 'bg-neon-cyan border-neon-cyan text-white'
                  : 'bg-studio-panel border-studio-border hover:border-neon-cyan/50'
                }
              `}
            >
              {mood}
            </button>
          ))}
        </div>
      </div>

      {/* Target DAW/Host -- shapes the plugin-chain suggestion text below,
          not a live connection to any actual DAW or plugin. */}
      <div className="mb-6">
        <label className="text-sm font-semibold mb-2 block">Target DAW / Host</label>
        <div className="grid grid-cols-3 gap-2">
          {hostOptions.map((host) => (
            <button
              key={host}
              onClick={() => setSelectedHost(host)}
              className={`
                px-4 py-3 rounded-lg border transition-all
                ${selectedHost === host
                  ? 'bg-neon-purple border-neon-purple text-white'
                  : 'bg-studio-panel border-studio-border hover:border-neon-purple/50'
                }
              `}
            >
              {host}
            </button>
          ))}
        </div>
      </div>

      {/* Generation Stages */}
      <div className="mb-6">
        <label className="text-sm font-semibold mb-3 block">Generation Stages</label>
        <div className="space-y-3">
          {stages.map((stage, index) => {
            const isActive = index === currentStage && isGenerating;
            const isCompleted = completedStages.has(index);
            const isFallback = fallbackStages.has(index);
            const hasContent = generatedContent[stage.name];

            return (
              <div key={stage.id}>
                <div
                  className={`
                    flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer
                    ${isActive ? 'bg-neon-purple/10 border-neon-purple animate-pulse-glow' : ''}
                    ${isCompleted ? 'bg-studio-surface border-neon-cyan' : ''}
                    ${!isActive && !isCompleted ? 'bg-studio-panel border-studio-border' : ''}
                  `}
                  onClick={() => hasContent && setGeneratedContent(prev => ({ ...prev, [`${stage.name}_expanded`]: !prev[`${stage.name}_expanded`] }))}
                >
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${isCompleted ? 'bg-neon-cyan' : isActive ? 'bg-neon-purple' : 'bg-studio-surface'}
                  `}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <>
                        {stage.icon === 'drum' && <Music2 className="w-5 h-5" />}
                        {stage.icon === 'music' && <Music2 className="w-5 h-5" />}
                        {stage.icon === 'waves' && <Waves className="w-5 h-5" />}
                        {stage.icon === 'zap' && <Zap className="w-5 h-5" />}
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{stage.name}</span>
                      {isFallback && (
                        <span
                          title="The AI backend was unreachable — this is a local placeholder, not real AI output"
                          className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        >
                          Offline
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{stage.description}</div>
                  </div>
                  {isActive && (
                    <div className="flex gap-1">
                      {['delay-75', 'delay-150', 'delay-200'].map((delayClass, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 bg-neon-purple rounded-full animate-waveform ${delayClass}`}
                        />
                      ))}
                    </div>
                  )}
                  {isCompleted && <ChevronRight className="w-5 h-5 text-neon-cyan" />}
                </div>

                {/* Show generated content when expanded */}
                {hasContent && generatedContent[`${stage.name}_expanded`] && (
                  <div className="mt-2 p-4 bg-studio-dark rounded-lg border border-studio-border">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{generatedContent[stage.name]}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pluginChain.length > 0 && (
        <div className="mb-6 p-4 rounded-lg border border-studio-border bg-studio-panel">
          <div className="text-sm font-semibold mb-1">Suggested Plugin Chain</div>
          <div className="text-xs text-muted-foreground mb-3">
            A reference recipe for {selectedHost} — not loaded or connected automatically, set these up yourself in your DAW.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pluginChain.map((item) => (
              <div key={item.pluginId} className="rounded-lg bg-[#11141f] p-4 border border-[#22263b]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-semibold text-white">{item.pluginName}</div>
                    <div className="text-xs text-muted-foreground">Stage {item.order}</div>
                  </div>
                  <div className="text-xs uppercase text-neon-cyan">{item.hostSupport.join(', ')}</div>
                </div>
                <div className="text-sm text-muted-foreground mb-2">{item.route.insertPoint || item.route.destination}</div>
                <div className="text-sm text-white mb-3">Preset: {item.preset.name}</div>
                <div className="grid gap-2 text-xs">
                  {Object.entries(item.preset.parameterValues).map(([key, value]) => (
                    <div key={key} className="rounded-md bg-[#16182d] p-2">
                      <span className="font-medium text-white">{key}</span>: <span className="text-muted-foreground">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!selectedGenre || !selectedMood || isGenerating}
        className="w-full bg-gradient-to-r from-neon-purple to-neon-cyan hover:shadow-xl hover:shadow-neon-purple/50 transition-all h-12 text-lg font-semibold"
      >
        {isGenerating ? (
          <>
            <div className="flex gap-1 mr-2">
              {['delay-75', 'delay-150', 'delay-200'].map((delayClass, i) => (
                <div
                  key={i}
                  className={`w-1 h-4 bg-white rounded-full animate-waveform ${delayClass}`}
                />
              ))}
            </div>
            Generating...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Generate Track
          </>
        )}
      </Button>
      <div className="mt-3 text-xs text-muted-foreground">
        Uses local AI fallback when the remote backend is unavailable. No remote API call is required for core beat generation.
      </div>

      {/* Premium Voice Cloning CTA */}
      <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-neon-pink/10 to-neon-purple/10 border border-neon-pink/30">
        <div className="flex items-center gap-3 mb-2">
          <Mic className="w-5 h-5 text-neon-pink" />
          <span className="font-semibold">Premium: AI Voice Cloning</span>
          <span className="ml-auto text-xs bg-neon-pink/20 px-2 py-1 rounded-full text-neon-pink">PRO</span>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Add professional vocals to your AI-generated tracks with custom voice cloning
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Coming soon — billing isn't set up yet"
          className="border-neon-pink/50 hover:bg-neon-pink/10 text-neon-pink disabled:opacity-50"
        >
          Upgrade to Add Vocals
        </Button>
      </div>
    </div>
  );
};
