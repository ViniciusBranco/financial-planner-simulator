# Financial Planner & Simulator (Finanças 2025)

> **Status:** Fase 3 Concluída (Simulação Avançada & ETL Robusto) | **Próximo:** Fase 4 (AI Categorization & MLOps)

Uma plataforma *Full-Stack* de Planejamento Financeiro Pessoal ("Enterprise-Grade for Personal Use"). O sistema transcende o rastreamento passivo de despesas, integrando um pipeline ETL resiliente para dados bancários brasileiros (XP/Itaú) com um motor de simulação estocástica para projeção de fluxo de caixa (Baseline + Cenários).

---

## 🚀 Arquitetura e Tech Stack

### Backend (`/backend`)
* **Core:** Python 3.11+, **FastAPI** (Async).
* **ORM & Data:** **SQLAlchemy 2.0** (AsyncSession), **Pydantic v2** (Strict Schemas & Validators).
* **Database:** PostgreSQL 15 (via Docker).
* **ETL Engine:** **Pandas** com lógica vetorial para parsing de CSVs "ragged" (desestruturados) e detecção de layouts bancários (XP Card vs Account).
* **Migrations:** Alembic.

### Frontend (`/frontend`)
* **Framework:** **React 18** + **Vite**.
* **Language:** TypeScript (Strict Mode).
* **Styling:** **Tailwind CSS v4** (Utility-first), `clsx`, `tailwind-merge`.
* **UI Components:** **Shadcn/UI** (Radix Primitives), Lucide React.
* **State & Data Fetching:** **TanStack Query** (React Query v5), **TanStack Table**.
* **Visualization:** Recharts (Gráficos financeiros).

### Infraestrutura
* **Containerização:** Docker & Docker Compose (Hot-reload habilitado para DX).

---

## 🌟 Funcionalidades Chave (Entregas Recentes)

### 1. Motor de Simulação e Cenários ("What-If")
Arquitetura de camadas temporais para planejamento financeiro:
* **Camada 0 (Realizado/Past):** Transações reais importadas e conciliadas.
* **Camada 1 (Baseline/Contracted):** Projeção automática de **Transações Recorrentes** (Salários, Aluguéis com vigência `start`/`end_date`) e **Parcelamentos Ativos** (projeção do restante de compras parceladas).
* **Camada 2 (Cenários/Hypothetical):** Overlay de eventos simulados (ex: "Compra de Carro", "Viagem") que persistem no banco (`scenarios` table) mas não afetam a contabilidade real.
    * *Feature:* Grid interativo (estilo Excel) com suporte a edição "in-loco" e cálculo de saldo acumulado em tempo real.

### 2. ETL e Ingestão de Dados Avançada
* **Estratégia "Sandwich Parsing":** Algoritmo capaz de ler faturas de cartão e extratos bancários detectando cabeçalhos dinâmicos e ignorando lixo.
* **Smart Polarity:** Validadores globais garantem consistência matemática:
    * `Type: EXPENSE` → Força armazenamento negativo.
    * `Type: INCOME` → Força armazenamento positivo.
* **Auto-Reconciliation (Assistida):** Ao importar um extrato, o sistema detecta transações manuais (previsões) que coincidem com o realizado (mesmo valor/data) e sugere a substituição via UI, eliminando duplicidade sem deletar dados silenciosamente.
* **Source Awareness:** Segregação estrita entre **Credit** (XP Card - Passivo) e **Debit** (XP Account - Ativo) para auditoria fiel ao App do banco.

### 3. Gestão Financeira "Pro"
* **Regime de Competência vs. Caixa:** Suporte a `reference_date` para alocar faturas de cartão no mês fiscal correto, independente da data da compra.
* **Navegação Temporal:** Dashboard e Histórico com seletores dinâmicos de Ano (Passado/Futuro) e navegação rápida entre meses.
* **Auditoria:** Tabela de Transações com "Soma Dinâmica" (Total Listado) para validação cruzada com faturas bancárias.

---

## 🛠️ Instalação e Execução

### Pré-requisitos
* Docker & Docker Compose.

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
```

### Comandos Úteis (Manutenção)

```bash
# Gerar nova migration (após alterar models)
docker compose exec backend alembic revision --autogenerate -m "descricao_mudanca"

# Aplicar migrations
docker compose exec backend alembic upgrade head

# Resetar Banco de Dados (Ambiente Dev - CUIDADO)
docker compose exec db psql -U postgres -d finances -c "TRUNCATE TABLE transactions, recurring_transactions, scenarios, scenario_items RESTART IDENTITY CASCADE;"
```

---

## 🔮 Roadmap: A Próxima Fronteira (AI & MLOps)

O foco agora muda para inteligência preditiva e automação de classificação.

- [ ]  **AI Categorizer (Prioridade):** Micro-serviço de ML para classificar transações automaticamente (`manual_tag` -> `Category`) usando Random Forest ou Embeddings leves.
    - *Objetivo:* Permitir inferência estatística (Mediana de gastos com Uber/iFood) para preencher a Simulação automaticamente.
- [ ]  **Detecção de Anomalias:** Alertas para desvios de padrão em contas de consumo.
- [ ]  **Orçamento Dinâmico:** Comparação Realizado vs. Previsto (Baseline) no Dashboard.

---

## 📄 Licença

Proprietário: Vinicius Branco. Projeto de uso pessoal e portfólio de arquitetura de software.