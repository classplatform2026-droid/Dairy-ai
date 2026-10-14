import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { User, LogOut, Settings as SettingsIcon, BookOpen, CheckCircle, ShieldAlert, Sparkles, ChevronDown } from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenQuickNew?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'diary', label: 'Diary' },
    { id: 'reader', label: 'Reader' },
    { id: 'plans', label: 'Plans' },
    { id: 'books', label: 'Books' },
    { id: 'skills', label: 'Skills' },
    { id: 'chat', label: 'AI Chat' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <button
          onClick={() => onNavigate('dashboard')}
          className="text-lg font-bold tracking-tight text-neutral-900 whitespace-nowrap shrink-0 hover:opacity-80 transition-opacity flex items-center gap-2 cursor-pointer"
        >
          <span>LifeNote AI</span>
        </button>

        {/* Zone 2: Single-line clean text navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-neutral-600">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 ${
                  isActive
                    ? 'text-neutral-950 font-semibold border-b-2 border-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account & Actions */}
        <div className="flex items-center gap-4 shrink-0" ref={dropdownRef}>
          {user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 text-xs font-medium text-neutral-800 hover:text-neutral-950 py-1.5 px-3 rounded-md hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-neutral-900 text-white flex items-center justify-center font-semibold text-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline-block max-w-[120px] truncate">{user.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg py-1.5 text-sm z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="px-3.5 py-2 border-b border-neutral-100">
                    <p className="font-semibold text-neutral-900 truncate">{user.name}</p>
                    <p className="text-xs text-neutral-500 truncate">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
                      {user.isEmailVerified ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="text-amber-700 flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" /> Unverified
                        </span>
                      )}
                      <span>·</span>
                      <span className="font-mono text-[11px] text-neutral-400">{user.selectedModel || 'gemini-3.8-flash'}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onNavigate('settings');
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                  >
                    <SettingsIcon className="w-4 h-4 text-neutral-400" />
                    <span>Settings & AI Config</span>
                  </button>

                  <button
                    onClick={() => {
                      onNavigate('reader');
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4 text-neutral-400" />
                    <span>Diary Reader Mode</span>
                  </button>

                  <div className="border-t border-neutral-100 my-1" />

                  <button
                    onClick={() => {
                      logout();
                      setDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-neutral-700 hover:bg-neutral-50 flex items-center gap-2 cursor-pointer text-red-600 hover:text-red-700"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => onNavigate('login')}
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation row */}
      <div className="md:hidden border-t border-neutral-100 px-4 py-2 flex items-center gap-4 overflow-x-auto text-xs font-medium text-neutral-600 no-scrollbar">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`whitespace-nowrap shrink-0 py-1 ${
                isActive ? 'text-neutral-900 font-semibold border-b-2 border-neutral-900' : 'text-neutral-500'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};
