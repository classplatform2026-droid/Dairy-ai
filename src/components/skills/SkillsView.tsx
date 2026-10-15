import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Skill } from '../../types/index.js';
import { SkillCreatorModal } from './SkillCreatorModal.js';
import { SkillDetailModal } from './SkillDetailModal.js';
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
  HelpCircle,
  Upload,
  Download,
  Search,
  MessageSquare,
  History,
  FileText,
  Moon,
  Sun,
  Coffee,
  Heart,
  Flame,
  Terminal,
  Clock
} from 'lucide-react';

const CATEGORIES = ['All', 'Writing', 'Refinement', 'Planning', 'Summarization', 'Creative', 'Analysis'];

const EMBLEM_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Sparkles,
  Feather,
  BookOpen,
  Compass,
  CheckCircle,
  Moon,
  Sun,
  Coffee,
  Heart,
  Flame,
  Terminal,
  FileText,
};

interface SkillsViewProps {
  onNavigateToChat?: (skillId?: string, skillName?: string) => void;
}

export const SkillsView: React.FC<SkillsViewProps> = ({ onNavigateToChat }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Skill Creator Modal
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [creatorEditingSkill, setCreatorEditingSkill] = useState<Skill | null>(null);

  // Skill Detail Modal
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Import file ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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
    setCreatorEditingSkill(null);
    setCreatorOpen(true);
  };

  const openEditModal = (s: Skill) => {
    if (s.isSystem) return;
    setCreatorEditingSkill(s);
    setCreatorOpen(true);
  };

  const openSkillDetail = (s: Skill) => {
    const id = s.id || (s as any)._id;
    setSelectedSkillId(id);
    setDetailModalOpen(true);
  };

  const handleSkillSaved = (savedSkill: Skill) => {
    const id = savedSkill.id || (savedSkill as any)._id;
    setSkills(prev => {
      const exists = prev.some(s => (s.id || (s as any)._id) === id);
      if (exists) {
        return prev.map(s => ((s.id || (s as any)._id) === id ? savedSkill : s));
      }
      return [savedSkill, ...prev];
    });
  };

  const handleDeleteSkill = async (s: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    if (s.isSystem) return;
    const id = s.id || (s as any)._id;
    const confirm = window.confirm(`Permanently delete skill "${s.name}"?`);
    if (!confirm) return;

    try {
      await api.skills.delete(id);
      setSkills(prev => prev.filter(item => (item.id || (item as any)._id) !== id));
      if (selectedSkillId === id) {
        setDetailModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete skill:', err);
    }
  };

  const handleExportSkill = (s: Skill, e: React.MouseEvent) => {
    e.stopPropagation();
    const content = s.skillMd || `# ${s.name}\n\n${s.description}\n\n${s.promptTemplate}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${s.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.SKILL.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async ev => {
      const rawMarkdown = ev.target?.result as string;
      if (!rawMarkdown) return;

      try {
        const parsed = await api.skills.parseMarkdown(rawMarkdown);
        const res = await api.skills.create({
          name: parsed.name,
          description: parsed.description,
          category: parsed.category,
          promptTemplate: parsed.promptTemplate,
          skillMd: rawMarkdown,
          variables: parsed.variables,
          tags: parsed.tags,
          icon: parsed.icon,
        });

        if (res.skill) {
          handleSkillSaved(res.skill);
          openSkillDetail(res.skill);
        }
      } catch (err) {
        console.error('Failed to import skill:', err);
        alert('Could not parse the uploaded markdown file. Please verify its YAML frontmatter.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const filteredSkills = skills.filter(s => {
    if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchDesc = s.description.toLowerCase().includes(q);
      const matchTags = (s.tags || []).some(t => t.toLowerCase().includes(q));
      if (!matchName && !matchDesc && !matchTags) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-neutral-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">AI Skills & Creator</h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-neutral-900 text-white font-medium">
              SKILL.md Native
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl leading-relaxed">
            Create, version, and execute modular AI cognitive skills through conversational interviewing and structured SKILL.md specifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Hidden File Input for import */}
          <input
            type="file"
            ref={fileInputRef}
            accept=".md,.txt"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import SKILL.md</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create AI Skill</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-neutral-900 text-white font-semibold'
                  : 'bg-neutral-100 text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search skills, tags..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50 space-y-3">
          <Sparkles className="w-8 h-8 text-neutral-300 mx-auto" />
          <p className="text-sm font-semibold text-neutral-800">No skills found</p>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery ? 'Try clearing your search query.' : 'Click "Create AI Skill" to design your first custom cognitive skill with the AI Architect.'}
          </p>
          {!searchQuery && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors"
            >
              Create First Skill
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map(skill => {
            const IconComponent = EMBLEM_ICONS[skill.icon] || Sparkles;
            const skillId = skill.id || (skill as any)._id;

            return (
              <div
                key={skillId}
                onClick={() => openSkillDetail(skill)}
                className="p-5 border border-neutral-200/90 hover:border-neutral-300 rounded-2xl bg-white shadow-xs hover:shadow-sm flex flex-col justify-between transition-all cursor-pointer group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between text-xs text-neutral-400 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium text-neutral-700">{skill.category}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-600">
                        v{skill.version || 1}.0.0
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {skill.isSystem ? (
                        <span className="text-[10px] font-mono text-neutral-400">System Built-In</span>
                      ) : (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(skill);
                            }}
                            className="p-1 text-neutral-400 hover:text-neutral-800 rounded transition-colors"
                            title="Edit specification"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSkill(skill, e)}
                            className="p-1 text-neutral-400 hover:text-red-600 rounded transition-colors"
                            title="Delete skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-bold text-neutral-900 text-sm mb-1.5 group-hover:text-black">
                    {skill.name}
                  </h3>
                  <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed mb-4">
                    {skill.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {skill.tags && skill.tags.length > 0 ? (
                      skill.tags.slice(0, 2).map((t, tidx) => (
                        <span key={tidx} className="text-[10px] font-mono text-neutral-500 bg-neutral-50 px-1.5 py-0.5 rounded border border-neutral-100">
                          #{t}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-400">#cognitive</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleExportSkill(skill, e)}
                      className="p-1.5 text-neutral-400 hover:text-neutral-800 rounded-md transition-colors"
                      title="Export SKILL.md"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openSkillDetail(skill);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Test</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Skill Creator Modal */}
      {creatorOpen && (
        <SkillCreatorModal
          isOpen={creatorOpen}
          onClose={() => setCreatorOpen(false)}
          onSaved={handleSkillSaved}
          editingSkill={creatorEditingSkill}
        />
      )}

      {/* Skill Detail Modal */}
      {detailModalOpen && selectedSkillId && (
        <SkillDetailModal
          skillId={selectedSkillId}
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          onSkillUpdated={handleSkillSaved}
          onSkillDeleted={(deletedId) => setSkills(prev => prev.filter(s => (s.id || (s as any)._id) !== deletedId))}
          onOpenInChat={onNavigateToChat}
        />
      )}
    </div>
  );
};
