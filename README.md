# Financial Planner & Simulator (Finanças 2025)

> Status: Fase 4 Em Progresso (AI Categorization, MLOps & UI Polish)
> 

Uma plataforma *Full-Stack* de Planejamento Financeiro Pessoal ("Enterprise-Grade for Personal Use"). O sistema transcende o rastreamento passivo de despesas, integrando um pipeline ETL resiliente para dados bancários brasileiros (XP/Itaú), um motor de simulação estocástica e classificação automática via IA Generativa Local (Ollama/Qwen).

---

## 🚀 Arquitetura e Tech Stack

### Backend (`/backend`)

- **Core:** Python 3.11+, **FastAPI** (Async).
- **ORM & Data:** **SQLAlchemy 2.0** (AsyncSession), **Pydantic v2** (Strict Schemas & Validators).
- **Database:** PostgreSQL 15 (via Docker).
- **AI & ML:** **LangChain** + **Ollama** (Qwen 2.5:7b) para classificação semântica de transações.
- **ETL Engine:** **Pandas** com lógica vetorial para parsing de CSVs "ragged" e detecção de layouts.
- **Migrations:** Alembic.

### Frontend (`/frontend`)

- **Framework:** **React 18** + **Vite**.
- **Language:** TypeScript (Strict Mode).
- **Styling:** **Tailwind CSS v4** (Utility-first), `clsx`, `tailwind-merge`.
- **UI Components:** **Shadcn/UI**, **TanStack Table** (Headless UI), Lucide React.
- **State & Data Fetching:** **TanStack Query** (React Query v5).
- **Visualization:** Recharts.

### Infraestrutura

- **Containerização:** Docker & Docker Compose (Hot-reload habilitado para DX).

---

## 🌟 Funcionalidades Chave

### 1. AI Auto-Categorization & MLOps

O sistema utiliza um LLM local para organizar suas finanças automaticamente:

- **Processamento em Lote:** Otimização para categorizar até 100 transações por request, garantindo performance mesmo em GPUs locais (GTX 1060).
- **Taxonomia Inteligente:** Distinção semântica estrita entre **"Salário"** (Payroll explícito) e **"Receita"** (Inflows gerais/Pix), evitando falsos positivos em entradas de caixa.
- **Backfill:** Ferramenta para varrer o histórico e categorizar transações passadas ("Uncategorized") sob demanda.

### 2. Motor de Simulação e Cenários ("What-If")

Arquitetura de camadas temporais para planejamento financeiro:

- **Camada 0 (Realizado):** Transações reais importadas e conciliadas.
- **Camada 1 (Baseline):** Projeção automática de contratos vigentes (Aluguéis, Assinaturas) e Parcelamentos Ativos.
- **Camada 2 (Cenários):** Overlay de eventos simulados (ex: "Compra de Carro") que persistem no banco sem afetar a contabilidade real.

### 3. UX de Transações Premium (Data Refining)

Interface focada em produtividade e estabilidade visual:

- **Tabela Estável:** Container de altura fixa com *Sticky Headers* e rolagem vertical interna (elimina "layout shift" ao filtrar). Colunas com larguras responsivas (sem scroll horizontal desnecessário).
- **Smart Editing:** Componente de Input de Categoria customizado com "Type-ahead" e toggle (Chevron) para seleção rápida ou entrada manual.
- **Sorting Robusto:** Ordenação unificada no Backend (`func.coalesce`) garantindo que categorias vinculadas e tags manuais sejam ordenadas logicamente.
- **Toolbar Unificada:** Barra de ferramentas responsiva integrando Busca, Navegação Temporal e Filtros de Tipo.

### 4. ETL e Ingestão Avançada

- **Sandwich Parsing:** Leitura de faturas de cartão e extratos bancários com detecção de cabeçalhos dinâmicos.
- **Auto-Reconciliation (Assistida):** Detecção de duplicatas entre Planejado (Manual) vs Realizado (Extrato) com sugestão de substituição via UI.
- **Source Awareness:** Segregação visual e lógica entre **Credit** (Passivo/Vermelho) e **Debit** (Ativo/Verde).

---

## 🛠️ Instalação e Execução

### Pré-requisitos

- Docker & Docker Compose.
- Ollama instalado no Host (para funcionalidade de IA).

### Rodando o Projeto

```bash
# 1. Clone o repositório
git clone [<https://github.com/seu-usuario/finances-2025.git>](<https://github.com/seu-usuario/finances-2025.git>)
cd finances-2025

# 2. Suba os containers
docker compose up -d --build

# 3. Acesse a Aplicação
# Frontend: <http://localhost:5173>
# Backend Docs: <http://localhost:8000/docs>
```

### Comandos Úteis

```bash
# Resetar Banco de Dados (Ambiente Dev - CUIDADO)
docker compose exec db psql -U postgres -d finances -c "TRUNCATE TABLE transactions, recurring_transactions, scenarios, scenario_items RESTART IDENTITY CASCADE;"

# Seed de Categorias Iniciais
docker compose exec backend python -m app.etl.seed_categories
```

---

## 🔮 Roadmap

- [x]  **AI Categorizer:** Implementado (LangChain + Ollama). Foco agora em refinamento de prompt.
- [ ]  **Budgeting:** Módulo para definir tetos de gastos por categoria e comparar Realizado vs. Previsto.
- [ ]  **Detecção de Anomalias:** Alertas para gastos que fogem do desvio padrão histórico.

---

## 📄 Licença

Proprietário: Vinicius Branco. Projeto de uso pessoal e portfólio de arquitetura de software.