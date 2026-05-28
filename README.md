# AI Agent Orchestrator Template

Kiro CLI bilan avtomatik loyiha qurish uchun shablon.

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

# 2. PROJECT_BRIEF.md ni yozing (loyihangiz tavsifi)
# 3. agentloop.toml ni sozlang (telegram, git, budget)
# 4. Ishga tushiring
python ai_orchestrator/orchestrator.py
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

## Xususiyatlar

- **Checkpoint/Resume** — Crash dan keyin `--resume` bilan davom ettirish
- **Error Retry + Backoff** — Avtomatik qayta urinish
- **Cost/Budget Tracking** — Xarajatlarni nazorat qilish
- **Multi-Model Support** — Har agent uchun alohida model
- **Separate Reviewer** — Tezroq/arzonroq model bilan review
- **Metrics & Observability** — Har run oxirida `metrics.json`
- **Web Dashboard** — Real-time progress UI (FastAPI + SSE)
- **Agent Context Sharing** — Agentlar orasida shared memory
- **Parallel Review** — Test va review parallel ishlaydi
- **Telegram Notifications** — Bot orqali xabar olish

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

Bot yarating (@BotFather), token va chat_id ni `.env` ga yozing:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

`agentloop.toml` da `[telegram] enabled = true` qiling.

## Requirements

- Python 3.11+
- `kiro-cli` (auth qilingan)
- Git repo
