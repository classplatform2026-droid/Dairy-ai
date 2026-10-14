import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Skill } from '../../types/index.js';
import {
  Sparkles,
  Plus,
  Play,
  Edit2,
  Trash2,
  Copy,
  Check,
  X,
  Compass,
  ListChecks,
  BookOpen,
  Feather,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

const CATEGORIES = ['All', 'Writing', 'Refinement', 'Planning', 'Summarization', 'Creative'];

export const SkillsView: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(true);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Writing');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Execute modal / Playground
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [executingSkill, setExecutingSkill] = useState<Skill | null>(null);
  const [inputText, setInputText] = useState('');
  const [executing, setExecuting] = useState(false);
  const [outputText, setOutputText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSkills = async () => {
    try {
      setLoading(true);
      const res = await api.skills.list();
      setSkills(res.skills || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const openCreateModal = () => {
    setEditingSkill(null);
    setName('');
    setDescription('');
    setCategory('Writing');
    setPromptTemplate('Please review and transform the following text with careful attention to style and intent:\n\n"{text}"');
    setTagsInput('custom, writing');
    setModalOpen(true);
  };

  const openEditModal = (s: Skill) => {
    if (s.isSystem) return;
    setEditingSkill(s);
    setName(s.name);
    setDescription(s.description);
    setCategory(s.category);
    setPromptTemplate(s.promptTemplate);
    setTagsInput(s.tags?.join(', ') || '');
    setModalOpen(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !promptTemplate.trim()) return;

    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    try {
      if (editingSkill) {
        const id = editingSkill.id || (editingSkill as any)._id;
        const res = await api.skills.update(id, {
          name,
          description,
          category,
          promptTemplate,
          tags,
        });
        setSkills(prev => prev.map(s => ((s.id || (s as any)._id) === id ? res.skill : s)));
      } else {
        const res = await api.skills.create({
          name,
          description,
          category,
          promptTemplate,
          tags,
        });
        setSkills(prev => [...prev, res.skill]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save skill:', err);
    }
  };

  const handleDeleteSkill = async (s: Skill) => {
    if (s.isSystem) return;
    const id = s.id || (s as any)._id;
    const confirm = window.confirm(`Delete skill "${s.name}"?`);
    if (!confirm) return;

    try {
      await api.skills.delete(id);
      setSkills(prev => prev.filter(item => (item.id || (item as any)._id) !== id));
    } catch (err) {
      console.error('Failed to delete skill:', err);
    }
  };

  const openExecutePlayground = (s: Skill) => {
    setExecutingSkill(s);
    setInputText('');
    setOutputText(null);
    setCopied(false);
    setExecuteModalOpen(true);
  };

  const handleExecute = async () => {
    if (!executingSkill || !inputText.trim()) return;
    setExecuting(true);
    setOutputText(null);

    try {
      const res = await api.ai.executeSkill(executingSkill.promptTemplate, inputText);
      setOutputText(res.output);
    } catch (err) {
      console.error('Failed to execute skill:', err);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopy = () => {
    if (outputText) {
      navigator.clipboard.writeText(outputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filteredSkills = skills.filter(s => {
    if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Skills Library</h1>
          <p className="text-xs text-neutral-500">Reusable prompt templates and cognitive workflows for writing, synthesis, and planning</p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Skill</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer shrink-0 ${
              selectedCategory === cat
                ? 'bg-neutral-900 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-44 bg-neutral-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="p-12 text-center border border-neutral-200 rounded-xl bg-white">
          <p className="text-xs text-neutral-500">No skills found in this category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map(skill => (
            <div
              key={skill.id || (skill as any)._id}
              className="p-5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span>{skill.category}</span>
                    {skill.isSystem ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[10px] text-neutral-500">System Built-In</span>
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-[10px] text-neutral-500">Custom</span>
                      </>
                    )}
                  </div>

                  {!skill.isSystem && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(skill)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 cursor-pointer"
                        title="Edit skill"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSkill(skill)}
                        className="p-1 text-neutral-400 hover:text-red-600 cursor-pointer"
                        title="Delete skill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="font-bold text-neutral-900 text-sm mb-1">{skill.name}</h3>
                <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed mb-4">
                  {skill.description}
                </p>
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400 font-mono">
                  {skill.tags && skill.tags.length > 0 ? skill.tags.map(t => `#${t}`).join(' ') : '{text}'}
                </span>

                <button
                  onClick={() => openExecutePlayground(skill)}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Execute</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Skill Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-xl border border-neutral-200 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">
                {editingSkill ? 'Edit Skill' : 'Create Custom Skill'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSkill} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Skill Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Socratic Questioner"
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this skill does and when to use it..."
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-neutral-700">Prompt Template</label>
                  <span className="text-[11px] font-mono text-neutral-400">Use {'{text}'} placeholder</span>
                </div>
                <textarea
                  required
                  rows={5}
                  value={promptTemplate}
                  onChange={(e) => setPromptTemplate(e.target.value)}
                  placeholder="Analyze the following passage and provide...: {text}"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none font-mono resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="reflection, clarity, philosophy"
                  className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
                >
                  Save Skill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Execute Playground Modal */}
      {executeModalOpen && executingSkill && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-neutral-200 shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-900" />
                <h2 className="text-base font-bold text-neutral-900">
                  Execute: {executingSkill.name}
                </h2>
              </div>
              <button onClick={() => setExecuteModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              {executingSkill.description}
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-700">Input Text to Transform</label>
              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste or write the text you want this skill to process..."
                className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none font-sans"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleExecute}
                disabled={executing || !inputText.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {executing ? 'Executing Skill...' : 'Run Skill'}
              </button>
            </div>

            {outputText && (
              <div className="mt-4 p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-700 border-b border-neutral-200/60 pb-2">
                  <span>Result</span>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-neutral-600 hover:text-neutral-900 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {outputText}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
