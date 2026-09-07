import { useState } from 'react';
import { AIStudio } from './components/features/AIStudio';
import { Dashboard } from './components/features/Dashboard';
import { Mixer } from './components/features/Mixer';
import { PulseAssistant } from './components/features/PulseAssistant';
import { Sequencer } from './components/features/Sequencer';
import { Sidebar } from './components/features/Sidebar';
import { Tutorials } from './components/features/Tutorials';
import { Header } from './components/layout/Header';
import { Toaster } from './components/ui/toaster';

type TabType = 'dashboard' | 'sequencer' | 'ai' | 'mixer' | 'voice' | 'tutorials';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'sequencer':
        return <Sequencer />;
      case 'ai':
        return (
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <AIStudio />
            </div>
          </div>
        );
      case 'tutorials':
        return <Tutorials />;
      case 'mixer':
        return <Mixer />;
      case 'voice':
        return (
          <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
            <div className="text-center max-w-md glass-panel rounded-xl p-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-neon-pink to-neon-purple flex items-center justify-center">
                <span className="text-2xl">🎤</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">AI Voice Cloning</h2>
              <p className="text-muted-foreground mb-4">
                Premium feature - Create custom vocals with AI voice cloning technology
              </p>
              <button
                disabled
                title="Coming soon — billing isn't set up yet"
                className="px-6 py-3 bg-gradient-to-r from-neon-pink to-neon-purple rounded-lg font-semibold hover:shadow-xl transition-all opacity-50 cursor-not-allowed"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-studio-dark text-foreground">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        {renderContent()}
      </div>
      <PulseAssistant />
      <Toaster />
    </div>
  );
}

export default App;
