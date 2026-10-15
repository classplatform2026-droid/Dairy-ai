import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { DiaryEntry } from '../../types/index.js';
import {
  getTodayDateString,
  formatHumanDate,
  formatShortDate,
  stepDateString,
  normalizeDate,
  isToday,
  compareDateDesc,
} from '../../utils/date.js';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Plus,
  Save,
  Check,
  Trash2,
  Search,
  BookOpen,
  Copy,
  PenLine,
  Sun,
  CloudRain,
  Cloud,
  Moon,
  Sparkles,
  Edit3,
  X,
  Wand2,
  RefreshCw,
  Clock,
  ArrowRight
} from 'lucide-react';

interface DiaryViewProps {
  initialSelectedId?: string;
  initialSelectedDate?: string;
  initialCreateNew?: boolean;
  onOpenReader?: () => void;
}

const MOODS = [
  { id: 'thoughtful', label: 'Thoughtful', emoji: '🤔' },
  { id: 'peaceful', label: 'Peaceful', emoji: '🌿' },
  { id: 'happy', label: 'Happy', emoji: '✨' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡' },
  { id: 'reflective', label: 'Reflective', emoji: '🌙' },
];

const WEATHERS = [
  { id: 'sunny', label: 'Sunny', icon: Sun },
  { id: 'rainy', label: 'Rainy', icon: CloudRain },
  { id: 'cloudy', label: 'Cloudy', icon: Cloud },
  { id: 'night', label: 'Quiet Night', icon: Moon },
];

export const DiaryView: React.FC<DiaryViewProps> = ({
  initialSelectedId,
  initialSelectedDate,
  initialCreateNew,
  onOpenReader,
}) => {
  const todayStr = getTodayDateString();

  // List of all entries
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Active view: 'list' or 'detail'
  const [activeView, setActiveView] = useState<'list' | 'detail'>('list');

  // Edit Mode state: ONLY true when user explicitly clicks "Edit" or "Write Today" (new entry)
  const [isEditing, setIsEditing] = useState(false);

  // Currently opened entry details
  const [selectedDate, setSelectedDate] = useState<string>(
    initialSelectedDate ? normalizeDate(initialSelectedDate) : todayStr
  );
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('thoughtful');
  const [weather, setWeather] = useState('sunny');

  // Baseline content snapshot to support "Cancel edit"
  const [initialSnapshot, setInitialSnapshot] = useState<{ title: string; content: string; mood: string; weather: string }>({
    title: '',
    content: '',
    mood: 'thoughtful',
    weather: 'sunny',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>('idle');
  const [copied, setCopied] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // Delete Confirmation Modal State
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; date: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AI Edit Modal / Drawer State
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiCustomInstruction, setAiCustomInstruction] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Synthesis state: "Protibar notun leka dairy te add korle nise ekta btn show hobe"
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesizeResult, setSynthesizeResult] = useState<{
    unifiedContent: string;
    title: string;
    mood: string;
  } | null>(null);
  const [isApplyingSynthesis, setIsApplyingSynthesis] = useState(false);
  const [synthesizeSuccess, setSynthesizeSuccess] = useState(false);
  const [synthesizeError, setSynthesizeError] = useState<string | null>(null);

  // Fetch all entries (deduplicated by calendar date)
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await api.diaries.list();
      const rawList = res.entries || [];

      const dateMap = new Map<string, DiaryEntry>();
      for (const item of rawList) {
        const cleanDate = normalizeDate(item.date);
        const existing = dateMap.get(cleanDate);
        if (!existing) {
          dateMap.set(cleanDate, { ...item, date: cleanDate });
        } else {
          if ((item.content || '').length >= (existing.content || '').length) {
            dateMap.set(cleanDate, { ...item, date: cleanDate });
          }
        }
      }

      const sorted = Array.from(dateMap.values()).sort((a, b) => compareDateDesc(a.date, b.date));
      setEntries(sorted);
      return sorted;
    } catch (err) {
      console.error('Failed to fetch diary entries:', err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries().then((items) => {
      if (initialSelectedId) {
        const found = items.find((e: any) => (e.id || e._id) === initialSelectedId);
        if (found) {
          openFullEntry(found, false);
          return;
        }
      }
      if (initialSelectedDate) {
        openDateEntry(normalizeDate(initialSelectedDate), false);
        return;
      }
      if (initialCreateNew) {
        openDateEntry(todayStr, true);
      }
    });
  }, [initialSelectedId, initialSelectedDate, initialCreateNew]);

  // Open existing entry in Full View
  const openFullEntry = (entry: DiaryEntry, startEditing = false) => {
    const cleanDate = normalizeDate(entry.date || todayStr);
    const entryTitle = entry.title || `Journal: ${cleanDate}`;
    const entryContent = entry.content || '';
    const entryMood = entry.mood || 'thoughtful';
    const entryWeather = entry.weather || 'sunny';

    setCurrentEntryId(entry.id || (entry as any)._id);
    setSelectedDate(cleanDate);
    setTitle(entryTitle);
    setContent(entryContent);
    setMood(entryMood);
    setWeather(entryWeather);
    setInitialSnapshot({
      title: entryTitle,
      content: entryContent,
      mood: entryMood,
      weather: entryWeather,
    });
    setIsEditing(startEditing);
    setActiveView('detail');
    setSaveStatus('idle');
    setShowAiModal(false);
    setAiPreview(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open entry for a specific date (create or load)
  const openDateEntry = async (dateStr: string, startEditing = false) => {
    const cleanDate = normalizeDate(dateStr);
    setPageLoading(true);
    setSelectedDate(cleanDate);
    setActiveView('detail');
    setSaveStatus('idle');
    setShowAiModal(false);
    setAiPreview(null);

    try {
      const res = await api.diaries.getByDate(cleanDate);
      if (res.entry) {
        const entryTitle = res.entry.title || `Journal: ${cleanDate}`;
        const entryContent = res.entry.content || '';
        const entryMood = res.entry.mood || 'thoughtful';
        const entryWeather = res.entry.weather || 'sunny';

        setCurrentEntryId(res.entry.id || (res.entry as any)._id);
        setTitle(entryTitle);
        setContent(entryContent);
        setMood(entryMood);
        setWeather(entryWeather);
        setInitialSnapshot({
          title: entryTitle,
          content: entryContent,
          mood: entryMood,
          weather: entryWeather,
        });
        setIsEditing(startEditing);
      } else {
        // Brand new page for this date
        const entryTitle = `Journal: ${cleanDate}`;
        setCurrentEntryId(null);
        setTitle(entryTitle);
        setContent('');
        setMood('thoughtful');
        setWeather('sunny');
        setInitialSnapshot({
          title: entryTitle,
          content: '',
          mood: 'thoughtful',
          weather: 'sunny',
        });
        // If creating a new page without content, automatically enter edit mode so user can write
        setIsEditing(true);
      }
    } catch (err) {
      console.error('Failed to load entry for date:', err);
    } finally {
      setPageLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Cancel edits and revert to read mode
  const handleCancelEdit = () => {
    setTitle(initialSnapshot.title);
    setContent(initialSnapshot.content);
    setMood(initialSnapshot.mood);
    setWeather(initialSnapshot.weather);
    setIsEditing(false);
    setShowAiModal(false);
    setAiPreview(null);
  };

  // Save changes to current entry
  const handleSaveCurrentEntry = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      const payload = {
        title: title.trim() || `Journal: ${selectedDate}`,
        content,
        mood,
        weather,
        date: selectedDate,
      };

      let saved: any;
      if (currentEntryId) {
        const res = await api.diaries.update(currentEntryId, payload);
        saved = res.entry;
      } else {
        const res = await api.diaries.create(payload);
        saved = res.entry;
        setCurrentEntryId(saved.id || saved._id);
      }

      setInitialSnapshot({
        title: payload.title,
        content: payload.content,
        mood: payload.mood,
        weather: payload.weather,
      });

      setSaveStatus('saved');
      setIsEditing(false); // Return to clean minimalist read view
      fetchEntries();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to save entry:', err);
      setSaveStatus('idle');
    } finally {
      setIsSaving(false);
    }
  };

  // Perform AI Edit transformation
  const handleRunAiEdit = async (action: string, customPrompt?: string) => {
    const textToProcess = content.trim();
    if (!textToProcess) {
      setAiError('Please write some thoughts first before using AI edit.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiPreview(null);

    try {
      const res = await api.ai.transformText(
        textToProcess,
        action,
        undefined,
        customPrompt || undefined
      );

      if (res && res.output) {
        setAiPreview(res.output);
      } else {
        setAiError('AI could not refine this text. Please try again.');
      }
    } catch (err: any) {
      console.error('AI Edit error:', err);
      setAiError(err.message || 'AI refinement is temporarily unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  // Apply AI refined text to editor
  const handleApplyAiEdit = () => {
    if (aiPreview) {
      setContent(aiPreview);
      setShowAiModal(false);
      setAiPreview(null);
    }
  };

  // Start AI Synthesis: reads whole page and weaves into one cohesive reflection with tuned mood
  const handleStartSynthesize = async () => {
    if (!content.trim()) return;
    setIsSynthesizing(true);
    setSynthesizeError(null);

    try {
      const res = await api.diaries.synthesizePage({
        content,
        title,
        date: selectedDate,
        id: currentEntryId || undefined,
      });

      if (res && res.unifiedContent) {
        setSynthesizeResult({
          unifiedContent: res.unifiedContent,
          title: res.title || title,
          mood: res.mood || mood,
        });
      } else {
        setSynthesizeError('Could not synthesize page. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to synthesize diary page:', err);
      setSynthesizeError(err.message || 'Failed to synthesize page.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Apply synthesized entry and mood
  const handleApplySynthesis = async () => {
    if (!synthesizeResult) return;
    setIsApplyingSynthesis(true);

    try {
      const newContent = synthesizeResult.unifiedContent;
      const newTitle = synthesizeResult.title;
      const newMood = synthesizeResult.mood;

      setContent(newContent);
      setTitle(newTitle);
      setMood(newMood);

      const payload = {
        title: newTitle,
        content: newContent,
        mood: newMood,
        weather,
        date: selectedDate,
      };

      if (currentEntryId) {
        await api.diaries.update(currentEntryId, payload);
      } else {
        const res = await api.diaries.create(payload);
        setCurrentEntryId(res.entry.id || (res.entry as any)._id);
      }

      setInitialSnapshot({
        title: newTitle,
        content: newContent,
        mood: newMood,
        weather,
      });

      setSynthesizeSuccess(true);
      setSynthesizeResult(null);
      fetchEntries();
      setTimeout(() => setSynthesizeSuccess(false), 3500);
    } catch (err: any) {
      console.error('Failed to apply synthesis:', err);
    } finally {
      setIsApplyingSynthesis(false);
    }
  };

  // Request Delete Confirmation Modal
  const requestDeleteConfirm = (entry: { id: string; date: string; title?: string }, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setEntryToDelete({
      id: entry.id,
      date: entry.date,
      title: entry.title || `Journal: ${entry.date}`,
    });
  };

  // Perform Confirmed Deletion
  const handlePerformDelete = async () => {
    if (!entryToDelete) return;

    setIsDeleting(true);
    try {
      await api.diaries.delete(entryToDelete.id);
      setEntries(prev => prev.filter(e => (e.id || (e as any)._id) !== entryToDelete.id));

      if (activeView === 'detail' && currentEntryId === entryToDelete.id) {
        setActiveView('list');
        setCurrentEntryId(null);
        setContent('');
        setIsEditing(false);
      }
      setEntryToDelete(null);
    } catch (err) {
      console.error('Failed to delete diary entry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Step to previous or next date
  const handleStepDate = (offsetDays: number) => {
    const newDateStr = stepDateString(selectedDate, offsetDays);
    openDateEntry(newDateStr, false);
  };

  const handleCopyText = () => {
    if (!content) return;
    navigator.clipboard.writeText(`${title}\n${formatHumanDate(selectedDate)}\n\n${content}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter entries in list view
  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.date.toLowerCase().includes(q) ||
      (entry.title && entry.title.toLowerCase().includes(q)) ||
      (entry.content && entry.content.toLowerCase().includes(q))
    );
  });

  const wordCount = content.trim() ? content.trim().split(/\s+/).filter(Boolean).length : 0;
  const currentMoodObj = MOODS.find(m => m.id === mood);
  const currentWeatherObj = WEATHERS.find(w => w.id === weather);
  const WeatherIcon = currentWeatherObj?.icon || Sun;

  // Render Delete Confirmation Modal
  const renderDeleteModal = () => {
    if (!entryToDelete) return null;

    return (
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={() => !isDeleting && setEntryToDelete(null)}
      >
        <div
          className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-neutral-200 animate-in zoom-in-95 duration-150 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <button
              onClick={() => !isDeleting && setEntryToDelete(null)}
              className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-semibold text-neutral-900">Delete this entry?</h3>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Are you sure you want to delete the journal entry for{' '}
              <span className="font-semibold text-neutral-800">{entryToDelete.title}</span>? This action cannot be undone.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => setEntryToDelete(null)}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isDeleting}
              onClick={handlePerformDelete}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render "Edit by AI" Assistant Modal
  const renderAiModal = () => {
    if (!showAiModal) return null;

    return (
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={() => !aiLoading && setShowAiModal(false)}
      >
        <div
          className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150 space-y-5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">Edit by AI</h3>
                <p className="text-xs text-neutral-500">Refine, beautify, or rewrite your journal entry</p>
              </div>
            </div>
            <button
              onClick={() => !aiLoading && setShowAiModal(false)}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Smart Actions */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Quick Enhancements
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={aiLoading}
                onClick={() => handleRunAiEdit('beautify')}
                className="p-3 text-left border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 group-hover:text-black">
                  <span>✨</span>
                  <span>Refine & Beautify</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  Lyrical polish, emotional resonance, and elegant flow.
                </p>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => handleRunAiEdit('grammar')}
                className="p-3 text-left border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 group-hover:text-black">
                  <span>📝</span>
                  <span>Fix Grammar & Flow</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  Correct spelling, punctuation, and sentence clarity.
                </p>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => handleRunAiEdit('expand')}
                className="p-3 text-left border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 group-hover:text-black">
                  <span>🌿</span>
                  <span>Deepen Reflections</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  Explore underlying feelings and contemplative insights.
                </p>
              </button>

              <button
                type="button"
                disabled={aiLoading}
                onClick={() => handleRunAiEdit('shorten')}
                className="p-3 text-left border border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 rounded-xl transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-neutral-900 group-hover:text-black">
                  <span>✂️</span>
                  <span>Make Concise</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  Distill to its essential core thoughts without fluff.
                </p>
              </button>
            </div>
          </div>

          {/* Custom Instruction Prompt */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
              Or Custom Instruction
            </span>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiCustomInstruction}
                onChange={(e) => setAiCustomInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiCustomInstruction.trim() && !aiLoading) {
                    handleRunAiEdit('custom', aiCustomInstruction);
                  }
                }}
                placeholder="e.g., বাংলায় রূপান্তর করো, add 3 bullet reflections, make it poetic..."
                className="flex-1 text-xs border border-neutral-200 rounded-xl px-3.5 py-2.5 bg-neutral-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              <button
                type="button"
                disabled={aiLoading || !aiCustomInstruction.trim()}
                onClick={() => handleRunAiEdit('custom', aiCustomInstruction)}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {aiLoading ? 'Thinking...' : 'Apply AI'}
              </button>
            </div>
          </div>

          {/* Error message */}
          {aiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              {aiError}
            </div>
          )}

          {/* Loading state */}
          {aiLoading && (
            <div className="p-6 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col items-center justify-center space-y-2.5 animate-pulse">
              <div className="w-5 h-5 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-neutral-600 font-medium">Refining your journal entry with AI...</p>
            </div>
          )}

          {/* AI Output Preview */}
          {aiPreview && !aiLoading && (
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900">AI Preview</span>
                <span className="text-[11px] text-neutral-400 font-mono">
                  {aiPreview.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 max-h-56 overflow-y-auto text-xs sm:text-sm text-neutral-800 leading-relaxed font-sans whitespace-pre-wrap">
                {aiPreview}
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAiPreview(null)}
                  className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleApplyAiEdit}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Replace in Journal</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render "Synthesize Daily Page" Modal
  const renderSynthesizeModal = () => {
    if (!synthesizeResult) return null;

    const chosenMoodObj = MOODS.find(m => m.id === synthesizeResult.mood);

    return (
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={() => !isApplyingSynthesis && setSynthesizeResult(null)}
      >
        <div
          className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150 space-y-5 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-neutral-900">
                  Synthesized Daily Reflection
                </h3>
                <p className="text-xs text-neutral-500">
                  All thoughts woven into one harmonious piece
                </p>
              </div>
            </div>
            <button
              onClick={() => !isApplyingSynthesis && setSynthesizeResult(null)}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Detected Mood based on writing */}
            <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400 font-semibold">
                  Detected Mood (Based on your writing)
                </span>
                <span className="text-[11px] text-neutral-400">
                  Auto-tuned by AI
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-900 shadow-2xs">
                  <span>{chosenMoodObj?.emoji || '🌿'}</span>
                  <span className="capitalize">{chosenMoodObj?.label || synthesizeResult.mood}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-neutral-400">Switch mood:</span>
                  <select
                    value={synthesizeResult.mood}
                    onChange={(e) => setSynthesizeResult({ ...synthesizeResult, mood: e.target.value })}
                    className="text-xs bg-white border border-neutral-200 rounded-lg px-2 py-0.5 text-neutral-800 cursor-pointer focus:outline-none"
                  >
                    {MOODS.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.emoji} {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Suggested Title */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-neutral-400 mb-1">
                Suggested Title
              </label>
              <input
                type="text"
                value={synthesizeResult.title}
                onChange={(e) => setSynthesizeResult({ ...synthesizeResult, title: e.target.value })}
                className="w-full text-xs font-semibold text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:bg-white"
                placeholder="Title for this unified reflection..."
              />
            </div>

            {/* Synthesized Content */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                  Unified Continuous Reflection
                </label>
                <span className="text-[11px] font-mono text-neutral-400">
                  {synthesizeResult.unifiedContent.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/80 max-h-64 overflow-y-auto text-xs sm:text-sm text-neutral-800 font-serif leading-relaxed sm:leading-loose whitespace-pre-wrap select-text">
                {synthesizeResult.unifiedContent}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
            <button
              type="button"
              disabled={isApplyingSynthesis}
              onClick={() => setSynthesizeResult(null)}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={isApplyingSynthesis}
              onClick={handleApplySynthesis}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              {isApplyingSynthesis ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Apply to Entry</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW: FULL DAILY SHEET (Clean & Minimal)
  // ==========================================
  if (activeView === 'detail') {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
          {/* Back Button */}
          <button
            onClick={() => {
              setActiveView('list');
              setIsEditing(false);
              fetchEntries();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-black cursor-pointer transition-colors group self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-neutral-400 group-hover:text-black group-hover:-translate-x-0.5 transition-transform" />
            <span>All Entries</span>
          </button>

          {/* Date Navigator */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center bg-white border border-neutral-200/80 rounded-xl p-0.5 shadow-2xs">
              <button
                onClick={() => handleStepDate(-1)}
                className="p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openDateEntry(todayStr, false)}
                className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  isToday(selectedDate)
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => handleStepDate(1)}
                className="p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                title="Next day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && openDateEntry(normalizeDate(e.target.value), false)}
              className="text-xs font-mono font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200/80 rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Action Buttons: Minimal and Context-Aware */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {!isEditing ? (
              /* Reading Mode Action Buttons */
              <>
                <button
                  onClick={handleCopyText}
                  className="p-2 text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200/80 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
                  title="Copy text"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>

                {currentEntryId && (
                  <button
                    type="button"
                    onClick={() =>
                      requestDeleteConfirm({
                        id: currentEntryId,
                        date: selectedDate,
                        title: title || formatHumanDate(selectedDate),
                      })
                    }
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 bg-white border border-neutral-200/80 rounded-xl transition-all cursor-pointer"
                    title="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Primary Edit Button: Prominent & Clean */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </>
            ) : (
              /* Edit Mode Action Buttons: "Edit by AI" and "Save" */
              <>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {/* "Edit by AI" Button opens alongside Save */}
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 rounded-xl shadow-2xs transition-all cursor-pointer active:scale-95"
                  title="Polish or rewrite this entry with AI"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                  <span>Edit by AI</span>
                </button>

                {/* Save Button */}
                <button
                  onClick={handleSaveCurrentEntry}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {saveStatus === 'saved' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Saved</span>
                    </>
                  ) : saveStatus === 'saving' ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* The Minimal Journal Sheet */}
        <div className="bg-white border border-neutral-200/80 rounded-3xl p-6 sm:p-10 shadow-xs space-y-6">
          {/* Subtle Date & Vibe Header */}
          <div className="flex items-center justify-between text-xs text-neutral-400 pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="font-mono uppercase tracking-wider text-[11px] font-medium text-neutral-500">
                {formatHumanDate(selectedDate)}
              </span>
              <span>·</span>
              <span className="text-[11px] font-mono">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>

            {/* Subtle Mood & Weather Icon Display / Selector */}
            {!isEditing ? (
              <div className="flex items-center gap-2 text-neutral-500 text-xs">
                {currentMoodObj && (
                  <span className="flex items-center gap-1">
                    <span>{currentMoodObj.emoji}</span>
                    <span className="capitalize">{currentMoodObj.label}</span>
                  </span>
                )}
                <span>·</span>
                <span className="flex items-center gap-1">
                  <WeatherIcon className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="capitalize">{currentWeatherObj?.label || 'Sunny'}</span>
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-0.5 text-neutral-700 cursor-pointer focus:outline-none"
                >
                  {MOODS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.emoji} {m.label}
                    </option>
                  ))}
                </select>

                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-0.5 text-neutral-700 cursor-pointer focus:outline-none"
                >
                  {WEATHERS.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Title Area */}
          <div>
            {!isEditing ? (
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-neutral-900 leading-tight">
                {title || `Journal: ${formatHumanDate(selectedDate)}`}
              </h1>
            ) : (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Journal: ${formatHumanDate(selectedDate)}`}
                className="w-full text-2xl sm:text-3xl font-serif font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 border-0 focus:outline-none bg-transparent"
                autoFocus
              />
            )}
          </div>

          {/* Main Content Area */}
          {pageLoading ? (
            <div className="space-y-3 py-10 animate-pulse">
              <div className="h-4 bg-neutral-100 rounded w-5/6" />
              <div className="h-4 bg-neutral-100 rounded w-full" />
              <div className="h-4 bg-neutral-100 rounded w-4/6" />
              <div className="h-4 bg-neutral-100 rounded w-3/4" />
            </div>
          ) : !isEditing ? (
            /* Minimal Tranquil Reading View */
            <div className="min-h-[300px]">
              {content.trim() ? (
                <div className="text-base sm:text-lg text-neutral-800 font-serif leading-relaxed sm:leading-loose whitespace-pre-wrap select-text">
                  {content}
                </div>
              ) : (
                <div className="py-16 text-center border border-dashed border-neutral-200 rounded-2xl p-6 space-y-3">
                  <p className="text-sm text-neutral-400 font-serif italic">
                    No reflections written yet for this day.
                  </p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Start Writing</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Focused Writing Editor */
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your reflections for ${formatHumanDate(selectedDate)}...\n\nCapture your moments, thoughts, emotions, and lessons.`}
              rows={16}
              className="w-full text-base sm:text-lg text-neutral-800 placeholder:text-neutral-300 font-serif leading-relaxed sm:leading-loose border-0 focus:outline-none resize-none bg-transparent"
            />
          )}

          {/* Minimal Sheet Footer */}
          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
            <span className="font-mono text-[11px]">
              {isEditing ? 'Drafting page' : 'Daily sheet'} · {selectedDate}
            </span>
            {isEditing && (
              <span className="text-[11px] text-neutral-500">
                Click <span className="font-semibold text-neutral-700">Save</span> to apply your changes
              </span>
            )}
          </div>
        </div>

        {/* Synthesis Success Toast */}
        {synthesizeSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in duration-200 shadow-2xs">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              ✨ All thoughts unified into one cohesive reflection, and mood successfully updated!
            </span>
          </div>
        )}

        {/* Synthesis Error Notice */}
        {synthesizeError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
            {synthesizeError}
          </div>
        )}

        {/* Bottom Prominent Synthesize Button: "Protibar notun leka dairy te add korle nise ekta btn show hobe" */}
        {content.trim().length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-neutral-50/90 border border-neutral-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-4 h-4 text-amber-300" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-900">
                    Unify & Synthesize Page with AI
                  </h4>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-medium">
                    One Story
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Reads today's entire page, weaves all notes into one continuous piece, and sets the mood based on your writing.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartSynthesize}
              disabled={isSynthesizing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 shrink-0 disabled:opacity-50"
            >
              {isSynthesizing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Reading & Synthesizing...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                  <span>Synthesize Page</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {renderDeleteModal()}

        {/* AI Edit Assistant Modal */}
        {renderAiModal()}

        {/* AI Page Synthesis Modal */}
        {renderSynthesizeModal()}
      </div>
    );
  }

  // ==========================================
  // VIEW: DIARY ENTRIES LIST (Clean & Minimal)
  // ==========================================
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 font-sans">
            Diary
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Your personal thoughts and daily reflections, organized by date.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {onOpenReader && (
            <button
              onClick={onOpenReader}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200/80 hover:border-neutral-300 rounded-xl shadow-2xs transition-all cursor-pointer"
              title="Continuous Reader Mode"
            >
              <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
              <span>Reader Mode</span>
            </button>
          )}

          <button
            onClick={() => openDateEntry(todayStr, true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Write Today</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search entries by date, title, or keywords..."
          className="w-full pl-10 pr-4 py-2 text-xs border border-neutral-200/80 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 shadow-2xs"
        />
      </div>

      {/* Diary Entries List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-200 rounded-3xl bg-white space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
            <PenLine className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">
            {searchQuery ? 'No matching diary entries' : 'No diary entries yet'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with a different date or keyword.'
              : 'Every day is a new page. Start capturing your thoughts.'}
          </p>
          <button
            onClick={() => openDateEntry(todayStr, true)}
            className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-xl shadow-xs hover:bg-black transition-colors cursor-pointer"
          >
            Write Today's Page
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            const entryId = entry.id || (entry as any)._id;
            const words = (entry.content || '').split(/\s+/).filter(Boolean).length;
            const moodObj = MOODS.find(m => m.id === entry.mood);

            return (
              <div
                key={entryId}
                onClick={() => openFullEntry(entry, false)}
                className="group p-5 border border-neutral-200/80 hover:border-neutral-300 rounded-2xl bg-white hover:bg-neutral-50/50 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-900">
                      {formatShortDate(entry.date)}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {formatHumanDate(entry.date)}
                    </span>
                    {moodObj && (
                      <span className="text-[11px] text-neutral-500 flex items-center gap-1">
                        <span>{moodObj.emoji}</span>
                        <span className="capitalize">{moodObj.label}</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-neutral-900 group-hover:text-black transition-colors font-sans">
                    {entry.title || `Journal: ${entry.date}`}
                  </h3>

                  <p className="text-xs sm:text-sm text-neutral-600 line-clamp-2 leading-relaxed font-serif">
                    {entry.content || 'Empty entry'}
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[11px] text-neutral-400 font-mono">
                    <span>{words} {words === 1 ? 'word' : 'words'}</span>
                    <span>·</span>
                    <span className="text-neutral-700 group-hover:text-neutral-900 font-medium flex items-center gap-1">
                      Read page <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 self-center">
                  <button
                    type="button"
                    onClick={(e) =>
                      requestDeleteConfirm(
                        {
                          id: entryId,
                          date: entry.date,
                          title: entry.title || formatHumanDate(entry.date),
                        },
                        e
                      )
                    }
                    className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                    title="Delete entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {renderDeleteModal()}
    </div>
  );
};
