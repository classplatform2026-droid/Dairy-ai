import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Skill, SkillVersion, SkillExecution } from '../../types/index.js';
import {
  Sparkles,
  Play,
  Copy,
  Check,
  X,
  Download,
  Trash2,
  History,
  FileText,
  Terminal,
  Clock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Code,
  Eye,
  MessageSquare,
  Undo2,
  Sliders,
  Feather,
  BookOpen,
  Compass,
  Moon,
  Sun,
  Coffee,
  Heart,
  Flame
} from 'lucide-react';

interface SkillDetailModalProps {
  skillId: string;
  isOpen: boolean;
  onClose: () => void;
  onSkillUpdated: (skill: Skill) => void;
  onSkillDeleted?: (skillId: string) => void;
  onOpenInChat?: (skillId: string, skillName: string) => void;
}

const EMBLEM_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Sparkles,
  Feather,
  BookOpen,
  Compass,
  CheckCircle2,
  Moon,
  Sun,
  Coffee,
  Heart,
  Flame,
  Terminal,
  FileText,
};

export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({
  skillId,
  isOpen,
  onClose,
  onSkillUpdated,
  onSkillDeleted,
  onOpenInChat,
}) => {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'spec' | 'test' | 'versions' | 'history'>('spec');
  const [specViewMode, setSpecViewMode] = useState<'preview' | 'raw' | 'edit'>('preview');

  // Editing state for raw markdown and metadata
  const [editedSkillMd, setEditedSkillMd] = useState('');
  const [editedPromptTemplate, setEditedPromptTemplate] = useState('');
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [changeNote, setChangeNote] = useState('Updated instructions');
  const [savingChanges, setSavingChanges] = useState(false);

  // Test bench state
  const [testInput, setTestInput] = useState('');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testModel, setTestModel] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [refinementFeedback, setRefinementFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  // General states
  const [copied, setCopied] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [previewingSnapshot, setPreviewingSnapshot] = useState<SkillVersion | null>(null);

  const fetchSkillDetails = async () => {
    if (!skillId) return;
    try {
      setLoading(true);
      const res = await api.skills.get(skillId);
      if (res.skill) {
        setSkill(res.skill);
        setEditedSkillMd(res.skill.skillMd || '');
        setEditedPromptTemplate(res.skill.promptTemplate || '');
        setEditedName(res.skill.name || '');
        setEditedDescription(res.skill.description || '');
        setEditedCategory(res.skill.category || 'Writing');

        // Extract a sample from example in SKILL.md if testInput is empty
        if (!testInput && res.skill.skillMd) {
          const exampleMatch = res.skill.skillMd.match(/### Example[^\n]*\s+\*\*Input:\*\*\s+```[a-z]*\s*([\s\S]*?)```/i);
          if (exampleMatch && exampleMatch[1].trim()) {
            setTestInput(exampleMatch[1].trim());
          } else {
            setTestInput('This evening was quietly reflective. I observed my habit of procrastinating on things I care deeply about, and realized it stems from fear of imperfection.');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load skill details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSkillDetails();
    }
  }, [skillId, isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportSkillMd = () => {
    if (!skill) return;
    const content = skill.skillMd || `# ${skill.name}\n\n${skill.description}\n\n${skill.promptTemplate}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.SKILL.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveChanges = async () => {
    if (!skill || skill.isSystem) return;
    setSavingChanges(true);
    const id = skill.id || (skill as any)._id;

    try {
      const res = await api.skills.update(id, {
        name: editedName.trim(),
        description: editedDescription.trim(),
        category: editedCategory,
        skillMd: editedSkillMd.trim(),
        promptTemplate: editedPromptTemplate.trim(),
        changeNote: changeNote.trim() || 'Updated instructions',
      });

      if (res.skill) {
        setSkill(res.skill);
        onSkillUpdated(res.skill);
        setSpecViewMode('preview');
        setChangeNote('Updated instructions');
      }
    } catch (err: any) {
      console.error('Failed to save skill changes:', err);
      alert(`Save error: ${err.message || 'Could not update skill'}`);
    } finally {
      setSavingChanges(false);
    }
  };

  const handleRunTest = async () => {
    if (!skill || !testInput.trim() || testing) return;
    setTesting(true);
    setTestOutput(null);

    const id = skill.id || (skill as any)._id;

    try {
      const res = await api.skills.test(id, {
        input: testInput.trim(),
      });

      setTestOutput(res.output);
      setTestDurationMs(res.durationMs);
      setTestModel(res.model);

      // Refresh skill to get updated execution history
      const refreshed = await api.skills.get(id);
      if (refreshed.skill) {
        setSkill(refreshed.skill);
        onSkillUpdated(refreshed.skill);
      }
    } catch (err: any) {
      console.error('Skill test error:', err);
      setTestOutput(`Execution error: ${err.message || 'Execution failed'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleRefineInstructions = async () => {
    if (!skill || !refinementFeedback.trim() || refining) return;
    setRefining(true);

    try {
      const res = await api.skills.refineSpec({
        skillMd: skill.skillMd || editedSkillMd,
        feedback: refinementFeedback.trim(),
        testOutput: testOutput || undefined,
      });

      if (res.skillMd) {
        setEditedSkillMd(res.skillMd);
        if (res.promptTemplate) setEditedPromptTemplate(res.promptTemplate);
        if (res.description) setEditedDescription(res.description);

        // Auto save to update the skill
        const id = skill.id || (skill as any)._id;
        const updated = await api.skills.update(id, {
          skillMd: res.skillMd,
          promptTemplate: res.promptTemplate || skill.promptTemplate,
          description: res.description || skill.description,
          changeNote: `Refined: ${refinementFeedback.trim()}`,
        });

        if (updated.skill) {
          setSkill(updated.skill);
          onSkillUpdated(updated.skill);
        }
        setRefinementFeedback('');
      }
    } catch (err: any) {
      console.error('Refinement error:', err);
      alert(`Refinement failed: ${err.message || 'Could not refine skill'}`);
    } finally {
      setRefining(false);
    }
  };

  const handleRestoreVersion = async (versionNum: number) => {
    if (!skill || skill.isSystem) return;
    const confirm = window.confirm(`Restore skill "${skill.name}" to version ${versionNum}? Current draft will be backed up as a new snapshot.`);
    if (!confirm) return;

    setRestoringVersion(versionNum);
    const id = skill.id || (skill as any)._id;

    try {
      const res = await api.skills.restoreVersion(id, versionNum);
      if (res.skill) {
        setSkill(res.skill);
        setEditedSkillMd(res.skill.skillMd || '');
        setEditedPromptTemplate(res.skill.promptTemplate || '');
        onSkillUpdated(res.skill);
        setPreviewingSnapshot(null);
      }
    } catch (err: any) {
      console.error('Failed to restore version:', err);
      alert(`Restore failed: ${err.message || 'Unknown error'}`);
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleDelete = async () => {
    if (!skill || skill.isSystem) return;
    const confirm = window.confirm(`Permanently delete skill "${skill.name}"? This action cannot be undone.`);
    if (!confirm) return;

    const id = skill.id || (skill as any)._id;
    try {
      await api.skills.delete(id);
      if (onSkillDeleted) onSkillDeleted(id);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete skill:', err);
      alert(`Delete error: ${err.message || 'Failed'}`);
    }
  };

  const SelectedIcon = skill ? (EMBLEM_ICONS[skill.icon] || Sparkles) : Sparkles;

  // Render formatted markdown helper
  const renderFormattedMarkdown = (markdown: string) => {
    if (!markdown) {
      return (
        <div className="p-8 text-center text-xs text-neutral-400">
          No canonical SKILL.md specification available for this skill.
        </div>
      );
    }

    // Split frontmatter and body
    const parts = markdown.split(/^---\s*$/m);
    let frontmatter = '';
    let body = markdown;
    if (markdown.startsWith('---') && parts.length >= 3) {
      frontmatter = parts[1].trim();
      body = parts.slice(2).join('---').trim();
    }

    const lines = body.split('\n');

    return (
      <div className="space-y-4 text-xs text-neutral-800 leading-relaxed font-sans">
        {frontmatter && (
          <div className="p-3.5 bg-neutral-50 border border-neutral-200/80 rounded-xl font-mono text-[11px] text-neutral-600">
            <span className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">YAML Frontmatter</span>
            <pre className="whitespace-pre-wrap">{frontmatter}</pre>
          </div>
        )}

        <div className="space-y-3">
          {lines.map((line, idx) => {
            if (line.startsWith('# ')) {
              return (
                <h2 key={idx} className="text-lg font-bold text-neutral-900 border-b border-neutral-200 pb-1.5 pt-2">
                  {line.replace('# ', '')}
                </h2>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <h3 key={idx} className="text-sm font-bold text-neutral-900 pt-3 border-t border-neutral-100 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 inline-block" />
                  <span>{line.replace('## ', '')}</span>
                </h3>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h4 key={idx} className="text-xs font-semibold text-neutral-800 pt-2 font-mono uppercase tracking-wider">
                  {line.replace('### ', '')}
                </h4>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-2">
                  <span className="text-neutral-400 font-bold">·</span>
                  <span className="flex-1">{line.replace('- ', '')}</span>
                </div>
              );
            }
            if (line.match(/^\d+\.\s+/)) {
              return (
                <div key={idx} className="flex items-start gap-2 pl-2 font-medium text-neutral-900">
                  <span className="font-mono text-neutral-400 text-[11px]">{line.match(/^\d+\./)?.[0]}</span>
                  <span className="flex-1">{line.replace(/^\d+\.\s+/, '')}</span>
                </div>
              );
            }
            if (line.startsWith('```')) {
              return (
                <div key={idx} className="text-[10px] font-mono text-neutral-400 py-0.5">
                  {line}
                </div>
              );
            }
            if (!line.trim()) {
              return <div key={idx} className="h-1" />;
            }
            return (
              <p key={idx} className="text-neutral-700">
                {line}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-5xl w-full my-auto flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <header className="px-6 py-4 border-b border-neutral-200/90 flex items-center justify-between gap-4 bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 shadow-xs">
              <SelectedIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-neutral-900 truncate">
                  {skill?.name || 'Skill Details'}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 font-semibold">
                  v{skill?.version || 1}.0.0
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                  {skill?.category}
                </span>
                {skill?.isSystem ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 text-white font-medium">
                    Built-in System
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                    Custom Reusable Skill
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                {skill?.description}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenInChat && skill && (
              <button
                type="button"
                onClick={() => {
                  const id = skill.id || (skill as any)._id;
                  onOpenInChat(id, skill.name);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Launch this skill in LifeNote Chat"
              >
                <MessageSquare className="w-3.5 h-3.5 text-neutral-900" />
                <span className="hidden sm:inline">Use in Chat</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportSkillMd}
              className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
              title="Download SKILL.md file"
            >
              <Download className="w-3.5 h-3.5 text-neutral-700" />
              <span className="hidden sm:inline">Export .md</span>
            </button>

            {skill && !skill.isSystem && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete skill"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-neutral-200 bg-white flex items-center gap-6 text-xs font-medium shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('spec')}
            className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'spec'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>SKILL.md Specification</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Live Test Bench</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'versions'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Version History ({skill?.versionHistory?.length || 1})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Execution Audit Log ({skill?.executionHistory?.length || 0})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-neutral-400">Loading skill details...</span>
            </div>
          ) : !skill ? (
            <div className="py-16 text-center text-xs text-neutral-500">
              Skill could not be found or loaded.
            </div>
          ) : (
            <>
              {/* TAB 1: SPECIFICATION & SKILL.MD */}
              {activeTab === 'spec' && (
                <div className="space-y-4">
                  {/* Sub-view switch: Preview vs Raw vs Edit */}
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                    <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setSpecViewMode('preview')}
                        className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                          specViewMode === 'preview'
                            ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Formatted View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSpecViewMode('raw')}
                        className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                          specViewMode === 'raw'
                            ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                            : 'text-neutral-600 hover:text-neutral-900'
                        }`}
                      >
                        <Code className="w-3.5 h-3.5" />
                        <span>Raw Markdown</span>
                      </button>

                      {!skill.isSystem && (
                        <button
                          type="button"
                          onClick={() => setSpecViewMode('edit')}
                          className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                            specViewMode === 'edit'
                              ? 'bg-white text-neutral-900 font-semibold shadow-2xs'
                              : 'text-neutral-600 hover:text-neutral-900'
                          }`}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Edit Specification</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(skill.skillMd || skill.promptTemplate)}
                        className="px-2.5 py-1 text-xs border border-neutral-200 hover:bg-neutral-50 rounded-lg cursor-pointer flex items-center gap-1 text-neutral-700"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy Spec'}</span>
                      </button>
                    </div>
                  </div>

                  {/* PREVIEW MODE */}
                  {specViewMode === 'preview' && (
                    <div className="p-6 bg-white border border-neutral-200/90 rounded-2xl shadow-xs">
                      {renderFormattedMarkdown(skill.skillMd || '')}
                    </div>
                  )}

                  {/* RAW MARKDOWN MODE */}
                  {specViewMode === 'raw' && (
                    <div className="bg-neutral-900 text-neutral-100 p-4 rounded-2xl font-mono text-xs overflow-x-auto leading-relaxed shadow-xs">
                      <pre className="whitespace-pre-wrap">{skill.skillMd || `# ${skill.name}\n\n${skill.description}`}</pre>
                    </div>
                  )}

                  {/* EDIT SPECIFICATION MODE */}
                  {specViewMode === 'edit' && (
                    <div className="space-y-4 bg-neutral-50/60 p-5 border border-neutral-200 rounded-2xl">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-neutral-700">Skill Name</label>
                          <input
                            type="text"
                            value={editedName}
                            onChange={e => setEditedName(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-neutral-700">Category</label>
                          <select
                            value={editedCategory}
                            onChange={e => setEditedCategory(e.target.value)}
                            className="w-full px-2.5 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none"
                          >
                            {['Writing', 'Refinement', 'Planning', 'Summarization', 'Creative', 'Analysis'].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="block text-xs font-semibold text-neutral-700">Changelog Note for this Version</label>
                          <input
                            type="text"
                            value={changeNote}
                            onChange={e => setChangeNote(e.target.value)}
                            placeholder="e.g. Added constraint for Bengali language"
                            className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-neutral-700">Short Description</label>
                        <input
                          type="text"
                          value={editedDescription}
                          onChange={e => setEditedDescription(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-neutral-700">Canonical SKILL.md Document</label>
                          <span className="text-[10px] font-mono text-neutral-400">Strict YAML frontmatter + Markdown body</span>
                        </div>
                        <textarea
                          rows={14}
                          value={editedSkillMd}
                          onChange={e => setEditedSkillMd(e.target.value)}
                          className="w-full p-4 text-xs font-mono bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed resize-none"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[11px] font-mono text-neutral-400">
                          Saving will create version v{(skill.version || 1) + 1}.0.0
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSpecViewMode('preview')}
                            className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                          >
                            Cancel
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveChanges}
                            disabled={savingChanges || !editedName.trim()}
                            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {savingChanges ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving New Version...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Save Changes (v{(skill.version || 1) + 1}.0.0)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LIVE TEST BENCH */}
              {activeTab === 'test' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left: Input & Execution */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-neutral-800">Sample Test Input</label>
                        <button
                          type="button"
                          onClick={() => {
                            const exampleMatch = skill.skillMd?.match(/### Example[^\n]*\s+\*\*Input:\*\*\s+```[a-z]*\s*([\s\S]*?)```/i);
                            if (exampleMatch && exampleMatch[1].trim()) {
                              setTestInput(exampleMatch[1].trim());
                            }
                          }}
                          className="text-[11px] font-mono text-neutral-500 hover:text-neutral-900 underline cursor-pointer"
                        >
                          Load Example from SKILL.md
                        </button>
                      </div>
                      <textarea
                        rows={7}
                        value={testInput}
                        onChange={e => setTestInput(e.target.value)}
                        placeholder="Paste or write text to test this skill..."
                        className="w-full p-3.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed resize-none font-sans"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-mono text-neutral-400">
                        Configured AI: <span className="text-neutral-800 font-semibold">Gemini 3.8 Flash</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={testing || !testInput.trim()}
                        className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {testing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Executing Skill...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Execute Skill Test</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Refinement box */}
                    <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                        <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                        <span>Refine Instructions via Feedback</span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Describe what to adjust (e.g. "Too wordy, give bullet points" or "Enforce formal Bengali").
                      </p>
                      <input
                        type="text"
                        value={refinementFeedback}
                        onChange={e => setRefinementFeedback(e.target.value)}
                        placeholder="Tell the AI architect what rule or workflow to tweak..."
                        className="w-full px-3 py-2 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleRefineInstructions}
                          disabled={refining || !refinementFeedback.trim()}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          {refining ? 'Refining Spec...' : 'Update SKILL.md with Feedback'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Output */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-xs font-bold text-neutral-800">Execution Output</span>
                      {testDurationMs !== null && (
                        <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                          <span>{testDurationMs}ms</span>
                          <span>·</span>
                          <span>{testModel}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl min-h-[300px] flex flex-col justify-between">
                      {testOutput ? (
                        <div className="text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto">
                          {testOutput}
                        </div>
                      ) : (
                        <div className="m-auto text-center py-12 text-xs text-neutral-400 font-mono">
                          Run a test on sample text to review live output here.
                        </div>
                      )}

                      {testOutput && (
                        <div className="pt-3 border-t border-neutral-200/60 flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleCopy(testOutput)}
                            className="px-3 py-1 text-xs border border-neutral-200 bg-white hover:bg-neutral-100 rounded-lg cursor-pointer flex items-center gap-1 text-neutral-700"
                          >
                            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copied ? 'Copied' : 'Copy Result'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: VERSION HISTORY */}
              {activeTab === 'versions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 font-mono">
                        Version Changelog & Rollbacks
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Every modification creates an immutable snapshot with change notes
                      </p>
                    </div>
                  </div>

                  {(!skill.versionHistory || skill.versionHistory.length === 0) ? (
                    <div className="p-8 text-center text-xs text-neutral-400">
                      No previous versions logged yet. Current version is v{skill.version || 1}.0.0.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {skill.versionHistory.map((v, i) => (
                        <div
                          key={i}
                          className="p-4 border border-neutral-200 rounded-xl bg-white hover:border-neutral-300 transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-neutral-900 font-mono px-2 py-0.5 rounded bg-neutral-100">
                                v{v.version}.0.0
                              </span>
                              <span className="text-xs text-neutral-700 font-medium">
                                {v.changeNote || (i === skill.versionHistory!.length - 1 ? 'Initial skill creation' : 'Instruction update')}
                              </span>
                              {v.version === skill.version && (
                                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                                  Current Active
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-[11px] font-mono text-neutral-400">
                                {new Date(v.savedAt).toLocaleDateString()} {new Date(v.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>

                              <button
                                type="button"
                                onClick={() => setPreviewingSnapshot(v)}
                                className="px-2.5 py-1 text-xs border border-neutral-200 hover:bg-neutral-50 rounded-lg cursor-pointer"
                              >
                                View Snapshot
                              </button>

                              {!skill.isSystem && v.version !== skill.version && (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreVersion(v.version)}
                                  disabled={restoringVersion === v.version}
                                  className="px-2.5 py-1 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Undo2 className="w-3 h-3" />
                                  <span>{restoringVersion === v.version ? 'Restoring...' : 'Restore'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modal to preview snapshot */}
                  {previewingSnapshot && (
                    <div className="fixed inset-0 z-60 bg-neutral-900/60 flex items-center justify-center p-4">
                      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                          <h4 className="text-sm font-bold text-neutral-900">
                            Snapshot v{previewingSnapshot.version}.0.0 — {previewingSnapshot.changeNote}
                          </h4>
                          <button onClick={() => setPreviewingSnapshot(null)} className="text-neutral-400 hover:text-neutral-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="bg-neutral-900 text-neutral-100 p-4 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                          {previewingSnapshot.skillMd}
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            onClick={() => setPreviewingSnapshot(null)}
                            className="px-4 py-1.5 text-xs border border-neutral-200 rounded-lg hover:bg-neutral-50"
                          >
                            Close
                          </button>
                          {!skill.isSystem && previewingSnapshot.version !== skill.version && (
                            <button
                              onClick={() => handleRestoreVersion(previewingSnapshot.version)}
                              className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg"
                            >
                              Restore This Version
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: EXECUTION AUDIT LOG */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700 font-mono">
                        Execution Audit Log
                      </h3>
                      <p className="text-[11px] text-neutral-400">
                        Tracks latency, models used, and inputs/outputs from test bench and chat invocations
                      </p>
                    </div>
                  </div>

                  {(!skill.executionHistory || skill.executionHistory.length === 0) ? (
                    <div className="p-8 text-center text-xs text-neutral-400">
                      No executions recorded yet. Run a test in the Live Test Bench or in Chat to see history.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {skill.executionHistory.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-4 border border-neutral-200/90 rounded-xl bg-white space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                {item.status}
                              </span>
                              <span className="font-mono text-neutral-500 text-[11px]">
                                {item.model}
                              </span>
                              <span className="font-mono text-neutral-400 text-[11px]">
                                · {item.durationMs}ms
                              </span>
                            </div>

                            <span className="font-mono text-[10px] text-neutral-400">
                              {new Date(item.executedAt).toLocaleDateString()} {new Date(item.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-neutral-400">Sample Input</span>
                              <p className="text-neutral-700 bg-neutral-50 p-2.5 rounded-lg line-clamp-3 leading-relaxed">
                                {item.input}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-bold text-neutral-400">Transformed Output</span>
                              <p className="text-neutral-900 bg-neutral-50 p-2.5 rounded-lg line-clamp-3 leading-relaxed">
                                {item.output}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
