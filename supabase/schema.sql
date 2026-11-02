-- ============================================================================
-- INSIGHTER — Schema PostgreSQL / Supabase (Desktop + Web Cloud Sync + Auth RLS)
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- 1. Projetos / Cadernos de Roteiro (vinculados ao usuário autenticado no Supabase Auth)
create table if not exists public.projects (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  logline text not null default '',
  format text not null default 'video_essay',
  updated_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb
);

-- 2. Fontes de Pesquisa (PDFs, Transcrições, Lore, Notas Destiladas)
create table if not exists public.sources (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  title text not null,
  type text not null,
  content text not null,
  summary text not null default '',
  is_active boolean not null default true,
  origin_card_ids jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 3. Cards de Insight no Canvas Livre
create table if not exists public.insight_cards (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  lens_id text not null,
  title text not null,
  body text not null,
  subtext_note text default '',
  position_x double precision not null default 100,
  position_y double precision not null default 100,
  citations jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  beat_act text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- 4. Conexões Visuais no Canvas
create table if not exists public.canvas_connections (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  from_card_id text not null,
  to_card_id text not null,
  label text not null default 'Conexão Narrativa'
);

-- 5. Escaleta / Beats de Roteiro
create table if not exists public.script_beats (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  act text not null,
  title text not null,
  scene_heading text not null default '',
  content text not null default '',
  linked_card_ids jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0
);

-- 6. Sessões da Sala de Roteiristas em Áudio (Multi-Speaker Debate)
create table if not exists public.audio_debates (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  focus_directive text not null,
  turns jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_projects_user on public.projects(user_id);
create index if not exists idx_sources_project on public.sources(project_id);
create index if not exists idx_cards_project on public.insight_cards(project_id);
create index if not exists idx_beats_project on public.script_beats(project_id);

-- Row Level Security (RLS) para isolar projetos por conta autenticada
alter table public.projects enable row level security;

-- 8. Tabela de Membros e Colaboradores dos Projetos
create table if not exists public.project_members (
  id uuid primary key default uuid_generate_v4(),
  project_id text not null references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  invited_email text not null,
  role text not null default 'editor', -- 'owner' | 'editor' | 'viewer'
  status text not null default 'accepted', -- 'pending' | 'accepted'
  created_at timestamptz not null default now(),
  unique(project_id, invited_email)
);

create index if not exists idx_project_members_proj on public.project_members(project_id);
create index if not exists idx_project_members_email on public.project_members(invited_email);
create index if not exists idx_project_members_user on public.project_members(user_id);

alter table public.project_members enable row level security;

-- Políticas de RLS para project_members
create policy "Membros e donos podem ver colaboradores do projeto"
  on public.project_members
  for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and (projects.user_id = auth.uid() or lower(project_members.invited_email) = lower(auth.jwt()->>'email'))
    )
  );

create policy "Donos de projetos podem convidar colaboradores"
  on public.project_members
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.user_id = auth.uid()
    )
  );

create policy "Donos podem remover colaboradores"
  on public.project_members
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.user_id = auth.uid()
    )
  );

-- Atualização na política de RLS de public.projects para colaboração:
-- Usuários podem visualizar projetos que eles criaram OU onde foram convidados
create policy "Usuários acessam projetos próprios ou compartilhados"
  on public.projects
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = projects.id
        and (
          project_members.user_id = auth.uid()
          or lower(project_members.invited_email) = lower(auth.jwt()->>'email')
        )
    )
  );

create policy "Usuários criam projetos próprios"
  on public.projects
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Usuários atualizam projetos próprios ou com permissão de editor"
  on public.projects
  for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = projects.id
        and project_members.role in ('owner', 'editor')
        and (
          project_members.user_id = auth.uid()
          or lower(project_members.invited_email) = lower(auth.jwt()->>'email')
        )
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = projects.id
        and project_members.role in ('owner', 'editor')
        and (
          project_members.user_id = auth.uid()
          or lower(project_members.invited_email) = lower(auth.jwt()->>'email')
        )
    )
  );

create policy "Apenas donos deletam seus projetos"
  on public.projects
  for delete
  to authenticated
  using (user_id = auth.uid());

-- 7. Tabela de Segredos de Configuração no Banco de Dados (Chave da API Google Gemini)
-- Acessível exclusivamente via banco de dados (sem exposição em botões de UI ou .env cliente)
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  description text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_secrets enable row level security;

-- Apenas usuários autenticados podem ler as chaves de serviço necessárias ao motor
create policy "Leitura de segredos restrita a usuários autenticados no banco"
  on public.app_secrets
  for select
  to authenticated
  using (true);

-- Exemplo para inserir/atualizar a chave da API Google diretamente via SQL Editor no Supabase:
-- insert into public.app_secrets (key, value, description)
-- values ('GEMINI_API_KEY', 'SUA_CHAVE_GOOGLE_AQUI', 'Chave oficial Google Gemini API')
-- on conflict (key) do update set value = excluded.value, updated_at = now();

