
import React, { useState, useRef, useEffect } from 'react';
import { decodeBase64, decodeAudioData } from '../services/geminiService';

interface VoicePlayerProps {
  base64Audio: string | null;
  onProgressUpdate?: (progress: number) => void;
  onRefreshSlowMode: () => void;
  isSlowMode: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ base64Audio, onProgressUpdate, onRefreshSlowMode, isSlowMode }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState('0:00');
  const [durationDisplay, setDurationDisplay] = useState('0:00');

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    return () => {
      stopAudio(true);
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    stopAudio(true);
    audioBufferRef.current = null;
    if (base64Audio) {
      loadAudio();
    }
  }, [base64Audio]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadAudio = async () => {
    if (!base64Audio) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const bytes = decodeBase64(base64Audio);
      const buffer = await decodeAudioData(bytes, audioContextRef.current);
      audioBufferRef.current = buffer;
      setDurationDisplay(formatTime(buffer.duration));
    } catch (err) {
      console.error("Error loading audio:", err);
    }
  };

  const stopAudio = (resetOffset = true) => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsPlaying(false);
    if (resetOffset) {
      setProgress(0);
      offsetRef.current = 0;
      setCurrentTimeDisplay('0:00');
      if (onProgressUpdate) onProgressUpdate(0);
    }
  };

  const playFromOffset = async (startOffset: number) => {
    if (!base64Audio) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    try {
      if (!audioBufferRef.current) {
        await loadAudio();
      }

      const buffer = audioBufferRef.current;
      if (!buffer) return;

      const duration = buffer.duration;
      const clampedOffset = Math.max(0, Math.min(startOffset, duration));
      offsetRef.current = clampedOffset;

      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(audioContextRef.current.destination);
      
      source.onended = () => {
        if (!audioContextRef.current) return;
        const now = audioContextRef.current.currentTime;
        const currentPos = offsetRef.current + (now - startTimeRef.current) * playbackSpeed;
        if (currentPos >= duration - 0.2) {
          setIsPlaying(false);
          setProgress(100);
          setCurrentTimeDisplay(formatTime(duration));
          if (onProgressUpdate) onProgressUpdate(100);
        }
      };

      startTimeRef.current = audioContextRef.current.currentTime;
      source.start(0, clampedOffset);
      sourceNodeRef.current = source;
      setIsPlaying(true);

      const updateProgress = () => {
        if (!audioContextRef.current || !isPlaying) return;
        const now = audioContextRef.current.currentTime;
        const currentPos = offsetRef.current + (now - startTimeRef.current) * playbackSpeed;
        const newProgress = Math.min((currentPos / duration) * 100, 100);
        
        setProgress(newProgress);
        setCurrentTimeDisplay(formatTime(Math.min(currentPos, duration)));
        if (onProgressUpdate) onProgressUpdate(newProgress);
        
        if (newProgress < 100) {
          animationFrameRef.current = requestAnimationFrame(updateProgress);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } catch (err) {
      console.error("Playback error:", err);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      const now = audioContextRef.current!.currentTime;
      offsetRef.current += (now - startTimeRef.current) * playbackSpeed;
      stopAudio(false);
    } else {
      playFromOffset(offsetRef.current);
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioBufferRef.current) return;
    let currentPos = offsetRef.current;
    if (isPlaying) {
      const now = audioContextRef.current!.currentTime;
      currentPos += (now - startTimeRef.current) * playbackSpeed;
    }
    const newPos = Math.max(0, Math.min(currentPos + seconds, audioBufferRef.current.duration));
    
    if (isPlaying) {
      playFromOffset(newPos);
    } else {
      offsetRef.current = newPos;
      const prog = (newPos / audioBufferRef.current.duration) * 100;
      setProgress(prog);
      setCurrentTimeDisplay(formatTime(newPos));
      if (onProgressUpdate) onProgressUpdate(prog);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioBufferRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = Math.max(0, Math.min(x / rect.width, 1));
    const newOffset = clickedProgress * audioBufferRef.current.duration;
    
    if (isPlaying) {
      playFromOffset(newOffset);
    } else {
      offsetRef.current = newOffset;
      setProgress(clickedProgress * 100);
      setCurrentTimeDisplay(formatTime(newOffset));
      if (onProgressUpdate) onProgressUpdate(clickedProgress * 100);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-7 bg-slate-900/60 rounded-[2.5rem] border border-slate-700/50 shadow-2xl backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-3">
           <button 
             onClick={onRefreshSlowMode}
             className={`flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black tracking-widest transition-all border shadow-lg uppercase ${
               isSlowMode 
               ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/20' 
               : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
             }`}
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
             </svg>
             {isSlowMode ? 'LITE MODE ENABLED' : 'ENABLE LITE VOICES'}
           </button>
        </div>

        <div className="flex items-center gap-6">
           <button 
             onClick={() => handleSkip(-10)} 
             className="text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 p-2.5 rounded-full transition-all active:scale-90" 
             title="Skip back 10s"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
             </svg>
           </button>

           <button 
             onClick={handleTogglePlay} 
             className={`${isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-sky-500 hover:bg-sky-600 shadow-sky-500/20'} text-white p-5 rounded-full transition-all shadow-2xl active:scale-90 disabled:opacity-50`} 
             disabled={!base64Audio}
           >
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
           </button>

           <button 
             onClick={() => handleSkip(10)} 
             className="text-slate-500 hover:text-sky-400 hover:bg-sky-400/10 p-2.5 rounded-full transition-all active:scale-90" 
             title="Skip forward 10s"
           >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 005 8v8a1 1 0 001.6.8l5.334-4zM19.934 12.8a1 1 0 000-1.6l-5.334-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.334-4z" />
             </svg>
           </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Speed</span>
          <select 
            value={playbackSpeed} 
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-transparent text-xs font-black text-sky-400 focus:outline-none cursor-pointer"
          >
            <option value="0.5">0.5x</option>
            <option value="0.8">0.8x</option>
            <option value="1">1.0x</option>
            <option value="1.2">1.2x</option>
          </select>
        </div>
      </div>
      
      <div className="space-y-2 mt-2">
        <div 
          className="relative w-full h-3.5 bg-slate-950 rounded-full cursor-pointer overflow-hidden group shadow-inner border border-white/5"
          onClick={handleProgressBarClick}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-sky-500 transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(14,165,233,0.5)]" 
            style={{ width: `${progress}%` }}
          ></div>
          <div className="absolute top-0 left-0 h-full w-full opacity-0 group-hover:opacity-10 bg-white transition-opacity"></div>
        </div>
        <div className="flex justify-between text-[11px] font-black text-slate-500 tracking-widest px-1 tabular-nums">
          <span>{currentTimeDisplay}</span>
          <span>{durationDisplay}</span>
        </div>
      </div>
    </div>
  );
};
