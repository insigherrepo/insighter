import React from 'react';
import { BookOpen, Download, FileCode, FileText, Film, Quote, Sparkles, Tv, Users } from 'lucide-react';
import { useInsighterStore } from '../store/useInsighterStore';
import { BeatActId } from '../types/insighter';

const ACT_METADATA: Record<BeatActId, { badge: string; colorClass: 'amber' | 'sage' | 'terracotta' | 'lavender' }> = {
  hook_0_30s: { badge: '0:00 – 0:30 · GANCHO PARADOXAL', colorClass: 'amber' },
  act_1_setup: { badge: 'ATO I · PREMISSA & MUNDO', colorClass: 'sage' },
  act_2_escalation: { badge: 'ATO II · CONFLITO & SUBTEXTO', colorClass: 'terracotta' },
  midpoint_twist: { badge: 'MEIO · VIRADA DE PERSPECTIVA', colorClass: 'lavender' },
  act_3_climax: { badge: 'ATO III · CLÍMAX & RESOLUÇÃO', colorClass: 'amber' },
};

export const ScriptBeatView: React.FC = () => {
  const { project, updateBeatContent, setActiveCitation, triggerCreativeLens, isSynthesizing } =
    useInsighterStore();

  const exportScriptFile = (ext: 'md' | 'fountain' | 'txt') => {
    let content = '';
    if (ext === 'fountain') {
      content =
        `Title: ${project.title}\nCredit: Criado no Insighter\nNotes: ${project.logline}\n\n` +
        project.beats
          .map((b) => `${b.sceneHeading.toUpperCase()}\n\n${b.content}\n`)
          .join('\n===\n\n');
    } else if (ext === 'txt') {
      content =
        `${project.title.toUpperCase()}\n${project.logline ? `${project.logline}\n` : ''}\n` +
        project.beats
          .map((b) => `[${b.title.toUpperCase()}]\n${b.content}\n`)
          .join('\n\n====================\n\n');
    } else {
      content =
        `# ${project.title}\n> **Logline:** ${project.logline}\n\n` +
        project.beats
          .map((b) => `## ${b.title} (${b.durationEstimate})\n\`${b.sceneHeading}\`\n\n${b.content}\n`)
          .join('\n---\n\n');
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title.toLowerCase().replace(/\s+/g, '-')}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFormatBadge = () => {
    if (project.format === 'series_episode') {
      const sName = project.seriesContext?.seriesTitle || 'Série';
      const sNum = project.seriesContext?.seasonNumber || 1;
      const eNum = project.seriesContext?.episodeNumber || 1;
      return (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            color: 'var(--accent-amber)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Tv size={14} /> EPISÓDIO DE SÉRIE: {sName.toUpperCase()} (T{sNum}:E{eNum})
        </span>
      );
    }
    if (project.format === 'book') {
      const chInfo = project.bookContext?.byChapters
        ? ` · CAPÍTULO ${project.bookContext.chapterNumber || 1}${project.bookContext.chapterTitle ? `: ${project.bookContext.chapterTitle.toUpperCase()}` : ''}`
        : '';
      return (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            color: 'var(--accent-sage)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BookOpen size={14} /> MANUSCRITO DE LIVRO{chInfo}
        </span>
      );
    }
    if (project.format === 'article') {
      return (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            color: 'var(--accent-terracotta)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FileText size={14} /> ESTRUTURA DE ARTIGO & ENSAIO
        </span>
      );
    }
    if (project.format === 'free_brainstorm') {
      const isSolo = project.freeBrainstormContext?.subtype === 'solo_study';
      return (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            color: 'var(--accent-amber)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Sparkles size={14} /> {isSolo ? 'ESTUDO INDIVIDUAL & FICHAMENTO' : 'BRAINSTORM LIVRE & EXPLORAÇÃO'}
        </span>
      );
    }
    if (project.format === 'study_group_meeting') {
      const isMeeting = project.meetingGroupContext?.meetingType === 'team_meeting';
      return (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            color: 'var(--accent-sage)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Users size={14} /> {isMeeting ? 'REUNIÃO DE EQUIPE (MÍN. 2 PARTICIPANTES)' : 'GRUPO DE ESTUDO (MÍN. 2 PARTICIPANTES)'}
        </span>
      );
    }
    return (
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.74rem',
          color: 'var(--accent-amber)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Film size={14} /> ESCALETA ESTRUTURADA & ROTEIRO (BEAT SHEET)
      </span>
    );
  };

  return (
    <div className="beatsheet-container">
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          paddingBottom: 14,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ maxWidth: 680 }}>
          {getFormatBadge()}
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', fontWeight: 500, marginTop: 4 }}>
            {project.title}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>{project.logline}</p>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-studio terracotta"
            disabled={isSynthesizing}
            onClick={() =>
              triggerCreativeLens(
                'devils_advocate',
                'Assuma a postura mais implacável, crítica e amoral do Advogado do Diabo: aponte furos de roteiro, incoerências de lore, conveniências lógicas e covardias narrativas nesta escaleta. Exponha a verdade crua das consequências sem nenhum elogio e formule a dúvida inibitória que o autor é obrigado a responder antes de escrever.'
              )
            }
          >
            <Sparkles size={14} /> Confronto com Advogado do Diabo (Furos & Lógica)
          </button>

          {project.format === 'article' ? (
            <>
              <button type="button" className="btn-studio" onClick={() => exportScriptFile('txt')}>
                <FileText size={14} /> Exportar .TXT
              </button>
              <button type="button" className="btn-studio amber" onClick={() => exportScriptFile('md')}>
                <Download size={14} /> Exportar Artigo .MD
              </button>
            </>
          ) : project.format === 'book' ? (
            <>
              <button type="button" className="btn-studio" onClick={() => exportScriptFile('fountain')}>
                <BookOpen size={14} /> Exportar Manuscrito
              </button>
              <button type="button" className="btn-studio amber" onClick={() => exportScriptFile('md')}>
                <Download size={14} /> Exportar Livro .MD
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-studio" onClick={() => exportScriptFile('md')}>
                <Download size={14} /> Exportar .MD
              </button>
              <button type="button" className="btn-studio amber" onClick={() => exportScriptFile('fountain')}>
                <FileCode size={14} /> Exportar Roteiro .Fountain
              </button>
            </>
          )}
        </div>
      </div>

      <div className="beats-grid">
        {project.beats.map((beat) => {
          const meta = ACT_METADATA[beat.act] || ACT_METADATA.act_1_setup;
          const linkedCards = project.cards.filter(
            (c) => beat.linkedCardIds.includes(c.id) || c.beatAct === beat.act
          );

          return (
            <section key={beat.id} className="beat-column">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className={`lens-badge ${meta.colorClass}`}>{meta.badge}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                  ⏱ {beat.durationEstimate}
                </span>
              </div>

              <input
                type="text"
                value={beat.title}
                onChange={(e) => updateBeatContent(beat.id, { title: e.target.value })}
                className="provocation-input"
                style={{ fontFamily: 'var(--font-serif)', fontSize: '1.04rem', fontWeight: 500 }}
              />

              <input
                type="text"
                value={beat.sceneHeading}
                onChange={(e) => updateBeatContent(beat.id, { sceneHeading: e.target.value })}
                className="provocation-input"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.74rem',
                  color: 'var(--accent-sage)',
                  padding: '6px 9px',
                }}
              />

              <textarea
                value={beat.content}
                onChange={(e) => updateBeatContent(beat.id, { content: e.target.value })}
                className="beat-textarea"
                placeholder="Escreva a ação visual, narração ou diálogo desta cena..."
              />

              {/* Cards do Canvas ancorados neste bloco da Escaleta */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  INSIGHTS DO CANVAS VINCULADOS ({linkedCards.length})
                </span>
                {linkedCards.map((card) => (
                  <div
                    key={card.id}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-canvas)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{card.title}</div>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 3, fontSize: '0.74rem' }}>
                      {card.body.slice(0, 120)}...
                    </p>
                    {card.citations[0] && (
                      <button
                        type="button"
                        className="citation-pill"
                        style={{ marginTop: 6 }}
                        onClick={() => setActiveCitation(card.citations[0])}
                      >
                        <Quote size={10} /> Ver Citação Original
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
