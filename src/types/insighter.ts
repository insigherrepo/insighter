export type ProjectFormat =
  | 'fiction_film'
  | 'video_essay'
  | 'documentary'
  | 'series_bible'
  | 'series_episode'
  | 'article'
  | 'book'
  | 'free_brainstorm'
  | 'study_group_meeting';

export interface SeriesCharacter {
  id: string;
  name: string;
  role: string;
  status: 'alive' | 'dead' | 'missing' | 'unknown';
  notes: string;
}

export interface SeriesCanonicalEvent {
  id: string;
  episodeTag: string; // Ex: "T1E1"
  description: string;
  impactOnLore?: string;
}

export interface SeriesOpenHook {
  id: string;
  originEpisodeTag: string; // Ex: "T1E1"
  hookText: string;
  resolved: boolean;
  resolvedInEpisodeTag?: string;
}

export interface SeriesPersistentMemory {
  seriesId: string;
  seriesTitle: string;
  characters?: SeriesCharacter[];
  canonicalEvents?: SeriesCanonicalEvent[];
  unresolvedHooks?: SeriesOpenHook[];
  loreRules?: string[];
  canonicalCards?: InsightCard[];
}

export interface SeriesContext {
  mode: 'new' | 'existing';
  seriesTitle: string;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesId?: string;
  seriesLoreSnippet?: string;
  parentCards?: InsightCard[];
  parentSources?: SourceItem[];
  inheritCardsAsSource?: boolean;
  inheritSources?: boolean;
  memory?: SeriesPersistentMemory;
}

export interface BookContext {
  byChapters: boolean;
  chapterNumber?: number;
  chapterTitle?: string;
  totalChaptersPlanned?: number;
}

export interface FreeBrainstormContext {
  subtype: 'free_exploration' | 'solo_study';
  studyTopic?: string;
  studyGoal?: string;
}

export interface MeetingGroupContext {
  meetingType: 'study_group' | 'team_meeting';
  requiredPartnerEmail: string;
  agendaTopic?: string;
}

export type SourceType =
  | 'pdf_article'
  | 'image_visual'
  | 'youtube_transcript'
  | 'script_draft'
  | 'lore_bible'
  | 'raw_notes'
  | 'distilled_note';

export type CreativeLensId =
  | 'hook_engineering'
  | 'data_to_scene'
  | 'conflict_subtext'
  | 'hidden_patterns'
  | 'continuity_lore'
  | 'devils_advocate'
  | 'free_provocation'
  | 'card_synthesis';

export type BeatActId = 'hook_0_30s' | 'act_1_setup' | 'act_2_escalation' | 'midpoint_twist' | 'act_3_climax';

export interface Citation {
  id: string;
  sourceId: string;
  sourceTitle: string;
  quote: string;
  contextPassage: string;
  whyItMatters: string;
}

export interface SourceItem {
  id: string;
  title: string;
  type: SourceType;
  authorOrOrigin: string;
  content: string;
  summary: string;
  isActive: boolean;
  filePath?: string;
  mimeType?: string;
  mediaDataUrl?: string;
  originCardIds?: string[];
  createdAt: string;
}

export type CardColor = 'default' | 'amber' | 'sage' | 'terracotta' | 'lavender' | 'blue' | 'rose';

export interface CardChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  lensId?: CreativeLensId;
  timestamp: string;
  isRejected?: boolean;
  isHidden?: boolean;
}

export interface CardGroup {
  id: string;
  title: string;
  color?: CardColor;
  cardIds: string[];
  createdAt: string;
}

export type AttachmentType = 'image' | 'pdf_snippet' | 'text_snippet';

export interface CardAttachment {
  id: string;
  type: AttachmentType;
  title: string;
  dataUrl?: string;
  textContent?: string;
  fileName?: string;
  fileSize?: number;
  createdAt: string;
}

export interface InsightCard {
  id: string;
  lensId: CreativeLensId;
  title: string;
  body: string;
  subtextOrVisualCue?: string;
  position: { x: number; y: number };
  dimensions?: { width: number; height?: number };
  citations: Citation[];
  tags: string[];
  beatAct?: BeatActId;
  isPinned: boolean;
  color?: CardColor;
  groupId?: string;
  chatMessages?: CardChatMessage[];
  attachments?: CardAttachment[];
  isCanonicalSeriesMemory?: boolean;
  createdAt: string;
}

export type ConnectionPortSide = 'top' | 'bottom' | 'left' | 'right';

export interface CanvasConnection {
  id: string;
  fromCardId: string;
  toCardId: string;
  label: string;
  fromSide?: ConnectionPortSide;
  toSide?: ConnectionPortSide;
}

export interface ScriptBeat {
  id: string;
  act: BeatActId;
  title: string;
  sceneHeading: string;
  content: string;
  linkedCardIds: string[];
  durationEstimate: string;
}

export interface DebateTurn {
  id: string;
  speaker:
    | 'Sofia (Arquiteta Narrativa)'
    | 'Marco (Advogado do Diabo & Script Doctor Cético)'
    | 'Marco (Script Doctor Cético)';
  role: 'defender' | 'critic';
  text: string;
  actionableTakeaway: string;
  citedSourceId?: string;
}

export interface AudioDebateSession {
  id: string;
  title: string;
  focusDirective: string;
  turns: DebateTurn[];
  audioDataUrl?: string;
  createdAt: string;
}

export type MemberRole = 'owner' | 'editor' | 'viewer';
export type MemberStatus = 'pending' | 'accepted';

export interface ProjectMember {
  id: string;
  projectId: string;
  userId?: string;
  invitedEmail: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: string;
}

export interface ProjectData {
  id: string;
  title: string;
  logline: string;
  format: ProjectFormat;
  seriesContext?: SeriesContext;
  bookContext?: BookContext;
  freeBrainstormContext?: FreeBrainstormContext;
  meetingGroupContext?: MeetingGroupContext;
  updatedAt: string;
  sources: SourceItem[];
  cards: InsightCard[];
  connections: CanvasConnection[];
  groups?: CardGroup[];
  beats: ScriptBeat[];
  debates: AudioDebateSession[];
  ownerEmail?: string;
  ownerId?: string;
  members?: ProjectMember[];
  userRole?: MemberRole;
  isShared?: boolean;
  isDemo?: boolean;
  isTrashed?: boolean;
  trashedAt?: string;
  viewport?: {
    pan: { x: number; y: number };
    zoom: number;
  };
  meetingLiveState?: {
    isActive: boolean;
    presenterEmail?: string;
    presenterName?: string;
    pan: { x: number; y: number };
    zoom: number;
    ultrafocusCardId?: string | null;
    cursorPosition?: { x: number; y: number } | null;
    updatedAt: string;
  };
}

export interface CreativeLensConfig {
  id: CreativeLensId;
  name: string;
  shortLabel: string;
  tagline: string;
  accentVar: '--accent-amber' | '--accent-sage' | '--accent-terracotta' | '--accent-lavender';
  badgeClass: 'amber' | 'sage' | 'terracotta' | 'lavender';
  promptTemplate: string;
}
