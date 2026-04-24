# KPI Ownership Matrix

## Purpose
Make KPI responsibility explicit before score computation and workflow triggers expand.

## Current Matrix

### Hedef Gerceklestirme Orani
- operational owner: `STORE_MANAGER`
- visible to:
  - `DEPUTY_GM`
  - `REGION_MANAGER`
  - `STORE_MANAGER`
  - `STORE_PERSONNEL`
- contributes to:
  - `store`
  - `personnel`
- task candidate: yes

### CR
- operational owner: `STORE_MANAGER`
- visible to:
  - `DEPUTY_GM`
  - `REGION_MANAGER`
  - `STORE_MANAGER`
- contributes to:
  - `store`
- task candidate: yes

### ATV
- operational owner: `STORE_MANAGER`
- visible to:
  - `DEPUTY_GM`
  - `REGION_MANAGER`
  - `STORE_MANAGER`
  - `STORE_PERSONNEL`
- contributes to:
  - `store`
  - `personnel`
- task candidate: not initially

### UPT
- operational owner: `STORE_MANAGER`
- visible to:
  - `DEPUTY_GM`
  - `REGION_MANAGER`
  - `STORE_MANAGER`
  - `STORE_PERSONNEL`
- contributes to:
  - `store`
  - `personnel`
- task candidate: not initially

### BM Checklist
- operational owner: `STORE_MANAGER`
- visible to:
  - `REGION_MANAGER`
  - `STORE_MANAGER`
- contributes to:
  - `store`
- task candidate: yes

### VM Checklist
- operational owner: `STORE_MANAGER`
- data producer may be: `VISUAL_TEAM`
- visible to:
  - `REGION_MANAGER`
  - `STORE_MANAGER`
  - `VISUAL_TEAM`
- contributes to:
  - `store`
- task candidate: yes

## Rule
- visibility does not equal ownership
- ownership does not automatically mean workflow trigger
- store score and personnel score should reuse the same KPI catalog, but remain separate score profiles

## Future Metric Rule
When a new metric such as `GSM approvals` is introduced, define:
- operational owner
- who can see it
- which score profiles it contributes to
- whether it becomes a task candidate

Do not add a new KPI directly into a page before those answers exist.
