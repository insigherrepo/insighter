import { describe, expect, it } from 'vitest';
import {
  buildActiveContextBlock,
  CREATIVE_LENSES,
  distillCardsIntoSource,
  runCreativeLensSynthesis,
} from '../services/geminiEngine';
import { createCleanProject, DEMO_PROJECT } from '../data/demoProject';

describe('Insighter — Motor de Síntese Cruzada & Metodologia NotebookLM', () => {
  it('inicia um projeto limpo com zero cards e zero fontes por padrão', () => {
    const clean = createCleanProject();
    expect(clean.cards.length).toBe(0);
    expect(clean.sources.length).toBe(0);
    expect(clean.beats.length).toBe(5);
  });

  it('isola estritamente apenas as fontes marcadas como isActive no Context Mixer', () => {
    const { activeSources, formattedContext } = buildActiveContextBlock(DEMO_PROJECT.sources);

    expect(activeSources.length).toBe(3);
    expect(activeSources.every((s) => s.isActive)).toBe(true);
    expect(formattedContext).toContain('Estudo Clínico: Reconsolidação da Memória Humana');
    expect(formattedContext).not.toContain('Bíblia Visual & Regras Narrativas do Ensaio');
  });

  it('possui as 6 lentes criativas baseadas na conversa sobre NotebookLM para roteiros', () => {
    const lensIds = CREATIVE_LENSES.map((l) => l.id);
    expect(lensIds).toEqual([
      'hook_engineering',
      'data_to_scene',
      'conflict_subtext',
      'hidden_patterns',
      'continuity_lore',
      'devils_advocate',
    ]);
  });

  it('destila múltiplos cards selecionados no Canvas em uma nova Fonte ativa (Notas -> Novas Fontes)', () => {
    const selectedCards = DEMO_PROJECT.cards.slice(0, 2);
    const distilledSource = distillCardsIntoSource(selectedCards, 'Fonte Consolidada Ato I & II');

    expect(distilledSource.type).toBe('distilled_note');
    expect(distilledSource.isActive).toBe(true);
    expect(distilledSource.title).toBe('Fonte Consolidada Ato I & II');
    expect(distilledSource.originCardIds).toEqual([selectedCards[0].id, selectedCards[1].id]);
    expect(distilledSource.content).toContain(selectedCards[0].title);
    expect(distilledSource.content).toContain(selectedCards[1].title);
  });

  it('gera novos cards com citações auditáveis ancoradas nas fontes ativas', async () => {
    const generated = await runCreativeLensSynthesis({
      lensId: 'hook_engineering',
      sources: DEMO_PROJECT.sources,
      projectTitle: DEMO_PROJECT.title,
      projectLogline: DEMO_PROJECT.logline,
      existingCardCount: DEMO_PROJECT.cards.length,
    });

    expect(generated.length).toBeGreaterThan(0);
    expect(generated[0].lensId).toBe('hook_engineering');
    expect(generated[0].citations.length).toBeGreaterThan(0);
  }, 15000);

  it('permite criar episódio de série vinculado a uma série com lore herdado e beats de episódio', () => {
    const episode = createCleanProject(
      'Arquivo Oculto — T1E2: O Segundo Sinal',
      'Arthur descobre que o sinal analógico não veio de uma antena, mas de dentro do gravador.',
      'series_episode',
      {
        mode: 'new',
        seriesTitle: 'Arquivo Oculto',
        seasonNumber: 1,
        episodeNumber: 2,
        seriesLoreSnippet: 'Regra do universo: gravações em fita de 1974 contêm anomalias psicoacústicas que afetam a percepção do tempo.',
      }
    );

    expect(episode.format).toBe('series_episode');
    expect(episode.seriesContext?.seriesTitle).toBe('Arquivo Oculto');
    expect(episode.seriesContext?.seasonNumber).toBe(1);
    expect(episode.seriesContext?.episodeNumber).toBe(2);
    expect(episode.sources.length).toBe(1);
    expect(episode.sources[0].type).toBe('lore_bible');
    expect(episode.sources[0].content).toContain('anomalias psicoacústicas');
    expect(episode.beats[0].title).toContain('Cold Open / Teaser');
    expect(episode.beats[4].title).toContain('Cliffhanger');
  });

  it('permite criar livro estruturado por capítulos com arcos sequenciais', () => {
    const book = createCleanProject(
      'O Último Arquivista',
      'Uma distopia sobre a última biblioteca física em 2090.',
      'book',
      undefined,
      {
        byChapters: true,
        chapterNumber: 1,
        chapterTitle: 'O Ponto de Ruptura',
        totalChaptersPlanned: 12,
      }
    );

    expect(book.format).toBe('book');
    expect(book.bookContext?.byChapters).toBe(true);
    expect(book.bookContext?.chapterNumber).toBe(1);
    expect(book.bookContext?.totalChaptersPlanned).toBe(12);
    expect(book.beats[0].title).toContain('Capítulo 1');
    expect(book.beats[1].title).toContain('Capítulo 2');
    expect(book.beats[4].title).toContain('Capítulo 5');
  });

  it('permite criar artigo com estrutura de lead, antítese e ponto cego', () => {
    const article = createCleanProject(
      'Por Que Lembrar É Reescrever',
      'Ensaio sobre as armadilhas da memória reconsolidada.',
      'article'
    );

    expect(article.format).toBe('article');
    expect(article.beats[0].title).toContain('Lead (O Paradoxo Central)');
    expect(article.beats[2].title).toContain('Evidências Cruzadas');
    expect(article.beats[3].title).toContain('O Ponto Cego Descoberto');
  });

  it('suporta paginação com limit, offset e hasMore ao listar brainstorms', async () => {
    const { listRecentProjectsFromSupabase } = await import('../lib/supabase');
    const resultPage1 = await listRecentProjectsFromSupabase(5, 0);

    expect(resultPage1).toHaveProperty('projects');
    expect(resultPage1).toHaveProperty('totalCount');
    expect(resultPage1).toHaveProperty('hasMore');
    expect(Array.isArray(resultPage1.projects)).toBe(true);
    expect(resultPage1.projects.length).toBeLessThanOrEqual(5);

    const resultPage2 = await listRecentProjectsFromSupabase(5, 5);
    expect(resultPage2).toHaveProperty('projects');
    expect(resultPage2).toHaveProperty('totalCount');
  }, 15000);

  it('configura o Advogado do Diabo com postura confrontadora, amoral e inibitória sem elogios', async () => {
    const devilLens = CREATIVE_LENSES.find((l) => l.id === 'devils_advocate');
    expect(devilLens).toBeDefined();
    expect(devilLens?.promptTemplate).toContain('ZERO ELOGIOS');
    expect(devilLens?.promptTemplate).toContain('CONFRONTO E QUASE INIBIÇÃO');
    expect(devilLens?.promptTemplate).toContain('CAÇA A FUROS');
    expect(devilLens?.promptTemplate).toContain('AMORALIDADE PARA VER A VERDADE');

    const generated = await runCreativeLensSynthesis({
      lensId: 'devils_advocate',
      sources: DEMO_PROJECT.sources,
      projectTitle: DEMO_PROJECT.title,
      projectLogline: DEMO_PROJECT.logline,
      existingCardCount: 0,
    });

    expect(generated.length).toBeGreaterThan(0);
    const card = generated[0];
    expect(card.lensId).toBe('devils_advocate');
    expect(card.body).toContain('[O FURO / A CONTRADIÇÃO DETECTADA]');
    expect(card.body).toContain('[A DÚVIDA INIBITÓRIA]');
    expect(card.tags).toContain('Advogado do Diabo');
    expect(card.tags).toContain('Verdade Amoral');
    expect(card.body).not.toContain('Excelente ideia');
    expect(card.body).not.toContain('Parabéns');
  });

  it('permite convidar e remover colaboradores de um projeto com controle de permissões', async () => {
    const { inviteProjectMember, removeProjectMember, listRecentProjectsFromSupabase } = await import('../lib/supabase');
    const projectId = 'proj-test-collab-1';

    const inviteResult = await inviteProjectMember(projectId, 'CoAutor@estudio.com', 'editor');
    expect(inviteResult.ok).toBe(true);
    expect(inviteResult.member).toBeDefined();
    expect(inviteResult.member?.invitedEmail).toBe('coautor@estudio.com');
    expect(inviteResult.member?.role).toBe('editor');
    expect(inviteResult.member?.status).toBe('accepted');

    const removeResult = await removeProjectMember(projectId, 'coautor@estudio.com');
    expect(removeResult.ok).toBe(true);

    const listResult = await listRecentProjectsFromSupabase(10, 0, 'shared');
    expect(listResult).toHaveProperty('projects');
    expect(Array.isArray(listResult.projects)).toBe(true);
  }, 15000);

  it('permite criar brainstorm livre com subtipo estudo solo e estrutura acadêmica de 5 blocos', () => {
    const studyProject = createCleanProject(
      'Estudo de Neurociência da Memória',
      'Fichamento e investigação solo sobre plasticidade sináptica.',
      'free_brainstorm',
      undefined,
      undefined,
      {
        subtype: 'solo_study',
        studyTopic: 'Neurociência Cognitiva',
        studyGoal: 'Mapear contradições sobre engramas de memória',
      }
    );

    expect(studyProject.format).toBe('free_brainstorm');
    expect(studyProject.freeBrainstormContext?.subtype).toBe('solo_study');
    expect(studyProject.freeBrainstormContext?.studyTopic).toBe('Neurociência Cognitiva');
    expect(studyProject.beats.length).toBe(5);
    expect(studyProject.beats[0].title).toContain('Conceitos Fundamentais');
    expect(studyProject.beats[2].title).toContain('Fichamento & Síntese Cruzada');
    expect(studyProject.beats[3].title).toContain('Pontos Cegos');
    expect(studyProject.beats[4].title).toContain('Fixação & Aplicação');
  });

  it('permite criar grupo de estudo ou reunião exigindo pelo menos 2 participantes e inicializando membro obrigatório', () => {
    const meetingProject = createCleanProject(
      'Grupo de Pesquisa — Artigo Q4',
      'Sessão coletiva de alinhamento e revisão de referências.',
      'study_group_meeting',
      undefined,
      undefined,
      undefined,
      {
        meetingType: 'study_group',
        requiredPartnerEmail: 'pesquisador.parceiro@universidade.edu',
        agendaTopic: 'Revisão do Módulo 3',
      }
    );

    expect(meetingProject.format).toBe('study_group_meeting');
    expect(meetingProject.meetingGroupContext?.meetingType).toBe('study_group');
    expect(meetingProject.meetingGroupContext?.requiredPartnerEmail).toBe('pesquisador.parceiro@universidade.edu');
    expect(meetingProject.members).toBeDefined();
    expect(meetingProject.members?.length).toBeGreaterThanOrEqual(1);
    expect(meetingProject.members?.[0].invitedEmail).toBe('pesquisador.parceiro@universidade.edu');
    expect(meetingProject.beats.length).toBe(5);
    expect(meetingProject.beats[0].title).toContain('Pauta do Estudo');
    expect(meetingProject.beats[2].title).toContain('Debate de Evidências');
    expect(meetingProject.beats[4].title).toContain('Tarefas de Aprofundamento');
  });

  it('permite definir e alterar cores nos cards do Canvas', async () => {
    const card = DEMO_PROJECT.cards[0];
    expect(card).toBeDefined();

    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();
    store.loadExistingProject(DEMO_PROJECT);

    store.updateCardColor(card.id, 'terracotta');
    const updatedCard = useInsighterStore.getState().project.cards.find((c: any) => c.id === card.id);
    expect(updatedCard?.color).toBe('terracotta');

    store.updateCardColor(card.id, 'sage');
    const reupdatedCard = useInsighterStore.getState().project.cards.find((c: any) => c.id === card.id);
    expect(reupdatedCard?.color).toBe('sage');
  });

  it('permite criar e gerenciar grupos de cards no Canvas livre', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();
    store.loadExistingProject(DEMO_PROJECT);

    const cardIds = [DEMO_PROJECT.cards[0].id, DEMO_PROJECT.cards[1].id];
    const group = store.createCardGroup('Arco de Mistério', cardIds, 'amber');

    expect(group.id).toBeDefined();
    expect(group.title).toBe('Arco de Mistério');
    expect(group.cardIds).toEqual(cardIds);

    const stateAfterGroup = useInsighterStore.getState().project;
    expect(stateAfterGroup.groups?.some((g: any) => g.id === group.id)).toBe(true);

    const card0 = stateAfterGroup.cards.find((c: any) => c.id === cardIds[0]);
    expect(card0?.groupId).toBe(group.id);

    // Desagrupar
    store.removeCardGroup(group.id);
    const stateAfterUngroup = useInsighterStore.getState().project;
    expect(stateAfterUngroup.groups?.some((g: any) => g.id === group.id)).toBe(false);
    const card0After = stateAfterUngroup.cards.find((c: any) => c.id === cardIds[0]);
    expect(card0After?.groupId).toBeUndefined();
  });

  it('permite conversar com um card para aprofundar com o Advogado do Diabo', async () => {
    const { chatWithCard } = await import('../services/geminiEngine');
    const card = DEMO_PROJECT.cards[0];

    const response = await chatWithCard({
      card,
      message: 'E se o protagonista decidir não confrontar a instituição?',
      lensId: 'devils_advocate',
      sources: DEMO_PROJECT.sources,
      projectTitle: DEMO_PROJECT.title,
      projectLogline: DEMO_PROJECT.logline,
    });

    expect(response).toBeDefined();
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(20);
    // Deve conter tom crítico de confronto implacável
    expect(response).toMatch(/conveniência|conflito|autopreservação|implacável|pressuposto|risco/i);
  }, 15000);

  it('permite conectar cards diretamente e remover conexões', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();
    const clean = createCleanProject();
    clean.cards = [
      { id: 'c1', title: 'Card 1', body: '', lensId: 'free_provocation', position: { x: 0, y: 0 }, citations: [], tags: [], isPinned: false, createdAt: '' },
      { id: 'c2', title: 'Card 2', body: '', lensId: 'free_provocation', position: { x: 100, y: 100 }, citations: [], tags: [], isPinned: false, createdAt: '' },
    ];
    store.loadExistingProject(clean);

    // Conectar c1 e c2
    store.connectCards('c1', 'c2', 'Fio de Síntese Teste');
    const projectWithConn = useInsighterStore.getState().project;
    const conn = projectWithConn.connections.find(
      (c) =>
        (c.fromCardId === 'c1' && c.toCardId === 'c2') ||
        (c.fromCardId === 'c2' && c.toCardId === 'c1')
    );
    expect(conn).toBeDefined();
    expect(conn?.label).toBe('Fio de Síntese Teste');

    // Remover a conexão criada
    if (conn) {
      store.removeConnection(conn.id);
      const projectWithoutConn = useInsighterStore.getState().project;
      expect(projectWithoutConn.connections.some((c) => c.id === conn.id)).toBe(false);
    }
  });

  it('permite anexar evidências (imagens/prints/recortes) e operar o Modo Investigativo com foco e esmaecimento', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();

    // 1. Por padrão, o Modo Investigativo deve estar desligado
    expect(store.investigativeMode).toBe(false);
    expect(store.focusedInvestigativeCardId).toBeNull();

    const clean = createCleanProject();
    clean.cards = [
      { id: 'card-evidencia', title: 'Cena da Gravação Suspeita', body: 'Áudio gravado em 1974 com voz impossível.', lensId: 'free_provocation', position: { x: 50, y: 50 }, citations: [], tags: [], isPinned: false, createdAt: '' },
      { id: 'card-vizinho', title: 'Perícia Técnica do Gravador', body: 'Análise de fita magnética.', lensId: 'free_provocation', position: { x: 300, y: 150 }, citations: [], tags: [], isPinned: false, createdAt: '' },
    ];
    store.loadExistingProject(clean);

    // 2. Adicionar anexo de recorte de texto e imagem/print
    const attachment = store.addCardAttachment('card-evidencia', {
      type: 'text_snippet',
      title: 'Transcrição do Diálogo Oculto',
      textContent: 'Você não deveria estar ouvindo isso.',
    });

    expect(attachment.id).toBeDefined();
    expect(attachment.title).toBe('Transcrição do Diálogo Oculto');
    expect(attachment.type).toBe('text_snippet');

    const cardWithAtt = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-evidencia');
    expect(cardWithAtt?.attachments).toBeDefined();
    expect(cardWithAtt?.attachments?.length).toBe(1);
    expect(cardWithAtt?.attachments?.[0].textContent).toBe('Você não deveria estar ouvindo isso.');

    // 3. Ativar o Modo Investigativo e focar o card de evidência
    store.setInvestigativeMode(true);
    expect(useInsighterStore.getState().investigativeMode).toBe(true);

    store.setFocusedInvestigativeCardId('card-evidencia');
    expect(useInsighterStore.getState().focusedInvestigativeCardId).toBe('card-evidencia');

    // 4. Remover o anexo
    store.removeCardAttachment('card-evidencia', attachment.id);
    const cardAfterDel = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-evidencia');
    expect(cardAfterDel?.attachments?.length).toBe(0);

    // 5. Desativar o Modo Investigativo
    store.setInvestigativeMode(false);
    store.setFocusedInvestigativeCardId(null);
    expect(useInsighterStore.getState().investigativeMode).toBe(false);
    expect(useInsighterStore.getState().focusedInvestigativeCardId).toBeNull();
  });

  it('compila cards da série em fonte viva ativa e preserva memória persistente ao criar episódio de série', async () => {
    const parentCards = [
      {
        id: 'card-s1e1-1',
        title: 'Revelação: O Sinal é Interno',
        body: 'Arthur descobre que o som vem do cabeçote do gravador de 1974.',
        lensId: 'hidden_patterns' as const,
        position: { x: 100, y: 100 },
        citations: [],
        tags: ['Lore', 'Gravação'],
        isPinned: false,
        isCanonicalSeriesMemory: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'card-s1e1-2',
        title: 'Dilema de Helena: O Arquivo Excluído',
        body: 'Helena sabe que o protocolo proíbe abrir o cofre.',
        lensId: 'conflict_subtext' as const,
        position: { x: 400, y: 100 },
        citations: [],
        tags: ['Conflito'],
        isPinned: false,
        createdAt: new Date().toISOString(),
      },
    ];

    const parentSources = [
      {
        id: 'src-laudo-1974',
        title: 'Laudo Pericial Acústico 1974',
        type: 'pdf_article' as const,
        authorOrOrigin: 'Polícia Técnica',
        content: 'Frequências anômalas registradas na fita.',
        summary: '',
        isActive: true,
        createdAt: new Date().toISOString(),
      },
    ];

    const episode = createCleanProject(
      'Arquivo Oculto — T1E2: O Segundo Sinal',
      'Arthur aprofunda a investigação.',
      'series_episode',
      {
        mode: 'existing',
        seriesTitle: 'Arquivo Oculto',
        seasonNumber: 1,
        episodeNumber: 2,
        parentCards,
        parentSources,
        inheritCardsAsSource: true,
        inheritSources: true,
        memory: {
          seriesId: 'series-arq-oculto',
          seriesTitle: 'Arquivo Oculto',
          loreRules: ['Fitas magnéticas de 1974 retêm ecos temporais.'],
          characters: [
            { id: 'c1', name: 'Arthur', role: 'Perito de Áudio', status: 'alive', notes: 'Possui insônia crônica' },
          ],
          canonicalEvents: [
            { id: 'e1', episodeTag: 'T1E1', description: 'Arthur encontrou a fita 07 no cofre' },
          ],
          unresolvedHooks: [
            { id: 'h1', originEpisodeTag: 'T1E1', hookText: 'Quem trancou a fita 07 no cofre?', resolved: false },
          ],
          canonicalCards: [parentCards[0]],
        },
      }
    );

    // 1. Deve ter gerado a fonte viva compilada dos cards da série
    const cardsSource = episode.sources.find((s) => s.title.includes('Cards da Série'));
    expect(cardsSource).toBeDefined();
    expect(cardsSource?.isActive).toBe(true);
    expect(cardsSource?.type).toBe('distilled_note');
    expect(cardsSource?.content).toContain('Revelação: O Sinal é Interno');
    expect(cardsSource?.content).toContain('Dilema de Helena: O Arquivo Excluído');

    // 2. Deve ter herdado a fonte original da série
    const inheritedPdf = episode.sources.find((s) => s.id === 'src-laudo-1974');
    expect(inheritedPdf).toBeDefined();
    expect(inheritedPdf?.authorOrOrigin).toContain('Herdada de "Arquivo Oculto"');

    // 3. Deve formatar o bloco de memória persistente para injeção no Gemini
    const { buildSeriesMemoryBlock } = await import('../services/geminiEngine');
    const memoryBlock = buildSeriesMemoryBlock(episode.seriesContext);
    expect(memoryBlock).toContain('Arquivo Oculto');
    expect(memoryBlock).toContain('Fitas magnéticas de 1974 retêm ecos temporais.');
    expect(memoryBlock).toContain('Arthur (Perito de Áudio) [Status: alive]');
    expect(memoryBlock).toContain('[T1E1] Arthur encontrou a fita 07 no cofre');
    expect(memoryBlock).toContain('(T1E1) Quem trancou a fita 07 no cofre?');
    expect(memoryBlock).toContain('Revelação: O Sinal é Interno');
  });

  it('permite promover cards à memória canônica, registrar ganchos abertos e importar cards da série para a bancada', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();

    const episode = createCleanProject(
      'Arquivo Oculto — T1E2: O Segundo Sinal',
      'Arthur aprofunda a investigação.',
      'series_episode',
      {
        mode: 'existing',
        seriesTitle: 'Arquivo Oculto',
        seasonNumber: 1,
        episodeNumber: 2,
        parentCards: [
          {
            id: 'card-lore-anterior',
            title: 'Gravação Original de 1974',
            body: 'A gravação contem frequências binaurais perigosas.',
            lensId: 'hidden_patterns',
            position: { x: 50, y: 50 },
            citations: [],
            tags: ['Lore'],
            isPinned: false,
            createdAt: '',
          },
        ],
        memory: {
          seriesId: 'series-arq-oculto',
          seriesTitle: 'Arquivo Oculto',
          unresolvedHooks: [
            { id: 'h-antigo', originEpisodeTag: 'T1E1', hookText: 'O paradeiro do técnico de som', resolved: false },
          ],
        },
      }
    );

    // Cria um card novo no episódio atual
    episode.cards = [
      {
        id: 'card-ep2-novo',
        title: 'Descoberta do Segundo Sinal',
        body: 'O segundo sinal modula a 432Hz e altera a temperatura da sala.',
        lensId: 'data_to_scene',
        position: { x: 100, y: 100 },
        citations: [],
        tags: ['Acústica'],
        isPinned: false,
        createdAt: '',
      },
    ];

    store.loadExistingProject(episode);

    // 1. Promover card do episódio atual para a memória canônica da série
    store.toggleCardSeriesMemory('card-ep2-novo');
    const stateAfterPromote = useInsighterStore.getState();
    const promotedCard = stateAfterPromote.project.cards.find((c) => c.id === 'card-ep2-novo');
    expect(promotedCard?.isCanonicalSeriesMemory).toBe(true);

    const canonicalCardsInMemory = stateAfterPromote.project.seriesContext?.memory?.canonicalCards || [];
    expect(canonicalCardsInMemory.some((c) => c.id === 'card-ep2-novo')).toBe(true);

    // 2. Registrar um novo gancho aberto deixado por este episódio
    store.addSeriesOpenHook('Arthur guardou o segundo gravador no armário sem contar para Helena');
    const stateAfterHook = useInsighterStore.getState();
    const hooks = stateAfterHook.project.seriesContext?.memory?.unresolvedHooks || [];
    const newHook = hooks.find((h) => h.hookText.includes('Arthur guardou o segundo gravador'));
    expect(newHook).toBeDefined();
    expect(newHook?.originEpisodeTag).toBe('T1E2');
    expect(newHook?.resolved).toBe(false);

    // Resolver o gancho antigo de T1E1
    store.toggleSeriesOpenHook('h-antigo');
    const stateAfterResolve = useInsighterStore.getState();
    const oldHook = stateAfterResolve.project.seriesContext?.memory?.unresolvedHooks?.find((h) => h.id === 'h-antigo');
    expect(oldHook?.resolved).toBe(true);
    expect(oldHook?.resolvedInEpisodeTag).toBe('T1E2');

    // 3. Trazer um card herdado da série para a bancada do episódio atual
    const seriesParentCard = episode.seriesContext?.parentCards?.[0];
    if (seriesParentCard) {
      store.importSeriesCardToCanvas(seriesParentCard);
      const stateAfterImport = useInsighterStore.getState();
      const imported = stateAfterImport.project.cards.find((c) => c.title === seriesParentCard.title);
      expect(imported).toBeDefined();
      expect(imported?.tags).toContain('Memória da Série');
      expect(imported?.isCanonicalSeriesMemory).toBe(true);
    }
  });

  it('preserva o contexto do debate de card além do 3º turno (turnos 4, 5 e 6) sem perder a linha de raciocínio e permite reiniciar o chat', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const { chatWithCard } = await import('../services/geminiEngine');
    const store = useInsighterStore.getState();

    const clean = createCleanProject();
    clean.cards = [
      {
        id: 'card-debate-longo',
        title: 'A Conspiração do Hotel Palace',
        body: 'Ministro é chantageado por uma gravação feita no quarto 402.',
        lensId: 'devils_advocate',
        position: { x: 50, y: 50 },
        citations: [],
        tags: ['Chantagem'],
        isPinned: false,
        createdAt: '',
      },
    ];
    store.loadExistingProject(clean);

    // Simula 4 turnos completos de conversa no card
    await store.sendCardChatMessage('card-debate-longo', 'Turno 1: E se o ministro matar o chantagista?');
    await store.sendCardChatMessage('card-debate-longo', 'Turno 2: E se ele contratar um terceiro para não se sujar?');
    await store.sendCardChatMessage('card-debate-longo', 'Turno 3: E se o intermediário for um agente duplo?');
    await store.sendCardChatMessage('card-debate-longo', 'Turno 4: Como isso se conecta com a gravação do quarto 402?');

    const cardAfter4 = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-debate-longo');
    expect(cardAfter4?.chatMessages?.length).toBe(8); // 4 perguntas do autor + 4 respostas

    // Testa se chatWithCard avalia o 5º turno mantendo os 8 itens de histórico sem truncar
    const fifthResponse = await chatWithCard({
      card: cardAfter4!,
      message: 'Turno 5: Confronte a saída do ministro à luz de tudo o que concordamos.',
      lensId: 'devils_advocate',
      sources: clean.sources,
      projectTitle: clean.title,
      projectLogline: clean.logline,
      history: cardAfter4?.chatMessages || [],
    });

    expect(fifthResponse).toBeDefined();
    expect(typeof fifthResponse).toBe('string');
    expect(fifthResponse.length).toBeGreaterThan(20);

    // Testa a ação de reiniciar o debate
    store.clearCardChat('card-debate-longo');
    const cardReset = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-debate-longo');
    expect(cardReset?.chatMessages?.length).toBe(0);
  });

  it('permite rejeitar, ocultar ou deletar respostas do chat e as inutiliza estritamente como contexto em chats futuros e na destilação de fontes', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const { distillCardsIntoSource } = await import('../services/geminiEngine');
    const store = useInsighterStore.getState();

    const clean = createCleanProject();
    clean.cards = [
      {
        id: 'card-rejeicao-test',
        title: 'Reviravolta da Herança Oculta',
        body: 'O testamento original foi gravado em áudio e escondido em um cofre suíço.',
        lensId: 'devils_advocate',
        position: { x: 100, y: 100 },
        citations: [],
        tags: ['Reviravolta'],
        isPinned: false,
        createdAt: '',
      },
    ];
    store.loadExistingProject(clean);

    // Envia 2 mensagens
    await store.sendCardChatMessage('card-rejeicao-test', 'Como o advogado encontra o cofre?');
    await store.sendCardChatMessage('card-rejeicao-test', 'E se ele subornar o banqueiro?');

    let currentCard = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-rejeicao-test')!;
    expect(currentCard.chatMessages?.length).toBe(4); // 2 user + 2 assistant

    const firstAssistantMsg = currentCard.chatMessages!.find((m) => m.sender === 'assistant')!;
    expect(firstAssistantMsg.isRejected).toBeFalsy();

    // 1. Rejeitar a primeira resposta da IA
    store.toggleRejectCardChatMessage('card-rejeicao-test', firstAssistantMsg.id);
    currentCard = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-rejeicao-test')!;
    const rejectedMsg = currentCard.chatMessages!.find((m) => m.id === firstAssistantMsg.id)!;
    expect(rejectedMsg.isRejected).toBe(true);

    // 2. Alternar ocultação visual
    store.toggleHideCardChatMessage('card-rejeicao-test', firstAssistantMsg.id);
    currentCard = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-rejeicao-test')!;
    expect(currentCard.chatMessages!.find((m) => m.id === firstAssistantMsg.id)?.isHidden).toBe(true);

    // 3. Testar destilação de fontes: a mensagem rejeitada NÃO pode ser incluída na fonte destilada
    const distilled = distillCardsIntoSource([currentCard], 'Fonte com Respostas Filtradas');
    expect(distilled.content).not.toContain(rejectedMsg.text);
    // A outra mensagem válida da IA deve ser incluída
    const validAssistantMsg = currentCard.chatMessages!.find((m) => m.sender === 'assistant' && !m.isRejected)!;
    expect(distilled.content).toContain(validAssistantMsg.text);

    // 4. Excluir definitivamente uma mensagem do histórico
    store.deleteCardChatMessage('card-rejeicao-test', firstAssistantMsg.id);
    currentCard = useInsighterStore.getState().project.cards.find((c) => c.id === firstAssistantMsg.id) as any;
    const updatedCard = useInsighterStore.getState().project.cards.find((c) => c.id === 'card-rejeicao-test')!;
    expect(updatedCard.chatMessages?.some((m) => m.id === firstAssistantMsg.id)).toBe(false);
    expect(updatedCard.chatMessages?.length).toBe(3);
  });

  it('marca o exemplo guiado com isDemo=true e permite enviar brainstorms para a lixeira, restaurar e excluir da lixeira', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();

    // 1. Carregar Exemplo Guiado (Demo) e verificar flag isDemo
    store.resetToDemoProject();
    const demoState = useInsighterStore.getState().project;
    expect(demoState.isDemo).toBe(true);
    expect(demoState.id).toBe('proj-cronos-noir');

    // 2. Enviar para a Lixeira (Estágio 1)
    const trashed = await store.trashProject(demoState);
    expect(trashed.isTrashed).toBe(true);
    expect(trashed.trashedAt).toBeDefined();

    // 3. Restaurar da Lixeira
    const restored = await store.restoreProject(trashed);
    expect(restored.isTrashed).toBe(false);
    expect(restored.trashedAt).toBeUndefined();

    // 4. Excluir definitivamente da Lixeira (Estágio 2)
    await store.trashProject(restored);
    const deletedOk = await store.deleteProjectPermanently(restored.id);
    expect(deletedOk).toBe(true);
  });

  it('grava e restaura a posição e zoom do canvas (viewport) e as posições dos cards ao sair e reabrir brainstorms', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();
    const clean = createCleanProject('Brainstorm Câmera e Zoom');
    clean.cards = [
      { id: 'c-pos1', title: 'Card Alpha', body: '', lensId: 'free_provocation', position: { x: 120, y: 340 }, citations: [], tags: [], isPinned: false, createdAt: '' },
    ];
    store.loadExistingProject(clean);

    // Mover o card
    store.updateCardPosition('c-pos1', 450, 780);
    const cardMoved = useInsighterStore.getState().project.cards.find((c) => c.id === 'c-pos1');
    expect(cardMoved?.position).toEqual({ x: 450, y: 780 });

    // Gravar o viewport do canvas (pan e zoom)
    store.saveCanvasViewport({ x: -240, y: 560 }, 1.35);
    const projSaved = useInsighterStore.getState().project;
    expect(projSaved.viewport).toEqual({
      pan: { x: -240, y: 560 },
      zoom: 1.35,
    });

    // Ao recarregar o projeto, os dados de viewport e posição dos cards são preservados
    store.loadExistingProject(projSaved);
    const reloaded = useInsighterStore.getState().project;
    expect(reloaded.viewport?.pan).toEqual({ x: -240, y: 560 });
    expect(reloaded.viewport?.zoom).toBe(1.35);
    expect(reloaded.cards[0].position).toEqual({ x: 450, y: 780 });
  });

  it('permite iniciar modo de reunião ao vivo e espelhar ações para outros colaboradores', async () => {
    const { useInsighterStore } = await import('../store/useInsighterStore');
    const store = useInsighterStore.getState();
    const clean = createCleanProject('Brainstorm Reunião Ao Vivo');
    store.loadExistingProject(clean);

    expect(store.isLivePresenter).toBe(false);

    // Iniciar reunião como apresentador
    store.startLiveMeeting('Diretor de Criação');
    const stateLive = useInsighterStore.getState();
    expect(stateLive.isLivePresenter).toBe(true);
    expect(stateLive.project.meetingLiveState?.isActive).toBe(true);
    expect(stateLive.project.meetingLiveState?.presenterName).toBe('Diretor de Criação');

    // Transmitir ultrafoco e tela para os colaboradores
    store.setUltrafocusCardId('card-foco-reuniao');
    expect(useInsighterStore.getState().ultrafocusCardId).toBe('card-foco-reuniao');

    // Encerrar transmissão
    store.stopLiveMeeting();
    expect(useInsighterStore.getState().isLivePresenter).toBe(false);
    expect(useInsighterStore.getState().project.meetingLiveState).toBeUndefined();
  });
});
