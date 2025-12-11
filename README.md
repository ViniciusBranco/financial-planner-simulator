# Financial Planner & Simulator (Finanças 2025)

> **Status:** Fase 4 Concluída (AI Categorization, RAG Memory & Premium UI) | **Próximo:** Fase 5 (Budgeting & Analytics)

Uma plataforma *Full-Stack* de Planejamento Financeiro Pessoal ("Enterprise-Grade for Personal Use"). O sistema transcende o rastreamento passivo de despesas, integrando um pipeline ETL resiliente, um motor de simulação estocástica e **Classificação Automática via IA Generativa Local** (RAG + LLM).

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

## 🚀 Arquitetura e Tech Stack

### Backend (`/backend`)
* **Core:** Python 3.11+, **FastAPI** (Async).
* **AI & MLOps:** **LangChain** + **Ollama** (Qwen 2.5:7b) para inferência local.
* **RAG Engine:** **RapidFuzz** para recuperação de contexto histórico (Similaridade Semântica + Numérica).
* **ORM & Data:** **SQLAlchemy 2.0** (AsyncSession), **Pydantic v2**.
* **Database:** PostgreSQL 15.
* **ETL Engine:** **Pandas** com lógica vetorial para parsing de CSVs complexos.

### Frontend (`/frontend`)
* **Framework:** **React 18** + **Vite**.
* **Language:** TypeScript (Strict Mode).
* **Styling:** **Tailwind CSS v4**, `clsx`, `tailwind-merge`.
* **UI Components:** **Shadcn/UI**, **TanStack Table** (Headless UI).
* **State:** **TanStack Query** (React Query v5).
* **Visualization:** Recharts.

---

## 🌟 Funcionalidades Chave (Entregas Recentes)

### 1. AI Auto-Categorization (Local LLM + RAG)
O sistema organiza suas finanças automaticamente usando Inteligência Artificial rodando 100% localmente (Privacidade Total):
* **RAG Híbrido (Texto + Valor):** A IA consulta seu histórico de transações **Verificadas**. Ela aprende não apenas com a descrição (ex: "Bsys"), mas com o valor (ex: diferenciar "Salário" de "Reembolso" baseado na faixa de valor histórica).
* **Smart Batching:** Processamento em lotes de 100 transações para otimizar o uso da GPU (GTX 1060).
* **Human-in-the-Loop:** Sistema de flag `is_verified`. A IA nunca sobrescreve o que você corrigiu manualmente. O que você corrige torna-se "exemplo canônico" para o aprendizado futuro da IA.
* **Taxonomia Estrita:** Distinção semântica entre **"Salário"** (Payroll explícito) e **"Receita"** (Inflows gerais).

### 2. Motor de Simulação e Cenários ("What-If")
Arquitetura de camadas temporais para planejamento:
* **Camada 0 (Realizado):** Transações reais importadas e conciliadas.
* **Camada 1 (Baseline):** Projeção automática de contratos vigentes e parcelamentos ativos.
* **Camada 2 (Cenários):** Overlay de eventos simulados (ex: "Compra de Carro") que persistem no banco sem afetar a contabilidade real.

### 3. UX "Premium" & Data Refining
Interface focada em produtividade e estabilidade:
* **Tabela Estável:** Container com *Sticky Headers* e rolagem virtual (elimina "layout shift").
* **Smart Editing:** Input de Categoria com "Type-ahead" e toggle para seleção rápida.
* **Sorting Unificado:** Ordenação no Backend (`func.coalesce`) garantindo consistência entre tags manuais e categorias vinculadas.
* **AI Manager:** Painel dedicado para rodar categorização em massa por competência (Mês/Ano).

### 4. ETL e Ingestão Avançada
* **Sandwich Parsing:** Leitura de faturas de cartão e extratos bancários com detecção de cabeçalhos dinâmicos.
* **Auto-Reconciliation (Assistida):** Detecção de duplicatas entre Planejado (Manual) vs Realizado (Extrato) com sugestão de substituição via UI.
* **Source Awareness:** Segregação visual entre **Credit** (Passivo/Vermelho) e **Debit** (Ativo/Verde).

---

## 🛠️ Instalação e Execução

### Pré-requisitos
* Docker & Docker Compose.
* **Ollama** instalado no Host (Windows/Linux/Mac).
* Modelo Qwen baixado: `ollama pull qwen2.5:7b`

### Rodando o Projeto
```bash
# 1. Clone o repositório
git clone [https://github.com/seu-usuario/finances-2025.git](https://github.com/seu-usuario/finances-2025.git)
cd finances-2025

# 2. Suba os containers
docker compose up -d --build

# 3. Acesse a Aplicação
# Frontend: http://localhost:5173
# Backend Docs: http://localhost:8000/docs
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

- [x] AI Categorizer: Implementado (RAG + Qwen 2.5).

- [ ] Budgeting: Definição de tetos de gastos e alertas de desvio.

- [ ] Analytics Avançado: Breakdown de gastos por fornecedor e evolução anual.

---

## 📄 Licença

Proprietário: Vinicius Branco. Projeto de uso pessoal e portfólio de arquitetura de software.