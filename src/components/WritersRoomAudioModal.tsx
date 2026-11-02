import React, { useEffect, useRef, useState } from 'react';
import { Headphones, Loader2, Mic, Pause, Play, PlusCircle, Volume2, X } from 'lucide-react';
import { useInsighterStore } from '../store/useInsighterStore';
import { DebateTurn } from '../types/insighter';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const WritersRoomAudioModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const { project, runAudioDebate, isSynthesizing, addManualCard } = useInsighterStore();

  const [focusDirective, setFocusDirective] = useState(
    'Atacar furos de lógica no primeiro ato, eliminar infodumping e debater como transformar as fontes em tensão visual.'
  );
  const [activeTurnIdx, setActiveTurnIdx] = useState<number | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const latestDebate = project.debates[0] || null;

  // Sincroniza abertura com showModal() e fallback de light-dismiss para Safari (modern-web-guidance)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    // Fallback para navegadores sem suporte a <dialog closedby="any">
    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isDialogContent =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!isDialogContent) {
        dialog.close();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const handleGenerateDebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusDirective.trim() || isSynthesizing) return;
    await runAudioDebate(focusDirective);
  };

  const speakDebateTurns = (turns: DebateTurn[]) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeaking) {
      setIsSpeaking(false);
      setActiveTurnIdx(null);
      return;
    }

    setIsSpeaking(true);
    turns.forEach((turn, idx) => {
      const utter = new SpeechSynthesisUtterance(turn.text);
      utter.lang = 'pt-BR';
      utter.pitch = turn.role === 'critic' ? 0.88 : 1.08;
      utter.rate = 1.04;
      utter.onstart = () => setActiveTurnIdx(idx);
      utter.onend = () => {
        if (idx === turns.length - 1) {
          setIsSpeaking(false);
          setActiveTurnIdx(null);
        }
      };
      window.speechSynthesis.speak(utter);
    });
  };

  const sendTurnToCanvas = (turn: DebateTurn) => {
    addManualCard(
      `[${turn.speaker}] Insight de Sala de Roteiristas`,
      `${turn.text}\n\nAção Recomendada: ${turn.actionableTakeaway}`
    );
  };

  return (
    <dialog
      ref={dialogRef}
      className="studio-dialog"
      aria-labelledby="writersRoomTitle"
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
    >
      <div className="dialog-inner">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-mark">
              <Headphones size={17} />
            </div>
            <div>
              <h2 id="writersRoomTitle" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.22rem', fontWeight: 500 }}>
                Sala de Roteiristas em Áudio (Audio Overview Customizado)
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Meta-Prompt de Consultores a Portas Fechadas: Sofia (Arquiteta Narrativa) vs. Marco (Script Doctor Cético)
              </p>
            </div>
          </div>

          <button type="button" className="btn-studio" onClick={() => dialogRef.current?.close()}>
            <X size={14} /> Fechar
          </button>
        </div>

        <form
          onSubmit={handleGenerateDebate}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-canvas)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <label style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)' }}>
            DIREÇÃO PERSONALIZADA PARA OS CONSULTORES DE IA (META-PROMPT)
          </label>
          <textarea
            value={focusDirective}
            onChange={(e) => setFocusDirective(e.target.value)}
            className="beat-textarea"
            style={{ minHeight: 74, fontSize: '0.84rem' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Usa apenas as fontes marcadas como ativas no Context Mixer.
            </span>
            <button type="submit" className="btn-studio amber" disabled={isSynthesizing}>
              {isSynthesizing ? (
                <>
                  <Loader2 size={14} /> Gerando Debate...
                </>
              ) : (
                <>
                  <Mic size={14} /> Gerar Debate a Portas Fechadas
                </>
              )}
            </button>
          </div>
        </form>

        {latestDebate && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {latestDebate.title}
              </span>
              <button
                type="button"
                className="btn-studio sage"
                onClick={() => speakDebateTurns(latestDebate.turns)}
              >
                {isSpeaking ? <Pause size={14} /> : <Play size={14} />}
                {isSpeaking ? 'Pausar Vozes' : 'Ouvir Debate Multi-Voz'}
              </button>
            </div>

            {latestDebate.turns.map((turn, idx) => {
              const isCritic = turn.role === 'critic';
              const isCurrent = activeTurnIdx === idx;
              return (
                <div
                  key={turn.id}
                  style={{
                    padding: 13,
                    borderRadius: 'var(--radius-md)',
                    background: isCurrent ? 'var(--tint-amber)' : 'var(--bg-canvas)',
                    border: `1px solid ${isCritic ? 'color-mix(in oklab, var(--accent-terracotta) 45%, var(--border-subtle))' : 'color-mix(in oklab, var(--accent-sage) 45%, var(--border-subtle))'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className={`lens-badge ${isCritic ? 'terracotta' : 'sage'}`}>
                      <Volume2 size={12} /> {turn.speaker}
                    </span>
                    <button
                      type="button"
                      className="btn-studio"
                      style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                      onClick={() => sendTurnToCanvas(turn)}
                    >
                      <PlusCircle size={12} /> Enviar para o Canvas
                    </button>
                  </div>

                  <p style={{ fontFamily: 'var(--font-serif)', fontSize: '0.94rem', lineHeight: 1.6 }}>
                    “{turn.text}”
                  </p>

                  <div style={{ fontSize: '0.77rem', color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
                    → Ação Prática: {turn.actionableTakeaway}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </dialog>
  );
};
