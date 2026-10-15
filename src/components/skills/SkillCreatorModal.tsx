import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Skill } from '../../types/index.js';
import {
  Sparkles,
  Play,
  Copy,
  Check,
  X,
  Code,
  Sliders,
  FileText
} from 'lucide-react';

interface SkillCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (skill: Skill) => void;
  initialMode?: 'conversation' | 'form' | 'markdown' | 'import';
  editingSkill?: Skill | null;
}

const CATEGORIES = ['Writing', 'Refinement', 'Planning', 'Summarization', 'Creative', 'Analysis'];

export const SkillCreatorModal: React.FC<SkillCreatorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  editingSkill = null,
}) => {
  if (!isOpen) return null;

  // Active view tab: 'configure' | 'test' | 'markdown'
  const [activeTab, setActiveTab] = useState<'configure' | 'test' | 'markdown'>('configure');

  // Core Skill Fields
  const [name, setName] = useState(editingSkill?.name || '');
  const [description, setDescription] = useState(editingSkill?.description || '');
  const [category, setCategory] = useState(editingSkill?.category || 'Writing');
  const [promptTemplate, setPromptTemplate] = useState(
    editingSkill?.promptTemplate || 'Analyze the following text and provide structured, high-value insights:\n\n{text}'
  );
  const [skillMd, setSkillMd] = useState(editingSkill?.skillMd || '');

  // Quick AI Prompt Builder
  const [aiIdea, setAiIdea] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Live Test State
  const [sampleInput, setSampleInput] = useState(
    'Today I worked through several important decisions regarding my focus and priorities. Feeling clarity, but need action items.'
  );
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Save State
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingSkill) {
      setName(editingSkill.name || '');
      setDescription(editingSkill.description || '');
      setCategory(editingSkill.category || 'Writing');
      setPromptTemplate(editingSkill.promptTemplate || '');
      setSkillMd(editingSkill.skillMd || '');
    }
  }, [editingSkill]);

  // One-Click AI Generation
  const handleAIGenerate = async (customPrompt?: string) => {
    const promptToUse = customPrompt || aiIdea;
    if (!promptToUse.trim() || generating) return;

    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await api.skills.generateSpec({
        prompt: promptToUse.trim(),
        currentDraft: {
          name,
          description,
          category,
          promptTemplate,
        },
      });

      if (res.name) setName(res.name);
      if (res.description) setDescription(res.description);
      if (res.category) setCategory(res.category);
      if (res.promptTemplate) setPromptTemplate(res.promptTemplate);
      if (res.skillMd) setSkillMd(res.skillMd);

      // Auto-switch to configure tab
      setActiveTab('configure');
    } catch (err: any) {
      console.error('Failed to generate skill:', err);
      setGenerateError(err.message || 'Could not generate skill. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Run Test directly on current instructions
  const handleRunTest = async () => {
    if (!sampleInput.trim() || testing) return;
    setTesting(true);
    setTestOutput(null);

    try {
      const res = await api.skills.testDraft({
        promptTemplate: promptTemplate.trim(),
        skillMd: skillMd.trim() || undefined,
        input: sampleInput.trim(),
      });

      setTestOutput(res.output || 'No output generated.');
    } catch (err: any) {
      console.error('Test error:', err);
      setTestOutput(`Execution error: ${err.message || 'Failed to run test'}`);
    } finally {
      setTesting(false);
    }
  };

  // Save Skill
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please provide a Skill Name.');
      return;
    }

    setSaving(true);
    try {
      // Build clean SKILL.md if not present
      const finalMd =
        skillMd ||
        `---
name: ${name.trim()}
description: ${description.trim()}
category: ${category}
variables:
  - text
---

# ${name.trim()}

${description.trim()}

## Instructions
${promptTemplate.trim()}
`;

      let saved: Skill;
      const sId = editingSkill?.id || (editingSkill as any)?._id;

      if (editingSkill && sId) {
        const res = await api.skills.update(sId, {
          name: name.trim(),
          description: description.trim(),
          category,
          promptTemplate: promptTemplate.trim(),
          skillMd: finalMd,
        });
        saved = res.skill;
      } else {
        const res = await api.skills.create({
          name: name.trim(),
          description: description.trim(),
          category,
          promptTemplate: promptTemplate.trim(),
          skillMd: finalMd,
          tags: [category.toLowerCase()],
        });
        saved = res.skill;
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save skill:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-neutral-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Minimal Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              {editingSkill ? 'Edit Skill' : 'Create AI Skill'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Reusable intelligence for LifeNote chat, journals, and plans.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* AI Quick Generator Box */}
        <div className="px-6 pt-4 pb-3 bg-neutral-50/80 border-b border-neutral-100">
          <label className="block text-[11px] font-semibold text-neutral-600 uppercase tracking-wider mb-1.5">
            Auto-Draft with AI
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={aiIdea}
              onChange={(e) => setAiIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAIGenerate();
                }
              }}
              placeholder="e.g. Socratic questions for reflection, or extract 3 action items..."
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-white border border-neutral-200 rounded-xl text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300"
            />
            <button
              type="button"
              disabled={generating || !aiIdea.trim()}
              onClick={() => handleAIGenerate()}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 disabled:opacity-50 shadow-2xs"
            >
              {generating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Drafting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate</span>
                </>
              )}
            </button>
          </div>

          {generateError && (
            <p className="text-xs text-red-600 mt-1.5">{generateError}</p>
          )}

          {/* Quick presets (minimal, 1-click) */}
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] text-neutral-400 shrink-0">Quick ideas:</span>
            {[
              'Extract 3 Action Items',
              'Socratic Inquirer',
              'Executive Summary',
              'Polish & Clarify Prose'
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => {
                  setAiIdea(idea);
                  handleAIGenerate(idea);
                }}
                className="text-[11px] px-2 py-0.5 bg-white border border-neutral-200/80 rounded-full text-neutral-600 hover:text-neutral-900 hover:border-neutral-400 transition-colors cursor-pointer shrink-0"
              >
                {idea}
              </button>
            ))}
          </div>
        </div>

        {/* Minimal Tab Bar */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-neutral-100 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('configure')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'configure'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Instructions</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Live Test</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('markdown')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'markdown'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>SKILL.md</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'configure' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Skill Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Action Item Harvester"
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs sm:text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Short Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What this skill does in one brief sentence..."
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-neutral-700">
                    Instructions & Prompt Template
                  </label>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Use {'{text}'} as input placeholder
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={promptTemplate}
                  onChange={(e) => {
                    setPromptTemplate(e.target.value);
                    // keep skillMd roughly in sync
                    setSkillMd(
                      `---\nname: ${name || 'Custom Skill'}\ndescription: ${description}\ncategory: ${category}\nvariables:\n  - text\n---\n\n# ${name || 'Custom Skill'}\n\n${e.target.value}`
                    );
                  }}
                  placeholder="Explain how the AI should process the input. E.g.: Extract 3 bullet points with concise actionable tasks..."
                  className="w-full p-3 text-xs sm:text-sm font-mono border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300 leading-relaxed"
                />
              </div>
            </div>
          )}

          {activeTab === 'test' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Sample Input Text
                </label>
                <textarea
                  rows={3}
                  value={sampleInput}
                  onChange={(e) => setSampleInput(e.target.value)}
                  placeholder="Type a sample sentence or journal note to test..."
                  className="w-full p-2.5 text-xs border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-neutral-500">
                  Runs against current instructions without needing to save first
                </span>
                <button
                  type="button"
                  disabled={testing || !sampleInput.trim()}
                  onClick={handleRunTest}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {testing ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Testing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Run Test</span>
                    </>
                  )}
                </button>
              </div>

              {testOutput && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-neutral-700">
                      Test Output
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopy(testOutput)}
                      className="text-[11px] text-neutral-500 hover:text-neutral-900 flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {testOutput}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'markdown' && (
            <div className="space-y-2 animate-in fade-in duration-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-700">
                  Standard SKILL.md Specification
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">YAML + Markdown</span>
              </div>
              <textarea
                rows={10}
                value={skillMd || `---\nname: ${name}\ndescription: ${description}\ncategory: ${category}\nvariables:\n  - text\n---\n\n# ${name}\n\n${description}\n\n## Instructions\n${promptTemplate}`}
                onChange={(e) => setSkillMd(e.target.value)}
                className="w-full p-3 text-xs font-mono border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-400 leading-relaxed bg-neutral-50"
              />
            </div>
          )}
        </div>

        {/* Minimal Footer Actions */}
        <div className="px-6 py-3.5 bg-neutral-50 border-t border-neutral-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !name.trim()}
            onClick={handleSave}
            className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Skill</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
