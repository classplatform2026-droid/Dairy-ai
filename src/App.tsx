import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Sidebar } from './components/common/Sidebar.js';
import { TopBar } from './components/common/TopBar.js';
import { MobileBottomNav } from './components/common/MobileBottomNav.js';
import { AuthView } from './components/auth/AuthView.js';
import { DashboardView } from './components/dashboard/DashboardView.js';
import { DiaryView } from './components/diary/DiaryView.js';
import { DiaryReaderView } from './components/diary/DiaryReaderView.js';
import { PlansView } from './components/plans/PlansView.js';
import { BooksView } from './components/books/BooksView.js';
import { SkillsView } from './components/skills/SkillsView.js';
import { ChatView } from './components/chat/ChatView.js';
import { SettingsView } from './components/settings/SettingsView.js';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [viewParams, setViewParams] = useState<any>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleNavigate = (view: string, params?: any) => {
    setCurrentView(view);
    setViewParams(params || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono text-neutral-400">Loading LifeNote AI...</p>
      </div>
    );
  }

  // If user is not logged in, render minimal AuthView
  if (!user) {
    return (
      <div className="min-h-screen bg-white flex flex-col justify-between">
        <header className="border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs tracking-wider">
              LN
            </div>
            <span className="text-base font-bold tracking-tight text-neutral-900">LifeNote AI</span>
          </div>
          <span className="text-xs text-neutral-400 font-mono hidden sm:inline">Personal Reflection Studio</span>
        </header>

        <AuthView
          initialMode={currentView === 'signup' ? 'signup' : 'login'}
          onSuccess={() => handleNavigate('dashboard')}
        />

        <footer className="border-t border-neutral-100 py-4 text-center text-xs text-neutral-400">
          LifeNote AI · Minimalist Thought & Planning Companion
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 flex">
      {/* 1. Desktop Persistent Sidebar & Mobile Drawer */}
      <Sidebar
        currentView={currentView}
        onNavigate={handleNavigate}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* 2. Main Content Frame (Offset by 16rem / 64 on desktop) */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen pb-16 lg:pb-0">
        {/* Top Header Bar */}
        <TopBar
          currentView={currentView}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          onNavigate={handleNavigate}
        />

        {/* View Router Main Container */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onOpenCreateDiary={() => handleNavigate('diary', { createNew: true })}
              onOpenCreatePlan={() => handleNavigate('plans', { createNew: true })}
              onOpenCreateBook={() => handleNavigate('books', { createNew: true })}
            />
          )}

          {currentView === 'diary' && (
            <DiaryView
              initialSelectedId={viewParams?.selectedId}
              initialCreateNew={viewParams?.createNew}
              onOpenReader={() => handleNavigate('reader')}
            />
          )}

          {currentView === 'reader' && (
            <DiaryReaderView onBack={() => handleNavigate('diary')} />
          )}

          {currentView === 'plans' && (
            <PlansView initialCreateNew={viewParams?.createNew} />
          )}

          {currentView === 'books' && (
            <BooksView
              initialBookId={viewParams?.selectedId}
              initialCreateNew={viewParams?.createNew}
            />
          )}

          {currentView === 'skills' && (
            <SkillsView />
          )}

          {currentView === 'chat' && (
            <ChatView />
          )}

          {currentView === 'profile' && (
            <SettingsView initialTab="profile" />
          )}

          {currentView === 'settings' && (
            <SettingsView initialTab={viewParams?.tab || 'all'} />
          )}
        </main>

        {/* Clean Minimal Desktop/Tablet Footer */}
        <footer className="hidden lg:flex border-t border-neutral-100 py-6 px-8 items-center justify-between text-xs text-neutral-400 max-w-7xl mx-auto w-full mt-auto">
          <span>LifeNote AI — Minimalist Companion for Writers & Thinkers</span>
          <div className="flex items-center gap-4">
            <button onClick={() => handleNavigate('dashboard')} className="hover:text-neutral-900 cursor-pointer">Dashboard</button>
            <span>·</span>
            <button onClick={() => handleNavigate('reader')} className="hover:text-neutral-900 cursor-pointer">Reader Mode</button>
            <span>·</span>
            <button onClick={() => handleNavigate('skills')} className="hover:text-neutral-900 cursor-pointer">Skills</button>
            <span>·</span>
            <button onClick={() => handleNavigate('settings')} className="hover:text-neutral-900 cursor-pointer">Settings</button>
          </div>
        </footer>
      </div>

      {/* 3. Mobile Bottom Navigation */}
      <MobileBottomNav currentView={currentView} onNavigate={handleNavigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
