import React, { useEffect, useRef, useState } from 'react';
import { bufferToWave } from '../utils/audioHelper';

interface AudioPlayerProps {
  audioBuffer: AudioBuffer;
  fileName: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBuffer, fileName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const [downloadUrl, setDownloadUrl] = useState<string>('');

  useEffect(() => {
    // Generate Download Link
    const blob = bufferToWave(audioBuffer, audioBuffer.length);
    const url = URL.createObjectURL(blob);
    setDownloadUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [audioBuffer]);

  useEffect(() => {
    drawWaveform();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  };

  const playAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    source.onended = () => setIsPlaying(false);
    
    source.start(0);
    startTimeRef.current = ctx.currentTime;
    sourceRef.current = source;
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    setIsPlaying(false);
  };

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#6366f1'; // Indigo-500

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[i * step + j];
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700 w-full max-w-2xl mx-auto mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">Audiobook Ready</h3>
        <span className="text-slate-400 text-sm">{formatDuration(audioBuffer.duration)}</span>
      </div>

      <div className="relative bg-slate-900 rounded-lg overflow-hidden h-32 mb-6 border border-slate-700">
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={128} 
          className="w-full h-full object-cover opacity-80"
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={togglePlay}
          className={`flex-1 py-3 px-6 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all
            ${isPlaying 
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20' 
              : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'}
          `}
        >
          {isPlaying ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Stop
            </>
          ) : (
             <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Play
            </>
          )}
        </button>

        <a
          href={downloadUrl}
          download={`audiobook_${fileName}.wav`}
          className="flex-1 py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all border border-slate-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Download MP3
        </a>
      </div>
    </div>
  );
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
