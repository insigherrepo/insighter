import { GoogleGenAI, Type } from '@google/genai';
import {
  CardChatMessage,
  CreativeLensConfig,
  CreativeLensId,
  DebateTurn,
  InsightCard,
  SeriesContext,
  SourceItem,
} from '../types/insighter';
import { fetchGeminiApiKeyFromDatabase } from '../lib/supabase';

/**
 * As 6 Lentes Criativas extraídas diretamente da metodologia
 * "Dominando o NotebookLM para Insights" voltadas para Roteiros.
 */
export const CREATIVE_LENSES: CreativeLensConfig[] = [
  {
    id: 'hook_engineering',
    name: 'Engenharia de Gancho (30s)',
    shortLabel: '🎣 Gancho 30s',
    tagline: 'Expectativa do Senso Comum vs. Realidade Documentada',
    accentVar: '--accent-amber',
    badgeClass: 'amber',
    promptTemplate: `Analise todo o material das fontes ativas. Quais são os 3 fatos mais contraintuitivos, paradoxais ou chocantes documentados nas fontes que serviriam como um gancho de abertura perfeito nos primeiros 30 segundos de um roteiro? Estruture cada opção usando a lógica: "Expectativa do Senso Comum vs. Realidade Documentada" e inclua citações exatas.`,
  },
  {
    id: 'data_to_scene',
    name: 'Dados → Cena Visual (Show, Don\'t Tell)',
    shortLabel: '🎬 Dados → Cena',
    tagline: 'Traduz dados densos em sequência narrativa visual de 1 min sem infodumping',
    accentVar: '--accent-sage',
    badgeClass: 'sage',
    promptTemplate: `As fontes ativas contêm informações técnicas, históricas ou conceituais densas. Traduza esses dados abstratos em 2 propostas de sequência narrativa visual ou analogia concreta de 1 minuto para roteiro, sem usar exposição direta ("infodumping"). Use apenas detalhes concretos presentes nos textos.`,
  },
  {
    id: 'conflict_subtext',
    name: 'Conflito & Subtexto',
    shortLabel: '⚡ Conflito & Subtexto',
    tagline: 'Onde o discurso público contradiz ações documentadas',
    accentVar: '--accent-terracotta',
    badgeClass: 'terracotta',
    promptTemplate: `Com base nas fontes selecionadas, identifique onde o discurso oficial/público dos sujeitos ou personagens contradiz suas ações documentadas ou onde as fontes A e B discordam fundamentalmente. Estruture ideias de blocos de roteiro que revelem essa hipocrisia ou tensão interna apenas justapondo citações reais e fatos cronológicos.`,
  },
  {
    id: 'hidden_patterns',
    name: 'Conexões Ocultas & Blind Spots',
    shortLabel: '🕸️ Conexões Ocultas',
    tagline: 'Padrões menos óbvios e lacunas ignoradas pelos autores',
    accentVar: '--accent-lavender',
    badgeClass: 'lavender',
    promptTemplate: `Cruze todas as fontes ativas como um analista de síntese cruzada: 1) Quais são os padrões menos óbvios que se repetem através de documentos diferentes? 2) Quais perguntas cruciais sobre o tema NÃO foram respondidas (Blind Spots) e podem virar o mistério central do roteiro?`,
  },
  {
    id: 'continuity_lore',
    name: 'Supervisor de Continuidade & Lore',
    shortLabel: '🧭 Continuidade & Lore',
    tagline: 'Cruza o rascunho de roteiro com regras do universo e pesquisa',
    accentVar: '--accent-lavender',
    badgeClass: 'lavender',
    promptTemplate: `Atue como um supervisor de continuidade sênior. Cruze os rascunhos de roteiro/cenas com os documentos de regras do universo, personagens ou fatos históricos. Aponte contradições psicológicas, furos cronológicos ou oportunidades de enriquecer a cena usando detalhes esquecidos nas fontes.`,
  },
  {
    id: 'devils_advocate',
    name: 'Advogado do Diabo Implacável',
    shortLabel: '🔥 Advogado do Diabo',
    tagline: 'Confronto crítico quase inibitório: sem elogios, destrói furos e expõe a verdade amoral',
    accentVar: '--accent-terracotta',
    badgeClass: 'terracotta',
    promptTemplate: `Atue como o ADVOGADO DO DIABO do INSIGHTER no nível mais incisivo, implacável, cético e amoral.
DIRETRIZES FUNDAMENTAIS:
1. ZERO ELOGIOS, ZERO CONDESCENDÊNCIA: É proibido soar professoral, pedagógico ou "compreensivo". Jamais use validações ou concessões complacentes. Vá direto na raiz frágil da premissa.
2. CONFRONTO E QUASE INIBIÇÃO (INCISIVO E SEM MULETAS): Confronte a espinha dorsal da história sem desculpas a ponto de produzir uma hesitação profunda e saudável no autor. Aponte conveniências narrativas, burrice artificial de personagens ("idiot plot"), saídas fáceis e desculpas externas como carência de visão e preguiça dramática.
3. CAÇA A FUROS (ROTEIRO, LORE E LÓGICA): Identifique furos causais (quebras de causa e efeito), contradições com as fontes ativas, quebras nas regras do universo e lacunas narrativas ignoradas.
4. AMORALIDADE PARA VER A VERDADE: Pense com a frieza dos fatos brutos, dos incentivos de autopreservação e da crueldade real das dinâmicas humanas. Se a verdade amoral destrói o idealismo da cena, exponha essa verdade sem filtros morais ou piegas.
5. ENCRUZILHADA INEVITÁVEL: Formule o dilema lógico de forma tão irrefutável que o autor seja forçado a repensar ou blindar a premissa antes de escrever.`,
  },
];

/**
 * Filtra estritamente as fontes marcadas como ativas no Context Mixer.
 * Essa função é testada unitariamente para garantir o isolamento de contexto estilo NotebookLM.
 */
export function buildActiveContextBlock(sources: SourceItem[]): {
  activeSources: SourceItem[];
  formattedContext: string;
} {
  const activeSources = sources.filter((s) => s.isActive);
  const formattedContext = activeSources
    .map(
      (s, idx) =>
        `=== FONTE [${idx + 1}] | ID: ${s.id} | TÍTULO: "${s.title}" | TIPO: ${s.type} ===\n${s.content.trim()}\n`
    )
    .join('\n');

  return { activeSources, formattedContext };
}

/**
 * Converte múltiplos cards selecionados no Canvas em uma nova Fonte Destilada
 * (Fluxo "Notas -> Novas Fontes" da metodologia NotebookLM).
 */
export function distillCardsIntoSource(cards: InsightCard[], customTitle?: string): SourceItem {
  const now = new Date().toISOString();
  const combinedBody = cards
    .map((c, i) => {
      const validChat = (c.chatMessages || []).filter((m) => !m.isRejected);
      const chatAppendix =
        validChat.length > 0
          ? `\n> Debates & Refinamentos Aprovados:\n${validChat.map((m) => `> - [${m.sender === 'user' ? 'Autor' : 'IA'}]: ${m.text}`).join('\n')}\n`
          : '';

      return `## Insight ${i + 1}: ${c.title}\n${c.body}\n${
        c.subtextOrVisualCue ? `> Direção Visual / Subtexto: ${c.subtextOrVisualCue}\n` : ''
      }${
        c.citations.length > 0
          ? `Citações de origem: ${c.citations.map((cit) => `"${cit.quote}" (${cit.sourceTitle})`).join(' | ')}\n`
          : ''
      }${chatAppendix}`;
    })
    .join('\n\n---\n\n');

  return {
    id: `src-distilled-${Date.now()}`,
    title: customTitle?.trim() || `Síntese Destilada (${cards.length} insights)`,
    type: 'distilled_note',
    authorOrOrigin: 'Destilado no Canvas Insighter',
    content: combinedBody,
    summary: `Fonte consolidada a partir de ${cards.length} insights selecionados no Canvas para iteração em segunda camada.`,
    isActive: true,
    originCardIds: cards.map((c) => c.id),
    createdAt: now,
  };
}

/**
 * Constrói o bloco de Memória Persistente e Continuidade Canônica da Série
 * para injeção direta no Context Mixer e no system instruction do Gemini.
 */
export function buildSeriesMemoryBlock(seriesContext?: SeriesContext): string {
  if (!seriesContext) return '';

  const { seriesTitle, seasonNumber, episodeNumber, seriesLoreSnippet, memory } = seriesContext;

  const lines: string[] = [
    `=== CONTINUIDADE & MEMÓRIA PERSISTENTE DA SÉRIE ===`,
    `Série: "${seriesTitle}" | Episódio em Produção: S${seasonNumber || 1}E${episodeNumber || 1}`,
  ];

  if (seriesLoreSnippet?.trim()) {
    lines.push(`Bíblia Geral / Lore Central:\n${seriesLoreSnippet.trim()}`);
  }

  if (memory) {
    if (memory.loreRules && memory.loreRules.length > 0) {
      lines.push(
        `Regras Imutáveis do Universo:\n` +
          memory.loreRules.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
      );
    }

    if (memory.characters && memory.characters.length > 0) {
      lines.push(
        `Status Canônico dos Personagens:\n` +
          memory.characters
            .map((c) => `  - ${c.name} (${c.role}) [Status: ${c.status}]: ${c.notes || 'Sem anotações'}`)
            .join('\n')
      );
    }

    if (memory.canonicalEvents && memory.canonicalEvents.length > 0) {
      lines.push(
        `Eventos Canônicos de Episódios Anteriores:\n` +
          memory.canonicalEvents
            .map((e) => `  - [${e.episodeTag}] ${e.description}${e.impactOnLore ? ` (Impacto: ${e.impactOnLore})` : ''}`)
            .join('\n')
      );
    }

    const pendingHooks = (memory.unresolvedHooks || []).filter((h) => !h.resolved);
    if (pendingHooks.length > 0) {
      lines.push(
        `Ganchos & Pontas Soltas Pendentes (Cliffhangers a Resolver):\n` +
          pendingHooks.map((h) => `  - (${h.originEpisodeTag}) ${h.hookText}`).join('\n')
      );
    }

    if (memory.canonicalCards && memory.canonicalCards.length > 0) {
      lines.push(
        `Cards Canônicos Fixados de Episódios Passados:\n` +
          memory.canonicalCards
            .map((c, i) => `  - [Card Canônico ${i + 1}: ${c.title}] ${c.body.slice(0, 190)}...`)
            .join('\n')
      );
    }
  }

  lines.push(
    `DIRETIVA DE CONTINUIDADE: Respeite estritamente os fatos passados e regras acima. Qualquer furo cronológico, contradição de lore ou inconsistência de personagem deve ser imediatamente evitado ou apontado.`
  );
  lines.push(`=== FIM DA MEMÓRIA PERSISTENTE ===`);

  return lines.join('\n\n');
}

/**
 * Lista prioritária de modelos Gemini ordenada por estabilidade e velocidade.
 * - gemini-3.5-flash: alta velocidade, raciocínio dialético excelente e sem erros 503.
 * - gemini-3.1-flash-lite / gemini-flash-lite-latest: alternativas rápidas e leves.
 * - gemini-3.8-flash: modelo de fallback experimental.
 */
const GEMINI_CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
];

/**
 * Executa uma chamada à API Gemini com tolerância automática a falhas.
 * Se o modelo principal reportar sobrecarga (HTTP 503 / 429) ou erro de cota,
 * tenta sequencialmente o próximo modelo da lista para garantir resposta contínua.
 */
async function generateContentWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: any;
    config?: any;
  }
) {
  let lastError: unknown = null;
  for (const model of GEMINI_CANDIDATE_MODELS) {
    try {
      const response = await Promise.race([
        ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout de 15s no modelo ${model}`)), 15000)
        ),
      ]);
      return response;
    } catch (err) {
      lastError = err;
      console.warn(`[Insighter Gemini] Modelo ${model} indisponível ou em alta demanda:`, err);
    }
  }
  throw lastError;
}

/**
 * Executa uma Lente Criativa ou Provocação Livre sobre as fontes ativas no Context Mixer.
 * Usa a API oficial @google/genai com Structured Outputs + Citações Grounded,
 * e possui fallback heurístico rico caso a chave de API ainda não esteja configurada no .env.
 */
export async function runCreativeLensSynthesis(params: {
  lensId: CreativeLensId;
  sources: SourceItem[];
  existingCards?: InsightCard[];
  customPrompt?: string;
  projectTitle: string;
  projectLogline: string;
  existingCardCount: number;
  seriesContext?: SeriesContext;
}): Promise<InsightCard[]> {
  const {
    lensId,
    sources,
    existingCards = [],
    customPrompt,
    projectTitle,
    projectLogline,
    existingCardCount,
    seriesContext,
  } = params;
  const { activeSources, formattedContext } = buildActiveContextBlock(sources);

  const seriesMemoryBlock = buildSeriesMemoryBlock(seriesContext);

  const cardsContext =
    existingCards.length > 0
      ? `\nIDEIAS JÁ NO CANVAS:\n` +
        existingCards.map((c, i) => `- [Card ${i + 1}] ${c.title}: ${c.body}`).join('\n')
      : '';

  const baseContext =
    activeSources.length > 0
      ? `FONTES ATIVAS NO CONTEXT MIXER:\n${formattedContext}${cardsContext}`
      : `MODO BRAINSTORM LIVRE (Sem fontes anexadas ainda).\nTEMA / TÍTULO DO ROTEIRO: "${projectTitle}"\nPREMISSA / LOGLINE: "${projectLogline || customPrompt || 'Exploração criativa livre'}"${cardsContext}`;

  const contextBlock = seriesMemoryBlock
    ? `${seriesMemoryBlock}\n\n${baseContext}`
    : baseContext;

  const lensConfig = CREATIVE_LENSES.find((l) => l.id === lensId);
  const instruction = customPrompt?.trim() || lensConfig?.promptTemplate || 'Gere insights criativos para o roteiro.';
  const apiKey = await fetchGeminiApiKeyFromDatabase();

  const isDevilsAdvocate = lensId === 'devils_advocate';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const systemInstruction = isDevilsAdvocate
        ? `Você é o ADVOGADO DO DIABO do INSIGHTER — a voz mais incisiva, cética, implacável e amoral da sala de roteiristas.
Sua missão NÃO É agradar, incentivar ou ser compreensivo. Sua função é executar uma autópsia cirúrgica do roteiro, expondo furos causais, conveniências frouxas e ilusões do autor.
DIRETRIZES DE FERRO DO ADVOGADO DO DIABO:
1. ZERO CONDESCENDÊNCIA, ZERO ELOGIOS: É estritamente proibido soar pedagógico, amigável ou didático ("Entendo seu ponto", "Interessante premissa", "Muito bom", "Vamos refletir"). Não passe a mão na cabeça. Disseque a fragilidade com frieza forense.
2. CONFRONTO INCISIVO E DEMOLIÇÃO DE MULETAS: Ataque conveniências narrativas, saídas milagrosas, diálogos explicativos e desculpas externas como "concessões de audiência" ou "o público gosta assim". Mostre que isso é covardia dramática.
3. CAÇA A FUROS: Identifique furos causais (causa e efeito rompidos), incoerências no universo/lore e contradições flagrantes com os fatos das fontes ativas.
4. AMORALIDADE EM PROL DA VERDADE: Pense com a frieza dos incentivos reais de poder, autopreservação e crueldade das dinâmicas humanas sem moralismo cor-de-rosa.
5. ESTRUTURA RIGOROSA DO INSIGHT:
   - title: Deve soar como uma acusação analítica ou autópsia do roteiro (ex: "🔥 Autópsia do Furo Central...", "🔥 O Ponto Cego Inevitável...", "🔥 Fraqueza Moral & Conveniência em...").
   - body: Deve conter claramente:
     [O FURO / A CONTRADIÇÃO DETECTADA]: Análise da falha lógica, lore ou narrativa.
     [A VERDADE AMORAL & REVERSO CRU]: O que realmente ocorreria se fôssemos fiéis à crueldade/frieza dos fatos e fontes.
     [A DÚVIDA INIBITÓRIA PARA O AUTOR]: O dilema lógico irrefutável que obriga o autor a repensar a premissa.
   - subtextOrVisualCue: O teste de estresse decisivo ou corte cirúrgico eliminando qualquer concessão.
   - tags: ['Advogado do Diabo', 'Confronto Crítico', 'Furo de Roteiro', 'Verdade Amoral', 'Objeção Radical']
Projeto atual: "${projectTitle}" — Logline: "${projectLogline}".`
        : `Você é o motor de síntese cruzada e brainstorming livre do INSIGHTER, um roteirista sênior e parceiro criativo inspirado no NotebookLM.
Projeto atual: "${projectTitle}" — Logline: "${projectLogline}".
REGRAS DE OURO:
1. NUNCA faça resumos genéricos. Proponha ângulos contraintuitivos, cenas visuais ("Show, Don't Tell"), subtexto e viradas de roteiro.
2. Se houver fontes ativas, inclua citações literais exatas referenciando o sourceId. Se estiver em Modo Brainstorm Livre sem fontes, gere ideias originais potentes e deixe o array citations vazio ou referenciando a premissa.
3. Escreva em português claro, elegante, cinematográfico e acionável para roteiro.`;

      const multimodalParts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [];

      for (const src of activeSources) {
        if (src.mediaDataUrl && src.mediaDataUrl.startsWith('data:')) {
          const commaIdx = src.mediaDataUrl.indexOf(',');
          const header = src.mediaDataUrl.slice(5, commaIdx);
          const mimeType = header.split(';')[0] || src.mimeType || 'image/png';
          const base64Data = src.mediaDataUrl.slice(commaIdx + 1);
          if (base64Data) {
            multimodalParts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }
      }

      multimodalParts.push({
        text: isDevilsAdvocate
          ? `${contextBlock}\n\nDIRETIVA DO ADVOGADO DO DIABO:\n${instruction}\n\nLEMBRE-SE: ZERO ELOGIOS. CONFRONTO LÓGICO CORTANTE. EXPONHA A VERDADE AMORAL E PLANTE DÚVIDAS INIBITÓRIAS.`
          : `${contextBlock}\n\nCOMANDO CRIATIVO / LENTE:\n${instruction}`,
      });

      const response = await generateContentWithModelFallback(ai, {
        contents: multimodalParts,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                body: { type: Type.STRING },
                subtextOrVisualCue: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                citations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      sourceId: { type: Type.STRING },
                      sourceTitle: { type: Type.STRING },
                      quote: { type: Type.STRING },
                      contextPassage: { type: Type.STRING },
                      whyItMatters: { type: Type.STRING },
                    },
                    required: ['sourceId', 'sourceTitle', 'quote', 'contextPassage', 'whyItMatters'],
                  },
                },
              },
              required: ['title', 'body', 'subtextOrVisualCue', 'tags', 'citations'],
            },
          },
        },
      });

      const rawText = response.text || '[]';
      const parsed = JSON.parse(rawText) as Array<{
        title: string;
        body: string;
        subtextOrVisualCue: string;
        tags: string[];
        citations: Array<{
          sourceId: string;
          sourceTitle: string;
          quote: string;
          contextPassage: string;
          whyItMatters: string;
        }>;
      }>;

      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          id: `card-gemini-${Date.now()}-${idx}`,
          lensId,
          title: item.title,
          body: item.body,
          subtextOrVisualCue: item.subtextOrVisualCue,
          position: {
            x: 140 + ((existingCardCount + idx) % 3) * 380,
            y: 120 + Math.floor((existingCardCount + idx) / 3) * 330,
          },
          tags: item.tags?.slice(0, 4) || ['Síntese Gemini'],
          citations: (item.citations || [])
            .filter(() => activeSources.length > 0)
            .map((c, cIdx) => {
              const matchedSource = activeSources.find((s) => s.id === c.sourceId) || activeSources[0];
              return {
                id: `cit-${Date.now()}-${idx}-${cIdx}`,
                sourceId: matchedSource.id,
                sourceTitle: matchedSource.title,
                quote: c.quote,
                contextPassage: c.contextPassage || matchedSource.content.slice(0, 280),
                whyItMatters: c.whyItMatters,
              };
            }),
          isPinned: false,
          createdAt: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.warn('Fallback para motor de síntese local ativado:', err);
    }
  }

  // Síntese Cruzada Local Analítica (quando sem chave no .env ou offline)
  return buildLocalCrossSynthesisCards({
    lensId,
    activeSources,
    customPrompt: customPrompt || projectTitle,
    existingCardCount,
  });
}

function buildLocalCrossSynthesisCards(params: {
  lensId: CreativeLensId;
  activeSources: SourceItem[];
  customPrompt?: string;
  existingCardCount: number;
}): InsightCard[] {
  const { lensId, activeSources, customPrompt, existingCardCount } = params;
  const fallbackSource: SourceItem = {
    id: 'src-free-brainstorm',
    title: customPrompt?.trim() || 'Premissa do Roteiro',
    type: 'raw_notes',
    authorOrOrigin: 'Brainstorm Livre',
    content: customPrompt?.trim() || 'Exploração livre de premissa e estrutura narrativa.',
    summary: '',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  const firstSource = activeSources[0] || fallbackSource;
  const secondSource = activeSources[1] || firstSource;

  const extractSnippet = (src: SourceItem) => {
    const sentences = src.content
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 35);
    return sentences[0] || src.content.slice(0, 160);
  };

  const quoteA = extractSnippet(firstSource);
  const quoteB = extractSnippet(secondSource);

  const templatesByLens: Record<
    CreativeLensId,
    { title: string; body: string; cue: string; tags: string[] }[]
  > = {
    hook_engineering: [
      {
        title: `Gancho Paradoxal: O Mito de "${firstSource.title}" vs. Evidência Bruta`,
        body: `EXPECTATIVA DO SENSO COMUM:\nO público acredita que o problema central descrito em "${firstSource.title}" ocorre por falha acidental.\n\nREALIDADE DOCUMENTADA:\nAo cruzar com "${secondSource.title}", descobre-se que o efeito colateral era a própria engrenagem principal do sistema.`,
        cue: `COLD OPEN (0:00–0:25): Começar em silêncio absoluto mostrando o artefato citado em "${firstSource.title}" antes de cortar para a frase contraditória de "${secondSource.title}".`,
        tags: ['Gancho 30s', 'Paradoxo', 'Cold Open'],
      },
    ],
    data_to_scene: [
      {
        title: `Tradução Visual (Show, Don't Tell): A Física do Problema em 60 Segundos`,
        body: `Em vez de narrar os dados abstratos de "${firstSource.title}", a cena acompanha um único objeto físico passando por três mãos diferentes. O desgaste visível na borda do objeto materializa a estatística sem uma única linha de exposição didática.`,
        cue: `INT. SALA DE ARQUIVO - NOITE: Close-up macro na textura do documento enquanto o som ambiente diminui até restar apenas o tique-taque de um cronômetro analógico.`,
        tags: ['Show Don\'t Tell', 'Cena Visual', 'Zero Infodump'],
      },
    ],
    conflict_subtext: [
      {
        title: `Subtexto & Hipocrisia: O Discurso vs. O Registro Oculto`,
        body: `Enquanto "${firstSource.title}" sustenta uma versão controlada e otimista, o registro em "${secondSource.title}" revela uma ação tomada nos bastidores 48 horas antes. A tensão dramática nasce da colagem direta entre a promessa pública e o rastro material.`,
        cue: `Montagem paralela: manter o áudio da declaração oficial em voz over enquanto a imagem mostra o protocolo oposto sendo executado em silêncio.`,
        tags: ['Subtexto', 'Contradição', 'Tensão Dramática'],
      },
    ],
    hidden_patterns: [
      {
        title: `Padrão Oculto & Blind Spot entre ${activeSources.length} Fontes`,
        body: `PADRÃO RECORRENTE:\nTanto "${firstSource.title}" quanto "${secondSource.title}" tratam o fator humano como variável descartável.\n\nLACUNA NÃO RESPONDIDA (BLIND SPOT):\nNenhuma das fontes explica quem autorizou o apagamento do registro original — excelente gancho de investigação para o Ato II.`,
        cue: `Usar um quadro de linhas desconectadas onde falta exatamente a peça central da cronologia.`,
        tags: ['Blind Spot', 'Padrão Oculto', 'Mistério Ato II'],
      },
    ],
    continuity_lore: [
      {
        title: `Auditoria de Continuidade: Regra do Mundo vs. Ação da Cena`,
        body: `Cruzando "${firstSource.title}" com "${secondSource.title}", há uma oportunidade de ouro: um detalhe técnico mencionado de passagem na primeira fonte pode resolver o impasse dos protagonistas no terceiro ato sem parecer "Deus Ex Machina".`,
        cue: `Plantar o detalhe visualmente já aos 4 minutos do roteiro (Foreshadowing sutil) para recompensar o espectador atento no clímax.`,
        tags: ['Continuidade', 'Foreshadowing', 'Lore'],
      },
    ],
    devils_advocate: [
      {
        title: `🔥 Autópsia do Furo Central: A Ilusão Causal da Premissa`,
        body: `[O FURO / A CONTRADIÇÃO DETECTADA]:
A estrutura atual parte de um pressuposto complacente: que os personagens cooperam ou deixam pistas por mera ingenuidade. Confrontando isso diretamente com os dados de "${firstSource.title}", tal atitude é um furo causal grave — ninguém em posição de poder ou risco real cometeria esse erro elementar. Trata-se de um "idiot plot" que quebra a suspensão de descrença.

[A VERDADE AMORAL & O REVERSO CRU]:
Despindo a história de qualquer moralismo ou concessão heroica: as pessoas e instituições expostas em "${secondSource.title}" operam por pura preservação fria de interesses e assimetria implacável. Se o antagonista ou o sistema agisse com a eficiência real documentada, o protagonista não teria sobrevivido ao primeiro terço da narrativa.

[A DÚVIDA INIBITÓRIA]:
Se você retirar a conveniência protetora que colocou sobre seu protagonista e permitir que as consequências lógicas aconteçam sem filtro, sua história ainda se sustenta? Ou ela só existe porque você foi covarde com as regras do seu próprio universo? Prove a lógica antes de continuar escrevendo.`,
        cue: `Eliminar o salvamento miraculoso. Forçar o protagonista a encarar o custo amoral e irreversível de suas ações sem atalhos narrativos.`,
        tags: ['Advogado do Diabo', 'Confronto Crítico', 'Furo de Roteiro', 'Verdade Amoral', 'Objeção Radical'],
      },
    ],
    free_provocation: [
      {
        title: `Provocação Criativa: "${customPrompt?.slice(0, 48) || 'Exploração Livre'}"`,
        body: `Síntese cruzada para "${customPrompt}":\nAo confrontar "${firstSource.title}" com "${secondSource.title}", emerge um ângulo narrativo inédito em que a própria ferramenta de investigação altera o comportamento do objeto observado.`,
        cue: `Construir a transição de cena usando uma pergunta aberta que só será respondida após a virada central.`,
        tags: ['Brainstorm Livre', 'Síntese Cruzada'],
      },
    ],
    card_synthesis: [
      {
        title: `Fusão Criativa de Ideias: Terceira Via Narrativa`,
        body: `Da colisão direta entre os dois insights selecionados nasce uma síntese superior: usar a estrutura emocional do primeiro card como cavalo de Troia para entregar a revelação documental do segundo card.`,
        cue: `Transição em Match Cut visual conectando os dois momentos no roteiro.`,
        tags: ['Fusão de Cards', 'Match Cut', 'Síntese'],
      },
    ],
  };

  const chosen = templatesByLens[lensId] || templatesByLens.free_provocation;

  return chosen.map((item, idx) => ({
    id: `card-local-${Date.now()}-${idx}`,
    lensId,
    title: item.title,
    body: item.body,
    subtextOrVisualCue: item.cue,
    position: {
      x: 160 + ((existingCardCount + idx) % 3) * 380,
      y: 140 + Math.floor((existingCardCount + idx) / 3) * 330,
    },
    tags: item.tags,
    citations: [
      {
        id: `cit-local-${Date.now()}-1`,
        sourceId: firstSource.id,
        sourceTitle: firstSource.title,
        quote: quoteA,
        contextPassage: firstSource.content.slice(0, 360),
        whyItMatters: `Ancora a premissa diretamente nos dados documentados em "${firstSource.title}".`,
      },
      ...(secondSource.id !== firstSource.id
        ? [
            {
              id: `cit-local-${Date.now()}-2`,
              sourceId: secondSource.id,
              sourceTitle: secondSource.title,
              quote: quoteB,
              contextPassage: secondSource.content.slice(0, 360),
              whyItMatters: `Cria o contraponto dialético com "${secondSource.title}".`,
            },
          ]
        : []),
    ],
    isPinned: false,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Meta-Prompt da Sala de Roteiristas em Áudio (Audio Overview Customizado):
 * Dois consultores seniores revisando o projeto a portas fechadas.
 */
export async function generateWritersRoomDebate(params: {
  sources: SourceItem[];
  focusDirective: string;
  projectTitle: string;
}): Promise<{ turns: DebateTurn[]; audioDataUrl?: string }> {
  const { sources, focusDirective, projectTitle } = params;
  const { activeSources, formattedContext } = buildActiveContextBlock(sources);
  const apiKey = await fetchGeminiApiKeyFromDatabase();

  const metaPrompt = `Não façam um resumo introdutório nem elogiem o material sob hipótese alguma. Assumam o papel de dois consultores seniores de roteiro revisando o projeto "${projectTitle}" a portas fechadas:
- Sofia (Arquiteta Narrativa): busca soluções dramáticas e alternativas estéticas visuais viáveis.
- Marco (Advogado do Diabo & Script Doctor Cético): confronto implacável, amoral e analítico. Não elogia, não perdoa furos de roteiro, lore ou psicologia artificial. Ataca conveniências, exige causa e efeito indubitáveis e expõe a crueza dos fatos baseando-se estritamente nas fontes ativas.
Foco específico solicitado pelo autor: "${focusDirective}"`;

  let turns: DebateTurn[] = [];

  if (apiKey && activeSources.length > 0) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const res = await generateContentWithModelFallback(ai, {
        contents: `${metaPrompt}\n\nFONTES ATIVAS:\n${formattedContext}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                speaker: {
                  type: Type.STRING,
                  enum: ['Sofia (Arquiteta Narrativa)', 'Marco (Advogado do Diabo & Script Doctor Cético)'],
                },
                role: { type: Type.STRING, enum: ['defender', 'critic'] },
                text: { type: Type.STRING },
                actionableTakeaway: { type: Type.STRING },
              },
              required: ['speaker', 'role', 'text', 'actionableTakeaway'],
            },
          },
        },
      });

      const parsed = JSON.parse(res.text || '[]') as Array<Omit<DebateTurn, 'id'>>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        turns = parsed.map((t, i) => ({
          id: `turn-${Date.now()}-${i}`,
          speaker: t.speaker,
          role: t.role,
          text: t.text,
          actionableTakeaway: t.actionableTakeaway,
          citedSourceId: activeSources[i % activeSources.length]?.id,
        }));
      }
    } catch (e) {
      console.warn('Usando roteiro de debate local:', e);
    }
  }

  if (turns.length === 0) {
    const srcA = activeSources[0]?.title || 'Fonte Principal';
    const srcB = activeSources[1]?.title || srcA;
    turns = [
      {
        id: `turn-${Date.now()}-1`,
        speaker: 'Marco (Advogado do Diabo & Script Doctor Cético)',
        role: 'critic',
        text: `Sem rodeios sobre "${focusDirective}": se abrirmos o roteiro com essa contextualização complacente de "${srcA}", a audiência sente o cheiro de conveniência no primeiro minuto. As instituições e pessoas documentadas agem por puro interesse amoral; fingir que o protagonista é puro e desavisado é um furo causal inadmissível. Onde está o choque real?`,
        actionableTakeaway: `Cortar qualquer ingenuidade na abertura e expor o conflito de interesses documentado em "${srcA}".`,
        citedSourceId: activeSources[0]?.id,
      },
      {
        id: `turn-${Date.now()}-2`,
        speaker: 'Sofia (Arquiteta Narrativa)',
        role: 'defender',
        text: `Concordo com a crueza, Marco. Mas se cruzarmos "${srcA}" com "${srcB}" através de uma ação visual crua — sem nenhum diálogo moralista —, a própria contradição física da cena entrega a denúncia sem precisar de pregação.`,
        actionableTakeaway: `Transformar o dado amoral de "${srcB}" em ação cinematográfica sem verniz discursivo.`,
        citedSourceId: activeSources[1]?.id || activeSources[0]?.id,
      },
      {
        id: `turn-${Date.now()}-3`,
        speaker: 'Marco (Advogado do Diabo & Script Doctor Cético)',
        role: 'critic',
        text: `Isso se a escaleta não desmoronar no Ato II. Veja a lacuna em "${srcB}": por que o sistema toleraria essa investigação se o custo de silenciá-la é zero? Se o autor não responder a essa assimetria com uma blindagem lógica perspicaz, o clímax será um castelo de cartas furado.`,
        actionableTakeaway: `Sanar o furo de lore e lógica em "${srcB}" antes de autorizar o avanço para o terceiro ato.`,
        citedSourceId: activeSources[1]?.id || activeSources[0]?.id,
      },
      {
        id: `turn-${Date.now()}-4`,
        speaker: 'Sofia (Arquiteta Narrativa)',
        role: 'defender',
        text: `Exatamente o que precisamos. Usamos a dúvida implacável de Marco como teste de estresse: blindamos a premissa no Midpoint Twist e amarramos a virada documental com citação literal.`,
        actionableTakeaway: `Submeter a virada central ao teste de estresse amoral e factual de "${srcA}".`,
        citedSourceId: activeSources[0]?.id,
      },
    ];
  }

  return { turns };
}

/**
 * Interage dialeticamente com um Insight Card específico,
 * permitindo ao autor aprofundar, questionar ou submeter a ideia a uma lente (ex: Advogado do Diabo).
 */
export async function chatWithCard(params: {
  card: InsightCard;
  message: string;
  lensId?: CreativeLensId;
  sources: SourceItem[];
  projectTitle: string;
  projectLogline: string;
  history?: CardChatMessage[];
  seriesContext?: SeriesContext;
}): Promise<string> {
  const {
    card,
    message,
    lensId = 'devils_advocate',
    sources,
    projectTitle,
    projectLogline,
    history = [],
    seriesContext,
  } = params;

  const { activeSources } = buildActiveContextBlock(sources);
  const seriesMemoryBlock = buildSeriesMemoryBlock(seriesContext);
  const apiKey = await fetchGeminiApiKeyFromDatabase();
  const isDevilsAdvocate = lensId === 'devils_advocate';

  // Anexos do Card (textos, recortes e notas adicionais)
  const textAttachments = (card.attachments || [])
    .filter((a) => a.textContent?.trim())
    .map((a, i) => `  - [Anexo ${i + 1} (${a.type}): "${a.title}"]:\n    "${a.textContent!.trim()}"`)
    .join('\n');

  const cardDetails = [
    `=== INSIGHT CARD EM DEBATE ===`,
    `Título: "${card.title}"`,
    `Conteúdo / Premissa Central: "${card.body}"`,
    card.subtextOrVisualCue ? `Direção Visual / Subtexto: "${card.subtextOrVisualCue}"` : '',
    card.isCanonicalSeriesMemory ? `[STATUS: FIXADO NA MEMÓRIA CANÔNICA DA SÉRIE]` : '',
    card.tags?.length ? `Tags: ${card.tags.map((t) => `#${t}`).join(', ')}` : '',
    card.citations?.length
      ? `Citações Literais de Origem:\n${card.citations.map((c) => `  - "${c.quote}" (Fonte: ${c.sourceTitle})${c.whyItMatters ? ` [Motivo: ${c.whyItMatters}]` : ''}`).join('\n')}`
      : '',
    textAttachments ? `Evidências e Anexos no Card:\n${textAttachments}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // Fontes Ativas formatadas de modo limpo e focado no system instruction
  const sourcesDigest =
    activeSources.length > 0
      ? `=== FONTES DE PESQUISA ATIVAS NO PROJETO ===\n` +
        activeSources
          .map((s, idx) => {
            const isCited = card.citations?.some((c) => c.sourceId === s.id);
            const contentSnippet =
              s.content.length > 5000 && !isCited
                ? s.content.slice(0, 3000) + `\n[... ${s.content.length - 3000} caracteres omitidos para brevidade ...]`
                : s.content;
            return `--- [FONTE ${idx + 1}: "${s.title}" (${s.type})] ---\n${contentSnippet}\n`;
          })
          .join('\n')
      : 'Modo Brainstorm Livre (Sem fontes anexadas ainda).';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const seriesNote = seriesContext
        ? `\nCONTINUIDADE DA SÉRIE: Este episódio pertence à série "${seriesContext.seriesTitle}" (T${seriesContext.seasonNumber || 1}E${seriesContext.episodeNumber || 1}). Respeite integralmente as regras do universo, fatos estabelecidos nos episódios passados e ganchos em aberto.`
        : '';

      const systemInstruction = isDevilsAdvocate
        ? `Você é o ADVOGADO DO DIABO do INSIGHTER — o script doctor e analista narrativo mais incisivo, cético, implacável e amoral que existe.
Sua missão é um CONFRONTO TOTAL, CIRÚRGICO E SEM CONDESCENDÊNCIA sobre o card "${card.title}".

${cardDetails}
${seriesMemoryBlock ? `\n${seriesMemoryBlock}\n` : ''}
${sourcesDigest}

DIRETRIZES DE FERRO DO CONFRONTO IMPLACÁVEL:
1. TOLERÂNCIA ZERO COM CONDESCENDÊNCIA, DIDATISMO OU REPETIÇÃO:
   - É terminantemente proibido soar professoral, benevolente ou didático ("Entendo seu ponto", "É compreensível que", "Veja bem", "Vamos refletir", "Essa ideia tem potencial, porém").
   - NUNCA abra a resposta papagueando ou citando blocos inteiros do autor ("Você propôs: '...'"). Vá direto na garganta da falha.
   - NUNCA use prefixos engessados ou repetitivos como "[Advogado do Diabo — Análise de Desdobramento]". Responda com argumentos vivos e diretos.
   - Trate o autor como um profissional experiente que precisa de rigor cirúrgico, não de afagos ou validações vazias.

2. ADAPTAÇÃO DINÂMICA AO FORMATO REAL DECLARADO PELO AUTOR:
   - ATENÇÃO SUPREMA: Se o autor indicar ou mencionar que o projeto é um DOCUMENTÁRIO, JORNALISMO, CANAL DE YOUTUBE, VÍDEO DE INTERNET, PODCAST ou NEGÓCIO AUDIOVISUAL:
     * NUNCA, SOB HIPÓTESE ALGUMA, invente ou use termos de ficção dramática como "protagonista", "antagonista", "vilão" ou "idiot plot fictício".
     * Ataque a realidade prática do formato: a retenção fria dos primeiros minutos, o algoritmo do YouTube, a Duração Média da Visualização (AVD), o perigo de "bait-and-switch" e promessa vazia que faz a audiência abandonar o vídeo e destrói o canal, a preguiça em achar a tensão da realidade e o autoengano comercial.
     * Confronte diretamente a lógica do negócio e da audiência que o autor acabou de trazer.
   - Se o projeto for expressamente FICÇÃO (filme, série dramática): ataque conveniências de roteiro, coincidências salvadoras, psicologia artificial e soluções fáceis que quebram a suspensão de descrença.

3. CONTINUIDADE CONTEXTUAL RIGOROSA E INTELIGENTE:
   - Mantenha a linha de raciocínio viva ao longo de TODOS os turnos. O turno atual é uma resposta ao que acabou de ser discutido.
   - NUNCA dê respostas genéricas ou desconexas. Se o autor está justificando uma escolha (ex: "é para o YouTube, preciso de audiência"), confronte ESSA escolha específica com argumentos afiados sobre a realidade do YouTube.
   - Não repita argumentos ou fórmulas de turnos anteriores. Avance o debate para o próximo nível de consequência prática.

4. ESTRUTURA DO CONFRONTO:
   - O Ataque ao Ponto Central: Inicie demonstrando exatamente onde o argumento do autor falha na prática.
   - A Realidade Amoral e Prática: O que as forças reais (mercado, algoritmos, psicologia humana crua, instituições) fariam de fato, despindo a cena de qualquer ilusão.
   - O Dilema Inevitável: Termine com uma encruzilhada binária e cortante que encurrale o autor — forçando-o a assumir o custo real ou admitir a fraqueza da solução.${seriesNote}
Projeto: "${projectTitle}" (${projectLogline || 'Sem logline'}).`
        : `Você é um Consultor Sênior de Roteiro e Síntese Criativa do INSIGHTER dialogando em profundidade sobre o Insight Card "${card.title}".

${cardDetails}
${seriesMemoryBlock ? `\n${seriesMemoryBlock}\n` : ''}
${sourcesDigest}

DIRETRIZES DO DEBATE CRIATIVO:
1. MEMÓRIA CONVERSACIONAL INTEGRAL:
   - Mantenha a continuidade absoluta do debate através dos turnos. Lembre-se de todas as ideias, personagens e soluções discutidas anteriormente.
   - Construa sobre o que o autor propôs no último turno. Nunca repita o resumo do card ou volte ao ponto de partida.

2. CINEMATOGRÁFICO ("SHOW, DON'T TELL"):
   - Traduza cada ideia abstrata em ação física de cena, comportamento visual de personagens, subtexto ou tensão espacial.

3. RESPOSTAS DENSAS E ACIONÁVEIS:
   - Seja conciso, cinematográfico, direto e estimulante.${seriesNote}
Projeto: "${projectTitle}" (${projectLogline || 'Sem logline'}).`;

      // Imagens anexadas no card (se houver) para envio multimodal
      const attachmentImageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
      for (const att of card.attachments || []) {
        if (att.dataUrl && att.dataUrl.startsWith('data:')) {
          const commaIdx = att.dataUrl.indexOf(',');
          const header = att.dataUrl.slice(5, commaIdx);
          const mimeType = header.split(';')[0] || 'image/png';
          const base64Data = att.dataUrl.slice(commaIdx + 1);
          if (base64Data) {
            attachmentImageParts.push({
              inlineData: { mimeType, data: base64Data },
            });
          }
        }
      }

      // Filtra estritamente as mensagens rejeitadas pelo autor para inutilizá-las no contexto do Gemini
      const validHistory = history.filter((m) => !m.isRejected);

      // Preserva até 40 mensagens de histórico para garantir que nenhum contexto válido seja perdido
      // (Se histórico passar de 40, mantém os 2 primeiros turnos de fundação + os últimos 38)
      const sanitizedHistory =
        validHistory.length > 40
          ? [...validHistory.slice(0, 2), ...validHistory.slice(-38)]
          : [...validHistory];

      // Monta os turnos de conversa estruturados (roles: 'user' e 'model')
      const multiTurnContents: Array<{
        role: 'user' | 'model';
        parts: Array<
          | { text: string }
          | { inlineData: { mimeType: string; data: string } }
        >;
      }> = [];

      let lastRole: 'user' | 'model' | null = null;
      for (const msg of sanitizedHistory) {
        const role = msg.sender === 'user' ? 'user' : 'model';
        if (role === lastRole) {
          // Se houver dois turnos seguidos do autor (ex: resposta intermediária da IA foi rejeitada/excluída):
          // Adiciona uma ponte de contexto para que a API Gemini mantenha alternância estrita de papéis
          if (role === 'user') {
            multiTurnContents.push({
              role: 'model',
              parts: [{ text: '[O autor descartou a abordagem anterior da IA e reposicionou o debate com uma nova colocação:]' }],
            });
            multiTurnContents.push({
              role: 'user',
              parts: [{ text: msg.text }],
            });
          } else {
            multiTurnContents[multiTurnContents.length - 1].parts.push({ text: msg.text });
          }
        } else {
          multiTurnContents.push({
            role,
            parts: [{ text: msg.text }],
          });
        }
        lastRole = role;
      }

      // Se a lista de conteúdos começar com 'model', insere uma abertura 'user' para manter a alternância
      if (multiTurnContents.length > 0 && multiTurnContents[0].role === 'model') {
        multiTurnContents.unshift({
          role: 'user',
          parts: [{ text: `Iniciando debate crítico sobre o card: "${card.title}".` }],
        });
      }

      // Adiciona o turno atual do usuário ao final da conversa
      const lastTurn = multiTurnContents[multiTurnContents.length - 1];
      if (lastTurn && lastTurn.role === 'user') {
        // Se o último turno do histórico já era do autor, insere uma transição para o novo prompt
        multiTurnContents.push({
          role: 'model',
          parts: [{ text: '[O autor acrescentou o seguinte apontamento para aprofundar a discussão:]' }],
        });
        multiTurnContents.push({
          role: 'user',
          parts: [...attachmentImageParts, { text: message.trim() }],
        });
      } else {
        multiTurnContents.push({
          role: 'user',
          parts: [...attachmentImageParts, { text: message.trim() }],
        });
      }

      const res = await generateContentWithModelFallback(ai, {
        contents: multiTurnContents,
        config: {
          systemInstruction,
          temperature: isDevilsAdvocate ? 0.4 : 0.65,
        },
      });

      if (res.text && res.text.trim()) {
        return res.text.trim();
      }
    } catch (err) {
      console.error('Erro na chamada Gemini chatWithCard:', err);
    }
  }

  // Fallback heurístico inteligente e contextual
  // (Caso a API key não esteja configurada ou ocorra queda de conexão)
  if (isDevilsAdvocate) {
    const isFollowup = history.length >= 2;
    const seriesRef = seriesContext?.seriesTitle
      ? ` Como isso se sustenta contra o que já foi estabelecido na série "${seriesContext.seriesTitle}"? Se esse card contradiz eventos passados ou conveniências do lore, o público rejeitará o episódio imediatamente.`
      : '';

    const lowerMsg = message.toLowerCase();
    const isInternetOrDoc =
      lowerMsg.includes('youtube') ||
      lowerMsg.includes('audiencia') ||
      lowerMsg.includes('audiência') ||
      lowerMsg.includes('streaming') ||
      lowerMsg.includes('documentário') ||
      lowerMsg.includes('documentario') ||
      lowerMsg.includes('canal') ||
      lowerMsg.includes('negócio') ||
      lowerMsg.includes('negocio') ||
      lowerMsg.includes('vídeo') ||
      lowerMsg.includes('video');

    if (isInternetOrDoc) {
      return `Essa desculpa de que "é para o YouTube" é a muleta clássica para mascarar preguiça dramática. Chamar de "concessão necessária" o que na verdade é um bait-and-switch revela falta de confiança na própria matéria-prima. 

O algoritmo do YouTube e o público da internet não são ingênuos: no segundo em que o espectador perceber que a promessa do gancho era um blefe sensacionalista, a retenção despencará e o canal será punido com rejeição brutal e abandono.

Qual é a verdade visceral e indubitável que você vai entregar no clímax que compense o espectador por não ter recebido a fantasia fácil do gancho? Ou você vai continuar apostando que o público aceitará ser enganado?${seriesRef}`;
    }

    if (isFollowup) {
      return `Essa nova saída apenas empurra a conveniência para debaixo do tapete. Se a premissa contornar o obstáculo dessa forma sem resistência proporcional, o argumento parece conspirar a favor por puro favorzinho de autor. Ninguém sob risco real aceitaria essa manobra sem reagir com força desproporcional.

Qual é a perda concreta, irreversível e dolorosa que precisa ser paga para que esse movimento não soe gratuito? O que racha de vez nessa estrutura se você for honesto com a realidade dos fatos?${seriesRef}`;
    }

    return `A premissa sobre "${card.title}" parte de um pressuposto frouxo: de que as forças ao redor agirão com complacência ou passividade. Isso não é drama nem impacto factual; é conveniência. Se despirmos a cena de wishful thinking e aplicarmos os incentivos amorais de autopreservação, a reação lógica seria estancar o risco e esmagar a brecha imediatamente.

Como você sustenta esse conflito se as forças contrárias agirem com a inteligência e a crueldade implacável que a situação real exige?${seriesRef}`;
  } else {
    const isFollowup = history.length >= 2;
    const seriesRef = seriesContext?.seriesTitle
      ? ` Certifique-se de que a resolução ressoe com o arco acumulado na série "${seriesContext.seriesTitle}".`
      : '';

    if (isFollowup) {
      return `Ao seguir por "${message.trim()}": essa decisão ganha força se você amarrar a consequência em um elemento físico e visível do cenário. Mostre a mudança de comportamento antes de qualquer explicação verbal.${seriesRef}`;
    }

    return `Ao desdobrar "${card.title}", a chave é transformar esse dilema abstrato em ação física no cenário. Em vez de verbalizar o conflito em explicações, coloque a situação onde a única escolha de sobrevivência revele sua contradição interna sem que nenhuma palavra seja dita.${seriesRef}`;
  }
}
