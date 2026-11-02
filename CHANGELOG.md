# 📜 Changelog — Insighter

Todas as notas de atualização, correções e novidades de cada versão do Insighter.

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
