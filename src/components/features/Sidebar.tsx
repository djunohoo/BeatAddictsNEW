import { Home, Music, Sparkles, Layers, Mic, BookOpen, Settings } from 'lucide-react';
import { useState } from 'react';

type TabType = 'dashboard' | 'sequencer' | 'ai' | 'mixer' | 'voice' | 'tutorials';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Sidebar = ({ activeTab, onTabChange }: SidebarProps) => {
  const tabs = [
    { id: 'dashboard' as TabType, icon: Home, label: 'Dashboard' },
    { id: 'sequencer' as TabType, icon: Music, label: 'Sequencer' },
    { id: 'ai' as TabType, icon: Sparkles, label: 'AI Studio' },
    { id: 'mixer' as TabType, icon: Layers, label: 'Mixer' },
    { id: 'voice' as TabType, icon: Mic, label: 'Voice Clone' },
    { id: 'tutorials' as TabType, icon: BookOpen, label: 'Learn' }
  ];

  return (
    <aside className="w-20 border-r border-studio-border bg-studio-dark flex flex-col items-center py-6 gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              group relative w-14 h-14 rounded-xl flex items-center justify-center transition-all
              ${isActive
                ? 'bg-gradient-to-br from-neon-purple to-neon-cyan shadow-lg shadow-neon-purple/50'
                : 'bg-studio-panel hover:bg-studio-surface'
              }
            `}
          >
            <Icon className={`w-6 h-6 ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-foreground'}`} />
            
            {/* Tooltip */}
            <div className="absolute left-full ml-4 px-3 py-2 bg-studio-surface border border-studio-border rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              <span className="text-sm font-medium">{tab.label}</span>
            </div>
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        disabled
        className="relative w-14 h-14 rounded-xl bg-studio-panel opacity-50 cursor-not-allowed flex items-center justify-center transition-all group"
      >
        <Settings className="w-6 h-6 text-muted-foreground" />
        <div className="absolute left-full ml-4 px-3 py-2 bg-studio-surface border border-studio-border rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          <span className="text-sm font-medium">Coming soon</span>
        </div>
      </button>
    </aside>
  );
};
