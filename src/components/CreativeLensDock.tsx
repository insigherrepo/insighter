import React, { useState } from 'react';
import { Flame, Loader2, PlusCircle, Send, Sparkles } from 'lucide-react';
import { CREATIVE_LENSES } from '../services/geminiEngine';
import { useInsighterStore } from '../store/useInsighterStore';
import { CreativeLensId } from '../types/insighter';

export const CreativeLensDock: React.FC = () => {
  const {
    project,
    isSynthesizing,
    activeLensRunning,
    triggerCreativeLens,
    addManualCard,
  } = useInsighterStore();

  const [freePrompt, setFreePrompt] = useState('');
  const [selectedLens, setSelectedLens] = useState<CreativeLensId>('devils_advocate');

  const activeSourcesCount = project.sources.filter((s) => s.isActive).length;

  const handleFreeProvocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freePrompt.trim() || isSynthesizing) return;
    const text = freePrompt;
    setFreePrompt('');
    await triggerCreativeLens(selectedLens, text);
  };

  const handleQuickNote = () => {
    if (!freePrompt.trim()) {
      addManualCard(
        selectedLens === 'devils_advocate' ? '🔥 Objeção Inicial do Roteiro' : 'Ideia Solta de Roteiro',
        'Anote aqui uma premissa, diálogo ou virada para testar contra o lore e as fontes ativas.',
        undefined,
        selectedLens
      );
      return;
    }
    addManualCard(freePrompt.slice(0, 52), freePrompt, undefined, selectedLens);
    setFreePrompt('');
  };

  const isDevilsAdvocate = selectedLens === 'devils_advocate';

  return (
    <section className="creative-dock" aria-label="Lentes Criativas de Síntese Cruzada">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span
          style={{
            fontSize: '0.73rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={13} style={{ color: 'var(--accent-amber)' }} />
          LENTES DE SÍNTESE CRUZADA ({activeSourcesCount} fontes ativas no Context Mixer)
        </span>

        {isSynthesizing && (
          <span
            className="pulse-indicator"
            style={{
              fontSize: '0.74rem',
              color: 'var(--accent-amber)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Loader2 size={13} /> Gemini cruzando fontes e extraindo citações...
          </span>
        )}
      </div>

      {/* Faixa de 1-Click para as 6 Lentes da conversa do Gemini */}
      <div className="lens-strip">
        {CREATIVE_LENSES.map((lens) => {
          const isRunningThis = isSynthesizing && activeLensRunning === lens.id;
          return (
            <button
              key={lens.id}
              type="button"
              className="lens-trigger-btn"
              disabled={isSynthesizing}
              onClick={() => triggerCreativeLens(lens.id)}
              title={`${lens.name}: ${lens.tagline}`}
            >
              <span>{lens.shortLabel}</span>
              {isRunningThis && <Loader2 size={12} />}
            </button>
          );
        })}
      </div>

      {/* Barra de Provocação Livre ou Nota Instantânea com Seletor de Lente Ativa */}
      <form className="provocation-bar" onSubmit={handleFreeProvocation}>
        {/* Seletor de Lente para a Provocação */}
        <select
          value={selectedLens}
          onChange={(e) => setSelectedLens(e.target.value as CreativeLensId)}
          className="btn-studio"
          style={{
            background: isDevilsAdvocate ? 'var(--tint-terracotta)' : 'var(--bg-canvas)',
            color: isDevilsAdvocate ? 'var(--accent-terracotta)' : 'var(--accent-amber)',
            borderColor: isDevilsAdvocate
              ? 'color-mix(in oklab, var(--accent-terracotta) 45%, var(--border-subtle))'
              : 'var(--border-subtle)',
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '7px 10px',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            maxWidth: 190,
          }}
          title="Escolha a lente analítica com a qual o Gemini confrontará sua provocação"
        >
          <option value="devils_advocate">🔥 Advogado do Diabo</option>
          <option value="free_provocation">✨ Exploração Livre</option>
          <option value="hook_engineering">🎣 Gancho 30s</option>
          <option value="data_to_scene">🎬 Dados → Cena</option>
          <option value="conflict_subtext">⚡ Conflito & Subtexto</option>
          <option value="hidden_patterns">🕸️ Conexões Ocultas</option>
          <option value="continuity_lore">🧭 Continuidade & Lore</option>
        </select>

        <input
          type="text"
          className="provocation-input"
          placeholder={
            isDevilsAdvocate
              ? "Escreva sua cena ou premissa para o Advogado do Diabo estraçalhar furos de lógica e lore..."
              : "Provocação livre (ex: 'Onde as fontes A e B se contradizem?' ou 'Crie uma cena visual sem diálogos')..."
          }
          value={freePrompt}
          onChange={(e) => setFreePrompt(e.target.value)}
        />

        <button
          type="button"
          className="btn-studio"
          onClick={handleQuickNote}
          title="Criar card manual no Canvas com este texto"
        >
          <PlusCircle size={14} /> Nota Livre
        </button>

        <button
          type="submit"
          className={`btn-studio ${isDevilsAdvocate ? 'terracotta' : 'amber'}`}
          disabled={isSynthesizing || !freePrompt.trim()}
          title={
            isDevilsAdvocate
              ? "Submeter ao Advogado do Diabo: confronto crítico implacável e amoral sem elogios"
              : "Provocar o Gemini cruzando as fontes ativas com este texto"
          }
          style={
            isDevilsAdvocate
              ? {
                  background: 'var(--tint-terracotta)',
                  color: 'var(--accent-terracotta)',
                  borderColor: 'var(--accent-terracotta)',
                }
              : undefined
          }
        >
          {isDevilsAdvocate ? <Flame size={14} /> : <Send size={14} />}
          {isDevilsAdvocate ? 'Confrontar Premissa' : 'Provocar Gemini'}
        </button>
      </form>
    </section>
  );
};
