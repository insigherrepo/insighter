import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Ban,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Compass,
  Edit3,
  Eye,
  EyeOff,
  FileText,
  Focus,
  FolderMinus,
  FolderPlus,
  GitMerge,
  Image as ImageIcon,
  Link2,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Paperclip,
  Pin,
  Plus,
  Quote,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useInsighterStore } from '../store/useInsighterStore';
import { createProjectLiveChannel } from '../lib/supabase';
import { CREATIVE_LENSES } from '../services/geminiEngine';
import { BeatActId, CardColor, ConnectionPortSide, CreativeLensId, InsightCard, CanvasConnection } from '../types/insighter';

export function getCardPortPoint(
  card: InsightCard,
  side: ConnectionPortSide
): { x: number; y: number } {
  const w = card.dimensions?.width || 340;
  const h = card.dimensions?.height || 220;
  switch (side) {
    case 'top':
      return { x: card.position.x + w / 2, y: card.position.y };
    case 'bottom':
      return { x: card.position.x + w / 2, y: card.position.y + h };
    case 'left':
      return { x: card.position.x, y: card.position.y + h / 2 };
    case 'right':
      return { x: card.position.x + w, y: card.position.y + h / 2 };
  }
}

export function computeSmoothSpline(
  x1: number,
  y1: number,
  side1: ConnectionPortSide,
  x2: number,
  y2: number,
  side2: ConnectionPortSide
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;

  let cx1 = x1;
  let cy1 = y1;
  let cx2 = x2;
  let cy2 = y2;

  switch (side1) {
    case 'bottom':
      cy1 = y1 + Math.max(Math.abs(dy) * 0.48, 48);
      break;
    case 'top':
      cy1 = y1 - Math.max(Math.abs(dy) * 0.48, 48);
      break;
    case 'right':
      cx1 = x1 + Math.max(Math.abs(dx) * 0.48, 48);
      break;
    case 'left':
      cx1 = x1 - Math.max(Math.abs(dx) * 0.48, 48);
      break;
  }

  switch (side2) {
    case 'top':
      cy2 = y2 - Math.max(Math.abs(dy) * 0.48, 48);
      break;
    case 'bottom':
      cy2 = y2 + Math.max(Math.abs(dy) * 0.48, 48);
      break;
    case 'left':
      cx2 = x2 - Math.max(Math.abs(dx) * 0.48, 48);
      break;
    case 'right':
      cx2 = x2 + Math.max(Math.abs(dx) * 0.48, 48);
      break;
  }

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

export function resolveConnectionGeometry(
  fromCard: InsightCard,
  toCard: InsightCard,
  fixedFromSide?: ConnectionPortSide,
  fixedToSide?: ConnectionPortSide
): {
  fromSide: ConnectionPortSide;
  toSide: ConnectionPortSide;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pathD: string;
} {
  const fw = fromCard.dimensions?.width || 340;
  const fh = fromCard.dimensions?.height || 220;
  const tw = toCard.dimensions?.width || 340;
  const th = toCard.dimensions?.height || 220;

  const fcx = fromCard.position.x + fw / 2;
  const fcy = fromCard.position.y + fh / 2;
  const tcx = toCard.position.x + tw / 2;
  const tcy = toCard.position.y + th / 2;

  const dx = tcx - fcx;
  const dy = tcy - fcy;

  let fromSide = fixedFromSide;
  let toSide = fixedToSide;

  if (!fromSide || !toSide) {
    if (Math.abs(dy) >= Math.abs(dx) * 0.68) {
      if (dy > 0) {
        fromSide = fromSide || 'bottom';
        toSide = toSide || 'top';
      } else {
        fromSide = fromSide || 'top';
        toSide = toSide || 'bottom';
      }
    } else {
      if (dx > 0) {
        fromSide = fromSide || 'right';
        toSide = toSide || 'left';
      } else {
        fromSide = fromSide || 'left';
        toSide = toSide || 'right';
      }
    }
  }

  const p1 = getCardPortPoint(fromCard, fromSide);
  const p2 = getCardPortPoint(toCard, toSide);
  const pathD = computeSmoothSpline(p1.x, p1.y, fromSide, p2.x, p2.y, toSide);

  return {
    fromSide,
    toSide,
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    pathD,
  };
}

function computeLiveSpline(
  x1: number,
  y1: number,
  side1: ConnectionPortSide,
  x2: number,
  y2: number,
  side2?: ConnectionPortSide
): string {
  if (side2) {
    return computeSmoothSpline(x1, y1, side1, x2, y2, side2);
  }
  const dx = x2 - x1;
  const dy = y2 - y1;
  let cx1 = x1;
  let cy1 = y1;

  switch (side1) {
    case 'bottom':
      cy1 = y1 + Math.max(Math.abs(dy) * 0.45, 45);
      break;
    case 'top':
      cy1 = y1 - Math.max(Math.abs(dy) * 0.45, 45);
      break;
    case 'right':
      cx1 = x1 + Math.max(Math.abs(dx) * 0.45, 45);
      break;
    case 'left':
      cx1 = x1 - Math.max(Math.abs(dx) * 0.45, 45);
      break;
  }

  const cx2 = x2;
  const cy2 = y2;
  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

const BEAT_ACT_LABELS: { id: BeatActId; label: string }[] = [
  { id: 'hook_0_30s', label: '🎣 Gancho (0-30s)' },
  { id: 'act_1_setup', label: 'Ato I: Setup' },
  { id: 'act_2_escalation', label: 'Ato II: Escalada' },
  { id: 'midpoint_twist', label: '⚡ Virada Central' },
  { id: 'act_3_climax', label: 'Ato III: Clímax' },
];

export const InfiniteCanvas: React.FC = () => {
  const {
    project,
    selectedCardIds,
    editingCardId,
    toggleSelectCard,
    selectSingleCard,
    clearCardSelection,
    setEditingCardId,
    updateCardPosition,
    updateCardSize,
    updateCardContent,
    updateCardColor,
    createCardGroup,
    removeCardGroup,
    updateCardGroup,
    sendCardChatMessage,
    cardChatRunningId,
    assignCardToBeatAct,
    removeCard,
    connectCards,
    reconnectConnection,
    removeConnection,
    updateConnectionLabel,
    addManualCard,
    setActiveCitation,
    distillSelectedCardsToSource,
    crossSelectedCards,
    triggerCreativeLens,
    updateProjectMeta,
    resetToDemoProject,
    isSynthesizing,
    investigativeMode,
    focusedInvestigativeCardId,
    setInvestigativeMode,
    setFocusedInvestigativeCardId,
    addCardAttachment,
    removeCardAttachment,
    toggleCardSeriesMemory,
    importSeriesCardToCanvas,
    addSeriesOpenHook,
    toggleSeriesOpenHook,
    clearCardChat,
    toggleRejectCardChatMessage,
    toggleHideCardChatMessage,
    deleteCardChatMessage,
    ultrafocusCardId,
    setUltrafocusCardId,
    saveCanvasViewport,
    isLivePresenter,
    isLiveFollowing,
    livePresenterName,
    startLiveMeeting,
    stopLiveMeeting,
    toggleLiveFollow,
    applyRemoteProjectUpdate,
  } = useInsighterStore();

  const [pan, setPan] = useState(() => project.viewport?.pan || { x: 30, y: 20 });
  const [zoom, setZoom] = useState(() => project.viewport?.zoom || 1);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [connectingFromSide, setConnectingFromSide] = useState<ConnectionPortSide | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number } | null>(null);
  const [connectingHoverTargetId, setConnectingHoverTargetId] = useState<string | null>(null);
  const [connectingHoverTargetSide, setConnectingHoverTargetSide] = useState<ConnectionPortSide | null>(null);
  const [reconnectingConnectionId, setReconnectingConnectionId] = useState<string | null>(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [isDraggingWire, setIsDraggingWire] = useState(false);
  const connectingFromIdRef = useRef<string | null>(null);
  const connectingFromSideRef = useRef<ConnectionPortSide | null>(null);
  const reconnectingConnectionIdRef = useRef<string | null>(null);
  const isDraggingWireRef = useRef<boolean>(false);
  const wireDragStartPosRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const [starterIdea, setStarterIdea] = useState('');
  const [openChatCardIds, setOpenChatCardIds] = useState<string[]>([]);
  const [cardChatInputs, setCardChatInputs] = useState<Record<string, string>>({});
  const [cardChatLens, setCardChatLens] = useState<Record<string, CreativeLensId>>({});
  const [attachmentModalCardId, setAttachmentModalCardId] = useState<string | null>(null);
  const [textSnippetText, setTextSnippetText] = useState('');
  const [textSnippetTitle, setTextSnippetTitle] = useState('');
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);
  const [hideRejectedByCard, setHideRejectedByCard] = useState<Record<string, boolean>>({});
  const [lastActiveCardId, setLastActiveCardId] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragCardRef = useRef<{ id: string; startX: number; startY: number; cardX: number; cardY: number } | null>(null);
  const resizeStateRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const liveChannelRef = useRef<ReturnType<typeof createProjectLiveChannel> | null>(null);
  const isLivePresenterRef = useRef(isLivePresenter);
  isLivePresenterRef.current = isLivePresenter;
  const isLiveFollowingRef = useRef(isLiveFollowing);
  isLiveFollowingRef.current = isLiveFollowing;

  // 1. Restaura a posição e zoom salvos do brainstorm quando abrir ou trocar de projeto
  const lastLoadedProjectIdRef = useRef(project.id);
  useEffect(() => {
    if (lastLoadedProjectIdRef.current !== project.id) {
      lastLoadedProjectIdRef.current = project.id;
      if (project.viewport) {
        setPan(project.viewport.pan);
        setZoom(project.viewport.zoom);
        panRef.current = project.viewport.pan;
        zoomRef.current = project.viewport.zoom;
      }
    }
  }, [project.id, project.viewport]);

  // 2. Grava a posição e zoom do canvas com debounce durante a navegação
  useEffect(() => {
    const timer = setTimeout(() => {
      saveCanvasViewport(pan, zoom);
    }, 280);
    return () => clearTimeout(timer);
  }, [pan, zoom, saveCanvasViewport]);

  // 3. Ao sair do brainstorm (desmontagem do canvas), grava com certeza a última posição e zoom da tela
  useEffect(() => {
    return () => {
      saveCanvasViewport(panRef.current, zoomRef.current);
    };
  }, [saveCanvasViewport]);

  // 4. Conexão ao Canal de Reunião Ao Vivo (Realtime Broadcast + BroadcastChannel local)
  useEffect(() => {
    const channel = createProjectLiveChannel(
      project.id,
      (payload) => {
        // Se eu sou colaborador e estou no modo seguir: replica a tela do apresentador em tempo real
        if (!isLivePresenterRef.current && isLiveFollowingRef.current) {
          setPan(payload.pan);
          setZoom(payload.zoom);
          panRef.current = payload.pan;
          zoomRef.current = payload.zoom;
          if (payload.ultrafocusCardId !== undefined) {
            setUltrafocusCardId(payload.ultrafocusCardId);
          }
        }
      },
      (remoteProj) => {
        // Replica alterações de cards, textos e conexões feitas pelo apresentador
        if (!isLivePresenterRef.current) {
          applyRemoteProjectUpdate(remoteProj);
        }
      }
    );
    liveChannelRef.current = channel;

    return () => {
      channel.leave();
      liveChannelRef.current = null;
    };
  }, [project.id, applyRemoteProjectUpdate, setUltrafocusCardId]);

  // 5. Se eu sou o apresentador, sempre que mexo no pan, zoom ou ultrafoco, transmito imediatamente para os outros
  useEffect(() => {
    if (isLivePresenter && liveChannelRef.current) {
      liveChannelRef.current.broadcastMeetingState({
        presenterEmail: project.ownerEmail || 'me',
        presenterName: livePresenterName || 'Apresentador',
        pan,
        zoom,
        ultrafocusCardId,
      });
    }
  }, [isLivePresenter, livePresenterName, pan, zoom, ultrafocusCardId, project.ownerEmail]);

  // 6. Se eu sou o apresentador, sempre que modifico o projeto (cards, conexões), replico na tela dos outros
  useEffect(() => {
    if (isLivePresenter && liveChannelRef.current) {
      liveChannelRef.current.broadcastProjectUpdate(project);
    }
  }, [isLivePresenter, project]);

  const zoomAroundCenter = useCallback((deltaZoom: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const pivotX = rect.width / 2;
    const pivotY = rect.height / 2;

    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    let targetZoom = currentZoom + deltaZoom;
    targetZoom = Math.min(2.5, Math.max(0.3, Math.round(targetZoom * 100) / 100));
    if (targetZoom === currentZoom) return;

    const worldX = (pivotX - currentPan.x) / currentZoom;
    const worldY = (pivotY - currentPan.y) / currentZoom;

    const newPanX = Math.round(pivotX - worldX * targetZoom);
    const newPanY = Math.round(pivotY - worldY * targetZoom);

    setZoom(targetZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  const fitAllCardsInView = useCallback(() => {
    if (project.cards.length === 0) {
      setPan({ x: 30, y: 20 });
      setZoom(1);
      return;
    }

    const viewport = viewportRef.current;
    const vpWidth = viewport ? viewport.clientWidth : window.innerWidth;
    const vpHeight = viewport ? viewport.clientHeight : window.innerHeight;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    project.cards.forEach((card) => {
      const w = card.dimensions?.width || 340;
      const h = card.dimensions?.height || 220;
      if (card.position.x < minX) minX = card.position.x;
      if (card.position.y < minY) minY = card.position.y;
      if (card.position.x + w > maxX) maxX = card.position.x + w;
      if (card.position.y + h > maxY) maxY = card.position.y + h;
    });

    const padding = 100;
    const boundsWidth = Math.max(200, maxX - minX + padding * 2);
    const boundsHeight = Math.max(200, maxY - minY + padding * 2);

    const targetZoom = Math.min(
      1.6,
      Math.max(0.35, Math.min(vpWidth / boundsWidth, vpHeight / boundsHeight))
    );

    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;

    const newPanX = Math.round(vpWidth / 2 - centerX * targetZoom);
    const newPanY = Math.round(vpHeight / 2 - centerY * targetZoom);

    setZoom(Number(targetZoom.toFixed(2)));
    setPan({ x: newPanX, y: newPanY });
  }, [project.cards]);

  // Estados da Gaveta de Memória Persistente da Série
  const [showSeriesMemoryDrawer, setShowSeriesMemoryDrawer] = useState(false);
  const [seriesDrawerTab, setSeriesDrawerTab] = useState<'cards' | 'hooks' | 'lore'>('cards');
  const [seriesCardSearch, setSeriesCardSearch] = useState('');
  const [newHookText, setNewHookText] = useState('');

  const seriesCtx = project.seriesContext;
  const parentCards = seriesCtx?.parentCards || [];
  const canonicalMemCards = seriesCtx?.memory?.canonicalCards || [];
  const allSeriesCards = [...canonicalMemCards, ...parentCards].filter(
    (c, i, arr) => arr.findIndex((item) => item.id === c.id || item.title === c.title) === i
  );
  const filteredSeriesCards = seriesCardSearch.trim()
    ? allSeriesCards.filter(
        (c) =>
          c.title.toLowerCase().includes(seriesCardSearch.toLowerCase()) ||
          c.body.toLowerCase().includes(seriesCardSearch.toLowerCase())
      )
    : allSeriesCards;

  const seriesHooks = seriesCtx?.memory?.unresolvedHooks || [];
  const pendingHooks = seriesHooks.filter((h) => !h.resolved);

  const toggleCardChat = (cardId: string) => {
    setOpenChatCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    );
  };

  const navigateToConnectedCard = (targetCard: InsightCard) => {
    if (!investigativeMode) {
      setInvestigativeMode(true);
    }
    setFocusedInvestigativeCardId(targetCard.id);
    setLastActiveCardId(targetCard.id);
    selectSingleCard(targetCard.id);

    if (!viewportRef.current) {
      return;
    }
    const rect = viewportRef.current.getBoundingClientRect();
    const targetPanX = rect.width / 2 - (targetCard.position.x + (targetCard.dimensions?.width || 340) / 2) * zoom;
    const targetPanY = rect.height / 2 - (targetCard.position.y + (targetCard.dimensions?.height || 220) / 2) * zoom;

    const startX = pan.x;
    const startY = pan.y;
    const distance = Math.hypot(targetPanX - startX, targetPanY - startY);

    // Se o card já estiver praticamente centralizado na visão do usuário, não força animação de pan
    if (distance < 70) {
      return;
    }

    const startTime = performance.now();
    const duration = 460;

    const animatePan = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      setPan({
        x: Math.round(startX + (targetPanX - startX) * ease),
        y: Math.round(startY + (targetPanY - startY) * ease),
      });
      if (progress < 1) {
        requestAnimationFrame(animatePan);
      } else {
        setFocusedInvestigativeCardId(targetCard.id);
      }
    };
    requestAnimationFrame(animatePan);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInputActive =
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      // Atalhos de Zoom no Canvas: Cmd + "+" / Cmd + "=" e Cmd + "-" / Cmd + "_"
      if (e.metaKey || e.ctrlKey) {
        const isZoomIn =
          e.key === '+' ||
          e.key === '=' ||
          e.code === 'Equal' ||
          e.code === 'NumpadAdd';
        const isZoomOut =
          e.key === '-' ||
          e.key === '_' ||
          e.code === 'Minus' ||
          e.code === 'NumpadSubtract';
        const isZoomReset =
          (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') &&
          !e.shiftKey;
        const isZoomFit =
          (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') &&
          e.shiftKey;

        if (isZoomIn) {
          e.preventDefault();
          zoomAroundCenter(0.15);
          return;
        }
        if (isZoomOut) {
          e.preventDefault();
          zoomAroundCenter(-0.15);
          return;
        }
        if (isZoomReset) {
          e.preventDefault();
          setZoom(1);
          return;
        }
        if (isZoomFit) {
          e.preventDefault();
          fitAllCardsInView();
          return;
        }
      }

      if (e.code === 'Space' && !isInputActive && !e.repeat) {
        setIsSpacePressed(true);
      }

      if (e.key === 'Escape') {
        if (ultrafocusCardId) {
          setUltrafocusCardId(null);
          return;
        }
        if (selectedConnectionId) {
          setSelectedConnectionId(null);
          return;
        }
        if (showSeriesMemoryDrawer) {
          setShowSeriesMemoryDrawer(false);
          return;
        }
        if (previewAttachmentUrl) {
          setPreviewAttachmentUrl(null);
          return;
        }
        if (connectingFromIdRef.current) {
          cancelConnection();
          return;
        }
        if (focusedInvestigativeCardId) {
          setFocusedInvestigativeCardId(null);
          return;
        }
        if (attachmentModalCardId) {
          setAttachmentModalCardId(null);
          return;
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputActive) {
        if (selectedConnectionId) {
          e.preventDefault();
          removeConnection(selectedConnectionId);
          setSelectedConnectionId(null);
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    connectingFromId,
    focusedInvestigativeCardId,
    previewAttachmentUrl,
    attachmentModalCardId,
    showSeriesMemoryDrawer,
    zoomAroundCenter,
    fitAllCardsInView,
  ]);

  // Integração com os atalhos de menu nativos do macOS no Desktop (Visualizar > Zoom In / Out / Reset / Fit)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.insighterDesktop) return;
    const unsubs: Array<(() => void) | undefined> = [];

    if (window.insighterDesktop.onZoomIn) {
      unsubs.push(window.insighterDesktop.onZoomIn(() => zoomAroundCenter(0.15)));
    }
    if (window.insighterDesktop.onZoomOut) {
      unsubs.push(window.insighterDesktop.onZoomOut(() => zoomAroundCenter(-0.15)));
    }
    if (window.insighterDesktop.onZoomReset) {
      unsubs.push(window.insighterDesktop.onZoomReset(() => setZoom(1)));
    }
    if (window.insighterDesktop.onZoomFit) {
      unsubs.push(window.insighterDesktop.onZoomFit(() => fitAllCardsInView()));
    }

    return () => {
      unsubs.forEach((unsub) => unsub && unsub());
    };
  }, [zoomAroundCenter, fitAllCardsInView]);

  const handleFileUpload = (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      addCardAttachment(cardId, {
        type: isImg ? 'image' : isPdf ? 'pdf_snippet' : 'text_snippet',
        title: file.name,
        fileName: file.name,
        fileSize: file.size,
        dataUrl,
      });
      setAttachmentModalCardId(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCardPaste = (cardId: string, e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            addCardAttachment(cardId, {
              type: 'image',
              title: `Print ${new Date().toLocaleTimeString('pt-BR')}`,
              dataUrl,
              fileName: `print-${Date.now()}.png`,
            });
          };
          reader.readAsDataURL(blob);
        }
        return;
      }
    }
  };

  // Zoom suave com Scroll do Mouse ou Gesto de Pinça no Canvas
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;

      // Se o cursor estiver sobre um container com rolagem interna (chat, textarea, vislumbre, lightbox),
      // verifica se o elemento possui espaço para rolar verticalmente. Se sim, preserva a rolagem natural,
      // a menos que o usuário esteja segurando Ctrl/Cmd (pinça de zoom no trackpad).
      const scrollable = target.closest(
        '.card-chat-history, .beat-textarea, .card-expanded-vislumbre, .citation-drawer-body, .collaborators-list, .canvas-lightbox-backdrop'
      ) as HTMLElement | null;

      if (scrollable && !e.ctrlKey && !e.metaKey) {
        const canScrollDown = scrollable.scrollTop + scrollable.clientHeight < scrollable.scrollHeight - 1;
        const canScrollUp = scrollable.scrollTop > 1;
        if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
          return;
        }
      }

      e.preventDefault();

      const currentZoom = zoomRef.current;
      const currentPan = panRef.current;
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 1. PINCH-TO-ZOOM / CTRL/CMD + WHEEL: Zoom suave centrado no cursor
      if (e.ctrlKey || e.metaKey) {
        const worldX = (mouseX - currentPan.x) / currentZoom;
        const worldY = (mouseY - currentPan.y) / currentZoom;

        let delta = e.deltaY;
        if (e.deltaMode === 1) delta *= 24;
        else if (e.deltaMode === 2) delta *= 400;

        const clampedDelta = Math.max(-120, Math.min(120, delta));
        const factor = Math.exp(-clampedDelta * 0.003);
        let newZoom = currentZoom * factor;
        newZoom = Math.min(2.5, Math.max(0.3, Math.round(newZoom * 100) / 100));

        if (newZoom !== currentZoom) {
          const newPanX = Math.round(mouseX - worldX * newZoom);
          const newPanY = Math.round(mouseY - worldY * newZoom);
          setZoom(newZoom);
          setPan({ x: newPanX, y: newPanY });
        }
        return;
      }

      // 2. PAN LIVRE 2D NO TRACKPAD / MOUSE (Sem travas de limite nem de direção)
      let dx = e.deltaX;
      let dy = e.deltaY;
      if (e.deltaMode === 1) {
        dx *= 24;
        dy *= 24;
      } else if (e.deltaMode === 2) {
        dx *= 400;
        dy *= 400;
      }

      // Shift + scroll converte movimento vertical em horizontal
      if (e.shiftKey && dx === 0) {
        dx = dy;
        dy = 0;
      }

      setPan({
        x: Math.round(currentPan.x - dx),
        y: Math.round(currentPan.y - dy),
      });
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const cancelConnection = () => {
    connectingFromIdRef.current = null;
    connectingFromSideRef.current = null;
    reconnectingConnectionIdRef.current = null;
    isDraggingWireRef.current = false;
    wireDragStartPosRef.current = null;
    setConnectingFromId(null);
    setConnectingFromSide(null);
    setConnectingMousePos(null);
    setConnectingHoverTargetId(null);
    setConnectingHoverTargetSide(null);
    setReconnectingConnectionId(null);
    setIsDraggingWire(false);
  };

  const finalizeConnection = (targetCardId: string, targetSide?: ConnectionPortSide) => {
    const fromId = connectingFromIdRef.current;
    const fromSide = connectingFromSideRef.current || undefined;
    const recId = reconnectingConnectionIdRef.current;

    if (fromId && targetCardId && fromId !== targetCardId) {
      if (recId) {
        reconnectConnection(recId, fromId, targetCardId, fromSide, targetSide);
      } else {
        connectCards(fromId, targetCardId, 'Fio de Síntese', fromSide, targetSide);
      }
    }
    cancelConnection();
  };

  const startConnection = (
    cardId: string,
    side: ConnectionPortSide = 'bottom',
    clientX?: number,
    clientY?: number,
    isDrag = false
  ) => {
    connectingFromIdRef.current = cardId;
    connectingFromSideRef.current = side;
    reconnectingConnectionIdRef.current = null;
    isDraggingWireRef.current = isDrag;
    if (clientX !== undefined && clientY !== undefined) {
      wireDragStartPosRef.current = { clientX, clientY };
    } else {
      wireDragStartPosRef.current = null;
    }
    setConnectingFromId(cardId);
    setConnectingFromSide(side);
    setReconnectingConnectionId(null);
    setIsDraggingWire(isDrag);

    const c = project.cards.find((card) => card.id === cardId);
    if (c) {
      const portPt = getCardPortPoint(c, side);
      setConnectingMousePos(portPt);
    }
  };

  const handleExistingConnectionHandleMouseDown = (
    e: React.MouseEvent,
    conn: CanvasConnection,
    endToMove: 'from' | 'to'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (endToMove === 'to') {
      const fromCard = project.cards.find((c) => c.id === conn.fromCardId);
      if (!fromCard) return;
      const startSide = conn.fromSide || 'bottom';
      const startPt = getCardPortPoint(fromCard, startSide);

      reconnectingConnectionIdRef.current = conn.id;
      connectingFromIdRef.current = conn.fromCardId;
      connectingFromSideRef.current = startSide;
      isDraggingWireRef.current = true;
      wireDragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };

      setReconnectingConnectionId(conn.id);
      setConnectingFromId(conn.fromCardId);
      setConnectingFromSide(startSide);
      setIsDraggingWire(true);
      setConnectingMousePos(startPt);
    } else {
      const toCard = project.cards.find((c) => c.id === conn.toCardId);
      if (!toCard) return;
      const startSide = conn.toSide || 'top';
      const startPt = getCardPortPoint(toCard, startSide);

      reconnectingConnectionIdRef.current = conn.id;
      connectingFromIdRef.current = conn.toCardId;
      connectingFromSideRef.current = startSide;
      isDraggingWireRef.current = true;
      wireDragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };

      setReconnectingConnectionId(conn.id);
      setConnectingFromId(conn.toCardId);
      setConnectingFromSide(startSide);
      setIsDraggingWire(true);
      setConnectingMousePos(startPt);
    }
  };

  const handleViewportMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        '.insight-card, .creative-dock, .distill-floating-bar, .canvas-hud, .empty-canvas-studio, .connection-active-banner, .canvas-connection-pill, .canvas-line-action-pill'
      )
    ) {
      return;
    }
    setSelectedConnectionId(null);
    setHoveredConnectionId(null);
    if (connectingFromIdRef.current) {
      cancelConnection();
      return;
    }
    if (e.button === 0 || e.button === 1 || isSpacePressed) {
      setEditingCardId(null);
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  // Duplo-clique em qualquer lugar vazio do Canvas cria um novo card de Insight exatamente ali (sem limites artificiais)
  const handleViewportDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest(
        '.insight-card, .creative-dock, .distill-floating-bar, .canvas-hud, .empty-canvas-studio, .connection-active-banner, .canvas-connection-pill, .canvas-line-action-pill'
      )
    ) {
      return;
    }
    const rect = viewportRef.current?.getBoundingClientRect();
    const clickX = rect ? (e.clientX - rect.left - pan.x) / zoom : 180;
    const clickY = rect ? (e.clientY - rect.top - pan.y) / zoom : 140;
    addManualCard('Novo Insight', '', {
      x: Math.round(clickX - 160),
      y: Math.round(clickY - 60),
    });
  };

  // Listeners globais na janela para arrasto, pan e criação de conexões sem perda de foco
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      // 1. Atualização do fio de conexão enquanto conecta ou arrasta conector
      if (connectingFromIdRef.current && viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const currentZoom = zoomRef.current;
        const currentPan = panRef.current;
        const worldX = Math.round((e.clientX - rect.left - currentPan.x) / currentZoom);
        const worldY = Math.round((e.clientY - rect.top - currentPan.y) / currentZoom);
        setConnectingMousePos({ x: worldX, y: worldY });

        // Identifica porta ou card candidato sob o cursor
        const elem = document.elementFromPoint(e.clientX, e.clientY);
        const portEl = elem?.closest('.card-connect-port') as HTMLElement | null;
        const cardEl = elem?.closest('.insight-card') as HTMLElement | null;

        if (portEl) {
          const parentCard = portEl.closest('.insight-card');
          const targetId = parentCard?.getAttribute('data-card-id');
          const side = (portEl.getAttribute('data-port-side') as ConnectionPortSide) || null;
          if (targetId && targetId !== connectingFromIdRef.current) {
            setConnectingHoverTargetId(targetId);
            setConnectingHoverTargetSide(side);
          } else {
            setConnectingHoverTargetId(null);
            setConnectingHoverTargetSide(null);
          }
        } else if (cardEl) {
          const targetId = cardEl.getAttribute('data-card-id');
          if (targetId && targetId !== connectingFromIdRef.current) {
            setConnectingHoverTargetId(targetId);
            setConnectingHoverTargetSide(null);
          } else {
            setConnectingHoverTargetId(null);
            setConnectingHoverTargetSide(null);
          }
        } else {
          setConnectingHoverTargetId(null);
          setConnectingHoverTargetSide(null);
        }
      }

      // 2. Arrasto de Card
      if (dragCardRef.current) {
        const { id, startX, startY, cardX, cardY } = dragCardRef.current;
        const currentZoom = zoomRef.current;
        const dx = (e.clientX - startX) / currentZoom;
        const dy = (e.clientY - startY) / currentZoom;
        updateCardPosition(id, Math.round(cardX + dx), Math.round(cardY + dy));
        return;
      }

      // 3. Pan de Tela
      if (isPanning && panStartRef.current) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      // Se estava arrastando o fio conector
      if (isDraggingWireRef.current && connectingFromIdRef.current) {
        const startPos = wireDragStartPosRef.current;
        const dragDist = startPos
          ? Math.hypot(e.clientX - startPos.clientX, e.clientY - startPos.clientY)
          : 0;

        const elem = document.elementFromPoint(e.clientX, e.clientY);
        const portEl = elem?.closest('.card-connect-port') as HTMLElement | null;
        const cardEl = elem?.closest('.insight-card') as HTMLElement | null;
        const portSide = (portEl?.getAttribute('data-port-side') as ConnectionPortSide) || undefined;
        const targetId =
          portEl?.closest('.insight-card')?.getAttribute('data-card-id') ||
          cardEl?.getAttribute('data-card-id');

        isDraggingWireRef.current = false;
        wireDragStartPosRef.current = null;

        // Se arrastou mais de 8px e soltou:
        if (dragDist > 8) {
          if (targetId && targetId !== connectingFromIdRef.current) {
            finalizeConnection(targetId, portSide);
          } else {
            if (reconnectingConnectionIdRef.current) {
              removeConnection(reconnectingConnectionIdRef.current);
            }
            cancelConnection();
          }
          return;
        } else {
          // Foi clique simples (<= 8px): mantém o modo de conexão aberto para o clique no destino!
          return;
        }
      }

      setIsPanning(false);
      setIsDraggingCard(false);
      panStartRef.current = null;
      dragCardRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, isDraggingCard, updateCardPosition, connectCards, reconnectConnection, removeConnection]);

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (connectingFromIdRef.current && viewportRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      setConnectingMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }
  };

  const handleViewportMouseUp = () => {
    setIsPanning(false);
    setIsDraggingCard(false);
    panStartRef.current = null;
    dragCardRef.current = null;
  };

  const startCardDrag = (e: React.MouseEvent, card: InsightCard) => {
    if (
      (e.target as HTMLElement).closest(
        'button, select, input, textarea, .card-resize-handle, .card-connect-port, .card-connecting-overlay'
      )
    ) {
      return;
    }
    e.stopPropagation();
    dragCardRef.current = {
      id: card.id,
      startX: e.clientX,
      startY: e.clientY,
      cardX: card.position.x,
      cardY: card.position.y,
    };
    setIsDraggingCard(true);
  };

  const handlePortMouseDown = (e: React.MouseEvent, cardId: string, side: ConnectionPortSide) => {
    e.stopPropagation();
    e.preventDefault();

    // Se já estava conectando de outro card e clicou/soltou no conector deste card:
    if (connectingFromIdRef.current && connectingFromIdRef.current !== cardId) {
      finalizeConnection(cardId, side);
      return;
    }

    if (connectingFromIdRef.current === cardId && !isDraggingWireRef.current) {
      cancelConnection();
      return;
    }

    const c = project.cards.find((card) => card.id === cardId);
    const portPt = c ? getCardPortPoint(c, side) : { x: 0, y: 0 };

    connectingFromIdRef.current = cardId;
    connectingFromSideRef.current = side;
    reconnectingConnectionIdRef.current = null;
    isDraggingWireRef.current = true;
    wireDragStartPosRef.current = { clientX: e.clientX, clientY: e.clientY };
    setConnectingFromId(cardId);
    setConnectingFromSide(side);
    setReconnectingConnectionId(null);
    setIsDraggingWire(true);
    setConnectingMousePos(portPt);
  };

  const handleConnectClick = (cardId: string) => {
    if (!connectingFromIdRef.current) {
      startConnection(cardId, 'bottom');
    } else {
      if (connectingFromIdRef.current !== cardId) {
        finalizeConnection(cardId);
      } else {
        cancelConnection();
      }
    }
  };

  // Handlers para redimensionamento de card
  const resizeCardRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  const handleResizePointerDown = (e: React.PointerEvent<HTMLDivElement>, card: InsightCard) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const startW = card.dimensions?.width ?? 340;
    const startH = card.dimensions?.height ?? 220;
    resizeCardRef.current = {
      cardId: card.id,
      startX: e.clientX,
      startY: e.clientY,
      startWidth: startW,
      startHeight: startH,
    };
  };

  const handleResizePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeCardRef.current) return;
    const { cardId, startX, startY, startWidth, startHeight } = resizeCardRef.current;
    const currentZoom = zoomRef.current;
    const dx = (e.clientX - startX) / currentZoom;
    const dy = (e.clientY - startY) / currentZoom;
    updateCardSize(cardId, startWidth + dx, startHeight + dy);
  };

  const handleResizeLostCapture = () => {
    resizeCardRef.current = null;
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, card: InsightCard) => {
    const curW = card.dimensions?.width ?? 340;
    const curH = card.dimensions?.height ?? 220;
    const step = e.shiftKey ? 40 : 15;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      updateCardSize(card.id, curW + step, curH);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      updateCardSize(card.id, curW - step, curH);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateCardSize(card.id, curW, curH + step);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateCardSize(card.id, curW, curH - step);
    }
  };

  const handleStarterBrainstorm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!starterIdea.trim() || isSynthesizing) return;
    if (project.title === 'Novo Roteiro Sem Título') {
      updateProjectMeta(starterIdea.slice(0, 48), starterIdea);
    }
    await triggerCreativeLens('free_provocation', starterIdea);
    setStarterIdea('');
  };

  return (
    <div
      ref={viewportRef}
      className={`canvas-viewport ${isPanning ? 'panning' : ''} ${isSpacePressed ? 'space-pan' : ''} ${connectingFromId ? 'connecting-active' : ''}`}
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${28 * zoom}px ${28 * zoom}px`,
        cursor: isPanning ? 'grabbing' : isSpacePressed ? 'grab' : undefined,
      }}
      onMouseDown={handleViewportMouseDown}
      onDoubleClick={handleViewportDoubleClick}
      onMouseMove={handleViewportMouseMove}
      onMouseUp={handleViewportMouseUp}
    >
      {/* Banner Superior de Conexão Ativa com Feedback Claro */}
      {connectingFromId && (
        <div className="connection-active-banner">
          <Link2 size={15} className="spin" style={{ color: 'var(--accent-amber)' }} />
          <span>
            Conectando a partir de{' '}
            <strong>
              "{project.cards.find((c) => c.id === connectingFromId)?.title.slice(0, 36) || 'Card'}"
            </strong>{' '}
            — Arraste o fio até outro card ou clique no destino
          </span>
          <button
            type="button"
            className="btn-studio"
            onClick={() => {
              setConnectingFromId(null);
              setConnectingMousePos(null);
              setConnectingHoverTargetId(null);
              setIsDraggingWire(false);
              wireDragStartPosRef.current = null;
            }}
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
          >
            Cancelar (Esc)
          </button>
        </div>
      )}

      {/* Barra Temática do Modo Investigativo (Detective Board) */}
      {investigativeMode && (
        <div className="investigative-status-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={15} style={{ color: 'var(--accent-amber)' }} />
            <span>
              <strong>Modo Investigativo:</strong>{' '}
              {focusedInvestigativeCardId ? (
                <>
                  Foco em "
                  <strong>
                    {project.cards.find((c) => c.id === focusedInvestigativeCardId)?.title.slice(0, 32) || 'Card'}
                  </strong>
                  " — Conexões destacadas, ruído esmaecido. Clique nos cards conectados para navegar.
                </>
              ) : (
                'Clique em qualquer card ou no ícone de Vislumbre (👁️) para focar na rede de conexões e evidências.'
              )}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {focusedInvestigativeCardId && (
              <button
                type="button"
                className="btn-studio"
                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                onClick={() => setFocusedInvestigativeCardId(null)}
              >
                Liberar Foco (Esc)
              </button>
            )}
            <button
              type="button"
              className="btn-studio"
              style={{ padding: '3px 8px', fontSize: '0.72rem' }}
              onClick={() => {
                setInvestigativeMode(false);
                setFocusedInvestigativeCardId(null);
              }}
            >
              Sair
            </button>
          </div>
        </div>
      )}

      {/* Barra Flutuante de Destilação (Notas -> Nova Fonte) e Cruzamento */}
      {selectedCardIds.length > 0 && (
        <div className="distill-floating-bar">
          <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
            <strong>{selectedCardIds.length}</strong>{' '}
            {selectedCardIds.length === 1 ? 'card selecionado' : 'cards selecionados'}
          </span>

          {selectedCardIds.length === 1 && (
            <button
              type="button"
              className="btn-studio amber"
              onClick={() => setUltrafocusCardId(selectedCardIds[0])}
              title="Abrir este card em tela cheia no Modo Ultrafoco (Esc)"
            >
              <Focus size={14} /> Ultrafoco no Card
            </button>
          )}

          {selectedCardIds.length >= 2 && (
            <>
              <button
                type="button"
                className="btn-studio"
                style={{
                  borderColor: 'var(--accent-sage)',
                  color: 'var(--accent-sage)',
                }}
                onClick={() => {
                  for (let i = 0; i < selectedCardIds.length - 1; i++) {
                    connectCards(selectedCardIds[i], selectedCardIds[i + 1], 'Fio de Síntese');
                  }
                }}
                title="Conectar os cards selecionados em sequência com fios narrativos"
              >
                <Link2 size={14} /> Conectar {selectedCardIds.length} Cards
              </button>

              <button
                type="button"
                className="btn-studio"
                style={{
                  borderColor: 'var(--accent-amber)',
                  color: 'var(--accent-amber)',
                }}
                onClick={() => {
                  const defaultTitle = `Grupo (${selectedCardIds.length} cards)`;
                  createCardGroup(defaultTitle, selectedCardIds, 'amber');
                  clearCardSelection();
                }}
                title="Agrupar cards selecionados em uma moldura visual unificada no Canvas"
              >
                <FolderPlus size={14} /> Agrupar {selectedCardIds.length} Cards
              </button>

              <button
                type="button"
                className="btn-studio sage"
                disabled={isSynthesizing}
                onClick={() => crossSelectedCards()}
                title="Cruza os cards selecionados usando o Gemini para gerar um card filho de síntese"
              >
                <GitMerge size={14} /> Cruzar {selectedCardIds.length} Cards com Gemini
              </button>
            </>
          )}

          <button
            type="button"
            className="btn-studio amber"
            onClick={() => distillSelectedCardsToSource()}
            title="Fluxo de Destilação do NotebookLM: Converte os insights selecionados em uma nova Fonte ativa"
          >
            <Sparkles size={14} /> Converter em Nova Fonte Destilada
          </button>

          <button
            type="button"
            className="btn-studio"
            style={{ padding: '4px 9px', fontSize: '0.74rem' }}
            onClick={clearCardSelection}
          >
            Limpar
          </button>
        </div>
      )}

      {/* Barra Flutuante de Reunião Ao Vivo / Espelhamento de Tela */}
      {isLivePresenter && (
        <div className="meeting-live-bar presenter">
          <span className="live-dot" />
          <span>
            <strong>Transmitindo Reunião Ao Vivo:</strong> tudo que você fizer na tela (zoom, navegação, cards e ultrafoco) está sendo espelhado para os colaboradores.
          </span>
          <button
            type="button"
            className="btn-studio"
            style={{
              padding: '3px 8px',
              fontSize: '0.72rem',
              background: 'rgba(239, 68, 68, 0.2)',
              color: '#fff',
              borderColor: 'rgba(239, 68, 68, 0.5)',
            }}
            onClick={stopLiveMeeting}
          >
            Encerrar
          </button>
        </div>
      )}

      {project.meetingLiveState?.isActive && !isLivePresenter && (
        <div className="meeting-live-bar audience">
          <span className="live-dot audience" />
          <span>
            <strong>Reunião com {project.meetingLiveState.presenterName || 'Apresentador'}:</strong>
            {isLiveFollowing ? ' sua tela está seguindo a navegação do apresentador em tempo real.' : ' navegação livre pausada.'}
          </span>
          <button
            type="button"
            className="btn-studio"
            style={{ padding: '3px 8px', fontSize: '0.72rem' }}
            onClick={toggleLiveFollow}
          >
            {isLiveFollowing ? 'Pausar e Navegar Livre' : 'Voltar a Seguir'}
          </button>
        </div>
      )}

      {/* HUD Superior Direito: + Novo Insight + Controles de Zoom */}
      <div
        className="canvas-hud"
        style={{
          position: 'absolute',
          top: 16,
          right: 18,
          zIndex: 22,
          display: 'flex',
          gap: 6,
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(10px)',
          padding: 5,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Modo Reunião / Transmissão de Tela em Tempo Real */}
        <button
          type="button"
          className={`btn-studio ${isLivePresenter ? 'red-live' : ''}`}
          style={{
            padding: '5px 10px',
            borderColor: isLivePresenter ? '#ef4444' : undefined,
            color: isLivePresenter ? '#ef4444' : undefined,
            background: isLivePresenter ? 'rgba(239, 68, 68, 0.12)' : undefined,
            fontWeight: isLivePresenter ? 600 : undefined,
          }}
          onClick={() => {
            if (isLivePresenter) {
              stopLiveMeeting();
            } else {
              startLiveMeeting(
                project.ownerEmail ? `Apresentador (${project.ownerEmail.split('@')[0]})` : 'Apresentador'
              );
            }
          }}
          title={
            isLivePresenter
              ? 'Encerrar transmissão da reunião ao vivo'
              : 'Iniciar Reunião Ao Vivo: tudo o que você fizer no brainstorm espelhará na tela dos colaboradores'
          }
        >
          <Users size={14} />
          <span>{isLivePresenter ? 'Transmitindo Tela' : 'Modo Reunião'}</span>
        </button>
        {(project.format === 'series_episode' || project.seriesContext) && (
          <button
            type="button"
            className={`btn-studio ${showSeriesMemoryDrawer ? 'amber' : ''}`}
            style={{
              padding: '5px 10px',
              borderColor: showSeriesMemoryDrawer ? 'var(--accent-amber)' : undefined,
              background: showSeriesMemoryDrawer ? 'var(--tint-amber)' : undefined,
              color: showSeriesMemoryDrawer ? 'var(--accent-amber)' : undefined,
            }}
            onClick={() => setShowSeriesMemoryDrawer(!showSeriesMemoryDrawer)}
            title="Abrir Gaveta de Memória Persistente e Continuidade Canônica da Série"
          >
            <Compass size={14} /> Memória da Série (T{project.seriesContext?.seasonNumber || 1}E{project.seriesContext?.episodeNumber || 1})
          </button>
        )}

        <button
          type="button"
          className={`btn-studio ${investigativeMode ? 'amber' : ''}`}
          style={{
            padding: '5px 10px',
            borderColor: investigativeMode ? 'var(--accent-amber)' : undefined,
            background: investigativeMode ? 'var(--tint-amber)' : undefined,
            color: investigativeMode ? 'var(--accent-amber)' : undefined,
          }}
          onClick={() => {
            if (investigativeMode) {
              setInvestigativeMode(false);
              setFocusedInvestigativeCardId(null);
            } else {
              setInvestigativeMode(true);

              // Resolução prioritária estrita do Card Ativo no Modo Investigativo:
              // 1. O card explicitamente selecionado pelo autor
              // 2. O card com interação recente (clique, texto ou botão)
              // 3. O card em edição ativa ou Ultrafoco
              // 4. O card com debate de IA aberto
              // 5. O foco investigativo anterior
              // 6. O card mais visível/próximo do centro atual da tela do autor (nunca pula para o card 0)
              const findTargetCard = (): InsightCard | undefined => {
                if (selectedCardIds.length > 0) {
                  const lastSelectedId = selectedCardIds[selectedCardIds.length - 1];
                  const c = project.cards.find((item) => item.id === lastSelectedId);
                  if (c) return c;
                }
                if (lastActiveCardId) {
                  const c = project.cards.find((item) => item.id === lastActiveCardId);
                  if (c) return c;
                }
                if (editingCardId) {
                  const c = project.cards.find((item) => item.id === editingCardId);
                  if (c) return c;
                }
                if (ultrafocusCardId) {
                  const c = project.cards.find((item) => item.id === ultrafocusCardId);
                  if (c) return c;
                }
                if (openChatCardIds.length > 0) {
                  const lastChatId = openChatCardIds[openChatCardIds.length - 1];
                  const c = project.cards.find((item) => item.id === lastChatId);
                  if (c) return c;
                }
                if (focusedInvestigativeCardId) {
                  const c = project.cards.find((item) => item.id === focusedInvestigativeCardId);
                  if (c) return c;
                }

                // Identifica o card posicionado no campo de visão central do autor:
                if (project.cards.length > 0) {
                  const vpRect = viewportRef.current?.getBoundingClientRect();
                  const cx = vpRect ? vpRect.width / 2 : window.innerWidth / 2;
                  const cy = vpRect ? vpRect.height / 2 : window.innerHeight / 2;
                  const worldCenterX = (cx - pan.x) / zoom;
                  const worldCenterY = (cy - pan.y) / zoom;

                  let bestCard = project.cards[0];
                  let bestDist = Infinity;
                  for (const c of project.cards) {
                    const cardCx = c.position.x + (c.dimensions?.width || 340) / 2;
                    const cardCy = c.position.y + (c.dimensions?.height || 220) / 2;
                    const d = Math.hypot(cardCx - worldCenterX, cardCy - worldCenterY);
                    if (d < bestDist) {
                      bestDist = d;
                      bestCard = c;
                    }
                  }
                  return bestCard;
                }

                return undefined;
              };

              const targetCard = findTargetCard();
              if (targetCard) {
                setLastActiveCardId(targetCard.id);
                selectSingleCard(targetCard.id);
                navigateToConnectedCard(targetCard);
              }
            }
          }}
          title="Alternar Modo Investigativo: destaque conexões, esmaeça o ruído e navegue pelos fios"
        >
          <Search size={14} /> {investigativeMode ? 'Modo Investigativo Ativo' : 'Modo Investigativo'}
        </button>

        <button
          type="button"
          className="btn-studio amber"
          style={{ padding: '5px 10px' }}
          onClick={() => addManualCard('Novo Insight', '')}
          title="Criar um novo card de Insight no Canvas (ou dê duplo-clique no fundo)"
        >
          <Plus size={14} /> Novo Insight
        </button>

        <button
          type="button"
          className="btn-studio"
          style={{ padding: '5px 8px' }}
          onClick={() => zoomAroundCenter(-0.15)}
          title="Diminuir Zoom (Cmd + - ou role o mouse para trás)"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          style={{
            background: 'none',
            border: 'none',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.74rem',
            padding: '0 6px',
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          title="Clique para redefinir o zoom em 100% (Cmd + 0)"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="btn-studio"
          style={{ padding: '5px 8px' }}
          onClick={() => zoomAroundCenter(0.15)}
          title="Aumentar Zoom (Cmd + + ou role o mouse para frente)"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="btn-studio"
          style={{ padding: '5px 8px' }}
          onClick={fitAllCardsInView}
          title="Centralizar e Enquadrar Todos os Cards no Visor (Cmd + Shift + 0)"
        >
          <Compass size={14} />
        </button>
      </div>

      {/* Estado Inicial Limpo (Bancada Livre para Começar do Zero) */}
      {project.cards.length === 0 && (
        <div
          className="empty-canvas-studio"
          style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(580px, 90vw)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '26px 28px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.5)',
            zIndex: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-mark">
              <Sparkles size={17} />
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.3rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                }}
              >
                Bancada Limpa — Comece seu Brainstorm
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Dê um <strong>duplo-clique em qualquer ponto do quadro</strong> para soltar um card livre, adicione fontes à esquerda ou provoque o Gemini abaixo:
              </p>
            </div>
          </div>

          <form onSubmit={handleStarterBrainstorm} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <textarea
              value={starterIdea}
              onChange={(e) => setStarterIdea(e.target.value)}
              placeholder="Qual é a semente do seu roteiro? (Ex: 'Um thriller sobre um restaurador de áudio que descobre uma voz impossível numa fita de 1974'...)"
              className="beat-textarea"
              style={{ minHeight: 82, fontSize: '0.88rem' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn-studio"
                  onClick={() => addManualCard('Primeiro Insight', starterIdea)}
                >
                  <Plus size={14} /> Criar Card Manual
                </button>
                <button
                  type="button"
                  className="btn-studio"
                  onClick={resetToDemoProject}
                  title="Ver exemplo completo preenchido"
                >
                  <Sparkles size={14} /> Ver Projeto Demo
                </button>
              </div>

              <button
                type="submit"
                className="btn-studio amber"
                disabled={isSynthesizing || !starterIdea.trim()}
              >
                <Sparkles size={14} /> Gerar Primeiros Insights com Gemini
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mundo Espacial (Linhas SVG + Cards) */}
      <div
        className="canvas-world"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Fios de Conexão no Estilo Linha (Curva suave Bezier com nós de arrasto e controle total) */}
        <svg
          className="canvas-connections-svg"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 12,
          }}
        >
          {project.connections.map((conn) => {
            if (conn.id === reconnectingConnectionId) return null;
            const fromCard = project.cards.find((c) => c.id === conn.fromCardId);
            const toCard = project.cards.find((c) => c.id === conn.toCardId);
            if (!fromCard || !toCard) return null;

            const geo = resolveConnectionGeometry(fromCard, toCard, conn.fromSide, conn.toSide);
            const { x1, y1, x2, y2, pathD } = geo;

            const isConnectedToFocus =
              investigativeMode &&
              focusedInvestigativeCardId &&
              (conn.fromCardId === focusedInvestigativeCardId || conn.toCardId === focusedInvestigativeCardId);
            const isDimmedWire =
              investigativeMode &&
              focusedInvestigativeCardId &&
              !isConnectedToFocus;

            const isHovered = hoveredConnectionId === conn.id;
            const isSelected = selectedConnectionId === conn.id;

            const strokeColor =
              isHovered || isSelected
                ? '#f59e0b'
                : isConnectedToFocus
                ? '#e2a04a'
                : isDimmedWire
                ? 'rgba(207, 200, 238, 0.12)'
                : '#cfc8ee';

            const strokeW = isHovered || isSelected ? 3 : isConnectedToFocus ? 2.8 : 2;

            return (
              <g key={conn.id}>
                {/* Hitbox transparente larga (28px) para captura fácil do mouse ao longo de todo o fio */}
                {!isDimmedWire && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={28}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredConnectionId(conn.id)}
                    onMouseLeave={() =>
                      setHoveredConnectionId((cur) => (cur === conn.id ? null : cur))
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedConnectionId(conn.id);
                    }}
                  />
                )}

                {/* Linha visível suave conectando uma porta do card à outra */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                  strokeDasharray={isConnectedToFocus ? '8 4' : undefined}
                  style={{
                    pointerEvents: 'none',
                    transition: 'stroke 0.18s ease, stroke-width 0.18s ease, filter 0.18s ease',
                    filter:
                      isHovered || isSelected
                        ? 'drop-shadow(0 0 7px rgba(245, 158, 11, 0.75))'
                        : 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))',
                  }}
                  className={`canvas-connection-line ${
                    isConnectedToFocus
                      ? 'investigative-wire-active'
                      : isDimmedWire
                      ? 'investigative-wire-dimmed'
                      : ''
                  }`}
                />

                {/* Bolinha na ponta de origem (x1, y1) */}
                {!isDimmedWire && (
                  <g style={{ pointerEvents: 'auto' }}>
                    <circle
                      cx={x1}
                      cy={y1}
                      r={16}
                      fill="transparent"
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) => handleExistingConnectionHandleMouseDown(e, conn, 'from')}
                      onMouseEnter={() => setHoveredConnectionId(conn.id)}
                      onMouseLeave={() => setHoveredConnectionId(null)}
                    >
                      <title>Arraste para mover esta ponta da linha para outro card</title>
                    </circle>
                    <circle
                      cx={x1}
                      cy={y1}
                      r={isHovered || isSelected ? 5.5 : 4.5}
                      fill={strokeColor}
                      stroke="#1e1b29"
                      strokeWidth={1.5}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                )}

                {/* Bolinha na ponta de chegada (x2, y2) */}
                {!isDimmedWire && (
                  <g style={{ pointerEvents: 'auto' }}>
                    <circle
                      cx={x2}
                      cy={y2}
                      r={16}
                      fill="transparent"
                      style={{ cursor: 'grab' }}
                      onMouseDown={(e) => handleExistingConnectionHandleMouseDown(e, conn, 'to')}
                      onMouseEnter={() => setHoveredConnectionId(conn.id)}
                      onMouseLeave={() => setHoveredConnectionId(null)}
                    >
                      <title>Arraste para mover esta ponta da linha para outro card</title>
                    </circle>
                    <circle
                      cx={x2}
                      cy={y2}
                      r={isHovered || isSelected ? 5.5 : 4.5}
                      fill={strokeColor}
                      stroke="#1e1b29"
                      strokeWidth={1.5}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                )}
              </g>
            );
          })}

          {/* Fio dinâmico em tempo real enquanto o autor arrasta ou conecta */}
          {connectingFromId && connectingMousePos && (() => {
            const fromCard = project.cards.find((c) => c.id === connectingFromId);
            if (!fromCard) return null;

            const fromSide = connectingFromSide || 'bottom';
            const startPt = getCardPortPoint(fromCard, fromSide);

            const targetCard = connectingHoverTargetId
              ? project.cards.find((c) => c.id === connectingHoverTargetId)
              : null;

            let endPt = connectingMousePos;
            let targetSide = connectingHoverTargetSide;

            if (targetCard) {
              if (!targetSide) {
                const geo = resolveConnectionGeometry(fromCard, targetCard, fromSide);
                targetSide = geo.toSide;
                endPt = getCardPortPoint(targetCard, targetSide);
              } else {
                endPt = getCardPortPoint(targetCard, targetSide);
              }
            }

            const livePathD = computeLiveSpline(
              startPt.x,
              startPt.y,
              fromSide,
              endPt.x,
              endPt.y,
              targetSide || undefined
            );

            return (
              <g style={{ pointerEvents: 'none' }}>
                <path
                  d={livePathD}
                  fill="none"
                  stroke={targetCard ? '#f59e0b' : '#cfc8ee'}
                  strokeWidth={targetCard ? 3 : 2.2}
                  strokeDasharray={targetCard ? undefined : '6 4'}
                  className={targetCard ? undefined : 'pulsing-wire'}
                  style={{
                    filter: targetCard
                      ? 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))'
                      : 'drop-shadow(0 0 5px rgba(207, 200, 238, 0.5))',
                  }}
                />
                <circle
                  cx={startPt.x}
                  cy={startPt.y}
                  r="5"
                  fill={targetCard ? '#f59e0b' : '#cfc8ee'}
                  stroke="#1e1b29"
                  strokeWidth={1.5}
                />
                <circle
                  cx={endPt.x}
                  cy={endPt.y}
                  r={targetCard ? 6 : 5}
                  fill={targetCard ? '#f59e0b' : '#cfc8ee'}
                  stroke="#1e1b29"
                  strokeWidth={1.5}
                />
              </g>
            );
          })()}
        </svg>

        {/* Ação Flutuante Rápida na Linha de Conexão (Visível apenas sob Hover ou Seleção) */}
        {project.connections.map((conn) => {
          if (conn.id !== hoveredConnectionId && conn.id !== selectedConnectionId) {
            return null;
          }

          const fromCard = project.cards.find((c) => c.id === conn.fromCardId);
          const toCard = project.cards.find((c) => c.id === conn.toCardId);
          if (!fromCard || !toCard) return null;

          const geo = resolveConnectionGeometry(fromCard, toCard, conn.fromSide, conn.toSide);
          const midX = (geo.x1 + geo.x2) / 2;
          const midY = (geo.y1 + geo.y2) / 2;

          return (
            <div
              key={`conn-action-${conn.id}`}
              className="canvas-line-action-pill"
              style={{
                position: 'absolute',
                left: `${midX}px`,
                top: `${midY}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
              }}
              onMouseEnter={() => setHoveredConnectionId(conn.id)}
              onMouseLeave={() => setHoveredConnectionId(null)}
            >
              {conn.label && conn.label !== 'Fio de Síntese' && (
                <span className="canvas-line-action-label" title={conn.label}>
                  {conn.label}
                </span>
              )}
              <button
                type="button"
                className="canvas-line-delete-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  removeConnection(conn.id);
                  setHoveredConnectionId(null);
                  setSelectedConnectionId(null);
                }}
                title="Excluir linha de conexão"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}

        {/* Molduras de Grupos de Cards no Canvas Livre */}
        {(project.groups || []).map((grp) => {
          const groupCards = project.cards.filter((c) => grp.cardIds.includes(c.id));
          if (groupCards.length === 0) return null;

          const minX = Math.min(...groupCards.map((c) => c.position.x)) - 22;
          const minY = Math.min(...groupCards.map((c) => c.position.y)) - 26;
          const maxX = Math.max(...groupCards.map((c) => c.position.x + (c.dimensions?.width || 340))) + 22;
          const maxY = Math.max(...groupCards.map((c) => c.position.y + (c.dimensions?.height || 220))) + 22;
          const width = Math.max(380, maxX - minX);
          const height = Math.max(260, maxY - minY);

          const groupColor = grp.color || 'amber';

          return (
            <div
              key={grp.id}
              className={`canvas-card-group-frame ${groupColor}`}
              style={{
                transform: `translate(${minX}px, ${minY}px)`,
                width: `${width}px`,
                height: `${height}px`,
              }}
            >
              <div className="canvas-card-group-header">
                <FolderPlus size={13} style={{ color: `var(--accent-${groupColor})` }} />
                <input
                  type="text"
                  className="canvas-group-title"
                  value={grp.title}
                  onChange={(e) => updateCardGroup(grp.id, { title: e.target.value })}
                  placeholder="Nome do Grupo..."
                />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  {groupCards.length} {groupCards.length === 1 ? 'card' : 'cards'}
                </span>

                <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                  {(['amber', 'sage', 'terracotta', 'lavender', 'blue', 'rose'] as CardColor[]).map((clr) => (
                    <button
                      key={clr}
                      type="button"
                      className={`color-dot-choice ${grp.color === clr ? 'active' : ''}`}
                      style={{ background: `var(--accent-${clr})` }}
                      onClick={() => updateCardGroup(grp.id, { color: clr })}
                      title={`Cor do grupo: ${clr}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="btn-studio"
                  style={{ padding: '2px 6px', fontSize: '0.67rem', marginLeft: 4 }}
                  onClick={() => removeCardGroup(grp.id)}
                  title="Desagrupar cards deste grupo"
                >
                  <FolderMinus size={11} /> Desagrupar
                </button>
              </div>
            </div>
          );
        })}

        {/* Cards de Insight */}
        {project.cards.map((card) => {
          const lensMeta = CREATIVE_LENSES.find((l) => l.id === card.lensId);
          const isSelected = selectedCardIds.includes(card.id);
          const isEditing = editingCardId === card.id;
          const isConnectingOrigin = connectingFromId === card.id;
          const isChatOpen = openChatCardIds.includes(card.id);
          const isAttachmentOpen = attachmentModalCardId === card.id;

          const isInvestigativeFocused = investigativeMode && focusedInvestigativeCardId === card.id;
          const connectedNeighborIds = focusedInvestigativeCardId
            ? project.connections
                .filter(
                  (conn) =>
                    conn.fromCardId === focusedInvestigativeCardId ||
                    conn.toCardId === focusedInvestigativeCardId
                )
                .map((conn) =>
                  conn.fromCardId === focusedInvestigativeCardId ? conn.toCardId : conn.fromCardId
                )
            : [];
          const isInvestigativeNeighbor =
            investigativeMode &&
            focusedInvestigativeCardId !== null &&
            !isInvestigativeFocused &&
            connectedNeighborIds.includes(card.id);
          const isInvestigativeDimmed =
            investigativeMode &&
            focusedInvestigativeCardId !== null &&
            !isInvestigativeFocused &&
            !isInvestigativeNeighbor;

          return (
            <article
              key={card.id}
              data-card-id={card.id}
              className={`insight-card ${isSelected ? 'selected' : ''} color-${card.color || 'default'} ${
                connectingFromId === card.id ? 'connecting-source' : ''
              } ${connectingFromId && connectingFromId !== card.id ? 'connecting-target-candidate' : ''} ${
                connectingHoverTargetId === card.id ? 'connecting-target-hovered' : ''
              } ${
                isInvestigativeFocused ? 'investigative-focused' : ''
              } ${isInvestigativeNeighbor ? 'investigative-neighbor' : ''} ${
                isInvestigativeDimmed ? 'investigative-dimmed' : ''
              }`}
              style={{
                transform: `translate(${card.position.x}px, ${card.position.y}px)`,
                width: card.dimensions?.width ? `${card.dimensions.width}px` : undefined,
                minHeight: card.dimensions?.height ? `${card.dimensions.height}px` : undefined,
                cursor:
                  connectingFromId && connectingFromId !== card.id
                    ? 'pointer'
                    : isInvestigativeNeighbor || isInvestigativeDimmed
                    ? 'pointer'
                    : undefined,
              }}
              onPaste={(e) => handleCardPaste(card.id, e)}
              onClickCapture={() => setLastActiveCardId(card.id)}
              onFocusCapture={() => setLastActiveCardId(card.id)}
              onMouseDown={(e) => {
                setLastActiveCardId(card.id);

                if (investigativeMode && (isInvestigativeNeighbor || isInvestigativeDimmed)) {
                  e.stopPropagation();
                  navigateToConnectedCard(card);
                  return;
                }

                if (connectingFromIdRef.current) {
                  e.stopPropagation();
                  e.preventDefault();
                  if (connectingFromIdRef.current !== card.id) {
                    finalizeConnection(card.id);
                  } else {
                    cancelConnection();
                  }
                  return;
                }

                if (e.shiftKey || e.metaKey || e.ctrlKey) {
                  toggleSelectCard(card.id, true);
                } else if (!isSelected) {
                  selectSingleCard(card.id);
                }

                startCardDrag(e, card);
              }}
            >
              {/* Selo de Navegação ao Longo da Linha (Modo Investigativo) */}
              {isInvestigativeNeighbor && (
                <div
                  className="investigative-neighbor-badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigateToConnectedCard(card);
                  }}
                  title="Clique para percorrer a linha até este card conectado"
                >
                  <GitMerge size={12} />
                  <span>Percorrer Linha →</span>
                </div>
              )}

              {/* Portas de conexão no card: Topo, Base, Esquerda e Direita (visíveis e arrastáveis como no print) */}
              {(['top', 'bottom', 'left', 'right'] as ConnectionPortSide[]).map((side) => {
                const isActive = connectingFromId === card.id && connectingFromSide === side;
                const isTargetHovered = connectingHoverTargetId === card.id && connectingHoverTargetSide === side;
                const isConnected = project.connections.some(
                  (conn) =>
                    (conn.fromCardId === card.id && (conn.fromSide === side || (!conn.fromSide && side === 'bottom'))) ||
                    (conn.toCardId === card.id && (conn.toSide === side || (!conn.toSide && side === 'top')))
                );

                return (
                  <button
                    key={side}
                    type="button"
                    data-port-side={side}
                    className={`card-connect-port ${side} ${isActive ? 'active' : ''} ${
                      isTargetHovered ? 'target-hovered' : ''
                    } ${isConnected ? 'connected' : ''}`}
                    onMouseDown={(e) => handlePortMouseDown(e, card.id, side)}
                    onMouseUp={(e) => {
                      if (connectingFromId && connectingFromId !== card.id) {
                        e.stopPropagation();
                        e.preventDefault();
                        finalizeConnection(card.id, side);
                      }
                    }}
                    title={`Porta ${side}: clique ou arraste para conectar ou levar para outro card`}
                  />
                );
              })}

              {/* Overlay quando o card é candidato a destino de conexão */}
              {connectingFromId && connectingFromId !== card.id && (
                <div
                  className="card-connecting-overlay"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    finalizeConnection(card.id, connectingHoverTargetSide || undefined);
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    finalizeConnection(card.id, connectingHoverTargetSide || undefined);
                  }}
                  title="Solte ou clique para conectar"
                >
                  <Link2 size={16} />
                  <span>Solte para Conectar</span>
                </div>
              )}
              {/* Cabeçalho do Card */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span className={`lens-badge ${lensMeta?.badgeClass || 'amber'}`}>
                    {lensMeta?.shortLabel || '✨ Insight Livre'}
                  </span>

                  {card.isCanonicalSeriesMemory && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--accent-amber)',
                        background: 'var(--tint-amber)',
                        border: '1px solid rgba(226, 160, 74, 0.45)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '2px 7px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Este card está registrado na Memória Canônica da Série e será herdado por episódios futuros"
                    >
                      <Compass size={11} /> Canônico
                    </span>
                  )}

                  {/* Seletor Visual de Cores do Card */}
                  <div className="card-color-picker-popover" title="Escolha a cor do card">
                    {(['default', 'amber', 'sage', 'terracotta', 'lavender', 'blue', 'rose'] as CardColor[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`color-dot-choice ${(card.color || 'default') === c ? 'active' : ''}`}
                        style={{
                          background: c === 'default' ? 'var(--border-strong)' : `var(--accent-${c})`,
                        }}
                        onClick={() => updateCardColor(card.id, c)}
                        title={`Cor: ${c}`}
                      />
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Promover à Memória Canônica da Série */}
                  {(project.format === 'series_episode' || project.seriesContext) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCardSeriesMemory(card.id);
                      }}
                      className="btn-studio"
                      style={{
                        padding: '3px 7px',
                        fontSize: '0.69rem',
                        borderColor: card.isCanonicalSeriesMemory ? 'var(--accent-amber)' : undefined,
                        color: card.isCanonicalSeriesMemory ? 'var(--accent-amber)' : 'var(--text-secondary)',
                        background: card.isCanonicalSeriesMemory ? 'var(--tint-amber)' : undefined,
                      }}
                      title={
                        card.isCanonicalSeriesMemory
                          ? 'Card fixado na Memória Canônica da Série (clique para remover da memória permanente)'
                          : 'Promover à Memória Canônica da Série (permanece e vira lore nos próximos episódios)'
                      }
                    >
                      <Compass size={12} />
                      {card.isCanonicalSeriesMemory && <span>Canônico</span>}
                    </button>
                  )}

                  {/* Botão de Ultrafoco (Trabalho Exclusivo em Tela Cheia no Card) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLastActiveCardId(card.id);
                      selectSingleCard(card.id);
                      setUltrafocusCardId(card.id);
                    }}
                    className="btn-studio amber"
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.69rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontWeight: 600,
                      borderColor: 'var(--accent-amber)',
                      background: 'var(--tint-amber)',
                      color: 'var(--accent-amber)',
                    }}
                    title="Modo Ultrafoco: Expandir este card em tela cheia para trabalhar exclusivamente nele (Esc para sair)"
                  >
                    <Focus size={12} />
                    <span>Ultrafoco</span>
                  </button>

                  {/* Botão de Expandir Vislumbre Visual (Modo Investigativo) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLastActiveCardId(card.id);
                      selectSingleCard(card.id);
                      if (!investigativeMode) {
                        setInvestigativeMode(true);
                        navigateToConnectedCard(card);
                      } else if (focusedInvestigativeCardId === card.id) {
                        setFocusedInvestigativeCardId(null);
                      } else {
                        navigateToConnectedCard(card);
                      }
                    }}
                    className="btn-studio"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.69rem',
                      borderColor: isInvestigativeFocused ? 'var(--accent-amber)' : undefined,
                      color: isInvestigativeFocused ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      background: isInvestigativeFocused ? 'var(--tint-amber)' : undefined,
                    }}
                    title={
                      isInvestigativeFocused
                        ? 'Recolher vislumbre investigativo (Esc)'
                        : 'Expandir Card / Vislumbre Visual (Modo Investigativo)'
                    }
                  >
                    {isInvestigativeFocused ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  </button>

                  {/* Botão de Anexos (Imagens, prints, PDFs, textos) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLastActiveCardId(card.id);
                      selectSingleCard(card.id);
                      setAttachmentModalCardId(isAttachmentOpen ? null : card.id);
                    }}
                    className="btn-studio"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.69rem',
                      color: (card.attachments?.length || 0) > 0 ? 'var(--accent-sage)' : 'var(--text-secondary)',
                      borderColor: isAttachmentOpen ? 'var(--accent-sage)' : undefined,
                    }}
                    title="Anexar imagens, prints, recortes de PDF ou notas (ou cole com Cmd+V / Ctrl+V)"
                  >
                    <Paperclip size={12} />
                    {(card.attachments?.length || 0) > 0 && <span>{card.attachments!.length}</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLastActiveCardId(card.id);
                      selectSingleCard(card.id);
                      toggleCardChat(card.id);
                    }}
                    className="btn-studio"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.69rem',
                      color: (card.chatMessages?.length || 0) > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      borderColor: isChatOpen ? 'var(--accent-amber)' : undefined,
                    }}
                    title="Conversar com IA para aprofundar insight (Advogado do Diabo)"
                  >
                    <MessageSquare size={12} />
                    {(card.chatMessages?.length || 0) > 0 && <span>{card.chatMessages!.length}</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLastActiveCardId(card.id);
                      selectSingleCard(card.id);
                      setEditingCardId(isEditing ? null : card.id);
                    }}
                    className="btn-studio"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.69rem',
                      color: isEditing ? 'var(--accent-sage)' : 'var(--text-secondary)',
                    }}
                    title={isEditing ? 'Concluir edição' : 'Editar texto do Insight'}
                  >
                    {isEditing ? <Check size={12} /> : <Edit3 size={12} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLastActiveCardId(card.id);
                      toggleSelectCard(card.id, true);
                    }}
                    className="btn-studio"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.69rem',
                      borderColor: isSelected ? 'var(--accent-amber)' : undefined,
                      color: isSelected ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    }}
                    title="Selecionar para Destilar em Fonte ou Cruzar Cards"
                  >
                    <Pin size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLastActiveCardId(card.id);
                      selectSingleCard(card.id);
                      handleConnectClick(card.id);
                    }}
                    className="btn-studio"
                    style={{
                      padding: '3px 7px',
                      fontSize: '0.69rem',
                      borderColor: isConnectingOrigin ? 'var(--accent-amber)' : undefined,
                      color: isConnectingOrigin ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      background: isConnectingOrigin ? 'var(--tint-amber)' : undefined,
                    }}
                    title={
                      isConnectingOrigin
                        ? 'Cancelar modo de conexão'
                        : 'Conectar este card a outro no Canvas (ou use as portas laterais)'
                    }
                  >
                    <Link2 size={12} className={isConnectingOrigin ? 'spin' : ''} />
                  </button>

                  <button
                    type="button"
                    onClick={() => removeCard(card.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: 3,
                    }}
                    title="Excluir card"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Popover para Anexar Evidências */}
              {isAttachmentOpen && (
                <div className="card-attachment-popover" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Paperclip size={12} /> Anexar ao Card
                    </span>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                      onClick={() => setAttachmentModalCardId(null)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <label
                      className="btn-studio"
                      style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '5px 8px', fontSize: '0.72rem' }}
                    >
                      <ImageIcon size={12} /> Imagem / Print
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileUpload(card.id, e)}
                      />
                    </label>
                    <label
                      className="btn-studio"
                      style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '5px 8px', fontSize: '0.72rem' }}
                    >
                      <FileText size={12} /> PDF / Texto
                      <input
                        type="file"
                        accept=".pdf,text/plain"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileUpload(card.id, e)}
                      />
                    </label>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    <input
                      type="text"
                      placeholder="Título do recorte ou citação..."
                      value={textSnippetTitle}
                      onChange={(e) => setTextSnippetTitle(e.target.value)}
                      className="provocation-input"
                      style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                    />
                    <textarea
                      placeholder="Cole aqui um trecho de texto, diálogo, roteiro ou transcrição..."
                      value={textSnippetText}
                      onChange={(e) => setTextSnippetText(e.target.value)}
                      className="beat-textarea"
                      style={{ minHeight: 46, fontSize: '0.74rem', padding: '4px 6px' }}
                    />
                    <button
                      type="button"
                      className="btn-studio amber"
                      style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      disabled={!textSnippetText.trim()}
                      onClick={() => {
                        addCardAttachment(card.id, {
                          type: 'text_snippet',
                          title: textSnippetTitle.trim() || 'Recorte de Texto',
                          textContent: textSnippetText.trim(),
                        });
                        setTextSnippetTitle('');
                        setTextSnippetText('');
                        setAttachmentModalCardId(null);
                      }}
                    >
                      Adicionar Recorte
                    </button>
                    <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Dica: você também pode colar prints diretamente com Ctrl+V / Cmd+V
                    </span>
                  </div>
                </div>
              )}

              {/* Mini-Galeria de Anexos no Card */}
              {card.attachments && card.attachments.length > 0 && (
                <div className="card-attachments-section">
                  <div className="card-attachments-grid">
                    {card.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="card-attachment-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (att.dataUrl) setPreviewAttachmentUrl(att.dataUrl);
                        }}
                        title={`${att.title} (clique para ampliar)`}
                      >
                        {att.type === 'image' && att.dataUrl ? (
                          <img src={att.dataUrl} alt={att.title} className="card-attachment-thumb" />
                        ) : (
                          <div className="card-attachment-snippet">
                            <FileText size={13} style={{ color: 'var(--accent-amber)', marginBottom: 2 }} />
                            <span style={{ fontSize: '0.67rem', fontWeight: 600 }}>{att.title.slice(0, 16)}</span>
                            {att.textContent && (
                              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>
                                "{att.textContent.slice(0, 28)}..."
                              </span>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          className="card-attachment-del-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCardAttachment(card.id, att.id);
                          }}
                          title="Remover anexo"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modo de Edição Direta vs Leitura */}
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="text"
                    value={card.title}
                    onChange={(e) =>
                      updateCardContent(card.id, e.target.value, card.body, card.subtextOrVisualCue)
                    }
                    placeholder="Título do Insight ou Gancho..."
                    className="provocation-input"
                    style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', fontWeight: 500 }}
                    autoFocus
                  />
                  <textarea
                    value={card.body}
                    onChange={(e) =>
                      updateCardContent(card.id, card.title, e.target.value, card.subtextOrVisualCue)
                    }
                    placeholder="Desenvolva a ideia, conflito, diálogo ou conexão..."
                    className="beat-textarea"
                    style={{ minHeight: 95, fontSize: '0.85rem' }}
                  />
                  <input
                    type="text"
                    value={card.subtextOrVisualCue || ''}
                    onChange={(e) => updateCardContent(card.id, card.title, card.body, e.target.value)}
                    placeholder="Cena / Direção Visual (opcional)..."
                    className="provocation-input"
                    style={{ fontSize: '0.78rem' }}
                  />
                </div>
              ) : (
                <>
                  <h3
                    className="insight-card-title"
                    onDoubleClick={() => setEditingCardId(card.id)}
                    title="Duplo-clique para editar"
                  >
                    {card.title}
                  </h3>
                  <div
                    className="insight-card-body"
                    onDoubleClick={() => setEditingCardId(card.id)}
                    title="Duplo-clique para editar"
                  >
                    {card.body || (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Clique no ícone de lápis ou dê duplo-clique aqui para escrever seu insight...
                      </span>
                    )}
                  </div>
                </>
              )}

              {/* Subtexto / Direção Visual (Show, Don't Tell) */}
              {!isEditing && card.subtextOrVisualCue && (
                <div className="subtext-box">
                  <strong style={{ fontStyle: 'normal', color: 'var(--accent-amber)', fontSize: '0.73rem' }}>
                    CENA / DIREÇÃO VISUAL:{' '}
                  </strong>
                  {card.subtextOrVisualCue}
                </div>
              )}

              {/* Citações Clicáveis (Auditoria por Citações) */}
              {card.citations.length > 0 && (
                <div className="citation-pills">
                  {card.citations.map((cit, idx) => (
                    <button
                      key={cit.id}
                      type="button"
                      className="citation-pill"
                      onClick={() => setActiveCitation(cit)}
                      title={`Auditar citação exata em "${cit.sourceTitle}"`}
                    >
                      <Quote size={11} /> [{idx + 1}] {cit.sourceTitle.slice(0, 26)}...
                    </button>
                  ))}
                </div>
              )}

              {/* Vislumbre Visual Expandido (Modo Investigativo) */}
              {isInvestigativeFocused && (
                <div className="card-expanded-vislumbre">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        color: 'var(--accent-amber)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Eye size={13} /> Vislumbre de Evidências ({card.attachments?.length || 0})
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {connectedNeighborIds.length} {connectedNeighborIds.length === 1 ? 'conexão direta' : 'conexões diretas'}
                    </span>
                  </div>
                  {card.attachments && card.attachments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {card.attachments.map((att) => (
                        <div key={att.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {att.title}
                          </span>
                          {att.type === 'image' && att.dataUrl && (
                            <img
                              src={att.dataUrl}
                              alt={att.title}
                              className="vislumbre-image-large"
                              onClick={() => setPreviewAttachmentUrl(att.dataUrl!)}
                              title="Clique para expandir em tela cheia"
                            />
                          )}
                          {att.textContent && (
                            <blockquote
                              style={{
                                background: 'var(--bg-canvas)',
                                borderLeft: '3px solid var(--accent-amber)',
                                margin: 0,
                                padding: '6px 10px',
                                fontSize: '0.74rem',
                                color: 'var(--text-secondary)',
                                fontStyle: 'italic',
                                borderRadius: '0 4px 4px 0',
                              }}
                            >
                              "{att.textContent}"
                            </blockquote>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '0.71rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0' }}>
                      Nenhum anexo neste card. Clique em 📎 no topo do card ou cole prints com Cmd+V / Ctrl+V.
                    </p>
                  )}
                </div>
              )}

              {/* Rodapé: Enviar para Ato da Escaleta */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 6,
                  borderTop: '1px solid var(--border-subtle)',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Bookmark size={11} /> Escaleta:
                </span>
                <select
                  value={card.beatAct || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      assignCardToBeatAct(card.id, e.target.value as BeatActId);
                    }
                  }}
                  style={{
                    background: 'var(--bg-canvas)',
                    color: card.beatAct ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '3px 7px',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Enviar para Ato do Roteiro...</option>
                  {BEAT_ACT_LABELS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gaveta de Conversa e Aprofundamento no Card (Interação Dialética) */}
              {isChatOpen && (
                <div className="card-chat-drawer">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span
                      style={{
                        fontSize: '0.71rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <MessageSquare size={12} style={{ color: 'var(--accent-amber)' }} />
                      Debate & Aprofundamento
                    </span>

                    <select
                      value={cardChatLens[card.id] || 'devils_advocate'}
                      onChange={(e) =>
                        setCardChatLens((prev) => ({ ...prev, [card.id]: e.target.value as CreativeLensId }))
                      }
                      style={{
                        background:
                          (cardChatLens[card.id] || 'devils_advocate') === 'devils_advocate'
                            ? 'var(--tint-terracotta)'
                            : 'var(--bg-canvas)',
                        color:
                          (cardChatLens[card.id] || 'devils_advocate') === 'devils_advocate'
                            ? 'var(--accent-terracotta)'
                            : 'var(--accent-amber)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 6,
                        padding: '2px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Escolha a lente com a qual interagir sobre este card"
                    >
                      <option value="devils_advocate">🔥 Advogado do Diabo</option>
                      <option value="data_to_scene">🎬 Show, Don't Tell</option>
                      <option value="conflict_subtext">⚡ Conflito & Subtexto</option>
                      <option value="hook_engineering">🎣 Gancho / Curiosidade</option>
                      <option value="free_provocation">✨ Consultor Criativo</option>
                    </select>

                    {(() => {
                      const rejectedCount = (card.chatMessages || []).filter((m) => m.isRejected).length;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {rejectedCount > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setHideRejectedByCard((prev) => ({
                                  ...prev,
                                  [card.id]: !prev[card.id],
                                }))
                              }
                              style={{
                                background: 'none',
                                border: 'none',
                                color: hideRejectedByCard[card.id] ? 'var(--accent-terracotta)' : 'var(--text-muted)',
                                fontSize: '0.67rem',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title={
                                hideRejectedByCard[card.id]
                                  ? 'Exibir respostas rejeitadas'
                                  : 'Ocultar respostas rejeitadas da conversa visual'
                              }
                            >
                              {hideRejectedByCard[card.id] ? <Eye size={11} /> : <EyeOff size={11} />}
                              {hideRejectedByCard[card.id]
                                ? `Exibir rejeitadas (${rejectedCount})`
                                : `Ocultar rejeitadas (${rejectedCount})`}
                            </button>
                          )}

                          {card.chatMessages && card.chatMessages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => clearCardChat(card.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.67rem',
                                cursor: 'pointer',
                                padding: '2px 4px',
                                textDecoration: 'underline',
                              }}
                              title="Limpar histórico e reiniciar o debate deste card do zero"
                            >
                              Reiniciar ({Math.floor(card.chatMessages.length / 2)} turnos)
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Histórico da Conversa neste Card */}
                  <div className="card-chat-history">
                    {(!card.chatMessages || card.chatMessages.length === 0) ? (
                      <p
                        style={{
                          fontSize: '0.73rem',
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                          padding: '4px 0',
                        }}
                      >
                        Inicie uma conversa para testar premissas, encontrar furos de roteiro ou aprofundar este card...
                      </p>
                    ) : (
                      card.chatMessages.map((msg) => {
                        const isCardRejectedHidden = !!hideRejectedByCard[card.id] && !!msg.isRejected;
                        if (isCardRejectedHidden) return null;

                        if (msg.isRejected && msg.isHidden) {
                          return (
                            <div key={msg.id} className="card-chat-item assistant rejected collapsed">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span className="card-chat-rejected-badge">
                                  <Ban size={10} /> RESPOSTA REJEITADA (OCULTA DO CONTEXTO)
                                </span>
                                <div className="card-chat-item-actions" style={{ margin: 0, padding: 0, border: 'none' }}>
                                  <button
                                    type="button"
                                    className="card-chat-action-btn"
                                    onClick={() => toggleHideCardChatMessage(card.id, msg.id)}
                                    title="Expandir conteúdo desta mensagem rejeitada"
                                  >
                                    <Eye size={11} /> Ver
                                  </button>
                                  <button
                                    type="button"
                                    className="card-chat-action-btn danger"
                                    onClick={() => deleteCardChatMessage(card.id, msg.id)}
                                    title="Excluir mensagem definitivamente"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={msg.id}
                            className={`card-chat-item ${msg.sender} ${
                              msg.lensId === 'devils_advocate' && msg.sender === 'assistant' ? 'devils-advocate' : ''
                            } ${msg.isRejected ? 'rejected' : ''}`}
                          >
                            {msg.isRejected && (
                              <div style={{ marginBottom: 4 }}>
                                <span className="card-chat-rejected-badge">
                                  <Ban size={10} /> RESPOSTA REJEITADA PELO AUTOR (INUTILIZADA DO CONTEXTO)
                                </span>
                              </div>
                            )}

                            {msg.sender === 'assistant' && !msg.isRejected && (
                              <strong
                                style={{
                                  display: 'block',
                                  fontSize: '0.69rem',
                                  color:
                                    msg.lensId === 'devils_advocate'
                                      ? 'var(--accent-terracotta)'
                                      : 'var(--accent-amber)',
                                  marginBottom: 2,
                                }}
                              >
                                {msg.lensId === 'devils_advocate' ? '🔥 Advogado do Diabo:' : '✨ Consultor Criativo:'}
                              </strong>
                            )}

                            <div className={msg.isRejected ? 'card-chat-text' : undefined}>
                              {msg.text}
                            </div>

                            {/* Controles de Rejeição, Ocultação e Exclusão */}
                            <div className="card-chat-item-actions">
                              {msg.sender === 'assistant' && (
                                <button
                                  type="button"
                                  className={`card-chat-action-btn ${msg.isRejected ? '' : 'danger'}`}
                                  onClick={() => toggleRejectCardChatMessage(card.id, msg.id)}
                                  title={
                                    msg.isRejected
                                      ? 'Restaurar resposta ao contexto ativo'
                                      : 'Rejeitar resposta e inutilizá-la do contexto futuro'
                                  }
                                >
                                  {msg.isRejected ? (
                                    <>
                                      <Undo2 size={11} /> Restaurar
                                    </>
                                  ) : (
                                    <>
                                      <Ban size={11} /> Rejeitar
                                    </>
                                  )}
                                </button>
                              )}

                              {msg.isRejected && (
                                <button
                                  type="button"
                                  className="card-chat-action-btn"
                                  onClick={() => toggleHideCardChatMessage(card.id, msg.id)}
                                  title="Ocultar corpo do texto rejeitado"
                                >
                                  <EyeOff size={11} /> Ocultar
                                </button>
                              )}

                              <button
                                type="button"
                                className="card-chat-action-btn danger"
                                onClick={() => deleteCardChatMessage(card.id, msg.id)}
                                title="Excluir mensagem definitivamente"
                              >
                                <Trash2 size={11} /> Excluir
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                    {cardChatRunningId === card.id && (
                      <div
                        className="card-chat-item assistant"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-amber)' }}
                      >
                        <Loader2 size={12} className="spin" /> Formulando análise crítica...
                      </div>
                    )}
                  </div>

                  {/* Formulário de Envio */}
                  <form
                    className="card-chat-controls"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const msg = (cardChatInputs[card.id] || '').trim();
                      if (!msg || cardChatRunningId === card.id) return;
                      setCardChatInputs((prev) => ({ ...prev, [card.id]: '' }));
                      await sendCardChatMessage(card.id, msg, cardChatLens[card.id] || 'devils_advocate');
                    }}
                  >
                    <input
                      type="text"
                      value={cardChatInputs[card.id] || ''}
                      onChange={(e) => setCardChatInputs((prev) => ({ ...prev, [card.id]: e.target.value }))}
                      placeholder={
                        (cardChatLens[card.id] || 'devils_advocate') === 'devils_advocate'
                          ? "Confronte: 'E se o vilão fizer X?' ou 'Como evitar esse furo?'..."
                          : "Pergunte ou peça para desdobrar esta cena..."
                      }
                      className="card-chat-input"
                    />
                    <button
                      type="submit"
                      className="btn-studio"
                      disabled={cardChatRunningId === card.id || !(cardChatInputs[card.id] || '').trim()}
                      style={{ padding: '5px 8px', color: 'var(--accent-amber)' }}
                      title="Enviar pergunta ou provocação"
                    >
                      <Send size={12} />
                    </button>
                  </form>
                </div>
              )}

              {/* Alça Dedicada de Redimensionamento do Card (Arraste ou Setas do Teclado) */}
              <div
                className="card-resize-handle"
                tabIndex={0}
                aria-label="Redimensionar card (arraste ou use as setas do teclado)"
                title="Arraste para redimensionar o card para leitura (use as setas do teclado quando focado)"
                onPointerDown={(e) => handleResizePointerDown(e, card)}
                onPointerMove={handleResizePointerMove}
                onLostPointerCapture={handleResizeLostCapture}
                onKeyDown={(e) => handleResizeKeyDown(e, card)}
              />
            </article>
          );
        })}
      </div>

      {/* Gaveta Lateral de Memória Persistente & Continuidade da Série */}
      {showSeriesMemoryDrawer && seriesCtx && (
        <div
          className="series-memory-drawer-overlay"
          onClick={() => setShowSeriesMemoryDrawer(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            zIndex: 9990,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <aside
            className="series-memory-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 460,
              maxWidth: '92vw',
              height: '100%',
              background: 'var(--bg-surface-elevated)',
              borderLeft: '1px solid var(--border-subtle)',
              boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'text',
            }}
          >
            {/* Topo da Gaveta */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'color-mix(in oklab, var(--accent-amber) 6%, var(--bg-surface-elevated))',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--accent-amber)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    fontWeight: 600,
                  }}
                >
                  <Compass size={14} /> Memória Canônica & Continuidade
                </div>
                <h3
                  style={{
                    margin: '3px 0 0',
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.14rem',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }}
                >
                  {seriesCtx.seriesTitle}
                </h3>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Episódio em produção: <strong>T{seriesCtx.seasonNumber || 1}E{seriesCtx.episodeNumber || 1}</strong>
                </div>
              </div>

              <button
                type="button"
                className="btn-studio"
                onClick={() => setShowSeriesMemoryDrawer(false)}
                style={{ padding: '6px 8px' }}
                title="Fechar Gaveta de Memória (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Abas de Navegação */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-canvas)',
                padding: '4px 12px 0',
                gap: 6,
              }}
            >
              <button
                type="button"
                onClick={() => setSeriesDrawerTab('cards')}
                style={{
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: seriesDrawerTab === 'cards' ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: seriesDrawerTab === 'cards' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  fontWeight: seriesDrawerTab === 'cards' ? 600 : 400,
                  fontSize: '0.79rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FileText size={13} /> Cards Canônicos ({allSeriesCards.length})
              </button>

              <button
                type="button"
                onClick={() => setSeriesDrawerTab('hooks')}
                style={{
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: seriesDrawerTab === 'hooks' ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: seriesDrawerTab === 'hooks' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  fontWeight: seriesDrawerTab === 'hooks' ? 600 : 400,
                  fontSize: '0.79rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <GitMerge size={13} /> Ganchos & Pontas ({pendingHooks.length})
              </button>

              <button
                type="button"
                onClick={() => setSeriesDrawerTab('lore')}
                style={{
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  borderBottom: seriesDrawerTab === 'lore' ? '2px solid var(--accent-amber)' : '2px solid transparent',
                  color: seriesDrawerTab === 'lore' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  fontWeight: seriesDrawerTab === 'lore' ? 600 : 400,
                  fontSize: '0.79rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <BookOpen size={13} /> Bíblia & Lore
              </button>
            </div>

            {/* Conteúdo da Aba */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {seriesDrawerTab === 'cards' && (
                <>
                  <div
                    style={{
                      background: 'color-mix(in oklab, var(--accent-amber) 8%, var(--bg-canvas))',
                      border: '1px solid rgba(226, 160, 74, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    Estes cards pertencem à memória acumulada da série. Eles <strong>já estão ativos como fonte viva no Context Mixer</strong> para o Gemini citar e para o Advogado do Diabo checar furos. Clique em <em>"Trazer para a Bancada"</em> para criar uma cópia editável no Canvas deste episódio.
                  </div>

                  {allSeriesCards.length > 3 && (
                    <div style={{ position: 'relative' }}>
                      <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                      <input
                        type="text"
                        placeholder="Buscar nos cards canônicos da série..."
                        value={seriesCardSearch}
                        onChange={(e) => setSeriesCardSearch(e.target.value)}
                        className="provocation-input"
                        style={{ width: '100%', paddingLeft: 28, fontSize: '0.78rem' }}
                      />
                    </div>
                  )}

                  {filteredSeriesCards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Nenhum card canônico encontrado.{' '}
                      <div style={{ marginTop: 6, fontSize: '0.76rem' }}>
                        Para promover um card criado neste episódio à memória permanente da série, clique no ícone 🧭 no cabeçalho do card no Canvas.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {filteredSeriesCards.map((sc) => {
                        const isAlreadyOnCanvas = project.cards.some(
                          (c) => c.title.trim().toLowerCase() === sc.title.trim().toLowerCase()
                        );
                        return (
                          <div
                            key={sc.id}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <h4 style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                {sc.title}
                              </h4>
                              {isAlreadyOnCanvas ? (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: 'var(--accent-sage)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                >
                                  <Check size={12} /> Na Bancada
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-studio amber"
                                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                  onClick={() => importSeriesCardToCanvas(sc)}
                                  title="Importar este card para a bancada do episódio atual"
                                >
                                  <Plus size={12} /> Trazer para a Bancada
                                </button>
                              )}
                            </div>

                            <p style={{ margin: 0, fontSize: '0.79rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                              {sc.body.slice(0, 180)}...
                            </p>

                            {sc.subtextOrVisualCue && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--accent-amber)', fontStyle: 'italic' }}>
                                ↳ {sc.subtextOrVisualCue.slice(0, 100)}...
                              </div>
                            )}

                            {sc.tags && sc.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                                {sc.tags.map((t) => (
                                  <span
                                    key={t}
                                    style={{
                                      fontSize: '0.66rem',
                                      background: 'var(--bg-canvas)',
                                      padding: '1px 6px',
                                      borderRadius: 'var(--radius-pill)',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {seriesDrawerTab === 'hooks' && (
                <>
                  <div
                    style={{
                      background: 'color-mix(in oklab, var(--accent-amber) 8%, var(--bg-canvas))',
                      border: '1px solid rgba(226, 160, 74, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.45,
                    }}
                  >
                    Ganchos, enigmas e cliffhangers não resolvidos deixados pelos episódios anteriores. O Advogado do Diabo utiliza esta lista para exigir consistência e impedir que mistérios sejam esquecidos.
                  </div>

                  {/* Formulário para Registrar Novo Gancho */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newHookText.trim()) return;
                      addSeriesOpenHook(newHookText);
                      setNewHookText('');
                    }}
                    style={{ display: 'flex', gap: 6 }}
                  >
                    <input
                      type="text"
                      placeholder="Registrar novo gancho ou ponta solta deixada neste episódio..."
                      value={newHookText}
                      onChange={(e) => setNewHookText(e.target.value)}
                      className="provocation-input"
                      style={{ flex: 1, fontSize: '0.78rem' }}
                    />
                    <button
                      type="submit"
                      className="btn-studio amber"
                      style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                      disabled={!newHookText.trim()}
                    >
                      <Plus size={13} /> Gancho
                    </button>
                  </form>

                  {/* Lista de Ganchos */}
                  {seriesHooks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      Nenhum gancho em aberto registrado ainda para esta série.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {seriesHooks.map((h) => (
                        <div
                          key={h.id}
                          style={{
                            background: h.resolved ? 'var(--bg-canvas)' : 'var(--bg-surface)',
                            border: `1px solid ${h.resolved ? 'var(--border-subtle)' : 'rgba(226, 160, 74, 0.35)'}`,
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            opacity: h.resolved ? 0.65 : 1,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSeriesOpenHook(h.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 2,
                              color: h.resolved ? 'var(--accent-sage)' : 'var(--accent-amber)',
                            }}
                            title={h.resolved ? 'Marcar como pendente' : 'Marcar como resolvido neste episódio'}
                          >
                            {h.resolved ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          </button>

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                              <span
                                style={{
                                  fontSize: '0.67rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--accent-amber)',
                                  background: 'var(--tint-amber)',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                {h.originEpisodeTag}
                              </span>
                              {h.resolved && (
                                <span style={{ fontSize: '0.68rem', color: 'var(--accent-sage)' }}>
                                  Resolvido {h.resolvedInEpisodeTag ? `em ${h.resolvedInEpisodeTag}` : ''}
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontSize: '0.81rem',
                                color: 'var(--text-primary)',
                                textDecoration: h.resolved ? 'line-through' : 'none',
                              }}
                            >
                              {h.hookText}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {seriesDrawerTab === 'lore' && (
                <>
                  {seriesCtx.seriesLoreSnippet && (
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '0.84rem', color: 'var(--accent-amber)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Bíblia Geral / Premissa Maior
                      </h4>
                      <div
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          padding: 12,
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                        }}
                      >
                        {seriesCtx.seriesLoreSnippet}
                      </div>
                    </div>
                  )}

                  {seriesCtx.memory?.loreRules && seriesCtx.memory.loreRules.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '0.84rem', color: 'var(--accent-lavender)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Regras Imutáveis do Universo
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {seriesCtx.memory.loreRules.map((rule, idx) => (
                          <li key={idx}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {seriesCtx.memory?.characters && seriesCtx.memory.characters.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '0.84rem', color: 'var(--accent-sage)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} /> Personagens Canônicos
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {seriesCtx.memory.characters.map((char) => (
                          <div
                            key={char.id}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px 10px',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{char.name}</strong>
                              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                                {char.role} • [{char.status}]
                              </span>
                            </div>
                            {char.notes && (
                              <div style={{ color: 'var(--text-secondary)', marginTop: 3, fontSize: '0.74rem' }}>
                                {char.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {seriesCtx.memory?.canonicalEvents && seriesCtx.memory.canonicalEvents.length > 0 && (
                    <div>
                      <h4 style={{ margin: '0 0 6px', fontSize: '0.84rem', color: 'var(--accent-terracotta)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Linha do Tempo de Episódios Anteriores
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {seriesCtx.memory.canonicalEvents.map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px 10px',
                              fontSize: '0.78rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                              <span
                                style={{
                                  fontSize: '0.66rem',
                                  fontFamily: 'var(--font-mono)',
                                  color: 'var(--accent-terracotta)',
                                  background: 'var(--tint-terracotta)',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                {ev.episodeTag}
                              </span>
                            </div>
                            <div style={{ color: 'var(--text-secondary)' }}>{ev.description}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Lightbox em Tela Cheia para Anexos / Prints */}
      {previewAttachmentUrl && (
        <div
          className="canvas-lightbox-backdrop"
          onClick={() => setPreviewAttachmentUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <button
            type="button"
            className="btn-studio"
            style={{ position: 'absolute', top: 20, right: 24, padding: '6px 12px', fontSize: '0.82rem' }}
            onClick={() => setPreviewAttachmentUrl(null)}
          >
            <X size={16} /> Fechar (Esc)
          </button>
          <img
            src={previewAttachmentUrl}
            alt="Anexo ampliado"
            style={{
              maxWidth: '92vw',
              maxHeight: '88vh',
              objectFit: 'contain',
              borderRadius: 8,
              boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ====================================================================
          MODO ULTRAFOCO (O card toma conta de toda a tela para foco total)
          ==================================================================== */}
      {ultrafocusCardId && (() => {
        const uCard = project.cards.find((c) => c.id === ultrafocusCardId);
        if (!uCard) return null;

        const uLensMeta = CREATIVE_LENSES.find((l) => l.id === uCard.lensId);
        const cardIndex = project.cards.findIndex((c) => c.id === uCard.id);
        const prevCard = cardIndex > 0 ? project.cards[cardIndex - 1] : null;
        const nextCard = cardIndex < project.cards.length - 1 ? project.cards[cardIndex + 1] : null;

        const totalWords = (uCard.body || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean).length;
        const totalChars = (uCard.body || '').length;

        const isSidebarChatOpen = openChatCardIds.includes(uCard.id);

        return (
          <div
            className="ultrafocus-overlay"
            onClick={(e) => e.stopPropagation()}
            onPaste={(e) => handleCardPaste(uCard.id, e)}
          >
            {/* Topbar Superior do Ultrafoco */}
            <header className="ultrafocus-topbar">
              <div className="ultrafocus-topbar-left">
                <span className="ultrafocus-badge">
                  <Focus size={14} /> Ultrafoco
                </span>

                <span className={`lens-badge ${uLensMeta?.badgeClass || 'amber'}`}>
                  {uLensMeta?.shortLabel || '✨ Insight Livre'}
                </span>

                {/* Seletor Visual de Cores */}
                <div className="card-color-picker-popover" title="Escolha a cor do card">
                  {(['default', 'amber', 'sage', 'terracotta', 'lavender', 'blue', 'rose'] as CardColor[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-dot-choice ${(uCard.color || 'default') === c ? 'active' : ''}`}
                      style={{
                        background: c === 'default' ? 'var(--border-strong)' : `var(--accent-${c})`,
                      }}
                      onClick={() => updateCardColor(uCard.id, c)}
                      title={`Cor: ${c}`}
                    />
                  ))}
                </div>

                {/* Seletor de Escaleta */}
                <select
                  value={uCard.beatAct || ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      assignCardToBeatAct(uCard.id, e.target.value as BeatActId);
                    }
                  }}
                  style={{
                    background: 'var(--bg-canvas)',
                    color: uCard.beatAct ? 'var(--accent-amber)' : 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 6,
                    padding: '3px 8px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Ato do Roteiro...</option>
                  {BEAT_ACT_LABELS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>

                {/* Memória Canônica se Série */}
                {(project.format === 'series_episode' || project.seriesContext) && (
                  <button
                    type="button"
                    onClick={() => toggleCardSeriesMemory(uCard.id)}
                    className="btn-studio"
                    style={{
                      padding: '3px 8px',
                      fontSize: '0.72rem',
                      borderColor: uCard.isCanonicalSeriesMemory ? 'var(--accent-amber)' : undefined,
                      color: uCard.isCanonicalSeriesMemory ? 'var(--accent-amber)' : 'var(--text-secondary)',
                      background: uCard.isCanonicalSeriesMemory ? 'var(--tint-amber)' : undefined,
                    }}
                    title="Promover à Memória Canônica da Série"
                  >
                    <Compass size={12} />
                    <span>Canônico</span>
                  </button>
                )}
              </div>

              {/* Centro: Contadores & Navegação de Cards */}
              <div className="ultrafocus-nav-center">
                <button
                  type="button"
                  className="btn-studio"
                  disabled={!prevCard}
                  onClick={() => prevCard && setUltrafocusCardId(prevCard.id)}
                  style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                  title={prevCard ? `Ir para anterior: "${prevCard.title}"` : 'Primeiro card'}
                >
                  <ChevronLeft size={14} /> Anterior
                </button>

                <span className="ultrafocus-counter-tag">
                  {totalWords} palavras • {totalChars} caracteres
                </span>

                <button
                  type="button"
                  className="btn-studio"
                  disabled={!nextCard}
                  onClick={() => nextCard && setUltrafocusCardId(nextCard.id)}
                  style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                  title={nextCard ? `Ir para próximo: "${nextCard.title}"` : 'Último card'}
                >
                  Próximo <ChevronRight size={14} />
                </button>
              </div>

              {/* Lado Direito: IA Debate & Fechar */}
              <div className="ultrafocus-topbar-right">
                <button
                  type="button"
                  onClick={() => toggleCardChat(uCard.id)}
                  className={`btn-studio ${isSidebarChatOpen ? 'amber' : ''}`}
                  style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                  title="Abrir debate com IA / Advogado do Diabo"
                >
                  <MessageSquare size={13} />
                  <span>Debate IA ({uCard.chatMessages?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAttachmentModalCardId(uCard.id)}
                  className="btn-studio"
                  style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                  title="Anexar arquivos ao card"
                >
                  <Paperclip size={13} />
                  <span>Anexos ({uCard.attachments?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUltrafocusCardId(null)}
                  className="btn-studio amber"
                  style={{ padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600 }}
                  title="Sair do Ultrafoco e voltar para o Canvas livre (Esc)"
                >
                  <Minimize2 size={13} />
                  <span>Sair do Ultrafoco (Esc)</span>
                </button>
              </div>
            </header>

            {/* Corpo Central do Ultrafoco */}
            <div className="ultrafocus-main-container">
              <div className="ultrafocus-editor-scroll">
                <div className="ultrafocus-paper">
                  {/* Título do Card em Grande Escala */}
                  <input
                    type="text"
                    value={uCard.title}
                    onChange={(e) =>
                      updateCardContent(uCard.id, e.target.value, uCard.body, uCard.subtextOrVisualCue)
                    }
                    placeholder="Título do Insight ou Gancho da Cena..."
                    className="ultrafocus-title-input"
                  />

                  {/* Campo de Cena / Direção Visual (Show, Don't Tell) */}
                  <div className="ultrafocus-subtext-section">
                    <span className="ultrafocus-section-label">
                      <Eye size={12} /> Cena / Direção Visual (Show, Don't Tell):
                    </span>
                    <textarea
                      value={uCard.subtextOrVisualCue || ''}
                      onChange={(e) =>
                        updateCardContent(uCard.id, uCard.title, uCard.body, e.target.value)
                      }
                      placeholder="O que vemos ou ouvimos em cena? Direção de arte, expressão dos atores, pistas no cenário, subtexto velado..."
                      className="ultrafocus-subtext-textarea"
                    />
                  </div>

                  {/* Desenvolvimento do Insight Principal */}
                  <div className="ultrafocus-body-section">
                    <span className="ultrafocus-section-label" style={{ color: 'var(--text-secondary)' }}>
                      <FileText size={12} /> Conteúdo & Desenvolvimento do Insight:
                    </span>
                    <textarea
                      value={uCard.body}
                      onChange={(e) =>
                        updateCardContent(uCard.id, uCard.title, e.target.value, uCard.subtextOrVisualCue)
                      }
                      placeholder="Escreva livremente sem distrações. Desenvolva o raciocínio, o diálogo, o dilema moral, a tese ou os detalhes cruciais da narrativa..."
                      className="ultrafocus-body-textarea"
                      autoFocus
                    />
                  </div>

                  {/* Citações Auditáveis Ancoradas */}
                  {uCard.citations.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <span className="ultrafocus-section-label" style={{ color: 'var(--accent-sage)', marginBottom: 8 }}>
                        <Quote size={12} /> Citações Ancoradas nas Fontes ({uCard.citations.length}):
                      </span>
                      <div className="citation-pills">
                        {uCard.citations.map((cit, idx) => (
                          <button
                            key={cit.id}
                            type="button"
                            className="citation-pill"
                            onClick={() => setActiveCitation(cit)}
                            title={`Auditar citação: "${cit.sourceTitle}"`}
                          >
                            <Quote size={11} /> [{idx + 1}] {cit.sourceTitle.slice(0, 36)}...
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Galeria de Anexos no Ultrafoco */}
                  {uCard.attachments && uCard.attachments.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <span className="ultrafocus-section-label" style={{ color: 'var(--accent-amber)', marginBottom: 8 }}>
                        <Paperclip size={12} /> Evidências & Anexos Visuais ({uCard.attachments.length}):
                      </span>
                      <div className="card-attachments-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                        {uCard.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="card-attachment-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (att.dataUrl) setPreviewAttachmentUrl(att.dataUrl);
                            }}
                            title={`${att.title} (clique para ampliar)`}
                            style={{ aspectRatio: '16/9' }}
                          >
                            {att.type === 'image' && att.dataUrl ? (
                              <img src={att.dataUrl} alt={att.title} className="card-attachment-thumb" />
                            ) : (
                              <div className="card-attachment-snippet">
                                <FileText size={14} style={{ color: 'var(--accent-amber)', marginBottom: 2 }} />
                                <span style={{ fontSize: '0.72rem', fontWeight: 600 }}>{att.title.slice(0, 20)}</span>
                                {att.textContent && (
                                  <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                                    "{att.textContent.slice(0, 40)}..."
                                  </span>
                                )}
                              </div>
                            )}
                            <button
                              type="button"
                              className="card-attachment-del-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCardAttachment(uCard.id, att.id);
                              }}
                              title="Remover anexo"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Barra de Acionamento Rápida do Debate IA Abaixo quando fechado */}
                  {!isSidebarChatOpen && (
                    <div
                      className="ultrafocus-bottom-dock-trigger"
                      onClick={() => toggleCardChat(uCard.id)}
                      title="Abrir o Chatbot de Debate com a IA posicionado abaixo"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--tint-amber)',
                            border: '1px solid rgba(226, 160, 74, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-amber)',
                            flexShrink: 0,
                          }}
                        >
                          <Sparkles size={16} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.86rem' }}>
                            Debate IA & Advogado do Diabo
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Abra a conversa abaixo para testar a consistência do roteiro, encontrar furos e refinar o subtexto.
                          </span>
                        </div>
                      </div>
                      <span className="btn-studio amber" style={{ padding: '5px 12px', fontSize: '0.76rem', fontWeight: 600 }}>
                        <MessageSquare size={12} /> Abrir Chatbot Abaixo ↓
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Painel de Debate IA Abaixo (Interface de Chatbot Clássica) */}
              {isSidebarChatOpen && (
                <section className="ultrafocus-bottom-chat-pane">
                  {/* Cabeçalho do Chatbot */}
                  <div className="ultrafocus-bottom-chat-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: 'var(--accent-amber)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Sparkles size={14} /> Debate IA do Card
                      </span>

                      {/* Seletor de Personalidade / Lente Criativa */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Lente:</span>
                        <select
                          className="ultrafocus-bottom-chat-lens-select"
                          value={cardChatLens[uCard.id] || 'devils_advocate'}
                          onChange={(e) =>
                            setCardChatLens((prev) => ({
                              ...prev,
                              [uCard.id]: e.target.value as CreativeLensId,
                            }))
                          }
                        >
                          <option value="devils_advocate">🔥 Advogado do Diabo (Crítico & Anti-Clichê)</option>
                          <option value="conflict_subtext">👁️ Conflito & Subtexto (Show, Don't Tell)</option>
                          <option value="hook_engineering">🎣 Gancho 30s & Retenção</option>
                          <option value="theme_cross">🧪 Colisão de Fontes & Ideias</option>
                          <option value="free_provocation">✨ Consultor Narrativo Livre</option>
                        </select>
                      </div>

                      <span
                        style={{
                          fontSize: '0.70rem',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                          background: 'var(--bg-canvas)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {Math.floor((uCard.chatMessages?.length || 0) / 2)} turnos
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {/* Alternar Rejeitadas */}
                      {(() => {
                        const rejectedCount = (uCard.chatMessages || []).filter((m) => m.isRejected).length;
                        if (rejectedCount === 0) return null;
                        return (
                          <button
                            type="button"
                            className="btn-studio"
                            style={{ padding: '3px 7px', fontSize: '0.70rem' }}
                            onClick={() =>
                              setHideRejectedByCard((prev) => ({
                                ...prev,
                                [uCard.id]: !prev[uCard.id],
                              }))
                            }
                            title={
                              hideRejectedByCard[uCard.id]
                                ? 'Exibir respostas que foram rejeitadas'
                                : 'Ocultar respostas rejeitadas da conversa visual'
                            }
                          >
                            {hideRejectedByCard[uCard.id] ? <Eye size={12} /> : <EyeOff size={12} />}
                            <span>{hideRejectedByCard[uCard.id] ? `Ver Rejeitadas (${rejectedCount})` : `Ocultar Rejeitadas (${rejectedCount})`}</span>
                          </button>
                        );
                      })()}

                      {/* Reiniciar Chat */}
                      {uCard.chatMessages && uCard.chatMessages.length > 0 && (
                        <button
                          type="button"
                          className="btn-studio"
                          style={{ padding: '3px 8px', fontSize: '0.70rem' }}
                          onClick={() => clearCardChat(uCard.id)}
                          title="Limpar mensagens e reiniciar este debate do zero"
                        >
                          <Trash2 size={12} /> Reiniciar
                        </button>
                      )}

                      {/* Recolher Chatbot */}
                      <button
                        type="button"
                        className="btn-studio"
                        style={{ padding: '3px 8px', fontSize: '0.70rem' }}
                        onClick={() => toggleCardChat(uCard.id)}
                        title="Recolher painel de chat"
                      >
                        <ChevronDown size={13} /> Recolher Chat
                      </button>
                    </div>
                  </div>

                  {/* Corpo de Mensagens estilo Chatbot */}
                  <div className="ultrafocus-bottom-chat-body">
                    <div className="ultrafocus-bottom-chat-inner">
                      {(!uCard.chatMessages || uCard.chatMessages.length === 0) ? (
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                          <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                            💡 Inicie uma conversa para testar hipóteses, achar furos narrativos ou transformar fatos em conflito dramático.
                          </p>
                          <div className="ultrafocus-chat-suggestions">
                            {[
                              '🔥 Onde está o maior furo de verossimilhança ou lógica nesta cena?',
                              '👁️ Como expressar esse conflito sem usar diálogos didáticos?',
                              '⚡ Dê 3 ideias de ganchos de abertura contraintuitivos para este ponto.',
                            ].map((sugg) => (
                              <button
                                key={sugg}
                                type="button"
                                className="ultrafocus-suggestion-chip"
                                onClick={() => {
                                  setCardChatInputs((prev) => ({ ...prev, [uCard.id]: sugg }));
                                }}
                              >
                                {sugg}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        uCard.chatMessages.map((msg) => {
                          const isCardRejectedHidden = !!hideRejectedByCard[uCard.id] && !!msg.isRejected;
                          if (isCardRejectedHidden) return null;

                          return (
                            <div
                              key={msg.id}
                              className={`ultrafocus-chat-row ${msg.sender} ${
                                msg.lensId === 'devils_advocate' && msg.sender === 'assistant' ? 'devils-advocate' : ''
                              }`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.70rem', color: 'var(--text-muted)' }}>
                                <span>{msg.sender === 'user' ? 'Você' : (CREATIVE_LENSES.find((l) => l.id === msg.lensId)?.name || 'IA')}</span>
                                {msg.isRejected && (
                                  <span style={{ color: 'var(--accent-terracotta)', fontWeight: 600 }}>• REJEITADA</span>
                                )}
                              </div>

                              <div className={`ultrafocus-chat-bubble ${msg.isRejected ? 'rejected' : ''}`}>
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>

                                {msg.sender === 'assistant' && (
                                  <div className="ultrafocus-chat-bubble-actions">
                                    <button
                                      type="button"
                                      className="btn-studio"
                                      style={{ padding: '2px 7px', fontSize: '0.69rem', color: 'var(--accent-sage)' }}
                                      onClick={() => {
                                        const currentBody = uCard.body ? `${uCard.body}\n\n${msg.text}` : msg.text;
                                        updateCardContent(uCard.id, uCard.title, currentBody, uCard.subtextOrVisualCue);
                                      }}
                                      title="Adicionar o texto desta resposta ao final do corpo do card"
                                    >
                                      <Check size={11} /> Inserir no Card
                                    </button>

                                    <button
                                      type="button"
                                      className="btn-studio"
                                      style={{
                                        padding: '2px 7px',
                                        fontSize: '0.69rem',
                                        color: msg.isRejected ? 'var(--accent-amber)' : 'var(--accent-terracotta)',
                                      }}
                                      onClick={() => toggleRejectCardChatMessage(uCard.id, msg.id)}
                                      title="Rejeitar esta resposta para não ser usada como contexto no próximo turno"
                                    >
                                      <Ban size={11} /> {msg.isRejected ? 'Reabilitar' : 'Rejeitar Resposta'}
                                    </button>

                                    <button
                                      type="button"
                                      className="btn-studio"
                                      style={{ padding: '2px 7px', fontSize: '0.69rem' }}
                                      onClick={() => deleteCardChatMessage(uCard.id, msg.id)}
                                      title="Excluir mensagem definitivamente"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}

                      {cardChatRunningId === uCard.id && (
                        <div className="ultrafocus-chat-row assistant">
                          <div className="ultrafocus-chat-bubble" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <Loader2 size={14} className="spin" style={{ color: 'var(--accent-amber)' }} />
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              IA analisando premissas narrativas e consultando fontes ativas...
                            </span>
                          </div>
                        </div>
                      )}

                      <div ref={chatMessagesEndRef} />
                    </div>
                  </div>

                  {/* Barra de Entrada Centralizada na Base (Cápsula de Chatbot Moderno) */}
                  <div className="ultrafocus-bottom-chat-input-container">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const txt = (cardChatInputs[uCard.id] || '').trim();
                        if (!txt || cardChatRunningId === uCard.id) return;
                        setCardChatInputs((prev) => ({ ...prev, [uCard.id]: '' }));
                        await sendCardChatMessage(uCard.id, txt, cardChatLens[uCard.id] || 'devils_advocate');
                        setTimeout(() => {
                          chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }, 80);
                      }}
                    >
                      <div className="ultrafocus-bottom-chat-input-capsule">
                        <textarea
                          className="ultrafocus-bottom-chat-textarea"
                          rows={1}
                          placeholder="Pergunte, provoque o Advogado do Diabo ou teste a consistência desta cena... (Enter para enviar)"
                          value={cardChatInputs[uCard.id] || ''}
                          onChange={(e) =>
                            setCardChatInputs((prev) => ({ ...prev, [uCard.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const form = e.currentTarget.closest('form');
                              if (form) form.requestSubmit();
                            }
                          }}
                        />
                        <button
                          type="submit"
                          className="ultrafocus-bottom-chat-send-btn"
                          disabled={!(cardChatInputs[uCard.id] || '').trim() || cardChatRunningId === uCard.id}
                          title="Enviar mensagem (Enter)"
                        >
                          <Send size={14} />
                        </button>
                      </div>
                    </form>
                  </div>
                </section>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
