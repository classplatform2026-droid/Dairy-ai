import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import {
  User,
  Shield,
  Sparkles,
  Database,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Key,
  Check,
  RefreshCw,
  Lock,
  Mail,
  ShieldAlert
} from 'lucide-react';

const AI_MODELS = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (Recommended)', desc: 'Fast, highly nuanced for reflective writing & planning' },
  { id: 'gemini-4-argon', name: 'Gemini 4 Argon', desc: 'Flagship reasoning and intricate literary narrative generation' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', desc: 'Ultra-low latency for instant stylistic checks' },
];

interface SettingsViewProps {
  initialTab?: 'all' | 'profile' | 'ai' | 'security' | 'data';
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialTab = 'all' }) => {
  const { user, refreshUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'profile' | 'ai' | 'security' | 'data'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Profile Form
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [writingPreference, setWritingPreference] = useState(user?.writingPreference || 'reflective');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  // Email verification
  const [verifyCode, setVerifyCode] = useState(user?.verificationCode || '');
  const [verifying, setVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  // Security (Password Change)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [securitySaving, setSecuritySaving] = useState(false);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  // AI Configuration
  const [selectedModel, setSelectedModel] = useState(user?.selectedModel || 'gemini-3.8-flash');
  const [customApiKey, setCustomApiKey] = useState('');
  const [testingAI, setTestingAI] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [aiConfigSaving, setAiConfigSaving] = useState(false);

  // Database status
  const [dbStatus, setDbStatus] = useState<any>(null);

  // Deletion modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio || '');
      setWritingPreference(user.writingPreference || 'reflective');
      setSelectedModel(user.selectedModel || 'gemini-3.8-flash');
    }

    const checkHealth = async () => {
      try {
        const res = await api.health();
        setDbStatus(res.database);
      } catch (err) {
        console.error('Failed to get database health:', err);
      }
    };
    checkHealth();
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      await api.auth.updateProfile({ name, bio, writingPreference });
      await refreshUser();
      setProfileMessage('Profile settings saved successfully.');
      setTimeout(() => setProfileMessage(null), 3000);
    } catch (err: any) {
      setProfileMessage(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    setVerifying(true);
    setVerifySuccess(null);
    try {
      const res = await api.auth.verifyEmail(verifyCode);
      await refreshUser();
      setVerifySuccess(res.message);
    } catch (err: any) {
      alert(err.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecuritySaving(true);
    setSecurityMessage(null);
    setSecurityError(null);

    try {
      const res = await api.auth.updateSecurity({ currentPassword, newPassword });
      setSecurityMessage(res.message);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setSecurityMessage(null), 3000);
    } catch (err: any) {
      setSecurityError(err.message || 'Failed to update password.');
    } finally {
      setSecuritySaving(false);
    }
  };

  const handleSaveAIConfig = async () => {
    setAiConfigSaving(true);
    try {
      await api.auth.updateAIConfig({
        selectedModel,
        customApiKey: customApiKey || undefined,
      });
      await refreshUser();
      setCustomApiKey('');
      setAiTestResult({ success: true, message: 'AI configuration updated successfully.' });
      setTimeout(() => setAiTestResult(null), 3000);
    } catch (err: any) {
      setAiTestResult({ success: false, message: err.message || 'Failed to save AI config.' });
    } finally {
      setAiConfigSaving(false);
    }
  };

  const handleTestAIConnection = async () => {
    setTestingAI(true);
    setAiTestResult(null);
    try {
      const res = await api.auth.testAI(selectedModel);
      setAiTestResult(res);
    } catch (err: any) {
      setAiTestResult({ success: false, message: err.message || 'Connection test failed.' });
    } finally {
      setTestingAI(false);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await api.auth.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifenote_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export data:', err);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteInput !== 'DELETE') return;
    setDeleting(true);
    try {
      await api.auth.deleteAccount();
      logout();
    } catch (err: any) {
      alert(err.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Top Header */}
      <div className="pb-4 border-b border-neutral-200">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Settings & Preferences</h1>
        <p className="text-xs text-neutral-500 mt-1">Configure your writing environment, AI intelligence, security, and data</p>

        {/* Tab pills */}
        <div className="flex items-center gap-1.5 mt-6 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Settings' },
            { id: 'profile', label: 'Author Profile' },
            { id: 'ai', label: 'AI & Models' },
            { id: 'security', label: 'Security & Auth' },
            { id: 'data', label: 'Data Management' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                  : 'bg-neutral-100/80 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Profile Section */}
      {(activeTab === 'all' || activeTab === 'profile') && (
        <section className="p-6 border border-neutral-200 rounded-xl bg-white shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
            <User className="w-4 h-4 text-neutral-900" />
            <h2 className="text-sm font-bold text-neutral-900">Profile & Voice</h2>
          </div>

        {profileMessage && (
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-neutral-900 shrink-0" />
            <span>{profileMessage}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3 py-2 text-xs border border-neutral-200 bg-neutral-50 text-neutral-500 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Author Bio / Intent</label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A few words on what you seek to cultivate in this journal..."
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Default Reflection Style</label>
            <select
              value={writingPreference}
              onChange={(e) => setWritingPreference(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none capitalize"
            >
              <option value="reflective">Reflective & Philosophical</option>
              <option value="concise">Concise & Minimalist</option>
              <option value="lyrical">Lyrical & Poetic</option>
              <option value="structured">Structured & Action-Oriented</option>
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Email verification row */}
        <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-medium text-neutral-800">Email Verification:</span>
            {user?.isEmailVerified ? (
              <span className="ml-2 text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="ml-2 text-amber-700 inline-flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Unverified
              </span>
            )}
          </div>

          {!user?.isEmailVerified && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="6-digit code"
                className="w-28 px-2 py-1 text-xs border border-neutral-200 rounded font-mono"
              />
              <button
                type="button"
                onClick={handleVerifyEmail}
                disabled={verifying}
                className="px-3 py-1 bg-neutral-900 text-white rounded text-xs font-medium hover:bg-neutral-800 cursor-pointer"
              >
                {verifying ? 'Verifying...' : 'Verify Email'}
              </button>
            </div>
          )}
        </div>
      </section>
      )}

      {/* 2. AI Intelligence & Provider Configuration */}
      {(activeTab === 'all' || activeTab === 'ai') && (
        <section className="p-6 border border-neutral-200 rounded-xl bg-white shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-neutral-900" />
              <h2 className="text-sm font-bold text-neutral-900">AI Provider & Models</h2>
            </div>
            <span className="text-xs font-mono text-neutral-400">@google/genai</span>
          </div>

          <p className="text-xs text-neutral-600 leading-relaxed">
            LifeNote AI is powered by Google Gemini models for deep reflective writing, automated plan breakdowns, and contextual reasoning.
          </p>

          {aiTestResult && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
              aiTestResult.success ? 'bg-neutral-50 border-neutral-200 text-neutral-900' : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {aiTestResult.success ? <CheckCircle2 className="w-4 h-4 text-neutral-900" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{aiTestResult.message}</span>
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-medium text-neutral-700">Select Reasoning Model</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AI_MODELS.map(m => (
                <div
                  key={m.id}
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedModel === m.id
                      ? 'border-neutral-900 bg-neutral-50 shadow-xs'
                      : 'border-neutral-200 hover:border-neutral-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold text-neutral-900 mb-1">
                    <span>{m.name}</span>
                    {selectedModel === m.id && <Check className="w-3.5 h-3.5 text-neutral-900" />}
                  </div>
                  <p className="text-[11px] text-neutral-500 leading-normal">{m.desc}</p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Custom Gemini API Key (Optional)
              </label>
              <p className="text-[11px] text-neutral-400 mb-1.5">
                Leave blank to use environment default key. Custom keys are encrypted on the server with AES-256-GCM.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder={user?.hasCustomKey ? '•••••••••••••••• (Encrypted on Server)' : 'AIzaSy...'}
                  className="flex-1 px-3 py-2 text-xs font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <button
                  type="button"
                  onClick={handleSaveAIConfig}
                  disabled={aiConfigSaving}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                >
                  {aiConfigSaving ? 'Saving...' : 'Save Config'}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleTestAIConnection}
                disabled={testingAI}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingAI ? 'animate-spin' : ''}`} />
                <span>{testingAI ? 'Testing Connection...' : 'Test AI Connection'}</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. Security (Password change) */}
      {(activeTab === 'all' || activeTab === 'security') && (
        <section className="p-6 border border-neutral-200 rounded-xl bg-white shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
            <Lock className="w-4 h-4 text-neutral-900" />
            <h2 className="text-sm font-bold text-neutral-900">Security & Credentials</h2>
          </div>

          {securityMessage && (
            <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-neutral-900" />
              <span>{securityMessage}</span>
            </div>
          )}

          {securityError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>{securityError}</span>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={securitySaving}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
              >
                {securitySaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 4. Database Status & Storage Persistence */}
      {(activeTab === 'all' || activeTab === 'data') && (
        <section className="p-6 border border-neutral-200 rounded-xl bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-neutral-900" />
              <h2 className="text-sm font-bold text-neutral-900">Database & Persistence</h2>
            </div>
            <span className="text-xs font-mono text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
            </span>
          </div>

          <div className="text-xs text-neutral-600 space-y-1">
            <p>
              <span className="font-semibold text-neutral-800">Storage Engine:</span>{' '}
              {dbStatus?.mode || 'Embedded Persistent Storage'}
            </p>
            <p className="text-[11px] text-neutral-400">
              All user entities, journals, plans, books, and chat history are isolated and safely persisted.
            </p>
          </div>
        </section>
      )}

      {/* 5. Data Management (Export & Permanent Deletion) */}
      {(activeTab === 'all' || activeTab === 'data') && (
        <section className="p-6 border border-neutral-200 rounded-xl bg-white shadow-xs space-y-4">
          <div className="pb-2 border-b border-neutral-100">
            <h2 className="text-sm font-bold text-neutral-900">Data Ownership & Account</h2>
            <p className="text-xs text-neutral-500">You retain 100% ownership of everything you write</p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div>
              <h3 className="text-xs font-semibold text-neutral-900">Export All Personal Content</h3>
              <p className="text-[11px] text-neutral-500">Download a full JSON archive of all your diaries, plans, manuscripts, and skills.</p>
            </div>
            <button
              onClick={handleExportData}
              className="px-3.5 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Archive</span>
            </button>
          </div>

          <div className="pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-semibold text-red-600">Delete Account Permanently</h3>
              <p className="text-[11px] text-neutral-500">Irreversible. All private journals, books, and plans will be expunged.</p>
            </div>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="px-3.5 py-2 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Account</span>
            </button>
          </div>
        </section>
      )}

      {/* Delete Account Safeguard Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-bold text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Confirm Account Deletion</span>
            </h2>

            <p className="text-xs text-neutral-600 leading-relaxed">
              This action cannot be undone. All your entries, chapters, plans, custom skills, and conversation logs will be permanently deleted immediately.
            </p>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Type <span className="font-mono font-bold text-neutral-900">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 text-xs font-mono border border-neutral-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
              >
                {deleting ? 'Expunging Account...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
