# Insighter — Estúdio de Síntese Cruzada & Brainstorming para Roteiros

O **Insighter** é um aplicativo de brainstorming livre em tela cheia para roteiristas, inspirado nas técnicas avançadas de **síntese cruzada do NotebookLM** com motor **Google Gemini API (`@google/genai`)** e banco de dados **Supabase** configurado via `.env` / Docker.

## Principais Recursos
- **Modo Híbrido (Canvas Espacial Livre ↔ Visão de Escaleta/Roteiro):** Arraste, conecte e cruze cards de ideias no espaço livre ou estruture nos blocos da escaleta (*Gancho 0–30s*, *Ato I*, *Ato II*, *Virada Central*, *Ato III*) com exportação em `.md` e `.fountain`.
- **Context Mixer (Curadoria Estratégica de Fontes):** Ligue/desligue quais fontes (PDFs, transcrições do YouTube, rascunhos de roteiro, bíblias de universo) participam de cada provocação criativa.
- **6 Lentes Criativas de Roteiro (1-Click):**
  - 🎣 **Engenharia de Gancho (30s):** *Expectativa do Senso Comum vs. Realidade Documentada*
  - 🎬 **Dados → Cena Visual (*Show, Don't Tell*):** Traduz dados densos em cena visual de 1 min sem *infodumping*
  - ⚡ **Conflito & Subtexto:** Onde o discurso público contradiz ações documentadas
  - 🕸️ **Conexões Ocultas & Blind Spots:** Padrões ocultos e lacunas ignoradas pelos autores
  - 🧭 **Supervisor de Continuidade & Lore:** Confronta rascunho de roteiro com regras do mundo
  - 🔥 **Advogado do Diabo & Cortes Cirúrgicos:** Ataca premissas frágeis e sugere viradas de perspectiva
- **Fluxo de Destilação (*Notas → Novas Fontes*):** Selecione múltiplos cards no Canvas e converta suas próprias descobertas em uma nova Fonte ativa para iterar em camadas.
- **Auditoria por Citações Clicáveis:** Cada card exibe citações clicáveis (`[1]`, `[2]`) que abrem o trecho original exato na lateral.
- **Sala de Roteiristas em Áudio (*Multi-Speaker Debate*):** Dois consultores seniores (*Sofia, Arquiteta Narrativa* vs. *Marco, Script Doctor Cético*) debatem seu projeto a portas fechadas.
- **Estética "Estúdio Noturno Acolhedor" (*Warm Dark*):** Paleta de baixa fadiga visual (`#161514` carvão quente, `#E6E1DA` papel creme, acentos âmbar e verde-sálvia).

---

## Configuração via `.env` e Docker (Sem Supabase CLI)

1. Edite o arquivo `.env` na raiz do projeto com as credenciais do seu **Painel Web do Supabase** e a sua chave da **Gemini API**:
   ```env
   VITE_GEMINI_API_KEY=sua_chave_gemini_aqui
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=sua_anon_key_aqui
   ```
2. No **Painel Web do Supabase** (`SQL Editor`), cole e execute o script [`supabase/schema.sql`](./supabase/schema.sql) para criar as tabelas do projeto.
3. Para rodar via Docker:
   ```bash
   docker compose up --build -d
   ```
4. Ou para rodar diretamente no ambiente local:
   ```bash
   npm run dev
   ```

## Conectando à sua Nova Conta do GitHub

O repositório Git local já está inicializado e com commit pronto na branch `main`. Quando criar o repositório na sua nova conta do GitHub, basta rodar:

```bash
git remote add origin https://github.com/SUA_NOVA_CONTA/insighter.git
git branch -M main
git push -u origin main
```
