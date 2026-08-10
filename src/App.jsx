import React, { useState } from 'react';
import DraftPage from './pages/Draft';
import DebugDashboard from './pages/DebugDashboard';
import { Gamepad2 } from 'lucide-react';

export default function App() {
  const [currentView, setCurrentView] = useState('game'); // 'game' | 'dashboard'

  return (
    <div className="min-h-screen bg-[#070b12]">
      {currentView === 'game' ? (
        <DraftPage
          onToggleDashboard={() => setCurrentView('dashboard')}
          showDebug={false}
        />
      ) : (
        <div className="relative">
          <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-50 backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-black rounded border border-amber-500/30 uppercase">
                  Developer Mode
                </span>
                <h2 className="text-sm font-extrabold text-white">IPL Draft Arena Debug Dashboard</h2>
              </div>
              <button
                onClick={() => setCurrentView('game')}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
              >
                <Gamepad2 className="w-4 h-4" />
                <span>Return to Draft Arena</span>
              </button>
            </div>
          </div>
          <DebugDashboard />
        </div>
      )}
    </div>
  );
}
