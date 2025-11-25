import React, { useState, useRef, useEffect } from 'react';
import { AppState, ExtractedDocument, ProcessingLog, SupportedLanguage } from './types';
import { SUPPORTED_LANGUAGES, MAX_PREVIEW_LENGTH, VOICE_OPTIONS } from './constants';
import { extractTextAndLanguage, translateText, generateSpeech } from './services/geminiService';
import { decodeAudioData } from './utils/audioHelper';
import { StepIndicator } from './components/StepIndicator';
import { AudioPlayer } from './components/AudioPlayer';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedDocument | null>(null);
  const [targetLang, setTargetLang] = useState<string>('en');
  const [selectedVoice, setSelectedVoice] = useState<string>('Puck');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<AudioBuffer | null>(null);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, { id: Date.now().toString(), message, timestamp: Date.now() }]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setErrorMsg(null);
    }
  };

  // Update default voice when language changes
  useEffect(() => {
    const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
    if (langConfig) {
      setSelectedVoice(langConfig.voiceName);
    }
  }, [targetLang]);

  const handleUploadAndExtract = async () => {
    if (!file) return;

    try {
      setAppState(AppState.EXTRACTING);
      addLog(`Uploading ${file.name}...`);
      
      const result = await extractTextAndLanguage(file);
      
      addLog(`Text extracted. Detected language: ${result.detectedLanguage}`);
      setExtractedData(result);
      
      // Attempt to auto-select target language
      const matchedLang = SUPPORTED_LANGUAGES.find(l => 
        result.detectedLanguage.toLowerCase().includes(l.name.toLowerCase())
      );
      if (matchedLang) {
        setTargetLang(matchedLang.code);
      }

      setAppState(AppState.REVIEW);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Extraction failed");
      setAppState(AppState.ERROR);
    }
  };

  const handlePreview = async () => {
    if (!extractedData) return;
    setIsPreviewLoading(true);
    try {
      // For preview, we use a small snippet. 
      // If translation is needed, we only translate the snippet.
      let snippet = extractedData.text.substring(0, 300);
      const selectedLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);

      if (selectedLangConfig && !extractedData.detectedLanguage.toLowerCase().includes(selectedLangConfig.name.toLowerCase())) {
         snippet = await translateText(snippet, selectedLangConfig.name);
      }

      const base64Audio = await generateSpeech(snippet, selectedVoice);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(base64Audio, ctx);
      
      // Play immediately
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

    } catch (e) {
      console.error("Preview failed", e);
      alert("Preview generation failed.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleGenerateAudiobook = async () => {
    if (!extractedData) return;

    try {
      // If we are already translating for the preview, we might re-do it here for the full text. 
      // In a prod app, we'd cache the translated text.
      
      const selectedLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
      
      if (!selectedLangConfig) throw new Error("Invalid language selection");

      // 1. Translation Step (if needed)
      // Check if detected language implies translation is needed.
      const needsTranslation = !extractedData.detectedLanguage.toLowerCase().includes(selectedLangConfig.name.toLowerCase());
      let textToSpeak = extractedData.text;

      if (needsTranslation) {
        setAppState(AppState.TRANSLATING);
        addLog(`Translating full text to ${selectedLangConfig.name}...`);
        textToSpeak = await translateText(extractedData.text, selectedLangConfig.name);
        addLog("Translation complete.");
      }

      // 2. TTS Generation
      setAppState(AppState.GENERATING_AUDIO);
      addLog(`Generating audio using Gemini TTS (Voice: ${selectedVoice})...`);
      addLog("Large documents are processed in chunks...");
      
      const base64Audio = await generateSpeech(textToSpeak, selectedVoice);
      addLog("Audio generated. Assembling...");

      // 3. Decoding
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const buffer = await decodeAudioData(base64Audio, ctx);
      
      setAudioBuffer(buffer);
      setAppState(AppState.PLAYBACK);
      addLog("Audiobook ready!");

    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Generation failed");
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    setAppState(AppState.IDLE);
    setFile(null);
    setExtractedData(null);
    setAudioBuffer(null);
    setLogs([]);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen p-6 md:p-12 flex flex-col items-center">
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 mb-2">
          Gemini Audiobook Creator
        </h1>
        <p className="text-slate-400 text-lg">
          Turn PDFs, Docs, and text files into lifelike speech instantly.
        </p>
      </header>

      <StepIndicator currentStep={appState} />

      <main className="w-full max-w-3xl bg-slate-800/50 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-8 transition-all">
        
        {/* IDLE STATE: UPLOAD */}
        {appState === AppState.IDLE && (
          <div className="flex flex-col items-center justify-center space-y-6 py-10">
            <div className="w-full max-w-md">
              <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-600 border-dashed rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-750 hover:border-indigo-500 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-12 h-12 mb-4 text-slate-400 group-hover:text-indigo-400 transition-colors" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                  </svg>
                  <p className="mb-2 text-sm text-slate-400"><span className="font-semibold text-slate-200">Click to upload</span> or drag and drop</p>
                  <p className="text-xs text-slate-500">PDF, DOCX, TXT (MAX. 5MB)</p>
                </div>
                <input id="file-upload" type="file" className="hidden" accept=".pdf,.docx,.txt" onChange={handleFileChange} />
              </label>
            </div>

            {file && (
              <div className="flex flex-col items-center gap-4 animate-fade-in">
                <div className="flex items-center gap-2 text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  <span className="font-medium">{file.name}</span>
                </div>
                <button 
                  onClick={handleUploadAndExtract}
                  className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/30 transition-all hover:scale-105"
                >
                  Analyze Document
                </button>
              </div>
            )}
          </div>
        )}

        {/* PROCESSING STATES */}
        {(appState === AppState.EXTRACTING || appState === AppState.TRANSLATING || appState === AppState.GENERATING_AUDIO) && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-700 rounded-full"></div>
              <div className="absolute top-0 left-0 w-full h-full border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              {appState === AppState.EXTRACTING && "Reading Document..."}
              {appState === AppState.TRANSLATING && "Translating Text..."}
              {appState === AppState.GENERATING_AUDIO && "Synthesizing Voice..."}
            </h2>
            <div className="w-full max-w-md bg-slate-900 rounded-lg p-4 mt-6 h-32 overflow-y-auto font-mono text-xs text-slate-400 border border-slate-700">
              {logs.map(log => (
                <div key={log.id} className="mb-1 border-l-2 border-indigo-500 pl-2">
                  <span className="opacity-50">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REVIEW STATE */}
        {appState === AppState.REVIEW && extractedData && (
          <div className="space-y-6">
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Document Summary</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-slate-800 p-3 rounded-lg">
                  <span className="text-xs text-slate-500 block">Detected Language</span>
                  <span className="text-indigo-400 font-medium">{extractedData.detectedLanguage}</span>
                </div>
                <div className="bg-slate-800 p-3 rounded-lg">
                  <span className="text-xs text-slate-500 block">Character Count</span>
                  <span className="text-slate-200 font-medium">{extractedData.text.length}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <span className="text-xs text-slate-500">Text Preview:</span>
                <p className="text-slate-300 text-sm p-4 bg-slate-800 rounded-lg italic leading-relaxed border border-slate-700/50 max-h-40 overflow-y-auto">
                  "{extractedData.text.substring(0, MAX_PREVIEW_LENGTH)}..."
                </p>
              </div>

              {extractedData.text.length > 5000 && (
                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start gap-3">
                  <svg className="w-6 h-6 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <p className="text-xs text-amber-200">
                    <strong>Large Document:</strong> This text is quite long ({extractedData.text.length} characters). 
                    Generation might take longer as we process it in high-quality chunks to avoid API limits.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-indigo-900/20 p-6 rounded-xl border border-indigo-500/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-indigo-300 mb-2">Language</label>
                  <select 
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className="bg-slate-900 border border-indigo-500/50 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-300 mb-2">Voice Model</label>
                  <select 
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-slate-900 border border-indigo-500/50 text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-3"
                  >
                    {VOICE_OPTIONS.map(voice => (
                      <option key={voice} value={voice}>{voice}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                 <button 
                  onClick={handlePreview}
                  disabled={isPreviewLoading}
                  className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold border border-slate-600 transition-all flex items-center justify-center gap-2"
                >
                  {isPreviewLoading ? (
                    <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin"></span>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  )}
                  Listen Preview
                </button>

                <button 
                  onClick={handleGenerateAudiobook}
                  className="flex-[2] py-3 px-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold shadow-lg shadow-indigo-500/30 whitespace-nowrap transition-all"
                >
                  Generate Full Audiobook
                </button>
              </div>
              
              <p className="text-xs text-indigo-400/70 mt-4 text-center">
                * If target language differs from source, automatic translation will be applied.
              </p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {appState === AppState.ERROR && (
          <div className="text-center py-10">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
            <p className="text-red-300 mb-6">{errorMsg}</p>
            <button 
              onClick={resetApp}
              className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* PLAYBACK STATE */}
        {appState === AppState.PLAYBACK && audioBuffer && file && (
          <div className="animate-fade-in-up">
            <AudioPlayer audioBuffer={audioBuffer} fileName={file.name} />
            <div className="text-center mt-8">
              <button 
                onClick={resetApp}
                className="text-slate-500 hover:text-white underline text-sm transition-colors"
              >
                Create Another Audiobook
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-12 text-slate-600 text-xs">
        Powered by Gemini 2.5 Flash & Gemini 2.5 Flash TTS
      </footer>
    </div>
  );
};

export default App;