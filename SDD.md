# SDD - YayaMind 1.1 软件设计文档

## 1. 文档信息

- 当前版本：1.1 Schedule-only
- 关联 PRD：`PRD.md`
- 更新日期：2026-06-24
- 维护者：用户 + Codex
- 版本基线：1.0 已冻结为 Git tag `v1.0-ai-assistant`

## 2. 架构目标

1.1 在 1.0 的桌面小猫、React 工作台、Fastify 本地 API 和本地 JSON/JSONL 数据层上做减法：删除当前版本待办主链路，只保留日程、提醒、画像、周期日程和语音追问。

```text
桌面小猫 / Web 输入
-> 会话状态机
-> 输入理解
-> 日程 / 提醒 / 周期草稿
-> 追问缺失时间
-> 用户确认
-> 写入 events.jsonl / reminders.jsonl / recurring_rules.json
-> bootstrap 刷新日程
```

## 3. 模块设计

| 模块 | 1.1 行为 | 主要文件 |
|---|---|---|
| React 工作台 | 导航无待办；右侧无待办区；只展示日程、待补充、提醒 | `src/App.tsx`、`src/styles.css` |
| Intent Router | `add_task` 统一转成日程或待补充日程草稿 | `server/dataStore.ts` |
| Draft Manager | 草稿项只写日程、提醒、周期规则 | `server/dataStore.ts`、`server/types.ts` |
| Bootstrap | 不返回待办列表和待办项目；日历 `tasks` 为空 | `server/dataStore.ts` |
| API | `/api/tasks`、`/api/todo-projects` 从当前版本移除 | `server/index.ts` |
| Desktop | 继续打包同步到 `D:\YayaMind` | `electron/`、`package.json` |

## 4. 数据边界

- 旧用户数据文件 `tasks.jsonl` 和 `todo_projects.json` 不删除，避免破坏历史数据。
- 1.1 当前代码不读取旧待办进入 UI，不写入新的待办。
- `/api/bootstrap` 仍可保留空数组字段 `tasks: []`、`todoProjects: []`，用于兼容前端旧字段，但语义上已经冻结。
- 需要恢复待办能力时，从 Git tag `v1.0-ai-assistant` 恢复代码。

## 5. 核心流程

### 5.1 普通输入

```text
“下午三点写简历”
-> parse 为 add_event
-> commit 写 events.jsonl
-> 日程刷新
```

```text
“写简历”
-> parse 为 add_event 但时间不明确
-> 小猫追问“安排到几点”
-> 用户补时间
-> 转成日程草稿 / 日程
```

### 5.2 周期安排

```text
“每周六下午三点上课”
-> habit_rule 草稿
-> 确认后写 recurring_rules.json
-> bootstrap 动态生成周期日程
```

```text
“每天给猫刷牙”
-> habit_rule 草稿
-> 无明确时间，追问“给猫刷牙什么时间？”
-> 不生成待办
```

### 5.3 复杂草稿

- `buildPlanDraftItems` 不再创建 task 草稿项。
- 原本可能落成 task 的“准备 / 写 / 整理”表达，统一作为 event 草稿处理。
- `confirmPlanDraft` 遇到历史 task 草稿时兜底转写为 event，不再写 `tasks.jsonl`。

## 6. 验证策略

- API 回放：
  - “写简历”不写入待办，返回追问。
  - “下午三点写简历”写入 `events.jsonl`。
  - “每天给猫刷牙”追问一次时间，bootstrap 中无 tasks。
- 构建验证：`npm run build`。
- 桌面验证：`npm run desktop:pack`，同步 `D:\YayaMind`，冷启动后 `/api/bootstrap` 返回 200。
