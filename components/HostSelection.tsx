
import React from 'react';
import { HOST_PERSONALITIES } from '../constants';
import { HostPersonality } from '../types';

interface HostSelectionProps {
  onSelect: (host: HostPersonality) => void;
}

const HostSelection: React.FC<HostSelectionProps> = ({ onSelect }) => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-extrabold mb-4 gradient-text">Choose Your Host</h2>
        <p className="text-slate-400 text-lg">Every game is different depending on who's asking the questions.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {HOST_PERSONALITIES.map((host) => (
          <button
            key={host.id}
            onClick={() => onSelect(host)}
            className="glass p-6 rounded-2xl text-left transition-all hover:scale-[1.02] hover:bg-slate-800 active:scale-95 group"
          >
            <div className="flex items-center gap-4 mb-4">
              <span className="text-5xl group-hover:scale-110 transition-transform">{host.avatar}</span>
              <div>
                <h3 className="text-2xl font-bold text-white">{host.name}</h3>
                <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">{host.id}</span>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed">{host.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HostSelection;
