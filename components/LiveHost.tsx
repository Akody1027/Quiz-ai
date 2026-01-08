
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { HostPersonality, FactCheck } from '../types';
import { decode, encode, decodeAudioData, createPcmBlob } from '../utils/audioUtils';
import { getVerifiedFact } from '../services/geminiService';
import AudioVisualizer from './AudioVisualizer';

interface LiveHostProps {
  host: HostPersonality;
  onEndGame: (score: number, count: number) => void;
}

const LiveHost: React.FC<LiveHostProps> = ({ host, onEndGame }) => {
  const [isReady, setIsReady] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'host' | 'user'; text: string }[]>([]);
  const [currentHostText, setCurrentHostText] = useState('');
  const [currentUserText, setCurrentUserText] = useState('');
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [latestFact, setLatestFact] = useState<FactCheck | null>(null);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [volume, setVolume] = useState(2.5); // Default boosted volume

  const nextStartTimeRef = useRef(0);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Update gain when volume slider changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume, audioContextsRef.current?.output.currentTime || 0, 0.1);
    }
  }, [volume]);

  // Setup Live API
  const setupSession = useCallback(async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(micStream);

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const gainNode = outputCtx.createGain();
      gainNode.gain.value = volume;
      gainNode.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Session Opened');
            setIsReady(true);
            const source = inputCtx.createMediaStreamSource(micStream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: pcmData, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Transcription
            if (message.serverContent?.outputTranscription) {
              setCurrentHostText(prev => prev + message.serverContent!.outputTranscription!.text);
            } else if (message.serverContent?.inputTranscription) {
              setCurrentUserText(prev => prev + message.serverContent!.inputTranscription!.text);
            }

            if (message.serverContent?.turnComplete) {
              setTranscript(prev => [
                ...prev,
                { role: 'user', text: currentUserText },
                { role: 'host', text: currentHostText }
              ]);
              
              if (currentHostText.toLowerCase().includes('correct') || currentHostText.toLowerCase().includes('right')) {
                setScore(s => s + 1);
              }
              if (currentHostText.includes('?')) {
                setQuestionCount(c => c + 1);
              }

              if (currentHostText.length > 50) {
                handleFactCheck(currentHostText);
              }

              setCurrentHostText('');
              setCurrentUserText('');
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && audioContextsRef.current && gainNodeRef.current) {
              const { output } = audioContextsRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
              const buffer = await decodeAudioData(decode(base64Audio), output, 24000, 1);
              const source = output.createBufferSource();
              source.buffer = buffer;
              // Connect through gain node for volume boost
              source.connect(gainNodeRef.current);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => console.error('Live API Error:', e),
          onclose: () => console.log('Session Closed'),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: host.accent as any } }
          },
          systemInstruction: `${host.instruction}. Start the game immediately by introducing yourself and asking the first trivia question. Keep score internally and verbally. Enable input and output transcriptions.`,
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Failed to start session:', err);
    }
  }, [host]);

  useEffect(() => {
    setupSession();
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (audioContextsRef.current) {
        audioContextsRef.current.input.close();
        audioContextsRef.current.output.close();
      }
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleFactCheck = async (text: string) => {
    setIsFactChecking(true);
    try {
      const fact = await getVerifiedFact(text);
      setLatestFact(fact);
    } finally {
      setIsFactChecking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-[calc(100vh-120px)]">
      {/* Host Area */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="glass rounded-3xl p-8 flex flex-col items-center justify-center relative overflow-hidden flex-1">
          <div className="absolute top-4 right-4 bg-indigo-600/30 px-4 py-1 rounded-full text-sm font-bold border border-indigo-500/50">
            Score: {score}
          </div>
          
          <div className="relative mb-8">
            {isReady && <div className="pulse-ring"></div>}
            <div className="text-8xl relative z-10">{host.avatar}</div>
          </div>
          
          <h2 className="text-3xl font-bold mb-2">{host.name}</h2>
          <p className="text-indigo-400 font-medium mb-6">Host Personality: {host.id}</p>

          <div className="w-full bg-slate-900/50 rounded-2xl p-6 min-h-[120px] flex flex-col items-center justify-center text-center">
            {currentHostText ? (
              <p className="text-xl text-slate-100 italic">"{currentHostText}"</p>
            ) : (
              <p className="text-slate-500">Wait for the host to speak...</p>
            )}
          </div>

          <div className="mt-8 w-full">
            <AudioVisualizer stream={stream} isActive={isReady} />
            <div className="flex justify-center mt-4">
               {currentUserText && (
                 <div className="bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-700 max-w-md">
                   <span className="text-xs font-bold text-slate-500 uppercase block mb-1">You said:</span>
                   <p className="text-slate-300">"{currentUserText}"</p>
                 </div>
               )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="glass rounded-2xl p-4 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-green-500 shadow-[0_0_10px_green]' : 'bg-red-500'}`}></div>
              <span className="text-sm font-semibold whitespace-nowrap">{isReady ? 'Live Session' : 'Connecting...'}</span>
            </div>
            
            <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-white/5">
              <span className="text-xl">🔊</span>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Voice Boost</span>
                <input 
                  type="range" 
                  min="0" 
                  max="4" 
                  step="0.1" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-indigo-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
              <span className="text-xs font-mono text-indigo-400 w-8">{Math.round(volume * 100)}%</span>
            </div>
          </div>

          <button 
            onClick={() => onEndGame(score, questionCount)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-lg shadow-red-900/20"
          >
            End Game
          </button>
        </div>
      </div>

      {/* Sidebar: Transcript & Fact Check */}
      <div className="flex flex-col gap-6 h-full overflow-hidden">
        <div className="glass rounded-2xl p-6 flex flex-col h-1/2">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>📜</span> Game Logs
          </h3>
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {transcript.map((t, i) => (
              <div key={i} className={`p-3 rounded-lg text-sm ${t.role === 'host' ? 'bg-indigo-900/20 border-l-2 border-indigo-500' : 'bg-slate-700/30 border-l-2 border-slate-400'}`}>
                <span className="font-bold block mb-1 opacity-60 text-[10px] uppercase tracking-tighter">
                  {t.role === 'host' ? host.name : 'You'}
                </span>
                {t.text}
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 flex flex-col h-1/2 relative">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🔍</span> AI Fact Checker
            {isFactChecking && <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>}
          </h3>
          <div className="flex-1 overflow-y-auto pr-2">
            {latestFact ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <p className="text-xs font-bold text-indigo-400 uppercase">Context Verification</p>
                <p className="text-slate-300 text-sm italic">"{latestFact.query.slice(0, 100)}..."</p>
                <div className="bg-slate-900/40 p-3 rounded-lg border border-white/5">
                  <p className="text-sm text-slate-100">{latestFact.fact}</p>
                </div>
                {latestFact.sources.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">Sources:</p>
                    <div className="flex flex-wrap gap-2">
                      {latestFact.sources.map((s, i) => (
                        <a 
                          key={i} 
                          href={s.uri} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded border border-slate-700 text-indigo-300 transition-colors"
                        >
                          {s.title.length > 25 ? s.title.slice(0, 25) + '...' : s.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <span className="text-4xl mb-2">🤖</span>
                <p className="text-sm">Speak to trigger real-time Google Search grounding facts.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveHost;
