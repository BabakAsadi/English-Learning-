
import React, { useState, useMemo, useEffect } from 'react';
import { generateScenario, generateAudio, getWordDefinition } from './services/geminiService';
import { Scenario, AppStatus, Level, VocabularyItem, Topic, Duration } from './types';
import { VoicePlayer } from './components/VoicePlayer';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [selectedLevel, setSelectedLevel] = useState<Level>('Intermediate');
  const [selectedTopic, setSelectedTopic] = useState<Topic>('Job Interview');
  const [selectedDuration, setSelectedDuration] = useState<Duration>('1m');
  
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [visibleTranslations, setVisibleTranslations] = useState<Record<number, boolean>>({});
  const [customVocab, setCustomVocab] = useState<VocabularyItem[]>([]);
  const [isSlowMode, setIsSlowMode] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  const startPractice = async (overrideSlowMode?: boolean) => {
    const useSlow = overrideSlowMode !== undefined ? overrideSlowMode : isSlowMode;
    try {
      setError(null);
      setAudioData(null);
      setPlaybackProgress(0);
      
      if (!scenario) {
        setStatus(AppStatus.GENERATING_TEXT);
        const newScenario = await generateScenario(
          selectedLevel, 
          selectedTopic, 
          selectedDuration, 
          "Frontend Team Lead / Junior Developer"
        );
        setScenario(newScenario);
        setStatus(AppStatus.GENERATING_AUDIO);
        const base64Audio = await generateAudio(newScenario, useSlow);
        setAudioData(base64Audio);
      } else {
        setStatus(AppStatus.GENERATING_AUDIO);
        const base64Audio = await generateAudio(scenario, useSlow);
        setAudioData(base64Audio);
      }
      
      setStatus(AppStatus.READY);
    } catch (err) {
      console.error(err);
      setError("Failed to create session. Please try again.");
      setStatus(AppStatus.ERROR);
    }
  };

  const toggleSlowMode = () => {
    const next = !isSlowMode;
    setIsSlowMode(next);
    if (scenario) startPractice(next);
  };

  const handleWordClick = async (word: string, context: string) => {
    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
    if (isLookingUp || !cleanWord) return;
    setIsLookingUp(true);
    try {
      const def = await getWordDefinition(cleanWord, context);
      setCustomVocab(prev => {
        if (prev.find(v => v.word.toLowerCase() === cleanWord.toLowerCase())) return prev;
        return [{ ...def, isCustom: true }, ...prev];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLookingUp(false);
    }
  };

  const activeTurnIndex = useMemo(() => {
    if (!scenario || playbackProgress === 0 || playbackProgress >= 99.5) return -1;
    const totalChars = scenario.dialogue.reduce((acc, turn) => acc + turn.text.length, 0);
    let charCounter = 0;
    const progressRatio = playbackProgress / 100;
    for (let i = 0; i < scenario.dialogue.length; i++) {
      const turnChars = scenario.dialogue[i].text.length;
      if (progressRatio >= charCounter / totalChars && progressRatio < (charCounter + turnChars) / totalChars) {
        return i;
      }
      charCounter += turnChars;
    }
    return -1;
  }, [scenario, playbackProgress]);

  const toggleTranslation = (idx: number) => {
    setVisibleTranslations(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="min-h-screen pb-20 px-4 md:px-8 max-w-7xl mx-auto">
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 py-4 mb-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sky-500 rounded-xl flex items-center justify-center text-white shadow-sky-500/20 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-black">Frontend Hub</h1>
              <p className="text-[10px] text-sky-400 font-bold uppercase tracking-widest">Career English Training</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Level Selector */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {(['Beginner', 'Intermediate', 'Advanced'] as Level[]).map(lvl => (
                <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedLevel === lvl ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>{lvl}</button>
              ))}
            </div>

            {/* Topic Selector */}
            <select 
              value={selectedTopic} 
              onChange={(e) => setSelectedTopic(e.target.value as Topic)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
            >
              <option value="Job Interview">Job Interview</option>
              <option value="Work Daily">Work Daily</option>
              <option value="Casual">Casual Dialogue</option>
            </select>

            {/* Duration Selector */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {(['1m', '3m', '5m'] as Duration[]).map(dur => (
                <button key={dur} onClick={() => setSelectedDuration(dur)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedDuration === dur ? 'bg-sky-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}>{dur}</button>
              ))}
            </div>

            <button 
              onClick={() => { setScenario(null); startPractice(); }} 
              disabled={status === AppStatus.GENERATING_TEXT || status === AppStatus.GENERATING_AUDIO} 
              className="bg-sky-500 hover:bg-sky-600 disabled:bg-slate-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 whitespace-nowrap active:scale-95"
            >
              {status === AppStatus.IDLE ? 'Start' : 'Generate'}
              {(status === AppStatus.GENERATING_TEXT || status === AppStatus.GENERATING_AUDIO) && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
            </button>
          </div>
        </div>
      </header>

      <main>
        {status === AppStatus.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-1000">
             <div className="relative">
                <div className="absolute inset-0 bg-sky-500 blur-[80px] opacity-10 rounded-full"></div>
                <img src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400&h=300" className="relative rounded-[3rem] shadow-2xl border border-white/5" alt="Hero" />
             </div>
            <div className="space-y-4">
              <h2 className="text-4xl font-black max-w-md mx-auto leading-tight">Master English for Modern Teams</h2>
              <p className="text-slate-400 max-w-sm mx-auto">Personalized AI dialogues to help you advance in international tech companies.</p>
            </div>
            <button onClick={startPractice} className="bg-white text-slate-900 px-8 py-4 rounded-3xl font-black text-lg hover:bg-sky-50 shadow-2xl transition-all active:scale-95">Begin Session</button>
          </div>
        )}

        {(status === AppStatus.GENERATING_TEXT || status === AppStatus.GENERATING_AUDIO) && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
              <p className="text-sky-400 font-bold text-lg animate-pulse">{status === AppStatus.GENERATING_TEXT ? "Writing Custom Dialogue..." : "Generating High-Quality Voices..."}</p>
              <p className="text-slate-500 text-sm mt-2">Setting the stage for your practice.</p>
            </div>
          </div>
        )}

        {scenario && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-slate-800/40 p-6 md:p-8 rounded-[3rem] border border-slate-700/50 shadow-2xl">
                <div className="mb-8">
                  <h2 className="text-3xl font-black text-sky-400">{scenario.title}</h2>
                  <p className="text-slate-400 mt-2 italic text-sm p-5 bg-slate-900/50 rounded-2xl border border-slate-700/30 leading-relaxed">{scenario.context}</p>
                </div>

                <VoicePlayer 
                  base64Audio={audioData} 
                  onProgressUpdate={setPlaybackProgress} 
                  isSlowMode={isSlowMode}
                  onRefreshSlowMode={toggleSlowMode}
                />

                <div className="mt-10 space-y-8 max-h-[800px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-700">
                  {scenario.dialogue.map((turn, idx) => (
                    <div key={idx} className={`flex flex-col transition-all duration-500 ${turn.role === 'candidate' ? 'items-end' : 'items-start'} ${activeTurnIndex === idx ? 'scale-[1.03] z-10' : 'opacity-40 grayscale-[20%]'}`}>
                      <div className={`relative max-w-[90%] rounded-[2.5rem] px-8 pt-7 pb-10 shadow-2xl transition-all duration-500 ${
                        turn.role === 'candidate' ? 'bg-sky-600 text-white rounded-tr-none' : 'bg-slate-700/90 text-slate-100 rounded-tl-none'
                      } ${activeTurnIndex === idx ? 'ring-8 ring-sky-400/30 ring-offset-4 ring-offset-slate-900 shadow-sky-500/40' : 'ring-1 ring-slate-600'}`}>
                        
                        <div className="flex items-center justify-between mb-4">
                           <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-80">{turn.speaker} • {turn.role}</p>
                           <button onClick={() => toggleTranslation(idx)} className="text-[9px] font-black uppercase bg-black/30 hover:bg-black/50 px-3 py-1.5 rounded-full transition-all tracking-widest">
                             {visibleTranslations[idx] ? 'Hide Farsi' : 'Translate'}
                           </button>
                        </div>
                        
                        <div className="text-xl leading-relaxed font-semibold">
                          {turn.text.split(' ').map((word, wIdx) => (
                            <span 
                              key={wIdx} 
                              onClick={() => handleWordClick(word, turn.text)}
                              className="inline-block cursor-pointer hover:text-sky-300 transition-colors mr-1.5 hover:bg-white/15 px-0.5 rounded-sm select-none"
                            >
                              {word}
                            </span>
                          ))}
                        </div>

                        {visibleTranslations[idx] && (
                          <div className="mt-6 pt-6 border-t border-white/10 farsi animate-in slide-in-from-top-3">
                            <p className="text-sky-100/95 text-lg leading-loose">{turn.persianText}</p>
                          </div>
                        )}

                        {/* Speech indicator for active turn */}
                        {activeTurnIndex === idx && (
                          <div className="absolute -bottom-1 -right-1 flex gap-1 p-2 bg-sky-500 rounded-full shadow-lg animate-pulse">
                            <div className="w-1 h-3 bg-white animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-1 h-3 bg-white animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-1 h-3 bg-white animate-bounce" style={{animationDelay: '300ms'}}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div className="h-20"></div> {/* Space at the bottom */}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-800/90 p-8 rounded-[3rem] border border-slate-700/50 h-fit sticky top-24 shadow-2xl backdrop-blur-xl">
                <h3 className="text-xl font-black mb-8 flex items-center justify-between text-sky-400">
                  <span className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10a7.969 7.969 0 013.5-.804c1.154 0 2.251.24 3.243.673.1.044.214.044.314 0A10.97 10.97 0 0112.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0012.5 4c-1.255 0-2.443.29-3.5.804z" /></svg>
                    Lexicon
                  </span>
                  {isLookingUp && <div className="w-5 h-5 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>}
                </h3>
                
                <div className="space-y-4 max-h-[750px] overflow-y-auto pr-3 scrollbar-thin scrollbar-thumb-slate-700">
                  {[...customVocab, ...scenario.vocabulary].map((item, idx) => (
                    <div key={idx} className={`p-6 rounded-[2rem] border transition-all duration-500 ${
                      item.isCustom 
                        ? 'bg-sky-500/15 border-sky-500/40 ring-1 ring-sky-500/20 shadow-sky-500/10 shadow-lg' 
                        : 'bg-slate-900/60 border-slate-700/50 hover:border-slate-500/50 hover:bg-slate-900/90'
                    }`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-lg font-black text-sky-400 tracking-tight">{item.word}</span>
                        <span className="text-[9px] bg-slate-800 text-slate-500 px-2 py-1 rounded-lg font-black uppercase tracking-widest">{item.partOfSpeech}</span>
                      </div>
                      <p className="text-sm text-slate-300 mb-4 leading-relaxed">{item.englishMeaning}</p>
                      <div className="pt-4 border-t border-slate-700/40 farsi">
                        <p className="text-sky-200 text-base font-bold">{item.persianMeaning}</p>
                      </div>
                    </div>
                  ))}
                  {customVocab.length === 0 && scenario.vocabulary.length === 0 && (
                    <div className="text-center py-10 opacity-30">
                       <p className="text-sm font-bold uppercase tracking-widest">No definitions yet</p>
                    </div>
                  )}
                </div>
                
                <div className="mt-10 p-4 bg-slate-900/50 rounded-2xl border border-slate-700/50">
                  <p className="text-center text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] leading-relaxed">
                    Tap any word in the conversation to see its meaning here
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
