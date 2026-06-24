# FILE_INDEX - YayaMind 1.1 文件定位索引

本文档只记录“去哪找”。当前版本为 1.1 Schedule-only，待办功能已从当前源码主链路删除；需要恢复待办能力时，从 Git tag `v1.0-ai-assistant` 拉取。

## 快速入口

| 我要做什么 | 优先看哪里 | 备注 |
|---|---|---|
| 当前版本需求 | `PRD.md` | 1.1 只保留日程主线 |
| 当前版本设计 | `SDD.md` | 记录 schedule-only 数据和接口边界 |
| 当前任务状态 | `TODO.md` | 记录 1.1 删除待办和验证进度 |
| 历史回溯 | `PROJECT_CONTEXT.md` | 按 CTX 编号看历史 |
| 一周日程 / 右侧详情 | `src/App.tsx`、`src/styles.css`、`server/dataStore.ts` | 当前主工作台 |
| 小猫语音输入 | `src/App.tsx`、`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`、`server/dataStore.ts` | 语音 -> parse -> commit |
| 本地 API | `server/index.ts` | 路由入口；待办 API 已从当前版本移除 |
| 自然语言解析 | `server/dataStore.ts`、`server/aiAdapter.ts` | `add_task` 会转成日程或待补充日程 |
| 数据 schema | `server/types.ts` | 旧 task 类型可能仍用于历史兼容，不代表当前功能 |
| 桌面壳 | `electron/` | 桌面小猫、托盘、本地 API 启动 |
| 打包 | `package.json` | `npm run desktop:pack` 输出到 `D:\YayaMindBuild\release` |
| 真实入口 | `D:\YayaMind\YayaMind.exe` | 收口时同步并冷启动 |
| 真实数据 | `D:\YayaMindData\personal-assistant-data\` | 用户数据目录，不随版本切换删除 |
| 桌面日志 | `D:\YayaMindData\userData\desktop-cat.log` | 语音和 IPC 排障 |

## 目录导航

### `src/`

- `src/App.tsx`：React 主应用、周视图、右侧详情、语音交互、设置、画像、总结。
- `src/styles.css`：页面布局、周视图、右侧详情、小猫气泡和响应式样式。
- `src/assets/desktop/`：桌面小猫与应用图标资源。

### `server/`

- `server/index.ts`：Fastify 路由入口；当前没有 `/api/tasks` 和 `/api/todo-projects`。
- `server/dataStore.ts`：本地数据读写、解析守卫、草稿确认、日程/提醒/周期规则写入。
- `server/types.ts`：共享类型；旧 task/todo 类型仅作为历史兼容或旧数据边界。
- `server/aiAdapter.ts`：DeepSeek / OpenAI compatible 解析适配。

### `electron/`

- `electron/main.cjs`：主进程、窗口、托盘、系统听写、日志。
- `electron/preload.cjs`：桌面安全桥。
- `electron/bubble.html`：悬浮小猫 UI。
- `electron/server-runner.cjs`：打包态本地 API 启动。

### 数据文件

| 文件 / 目录 | 当前用途 |
|---|---|
| `events.jsonl` | 当前日程主数据 |
| `reminders.jsonl` | 提醒 |
| `plan_drafts.json` | 未确认日程 / 提醒 / 周期草稿 |
| `conversation_context.json` | 当前追问 / 确认上下文 |
| `recurring_rules.json` | 周期日程规则 |
| `profiles.json` | 画像和偏好 |
| `settings.json` | 作息、AI 设置、显示设置 |
| `work_logs.jsonl` | 执行日志和总结输入 |
| `tasks.jsonl` | 1.0 历史数据；1.1 不读取展示、不写入 |
| `todo_projects.json` | 1.0 历史数据；1.1 不读取展示、不写入 |

## 1.1 待办删除边界

- 当前版本不再修改项目待办相关文件。
- 当前版本不删除用户数据目录中的旧 `tasks.jsonl` / `todo_projects.json`。
- 如果用户要恢复待办，从 GitHub tag `v1.0-ai-assistant` 开新分支。
