import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CloudUpload,
  Columns,
  EyeOff,
  Headphones,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  LogOut,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { useInsighterStore } from './store/useInsighterStore';
import { SourceMixerSidebar } from './components/SourceMixerSidebar';
import { InfiniteCanvas } from './components/InfiniteCanvas';
import { CreativeLensDock } from './components/CreativeLensDock';
import { ScriptBeatView } from './components/ScriptBeatView';
import { CitationDrawer } from './components/CitationDrawer';
import { WritersRoomAudioModal } from './components/WritersRoomAudioModal';
import { CollaboratorsModal } from './components/CollaboratorsModal';
import { AuthScreen } from './components/AuthScreen';
import { StudioDashboard } from './components/StudioDashboard';
import {
  AuthUserProfile,
  getSupabaseClient,
  mapSupabaseUser,
  signOutFromSupabase,
} from './lib/supabase';

declare global {
  interface Window {
    insighterDesktop?: {
      isDesktopApp: boolean;
      platform: string;
      toggleNativeFullscreen: () => Promise<boolean>;
      hideToMenuBar?: () => Promise<boolean>;
      getConnectedDisplays?: () => Promise<Array<{
        id: number;
        label: string;
        isPrimary: boolean;
        isCurrent: boolean;
        bounds: { x: number; y: number; width: number; height: number };
        workArea: { x: number; y: number; width: number; height: number };
      }>>;
      moveToDisplay?: (displayId: number) => Promise<boolean>;
      loadSourceFromPath?: (rawPath: string) => Promise<{
        ok: boolean;
        error?: string;
        sources?: Array<{
          title: string;
          type: string;
          authorOrOrigin: string;
          content: string;
          filePath?: string;
          mimeType?: string;
          mediaDataUrl?: string;
        }>;
      }>;
      extractPdfText?: (rawPath: string) => Promise<{
        ok: boolean;
        error?: string;
        text?: string;
        length?: number;
      }>;
      getPathForFile?: (file: File) => string;
      onZoomIn?: (callback: () => void) => () => void;
      onZoomOut?: (callback: () => void) => () => void;
      onZoomReset?: (callback: () => void) => () => void;
      onZoomFit?: (callback: () => void) => () => void;
      checkForUpdates?: (manual?: boolean) => Promise<{
        status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';
        currentVersion: string;
        latestVersion: string | null;
        releaseNotes: string;
        downloadUrl: string | null;
        htmlUrl: string | null;
        progress: number;
        error: string | null;
        repo: string;
      }>;
      installUpdate?: () => Promise<{ ok: boolean; error?: string }>;
      getUpdateState?: () => Promise<{
        status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';
        currentVersion: string;
        latestVersion: string | null;
        releaseNotes: string;
        downloadUrl: string | null;
        htmlUrl: string | null;
        progress: number;
        error: string | null;
        repo: string;
      }>;
      onUpdateStatus?: (
        callback: (state: {
          status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';
          currentVersion: string;
          latestVersion: string | null;
          releaseNotes: string;
          downloadUrl: string | null;
          htmlUrl: string | null;
          progress: number;
          error: string | null;
          repo: string;
        }) => void
      ) => () => void;
    };
  }
}

export const App: React.FC = () => {
  const {
    project,
    viewMode,
    zenFullscreen,
    sidebarCollapsed,
    errorBanner,
    setViewMode,
    toggleZenFullscreen,
    toggleSidebar,
    updateProjectMeta,
    addManualCard,
    triggerCloudSync,
    clearError,
  } = useInsighterStore();

  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUserProfile | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showDashboard, setShowDashboard] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<{
    status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error';
    currentVersion: string;
    latestVersion: string | null;
    progress: number;
    error: string | null;
  } | null>(null);

  const isDesktopMac =
    typeof window !== 'undefined' &&
    Boolean(window.insighterDesktop?.isDesktopApp) &&
    window.insighterDesktop?.platform === 'darwin';

  useEffect(() => {
    const desktop = window.insighterDesktop;
    if (!desktop?.isDesktopApp) return;

    desktop.getUpdateState?.().then((state) => {
      if (state) setUpdateInfo(state);
    });

    const unsub = desktop.onUpdateStatus?.((state) => {
      setUpdateInfo(state);
    });

    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setCheckingSession(false);
      return;
    }

    client.auth.getSession().then(({ data }) => {
      const mapped = mapSupabaseUser(data.session?.user ?? null);
      setAuthUser(mapped);
      setCheckingSession(false);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUser(mapSupabaseUser(session?.user ?? null));
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOutFromSupabase();
    setAuthUser(null);
    setGuestMode(false);
    setShowDashboard(true);
  };

  if (!checkingSession && !authUser && !guestMode) {
    return (
      <AuthScreen
        onAuthenticated={(user) => {
          setAuthUser(user);
          setShowDashboard(true);
        }}
        onContinueLocalGuest={() => {
          setGuestMode(true);
          setShowDashboard(true);
        }}
      />
    );
  }

  if (showDashboard) {
    return (
      <StudioDashboard
        authUser={authUser}
        onEnterStudio={() => setShowDashboard(false)}
        onLogout={handleLogout}
        onOpenLogin={() => setGuestMode(false)}
      />
    );
  }

  return (
    <div className="studio-shell">
      {/* Barra Superior do Estúdio (com suporte a botões nativos macOS no Desktop) */}
      <header className={`topbar ${isDesktopMac ? 'desktop-mac' : ''}`}>
        <div className="brand-cluster">
          <button
            type="button"
            className="btn-studio"
            onClick={async () => {
              await triggerCloudSync();
              setShowDashboard(true);
            }}
            title="Salvar e voltar ao Dashboard Inicial (Criar ou Carregar os 10 primeiros do servidor)"
          >
            <LayoutDashboard size={14} /> Dashboard
          </button>

          <button
            type="button"
            className="btn-studio"
            style={{ padding: '6px 8px' }}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Mostrar Curadoria de Fontes' : 'Recolher Curadoria de Fontes'}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>

          <div className="brand-mark" title="Insighter — Estúdio de Síntese Cruzada">
            <Sparkles size={16} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="text"
              className="project-title-input"
              value={project.title}
              onChange={(e) => updateProjectMeta(e.target.value)}
              aria-label="Título do Projeto de Roteiro"
            />
            {(project.isDemo || project.id === 'proj-cronos-noir' || project.id.startsWith('proj-demo')) && (
              <span
                className="lens-badge amber"
                style={{ fontSize: '0.7rem', padding: '3px 9px', whiteSpace: 'nowrap' }}
                title="Este exemplo guiado é uma versão demo de um brainstorm real"
              >
                🧪 Versão Demo de um Brainstorm Real
              </span>
            )}
          </div>
        </div>

        {/* Alternador do Modo Híbrido: Canvas Espacial Livre <-> Visão de Escaleta/Roteiro */}
        <nav className="mode-switcher" aria-label="Modo de Visualização">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'canvas' ? 'active' : ''}`}
            onClick={() => setViewMode('canvas')}
          >
            <LayoutGrid size={14} /> Canvas Espacial Livre ({project.cards.length})
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'beatsheet' ? 'active' : ''}`}
            onClick={() => setViewMode('beatsheet')}
          >
            <Columns size={14} /> Escaleta & Roteiro ({project.beats.length})
          </button>
        </nav>

        {/* Ações de Estúdio: Novo Insight, Salvar no Servidor, Sala de Roteiristas, Conta e Tela Cheia */}
        <div className="topbar-actions">
          <button
            type="button"
            className="btn-studio amber"
            onClick={() => {
              setViewMode('canvas');
              addManualCard('Novo Insight', '');
            }}
            title="Criar um novo Card de Insight no Canvas"
          >
            <Plus size={14} /> Novo Insight
          </button>

          <button
            type="button"
            className="btn-studio"
            onClick={() => triggerCloudSync()}
            title="Salvar brainstorm atual no servidor Supabase"
          >
            <CloudUpload size={14} /> Salvar
          </button>

          <button
            type="button"
            className="btn-studio"
            onClick={() => setCollabModalOpen(true)}
            title="Convidar e gerenciar colaboradores deste brainstorm"
          >
            <Users size={14} style={{ color: 'var(--accent-amber)' }} />
            <span>Colaboradores {project.members && project.members.length > 0 ? `(${project.members.length + 1})` : ''}</span>
          </button>

          <button
            type="button"
            className="btn-studio sage"
            onClick={() => setAudioModalOpen(true)}
            title="Abrir Sala de Roteiristas em Áudio (Debate entre 2 Consultores de IA)"
          >
            <Headphones size={14} /> Sala de Roteiristas
          </button>

          {authUser ? (
            <button
              type="button"
              className="btn-studio"
              onClick={handleLogout}
              title={`Conectado como ${authUser.email} — Clique para sair`}
            >
              <UserCheck size={14} style={{ color: 'var(--accent-sage)' }} />
              <span>{authUser.fullName || authUser.email.split('@')[0]}</span>
              <LogOut size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-studio"
              onClick={() => setGuestMode(false)}
              title="Entrar ou criar conta no Supabase Auth"
            >
              <LogIn size={14} /> Login
            </button>
          )}

          {isDesktopMac && updateInfo?.status === 'available' && (
            <button
              type="button"
              className="btn-studio amber"
              onClick={() => window.insighterDesktop?.installUpdate?.()}
              title={`Nova versão v${updateInfo.latestVersion} disponível! Clique para baixar e atualizar em /Applications/Capitolio/Insighter.app`}
            >
              <RefreshCw size={14} /> Atualizar v{updateInfo.latestVersion}
            </button>
          )}

          {isDesktopMac && (updateInfo?.status === 'downloading' || updateInfo?.status === 'installing') && (
            <button
              type="button"
              className="btn-studio amber"
              disabled
              title="Baixando e instalando atualização automática..."
            >
              <RefreshCw size={14} /> {updateInfo.status === 'installing' ? 'Instalando...' : `Atualizando ${updateInfo.progress}%`}
            </button>
          )}

          {isDesktopMac && (
            <button
              type="button"
              className="btn-studio"
              onClick={() => window.insighterDesktop?.hideToMenuBar?.()}
              title="Ocultar aplicativo no ícone branco do Menu Superior e remover do Dock (Cmd+H)"
            >
              <EyeOff size={14} /> Menu Superior
            </button>
          )}

          <button
            type="button"
            className="btn-studio amber"
            onClick={() => {
              if (window.insighterDesktop?.toggleNativeFullscreen) {
                window.insighterDesktop.toggleNativeFullscreen();
              }
              toggleZenFullscreen();
            }}
            title="Alternar Modo Imersivo em Tela Cheia (Zen Mode)"
          >
            {zenFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {zenFullscreen ? 'Sair do Zen' : 'Zen'}
          </button>
        </div>
      </header>

      {/* Alerta não-intrusivo caso ocorra erro */}
      {errorBanner && (
        <div
          role="alert"
          style={{
            padding: '8px 18px',
            background: 'var(--tint-terracotta)',
            borderBottom: '1px solid var(--accent-terracotta)',
            color: 'var(--text-primary)',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} style={{ color: 'var(--accent-terracotta)' }} />
            {errorBanner}
          </span>
          <button type="button" className="btn-studio" style={{ padding: '2px 8px' }} onClick={clearError}>
            OK
          </button>
        </div>
      )}

      {/* Corpo Principal em Tela Cheia */}
      <main className="workspace-body">
        <SourceMixerSidebar />

        {viewMode === 'canvas' ? (
          <>
            <InfiniteCanvas />
            <CreativeLensDock />
          </>
        ) : (
          <ScriptBeatView />
        )}

        <CitationDrawer />
      </main>

      {/* Modais Nativos com Light-Dismiss (<dialog closedby="any">) */}
      <WritersRoomAudioModal isOpen={audioModalOpen} onClose={() => setAudioModalOpen(false)} />
      <CollaboratorsModal
        isOpen={collabModalOpen}
        onClose={() => setCollabModalOpen(false)}
        currentUserEmail={authUser?.email}
      />
    </div>
  );
};
