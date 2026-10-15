import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../services/api.js';
import { Skill } from '../../types/index.js';
import {
  Sparkles,
  MessageSquare,
  Code,
  Sliders,
  Play,
  Copy,
  Check,
  X,
  Download,
  Upload,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Feather,
  BookOpen,
  Compass,
  Moon,
  Sun,
  Coffee,
  Heart,
  Flame,
  Terminal,
  FileText,
  Send,
  Eye,
  CheckCheck,
  ChevronRight,
  Lightbulb,
  CornerDownLeft
} from 'lucide-react';

interface SkillCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (skill: Skill) => void;
  initialMode?: 'conversation' | 'form' | 'markdown' | 'import';
  editingSkill?: Skill | null;
}

const CATEGORIES = ['Writing', 'Refinement', 'Planning', 'Summarization', 'Creative', 'Analysis'];

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

const STEP_QUESTIONS = [
  {
    id: 'purpose',
    title: '1. Purpose',
    subtitle: 'What should this skill accomplish?',
    promptPrompt: 'The purpose of this skill is to ',
    aiQuestion: 'What is the primary purpose and core mission of this skill? What kind of transformation should it bring to the user’s text or thoughts?'
  },
  {
    id: 'use_cases',
    title: '2. Use Cases',
    subtitle: 'When should it be invoked?',
    promptPrompt: 'Key use cases include: ',
    aiQuestion: 'In what situations or moments in LifeNote AI should this skill be triggered (e.g. daily evening reflection, chapter editing, messy brain dumps)?'
  },
  {
    id: 'inputs',
    title: '3. Inputs & Placeholders',
    subtitle: 'What inputs does it require?',
    promptPrompt: 'Inputs required are: {text} and ',
    aiQuestion: 'What inputs or placeholders does this skill need? (Default is `{text}`, but you can include `{tone}`, `{target_audience}`, or `{context}`).'
  },
  {
    id: 'outputs',
    title: '4. Expected Outputs',
    subtitle: 'Tone, format, and structure',
    promptPrompt: 'The expected output should be structured as: ',
    aiQuestion: 'How should the output look? (e.g. 3 bullet points, lyrical prose, markdown table, JSON, or minimal clean text without commentary)?'
  },
  {
    id: 'workflow',
    title: '5. Instructions & Workflow',
    subtitle: 'Step-by-step reasoning',
    promptPrompt: 'The step-by-step thinking workflow is: ',
    aiQuestion: 'What step-by-step thinking process should the model follow before producing the answer?'
  },
  {
    id: 'rules',
    title: '6. Rules & Constraints',
    subtitle: 'Boundaries, language & style',
    promptPrompt: 'Important rules and constraints: ',
    aiQuestion: 'What rules, style boundaries, or language constraints (e.g. natural Bengali support, preserve personal truth, no conversational filler) must be enforced?'
  },
  {
    id: 'examples_edge_cases',
    title: '7. Examples & Edge Cases',
    subtitle: 'Few-shot samples & fallback',
    promptPrompt: 'Here is an example before-and-after and how to handle edge cases: ',
    aiQuestion: 'Can you provide a realistic sample input and desired output, and explain how the skill should handle empty or ambiguous text?'
  }
];

const SUGGESTED_PROMPTS = [
  'Create a Socratic Inquirer skill that asks 3 profound questions about any diary reflection.',
  'Create a Prose Polisher skill that corrects grammar, removes clichés, and refines cadence.',
  'Create an Action Item Harvester that extracts tasks with deadlines and priorities from thoughts.',
  'Create a Bengali Memoir Sculptor that transforms brief memories into rich, lyrical Bengali prose.',
  'Create a Contradiction & Hypocrisy Mirror that gently highlights cognitive blindspots and ideals.',
  'Create an Executive Distiller that summarizes long passages into 3 bullet points and 1 takeaway.',
];

export const SkillCreatorModal: React.FC<SkillCreatorModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  initialMode = 'conversation',
  editingSkill = null,
}) => {
  if (!isOpen) return null;

  // Active Creator Mode
  const [mode, setMode] = useState<'conversation' | 'form' | 'markdown'>(
    initialMode === 'import' ? 'markdown' : initialMode
  );

  // Skill draft state
  const [name, setName] = useState(editingSkill?.name || '');
  const [description, setDescription] = useState(editingSkill?.description || '');
  const [category, setCategory] = useState(editingSkill?.category || 'Writing');
  const [promptTemplate, setPromptTemplate] = useState(editingSkill?.promptTemplate || '');
  const [skillMd, setSkillMd] = useState(editingSkill?.skillMd || '');
  const [variables, setVariables] = useState<string[]>(editingSkill?.variables || ['text']);
  const [tags, setTags] = useState<string[]>(editingSkill?.tags || ['custom']);
  const [icon, setIcon] = useState(editingSkill?.icon || 'Sparkles');
  const [changeNote, setChangeNote] = useState(editingSkill ? 'Refined instructions' : 'Initial creation');

  // Conversational AI Interview state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'assistant' | 'user'; content: string }>>([
    {
      role: 'assistant',
      content: editingSkill
        ? `I am ready to help you evolve and refine "${editingSkill.name}". What rules, workflow, inputs, or edge cases would you like to update in its SKILL.md?`
        : 'Welcome to the LifeNote AI Skill Architect. Let\'s build a custom reusable AI Skill together step-by-step. What is the primary purpose and mission of your skill?',
    },
  ]);
  const [userInput, setUserInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Right column tab: 'preview' (formatted rendered documentation), 'markdown' (editable code), 'test' (workbench)
  const [rightTab, setRightTab] = useState<'preview' | 'markdown' | 'test'>('preview');

  // Live Test Workbench state
  const [testInput, setTestInput] = useState(
    'I spent the morning hesitating on starting my project, distracting myself with small tasks. I realized I was afraid of failing.'
  );
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testDurationMs, setTestDurationMs] = useState<number | null>(null);
  const [testModel, setTestModel] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [refinementFeedback, setRefinementFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  // General UI states
  const [saving, setSaving] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  // Scroll conversation
  useEffect(() => {
    chatScrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // When skillMd changes, extract sample example for test input if testInput is default
  const handleExtractExampleToTestInput = () => {
    if (!skillMd) return;
    const exampleMatch = skillMd.match(/### Example[^\n]*\s+\*\*Input:\*\*\s+```[a-z]*\s*([\s\S]*?)```/i);
    if (exampleMatch && exampleMatch[1].trim()) {
      setTestInput(exampleMatch[1].trim());
      setRightTab('test');
    }
  };

  // Handle Conversational Step Submission
  const handleSendConversationMessage = async (textToSend?: string) => {
    const text = (textToSend || userInput).trim();
    if (!text || generating) return;

    const newHistory = [...chatMessages, { role: 'user' as const, content: text }];
    setChatMessages(newHistory);
    setUserInput('');
    setGenerating(true);

    try {
      const res = await api.skills.generateSpec({
        prompt: text,
        conversationHistory: newHistory,
        currentDraft: {
          name,
          description,
          category,
          promptTemplate,
          skillMd,
          variables,
          tags,
          icon,
        },
      });

      // Update local state with AI generated specification
      setName(res.name);
      setDescription(res.description);
      setCategory(res.category);
      setPromptTemplate(res.promptTemplate);
      setSkillMd(res.skillMd);
      setVariables(res.variables);
      setTags(res.tags);
      setIcon(res.icon);

      // Advance step index automatically
      setCurrentStepIndex(prev => Math.min(prev + 1, STEP_QUESTIONS.length - 1));

      // Append assistant reply to conversation
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: res.assistantReply || `I have synthesized the specification for "${res.name}" and generated its structured SKILL.md. You can review the live preview on the right or test it with sample inputs.`,
        },
      ]);
    } catch (err: any) {
      console.error('Failed to generate skill specification:', err);
      setChatMessages([
        ...newHistory,
        {
          role: 'assistant',
          content: 'I encountered an issue generating the specification. You can still edit the details manually in the Visual Form or Raw Markdown editor.',
        },
      ]);
    } finally {
      setGenerating(false);
    }
  };

  // Step Click
  const handleStepClick = (idx: number) => {
    setCurrentStepIndex(idx);
    const step = STEP_QUESTIONS[idx];
    setChatMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: `**${step.title}**: ${step.aiQuestion}`,
      },
    ]);
  };

  // Run Live Test
  const handleRunLiveTest = async () => {
    if (!testInput.trim() || testing) return;
    setTesting(true);
    setTestOutput(null);

    try {
      const res = await api.skills.testDraft({
        promptTemplate: promptTemplate || 'Process the text:\n"{text}"',
        skillMd: skillMd || undefined,
        input: testInput.trim(),
      });
      setTestOutput(res.output);
      setTestDurationMs(res.durationMs);
      setTestModel(res.model);
    } catch (err: any) {
      console.error('Test execution failed:', err);
      setTestOutput(`Error running test: ${err.message || 'Execution failed'}`);
    } finally {
      setTesting(false);
    }
  };

  // Refine Spec based on Test Output or User Feedback
  const handleRefineFromTest = async () => {
    if (!refinementFeedback.trim() || !skillMd || refining) return;
    setRefining(true);

    try {
      const res = await api.skills.refineSpec({
        skillMd,
        feedback: refinementFeedback.trim(),
        testOutput: testOutput || undefined,
      });

      setSkillMd(res.skillMd);
      if (res.promptTemplate) setPromptTemplate(res.promptTemplate);
      if (res.description) setDescription(res.description);
      setRefinementFeedback('');

      // Add feedback to conversation
      setChatMessages(prev => [
        ...prev,
        { role: 'user', content: `Refine skill instructions: ${refinementFeedback.trim()}` },
        { role: 'assistant', content: res.explanation || 'I have updated the SKILL.md rules, workflow, and instructions based on your feedback.' },
      ]);
    } catch (err) {
      console.error('Refinement failed:', err);
    } finally {
      setRefining(false);
    }
  };

  // Import external SKILL.md
  const handleImportMarkdown = async (rawMarkdown: string) => {
    try {
      const parsed = await api.skills.parseMarkdown(rawMarkdown);
      setName(parsed.name);
      setDescription(parsed.description);
      setCategory(parsed.category);
      setIcon(parsed.icon);
      setTags(parsed.tags);
      setVariables(parsed.variables);
      setPromptTemplate(parsed.promptTemplate);
      setSkillMd(rawMarkdown);
      setRightTab('preview');
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Imported SKILL.md for "${parsed.name}". You can now test it in the test bench or customize its rules.`,
        },
      ]);
    } catch (err) {
      console.error('Failed to parse markdown:', err);
      alert('Could not parse the provided markdown. Ensure it has valid YAML frontmatter.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = ev.target?.result as string;
      if (content) handleImportMarkdown(content);
    };
    reader.readAsText(file);
  };

  // Export / Download SKILL.md
  const handleDownloadSkillMd = () => {
    const blob = new Blob([skillMd || `# ${name}\n\n${description}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(name || 'skill').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.SKILL.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy SKILL.md to clipboard
  const handleCopySkillMd = () => {
    navigator.clipboard.writeText(skillMd);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  // Save Skill to Database
  const handleSaveSkill = async () => {
    if (!name.trim()) {
      alert('Please provide a name for this skill.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim() || 'Custom LifeNote AI skill',
        category,
        promptTemplate: promptTemplate.trim() || 'Analyze and transform:\n"{text}"',
        skillMd: skillMd.trim(),
        variables,
        tags,
        icon,
        changeNote: editingSkill ? changeNote : 'Initial creation',
      };

      let savedSkill: Skill;
      if (editingSkill) {
        const id = editingSkill.id || (editingSkill as any)._id;
        const res = await api.skills.update(id, payload);
        savedSkill = res.skill;
      } else {
        const res = await api.skills.create(payload);
        savedSkill = res.skill;
      }

      onSaved(savedSkill);
      onClose();
    } catch (err: any) {
      console.error('Failed to save skill:', err);
      alert(`Save failed: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const SelectedIcon = EMBLEM_ICONS[icon] || Sparkles;

  // Render formatted markdown helper
  const renderFormattedMarkdown = (markdown: string) => {
    if (!markdown) {
      return (
        <div className="py-16 text-center text-xs text-neutral-400 space-y-2">
          <Sparkles className="w-6 h-6 mx-auto text-neutral-300 animate-pulse" />
          <p>No SKILL.md generated yet.</p>
          <p className="text-[11px] text-neutral-400 font-mono">
            Chat with the AI Skill Architect on the left to generate your complete specification.
          </p>
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
          <div className="p-3 bg-neutral-100/70 border border-neutral-200 rounded-xl font-mono text-[11px] text-neutral-700">
            <span className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">YAML Frontmatter Specification</span>
            <pre className="whitespace-pre-wrap">{frontmatter}</pre>
          </div>
        )}

        <div className="space-y-3">
          {lines.map((line, idx) => {
            if (line.startsWith('# ')) {
              return (
                <h2 key={idx} className="text-base font-bold text-neutral-900 border-b border-neutral-200 pb-1 pt-1">
                  {line.replace('# ', '')}
                </h2>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <h3 key={idx} className="text-xs font-bold uppercase tracking-wider text-neutral-900 pt-3 border-t border-neutral-100 flex items-center gap-1.5 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 inline-block" />
                  <span>{line.replace('## ', '')}</span>
                </h3>
              );
            }
            if (line.startsWith('### ')) {
              return (
                <h4 key={idx} className="text-[11px] font-semibold text-neutral-800 pt-1.5 font-mono">
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
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-6xl w-full my-auto flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <header className="px-6 py-3.5 border-b border-neutral-200/90 flex items-center justify-between gap-4 bg-neutral-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
              <SelectedIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 truncate">
                  {editingSkill ? `Edit Skill: ${name || editingSkill.name}` : name || 'Create New AI Skill'}
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/70 text-neutral-700">
                  SKILL.md
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                  v{editingSkill ? (editingSkill.version || 1) + 1 : '1.0.0'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-500 truncate font-mono">
                {description || 'Conversational step-by-step cognitive skill architect'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 shadow-2xs text-xs">
            <button
              onClick={() => setMode('conversation')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'conversation'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>AI Architect Interview</span>
            </button>

            <button
              onClick={() => setMode('form')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'form'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Visual Spec Form</span>
            </button>

            <button
              onClick={() => setMode('markdown')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                mode === 'markdown'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Raw SKILL.md</span>
            </button>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Modal Main Content Workspace: 2-column layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200 overflow-hidden">
          {/* Main Left Workspace: 6 cols (Conversational Architect / Guided Steps) */}
          <div className="lg:col-span-6 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* Step-by-Step Flow Tracker */}
            <div className="space-y-1.5 pb-2 border-b border-neutral-100">
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500">
                <span className="uppercase font-semibold tracking-wider">Step-by-Step Skill Discovery</span>
                <span>{currentStepIndex + 1} of {STEP_QUESTIONS.length}</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {STEP_QUESTIONS.map((step, idx) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepClick(idx)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-lg shrink-0 transition-colors cursor-pointer ${
                      currentStepIndex === idx
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {step.title}
                  </button>
                ))}
              </div>
            </div>

            {/* ========================================================
                MODE 1: CONVERSATIONAL AI INTERVIEW (Claude-Style)
                ======================================================== */}
            {mode === 'conversation' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-3">
                {/* Chat message history container */}
                <div className="flex-1 min-h-[280px] max-h-[380px] overflow-y-auto space-y-3 p-3.5 bg-neutral-50/70 border border-neutral-200/80 rounded-xl">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                          AI
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] text-xs leading-relaxed rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-neutral-900 text-white rounded-br-xs font-medium'
                            : 'bg-white text-neutral-800 border border-neutral-200/90 rounded-bl-xs shadow-2xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {generating && (
                    <div className="flex gap-2.5 items-center text-xs text-neutral-500 font-mono py-1">
                      <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center animate-spin">
                        <RefreshCw className="w-3 h-3 text-neutral-700" />
                      </div>
                      <span>Synthesizing structured SKILL.md specification...</span>
                    </div>
                  )}
                  <div ref={chatScrollRef} />
                </div>

                {/* Suggested prompt chips */}
                {chatMessages.length <= 2 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                      Quick Starter Blueprints
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTED_PROMPTS.map((sp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendConversationMessage(sp)}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 text-left transition-colors cursor-pointer truncate max-w-full"
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interview chat input composer */}
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleSendConversationMessage();
                  }}
                  className="space-y-2 pt-1"
                >
                  <div className="relative">
                    <textarea
                      rows={2}
                      value={userInput}
                      onChange={e => setUserInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendConversationMessage();
                        }
                      }}
                      placeholder={`Answer question or give instructions for ${STEP_QUESTIONS[currentStepIndex].title}...`}
                      className="w-full pl-3.5 pr-20 py-2.5 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900 placeholder:text-neutral-400 resize-none leading-relaxed"
                    />
                    <button
                      type="submit"
                      disabled={generating || !userInput.trim()}
                      className="absolute right-2 bottom-3 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-lg transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <span>Send</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ========================================================
                MODE 2: VISUAL SPEC FORM (Guided Fields)
                ======================================================== */}
            {mode === 'form' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-800">Skill Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Socratic Inquirer"
                      className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-800">Category</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-neutral-800">Short Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Precise summary of what this skill accomplishes..."
                    className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-neutral-800">Executable Prompt Template</label>
                    <span className="text-[10px] font-mono text-neutral-400">Use {'{text}'} or {'{input}'}</span>
                  </div>
                  <textarea
                    rows={6}
                    value={promptTemplate}
                    onChange={e => setPromptTemplate(e.target.value)}
                    placeholder="Instructions for the model to execute..."
                    className="w-full px-3 py-2 text-xs font-mono border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-800">Inputs / Variables</label>
                    <input
                      type="text"
                      value={variables.join(', ')}
                      onChange={e => setVariables(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="text, tone, audience"
                      className="w-full px-3 py-2 text-xs font-mono border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-neutral-800">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={tags.join(', ')}
                      onChange={e => setTags(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                      placeholder="reflection, clarity, writing"
                      className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                    />
                  </div>
                </div>

                {/* Crest Icon Selector */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-neutral-800">Skill Emblem Icon</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {Object.keys(EMBLEM_ICONS).map(iconKey => {
                      const IconC = EMBLEM_ICONS[iconKey];
                      const isSel = icon === iconKey;
                      return (
                        <button
                          key={iconKey}
                          type="button"
                          onClick={() => setIcon(iconKey)}
                          className={`p-2 rounded-lg border transition-all cursor-pointer ${
                            isSel ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                          }`}
                        >
                          <IconC className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================
                MODE 3: RAW SKILL.MD EDITOR & IMPORT/EXPORT
                ======================================================== */}
            {mode === 'markdown' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-600 font-mono">
                      Canonical SKILL.md Document
                    </span>
                    <p className="text-[11px] text-neutral-400">
                      Standardized format with YAML frontmatter, workflow, rules, and examples
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <label className="px-2.5 py-1 text-xs border border-neutral-200 hover:bg-neutral-100 rounded-md cursor-pointer flex items-center gap-1 text-neutral-700">
                      <Upload className="w-3 h-3" />
                      <span>Import .md</span>
                      <input type="file" accept=".md,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>

                    <button
                      type="button"
                      onClick={handleCopySkillMd}
                      className="px-2.5 py-1 text-xs border border-neutral-200 hover:bg-neutral-100 rounded-md cursor-pointer flex items-center gap-1 text-neutral-700"
                    >
                      {copiedMd ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedMd ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSkillMd}
                      className="px-2.5 py-1 text-xs border border-neutral-200 hover:bg-neutral-100 rounded-md cursor-pointer flex items-center gap-1 text-neutral-700"
                    >
                      <Download className="w-3 h-3" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                <textarea
                  rows={14}
                  value={skillMd}
                  onChange={e => setSkillMd(e.target.value)}
                  placeholder="Paste or write your full SKILL.md specification..."
                  className="w-full p-4 text-xs font-mono border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-neutral-50/50 leading-relaxed resize-none"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleImportMarkdown(skillMd)}
                    className="px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Sync Variables from Markdown
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================
              Right Column: 6 cols (Live Preview / Editor / Test Bench)
              ======================================================== */}
          <div className="lg:col-span-6 flex flex-col min-h-0 bg-neutral-50/50 p-4 sm:p-5 space-y-4 overflow-y-auto">
            {/* Top Bar Switcher between Preview, Markdown, and Live Test */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 text-xs">
                <button
                  type="button"
                  onClick={() => setRightTab('preview')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    rightTab === 'preview'
                      ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview Doc</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightTab('markdown')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    rightTab === 'markdown'
                      ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  <span>Raw SKILL.md</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRightTab('test')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    rightTab === 'test'
                      ? 'bg-neutral-900 text-white shadow-2xs font-semibold'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Terminal className="w-3 h-3" />
                  <span>Live Test Bench</span>
                </button>
              </div>

              {/* Quick actions for right column */}
              <div className="flex items-center gap-1">
                {skillMd && (
                  <button
                    type="button"
                    onClick={handleExtractExampleToTestInput}
                    className="px-2 py-1 text-[11px] font-mono text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
                    title="Load example input into test bench"
                  >
                    Load Example
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleDownloadSkillMd}
                  className="p-1.5 text-neutral-500 hover:text-neutral-900 rounded cursor-pointer"
                  title="Download .md"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* TAB: PREVIEW DOC */}
            {rightTab === 'preview' && (
              <div className="p-4 bg-white border border-neutral-200/90 rounded-2xl shadow-xs overflow-y-auto min-h-[350px]">
                {renderFormattedMarkdown(skillMd)}
              </div>
            )}

            {/* TAB: RAW MARKDOWN EDITOR */}
            {rightTab === 'markdown' && (
              <div className="space-y-2">
                <textarea
                  rows={16}
                  value={skillMd}
                  onChange={e => setSkillMd(e.target.value)}
                  className="w-full p-4 text-xs font-mono bg-neutral-900 text-neutral-100 rounded-xl leading-relaxed resize-none focus:outline-none"
                />
                <div className="flex justify-between items-center text-[11px] text-neutral-400 font-mono">
                  <span>Lines: {skillMd.split('\n').length}</span>
                  <button
                    type="button"
                    onClick={() => handleCopySkillMd()}
                    className="hover:text-neutral-700 underline cursor-pointer"
                  >
                    {copiedMd ? 'Copied to clipboard' : 'Copy markdown'}
                  </button>
                </div>
              </div>
            )}

            {/* TAB: LIVE TEST BENCH */}
            {rightTab === 'test' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-700">Sample Test Input</label>
                    <button
                      type="button"
                      onClick={handleExtractExampleToTestInput}
                      className="text-[11px] font-mono text-neutral-500 hover:text-neutral-900 underline"
                    >
                      Extract Example from SKILL.md
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    placeholder="Enter sample text to test this skill..."
                    className="w-full p-3 text-xs bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-neutral-900 leading-relaxed resize-none"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-neutral-400 font-mono">
                    Provider: Gemini 3.8 Flash
                  </span>

                  <button
                    type="button"
                    onClick={handleRunLiveTest}
                    disabled={testing || !testInput.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    {testing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Run Test</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Output Panel */}
                {testOutput ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3.5 bg-white border border-neutral-200 rounded-xl shadow-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 border-b border-neutral-100 pb-1.5">
                        <span className="font-semibold text-neutral-800">Result</span>
                        <div className="flex items-center gap-2">
                          {testDurationMs !== null && <span>{testDurationMs}ms</span>}
                          {testModel && <span>· {testModel}</span>}
                        </div>
                      </div>

                      <div className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {testOutput}
                      </div>
                    </div>

                    {/* Instant Refine with AI */}
                    <div className="p-3 bg-white border border-neutral-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                        <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                        <span>Refine Instructions based on Output</span>
                      </div>
                      <input
                        type="text"
                        value={refinementFeedback}
                        onChange={e => setRefinementFeedback(e.target.value)}
                        placeholder="e.g. Make it more poetic, output as bullet points..."
                        className="w-full px-3 py-1.5 text-xs border border-neutral-200 rounded-lg focus:outline-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleRefineFromTest}
                          disabled={refining || !refinementFeedback.trim()}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                        >
                          {refining ? 'Refining Spec...' : 'Update SKILL.md with Feedback'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-neutral-400 font-mono bg-white border border-neutral-200/80 rounded-xl">
                    Run test to see live AI output here.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Action Footer */}
        <footer className="px-6 py-3.5 bg-neutral-50/80 border-t border-neutral-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Ready to save version {editingSkill ? (editingSkill.version || 1) + 1 : '1.0.0'}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveSkill}
              disabled={saving || !name.trim()}
              className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-black rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Skill to Library</span>
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
