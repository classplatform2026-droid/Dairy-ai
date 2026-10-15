import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { Book, DiaryEntry, Chapter } from '../../types/index.js';
import {
  compareDateAsc,
  formatHumanDate,
  formatShortDate,
  normalizeDate,
} from '../../utils/date.js';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  BookMarked,
  Search,
  Sparkles,
  Calendar,
  Layers,
  Clock,
  Feather,
  List,
  Sun,
  Moon,
  Coffee,
  X,
  Bookmark,
  Check,
  Palette,
  Edit3,
  Compass,
  Heart,
  Flame,
  Type as TypeIcon
} from 'lucide-react';

interface DiaryReaderViewProps {
  onBack: () => void;
  initialBookId?: string;
  initialType?: 'book' | 'journal';
  onNavigateToBooks?: () => void;
  onNavigateToDiary?: () => void;
}

type ReaderTheme = 'light' | 'sepia' | 'dark';
type ViewFilter = 'all' | 'journals' | 'books';
type ReaderViewMode = 'page' | 'continuous';
type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type FontFamily = 'serif' | 'sans' | 'mono';

interface JournalVolume {
  id: string;
  title: string;
  subtitle: string;
  year?: string;
  entries: DiaryEntry[];
  wordCount: number;
  coverStyle: string;
  iconName?: string;
  author?: string;
}

// Visual Cover Themes for Books & Journals
const COVER_THEMES: Record<string, {
  name: string;
  bg: string;
  border: string;
  titleColor: string;
  accentColor: string;
  spineGrad: string;
  ribbonColor: string;
  emblemBorder: string;
  previewBg: string;
}> = {
  'classic-dark': {
    name: 'Obsidian & Gold',
    bg: 'bg-gradient-to-br from-[#1c1d22] via-[#141518] to-[#0a0b0d]',
    border: 'border-amber-600/30',
    titleColor: 'text-amber-100',
    accentColor: 'text-amber-300/80',
    spineGrad: 'from-amber-500/20 via-transparent to-black/60',
    ribbonColor: 'bg-amber-600',
    emblemBorder: 'border-amber-500/40 text-amber-300',
    previewBg: 'bg-[#141518] border-amber-600/40',
  },
  'linen-cream': {
    name: 'Linen Ivory & Ink',
    bg: 'bg-gradient-to-br from-[#faf7ee] via-[#f3edd9] to-[#eae2c7]',
    border: 'border-[#cfc5aa]',
    titleColor: 'text-neutral-900',
    accentColor: 'text-neutral-600',
    spineGrad: 'from-[#beaf8f] via-transparent to-black/15',
    ribbonColor: 'bg-neutral-800',
    emblemBorder: 'border-neutral-400 text-neutral-800',
    previewBg: 'bg-[#f4efe2] border-[#cfc5aa]',
  },
  'navy-foil': {
    name: 'Midnight Navy Foil',
    bg: 'bg-gradient-to-br from-[#10213b] via-[#0b172a] to-[#060d19]',
    border: 'border-sky-400/25',
    titleColor: 'text-sky-50',
    accentColor: 'text-sky-300/80',
    spineGrad: 'from-sky-400/20 via-transparent to-black/60',
    ribbonColor: 'bg-sky-500',
    emblemBorder: 'border-sky-400/40 text-sky-200',
    previewBg: 'bg-[#0b172a] border-sky-400/40',
  },
  'forest-green': {
    name: 'Forest Pine & Brass',
    bg: 'bg-gradient-to-br from-[#12281d] via-[#0c1c14] to-[#060e0a]',
    border: 'border-emerald-500/30',
    titleColor: 'text-emerald-50',
    accentColor: 'text-emerald-300/80',
    spineGrad: 'from-emerald-400/20 via-transparent to-black/60',
    ribbonColor: 'bg-emerald-600',
    emblemBorder: 'border-emerald-500/40 text-emerald-200',
    previewBg: 'bg-[#0c1c14] border-emerald-500/40',
  },
  'crimson-leather': {
    name: 'Crimson Wine Leather',
    bg: 'bg-gradient-to-br from-[#2f1117] via-[#210a0e] to-[#120508]',
    border: 'border-rose-500/30',
    titleColor: 'text-rose-50',
    accentColor: 'text-rose-300/80',
    spineGrad: 'from-rose-400/20 via-transparent to-black/60',
    ribbonColor: 'bg-rose-600',
    emblemBorder: 'border-rose-500/40 text-rose-200',
    previewBg: 'bg-[#210a0e] border-rose-500/40',
  },
  'minimal-slate': {
    name: 'Graphite Slate Monolith',
    bg: 'bg-gradient-to-br from-[#27272a] via-[#1f1f23] to-[#18181b]',
    border: 'border-neutral-600/40',
    titleColor: 'text-white',
    accentColor: 'text-neutral-300',
    spineGrad: 'from-white/10 via-transparent to-black/60',
    ribbonColor: 'bg-neutral-500',
    emblemBorder: 'border-neutral-500 text-neutral-300',
    previewBg: 'bg-[#1f1f23] border-neutral-600/40',
  },
  'sunset-terracotta': {
    name: 'Sunset Terracotta',
    bg: 'bg-gradient-to-br from-[#381d16] via-[#2a140f] to-[#180a07]',
    border: 'border-amber-500/30',
    titleColor: 'text-amber-100',
    accentColor: 'text-amber-300/80',
    spineGrad: 'from-amber-400/20 via-transparent to-black/60',
    ribbonColor: 'bg-amber-600',
    emblemBorder: 'border-amber-500/40 text-amber-200',
    previewBg: 'bg-[#2a140f] border-amber-600/40',
  },
  'indigo-wabi': {
    name: 'Indigo Wabi-Sabi',
    bg: 'bg-gradient-to-br from-[#121c38] via-[#0d1427] to-[#070b16]',
    border: 'border-indigo-400/30',
    titleColor: 'text-indigo-100',
    accentColor: 'text-indigo-200/80',
    spineGrad: 'from-indigo-400/20 via-transparent to-black/60',
    ribbonColor: 'bg-indigo-500',
    emblemBorder: 'border-indigo-400/40 text-indigo-200',
    previewBg: 'bg-[#0d1427] border-indigo-400/40',
  },
};

// Available Emblem Icons
const EMBLEM_ICONS: Record<string, { label: string; component: React.FC<{ className?: string }> }> = {
  Sparkles: { label: 'Sparkles', component: Sparkles },
  BookOpen: { label: 'Book', component: BookOpen },
  Feather: { label: 'Feather', component: Feather },
  BookMarked: { label: 'Journal', component: BookMarked },
  Moon: { label: 'Moon', component: Moon },
  Sun: { label: 'Sun', component: Sun },
  Compass: { label: 'Compass', component: Compass },
  Coffee: { label: 'Coffee', component: Coffee },
  Bookmark: { label: 'Ribbon', component: Bookmark },
  Heart: { label: 'Heart', component: Heart },
  Flame: { label: 'Flame', component: Flame },
  Layers: { label: 'Layers', component: Layers },
};

// Quick short title options (Bengali & English)
const SHORT_TITLES_PRESETS = [
  'নীরবতার দিনলিপি',
  'The Quiet Mind',
  'স্মৃতির পদচিহ্ন',
  'Echoes of Time',
  'পথের শেষ কোথায়',
  'Letters to Tomorrow',
  'জীবন নদীর বাঁকে',
  'Morning Reflections',
  'আত্মোপলব্ধির আলো',
  'Days of Wonder',
  'অচেনা অনুভূতির কথা',
  'The Art of Being',
];

// Quick subtitle suggestions
const SUBTITLE_PRESETS = [
  'A private record of thoughts, memory, and personal growth',
  'প্রতিদিনের ভাবনা ও স্মৃতিকথার নীরব সংকলন',
  'Personal reflections on stillness and intentional living',
  'জীবনপ্রবাহের একান্ত অনুভব ও আত্মানুসন্ধান',
  'Unfiltered memoirs across the turning seasons',
];

interface EditingCoverState {
  itemType: 'book' | 'journal';
  id: string;
  title: string;
  subtitle: string;
  author: string;
  coverStyle: string;
  iconName: string;
  genre?: string;
}

export const DiaryReaderView: React.FC<DiaryReaderViewProps> = ({
  onBack,
  initialBookId,
  initialType,
  onNavigateToBooks,
  onNavigateToDiary,
}) => {
  const { user } = useAuth();

  // Data states
  const [books, setBooks] = useState<Book[]>([]);
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Reader state: null = Bookshelf view; otherwise reader is open
  const [activeItem, setActiveItem] = useState<
    | { type: 'book'; book: Book; currentChapterIndex: number }
    | { type: 'journal'; volume: JournalVolume; currentEntryIndex: number }
    | null
  >(null);

  // Bookshelf filter & search
  const [filter, setFilter] = useState<ViewFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reader Customization controls
  const [readerTheme, setReaderTheme] = useState<ReaderTheme>('light');
  const [readerMode, setReaderMode] = useState<ReaderViewMode>('page');
  const [fontSize, setFontSize] = useState<FontSize>('lg');
  const [fontFamily, setFontFamily] = useState<FontFamily>('serif');
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);

  // Cover Editing Modal State (ONLY accessible from the Library & Bookshelf page)
  const [editingCover, setEditingCover] = useState<EditingCoverState | null>(null);
  const [savingCover, setSavingCover] = useState(false);

  // Custom Journal volume local storage key
  const getJournalCoverStorageKey = (id: string) => `lifenote_journal_cover_${user?.id || 'default'}_${id}`;

  // Helper to parse coverStyle string (e.g. "classic-dark:Feather" or "classic-dark")
  const parseCoverStyle = (styleStr?: string, defaultIcon: string = 'BookOpen') => {
    if (!styleStr) return { styleKey: 'classic-dark', iconName: defaultIcon };
    const parts = styleStr.split(':');
    const styleKey = parts[0] in COVER_THEMES ? parts[0] : 'classic-dark';
    const iconName = parts[1] && parts[1] in EMBLEM_ICONS ? parts[1] : defaultIcon;
    return { styleKey, iconName };
  };

  // Helper to serialize styleKey and iconName
  const serializeCoverStyle = (styleKey: string, iconName: string) => {
    return `${styleKey}:${iconName}`;
  };

  // Fetch initial books & diaries
  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const [diariesRes, booksRes] = await Promise.all([
          api.diaries.list().catch(() => ({ entries: [] })),
          api.books.list().catch(() => ({ books: [] })),
        ]);

        // Process diaries
        const rawDiaries = diariesRes.entries || [];
        const dateMap = new Map<string, DiaryEntry>();
        for (const item of rawDiaries) {
          const cleanDate = normalizeDate(item.date);
          const existing = dateMap.get(cleanDate);
          if (!existing || (item.content || '').length >= (existing.content || '').length) {
            dateMap.set(cleanDate, { ...item, date: cleanDate });
          }
        }
        const sortedDiaries = Array.from(dateMap.values()).sort((a, b) => compareDateAsc(a.date, b.date));
        setAllEntries(sortedDiaries);

        const loadedBooks = booksRes.books || [];
        setBooks(loadedBooks);

        // If an initial book was requested, automatically open it
        if (initialBookId) {
          openBookById(initialBookId, loadedBooks);
        } else if (initialType === 'journal' && sortedDiaries.length > 0) {
          const defaultTitle = 'The Life Chronicles';
          const defaultSubtitle = 'The Collected Daily Journals & Contemplations';
          openJournalVolume({
            id: 'complete-life-journal',
            title: defaultTitle,
            subtitle: defaultSubtitle,
            entries: sortedDiaries,
            wordCount: sortedDiaries.reduce((acc, e) => acc + (e.wordCount || 0), 0),
            coverStyle: 'classic-dark:Sparkles',
            iconName: 'Sparkles',
          });
        }
      } catch (err) {
        console.error('Failed to load reader collection:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, [initialBookId, initialType]);

  // Open book handler (fetches full book with chapters if needed)
  const openBook = async (book: Book) => {
    const bookId = book.id || (book as any)._id;
    try {
      setBookLoading(true);
      const res = await api.books.get(bookId);
      const fullBook = res.book || book;
      setActiveItem({
        type: 'book',
        book: fullBook,
        currentChapterIndex: 0,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to load full book details:', err);
      setActiveItem({
        type: 'book',
        book,
        currentChapterIndex: 0,
      });
    } finally {
      setBookLoading(false);
    }
  };

  const openBookById = async (bookId: string, availableBooks: Book[]) => {
    const found = availableBooks.find(b => (b.id || (b as any)._id) === bookId);
    if (found) {
      await openBook(found);
    } else {
      try {
        setBookLoading(true);
        const res = await api.books.get(bookId);
        if (res.book) {
          setActiveItem({
            type: 'book',
            book: res.book,
            currentChapterIndex: 0,
          });
        }
      } catch (e) {
        console.error('Failed to open book by id', e);
      } finally {
        setBookLoading(false);
      }
    }
  };

  // Open journal volume handler
  const openJournalVolume = (vol: JournalVolume) => {
    setActiveItem({
      type: 'journal',
      volume: vol,
      currentEntryIndex: 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Close reader back to bookshelf
  const handleCloseReader = () => {
    setActiveItem(null);
    setTocDrawerOpen(false);
  };

  // Generate Journal Volumes based on user's entries (with local storage overrides for user customization)
  const journalVolumes = useMemo<JournalVolume[]>(() => {
    if (allEntries.length === 0) return [];

    const totalWords = allEntries.reduce((acc, e) => acc + (e.wordCount || 0), 0);

    // Check if user has saved custom cover for complete journal
    let completeTitle = 'The Life Chronicles';
    let completeSubtitle = 'The Collected Daily Journals & Contemplations';
    let completeCoverStyle = 'classic-dark:Sparkles';
    let completeAuthor = user?.name || 'Saad';

    try {
      const saved = localStorage.getItem(getJournalCoverStorageKey('complete-life-journal'));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.title) completeTitle = parsed.title;
        if (parsed.subtitle) completeSubtitle = parsed.subtitle;
        if (parsed.coverStyle) completeCoverStyle = parsed.coverStyle;
        if (parsed.author) completeAuthor = parsed.author;
      }
    } catch {
      // fallback
    }

    const { styleKey, iconName } = parseCoverStyle(completeCoverStyle, 'Sparkles');

    const volumes: JournalVolume[] = [
      {
        id: 'complete-life-journal',
        title: completeTitle,
        subtitle: completeSubtitle,
        entries: allEntries,
        wordCount: totalWords,
        coverStyle: styleKey,
        iconName,
        author: completeAuthor,
      },
    ];

    // Group by Year if multiple years exist
    const yearGroups = new Map<string, DiaryEntry[]>();
    for (const entry of allEntries) {
      const year = entry.date.split('-')[0] || '2026';
      const arr = yearGroups.get(year) || [];
      arr.push(entry);
      yearGroups.set(year, arr);
    }

    if (yearGroups.size > 1) {
      const defaultStyles = ['linen-cream', 'navy-foil', 'forest-green', 'crimson-leather'];
      let idx = 0;
      yearGroups.forEach((entries, year) => {
        const words = entries.reduce((acc, e) => acc + (e.wordCount || 0), 0);
        const volId = `volume-${year}`;

        let vTitle = `Volume ${year}`;
        let vSubtitle = `Memories, Insights & Reflections of ${year}`;
        let vCoverStyle = `${defaultStyles[idx % defaultStyles.length]}:BookMarked`;
        let vAuthor = user?.name || 'Saad';

        try {
          const s = localStorage.getItem(getJournalCoverStorageKey(volId));
          if (s) {
            const p = JSON.parse(s);
            if (p.title) vTitle = p.title;
            if (p.subtitle) vSubtitle = p.subtitle;
            if (p.coverStyle) vCoverStyle = p.coverStyle;
            if (p.author) vAuthor = p.author;
          }
        } catch {
          // fallback
        }

        const parsedStyle = parseCoverStyle(vCoverStyle, 'BookMarked');

        volumes.push({
          id: volId,
          title: vTitle,
          subtitle: vSubtitle,
          year,
          entries,
          wordCount: words,
          coverStyle: parsedStyle.styleKey,
          iconName: parsedStyle.iconName,
          author: vAuthor,
        });
        idx++;
      });
    }

    return volumes;
  }, [allEntries, user?.name]);

  // Filtered lists for the bookshelf
  const filteredBooks = useMemo(() => {
    if (filter === 'journals') return [];
    let list = books;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || (b.genre && b.genre.toLowerCase().includes(q)));
    }
    return list;
  }, [books, filter, searchQuery]);

  const filteredJournals = useMemo(() => {
    if (filter === 'books') return [];
    let list = journalVolumes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(j => j.title.toLowerCase().includes(q) || j.subtitle.toLowerCase().includes(q));
    }
    return list;
  }, [journalVolumes, filter, searchQuery]);

  // Open Cover Editor Modal for a book or journal
  const handleOpenCoverEditor = (
    e: React.MouseEvent,
    target: {
      type: 'book' | 'journal';
      id: string;
      title: string;
      subtitle?: string;
      author?: string;
      coverStyle?: string;
      iconName?: string;
      genre?: string;
    }
  ) => {
    e.stopPropagation(); // Do not trigger book opening!
    const { styleKey, iconName } = parseCoverStyle(
      target.coverStyle,
      target.iconName || (target.type === 'journal' ? 'Sparkles' : 'BookOpen')
    );

    setEditingCover({
      itemType: target.type,
      id: target.id,
      title: target.title,
      subtitle: target.subtitle || '',
      author: target.author || user?.name || 'Saad',
      coverStyle: styleKey,
      iconName,
      genre: target.genre,
    });
  };

  // Save Cover Changes Handler
  const handleSaveCover = async () => {
    if (!editingCover || !editingCover.title.trim()) return;

    try {
      setSavingCover(true);
      const combinedCoverStyle = serializeCoverStyle(editingCover.coverStyle, editingCover.iconName);

      if (editingCover.itemType === 'book') {
        // Update Book in Database
        await api.books.update(editingCover.id, {
          title: editingCover.title.trim(),
          subtitle: editingCover.subtitle.trim(),
          coverStyle: combinedCoverStyle,
        });

        // Update local books state
        setBooks(prev =>
          prev.map(b =>
            (b.id || (b as any)._id) === editingCover.id
              ? {
                  ...b,
                  title: editingCover.title.trim(),
                  subtitle: editingCover.subtitle.trim(),
                  coverStyle: combinedCoverStyle,
                }
              : b
          )
        );
      } else {
        // Save Journal Volume custom preferences
        const savePayload = {
          title: editingCover.title.trim(),
          subtitle: editingCover.subtitle.trim(),
          author: editingCover.author.trim(),
          coverStyle: combinedCoverStyle,
        };
        localStorage.setItem(getJournalCoverStorageKey(editingCover.id), JSON.stringify(savePayload));

        // Trigger state refresh for journals
        setAllEntries(prev => [...prev]);
      }

      setEditingCover(null);
    } catch (err) {
      console.error('Failed to save cover changes:', err);
    } finally {
      setSavingCover(false);
    }
  };

  // Reader style classes
  const themeClasses = {
    light: 'bg-[#faf9f5] text-neutral-900 border-neutral-200 selection:bg-neutral-900 selection:text-white',
    sepia: 'bg-[#f5efe0] text-[#36271c] border-[#e2d5be] selection:bg-[#543d2b] selection:text-white',
    dark: 'bg-[#18181b] text-neutral-200 border-neutral-800 selection:bg-neutral-100 selection:text-neutral-900',
  }[readerTheme];

  const contentBgClasses = {
    light: 'bg-white text-neutral-800 shadow-sm border border-neutral-200/80',
    sepia: 'bg-[#fcf7ee] text-[#3a2c20] shadow-sm border border-[#e4d7c0]',
    dark: 'bg-[#202024] text-neutral-200 shadow-sm border border-neutral-800',
  }[readerTheme];

  const fontSizeClass = {
    sm: 'text-sm leading-relaxed',
    base: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
    xl: 'text-xl leading-loose',
  }[fontSize];

  const fontClass = {
    serif: 'font-serif-reading',
    sans: 'font-sans',
    mono: 'font-mono',
  }[fontFamily];

  // Helper to render book cover styling with Edit Icon right on this page!
  const renderCover = (item: {
    id: string;
    title: string;
    subtitle?: string;
    genreOrType: string;
    author: string;
    statsText: string;
    coverStyle?: string;
    iconName?: string;
    isJournal?: boolean;
    genre?: string;
    onClick: () => void;
  }) => {
    const { styleKey, iconName } = parseCoverStyle(
      item.coverStyle,
      item.iconName || (item.isJournal ? 'Sparkles' : 'BookOpen')
    );

    const t = COVER_THEMES[styleKey] || COVER_THEMES['classic-dark'];
    const IconComponent = EMBLEM_ICONS[iconName]?.component || (item.isJournal ? Sparkles : BookOpen);

    return (
      <div className="flex flex-col space-y-2 select-none group">
        {/* Book Container with 3D Aspect Ratio */}
        <div
          onClick={item.onClick}
          className="relative aspect-[3/4.4] w-full rounded-r-xl rounded-l-xs cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl shadow-lg overflow-hidden"
        >
          <div className={`absolute inset-0 ${t.bg} border ${t.border} p-5 flex flex-col justify-between`}>
            {/* Realistic Spine crease & shadow on the left edge */}
            <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 via-white/5 to-transparent z-10 pointer-events-none" />
            <div className="absolute inset-y-0 left-3 w-px bg-white/10 pointer-events-none" />

            {/* Book Spine Highlight Overlay */}
            <div className={`absolute inset-0 bg-gradient-to-r ${t.spineGrad} opacity-30 pointer-events-none`} />

            {/* Ribbon Bookmark Accent */}
            <div className={`absolute -top-1 right-6 w-3 h-7 ${t.ribbonColor} shadow-md rounded-b-sm pointer-events-none z-10`} />

            {/* Top Header Badge & Dedicated Minimal Edit Icon on Cover */}
            <div className="relative z-10 flex items-center justify-between text-[10px] font-mono tracking-widest uppercase">
              <span className={`${t.accentColor} font-semibold flex items-center gap-1`}>
                {item.isJournal ? (
                  <>
                    <BookMarked className="w-3 h-3" />
                    <span>Journal</span>
                  </>
                ) : (
                  <>
                    <Feather className="w-3 h-3" />
                    <span>Manuscript</span>
                  </>
                )}
              </span>

              {/* Minimal Edit Cover Button on the Cover Card (Only on this page!) */}
              <button
                onClick={(e) =>
                  handleOpenCoverEditor(e, {
                    type: item.isJournal ? 'journal' : 'book',
                    id: item.id,
                    title: item.title,
                    subtitle: item.subtitle,
                    author: item.author,
                    coverStyle: item.coverStyle,
                    iconName: item.iconName,
                    genre: item.genre,
                  })
                }
                className="p-1 rounded-md bg-black/30 hover:bg-white/20 text-white/80 hover:text-white backdrop-blur-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Edit Cover & Title (কভার পরিবর্তন)"
              >
                <Palette className="w-3 h-3" />
                <span className="text-[9px] lowercase tracking-normal hidden group-hover:inline">edit</span>
              </button>
            </div>

            {/* Center Title & Emblem */}
            <div className="relative z-10 my-auto text-center py-3 space-y-2.5">
              {/* Elegant Ornamental Crest */}
              <div className="flex items-center justify-center">
                <div
                  className={`w-8 h-8 rounded-full border ${t.emblemBorder} flex items-center justify-center backdrop-blur-xs`}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1 px-2">
                <h3
                  className={`text-base sm:text-lg font-bold tracking-tight font-serif-reading line-clamp-3 leading-snug ${t.titleColor}`}
                >
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className={`text-[11px] italic font-serif-reading line-clamp-2 ${t.accentColor}`}>
                    {item.subtitle}
                  </p>
                )}
              </div>

              {/* Author Line */}
              <div className="pt-0.5">
                <div className="w-6 h-px bg-current opacity-30 mx-auto mb-1" />
                <p className={`text-[10px] font-medium tracking-wide uppercase font-mono ${t.accentColor}`}>
                  {item.author}
                </p>
              </div>
            </div>

            {/* Cover Footer & Read Action */}
            <div className="relative z-10 pt-2.5 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
              <span className={`${t.accentColor} opacity-90 truncate max-w-[65%]`}>
                {item.statsText}
              </span>

              <span className="inline-flex items-center gap-1 font-semibold text-white bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs group-hover:bg-white group-hover:text-black transition-colors">
                <span>Read</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>

        {/* Name and Direct Edit Icon right next to the title label beneath the book! */}
        <div className="pt-1 px-1 flex items-start justify-between gap-1.5">
          <div className="min-w-0 flex-1">
            <h4
              onClick={item.onClick}
              className="text-xs font-semibold text-neutral-900 truncate hover:underline cursor-pointer font-serif-reading"
              title={item.title}
            >
              {item.title}
            </h4>
            <div className="text-[10px] text-neutral-400 truncate font-mono">
              {item.genreOrType} · {item.statsText}
            </div>
          </div>

          {/* Minimal Edit Cover Icon next to book name on this page */}
          <button
            onClick={(e) =>
              handleOpenCoverEditor(e, {
                type: item.isJournal ? 'journal' : 'book',
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
                author: item.author,
                coverStyle: item.coverStyle,
                iconName: item.iconName,
                genre: item.genre,
              })
            }
            className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
            title="Edit Cover Photo & Title"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // =========================================================================
  // VIEW 1: BOOKSHELF & READING LIBRARY (Cover Page Showcase)
  // =========================================================================
  if (!activeItem) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-neutral-200">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mb-1">
              <BookMarked className="w-3.5 h-3.5 text-neutral-800" />
              <span>LifeNote Reading Room</span>
              <span>·</span>
              <span className="text-neutral-600 font-medium">Personal Bookshelf</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 font-serif-reading">
              Library & Bookshelf
            </h1>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
              Curated collection of your bound journal chronicles and structured book manuscripts. Click any cover to read, or click the edit icon to customize covers and titles.
            </p>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2.5">
            {onNavigateToDiary && (
              <button
                onClick={onNavigateToDiary}
                className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Open Diary</span>
              </button>
            )}

            {onNavigateToBooks && (
              <button
                onClick={onNavigateToBooks}
                className="px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Manage Books</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats & Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-neutral-50 p-3 sm:p-4 rounded-xl border border-neutral-200/80">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-neutral-200 shadow-2xs text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer ${
                filter === 'all' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              All Volumes ({books.length + journalVolumes.length})
            </button>

            <button
              onClick={() => setFilter('journals')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                filter === 'journals' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>Journals ({journalVolumes.length})</span>
            </button>

            <button
              onClick={() => setFilter('books')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                filter === 'books' ? 'bg-neutral-900 text-white shadow-2xs' : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Books ({books.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by title, genre..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 pt-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-[3/4.4] bg-neutral-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredBooks.length === 0 && filteredJournals.length === 0 ? (
          /* Empty Showcase State */
          <div className="text-center py-20 border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 p-8 space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-neutral-900">Your Reading Shelf is Waiting</h3>
              <p className="text-xs text-neutral-500">
                Write thoughts in your daily diary or compose chapters in a manuscript to populate your personal library.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              {onNavigateToDiary && (
                <button
                  onClick={onNavigateToDiary}
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
                >
                  Write Diary Entry
                </button>
              )}
              {onNavigateToBooks && (
                <button
                  onClick={onNavigateToBooks}
                  className="px-4 py-2 text-xs font-semibold text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer"
                >
                  Create Book
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Book Covers Showcase Grid */
          <div className="space-y-12">
            {/* Section 1: Journal Chronicles */}
            {filteredJournals.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-neutral-800" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Personal Journal Volumes ({filteredJournals.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Click cover to read · Click icon to edit
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
                  {filteredJournals.map(journal => (
                    <div key={journal.id}>
                      {renderCover({
                        id: journal.id,
                        title: journal.title,
                        subtitle: journal.subtitle,
                        genreOrType: journal.year ? `${journal.year} Chronicle` : 'All-Time Volume',
                        author: journal.author || user?.name || 'Saad',
                        statsText: `${journal.entries.length} Entries · ${journal.wordCount.toLocaleString()} w`,
                        coverStyle: journal.coverStyle,
                        iconName: journal.iconName,
                        isJournal: true,
                        onClick: () => openJournalVolume(journal),
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Books & Manuscripts */}
            {filteredBooks.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-neutral-100">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-neutral-800" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Books & Manuscripts ({filteredBooks.length})
                    </h2>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    Click cover to read · Click icon to edit
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8">
                  {filteredBooks.map(book => {
                    const bId = book.id || (book as any)._id;
                    const parsed = parseCoverStyle(book.coverStyle, 'BookOpen');
                    return (
                      <div key={bId}>
                        {renderCover({
                          id: bId,
                          title: book.title,
                          subtitle: book.subtitle || book.description,
                          genreOrType: book.genre || 'Memoir',
                          genre: book.genre,
                          author: user?.name || 'Author',
                          statsText: `${book.chapterCount || book.chapters?.length || 0} Ch · ${(book.wordCount || 0).toLocaleString()} w`,
                          coverStyle: parsed.styleKey,
                          iconName: parsed.iconName,
                          isJournal: false,
                          onClick: () => openBook(book),
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            MINIMAL COVER PHOTO & TITLE EDITING MODAL (Only in this single page!)
            ========================================================================= */}
        {editingCover && (
          <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-4xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-neutral-900">
                      Cover & Title Customizer
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      {editingCover.itemType === 'book' ? 'Book Manuscript Cover' : 'Journal Volume Cover'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setEditingCover(null)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body: Left Live Preview | Right Controls */}
              <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-neutral-100 max-h-[80vh] overflow-y-auto">
                {/* Left: Live Interactive Cover Preview (5 cols) */}
                <div className="md:col-span-5 p-6 bg-neutral-50/60 flex flex-col items-center justify-center space-y-4">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                    Live Cover Preview
                  </span>

                  {/* Render Live Preview Card */}
                  <div className="w-56 aspect-[3/4.4] relative rounded-r-xl rounded-l-xs shadow-xl overflow-hidden border transition-all duration-200">
                    {(() => {
                      const t = COVER_THEMES[editingCover.coverStyle] || COVER_THEMES['classic-dark'];
                      const IconComp = EMBLEM_ICONS[editingCover.iconName]?.component || BookOpen;

                      return (
                        <div className={`absolute inset-0 ${t.bg} border ${t.border} p-4 flex flex-col justify-between`}>
                          {/* Spine crease */}
                          <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-black/40 via-white/5 to-transparent z-10" />
                          <div className={`absolute -top-1 right-5 w-2.5 h-6 ${t.ribbonColor} shadow-md rounded-b-xs z-10`} />

                          {/* Top badge */}
                          <div className="relative z-10 flex items-center justify-between text-[9px] font-mono tracking-widest uppercase">
                            <span className={`${t.accentColor} font-semibold`}>
                              {editingCover.itemType === 'book' ? 'Manuscript' : 'Journal'}
                            </span>
                            <span className={`${t.accentColor} opacity-70 truncate max-w-[80px]`}>
                              {editingCover.genre || 'Volume'}
                            </span>
                          </div>

                          {/* Center Title & Crest */}
                          <div className="relative z-10 my-auto text-center py-2 space-y-2">
                            <div className="flex items-center justify-center">
                              <div className={`w-7 h-7 rounded-full border ${t.emblemBorder} flex items-center justify-center backdrop-blur-xs`}>
                                <IconComp className="w-3.5 h-3.5" />
                              </div>
                            </div>

                            <div className="space-y-0.5 px-1">
                              <h4 className={`text-sm sm:text-base font-bold tracking-tight font-serif-reading leading-snug line-clamp-3 ${t.titleColor}`}>
                                {editingCover.title || 'Untitled Book'}
                              </h4>
                              {editingCover.subtitle && (
                                <p className={`text-[10px] italic font-serif-reading line-clamp-2 ${t.accentColor}`}>
                                  {editingCover.subtitle}
                                </p>
                              )}
                            </div>

                            <div className="pt-0.5">
                              <div className="w-5 h-px bg-current opacity-30 mx-auto mb-0.5" />
                              <p className={`text-[9px] font-medium tracking-wide uppercase font-mono ${t.accentColor}`}>
                                {editingCover.author || user?.name || 'Author'}
                              </p>
                            </div>
                          </div>

                          {/* Footer */}
                          <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[9px] font-mono">
                            <span className={`${t.accentColor} opacity-80`}>Personal Library</span>
                            <span className="text-white/80">LifeNote</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <p className="text-[11px] text-neutral-400 text-center max-w-xs">
                    This cover is rendered exclusively in your reading shelf with authentic leather and foil accents.
                  </p>
                </div>

                {/* Right: Customization Controls (7 cols) */}
                <div className="md:col-span-7 p-6 space-y-6">
                  {/* 1. Cover Theme Previews (Presets) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Select Cover Style Preview ({Object.keys(COVER_THEMES).length} Themes)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(COVER_THEMES).map(([key, theme]) => {
                        const isSelected = editingCover.coverStyle === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEditingCover({ ...editingCover, coverStyle: key })}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-18 ${
                              isSelected
                                ? 'border-neutral-900 ring-2 ring-neutral-900/20 shadow-xs'
                                : 'border-neutral-200 hover:border-neutral-400'
                            }`}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <div className={`w-4 h-4 rounded-full ${theme.previewBg} shadow-2xs border`} />
                              {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900" />}
                            </div>
                            <span className="text-[10px] font-semibold text-neutral-800 leading-tight">
                              {theme.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Quick Short Title Presets */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                        Short Title Options (ছোট শিরোনামসমূহ)
                      </label>
                      <span className="text-[10px] text-neutral-400">Click to apply</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {SHORT_TITLES_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEditingCover({ ...editingCover, title: preset })}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer border ${
                            editingCover.title === preset
                              ? 'bg-neutral-900 text-white border-neutral-900 font-medium'
                              : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border-neutral-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Custom Title Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Book Title (নতুন শিরোনাম লিখুন)
                    </label>
                    <input
                      type="text"
                      value={editingCover.title}
                      onChange={e => setEditingCover({ ...editingCover, title: e.target.value })}
                      placeholder="e.g. Reflections on Stillness"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900/20 focus:border-neutral-900 font-serif-reading font-semibold text-neutral-900 transition-all"
                    />
                  </div>

                  {/* 4. Subtitle Input & Presets */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                        Subtitle / Tagline (ঐচ্ছিক বিবরণ)
                      </label>
                    </div>

                    <input
                      type="text"
                      value={editingCover.subtitle}
                      onChange={e => setEditingCover({ ...editingCover, subtitle: e.target.value })}
                      placeholder="e.g. A Memoir of Quiet Discipline"
                      className="w-full px-3.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-800"
                    />

                    {/* Subtitle suggestions */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {SUBTITLE_PRESETS.map((sub, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setEditingCover({ ...editingCover, subtitle: sub })}
                          className="text-[10px] text-neutral-500 hover:text-neutral-900 hover:underline cursor-pointer truncate max-w-[280px]"
                        >
                          • {sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Emblem Crest Icon Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Cover Crest Emblem
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {Object.entries(EMBLEM_ICONS).map(([iconKey, item]) => {
                        const Icon = item.component;
                        const isSelected = editingCover.iconName === iconKey;
                        return (
                          <button
                            key={iconKey}
                            type="button"
                            onClick={() => setEditingCover({ ...editingCover, iconName: iconKey })}
                            className={`p-2 rounded-lg border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                            }`}
                            title={item.label}
                          >
                            <Icon className="w-4 h-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 6. Author Name Input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Author Name (লেখকের নাম)
                    </label>
                    <input
                      type="text"
                      value={editingCover.author}
                      onChange={e => setEditingCover({ ...editingCover, author: e.target.value })}
                      placeholder="e.g. Eleanor or Saad"
                      className="w-full px-3.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 text-neutral-800"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400 font-mono">
                  Changes update immediately across the reading room.
                </span>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingCover(null)}
                    className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCover}
                    disabled={savingCover || !editingCover.title.trim()}
                    className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingCover ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Save Cover Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE READING ROOM (Distraction-Free Book & Journal Reader)
  // (NOTE: The edit icon is deliberately omitted here, so the reading view
  //  remains pure, calm, and distraction-free as requested!)
  // =========================================================================

  const isBook = activeItem.type === 'book';
  const book = isBook ? activeItem.book : null;
  const journal = !isBook ? activeItem.volume : null;

  const chapters: Chapter[] = book?.chapters || [];
  const entries: DiaryEntry[] = journal?.entries || [];

  const currentChapter = isBook && chapters.length > 0 ? chapters[activeItem.currentChapterIndex] : null;
  const currentEntry = !isBook && entries.length > 0 ? entries[activeItem.currentEntryIndex] : null;

  return (
    <div className={`min-h-screen transition-colors duration-200 ${themeClasses} -mt-6 sm:-mt-8 -mx-4 sm:-mx-8 px-4 sm:px-8 py-6`}>
      {/* Reader Sticky Header Bar */}
      <header className="sticky top-0 z-30 max-w-5xl mx-auto backdrop-blur-md pb-4 pt-2 border-b border-inherit mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Back to Bookshelf & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleCloseReader}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-inherit hover:bg-black/5 dark:hover:bg-white/10 text-xs font-semibold transition-colors cursor-pointer shrink-0"
            title="Return to Bookshelf"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Bookshelf</span>
          </button>

          <div className="min-w-0 flex items-center gap-2">
            <span className="text-xs font-mono opacity-50 truncate hidden md:inline">
              {isBook ? book?.genre : 'Journal Volume'}
            </span>
            <span className="text-xs font-mono opacity-50 hidden md:inline">/</span>
            <h2 className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-xs font-serif-reading">
              {isBook ? book?.title : journal?.title}
            </h2>
          </div>
        </div>

        {/* Right: Appearance & Navigation Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Table of Contents Drawer Toggle */}
          <button
            onClick={() => setTocDrawerOpen(!tocDrawerOpen)}
            className={`px-2.5 py-1.5 rounded-lg border border-inherit text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              tocDrawerOpen ? 'bg-black/10 dark:bg-white/20' : 'hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Table of Contents"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Contents</span>
            <span className="text-[10px] font-mono opacity-70">
              ({isBook ? chapters.length : entries.length})
            </span>
          </button>

          {/* Reading Mode Switcher */}
          <div className="flex items-center p-0.5 rounded-lg border border-inherit text-xs font-medium">
            <button
              onClick={() => setReaderMode('page')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                readerMode === 'page' ? 'bg-black/10 dark:bg-white/20 font-bold' : 'opacity-70 hover:opacity-100'
              }`}
            >
              Page Flip
            </button>
            <button
              onClick={() => setReaderMode('continuous')}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                readerMode === 'continuous' ? 'bg-black/10 dark:bg-white/20 font-bold' : 'opacity-70 hover:opacity-100'
              }`}
            >
              Continuous
            </button>
          </div>

          {/* Theme Selector (Paper, Sepia, Night) */}
          <div className="flex items-center p-0.5 rounded-lg border border-inherit">
            <button
              onClick={() => setReaderTheme('light')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                readerTheme === 'light' ? 'bg-black/15 shadow-2xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Clean White Paper"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setReaderTheme('sepia')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                readerTheme === 'sepia' ? 'bg-[#543d2b] text-white shadow-2xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Warm Sepia Tone"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setReaderTheme('dark')}
              className={`p-1.5 rounded transition-colors cursor-pointer ${
                readerTheme === 'dark' ? 'bg-white/25 shadow-2xs' : 'opacity-60 hover:opacity-100'
              }`}
              title="Midnight Dark"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Font Size Selector */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-inherit text-xs font-mono">
            {(['sm', 'base', 'lg', 'xl'] as const).map(size => (
              <button
                key={size}
                onClick={() => setFontSize(size)}
                className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                  fontSize === size ? 'bg-black/10 dark:bg-white/20 font-bold' : 'opacity-50 hover:opacity-100'
                }`}
              >
                {size === 'sm' ? 'A-' : size === 'xl' ? 'A+' : size === 'base' ? 'A' : 'A+'}
              </button>
            ))}
          </div>

          {/* Font Family Selector */}
          <button
            onClick={() => {
              const next: Record<FontFamily, FontFamily> = {
                serif: 'sans',
                sans: 'mono',
                mono: 'serif',
              };
              setFontFamily(next[fontFamily]);
            }}
            className="px-2 py-1 rounded-lg border border-inherit text-xs font-mono uppercase tracking-wider opacity-80 hover:opacity-100 cursor-pointer"
            title="Toggle Font Family (Serif / Sans / Mono)"
          >
            {fontFamily}
          </button>
        </div>
      </header>

      {/* Table of Contents Drawer / Popover */}
      {tocDrawerOpen && (
        <div className="max-w-5xl mx-auto mb-8 p-4 rounded-xl border border-inherit bg-black/5 dark:bg-white/5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-inherit mb-3">
            <span className="text-xs font-bold uppercase tracking-wider font-mono">
              Table of Contents / সূচিপত্র
            </span>
            <button
              onClick={() => setTocDrawerOpen(false)}
              className="text-xs p-1 hover:opacity-100 opacity-60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
            {isBook ? (
              chapters.map((ch, idx) => {
                const isCurrent = idx === activeItem.currentChapterIndex;
                return (
                  <button
                    key={ch.id || (ch as any)._id}
                    onClick={() => {
                      setActiveItem({ ...activeItem, currentChapterIndex: idx });
                      setTocDrawerOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`text-left p-2.5 rounded-lg border border-inherit text-xs transition-colors cursor-pointer truncate ${
                      isCurrent ? 'bg-black/15 dark:bg-white/20 font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                    }`}
                  >
                    <div className="text-[10px] opacity-60 font-mono">Chapter {idx + 1}</div>
                    <div className="truncate font-serif-reading">{ch.title}</div>
                    <div className="text-[10px] opacity-50 font-mono mt-0.5">{ch.wordCount || 0} words</div>
                  </button>
                );
              })
            ) : (
              entries.map((entry, idx) => {
                const isCurrent = idx === activeItem.currentEntryIndex;
                return (
                  <button
                    key={entry.id || (entry as any)._id}
                    onClick={() => {
                      setActiveItem({ ...activeItem, currentEntryIndex: idx });
                      setTocDrawerOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`text-left p-2.5 rounded-lg border border-inherit text-xs transition-colors cursor-pointer truncate ${
                      isCurrent ? 'bg-black/15 dark:bg-white/20 font-bold' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-80'
                    }`}
                  >
                    <div className="text-[10px] opacity-60 font-mono">{formatShortDate(entry.date)}</div>
                    <div className="truncate font-serif-reading">{entry.title}</div>
                    <div className="text-[10px] opacity-50 font-mono capitalize mt-0.5">{entry.mood} · {entry.wordCount || 0} words</div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Reading Frame */}
      <main className="max-w-3xl mx-auto py-6">
        {/* Book Reading Experience */}
        {isBook ? (
          chapters.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-inherit rounded-xl p-8 space-y-3">
              <BookOpen className="w-8 h-8 opacity-40 mx-auto" />
              <h3 className="font-bold text-base font-serif-reading">{book?.title}</h3>
              <p className="text-xs opacity-70">This manuscript has no chapters yet.</p>
              {onNavigateToBooks && (
                <button
                  onClick={onNavigateToBooks}
                  className="mt-2 px-3.5 py-1.5 text-xs font-semibold rounded border border-inherit hover:bg-black/5"
                >
                  Edit & Add Chapters in Books
                </button>
              )}
            </div>
          ) : readerMode === 'page' && currentChapter ? (
            /* Page Flip View for Book */
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Chapter Header */}
              <div className="text-center space-y-2 py-6 border-b border-inherit">
                <span className="text-xs font-mono uppercase tracking-widest opacity-60">
                  Chapter {activeItem.currentChapterIndex + 1} of {chapters.length}
                </span>
                <h1 className={`text-2xl sm:text-3xl font-bold tracking-tight font-serif-reading`}>
                  {currentChapter.title}
                </h1>
                <div className="text-xs font-mono opacity-50">
                  <span>{currentChapter.wordCount || 0} words</span>
                  <span className="mx-1.5">·</span>
                  <span>Order {currentChapter.order}</span>
                </div>
              </div>

              {/* Chapter Content Body */}
              <div className={`p-6 sm:p-12 rounded-2xl ${contentBgClasses}`}>
                <article
                  className={`prose max-w-none whitespace-pre-wrap ${fontClass} ${fontSizeClass}`}
                >
                  {currentChapter.content || 'This chapter draft is currently empty.'}
                </article>
              </div>

              {/* Bottom Pagination Controls */}
              <div className="flex items-center justify-between pt-6 border-t border-inherit">
                <button
                  onClick={() => {
                    setActiveItem({
                      ...activeItem,
                      currentChapterIndex: Math.max(0, activeItem.currentChapterIndex - 1),
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={activeItem.currentChapterIndex === 0}
                  className="px-4 py-2 text-xs font-medium border border-inherit rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Chapter</span>
                </button>

                <span className="text-xs font-mono opacity-60">
                  {Math.round(((activeItem.currentChapterIndex + 1) / chapters.length) * 100)}% Read
                </span>

                <button
                  onClick={() => {
                    setActiveItem({
                      ...activeItem,
                      currentChapterIndex: Math.min(chapters.length - 1, activeItem.currentChapterIndex + 1),
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={activeItem.currentChapterIndex === chapters.length - 1}
                  className="px-4 py-2 text-xs font-medium border border-inherit rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <span>Next Chapter</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Continuous Reading View for Book */
            <div className="space-y-16">
              {/* Title Page */}
              <div className="text-center py-12 space-y-3 border-b border-inherit">
                <span className="text-xs uppercase tracking-widest font-mono opacity-60">
                  {book?.genre}
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight font-serif-reading">
                  {book?.title}
                </h1>
                {book?.subtitle && (
                  <p className="text-sm italic opacity-75 font-serif-reading max-w-lg mx-auto">
                    {book.subtitle}
                  </p>
                )}
                <div className="pt-2 text-xs font-mono opacity-50">
                  <span>By {user?.name || 'Author'}</span>
                  <span className="mx-2">·</span>
                  <span>{chapters.length} Chapters</span>
                  <span className="mx-2">·</span>
                  <span>{book?.wordCount?.toLocaleString() || 0} Words</span>
                </div>
              </div>

              {/* Chapters Sequence */}
              <div className="space-y-16 divide-y divide-inherit">
                {chapters.map((ch, idx) => (
                  <section key={ch.id || (ch as any)._id} className="pt-14 first:pt-0 space-y-6">
                    <div className="text-center space-y-1">
                      <span className="text-xs font-mono opacity-60 uppercase tracking-widest">
                        Chapter {idx + 1}
                      </span>
                      <h2 className="text-2xl font-bold tracking-tight font-serif-reading">
                        {ch.title}
                      </h2>
                    </div>

                    <div className={`p-6 sm:p-12 rounded-2xl ${contentBgClasses}`}>
                      <article className={`prose max-w-none whitespace-pre-wrap ${fontClass} ${fontSizeClass}`}>
                        {ch.content || 'Draft in progress.'}
                      </article>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Journal Reading Experience */
          entries.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-inherit rounded-xl p-8 space-y-3">
              <BookMarked className="w-8 h-8 opacity-40 mx-auto" />
              <h3 className="font-bold text-base font-serif-reading">{journal?.title}</h3>
              <p className="text-xs opacity-70">No entries recorded in this journal volume yet.</p>
            </div>
          ) : readerMode === 'page' && currentEntry ? (
            /* Page Flip View for Journal */
            <div className="space-y-8 animate-in fade-in duration-150">
              <div className="text-center space-y-2 py-4">
                <div className="flex items-center justify-center gap-2 text-xs opacity-60 font-mono">
                  <span className="font-semibold">{formatHumanDate(currentEntry.date)}</span>
                  <span>·</span>
                  <span className="capitalize">{currentEntry.mood}</span>
                  {currentEntry.weather && (
                    <>
                      <span>·</span>
                      <span className="capitalize">{currentEntry.weather}</span>
                    </>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-serif-reading">
                  {currentEntry.title}
                </h1>
              </div>

              <div className={`p-6 sm:p-12 rounded-2xl ${contentBgClasses}`}>
                <article className={`prose max-w-none whitespace-pre-wrap ${fontClass} ${fontSizeClass}`}>
                  {currentEntry.content}
                </article>
              </div>

              {/* Page navigation controls */}
              <div className="flex items-center justify-between pt-6 border-t border-inherit">
                <button
                  onClick={() => {
                    setActiveItem({
                      ...activeItem,
                      currentEntryIndex: Math.max(0, activeItem.currentEntryIndex - 1),
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={activeItem.currentEntryIndex === 0}
                  className="px-4 py-2 text-xs font-medium border border-inherit rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous Entry</span>
                </button>

                <span className="text-xs font-mono opacity-60">
                  Page {activeItem.currentEntryIndex + 1} of {entries.length}
                </span>

                <button
                  onClick={() => {
                    setActiveItem({
                      ...activeItem,
                      currentEntryIndex: Math.min(entries.length - 1, activeItem.currentEntryIndex + 1),
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  disabled={activeItem.currentEntryIndex === entries.length - 1}
                  className="px-4 py-2 text-xs font-medium border border-inherit rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-30 cursor-pointer"
                >
                  <span>Next Entry</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Continuous Reading View for Journal */
            <div className="space-y-16">
              <div className="text-center py-10 space-y-2 border-b border-inherit">
                <span className="text-xs font-mono uppercase tracking-widest opacity-60">
                  Life Chronicles
                </span>
                <h1 className="text-3xl sm:text-4xl font-bold font-serif-reading">
                  {journal?.title}
                </h1>
                <p className="text-xs opacity-60 font-mono">
                  {entries.length} Recorded Days · {journal?.wordCount.toLocaleString() || 0} Total Words
                </p>
              </div>

              <div className="space-y-14 divide-y divide-inherit">
                {entries.map((entry, idx) => (
                  <section key={entry.id || (entry as any)._id} className="pt-12 first:pt-0 space-y-4">
                    <div className="flex items-baseline justify-between gap-4 text-xs font-mono opacity-60">
                      <div>
                        <span className="font-bold">{formatHumanDate(entry.date)}</span>
                        <span className="mx-1.5">·</span>
                        <span className="capitalize">{entry.mood}</span>
                      </div>
                      <span>Entry {idx + 1}</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight font-serif-reading">
                      {entry.title}
                    </h2>

                    <div className={`p-6 sm:p-10 rounded-2xl ${contentBgClasses}`}>
                      <article className={`prose max-w-none whitespace-pre-wrap ${fontClass} ${fontSizeClass}`}>
                        {entry.content}
                      </article>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )
        )}
      </main>
    </div>
  );
};
