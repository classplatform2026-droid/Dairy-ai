import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api.js';
import { Chat, Message, Attachment, ActionProposal } from '../../types/index.js';
import {
  MessageSquare,
  Plus,
  Send,
  Paperclip,
  Trash2,
  Edit2,
  Sparkles,
  CheckCircle2,
  BookOpen,
  Calendar,
  CheckSquare,
  X,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  Layers,
  Search,
  Check
} from 'lucide-react';

const CHAT_MODES = [
  { id: 'default', label: 'General AI', desc: 'Versatile conversational assistant' },
  { id: 'diary', label: 'Diary Mode', desc: 'Reflective companion & journal drafting' },
  { id: 'book', label: 'Book Mode', desc: 'Narrative expansion & chapter sculpting' },
  { id: 'plan', label: 'Plan Mode', desc: 'Strategic breakdown & task harvesting' },
] as const;

export const ChatView: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Composer states
  const [messageInput, setMessageInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [activeAttachTab, setActiveAttachTab] = useState<'diaries' | 'plans' | 'books' | 'skills'>('diaries');

  // Available resources to attach
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

  // Chat rename state
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);

  // Close attachment menu on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachmentMenuOpen(false);
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

  const loadChats = async () => {
    try {
      setLoading(true);
      const res = await api.chats.list();
      setChats(res.chats || []);
      if (res.chats && res.chats.length > 0) {
        loadChatDetail(res.chats[0].id || (res.chats[0] as any)._id);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadChatDetail = async (chatId: string) => {
    try {
      const res = await api.chats.get(chatId);
      setActiveChat(res.chat);
    } catch (err) {
      console.error('Failed to load chat thread:', err);
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

  useEffect(() => {
    loadChats();
    loadAttachableResources();
  }, []);

  const handleCreateNewChat = async (mode: 'default' | 'diary' | 'book' | 'plan' = 'default') => {
    try {
      const res = await api.chats.create({
        title: 'New Conversation',
        mode,
      });
      setChats(prev => [res.chat, ...prev]);
      setActiveChat({ ...res.chat, messages: [] });
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  };

  const handleDeleteChat = async (chatId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirm = window.confirm('Delete this conversation thread? Saved diaries, books, and plans will NOT be deleted.');
    if (!confirm) return;

    try {
      await api.chats.delete(chatId);
      const remaining = chats.filter(c => (c.id || (c as any)._id) !== chatId);
      setChats(remaining);
      if (remaining.length > 0) {
        loadChatDetail(remaining[0].id || (remaining[0] as any)._id);
      } else {
        setActiveChat(null);
      }
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  const handleStartRename = (c: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingChatId(c.id || (c as any)._id);
    setNewTitle(c.title);
  };

  const handleSaveRename = async (chatId: string) => {
    if (!newTitle.trim()) {
      setRenamingChatId(null);
      return;
    }
    try {
      await api.chats.update(chatId, { title: newTitle.trim() });
      setChats(prev => prev.map(c => ((c.id || (c as any)._id) === chatId ? { ...c, title: newTitle.trim() } : c)));
      if (activeChat && (activeChat.id || (activeChat as any)._id) === chatId) {
        setActiveChat({ ...activeChat, title: newTitle.trim() });
      }
    } catch (err) {
      console.error('Failed to rename chat:', err);
    } finally {
      setRenamingChatId(null);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || sending) return;

    let currentChatId = activeChat?.id || (activeChat as any)?._id;

    // Create chat on the fly if none selected
    if (!currentChatId) {
      try {
        const newChat = await api.chats.create({ title: messageInput.slice(0, 30) });
        currentChatId = newChat.chat.id || (newChat.chat as any)._id;
        setChats(prev => [newChat.chat, ...prev]);
        setActiveChat({ ...newChat.chat, messages: [] });
      } catch (err) {
        console.error('Failed to initialize conversation:', err);
        return;
      }
    }

    const payload = {
      content: messageInput.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
      skillId: selectedSkillId || undefined,
    };

    setSending(true);
    setMessageInput('');
    setAttachments([]);
    setSelectedSkillId(null);

    try {
      const res = await api.chats.sendMessage(currentChatId, payload);
      setActiveChat(prev => {
        if (!prev) return prev;
        const msgs = prev.messages || [];
        return {
          ...prev,
          messages: [...msgs, res.userMessage, res.assistantMessage],
        };
      });
      // Touch chats list
      setChats(prev => prev.map(c =>
        ((c.id || (c as any)._id) === currentChatId
          ? { ...c, updatedAt: new Date().toISOString() }
          : c)
      ));
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

  // Open proposal approval modal
  const openProposalReview = (messageId: string, proposal: ActionProposal) => {
    setProposalModal({
      messageId,
      proposal,
      editableData: JSON.parse(JSON.stringify(proposal.data)),
    });
  };

  // Approve & Apply Action
  const handleApproveAction = async () => {
    if (!proposalModal || !activeChat) return;
    setApplyingAction(true);
    const chatId = activeChat.id || (activeChat as any)._id;

    try {
      const res = await api.chats.applyAction(chatId, proposalModal.messageId, proposalModal.editableData);
      setApplySuccessNotice(res.message);

      // Update message in state to status 'applied'
      setActiveChat(prev => {
        if (!prev) return prev;
        const updated = (prev.messages || []).map(m => {
          if ((m.id || (m as any)._id) === proposalModal.messageId && m.actionProposal) {
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

  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[calc(100vh-10rem)]">
        {/* Left Column: Chat History & Threads (4 cols) */}
        <div className="lg:col-span-4 border border-neutral-200 rounded-xl bg-white p-4 flex flex-col justify-between shadow-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h2 className="text-sm font-bold text-neutral-900 tracking-tight">Conversations</h2>
              <button
                onClick={() => handleCreateNewChat('default')}
                className="px-2.5 py-1 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Search chats */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400"
              />
            </div>

            {/* Chat threads list */}
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-12 bg-neutral-100 rounded-lg animate-pulse" />)}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-400">
                No conversations found.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
                {filteredChats.map((c) => {
                  const chatId = c.id || (c as any)._id;
                  const isCurrent = activeChat && (activeChat.id || (activeChat as any)._id) === chatId;
                  const isRenaming = renamingChatId === chatId;

                  return (
                    <div
                      key={chatId}
                      onClick={() => !isRenaming && loadChatDetail(chatId)}
                      className={`p-2.5 rounded-lg border text-xs transition-all cursor-pointer flex items-center justify-between group ${
                        isCurrent
                          ? 'border-neutral-900 bg-neutral-50 font-medium'
                          : 'border-neutral-200 hover:border-neutral-300 bg-white'
                      }`}
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(chatId)}
                            className="flex-1 text-xs px-2 py-0.5 border border-neutral-300 rounded focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveRename(chatId)}
                            className="p-1 hover:text-neutral-900"
                          >
                            <Check className="w-3.5 h-3.5 text-neutral-900" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="truncate pr-2">
                            <p className="truncate text-neutral-900">{c.title}</p>
                            <span className="text-[10px] text-neutral-400 capitalize">{c.mode} mode</span>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleStartRename(c, e)}
                              className="p-1 text-neutral-400 hover:text-neutral-700"
                              title="Rename chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteChat(chatId, e)}
                              className="p-1 text-neutral-400 hover:text-red-600"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom quick mode launchers */}
          <div className="pt-3 border-t border-neutral-100">
            <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block mb-1.5">
              Launch Focused Session
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {CHAT_MODES.filter(m => m.id !== 'default').map(m => (
                <button
                  key={m.id}
                  onClick={() => handleCreateNewChat(m.id as any)}
                  className="px-2 py-1 text-[11px] font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded text-left transition-colors cursor-pointer truncate"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Universal Chat Workspace (8 cols) */}
        <div className="lg:col-span-8 border border-neutral-200 rounded-xl bg-white flex flex-col justify-between shadow-xs overflow-hidden">
          {/* Header Mode Bar */}
          <div className="px-6 py-3.5 border-b border-neutral-200 flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900 text-sm">
                {activeChat?.title || 'New Conversation'}
              </span>
              <span className="text-neutral-300">·</span>
              <span className="text-xs text-neutral-500 font-mono capitalize">
                {activeChat?.mode || 'default'} mode
              </span>
            </div>

            {/* Mode Selector for current chat */}
            <div className="flex items-center gap-1 bg-neutral-100 p-0.5 rounded-lg text-xs font-medium text-neutral-600">
              {CHAT_MODES.map(m => (
                <button
                  key={m.id}
                  onClick={async () => {
                    if (activeChat) {
                      const chatId = activeChat.id || (activeChat as any)._id;
                      await api.chats.update(chatId, { mode: m.id });
                      setActiveChat({ ...activeChat, mode: m.id as any });
                    }
                  }}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeChat?.mode === m.id
                      ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                      : 'hover:text-neutral-900'
                  }`}
                >
                  {m.id}
                </button>
              ))}
            </div>
          </div>

          {/* Success banner if action applied */}
          {applySuccessNotice && (
            <div className="mx-6 mt-4 p-3 bg-neutral-900 text-white rounded-lg text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{applySuccessNotice}</span>
              </div>
              <button onClick={() => setApplySuccessNotice(null)} className="text-neutral-400 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 max-h-[calc(100vh-22rem)]">
            {!activeChat || !activeChat.messages || activeChat.messages.length === 0 ? (
              <div className="text-center py-24 space-y-3 max-w-md mx-auto">
                <div className="w-10 h-10 rounded-full bg-neutral-100 text-neutral-900 flex items-center justify-center mx-auto">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-neutral-900">Universal LifeNote Composer</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Attach your diary entries, goals, or book drafts with <span className="font-mono font-bold">+</span> to synthesize reflections, harvest tasks, or brainstorm chapters.
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    onClick={() => setMessageInput('Help me review my recent thoughts and extract 3 key priorities for tomorrow.')}
                    className="text-[11px] px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    "Extract 3 key priorities for tomorrow"
                  </button>
                  <button
                    onClick={() => setMessageInput('Draft an opening hook for my memoir chapter.')}
                    className="text-[11px] px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    "Draft an opening hook for my memoir chapter"
                  </button>
                </div>
              </div>
            ) : (
              activeChat.messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id || (msg as any)._id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-neutral-900 text-white rounded-br-xs'
                          : 'bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-bl-xs'
                      }`}
                    >
                      {/* Attached Items Indicator */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mb-2 pb-2 border-b border-neutral-200/40 flex items-center gap-1.5 flex-wrap">
                          <Paperclip className="w-3 h-3 text-neutral-400" />
                          {msg.attachments.map(att => (
                            <span
                              key={att.id}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 text-neutral-600 truncate max-w-[140px]"
                            >
                              {att.type.toUpperCase()}: {att.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Content */}
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Intent Detection & Skill Info */}
                      {!isUser && (msg.detectedIntent || msg.skillExecuted) && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-200/60 flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                          {msg.detectedIntent && (
                            <span>Intent: {msg.detectedIntent.type.toUpperCase()}</span>
                          )}
                          {msg.skillExecuted && (
                            <span>Skill: {msg.skillExecuted.skillName}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Proposal Card (Approval Flow) */}
                    {!isUser && msg.actionProposal && (
                      <div className="mt-2.5 max-w-[85%] w-full p-3.5 border border-neutral-300 rounded-xl bg-white shadow-xs space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold text-neutral-900 pb-1.5 border-b border-neutral-100">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                            <span>Action Proposal: {msg.actionProposal.type.replace('_', ' ').toUpperCase()}</span>
                          </div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded capitalize ${
                            msg.actionProposal.status === 'applied'
                              ? 'bg-emerald-100 text-emerald-800 font-semibold'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {msg.actionProposal.status}
                          </span>
                        </div>

                        {/* Summary description of what will be saved */}
                        <div className="text-xs text-neutral-600 font-sans space-y-1 bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                          {msg.actionProposal.type === 'create_diary' && (
                            <div>
                              <p className="font-semibold text-neutral-900">Title: {msg.actionProposal.data?.title}</p>
                              <p className="text-[11px] text-neutral-500 line-clamp-2 mt-0.5">{msg.actionProposal.data?.content}</p>
                            </div>
                          )}
                          {msg.actionProposal.type === 'update_plan' && (
                            <div>
                              <p className="font-semibold text-neutral-900">Plan: {msg.actionProposal.data?.planTitle || 'New Plan'}</p>
                              <p className="text-[11px] text-neutral-500">
                                Adding {(msg.actionProposal.data?.newTasks || msg.actionProposal.data?.tasks || []).length} tasks to checklist.
                              </p>
                            </div>
                          )}
                          {msg.actionProposal.type === 'add_chapter' && (
                            <div>
                              <p className="font-semibold text-neutral-900">Chapter: {msg.actionProposal.data?.chapterTitle}</p>
                              <p className="text-[11px] text-neutral-500 line-clamp-2">{msg.actionProposal.data?.content}</p>
                            </div>
                          )}
                          {msg.actionProposal.type === 'create_skill' && (
                            <div>
                              <p className="font-semibold text-neutral-900">Skill: {msg.actionProposal.data?.name}</p>
                              <p className="text-[11px] text-neutral-500">{msg.actionProposal.data?.description}</p>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1">
                          {msg.actionProposal.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => openProposalReview(msg.id || (msg as any)._id, msg.actionProposal!)}
                                className="px-2.5 py-1 text-xs font-medium text-neutral-700 hover:text-neutral-900 border border-neutral-200 rounded cursor-pointer"
                              >
                                Edit & Review
                              </button>
                              <button
                                onClick={() => {
                                  setProposalModal({
                                    messageId: msg.id || (msg as any)._id,
                                    proposal: msg.actionProposal!,
                                    editableData: msg.actionProposal!.data,
                                  });
                                  handleApproveAction();
                                }}
                                className="px-3 py-1 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve & Save</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Content Saved to LifeNote
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Composer Box with Universal '+' Menu */}
          <div className="p-4 border-t border-neutral-200 bg-white space-y-2">
            {/* Attached items tray */}
            {attachments.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap pb-1">
                <span className="text-[11px] text-neutral-400 font-mono">Context:</span>
                {attachments.map(att => (
                  <span
                    key={att.id}
                    className="inline-flex items-center gap-1 text-[11px] bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded font-medium"
                  >
                    <span>{att.type}: {att.title}</span>
                    <button
                      type="button"
                      onClick={() => toggleAttach(att as any)}
                      className="hover:text-red-500 cursor-pointer ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2 relative">
              {/* Attachment Button */}
              <div className="relative" ref={attachMenuRef}>
                <button
                  type="button"
                  onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                  className="p-2 text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  title="Attach saved books, chapters, plans, skills, or diary entries"
                >
                  <Plus className="w-4 h-4" />
                </button>

                {/* '+' Attachment Dropdown Menu */}
                {attachmentMenuOpen && (
                  <div className="absolute bottom-12 left-0 w-80 bg-white border border-neutral-200 rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100 mb-2">
                      <span className="text-xs font-bold text-neutral-900">Attach Saved Content</span>
                      <button onClick={() => setAttachmentMenuOpen(false)} className="text-neutral-400 hover:text-neutral-700">
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
                          className={`py-1 rounded text-center transition-colors cursor-pointer ${
                            activeAttachTab === t.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 hover:bg-neutral-200'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Resources list to toggle */}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {activeAttachTab === 'diaries' && availableDiaries.map(d => {
                        const isAttached = attachments.some(a => a.id === (d.id || d._id));
                        return (
                          <button
                            key={d.id || d._id}
                            type="button"
                            onClick={() => toggleAttach({ type: 'diary', id: d.id || d._id, title: d.title })}
                            className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                              isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                            }`}
                          >
                            <span className="truncate">{d.title}</span>
                            <span className="text-[10px] opacity-70 shrink-0 font-mono ml-1">{d.date}</span>
                          </button>
                        );
                      })}

                      {activeAttachTab === 'plans' && availablePlans.map(p => {
                        const isAttached = attachments.some(a => a.id === (p.id || p._id));
                        return (
                          <button
                            key={p.id || p._id}
                            type="button"
                            onClick={() => toggleAttach({ type: 'plan', id: p.id || p._id, title: p.title })}
                            className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                              isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                            }`}
                          >
                            <span className="truncate">{p.title}</span>
                            <span className="text-[10px] opacity-70 shrink-0 font-mono ml-1">{p.progress}%</span>
                          </button>
                        );
                      })}

                      {activeAttachTab === 'books' && availableBooks.map(b => {
                        const isAttached = attachments.some(a => a.id === (b.id || b._id));
                        return (
                          <button
                            key={b.id || b._id}
                            type="button"
                            onClick={() => toggleAttach({ type: 'book', id: b.id || b._id, title: b.title })}
                            className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                              isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                            }`}
                          >
                            <span className="truncate">{b.title}</span>
                            <span className="text-[10px] opacity-70 shrink-0 font-mono ml-1">{b.genre}</span>
                          </button>
                        );
                      })}

                      {activeAttachTab === 'skills' && availableSkills.map(s => {
                        const isAttached = attachments.some(a => a.id === (s.id || s._id));
                        return (
                          <button
                            key={s.id || s._id}
                            type="button"
                            onClick={() => toggleAttach({ type: 'skill', id: s.id || s._id, title: s.name })}
                            className={`w-full text-left p-2 rounded text-xs transition-colors flex items-center justify-between ${
                              isAttached ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-800'
                            }`}
                          >
                            <span className="truncate">{s.name}</span>
                            <span className="text-[10px] opacity-70 shrink-0 ml-1">{s.category}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Text Input */}
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder={`Ask, summarize, plan, or write in ${activeChat?.mode || 'default'} mode...`}
                className="flex-1 px-3 py-2 text-xs sm:text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none max-h-32"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={sending || !messageInput.trim()}
                className="p-2 text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-40 cursor-pointer shadow-xs shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Action Proposal Review & Edit Modal */}
      {proposalModal && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-neutral-200 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">
                Review Proposal: {proposalModal.proposal.type.replace('_', ' ').toUpperCase()}
              </h2>
              <button onClick={() => setProposalModal(null)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Review or adjust the content drafted by LifeNote AI before saving it to your private library.
            </p>

            {/* Editable Fields based on proposal type */}
            <div className="space-y-3">
              {proposalModal.proposal.type === 'create_diary' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Entry Title</label>
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
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Content</label>
                    <textarea
                      rows={6}
                      value={proposalModal.editableData.content || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, content: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none font-serif-reading"
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
                      value={proposalModal.editableData.planTitle || proposalModal.editableData.title || ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, planTitle: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">Tasks to Add</label>
                    <textarea
                      rows={5}
                      value={Array.isArray(proposalModal.editableData.newTasks) ? proposalModal.editableData.newTasks.join('\n') : ''}
                      onChange={(e) => setProposalModal({
                        ...proposalModal,
                        editableData: { ...proposalModal.editableData, newTasks: e.target.value.split('\n').filter(Boolean) }
                      })}
                      placeholder="One task per line..."
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none font-mono"
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
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none font-serif-reading"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setProposalModal(null)}
                className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAction}
                disabled={applyingAction}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
              >
                {applyingAction ? 'Applying...' : 'Approve & Save to LifeNote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
