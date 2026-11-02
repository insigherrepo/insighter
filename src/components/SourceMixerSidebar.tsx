import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckSquare,
  FileText,
  Film,
  Flame,
  FolderUp,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  UploadCloud,
  Video,
} from 'lucide-react';
import { useInsighterStore } from '../store/useInsighterStore';
import { SourceItem, SourceType } from '../types/insighter';

const SOURCE_TYPE_META: Record<SourceType, { label: string; icon: React.ReactNode }> = {
  pdf_article: { label: 'Artigo / PDF', icon: <FileText size={14} /> },
  image_visual: { label: 'Imagem / Visual', icon: <ImageIcon size={14} /> },
  youtube_transcript: { label: 'YouTube / Transcrição', icon: <Video size={14} /> },
  script_draft: { label: 'Rascunho de Roteiro', icon: <Film size={14} /> },
  lore_bible: { label: 'Bíblia / Lore', icon: <BookOpen size={14} /> },
  raw_notes: { label: 'Notas Brutas', icon: <Flame size={14} /> },
  distilled_note: { label: 'Fonte Destilada ✨', icon: <Sparkles size={14} /> },
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const SourceMixerSidebar: React.FC = () => {
  const {
    project,
    sidebarCollapsed,
    toggleSourceActive,
    setAllSourcesActive,
    addSource,
    removeSource,
    updateSourceContent,
  } = useInsighterStore();

  const pathInputId = useId();
  const dropInputRef = useRef<HTMLInputElement | null>(null);
  const lastLoadedPathRef = useRef<string>('');

  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<SourceType>('pdf_article');
  const [newOrigin, setNewOrigin] = useState('');
  const [newContent, setNewContent] = useState('');

  const [copyPathInput, setCopyPathInput] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoadingSource, setIsLoadingSource] = useState(false);
  const [reloadingSourceId, setReloadingSourceId] = useState<string | null>(null);
  const [sourceFeedback, setSourceFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const activeCount = project.sources.filter((s) => s.isActive).length;

  const showTempFeedback = (type: 'ok' | 'err', text: string) => {
    setSourceFeedback({ type, text });
    window.setTimeout(() => {
      setSourceFeedback((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  /**
   * Auto-reparo imediato de fontes:
   * Se alguma fonte tiver filePath mas seu content começar com o marcador de caminho ou
   * for apenas um placeholder curto (< 250 chars), re-extrai automaticamente o texto real.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const desktop = window.insighterDesktop;
    const loadFn = desktop?.loadSourceFromPath;
    if (!loadFn) return;

    const sourcesNeedingRepair = project.sources.filter(
      (s) =>
        s.filePath &&
        (s.content.startsWith('[Documento PDF carregado:') ||
          s.content.startsWith('[Fonte referenciada pelo caminho:') ||
          (s.type === 'pdf_article' && s.content.length < 250))
    );

    if (sourcesNeedingRepair.length === 0) return;

    (async () => {
      for (const src of sourcesNeedingRepair) {
        try {
          if (!src.filePath) continue;
          const res = await loadFn(src.filePath);
          if (res.ok && res.sources && res.sources.length > 0) {
            const loaded = res.sources[0];
            if (loaded.content && loaded.content.length > 250) {
              updateSourceContent(src.id, loaded.content);
              showTempFeedback(
                'ok',
                `Texto extraído com sucesso de "${src.title}" (${loaded.content.length.toLocaleString('pt-BR')} caracteres)!`
              );
            }
          }
        } catch (err) {
          console.error('Erro ao auto-reparar texto da fonte:', src.title, err);
        }
      }
    })();
  }, [project.id]);

  const handleReloadSource = async (src: SourceItem) => {
    if (!src.filePath) return;
    const loadFn = typeof window !== 'undefined' ? window.insighterDesktop?.loadSourceFromPath : undefined;
    if (!loadFn) {
      showTempFeedback('err', 'Recarregamento de arquivo disponível no aplicativo desktop.');
      return;
    }
    setReloadingSourceId(src.id);
    try {
      const res = await loadFn(src.filePath);
      if (res.ok && res.sources && res.sources.length > 0) {
        const loaded = res.sources[0];
        updateSourceContent(src.id, loaded.content);
        showTempFeedback(
          'ok',
          `Texto de "${src.title}" extraído com sucesso (${loaded.content.length.toLocaleString('pt-BR')} caracteres)!`
        );
      } else {
        showTempFeedback('err', res.error || 'Não foi possível extrair o texto do arquivo.');
      }
    } catch (err: any) {
      showTempFeedback('err', err?.message || 'Erro ao recarregar arquivo.');
    } finally {
      setReloadingSourceId(null);
    }
  };

  /**
   * Carrega um arquivo ou pasta pelo caminho local (ex: colado via Copy Path do Finder)
   * automaticamente ao sair do campo (onBlur) ou pressionar Enter.
   */
  const loadFromPathString = async (rawPath: string) => {
    const trimmed = rawPath.trim();
    if (!trimmed || isLoadingSource) return;
    if (trimmed === lastLoadedPathRef.current) return;

    setIsLoadingSource(true);
    try {
      if (typeof window !== 'undefined' && window.insighterDesktop?.loadSourceFromPath) {
        const result = await window.insighterDesktop.loadSourceFromPath(trimmed);
        if (result.ok && result.sources && result.sources.length > 0) {
          for (const item of result.sources) {
            addSource({
              title: item.title,
              type: (item.type as SourceType) || 'pdf_article',
              authorOrOrigin: item.authorOrOrigin,
              content: item.content,
              filePath: item.filePath,
              mimeType: item.mimeType,
              mediaDataUrl: item.mediaDataUrl,
            });
          }
          lastLoadedPathRef.current = '';
          setCopyPathInput('');
          showTempFeedback(
            'ok',
            result.sources.length === 1
              ? `Fonte "${result.sources[0].title}" adicionada!`
              : `${result.sources.length} fontes carregadas da pasta!`
          );
          return;
        }
        showTempFeedback('err', result.error || 'Não foi possível ler o caminho informado.');
        return;
      }

      // Fallback Web caso fora do Electron
      const fileName = trimmed.split(/[/\\]/).pop() || 'Fonte por Caminho';
      addSource({
        title: fileName,
        type: /\.(png|jpe?g|webp|gif|svg)$/i.test(fileName) ? 'image_visual' : 'pdf_article',
        authorOrOrigin: `Caminho: ${trimmed}`,
        content: `[Fonte referenciada pelo caminho: ${trimmed}]`,
        filePath: trimmed,
      });
      setCopyPathInput('');
      showTempFeedback('ok', `Fonte "${fileName}" adicionada!`);
    } finally {
      setIsLoadingSource(false);
    }
  };

  /**
   * Processa uma lista de arquivos (via Drag-and-Drop ou seletor de arquivos):
   * suporta imagens, PDFs, roteiros (.fountain), documentos (.docx, .rtf, .txt, .md, .srt, .csv, .json, etc.)
   */
  const processFilesList = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsLoadingSource(true);
    let addedCount = 0;

    try {
      for (const file of files) {
        // No aplicativo Desktop macOS, usa o leitor nativo (com PDFKit, textutil e redimensionamento de imagem)
        const nativePath =
          typeof window !== 'undefined' && window.insighterDesktop?.getPathForFile
            ? window.insighterDesktop.getPathForFile(file)
            : (file as File & { path?: string }).path || '';

        if (nativePath && window.insighterDesktop?.loadSourceFromPath) {
          const res = await window.insighterDesktop.loadSourceFromPath(nativePath);
          if (res.ok && res.sources && res.sources.length > 0) {
            for (const src of res.sources) {
              addSource({
                title: src.title,
                type: (src.type as SourceType) || 'pdf_article',
                authorOrOrigin: src.authorOrOrigin,
                content: src.content,
                filePath: src.filePath,
                mimeType: src.mimeType,
                mediaDataUrl: src.mediaDataUrl,
              });
              addedCount++;
            }
            continue;
          }
        }

        // Processamento direto no navegador / fallback multimodal
        const isImage =
          file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|heic)$/i.test(file.name);
        const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const sizeKb = Math.max(1, Math.round(file.size / 1024));

        if (isImage) {
          const dataUrl = await readFileAsDataUrl(file);
          addSource({
            title: file.name,
            type: 'image_visual',
            authorOrOrigin: `Imagem (${sizeKb} KB)`,
            content: `[Referência Visual / Imagem: "${file.name}" (${sizeKb} KB). O motor multimodal Gemini analisará diretamente os elementos visuais desta imagem.]`,
            mimeType: file.type || 'image/png',
            mediaDataUrl: dataUrl,
          });
          addedCount++;
        } else if (isPdf) {
          const rawText = await file.text().catch(() => '');
          const printable = rawText.replace(/[^\x20-\x7E\u00A0-\u00FF\n\r\t]/g, ' ').replace(/\s{3,}/g, ' ').trim();
          addSource({
            title: file.name,
            type: 'pdf_article',
            authorOrOrigin: `PDF (${sizeKb} KB)`,
            content:
              printable.length > 120
                ? printable.slice(0, 25000)
                : `[Documento PDF: "${file.name}" (${sizeKb} KB) carregado para análise.]`,
            mimeType: 'application/pdf',
          });
          addedCount++;
        } else {
          const text = await file.text().catch(() => '');
          addSource({
            title: file.name,
            type: file.name.endsWith('.fountain')
              ? 'script_draft'
              : /\.(srt|vtt)$/i.test(file.name)
              ? 'youtube_transcript'
              : 'pdf_article',
            authorOrOrigin: `Arquivo (${sizeKb} KB)`,
            content: text.slice(0, 30000) || `[Arquivo "${file.name}" (${sizeKb} KB)]`,
          });
          addedCount++;
        }
      }

      if (addedCount > 0) {
        showTempFeedback(
          'ok',
          addedCount === 1 ? '1 fonte adicionada ao Mixer!' : `${addedCount} fontes adicionadas ao Mixer!`
        );
      }
    } catch {
      showTempFeedback('err', 'Erro ao processar arquivo arrastado.');
    } finally {
      setIsLoadingSource(false);
    }
  };

  const handleCreateSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    addSource({
      title: newTitle || 'Nova Fonte de Pesquisa',
      type: newType,
      authorOrOrigin: newOrigin || 'Upload / Nota Local',
      content: newContent,
    });
    setNewTitle('');
    setNewOrigin('');
    setNewContent('');
    setIsAdding(false);
  };

  const handleManualFormFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFilesList(files);
    e.target.value = '';
    setIsAdding(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      await processFilesList(e.dataTransfer.files);
      return;
    }

    const droppedText = e.dataTransfer?.getData('text/plain')?.trim();
    if (droppedText) {
      await loadFromPathString(droppedText);
    }
  };

  return (
    <aside
      className={`source-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${
        isDraggingOver ? 'dragging-over' : ''
      }`}
      aria-label="Curadoria de Fontes"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              color: 'var(--text-primary)',
            }}
          >
            CURADORIA & CONTEXT MIXER
          </span>
          <button
            type="button"
            className="btn-studio amber"
            style={{ padding: '4px 9px', fontSize: '0.73rem', flexShrink: 0 }}
            onClick={() => setIsAdding(!isAdding)}
            title="Escrever ou colar texto de fonte manualmente"
          >
            <Plus size={13} /> Nota / Texto
          </button>
        </div>

        {/* Zona Drag-and-Drop para Imagens, PDFs e outros arquivos */}
        <div
          className={`source-dropzone ${isDraggingOver ? 'active' : ''}`}
          onClick={() => dropInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              dropInputRef.current?.click();
            }
          }}
          title="Arraste e solte imagens, PDFs, roteiros ou documentos aqui, ou clique para selecionar"
        >
          <input
            ref={dropInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.fountain,.srt,.vtt,.csv,.json,.docx,.doc,.rtf,.html,.xml"
            onChange={(e) => {
              if (e.target.files) {
                processFilesList(e.target.files);
                e.target.value = '';
              }
            }}
            style={{ display: 'none' }}
          />
          {isLoadingSource ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent-amber)' }}>
              <Loader2 size={14} className="pulse-indicator" /> Carregando fonte(s)...
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <UploadCloud size={15} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
              <span>
                <strong>Arraste imagens, PDFs ou arquivos</strong> aqui (ou clique)
              </span>
            </span>
          )}
        </div>

        {/* Campo Copy Path: carrega automaticamente ao sair do campo (onBlur) ou dar Enter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label
            htmlFor={pathInputId}
            style={{
              fontSize: '0.69rem',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Link2 size={11} style={{ color: 'var(--accent-sage)' }} />
            Caminho da Fonte (Copy Path — carrega ao sair):
          </label>
          <input
            id={pathInputId}
            name="sourceFilePath"
            type="text"
            value={copyPathInput}
            onChange={(e) => setCopyPathInput(e.target.value)}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                loadFromPathString(e.target.value);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && copyPathInput.trim()) {
                e.preventDefault();
                loadFromPathString(copyPathInput);
              }
            }}
            placeholder="Cole o caminho (Option+Cmd+C) e saia do campo..."
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="provocation-input"
            style={{
              padding: '6px 9px',
              fontSize: '0.74rem',
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>

        {sourceFeedback && (
          <div
            role="status"
            aria-live="polite"
            style={{
              fontSize: '0.72rem',
              padding: '5px 8px',
              borderRadius: 'var(--radius-sm)',
              background: sourceFeedback.type === 'ok' ? 'var(--tint-sage)' : 'var(--tint-terracotta)',
              color: 'var(--text-primary)',
              border: `1px solid ${
                sourceFeedback.type === 'ok' ? 'var(--accent-sage)' : 'var(--accent-terracotta)'
              }`,
            }}
          >
            {sourceFeedback.text}
          </div>
        )}

        <div className="mixer-meter">
          <span>
            Contexto Ativo:{' '}
            <strong style={{ color: activeCount > 0 ? 'var(--accent-sage)' : 'var(--accent-terracotta)' }}>
              {activeCount} de {project.sources.length} fontes
            </strong>
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => setAllSourcesActive(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-sage)',
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              Todas
            </button>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <button
              type="button"
              onClick={() => setAllSourcesActive(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.72rem',
                cursor: 'pointer',
              }}
            >
              Isolar
            </button>
          </div>
        </div>

        {isAdding && (
          <form
            onSubmit={handleCreateSource}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 10,
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-strong)',
            }}
          >
            <input
              type="text"
              placeholder="Título da fonte (ex: Entrevista, Artigo, Cena 2)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="provocation-input"
              style={{ padding: '6px 9px', fontSize: '0.78rem' }}
              required
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as SourceType)}
                className="provocation-input"
                style={{ padding: '5px 8px', fontSize: '0.74rem', flex: 1, minWidth: 0 }}
              >
                <option value="pdf_article">📄 Artigo / PDF</option>
                <option value="image_visual">🖼️ Imagem / Visual</option>
                <option value="youtube_transcript">🎬 YouTube / Transcrição</option>
                <option value="script_draft">🎞️ Rascunho de Roteiro</option>
                <option value="lore_bible">🧭 Bíblia / Lore</option>
                <option value="raw_notes">📝 Notas Brutas</option>
              </select>
              <label
                className="btn-studio"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
                title="Selecionar arquivo do computador (Imagens, PDF, Texto, Roteiro)"
                aria-label="Selecionar arquivo do computador"
              >
                <FolderUp size={15} />
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.md,.fountain,.srt,.vtt,.csv,.json,.docx,.doc,.rtf,.html,.xml"
                  onChange={handleManualFormFilePick}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <textarea
              placeholder="Cole aqui o trecho do documento, transcrição do vídeo, rascunho de cena ou regras do universo..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="beat-textarea"
              style={{ minHeight: 88, fontSize: '0.78rem' }}
              required
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                type="button"
                className="btn-studio"
                style={{ padding: '4px 8px', fontSize: '0.73rem' }}
                onClick={() => setIsAdding(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-studio sage"
                style={{ padding: '4px 10px', fontSize: '0.73rem' }}
              >
                Adicionar ao Mixer
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="source-list">
        {project.sources.map((src) => {
          const meta = SOURCE_TYPE_META[src.type] || SOURCE_TYPE_META.raw_notes;
          const isPlaceholderPathOnly =
            src.content.startsWith('[Documento PDF carregado:') ||
            src.content.startsWith('[Fonte referenciada pelo caminho:') ||
            (src.type === 'pdf_article' && src.content.length < 250 && Boolean(src.filePath));

          return (
            <div
              key={src.id}
              className={`source-card ${src.isActive ? 'active' : ''} ${
                src.type === 'distilled_note' ? 'distilled' : ''
              }`}
              onClick={() => toggleSourceActive(src.id)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    color: src.isActive ? 'var(--accent-sage)' : 'var(--text-muted)',
                  }}
                >
                  {src.isActive ? <CheckSquare size={15} /> : <Square size={15} />}
                  <span
                    style={{
                      fontSize: '0.71rem',
                      fontFamily: 'var(--font-mono)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSource(src.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: 2,
                  }}
                  title="Remover fonte"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <h4
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginTop: 6,
                  lineHeight: 1.35,
                  wordBreak: 'break-word',
                }}
              >
                {src.title}
              </h4>

              {src.mediaDataUrl && src.mediaDataUrl.startsWith('data:image/') && (
                <div
                  style={{
                    marginTop: 7,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-subtle)',
                    maxHeight: 120,
                    background: '#121110',
                  }}
                >
                  <img
                    src={src.mediaDataUrl}
                    alt={src.title}
                    style={{
                      width: '100%',
                      maxHeight: 120,
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>
              )}

              {/* Se o conteúdo ainda for apenas o marcador de caminho ou placeholder, exibe aviso e botão direto para extrair */}
              {isPlaceholderPathOnly ? (
                <div
                  style={{
                    marginTop: 6,
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--tint-terracotta)',
                    border: '1px solid var(--accent-terracotta)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span
                    style={{
                      fontSize: '0.69rem',
                      color: 'var(--accent-terracotta)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AlertCircle size={12} /> Apenas caminho registrado (texto ainda não extraído)
                  </span>
                  {src.filePath && (
                    <button
                      type="button"
                      className="btn-studio terracotta"
                      disabled={reloadingSourceId === src.id}
                      style={{ padding: '3px 7px', fontSize: '0.69rem', alignSelf: 'flex-start' }}
                      onClick={() => handleReloadSource(src)}
                    >
                      <RefreshCw size={11} className={reloadingSourceId === src.id ? 'spin' : ''} />
                      {reloadingSourceId === src.id ? 'Extraindo texto...' : 'Extrair Texto do Arquivo'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: 5,
                      lineHeight: 1.45,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {src.content}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 6,
                      fontSize: '0.67rem',
                      color: 'var(--text-muted)',
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 4,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span style={{ color: 'var(--accent-sage)', fontWeight: 500 }}>
                      ✓ {src.content.length.toLocaleString('pt-BR')} caracteres
                    </span>
                    {src.filePath && (
                      <button
                        type="button"
                        className="btn-studio"
                        disabled={reloadingSourceId === src.id}
                        style={{ padding: '2px 5px', fontSize: '0.66rem' }}
                        onClick={() => handleReloadSource(src)}
                        title="Re-extrair texto do arquivo original no disco"
                      >
                        <RefreshCw size={10} className={reloadingSourceId === src.id ? 'spin' : ''} />
                        <span>Recarregar</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
