import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  AuthUserProfile,
  signInWithEmail,
  signUpWithEmail,
} from '../lib/supabase';

interface Props {
  onAuthenticated: (user: AuthUserProfile) => void;
  onContinueLocalGuest: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onAuthenticated, onContinueLocalGuest }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSignInSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setIsSubmitting(true);

    try {
      const { user, error } = await signInWithEmail(email.trim(), password);
      if (error || !user) {
        setErrorMsg(error || 'Não foi possível autenticar com essas credenciais.');
      } else {
        onAuthenticated(user);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setIsSubmitting(true);

    try {
      const { user, needsEmailConfirmation, error } = await signUpWithEmail(
        email.trim(),
        password,
        fullName
      );
      if (error) {
        setErrorMsg(error);
      } else if (needsEmailConfirmation) {
        setInfoMsg(
          'Conta criada! Verifique a caixa de entrada do seu e-mail para confirmar o acesso (ou desative "Confirm email" em Authentication -> Providers -> Email no painel do Supabase para login imediato).'
        );
        setMode('signin');
      } else if (user) {
        onAuthenticated(user);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="studio-shell auth-shell">
      <div className="auth-card">
        {/* Cabeçalho Editorial do Estúdio */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand-mark" style={{ width: 40, height: 40 }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.55rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
              }}
            >
              Insighter Studio
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Brainstorming Espacial & Sala de Roteiristas com Gemini + Supabase
            </p>
          </div>
        </div>

        {/* Seletor entre Entrar e Criar Conta */}
        <div className="mode-switcher" style={{ width: '100%', justifyContent: 'center' }}>
          <button
            type="button"
            className={`mode-btn ${mode === 'signin' ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
          >
            <Lock size={13} /> Entrar na Conta
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === 'signup' ? 'active' : ''}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
              setInfoMsg(null);
            }}
          >
            <UserPlus size={13} /> Criar Nova Conta
          </button>
        </div>

        {/* Mensagens de Estado Acessíveis (aria-live + Ícone + Texto) */}
        <div aria-live="polite">
          {errorMsg && (
            <div className="auth-feedback error" role="alert">
              <AlertCircle size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}
          {infoMsg && (
            <div className="auth-feedback success">
              <CheckCircle2 size={16} aria-hidden="true" style={{ flexShrink: 0 }} />
              <span>{infoMsg}</span>
            </div>
          )}
        </div>

        {mode === 'signin' ? (
          <form method="post" action="/signin" onSubmit={handleSignInSubmit} className="auth-form">
            <div className="auth-field-group">
              <label htmlFor="email" className="auth-label">
                E-mail da conta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                enterKeyHint="next"
                required
                value={email}
                onInput={() => setErrorMsg(null)}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="roteirista@estudio.com"
              />
            </div>

            <div className="auth-field-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor="current-password" className="auth-label">
                  Senha
                </label>
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-describedby="toggle-warning-signin"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                </button>
                <span id="toggle-warning-signin" className="visually-hidden">
                  Aviso: isso exibirá sua senha na tela.
                </span>
              </div>
              <input
                id="current-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                enterKeyHint="done"
                required
                value={password}
                onInput={() => setErrorMsg(null)}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
              />
            </div>

            <button type="submit" className="btn-studio amber auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} /> Autenticando no Supabase...
                </>
              ) : (
                'Entrar no Estúdio'
              )}
            </button>
          </form>
        ) : (
          <form method="post" action="/signup" onSubmit={handleSignUpSubmit} className="auth-form">
            <div className="auth-field-group">
              <label htmlFor="name" className="auth-label">
                Nome completo ou artístico
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                required
                value={fullName}
                onInput={() => setErrorMsg(null)}
                onChange={(e) => setFullName(e.target.value)}
                className="auth-input"
                placeholder="Ex: Helena Costa"
              />
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-email" className="auth-label">
                E-mail
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                enterKeyHint="next"
                required
                value={email}
                onInput={() => setErrorMsg(null)}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="roteirista@estudio.com"
              />
            </div>

            <div className="auth-field-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label htmlFor="new-password" className="auth-label">
                  Criar senha
                </label>
                <button
                  type="button"
                  className="password-toggle-btn"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  aria-describedby="toggle-warning-signup"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
                </button>
                <span id="toggle-warning-signup" className="visually-hidden">
                  Aviso: isso exibirá sua senha na tela.
                </span>
              </div>
              <input
                id="new-password"
                name="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                minLength={8}
                aria-describedby="password-constraints"
                enterKeyHint="done"
                required
                value={password}
                onInput={() => setErrorMsg(null)}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
              />
              <span id="password-constraints" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Mínimo de 8 caracteres.
              </span>
            </div>

            <button type="submit" className="btn-studio sage auth-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} /> Criando conta no Supabase...
                </>
              ) : (
                'Criar Conta no Insighter'
              )}
            </button>
          </form>
        )}

        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Deseja explorar o estúdio antes de logar?
          </span>
          <button type="button" className="btn-studio" onClick={onContinueLocalGuest}>
            Continuar em Modo Local
          </button>
        </div>
      </div>
    </div>
  );
};
