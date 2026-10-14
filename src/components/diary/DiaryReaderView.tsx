import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { DiaryEntry } from '../../types/index.js';
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen, Sliders, Calendar } from 'lucide-react';

interface DiaryReaderViewProps {
  onBack: () => void;
}

export const DiaryReaderView: React.FC<DiaryReaderViewProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [readerMode, setReaderMode] = useState<'page' | 'continuous'>('page');
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>('lg');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const res = await api.diaries.list();
        // Sort chronologically for reading as a life story
        const sorted = (res.entries || []).sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setEntries(sorted);
      } catch (err) {
        console.error('Failed to load reader entries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const currentEntry = entries[currentIndex];

  const fontSizeClass = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
    xl: 'text-xl leading-loose',
  }[fontSize];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 min-h-[calc(100vh-4rem)]">
      {/* Top Controls Header */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-200 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit Reader</span>
        </button>

        <div className="flex items-center gap-3">
          {/* View mode toggle */}
          <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg text-xs font-medium text-neutral-600">
            <button
              onClick={() => setReaderMode('page')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                readerMode === 'page' ? 'bg-white text-neutral-900 shadow-xs' : 'hover:text-neutral-900'
              }`}
            >
              Page Flip
            </button>
            <button
              onClick={() => setReaderMode('continuous')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                readerMode === 'continuous' ? 'bg-white text-neutral-900 shadow-xs' : 'hover:text-neutral-900'
              }`}
            >
              Book Scroll
            </button>
          </div>

          {/* Font size picker */}
          <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs font-mono">
            {(['sm', 'base', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer capitalize ${
                  fontSize === size ? 'bg-white text-neutral-900 shadow-xs font-bold' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {size === 'sm' ? 'A-' : size === 'xl' ? 'A+' : size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6 py-12">
          <div className="h-6 w-48 bg-neutral-100 rounded animate-pulse mx-auto" />
          <div className="h-10 w-96 bg-neutral-100 rounded animate-pulse mx-auto" />
          <div className="space-y-3 max-w-xl mx-auto pt-6">
            <div className="h-4 bg-neutral-100 rounded animate-pulse" />
            <div className="h-4 bg-neutral-100 rounded animate-pulse" />
            <div className="h-4 bg-neutral-100 rounded animate-pulse w-5/6" />
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-neutral-200 rounded-2xl">
          <BookOpen className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
          <p className="text-base font-semibold text-neutral-800">Your life volume is empty</p>
          <p className="text-xs text-neutral-500 mt-1">Write your first reflections in the Diary to begin reading.</p>
        </div>
      ) : readerMode === 'page' && currentEntry ? (
        /* Page Turn View */
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-400 font-mono">
              <span>{currentEntry.date}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{currentEntry.mood}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize">{currentEntry.weather}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 font-serif-reading">
              {currentEntry.title}
            </h1>
          </div>

          <div className="border-t border-b border-neutral-100 py-10 px-4 sm:px-12 bg-white">
            <article className={`prose prose-neutral max-w-none text-neutral-800 whitespace-pre-wrap font-serif-reading ${fontSizeClass}`}>
              {currentEntry.content}
            </article>
          </div>

          {/* Page navigation controls */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-950 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Page</span>
            </button>

            <span className="text-xs font-mono text-neutral-400 tabular-nums">
              Page {currentIndex + 1} of {entries.length}
            </span>

            <button
              onClick={() => setCurrentIndex(prev => Math.min(entries.length - 1, prev + 1))}
              disabled={currentIndex === entries.length - 1}
              className="px-4 py-2 text-xs font-medium text-neutral-700 hover:text-neutral-950 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
            >
              <span>Next Page</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* Continuous Book Reading View */
        <div className="space-y-16 py-6 divide-y divide-neutral-200">
          {entries.map((entry, idx) => (
            <section key={entry.id || (entry as any)._id} className="pt-12 first:pt-0 space-y-4">
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-xs text-neutral-400 font-mono">
                  <span>{entry.date}</span>
                  <span className="mx-1.5">·</span>
                  <span className="capitalize">{entry.mood}</span>
                </div>
                <span className="text-xs font-mono text-neutral-400">Entry {idx + 1}</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 font-serif-reading">
                {entry.title}
              </h2>

              <article className={`prose prose-neutral max-w-none text-neutral-800 whitespace-pre-wrap font-serif-reading ${fontSizeClass}`}>
                {entry.content}
              </article>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
