import { useEffect, useState } from 'react';
import { AIStudio } from './components/features/AIStudio';
import { Auth } from './components/features/Auth';
import { Dashboard } from './components/features/Dashboard';
import { Mixer } from './components/features/Mixer';
import { PulseAssistant } from './components/features/PulseAssistant';
import { Sequencer } from './components/features/Sequencer';
import { Sidebar } from './components/features/Sidebar';
import { Tutorials } from './components/features/Tutorials';
import { Header } from './components/layout/Header';
import { Toaster } from './components/ui/toaster';
import { startStudioTimeTracking } from './lib/studioTime';
import { useAuthStore } from './stores/authStore';

type TabType = 'dashboard' | 'sequencer' | 'ai' | 'mixer' | 'tutorials';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const { session, initialized, init } = useAuthStore();

  useEffect(() => init(), [init]);
  useEffect(() => startStudioTimeTracking(), []);

  if (!initialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-studio-dark">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <Auth />
        <Toaster />
      </>
    );
  }

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
