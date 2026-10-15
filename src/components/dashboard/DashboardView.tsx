import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  PenLine,
  CheckSquare,
  BookOpen,
  Sparkles,
  Plus,
  ArrowUp,
  Mic,
  ChevronDown,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  Lightbulb
} from 'lucide-react';
import { DiaryEntry, Plan, Book, Chat } from '../../types/index.js';
import { formatShortDate } from '../../utils/date.js';

interface DashboardViewProps {
  onNavigate: (view: string, params?: any) => void;
  onOpenCreateDiary: () => void;
  onOpenCreatePlan: () => void;
  onOpenCreateBook: () => void;
}

const MODES = [
  { id: 'default', label: 'Default', desc: 'General conversational assistant' },
  { id: 'diary', label: 'Diary Mode', desc: 'Reflective thoughts & journaling' },
  { id: 'idea', label: 'Ideas Mode', desc: 'Brainstorm & structure concepts' },
  { id: 'plan', label: 'Plan Mode', desc: 'Strategic breakdowns & task lists' },
  { id: 'book', label: 'Book Mode', desc: 'Manuscripts & story crafting' },
] as const;

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenCreateDiary,
  onOpenCreatePlan,
  onOpenCreateBook,
}) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [recentDiaries, setRecentDiaries] = useState<DiaryEntry[]>([]);
  const [activePlans, setActivePlans] = useState<Plan[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  // Input composer state
  const [prompt, setPrompt] = useState('');
  const [selectedMode, setSelectedMode] = useState<'default' | 'diary' | 'idea' | 'plan' | 'book'>('default');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const modeMenuRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const loadData = async () => {
    try {
      const data = await api.dashboard.get();
      setStats(data.stats);
      setRecentDiaries(data.recentDiaries || []);
      setActivePlans(data.activePlans || []);
      setBooks(data.books || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Voice speech-to-text dictation
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setPrompt(prev => (prev ? `${prev.trim()} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  const handleSubmitPrompt = () => {
    if (!prompt.trim()) return;
    onNavigate('chat', {
      initialPrompt: prompt.trim(),
      mode: selectedMode,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitPrompt();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-10 w-64 bg-neutral-100 rounded-lg" />
        <div className="h-28 bg-neutral-100 rounded-2xl sm:rounded-3xl" />
        <div className="space-y-3">
          <div className="h-5 w-36 bg-neutral-100 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-neutral-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'Saad';
  const currentModeObj = MODES.find(m => m.id === selectedMode) || MODES[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. Greeting Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Good morning, {firstName}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Let's make today productive and meaningful.
        </p>
      </div>

      {/* 2. Input Section (Placed before Recent Activity) */}
      <div className="border border-neutral-200/90 hover:border-neutral-300 focus-within:border-neutral-400 focus-within:ring-1 focus-within:ring-neutral-200 rounded-2xl sm:rounded-3xl bg-white p-4 shadow-xs transition-all">
        {/* Text Input Area */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="Ask LifeNote AI, capture a thought, plan, or journal..."
          className="w-full bg-transparent text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none resize-none leading-relaxed block"
        />

        {/* Controls Bar */}
        <div className="flex items-center justify-between pt-2 mt-1">
          {/* Left: Plus Action Button with Popover */}
          <div className="relative" ref={plusMenuRef}>
            <button
              type="button"
              onClick={() => setPlusMenuOpen(v => !v)}
              aria-label="Quick options"
              title="Quick actions & resources"
              className="w-8 h-8 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-black transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>

            {plusMenuOpen && (
              <div className="absolute left-0 bottom-full mb-2 w-52 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5 z-30 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                <button
                  type="button"
                  onClick={() => { setPlusMenuOpen(false); onOpenCreateDiary(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg text-left cursor-pointer transition-colors"
                >
                  <PenLine className="w-3.5 h-3.5 text-neutral-500" />
                  <span>New Diary Entry</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPlusMenuOpen(false); onOpenCreatePlan(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg text-left cursor-pointer transition-colors"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-neutral-500" />
                  <span>New Plan</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPlusMenuOpen(false); onOpenCreateBook(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg text-left cursor-pointer transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Add Book</span>
                </button>
                <div className="border-t border-neutral-100 my-1" />
                <button
                  type="button"
                  onClick={() => { setPlusMenuOpen(false); onNavigate('ideas', { createNew: true }); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg text-left cursor-pointer transition-colors"
                >
                  <Lightbulb className="w-3.5 h-3.5 text-neutral-500" />
                  <span>New Idea</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setPlusMenuOpen(false); onNavigate('skills'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg text-left cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
                  <span>AI Writing Skills</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Mode Selector, Mic Button, Send Arrow Button */}
          <div className="flex items-center gap-2">
            {/* Mode Selector Pill Button */}
            <div className="relative" ref={modeMenuRef}>
              <button
                type="button"
                onClick={() => setModeMenuOpen(v => !v)}
                className="h-8 px-3 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer select-none active:scale-95"
              >
                <span>{currentModeObj.label}</span>
                <ChevronDown className="w-3 h-3 text-neutral-500" />
              </button>

              {modeMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5 z-30 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  {MODES.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setSelectedMode(m.id); setModeMenuOpen(false); }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg text-left cursor-pointer transition-colors ${
                        selectedMode === m.id
                          ? 'bg-neutral-900 text-white'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <div>
                        <div>{m.label}</div>
                        <div className={`text-[10px] ${selectedMode === m.id ? 'text-neutral-300' : 'text-neutral-400'}`}>
                          {m.desc}
                        </div>
                      </div>
                      {selectedMode === m.id && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Microphone Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              aria-label="Voice input"
              title={isListening ? 'Listening... click to stop' : 'Voice input'}
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isListening
                  ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                  : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 hover:bg-neutral-50'
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>

            {/* Submit Arrow Up Button */}
            <button
              type="button"
              onClick={handleSubmitPrompt}
              disabled={!prompt.trim()}
              aria-label="Send"
              title="Send to LifeNote AI"
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                prompt.trim()
                  ? 'bg-neutral-900 border-neutral-900 text-white hover:bg-black shadow-xs'
                  : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600'
              }`}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. Recent Activity (Full Width, Quick Actions Removed) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-neutral-900">Recent Activity</h2>
            <p className="text-xs text-neutral-400">Your latest diary entries, plans, and creative works</p>
          </div>
          <button
            onClick={() => onNavigate('diary')}
            className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View all</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recentDiaries.length === 0 && activePlans.length === 0 && books.length === 0 ? (
          <div className="p-8 border border-neutral-200 rounded-2xl bg-white text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-500">
              <PenLine className="w-5 h-5" />
            </div>
            <p className="text-xs text-neutral-500">No activity recorded yet. Start writing or planning above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {recentDiaries.slice(0, 4).map((d) => (
              <div
                key={d.id || (d as any)._id}
                onClick={() => onNavigate('diary', { selectedId: d.id || (d as any)._id })}
                className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-all cursor-pointer flex items-start justify-between group shadow-xs hover:shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                    <PenLine className="w-4 h-4 text-neutral-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        Diary
                      </span>
                      <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black truncate">
                        {d.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1">
                      {d.content || 'Empty entry'}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-3 mt-0.5">
                  {formatShortDate(d.date)}
                </span>
              </div>
            ))}

            {activePlans.slice(0, 2).map((p) => (
              <div
                key={p.id || (p as any)._id}
                onClick={() => onNavigate('plans')}
                className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-all cursor-pointer flex items-start justify-between group shadow-xs hover:shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckSquare className="w-4 h-4 text-neutral-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        Plan
                      </span>
                      <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black truncate">
                        {p.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {p.tasks?.length || 0} tasks · {p.progress}% completed
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-3 mt-0.5">
                  {p.deadline ? `Due ${p.deadline}` : 'In progress'}
                </span>
              </div>
            ))}

            {books.slice(0, 2).map((b) => (
              <div
                key={b.id || (b as any)._id}
                onClick={() => onNavigate('books', { selectedId: b.id || (b as any)._id })}
                className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-all cursor-pointer flex items-start justify-between group shadow-xs hover:shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0 mt-0.5">
                    <BookOpen className="w-4 h-4 text-neutral-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        Book
                      </span>
                      <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black truncate">
                        {b.title}
                      </h3>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      {b.chapterCount || 0} chapters · {b.genre}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-3 mt-0.5">
                  Manuscript
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
