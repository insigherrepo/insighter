import { create } from 'zustand';
import {
  AudioDebateSession,
  BeatActId,
  BookContext,
  CardAttachment,
  CardChatMessage,
  CardColor,
  CardGroup,
  Citation,
  ConnectionPortSide,
  CreativeLensId,
  FreeBrainstormContext,
  InsightCard,
  MeetingGroupContext,
  MemberRole,
  ProjectData,
  ProjectFormat,
  ProjectMember,
  SeriesContext,
  SourceItem,
  SourceType,
} from '../types/insighter';
import { createCleanProject, DEMO_PROJECT } from '../data/demoProject';
import {
  chatWithCard,
  distillCardsIntoSource,
  generateWritersRoomDebate,
  runCreativeLensSynthesis,
} from '../services/geminiEngine';
import {
  inviteProjectMember,
  moveProjectToTrash,
  permanentlyDeleteProjectFromTrash,
  removeProjectMember,
  restoreProjectFromTrash,
  saveProjectToLocalIndex,
  syncProjectToSupabase,
} from '../lib/supabase';

const STORAGE_KEY = 'insighter_active_project_v2';

function loadInitialProject(): ProjectData {
  if (typeof window === 'undefined') return createCleanProject();
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as ProjectData;
    }
  } catch {
    // ignore storage errors
  }
  return createCleanProject();
}

function persistProjectLocally(project: ProjectData) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // ignore storage quota errors
  }
}

export type WorkspaceViewMode = 'canvas' | 'beatsheet';

interface InsighterState {
  project: ProjectData;
  viewMode: WorkspaceViewMode;
  zenFullscreen: boolean;
  sidebarCollapsed: boolean;
  selectedCardIds: string[];
  editingCardId: string | null;
  activeCitation: Citation | null;
  activeCardChatId: string | null;
  cardChatRunningId: string | null;
  isSynthesizing: boolean;
  activeLensRunning: CreativeLensId | null;
  syncStatusMessage: string;
  errorBanner: string | null;

  // Actions de Navegação e Conforto Visual
  setViewMode: (mode: WorkspaceViewMode) => void;
  toggleZenFullscreen: () => void;
  toggleSidebar: () => void;
  setActiveCitation: (citation: Citation | null) => void;
  setActiveCardChatId: (cardId: string | null) => void;
  setEditingCardId: (cardId: string | null) => void;
  clearError: () => void;

  // Actions do Projeto
  updateProjectMeta: (title: string, logline?: string) => void;
  startCleanProject: (
    title?: string,
    logline?: string,
    format?: ProjectFormat,
    seriesContext?: SeriesContext,
    bookContext?: BookContext,
    freeBrainstormContext?: FreeBrainstormContext,
    meetingGroupContext?: MeetingGroupContext,
    initialMembers?: ProjectMember[]
  ) => Promise<ProjectData>;
  loadExistingProject: (proj: ProjectData) => void;
  resetToDemoProject: () => void;
  trashProject: (proj: ProjectData) => Promise<ProjectData>;
  restoreProject: (proj: ProjectData) => Promise<ProjectData>;
  deleteProjectPermanently: (projectId: string) => Promise<boolean>;
  triggerCloudSync: () => Promise<void>;
  inviteMember: (email: string, role?: MemberRole) => Promise<boolean>;
  removeMember: (memberEmail: string) => Promise<boolean>;

  // Actions do Context Mixer (Fontes)
  toggleSourceActive: (sourceId: string) => void;
  setAllSourcesActive: (active: boolean) => void;
  addSource: (params: {
    title: string;
    type: SourceType;
    authorOrOrigin: string;
    content: string;
    filePath?: string;
    mimeType?: string;
    mediaDataUrl?: string;
  }) => void;
  removeSource: (sourceId: string) => void;
  updateSourceContent: (sourceId: string, content: string) => void;

  // Actions do Canvas Livre e Lentes Criativas
  toggleSelectCard: (cardId: string, multi?: boolean) => void;
  selectSingleCard: (cardId: string) => void;
  clearCardSelection: () => void;
  updateCardPosition: (cardId: string, x: number, y: number) => void;
  updateCardSize: (cardId: string, width: number, height?: number) => void;
  updateCardContent: (cardId: string, title: string, body: string, subtextOrVisualCue?: string) => void;
  updateCardColor: (cardId: string, color: CardColor) => void;
  assignCardToBeatAct: (cardId: string, act: BeatActId) => void;
  removeCard: (cardId: string) => void;
  connectCards: (
    fromCardId: string,
    toCardId: string,
    label?: string,
    fromSide?: ConnectionPortSide,
    toSide?: ConnectionPortSide
  ) => void;
  reconnectConnection: (
    connectionId: string,
    fromCardId: string,
    toCardId: string,
    fromSide?: ConnectionPortSide,
    toSide?: ConnectionPortSide
  ) => void;
  removeConnection: (connectionId: string) => void;
  updateConnectionLabel: (connectionId: string, label: string) => void;
  addManualCard: (title?: string, body?: string, position?: { x: number; y: number }, lensId?: CreativeLensId) => string;

  // Grupos de Cards
  createCardGroup: (title: string, cardIds: string[], color?: CardColor) => CardGroup;
  removeCardGroup: (groupId: string) => void;
  updateCardGroup: (groupId: string, updates: Partial<CardGroup>) => void;
  addCardsToGroup: (groupId: string, cardIds: string[]) => void;
  removeCardFromGroup: (cardId: string) => void;

  // Memória Persistente & Continuidade da Série
  toggleCardSeriesMemory: (cardId: string) => void;
  importSeriesCardToCanvas: (card: InsightCard) => void;
  addSeriesOpenHook: (description: string, originEpisode?: string) => void;
  toggleSeriesOpenHook: (hookId: string) => void;

  // Interação e Conversa com Cards
  sendCardChatMessage: (cardId: string, message: string, lensId?: CreativeLensId) => Promise<void>;
  clearCardChat: (cardId: string) => void;
  toggleRejectCardChatMessage: (cardId: string, messageId: string) => void;
  toggleHideCardChatMessage: (cardId: string, messageId: string) => void;
  deleteCardChatMessage: (cardId: string, messageId: string) => void;

  // Anexos em Cards (Imagens, Prints, Recortes de PDFs e Texto)
  addCardAttachment: (
    cardId: string,
    attachment: Omit<CardAttachment, 'id' | 'createdAt'>
  ) => CardAttachment;
  removeCardAttachment: (cardId: string, attachmentId: string) => void;

  // Posição e Zoom do Viewport do Canvas
  saveCanvasViewport: (pan: { x: number; y: number }, zoom: number) => void;

  // Reunião Ao Vivo / Espelhamento de Tela (Live Meeting Broadcast & Following)
  isLivePresenter: boolean;
  isLiveFollowing: boolean;
  livePresenterName: string | null;
  startLiveMeeting: (presenterName?: string) => void;
  stopLiveMeeting: () => void;
  toggleLiveFollow: () => void;
  applyLiveMeetingState: (pan: { x: number; y: number }, zoom: number, ultrafocusCardId?: string | null) => void;
  applyRemoteProjectUpdate: (remoteProject: ProjectData) => void;

  // Modo Investigativo (Foco, Vislumbre Visual & Navegação por Fios)
  investigativeMode: boolean;
  focusedInvestigativeCardId: string | null;

  // Modo Ultrafoco (Trabalho Exclusivo em Tela Cheia no Card)
  ultrafocusCardId: string | null;
  setUltrafocusCardId: (cardId: string | null) => void;
  setInvestigativeMode: (active: boolean) => void;
  setFocusedInvestigativeCardId: (cardId: string | null) => void;

  // Motor Gemini: Lentes, Cruzamento de Cards, Destilação e Sala de Roteiristas
  triggerCreativeLens: (lensId: CreativeLensId, customPrompt?: string) => Promise<void>;
  crossSelectedCards: () => Promise<void>;
  distillSelectedCardsToSource: (customTitle?: string) => SourceItem | null;
  runAudioDebate: (focusDirective: string) => Promise<AudioDebateSession>;

  // Actions da Escaleta / Roteiro
  updateBeatContent: (beatId: string, updates: { title?: string; sceneHeading?: string; content?: string }) => void;
}

export const useInsighterStore = create<InsighterState>((set, get) => ({
  project: loadInitialProject(),
  viewMode: 'canvas',
  zenFullscreen: false,
  sidebarCollapsed: false,
  selectedCardIds: [],
  editingCardId: null,
  activeCitation: null,
  activeCardChatId: null,
  cardChatRunningId: null,
  isSynthesizing: false,
  activeLensRunning: null,
  syncStatusMessage: 'Estúdio pronto (Sincronização Supabase ativa)',
  errorBanner: null,
  investigativeMode: false,
  focusedInvestigativeCardId: null,
  ultrafocusCardId: null,
  isLivePresenter: false,
  isLiveFollowing: true,
  livePresenterName: null,

  saveCanvasViewport: (pan, zoom) => {
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        viewport: { pan, zoom },
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  startLiveMeeting: (presenterName) => {
    const { project } = get();
    const updated: ProjectData = {
      ...project,
      meetingLiveState: {
        isActive: true,
        presenterName: presenterName || 'Apresentador',
        pan: project.viewport?.pan || { x: 0, y: 0 },
        zoom: project.viewport?.zoom || 1,
        ultrafocusCardId: get().ultrafocusCardId,
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
    persistProjectLocally(updated);
    void syncProjectToSupabase(updated);
    set({
      isLivePresenter: true,
      isLiveFollowing: false,
      livePresenterName: presenterName || 'Você (Apresentador)',
      project: updated,
      syncStatusMessage: 'Transmitindo reunião ao vivo: tela espelhada para colaboradores',
    });
  },

  stopLiveMeeting: () => {
    const { project } = get();
    const updated: ProjectData = {
      ...project,
      meetingLiveState: undefined,
      updatedAt: new Date().toISOString(),
    };
    persistProjectLocally(updated);
    void syncProjectToSupabase(updated);
    set({
      isLivePresenter: false,
      livePresenterName: null,
      project: updated,
      syncStatusMessage: 'Transmissão da reunião encerrada',
    });
  },

  toggleLiveFollow: () => {
    set((state) => ({ isLiveFollowing: !state.isLiveFollowing }));
  },

  applyLiveMeetingState: (_pan, _zoom, ultrafocusCardId) => {
    if (!get().isLiveFollowing) return;
    set({
      ultrafocusCardId: ultrafocusCardId !== undefined ? ultrafocusCardId : get().ultrafocusCardId,
    });
  },

  applyRemoteProjectUpdate: (remoteProject) => {
    const { project: current } = get();
    if (remoteProject.id !== current.id) return;
    persistProjectLocally(remoteProject);
    set({ project: remoteProject });
  },

  setUltrafocusCardId: (cardId) => set({ ultrafocusCardId: cardId }),

  setInvestigativeMode: (active) =>
    set({
      investigativeMode: active,
      focusedInvestigativeCardId: active ? get().focusedInvestigativeCardId : null,
    }),
  setFocusedInvestigativeCardId: (cardId) => set({ focusedInvestigativeCardId: cardId }),

  setViewMode: (mode) => {
    if (typeof document !== 'undefined' && 'startViewTransition' in document) {
      (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(() => {
        set({ viewMode: mode });
      });
    } else {
      set({ viewMode: mode });
    }
  },

  toggleZenFullscreen: () => {
    const nextZen = !get().zenFullscreen;
    set({ zenFullscreen: nextZen, sidebarCollapsed: nextZen });
    if (typeof document !== 'undefined') {
      if (nextZen && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else if (!nextZen && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveCitation: (citation) => set({ activeCitation: citation }),
  setActiveCardChatId: (cardId) => set({ activeCardChatId: cardId }),
  setEditingCardId: (cardId) => set({ editingCardId: cardId }),
  clearError: () => set({ errorBanner: null }),

  updateProjectMeta: (title, logline) => {
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        title,
        logline: logline !== undefined ? logline : state.project.logline,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  startCleanProject: async (
    title = 'Novo Roteiro Sem Título',
    logline = '',
    format = 'video_essay',
    seriesContext?: SeriesContext,
    bookContext?: BookContext,
    freeBrainstormContext?: FreeBrainstormContext,
    meetingGroupContext?: MeetingGroupContext,
    initialMembers?: ProjectMember[]
  ) => {
    const clean: ProjectData = createCleanProject(
      title,
      logline,
      format,
      seriesContext,
      bookContext,
      freeBrainstormContext,
      meetingGroupContext,
      initialMembers
    );
    persistProjectLocally(clean);
    set({
      project: clean,
      selectedCardIds: [],
      editingCardId: null,
      activeCitation: null,
      syncStatusMessage: 'Novo brainstorm limpo criado',
    });
    await syncProjectToSupabase(clean);
    return clean;
  },

  loadExistingProject: (proj) => {
    persistProjectLocally(proj);
    set({
      project: proj,
      selectedCardIds: [],
      editingCardId: null,
      activeCitation: null,
      syncStatusMessage: `Brainstorm "${proj.title}" carregado`,
    });
  },

  resetToDemoProject: () => {
    const demoInstance: ProjectData = {
      ...DEMO_PROJECT,
      isDemo: true,
      isTrashed: false,
      trashedAt: undefined,
      updatedAt: new Date().toISOString(),
    };
    persistProjectLocally(demoInstance);
    saveProjectToLocalIndex(demoInstance);
    void syncProjectToSupabase(demoInstance);
    set({
      project: demoInstance,
      selectedCardIds: [],
      editingCardId: null,
      activeCitation: null,
      syncStatusMessage: 'Projeto de Exemplo (Demo) carregado',
    });
  },

  trashProject: async (proj: ProjectData) => {
    const { project: activeProj } = get();
    const { project: trashed } = await moveProjectToTrash(proj);
    if (activeProj.id === proj.id) {
      const clean = createCleanProject();
      persistProjectLocally(clean);
      set({
        project: clean,
        selectedCardIds: [],
        editingCardId: null,
        activeCitation: null,
        syncStatusMessage: `Brainstorm "${proj.title}" movido para a lixeira`,
      });
    } else {
      set({ syncStatusMessage: `Brainstorm "${proj.title}" movido para a lixeira` });
    }
    return trashed;
  },

  restoreProject: async (proj: ProjectData) => {
    const { project: restored } = await restoreProjectFromTrash(proj);
    set({ syncStatusMessage: `Brainstorm "${proj.title}" restaurado da lixeira` });
    return restored;
  },

  deleteProjectPermanently: async (projectId: string) => {
    const { project: activeProj } = get();
    const res = await permanentlyDeleteProjectFromTrash(projectId);
    if (activeProj.id === projectId) {
      const clean = createCleanProject();
      persistProjectLocally(clean);
      set({
        project: clean,
        selectedCardIds: [],
        editingCardId: null,
        activeCitation: null,
        syncStatusMessage: 'Brainstorm excluído definitivamente da lixeira',
      });
    } else {
      set({ syncStatusMessage: 'Brainstorm excluído definitivamente da lixeira' });
    }
    return res.ok;
  },

  triggerCloudSync: async () => {
    const { project } = get();
    set({ syncStatusMessage: 'Sincronizando com Supabase...' });
    const res = await syncProjectToSupabase(project);
    set({ syncStatusMessage: res.message });
  },

  inviteMember: async (email: string, role: MemberRole = 'editor') => {
    const { project } = get();
    const res = await inviteProjectMember(project.id, email, role);
    if (res.ok && res.member) {
      const updatedMembers = [...(project.members || [])];
      const existingIdx = updatedMembers.findIndex(
        (m) => m.invitedEmail.toLowerCase() === email.trim().toLowerCase()
      );
      if (existingIdx >= 0) {
        updatedMembers[existingIdx] = res.member;
      } else {
        updatedMembers.push(res.member);
      }
      const updatedProject: ProjectData = {
        ...project,
        members: updatedMembers,
        updatedAt: new Date().toISOString(),
      };
      set({
        project: updatedProject,
        syncStatusMessage: `Colaborador ${email} adicionado como ${role === 'editor' ? 'Editor' : 'Leitor'}`,
      });
      persistProjectLocally(updatedProject);
      await syncProjectToSupabase(updatedProject);
      return true;
    }
    return false;
  },

  removeMember: async (memberEmail: string) => {
    const { project } = get();
    await removeProjectMember(project.id, memberEmail);
    const updatedMembers = (project.members || []).filter(
      (m) => m.invitedEmail.toLowerCase() !== memberEmail.trim().toLowerCase()
    );
    const updatedProject: ProjectData = {
      ...project,
      members: updatedMembers,
      updatedAt: new Date().toISOString(),
    };
    set({
      project: updatedProject,
      syncStatusMessage: `Acesso do colaborador ${memberEmail} revogado`,
    });
    persistProjectLocally(updatedProject);
    await syncProjectToSupabase(updatedProject);
    return true;
  },

  toggleSourceActive: (sourceId) => {
    set((state) => {
      const updatedSources = state.project.sources.map((src) =>
        src.id === sourceId ? { ...src, isActive: !src.isActive } : src
      );
      const updated = { ...state.project, sources: updatedSources, updatedAt: new Date().toISOString() };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  setAllSourcesActive: (active) => {
    set((state) => {
      const updatedSources = state.project.sources.map((src) => ({ ...src, isActive: active }));
      const updated = { ...state.project, sources: updatedSources, updatedAt: new Date().toISOString() };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  addSource: ({ title, type, authorOrOrigin, content, filePath, mimeType, mediaDataUrl }) => {
    const newSource: SourceItem = {
      id: `src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim() || 'Nova Fonte Sem Título',
      type,
      authorOrOrigin: authorOrOrigin.trim() || 'Fonte do Autor',
      content: content.trim(),
      summary: content.trim().slice(0, 140) + (content.length > 140 ? '...' : ''),
      isActive: true,
      filePath,
      mimeType,
      mediaDataUrl,
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        sources: [newSource, ...state.project.sources],
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  removeSource: (sourceId) => {
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        sources: state.project.sources.filter((s) => s.id !== sourceId),
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  updateSourceContent: (sourceId, content) => {
    set((state) => {
      const trimmed = content.trim();
      const updatedSources = state.project.sources.map((s) => {
        if (s.id !== sourceId) return s;
        return {
          ...s,
          content: trimmed,
          summary: trimmed.slice(0, 140) + (trimmed.length > 140 ? '...' : ''),
        };
      });
      const updated: ProjectData = {
        ...state.project,
        sources: updatedSources,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  toggleSelectCard: (cardId, multi = true) => {
    set((state) => {
      const exists = state.selectedCardIds.includes(cardId);
      if (!multi) {
        return { selectedCardIds: exists ? [] : [cardId] };
      }
      return {
        selectedCardIds: exists
          ? state.selectedCardIds.filter((id) => id !== cardId)
          : [...state.selectedCardIds, cardId],
      };
    });
  },

  selectSingleCard: (cardId: string) => set({ selectedCardIds: [cardId] }),

  clearCardSelection: () => set({ selectedCardIds: [] }),

  updateCardPosition: (cardId, x, y) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId ? { ...c, position: { x: Math.round(x), y: Math.round(y) } } : c
      );
      const updated = { ...state.project, cards: updatedCards };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  updateCardSize: (cardId, width, height) => {
    set((state) => {
      const clampedWidth = Math.max(280, Math.min(860, Math.round(width)));
      const clampedHeight = height !== undefined ? Math.max(180, Math.min(920, Math.round(height))) : undefined;
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              dimensions: {
                width: clampedWidth,
                height: clampedHeight ?? c.dimensions?.height,
              },
            }
          : c
      );
      const updated = { ...state.project, cards: updatedCards };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  updateCardContent: (cardId, title, body, subtextOrVisualCue) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              title,
              body,
              subtextOrVisualCue: subtextOrVisualCue !== undefined ? subtextOrVisualCue : c.subtextOrVisualCue,
            }
          : c
      );
      const updated = { ...state.project, cards: updatedCards, updatedAt: new Date().toISOString() };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  updateCardColor: (cardId, color) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId ? { ...c, color } : c
      );
      const updated = { ...state.project, cards: updatedCards, updatedAt: new Date().toISOString() };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  assignCardToBeatAct: (cardId, act) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId ? { ...c, beatAct: act, isPinned: true } : c
      );
      const updatedBeats = state.project.beats.map((b) =>
        b.act === act && !b.linkedCardIds.includes(cardId)
          ? { ...b, linkedCardIds: [...b.linkedCardIds, cardId] }
          : b
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        beats: updatedBeats,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  removeCard: (cardId) => {
    set((state) => {
      const updatedGroups = (state.project.groups || [])
        .map((g) => ({
          ...g,
          cardIds: g.cardIds.filter((id) => id !== cardId),
        }))
        .filter((g) => g.cardIds.length > 0);

      const updated: ProjectData = {
        ...state.project,
        cards: state.project.cards.filter((c) => c.id !== cardId),
        connections: state.project.connections.filter(
          (conn) => conn.fromCardId !== cardId && conn.toCardId !== cardId
        ),
        groups: updatedGroups,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return {
        project: updated,
        selectedCardIds: state.selectedCardIds.filter((id) => id !== cardId),
        editingCardId: state.editingCardId === cardId ? null : state.editingCardId,
        activeCardChatId: state.activeCardChatId === cardId ? null : state.activeCardChatId,
        ultrafocusCardId: state.ultrafocusCardId === cardId ? null : state.ultrafocusCardId,
      };
    });
  },

  connectCards: (fromCardId, toCardId, label = 'Fio de Síntese', fromSide, toSide) => {
    if (!fromCardId || !toCardId || fromCardId === toCardId) return;
    set((state) => {
      const existingIdx = state.project.connections.findIndex(
        (c) =>
          (c.fromCardId === fromCardId && c.toCardId === toCardId) ||
          (c.fromCardId === toCardId && c.toCardId === fromCardId)
      );
      let nextConnections = [...state.project.connections];
      if (existingIdx >= 0) {
        nextConnections[existingIdx] = {
          ...nextConnections[existingIdx],
          fromCardId,
          toCardId,
          fromSide: fromSide ?? nextConnections[existingIdx].fromSide,
          toSide: toSide ?? nextConnections[existingIdx].toSide,
        };
      } else {
        nextConnections.push({
          id: `conn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fromCardId,
          toCardId,
          label,
          fromSide,
          toSide,
        });
      }
      const updated: ProjectData = {
        ...state.project,
        connections: nextConnections,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  reconnectConnection: (connectionId, fromCardId, toCardId, fromSide, toSide) => {
    if (!fromCardId || !toCardId || fromCardId === toCardId) return;
    set((state) => {
      const filtered = state.project.connections.filter(
        (c) =>
          c.id === connectionId ||
          !(
            (c.fromCardId === fromCardId && c.toCardId === toCardId) ||
            (c.fromCardId === toCardId && c.toCardId === fromCardId)
          )
      );
      const updatedConnections = filtered.map((c) =>
        c.id === connectionId
          ? {
              ...c,
              fromCardId,
              toCardId,
              fromSide,
              toSide,
            }
          : c
      );
      const updated: ProjectData = {
        ...state.project,
        connections: updatedConnections,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  removeConnection: (connectionId: string) => {
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        connections: state.project.connections.filter((c) => c.id !== connectionId),
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  updateConnectionLabel: (connectionId: string, label: string) => {
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        connections: state.project.connections.map((c) =>
          c.id === connectionId ? { ...c, label } : c
        ),
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },

  addManualCard: (title = '', body = '', position, lensId = 'free_provocation') => {
    const { project } = get();
    const count = project.cards.length;
    const newId = `card-note-${Date.now()}`;
    const newCard: InsightCard = {
      id: newId,
      lensId,
      title: title.trim() || 'Novo Insight',
      body: body.trim() || '',
      subtextOrVisualCue: '',
      position: position || {
        x: 120 + (count % 3) * 370,
        y: 100 + Math.floor(count / 3) * 300,
      },
      citations: [],
      tags: lensId === 'devils_advocate' ? ['Advogado do Diabo', 'Confronto Crítico'] : ['Insight do Autor'],
      isPinned: false,
      color: 'default',
      createdAt: new Date().toISOString(),
    };
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        cards: [...state.project.cards, newCard],
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return {
        project: updated,
        editingCardId: newId,
        selectedCardIds: [newId],
      };
    });
    return newId;
  },

  createCardGroup: (title, cardIds, color = 'amber') => {
    const newGroupId = `grp-${Date.now()}`;
    const newGroup: CardGroup = {
      id: newGroupId,
      title: title.trim() || 'Novo Grupo',
      color,
      cardIds: [...cardIds],
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        cardIds.includes(c.id) ? { ...c, groupId: newGroupId } : c
      );
      const existingGroups = state.project.groups || [];
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        groups: [...existingGroups, newGroup],
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });

    syncProjectToSupabase(get().project).catch(() => {});
    return newGroup;
  },

  removeCardGroup: (groupId) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.groupId === groupId ? { ...c, groupId: undefined } : c
      );
      const existingGroups = state.project.groups || [];
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        groups: existingGroups.filter((g) => g.id !== groupId),
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  updateCardGroup: (groupId, updates) => {
    set((state) => {
      const existingGroups = state.project.groups || [];
      const updatedGroups = existingGroups.map((g) =>
        g.id === groupId ? { ...g, ...updates } : g
      );
      const updated: ProjectData = {
        ...state.project,
        groups: updatedGroups,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  addCardsToGroup: (groupId, cardIds) => {
    set((state) => {
      const existingGroups = state.project.groups || [];
      const updatedGroups = existingGroups.map((g) => {
        if (g.id !== groupId) return g;
        const merged = Array.from(new Set([...g.cardIds, ...cardIds]));
        return { ...g, cardIds: merged };
      });
      const updatedCards = state.project.cards.map((c) =>
        cardIds.includes(c.id) ? { ...c, groupId } : c
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        groups: updatedGroups,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  removeCardFromGroup: (cardId) => {
    set((state) => {
      const existingGroups = state.project.groups || [];
      const updatedGroups = existingGroups
        .map((g) => ({
          ...g,
          cardIds: g.cardIds.filter((id) => id !== cardId),
        }))
        .filter((g) => g.cardIds.length > 0);

      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId ? { ...c, groupId: undefined } : c
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        groups: updatedGroups,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  toggleCardSeriesMemory: (cardId: string) => {
    set((state) => {
      const card = state.project.cards.find((c) => c.id === cardId);
      if (!card) return state;

      const nextStatus = !card.isCanonicalSeriesMemory;
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId ? { ...c, isCanonicalSeriesMemory: nextStatus } : c
      );

      // Sincroniza com o repositório de memória canônica da série
      let updatedSeriesContext = state.project.seriesContext;
      if (updatedSeriesContext) {
        const currentMemory = updatedSeriesContext.memory || {
          seriesId: updatedSeriesContext.seriesId || 'series-default',
          seriesTitle: updatedSeriesContext.seriesTitle || 'Série',
          loreRules: [],
          characters: [],
          canonicalEvents: [],
          unresolvedHooks: [],
          canonicalCards: [],
        };
        const canonicalCards = currentMemory.canonicalCards || [];
        let newCanonicalCards: InsightCard[];
        if (nextStatus) {
          const already = canonicalCards.some((c) => c.id === card.id);
          newCanonicalCards = already
            ? canonicalCards
            : [...canonicalCards, { ...card, isCanonicalSeriesMemory: true }];
        } else {
          newCanonicalCards = canonicalCards.filter((c) => c.id !== card.id);
        }
        updatedSeriesContext = {
          ...updatedSeriesContext,
          memory: {
            ...currentMemory,
            canonicalCards: newCanonicalCards,
          },
        };
      }

      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        seriesContext: updatedSeriesContext,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  importSeriesCardToCanvas: (card: InsightCard) => {
    set((state) => {
      const newId = `card-series-import-${Date.now()}`;
      const count = state.project.cards.length;
      const importedCard: InsightCard = {
        ...card,
        id: newId,
        isCanonicalSeriesMemory: true,
        tags: Array.from(new Set([...(card.tags || []), 'Memória da Série'])),
        position: {
          x: 180 + (count % 3) * 380,
          y: 160 + Math.floor(count / 3) * 320,
        },
        createdAt: new Date().toISOString(),
      };

      const updated: ProjectData = {
        ...state.project,
        cards: [...state.project.cards, importedCard],
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return {
        project: updated,
        selectedCardIds: [newId],
        editingCardId: newId,
      };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  addSeriesOpenHook: (description: string, originEpisodeTag?: string) => {
    set((state) => {
      if (!state.project.seriesContext) return state;
      const epLabel =
        originEpisodeTag ||
        `T${state.project.seriesContext.seasonNumber || 1}E${state.project.seriesContext.episodeNumber || 1}`;
      const newHook = {
        id: `hook-${Date.now()}`,
        originEpisodeTag: epLabel,
        hookText: description.trim(),
        resolved: false,
      };
      const currentMemory = state.project.seriesContext.memory || {
        seriesId: state.project.seriesContext.seriesId || 'series-default',
        seriesTitle: state.project.seriesContext.seriesTitle || 'Série',
        loreRules: [],
        characters: [],
        canonicalEvents: [],
        unresolvedHooks: [],
        canonicalCards: [],
      };
      const updatedSeriesContext: SeriesContext = {
        ...state.project.seriesContext,
        memory: {
          ...currentMemory,
          unresolvedHooks: [...(currentMemory.unresolvedHooks || []), newHook],
        },
      };
      const updated: ProjectData = {
        ...state.project,
        seriesContext: updatedSeriesContext,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  toggleSeriesOpenHook: (hookId: string) => {
    set((state) => {
      if (!state.project.seriesContext || !state.project.seriesContext.memory) return state;
      const currentMemory = state.project.seriesContext.memory;
      const currentEp = `T${state.project.seriesContext.seasonNumber || 1}E${state.project.seriesContext.episodeNumber || 1}`;
      const updatedHooks = (currentMemory.unresolvedHooks || []).map((h) =>
        h.id === hookId
          ? {
              ...h,
              resolved: !h.resolved,
              resolvedInEpisodeTag: !h.resolved ? currentEp : undefined,
            }
          : h
      );
      const updatedSeriesContext: SeriesContext = {
        ...state.project.seriesContext,
        memory: {
          ...currentMemory,
          unresolvedHooks: updatedHooks,
        },
      };
      const updated: ProjectData = {
        ...state.project,
        seriesContext: updatedSeriesContext,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  sendCardChatMessage: async (cardId, message, lensId = 'devils_advocate') => {
    const { project } = get();
    const card = project.cards.find((c) => c.id === cardId);
    if (!card || !message.trim()) return;

    const userMessage: CardChatMessage = {
      id: `msg-${Date.now()}-user`,
      sender: 'user',
      text: message.trim(),
      lensId,
      timestamp: new Date().toISOString(),
    };

    // Atualiza imediatamente com a pergunta do usuário e ativa o status de resposta
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              chatMessages: [...(c.chatMessages || []), userMessage],
            }
          : c
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return {
        project: updated,
        cardChatRunningId: cardId,
      };
    });

    try {
      const replyText = await chatWithCard({
        card,
        message,
        lensId,
        sources: project.sources,
        projectTitle: project.title,
        projectLogline: project.logline,
        history: card.chatMessages || [],
        seriesContext: project.seriesContext,
      });

      const assistantMessage: CardChatMessage = {
        id: `msg-${Date.now()}-ai`,
        sender: 'assistant',
        text: replyText,
        lensId,
        timestamp: new Date().toISOString(),
      };

      set((state) => {
        const updatedCards = state.project.cards.map((c) =>
          c.id === cardId
            ? {
                ...c,
                chatMessages: [...(c.chatMessages || []), assistantMessage],
              }
            : c
        );
        const updated: ProjectData = {
          ...state.project,
          cards: updatedCards,
          updatedAt: new Date().toISOString(),
        };
        persistProjectLocally(updated);
        return {
          project: updated,
          cardChatRunningId: null,
        };
      });

      await syncProjectToSupabase(get().project);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao responder no chat do card';
      set({ cardChatRunningId: null, errorBanner: errorMsg });
    }
  },

  clearCardChat: (cardId: string) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId ? { ...c, chatMessages: [] } : c
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  toggleRejectCardChatMessage: (cardId: string, messageId: string) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) => {
        if (c.id !== cardId) return c;
        const updatedMsgs = (c.chatMessages || []).map((m) =>
          m.id === messageId ? { ...m, isRejected: !m.isRejected } : m
        );
        return { ...c, chatMessages: updatedMsgs };
      });
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  toggleHideCardChatMessage: (cardId: string, messageId: string) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) => {
        if (c.id !== cardId) return c;
        const updatedMsgs = (c.chatMessages || []).map((m) =>
          m.id === messageId ? { ...m, isHidden: !m.isHidden } : m
        );
        return { ...c, chatMessages: updatedMsgs };
      });
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  deleteCardChatMessage: (cardId: string, messageId: string) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) => {
        if (c.id !== cardId) return c;
        const updatedMsgs = (c.chatMessages || []).filter((m) => m.id !== messageId);
        return { ...c, chatMessages: updatedMsgs };
      });
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
    syncProjectToSupabase(get().project).catch(() => {});
  },

  addCardAttachment: (cardId, attachmentData) => {
    const newAttachment: CardAttachment = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...attachmentData,
      createdAt: new Date().toISOString(),
    };

    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              attachments: [...(c.attachments || []), newAttachment],
            }
          : c
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });

    syncProjectToSupabase(get().project).catch(() => {});
    return newAttachment;
  },

  removeCardAttachment: (cardId, attachmentId) => {
    set((state) => {
      const updatedCards = state.project.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              attachments: (c.attachments || []).filter((a) => a.id !== attachmentId),
            }
          : c
      );
      const updated: ProjectData = {
        ...state.project,
        cards: updatedCards,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });

    syncProjectToSupabase(get().project).catch(() => {});
  },

  triggerCreativeLens: async (lensId, customPrompt) => {
    const { project } = get();
    set({ isSynthesizing: true, activeLensRunning: lensId, errorBanner: null });
    try {
      const newCards = await runCreativeLensSynthesis({
        lensId,
        sources: project.sources,
        existingCards: project.cards,
        customPrompt,
        projectTitle: project.title,
        projectLogline: project.logline,
        existingCardCount: project.cards.length,
        seriesContext: project.seriesContext,
      });

      set((state) => {
        const updated: ProjectData = {
          ...state.project,
          cards: [...state.project.cards, ...newCards],
          updatedAt: new Date().toISOString(),
        };
        persistProjectLocally(updated);
        return {
          project: updated,
          isSynthesizing: false,
          activeLensRunning: null,
          selectedCardIds: newCards.map((c) => c.id),
        };
      });

      await syncProjectToSupabase(get().project);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao executar lente criativa';
      set({ isSynthesizing: false, activeLensRunning: null, errorBanner: message });
    }
  },

  crossSelectedCards: async () => {
    const { project, selectedCardIds } = get();
    const selectedCards = project.cards.filter((c) => selectedCardIds.includes(c.id));
    if (selectedCards.length < 2) return;

    set({ isSynthesizing: true, activeLensRunning: 'card_synthesis', errorBanner: null });
    try {
      const synthesisPrompt = `Cruze diretamente estes ${selectedCards.length} insights do nosso Canvas e gere um Card de Fusão Narrativa mostrando como conectá-los em uma única cena ou virada de roteiro:\n${selectedCards
        .map((c, idx) => `[Card ${idx + 1}] ${c.title}: ${c.body}`)
        .join('\n')}`;

      const generated = await runCreativeLensSynthesis({
        lensId: 'card_synthesis',
        sources: project.sources,
        existingCards: project.cards,
        customPrompt: synthesisPrompt,
        projectTitle: project.title,
        projectLogline: project.logline,
        existingCardCount: project.cards.length,
        seriesContext: project.seriesContext,
      });

      const fusedCard = generated[0];
      if (fusedCard) {
        const avgX = selectedCards.reduce((acc, c) => acc + c.position.x, 0) / selectedCards.length;
        const avgY = selectedCards.reduce((acc, c) => acc + c.position.y, 0) / selectedCards.length + 220;
        fusedCard.position = { x: Math.round(avgX), y: Math.round(avgY) };

        const newConns = selectedCards.map((sc, i) => ({
          id: `conn-fusion-${Date.now()}-${i}`,
          fromCardId: sc.id,
          toCardId: fusedCard.id,
          label: 'Fusão Criativa',
        }));

        set((state) => {
          const updated: ProjectData = {
            ...state.project,
            cards: [...state.project.cards, fusedCard],
            connections: [...state.project.connections, ...newConns],
            updatedAt: new Date().toISOString(),
          };
          persistProjectLocally(updated);
          return {
            project: updated,
            isSynthesizing: false,
            activeLensRunning: null,
            selectedCardIds: [fusedCard.id],
          };
        });
      } else {
        set({ isSynthesizing: false, activeLensRunning: null });
      }
    } catch (err) {
      set({
        isSynthesizing: false,
        activeLensRunning: null,
        errorBanner: err instanceof Error ? err.message : 'Erro ao cruzar cards',
      });
    }
  },

  distillSelectedCardsToSource: (customTitle) => {
    const { project, selectedCardIds } = get();
    const cardsToDistill = project.cards.filter((c) => selectedCardIds.includes(c.id));
    if (cardsToDistill.length === 0) return null;

    const newSource = distillCardsIntoSource(cardsToDistill, customTitle);
    set((state) => {
      const updated: ProjectData = {
        ...state.project,
        sources: [newSource, ...state.project.sources],
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return {
        project: updated,
        selectedCardIds: [],
        syncStatusMessage: `Nova fonte destilada criada: "${newSource.title}"`,
      };
    });
    return newSource;
  },

  runAudioDebate: async (focusDirective) => {
    const { project } = get();
    set({ isSynthesizing: true, errorBanner: null });
    try {
      const { turns, audioDataUrl } = await generateWritersRoomDebate({
        sources: project.sources,
        focusDirective,
        projectTitle: project.title,
      });

      const session: AudioDebateSession = {
        id: `debate-${Date.now()}`,
        title: `Debate: ${focusDirective.slice(0, 42)}`,
        focusDirective,
        turns,
        audioDataUrl,
        createdAt: new Date().toISOString(),
      };

      set((state) => {
        const updated: ProjectData = {
          ...state.project,
          debates: [session, ...state.project.debates],
          updatedAt: new Date().toISOString(),
        };
        persistProjectLocally(updated);
        return { project: updated, isSynthesizing: false };
      });

      return session;
    } catch (err) {
      set({ isSynthesizing: false });
      throw err;
    }
  },

  updateBeatContent: (beatId, updates) => {
    set((state) => {
      const updatedBeats = state.project.beats.map((b) =>
        b.id === beatId ? { ...b, ...updates } : b
      );
      const updated: ProjectData = {
        ...state.project,
        beats: updatedBeats,
        updatedAt: new Date().toISOString(),
      };
      persistProjectLocally(updated);
      return { project: updated };
    });
  },
}));
