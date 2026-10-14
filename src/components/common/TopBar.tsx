import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import {
  Search,
  Bell,
  HelpCircle,
  Menu,
  Plus,
  PenLine,
  CheckSquare,
  BookOpen,
  MessageSquare,
  ChevronDown,
  Sparkles,
  CheckCircle,
  ShieldAlert,
  Settings,
  LogOut,
  User,
  X
} from 'lucide-react';

interface TopBarProps {
  currentView: string;
  onOpenMobileSidebar: () => void;
  onNavigate: (view: string, params?: any) => void;
  onSearchGlobal?: (query: string) => void;
}

const VIEW_TITLES: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview & recent reflections' },
  diary: { title: 'Personal Diary', subtitle: 'Daily logs & thoughts' },
  reader: { title: 'Reading Room', subtitle: 'Distraction-free life book' },
  plans: { title: 'Action Plans', subtitle: 'Goals, checklists & deadlines' },
  books: { title: 'Books & Manuscripts', subtitle: 'Long-form chapters & works' },
  skills: { title: 'Skills Library', subtitle: 'Reusable intelligence prompts' },
  chat: { title: 'AI Assistant', subtitle: 'Contextual dialogue & proposals' },
  settings: { title: 'Settings', subtitle: 'Account, AI model & preferences' },
  profile: { title: 'Author Profile', subtitle: 'Personal voice & identity' },
};

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onOpenMobileSidebar,
  onNavigate,
  onSearchGlobal,
}) => {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const createRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createRef.current && !createRef.current.contains(e.target as Node)) {
        setCreateDropdownOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (onSearchGlobal) {
      onSearchGlobal(query);
    } else {
      onNavigate('diary', { search: query });
    }
  };

  const currentInfo = VIEW_TITLES[currentView] || { title: 'LifeNote AI', subtitle: 'Personal Reflection Studio' };

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger + Breadcrumb Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer shrink-0"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex flex-col min-w-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
            <span>LifeNote</span>
            <span>/</span>
            <span className="text-neutral-800 font-medium capitalize">{currentView}</span>
          </div>
          <h1 className="text-sm font-bold tracking-tight text-neutral-900 truncate">
            {currentInfo.title}
          </h1>
        </div>
      </div>

      {/* Middle: Universal Search Bar */}
      <div className="flex-1 max-w-md mx-2 sm:mx-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search diary, plans, books..."
            className="w-full pl-8 pr-12 py-1.5 text-xs bg-neutral-50 hover:bg-neutral-100/80 focus:bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 transition-all"
          />
          <kbd className="hidden sm:inline-block absolute right-2.5 top-2 px-1.5 py-0.5 text-[9px] font-mono text-neutral-400 bg-white border border-neutral-200 rounded shadow-2xs">
            ↵
          </kbd>
        </form>
      </div>

      {/* Right: Quick + Create action, Status, Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Action Button with Dropdown */}
        <div className="relative" ref={createRef}>
          <button
            onClick={() => setCreateDropdownOpen(!createDropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-neutral-800 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New</span>
            <ChevronDown className="w-3 h-3 text-neutral-400" />
          </button>

          {createDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-neutral-200 rounded-xl shadow-lg py-1.5 text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                Create New
              </div>
              <button
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onNavigate('diary', { createNew: true });
                }}
                className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer"
              >
                <div className="w-5 h-5 rounded bg-neutral-100 flex items-center justify-center text-neutral-800">
                  <PenLine className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-medium">Diary Entry</div>
                  <div className="text-[10px] text-neutral-400">Capture daily reflection</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onNavigate('plans', { createNew: true });
                }}
                className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer"
              >
                <div className="w-5 h-5 rounded bg-neutral-100 flex items-center justify-center text-neutral-800">
                  <CheckSquare className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-medium">Action Plan</div>
                  <div className="text-[10px] text-neutral-400">Break down goals & tasks</div>
                </div>
              </button>

              <button
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onNavigate('books', { createNew: true });
                }}
                className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer"
              >
                <div className="w-5 h-5 rounded bg-neutral-100 flex items-center justify-center text-neutral-800">
                  <BookOpen className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-medium">Book & Chapters</div>
                  <div className="text-[10px] text-neutral-400">Write structured manuscripts</div>
                </div>
              </button>

              <div className="border-t border-neutral-100 my-1" />

              <button
                onClick={() => {
                  setCreateDropdownOpen(false);
                  onNavigate('chat', { newChat: true });
                }}
                className="w-full text-left px-3 py-2 text-neutral-800 hover:bg-neutral-50 flex items-center gap-2.5 cursor-pointer"
              >
                <div className="w-5 h-5 rounded bg-neutral-100 flex items-center justify-center text-neutral-800">
                  <MessageSquare className="w-3 h-3" />
                </div>
                <div>
                  <div className="font-medium">AI Discussion</div>
                  <div className="text-[10px] text-neutral-400">Start new AI consultation</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 absolute top-1.5 right-1.5" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg p-3 text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 font-semibold text-neutral-900">
                <span>Recent Updates</span>
                <span className="text-[10px] font-mono text-neutral-400">LifeNote</span>
              </div>
              <div className="space-y-2 py-2">
                <div className="p-2 bg-neutral-50 rounded-lg text-neutral-700">
                  <div className="font-medium text-neutral-900">AI Engine Ready</div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Configured with {user?.selectedModel || 'gemini-3.8-flash'}. You can refine your diary and execute custom skills.
                  </p>
                </div>
                <div className="p-2 bg-neutral-50 rounded-lg text-neutral-700">
                  <div className="font-medium text-neutral-900">Local & Cloud Persistence</div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Your diaries, plans, and chapters are continuously secured and scoped to your profile.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help / Guide Popover */}
        <button
          onClick={() => setHelpOpen(true)}
          className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer hidden sm:block"
          title="Shortcuts & Tips"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* User Account Avatar & Dropdown */}
        <div className="relative" ref={userRef}>
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer group"
          >
            <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <ChevronDown className="w-3 h-3 text-neutral-400 hidden sm:block" />
          </button>

          {userDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-xl shadow-lg py-1.5 text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-3.5 py-2.5 border-b border-neutral-100">
                <p className="font-semibold text-neutral-900 truncate">{user?.name || 'Saad'}</p>
                <p className="text-[11px] text-neutral-500 truncate">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-neutral-500">
                  {user?.isEmailVerified ? (
                    <span className="text-emerald-700 flex items-center gap-1 font-medium">
                      <CheckCircle className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="text-neutral-500 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Active
                    </span>
                  )}
                  <span>·</span>
                  <span className="font-mono text-neutral-400 truncate">{user?.selectedModel || 'gemini-3.8-flash'}</span>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onNavigate('profile');
                  }}
                  className="w-full text-left px-3.5 py-2 text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Author Profile</span>
                </button>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full text-left px-3.5 py-2 text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Settings & AI Config</span>
                </button>

                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onNavigate('reader');
                  }}
                  className="w-full text-left px-3.5 py-2 text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Diary Reader Mode</span>
                </button>
              </div>

              <div className="border-t border-neutral-100 my-1" />

              <button
                onClick={() => {
                  setUserDropdownOpen(false);
                  logout();
                }}
                className="w-full text-left px-3.5 py-2 text-red-600 hover:bg-red-50/50 flex items-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-900" />
                <h3 className="font-bold text-sm text-neutral-900">LifeNote AI Quick Guide</h3>
              </div>
              <button
                onClick={() => setHelpOpen(false)}
                className="text-neutral-400 hover:text-neutral-900 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-600">
              <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
                <div className="font-semibold text-neutral-900">Universal AI Chat with Approvals</div>
                <p className="text-[11px] text-neutral-500">
                  Use the <b>+</b> attachment menu in AI Chat to link existing diaries, plans, or books. The AI proposes changes with preview, requiring your explicit approval before saving.
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
                <div className="font-semibold text-neutral-900">AI Writing Assistant</div>
                <p className="text-[11px] text-neutral-500">
                  In Diary & Books, click <b>AI Improve</b> to refine your prose, fix grammar, adjust tone, expand, or summarize without losing your unique voice.
                </p>
              </div>

              <div className="p-3 bg-neutral-50 rounded-xl space-y-1">
                <div className="font-semibold text-neutral-900">Skills Library</div>
                <p className="text-[11px] text-neutral-500">
                  Create reusable prompt templates and run them on demand or invoke them inside the chat composer.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-semibold hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
