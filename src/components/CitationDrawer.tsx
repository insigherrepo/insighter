import React, { useState } from 'react';
import { AlertCircle, BookOpenCheck, CheckCircle2, Quote, RefreshCw, X } from 'lucide-react';
import { useInsighterStore } from '../store/useInsighterStore';

export const CitationDrawer: React.FC = () => {
  const { activeCitation, setActiveCitation, project, updateSourceContent } = useInsighterStore();
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  if (!activeCitation) return null;

  const sourceDoc = project.sources.find((s) => s.id === activeCitation.sourceId);

  const isPlaceholderQuote =
    activeCitation.quote.startsWith('[Documento PDF carregado:') ||
    activeCitation.quote.startsWith('[Fonte referenciada pelo caminho:') ||
    activeCitation.quote.includes('— Caminho:');

  const hasRealSourceText =
    sourceDoc &&
    sourceDoc.content.length > 250 &&
    !sourceDoc.content.startsWith('[Documento PDF carregado:') &&
    !sourceDoc.content.startsWith('[Fonte referenciada pelo caminho:');

  const handleExtractNow = async () => {
    if (!sourceDoc?.filePath) return;
    const loadFn = typeof window !== 'undefined' ? window.insighterDesktop?.loadSourceFromPath : undefined;
    if (!loadFn) {
      setExtractMsg('Extração disponível no aplicativo desktop.');
      return;
    }
    setIsExtracting(true);
    setExtractMsg(null);
    try {
      const res = await loadFn(sourceDoc.filePath);
      if (res.ok && res.sources && res.sources.length > 0) {
        const loaded = res.sources[0];
        updateSourceContent(sourceDoc.id, loaded.content);
        setExtractMsg(
          `Texto do livro extraído com sucesso (${loaded.content.length.toLocaleString('pt-BR')} caracteres)!`
        );
      } else {
        setExtractMsg(res.error || 'Erro ao extrair texto do PDF.');
      }
    } catch (err: any) {
      setExtractMsg(err?.message || 'Erro ao extrair.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <aside className="citation-drawer" aria-label="Auditoria de Citação Original">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.76rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--accent-sage)',
          }}
        >
          <BookOpenCheck size={15} /> AUDITORIA DE CITAÇÃO ORIGINAL
        </span>
        <button
          type="button"
          className="btn-studio"
          style={{ padding: '4px 8px' }}
          onClick={() => setActiveCitation(null)}
        >
          <X size={14} /> Fechar
        </button>
      </div>

      <div>
        <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>FONTE PRIMÁRIA AUDITADA</span>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.08rem', marginTop: 4, color: 'var(--text-primary)' }}>
          {activeCitation.sourceTitle}
        </h3>
      </div>

      <div>
        <span
          style={{
            fontSize: '0.73rem',
            color: 'var(--accent-amber)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 6,
          }}
        >
          <Quote size={13} /> TRECHO EXATO CITADO PELO INSIGHT
        </span>
        <blockquote className="highlighted-passage">“{activeCitation.quote}”</blockquote>

        {isPlaceholderQuote && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--tint-amber)',
              border: '1px solid var(--accent-amber)',
              fontSize: '0.78rem',
              color: 'var(--text-primary)',
              lineHeight: 1.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--accent-amber)' }}>
              <AlertCircle size={14} />
              <span>Citação gerada antes da extração do PDF</span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              {hasRealSourceText ? (
                <>
                  Este insight foi gerado anteriormente quando o PDF estava registrado apenas pelo caminho. O texto completo do livro agora já está <strong>100% extraído ({sourceDoc?.content.length.toLocaleString('pt-BR')} caracteres)</strong>! Abaixo você já pode consultar os capítulos e parágrafos reais do livro. Ao provocar o Gemini ou cruzar os cards novamente, os novos insights trarão as citações literais dos trechos do livro.
                </>
              ) : (
                <>
                  O texto deste documento ainda não havia sido extraído da camada PDF. Clique no botão abaixo para extrair agora mesmo todo o conteúdo do livro diretamente do arquivo original:
                </>
              )}
            </p>
            {!hasRealSourceText && sourceDoc?.filePath && (
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn-studio amber"
                  disabled={isExtracting}
                  onClick={handleExtractNow}
                  style={{ padding: '5px 10px', fontSize: '0.74rem' }}
                >
                  <RefreshCw size={12} className={isExtracting ? 'spin' : ''} />
                  {isExtracting ? 'Extraindo texto do PDF...' : 'Extrair Texto do Livro Agora'}
                </button>
              </div>
            )}
            {extractMsg && (
              <span style={{ display: 'block', marginTop: 6, fontSize: '0.72rem', color: 'var(--accent-sage)' }}>
                {extractMsg}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          padding: 12,
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-canvas)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span
          style={{
            fontSize: '0.73rem',
            color: 'var(--accent-sage)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={13} /> POR QUE ESSE DETALHE IMPORTA NO ROTEIRO
        </span>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
          {activeCitation.whyItMatters}
        </p>
      </div>

      {sourceDoc && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              {isPlaceholderQuote && hasRealSourceText
                ? 'CONTEÚDO EXTRAÍDO DO LIVRO / FONTE ORIGINAL'
                : 'PARÁGRAFO COMPLETO NA FONTE ORIGINAL (PARA PESCAR NUANCES EXTRAS)'}
            </span>
            {hasRealSourceText && (
              <span style={{ fontSize: '0.69rem', color: 'var(--accent-sage)', fontWeight: 500 }}>
                {sourceDoc.content.length.toLocaleString('pt-BR')} caracteres disponíveis
              </span>
            )}
          </div>
          <div
            style={{
              padding: 13,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.84rem',
              lineHeight: 1.65,
              color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              maxHeight: 380,
              overflowY: 'auto',
            }}
          >
            {sourceDoc.content}
          </div>
        </div>
      )}
    </aside>
  );
};
