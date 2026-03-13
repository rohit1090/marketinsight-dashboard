import React, { useState, useCallback, useEffect, useRef } from 'react';
import { generateSeoBlogArticle, runEditorAction, runQuickAction, EditorActionType, QuickActionType, SeoArticleResult } from '../services/geminiService';

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const Tooltip = ({ label, children }: { label: string; children: React.ReactNode; key?: React.Key }) => (
  <div className="relative group/tip">
    {children}
    <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-0.5 text-[11px] font-medium text-white bg-gray-900 rounded-md shadow-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
      {label}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900" />
    </div>
  </div>
);

// ─── Types ────────────────────────────────────────────────────────────────────

type ArticleStatus = 'generating' | 'ready' | 'editing' | 'completed' | 'error';

interface Article {
  id: string;
  topic: string;
  category: string | null;
  brandName: string;
  createdAt: number;
  wordCount: number;
  seoScore: number;
  status: ArticleStatus;
  result: SeoArticleResult | null;
  editedContent?: string;
  errorMessage?: string;
}

interface ContentCheck {
  label: string;
  status: 'good' | 'issues';
  issueCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 90000) return 'a minute ago';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightKeywords(html: string, keywords: string[]): string {
  if (!keywords.length) return html;
  // Don't highlight inside HTML tags
  const parts = html.split(/(<[^>]+>)/);
  const sorted = [...keywords].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${sorted.map(escapeRegex).join('|')})`, 'gi');
  return parts.map(part =>
    part.startsWith('<') ? part :
    part.replace(pattern, '<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5 font-medium">$1</mark>')
  ).join('');
}

/** Strip HTML tags and count real words — consistent with contentEditable innerText */
function countArticleWords(html: string): number {
  const div = document.createElement('div');
  div.innerHTML = html;
  return countWords(div.textContent || div.innerText || '');
}

/**
 * Compute a real SEO score (0–100) from actual content metrics.
 * Breakdown: word count 30 | H2 headings 15 | H3 headings 10 | H1 10 |
 *            lists 10 | keyword density 10 | meta title 5 | meta desc 5 | slug 5
 */
function computeSeoScore(
  html: string,
  words: number,
  primaryKeyword: string,
  seoTitle: string,
  metaDescription: string,
  urlSlug: string,
  keywordDensity: number,
): number {
  let score = 0;

  // Word count (30 pts) — target 1000–1400
  if (words >= 1000 && words <= 1400) score += 30;
  else if (words >= 800 && words < 1000) score += 20;
  else if (words >= 600 && words < 800) score += 12;
  else if (words > 1400) score += 22; // over target is still good

  // H2 headings (15 pts)
  const h2 = (html.match(/<h2/gi) || []).length;
  if (h2 >= 5) score += 15;
  else if (h2 >= 3) score += 10;
  else if (h2 >= 1) score += 5;

  // H3 headings (10 pts)
  const h3 = (html.match(/<h3/gi) || []).length;
  if (h3 >= 3) score += 10;
  else if (h3 >= 1) score += 6;

  // H1 present (10 pts)
  if (/<h1/i.test(html)) score += 10;

  // Lists (10 pts)
  const ul = (html.match(/<ul/gi) || []).length;
  if (ul >= 3) score += 10;
  else if (ul >= 2) score += 7;
  else if (ul >= 1) score += 4;

  // Keyword density (10 pts) — ideal 1–2.5%
  if (keywordDensity >= 1 && keywordDensity <= 2.5) score += 10;
  else if (keywordDensity >= 0.5 && keywordDensity <= 3) score += 6;
  else if (keywordDensity > 0) score += 2;

  // Keyword in content (bonus check via primary keyword)
  const kwInHtml = primaryKeyword && html.toLowerCase().includes(primaryKeyword.toLowerCase());
  if (!kwInHtml) score = Math.max(0, score - 5);

  // SEO title length (5 pts)
  if (seoTitle.length >= 30 && seoTitle.length <= 60) score += 5;
  else if (seoTitle.length > 0) score += 2;

  // Meta description length (5 pts)
  if (metaDescription.length >= 120 && metaDescription.length <= 160) score += 5;
  else if (metaDescription.length >= 80) score += 2;

  // URL slug quality (5 pts)
  if (/^[a-z0-9-]+$/.test(urlSlug) && urlSlug.length > 5) score += 5;
  else if (urlSlug.length > 0) score += 2;

  return Math.min(100, Math.max(0, score));
}

function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const result: string[] = [];
  let inUl = false;
  let inOl = false;

  const closeUl = () => { if (inUl) { result.push('</ul>'); inUl = false; } };
  const closeOl = () => { if (inOl) { result.push('</ol>'); inOl = false; } };

  for (const line of lines) {
    if (line.startsWith('# ')) {
      closeUl(); closeOl();
      result.push(`<h1><strong>${line.slice(2)}</strong></h1>`);
    } else if (line.startsWith('## ')) {
      closeUl(); closeOl();
      result.push(`<h2><strong>${line.slice(3)}</strong></h2>`);
    } else if (line.startsWith('### ')) {
      closeUl(); closeOl();
      result.push(`<h3><strong>${line.slice(4)}</strong></h3>`);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      closeOl();
      if (!inUl) { result.push('<ul>'); inUl = true; }
      result.push(`<li>${line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`);
    } else if (/^\d+\.\s/.test(line)) {
      closeUl();
      if (!inOl) { result.push('<ol>'); inOl = true; }
      result.push(`<li>${line.replace(/^\d+\.\s/, '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</li>`);
    } else if (line.trim() === '') {
      closeUl(); closeOl();
      result.push('');
    } else {
      closeUl(); closeOl();
      result.push(`<p>${line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>`);
    }
  }
  closeUl(); closeOl();
  return result.join('\n');
}

function analyzeContent(article: Article): ContentCheck[] {
  if (!article.result) return [];
  const { result, wordCount } = article;
  const text = result.article || '';

  const h2Count =
    (text.match(/^## /gm) || []).length + (text.match(/<h2/gi) || []).length;
  const hasSnippet = text.split('\n').some(l => l.trim().length > 80 && l.trim().length < 400);
  const kwFound = text.toLowerCase().includes(result.primaryKeyword.toLowerCase());
  const slugOk = /^[a-z0-9-]+$/.test(result.urlSlug);
  const titleOk = result.seoTitle.length <= 60;
  const descOk = result.metaDescription.length >= 100 && result.metaDescription.length <= 165;
  const densityOk = result.keywordDensity >= 0.5 && result.keywordDensity <= 3.5;
  const h2Issues = Math.max(0, 3 - h2Count);
  const depthIssues = wordCount < 1000 ? Math.min(5, Math.ceil((1000 - wordCount) / 200)) : 0;

  return [
    { label: 'Prompt Coverage',  status: wordCount >= 900 ? 'good' : 'issues',       issueCount: wordCount < 900 ? 1 : 0 },
    { label: 'Schema Markup',    status: 'good',                                      issueCount: 0 },
    { label: 'Key Terms',        status: kwFound ? 'good' : 'issues',                 issueCount: kwFound ? 0 : 1 },
    { label: 'Meta Tags',        status: titleOk && descOk ? 'good' : 'issues',       issueCount: (titleOk ? 0 : 1) + (descOk ? 0 : 1) },
    { label: 'URL',              status: slugOk ? 'good' : 'issues',                  issueCount: slugOk ? 0 : 1 },
    { label: 'Featured Snippet', status: hasSnippet ? 'good' : 'issues',              issueCount: hasSnippet ? 0 : 1 },
    { label: 'H1 Heading',       status: result.title ? 'good' : 'issues',            issueCount: result.title ? 0 : 1 },
    { label: 'Links',            status: 'issues',                                    issueCount: 2 },
    { label: 'H2-H6 Heading',   status: h2Issues === 0 ? 'good' : 'issues',          issueCount: h2Issues },
    { label: 'Content Depth',    status: depthIssues === 0 ? 'good' : 'issues',       issueCount: depthIssues },
    { label: 'Keyword Density',  status: densityOk ? 'good' : 'issues',              issueCount: densityOk ? 0 : 2 },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CircularProgress: React.FC<{ progress: number }> = ({ progress }) => {
  const r = 14;
  const circ = 2 * Math.PI * r;
  // Show at least 8% arc so the ring is always visibly animating
  const effectiveProgress = Math.max(progress, 8);
  const offset = circ - (effectiveProgress / 100) * circ;
  return (
    <svg
      width="36" height="36"
      style={{
        animation: 'spin 1.2s linear infinite',
        transformOrigin: 'center',
      }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r} fill="none" stroke="#6366f1" strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  );
};

const StatusBadge: React.FC<{ status: ArticleStatus }> = ({ status }) => {
  const map: Record<ArticleStatus, string> = {
    generating: 'bg-blue-50 text-blue-700',
    ready:      'bg-slate-100 text-slate-600',
    editing:    'bg-amber-50 text-amber-700',
    completed:  'bg-emerald-50 text-emerald-700',
    error:      'bg-red-50 text-red-600',
  };
  const labels: Record<ArticleStatus, string> = {
    generating: 'Generating',
    ready:      'Ready for Writing',
    editing:    'Editing in Progress',
    completed:  'Completed',
    error:      'Generation Failed',
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
};

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const textColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-500';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';
  return (
    <div
      className="flex flex-col items-center justify-center w-24 h-24 rounded-full border-4 mx-auto"
      style={{ borderColor: color }}
    >
      <span className={`text-3xl font-black ${textColor}`}>{score}</span>
      <span className={`text-[10px] font-bold uppercase ${textColor}`}>{label}</span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ContentWriterPanel: React.FC = () => {
  // Form state
  const [topic, setTopic] = useState('');
  const [brandName, setBrandName] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  // Article list
  const [articles, setArticles] = useState<Article[]>(() => {
    try {
      const s = sessionStorage.getItem('cw_articles');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  // Progress per generating article
  const [genProgress, setGenProgress] = useState<Record<string, number>>({});

  const isGenerating = articles.some(a => a.status === 'generating');

  // Selected article for editor
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Editor state (live)
  const editorRef = useRef<HTMLDivElement>(null);
  const [editorWords, setEditorWords] = useState(0);
  const [editorScore, setEditorScore] = useState(0);
  const [editorKd, setEditorKd] = useState(0);
  const [editorReadTime, setEditorReadTime] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPreview, setLinkPreview] = useState<{ href: string; x: number; y: number } | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);

  // ── Context AI menu ───────────────────────────────────────────────────────
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showRitzMenu, setShowRitzMenu] = useState(false);
  const [selectionBar, setSelectionBar] = useState<{ x: number; y: number; text: string } | null>(null);
  const selectionRangeRef = useRef<Range | null>(null);
  const [quickActionLoading, setQuickActionLoading] = useState<QuickActionType | null>(null);
  const [contextActionLoading, setContextActionLoading] = useState<EditorActionType | null>(null);
  const [showContextEditModal, setShowContextEditModal] = useState(false);
  const [contextEditInstruction, setContextEditInstruction] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'info' | 'success' } | null>(null);

  // ── Undo / Redo history ──────────────────────────────────────────────────
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist articles list
  useEffect(() => {
    sessionStorage.setItem('cw_articles', JSON.stringify(articles));
  }, [articles]);

  const selectedArticle = articles.find(a => a.id === selectedId) ?? null;

  // Initialize editor content when navigating to an article
  useEffect(() => {
    // Clear history when switching to a different article
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    isTypingRef.current = false;
    if (!editorRef.current || !selectedArticle?.result) return;
    const res = selectedArticle.result;
    const content = selectedArticle.editedContent || res.article;
    const isHtml = content.trim().startsWith('<');
    const html = isHtml ? content : markdownToHtml(content);
    // Apply same keyword highlighting as SeoArticleGenerator
    const keywords = [res.primaryKeyword, ...res.secondaryKeywords, ...res.lsiKeywords].filter(Boolean);
    editorRef.current.innerHTML = highlightKeywords(html, keywords);
    const words = countWords(editorRef.current.textContent || editorRef.current.innerText || '');
    const score = computeSeoScore(
      html, words,
      res.primaryKeyword, res.seoTitle,
      res.metaDescription, res.urlSlug,
      res.keywordDensity,
    );
    setEditorWords(words);
    setEditorScore(score);
    setEditorKd(res.keywordDensity);
    setEditorReadTime(res.readingTime || Math.round(words / 200));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current || !selectedId) return;
    const res = articles.find(a => a.id === selectedId)?.result;
    const words = countWords(editorRef.current.textContent || editorRef.current.innerText || '');
    const html = editorRef.current.innerHTML;
    const score = res
      ? computeSeoScore(html, words, res.primaryKeyword, res.seoTitle, res.metaDescription, res.urlSlug, res.keywordDensity)
      : Math.min(100, Math.max(55, Math.round(55 + (words / 1400) * 35)));
    setEditorWords(words);
    setEditorScore(score);
    setEditorReadTime(Math.round(words / 200));
    setArticles(prev => prev.map(a =>
      a.id === selectedId
        ? { ...a, editedContent: html, wordCount: words, seoScore: score, status: 'editing' }
        : a
    ));
  }, [selectedId, articles]);

  const execCmd = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }, []);

  const handleOpenLinkInput = useCallback(() => {
    // Save selection BEFORE the input steals focus
    const sel = window.getSelection();
    savedSelectionRef.current = (sel && sel.rangeCount > 0)
      ? sel.getRangeAt(0).cloneRange()
      : null;
    setLinkUrl('');
    setShowLinkInput(true);
  }, []);

  // ── Undo / Redo ───────────────────────────────────────────────────────────

  /** Save current editor HTML onto the undo stack (call BEFORE any change) */
  const saveSnapshot = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    undoStack.current.push(editor.innerHTML);
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const showToast = useCallback((msg: string, type: 'error' | 'info' | 'success' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleInsertLink = useCallback(() => {
    const url = linkUrl.trim();
    if (!url) { setShowLinkInput(false); return; }
    const href = url.startsWith('http') ? url : `https://${url}`;

    saveSnapshot();

    const range = savedSelectionRef.current;
    const editor = editorRef.current;
    if (!editor) return;

    // Focus editor so DOM mutations happen inside it
    editor.focus();

    if (range && !range.collapsed) {
      // Text is selected — wrap it in an <a>
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand('createLink', false, href);
    } else {
      // No selection — insert link with URL as display text at cursor / end
      const a = document.createElement('a');
      a.href = href;
      a.textContent = href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';

      if (range) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        range.insertNode(a);
        // Move cursor after inserted link
        range.setStartAfter(a);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } else {
        editor.appendChild(a);
      }
    }

    // Ensure all links with this href open in new tab
    editor.querySelectorAll(`a[href="${href}"]`).forEach(a => {
      (a as HTMLAnchorElement).target = '_blank';
      (a as HTMLAnchorElement).rel = 'noopener noreferrer';
    });

    setShowLinkInput(false);
    setLinkUrl('');
  }, [linkUrl, saveSnapshot]);

  const handleUndo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || undoStack.current.length === 0) return;
    redoStack.current.push(editor.innerHTML);
    editor.innerHTML = undoStack.current.pop()!;
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    // Trigger metrics update without re-saving history
    const res = articles.find(a => a.id === selectedId)?.result;
    const words = countWords(editor.textContent || editor.innerText || '');
    const score = res
      ? computeSeoScore(editor.innerHTML, words, res.primaryKeyword, res.seoTitle, res.metaDescription, res.urlSlug, res.keywordDensity)
      : Math.min(100, Math.max(55, Math.round(55 + (words / 1400) * 35)));
    setEditorWords(words);
    setEditorScore(score);
  }, [articles, selectedId]);

  const handleRedo = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || redoStack.current.length === 0) return;
    undoStack.current.push(editor.innerHTML);
    editor.innerHTML = redoStack.current.pop()!;
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
    const res = articles.find(a => a.id === selectedId)?.result;
    const words = countWords(editor.textContent || editor.innerText || '');
    const score = res
      ? computeSeoScore(editor.innerHTML, words, res.primaryKeyword, res.seoTitle, res.metaDescription, res.urlSlug, res.keywordDensity)
      : Math.min(100, Math.max(55, Math.round(55 + (words / 1400) * 35)));
    setEditorWords(words);
    setEditorScore(score);
  }, [articles, selectedId]);

  /** Keyboard handler: intercepts Ctrl+Z / Ctrl+Y and saves snapshot on typing bursts */
  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    // Redo
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
      return;
    }
    // Save snapshot at the start of each typing burst (before the change)
    const isModifying = !e.ctrlKey && !e.metaKey && !e.altKey &&
      (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter');
    if (isModifying && !isTypingRef.current) {
      saveSnapshot();
      isTypingRef.current = true;
    }
    // Reset burst timer — next keystroke after 800ms idle starts a new snapshot
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => { isTypingRef.current = false; }, 800);
  }, [handleUndo, handleRedo, saveSnapshot]);

  // ── AI Editor Actions ──────────────────────────────────────────────────────

  const [activeAction, setActiveAction] = useState<EditorActionType | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [showEditInput, setShowEditInput] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Insert HTML at cursor, or append at end if cursor is outside the editor */
  const insertContentAtCursor = useCallback((html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    saveSnapshot(); // save before AI insert so it's undoable
    editor.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.collapse(false);
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) frag.appendChild(temp.firstChild);
      range.insertNode(frag);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      editor.innerHTML += html;
    }
    handleEditorInput();
  }, [handleEditorInput]);

  const handleActionClick = useCallback(async (actionType: EditorActionType) => {
    if (actionType === 'edit') {
      setShowEditInput(v => !v);
      setActionError(null);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const title = selectedArticle?.result?.title || selectedArticle?.topic || '';
    const content = editor.innerHTML;
    setActiveAction(actionType);
    setActionError(null);
    try {
      const html = await runEditorAction(actionType, title, content);
      insertContentAtCursor(html);
    } catch {
      setActionError('AI generation failed. Please try again.');
    } finally {
      setActiveAction(null);
    }
  }, [selectedArticle, insertContentAtCursor]);

  const handleEditSubmit = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !editInstruction.trim()) return;
    const title = selectedArticle?.result?.title || selectedArticle?.topic || '';
    const content = editor.innerHTML;
    setActiveAction('edit');
    setActionError(null);
    setShowEditInput(false);
    saveSnapshot(); // save before AI rewrite so it's undoable
    try {
      const html = await runEditorAction('edit', title, content, editInstruction.trim());
      editor.innerHTML = html;
      handleEditorInput();
      setEditInstruction('');
    } catch {
      setActionError('AI edit failed. Please try again.');
    } finally {
      setActiveAction(null);
    }
  }, [selectedArticle, editInstruction, handleEditorInput]);

  // ── Context AI Menu handlers ───────────────────────────────────────────────

  /** Right-click inside editor → show context menu */
  const handleEditorContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const sel = window.getSelection();
    savedSelectionRef.current = (sel && sel.rangeCount > 0) ? sel.getRangeAt(0).cloneRange() : null;
    setContextMenu({ x: e.clientX, y: e.clientY });
    setShowRitzMenu(false);
    setSelectionBar(null);
  }, []);

  /** Mouse-up inside editor → show selection bar if text is highlighted */
  const handleEditorMouseUp = useCallback(() => {
    // Small delay so selection is committed
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) {
        setSelectionBar(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 3) { setSelectionBar(null); return; }
      selectionRangeRef.current = sel.getRangeAt(0).cloneRange();
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setSelectionBar({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        text,
      });
      setContextMenu(null);
    }, 10);
  }, []);

  /** Close context menu + selection bar on click-outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ctx-menu]') && !target.closest('[data-ritz-menu]')) {
        setContextMenu(null);
        setShowRitzMenu(false);
      }
      if (!target.closest('[data-sel-bar]')) {
        // only clear selection bar on mousedown outside of it
        if (e.type === 'mousedown' && !target.closest('[data-sel-bar]')) {
          setSelectionBar(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /** Context menu: run FAQ/List/Table at current cursor */
  const handleContextMenuAction = useCallback(async (actionType: EditorActionType) => {
    setShowRitzMenu(false);
    setContextMenu(null);
    if (actionType === 'edit') {
      setShowContextEditModal(true);
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    const title = selectedArticle?.result?.title || selectedArticle?.topic || '';
    const content = editor.innerHTML;
    setContextActionLoading(actionType);
    try {
      const html = await runEditorAction(actionType, title, content);
      // Restore cursor to where user right-clicked, then insert
      if (savedSelectionRef.current) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedSelectionRef.current);
      }
      insertContentAtCursor(html);
    } catch {
      showToast('AI generation failed. Please try again.', 'error');
    } finally {
      setContextActionLoading(null);
    }
  }, [selectedArticle, insertContentAtCursor, showToast]);

  /** Context Edit modal: apply instruction to full article */
  const handleContextEditSubmit = useCallback(async () => {
    if (!contextEditInstruction.trim()) return;
    const editor = editorRef.current;
    if (!editor) return;
    setShowContextEditModal(false);
    const title = selectedArticle?.result?.title || selectedArticle?.topic || '';
    const content = editor.innerHTML;
    setContextActionLoading('edit');
    saveSnapshot();
    try {
      const html = await runEditorAction('edit', title, content, contextEditInstruction.trim());
      editor.innerHTML = html;
      handleEditorInput();
      setContextEditInstruction('');
    } catch {
      showToast('AI edit failed. Please try again.', 'error');
    } finally {
      setContextActionLoading(null);
    }
  }, [contextEditInstruction, selectedArticle, saveSnapshot, handleEditorInput, showToast]);

  /** Selection bar: rewrite/expand/shorten/simplify selected text only */
  const handleQuickAction = useCallback(async (action: QuickActionType) => {
    const range = selectionRangeRef.current;
    const text = range?.toString().trim() || '';
    if (!text) return;
    const title = selectedArticle?.result?.title || selectedArticle?.topic || '';
    setQuickActionLoading(action);
    try {
      const html = await runQuickAction(action, text, title);
      saveSnapshot();
      const editor = editorRef.current;
      if (!editor || !range) return;
      // Restore selection and replace with AI result
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const frag = document.createDocumentFragment();
      while (temp.firstChild) frag.appendChild(temp.firstChild);
      range.insertNode(frag);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
      handleEditorInput();
      setSelectionBar(null);
    } catch {
      showToast('AI generation failed. Please try again.', 'error');
    } finally {
      setQuickActionLoading(null);
    }
  }, [selectedArticle, saveSnapshot, handleEditorInput, showToast]);

  // ── Retry failed article ───────────────────────────────────────────────────

  const handleRetry = useCallback(async (article: Article) => {
    const { id, topic: t, brandName: bn, category: cat } = article;
    setArticles(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'generating', errorMessage: undefined, result: null, wordCount: 0, seoScore: 0 } : a
    ));
    setGenProgress(prev => ({ ...prev, [id]: 8 }));

    let prog = 8;
    const interval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 7 + 2, 92);
      setGenProgress(prev => ({ ...prev, [id]: prog }));
    }, 700);

    try {
      const result = await generateSeoBlogArticle(t, bn || undefined, cat || undefined);
      const wc = countArticleWords(result.article);
      const computedScore = computeSeoScore(
        result.article, wc,
        result.primaryKeyword, result.seoTitle,
        result.metaDescription, result.urlSlug,
        result.keywordDensity,
      );
      clearInterval(interval);
      setGenProgress(prev => ({ ...prev, [id]: 100 }));
      setTimeout(() => {
        setArticles(prev => prev.map(a =>
          a.id === id ? { ...a, status: 'ready', result, wordCount: wc, seoScore: computedScore } : a
        ));
        setGenProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
      }, 700);
    } catch (err) {
      clearInterval(interval);
      setGenProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setArticles(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'error', errorMessage: msg } : a
      ));
    }
  }, []);

  // ── Generate article ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;

    const id = `art_${Date.now()}`;
    const newArticle: Article = {
      id,
      topic: topic.trim(),
      category,
      brandName: brandName.trim(),
      createdAt: Date.now(),
      wordCount: 0,
      seoScore: 0,
      status: 'generating',
      result: null,
    };

    setArticles(prev => [newArticle, ...prev]);
    setGenProgress(prev => ({ ...prev, [id]: 8 }));

    // Animate progress up to ~92% while waiting for API
    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + Math.random() * 7 + 2, 92);
      setGenProgress(prev => ({ ...prev, [id]: prog }));
    }, 700);

    try {
      const result = await generateSeoBlogArticle(
        topic.trim(),
        brandName.trim() || undefined,
        category || undefined,
      );

      // Always recount from actual article text so list and editor stay in sync
      const wc = countArticleWords(result.article);
      // Compute accurate SEO score from real content metrics
      const computedScore = computeSeoScore(
        result.article, wc,
        result.primaryKeyword, result.seoTitle,
        result.metaDescription, result.urlSlug,
        result.keywordDensity,
      );

      clearInterval(interval);
      setGenProgress(prev => ({ ...prev, [id]: 100 }));

      // Short delay so user sees the full ring before it disappears
      setTimeout(() => {
        setArticles(prev => prev.map(a =>
          a.id === id ? { ...a, status: 'ready', result, wordCount: wc, seoScore: computedScore } : a
        ));
        setGenProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
      }, 700);
    } catch (err) {
      clearInterval(interval);
      setGenProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setArticles(prev => prev.map(a =>
        a.id === id ? { ...a, status: 'error', errorMessage: msg } : a
      ));
    }
  }, [topic, brandName, category]);

  // ── EDITOR VIEW ───────────────────────────────────────────────────────────

  if (selectedArticle && selectedId) {
    const checks = analyzeContent(selectedArticle);
    const res = selectedArticle.result;

    return (
      <div className="flex flex-col h-screen overflow-hidden pt-2">
        {/* Back nav */}
        <div className="flex items-center gap-3 shrink-0 pb-3">
          <button
            onClick={() => setSelectedId(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Articles
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-sm text-slate-500 truncate max-w-xs">{selectedArticle.topic}</span>
          <StatusBadge status={selectedArticle.status} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">

          {/* ── LEFT: Editor ─────────────────────────────────────────────── */}
          <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">

            {/* Toolbar */}
            <div className="relative flex items-center gap-1 px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex-wrap">
              <div className="flex items-center gap-1.5 mr-2">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span className="text-xs font-bold text-slate-600 mr-1">Write Ahead</span>
              </div>

              <select
                className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none mr-2"
                defaultValue="p"
                onChange={e => execCmd('formatBlock', e.target.value)}
              >
                <option value="p">Paragraph</option>
                <option value="h1">Heading 1</option>
                <option value="h2">Heading 2</option>
                <option value="h3">Heading 3</option>
              </select>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {([
                { cmd: 'bold',          label: 'B', cls: 'font-black',    tip: 'Bold' },
                { cmd: 'italic',        label: 'I', cls: 'italic',        tip: 'Italic' },
                { cmd: 'underline',     label: 'U', cls: 'underline',     tip: 'Underline' },
                { cmd: 'strikeThrough', label: 'S', cls: 'line-through',  tip: 'Strikethrough' },
              ]).map(({ cmd, label, cls, tip }) => (
                <Tooltip key={cmd} label={tip}>
                  <button
                    onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                    className={`w-7 h-7 flex items-center justify-center text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors ${cls}`}
                  >
                    {label}
                  </button>
                </Tooltip>
              ))}

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              <Tooltip label="Clear Formatting">
                <button
                  onMouseDown={e => { e.preventDefault(); execCmd('removeFormat'); }}
                  className="w-7 h-7 flex items-center justify-center text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors font-mono"
                >
                  Tx
                </button>
              </Tooltip>

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {([
                { cmd: 'justifyLeft',   tip: 'Align Left',   icon: 'M3 6h18M3 10h12M3 14h18M3 18h12' },
                { cmd: 'justifyCenter', tip: 'Align Center', icon: 'M3 6h18M6 10h12M3 14h18M6 18h12' },
                { cmd: 'justifyRight',  tip: 'Align Right',  icon: 'M3 6h18M9 10h12M3 14h18M9 18h12' },
              ]).map(({ cmd, tip, icon }) => (
                <Tooltip key={cmd} label={tip}>
                  <button
                    onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                    className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                      {icon.split('M').filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
                    </svg>
                  </button>
                </Tooltip>
              ))}

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {([
                { cmd: 'insertUnorderedList', tip: 'Bullet List',   icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
                { cmd: 'insertOrderedList',   tip: 'Numbered List', icon: 'M10 6h11M10 12h11M10 18h11M4 6h1v4m-1 0h2M4 12a1 1 0 011-1v1a1 1 0 01-1 1H3' },
              ]).map(({ cmd, tip, icon }) => (
                <Tooltip key={cmd} label={tip}>
                  <button
                    onMouseDown={e => { e.preventDefault(); execCmd(cmd); }}
                    className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round">
                      {icon.split('M').filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
                    </svg>
                  </button>
                </Tooltip>
              ))}

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Insert Link */}
              <Tooltip label="Insert Link">
                <button
                  onMouseDown={e => { e.preventDefault(); handleOpenLinkInput(); }}
                  className="w-7 h-7 flex items-center justify-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                </button>
              </Tooltip>

              {/* Link URL input popover */}
              {showLinkInput && (
                <div className="absolute top-full left-0 mt-1 z-50 flex items-center gap-2 bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  <input
                    autoFocus
                    type="url"
                    placeholder="Paste or type URL…"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleInsertLink();
                      if (e.key === 'Escape') setShowLinkInput(false);
                    }}
                    className="text-xs outline-none w-52 text-slate-700 placeholder-slate-400"
                  />
                  <button
                    onClick={handleInsertLink}
                    className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowLinkInput(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <div className="w-px h-5 bg-slate-200 mx-0.5" />

              {/* Undo / Redo */}
              <Tooltip label="Undo (Ctrl+Z)">
                <button
                  onMouseDown={e => { e.preventDefault(); handleUndo(); }}
                  disabled={!canUndo}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
              </Tooltip>
              <Tooltip label="Redo (Ctrl+Y)">
                <button
                  onMouseDown={e => { e.preventDefault(); handleRedo(); }}
                  disabled={!canRedo}
                  className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                  </svg>
                </button>
              </Tooltip>

              <div className="ml-auto">
                <Tooltip label="Copy article text to clipboard">
                  <button
                    onClick={() => {
                      const text =
                        editorRef.current?.textContent ||
                        editorRef.current?.innerText ||
                        selectedArticle.result?.article ||
                        '';
                      navigator.clipboard.writeText(text).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className={`text-xs font-bold px-2 py-1 rounded-lg transition-colors ${
                      copied
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50'
                    }`}
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* AI Action Pills */}
            <div className="px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/40">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-0.5">
                  AI Actions
                </span>
                {([
                  { action: 'faq'   as EditorActionType, label: 'Generate FAQ',   icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                  { action: 'list'  as EditorActionType, label: 'Generate List',  icon: 'M4 6h16M4 10h16M4 14h16M4 18h7' },
                  { action: 'table' as EditorActionType, label: 'Generate Table', icon: 'M3 10h18M3 14h18M10 3v18M14 3v18M3 6a1 1 0 011-1h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6z' },
                  { action: 'edit'  as EditorActionType, label: 'Edit with AI',   icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
                ] as const).map(({ action, label, icon }) => {
                  const isThisActive = activeAction === action;
                  const isDisabled = !!activeAction;
                  const isEditOpen = action === 'edit' && showEditInput;
                  return (
                    <button
                      key={action}
                      onClick={() => handleActionClick(action)}
                      disabled={isDisabled}
                      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all
                        ${isThisActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : isEditOpen
                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-700 hover:bg-indigo-50'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isThisActive ? (
                        <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none"
                          style={{ animation: 'spin 0.8s linear infinite', transformOrigin: 'center' }}>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                        </svg>
                      )}
                      {isThisActive ? 'Generating...' : label}
                    </button>
                  );
                })}

                {/* Error inline */}
                {actionError && (
                  <span className="text-[11px] text-red-500 font-medium ml-2 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                    {actionError}
                    <button onClick={() => setActionError(null)} className="underline hover:no-underline">Dismiss</button>
                  </span>
                )}
              </div>

              {/* Edit with AI — instruction input */}
              {showEditInput && (
                <div className="mt-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={editInstruction}
                    onChange={e => setEditInstruction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEditSubmit()}
                    placeholder='e.g. "Make it more concise" or "Add more details about benefits"'
                    className="flex-1 text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent placeholder-slate-400 text-slate-800"
                    autoFocus
                  />
                  <button
                    onClick={handleEditSubmit}
                    disabled={!editInstruction.trim()}
                    className="shrink-0 bg-purple-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => { setShowEditInput(false); setEditInstruction(''); setActionError(null); }}
                    className="shrink-0 text-slate-400 hover:text-slate-600 text-xs px-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Editable content area */}
            <div className="relative flex-1 overflow-y-auto">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                onKeyDown={handleEditorKeyDown}
                onContextMenu={handleEditorContextMenu}
                onMouseUp={handleEditorMouseUp}
                onMouseOver={e => {
                  const a = (e.target as HTMLElement).closest('a');
                  if (a) {
                    const rect = a.getBoundingClientRect();
                    const containerRect = editorRef.current!.parentElement!.getBoundingClientRect();
                    setLinkPreview({
                      href: a.getAttribute('href') || '',
                      x: rect.left - containerRect.left,
                      y: rect.bottom - containerRect.top + 4,
                    });
                  }
                }}
                onMouseOut={e => {
                  const a = (e.target as HTMLElement).closest('a');
                  if (a) setLinkPreview(null);
                }}
                onClick={e => {
                  const a = (e.target as HTMLElement).closest('a');
                  if (a) {
                    e.preventDefault();
                    const href = a.getAttribute('href');
                    if (href) window.open(href, '_blank', 'noopener,noreferrer');
                  }
                }}
                className="min-h-full px-8 py-6 text-slate-800 text-[15px] leading-relaxed outline-none
                  [&_h1]:text-2xl [&_h1]:font-black [&_h1]:text-slate-900 [&_h1]:mb-5 [&_h1]:mt-0 [&_h1]:leading-tight
                  [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:pb-2 [&_h2]:border-b [&_h2]:border-slate-100
                  [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 [&_h3]:mt-5 [&_h3]:mb-2
                  [&_p]:mb-4 [&_p]:text-slate-700 [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-4 [&_ul]:space-y-1.5
                  [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-4 [&_ol]:space-y-1.5
                  [&_li]:text-slate-700
                  [&_strong]:font-bold
                  [&_em]:italic
                  [&_hr]:my-6 [&_hr]:border-slate-200
                  [&_mark]:bg-yellow-200 [&_mark]:text-yellow-900 [&_mark]:rounded [&_mark]:px-0.5
                  [&_a]:text-indigo-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-indigo-400 [&_a]:cursor-pointer [&_a]:font-medium hover:[&_a]:text-indigo-800 hover:[&_a]:decoration-indigo-600"
              />

              {/* Link hover preview */}
              {linkPreview && (
                <div
                  className="pointer-events-none absolute z-50 flex items-center gap-1.5 bg-gray-900 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-lg max-w-xs"
                  style={{ left: linkPreview.x, top: linkPreview.y }}
                >
                  <svg className="w-3 h-3 shrink-0 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
                  </svg>
                  <span className="truncate">{linkPreview.href}</span>
                </div>
              )}
            </div>

            {/* ── Selection Bar (highlight toolbar) ─────────────────────────── */}
            {selectionBar && !contextMenu && (
              <div
                data-sel-bar
                className="fixed z-[200] flex items-center gap-0.5 bg-gray-900 rounded-xl shadow-2xl px-1.5 py-1.5 border border-white/10"
                style={{
                  left: selectionBar.x,
                  top: selectionBar.y,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                {([
                  { action: 'rewrite'  as QuickActionType, label: 'Rewrite',  icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
                  { action: 'expand'   as QuickActionType, label: 'Expand',   icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4' },
                  { action: 'shorten'  as QuickActionType, label: 'Shorten',  icon: 'M5 12h14M12 5l7 7-7 7' },
                  { action: 'simplify' as QuickActionType, label: 'Simplify', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
                ] as const).map(({ action, label, icon }) => (
                  <button
                    key={action}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleQuickAction(action)}
                    disabled={quickActionLoading !== null}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-white hover:bg-white/10 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {quickActionLoading === action ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        {icon.split('M').filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
                      </svg>
                    )}
                    {label}
                  </button>
                ))}
                {/* Caret arrow pointing down */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
              </div>
            )}

            {/* Bottom bar */}
            <div className="flex items-center gap-6 px-8 py-3 border-t border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
              <span>
                Content Score{' '}
                <span className={`font-bold ml-1 ${editorScore >= 80 ? 'text-emerald-600' : editorScore >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                  {editorScore || '—'}
                </span>
              </span>
              <span>
                Word Count <span className="font-bold text-slate-700 ml-1">{editorWords > 0 ? editorWords.toLocaleString() : '—'}</span>
              </span>
              <span>
                Readability <span className="font-bold text-slate-700 ml-1">Good</span>
              </span>
            </div>
          </div>

          {/* ── RIGHT: Analysis panels ────────────────────────────────────── */}
          <div className="space-y-5 overflow-y-auto">

            {/* SEO Analysis ring */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h4 className="font-bold text-slate-800 mb-4">SEO Analysis</h4>
              <ScoreRing score={editorScore || selectedArticle.seoScore} />
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Words</p>
                  <p className="text-base font-bold text-slate-800">{editorWords > 0 ? editorWords.toLocaleString() : selectedArticle.wordCount.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Read Time</p>
                  <p className="text-base font-bold text-slate-800">{editorReadTime || res?.readingTime || '—'} min</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 col-span-2">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Keyword Density</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 rounded-full h-1.5">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min((editorKd || res?.keywordDensity || 0) * 33, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{editorKd || res?.keywordDensity || 0}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SEO Metadata */}
            {res && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h4 className="font-bold text-slate-800 mb-4">SEO Metadata</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">SEO Title</p>
                    <input
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      defaultValue={res.seoTitle}
                    />
                    <p className="text-[10px] text-slate-400 mt-1">{res.seoTitle.length} / 60 chars</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Meta Description</p>
                    <textarea
                      rows={3}
                      className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                      defaultValue={res.metaDescription}
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">{res.metaDescription.length} / 160 chars</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">URL Slug</p>
                    <p className="text-sm font-mono text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg break-all">
                      /{res.urlSlug}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Schema Markup</p>
                    <p className="text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg">
                      Article schema applied automatically
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Content Optimization panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h4 className="font-bold text-slate-800 mb-4">Content Optimization</h4>
              {checks.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Generate an article to see optimization checks.</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {checks.map(check => (
                    <div key={check.label} className="flex items-center justify-between py-3">
                      <span className="text-sm text-slate-700">{check.label}</span>
                      {check.status === 'good' ? (
                        <span className="text-xs font-semibold text-emerald-600">All good</span>
                      ) : (
                        <span className="text-xs font-semibold text-red-500">
                          {check.issueCount} issue{check.issueCount !== 1 ? 's' : ''} found
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Context Menu (right-click) ──────────────────────────────────── */}
        {contextMenu && (
          <div
            data-ctx-menu
            className="fixed z-[300] bg-white rounded-2xl shadow-2xl border border-slate-100 py-1.5 min-w-[200px] overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y - 8, transform: 'translateY(-100%)' }}
          >
            {/* Add Comment */}
            <button
              onClick={() => { setContextMenu(null); showToast('Comments coming soon.', 'info'); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              Add Comment
            </button>

            {/* Create AI Image */}
            <button
              onClick={() => { setContextMenu(null); showToast('AI image generation coming soon.', 'info'); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
            >
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Create AI Image
            </button>

            <div className="my-1 border-t border-slate-100" />

            {/* Edit with Ritz AI */}
            <div data-ritz-menu className="relative">
              <button
                onClick={() => setShowRitzMenu(v => !v)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors text-left"
              >
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                Edit with Ritz AI
                <svg className={`w-3.5 h-3.5 ml-auto transition-transform ${showRitzMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Ritz AI submenu */}
              {showRitzMenu && (
                <div className="bg-slate-50 border-t border-slate-100">
                  {([
                    { type: 'edit'  as EditorActionType, label: 'Edit with AI',    icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'text-violet-600' },
                    { type: 'faq'   as EditorActionType, label: 'Generate FAQ',    icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-blue-600' },
                    { type: 'list'  as EditorActionType, label: 'Generate List',   icon: 'M4 6h16M4 10h16M4 14h16M4 18h7', color: 'text-emerald-600' },
                    { type: 'table' as EditorActionType, label: 'Generate Table',  icon: 'M3 10h18M3 14h18M10 3v18M14 3v18M3 6a1 1 0 011-1h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6z', color: 'text-amber-600' },
                  ]).map(({ type, label, icon, color }) => (
                    <button
                      key={type}
                      onClick={() => handleContextMenuAction(type)}
                      disabled={contextActionLoading !== null}
                      className="w-full flex items-center gap-3 pl-8 pr-4 py-2.5 text-sm text-slate-700 hover:bg-white transition-colors text-left disabled:opacity-50"
                    >
                      {contextActionLoading === type ? (
                        <svg className="w-4 h-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className={`w-4 h-4 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          {icon.split('M').filter(Boolean).map((d, i) => <path key={i} d={`M${d}`} />)}
                        </svg>
                      )}
                      {contextActionLoading === type ? `${label}…` : label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Context Edit Modal ──────────────────────────────────────────────── */}
        {showContextEditModal && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Edit with AI</h3>
                  <p className="text-xs text-slate-400">Describe what you want to change</p>
                </div>
                <button onClick={() => setShowContextEditModal(false)} className="ml-auto text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <textarea
                autoFocus
                rows={3}
                value={contextEditInstruction}
                onChange={e => setContextEditInstruction(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleContextEditSubmit(); }}
                placeholder='e.g. "Rewrite this paragraph to improve clarity" or "Expand the introduction"'
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 resize-none mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowContextEditModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleContextEditSubmit}
                  disabled={!contextEditInstruction.trim()}
                  className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-40"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Toast notification ──────────────────────────────────────────────── */}
        {toast && (
          <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all
            ${toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-white'}`}
          >
            {toast.type === 'error' && (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.msg}
          </div>
        )}

      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Generator card ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">AI SEO Blog Generator</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Generate a full SEO-optimized article with metadata, keywords &amp; ranking analysis.
            </p>
          </div>
          <div className="flex gap-1.5">
            {['Gemini AI', 'SEO Optimized', '900+ Words'].map(tag => (
              <span key={tag} className="text-[11px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-medium">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Inputs row */}
        <div className="px-6 py-4 border-b border-slate-100">
          <div className="flex items-end gap-3">

            {/* Topic */}
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Post Topic / Campaign
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder='e.g., "Best AI marketing tools for startups"'
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="h-10 w-px bg-slate-200 self-end mb-0.5" />

            {/* Brand Boost */}
            <div className="w-56 shrink-0">
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Your Brand</label>
                <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                  ⚡ Brand Boost
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={brandName}
                  onChange={e => setBrandName(e.target.value)}
                  placeholder="mywebsite.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 pr-8 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-all"
                />
                {brandName.trim() && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={handleGenerate}
              disabled={!topic.trim() || isGenerating}
              className="shrink-0 bg-indigo-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shadow-sm shadow-indigo-100 flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    style={{ animation: 'spin 0.8s linear infinite', transformOrigin: 'center' }}
                  >
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>✦ Generate Article</>
              )}
            </button>
          </div>
        </div>

        {/* Category pills */}
        <div className="px-6 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
            Content Category
          </span>
          {([
            { value: 'local_business', label: '📍 Local Business / City' },
            { value: 'products',       label: '🛍️ Products & Reviews' },
            { value: 'educational',    label: '🎓 Educational' },
            { value: 'informational',  label: '💡 Informational' },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(category === value ? null : value)}
              className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${
                category === value
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700'
              }`}
            >
              {label}
            </button>
          ))}
          {category && (
            <span className="text-[11px] text-slate-400 ml-auto">
              Category applied ·{' '}
              <button onClick={() => setCategory(null)} className="text-slate-500 hover:text-slate-700 underline">
                clear
              </button>
            </span>
          )}
        </div>
      </div>

      {/* ── Article list table ──────────────────────────────────────────── */}
      {articles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Table toolbar */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-wrap">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search Articles"
                className="text-sm bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 w-52 placeholder-slate-400"
              />
            </div>
            <button className="flex items-center gap-1.5 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Filter By
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2">
              Sort By: <span className="font-semibold ml-1">Created At</span>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <table className="w-full text-left">
            <thead className="border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Keyword(s)</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Created at</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Word Count</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Content Score</th>
                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articles.map(article => {
                const prog = genProgress[article.id];
                const isGen = article.status === 'generating';
                const isError = article.status === 'error';
                const clickable = !isGen && !isError && !!article.result;

                return (
                  <tr
                    key={article.id}
                    onClick={() => clickable && setSelectedId(article.id)}
                    className={`transition-colors ${clickable ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
                  >
                    {/* Topic */}
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <span className="text-sm font-semibold text-slate-900 block max-w-xs">
                            {article.topic}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            </svg>
                            <span className="text-[11px] text-slate-400">
                              {article.category ? article.category.replace('_', ' ') : 'Deep Research'}
                            </span>
                          </div>
                          <button className="mt-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium">
                            Add Tag +
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Created / Progress */}
                    <td className="px-6 py-4">
                      {isGen && prog !== undefined ? (
                        <div className="flex items-center gap-2">
                          <CircularProgress progress={prog} />
                          <span className="text-xs text-slate-500">{Math.round(prog)}%</span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">{relativeTime(article.createdAt)}</span>
                      )}
                    </td>

                    {/* Word count */}
                    <td className="px-6 py-4 text-center">
                      <span className={`text-base font-bold block ${article.wordCount > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                        {article.wordCount > 0 ? article.wordCount.toLocaleString() : '0'}
                      </span>
                      <span className="text-xs text-slate-400">Words</span>
                    </td>

                    {/* SEO score */}
                    <td className="px-6 py-4">
                      {article.seoScore > 0 ? (
                        <span className={`text-sm font-bold px-3 py-1 rounded-lg inline-block ${
                          article.seoScore >= 80 ? 'bg-amber-50 text-amber-700' :
                          article.seoScore >= 60 ? 'bg-blue-50 text-blue-700' :
                          'bg-red-50 text-red-700'
                        }`}>
                          {article.seoScore}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <StatusBadge status={article.status} />
                      {isError ? (
                        <div className="mt-1">
                          <p className="text-[11px] text-red-400 truncate max-w-[160px]" title={article.errorMessage}>
                            {article.errorMessage || 'Generation failed'}
                          </p>
                          <button
                            onClick={e => { e.stopPropagation(); handleRetry(article); }}
                            className="mt-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            ↺ Retry
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1">
                          Last updated {relativeTime(article.createdAt)}
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {articles.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700 mb-1">No articles yet</p>
          <p className="text-xs text-slate-400">Enter a topic above and click Generate Article to get started.</p>
        </div>
      )}
    </div>
  );
};

export default ContentWriterPanel;
