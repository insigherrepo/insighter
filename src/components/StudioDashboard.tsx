import React, { useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  CloudDownload,
  ExternalLink,
  EyeOff,
  FilePlus2,
  FileText,
  Film,
  FolderOpen,
  GitBranch,
  Layers,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Tv,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  AuthUserProfile,
  listRecentProjectsFromSupabase,
} from '../lib/supabase';
import { useInsighterStore } from '../store/useInsighterStore';
import {
  BookContext,
  FreeBrainstormContext,
  MeetingGroupContext,
  ProjectData,
  ProjectFormat,
  SeriesContext,
  SeriesPersistentMemory,
} from '../types/insighter';

interface Props {
  authUser: AuthUserProfile | null;
  onEnterStudio: () => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

const FORMAT_LABELS: Record<ProjectFormat, string> = {
  video_essay: '🎬 Video Essay / Ensaio',
  fiction_film: '🎞️ Filme / Ficção',
  documentary: '📽️ Documentário',
  series_bible: '📺 Série / Bíblia de Universo',
  series_episode: '🍿 Episódio de Série',
  article: '✍️ Escrever Artigo',
  book: '📖 Escrever Livro',
  free_brainstorm: '💡 Brainstorm Livre / Estudo',
  study_group_meeting: '👥 Grupo de Estudo ou Reunião',
};

export const StudioDashboard: React.FC<Props> = ({
  authUser,
  onEnterStudio,
  onLogout,
  onOpenLogin,
}) => {
  const {
    project: activeProject,
    startCleanProject,
    loadExistingProject,
    resetToDemoProject,
    trashProject,
    restoreProject,
    deleteProjectPermanently,
  } = useInsighterStore();

  const [savedProjects, setSavedProjects] = useState<ProjectData[]>([]);
  const [serverOrigin, setServerOrigin] = useState<string>('Carregando...');
  const [isLoadingList, setIsLoadingList] = useState(true);

  const [newTitle, setNewTitle] = useState('');
  const [newLogline, setNewLogline] = useState('');
  const [newFormat, setNewFormat] = useState<ProjectFormat>('video_essay');
  const [isCreating, setIsCreating] = useState(false);

  // Estados de Contexto para Episódio de Série
  const [seriesMode, setSeriesMode] = useState<'new' | 'existing'>('new');
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesSeason, setSeriesSeason] = useState(1);
  const [seriesEpisode, setSeriesEpisode] = useState(1);
  const [selectedExistingSeriesId, setSelectedExistingSeriesId] = useState('');
  const [seriesLore, setSeriesLore] = useState('');
  const [inheritCardsAsSource, setInheritCardsAsSource] = useState(true);
  const [inheritSources, setInheritSources] = useState(true);

  // Estados de Contexto para Escrever Livro
  const [bookByChapters, setBookByChapters] = useState(true);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [chapterTitle, setChapterTitle] = useState('');
  const [totalChaptersPlanned, setTotalChaptersPlanned] = useState(10);

  // Estados de Contexto para Escrever Artigo
  const [articleSubtype, setArticleSubtype] = useState('Ensaio / Op-Ed');

  // Estados para Brainstorm Livre / Estudo
  const [freeSubtype, setFreeSubtype] = useState<'free_exploration' | 'solo_study'>('solo_study');
  const [studyTopic, setStudyTopic] = useState('');
  const [studyGoal, setStudyGoal] = useState('');

  // Estados para Grupo de Estudo ou Reunião
  const [meetingType, setMeetingType] = useState<'study_group' | 'team_meeting'>('study_group');
  const [meetingPartnerEmail, setMeetingPartnerEmail] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);

  // Estados de Paginação e Busca do Servidor
  const [totalServerCount, setTotalServerCount] = useState(0);
  const [hasMoreProjects, setHasMoreProjects] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collabFilter, setCollabFilter] = useState<'all' | 'owned' | 'shared' | 'trash'>('all');
  const [updateInfo, setUpdateInfo] = useState<{
    status: 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'installing' | 'error' | 'unconfigured';
    currentVersion: string;
    latestVersion: string | null;
    repo?: string;
    progress: number;
    error: string | null;
    releaseNotes?: string;
  } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateCheckLog, setUpdateCheckLog] = useState<string>('');

  const handleCheckUpdates = async () => {
    setUpdateCheckLog('Consultando https://api.github.com/repos/scandocsgov/insighter-releases/releases/latest...');
    try {
      const res = await window.insighterDesktop?.checkForUpdates?.(true);
      if (res) {
        setUpdateInfo(res);
        if (res.status === 'up-to-date') {
          setUpdateCheckLog(`✅ Resposta recebida da API: o app está na versão mais recente (v${res.latestVersion || res.currentVersion}). Repositório conectado e funcional.`);
        } else if (res.status === 'available') {
          setUpdateCheckLog(`🚀 Nova versão detectada no repositório: v${res.latestVersion}! Pronto para baixar.`);
        } else if (res.status === 'error') {
          setUpdateCheckLog(`⚠️ Erro retornado: ${res.error}`);
        }
      }
    } catch (err: any) {
      setUpdateCheckLog(`❌ Falha na requisição: ${err?.message || err}`);
    }
  };

  useEffect(() => {
    const desktop = typeof window !== 'undefined' ? window.insighterDesktop : undefined;
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

  // IDs acessíveis para os campos
  const searchInputId = useId();
  const seriesNameId = useId();
  const seasonNumId = useId();
  const episodeNumId = useId();
  const seriesSelectId = useId();
  const seriesLoreId = useId();
  const bookByChaptersId = useId();
  const chapterNumId = useId();
  const chapterTitleId = useId();
  const totalChaptersId = useId();
  const freeSubtypeId = useId();
  const studyTopicId = useId();
  const studyGoalId = useId();
  const meetingTypeId = useId();
  const meetingPartnerEmailId = useId();
  const meetingAgendaId = useId();

  const fetchServerBrainstorms = async () => {
    setIsLoadingList(true);
    try {
      const { projects, origin, totalCount, hasMore } = await listRecentProjectsFromSupabase(10, 0);
      setSavedProjects(projects);
      setTotalServerCount(totalCount);
      setHasMoreProjects(hasMore);
      setServerOrigin(
        origin === 'supabase_sql'
          ? 'Supabase PostgreSQL (Servidor)'
          : origin === 'supabase_storage'
          ? 'Supabase Cloud Storage (Servidor)'
          : 'Cache Local / Sincronização Ativa'
      );
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMoreProjects) return;
    setIsLoadingMore(true);
    try {
      const currentOffset = savedProjects.length;
      const { projects, totalCount, hasMore } = await listRecentProjectsFromSupabase(10, currentOffset);
      const combined = [...savedProjects];
      for (const p of projects) {
        if (!combined.some((item) => item.id === p.id)) {
          combined.push(p);
        }
      }
      setSavedProjects(combined);
      setTotalServerCount(totalCount);
      setHasMoreProjects(hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleLoadAll = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const { projects, totalCount } = await listRecentProjectsFromSupabase(100, 0);
      setSavedProjects(projects);
      setTotalServerCount(totalCount);
      setHasMoreProjects(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchServerBrainstorms();
  }, []);

  const activeSavedProjects = savedProjects.filter((p) => !p.isTrashed);
  const trashedProjects = savedProjects.filter((p) => Boolean(p.isTrashed));

  const isDemoBrainstorm = (p: ProjectData) =>
    Boolean(p.isDemo || p.id === 'proj-cronos-noir' || p.id.startsWith('proj-demo'));

  const handleMoveToTrash = async (item: ProjectData) => {
    const trashed = await trashProject(item);
    setSavedProjects((prev) => prev.map((p) => (p.id === item.id ? trashed : p)));
  };

  const handleRestoreFromTrash = async (item: ProjectData) => {
    const restored = await restoreProject(item);
    setSavedProjects((prev) => prev.map((p) => (p.id === item.id ? restored : p)));
  };

  const handlePermanentDelete = async (item: ProjectData) => {
    await deleteProjectPermanently(item.id);
    setSavedProjects((prev) => prev.filter((p) => p.id !== item.id));
    setTotalServerCount((prev) => Math.max(0, prev - 1));
  };

  const handleEmptyTrash = async () => {
    const toDelete = [...trashedProjects];
    for (const item of toDelete) {
      await deleteProjectPermanently(item.id);
    }
    setSavedProjects((prev) => prev.filter((p) => !p.isTrashed));
    setTotalServerCount((prev) => Math.max(0, prev - toDelete.length));
  };

  const filteredProjects = savedProjects.filter((p) => {
    if (collabFilter === 'trash') {
      if (!p.isTrashed) return false;
    } else {
      if (p.isTrashed) return false;
      if (collabFilter === 'owned' && p.isShared) return false;
      if (collabFilter === 'shared' && !p.isShared) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.title.toLowerCase().includes(q) ||
      (p.logline && p.logline.toLowerCase().includes(q)) ||
      (p.seriesContext?.seriesTitle && p.seriesContext.seriesTitle.toLowerCase().includes(q)) ||
      (FORMAT_LABELS[p.format] && FORMAT_LABELS[p.format].toLowerCase().includes(q)) ||
      (p.members && p.members.some((m) => m.invitedEmail.toLowerCase().includes(q)))
    );
  });

  const handleQuickBlankCreate = async () => {
    setIsCreating(true);
    try {
      await startCleanProject('Novo Brainstorm Limpo', '', 'video_essay');
      onEnterStudio();
    } finally {
      setIsCreating(false);
    }
  };

  const handleCustomCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setFormValidationMsg(null);
    try {
      let seriesCtx: SeriesContext | undefined = undefined;
      let bookCtx: BookContext | undefined = undefined;
      let freeBrainstormCtx: FreeBrainstormContext | undefined = undefined;
      let meetingGroupCtx: MeetingGroupContext | undefined = undefined;

      if (newFormat === 'study_group_meeting') {
        const partner = meetingPartnerEmail.trim().toLowerCase();
        if (!partner || !partner.includes('@')) {
          setFormValidationMsg(
            '⚠️ Grupo de estudo ou reunião exige pelo menos 2 participantes (o criador e pelo menos mais um e-mail válido de parceiro).'
          );
          setIsCreating(false);
          return;
        }
        meetingGroupCtx = {
          meetingType,
          requiredPartnerEmail: partner,
          agendaTopic: meetingAgenda.trim() || undefined,
        };
      } else if (newFormat === 'free_brainstorm') {
        freeBrainstormCtx = {
          subtype: freeSubtype,
          studyTopic: studyTopic.trim() || undefined,
          studyGoal: studyGoal.trim() || undefined,
        };
      } else if (newFormat === 'series_episode') {
        const chosen = savedProjects.find((p) => p.id === selectedExistingSeriesId);
        const resolvedSeriesTitle =
          seriesMode === 'new'
            ? (seriesTitle.trim() || 'Nova Série')
            : (chosen?.seriesContext?.seriesTitle || chosen?.title || seriesTitle.trim() || 'Série em Andamento');

        const relatedProjects = chosen
          ? savedProjects.filter(
              (p) =>
                p.id === chosen.id ||
                (p.seriesContext?.seriesId &&
                  p.seriesContext.seriesId === (chosen.seriesContext?.seriesId || chosen.id)) ||
                (p.seriesContext?.seriesTitle &&
                  p.seriesContext.seriesTitle.toLowerCase() === resolvedSeriesTitle.toLowerCase())
            )
          : [];

        const aggregatedSeriesCards = relatedProjects.flatMap((p) => p.cards || []);
        const uniqueSeriesCards = aggregatedSeriesCards.filter(
          (c, i, arr) => arr.findIndex((item) => item.id === c.id) === i
        );

        const aggregatedSeriesSources = relatedProjects.flatMap((p) => p.sources || []);
        const uniqueSeriesSources = aggregatedSeriesSources.filter(
          (s, i, arr) => arr.findIndex((item) => item.id === s.id) === i
        );

        const aggregatedMemory: SeriesPersistentMemory = {
          seriesId: chosen?.seriesContext?.seriesId || chosen?.id || `series-${Date.now()}`,
          seriesTitle: resolvedSeriesTitle,
          loreRules: Array.from(
            new Set(
              relatedProjects.flatMap((p) => p.seriesContext?.memory?.loreRules || [])
            )
          ),
          characters: relatedProjects
            .flatMap((p) => p.seriesContext?.memory?.characters || [])
            .filter((c, i, arr) => arr.findIndex((item) => item.name.toLowerCase() === c.name.toLowerCase()) === i),
          canonicalEvents: [
            ...relatedProjects.flatMap((p) => p.seriesContext?.memory?.canonicalEvents || []),
            ...relatedProjects.map((p) => ({
              id: `ev-${p.id}`,
              episodeTag: p.seriesContext
                ? `T${p.seriesContext.seasonNumber || 1}E${p.seriesContext.episodeNumber || 1}`
                : 'Episódio Anterior',
              description: p.logline || p.title,
            })),
          ].filter((e, i, arr) => arr.findIndex((item) => item.episodeTag === e.episodeTag) === i),
          unresolvedHooks: relatedProjects
            .flatMap((p) => p.seriesContext?.memory?.unresolvedHooks || [])
            .filter((h, i, arr) => arr.findIndex((item) => item.id === h.id) === i),
          canonicalCards: uniqueSeriesCards.filter((c) => c.isCanonicalSeriesMemory),
        };

        seriesCtx = {
          mode: seriesMode,
          seriesTitle: resolvedSeriesTitle,
          seasonNumber: Math.max(1, Number(seriesSeason) || 1),
          episodeNumber: Math.max(1, Number(seriesEpisode) || 1),
          seriesId: seriesMode === 'existing' && chosen ? (chosen.seriesContext?.seriesId || chosen.id) : undefined,
          seriesLoreSnippet: seriesLore.trim() || chosen?.seriesContext?.seriesLoreSnippet || chosen?.logline || undefined,
          parentCards: seriesMode === 'existing' ? uniqueSeriesCards : undefined,
          parentSources: seriesMode === 'existing' ? uniqueSeriesSources : undefined,
          inheritCardsAsSource: seriesMode === 'existing' ? inheritCardsAsSource : false,
          inheritSources: seriesMode === 'existing' ? inheritSources : false,
          memory: seriesMode === 'existing' ? aggregatedMemory : undefined,
        };
      } else if (newFormat === 'book') {
        bookCtx = {
          byChapters: bookByChapters,
          chapterNumber: bookByChapters ? Math.max(1, Number(chapterNumber) || 1) : undefined,
          chapterTitle: chapterTitle.trim() || undefined,
          totalChaptersPlanned: Math.max(1, Number(totalChaptersPlanned) || 10),
        };
      }

      const defaultTitle =
        newFormat === 'series_episode'
          ? `${seriesTitle || 'Série'} — T${seriesSeason}E${seriesEpisode}: ${newTitle.trim() || 'Novo Episódio'}`
          : newFormat === 'book'
          ? (bookByChapters ? `${newTitle.trim() || 'Novo Livro'} — Cap. ${chapterNumber}` : (newTitle.trim() || 'Novo Livro'))
          : newFormat === 'article'
          ? (newTitle.trim() || 'Novo Artigo / Ensaio')
          : newFormat === 'free_brainstorm'
          ? (newTitle.trim() || (freeSubtype === 'solo_study' ? `Estudo: ${studyTopic.trim() || 'Novo Tema'}` : 'Novo Brainstorm Livre'))
          : newFormat === 'study_group_meeting'
          ? (newTitle.trim() || (meetingType === 'study_group' ? `Grupo de Estudo: ${meetingAgenda.trim() || 'Sessão Compartilhada'}` : `Reunião: ${meetingAgenda.trim() || 'Alinhamento'}`))
          : (newTitle.trim() || 'Novo Brainstorm de Roteiro');

      await startCleanProject(
        defaultTitle,
        newLogline.trim(),
        newFormat,
        seriesCtx,
        bookCtx,
        freeBrainstormCtx,
        meetingGroupCtx
      );
      onEnterStudio();
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenSavedProject = (proj: ProjectData) => {
    loadExistingProject(proj);
    onEnterStudio();
  };

  const isDesktopMac =
    typeof window !== 'undefined' &&
    Boolean(window.insighterDesktop?.isDesktopApp) &&
    window.insighterDesktop?.platform === 'darwin';

  return (
    <div className="studio-shell" style={{ overflowY: 'auto', userSelect: 'text' }}>
      {/* Barra Superior do Dashboard (com recuo para os botões de fechar/minimizar/maximizar no macOS) */}
      <header className={`topbar ${isDesktopMac ? 'desktop-mac' : ''}`}>
        <div className="brand-cluster">
          <div className="brand-mark">
            <Sparkles size={16} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.18rem', fontWeight: 500 }}>
              Insighter — Dashboard de Roteiros & Brainstorms
            </span>
          </div>
        </div>

        <div className="topbar-actions">
          {typeof window !== 'undefined' && window.insighterDesktop?.isDesktopApp && (
            updateInfo?.status === 'available' ? (
              <button
                type="button"
                className="btn-studio amber"
                onClick={() => window.insighterDesktop?.installUpdate?.()}
                title={`Nova versão v${updateInfo.latestVersion} disponível! Clique para baixar e atualizar em /Applications/Capitolio/Insighter.app`}
              >
                <RefreshCw size={14} /> Atualizar v{updateInfo.latestVersion}
              </button>
            ) : updateInfo?.status === 'downloading' || updateInfo?.status === 'installing' ? (
              <button
                type="button"
                className="btn-studio amber"
                disabled
                title="Baixando e instalando atualização automática..."
              >
                <RefreshCw size={14} /> {updateInfo.status === 'installing' ? 'Instalando...' : `Atualizando ${updateInfo.progress}%`}
              </button>
            ) : (
              <button
                type="button"
                className="btn-studio"
                onClick={() => window.insighterDesktop?.checkForUpdates?.()}
                disabled={updateInfo?.status === 'checking'}
                title={
                  updateInfo?.status === 'up-to-date'
                    ? `Versão atual v${updateInfo.currentVersion} está atualizada`
                    : 'Verificar se há nova versão disponível do Insighter'
                }
              >
                <RefreshCw size={14} />{' '}
                {updateInfo?.status === 'checking'
                  ? 'Verificando...'
                  : updateInfo?.status === 'up-to-date'
                  ? `v${updateInfo.currentVersion} (Atualizado)`
                  : 'Verificar Atualizações'}
              </button>
            )
          )}

          {typeof window !== 'undefined' && window.insighterDesktop?.hideToMenuBar && (
            <button
              type="button"
              className="btn-studio"
              onClick={() => window.insighterDesktop?.hideToMenuBar?.()}
              title="Ocultar aplicativo no ícone branco do Menu Superior e remover do Dock (Cmd+H)"
            >
              <EyeOff size={14} /> Ocultar no Menu Superior
            </button>
          )}

          {activeProject && activeProject.cards.length > 0 && (
            <button
              type="button"
              className="btn-studio sage"
              onClick={onEnterStudio}
              title="Retornar para a bancada ativa atual"
            >
              Continuar "{activeProject.title.slice(0, 24)}" <ArrowRight size={14} />
            </button>
          )}

          {authUser ? (
            <button type="button" className="btn-studio" onClick={onLogout}>
              <UserCheck size={14} style={{ color: 'var(--accent-sage)' }} />
              <span>{authUser.fullName || authUser.email}</span>
              <LogOut size={13} style={{ color: 'var(--text-muted)' }} />
            </button>
          ) : (
            <button type="button" className="btn-studio" onClick={onOpenLogin}>
              Entrar na Conta Supabase
            </button>
          )}
        </div>
      </header>

      {/* Conteúdo Central do Dashboard */}
      <main
        style={{
          maxWidth: 1220,
          width: '100%',
          margin: '0 auto',
          padding: '32px 28px 80px',
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        {/* Seção 1: Criar Novo Insight / Brainstorm Limpo */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {/* Card 1: Botão Direto para Iniciar Brainstorm 100% Limpo */}
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid color-mix(in oklab, var(--accent-amber) 42%, var(--border-subtle))',
              borderRadius: 'var(--radius-lg)',
              padding: 26,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 18,
              boxShadow: '0 18px 44px rgba(0, 0, 0, 0.38)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="lens-badge amber" style={{ alignSelf: 'flex-start' }}>
                <Sparkles size={12} /> BANCADA EM BRANCO
              </span>
              <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.55rem', fontWeight: 500 }}>
                Iniciar um Insight Limpo
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Abra uma bancada espacial vazia em tela cheia para lançar ideias soltas, subir PDFs ou provocar o motor Gemini sem distrações.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-studio amber"
                style={{ padding: '11px 18px', fontSize: '0.9rem', fontWeight: 600 }}
                disabled={isCreating}
                onClick={handleQuickBlankCreate}
              >
                <Plus size={16} /> Criar Novo Insight Limpo Agora
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  type="button"
                  className="btn-studio"
                  style={{ padding: '11px 14px', fontSize: '0.82rem' }}
                  onClick={() => {
                    resetToDemoProject();
                    onEnterStudio();
                  }}
                >
                  <Film size={14} /> Abrir Exemplo Guiado (Demo)
                </button>
                <span
                  className="lens-badge amber"
                  style={{
                    fontSize: '0.66rem',
                    alignSelf: 'flex-start',
                    padding: '2px 8px',
                  }}
                >
                  🧪 Versão Demo de um Brainstorm Real
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Configurar Novo Roteiro com Título e Premissa */}
          <form
            onSubmit={handleCustomCreate}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.73rem',
                color: 'var(--accent-sage)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FilePlus2 size={14} /> CRIAR COM TÍTULO E SEMENTE DE ROTEIRO
            </span>

            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                placeholder="Título do roteiro ou tema do brainstorm..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="provocation-input"
                style={{ flex: 1 }}
                required
              />
              <select
                value={newFormat}
                onChange={(e) => {
                  const fmt = e.target.value as ProjectFormat;
                  setNewFormat(fmt);
                  if (fmt === 'series_episode' && !seriesTitle.trim() && newTitle.trim()) {
                    setSeriesTitle(newTitle.trim());
                  }
                }}
                className="provocation-input"
                style={{ width: 195, fontSize: '0.8rem' }}
              >
                <option value="video_essay">🎬 Video Essay</option>
                <option value="fiction_film">🎞️ Filme / Ficção</option>
                <option value="documentary">📽️ Documentário</option>
                <option value="series_bible">📺 Bíblia de Série / Lore</option>
                <option value="series_episode">🍿 Episódio de Série</option>
                <option value="article">✍️ Escrever Artigo</option>
                <option value="book">📖 Escrever Livro</option>
                <option value="free_brainstorm">💡 Brainstorm Livre / Estudo</option>
                <option value="study_group_meeting">👥 Grupo de Estudo / Reunião</option>
              </select>
            </div>

            {/* Caixa de Contexto Dinâmica: Episódio de Série */}
            {newFormat === 'series_episode' && (
              <div
                style={{
                  background: 'color-mix(in oklab, var(--accent-amber) 7%, var(--bg-canvas))',
                  border: '1px solid color-mix(in oklab, var(--accent-amber) 38%, var(--border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--accent-amber)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Tv size={13} /> CONTEXTO DA SÉRIE
                  </span>

                  <div style={{ display: 'inline-flex', gap: 4, background: 'var(--bg-canvas)', padding: 2, borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setSeriesMode('new')}
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: seriesMode === 'new' ? 'var(--tint-amber)' : 'transparent',
                        color: seriesMode === 'new' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                        fontWeight: seriesMode === 'new' ? 600 : 400,
                      }}
                    >
                      Criar Nova Série
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSeriesMode('existing');
                        if (savedProjects.length > 0 && !selectedExistingSeriesId) {
                          const firstSeries = savedProjects.find(
                            (p) => p.format === 'series_bible' || p.format === 'series_episode' || p.seriesContext?.seriesTitle
                          ) || savedProjects[0];
                          if (firstSeries) {
                            setSelectedExistingSeriesId(firstSeries.id);
                            const name = firstSeries.seriesContext?.seriesTitle || firstSeries.title;
                            setSeriesTitle(name);
                            setSeriesSeason(firstSeries.seriesContext?.seasonNumber || 1);
                            setSeriesEpisode((firstSeries.seriesContext?.episodeNumber || 0) + 1);
                            setSeriesLore(firstSeries.seriesContext?.seriesLoreSnippet || firstSeries.logline || '');
                          }
                        }
                      }}
                      style={{
                        padding: '3px 10px',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: seriesMode === 'existing' ? 'var(--tint-amber)' : 'transparent',
                        color: seriesMode === 'existing' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                        fontWeight: seriesMode === 'existing' ? 600 : 400,
                      }}
                    >
                      Escolher Série em Andamento
                    </button>
                  </div>
                </div>

                {seriesMode === 'new' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label htmlFor={seriesNameId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Nome da Nova Série / Universo:
                      </label>
                      <input
                        id={seriesNameId}
                        type="text"
                        placeholder="Ex: Arquivo Oculto, Nebulosa, Cidade de Vidro..."
                        value={seriesTitle}
                        onChange={(e) => setSeriesTitle(e.target.value)}
                        className="provocation-input"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                        autoCorrect="off"
                        spellCheck={false}
                        required={newFormat === 'series_episode'}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={seasonNumId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          Temporada Nº:
                        </label>
                        <input
                          id={seasonNumId}
                          type="number"
                          min={1}
                          value={seriesSeason}
                          onChange={(e) => setSeriesSeason(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="provocation-input"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={episodeNumId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          Episódio Nº:
                        </label>
                        <input
                          id={episodeNumId}
                          type="number"
                          min={1}
                          value={seriesEpisode}
                          onChange={(e) => setSeriesEpisode(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="provocation-input"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={seriesLoreId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Bíblia / Lore Geral da Série (opcional — já vira fonte no Context Mixer):
                      </label>
                      <textarea
                        id={seriesLoreId}
                        placeholder="Regras do mundo, arcos dos personagens ou premissa maior que atravessa os episódios..."
                        value={seriesLore}
                        onChange={(e) => setSeriesLore(e.target.value)}
                        className="beat-textarea"
                        style={{ minHeight: 60, fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {savedProjects.length === 0 ? (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '10px 0' }}>
                        Nenhuma série salva no servidor ainda.{' '}
                        <button
                          type="button"
                          onClick={() => setSeriesMode('new')}
                          style={{ color: 'var(--accent-amber)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          Clique aqui para Criar uma Nova Série.
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label htmlFor={seriesSelectId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                            Selecione a Série em Andamento:
                          </label>
                          <select
                            id={seriesSelectId}
                            value={selectedExistingSeriesId}
                            onChange={(e) => {
                              const sId = e.target.value;
                              setSelectedExistingSeriesId(sId);
                              const found = savedProjects.find((p) => p.id === sId);
                              if (found) {
                                const name = found.seriesContext?.seriesTitle || found.title;
                                setSeriesTitle(name);
                                setSeriesSeason(found.seriesContext?.seasonNumber || 1);
                                setSeriesEpisode((found.seriesContext?.episodeNumber || 0) + 1);
                                setSeriesLore(found.seriesContext?.seriesLoreSnippet || found.logline || '');
                              }
                            }}
                            className="provocation-input"
                            style={{ width: '100%', fontSize: '0.82rem' }}
                          >
                            <option value="">-- Escolha uma série existente --</option>
                            {savedProjects.map((proj) => (
                              <option key={proj.id} value={proj.id}>
                                {proj.seriesContext?.seriesTitle ? `📺 Série: ${proj.seriesContext.seriesTitle}` : proj.title} ({FORMAT_LABELS[proj.format] || 'Projeto'})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                              Temporada:
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={seriesSeason}
                              onChange={(e) => setSeriesSeason(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="provocation-input"
                              style={{ width: '100%', fontSize: '0.82rem' }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                              Episódio:
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={seriesEpisode}
                              onChange={(e) => setSeriesEpisode(Math.max(1, parseInt(e.target.value, 10) || 1))}
                              className="provocation-input"
                              style={{ width: '100%', fontSize: '0.82rem' }}
                            />
                          </div>
                        </div>

                        {seriesLore && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'var(--bg-canvas)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                            <strong style={{ color: 'var(--accent-amber)' }}>Lore / Regras herdadas:</strong> {seriesLore.slice(0, 160)}...
                          </div>
                        )}

                        {selectedExistingSeriesId && (
                          <div
                            style={{
                              background: 'rgba(226, 160, 74, 0.08)',
                              border: '1px solid rgba(226, 160, 74, 0.28)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                color: 'var(--accent-amber)',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                              }}
                            >
                              <Sparkles size={13} />
                              <span>Continuidade & Memória Persistente da Série</span>
                            </div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                              Este episódio herdará e manterá sincronizados os elementos canônicos da série:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.74rem' }}>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  cursor: 'pointer',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={inheritCardsAsSource}
                                  onChange={(e) => setInheritCardsAsSource(e.target.checked)}
                                  style={{ accentColor: 'var(--accent-amber)' }}
                                />
                                <span>
                                  <strong>Compilar cards da série em Fonte Viva</strong> (ativa no Context Mixer para citações e Advogado do Diabo)
                                </span>
                              </label>
                              <label
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  cursor: 'pointer',
                                  color: 'var(--text-primary)',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={inheritSources}
                                  onChange={(e) => setInheritSources(e.target.checked)}
                                  style={{ accentColor: 'var(--accent-amber)' }}
                                />
                                <span>
                                  <strong>Herdar fontes de pesquisa originais</strong> (documentos e PDFs da série-mãe)
                                </span>
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Caixa de Contexto Dinâmica: Escrever Livro */}
            {newFormat === 'book' && (
              <div
                style={{
                  background: 'color-mix(in oklab, var(--accent-sage) 7%, var(--bg-canvas))',
                  border: '1px solid color-mix(in oklab, var(--accent-sage) 38%, var(--border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--accent-sage)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <BookOpen size={13} /> ESTRUTURA DO LIVRO
                  </span>

                  <label
                    htmlFor={bookByChaptersId}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      id={bookByChaptersId}
                      type="checkbox"
                      checked={bookByChapters}
                      onChange={(e) => setBookByChapters(e.target.checked)}
                      style={{ accentColor: 'var(--accent-sage)', width: 15, height: 15 }}
                    />
                    Fazer um livro por capítulos
                  </label>
                </div>

                {bookByChapters ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={chapterNumId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          Capítulo Atual / Inicial Nº:
                        </label>
                        <input
                          id={chapterNumId}
                          type="number"
                          min={1}
                          value={chapterNumber}
                          onChange={(e) => setChapterNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="provocation-input"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label htmlFor={totalChaptersId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                          Total de Capítulos Planejados:
                        </label>
                        <input
                          id={totalChaptersId}
                          type="number"
                          min={1}
                          value={totalChaptersPlanned}
                          onChange={(e) => setTotalChaptersPlanned(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="provocation-input"
                          style={{ width: '100%', fontSize: '0.82rem' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor={chapterTitleId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Título do Capítulo (opcional):
                      </label>
                      <input
                        id={chapterTitleId}
                        type="text"
                        placeholder="Ex: O Ponto de Ruptura, A Fuga da Cidade..."
                        value={chapterTitle}
                        onChange={(e) => setChapterTitle(e.target.value)}
                        className="provocation-input"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                      />
                    </div>

                    <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      ✨ Ao estruturar por capítulos, o Insighter organiza a escaleta com arcos progressivos capítulo a capítulo para facilitar a escrita fluida.
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Modo contínuo: o livro será estruturado em grandes partes dramáticas (Prólogo, Parte I, Parte II, Clímax e Epílogo).
                  </p>
                )}
              </div>
            )}

            {/* Caixa de Contexto Dinâmica: Escrever Artigo */}
            {newFormat === 'article' && (
              <div
                style={{
                  background: 'color-mix(in oklab, var(--accent-terracotta) 7%, var(--bg-canvas))',
                  border: '1px solid color-mix(in oklab, var(--accent-terracotta) 38%, var(--border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  padding: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--accent-terracotta)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <FileText size={13} /> TIPO DE ARTIGO
                  </span>

                  <div style={{ display: 'inline-flex', gap: 4 }}>
                    {['Ensaio / Op-Ed', 'Reportagem Investigativa', 'Artigo Acadêmico / Técnico'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setArticleSubtype(type)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.7rem',
                          borderRadius: 'var(--radius-pill)',
                          border: 'none',
                          cursor: 'pointer',
                          background: articleSubtype === type ? 'var(--tint-terracotta)' : 'transparent',
                          color: articleSubtype === type ? 'var(--accent-terracotta)' : 'var(--text-secondary)',
                          fontWeight: articleSubtype === type ? 600 : 400,
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  A escaleta será moldada com: Gancho / Lead paradoxal, Estado da Questão, Antítese de Evidências, Ponto Cego e Conclusão Provocativa.
                </p>
              </div>
            )}

            {/* Caixa de Contexto Dinâmica: Brainstorm Livre / Estudo */}
            {newFormat === 'free_brainstorm' && (
              <div
                style={{
                  background: 'color-mix(in oklab, var(--accent-amber) 7%, var(--bg-canvas))',
                  border: '1px solid color-mix(in oklab, var(--accent-amber) 38%, var(--border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-amber)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} /> Modalidade do Brainstorm Livre
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setFreeSubtype('solo_study')}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: freeSubtype === 'solo_study' ? 'var(--tint-amber)' : 'transparent',
                        color: freeSubtype === 'solo_study' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                        fontWeight: freeSubtype === 'solo_study' ? 600 : 400,
                      }}
                    >
                      📖 Estudo Individual (Solo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFreeSubtype('free_exploration')}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: freeSubtype === 'free_exploration' ? 'var(--tint-amber)' : 'transparent',
                        color: freeSubtype === 'free_exploration' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                        fontWeight: freeSubtype === 'free_exploration' ? 600 : 400,
                      }}
                    >
                      💡 Exploração Livre
                    </button>
                  </div>
                </div>

                {freeSubtype === 'solo_study' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label htmlFor={studyTopicId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Disciplina ou Tópico de Estudo:
                      </label>
                      <input
                        id={studyTopicId}
                        type="text"
                        placeholder="Ex: Filosofia da Mente, Deep Learning, Neurociência, História Econômica..."
                        value={studyTopic}
                        onChange={(e) => setStudyTopic(e.target.value)}
                        className="provocation-input"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label htmlFor={studyGoalId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                        Meta de Aprendizado / O que você quer dominar (opcional):
                      </label>
                      <input
                        id={studyGoalId}
                        type="text"
                        placeholder="Ex: Fichar artigos-chave, mapear contradições entre autores e tirar dúvidas..."
                        value={studyGoal}
                        onChange={(e) => setStudyGoal(e.target.value)}
                        className="provocation-input"
                        style={{ width: '100%', fontSize: '0.82rem' }}
                      />
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      📚 Modo Estudo Solo: organiza a escaleta com 5 blocos acadêmicos (Fundamentos, Hipóteses, Fichamento Cruzado, Pontos Cegos e Recapitulação Ativa).
                    </p>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Modo livre aberto: use o Canvas para conectar ideias soltas, imagens, anotações e hipóteses sem amarras estruturais rígidas.
                  </p>
                )}
              </div>
            )}

            {/* Caixa de Contexto Dinâmica: Grupo de Estudo ou Reunião */}
            {newFormat === 'study_group_meeting' && (
              <div
                style={{
                  background: 'color-mix(in oklab, var(--accent-sage) 7%, var(--bg-canvas))',
                  border: '1px solid color-mix(in oklab, var(--accent-sage) 40%, var(--border-subtle))',
                  borderRadius: 'var(--radius-md)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-sage)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Users size={14} /> Modalidade Coletiva (Mínimo 2 participantes)
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setMeetingType('study_group')}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: meetingType === 'study_group' ? 'var(--tint-sage)' : 'transparent',
                        color: meetingType === 'study_group' ? 'var(--accent-sage)' : 'var(--text-secondary)',
                        fontWeight: meetingType === 'study_group' ? 600 : 400,
                      }}
                    >
                      📚 Grupo de Estudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMeetingType('team_meeting')}
                      style={{
                        padding: '4px 9px',
                        fontSize: '0.72rem',
                        borderRadius: 'var(--radius-pill)',
                        border: 'none',
                        cursor: 'pointer',
                        background: meetingType === 'team_meeting' ? 'var(--tint-sage)' : 'transparent',
                        color: meetingType === 'team_meeting' ? 'var(--accent-sage)' : 'var(--text-secondary)',
                        fontWeight: meetingType === 'team_meeting' ? 600 : 400,
                      }}
                    >
                      💼 Reunião de Equipe
                    </button>
                  </div>
                </div>

                {/* Exigência Estrita de pelo menos 2 participantes */}
                <div>
                  <label htmlFor={meetingPartnerEmailId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>E-mail do Participante Convidado (Mínimo 2 participantes: Você + Convidado):</span>
                    <span style={{ color: 'var(--accent-terracotta)', fontWeight: 600 }}>* Obrigatório</span>
                  </label>
                  <input
                    id={meetingPartnerEmailId}
                    type="email"
                    required
                    placeholder="ex: parceiro@estudo.com ou colega@empresa.com"
                    value={meetingPartnerEmail}
                    onChange={(e) => {
                      setMeetingPartnerEmail(e.target.value);
                      if (formValidationMsg) setFormValidationMsg(null);
                    }}
                    className="provocation-input"
                    style={{
                      width: '100%',
                      fontSize: '0.82rem',
                      borderColor: !meetingPartnerEmail.trim() ? 'var(--accent-terracotta)' : undefined,
                    }}
                  />
                  <span style={{ fontSize: '0.71rem', color: 'var(--text-muted)', display: 'block', marginTop: 3 }}>
                    🔒 Regra: este formato exige pelo menos 2 participantes (o criador e pelo menos mais um membro) para ser inicializado.
                  </span>
                </div>

                <div>
                  <label htmlFor={meetingAgendaId} style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                    Pauta Principal ou Meta do Encontro (opcional):
                  </label>
                  <input
                    id={meetingAgendaId}
                    type="text"
                    placeholder={meetingType === 'study_group' ? 'Ex: Discussão do Módulo 3, Resolução de Questões...' : 'Ex: Alinhamento de Metas Q4, Revisão de Gargalos...'}
                    value={meetingAgenda}
                    onChange={(e) => setMeetingAgenda(e.target.value)}
                    className="provocation-input"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>

                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  👥 A escaleta estruturará os 5 passos do encontro: {meetingType === 'study_group' ? 'Pauta Coletiva, Dúvidas dos Membros, Debate de Fontes, Fichamento do Grupo e Tarefas de Aprofundamento.' : 'Pauta, Diagnóstico, Brainstorm de Propostas, Deliberações e Ata de Ação.'}
                </p>
              </div>
            )}

            {formValidationMsg && (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.78rem',
                  background: 'var(--tint-terracotta)',
                  border: '1px solid var(--accent-terracotta)',
                  color: 'var(--text-primary)',
                }}
              >
                {formValidationMsg}
              </div>
            )}

            <textarea
              placeholder="Premissa inicial / Logline (opcional — o Gemini pode usar isso para gerar seus primeiros ganchos)..."
              value={newLogline}
              onChange={(e) => setNewLogline(e.target.value)}
              className="beat-textarea"
              style={{ minHeight: 72, fontSize: '0.84rem' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button
                type="submit"
                className="btn-studio sage"
                style={{ padding: '9px 16px', fontSize: '0.85rem' }}
                disabled={isCreating || (newFormat === 'study_group_meeting' && !meetingPartnerEmail.trim())}
              >
                <Plus size={15} /> Criar e Entrar no Estúdio
              </button>
            </div>
          </form>
        </section>

        {/* Seção 2: Insights / Brainstorms Salvos no Servidor */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              paddingBottom: 12,
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.32rem', fontWeight: 500 }}>
                Brainstorms & Insights Salvos no Servidor {totalServerCount > 0 ? `(${savedProjects.length} de ${totalServerCount})` : ''}
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                Origem ativa: <strong style={{ color: 'var(--accent-sage)' }}>{serverOrigin}</strong> · Ordenados pelos mais recentes.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-studio"
                disabled={isLoadingList}
                onClick={fetchServerBrainstorms}
              >
                {isLoadingList ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                Recarregar Iniciais
              </button>
            </div>
          </div>

          {/* Abas de Filtro: Todos / Meus Projetos / Compartilhados / Lixeira */}
          {savedProjects.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`mode-btn ${collabFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCollabFilter('all')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Todos ({activeSavedProjects.length})
                </button>
                <button
                  type="button"
                  className={`mode-btn ${collabFilter === 'owned' ? 'active' : ''}`}
                  onClick={() => setCollabFilter('owned')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                >
                  Meus Brainstorms ({activeSavedProjects.filter((p) => !p.isShared).length})
                </button>
                <button
                  type="button"
                  className={`mode-btn ${collabFilter === 'shared' ? 'active' : ''}`}
                  onClick={() => setCollabFilter('shared')}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Users size={13} style={{ color: 'var(--accent-amber)' }} />
                  Compartilhados Comigo ({activeSavedProjects.filter((p) => p.isShared).length})
                </button>
                <button
                  type="button"
                  className={`mode-btn ${collabFilter === 'trash' ? 'active' : ''}`}
                  onClick={() => setCollabFilter('trash')}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    color: collabFilter === 'trash' || trashedProjects.length > 0 ? 'var(--accent-terracotta)' : undefined,
                  }}
                >
                  <Trash2 size={13} />
                  Lixeira ({trashedProjects.length})
                </button>
              </div>

              {collabFilter === 'trash' && trashedProjects.length > 0 && (
                <button
                  type="button"
                  className="btn-studio"
                  onClick={handleEmptyTrash}
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    color: 'var(--accent-terracotta)',
                    borderColor: 'color-mix(in oklab, var(--accent-terracotta) 45%, var(--border-subtle))',
                  }}
                  title="Excluir definitivamente todos os brainstorms que estão na lixeira"
                >
                  <Trash2 size={13} /> Esvaziar Lixeira ({trashedProjects.length})
                </button>
              )}
            </div>
          )}

          {/* Barra de Busca e Filtragem Rápida */}
          {savedProjects.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
                <label
                  htmlFor={searchInputId}
                  style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
                  title="Buscar brainstorms"
                >
                  <Search size={15} />
                </label>
                <input
                  id={searchInputId}
                  type="search"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Filtrar por título, logline, universo/série ou formato..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    fontSize: '0.82rem',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    padding: '4px 0',
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      padding: '2px 6px',
                    }}
                  >
                    Limpar
                  </button>
                )}
              </div>

              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
                aria-live="polite"
              >
                {searchQuery
                  ? `Filtrados: ${filteredProjects.length} de ${savedProjects.length}`
                  : `Exibindo ${savedProjects.length} de ${totalServerCount || savedProjects.length}`}
              </div>
            </div>
          )}

          {isLoadingList ? (
            <div
              style={{
                padding: 42,
                textAlign: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <Loader2 size={18} className="spin" /> Buscando brainstorms salvos no servidor Supabase...
            </div>
          ) : savedProjects.length === 0 ? (
            <div
              style={{
                padding: 38,
                textAlign: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-strong)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <CloudDownload size={28} style={{ color: 'var(--accent-amber)' }} />
              <div style={{ maxWidth: 460 }}>
                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.12rem', fontWeight: 500 }}>
                  Nenhum brainstorm salvo no servidor ainda
                </h4>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  Clique em <strong>"Criar Novo Insight Limpo Agora"</strong> acima para iniciar seu primeiro brainstorm — ele aparecerá automaticamente aqui sincronizado.
                </p>
              </div>
            </div>
          ) : filteredProjects.length === 0 && collabFilter === 'trash' && !searchQuery ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Trash2 size={24} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                A lixeira está vazia. Brainstorms movidos para a lixeira aparecerão aqui antes da exclusão definitiva.
              </p>
              <button
                type="button"
                className="btn-studio"
                onClick={() => setCollabFilter('all')}
                style={{ fontSize: '0.78rem', padding: '6px 12px', marginTop: 4 }}
              >
                Voltar para Todos os Brainstorms
              </button>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Search size={24} style={{ color: 'var(--text-muted)' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Nenhum brainstorm corresponde ao termo <strong>"{searchQuery}"</strong> entre os {savedProjects.length} carregados.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn-studio"
                  onClick={() => setSearchQuery('')}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  Limpar busca
                </button>
                {hasMoreProjects && (
                  <button
                    type="button"
                    className="btn-studio sage"
                    onClick={handleLoadAll}
                    disabled={isLoadingMore}
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    Carregar todos ({totalServerCount}) e tentar novamente
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                  gap: 16,
                }}
              >
                {filteredProjects.map((item, idx) => (
                  <article
                    key={item.id}
                    style={{
                      background: 'var(--bg-surface)',
                      border: item.isTrashed
                        ? '1px dashed color-mix(in oklab, var(--accent-terracotta) 50%, var(--border-subtle))'
                        : isDemoBrainstorm(item)
                        ? '1px solid color-mix(in oklab, var(--accent-amber) 50%, var(--border-subtle))'
                        : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 14,
                      transition: 'border-color 0.16s ease, transform 0.16s ease',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="lens-badge sage">
                            #{idx + 1} · {FORMAT_LABELS[item.format] || '🎬 Roteiro'}
                          </span>
                          {isDemoBrainstorm(item) && (
                            <span
                              className="lens-badge amber"
                              style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              title="Este brainstorm é o Exemplo Guiado que demonstra uma versão demo de um brainstorm real"
                            >
                              🧪 Versão Demo de um Brainstorm Real
                            </span>
                          )}
                          {item.isTrashed && (
                            <span
                              className="lens-badge terracotta"
                              style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              <Trash2 size={10} /> Na Lixeira
                            </span>
                          )}
                          {item.isShared && (
                            <span
                              className="lens-badge lavender"
                              style={{ fontSize: '0.68rem', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            >
                              <Users size={10} /> Compartilhado
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Clock size={11} />
                          {new Date(item.updatedAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h4
                        style={{
                          fontFamily: 'var(--font-serif)',
                          fontSize: '1.15rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {item.title}
                      </h4>

                      {item.members && item.members.length > 0 && (
                        <div
                          style={{
                            fontSize: '0.73rem',
                            color: 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <Users size={11} style={{ color: 'var(--accent-amber)' }} />
                          <span>{item.members.length + 1} pessoas colaborando</span>
                        </div>
                      )}

                      {item.seriesContext && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--accent-amber)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Tv size={12} />
                          <span>
                            {item.seriesContext.seriesTitle} · T{item.seriesContext.seasonNumber}E{item.seriesContext.episodeNumber}
                          </span>
                        </div>
                      )}

                      {item.bookContext && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--accent-sage)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <BookOpen size={12} />
                          <span>
                            {item.bookContext.byChapters
                              ? `Capítulo ${item.bookContext.chapterNumber || 1} de ${item.bookContext.totalChaptersPlanned || '?'}${item.bookContext.chapterTitle ? `: ${item.bookContext.chapterTitle}` : ''}`
                              : 'Livro contínuo'}
                          </span>
                        </div>
                      )}

                      {item.freeBrainstormContext && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--accent-amber)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Sparkles size={12} />
                          <span>
                            {item.freeBrainstormContext.subtype === 'solo_study'
                              ? `Estudo Individual: ${item.freeBrainstormContext.studyTopic || 'Geral'}`
                              : 'Exploração Criativa Livre'}
                          </span>
                        </div>
                      )}

                      {item.meetingGroupContext && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            color: 'var(--accent-sage)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Users size={12} />
                          <span>
                            {item.meetingGroupContext.meetingType === 'study_group' ? 'Grupo de Estudo' : 'Reunião'} com {item.meetingGroupContext.requiredPartnerEmail}
                          </span>
                        </div>
                      )}

                      <p
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                          minHeight: 38,
                        }}
                      >
                        {item.logline || 'Brainstorm livre sem logline definida.'}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        paddingTop: 12,
                        borderTop: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Layers size={13} style={{ color: 'var(--accent-amber)' }} />
                        {item.cards?.length || 0} insights · {item.sources?.length || 0} fontes
                      </span>

                      {item.isTrashed ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-studio sage"
                            onClick={() => handleRestoreFromTrash(item)}
                            title="Restaurar brainstorm da lixeira"
                          >
                            <RotateCcw size={13} /> Restaurar
                          </button>
                          <button
                            type="button"
                            className="btn-studio"
                            onClick={() => handlePermanentDelete(item)}
                            style={{
                              color: 'var(--accent-terracotta)',
                              borderColor: 'color-mix(in oklab, var(--accent-terracotta) 45%, var(--border-subtle))',
                            }}
                            title="Excluir definitivamente da lixeira (ação irreversível)"
                          >
                            <Trash2 size={13} /> Excluir da Lixeira
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="btn-studio"
                            onClick={() => handleMoveToTrash(item)}
                            style={{
                              padding: '7px 10px',
                              color: 'var(--text-secondary)',
                            }}
                            title="Mover este brainstorm para a Lixeira"
                            aria-label={`Mover "${item.title}" para a Lixeira`}
                          >
                            <Trash2 size={14} /> Lixeira
                          </button>
                          <button
                            type="button"
                            className="btn-studio amber"
                            onClick={() => handleOpenSavedProject(item)}
                          >
                            <FolderOpen size={14} /> Carregar no Estúdio
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              {/* Botões de Paginação / Carregar Mais Antigos */}
              {hasMoreProjects && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '24px 18px',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-strong)',
                    marginTop: 8,
                  }}
                >
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      Existem mais brainstorms antigos salvos no servidor
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 3 }}>
                      Você carregou <strong>{savedProjects.length}</strong> de <strong>{totalServerCount}</strong> brainstorms sincronizados.
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn-studio sage"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                      style={{ fontSize: '0.84rem', padding: '9px 18px' }}
                    >
                      {isLoadingMore ? <Loader2 size={15} className="spin" /> : <CloudDownload size={15} />}
                      Carregar Mais Antigos (+10)
                    </button>

                    <button
                      type="button"
                      className="btn-studio"
                      onClick={handleLoadAll}
                      disabled={isLoadingMore}
                      style={{ fontSize: '0.84rem', padding: '9px 18px' }}
                    >
                      {isLoadingMore ? <Loader2 size={15} className="spin" /> : <Layers size={15} />}
                      Carregar Todos ({totalServerCount})
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
};
