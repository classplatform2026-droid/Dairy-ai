import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Book, Chapter } from '../../types/index.js';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  X
} from 'lucide-react';

interface BooksViewProps {
  initialBookId?: string;
  initialCreateNew?: boolean;
  onOpenReader?: (bookId: string) => void;
}

const GENRES = ['Memoir', 'Fiction', 'Essays', 'Poetry', 'Philosophy', 'Personal Development', 'Sci-Fi', 'Biography'];

export const BooksView: React.FC<BooksViewProps> = ({ initialBookId, initialCreateNew, onOpenReader }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  // Book reader mode
  const [readerOpen, setReaderOpen] = useState(false);

  // Create Book Modal
  const [createBookOpen, setCreateBookOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newGenre, setNewGenre] = useState('Memoir');
  const [newDescription, setNewDescription] = useState('');

  // Chapter editing
  const [chapterTitle, setChapterTitle] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [chapterSummary, setChapterSummary] = useState('');
  const [isEditingChapter, setIsEditingChapter] = useState(false);
  const [savingChapter, setSavingChapter] = useState(false);

  // AI assistant for chapter
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiAction, setAiAction] = useState<'improve' | 'expand' | 'beautify'>('improve');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await api.books.list();
      setBooks(res.books || []);

      if (initialBookId) {
        loadBookDetail(initialBookId);
      } else if (!selectedBook && res.books && res.books.length > 0) {
        loadBookDetail(res.books[0].id || (res.books[0] as any)._id);
      }
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookDetail = async (bookId: string) => {
    try {
      const res = await api.books.get(bookId);
      setSelectedBook(res.book);
      if (res.book.chapters && res.book.chapters.length > 0) {
        selectChapter(res.book.chapters[0]);
      } else {
        setSelectedChapter(null);
      }
    } catch (err) {
      console.error('Failed to load book details:', err);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  useEffect(() => {
    if (initialCreateNew) {
      setCreateBookOpen(true);
    }
  }, [initialCreateNew]);

  const selectChapter = (ch: Chapter) => {
    setSelectedChapter(ch);
    setChapterTitle(ch.title);
    setChapterContent(ch.content || '');
    setChapterSummary(ch.summary || '');
    setIsEditingChapter(false);
    setAiPanelOpen(false);
    setAiResult(null);
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await api.books.create({
        title: newTitle,
        subtitle: newSubtitle,
        genre: newGenre,
        description: newDescription,
      });
      setBooks(prev => [res.book, ...prev]);
      setSelectedBook(res.book);
      if (res.book.chapters && res.book.chapters.length > 0) {
        selectChapter(res.book.chapters[0]);
      }
      setCreateBookOpen(false);
      setNewTitle('');
      setNewSubtitle('');
      setNewDescription('');
    } catch (err) {
      console.error('Failed to create book:', err);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    const bookId = book.id || (book as any)._id;
    const confirm = window.confirm(`Permanently delete manuscript "${book.title}" and all its chapters?`);
    if (!confirm) return;

    try {
      await api.books.delete(bookId);
      const remaining = books.filter(b => (b.id || (b as any)._id) !== bookId);
      setBooks(remaining);
      if (remaining.length > 0) {
        loadBookDetail(remaining[0].id || (remaining[0] as any)._id);
      } else {
        setSelectedBook(null);
        setSelectedChapter(null);
      }
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  };

  const handleCreateChapter = async () => {
    if (!selectedBook) return;
    const bookId = selectedBook.id || (selectedBook as any)._id;
    const nextOrder = (selectedBook.chapters?.length || 0) + 1;

    try {
      const res = await api.books.createChapter(bookId, {
        title: `Chapter ${nextOrder}`,
        content: '',
        order: nextOrder,
      });
      const updatedChapters = [...(selectedBook.chapters || []), res.chapter];
      setSelectedBook({ ...selectedBook, chapters: updatedChapters, chapterCount: updatedChapters.length });
      selectChapter(res.chapter);
      setIsEditingChapter(true);
    } catch (err) {
      console.error('Failed to create chapter:', err);
    }
  };

  const handleSaveChapter = async () => {
    if (!selectedBook || !selectedChapter) return;
    setSavingChapter(true);
    const bookId = selectedBook.id || (selectedBook as any)._id;
    const chapterId = selectedChapter.id || (selectedChapter as any)._id;

    try {
      const res = await api.books.updateChapter(bookId, chapterId, {
        title: chapterTitle || 'Untitled Chapter',
        content: chapterContent,
        summary: chapterSummary,
      });

      setSelectedChapter(res.chapter);
      const updatedChapters = (selectedBook.chapters || []).map(c =>
        ((c.id || (c as any)._id) === chapterId ? res.chapter : c)
      );
      setSelectedBook({ ...selectedBook, chapters: updatedChapters });
      setIsEditingChapter(false);
    } catch (err) {
      console.error('Failed to save chapter:', err);
    } finally {
      setSavingChapter(false);
    }
  };

  const handleDeleteChapter = async (ch: Chapter) => {
    if (!selectedBook) return;
    const bookId = selectedBook.id || (selectedBook as any)._id;
    const chapterId = ch.id || (ch as any)._id;
    const confirm = window.confirm(`Delete "${ch.title}"?`);
    if (!confirm) return;

    try {
      await api.books.deleteChapter(bookId, chapterId);
      const updated = (selectedBook.chapters || []).filter(c => (c.id || (c as any)._id) !== chapterId);
      setSelectedBook({ ...selectedBook, chapters: updated });
      if (updated.length > 0) {
        selectChapter(updated[0]);
      } else {
        setSelectedChapter(null);
      }
    } catch (err) {
      console.error('Failed to delete chapter:', err);
    }
  };

  const handleReorderChapter = async (index: number, direction: 'up' | 'down') => {
    if (!selectedBook || !selectedBook.chapters) return;
    const chapters = [...selectedBook.chapters];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= chapters.length) return;

    const temp = chapters[index];
    chapters[index] = chapters[targetIndex];
    chapters[targetIndex] = temp;

    const orderedIds = chapters.map(c => c.id || (c as any)._id);
    const bookId = selectedBook.id || (selectedBook as any)._id;

    try {
      const res = await api.books.reorderChapters(bookId, orderedIds);
      setSelectedBook({ ...selectedBook, chapters: res.chapters });
    } catch (err) {
      console.error('Failed to reorder chapters:', err);
    }
  };

  // Run AI transformation on chapter
  const handleRunAI = async () => {
    if (!chapterContent.trim()) return;
    setAiLoading(true);
    setAiResult(null);

    try {
      const res = await api.ai.transformText(chapterContent, aiAction);
      setAiResult(res.output);
    } catch (err) {
      console.error('AI refinement failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleApplyAI = () => {
    if (aiResult) {
      setChapterContent(aiResult);
      setAiResult(null);
      setAiPanelOpen(false);
    }
  };

  // Full Book Reader Overlay
  if (readerOpen && selectedBook) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 min-h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between pb-6 border-b border-neutral-200 mb-8">
          <button
            onClick={() => setReaderOpen(false)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Close Reading Mode</span>
          </button>
          <span className="text-xs font-mono text-neutral-400">
            {selectedBook.chapters?.length || 0} Chapters · {selectedBook.wordCount?.toLocaleString() || 0} Words
          </span>
        </div>

        {/* Title Page */}
        <div className="text-center py-16 space-y-3 border-b border-neutral-200 mb-16">
          <span className="text-xs uppercase tracking-widest text-neutral-400 font-mono">
            {selectedBook.genre}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 font-serif-reading">
            {selectedBook.title}
          </h1>
          {selectedBook.subtitle && (
            <p className="text-sm text-neutral-500 font-serif-reading italic">{selectedBook.subtitle}</p>
          )}
        </div>

        {/* Chapters */}
        <div className="space-y-20 divide-y divide-neutral-200">
          {(selectedBook.chapters || []).map((ch, idx) => (
            <div key={ch.id || (ch as any)._id} className="pt-16 first:pt-0 space-y-6">
              <div className="text-center space-y-1">
                <span className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
                  Chapter {idx + 1}
                </span>
                <h2 className="text-2xl font-bold tracking-tight text-neutral-900 font-serif-reading">
                  {ch.title}
                </h2>
              </div>

              <article className="prose prose-neutral max-w-none text-neutral-800 text-lg leading-loose font-serif-reading whitespace-pre-wrap px-4 sm:px-12">
                {ch.content || 'This chapter is still being drafted.'}
              </article>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Books & Manuscripts</h1>
          <p className="text-xs text-neutral-500">Structured chapters, long-form narratives, and published reading view</p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedBook && (
            <button
              onClick={() => {
                const bId = selectedBook.id || (selectedBook as any)._id;
                if (onOpenReader) {
                  onOpenReader(bId);
                } else {
                  setReaderOpen(true);
                }
              }}
              className="px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-neutral-700" />
              <span>Read Full Book</span>
            </button>
          )}

          <button
            onClick={() => setCreateBookOpen(true)}
            className="px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Book</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Studio Layout: Bookshelf (3) | Chapter Outline (3) | Chapter Workspace (6) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bookshelf list (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Manuscripts ({books.length})
            </h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-16 bg-neutral-100 rounded-lg animate-pulse" />)}
            </div>
          ) : books.length === 0 ? (
            <div className="p-6 text-center border border-neutral-200 rounded-xl bg-white">
              <p className="text-xs text-neutral-500">No books created.</p>
              <button
                onClick={() => setCreateBookOpen(true)}
                className="mt-2 text-xs font-semibold text-neutral-900 underline"
              >
                Start your first manuscript
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {books.map(b => {
                const isSelected = selectedBook && (selectedBook.id || (selectedBook as any)._id) === (b.id || (b as any)._id);
                return (
                  <div
                    key={b.id || (b as any)._id}
                    onClick={() => loadBookDetail(b.id || (b as any)._id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                      <span>{b.genre}</span>
                      <span className="capitalize">{b.status}</span>
                    </div>
                    <h3 className="font-semibold text-neutral-900 text-xs truncate">{b.title}</h3>
                    <div className="mt-2 text-[10px] text-neutral-400 font-mono">
                      <span>{b.chapterCount || 0} chapters</span>
                      <span className="mx-1">·</span>
                      <span>{b.wordCount?.toLocaleString() || 0} words</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chapters Outline (3 cols) */}
        <div className="lg:col-span-3 space-y-3 border-l border-neutral-100 lg:pl-6">
          <div className="flex items-center justify-between pb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
              Chapters
            </h2>
            {selectedBook && (
              <button
                onClick={handleCreateChapter}
                className="text-xs font-medium text-neutral-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>

          {!selectedBook ? (
            <p className="text-xs text-neutral-400 italic">Select a book to view chapters.</p>
          ) : (selectedBook.chapters || []).length === 0 ? (
            <div className="p-4 text-center border border-dashed border-neutral-200 rounded-lg">
              <p className="text-xs text-neutral-500">No chapters yet.</p>
              <button
                onClick={handleCreateChapter}
                className="mt-2 text-xs font-semibold text-neutral-900 underline"
              >
                Add Chapter 1
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
              {(selectedBook.chapters || []).map((ch, idx) => {
                const isSelected = selectedChapter && (selectedChapter.id || (selectedChapter as any)._id) === (ch.id || (ch as any)._id);
                return (
                  <div
                    key={ch.id || (ch as any)._id}
                    onClick={() => selectChapter(ch)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between group ${
                      isSelected
                        ? 'border-neutral-900 bg-white shadow-xs font-medium'
                        : 'border-neutral-200 hover:border-neutral-300 bg-neutral-50/50'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="text-[10px] text-neutral-400 font-mono mr-1.5">{idx + 1}.</span>
                      <span className="text-xs text-neutral-800">{ch.title}</span>
                    </div>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderChapter(idx, 'up');
                        }}
                        disabled={idx === 0}
                        className="p-1 hover:text-neutral-950 disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReorderChapter(idx, 'down');
                        }}
                        disabled={idx === (selectedBook.chapters?.length || 0) - 1}
                        className="p-1 hover:text-neutral-950 disabled:opacity-20 cursor-pointer"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chapter Workspace / Editor (6 cols) */}
        <div className="lg:col-span-6">
          <div className="border border-neutral-200 rounded-xl bg-white p-6 shadow-xs min-h-[580px] flex flex-col justify-between">
            {selectedChapter ? (
              <>
                <div>
                  {/* Top action row */}
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 mb-4">
                    <span className="text-xs font-mono text-neutral-400">
                      Order {selectedChapter.order} · {selectedChapter.wordCount || 0} words
                    </span>

                    <div className="flex items-center gap-2">
                      {isEditingChapter ? (
                        <>
                          <button
                            onClick={() => setAiPanelOpen(!aiPanelOpen)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                              aiPanelOpen
                                ? 'bg-neutral-900 text-white border-neutral-900'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                            }`}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>AI Polisher</span>
                          </button>

                          <button
                            onClick={handleSaveChapter}
                            disabled={savingChapter}
                            className="px-3.5 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>

                          <button
                            onClick={() => setIsEditingChapter(false)}
                            className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setIsEditingChapter(true)}
                            className="px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
                          >
                            Edit Chapter
                          </button>
                          <button
                            onClick={() => handleDeleteChapter(selectedChapter)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete chapter"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  {isEditingChapter ? (
                    <input
                      type="text"
                      value={chapterTitle}
                      onChange={(e) => setChapterTitle(e.target.value)}
                      placeholder="Chapter title..."
                      className="w-full text-xl font-bold tracking-tight text-neutral-900 border-0 focus:outline-none mb-4"
                    />
                  ) : (
                    <h2 className="text-xl font-bold tracking-tight text-neutral-900 mb-4 font-serif-reading">
                      {selectedChapter.title}
                    </h2>
                  )}

                  {/* Content */}
                  {isEditingChapter ? (
                    <textarea
                      value={chapterContent}
                      onChange={(e) => setChapterContent(e.target.value)}
                      placeholder="Draft chapter narrative here..."
                      rows={14}
                      className="w-full text-sm text-neutral-800 placeholder:text-neutral-300 leading-relaxed border-0 focus:outline-none resize-none font-serif-reading"
                    />
                  ) : (
                    <article className="prose prose-neutral max-w-none text-neutral-800 font-serif-reading text-base leading-relaxed whitespace-pre-wrap">
                      {selectedChapter.content || 'Draft is empty. Click Edit Chapter to begin.'}
                    </article>
                  )}
                </div>

                {/* AI Assistant drawer */}
                {aiPanelOpen && isEditingChapter && (
                  <div className="mt-6 p-4 border border-neutral-200 rounded-xl bg-neutral-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-900">
                        <Sparkles className="w-4 h-4" />
                        <span>AI Manuscript Enhancement</span>
                      </div>
                      <button onClick={() => setAiPanelOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-1.5">
                      {(['improve', 'expand', 'beautify'] as const).map(act => (
                        <button
                          key={act}
                          onClick={() => setAiAction(act)}
                          className={`px-2.5 py-1 text-xs rounded font-medium capitalize transition-colors cursor-pointer ${
                            aiAction === act ? 'bg-neutral-900 text-white' : 'bg-white border border-neutral-200 text-neutral-700'
                          }`}
                        >
                          {act}
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleRunAI}
                        disabled={aiLoading || !chapterContent.trim()}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 rounded-md hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {aiLoading ? 'Enhancing...' : 'Generate Revision'}
                      </button>
                    </div>

                    {aiResult && (
                      <div className="p-3 bg-white border border-neutral-200 rounded-lg space-y-2">
                        <p className="text-xs text-neutral-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {aiResult}
                        </p>
                        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                          <button
                            onClick={() => setAiResult(null)}
                            className="px-2.5 py-1 text-xs text-neutral-600 hover:text-neutral-900"
                          >
                            Discard
                          </button>
                          <button
                            onClick={handleApplyAI}
                            className="px-3 py-1 text-xs font-medium text-white bg-neutral-900 rounded hover:bg-neutral-800"
                          >
                            Apply to Chapter
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-24">
                <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-xs text-neutral-500">No chapter selected.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Book Modal */}
      {createBookOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-neutral-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">Create New Manuscript</h2>
              <button onClick={() => setCreateBookOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Book Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Reflections on Stillness"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Subtitle (Optional)</label>
                <input
                  type="text"
                  value={newSubtitle}
                  onChange={(e) => setNewSubtitle(e.target.value)}
                  placeholder="e.g. A Memoir of Quiet Discipline"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Genre</label>
                <select
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                >
                  {GENRES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Description / Concept</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Summary of the book narrative or theme..."
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setCreateBookOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
                >
                  Create Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
