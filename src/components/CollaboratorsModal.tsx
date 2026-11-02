import React, { useEffect, useId, useRef, useState } from 'react';
import { Check, Copy, Crown, Loader2, Trash2, UserPlus, Users, X } from 'lucide-react';
import { MemberRole } from '../types/insighter';
import { useInsighterStore } from '../store/useInsighterStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export const CollaboratorsModal: React.FC<Props> = ({ isOpen, onClose, currentUserEmail }) => {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const emailInputId = useId();
  const roleSelectId = useId();

  const {
    project,
    inviteMember,
    removeMember,
    isLivePresenter,
    startLiveMeeting,
    stopLiveMeeting,
  } = useInsighterStore();

  const [emailInput, setEmailInput] = useState('');
  const [selectedRole, setSelectedRole] = useState<MemberRole>('editor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

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
      setFeedbackMsg(null);
      setEmailInput('');
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    const handleBackdropClick = (event: MouseEvent) => {
      if ('closedBy' in HTMLDialogElement.prototype) return;
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const isInside =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.width + rect.left;
      if (!isInside) {
        dialog.close();
      }
    };

    dialog.addEventListener('click', handleBackdropClick);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('click', handleBackdropClick);
    };
  }, [onClose]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setFeedbackMsg(null);

    const normalized = emailInput.trim().toLowerCase();
    if (project.members?.some((m) => m.invitedEmail.toLowerCase() === normalized)) {
      setFeedbackMsg({ text: 'Este e-mail já foi convidado para o projeto.', type: 'error' });
      setIsSubmitting(false);
      return;
    }

    try {
      const ok = await inviteMember(normalized, selectedRole);
      if (ok) {
        setFeedbackMsg({
          text: `Convite enviado com sucesso para ${normalized} como ${selectedRole === 'editor' ? 'Editor' : 'Leitor'}.`,
          type: 'success',
        });
        setEmailInput('');
      } else {
        setFeedbackMsg({ text: 'Não foi possível registrar o convite.', type: 'error' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (email: string) => {
    await removeMember(email);
    setFeedbackMsg({ text: `Acesso de ${email} revogado.`, type: 'success' });
  };

  const handleCopyLink = () => {
    const link = typeof window !== 'undefined' ? `${window.location.origin}/?project=${project.id}` : '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2400);
    }
  };

  const membersList = project.members || [];
  const ownerDisplay = project.ownerEmail || currentUserEmail || 'Você (Criador)';

  return (
    <dialog ref={dialogRef} className="insighter-modal" aria-labelledby="modal-collab-title">
      <div
        style={{
          width: 'min(580px, 94vw)',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          color: 'var(--text-primary)',
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--tint-amber)',
                color: 'var(--accent-amber)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h3 id="modal-collab-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', fontWeight: 500 }}>
                Colaboradores do Brainstorm
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                Trabalhe em equipe: convide co-roteiristas ou revisores para este projeto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="btn-studio"
            style={{ padding: '4px 8px', borderRadius: '50%' }}
            aria-label="Fechar modal de colaboradores"
          >
            <X size={16} />
          </button>
        </div>

        {/* Feedback visual */}
        {feedbackMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: feedbackMsg.type === 'success' ? 'var(--tint-sage)' : 'var(--tint-terracotta)',
              color: 'var(--text-primary)',
              border: `1px solid ${feedbackMsg.type === 'success' ? 'var(--accent-sage)' : 'var(--accent-terracotta)'}`,
            }}
          >
            {feedbackMsg.type === 'success' ? <Check size={14} style={{ color: 'var(--accent-sage)' }} /> : null}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Formulário de Convite */}
        <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 220 }}>
              <label htmlFor={emailInputId} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                E-mail do Colaborador:
              </label>
              <input
                id={emailInputId}
                type="email"
                required
                placeholder="ex: coroteirista@estudio.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="provocation-input"
                style={{ width: '100%', fontSize: '0.84rem' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 150 }}>
              <label htmlFor={roleSelectId} style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Permissão:
              </label>
              <select
                id={roleSelectId}
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as MemberRole)}
                className="format-selector"
                style={{ width: '100%', fontSize: '0.82rem', height: 38 }}
              >
                <option value="editor">✍️ Co-autor (Editor)</option>
                <option value="viewer">👀 Leitor (Revisor)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <button
              type="button"
              className="btn-studio"
              onClick={handleCopyLink}
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              {copiedLink ? <Check size={13} style={{ color: 'var(--accent-sage)' }} /> : <Copy size={13} />}
              {copiedLink ? 'Link copiado!' : 'Copiar Link de Compartilhamento'}
            </button>

            <button
              type="submit"
              className="btn-studio amber"
              disabled={isSubmitting || !emailInput.trim()}
              style={{ fontSize: '0.82rem', padding: '7px 16px' }}
            >
              {isSubmitting ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
              Enviar Convite
            </button>
          </div>
        </form>

        {/* Lista de Membros Atuais */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <h4 style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 10 }}>
            MEMBROS COM ACESSO ({membersList.length + 1})
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
            {/* Dono / Proprietário */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 12px',
                background: 'var(--bg-canvas)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Crown size={14} style={{ color: 'var(--accent-amber)' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>{ownerDisplay}</span>
              </div>
              <span className="lens-badge amber" style={{ fontSize: '0.72rem' }}>
                👑 Proprietário
              </span>
            </div>

            {/* Colaboradores Convidados */}
            {membersList.map((member) => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  background: 'var(--bg-canvas)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 500 }}>{member.invitedEmail}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Convidado em {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`lens-badge ${member.role === 'editor' ? 'sage' : 'lavender'}`} style={{ fontSize: '0.72rem' }}>
                    {member.role === 'editor' ? '✍️ Editor' : '👀 Leitor'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemove(member.invitedEmail)}
                    className="btn-studio"
                    title="Remover colaborador"
                    style={{ padding: '4px 6px', color: 'var(--accent-terracotta)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reunião Ao Vivo / Espelhamento de Tela em Tempo Real */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: isLivePresenter
              ? 'color-mix(in oklab, #ef4444 8%, var(--bg-canvas))'
              : 'var(--bg-canvas)',
            padding: '12px 14px',
            borderRadius: 'var(--radius-sm)',
            border: `1px solid ${isLivePresenter ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)'}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {isLivePresenter ? <span className="live-dot" /> : <Users size={14} style={{ color: 'var(--accent-amber)' }} />}
              {isLivePresenter ? 'Transmissão de Reunião Ao Vivo Ativa' : 'Espelhamento de Tela na Reunião'}
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {isLivePresenter
                ? 'Tudo o que você fizer no brainstorm (zoom, movimentação de cards e ultrafoco) está sendo espelhado na tela dos colaboradores.'
                : 'Inicie uma reunião ao vivo para que tudo que você fizer na sua tela seja replicado na tela dos outros colaboradores.'}
            </span>
          </div>

          <button
            type="button"
            className={`btn-studio ${isLivePresenter ? 'red-live' : 'amber'}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onClick={() => {
              if (isLivePresenter) {
                stopLiveMeeting();
              } else {
                startLiveMeeting(currentUserEmail || ownerDisplay || 'Apresentador');
              }
            }}
          >
            {isLivePresenter ? 'Encerrar Reunião' : 'Iniciar Reunião Ao Vivo'}
          </button>
        </div>

        {/* Rodapé informativo */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-studio"
            onClick={() => dialogRef.current?.close()}
            style={{ fontSize: '0.82rem', padding: '6px 14px' }}
          >
            Concluir
          </button>
        </div>
      </div>
    </dialog>
  );
};
