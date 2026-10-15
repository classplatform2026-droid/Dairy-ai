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
  Edit2,
  Play,
  BookOpen,
  ListTodo,
  AlertCircle,
  Lightbulb
} from 'lucide-react';

const CHAT_MODES = [
  { id: 'default', label: 'Default', desc: 'General conversational assistant' },
  { id: 'diary', label: 'Diary Mode', desc: 'Reflective companion & journal drafting' },
  { id: 'idea', label: 'Ideas Mode', desc: 'Brainstorm, validate & structure concepts' },
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

  // Skill Execution on Text Selection / Message
  const [selectedSnippet, setSelectedSnippet] = useState('');
  const [selectionCoords, setSelectionCoords] = useState<{ x: number; y: number } | null>(null);
  const [selectionSkillMenuOpen, setSelectionSkillMenuOpen] = useState(false);
  const [messageSkillMenuId, setMessageSkillMenuId] = useState<string | null>(null);
  const [skillReview, setSkillReview] = useState<{
    skillId: string;
    skillName: string;
    inputText: string;
    output: string;
    editableOutput: string;
    durationMs?: number;
    model?: string;
    executing: boolean;
  } | null>(null);

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
      if (messageSkillMenuId) {
        setMessageSkillMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [messageSkillMenuId]);

  // Handle Text Selection in Messages for floating Skill Runner
  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          if (!selectionSkillMenuOpen) {
            setSelectedSnippet('');
            setSelectionCoords(null);
          }
          return;
        }

        const text = sel.toString().trim();
        if (text.length >= 3) {
          try {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setSelectedSnippet(text);
            setSelectionCoords({
              x: Math.max(20, rect.left + rect.width / 2),
              y: Math.max(20, rect.top - 8),
            });
          } catch {
            setSelectedSnippet(text);
          }
        }
      }, 50);
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [selectionSkillMenuOpen]);

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

  // Execute skill on selected text or full message
  const handleExecuteSkill = async (skill: any, text: string) => {
    if (!text || !text.trim()) return;
    const sId = skill.id || skill._id;
    setSkillReview({
      skillId: sId,
      skillName: skill.name,
      inputText: text.trim(),
      output: '',
      editableOutput: '',
      executing: true,
    });
    setSelectionSkillMenuOpen(false);
    setMessageSkillMenuId(null);
    setSelectedSnippet('');
    setSelectionCoords(null);

    try {
      const res = await api.skills.test(sId, { input: text.trim() });
      setSkillReview({
        skillId: sId,
        skillName: skill.name,
        inputText: text.trim(),
        output: res.output,
        editableOutput: res.output,
        durationMs: res.durationMs,
        model: res.model,
        executing: false,
      });
    } catch (err: any) {
      console.error('Skill execution failed:', err);
      setSkillReview({
        skillId: sId,
        skillName: skill.name,
        inputText: text.trim(),
        output: `Execution failed: ${err.message || 'Unknown error'}`,
        editableOutput: text.trim(),
        executing: false,
      });
    }
  };

  // User Approval Flow: Save Approved Output to Today's Journal
  const handleSaveSkillOutputToDiary = async () => {
    if (!skillReview || !skillReview.editableOutput) return;
    setApplyingAction(true);
    const today = getTodayDateString();

    try {
      const existing = await api.diaries.getByDate(today).catch(() => null);
      if (existing && existing.entry) {
        const id = existing.entry.id || existing.entry._id;
        const mergedContent = `${existing.entry.content}\n\n---\n[Refined via ${skillReview.skillName}]:\n${skillReview.editableOutput}`;
        await api.diaries.update(id, { content: mergedContent });
      } else {
        await api.diaries.create({
          title: `Reflections: ${today}`,
          content: skillReview.editableOutput,
          date: today,
          mood: 'thoughtful',
          weather: 'sunny',
          tags: ['skill', skillReview.skillName.toLowerCase().replace(/\s+/g, '-')],
        });
      }

      setApplySuccessNotice(`Approved output successfully saved to today's journal (${today})!`);
      setSkillReview(null);
      setTimeout(() => setApplySuccessNotice(null), 4000);
      loadAttachableResources();
    } catch (err: any) {
      console.error('Failed to save skill output to diary:', err);
      alert(`Save to diary failed: ${err.message || 'Error'}`);
    } finally {
      setApplyingAction(false);
    }
  };

  // User Approval Flow: Save Approved Output as Plan Tasks
  const handleSaveSkillOutputToPlan = async () => {
    if (!skillReview || !skillReview.editableOutput) return;
    setApplyingAction(true);

    try {
      const lines = skillReview.editableOutput
        .split('\n')
        .map(l => l.replace(/^[-*•\d.]+\s*/, '').trim())
        .filter(Boolean);

      const tasks = lines.slice(0, 10).map((t, idx) => ({
        title: t,
        completed: false,
        order: idx + 1,
      }));

      await api.plans.create({
        title: `${skillReview.skillName} Action Plan`,
        description: skillReview.inputText.slice(0, 120),
        category: 'Personal',
        tasks: tasks.length > 0 ? tasks : [{ title: 'Review refined plan items', completed: false, order: 1 }],
      });

      setApplySuccessNotice(`Approved output saved as a new Action Plan!`);
      setSkillReview(null);
      setTimeout(() => setApplySuccessNotice(null), 4000);
      loadAttachableResources();
    } catch (err: any) {
      console.error('Failed to save skill output to plan:', err);
      alert(`Save to plan failed: ${err.message || 'Error'}`);
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
                      const isIdea = proposalType.includes('idea');
                      const isPlan = proposalType.includes('plan');
                      const isChapter = proposalType.includes('chapter') || proposalType.includes('book');
                      const isSkill = proposalType.includes('skill');
                      const isDiary = !isIdea && !isPlan && !isChapter && !isSkill;

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
                      const entryTitle = isIdea
                        ? (msg.actionProposal.data?.title || 'Structured Idea Concept')
                        : isDiary
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

                      const proposalLabel = isIdea
                        ? 'Idea Architecture (9 Sections)'
                        : isDiary
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

                            {isIdea && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2 pb-1 border-b border-neutral-100 mb-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Lightbulb className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                                    <p className="font-semibold text-neutral-900 text-xs sm:text-sm truncate">
                                      {entryTitle}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-700 shrink-0">
                                    {msg.actionProposal.data?.category || 'Tech & AI'}
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-700 whitespace-pre-wrap leading-relaxed line-clamp-3">
                                  {msg.actionProposal.data?.sections?.overview || msg.actionProposal.data?.sections?.problemAndSolution || 'Idea structured across 9 key strategic sections.'}
                                </p>
                                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-neutral-500">
                                  <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700 font-semibold">9 Structured Sections</span>
                                  {msg.actionProposal.data?.tags?.slice(0, 3).map((t: string) => (
                                    <span key={t} className="bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-600">#{t}</span>
                                  ))}
                                </div>
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

                  {/* Action Row for Assistant and User Messages */}
                  <div className={`flex items-center gap-1.5 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity relative ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <button
                      type="button"
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

                    {/* Run Skill on Message Content */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMessageSkillMenuId(messageSkillMenuId === msgId ? null : msgId);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 bg-white/80 hover:bg-neutral-100 border border-neutral-200/80 rounded-md transition-colors cursor-pointer shadow-2xs"
                        title="Run an AI Skill on this entire message"
                      >
                        <Sparkles className="w-3 h-3 text-neutral-600" />
                        <span>Run Skill</span>
                        <ChevronDown className="w-2.5 h-2.5 opacity-60" />
                      </button>

                      {messageSkillMenuId === msgId && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className={`absolute ${isUser ? 'right-0' : 'left-0'} top-full mt-1 w-64 max-h-60 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-xl py-1.5 z-40 text-neutral-900 animate-in fade-in duration-150`}
                        >
                          <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 flex items-center justify-between">
                            <span>Execute on Message</span>
                            <span className="font-mono text-[9px]">{availableSkills.length} available</span>
                          </div>

                          {availableSkills.length === 0 ? (
                            <div className="px-3 py-3 text-xs text-neutral-500 text-center">
                              <p>No saved skills yet.</p>
                              <p className="text-[10px] text-neutral-400 mt-0.5">Create one in Skills Studio</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-neutral-50">
                              {availableSkills.map((sk) => (
                                <button
                                  key={sk.id || sk._id}
                                  type="button"
                                  onClick={() => {
                                    setMessageSkillMenuId(null);
                                    handleExecuteSkill(sk, msg.content);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors cursor-pointer flex items-start gap-2 group/item"
                                >
                                  <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover/item:text-neutral-900 mt-0.5 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="text-xs font-medium text-neutral-900 truncate">{sk.name}</p>
                                      {sk.category && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600 font-mono shrink-0">
                                          {sk.category}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-neutral-500 line-clamp-1 mt-0.5">
                                      {sk.description || 'Custom LifeNote skill'}
                                    </p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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

              {(proposalModal.proposal.type === 'create_idea' || proposalModal.proposal.type === 'update_idea') && (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Idea Title</label>
                      <input
                        type="text"
                        value={proposalModal.editableData.title || ''}
                        onChange={(e) => setProposalModal({
                          ...proposalModal,
                          editableData: { ...proposalModal.editableData, title: e.target.value }
                        })}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                      <select
                        value={proposalModal.editableData.category || 'Tech & AI'}
                        onChange={(e) => setProposalModal({
                          ...proposalModal,
                          editableData: { ...proposalModal.editableData, category: e.target.value }
                        })}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none bg-white"
                      >
                        <option value="Tech & AI">Tech & AI</option>
                        <option value="Business">Business</option>
                        <option value="Productivity">Productivity</option>
                        <option value="Creative">Creative</option>
                        <option value="Social">Social</option>
                        <option value="Personal">Personal</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* 9 Structured Sections */}
                  {[
                    { key: 'overview', label: '1. Overview', rows: 2 },
                    { key: 'problemAndSolution', label: '2. Problem & Solution', rows: 2 },
                    { key: 'targetAudience', label: '3. Target Audience', rows: 2 },
                    { key: 'features', label: '4. Features', rows: 2 },
                    { key: 'businessModel', label: '5. Business Model', rows: 2 },
                    { key: 'competitors', label: '6. Competitors', rows: 2 },
                    { key: 'implementationPlan', label: '7. Implementation Plan', rows: 2 },
                    { key: 'risks', label: '8. Risks', rows: 2 },
                    { key: 'improvementOpportunities', label: '9. Improvement Opportunities', rows: 2 },
                  ].map((sec) => (
                    <div key={sec.key}>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">{sec.label}</label>
                      <textarea
                        rows={sec.rows}
                        value={proposalModal.editableData.sections?.[sec.key] || ''}
                        onChange={(e) => setProposalModal({
                          ...proposalModal,
                          editableData: {
                            ...proposalModal.editableData,
                            sections: {
                              ...(proposalModal.editableData.sections || {}),
                              [sec.key]: e.target.value,
                            }
                          }
                        })}
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
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

      {/* Floating Toolbar on Text Selection */}
      {selectedSnippet && selectionCoords && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full bg-neutral-900 text-white shadow-2xl rounded-full px-3 py-1.5 flex items-center gap-2 border border-neutral-700 text-xs select-none animate-in fade-in zoom-in-95 duration-150"
          style={{ left: `${selectionCoords.x}px`, top: `${selectionCoords.y}px` }}
        >
          <span className="text-[10px] text-neutral-400 font-mono max-w-[120px] truncate">
            "{selectedSnippet}"
          </span>
          <div className="w-[1px] h-3.5 bg-neutral-700" />

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectionSkillMenuOpen(v => !v);
              }}
              className="flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Run Skill</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {selectionSkillMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute left-0 bottom-full mb-2 w-64 max-h-64 overflow-y-auto bg-white border border-neutral-200 rounded-xl shadow-2xl py-1.5 z-50 text-neutral-900 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="px-3 py-1 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-neutral-100 flex items-center justify-between">
                  <span>Run on Selection</span>
                  <span className="font-mono text-[9px]">{availableSkills.length} available</span>
                </div>
                {availableSkills.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-neutral-500 text-center">
                    No skills created yet
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-50">
                    {availableSkills.map((sk) => (
                      <button
                        key={sk.id || sk._id}
                        type="button"
                        onClick={() => {
                          setSelectionSkillMenuOpen(false);
                          handleExecuteSkill(sk, selectedSnippet);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-neutral-50 transition-colors cursor-pointer flex items-start gap-2 group/item"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-neutral-400 group-hover/item:text-neutral-900 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-neutral-900 truncate">{sk.name}</p>
                          <p className="text-[10px] text-neutral-500 line-clamp-1">{sk.description || 'Custom Skill'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="w-[1px] h-3.5 bg-neutral-700" />

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(selectedSnippet);
              setSelectedSnippet('');
              setSelectionCoords(null);
            }}
            className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
            title="Copy selected text"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedSnippet('');
              setSelectionCoords(null);
              setSelectionSkillMenuOpen(false);
            }}
            className="text-neutral-400 hover:text-white transition-colors cursor-pointer p-0.5"
            title="Close selection pill"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Skill Execution Review & User Approval Modal */}
      {skillReview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-neutral-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-neutral-900 text-sm">
                      Skill Execution: {skillReview.skillName}
                    </h3>
                    {skillReview.durationMs && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 font-mono">
                        {(skillReview.durationMs / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Review and edit output before approving modification of saved content
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSkillReview(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Source Text Input */}
              <div>
                <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                  Source Text / Context
                </label>
                <div className="p-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-700 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {skillReview.inputText}
                </div>
              </div>

              {/* Execution Status / Editable Output */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Generated Output</span>
                    <span className="text-[10px] font-normal text-neutral-400 lowercase">(editable prior to save)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(skillReview.editableOutput);
                    }}
                    className="text-[11px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>

                {skillReview.executing ? (
                  <div className="py-12 border border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center text-center gap-2 bg-neutral-50/50">
                    <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-medium text-neutral-800">
                      Executing skill "{skillReview.skillName}"...
                    </p>
                    <p className="text-[11px] text-neutral-400">Applying prompt template & constraints</p>
                  </div>
                ) : (
                  <textarea
                    rows={8}
                    value={skillReview.editableOutput}
                    onChange={(e) => setSkillReview({
                      ...skillReview,
                      editableOutput: e.target.value
                    })}
                    placeholder="Skill output will appear here..."
                    className="w-full p-3 text-xs sm:text-sm text-neutral-900 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-400 font-sans leading-relaxed resize-y"
                  />
                )}
              </div>
            </div>

            {/* User Approval & Save Action Bar */}
            <div className="px-5 py-3.5 bg-neutral-50/80 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSkillReview(null)}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
              >
                Dismiss
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={skillReview.executing || !skillReview.editableOutput}
                  onClick={() => {
                    setMessageInput(prev => prev ? `${prev}\n\n${skillReview.editableOutput}` : skillReview.editableOutput);
                    setSkillReview(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  title="Insert this refined text into the chat composer"
                >
                  Insert in Composer
                </button>

                <button
                  type="button"
                  disabled={skillReview.executing || !skillReview.editableOutput || applyingAction}
                  onClick={handleSaveSkillOutputToDiary}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <BookOpen className="w-3.5 h-3.5 text-neutral-600" />
                  <span>Save to Journal</span>
                </button>

                <button
                  type="button"
                  disabled={skillReview.executing || !skillReview.editableOutput || applyingAction}
                  onClick={handleSaveSkillOutputToPlan}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>Save as Plan</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
