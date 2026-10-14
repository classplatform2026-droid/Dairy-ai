import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Plan, TaskItem } from '../../types/index.js';
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Calendar,
  CheckCircle2,
  Circle,
  X,
  AlertCircle
} from 'lucide-react';

interface PlansViewProps {
  initialCreateNew?: boolean;
}

const PLAN_TABS = ['Active', 'Completed', 'All'] as const;

export const PlansView: React.FC<PlansViewProps> = ({ initialCreateNew }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activeTab, setActiveTab] = useState<'Active' | 'Completed' | 'All'>('Active');
  const [loading, setLoading] = useState(true);

  // Expanded plan drawer / detail
  const [detailPlan, setDetailPlan] = useState<Plan | null>(null);

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [deadline, setDeadline] = useState('');
  const [tasks, setTasks] = useState<{ id: string; title: string; completed: boolean; order: number }[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');

  // AI Breakdown generator modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.plans.list();
      setPlans(res.plans || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    if (initialCreateNew) {
      openCreateModal();
    }
  }, [initialCreateNew]);

  const openCreateModal = () => {
    setEditingPlan(null);
    setTitle('');
    setDescription('');
    setCategory('Personal');
    setPriority('medium');
    setDeadline('');
    setTasks([
      { id: 't1', title: 'Plan architecture & specifications', completed: true, order: 1 },
      { id: 't2', title: 'Implement frontend & backend workflows', completed: true, order: 2 },
      { id: 't3', title: 'Final testing & validation', completed: false, order: 3 },
    ]);
    setModalOpen(true);
  };

  const openEditModal = (p: Plan, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPlan(p);
    setTitle(p.title);
    setDescription(p.description || '');
    setCategory(p.category || 'Personal');
    setPriority(p.priority || 'medium');
    setDeadline(p.deadline || '');
    setTasks(p.tasks || []);
    setModalOpen(true);
  };

  const handleToggleTask = async (plan: Plan, taskId: string) => {
    const updatedTasks = plan.tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    const planId = plan.id || (plan as any)._id;

    try {
      const res = await api.plans.update(planId, { tasks: updatedTasks });
      setPlans(prev => prev.map(p => ((p.id || (p as any)._id) === planId ? res.plan : p)));
      if (detailPlan && (detailPlan.id || (detailPlan as any)._id) === planId) {
        setDetailPlan(res.plan);
      }
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (editingPlan) {
        const id = editingPlan.id || (editingPlan as any)._id;
        const res = await api.plans.update(id, {
          title,
          description,
          category,
          priority,
          deadline,
          tasks,
        });
        setPlans(prev => prev.map(p => ((p.id || (p as any)._id) === id ? res.plan : p)));
      } else {
        const res = await api.plans.create({
          title,
          description,
          category,
          priority,
          deadline,
          tasks,
        });
        setPlans(prev => [res.plan, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Failed to save plan:', err);
    }
  };

  const handleDeletePlan = async (p: Plan, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const id = p.id || (p as any)._id;
    const confirm = window.confirm(`Delete plan "${p.title}"?`);
    if (!confirm) return;

    try {
      await api.plans.delete(id);
      setPlans(prev => prev.filter(item => (item.id || (item as any)._id) !== id));
      if (detailPlan && (detailPlan.id || (detailPlan as any)._id) === id) {
        setDetailPlan(null);
      }
    } catch (err) {
      console.error('Failed to delete plan:', err);
    }
  };

  // AI Breakdown
  const handleAIBreakdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiGoal.trim()) return;
    setAiGenerating(true);
    try {
      const res = await api.plans.aiBreakdown(aiGoal);
      const b = res.breakdown;
      setTitle(b.title || aiGoal);
      setDescription(b.description || '');
      setTasks(
        (b.tasks || []).map((t: any, i: number) => ({
          id: 'task_' + Math.random().toString(36).substr(2, 9),
          title: t.title,
          completed: false,
          order: i + 1,
        }))
      );
      setAiModalOpen(false);
      setModalOpen(true);
      setAiGoal('');
    } catch (err) {
      console.error('AI plan breakdown failed:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  const filteredPlans = plans.filter(p => {
    if (activeTab === 'Active') return p.status !== 'completed';
    if (activeTab === 'Completed') return p.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header with + New Plan (Screen 8 Reference) */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
          Plans
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiModalOpen(true)}
            className="px-3 py-2 text-xs font-medium text-neutral-800 bg-white border border-neutral-200 hover:bg-neutral-50 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Architect</span>
          </button>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 text-xs font-semibold text-white bg-black hover:bg-neutral-800 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs: Active, Completed, All (Screen 8 Reference) */}
      <div className="flex items-center gap-1.5">
        {PLAN_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeTab === tab
                ? 'bg-black text-white'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Plan Card Rows (Screen 8 Reference) */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-neutral-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-neutral-200 rounded-2xl bg-white space-y-2">
          <CheckSquare className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-neutral-900">No {activeTab.toLowerCase()} plans</p>
          <p className="text-xs text-neutral-500">Create a plan to organize your roadmap and milestones.</p>
          <button
            onClick={openCreateModal}
            className="mt-3 px-3.5 py-1.5 text-xs font-semibold text-white bg-black rounded-lg"
          >
            Create Plan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPlans.map(plan => {
            const completedCount = (plan.tasks || []).filter(t => t.completed).length;
            const totalTasks = plan.tasks?.length || 0;

            return (
              <div
                key={plan.id || (plan as any)._id}
                onClick={() => setDetailPlan(plan)}
                className="p-5 border border-neutral-200 hover:border-neutral-300 rounded-xl bg-white shadow-xs transition-all cursor-pointer group space-y-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-800 flex items-center justify-center shrink-0">
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-xs text-neutral-900 group-hover:text-black">
                        {plan.title}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 mt-0.5">
                        <span>{completedCount}/{totalTasks} tasks</span>
                        {plan.deadline && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Due {plan.deadline}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Percentage (Screen 8 Reference) */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-neutral-800 tabular-nums">
                      {plan.progress}%
                    </span>
                    <button
                      onClick={(e) => openEditModal(plan, e)}
                      className="p-1 text-neutral-400 hover:text-neutral-900"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeletePlan(plan, e)}
                      className="p-1 text-neutral-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Minimal Progress Bar (Screen 8 Reference) */}
                <div className="w-full bg-neutral-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-black h-full rounded-full transition-all duration-300"
                    style={{ width: `${plan.progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Task Checklist Drawer */}
      {detailPlan && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div>
                <h2 className="text-base font-bold text-neutral-900">{detailPlan.title}</h2>
                <span className="text-xs font-mono text-neutral-400">
                  {detailPlan.progress}% completed
                </span>
              </div>
              <button onClick={() => setDetailPlan(null)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              {detailPlan.description || 'Tap any task to mark completed:'}
            </p>

            <div className="space-y-2 pt-1">
              {(detailPlan.tasks || []).map(task => (
                <button
                  key={task.id}
                  onClick={() => handleToggleTask(detailPlan, task.id)}
                  className="w-full text-left p-2.5 rounded-lg border border-neutral-100 hover:bg-neutral-50 flex items-start gap-2.5 text-xs transition-colors cursor-pointer group"
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 shrink-0 mt-0.5" />
                  )}
                  <span className={task.completed ? 'line-through text-neutral-400' : 'text-neutral-800'}>
                    {task.title}
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setDetailPlan(null)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-black rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Plan Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <h2 className="text-base font-bold text-neutral-900">
                {editingPlan ? 'Edit Plan' : 'Create New Plan'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Plan Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build LifeNote AI"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Deadline (Optional)</label>
                <input
                  type="text"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="e.g. Apr 30, 2025"
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Checklist Tasks</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto mb-2">
                  {tasks.map((t, i) => (
                    <div key={t.id} className="flex items-center justify-between text-xs py-1 px-2.5 bg-neutral-50 rounded-md">
                      <span className="truncate">{i + 1}. {t.title}</span>
                      <button
                        type="button"
                        onClick={() => setTasks(tasks.filter(item => item.id !== t.id))}
                        className="text-neutral-400 hover:text-red-500 ml-2"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Add step or task..."
                    className="flex-1 px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTaskInput.trim()) return;
                      setTasks([...tasks, { id: 't_' + Date.now(), title: newTaskInput.trim(), completed: false, order: tasks.length + 1 }]);
                      setNewTaskInput('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-neutral-100 hover:bg-neutral-200 rounded-lg"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-black rounded-lg shadow-xs"
                >
                  Save Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Breakdown Modal */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-neutral-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-neutral-900" />
                <h2 className="text-base font-bold text-neutral-900">AI Plan Architect</h2>
              </div>
              <button onClick={() => setAiModalOpen(false)} className="text-neutral-400 hover:text-neutral-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Enter any objective. LifeNote AI will break it into a phased task plan.
            </p>

            <form onSubmit={handleAIBreakdown} className="space-y-4">
              <textarea
                rows={3}
                required
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                placeholder="e.g. Learn Web Development in 60 days"
                className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none resize-none"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={aiGenerating || !aiGoal.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-black rounded-lg disabled:opacity-50"
                >
                  {aiGenerating ? 'Architecting...' : 'Generate Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
