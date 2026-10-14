import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { BrandLogo } from '../common/BrandLogo.js';
import {
  Eye,
  EyeOff,
  Mail,
  User,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Check,
  RefreshCw
} from 'lucide-react';

interface AuthViewProps {
  initialMode?: 'login' | 'signup';
  onSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ initialMode = 'signup', onSuccess }) => {
  const { login, signup, user, updateUser, refreshUser } = useAuth();

  // Step: 'auth' (Sign up/Login) | 'verify' | 'setName' | 'aiSetup'
  const [step, setStep] = useState<'auth' | 'verify' | 'setName' | 'aiSetup'>('auth');
  const [isLogin, setIsLogin] = useState(initialMode === 'login');

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  // AI Setup Form
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'other'>('gemini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gemini-3.1-flash-lite');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Handle Sign Up or Login
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        onSuccess();
      } else {
        await signup(name || 'Saad', email, password);
        // Advance to Email Verification (Screen 2)
        setStep('verify');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Email verification
  const handleVerifyEmail = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.verifyEmail(verifyCode);
      await refreshUser();
      // Advance to Set Name (Screen 3)
      setStep('setName');
    } catch (err: any) {
      setError(err.message || 'Verification failed. You can skip to next step.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Set Name
  const handleSetName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setStep('aiSetup');
      return;
    }
    setLoading(true);
    try {
      await api.auth.updateProfile({ name: name.trim() });
      await refreshUser();
      setStep('aiSetup');
    } catch {
      setStep('aiSetup');
    } finally {
      setLoading(false);
    }
  };

  // 4. Test AI Connection
  const handleTestAI = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.auth.testAI(aiModel);
      setTestResult(res.message);
    } catch (err: any) {
      setTestResult(err.message || 'Connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  // 5. Complete AI Setup
  const handleCompleteAISetup = async () => {
    setLoading(true);
    try {
      await api.auth.updateAIConfig({
        aiProvider,
        selectedModel: aiModel,
        customApiKey: aiApiKey || undefined,
      });
      await refreshUser();
      onSuccess();
    } catch {
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: 'saad' | 'new') => {
    if (role === 'saad') {
      setEmail('saad@example.com');
      setPassword('password123');
      setName('Saad');
    } else {
      const id = Math.floor(100 + Math.random() * 900);
      setEmail(`writer${id}@example.com`);
      setPassword('password123');
      setName('Eleanor');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">
      {/* Top Bar for Auth Screens */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-neutral-100">
        <BrandLogo size="md" showTagline={true} />
        <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-neutral-400">
          <span>Plan</span>
          <span>·</span>
          <span>Write</span>
          <span>·</span>
          <span>Learn</span>
          <span>·</span>
          <span>Grow</span>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        {/* SCREEN 1: Sign Up / Login (Split Layout with Mountain Hero) */}
        {step === 'auth' && (
          <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 border border-neutral-200 rounded-2xl overflow-hidden shadow-sm bg-white min-h-[580px]">
            {/* Left Form (7 cols) */}
            <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between">
              <div>
                <BrandLogo size="sm" showTagline={true} className="mb-6" />

                <h1 className="text-2xl font-bold tracking-tight text-neutral-900 mb-1">
                  {isLogin ? 'Welcome back' : 'Create your account'}
                </h1>
                <p className="text-xs text-neutral-500 mb-6">
                  {isLogin
                    ? 'Enter your credentials to access your personal workspace.'
                    : 'Start your personal AI workspace today.'}
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Saad"
                        className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Email address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="w-full px-3 py-2 pr-9 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create account'}
                  </button>
                </form>

                {/* Social continue with */}
                <div className="mt-5 text-center">
                  <span className="text-[11px] text-neutral-400 uppercase tracking-wider block mb-3">
                    or continue with
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => fillDemo('saad')}
                      className="py-2 px-3 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-medium text-neutral-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>Google</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillDemo('new')}
                      className="py-2 px-3 border border-neutral-200 hover:bg-neutral-50 rounded-lg text-xs font-medium text-neutral-700 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>GitHub</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom toggle between Login and Sign up */}
              <div className="mt-6 pt-4 border-t border-neutral-100 text-center text-xs text-neutral-500">
                {isLogin ? (
                  <span>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(false);
                        setError(null);
                      }}
                      className="font-semibold text-neutral-900 hover:underline cursor-pointer"
                    >
                      Sign up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogin(true);
                        setError(null);
                      }}
                      className="font-semibold text-neutral-900 hover:underline cursor-pointer"
                    >
                      Log in
                    </button>
                  </span>
                )}
              </div>
            </div>

            {/* Right Hero Image Column (Screen 1 Reference Image) */}
            <div className="hidden lg:block lg:col-span-6 relative bg-neutral-950 overflow-hidden">
              <img
                src="/src/assets/images/mountain_hero_auth_1791976720663.jpg"
                alt="Mountain landscape"
                className="w-full h-full object-cover opacity-90 filter grayscale contrast-125"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30 flex flex-col justify-end p-10 text-white">
                <blockquote className="max-w-sm space-y-2">
                  <p className="text-xl sm:text-2xl font-serif italic font-light tracking-wide leading-snug">
                    "A better version of you starts with a single note."
                  </p>
                  <p className="text-xs text-neutral-300 font-sans uppercase tracking-widest pt-1 font-mono">
                    LifeNote Studio
                  </p>
                </blockquote>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 2: Email Verification (Screen 2 in Reference) */}
        {step === 'verify' && (
          <div className="w-full max-w-md border border-neutral-200 rounded-2xl p-8 bg-white shadow-xs text-center space-y-6 animate-in fade-in duration-200">
            <BrandLogo size="sm" className="justify-center" />

            <div className="w-14 h-14 rounded-full bg-neutral-100 text-neutral-900 flex items-center justify-center mx-auto">
              <Mail className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">Verify your email</h2>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-xs mx-auto">
                We've sent a verification code to <span className="font-semibold text-neutral-800">{email}</span>. Check your inbox and enter it below.
              </p>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</p>
            )}

            <div className="space-y-3">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="6-digit verification code"
                className="w-full px-3 py-2 text-center text-sm font-mono tracking-widest border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />

              <button
                type="button"
                onClick={handleVerifyEmail}
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                {loading ? 'Verifying...' : 'Verify Email'}
              </button>

              <button
                type="button"
                onClick={() => setStep('setName')}
                className="text-xs text-neutral-400 hover:text-neutral-700 underline cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* SCREEN 3: Set Name (Screen 3 in Reference) */}
        {step === 'setName' && (
          <div className="w-full max-w-md border border-neutral-200 rounded-2xl p-8 bg-white shadow-xs text-center space-y-6 animate-in fade-in duration-200">
            <BrandLogo size="sm" className="justify-center" />

            <div className="w-16 h-16 rounded-full bg-neutral-100 text-neutral-900 flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-neutral-700" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900">What should we call you?</h2>
              <p className="text-xs text-neutral-500">
                This will be used in your personal conversations with AI.
              </p>
            </div>

            <form onSubmit={handleSetName} className="space-y-4">
              <div className="text-left">
                <label className="block text-xs font-medium text-neutral-700 mb-1">Your name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Saad"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                Continue
              </button>

              <button
                type="button"
                onClick={() => setStep('aiSetup')}
                className="text-xs text-neutral-400 hover:text-neutral-700 underline cursor-pointer block w-full text-center"
              >
                Skip for now
              </button>
            </form>
          </div>
        )}

        {/* SCREEN 4: Connect Your AI (Screen 4 in Reference) */}
        {step === 'aiSetup' && (
          <div className="w-full max-w-md border border-neutral-200 rounded-2xl p-8 bg-white shadow-xs space-y-5 animate-in fade-in duration-200">
            <div className="text-center space-y-3">
              <BrandLogo size="sm" className="justify-center" />
              <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-neutral-900">Connect Your AI</h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Add your AI provider and API key to get started.
                </p>
              </div>
            </div>

            {testResult && (
              <div className="p-3 rounded-lg text-xs bg-neutral-50 border border-neutral-200 text-neutral-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-neutral-900 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-2">AI Provider</label>
                <div className="space-y-1.5">
                  {[
                    { id: 'gemini', label: 'Google Gemini (Native @google/genai)' },
                    { id: 'openai', label: 'OpenAI (GPT-4o, o1)' },
                    { id: 'anthropic', label: 'Anthropic Claude' },
                    { id: 'other', label: 'Other provider' },
                  ].map(p => (
                    <label
                      key={p.id}
                      onClick={() => setAiProvider(p.id as any)}
                      className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                        aiProvider === p.id ? 'border-neutral-900 bg-neutral-50 font-medium' : 'border-neutral-200 hover:bg-neutral-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        checked={aiProvider === p.id}
                        onChange={() => setAiProvider(p.id as any)}
                        className="text-black focus:ring-0"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">API Key</label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="sk-... or leave empty for environment default"
                  className="w-full px-3 py-2 text-xs font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
                <span className="text-[10px] text-neutral-400 block mt-1">
                  Your key is encrypted and stored securely.
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Model</label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                >
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (High-Speed Recommended)</option>
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Reflective & Narrative)</option>
                  <option value="gemini-4-argon">gemini-4-argon (Flagship Reasoning)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestAI}
                  disabled={testing}
                  className="flex-1 py-2 px-3 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors cursor-pointer"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>

                <button
                  type="button"
                  onClick={handleCompleteAISetup}
                  disabled={loading}
                  className="flex-1 py-2 px-3 bg-black hover:bg-neutral-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Get Started
                </button>
              </div>

              <button
                type="button"
                onClick={onSuccess}
                className="text-xs text-neutral-400 hover:text-neutral-700 underline block text-center w-full pt-1 cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 border-t border-neutral-100 text-center text-xs text-neutral-400">
        LifeNote AI · Your thoughts. Your life. Build a better you.
      </footer>
    </div>
  );
};
