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
  ArrowRight,
  AlertTriangle,
  X
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

  // Currently opened entry details
  const [selectedDate, setSelectedDate] = useState<string>(
    initialSelectedDate ? normalizeDate(initialSelectedDate) : todayStr
  );
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('thoughtful');
  const [weather, setWeather] = useState('sunny');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>('idle');
  const [copied, setCopied] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // Delete Confirmation Modal State
  const [entryToDelete, setEntryToDelete] = useState<{ id: string; date: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all entries (deduplicated by date to strictly guarantee 1 page per day)
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await api.diaries.list();
      const rawList = res.entries || [];

      // Deduplicate so each calendar date strictly has one page
      const dateMap = new Map<string, DiaryEntry>();
      for (const item of rawList) {
        const cleanDate = normalizeDate(item.date);
        const existing = dateMap.get(cleanDate);
        if (!existing) {
          dateMap.set(cleanDate, { ...item, date: cleanDate });
        } else {
          // If a duplicate exists, preserve the one with more content or more recent data
          if ((item.content || '').length >= (existing.content || '').length) {
            dateMap.set(cleanDate, { ...item, date: cleanDate });
          }
        }
      }

      // Sort chronologically descending (newest date first)
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
          openFullEntry(found);
          return;
        }
      }
      if (initialSelectedDate) {
        openDateEntry(normalizeDate(initialSelectedDate));
        return;
      }
      if (initialCreateNew) {
        openDateEntry(todayStr);
      }
    });
  }, [initialSelectedId, initialSelectedDate, initialCreateNew]);

  // Open existing entry in Full View
  const openFullEntry = (entry: DiaryEntry) => {
    const cleanDate = normalizeDate(entry.date || todayStr);
    setCurrentEntryId(entry.id || (entry as any)._id);
    setSelectedDate(cleanDate);
    setTitle(entry.title || `Journal: ${cleanDate}`);
    setContent(entry.content || '');
    setMood(entry.mood || 'thoughtful');
    setWeather(entry.weather || 'sunny');
    setActiveView('detail');
    setSaveStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Open entry for a specific date (create or load)
  const openDateEntry = async (dateStr: string) => {
    const cleanDate = normalizeDate(dateStr);
    setPageLoading(true);
    setSelectedDate(cleanDate);
    setActiveView('detail');
    setSaveStatus('idle');

    try {
      const res = await api.diaries.getByDate(cleanDate);
      if (res.entry) {
        setCurrentEntryId(res.entry.id || (res.entry as any)._id);
        setTitle(res.entry.title || `Journal: ${cleanDate}`);
        setContent(res.entry.content || '');
        setMood(res.entry.mood || 'thoughtful');
        setWeather(res.entry.weather || 'sunny');
      } else {
        setCurrentEntryId(null);
        setTitle(`Journal: ${cleanDate}`);
        setContent('');
        setMood('thoughtful');
        setWeather('sunny');
      }
    } catch (err) {
      console.error('Failed to load entry for date:', err);
    } finally {
      setPageLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

      setSaveStatus('saved');
      fetchEntries();
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      console.error('Failed to save entry:', err);
      setSaveStatus('idle');
    } finally {
      setIsSaving(false);
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
      }
      setEntryToDelete(null);
    } catch (err) {
      console.error('Failed to delete diary entry:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Step to previous or next date in full view
  const handleStepDate = (offsetDays: number) => {
    const newDateStr = stepDateString(selectedDate, offsetDays);
    openDateEntry(newDateStr);
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

  // Render Delete Confirmation Modal
  const renderDeleteModal = () => {
    if (!entryToDelete) return null;

    return (
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        onClick={() => !isDeleting && setEntryToDelete(null)}
      >
        <div
          className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-neutral-200 animate-in zoom-in-95 duration-150 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Warning Icon & Close */}
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <button
              type="button"
              onClick={() => !isDeleting && setEntryToDelete(null)}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt */}
          <div>
            <h3 className="text-base font-bold text-neutral-900">
              Delete Diary Entry?
            </h3>
            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
              Are you sure you want to permanently delete the diary entry for{' '}
              <span className="font-semibold text-neutral-800">
                {formatHumanDate(entryToDelete.date)}
              </span>
              ? This action cannot be undone.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setEntryToDelete(null)}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePerformDelete}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50 active:scale-95"
            >
              {isDeleting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Delete</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // VIEW 1: FULL ENTRY VIEW (Read & Edit Page)
  // ==========================================
  if (activeView === 'detail') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-200">
          {/* Back Button */}
          <button
            onClick={() => {
              setActiveView('list');
              fetchEntries();
            }}
            className="flex items-center gap-2 text-xs font-semibold text-neutral-700 hover:text-black cursor-pointer transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 text-neutral-400 group-hover:text-black group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to All Entries</span>
          </button>

          {/* Date Selector & Navigator */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white border border-neutral-200 rounded-xl p-1 shadow-2xs">
              <button
                onClick={() => handleStepDate(-1)}
                className="p-1.5 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                title="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => openDateEntry(todayStr)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Date Input */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && openDateEntry(normalizeDate(e.target.value))}
              className="text-xs font-mono font-medium text-neutral-800 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Actions: Copy, Delete, Save */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="p-2 text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer"
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
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 bg-white border border-neutral-200 rounded-xl transition-all cursor-pointer"
                title="Delete this entry"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={handleSaveCurrentEntry}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
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
          </div>
        </div>

        {/* The Full Daily Sheet */}
        <div className="border border-neutral-200 rounded-3xl bg-white p-6 sm:p-10 shadow-xs space-y-6">
          {/* Top Metadata Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-100">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-mono font-medium">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const newD = normalizeDate(e.target.value);
                    setSelectedDate(newD);
                    if (title.startsWith('Journal:') || /202[0-5]/.test(title)) {
                      setTitle(`Journal: ${newD}`);
                    }
                  }}
                  className="bg-transparent text-neutral-900 font-mono text-xs focus:outline-none cursor-pointer"
                  title="Change entry date"
                />
              </div>
              {!isToday(selectedDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayStr);
                    if (title.startsWith('Journal:') || /202[0-5]/.test(title)) {
                      setTitle(`Journal: ${todayStr}`);
                    }
                  }}
                  className="text-[11px] font-semibold text-neutral-600 hover:text-black bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                  title="Set date to Today"
                >
                  Set to Today
                </button>
              )}
              <span className="text-xs text-neutral-400 font-mono">
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>

            {/* Mood & Weather Pills */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1">
                <span className="text-xs">Mood:</span>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="text-xs bg-transparent text-neutral-800 font-medium focus:outline-none cursor-pointer"
                >
                  {MOODS.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.emoji} {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-neutral-50 border border-neutral-200 rounded-lg px-2.5 py-1">
                <span className="text-xs">Weather:</span>
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value)}
                  className="text-xs bg-transparent text-neutral-800 font-medium focus:outline-none cursor-pointer"
                >
                  {WEATHERS.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Full Title */}
          <div>
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-1">
              {formatHumanDate(selectedDate)}
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Journal: ${formatHumanDate(selectedDate)}`}
              className="w-full text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 placeholder:text-neutral-300 border-0 focus:outline-none"
            />
          </div>

          {/* Full Page Content Area */}
          {pageLoading ? (
            <div className="space-y-3 py-10 animate-pulse">
              <div className="h-4 bg-neutral-100 rounded w-5/6" />
              <div className="h-4 bg-neutral-100 rounded w-full" />
              <div className="h-4 bg-neutral-100 rounded w-4/6" />
              <div className="h-4 bg-neutral-100 rounded w-3/4" />
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`Write your diary entry for ${formatHumanDate(selectedDate)}...\n\nCapture your reflections, moments, milestones, and thoughts. Everything written here is preserved as this day's page.`}
              rows={18}
              className="w-full text-base text-neutral-800 placeholder:text-neutral-300 leading-relaxed sm:leading-loose border-0 focus:outline-none resize-none font-sans"
            />
          )}

          {/* Bottom helper */}
          <div className="pt-4 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
            <span>One continuous page for {selectedDate}</span>
            <span>Edits are saved to your journal</span>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {renderDeleteModal()}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: DIARY PAGE LIST (Directly on Page)
  // ==========================================
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header with Search and New Entry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Diary
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            Your personal journal entries organized by date. Click any day to read the full page.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          {onOpenReader && (
            <button
              onClick={onOpenReader}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-900 bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl shadow-2xs transition-all cursor-pointer"
              title="Continuous Reader Mode"
            >
              <BookOpen className="w-3.5 h-3.5 text-neutral-500" />
              <span>Reader Mode</span>
            </button>
          )}

          <button
            onClick={() => openDateEntry(todayStr)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Write Today</span>
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-neutral-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search entries by date, title, or keywords..."
          className="w-full pl-10 pr-4 py-2 text-xs border border-neutral-200 rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 shadow-2xs"
        />
      </div>

      {/* Diary Entries List (Directly on Page) */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-200 rounded-3xl bg-white space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-400 flex items-center justify-center mx-auto">
            <PenLine className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-neutral-900">
            {searchQuery ? 'No matching diary entries' : 'No diary entries yet'}
          </h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery
              ? 'Try searching with a different date or keyword.'
              : 'Every day is a new page. Start your journal today.'}
          </p>
          <button
            onClick={() => openDateEntry(todayStr)}
            className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 rounded-xl shadow-xs hover:bg-black transition-colors"
          >
            Write Today's Page
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredEntries.map((entry) => {
            const entryId = entry.id || (entry as any)._id;
            const words = (entry.content || '').split(/\s+/).filter(Boolean).length;
            const moodObj = MOODS.find(m => m.id === entry.mood);

            return (
              <div
                key={entryId}
                onClick={() => openFullEntry(entry)}
                className="group p-5 sm:p-6 border border-neutral-200 hover:border-neutral-300 rounded-2xl bg-white hover:bg-neutral-50/50 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                {/* Left Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Date & Tags Row */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-md bg-neutral-100 text-neutral-900">
                      {formatShortDate(entry.date)}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {formatHumanDate(entry.date)}
                    </span>
                    {moodObj && (
                      <span className="text-[11px] text-neutral-500 flex items-center gap-1 bg-neutral-50 border border-neutral-100 px-2 py-0.5 rounded-md">
                        <span>{moodObj.emoji}</span>
                        <span className="capitalize">{moodObj.label}</span>
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-neutral-900 group-hover:text-black transition-colors">
                    {entry.title || `Journal: ${entry.date}`}
                  </h3>

                  {/* Preview of Content */}
                  <p className="text-xs sm:text-sm text-neutral-600 line-clamp-3 leading-relaxed">
                    {entry.content || 'Empty entry'}
                  </p>

                  {/* Metadata footer */}
                  <div className="flex items-center gap-3 pt-1 text-[11px] text-neutral-400 font-mono">
                    <span>{words} {words === 1 ? 'word' : 'words'}</span>
                    <span>·</span>
                    <span className="text-neutral-900 group-hover:underline font-semibold flex items-center gap-1">
                      Click to read full entry <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>

                {/* Right Actions: Delete Button & View Arrow */}
                <div className="flex items-center gap-1.5 self-center shrink-0">
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
                    title="Delete this diary entry"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="hidden sm:flex w-8 h-8 rounded-full border border-neutral-200 group-hover:border-neutral-900 group-hover:bg-neutral-900 group-hover:text-white items-center justify-center text-neutral-400 transition-all">
                    <ArrowRight className="w-4 h-4" />
                  </div>
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
