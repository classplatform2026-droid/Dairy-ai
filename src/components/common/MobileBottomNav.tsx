import React, { useState } from 'react';
import {
  LayoutDashboard,
  PenLine,
  CheckSquare,
  MessageSquare,
  MoreHorizontal,
  BookOpen,
  Sparkles,
  User,
  Settings,
  BookMarked,
  X
} from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ currentView, onNavigate }) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const primaryTabs = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'diary', label: 'Diary', icon: PenLine },
    { id: 'plans', label: 'Plans', icon: CheckSquare },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
  ];

  return (
    <>
      {/* Fixed bottom navigation bar on mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-neutral-200 px-3 py-1 flex items-center justify-around shadow-sm">
        {primaryTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onNavigate(tab.id);
                setMoreMenuOpen(false);
              }}
              className={`flex flex-col items-center py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                isActive ? 'text-black font-bold' : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Icon className={`w-4 h-4 mb-0.5 ${isActive ? 'text-black stroke-[2.5]' : 'text-neutral-400 stroke-[1.8]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          onClick={() => setMoreMenuOpen(!moreMenuOpen)}
          className={`flex flex-col items-center py-1.5 px-3 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
            moreMenuOpen || ['books', 'skills', 'reader', 'profile', 'settings'].includes(currentView)
              ? 'text-black font-bold'
              : 'text-neutral-500 hover:text-neutral-900'
          }`}
        >
          <MoreHorizontal className="w-4 h-4 mb-0.5" />
          <span>More</span>
        </button>
      </nav>

      {/* 'More' Drawer for secondary sections on mobile */}
      {moreMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-xs flex items-end">
          <div className="w-full bg-white rounded-t-2xl p-5 border-t border-neutral-200 shadow-xl space-y-4 mb-14 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <span className="text-xs font-bold text-neutral-900">More Workspaces</span>
              <button
                onClick={() => setMoreMenuOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  onNavigate('reader');
                  setMoreMenuOpen(false);
                }}
                className="p-3 border border-neutral-200 rounded-xl text-left hover:bg-neutral-50 flex items-center gap-2.5 text-xs font-medium text-neutral-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <BookMarked className="w-3.5 h-3.5 text-neutral-700" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Library & Bookshelf</div>
                  <div className="text-[10px] text-neutral-400">Book covers & reading</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('books');
                  setMoreMenuOpen(false);
                }}
                className="p-3 border border-neutral-200 rounded-xl text-left hover:bg-neutral-50 flex items-center gap-2.5 text-xs font-medium text-neutral-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5 text-neutral-700" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Books</div>
                  <div className="text-[10px] text-neutral-400">Manuscripts & chapters</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('skills');
                  setMoreMenuOpen(false);
                }}
                className="p-3 border border-neutral-200 rounded-xl text-left hover:bg-neutral-50 flex items-center gap-2.5 text-xs font-medium text-neutral-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-neutral-700" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Skills</div>
                  <div className="text-[10px] text-neutral-400">Prompt templates</div>
                </div>
              </button>

              <button
                onClick={() => {
                  onNavigate('settings');
                  setMoreMenuOpen(false);
                }}
                className="p-3 border border-neutral-200 rounded-xl text-left hover:bg-neutral-50 flex items-center gap-2.5 text-xs font-medium text-neutral-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                  <Settings className="w-3.5 h-3.5 text-neutral-700" />
                </div>
                <div>
                  <div className="font-semibold text-neutral-900">Settings</div>
                  <div className="text-[10px] text-neutral-400">AI model & preferences</div>
                </div>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMoreMenuOpen(false)} />
        </div>
      )}
    </>
  );
};
