import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { DiaryEntry } from '../../types/index.js';
import {
  PenLine,
  Search,
  Plus,
  ArrowLeft,
  Sparkles,
  Check,
  X,
  Trash2,
  BookOpen,
  Bold,
  Italic,
  List,
  Quote,
  Link,
  AlignLeft,
  Calendar,
  Smile,
  CloudSun
} from 'lucide-react';

interface DiaryViewProps {
  initialSelectedId?: string;
  initialCreateNew?: boolean;
  onOpenReader?: () => void;
}

const FILTER_TABS = ['All', 'Today', 'This Week', 'This Month'];

export const DiaryView: React.FC<DiaryViewProps> = ({ initialSelectedId, initialCreateNew, onOpenReader }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<DiaryEntry | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Editor Form States (Screen 7 Reference)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('thoughtful');
  const [weather, setWeather] = useState('sunny');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // AI Writing Assistant states (Screen 7 Reference)
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiAction, setAiAction] = useState<'improve' | 'grammar' | 'tone' | 'shorten' | 'expand'>('improve');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await api.diaries.list({
        search: searchQuery || undefined,
      });
      setEntries(res.entries || []);

      if (initialSelectedId) {
        const found = (res.entries || []).find((e: any) => (e.id || e._id) === initialSelectedId);
        if (found) {
          openEditorForEntry(found);
        }
      }
    } catch (err) {
      console.error('Failed to load diaries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [searchQuery]);

  useEffect(() => {
    if (initialCreateNew) {
      openNewEntry();
    }
  }, [initialCreateNew]);

  const openNewEntry = () => {
    setSelectedEntry(null);
    setTitle('');
    setContent('');
    setMood('thoughtful');
    setWeather('sunny');
    setDate(new Date().toISOString().split('T')[0]);
    setIsEditorOpen(true);
    setShowAIAssistant(false);
    setAiResult(null);
  };

  const openEditorForEntry = (entry: DiaryEntry) => {
    setSelectedEntry(entry);
    setTitle(entry.title);
    setContent(entry.content);
    setMood(entry.mood || 'thoughtful');
    setWeather(entry.weather || 'sunny');
    setDate(entry.date || new Date().toISOString().split('T')[0]);
    setIsEditorOpen(true);
    setShowAIAssistant(false);
    setAiResult(null);
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim()) return;

    try {
      if (selectedEntry) {
        const id = selectedEntry.id || (selectedEntry as any)._id;
        const res = await api.diaries.update(id, {
          title: title || 'Untitled Entry',
          content,
          mood,
          weather,
          date,
        });
        setEntries(prev => prev.map(e => ((e.id || (e as any)._id) === id ? res.entry : e)));
        setSelectedEntry(res.entry);
      } else {
        const res = await api.diaries.create({
          title: title || 'Untitled Entry',
          content,
          mood,
          weather,
          date,
        });
        setEntries(prev => [res.entry, ...prev]);
        setSelectedEntry(res.entry);
      }
      setIsEditorOpen(false);
    } catch (err) {
      console.error('Failed to save entry:', err);
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    const confirm = window.confirm('Are you sure you want to delete this diary entry?');
    if (!confirm) return;

    const id = selectedEntry.id || (selectedEntry as any)._id;
    try {
      await api.diaries.delete(id);
      setEntries(prev => prev.filter(e => (e.id || (e as any)._id) !== id));
      setIsEditorOpen(false);
      setSelectedEntry(null);
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Run AI Writing Assistant (Screen 7 Reference)
  const handleRunAI = async (action: 'improve' | 'grammar' | 'tone' | 'shorten' | 'expand') => {
    if (!content.trim()) return;
    setAiAction(action);
    setAiLoading(true);
    setAiResult(null);

    try {
      const res = await api.ai.transformText(content, action);
      setAiResult(res.output);
    } catch (err) {
      console.error('AI assistant failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAI = () => {
    if (aiResult) {
      setContent(aiResult);
      setAiResult(null);
      setShowAIAssistant(false);
    }
  };

  // SCREEN 7: Diary Editor (AI) View
  if (isEditorOpen) {
    return (
      <div className="max-w-4xl space-y-6">
        {/* Editor Top Bar (Screen 7 Reference) */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200">
          <button
            onClick={() => setIsEditorOpen(false)}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-800 hover:text-black cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{selectedEntry ? 'Back to Diary' : 'New Diary Entry'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs ${
                showAIAssistant
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-neutral-900 border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Improve</span>
            </button>

            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              Save
            </button>

            {selectedEntry && (
              <button
                onClick={handleDelete}
                className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Main Editor Surface */}
        <div className="border border-neutral-200 rounded-2xl bg-white p-6 sm:p-8 space-y-4 shadow-xs">
          {/* Title Input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My thoughts today..."
            className="w-full text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 border-0 focus:outline-none"
          />

          {/* Editor Formatting Toolbar (Screen 7 Reference) */}
          <div className="flex items-center gap-1 py-1.5 px-2 bg-neutral-50 rounded-lg border border-neutral-100 text-neutral-500">
            <button type="button" className="p-1 hover:text-black cursor-pointer"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-black cursor-pointer"><Italic className="w-3.5 h-3.5" /></button>
            <span className="w-px h-3.5 bg-neutral-200 mx-1" />
            <button type="button" className="p-1 hover:text-black cursor-pointer"><List className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-black cursor-pointer"><Quote className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-black cursor-pointer"><Link className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1 hover:text-black cursor-pointer"><AlignLeft className="w-3.5 h-3.5" /></button>
            <span className="w-px h-3.5 bg-neutral-200 mx-1" />
            <div className="flex items-center gap-2 ml-auto text-[11px] font-mono text-neutral-400">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent border-0 focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Body TextArea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Today was a productive day. I finished my React project and learned something new. Feeling good about the progress..."
            rows={14}
            className="w-full text-sm text-neutral-800 placeholder:text-neutral-300 leading-relaxed border-0 focus:outline-none resize-none"
          />
        </div>

        {/* AI Writing Assistant Card (Screen 7 Reference) */}
        {showAIAssistant && (
          <div className="border border-neutral-300 rounded-2xl bg-white p-5 shadow-lg space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-900">
                <Sparkles className="w-4 h-4 text-neutral-900" />
                <span>AI Writing Assistant</span>
              </div>
              <button
                onClick={() => setShowAIAssistant(false)}
                className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons Row (Screen 7 Reference) */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'improve', label: 'Improve writing' },
                { id: 'grammar', label: 'Fix grammar' },
                { id: 'tone', label: 'Change tone' },
                { id: 'shorten', label: 'Make shorter' },
                { id: 'expand', label: 'Make longer' },
              ].map(act => (
                <button
                  key={act.id}
                  onClick={() => handleRunAI(act.id as any)}
                  disabled={aiLoading}
                  className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors cursor-pointer ${
                    aiAction === act.id && aiResult
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                  }`}
                >
                  {act.label}
                </button>
              ))}
            </div>

            {aiLoading && (
              <p className="text-xs text-neutral-500 font-mono animate-pulse py-2">
                LifeNote AI is refining your prose...
              </p>
            )}

            {aiResult && (
              <div className="space-y-3 pt-2">
                <div className="p-3.5 bg-neutral-50 rounded-xl text-xs text-neutral-800 leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap border border-neutral-200">
                  {aiResult}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setAiResult(null)}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleApplyAI}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-xs"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // SCREEN 6: Diary (List) View
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Search & + New Entry bar (Screen 6 Reference) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search diary entries..."
            className="w-full pl-9 pr-4 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 bg-white"
          />
        </div>

        <button
          onClick={openNewEntry}
          className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Title & Filter Tabs (Screen 6 Reference) */}
      <div className="space-y-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Diary
        </h1>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5">
          {FILTER_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-black text-white'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Diary Card Rows (Screen 6 Reference) */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-200 rounded-2xl bg-white space-y-2">
          <PenLine className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-neutral-900">No diary entries found</p>
          <p className="text-xs text-neutral-500">Capture your first reflection to start your journal.</p>
          <button
            onClick={openNewEntry}
            className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-white bg-black rounded-lg"
          >
            Create Entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <div
              key={entry.id || (entry as any)._id}
              onClick={() => openEditorForEntry(entry)}
              className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
                  <PenLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black">
                    {entry.title}
                  </h3>
                  <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5 max-w-xl">
                    {entry.content}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-4">
                {entry.date}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
