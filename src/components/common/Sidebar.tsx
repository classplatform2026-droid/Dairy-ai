import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import {
  LayoutDashboard,
  PenLine,
  CheckSquare,
  BookOpen,
  BookMarked,
  Sparkles,
  MessageSquare,
  User,
  Settings,
  LogOut,
  X,
  Plus,
  ChevronRight,
  ShieldCheck,
  Trash2,
  Lightbulb
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  activeChatId?: string;
  onNavigate: (view: string, params?: any) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeChatId,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  const fetchChats = async () => {
    try {
      setLoadingChats(true);
      const res = await api.chats.list();
      setRecentChats(res.chats || []);
    } catch (e) {
      // silently handle
    } finally {
      setLoadingChats(false);
    }
  };

  useEffect(() => {
    fetchChats();
    const handleUpdate = () => fetchChats();
    window.addEventListener('lifenote:chats-changed', handleUpdate);
    return () => window.removeEventListener('lifenote:chats-changed', handleUpdate);
  }, []);

  const primaryNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'diary', label: 'Diary', icon: PenLine },
    { id: 'reader', label: 'Library & Bookshelf', icon: BookMarked },
    { id: 'ideas', label: 'Ideas Studio', icon: Lightbulb },
    { id: 'plans', label: 'Plans & Goals', icon: CheckSquare },
    { id: 'books', label: 'Books & Chapters', icon: BookOpen },
    { id: 'skills', label: 'Skills Library', icon: Sparkles },
  ];

  const handleNavClick = (id: string, params?: any) => {
    onNavigate(id, params);
    if (onCloseMobile) onCloseMobile();
  };

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversation thread?')) {
      try {
        await api.chats.delete(id);
        setRecentChats(prev => prev.filter(c => (c.id || c._id) !== id));
        window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));
        if (currentView === 'chat' && activeChatId === id) {
          handleNavClick('chat', { createNew: true });
        }
      } catch (err) {
        console.error('Failed to delete chat:', err);
      }
    }
  };

  const content = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-neutral-200/90 px-3.5 py-4 w-64 select-none">
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1 shrink-0">
          <button
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-2xs group-hover:bg-neutral-800 transition-colors">
              LN
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-neutral-900 group-hover:text-black">
                LifeNote AI
              </span>
              <span className="text-[10px] text-neutral-400 font-mono tracking-normal">
                Reflection & Planning
              </span>
            </div>
          </button>

          {mobileOpen && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-neutral-400 hover:text-neutral-900 rounded-md hover:bg-neutral-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* New Chat Primary Action Button */}
        <button
          onClick={() => handleNavClick('chat', { createNew: true })}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer group shrink-0"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
            <span>New Chat</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400 opacity-80">AI</span>
        </button>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Main Workspaces */}
          <div className="space-y-0.5">
            <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase font-mono">
              Workspaces
            </div>
            {primaryNav.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 text-neutral-400" />}
                </button>
              );
            })}
          </div>

          {/* Chat History Section (Conversations in Existing Sidebar) */}
          <div className="space-y-0.5 pt-2 border-t border-neutral-100">
            <div className="flex items-center justify-between px-2.5 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase font-mono">
              <span>Chat History</span>
              <button
                onClick={() => handleNavClick('chat', { createNew: true })}
                className="hover:text-neutral-900 cursor-pointer p-0.5 rounded"
                title="Start new conversation"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {loadingChats && recentChats.length === 0 ? (
              <div className="space-y-1.5 px-2.5 py-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-6 bg-neutral-100 rounded animate-pulse" />
                ))}
              </div>
            ) : recentChats.length === 0 ? (
              <div className="px-2.5 py-2 text-[11px] text-neutral-400 text-center italic">
                No past conversations
              </div>
            ) : (
              <div className="space-y-0.5">
                {recentChats.slice(0, 15).map((chat, idx) => {
                  const chatId = chat.id || chat._id;
                  const isCurrent = currentView === 'chat' && activeChatId === chatId;

                  return (
                    <div
                      key={chatId ? `${chatId}-${idx}` : `chat-${idx}`}
                      onClick={() => handleNavClick('chat', { chatId })}
                      className={`group relative flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-neutral-100 text-neutral-900 font-semibold'
                          : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        <MessageSquare className={`w-3 h-3 shrink-0 ${isCurrent ? 'text-neutral-900' : 'text-neutral-400'}`} />
                        <span className="truncate">{chat.title || 'Untitled conversation'}</span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteChat(chatId, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-red-600 rounded transition-opacity shrink-0 ml-1"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Footer Profile Card */}
      <div className="pt-3 border-t border-neutral-100 shrink-0">
        <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 border border-neutral-200/60">
          <button
            onClick={() => handleNavClick('profile')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group flex-1"
          >
            <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-neutral-900 truncate flex items-center gap-1">
                <span>{user?.name || 'Saad'}</span>
                {user?.isEmailVerified && (
                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400 truncate font-mono">
                {user?.email || 'user@lifenote.ai'}
              </div>
            </div>
          </button>

          <button
            onClick={logout}
            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors cursor-pointer shrink-0 ml-1"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Fixed Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-30 w-64">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex">
          <div className="w-64 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {content}
          </div>
          <div className="flex-1" onClick={onCloseMobile} />
        </div>
      )}
    </>
  );
};
