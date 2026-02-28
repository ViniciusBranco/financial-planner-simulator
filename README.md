# Financial Planner & Simulator (Finanças 2025-2026)

> **Status:** Fase 5 Iniciada (Budgeting & Strategy Transition) | **Data:** 02/01/2026

Plataforma *Full-Stack* de Planejamento Financeiro focada em transição de estratégia (Scenario 1 para Scenario 2). Integra um pipeline ETL resiliente, motor de simulação pivotado e **IA Generativa Local** com memória seletiva.

---

## 🚀 Arquitetura e Tech Stack

### Backend (`/backend`)
* **Core:** Python 3.12+, **FastAPI** (Async) com **Poetry**.
* **AI & MLOps:** **LangChain 1.0+** + **LangGraph 1.0+**.
* **Data Engine**: **Polars** (High-performance OLAP processing).
* **ORM & Data:** **SQLAlchemy 2.0** (AsyncSession), **Pydantic v2** (Strict Mode).
* **Database:** PostgreSQL 18.
* **Infrastructure**: Docker Compose & Cloudflare Tunnels.

### Frontend (`/frontend`)
* **Framework:** **React 19** + **Vite**.
* **Styling:** **Tailwind CSS v4**.
* **State:** **TanStack Query** (React Query v5).

---

## 🌟 Histórico de Funcionalidades Chave

### Fase 1 a 3: Fundação e ETL
* Pipeline de ingestão para XP Card (Crédito) e XP Account (Débito).
* Motor de simulação determinístico com camadas de realizado vs. planejado.
* Sistema de reconciliação assistida e detecção de duplicatas.

### Fase 4: Inteligência Artificial & UX Premium
* **AI Auto-Categorization:** Implementação de RAG local com Qwen 2.5.
* **Human-in-the-Loop:** Flag `is_verified` para proteger categorização manual e treinar a IA com dados canônicos.
* **Taxonomia Refinada:** Divisão granular de Alimentação em (Mercado, Restaurante, Delivery).

---

## 🚩 Marcos Recentes (Janeiro 2026)

### 1. Gestão de Estratégia Financeira
* **Financial Health Widget:** Monitoramento de Liquidez vs. Passivo (Liability) para transição de estratégia:
  * **Estratégia 1:** Receber para pagar o gasto passado (Déficit de capital de giro).
  * **Estratégia 2:** Receber para pagar o futuro (Excesso de capital de giro).
* **Pay Invoice Flow:** Fluxo atômico de transferência entre contas para liquidação de faturas e atualização de saúde financeira.

### 2. Motor de Simulação Inteligente (Pivot Mode)
* **Historical Burn Rate Projection:** Endpoint de analytics que calcula a média e mediana de gastos dos últimos 12 meses para projetar o "lifestyle" futuro.
* **Pivot Table UI:** Agrupamento inteligente de `ScenarioItems` por descrição, permitindo visualizar e editar projeções anuais em uma única linha (estilo planilha).
* **Integridade de Polaridade:** Garantia de sinal negativo para despesas em simulações, evitando distorções no *Cumulative Balance*.

### 3. Governança de Dados
* **Batch Delete Manager:** Exclusão cirúrgica de transações por competência e fonte.
* **Review Mode:** Filtro de interface para auditoria rápida de sugestões da IA (`is_verified=False`).
* **Date-Reference Sync:** Correção automática do mês de competência ao editar datas de transações manuais.

---

## 🛠️ Instalação e Execução

### Pré-requisitos
* Docker & Docker Compose.
* **Ollama** com modelo: `ollama pull qwen2.5:7b`

### Rodando o Projeto
```bash
docker compose up -d --build
```

🔮 Roadmap
[x] Smart Simulation: Projeção baseada em média histórica.

[ ] Budgeting Targets: Definição de metas de economia por categoria.

[ ] Investments Tracking: Integração de saldo de corretora para cálculo de patrimônio total líquido.