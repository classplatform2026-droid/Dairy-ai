import React, { useEffect, useState } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  PenLine,
  CheckSquare,
  BookOpen,
  Sparkles,
  MessageSquare,
  Plus,
  ArrowRight,
  Calendar,
  Clock,
  BookMarked
} from 'lucide-react';
import { DiaryEntry, Plan, Book, Chat } from '../../types/index.js';

interface DashboardViewProps {
  onNavigate: (view: string, params?: any) => void;
  onOpenCreateDiary: () => void;
  onOpenCreatePlan: () => void;
  onOpenCreateBook: () => void;
}

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
  const [recentChats, setRecentChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const data = await api.dashboard.get();
      setStats(data.stats);
      setRecentDiaries(data.recentDiaries || []);
      setActivePlans(data.activePlans || []);
      setBooks(data.books || []);
      setRecentChats(data.recentChats || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-neutral-100 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-neutral-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'Saad';

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Greeting Header (Screen 5 Reference) */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Good morning, {firstName}
        </h1>
        <p className="text-xs sm:text-sm text-neutral-500 mt-1">
          Let's make today productive and meaningful.
        </p>
      </div>

      {/* 4 Primary Stat Cards Row (Screen 5 Reference) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat 1: Diary Entries */}
        <div
          onClick={() => onNavigate('diary')}
          className="p-5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-2">
            <span className="w-5 h-5 rounded bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-[10px]">
              D
            </span>
            <span>Diary Entries</span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
            {stats?.totalEntries || 12}
          </div>
        </div>

        {/* Stat 2: Active Plans */}
        <div
          onClick={() => onNavigate('plans')}
          className="p-5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-2">
            <span className="w-5 h-5 rounded bg-neutral-100 text-neutral-700 flex items-center justify-center font-bold text-[10px]">
              P
            </span>
            <span>Active Plans</span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
            {stats?.totalPlans || 3}
          </div>
        </div>

        {/* Stat 3: Books */}
        <div
          onClick={() => onNavigate('books')}
          className="p-5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-2">
            <BookOpen className="w-4 h-4 text-neutral-600" />
            <span>Books</span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
            {stats?.totalBooks || 2}
          </div>
        </div>

        {/* Stat 4: Skills */}
        <div
          onClick={() => onNavigate('skills')}
          className="p-5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 mb-2">
            <Sparkles className="w-4 h-4 text-neutral-600" />
            <span>Skills</span>
          </div>
          <div className="text-3xl font-bold tracking-tight text-neutral-900 font-mono tabular-nums">
            6
          </div>
        </div>
      </div>

      {/* Main Split: Recent Activity (65%) vs Quick Actions (35%) (Screen 5 Reference) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Activity (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-neutral-900">Recent Activity</h2>
            <button
              onClick={() => onNavigate('diary')}
              className="text-xs text-neutral-500 hover:text-neutral-900 cursor-pointer"
            >
              View all
            </button>
          </div>

          <div className="space-y-2.5">
            {recentDiaries.slice(0, 3).map((d) => (
              <div
                key={d.id || (d as any)._id}
                onClick={() => onNavigate('diary', { selectedId: d.id || (d as any)._id })}
                className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <PenLine className="w-4 h-4 text-neutral-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black">
                      {d.title}
                    </h3>
                    <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                      {d.content}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-3">
                  {d.date}
                </span>
              </div>
            ))}

            {activePlans.slice(0, 2).map((p) => (
              <div
                key={p.id || (p as any)._id}
                onClick={() => onNavigate('plans')}
                className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <CheckSquare className="w-4 h-4 text-neutral-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black">
                      {p.title}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {p.tasks?.length || 0} tasks · {p.progress}% completed
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-3">
                  {p.deadline ? `Due ${p.deadline}` : 'In progress'}
                </span>
              </div>
            ))}

            {books.slice(0, 1).map((b) => (
              <div
                key={b.id || (b as any)._id}
                onClick={() => onNavigate('books', { selectedId: b.id || (b as any)._id })}
                className="p-4 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-neutral-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black">
                      {b.title}
                    </h3>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {b.chapterCount || 0} chapters · {b.genre}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono text-neutral-400 shrink-0 ml-3">
                  Manuscript
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Quick Actions (4 cols, Screen 5 Reference) */}
        <div className="lg:col-span-4 space-y-4">
          <h2 className="text-sm font-bold tracking-tight text-neutral-900">Quick Actions</h2>

          <div className="space-y-2.5">
            <button
              onClick={onOpenCreateDiary}
              className="w-full p-3.5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all cursor-pointer text-left flex items-center gap-3 text-xs font-semibold text-neutral-900 shadow-xs"
            >
              <div className="w-7 h-7 rounded-md bg-black text-white flex items-center justify-center shrink-0">
                <PenLine className="w-3.5 h-3.5" />
              </div>
              <span>New Diary Entry</span>
            </button>

            <button
              onClick={onOpenCreatePlan}
              className="w-full p-3.5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all cursor-pointer text-left flex items-center gap-3 text-xs font-semibold text-neutral-900 shadow-xs"
            >
              <div className="w-7 h-7 rounded-md bg-neutral-100 text-neutral-900 flex items-center justify-center shrink-0">
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <span>New Plan</span>
            </button>

            <button
              onClick={onOpenCreateBook}
              className="w-full p-3.5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all cursor-pointer text-left flex items-center gap-3 text-xs font-semibold text-neutral-900 shadow-xs"
            >
              <div className="w-7 h-7 rounded-md bg-neutral-100 text-neutral-900 flex items-center justify-center shrink-0">
                <BookOpen className="w-3.5 h-3.5" />
              </div>
              <span>Add Book</span>
            </button>

            <button
              onClick={() => onNavigate('chat')}
              className="w-full p-3.5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all cursor-pointer text-left flex items-center gap-3 text-xs font-semibold text-neutral-900 shadow-xs"
            >
              <div className="w-7 h-7 rounded-md bg-neutral-100 text-neutral-900 flex items-center justify-center shrink-0">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <span>New Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
