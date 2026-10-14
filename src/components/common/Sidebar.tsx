import React from 'react';
import { BrandLogo } from './BrandLogo.js';
import { useAuth } from '../../context/AuthContext.js';
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
  ShieldCheck
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string, params?: any) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  mobileOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();

  const primaryNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'diary', label: 'Diary', icon: PenLine },
    { id: 'reader', label: 'Reader Mode', icon: BookMarked },
    { id: 'plans', label: 'Plans & Goals', icon: CheckSquare },
    { id: 'books', label: 'Books & Chapters', icon: BookOpen },
  ];

  const intelligenceNav = [
    { id: 'chat', label: 'AI Studio Chat', icon: MessageSquare },
    { id: 'skills', label: 'Skills Library', icon: Sparkles },
  ];

  const systemNav = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'settings', label: 'Settings & Config', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    onNavigate(id);
    if (onCloseMobile) onCloseMobile();
  };

  const content = (
    <div className="h-full flex flex-col justify-between bg-white border-r border-neutral-200/90 px-4 py-5 w-64 select-none">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2 pt-1">
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

        {/* Quick New Entry Button */}
        <button
          onClick={() => handleNavClick('diary')}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-neutral-950 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer group"
        >
          <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-200" />
          <span>New Journal Entry</span>
        </button>

        {/* Section 1: Main Workspaces */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase font-mono">
            Workspaces
          </div>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-neutral-950 text-white font-semibold shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100/70 hover:text-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              </button>
            );
          })}
        </div>

        {/* Section 2: AI Intelligence */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase font-mono">
            Intelligence
          </div>
          {intelligenceNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-neutral-950 text-white font-semibold shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100/70 hover:text-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              </button>
            );
          })}
        </div>

        {/* Section 3: System & Profile */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-neutral-400 uppercase font-mono">
            Preferences
          </div>
          {systemNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-neutral-950 text-white font-semibold shadow-xs'
                    : 'text-neutral-600 hover:bg-neutral-100/70 hover:text-neutral-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* User Footer Profile Card */}
      <div className="pt-4 border-t border-neutral-100">
        <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50/80 border border-neutral-200/60">
          <button
            onClick={() => handleNavClick('profile')}
            className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group flex-1"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
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
