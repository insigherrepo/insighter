import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { MemberRole, MemberStatus, ProjectData, ProjectMember } from '../types/insighter';

const SUPABASE_URL = 'https://jhqekiyqmuamwrfvbnbn.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpocWVraXlxbXVhbXdyZnZibmJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MzA5MjMsImV4cCI6MjEwODIwNjkyM30.dOXNO8RrjfWZ4KrKsAIb4RVEL90aPx1awy8o_HOaCKU';

let cachedClient: SupabaseClient | null = null;
let cachedGeminiDbKey: string | null = null;

export interface AuthUserProfile {
  id: string;
  email: string;
  fullName?: string;
}

export function mapSupabaseUser(user: User | null): AuthUserProfile | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || '',
    fullName: (user.user_metadata?.full_name as string) || undefined,
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}

/**
 * Busca a chave da API do Google Gemini exclusivamente a partir do banco de dados Supabase
 * (tabela `public.app_secrets` protegida no banco, sem botões na UI nem exposição em .env).
 */
export async function fetchGeminiApiKeyFromDatabase(): Promise<string> {
  if (import.meta.env.MODE === 'test') return '';
  if (cachedGeminiDbKey) return cachedGeminiDbKey;

  const client = getSupabaseClient();
  if (!client) return '';

  try {
    // 1. Consulta prioritária na tabela SQL public.app_secrets do banco de dados
    const { data, error } = await client
      .from('app_secrets')
      .select('value')
      .eq('key', 'GEMINI_API_KEY')
      .single();

    if (!error && data?.value) {
      cachedGeminiDbKey = String(data.value).trim();
      return cachedGeminiDbKey;
    }

    // 2. Fallback no cofre privado app-secrets-db do servidor Supabase (caso a tabela SQL ainda não tenha sido criada)
    const { data: refBlob, error: refErr } = await client.storage
      .from('insighter-projects')
      .download('_system/db_secret_ref.json');

    if (!refErr && refBlob) {
      const { ref } = JSON.parse(await refBlob.text()) as { ref?: string };
      if (ref) {
        const resp = await fetch(ref);
        if (resp.ok) {
          const secretJson = (await resp.json()) as { GEMINI_API_KEY?: string };
          if (secretJson.GEMINI_API_KEY) {
            cachedGeminiDbKey = secretJson.GEMINI_API_KEY.trim();
            return cachedGeminiDbKey;
          }
        }
      }
    }
  } catch {
    // falha silenciosa caso offline
  }

  return '';
}

export async function signInWithEmail(email: string, password: string): Promise<{
  user: AuthUserProfile | null;
  error: string | null;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, error: 'Conexão com o banco Supabase indisponível.' };
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    return { user: null, error: error.message };
  }
  return { user: mapSupabaseUser(data.user), error: null };
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{
  user: AuthUserProfile | null;
  needsEmailConfirmation: boolean;
  error: string | null;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, needsEmailConfirmation: false, error: 'Conexão com o banco Supabase indisponível.' };
  }
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });
  if (error) {
    return { user: null, needsEmailConfirmation: false, error: error.message };
  }
  const needsEmailConfirmation = Boolean(data.user && !data.session);
  return {
    user: mapSupabaseUser(data.user),
    needsEmailConfirmation,
    error: null,
  };
}

export async function signOutFromSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

const LOCAL_PROJECTS_INDEX_KEY = 'insighter_saved_projects_index_v1';

export function saveProjectToLocalIndex(project: ProjectData): void {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') return;
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    const list: ProjectData[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((p) => p.id !== project.id);
    const updated = [{ ...project, updatedAt: new Date().toISOString() }, ...filtered].slice(0, 50);
    window.localStorage.setItem(LOCAL_PROJECTS_INDEX_KEY, JSON.stringify(updated));
  } catch {
    // ignore quota issues
  }
}

export function removeProjectFromLocalIndex(projectId: string): void {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') return;
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    const list: ProjectData[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((p) => p.id !== projectId);
    window.localStorage.setItem(LOCAL_PROJECTS_INDEX_KEY, JSON.stringify(filtered));
  } catch {
    // ignore
  }
}

export function getLocalProjectsIndex(): ProjectData[] {
  if (typeof window === 'undefined' || typeof window.localStorage?.getItem !== 'function') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_PROJECTS_INDEX_KEY);
    return raw ? (JSON.parse(raw) as ProjectData[]) : [];
  } catch {
    return [];
  }
}

/**
 * Estágio 1: Move um brainstorm para a Lixeira (isTrashed = true, trashedAt = ISO)
 */
export async function moveProjectToTrash(project: ProjectData): Promise<{ ok: boolean; project: ProjectData }> {
  const trashed: ProjectData = {
    ...project,
    isTrashed: true,
    trashedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await syncProjectToSupabase(trashed);
  return { ok: true, project: trashed };
}

/**
 * Restaura um brainstorm da Lixeira de volta para os brainstorms ativos
 */
export async function restoreProjectFromTrash(project: ProjectData): Promise<{ ok: boolean; project: ProjectData }> {
  const restored: ProjectData = {
    ...project,
    isTrashed: false,
    trashedAt: undefined,
    updatedAt: new Date().toISOString(),
  };
  await syncProjectToSupabase(restored);
  return { ok: true, project: restored };
}

/**
 * Estágio 2: Exclui definitivamente um brainstorm que já está na Lixeira (local + Supabase SQL + Storage)
 */
export async function permanentlyDeleteProjectFromTrash(
  projectId: string
): Promise<{ ok: boolean; error?: string }> {
  removeProjectFromLocalIndex(projectId);

  const client = getSupabaseClient();
  if (!client || import.meta.env.MODE === 'test') {
    return { ok: true };
  }

  try {
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user?.id || null;
    const scopedId = userId ? `${userId}_${projectId}` : projectId;

    await client
      .from('projects')
      .delete()
      .or(`id.eq.${projectId},id.eq.${scopedId}`);

    const pathsToDelete = [`public/${projectId}.json`];
    if (userId) {
      pathsToDelete.push(`${userId}/${projectId}.json`);
    }
    await client.storage.from('insighter-projects').remove(pathsToDelete);

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Sincroniza o estado completo do projeto com o Supabase (vinculado ao usuário autenticado ou compartilhado)
 */
export async function syncProjectToSupabase(project: ProjectData): Promise<{ ok: boolean; message: string }> {
  saveProjectToLocalIndex(project);

  const client = getSupabaseClient();
  if (!client) {
    return {
      ok: false,
      message: 'Salvo localmente.',
    };
  }

  try {
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user?.id || null;
    const userEmail = sessionData.session?.user?.email?.toLowerCase() || undefined;

    if (!project.ownerId && userId) {
      project.ownerId = userId;
    }
    if (!project.ownerEmail && userEmail) {
      project.ownerEmail = userEmail;
    }

    const { error } = await client.from('projects').upsert(
      {
        id: project.id,
        user_id: project.ownerId || userId,
        title: project.title,
        logline: project.logline,
        format: project.format,
        updated_at: new Date().toISOString(),
        payload: project,
      },
      { onConflict: 'id' }
    );

    if (error) {
      if (error.code === 'PGRST205') {
        const folder = userId || 'public';
        const storagePath = `${folder}/${project.id}.json`;
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const { error: storageErr } = await client.storage
          .from('insighter-projects')
          .upload(storagePath, blob, { upsert: true });
        if (!storageErr) {
          return {
            ok: true,
            message: 'Salvo no servidor Supabase',
          };
        }
      }
      return { ok: false, message: `Erro ao sincronizar no Supabase: ${error.message}` };
    }

    return { ok: true, message: 'Salvo no banco de dados Supabase' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Falha de rede Supabase: ${msg}` };
  }
}

/**
 * Busca os brainstorms/insights salvos no servidor Supabase com paginação (limit e offset) e filtro colaborativo
 */
export async function listRecentProjectsFromSupabase(
  limit = 10,
  offset = 0,
  filterMode: 'all' | 'owned' | 'shared' = 'all'
): Promise<{
  projects: ProjectData[];
  totalCount: number;
  hasMore: boolean;
  origin: 'supabase_sql' | 'supabase_storage' | 'local_cache';
}> {
  const localList = getLocalProjectsIndex();
  const client = getSupabaseClient();
  if (!client) {
    let filtered = localList;
    if (filterMode === 'owned') filtered = localList.filter((p) => !p.isShared);
    if (filterMode === 'shared') filtered = localList.filter((p) => p.isShared);
    const sliced = filtered.slice(offset, offset + limit);
    return {
      projects: sliced,
      totalCount: filtered.length,
      hasMore: offset + limit < filtered.length,
      origin: 'local_cache',
    };
  }

  try {
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user?.id || null;
    const userEmail = sessionData.session?.user?.email?.toLowerCase() || null;

    let query = client
      .from('projects')
      .select('payload, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId && filterMode === 'owned') {
      query = query.eq('user_id', userId);
    }

    const { data, count, error } = await query;

    if (!error && Array.isArray(data)) {
      let remoteProjects = data
        .map((row) => row.payload as ProjectData)
        .filter((p) => Boolean(p && p.id));

      remoteProjects = remoteProjects.map((p) => {
        const isOwner = (p.ownerId && p.ownerId === userId) || (p.ownerEmail && p.ownerEmail.toLowerCase() === userEmail);
        const member = p.members?.find((m) => m.invitedEmail.toLowerCase() === userEmail);
        return {
          ...p,
          isShared: Boolean(!isOwner && (p.ownerEmail || p.ownerId || member)),
          userRole: isOwner ? ('owner' as MemberRole) : (member?.role || ('editor' as MemberRole)),
        };
      });

      if (filterMode === 'owned') {
        remoteProjects = remoteProjects.filter((p) => !p.isShared);
      } else if (filterMode === 'shared') {
        remoteProjects = remoteProjects.filter((p) => p.isShared);
      }

      const total = count ?? (offset + remoteProjects.length);
      return {
        projects: remoteProjects,
        totalCount: total,
        hasMore: offset + limit < total,
        origin: 'supabase_sql',
      };
    }

    const folder = userId || 'public';
    const { data: files, error: listErr } = await client.storage
      .from('insighter-projects')
      .list(folder, {
        sortBy: { column: 'updated_at', order: 'desc' },
      });

    if (!listErr && Array.isArray(files) && files.length > 0) {
      const jsonFiles = files.filter((f) => f.name.endsWith('.json'));
      const pageFiles = jsonFiles.slice(offset, offset + limit);
      const downloaded = await Promise.all(
        pageFiles.map(async (fileItem) => {
          const { data: blob } = await client.storage
            .from('insighter-projects')
            .download(`${folder}/${fileItem.name}`);
          if (!blob) return null;
          try {
            const text = await blob.text();
            return JSON.parse(text) as ProjectData;
          } catch {
            return null;
          }
        })
      );

      const validRemote = downloaded.filter((p): p is ProjectData => p !== null);
      return {
        projects: validRemote,
        totalCount: jsonFiles.length,
        hasMore: offset + limit < jsonFiles.length,
        origin: 'supabase_storage',
      };
    }
  } catch {
    // fallback para cache local se sem internet
  }

  let filtered = localList;
  if (filterMode === 'owned') filtered = localList.filter((p) => !p.isShared);
  if (filterMode === 'shared') filtered = localList.filter((p) => p.isShared);
  const sliced = filtered.slice(offset, offset + limit);
  return {
    projects: sliced,
    totalCount: filtered.length,
    hasMore: offset + limit < filtered.length,
    origin: 'local_cache',
  };
}

export async function loadProjectFromSupabase(projectId: string): Promise<ProjectData | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data: sessionData } = await client.auth.getSession();
    const userId = sessionData.session?.user?.id || null;
    const userEmail = sessionData.session?.user?.email?.toLowerCase() || null;
    const scopedId = userId ? `${userId}_${projectId}` : projectId;

    const { data, error } = await client
      .from('projects')
      .select('payload')
      .or(`id.eq.${projectId},id.eq.${scopedId}`)
      .limit(1)
      .maybeSingle();

    if (!error && data?.payload) {
      const proj = data.payload as ProjectData;
      const isOwner = (proj.ownerId && proj.ownerId === userId) || (proj.ownerEmail && proj.ownerEmail.toLowerCase() === userEmail);
      const member = proj.members?.find((m) => m.invitedEmail.toLowerCase() === userEmail);
      proj.isShared = Boolean(!isOwner && (proj.ownerEmail || proj.ownerId || member));
      proj.userRole = isOwner ? 'owner' : (member?.role || 'editor');
      return proj;
    }

    const storagePath = userId ? `${userId}/${projectId}.json` : `public/${projectId}.json`;
    const { data: fileBlob, error: downloadErr } = await client.storage
      .from('insighter-projects')
      .download(storagePath);

    if (!downloadErr && fileBlob) {
      const text = await fileBlob.text();
      return JSON.parse(text) as ProjectData;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convida um colaborador para o projeto por e-mail com papel definido ('editor' ou 'viewer')
 */
export async function inviteProjectMember(
  projectId: string,
  email: string,
  role: MemberRole = 'editor'
): Promise<{ ok: boolean; member?: ProjectMember; error?: string }> {
  const client = getSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();

  const newMember: ProjectMember = {
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    projectId,
    invitedEmail: normalizedEmail,
    role,
    status: 'accepted',
    createdAt: new Date().toISOString(),
  };

  if (!client) {
    return { ok: true, member: newMember };
  }

  try {
    const { data, error } = await client
      .from('project_members')
      .upsert(
        {
          project_id: projectId,
          invited_email: normalizedEmail,
          role,
          status: 'accepted',
        },
        { onConflict: 'project_id,invited_email' }
      )
      .select()
      .single();

    if (!error && data) {
      return {
        ok: true,
        member: {
          id: data.id,
          projectId: data.project_id,
          userId: data.user_id,
          invitedEmail: data.invited_email,
          role: data.role as MemberRole,
          status: data.status as MemberStatus,
          createdAt: data.created_at,
        },
      };
    }
  } catch {
    // se offline ou tabela pendente de migração, permite salvar localmente
  }

  return { ok: true, member: newMember };
}

/**
 * Remove um colaborador do projeto
 */
export async function removeProjectMember(
  projectId: string,
  memberEmail: string
): Promise<{ ok: boolean; error?: string }> {
  const client = getSupabaseClient();
  if (!client || import.meta.env.MODE === 'test') return { ok: true };

  try {
    const { error } = await client
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('invited_email', memberEmail.trim().toLowerCase());

    if (error) {
      // Se a tabela ainda não foi criada no banco remoto, permite a remoção local
      return { ok: true };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * Lista todos os membros de um projeto
 */
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);

    if (!error && Array.isArray(data)) {
      return data.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        invitedEmail: row.invited_email,
        role: row.role as MemberRole,
        status: row.status as MemberStatus,
        createdAt: row.created_at,
      }));
    }
  } catch {
    // fallback
  }

  return [];
}

export interface LiveMeetingPayload {
  projectId: string;
  presenterEmail: string;
  presenterName?: string;
  pan: { x: number; y: number };
  zoom: number;
  ultrafocusCardId: string | null;
  cursorPosition?: { x: number; y: number } | null;
  timestamp: number;
}

/**
 * Cria o canal em tempo real para sincronização de tela e reunião entre colaboradores (Realtime Broadcast + BroadcastChannel local)
 */
export function createProjectLiveChannel(
  projectId: string,
  onMeetingUpdate: (payload: LiveMeetingPayload) => void,
  onProjectUpdate?: (project: ProjectData) => void
): {
  broadcastMeetingState: (payload: Omit<LiveMeetingPayload, 'projectId' | 'timestamp'>) => void;
  broadcastProjectUpdate: (project: ProjectData) => void;
  leave: () => void;
} {
  const localChannelName = `insighter_meeting_live_${projectId}`;
  let bc: BroadcastChannel | null = null;
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(localChannelName);
      bc.onmessage = (event) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'meeting_live' && data.payload) {
          onMeetingUpdate(data.payload as LiveMeetingPayload);
        } else if (data.type === 'project_live' && data.project && onProjectUpdate) {
          onProjectUpdate(data.project as ProjectData);
        }
      };
    }
  } catch {
    // ignore
  }

  const client = getSupabaseClient();
  let supabaseChannel: ReturnType<NonNullable<typeof client>['channel']> | null = null;

  if (client) {
    try {
      supabaseChannel = client.channel(`project-live-${projectId}`, {
        config: { broadcast: { self: false } },
      });

      supabaseChannel
        .on('broadcast', { event: 'meeting_live' }, ({ payload }) => {
          if (payload) {
            onMeetingUpdate(payload as LiveMeetingPayload);
          }
        })
        .on('broadcast', { event: 'project_live' }, ({ payload }) => {
          if (payload?.project && onProjectUpdate) {
            onProjectUpdate(payload.project as ProjectData);
          }
        })
        .subscribe();
    } catch {
      // fallback
    }
  }

  return {
    broadcastMeetingState: (payload) => {
      const fullPayload: LiveMeetingPayload = {
        ...payload,
        projectId,
        timestamp: Date.now(),
      };
      if (bc) {
        try {
          bc.postMessage({ type: 'meeting_live', payload: fullPayload });
        } catch {
          // ignore
        }
      }
      if (supabaseChannel) {
        supabaseChannel.send({
          type: 'broadcast',
          event: 'meeting_live',
          payload: fullPayload,
        }).catch(() => {});
      }
    },
    broadcastProjectUpdate: (project) => {
      if (bc) {
        try {
          bc.postMessage({ type: 'project_live', project });
        } catch {
          // ignore
        }
      }
      if (supabaseChannel) {
        supabaseChannel.send({
          type: 'broadcast',
          event: 'project_live',
          payload: { project },
        }).catch(() => {});
      }
    },
    leave: () => {
      if (bc) {
        try {
          bc.close();
        } catch {
          // ignore
        }
      }
      if (supabaseChannel && client) {
        try {
          client.removeChannel(supabaseChannel);
        } catch {
          // ignore
        }
      }
    },
  };
}
