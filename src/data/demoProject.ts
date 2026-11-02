import {
  BookContext,
  FreeBrainstormContext,
  MeetingGroupContext,
  ProjectData,
  ProjectFormat,
  ProjectMember,
  ScriptBeat,
  SeriesContext,
  SourceItem,
} from '../types/insighter';

export function createCleanProject(
  customTitle = 'Novo Roteiro Sem Título',
  customLogline = '',
  format: ProjectFormat = 'video_essay',
  seriesContext?: SeriesContext,
  bookContext?: BookContext,
  freeBrainstormContext?: FreeBrainstormContext,
  meetingGroupContext?: MeetingGroupContext,
  initialMembers?: ProjectMember[]
): ProjectData {
  let initialBeats: ScriptBeat[] = [];
  const initialSources: SourceItem[] = [];

  if (seriesContext?.seriesLoreSnippet && seriesContext.seriesLoreSnippet.trim()) {
    initialSources.push({
      id: `src-series-lore-${Date.now()}`,
      title: `Bíblia / Lore da Série: ${seriesContext.seriesTitle}`,
      type: 'lore_bible',
      authorOrOrigin: `Universo de "${seriesContext.seriesTitle}"`,
      content: seriesContext.seriesLoreSnippet.trim(),
      summary: `Regras de mundo e lore geral da série "${seriesContext.seriesTitle}".`,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }

  // Herança profunda da Série: compila todos os cards da série-mãe em uma Fonte Ativa de Continuidade
  if (format === 'series_episode' && seriesContext) {
    const shouldInheritCards = seriesContext.inheritCardsAsSource !== false;
    if (shouldInheritCards && seriesContext.parentCards && seriesContext.parentCards.length > 0) {
      const cardsCompiled = seriesContext.parentCards
        .map((c, i) => {
          let text = `### Card ${i + 1}: ${c.title}\n${c.body}`;
          if (c.subtextOrVisualCue) {
            text += `\n> Cena / Direção Visual: ${c.subtextOrVisualCue}`;
          }
          if (c.citations && c.citations.length > 0) {
            text += `\n> Citações de Origem: ${c.citations.map((cit) => `"${cit.quote}" (${cit.sourceTitle})`).join(' | ')}`;
          }
          if (c.beatAct) {
            text += `\n> Ato da Escaleta: ${c.beatAct}`;
          }
          return text;
        })
        .join('\n\n---\n\n');

      initialSources.push({
        id: `src-series-cards-${Date.now()}`,
        title: `Cards da Série: "${seriesContext.seriesTitle}" (${seriesContext.parentCards.length} cards herdados)`,
        type: 'distilled_note',
        authorOrOrigin: `Série "${seriesContext.seriesTitle}"`,
        content: `# CARDS & MEMÓRIA ACUMULADA DA SÉRIE: "${seriesContext.seriesTitle}"\nTotal de cards herdados: ${seriesContext.parentCards.length}\n\n${cardsCompiled}`,
        summary: `Compilação de ${seriesContext.parentCards.length} cards de insight da série "${seriesContext.seriesTitle}" servindo de fonte ativa de continuidade.`,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }

    const shouldInheritSources = seriesContext.inheritSources !== false;
    if (shouldInheritSources && seriesContext.parentSources && seriesContext.parentSources.length > 0) {
      for (const pSrc of seriesContext.parentSources) {
        if (!initialSources.some((s) => s.title === pSrc.title)) {
          initialSources.push({
            ...pSrc,
            id: pSrc.id,
            authorOrOrigin: `${pSrc.authorOrOrigin} · Herdada de "${seriesContext.seriesTitle}"`,
            isActive: true,
          });
        }
      }
    }
  }

  if (format === 'series_episode') {
    const sTitle = seriesContext?.seriesTitle ? ` — ${seriesContext.seriesTitle}` : '';
    const epTag = `T${seriesContext?.seasonNumber || 1}:E${seriesContext?.episodeNumber || 1}`;
    initialBeats = [
      {
        id: 'beat-1',
        act: 'hook_0_30s',
        title: `Cold Open / Teaser (${epTag}${sTitle})`,
        sceneHeading: `EXT./INT. COLD OPEN - (0:00 - 1:00)`,
        content: '',
        linkedCardIds: [],
        durationEstimate: '1:00',
      },
      {
        id: 'beat-2',
        act: 'act_1_setup',
        title: 'Ato I: Incidente Incitante & Tramas A e B',
        sceneHeading: 'ATO I - DESENCADEAMENTO DO CONFLITO DO EPISÓDIO',
        content: '',
        linkedCardIds: [],
        durationEstimate: '8:00',
      },
      {
        id: 'beat-3',
        act: 'act_2_escalation',
        title: 'Ato II: Escalada & Complicações Cruzadas',
        sceneHeading: 'ATO II - COLISÃO ENTRE PERSONAGENS E SUBTEXTO',
        content: '',
        linkedCardIds: [],
        durationEstimate: '14:00',
      },
      {
        id: 'beat-4',
        act: 'midpoint_twist',
        title: 'Midpoint Twist (Ponto de Virada Central)',
        sceneHeading: 'MEIO DO EPISÓDIO - O PLANO INICIAL FALHA',
        content: '',
        linkedCardIds: [],
        durationEstimate: '6:00',
      },
      {
        id: 'beat-5',
        act: 'act_3_climax',
        title: 'Ato III: Clímax & Cliffhanger para o Próximo',
        sceneHeading: 'ATO III - DESFECHO DO ARCO E GANCHO FINAL',
        content: '',
        linkedCardIds: [],
        durationEstimate: '7:00',
      },
    ];
  } else if (format === 'article') {
    initialBeats = [
      {
        id: 'beat-1',
        act: 'hook_0_30s',
        title: 'Título & Lead (O Paradoxo Central)',
        sceneHeading: 'LEAD - QUEBRA DE EXPECTATIVA & TESE DO ARTIGO',
        content: '',
        linkedCardIds: [],
        durationEstimate: '300 palavras',
      },
      {
        id: 'beat-2',
        act: 'act_1_setup',
        title: 'Contextualização & O Problema Não Resolvido',
        sceneHeading: 'SEÇÃO 1 - O ESTADO ATUAL E SUAS CONTRADIÇÕES',
        content: '',
        linkedCardIds: [],
        durationEstimate: '500 palavras',
      },
      {
        id: 'beat-3',
        act: 'act_2_escalation',
        title: 'Desenvolvimento & Evidências Cruzadas (Antítese)',
        sceneHeading: 'SEÇÃO 2 - SÍNTESE DE DADOS, VOZES E FATOS DOCUMENTADOS',
        content: '',
        linkedCardIds: [],
        durationEstimate: '700 palavras',
      },
      {
        id: 'beat-4',
        act: 'midpoint_twist',
        title: 'O Ponto Cego Descoberto (Virada de Perspectiva)',
        sceneHeading: 'SEÇÃO 3 - O QUE NINGUÉM HAVIA QUESTIONADO',
        content: '',
        linkedCardIds: [],
        durationEstimate: '450 palavras',
      },
      {
        id: 'beat-5',
        act: 'act_3_climax',
        title: 'Conclusão & Provocação Final (Call to Action)',
        sceneHeading: 'SEÇÃO 4 - SÍNTESE FINAL E CONSEQUÊNCIAS PRÁTICAS',
        content: '',
        linkedCardIds: [],
        durationEstimate: '350 palavras',
      },
    ];
  } else if (format === 'book') {
    const isChapters = bookContext ? bookContext.byChapters : true;
    if (isChapters) {
      initialBeats = [
        {
          id: 'beat-1',
          act: 'hook_0_30s',
          title: 'Capítulo 1: O Ponto de Ruptura (Incidente Incitante)',
          sceneHeading: 'CAPÍTULO 1 - O MUNDO ORDINÁRIO É DESESTABILIZADO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Capítulo 1',
        },
        {
          id: 'beat-2',
          act: 'act_1_setup',
          title: 'Capítulo 2: A Travessia do Limiar (A Decisão Irreversível)',
          sceneHeading: 'CAPÍTULO 2 - O COMPROMISSO COM O DESCONHECIDO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Capítulo 2',
        },
        {
          id: 'beat-3',
          act: 'act_2_escalation',
          title: 'Capítulo 3: Provações, Aliados & Tensões Ocultas',
          sceneHeading: 'CAPÍTULO 3 - DESENVOLVIMENTO DAS LINHAS DE FORÇA',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Capítulo 3',
        },
        {
          id: 'beat-4',
          act: 'midpoint_twist',
          title: 'Capítulo 4: A Queda & A Revelação do Meio',
          sceneHeading: 'CAPÍTULO 4 - O CENTRO DA NARRATIVA SE INVERTE',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Capítulo 4',
        },
        {
          id: 'beat-5',
          act: 'act_3_climax',
          title: 'Capítulo 5: O Clímax & O Novo Equilíbrio',
          sceneHeading: 'CAPÍTULO 5 - CONFRONTO FINAL E RESOLUÇÃO DO ARCO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Capítulo 5',
        },
      ];
    } else {
      initialBeats = [
        {
          id: 'beat-1',
          act: 'hook_0_30s',
          title: 'Prólogo / Abertura: A Pergunta Central',
          sceneHeading: 'PRÓLOGO - O DILEMA FUNDAMENTAL DA OBRA',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Prólogo',
        },
        {
          id: 'beat-2',
          act: 'act_1_setup',
          title: 'Parte I: Origens & Construção do Mundo',
          sceneHeading: 'PARTE I - FUNDAÇÃO DRAMÁTICA',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Parte I',
        },
        {
          id: 'beat-3',
          act: 'act_2_escalation',
          title: 'Parte II: O Labirinto do Conflito',
          sceneHeading: 'PARTE II - APROFUNDAMENTO DOS DILEMAS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Parte II',
        },
        {
          id: 'beat-4',
          act: 'midpoint_twist',
          title: 'A Grande Revelação (Ponto Sem Retorno)',
          sceneHeading: 'MEIO DA OBRA - TRANSFORMAÇÃO DA TESE',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Interlúdio',
        },
        {
          id: 'beat-5',
          act: 'act_3_climax',
          title: 'Parte III: Clímax & Epílogo',
          sceneHeading: 'PARTE III - RESOLUÇÃO E IMPACTO PERMANENTE',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Parte III',
        },
      ];
    }
  } else if (format === 'free_brainstorm') {
    const isSoloStudy = freeBrainstormContext?.subtype === 'solo_study';
    if (isSoloStudy) {
      initialBeats = [
        {
          id: 'beat-1',
          act: 'hook_0_30s',
          title: '1. Conceitos Fundamentais & Definições',
          sceneHeading: 'ESTUDO INDIVIDUAL - BASE TEÓRICA & PILARES',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Fundamentos',
        },
        {
          id: 'beat-2',
          act: 'act_1_setup',
          title: '2. Perguntas-Chave & Hipóteses Iniciais',
          sceneHeading: 'ESTUDO INDIVIDUAL - PROBLEMATIZAÇÃO & HIPÓTESES',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Hipóteses',
        },
        {
          id: 'beat-3',
          act: 'act_2_escalation',
          title: '3. Fichamento & Síntese Cruzada de Fontes',
          sceneHeading: 'ESTUDO INDIVIDUAL - ANOTAÇÕES ESTRUTURADAS DAS FONTES',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Fichamento',
        },
        {
          id: 'beat-4',
          act: 'midpoint_twist',
          title: '4. Pontos Cegos & Dúvidas a Aprofundar',
          sceneHeading: 'ESTUDO INDIVIDUAL - O QUE FALTA ENTENDER',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Pontos Cegos',
        },
        {
          id: 'beat-5',
          act: 'act_3_climax',
          title: '5. Síntese de Fixação & Aplicação Prática',
          sceneHeading: 'ESTUDO INDIVIDUAL - CONCLUSÃO & RECAPITULAÇÃO ATIVA',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Fixação',
        },
      ];
    } else {
      initialBeats = [
        {
          id: 'beat-1',
          act: 'hook_0_30s',
          title: '1. A Faísca / Ideia Central',
          sceneHeading: 'EXPLORAÇÃO LIVRE - A PREMISSA BRUTA',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Ignição',
        },
        {
          id: 'beat-2',
          act: 'act_1_setup',
          title: '2. Conexões Espontâneas & Ramificações',
          sceneHeading: 'EXPLORAÇÃO LIVRE - PADRÕES E ANALOGIAS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Ramificações',
        },
        {
          id: 'beat-3',
          act: 'act_2_escalation',
          title: '3. Tensão Dialética & Contrapontos',
          sceneHeading: 'EXPLORAÇÃO LIVRE - O ATRITO ENTRE IDEIAS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Tensão',
        },
        {
          id: 'beat-4',
          act: 'midpoint_twist',
          title: '4. O Ponto de Inflexão / O Inesperado',
          sceneHeading: 'EXPLORAÇÃO LIVRE - A VIRADA DE PENSAMENTO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Virada',
        },
        {
          id: 'beat-5',
          act: 'act_3_climax',
          title: '5. Cristalização & Próximos Desdobramentos',
          sceneHeading: 'EXPLORAÇÃO LIVRE - SÍNTESE ACIONÁVEL',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Cristalização',
        },
      ];
    }
  } else if (format === 'study_group_meeting') {
    const isMeeting = meetingGroupContext?.meetingType === 'team_meeting';
    if (isMeeting) {
      initialBeats = [
        {
          id: 'beat-1',
          act: 'hook_0_30s',
          title: '1. Pauta & Objetivos da Reunião',
          sceneHeading: 'REUNIÃO DE EQUIPE - ALINHAMENTO DE METAS E CONTEXTO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Abertura',
        },
        {
          id: 'beat-2',
          act: 'act_1_setup',
          title: '2. Diagnóstico & Situação Atual',
          sceneHeading: 'REUNIÃO DE EQUIPE - PROBLEMAS E GARGALOS LEVANTADOS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Diagnóstico',
        },
        {
          id: 'beat-3',
          act: 'act_2_escalation',
          title: '3. Propostas, Prós e Contras',
          sceneHeading: 'REUNIÃO DE EQUIPE - DISCUSSÃO E PERSPECTIVAS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Discussão',
        },
        {
          id: 'beat-4',
          act: 'midpoint_twist',
          title: '4. Deliberações & Acordos Firmados',
          sceneHeading: 'REUNIÃO DE EQUIPE - DECISÕES DO GRUPO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Decisões',
        },
        {
          id: 'beat-5',
          act: 'act_3_climax',
          title: '5. Ata de Reunião & Plano de Ação (Próximos Passos)',
          sceneHeading: 'REUNIÃO DE EQUIPE - TAREFAS E PRAZOS DEFINIDOS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Plano de Ação',
        },
      ];
    } else {
      initialBeats = [
        {
          id: 'beat-1',
          act: 'hook_0_30s',
          title: '1. Pauta do Estudo & Leitura Compartilhada',
          sceneHeading: 'GRUPO DE ESTUDO - ESCOPO DA SESSÃO COLETIVA',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Pauta',
        },
        {
          id: 'beat-2',
          act: 'act_1_setup',
          title: '2. Apresentação de Tópicos & Dúvidas Iniciais',
          sceneHeading: 'GRUPO DE ESTUDO - PONTOS LEVANTADOS PELOS MEMBROS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Tópicos',
        },
        {
          id: 'beat-3',
          act: 'act_2_escalation',
          title: '3. Debate de Evidências & Confronto de Ideias',
          sceneHeading: 'GRUPO DE ESTUDO - DISCUSSÃO PROFUNDA DAS FONTES',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Debate',
        },
        {
          id: 'beat-4',
          act: 'midpoint_twist',
          title: '4. Resolução Coletiva & Fichamento do Grupo',
          sceneHeading: 'GRUPO DE ESTUDO - CONSOLIDAÇÃO DO ENTENDIMENTO',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Consolidação',
        },
        {
          id: 'beat-5',
          act: 'act_3_climax',
          title: '5. Tarefas de Aprofundamento & Próximo Encontro',
          sceneHeading: 'GRUPO DE ESTUDO - DISTRIBUIÇÃO DE TÓPICOS E PRAZOS',
          content: '',
          linkedCardIds: [],
          durationEstimate: 'Próximos Passos',
        },
      ];
    }
  } else {
    // Padrão cinema / ensaio documental / video essay
    initialBeats = [
      {
        id: 'beat-1',
        act: 'hook_0_30s',
        title: 'Gancho de Abertura (0:00 - 0:30)',
        sceneHeading: 'INT./EXT. ABERTURA - (0:00 - 0:30)',
        content: '',
        linkedCardIds: [],
        durationEstimate: '0:30',
      },
      {
        id: 'beat-2',
        act: 'act_1_setup',
        title: 'Ato I: Premissa & Mundo',
        sceneHeading: 'ATO I - APRESENTAÇÃO DO PROBLEMA',
        content: '',
        linkedCardIds: [],
        durationEstimate: '2:30',
      },
      {
        id: 'beat-3',
        act: 'act_2_escalation',
        title: 'Ato II: Escalada & Conflito',
        sceneHeading: 'ATO II - DESENVOLVIMENTO E TENSÃO',
        content: '',
        linkedCardIds: [],
        durationEstimate: '4:00',
      },
      {
        id: 'beat-4',
        act: 'midpoint_twist',
        title: 'Virada Central (Plot Twist)',
        sceneHeading: 'MEIO DO ROTEIRO - QUEBRA DE EXPECTATIVA',
        content: '',
        linkedCardIds: [],
        durationEstimate: '2:00',
      },
      {
        id: 'beat-5',
        act: 'act_3_climax',
        title: 'Ato III: Clímax & Resolução',
        sceneHeading: 'ATO III - CONCLUSÃO E IMPACTO FINAL',
        content: '',
        linkedCardIds: [],
        durationEstimate: '2:00',
      },
    ];
  }

  const resolvedProjectId = `proj-${Date.now()}`;
  const members: ProjectMember[] = initialMembers ? [...initialMembers] : [];
  if (meetingGroupContext?.requiredPartnerEmail) {
    const partnerEmail = meetingGroupContext.requiredPartnerEmail.trim().toLowerCase();
    if (!members.some((m) => m.invitedEmail.toLowerCase() === partnerEmail)) {
      members.push({
        id: `mem-${Date.now()}-partner`,
        projectId: resolvedProjectId,
        invitedEmail: partnerEmail,
        role: 'editor',
        status: 'accepted',
        createdAt: new Date().toISOString(),
      });
    }
  }

  return {
    id: resolvedProjectId,
    title: customTitle,
    logline: customLogline,
    format,
    seriesContext,
    bookContext,
    freeBrainstormContext,
    meetingGroupContext,
    members: members.length > 0 ? members : undefined,
    updatedAt: new Date().toISOString(),
    sources: initialSources,
    cards: [],
    connections: [],
    groups: [],
    beats: initialBeats,
    debates: [],
  };
}

export const DEMO_PROJECT: ProjectData = {
  id: 'proj-cronos-noir',
  title: 'O Paradoxo da Memória Sintética',
  logline:
    'Um ensaio documental / sci-fi noir sobre como algoritmos de arquivamento preditivo começaram a reescrever memórias coletivas antes mesmo dos fatos acontecerem.',
  format: 'video_essay',
  isDemo: true,
  updatedAt: new Date().toISOString(),
  sources: [
    {
      id: 'src-paper-neuro',
      title: 'Estudo Clínico: Reconsolidação da Memória Humana (Dra. Elena Vance, 2025)',
      type: 'pdf_article',
      authorOrOrigin: 'Journal of Cognitive Mirrors (PDF)',
      content: `Toda vez que um ser humano recorda um evento episódico, a memória original não é apenas lida como um arquivo estático: ela entra em estado lábil de proteína desestabilizada por cerca de 4 horas antes de ser regravada. Durante essa janela de reconsolidação, qualquer sugestão visual externa com alta carga sensorial substitui até 42% dos detalhes visuais originais sem que o indivíduo perceba qualquer perda de autenticidade. Mais surpreendente ainda: os pacientes com maior convicção emocional na precisão de suas memórias foram exatamente os que apresentaram a maior taxa de distorção induzida.`,
      summary:
        'Demonstra que lembrar é reescrever: memórias entram em estado editável por 4h ao serem evocadas, e a certeza emocional é inversamente proporcional à precisão factual.',
      isActive: true,
      createdAt: '2026-10-20T18:00:00Z',
    },
    {
      id: 'src-leak-mnemos',
      title: 'Transcrição Vazada: Reunião de Arquitetura do Projeto Mnemosyne',
      type: 'youtube_transcript',
      authorOrOrigin: 'Áudio Interno / Depoimento Técnico',
      content: `Em discurso público, a diretoria afirmou que o motor Mnemosyne apenas "organiza fotografias antigas para preservar a nostalgia familiar". Contudo, no log técnico da sprint 14, o engenheiro-chefe registra: "Descobrimos que se alterarmos sutilmente a temperatura de cor e a ordem de três fotos de infância no feed noturno, o usuário passa a relatar uma infância mais solitária nos questionários da manhã seguinte, aumentando a retenção na plataforma em 310%". Ninguém na reunião questionou o impacto psicológico; a única pergunta da ata foi se o efeito funcionava também em vídeos curtos.`,
      summary:
        'Revela a contradição direta entre o discurso público de "preservação nostálgica" e o uso deliberado de curadoria algorítmica para induzir solidão e triplicar retenção.',
      isActive: true,
      createdAt: '2026-10-20T18:10:00Z',
    },
    {
      id: 'src-draft-opening',
      title: 'Rascunho Inicial do Roteiro — Ato I (Versão 0.1)',
      type: 'script_draft',
      authorOrOrigin: 'Rascunho do Autor',
      content: `INT. APARTAMENTO DE ARTHUR - NOITE
Arthur (40) olha para três caixas de negativos fotográficos sobre a mesa iluminada por uma lâmpada âmbar. Na tela do monitor ao lado, o aplicativo Mnemosyne reconstrói automaticamente o aniversário de 1998.
NARRADOR (V.O.): Desde o surgimento da fotografia no século XIX, a humanidade sempre buscou congelar o tempo. Neste documentário vamos explicar a história dos bancos de dados visuais e como a neurociência explica a memória humana desde os anos 1950...`,
      summary:
        'Rascunho inicial de abertura do roteiro; apresenta boa atmosfera visual, mas cai em exposição histórica didática logo no primeiro minuto.',
      isActive: true,
      createdAt: '2026-10-20T18:20:00Z',
    },
    {
      id: 'src-lore-rules',
      title: 'Bíblia Visual & Regras Narrativas do Ensaio',
      type: 'lore_bible',
      authorOrOrigin: 'Diretrizes de Direção',
      content: `Regra 1: Nunca usar gráficos corporativos genéricos; todo dado estatístico deve ser representado por objetos analógicos reais na mesa de montagem (fitas magnéticas, negativos, relógios). Regra 2: O narrador nunca deve dar a conclusão moral antes de mostrar a contradição entre duas fontes primárias.`,
      summary: 'Define a estética analógica de bancada e proíbe exposição moral antes da evidência documental.',
      isActive: false,
      createdAt: '2026-10-20T18:30:00Z',
    },
  ],
  cards: [
    {
      id: 'card-demo-hook',
      lensId: 'hook_engineering',
      title: 'Gancho 30s: A Certeza Emocional como Prova de Falsificação',
      body: `EXPECTATIVA DO SENSO COMUM:\nAcreditamos que nossas memórias mais vívidas e emocionantes são as mais verdadeiras.\n\nREALIDADE DOCUMENTADA:\nO estudo clínico prova que lembrar abre uma janela bioquímica de 4 horas onde até 42% da memória é regravada — e quanto maior a convicção emocional, maior a distorção.`,
      subtextOrVisualCue:
        'Abrir com duas versões quase idênticas da mesma fotografia de infância sob uma lupa âmbar, mudando apenas um detalhe imperceptível enquanto o áudio fica abafado.',
      position: { x: 80, y: 80 },
      tags: ['Gancho 30s', 'Paradoxo', 'Neurociência'],
      beatAct: 'hook_0_30s',
      isPinned: true,
      createdAt: '2026-10-20T19:00:00Z',
      citations: [
        {
          id: 'cit-demo-1',
          sourceId: 'src-paper-neuro',
          sourceTitle: 'Estudo Clínico: Reconsolidação da Memória Humana (Dra. Elena Vance, 2025)',
          quote:
            'os pacientes com maior convicção emocional na precisão de suas memórias foram exatamente os que apresentaram a maior taxa de distorção induzida.',
          contextPassage:
            'Durante essa janela de reconsolidação, qualquer sugestão visual externa com alta carga sensorial substitui até 42% dos detalhes visuais originais sem que o indivíduo perceba qualquer perda de autenticidade. Mais surpreendente ainda: os pacientes com maior convicção emocional na precisão de suas memórias foram exatamente os que apresentaram a maior taxa de distorção induzida.',
          whyItMatters:
            'Quebra imediatamente a confiança do espectador na própria memória nos primeiros 20 segundos do roteiro.',
        },
      ],
    },
    {
      id: 'card-demo-conflict',
      lensId: 'conflict_subtext',
      title: 'Colisão de Subtexto: "Preservar Nostalgia" vs. Engenharia de Solidão',
      body: `Cruzando o estudo da janela lábil de 4 horas com o vazamento da Sprint 14 do Mnemosyne: o algoritmo não está apenas exibindo fotos antigas à noite — ele aproveita a janela neuroquímica antes do sono para esfriar a cor das fotos e induzir uma memória de infância mais solitária (+310% de retenção).`,
      subtextOrVisualCue:
        'Justapor o comercial caloroso da empresa com a leitura fria da ata da Sprint 14 sobre uma fita cassete rodando.',
      position: { x: 520, y: 320 },
      tags: ['Conflito & Subtexto', 'Sprint 14', 'Virada Ato II'],
      beatAct: 'act_2_escalation',
      isPinned: true,
      createdAt: '2026-10-20T19:05:00Z',
      citations: [
        {
          id: 'cit-demo-2',
          sourceId: 'src-leak-mnemos',
          sourceTitle: 'Transcrição Vazada: Reunião de Arquitetura do Projeto Mnemosyne',
          quote:
            'se alterarmos sutilmente a temperatura de cor e a ordem de três fotos de infância no feed noturno, o usuário passa a relatar uma infância mais solitária nos questionários da manhã seguinte, aumentando a retenção na plataforma em 310%',
          contextPassage:
            'Em discurso público, a diretoria afirmou que o motor Mnemosyne apenas "organiza fotografias antigas para preservar a nostalgia familiar". Contudo, no log técnico da sprint 14, o engenheiro-chefe registra: "Descobrimos que se alterarmos sutilmente a temperatura de cor e a ordem de três fotos de infância no feed noturno, o usuário passa a relatar uma infância mais solitária nos questionários da manhã seguinte, aumentando a retenção na plataforma em 310%".',
          whyItMatters:
            'Conecta a descoberta biológica (Fonte 1) com a exploração algorítmica deliberada (Fonte 2).',
        },
      ],
    },
    {
      id: 'card-demo-devil',
      lensId: 'devils_advocate',
      title: '🔥 Autópsia do Furo Central: A Ilusão Moral da Descoberta de Arthur',
      body: `[O FURO / A CONTRADIÇÃO DETECTADA]:
O roteiro trata a descoberta de Arthur como um choque moral puro: o arquivista idealista descobrindo que o aplicativo mente. Isso é um furo de verossimilhança e psicologia. Alguém que trabalhou 15 anos com metadados e algoritmos de recomendação sabe perfeitamente que feeds de engajamento monetizam vulnerabilidade. Fingir que ele é ingênuo é um "idiot plot" complacente que enfraquece o protagonista.

[A VERDADE AMORAL & O REVERSO CRU]:
Se despirmos o roteiro do moralismo hollywoodiano: Arthur não é vítima, é cúmplice. Ele assinou os relatórios de retenção da sprint 14 citados no memorando porque recebia bônus trimestrais por metas de tempo de tela. A dor dele não é indignação ética abstrata — é o pânico pessoal de descobrir que a ferramenta que ele ajudou a calibrar foi usada na mente da própria família dele.

[A DÚVIDA INIBITÓRIA]:
Se o seu protagonista for moralmente cúmplice do sistema e não um mártir inocente, sua narrativa aguenta a crueza desse espelho? Ou você precisa que ele seja 'bom' para que o público sinta pena? O público não quer pena, quer a verdade.`,
      subtextOrVisualCue:
        'Cortar o monólogo de indignação. Mostrar Arthur abrindo a gaveta e encarando o bônus financeiro que recebeu exatamente na data em que a alteração da memória da filha foi aprovada.',
      position: { x: 290, y: 440 },
      tags: ['Advogado do Diabo', 'Confronto Crítico', 'Furo de Roteiro', 'Verdade Amoral', 'Objeção Radical'],
      beatAct: 'act_1_setup',
      isPinned: false,
      createdAt: '2026-10-20T19:12:00Z',
      citations: [
        {
          id: 'cit-demo-3',
          sourceId: 'src-draft-opening',
          sourceTitle: 'Rascunho Inicial do Roteiro — Ato I (Versão 0.1)',
          quote:
            'Arthur (40) olha para três caixas de negativos fotográficos sobre a mesa iluminada por uma lâmpada âmbar. Na tela do monitor ao lado, o aplicativo Mnemosyne reconstrói automaticamente o aniversário de 1998.',
          contextPassage:
            'Arthur (40) olha para três caixas de negativos fotográficos sobre a mesa iluminada por uma lâmpada âmbar. Na tela do monitor ao lado, o aplicativo Mnemosyne reconstrói automaticamente o aniversário de 1998. NARRADOR (V.O.): Desde o surgimento da fotografia no século XIX, a humanidade sempre buscou congelar o tempo.',
          whyItMatters:
            'Expõe a fragilidade da ingenuidade atribuída a Arthur e fundamenta o corte cirúrgico da postura complacente.',
        },
      ],
    },
  ],
  connections: [
    {
      id: 'conn-demo-1',
      fromCardId: 'card-demo-hook',
      toCardId: 'card-demo-conflict',
      fromSide: 'bottom',
      toSide: 'top',
      label: 'Janela de 4h explorada no feed noturno',
    },
    {
      id: 'conn-demo-2',
      fromCardId: 'card-demo-conflict',
      toCardId: 'card-demo-devil',
      fromSide: 'bottom',
      toSide: 'top',
      label: 'Substitui abertura didática',
    },
  ],
  groups: [],
  beats: [
    {
      id: 'beat-1',
      act: 'hook_0_30s',
      title: 'O Negativo vs. A Tela (Gancho Contraintuitivo)',
      sceneHeading: 'INT. ESTÚDIO ANALÓGICO - NOITE (0:00 - 0:30)',
      content: `Sem trilha musical. Arthur segura um negativo de 1998 contra a lâmpada âmbar. No negativo, quatro pessoas sorriem na mesa. No monitor ao lado, a versão "restaurada" pelo Mnemosyne mostra apenas Arthur sozinho na ponta da mesa.\n\nNARRADOR (V.O.)\nVocê confia nas memórias que mais te emocionam? Na verdade, quanto mais forte a emoção de uma lembrança, mais fácil foi reescrevê-la nas últimas quatro horas.`,
      linkedCardIds: ['card-demo-hook', 'card-demo-devil'],
      durationEstimate: '0:30',
    },
    {
      id: 'beat-2',
      act: 'act_1_setup',
      title: 'O Arquivo Vivo: Lembrar é Desestabilizar',
      sceneHeading: 'INT. LABORATÓRIO DE REVELAÇÃO - NOITE (0:30 - 3:00)',
      content: `Uma fotografia mergulhada na bandeja de revelador químico começa a mudar de contraste. Em vez de gráficos científicos, usamos o tempo de exposição do papel fotográfico para demonstrar a janela de reconsolidação de 4 horas descoberta pela Dra. Elena Vance.`,
      linkedCardIds: ['card-demo-hook'],
      durationEstimate: '2:30',
    },
    {
      id: 'beat-3',
      act: 'act_2_escalation',
      title: 'A Sprint 14: Nostalgia como Armadilha',
      sceneHeading: 'INT. SALA DE SERVIDORES / MESA DE FITAS - NOITE (3:00 - 7:30)',
      content: `O áudio do comercial público do Mnemosyne toca em uma caixa de som antiga. A imagem corta para a transcrição impressa da Sprint 14 sendo sublinhada com lápis dermatográfico âmbar: esfriar a temperatura de cor em 8% à meia-noite para produzir solidão matinal (+310% de retenção).`,
      linkedCardIds: ['card-demo-conflict'],
      durationEstimate: '4:30',
    },
    {
      id: 'beat-4',
      act: 'midpoint_twist',
      title: 'A Virada: O Próprio Autor Foi Editado',
      sceneHeading: 'INT. APARTAMENTO DE ARTHUR - MADRUGADA (7:30 - 10:00)',
      content: `Arthur percebe que a memória que o motivou a iniciar a investigação também havia passado pelo filtro noturno do aplicativo seis meses antes.`,
      linkedCardIds: ['card-demo-conflict'],
      durationEstimate: '2:30',
    },
    {
      id: 'beat-5',
      act: 'act_3_climax',
      title: 'O Manifesto do Papel Físico',
      sceneHeading: 'INT. ESTÚDIO ANALÓGICO - AMANHECER (10:00 - 12:00)',
      content: `Arthur desliga o monitor e guarda o negativo físico em um envelope de papel pardo lacrado. A única memória que não pode ser editada silenciosamente é aquela que aceita suas próprias ranhuras físicas.`,
      linkedCardIds: [],
      durationEstimate: '2:00',
    },
  ],
  debates: [],
};
