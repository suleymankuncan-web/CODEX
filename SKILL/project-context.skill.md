# Integration Principles
- Sistem başka kurumsal sistemlerden veri alabilecek şekilde tasarlanmalıdır
- Personel, norm kadro, aktif/pasif çalışan, mağaza bilgileri ve aylık operasyon verileri dış sistemlerden entegre gelebilir
- Dış sistemlerden gelen veriler doğrudan kritik rapor tablolarına yazılmamalıdır
- Önce staging/import katmanına alınmalı, doğrulanmalı, sonra iş kurallarından geçirilerek ana tablolara işlenmelidir
- Her entegrasyon işlemi zaman damgası, kaynak sistem bilgisi ve batch/job kimliği ile loglanmalıdır
- Aynı verinin tekrar gelmesi durumunda duplicate kayıt oluşmamalıdır
- Entegrasyonlar idempotent çalışmalıdır
- Hatalı veri tüm sistemi bozmamalı, satır bazlı hata yönetimi desteklenmelidir
- Anlık operasyon verisi ile snapshot rapor verisi ayrıştırılmalıdır
- Dış sistemden gelen veri geçmişi bozmayacak şekilde versioned veya history-aware işlenmelidir

# External Data Sources
Muhtemel dış kaynaklar:
- HR sistemi
- ERP sistemi
- Mağaza satış / operasyon sistemi
- Vardiya / puantaj sistemi
- Performans veri kaynakları
# Purpose

Bu sistem mağaza operasyon, denetim ve performans yönetim platformudur.

# Core Structure

Organizasyon hiyerarşisi:

* Company
* Region
* Store
* Employee

# User Roles

* Admin
* Bölge Müdürü
* Mağaza Müdürü
* Denetçi
* HR / Operasyon

# Core Modules

* Checklist / Denetim
* Performans & KPI
* Norm Kadro
* Turnover
* Raporlama
* Aksiyon Takibi

# Core Rules

* Role-based access zorunludur
* Her kullanıcı sadece yetkili olduğu veriyi görür
* Checklist kayıtları immutable'dır
* Raporlar snapshot tabanlıdır
* Tüm kritik işlemler audit log’a girer

# Performance Goals

* Dashboard < 3 saniye
* API response < 500ms (normal case)
* Ağır raporlar async export olarak çalışır

# UX Principles

* Saha kullanımı mobil-first
* Yönetim panelleri desktop-first
* Minimum click ile işlem yapılmalıdır

# Data Principles

* Anlık veri ve rapor verisi ayrıdır
* KPI’lar merkezi hesaplanır (single source of truth)
* Snapshot veriler geçmişi değiştirmeyecek şekilde saklanır

# Integration Principles

* Sistem dış kaynaklardan veri alabilecek şekilde tasarlanmalıdır
* HR, ERP ve diğer sistemlerden veri entegrasyonu desteklenir
* Dış sistem verileri doğrudan ana tablolara yazılmaz
* Tüm veri önce staging/import katmanına alınır
* Veri doğrulama ve iş kuralları sonrası ana tablolara işlenir
* Entegrasyonlar idempotent olmalıdır (aynı veri tekrar işlendiğinde bozulma olmamalı)
* Her veri kaydı source_system ve external_id ile izlenebilir olmalıdır
* Tüm entegrasyon işlemleri batch/job bazlı loglanmalıdır
* Hatalı kayıtlar sistem genelini etkilemeden yönetilmelidir

# External Data Sources

Muhtemel veri kaynakları:

* HR sistemleri (personel, giriş/çıkış, pozisyon)
* ERP sistemleri (mağaza, bölge yapısı)
* Satış / operasyon sistemleri
* Vardiya / puantaj sistemleri

# Audit & Logging

* Tüm kritik işlemler loglanmalıdır
* Kim, neyi, ne zaman değiştirdi bilgisi saklanmalıdır
* Entegrasyon işlemleri detaylı şekilde izlenmelidir

# Avoid

* Yetkisiz veri erişimi
* Snapshot olmadan geçmiş rapor üretimi
* Ağır raporları senkron çalıştırmak
* Dış veri ile mevcut veriyi doğrudan overwrite etmek
* Checklist sonuçlarını sonradan değiştirmek
* Tek sorguda aşırı büyük veri çekmek



---
name: "project-context"
description: "Maintains project context and progress tracking across Claude sessions. Use at session start to load context, on session end to save progress. Triggers: load project context, save context, end session, what was I working on, switch to project, done for today."
---

<objective>
Maintain project context and progress tracking across Claude sessions. Enables seamless session continuity by loading context at start and saving progress at end.
</objective>

<quick_start>
**Session start:** Load `<project-root>/.claude/PROJECT_CONTEXT.md`, verify against `git status`

**Session end:** Update context file with completed TODOs, clear previous session's Done list

**Context file location:** `<project-root>/.claude/PROJECT_CONTEXT.md`

**Triggers:** "load context", "save context", "done for today", "switch to [project]"
</quick_start>

<success_criteria>
Context management is successful when:
- Project detected from pwd (Claude Code) or user input (Claude Desktop)
- Context file matches current project (header verified against folder name)
- Git state verified against context (branch, recent commits)
- Done list cleared each new session (prevents accumulation)
- Context saved before session ends
</success_criteria>

<core_content>
## MANDATORY: Project Detection (Run First)

Before ANY other action, identify which project the user is in:

### Claude Code (Terminal)

```bash
pwd  # Get current working directory
```

1. Run `pwd` to get current directory
2. Extract project name from path (last folder name)
3. Load `<pwd>/.claude/PROJECT_CONTEXT.md`
4. **VERIFY**: Does the `# <project-name>` header match the folder name?
   - **YES** → Display context and proceed
   - **NO** → WARN: "Context mismatch! File says [X] but you're in [Y]. Regenerating..."
   - **FILE MISSING** → Auto-generate (see below)

### Claude Desktop (No Terminal)

If `pwd` is unavailable (Claude Desktop environment):

1. Check if user already specified a project in their message
2. If not, ASK: "Which project are you working on today?"
3. Use the projects list at `reference/projects-list.md` if available
4. Load: `/Users/tmkipper/Desktop/tk_projects/{project-name}/.claude/PROJECT_CONTEXT.md`

**To switch projects**: User says "switch to [project-name]" or "working on [project]"

---

## On Session Start

After project detection:

### 1. Load Context File
```
<project-root>/.claude/PROJECT_CONTEXT.md
```

### 2. Verify Against Git State
```bash
git status            # Current branch, modified files
git log --oneline -5  # Recent commits
```

Flag discrepancies:
- TODO marked done in commits? → Move to "Done"
- Branch changed? → Update context header
- Stale info? → Remove it

### 3. Display to User
Show a brief summary:
```
📍 Project: [name]
🌿 Branch: [branch]
📅 Last updated: [date]

Focus items: [count]
```

---

## On Session End

Triggers: "done", "end session", "save context", "done for today"

1. Review conversation for completed work
2. Update PROJECT_CONTEXT.md:
   - Move completed TODOs to "Done (This Session)"
   - Update Status based on commits made
   - Preserve untouched Focus items
   - **Clear previous session's Done list** (prevents accumulation)
   - Update timestamp
3. Show user the updated context

---

## Auto-Generate Context

When no PROJECT_CONTEXT.md exists, create from:

1. `.claude/CLAUDE.md` or `CLAUDE.md` (project docs)
2. `git log --oneline -5` (recent activity)
3. `git status` (current state)
4. `package.json` / `pyproject.toml` / `requirements.txt` (tech stack)

Write to: `<project-root>/.claude/PROJECT_CONTEXT.md`

---

## Context File Format

See `reference/template.md` for full template.

```markdown
# <project-name>

**Branch**: <branch> | **Updated**: <YYYY-MM-DD>

## Status
<2-3 sentences: current state>

## Today's Focus
1. [ ] <task>
2. [ ] <task>

## Done (This Session)
- <populated on session end, cleared on next session start>

## Blockers
<none or list>

## Tech Stack
<single line: Python 3.11 | FastAPI | PostgreSQL>
```

---

## Key Rules

1. **ALWAYS detect project first** - Never assume from previous session
2. **One project = one context file** - No cross-contamination
3. **Verify context matches pwd** - Warn on mismatch
4. **Clear Done list each session** - Prevents infinite accumulation
5. **Never store data in this SKILL.md** - Always use project's own file

---

## Reference Files

- `reference/template.md` - Full context file template with examples
- `reference/projects-list.md` - Tim's projects list for Claude Desktop

## Emit Outcome Sidecar

As the final step, write to `~/.claude/skill-analytics/last-outcome-project-context.json`:
```json
{"ts":"[UTC ISO8601]","skill":"project-context","version":"1.0.0","variant":"default",
 "status":"[success|partial|error]","runtime_ms":[estimated ms from start],
 "metrics":{"projects_detected":[n],"context_files_updated":[n]},
 "error":null,"session_id":"[YYYY-MM-DD]"}
```
Use status "partial" if some stages failed but results were produced. Use "error" only if no output was generated.
</core_content>

