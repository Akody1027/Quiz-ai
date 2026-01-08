
import React, { useState } from 'react';
import { GameState, HostPersonality } from './types';
import HostSelection from './components/HostSelection';
import LiveHost from './components/LiveHost';
import { generateGameSummaryTTS } from './services/geminiService';
import { decode } from './utils/audioUtils';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [selectedHost, setSelectedHost] = useState<HostPersonality | null>(null);
  const [finalScore, setFinalScore] = useState({ score: 0, count: 0 });

  const startNewGame = () => {
    setGameState(GameState.SELECT_HOST);
  };

  const handleHostSelect = (host: HostPersonality) => {
    setSelectedHost(host);
    setGameState(GameState.PLAYING);
  };

  const handleEndGame = async (score: number, count: number) => {
    setFinalScore({ score, count });
    setGameState(GameState.SUMMARY);
    
    // Play end game TTS with volume boost
    if (selectedHost) {
      try {
        const base64Audio = await generateGameSummaryTTS(score, count, selectedHost.name);
        const audioData = decode(base64Audio);
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Boost volume for summary
        const gainNode = ctx.createGain();
        gainNode.gain.value = 2.0; // 200% volume
        gainNode.connect(ctx.destination);

        const buffer = await ctx.decodeAudioData(audioData.buffer);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        source.start();
      } catch (err) {
        console.error("TTS Summary Error:", err);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="py-6 px-10 flex justify-between items-center border-b border-white/5 glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-2xl shadow-[0_0_20px_rgba(79,70,229,0.5)]">T</div>
          <h1 className="text-2xl font-black tracking-tight">TRIVIA<span className="text-indigo-500">.AI</span></h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-widest bg-slate-800/50 px-3 py-1 rounded-full border border-slate-700">Gemini Live Powered</span>
        </div>
      </header>

      <main className="flex-1">
        {gameState === GameState.START && (
          <div className="h-[80vh] flex flex-col items-center justify-center text-center p-6">
            <div className="max-w-3xl animate-in fade-in zoom-in duration-700">
              <span className="text-indigo-400 font-bold tracking-widest uppercase mb-4 block">The Ultimate Voice-First Trivia Experience</span>
              <h2 className="text-6xl md:text-8xl font-black mb-8 leading-tight">
                Play Trivia with <br />
                <span className="gradient-text">Dynamic AI Hosts</span>
              </h2>
              <p className="text-slate-400 text-lg md:text-xl mb-12 max-w-xl mx-auto leading-relaxed">
                Experience real-time conversations, dynamic personalities, and instant AI fact-checking in our revolutionary trivia arena.
              </p>
              <button 
                onClick={startNewGame}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-5 rounded-2xl text-2xl font-bold shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all hover:-translate-y-1 active:scale-95 flex items-center gap-3 mx-auto"
              >
                Start Your Journey 
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
              </button>
            </div>
          </div>
        )}

        {gameState === GameState.SELECT_HOST && (
          <HostSelection onSelect={handleHostSelect} />
        )}

        {gameState === GameState.PLAYING && selectedHost && (
          <LiveHost host={selectedHost} onEndGame={handleEndGame} />
        )}

        {gameState === GameState.SUMMARY && (
          <div className="h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-1000">
            <div className="glass p-12 rounded-[3rem] max-w-2xl border-indigo-500/30">
              <div className="text-6xl mb-6">🏆</div>
              <h2 className="text-5xl font-black mb-4">Game Over!</h2>
              <p className="text-slate-400 text-lg mb-8">You went head-to-head with {selectedHost?.name}. Here's how you did:</p>
              
              <div className="grid grid-cols-2 gap-6 mb-12">
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                  <span className="text-sm font-bold text-slate-500 uppercase block mb-1">Final Score</span>
                  <span className="text-4xl font-black text-indigo-400">{finalScore.score}</span>
                </div>
                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                  <span className="text-sm font-bold text-slate-500 uppercase block mb-1">Questions Answered</span>
                  <span className="text-4xl font-black text-purple-400">{finalScore.count}</span>
                </div>
              </div>

              <div className="flex gap-4 justify-center">
                <button 
                  onClick={() => setGameState(GameState.START)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 px-8 rounded-xl transition-all"
                >
                  Return Home
                </button>
                <button 
                  onClick={startNewGame}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-8 px-10 text-center text-slate-500 text-xs border-t border-white/5">
        <p>&copy; 2024 Trivia.AI Studio. Powered by Google Gemini. All facts verified via Google Search.</p>
      </footer>
    </div>
  );
};

export default App;
