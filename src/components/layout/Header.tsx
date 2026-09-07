import { Play, Pause, Square, Save, FolderOpen, Settings, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { useProjectStore } from '../../stores/projectStore';
import { usePulseStore } from '../../stores/pulseStore';

export const Header = () => {
  const { currentProject, isPlaying, togglePlay, stop, setBPM } = useProjectStore();
  const { togglePulse } = usePulseStore();

  return (
    <header className="h-16 border-b border-studio-border bg-studio-dark/95 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-neon-purple to-neon-cyan rounded-lg flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold neon-glow">Beat Addicts</h1>
          <p className="text-xs text-muted-foreground">{currentProject?.name || 'Untitled Project'}</p>
        </div>
      </div>

      {/* Transport Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={togglePlay}
          className="border-studio-border hover:border-neon-purple hover:bg-neon-purple/10"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={stop}
          className="border-studio-border hover:border-neon-purple hover:bg-neon-purple/10"
        >
          <Square className="w-4 h-4" />
        </Button>
        
        <div className="flex items-center gap-2 ml-4 glass-panel px-4 py-2 rounded-lg">
          <span className="text-sm text-muted-foreground">BPM</span>
          <input
            type="number"
            value={currentProject?.bpm || 128}
            onChange={(e) => setBPM(parseInt(e.target.value))}
            className="w-16 bg-studio-dark border border-studio-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-neon-purple"
            min="60"
            max="200"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Coming soon — project loading isn't implemented yet"
          className="border-studio-border hover:border-neon-purple hover:bg-neon-purple/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Open
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled
          title="Coming soon — project saving isn't implemented yet"
          className="border-studio-border hover:border-neon-purple hover:bg-neon-purple/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled
          title="Coming soon — settings aren't implemented yet"
          className="border-studio-border hover:border-neon-purple hover:bg-neon-purple/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button
          onClick={togglePulse}
          className="bg-gradient-to-r from-neon-purple to-neon-cyan hover:shadow-lg hover:shadow-neon-purple/50 transition-all"
        >
          <Zap className="w-4 h-4 mr-2" />
          Pulse
        </Button>
      </div>
    </header>
  );
};
