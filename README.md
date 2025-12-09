# Financial Planner & Simulator (Finanças 2025)

> **Status:** Fase 3 Concluída (Simulação & ETL Robusto) | **Próximo:** Fase 4 (AI Categorization & MLOps)

Uma plataforma *Full-Stack* de Planejamento Financeiro Pessoal projetada para ir além do rastreamento de despesas. O sistema combina um pipeline ETL resiliente para ingestão de dados bancários (foco em XP/Itaú) com um motor de simulação estocástica para projeção de fluxo de caixa (Baseline + Cenários).

---

## 🚀 Arquitetura e Tech Stack

### Backend (`/backend`)
* **Core:** Python 3.11+, **FastAPI** (Async).
* **ORM & Data:** **SQLAlchemy 2.0** (AsyncSession), **Pydantic v2** (Strict Schemas & Validators).
* **Database:** PostgreSQL 15 (via Docker).
* **ETL Engine:** **Pandas** para processamento vetorial de CSVs "ragged" (desestruturados) e normalização de dados bancários.
* **Migrations:** Alembic.

### Frontend (`/frontend`)
* **Framework:** **React 18** + **Vite**.
* **Language:** TypeScript (Strict Mode).
* **Styling:** **Tailwind CSS v4**, `clsx`, `tailwind-merge`.
* **UI Components:** **Shadcn/UI** (Radix Primitives), Lucide React.
* **State & Data Fetching:** **TanStack Query** (React Query v5), **TanStack Table**.
* **Visualization:** Recharts.

### Infraestrutura
* **Containerização:** Docker & Docker Compose (Hot-reload habilitado para DX).

---

## 🌟 Funcionalidades Chave (Entregas Recentes)

### 1. Motor de Simulação e Cenários ("What-If")
Diferente de apps tradicionais, o sistema opera em três camadas temporais:
* **Camada 0 (Realizado/Past):** Transações importadas e conciliadas.
* **Camada 1 (Baseline/Contracted):** Projeção automática de **Transações Recorrentes** (Salários, Aluguéis com vigência definida) e **Parcelamentos Ativos** (ex: Restante de compras parceladas no cartão).
* **Camada 2 (Cenários/Hypothetical):** Overlay de eventos simulados (ex: "Compra de Carro", "Viagem") que não afetam o banco de dados principal até serem efetivados.
    * *Feature:* Grid interativo estilo Excel para edição "in-loco" de projeções mensais.

### 2. ETL e Ingestão de Dados Avançada
* **Estratégia "Sandwich Parsing":** Algoritmo capaz de ler faturas de cartão e extratos bancários (XP/Itaú) detectando cabeçalhos dinâmicos.
* **Smart Polarity:** Validadores Pydantic globais garantem consistência matemática:
    * `Type: EXPENSE` → Força valor negativo no DB.
    * `Type: INCOME` → Força valor positivo.
* **Auto-Reconciliation:** Lógica de conciliação assistida. Ao importar um extrato, o sistema detecta transações manuais (previsões) que coincidem com o realizado (mesmo valor/data próxima) e sugere a substituição para evitar duplicidade.
* **Source Awareness:** Segregação estrita entre **Credit** (XP Card - Passivo) e **Debit** (XP Account - Ativo) para auditoria fiel ao Bank App.

### 3. Gestão Financeira "Pro"
* **Regime de Competência vs. Caixa:** Suporte a datas de referência (`reference_date`) para alocar faturas de cartão no mês fiscal correto, independente da data da compra.
* **Transações Recorrentes Inteligentes:** Suporte a contratos finitos (`start_date` e `end_date`), permitindo que aluguéis ou financiamentos expirem automaticamente na simulação.

---

## 🛠️ Instalação e Execução

### Pré-requisitos
* Docker & Docker Compose.
* (Opcional) Python 3.11+ e Node 20+ para desenvolvimento local fora do container.

### Rodando o Projeto
```bash
# 1. Clone o repositório
git clone [https://github.com/seu-usuario/finances-2025.git](https://github.com/seu-usuario/finances-2025.git)
cd finances-2025

# 2. Suba os containers (Build inicial pode demorar alguns minutos)
docker compose up -d --build

# 3. Acesse a Aplicação
# Frontend: http://localhost:5173
# Backend Docs: http://localhost:8000/docs