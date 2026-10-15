import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { Chat, Message, Attachment, ActionProposal } from '../../types/index.js';
import {
  Plus,
  ArrowUp,
  Mic,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Paperclip,
  X,
  Check,
  Copy,
  Edit2
} from 'lucide-react';

const CHAT_MODES = [
  { id: 'default', label: 'Default', desc: 'General conversational assistant' },
  { id: 'diary', label: 'Diary Mode', desc: 'Reflective companion & journal drafting' },
  { id: 'plan', label: 'Plan Mode', desc: 'Strategic breakdown & task harvesting' },
  { id: 'book', label: 'Book Mode', desc: 'Narrative expansion & chapter sculpting' },
] as const;

import { getTodayDateString } from '../../utils/date.js';

function deduplicateMessages(messages: Message[]): Message[] {
  const seen = new Set<string>();
  const result: Message[] = [];
  for (const m of messages) {
    const id = m.id || (m as any)._id;
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    result.push(m);
  }
  return result;
}

function getCleanDisplayContent(content: string): string {
  if (!content) return '';
  let trimmed = content.trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  if (trimmed.startsWith('{') && (trimmed.includes('"reply"') || trimmed.includes('"message"') || trimmed.includes('"content"') || trimmed.includes('"response"') || trimmed.includes('"text"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      const possibleKeys = ['reply', 'response', 'content', 'message', 'text', 'answer'];
      for (const k of possibleKeys) {
        if (typeof parsed[k] === 'string' && parsed[k].trim()) {
          return parsed[k].trim();
        }
      }
    } catch {
      const m = trimmed.match(/"(?:reply|response|content|message|text)"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
      if (m) {
        try {
          return JSON.parse(`"${m[1]}"`);
        } catch {
          return m[1];
        }
      }
    }
  }
  return content;
}

interface ChatViewProps {
  initialPrompt?: string;
  initialMode?: string;
  selectedChatId?: string;
  initialCreateNew?: boolean;
  onChatSelected?: (chatId: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  initialPrompt,
  initialMode,
  selectedChatId,
  initialCreateNew,
  onChatSelected,
}) => {
  const { user } = useAuth();
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Composer states (matching Dashboard input field)
  const [messageInput, setMessageInput] = useState('');
  const [selectedMode, setSelectedMode] = useState<'default' | 'diary' | 'book' | 'plan'>('default');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');

  // Available resources to attach
  const [activeAttachTab, setActiveAttachTab] = useState<'diaries' | 'plans' | 'books' | 'skills'>('diaries');
  const [availableDiaries, setAvailableDiaries] = useState<any[]>([]);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [availableBooks, setAvailableBooks] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);

  // Action Proposal Modal / Approval State
  const [proposalModal, setProposalModal] = useState<{
    messageId: string;
    proposal: ActionProposal;
    editableData: any;
  } | null>(null);
  const [applyingAction, setApplyingAction] = useState(false);
  const [applySuccessNotice, setApplySuccessNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Close menus on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages]);

  // Load chat detail
  const loadChatDetail = async (chatId: string) => {
    try {
      setLoading(true);
      const res = await api.chats.get(chatId);
      if (res.chat) {
        setActiveChat({
          ...res.chat,
          messages: deduplicateMessages(res.chat.messages || []),
        });
        if (res.chat.mode) {
          setSelectedMode(res.chat.mode as any);
        }
      }
      if (onChatSelected) {
        onChatSelected(chatId);
      }
    } catch (err) {
      console.error('Failed to load chat thread:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAttachableResources = async () => {
    try {
      const [d, p, b, s] = await Promise.all([
        api.diaries.list(),
        api.plans.list(),
        api.books.list(),
        api.skills.list(),
      ]);
      setAvailableDiaries(d.entries || []);
      setAvailablePlans(p.plans || []);
      setAvailableBooks(b.books || []);
      setAvailableSkills(s.skills || []);
    } catch (err) {
      console.error('Failed to load attachable items:', err);
    }
  };

  const promptProcessedRef = useRef(false);

  // Initial prompt handling or load selectedChatId
  useEffect(() => {
    loadAttachableResources();

    if (initialPrompt && !promptProcessedRef.current) {
      promptProcessedRef.current = true;
      const sendInitialPrompt = async () => {
        try {
          setLoading(true);
          const mode = (initialMode as any) || 'default';
          const newChat = await api.chats.create({
            title: initialPrompt.slice(0, 36) + (initialPrompt.length > 36 ? '...' : ''),
            mode,
          });
          const chatId = newChat.chat.id || (newChat.chat as any)._id;
          setActiveChat({ ...newChat.chat, messages: [] });
          if (onChatSelected) onChatSelected(chatId);
          window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));

          setSending(true);
          setLoading(false);
          const res = await api.chats.sendMessage(chatId, { content: initialPrompt.trim() });
          setActiveChat(prev => {
            if (!prev) return null;
            return {
              ...prev,
              messages: deduplicateMessages([...(prev.messages || []), res.userMessage, res.assistantMessage]),
            };
          });
          window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));
        } catch (err) {
          console.error('Failed to dispatch initial prompt:', err);
        } finally {
          setSending(false);
          setLoading(false);
        }
      };
      sendInitialPrompt();
      return;
    }

    if (initialCreateNew) {
      handleCreateNewChat();
      return;
    }

    if (selectedChatId) {
      const currentId = activeChat?.id || (activeChat as any)?._id;
      if (currentId !== selectedChatId) {
        loadChatDetail(selectedChatId);
      }
      return;
    }

    // Default: load recent conversation if any
    const loadInitial = async () => {
      try {
        setLoading(true);
        const res = await api.chats.list();
        if (res.chats && res.chats.length > 0) {
          const firstId = res.chats[0].id || (res.chats[0] as any)._id;
          loadChatDetail(firstId);
        } else {
          setActiveChat(null);
          setLoading(false);
        }
      } catch (e) {
        setLoading(false);
      }
    };
    loadInitial();
  }, [selectedChatId, initialCreateNew]);

  const handleCreateNewChat = async (mode: 'default' | 'diary' | 'book' | 'plan' = 'default') => {
    try {
      setLoading(true);
      const res = await api.chats.create({
        title: 'New Conversation',
        mode,
      });
      const chatId = res.chat.id || (res.chat as any)._id;
      setActiveChat({ ...res.chat, messages: [] });
      setSelectedMode(mode);
      setMessageInput('');
      setAttachments([]);
      if (onChatSelected) onChatSelected(chatId);
      window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));
      textareaRef.current?.focus();
    } catch (err) {
      console.error('Failed to create chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTitle = async () => {
    if (!activeChat || !editedTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }
    const chatId = activeChat.id || (activeChat as any)._id;
    try {
      await api.chats.update(chatId, { title: editedTitle.trim() });
      setActiveChat({ ...activeChat, title: editedTitle.trim() });
      window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));
    } catch (err) {
      console.error('Failed to rename chat:', err);
    } finally {
      setIsEditingTitle(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || messageInput).trim();
    if (!text || sending) return;

    let currentChatId = activeChat?.id || (activeChat as any)?._id;

    // Create chat on the fly if none selected
    if (!currentChatId) {
      try {
        const newChat = await api.chats.create({
          title: text.slice(0, 36) + (text.length > 36 ? '...' : ''),
          mode: selectedMode,
        });
        currentChatId = newChat.chat.id || (newChat.chat as any)._id;
        setActiveChat({ ...newChat.chat, messages: [] });
        if (onChatSelected) onChatSelected(currentChatId);
        window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));
      } catch (err) {
        console.error('Failed to initialize conversation:', err);
        return;
      }
    }

    const payload = {
      content: text,
      attachments: attachments.length > 0 ? attachments : undefined,
      clientDate: getTodayDateString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    setSending(true);
    setMessageInput('');
    setAttachments([]);

    try {
      const res = await api.chats.sendMessage(currentChatId, payload);
      setActiveChat(prev => {
        if (!prev) return prev;
        const msgs = prev.messages || [];
        return {
          ...prev,
          messages: deduplicateMessages([...msgs, res.userMessage, res.assistantMessage]),
        };
      });
      window.dispatchEvent(new CustomEvent('lifenote:chats-changed'));
    } catch (err: any) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Attach a resource
  const toggleAttach = (item: { type: 'diary' | 'plan' | 'book' | 'skill'; id: string; title: string }) => {
    if (attachments.some(a => a.id === item.id)) {
      setAttachments(attachments.filter(a => a.id !== item.id));
    } else {
      setAttachments([...attachments, item]);
    }
  };

  // Voice speech-to-text dictation
  const handleToggleVoice = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript;
        if (transcript) {
          setMessageInput(prev => (prev ? `${prev.trim()} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Open proposal approval modal
  const openProposalReview = (messageId: string, proposal: ActionProposal) => {
    const dataCopy = JSON.parse(JSON.stringify(proposal.data || {}));
    if (!dataCopy.content) {
      dataCopy.content = dataCopy.text || dataCopy.entry || dataCopy.body || dataCopy.notes || '';
    }
    setProposalModal({
      messageId,
      proposal,
      editableData: dataCopy,
    });
  };

  // Approve & Apply Action
  const handleApproveAction = async (targetMessageId?: string, targetData?: any) => {
    if (!activeChat) return;
    const msgId = targetMessageId || proposalModal?.messageId;
    const data = targetData || proposalModal?.editableData;
    if (!msgId) return;

    setApplyingAction(true);
    const chatId = activeChat.id || (activeChat as any)._id;

    try {
      const res = await api.chats.applyAction(chatId, msgId, data, getTodayDateString());
      setApplySuccessNotice(res.message);

      // Update message in state to status 'applied'
      setActiveChat(prev => {
        if (!prev) return prev;
        const updated = (prev.messages || []).map(m => {
          if ((m.id || (m as any)._id) === msgId && m.actionProposal) {
            return {
              ...m,
              actionProposal: { ...m.actionProposal, status: 'applied' as const },
            };
          }
          return m;
        });
        return { ...prev, messages: updated };
      });

      setProposalModal(null);
      setTimeout(() => setApplySuccessNotice(null), 4000);
      loadAttachableResources();
    } catch (err: any) {
      console.error('Failed to apply proposal:', err);
    } finally {
      setApplyingAction(false);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const currentModeObj = CHAT_MODES.find(m => m.id === selectedMode) || CHAT_MODES[0];
  const firstName = user?.name ? user.name.split(' ')[0] : 'there';
  const hasMessages = activeChat && activeChat.messages && activeChat.messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] -mx-4 sm:-mx-8 -my-6 sm:-my-8 bg-white relative">
      {/* 1. Claude AI Clean Top Navigation Bar */}
      <header className="h-12 border-b border-neutral-100 px-4 sm:px-8 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-xs z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="text-xs font-semibold px-2 py-0.5 border border-neutral-300 rounded focus:outline-none"
                autoFocus
              />
              <button onClick={handleSaveTitle} className="p-1 hover:text-black">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group cursor-pointer" onClick={() => {
              if (activeChat) {
                setEditedTitle(activeChat.title || 'New Conversation');
                setIsEditingTitle(true);
              }
            }}>
              <span className="text-xs sm:text-sm font-semibold text-neutral-800 truncate max-w-xs sm:max-w-md">
                {activeChat?.title || 'New Conversation'}
              </span>
              <Edit2 className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          )}
          <span className="text-neutral-300">·</span>
          <span className="text-[11px] text-neutral-400 font-mono capitalize">
            {currentModeObj.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreateNewChat(selectedMode)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-300 rounded-full transition-colors cursor-pointer bg-white"
            title="Start new conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>
      </header>

      {/* Success banner if action applied */}
      {applySuccessNotice && (
        <div className="mx-4 sm:mx-auto max-w-2xl mt-3 p-3 bg-neutral-900 text-white rounded-xl text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-150 z-20">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{applySuccessNotice}</span>
          </div>
          <button onClick={() => setApplySuccessNotice(null)} className="text-neutral-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Conversation Feed or Minimal Empty State */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        {loading ? (
          <div className="max-w-2xl mx-auto py-16 space-y-3">
            <div className="h-6 w-48 bg-neutral-100 rounded-lg animate-pulse" />
            <div className="h-24 bg-neutral-100 rounded-2xl animate-pulse" />
          </div>
        ) : !hasMessages ? (
          /* Claude AI Minimal Centered Empty State */
          <div className="max-w-2xl mx-auto h-full flex flex-col justify-center items-center text-center py-12 px-4 animate-in fade-in duration-300">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-sm tracking-wider mb-5 shadow-sm">
              LN
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-2">
              Good morning, {firstName}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-md mb-8 leading-relaxed">
              Where thoughts take form. What would you like to reflect on, draft, or organize today?
            </p>

            {/* Minimal Claude-style Suggestion Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl text-left">
              <button
                type="button"
                onClick={() => handleSendMessage('Help me review my day and extract 3 key takeaways.')}
                className="p-3 border border-neutral-200/90 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all text-xs text-neutral-700 cursor-pointer text-left shadow-2xs group"
              >
                <p className="font-semibold text-neutral-900 group-hover:text-black mb-0.5">Reflect on my day</p>
                <p className="text-[11px] text-neutral-400">Extract insights & wins from thoughts</p>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Break down my top weekly goals into a checklist with deadlines.')}
                className="p-3 border border-neutral-200/90 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all text-xs text-neutral-700 cursor-pointer text-left shadow-2xs group"
              >
                <p className="font-semibold text-neutral-900 group-hover:text-black mb-0.5">Strategic Plan Breakdown</p>
                <p className="text-[11px] text-neutral-400">Turn broad goals into actionable steps</p>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Draft an evocative opening scene for my next book chapter.')}
                className="p-3 border border-neutral-200/90 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all text-xs text-neutral-700 cursor-pointer text-left shadow-2xs group"
              >
                <p className="font-semibold text-neutral-900 group-hover:text-black mb-0.5">Creative Chapter Hook</p>
                <p className="text-[11px] text-neutral-400">Expand memoirs or book storylines</p>
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage('Polish my draft with elegant cadence and literary flow.')}
                className="p-3 border border-neutral-200/90 hover:border-neutral-300 rounded-xl bg-white hover:bg-neutral-50/70 transition-all text-xs text-neutral-700 cursor-pointer text-left shadow-2xs group"
              >
                <p className="font-semibold text-neutral-900 group-hover:text-black mb-0.5">Prose Polisher</p>
                <p className="text-[11px] text-neutral-400">Refine grammar, cadence, and elegance</p>
              </button>
            </div>
          </div>
        ) : (
          /* Message Thread (Claude AI Typography & Margins) */
          <div className="max-w-3xl mx-auto space-y-7 pb-6">
            {activeChat!.messages!.map((msg, index) => {
              const isUser = msg.role === 'user';
              const msgId = msg.id || (msg as any)._id || 'msg';
              const uniqueKey = `${msgId}-${index}`;

              return (
                <div
                  key={uniqueKey}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}
                >
                  {/* User / Assistant Tag */}
                  <div className="flex items-center gap-2 mb-1.5 px-1 text-[11px] text-neutral-400 font-medium">
                    <span>{isUser ? 'You' : 'LifeNote AI'}</span>
                    {!isUser && msg.detectedIntent && (
                      <>
                        <span>·</span>
                        <span className="font-mono uppercase text-[10px] text-neutral-500">
                          {msg.detectedIntent.type}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] text-sm leading-relaxed ${
                      isUser
                        ? 'bg-neutral-100 text-neutral-900 rounded-2xl px-4 py-3'
                        : 'bg-transparent text-neutral-900 rounded-2xl px-1 py-1'
                    }`}
                  >
                    {/* Attached Items Indicator */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 pb-2 border-b border-neutral-200/60 flex items-center gap-1.5 flex-wrap">
                        <Paperclip className="w-3 h-3 text-neutral-400" />
                        {msg.attachments.map((att, attIdx) => (
                          <span
                            key={att.id ? `${att.id}-${attIdx}` : `att-${attIdx}`}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 truncate max-w-[160px]"
                          >
                            {att.type.toUpperCase()}: {att.title}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Content with Claude-style readable typography */}
                    <div className="whitespace-pre-wrap font-sans text-sm sm:text-[15px] leading-relaxed text-neutral-800">
                      {getCleanDisplayContent(msg.content)}
                    </div>

                    {/* Action Proposal Card (Approval Flow) */}
                    {!isUser && msg.actionProposal && (() => {
                      const proposalType = String(msg.actionProposal.type || '').toLowerCase();
                      const isPlan = proposalType.includes('plan');
                      const isChapter = proposalType.includes('chapter') || proposalType.includes('book');
                      const isSkill = proposalType.includes('skill');
                      const isDiary = !isPlan && !isChapter && !isSkill;

                      const diaryDate = msg.actionProposal.data?.date || getTodayDateString();

                      let entryContent = (
                        msg.actionProposal.data?.content ||
                        msg.actionProposal.data?.text ||
                        msg.actionProposal.data?.entry ||
                        msg.actionProposal.data?.body ||
                        msg.actionProposal.data?.notes ||
                        ''
                      ).trim();

                      const prevMsg = index > 0 ? activeChat?.messages?.[index - 1] : null;
                      const rawUser = (prevMsg && prevMsg.role === 'user' ? prevMsg.content : '') || '';
                      const isRawBrief = !entryContent ||
                        (rawUser && entryContent.toLowerCase() === rawUser.trim().toLowerCase()) ||
                        entryContent.split(/\s+/).length < 8;

                      if (isRawBrief && isDiary) {
                        const raw = rawUser || entryContent || msg.content || '';
                        const isBengali = /[\u0980-\u09FF]/.test(raw) || /posondo|valo|kemon|kori|din|mon|amar/i.test(raw);
                        entryContent = isBengali
                          ? `আজকের দিনটি ছিল এক নীরব আত্মোপলব্ধির মুহূর্ত। "${raw}"—নিজের ভেতরের সৎ চিন্তা ও ভাবনার সাথে নতুন করে পরিচয় হলো। মানুষের মনের দ্বিচারিতা কিংবা সীমাবদ্ধতাগুলোকে অকপটে স্বীকার করে নেওয়াই আত্মউন্নয়নের প্রথম ধাপ। নিজের অনুভূতিগুলোকে উপলব্ধি করে সামনে এগিয়ে যাওয়ার এই প্রয়াস জীবনকে আরও অর্থবহ ও সুন্দর করে তোলে।`
                          : `Today brought a moment of quiet personal reflection and honest contemplation on "${raw}". Acknowledging these inner feelings and habits is the essential foundation for growth.`;
                      }

                      const isBengaliEntry = /[\u0980-\u09FF]/.test(entryContent);
                      const entryTitle = isDiary
                        ? (msg.actionProposal.data?.title && !msg.actionProposal.data.title.startsWith('Journal: 202')
                            ? msg.actionProposal.data.title
                            : (isBengaliEntry ? 'আত্মোপলব্ধি ও ভাবনার নতুন দিগন্ত' : `Reflections: ${diaryDate}`))
                        : isPlan
                        ? (msg.actionProposal.data?.planTitle || msg.actionProposal.data?.title || 'Action Plan')
                        : isChapter
                        ? (msg.actionProposal.data?.chapterTitle || msg.actionProposal.data?.title || 'Book Chapter Draft')
                        : isSkill
                        ? (msg.actionProposal.data?.name || 'Custom AI Skill')
                        : (msg.actionProposal.targetName || 'Journal Entry');

                      const proposalLabel = isDiary
                        ? 'Journal Entry Proposal'
                        : isPlan
                        ? 'Action Plan Breakdown'
                        : isChapter
                        ? 'Book Chapter Draft'
                        : isSkill
                        ? 'Custom AI Skill'
                        : 'Action Proposal';

                      return (
                        <div className="mt-3.5 p-4 border border-neutral-200/90 rounded-2xl bg-neutral-50/70 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-neutral-900 pb-1.5 border-b border-neutral-200/60">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                              <span>{proposalLabel}</span>
                            </div>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${
                              msg.actionProposal.status === 'applied'
                                ? 'bg-emerald-100 text-emerald-800 font-semibold'
                                : 'bg-neutral-200 text-neutral-800'
                            }`}>
                              {msg.actionProposal.status}
                            </span>
                          </div>

                          {/* Summary of what will be saved */}
                          <div className="text-xs text-neutral-700 font-sans space-y-1.5 bg-white p-3.5 rounded-xl border border-neutral-200/80 shadow-2xs">
                            {isDiary && (
                              <div>
                                <div className="flex items-center justify-between gap-2 pb-1 border-b border-neutral-100 mb-1.5">
                                  <p className="font-semibold text-neutral-900 text-xs sm:text-sm truncate">
                                    {entryTitle}
                                  </p>
                                  <span className="text-[10px] font-mono text-neutral-400 shrink-0">
                                    {diaryDate}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed line-clamp-4">
                                  {entryContent || 'Your thoughts and reflections are organized for your journal.'}
                                </p>
                                <p className="text-[10px] text-neutral-400 font-mono pt-1">
                                  ↳ Added to this day's journal (previous writing is preserved)
                                </p>
                              </div>
                            )}

                            {isPlan && (
                              <div>
                                <p className="font-semibold text-neutral-900">{entryTitle}</p>
                                <p className="text-[11px] text-neutral-500 mt-0.5">
                                  Checklist of {(msg.actionProposal.data?.newTasks || msg.actionProposal.data?.tasks || []).length} tasks ready to add.
                                </p>
                              </div>
                            )}

                            {isChapter && (
                              <div>
                                <p className="font-semibold text-neutral-900">{entryTitle}</p>
                                <p className="text-[11px] text-neutral-500 line-clamp-3 mt-0.5">{entryContent}</p>
                              </div>
                            )}

                            {isSkill && (
                              <div>
                                <p className="font-semibold text-neutral-900">{entryTitle}</p>
                                <p className="text-[11px] text-neutral-500 mt-0.5">{msg.actionProposal.data?.description}</p>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            {msg.actionProposal.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => openProposalReview(msgId, {
                                    ...msg.actionProposal!,
                                    data: {
                                      ...(msg.actionProposal!.data || {}),
                                      content: entryContent,
                                      title: entryTitle,
                                      date: diaryDate,
                                    }
                                  })}
                                  className="px-3 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded-lg bg-white hover:bg-neutral-50 cursor-pointer"
                                >
                                  Edit & Review
                                </button>
                                <button
                                  onClick={() => {
                                    const dataToSave = {
                                      ...(msg.actionProposal!.data || {}),
                                      content: entryContent,
                                      title: entryTitle,
                                      date: diaryDate,
                                    };
                                    handleApproveAction(msgId, dataToSave);
                                  }}
                                  className="px-3.5 py-1 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve & Save</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Saved to LifeNote
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Minimal Assistant Action Row */}
                  {!isUser && (
                    <div className="flex items-center gap-2 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleCopyText(msg.content, msgId)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 rounded transition-colors cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === msgId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-neutral-400 animate-pulse py-2">
                <div className="w-4 h-4 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                <span>LifeNote AI is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 3. Bottom Composer — EXACT SAME DESIGN AS DASHBOARD INPUT FIELD */}
      <div className="p-4 sm:p-6 bg-gradient-to-t from-white via-white to-transparent shrink-0">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Attached items context tray */}
          {attachments.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-2">
              <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider">Context:</span>
              {attachments.map((att, attIdx) => (
                <span
                  key={att.id ? `${att.id}-${attIdx}` : `att-${attIdx}`}
                  className="inline-flex items-center gap-1 text-[11px] bg-neutral-100 text-neutral-800 px-2.5 py-0.5 rounded-full font-medium"
                >
                  <span>{att.type}: {att.title}</span>
                  <button
                    type="button"
                    onClick={() => toggleAttach(att as any)}
                    className="hover:text-red-500 cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input Box (Matching Dashboard input container, border, controls) */}
          <div className="border border-neutral-200/90 hover:border-neutral-300 focus-within:border-neutral-400 focus-within:ring-1 focus-within:ring-neutral-200 rounded-2xl sm:rounded-3xl bg-white p-4 shadow-sm transition-all">
            {/* Text Input Area */}
            <textarea
              ref={textareaRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={`Ask LifeNote AI, capture a thought, plan, or journal in ${currentModeObj.label}...`}
              className="w-full bg-transparent text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none resize-none leading-relaxed block"
            />

            {/* Controls Bar */}
            <div className="flex items-center justify-between pt-2 mt-1">
              {/* Left: Plus Action Button with Popover */}
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen(v => !v)}
                  aria-label="Quick options"
                  title="Attach saved content or choose action"
                  className="w-8 h-8 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 hover:text-black transition-all cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* '+' Attachment Dropdown Menu */}
                {plusMenuOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-72 sm:w-80 bg-white border border-neutral-200 rounded-2xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100 mb-2">
                      <span className="text-xs font-bold text-neutral-900">Attach Saved Content</span>
                      <button onClick={() => setPlusMenuOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Category tabs */}
                    <div className="grid grid-cols-4 gap-1 mb-2.5 text-[11px] font-medium text-neutral-600">
                      {[
                        { id: 'diaries', label: 'Diaries' },
                        { id: 'plans', label: 'Plans' },
                        { id: 'books', label: 'Books' },
                        { id: 'skills', label: 'Skills' },
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveAttachTab(t.id as any)}
                          className={`py-1 rounded-lg text-center transition-colors cursor-pointer ${
                            activeAttachTab === t.id ? 'bg-neutral-900 text-white font-semibold' : 'bg-neutral-100 hover:bg-neutral-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Resources list to toggle */}
                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                      {activeAttachTab === 'diaries' && (
                        availableDiaries.length === 0 ? (
                          <p className="text-[11px] text-neutral-400 py-3 text-center">No diary entries yet</p>
                        ) : (
                          availableDiaries.map(d => {
                            const isAttached = attachments.some(a => a.id === (d.id || d._id));
                            return (
                              <button
                                key={d.id || d._id}
                                type="button"
                                onClick={() => toggleAttach({ type: 'diary', id: d.id || d._id, title: d.title })}
                                className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                  isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                                }`}
                              >
                                <span className="truncate">{d.title}</span>
                                <span className="text-[10px] opacity-70 shrink-0 font-mono ml-1">{d.date}</span>
                              </button>
                            );
                          })
                        )
                      )}

                      {activeAttachTab === 'plans' && (
                        availablePlans.length === 0 ? (
                          <p className="text-[11px] text-neutral-400 py-3 text-center">No plans yet</p>
                        ) : (
                          availablePlans.map(p => {
                            const isAttached = attachments.some(a => a.id === (p.id || p._id));
                            return (
                              <button
                                key={p.id || p._id}
                                type="button"
                                onClick={() => toggleAttach({ type: 'plan', id: p.id || p._id, title: p.title })}
                                className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                  isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                                }`}
                              >
                                <span className="truncate">{p.title}</span>
                                <span className="text-[10px] opacity-70 shrink-0 font-mono ml-1">{p.progress}%</span>
                              </button>
                            );
                          })
                        )
                      )}

                      {activeAttachTab === 'books' && (
                        availableBooks.length === 0 ? (
                          <p className="text-[11px] text-neutral-400 py-3 text-center">No books yet</p>
                        ) : (
                          availableBooks.map(b => {
                            const isAttached = attachments.some(a => a.id === (b.id || b._id));
                            return (
                              <button
                                key={b.id || b._id}
                                type="button"
                                onClick={() => toggleAttach({ type: 'book', id: b.id || b._id, title: b.title })}
                                className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                  isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                                }`}
                              >
                                <span className="truncate">{b.title}</span>
                                <span className="text-[10px] opacity-70 shrink-0 font-mono ml-1">{b.genre}</span>
                              </button>
                            );
                          })
                        )
                      )}

                      {activeAttachTab === 'skills' && (
                        availableSkills.map(s => {
                          const isAttached = attachments.some(a => a.id === (s.id || s._id));
                          return (
                            <button
                              key={s.id || s._id}
                              type="button"
                              onClick={() => toggleAttach({ type: 'skill', id: s.id || s._id, title: s.name })}
                              className={`w-full text-left p-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                                isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                              }`}
                            >
                              <span className="truncate">{s.name}</span>
                              <span className="text-[10px] opacity-70 shrink-0 ml-1">{s.category}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Mode Selector, Mic Button, Send Arrow Button */}
              <div className="flex items-center gap-2">
                {/* Mode Selector Pill Button */}
                <div className="relative" ref={modeMenuRef}>
                  <button
                    type="button"
                    onClick={() => setModeMenuOpen(v => !v)}
                    className="h-8 px-3 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-medium text-neutral-800 flex items-center gap-1.5 transition-colors cursor-pointer select-none active:scale-95"
                  >
                    <span>{currentModeObj.label}</span>
                    <ChevronDown className="w-3 h-3 text-neutral-500" />
                  </button>

                  {modeMenuOpen && (
                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5 z-30 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      {CHAT_MODES.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={async () => {
                            setSelectedMode(m.id as any);
                            setModeMenuOpen(false);
                            if (activeChat) {
                              const chatId = activeChat.id || (activeChat as any)._id;
                              await api.chats.update(chatId, { mode: m.id });
                              setActiveChat({ ...activeChat, mode: m.id as any });
                            }
                          }}
                          className={`w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded-lg text-left cursor-pointer transition-colors ${
                            selectedMode === m.id
                              ? 'bg-neutral-900 text-white'
                              : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                          }`}
                        >
                          <div>
                            <div>{m.label}</div>
                            <div className={`text-[10px] ${selectedMode === m.id ? 'text-neutral-300' : 'text-neutral-400'}`}>
                              {m.desc}
                            </div>
                          </div>
                          {selectedMode === m.id && <Check className="w-3.5 h-3.5 shrink-0 ml-1.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Microphone Button */}
                <button
                  type="button"
                  onClick={handleToggleVoice}
                  aria-label="Voice input"
                  title={isListening ? 'Listening... click to stop' : 'Voice input'}
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    isListening
                      ? 'border-red-400 bg-red-50 text-red-600 animate-pulse'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900 hover:bg-neutral-50'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                </button>

                {/* Submit Arrow Up Button */}
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={sending || !messageInput.trim()}
                  aria-label="Send"
                  title="Send message"
                  className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                    messageInput.trim()
                      ? 'bg-neutral-900 border-neutral-900 text-white hover:bg-black shadow-xs'
                      : 'bg-white border-neutral-200 text-neutral-400 hover:border-neutral-300 hover:text-neutral-600'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Proposal Review & Edit Modal */}
      {proposalModal && (() => {
        const pType = String(proposalModal.proposal.type || '').toLowerCase();
        const isPlanModal = pType.includes('plan');
        const isChapterModal = pType.includes('chapter') || pType.includes('book');
        const isSkillModal = pType.includes('skill');
        const isDiaryModal = !isPlanModal && !isChapterModal && !isSkillModal;

        const modalTitle = isDiaryModal
          ? 'Journal Entry'
          : isPlanModal
          ? 'Action Plan'
          : isChapterModal
          ? 'Book Chapter Draft'
          : isSkillModal
          ? 'Custom AI Skill'
          : 'Action Proposal';

        return (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-neutral-200 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">
                Review & Save: {modalTitle}
              </h2>
              <button onClick={() => setProposalModal(null)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              {isDiaryModal
                ? "Review or edit this reflection. It will be added to this date's journal without deleting any previous text."
                : "Review or adjust the content drafted by LifeNote AI before saving it to your private library."}
            </p>

            {/* Editable Fields based on proposal type */}
            <div className="space-y-3">
              {isDiaryModal && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Calendar Date</label>
                      <input
                        type="date"
                        value={
                          proposalModal.editableData.date && !/202[0-5]/.test(proposalModal.editableData.date) && !proposalModal.editableData.date.includes('YYYY')
                            ? proposalModal.editableData.date
                            : getTodayDateString()
                        }
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setProposalModal({
                            ...proposalModal,
                            editableData: {
                              ...proposalModal.editableData,
                              date: newDate,
                              title: (proposalModal.editableData.title || '').startsWith('Journal:') || /202[0-5]/.test(proposalModal.editableData.title || '')
                                ? `Journal: ${newDate}`
                                : proposalModal.editableData.title,
                            }
                          });
                        }}
                        className="w-full px-3 py-1.5 text-xs font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Entry Title</label>
                      <input
                        type="text"
                        value={
                          /202[0-5]/.test(proposalModal.editableData.title || '')
                            ? (proposalModal.editableData.title || '').replace(/202[0-5]-\d{2}-\d{2}/g, getTodayDateString()).replace(/202[0-5]/g, getTodayDateString().split('-')[0])
                            : proposalModal.editableData.title || ''
                        }
                        onChange={(e) => setProposalModal({
                          ...proposalModal,
                          editableData: { ...proposalModal.editableData, title: e.target.value }
                        })}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Content</label>
                    <textarea
                      rows={6}
                      value={proposalModal.editableData.content || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, content: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
                    />
                  </div>
                </>
              )}

              {proposalModal.proposal.type === 'update_plan' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Plan Title</label>
                    <input
                      type="text"
                      value={proposalModal.editableData.planTitle || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, planTitle: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Tasks (one per line)</label>
                    <textarea
                      rows={4}
                      value={(proposalModal.editableData.newTasks || proposalModal.editableData.tasks || []).join('\n')}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: {
                          ...proposalModal.editableData,
                          newTasks: e.target.value.split('\n').filter(Boolean)
                        }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </>
              )}

              {proposalModal.proposal.type === 'add_chapter' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Chapter Title</label>
                    <input
                      type="text"
                      value={proposalModal.editableData.chapterTitle || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, chapterTitle: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Chapter Content</label>
                    <textarea
                      rows={6}
                      value={proposalModal.editableData.content || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, content: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </>
              )}

              {proposalModal.proposal.type === 'create_skill' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Skill Name</label>
                    <input
                      type="text"
                      value={proposalModal.editableData.name || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, name: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
                    <input
                      type="text"
                      value={proposalModal.editableData.description || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, description: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Prompt Template</label>
                    <textarea
                      rows={4}
                      value={proposalModal.editableData.promptTemplate || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, promptTemplate: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none font-mono text-[11px]"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setProposalModal(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApproveAction()}
                disabled={applyingAction}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                {applyingAction ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save to Library</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
};
