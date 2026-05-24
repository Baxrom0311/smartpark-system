# AI Agent Orchestrator Template

Kiro (Opus 4.7) bilan avtomatik loyiha qurish uchun shablon.

## Arxitektura

| Agent | Rol | Model | Fayl |
|-------|-----|-------|------|
| ai-planner | Planner + Replanner | claude-opus-4.7 | `.kiro/agents/ai-planner.json` |
| ai-builder | Builder / Kod yozuvchi | claude-opus-4.7 | `.kiro/agents/ai-builder.json` |
| ai-reviewer | Reviewer (alohida) | claude-opus-4.7* | `.kiro/agents/ai-reviewer.json` |

*Reviewer uchun `claude-haiku-4.5` ishlatish mumkin (tezroq va arzonroq).

## Tez boshlash

```bash
# 1. Clone
git clone <this-repo> my-project && cd my-project

# 2. PROJECT_BRIEF.md ni yozing
# 3. agentloop.toml ni sozlang
# 4. Ishga tushiring
python ai_orchestrator/orchestrator.py
```

## Yangi imkoniyatlar

### Checkpoint / Resume

Crash dan keyin davom ettirish:

```bash
# Oxirgi to'xtagan joydan davom
python ai_orchestrator/orchestrator.py --resume

# Aniq run directory dan davom
python ai_orchestrator/orchestrator.py --resume .agentloop/runs/20260520_143000
```

Har build dan keyin `run_state.json` saqlanadi.

### Error Retry + Backoff

Agent crash yoki timeout bo'lganda avtomatik qayta urinish:

```toml
[retry]
max_attempts = 3
backoff_base = 2      # 2s, 4s, 8s...
backoff_max = 60
jitter = true
```

### Cost / Budget Tracking

Taxminiy xarajatlarni nazorat qilish:

```toml
[budget]
max_cost_usd = 10.0   # 0 = unlimited
warn_at_pct = 80       # 80% da ogohlantirish
cost_per_build_usd = 0.15
cost_per_review_usd = 0.05
cost_per_plan_usd = 0.10
```

Budget tugaganda loop to'xtaydi.

### Multi-Model Support

Har agent uchun alohida model:

```toml
[agents.planner]
agent = "ai-planner"    # .kiro/agents/ai-planner.json → model: opus

[agents.builder]
agent = "ai-builder"    # .kiro/agents/ai-builder.json → model: opus

[agents.reviewer]
agent = "ai-reviewer"   # .kiro/agents/ai-reviewer.json → model: haiku (tezroq)
```

Model ni `.kiro/agents/*.json` ichida `"model"` field orqali o'zgartiring.

### Separate Reviewer

Reviewer endi planner dan alohida agent sifatida ishlaydi. Bu:
- Tezroq/arzonroq model ishlatish imkonini beradi
- Review sifatini yaxshilaydi (ixtisoslashgan prompt)
- Planner yukini kamaytiradi

### Metrics & Observability

Har run oxirida `metrics.json` saqlanadi:

```json
{
  "summary": {
    "total_duration_sec": 1234.5,
    "total_builds": 15,
    "total_reviews": 5,
    "review_pass_rate": 0.80,
    "avg_build_duration": 82.3,
    "total_files_changed": 12
  }
}
```

### Web Dashboard (FastAPI + SSE)

Real-time progress UI:

```bash
# Alohida terminal da ishga tushiring
pip install fastapi uvicorn
python ai_orchestrator/dashboard.py --logs-dir .agentloop/runs

# Brauzerda oching: http://localhost:8420
```

Dashboard ko'rsatadi:
- Status (running/done)
- Total builds, reviews, cost
- Live events stream (SSE)
- Review pass rate

### Agent Context Sharing

Agentlar orasida shared memory — `context_store.json`:
- Completed tasks
- Key files
- Architecture decisions
- Active blockers
- Reviewer notes

Builder prompt ga avtomatik inject qilinadi.

### Parallel Review

Test va snapshot parallel ishlaydi (tezroq):

```toml
[loop]
parallel_review = true
```

## Sikl

```
Plan → Build → Test → Review → Replan
  ↑                               ↓
  └──── davom (agar done=false) ──┘
                                  ↓
            done=true → Auto-Discovery → Git Push
```

## Konfiguratsiya

`agentloop.toml` da:

| Parametr | Default | Tavsif |
|----------|---------|--------|
| plan_cycles | 3 | Necha marta plan yaratiladi |
| review_cycles | 3 | Har plan uchun necha review |
| build_iterations | 5 | Har review uchun necha build |
| max_total_builds | 50 | Umumiy build limiti |
| max_discovery_rounds | 2 | Auto-discovery limiti |
| retry.max_attempts | 3 | Agent crash da qayta urinish |
| budget.max_cost_usd | 0 | Budget limiti (0=unlimited) |

## CLI Flags

```
--config FILE        Konfiguratsiya fayli (default: agentloop.toml)
--project PATH       Loyiha papkasi
--brief FILE         Brief fayli
--plan-cycles N      Plan cycles soni
--review-cycles N    Review cycles soni
--build-iterations N Build iterations soni
--dry-run            AI chaqirmasdan promptlarni yozish
--skip-preflight     Preflight tekshiruvlarni o'tkazib yuborish
--resume [PATH]      Checkpoint dan davom ettirish
```

## Telegram

Bot yarating (@BotFather), token va chat_id ni `agentloop.toml` ga yozing.

## Requirements

- Python 3.11+
- `kiro-cli` (auth qilingan)
- Git repo
