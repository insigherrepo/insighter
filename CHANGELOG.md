# 📜 Changelog — Insighter

Todas as notas de atualização, correções e novidades de cada versão do Insighter.

---

## [0.1.5] - 2026-11-03

### 🎓 Novo Formato: Aula / Masterclass Didática
- **Formato dedicado para instrutores e criadores de conteúdo**: Adicionada a opção `🎓 Aula / Masterclass` no Studio Dashboard com formulário de contexto pedagógico estruturado.
- **Configuração pedagógica customizada**: Definição de nível de proficiência (*Iniciante*, *Intermediário*, *Avançado*), formato didático (*Masterclass Intensiva / Deep Dive*, *Workshop Prático Mão na Massa*, *Módulo de Trilha*), público-alvo específico e objetivo central de aprendizagem.
- **Jornada de Ensino Ativo no Canvas**: Geração automática de 5 blocos pedagógicos interconectados por fios de síntese narrativa:
  1. `🎯 01. Gancho de Abertura & Problema Real` (A dor concreta e a promessa transformadora)
  2. `🧠 02. Princípio Raiz & Modelo Mental` (Fundamentação teórica desmistificada sem jargões)
  3. `🔬 03. Demonstração Prática & Estudo de Caso` (Aplicação passo a passo no mundo real)
  4. `⚠️ 04. Armadilhas Comuns & Ponto Cego` (Os 3 erros clássicos e como se blindar)
  5. `⚡ 05. Exercício Prático & Plano de Ação` (Desafio imediato de fixação e checklist)
- **Fonte Ativa de Diretrizes Pedagógicas**: O briefing pedagógico preenchido é compilado automaticamente como Fonte Ativa no Context Mixer, servindo de guia para o Gemini nas lentes criativas.
- **Escaleta Didática no ScriptBeatView**: Visualização com badges e cabeçalho didático (`01 · GANCHO & PROBLEMA REAL`, `02 · FUNDAMENTAÇÃO`, etc.) e estimativas dinâmicas de tempo por etapa.

---

## [0.1.4] - 2026-11-02

### 📐 Layout & Correção de Sobreposição no Canvas
- **Fim da sobreposição de barras no topo**: Implementação do container flexível empilhado `.canvas-top-floating-stack`, que organiza verticalmente e centraliza no topo da tela todas as barras de ação ativas.
- **Convivência harmônica de estados**: A barra de status do Modo Investigativo e a barra de ações de seleção de cards (Ultrafoco, Destilação, Agrupamento e Cruzamento) não se sobrepõem mais quando um card é clicado durante uma investigação.
- **Empilhamento limpo**: Banners de conexão de fios, modo reunião ao vivo, modo investigativo e seleção de cards agora se empilham de forma elegante com espaçamento de 10px e sem bloquear cliques no canvas.

---

## [0.1.3] - 2026-11-02

### ⚡ Atualizações na Inicialização com Autorização Prévia
- **Checagem automática ao abrir o app**: O Insighter agora consulta o repositório oficial (`insigherrepo/insighter`) logo na inicialização para detectar novas versões.
- **Autorização obrigatória do usuário**: O download da atualização não começa de forma silenciosa ou arbitrária. Uma interface dedicada apresenta o resumo das novidades da versão e aguarda a autorização expressa do usuário ("Autorizar e Atualizar Agora").
- **Acompanhamento de progresso**: Barra de download em tempo real (0% a 100%) e status transparente de extração e reinicialização.
- **Opção de adiar**: Botão "Lembrar Mais Tarde" para que o usuário decida atualizar no momento mais oportuno sem interrupções.

---

## [0.1.2] - 2026-11-02

### 💬 Debate com IA & Rolagem no Ultrafoco
- **Desbloqueio de rolagem do chat**: Correção da trava que impedia a rolagem vertical da conversa no painel inferior do modo Ultrafoco. Eventos de scroll (`wheel` e gestos no trackpad) agora são preservados nativamente dentro do container.
- **Ajuste estrutural de Flexbox**: Aplicação de `min-height: 0` e `overflow-y: auto` no corpo de mensagens (`.ultrafocus-bottom-chat-body`), permitindo rolagem fluida e barra de rolagem visível e interativa.
- **Auto-scroll para o fim do debate**: O histórico da conversa agora desliza suavemente até a mensagem mais recente de forma automática ao receber respostas da IA ou ao enviar uma nova pergunta.

---

## [0.1.1] - 2026-11-02

### 🎯 Modo Investigativo & Navegação Espacial
- **Foco estrito no card ativo**: O Modo Investigativo agora respeita com precisão o card atualmente selecionado, focado ou interagido pelo usuário, eliminando a regressão que forçava a navegação de volta para o primeiro card (`card[0]`).
- **Detecção geométrica inteligente**: Quando nenhum card está explicitamente selecionado, o foco é calculado a partir do card mais próximo do centro do campo de visão atual da tela (`viewport`), evitando deslocamentos bruscos de tela.
- **Transições suaves**: Verificação de proximidade para evitar re-animações de pan desnecessárias quando o card já se encontra centralizado no visor.

### 💬 Debate com IA & Sala de Roteiristas
- **Chat na base da tela (Cápsula de Chatbot Moderno)**: O debate com o Advogado do Diabo e as lentes criativas agora fica posicionado na parte inferior do modo Ultrafoco, proporcionando uma experiência de conversação natural e desobstruída.
- **Histórico persistente & Gestão de turnos**: Suporte a debates prolongados (turnos 4, 5, 6+) sem perda de contexto ou alucinações, com ações rápidas para rejeitar respostas, reabilitar ou reiniciar o diálogo.

### 📐 Persistência & Colaboração em Reunião
- **Gravação de Viewport**: A posição de pan (`x`, `y`) e a escala de zoom do Canvas são salvas automaticamente ao fechar ou alternar entre brainstorms, reabrindo exatamente no mesmo estado visual.
- **Modo Reunião ao Vivo**: Capacidade de espelhar em tempo real a tela e navegação do moderador para outros colaboradores via canais Supabase Realtime.

### 🗑️ Gestão de Projetos & Lixeira
- **Exclusão segura em duas etapas**: Projetos excluídos são movidos para uma Lixeira dedicada com contadores visuais, permitindo restauração instantânea ou exclusão permanente.
- **Selo de Demonstração (Demo)**: Brainstorms de exemplo guiado recebem uma badge destacada indicando sua natureza pedagógica.

### ⚡ Infraestrutura & Auto-Update
- **Repositório oficial de updates**: Configuração para distribuição automática via GitHub Releases em `insigherrepo/insighter`.
- **Compilação isolada para macOS**: Geração do binário de release sem sobrescrever a instalação local, viabilizando testes reais de auto-update.

---

## [0.1.0] - 2026-11-02

### 🚀 Lançamento Inicial
- **Canvas Infinito & Livre**: Manipulação livre de cartões de ideias, sequências e premissas narrativas com zoom e pan de alta performance.
- **Conexões Arrastáveis**: Linhas curvas em spline com portas de conexão (`top`, `bottom`, `left`, `right`) para encadear relacionamentos de causa e efeito.
- **Context Mixer (Estilo NotebookLM)**: Isolamento rigoroso de fontes ativas (`isActive`) para ancorar as análises da IA sem vazamento de premissas não autorizadas.
- **6 Lenses Criativas**: Advogado do Diabo, Arquiteto de Beats, Detetive de Premissas, Catalisador de Emoções, etc.
- **Suporte Multimodal**: Upload e visualização de recortes de imagem, áudio e vídeo com player nativo integrado aos cards.
- **Pacote macOS Apple Silicon**: Distribuição assinável para processadores M-Series com ícone customizado de alta resolução e atalhos na barra de status.
