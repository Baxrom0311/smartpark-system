# AI Agent Orchestrator Template

Kiro (Opus 4.7) bilan avtomatik loyiha qurish uchun shablon.

## Arxitektura

| Agent | Rol | Model |
|-------|-----|-------|
| Kiro (ai-planner) | Planner + Reviewer | claude-opus-4.7 |
| Kiro (ai-builder) | Builder / Kod yozuvchi | claude-opus-4.7 |

## Tez boshlash

```bash
# 1. Shu reponi clone qiling yoki yangi loyihaga ko'chiring
git clone <this-repo> my-project
cd my-project

# 2. PROJECT_BRIEF.md ni yozing
# Loyihangiz tavsifini batafsil yozing

# 3. agentloop.toml ni sozlang
# - test_command: sizning test buyrug'ingiz
# - telegram: bot_token va chat_id (ixtiyoriy)
# - git: auto_push = true (ixtiyoriy)

# 4. Ishga tushiring
python ai_orchestrator/orchestrator.py
```

## Sikl

```
Kiro Plan → Kiro Build → Test → Kiro Review → Kiro Replan
     ↑                                              ↓
     └──────────── davom etadi (agar done=false) ───┘
                                                    ↓
                              done=true → Auto-Discovery → GitHub Push
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

## Telegram

Bot yarating (@BotFather), token va chat_id ni `agentloop.toml` ga yozing.

## Requirements

- Python 3.11+
- `kiro-cli` (auth qilingan)
- Git repo
