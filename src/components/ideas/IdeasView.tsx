import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Idea, IdeaSections } from '../../types/index.js';
import {
  Lightbulb,
  Plus,
  Search,
  Sparkles,
  Archive,
  Trash2,
  Edit2,
  MessageSquare,
  Check,
  X,
  History,
  RotateCcw,
  AlertCircle,
  Copy,
  ChevronRight,
  ExternalLink,
  Tag,
  Folder
} from 'lucide-react';

interface IdeasViewProps {
  initialCreateNew?: boolean;
  initialSelectedId?: string;
  onNavigateToChat?: (ideaId: string, ideaTitle: string) => void;
}

const CATEGORIES = [
  'All',
  'Tech & AI',
  'Business',
  'Productivity',
  'Creative',
  'Social',
  'Personal',
  'Other',
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Drafts' },
  { id: 'validated', label: 'Validated' },
  { id: 'archived', label: 'Archived' },
];

const SECTION_METADATA: Array<{ key: keyof IdeaSections; label: string; desc: string }> = [
  { key: 'overview', label: '1. Overview', desc: 'Summary & core value proposition' },
  { key: 'problemAndSolution', label: '2. Problem & Solution', desc: 'Pain point and unique resolution' },
  { key: 'targetAudience', label: '3. Target Audience', desc: 'Ideal user personas and customers' },
  { key: 'features', label: '4. Features', desc: 'Core capabilities and product workflows' },
  { key: 'businessModel', label: '5. Business Model', desc: 'Monetization and unit economics' },
  { key: 'competitors', label: '6. Competitors', desc: 'Alternatives & key differentiators' },
  { key: 'implementationPlan', label: '7. Implementation Plan', desc: 'Rollout phases and milestones' },
  { key: 'risks', label: '8. Risks & Challenges', desc: 'Pitfalls, technical and market blockers' },
  { key: 'improvementOpportunities', label: '9. Improvement Opportunities', desc: 'Actionable ways to expand or refine' },
];

export const IdeasView: React.FC<IdeasViewProps> = ({
  initialCreateNew = false,
  initialSelectedId,
  onNavigateToChat,
}) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal states
  const [activeIdea, setActiveIdea] = useState<Idea | null>(null);
  const [activeTab, setActiveTab] = useState<'sections' | 'analysis' | 'history'>('sections');
  const [editingSections, setEditingSections] = useState<IdeaSections>({
    overview: '',
    problemAndSolution: '',
    targetAudience: '',
    features: '',
    businessModel: '',
    competitors: '',
    implementationPlan: '',
    risks: '',
    improvementOpportunities: '',
  });
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCategory, setEditingCategory] = useState('Tech & AI');
  const [editingStatus, setEditingStatus] = useState<'draft' | 'active' | 'validated' | 'archived' | 'implemented'>('draft');
  const [editingTags, setEditingTags] = useState('');
  const [changeNote, setChangeNote] = useState('');
  const [savingIdea, setSavingIdea] = useState(false);

  // Analysis state
  const [analysis, setAnalysis] = useState<{
    critique?: string;
    weaknesses?: string[];
    missingQuestions?: string[];
    suggestedImprovements?: string[];
    nextSteps?: string[];
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Create Modal state
  const [createModalOpen, setCreateModalOpen] = useState(initialCreateNew);
  const [rawBrainstorm, setRawBrainstorm] = useState('');
  const [structuringWithAI, setStructuringWithAI] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Tech & AI');
  const [newTags, setNewTags] = useState('');
  const [newSections, setNewSections] = useState<IdeaSections>({
    overview: '',
    problemAndSolution: '',
    targetAudience: '',
    features: '',
    businessModel: '',
    competitors: '',
    implementationPlan: '',
    risks: '',
    improvementOpportunities: '',
  });
  const [copiedSectionKey, setCopiedSectionKey] = useState<string | null>(null);

  const fetchIdeas = async () => {
    try {
      setLoading(true);
      const res = await api.ideas.list({
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        search: search.trim() || undefined,
      });
      setIdeas(res.ideas || []);
    } catch (err) {
      console.error('Failed to load ideas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [selectedCategory, selectedStatus]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchIdeas();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle initialSelectedId
  useEffect(() => {
    if (initialSelectedId && ideas.length > 0) {
      const match = ideas.find(i => (i.id === initialSelectedId || i._id === initialSelectedId));
      if (match) {
        handleOpenIdea(match);
      }
    }
  }, [initialSelectedId, ideas]);

  const handleOpenIdea = (idea: Idea) => {
    setActiveIdea(idea);
    setEditingTitle(idea.title || '');
    setEditingCategory(idea.category || 'Tech & AI');
    setEditingStatus(idea.status || 'draft');
    setEditingTags((idea.tags || []).join(', '));
    setEditingSections({
      overview: idea.sections?.overview || '',
      problemAndSolution: idea.sections?.problemAndSolution || '',
      targetAudience: idea.sections?.targetAudience || '',
      features: idea.sections?.features || '',
      businessModel: idea.sections?.businessModel || '',
      competitors: idea.sections?.competitors || '',
      implementationPlan: idea.sections?.implementationPlan || '',
      risks: idea.sections?.risks || '',
      improvementOpportunities: idea.sections?.improvementOpportunities || '',
    });
    setChangeNote('');
    setAnalysis(null);
    setActiveTab('sections');
  };

  const handleSaveIdea = async () => {
    if (!activeIdea) return;
    if (!editingTitle.trim()) {
      alert('Please provide a title for this idea.');
      return;
    }

    try {
      setSavingIdea(true);
      const tagsArray = editingTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const res = await api.ideas.update(activeIdea.id || (activeIdea as any)._id, {
        title: editingTitle.trim(),
        category: editingCategory,
        status: editingStatus,
        tags: tagsArray,
        sections: editingSections,
        changeNote: changeNote.trim() || undefined,
      });

      if (res.idea) {
        setActiveIdea(res.idea);
        setIdeas(prev => prev.map(i => ((i.id || i._id) === (res.idea.id || res.idea._id) ? res.idea : i)));
        setChangeNote('');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save idea changes.');
    } finally {
      setSavingIdea(false);
    }
  };

  const handleToggleArchive = async (ideaId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await api.ideas.archive(ideaId);
      if (res.idea) {
        setIdeas(prev => prev.map(i => ((i.id || i._id) === ideaId ? res.idea : i)));
        if (activeIdea && (activeIdea.id === ideaId || (activeIdea as any)._id === ideaId)) {
          setActiveIdea(res.idea);
          setEditingStatus(res.idea.status);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update archive status.');
    }
  };

  const handleDeleteIdea = async (ideaId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this idea? This action cannot be undone.')) {
      return;
    }
    try {
      await api.ideas.delete(ideaId);
      setIdeas(prev => prev.filter(i => (i.id !== ideaId && (i as any)._id !== ideaId)));
      if (activeIdea && (activeIdea.id === ideaId || (activeIdea as any)._id === ideaId)) {
        setActiveIdea(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete idea.');
    }
  };

  const handleRunAnalysis = async () => {
    if (!activeIdea) return;
    try {
      setAnalyzing(true);
      const payload: Partial<Idea> = {
        title: editingTitle,
        category: editingCategory,
        status: editingStatus,
        tags: editingTags.split(',').map(t => t.trim()).filter(Boolean),
        sections: editingSections,
      };
      const res = await api.ideas.analyze(payload);
      setAnalysis(res.analysis);
      setActiveTab('analysis');
    } catch (err: any) {
      alert(err.message || 'Failed to analyze idea.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleStructureWithAI = async () => {
    if (!rawBrainstorm.trim()) {
      alert('Please enter some thoughts, pitch, or notes to structure with AI.');
      return;
    }

    try {
      setStructuringWithAI(true);
      const res = await api.ideas.structureFromText({
        content: rawBrainstorm.trim(),
        category: newCategory !== 'Tech & AI' ? newCategory : undefined,
      });

      if (res.structured) {
        setNewTitle(res.structured.title || newTitle);
        if (res.structured.category) setNewCategory(res.structured.category);
        if (res.structured.tags?.length) setNewTags(res.structured.tags.join(', '));
        if (res.structured.sections) {
          setNewSections({
            overview: res.structured.sections.overview || '',
            problemAndSolution: res.structured.sections.problemAndSolution || '',
            targetAudience: res.structured.sections.targetAudience || '',
            features: res.structured.sections.features || '',
            businessModel: res.structured.sections.businessModel || '',
            competitors: res.structured.sections.competitors || '',
            implementationPlan: res.structured.sections.implementationPlan || '',
            risks: res.structured.sections.risks || '',
            improvementOpportunities: res.structured.sections.improvementOpportunities || '',
          });
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to organize idea with AI.');
    } finally {
      setStructuringWithAI(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Please provide an idea title.');
      return;
    }

    try {
      setSavingIdea(true);
      const tagsArray = newTags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const res = await api.ideas.create({
        title: newTitle.trim(),
        category: newCategory,
        status: 'draft',
        tags: tagsArray,
        sections: newSections,
      });

      if (res.idea) {
        setIdeas(prev => [res.idea, ...prev]);
        setCreateModalOpen(false);
        // Reset form
        setNewTitle('');
        setNewCategory('Tech & AI');
        setNewTags('');
        setRawBrainstorm('');
        setNewSections({
          overview: '',
          problemAndSolution: '',
          targetAudience: '',
          features: '',
          businessModel: '',
          competitors: '',
          implementationPlan: '',
          risks: '',
          improvementOpportunities: '',
        });
        // Open the newly created idea
        handleOpenIdea(res.idea);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create idea.');
    } finally {
      setSavingIdea(false);
    }
  };

  const handleCopySection = (key: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSectionKey(key);
    setTimeout(() => setCopiedSectionKey(null), 1500);
  };

  const handleRestoreVersion = (v: any) => {
    if (!window.confirm(`Restore to Version ${v.version} saved at ${new Date(v.savedAt).toLocaleString()}?`)) {
      return;
    }
    setEditingTitle(v.title);
    setEditingCategory(v.category);
    setEditingStatus(v.status);
    setEditingTags((v.tags || []).join(', '));
    setEditingSections({ ...v.sections });
    setChangeNote(`Restored from Version ${v.version}`);
    setActiveTab('sections');
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shadow-xs">
              <Lightbulb className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Ideas Studio</h1>
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Capture, structure into 9 core strategic sections, critique, and validate projects with AI.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setRawBrainstorm('');
              setNewTitle('');
              setNewCategory('Tech & AI');
              setNewTags('');
              setNewSections({
                overview: '',
                problemAndSolution: '',
                targetAudience: '',
                features: '',
                businessModel: '',
                competitors: '',
                implementationPlan: '',
                risks: '',
                improvementOpportunities: '',
              });
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Idea</span>
          </button>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-50/80 p-2.5 rounded-2xl border border-neutral-200/80">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ideas, problem, features, tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400 transition-shadow"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg text-neutral-700 focus:outline-none cursor-pointer"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>
            ))}
          </select>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_OPTIONS.map(st => (
            <button
              key={st.id}
              onClick={() => setSelectedStatus(st.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                selectedStatus === st.id
                  ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                  : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Ideas Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-2">
          <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-neutral-400">Loading your ideas...</p>
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-20 px-4 border border-dashed border-neutral-200 rounded-3xl bg-neutral-50/50">
          <div className="w-12 h-12 rounded-2xl bg-white border border-neutral-200 flex items-center justify-center mx-auto text-neutral-400 mb-3 shadow-2xs">
            <Lightbulb className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900">No ideas found</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            {search || selectedCategory !== 'All' || selectedStatus !== 'all'
              ? 'Try adjusting your search query or filters.'
              : 'Create your first idea manually or use AI to organize unstructured brainstorm notes into 9 sections.'}
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg hover:bg-black cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Idea</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => {
            const ideaId = idea.id || (idea as any)._id;
            const isArchived = idea.status === 'archived';

            return (
              <div
                key={ideaId}
                onClick={() => handleOpenIdea(idea)}
                className="group relative bg-white border border-neutral-200 hover:border-neutral-900/40 rounded-2xl p-4 transition-all hover:shadow-xs cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-700 font-semibold">
                      {idea.category || 'Tech & AI'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {idea.version && idea.version > 1 && (
                        <span className="text-[10px] font-mono text-neutral-400">
                          v{idea.version}
                        </span>
                      )}
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full capitalize ${
                        idea.status === 'validated'
                          ? 'bg-neutral-900 text-white font-semibold'
                          : idea.status === 'active'
                          ? 'bg-neutral-200 text-neutral-900 font-semibold'
                          : idea.status === 'archived'
                          ? 'bg-neutral-100 text-neutral-400 line-through'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}>
                        {idea.status}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-neutral-900 text-sm group-hover:text-black line-clamp-1 mb-1.5">
                    {idea.title}
                  </h3>

                  {/* Brief Snippet */}
                  <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed mb-3">
                    {idea.sections?.overview || idea.sections?.problemAndSolution || 'No overview provided yet. Click to flesh out the 9 sections.'}
                  </p>

                  {/* Tags */}
                  {idea.tags && idea.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {idea.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-50 text-neutral-500 border border-neutral-200/60">
                          #{t}
                        </span>
                      ))}
                      {idea.tags.length > 3 && (
                        <span className="text-[10px] font-mono text-neutral-400 px-1 py-0.5">
                          +{idea.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer and Actions */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-400">
                  <span className="text-[10px] font-mono">
                    {new Date(idea.updatedAt || idea.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>

                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {onNavigateToChat && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToChat(ideaId, idea.title);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 cursor-pointer"
                        title="Brainstorm in Chat"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleToggleArchive(ideaId, e)}
                      className="p-1 text-neutral-400 hover:text-neutral-900 rounded hover:bg-neutral-100 cursor-pointer"
                      title={isArchived ? 'Unarchive' : 'Archive'}
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteIdea(ideaId, e)}
                      className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-neutral-100 cursor-pointer"
                      title="Delete idea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Idea Detail & Edit Modal */}
      {activeIdea && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <input
                    type="text"
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    placeholder="Idea Title..."
                    className="font-bold text-base text-neutral-900 bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-neutral-900 focus:outline-none truncate w-full sm:w-96"
                  />
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-neutral-400">
                    <span className="font-mono">v{activeIdea.version || 1}</span>
                    <span>·</span>
                    <span>Last updated {new Date(activeIdea.updatedAt || activeIdea.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onNavigateToChat && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = activeIdea.id || (activeIdea as any)._id;
                      onNavigateToChat(id, activeIdea.title);
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-medium rounded-lg cursor-pointer transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Discuss in Chat</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveIdea(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sub-header Controls & Tabs */}
            <div className="px-6 py-2.5 bg-neutral-50/70 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                {/* Category Selector */}
                <select
                  value={editingCategory}
                  onChange={(e) => setEditingCategory(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:outline-none cursor-pointer"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Status Selector */}
                <select
                  value={editingStatus}
                  onChange={(e) => setEditingStatus(e.target.value as any)}
                  className="px-2.5 py-1 bg-white border border-neutral-200 rounded-lg text-neutral-800 focus:outline-none cursor-pointer capitalize font-mono text-[11px]"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="validated">Validated</option>
                  <option value="implemented">Implemented</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 bg-neutral-200/60 p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setActiveTab('sections')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    activeTab === 'sections' ? 'bg-white text-neutral-900 shadow-2xs font-semibold' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  9 Sections
                </button>
                <button
                  onClick={handleRunAnalysis}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'analysis' ? 'bg-white text-neutral-900 shadow-2xs font-semibold' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-neutral-800" />
                  <span>AI Critique & Insights</span>
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                    activeTab === 'history' ? 'bg-white text-neutral-900 shadow-2xs font-semibold' : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <History className="w-3 h-3" />
                  <span>Versions ({activeIdea.versionHistory?.length || 1})</span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: 9 STRUCTURED SECTIONS */}
              {activeTab === 'sections' && (
                <div className="space-y-5">
                  {/* Tags Input */}
                  <div className="flex items-center gap-2 text-xs">
                    <Tag className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Add comma-separated tags (e.g. b2b, saas, ai, mobile)..."
                      value={editingTags}
                      onChange={(e) => setEditingTags(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  {/* 9 Structured Sections Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SECTION_METADATA.map((sec, idx) => (
                      <div
                        key={sec.key}
                        className={`p-3.5 border border-neutral-200 rounded-2xl bg-neutral-50/50 hover:bg-neutral-50 transition-colors flex flex-col justify-between ${
                          idx === 0 || idx === 1 ? 'md:col-span-2' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-neutral-200/60 mb-2">
                          <div>
                            <span className="text-xs font-bold text-neutral-900">{sec.label}</span>
                            <p className="text-[10px] text-neutral-400 font-sans">{sec.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopySection(sec.key, editingSections[sec.key])}
                            className="p-1 text-neutral-400 hover:text-neutral-800 rounded cursor-pointer"
                            title="Copy section"
                          >
                            {copiedSectionKey === sec.key ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <textarea
                          rows={idx === 0 || idx === 1 ? 3 : 4}
                          value={editingSections[sec.key] || ''}
                          onChange={(e) => setEditingSections({ ...editingSections, [sec.key]: e.target.value })}
                          placeholder={`Enter ${sec.label.toLowerCase()}...`}
                          className="w-full text-xs bg-white border border-neutral-200/90 rounded-xl p-2.5 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 leading-relaxed font-sans resize-y"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Optional Change Note for Versioning */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                      Change Note (optional snapshot description for version history):
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Refined business model and added competitor differentiators"
                      value={changeNote}
                      onChange={(e) => setChangeNote(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: AI CRITIQUE & IMPROVEMENTS */}
              {activeTab === 'analysis' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-900 uppercase font-mono tracking-wider">
                        Strategic AI Evaluation
                      </h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Objective critique, identified weaknesses, critical questions, and high-impact upgrades.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRunAnalysis}
                      disabled={analyzing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-black cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{analyzing ? 'Evaluating...' : 'Re-Analyze Idea'}</span>
                    </button>
                  </div>

                  {analyzing ? (
                    <div className="py-16 flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-mono text-neutral-400">Analyzing venture feasibility and weaknesses...</p>
                    </div>
                  ) : analysis ? (
                    <div className="space-y-4">
                      {/* Critique Summary */}
                      {analysis.critique && (
                        <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl">
                          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">Executive Critique</span>
                          <p className="text-xs text-neutral-800 font-medium leading-relaxed mt-1">
                            {analysis.critique}
                          </p>
                        </div>
                      )}

                      {/* Weaknesses / Vulnerabilities */}
                      {analysis.weaknesses && analysis.weaknesses.length > 0 && (
                        <div className="p-4 bg-white border border-neutral-200 rounded-2xl space-y-2">
                          <span className="text-[10px] font-mono font-bold text-neutral-900 uppercase flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-neutral-900" />
                            <span>Vulnerabilities & Assumptions to Validate</span>
                          </span>
                          <ul className="space-y-1.5 text-xs text-neutral-700">
                            {analysis.weaknesses.map((w, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-neutral-400 mt-0.5 font-mono">•</span>
                                <span className="leading-relaxed">{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Missing Information Questions */}
                      {analysis.missingQuestions && analysis.missingQuestions.length > 0 && (
                        <div className="p-4 bg-white border border-neutral-200 rounded-2xl space-y-2">
                          <span className="text-[10px] font-mono font-bold text-neutral-900 uppercase flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-neutral-900" />
                            <span>Missing Critical Information (Answer these)</span>
                          </span>
                          <ul className="space-y-1.5 text-xs text-neutral-700">
                            {analysis.missingQuestions.map((q, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-neutral-400 mt-0.5 font-mono">?</span>
                                <span className="leading-relaxed font-medium text-neutral-800">{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Suggested Improvements */}
                      {analysis.suggestedImprovements && analysis.suggestedImprovements.length > 0 && (
                        <div className="p-4 bg-white border border-neutral-200 rounded-2xl space-y-2">
                          <span className="text-[10px] font-mono font-bold text-neutral-900 uppercase flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                            <span>High-Impact Improvement Opportunities</span>
                          </span>
                          <ul className="space-y-1.5 text-xs text-neutral-700">
                            {analysis.suggestedImprovements.map((imp, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-neutral-900 mt-0.5 shrink-0" />
                                <span className="leading-relaxed">{imp}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Immediate Next Steps */}
                      {analysis.nextSteps && analysis.nextSteps.length > 0 && (
                        <div className="p-4 bg-neutral-900 text-white rounded-2xl space-y-2 shadow-xs">
                          <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                            Immediate Action Steps
                          </span>
                          <ul className="space-y-1.5 text-xs text-neutral-200">
                            {analysis.nextSteps.map((s, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-neutral-400 font-mono text-[11px] mt-0.5">{i + 1}.</span>
                                <span className="leading-relaxed">{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-xs text-neutral-400">
                      Click "Re-Analyze Idea" to run deep AI critique and suggestions.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: VERSION HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="pb-2 border-b border-neutral-100">
                    <h4 className="text-xs font-bold text-neutral-900 uppercase font-mono tracking-wider">
                      Immutable Version History
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Every update automatically captures an immutable snapshot. Restore any prior version with one click.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {(activeIdea.versionHistory || []).slice().reverse().map((vh, i) => (
                      <div
                        key={i}
                        className="p-3.5 border border-neutral-200 rounded-xl bg-white hover:bg-neutral-50 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold font-mono text-neutral-900">
                              Version {vh.version}
                            </span>
                            <span className="text-[10px] font-mono text-neutral-400">
                              {new Date(vh.savedAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 mt-1 font-sans">
                            {vh.changeNote || 'Standard snapshot update'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(vh)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-neutral-200 rounded-lg text-neutral-700 hover:text-neutral-900 hover:bg-neutral-100 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleToggleArchive(activeIdea.id || (activeIdea as any)._id, e)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-200/50 cursor-pointer"
                >
                  {editingStatus === 'archived' ? 'Unarchive Idea' : 'Archive Idea'}
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteIdea(activeIdea.id || (activeIdea as any)._id, e)}
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer"
                >
                  Delete Idea
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveIdea(null)}
                  className="px-4 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveIdea}
                  disabled={savingIdea}
                  className="px-5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {savingIdea ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Create Idea Modal (Manual or Organize with AI) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white border border-neutral-200 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Create New Idea</h3>
                  <p className="text-[11px] text-neutral-500">
                    Draft manually or paste unstructured notes to organize into 9 structured sections.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* AI Brainstorm Input */}
              <div className="p-4 bg-neutral-50/80 border border-neutral-200/90 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                    <span>Quick AI Organizer</span>
                  </label>
                  <span className="text-[10px] font-mono text-neutral-400">Optional</span>
                </div>
                <textarea
                  rows={3}
                  value={rawBrainstorm}
                  onChange={(e) => setRawBrainstorm(e.target.value)}
                  placeholder="Paste unstructured notes, elevator pitch, or speech-to-text transcript... AI will analyze and populate all 9 sections below."
                  className="w-full text-xs p-2.5 bg-white border border-neutral-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-400 leading-relaxed font-sans"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleStructureWithAI}
                    disabled={structuringWithAI || !rawBrainstorm.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-black text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{structuringWithAI ? 'Structuring with AI...' : 'Organize into 9 Sections'}</span>
                  </button>
                </div>
              </div>

              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. AI-Powered Freelance Escrow Platform"
                    className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none bg-white cursor-pointer"
                  >
                    {CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Tags</label>
                <input
                  type="text"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="Comma-separated (e.g. saas, ai, automation)"
                  className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                />
              </div>

              {/* Core Sections (Compact edit in create modal) */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-neutral-900 block border-b border-neutral-100 pb-1">
                  Structured Sections (Editable)
                </span>

                {SECTION_METADATA.map((sec) => (
                  <div key={sec.key}>
                    <label className="block text-[11px] font-medium text-neutral-600 mb-0.5">
                      {sec.label}
                    </label>
                    <textarea
                      rows={2}
                      value={newSections[sec.key] || ''}
                      onChange={(e) => setNewSections({ ...newSections, [sec.key]: e.target.value })}
                      placeholder={`Draft ${sec.label.toLowerCase()}...`}
                      className="w-full text-xs p-2 border border-neutral-200 rounded-lg focus:outline-none leading-relaxed"
                    />
                  </div>
                ))}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-neutral-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingIdea || !newTitle.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {savingIdea ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Create Idea</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
