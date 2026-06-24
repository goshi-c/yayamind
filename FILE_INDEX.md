# FILE_INDEX - YayaMind 文件定位索引

本文档是文件定位字典 / 代码导航索引，用来快速回答“要改某个东西，应该先打开哪些文件”。它只记录去哪找，不记录历史过程、任务状态、复盘原因和产品决策。

## 文档定位

- `PRD.md`：回答“做什么、为什么做、验收标准是什么”。
- `SDD.md`：回答“系统怎么设计、链路怎么走、接口和数据怎么流”。
- `TODO.md`：回答“现在做什么、下一步做什么”。
- `PROJECT_CONTEXT.md`：回答“历史上做过什么、为什么这么变、旧链路怎么回溯”。
- `README.md`：给外部人看，说明项目是什么、怎么运行、怎么展示。
- `FILE_INDEX.md`：回答“要改某个东西，应该先打开哪些文件”。

## 使用规则

- 日常开发默认仍然先读 `PRD.md`、`SDD.md`、`TODO.md`。
- `FILE_INDEX.md` 不是日常开发主读文档。
- 只有当任务进入“找文件 / 改代码 / 查日志 / 查数据结构 / 定位模块”阶段时，才读取它。
- 如果 `FILE_INDEX.md` 已经能定位文件，不要再盲目全项目搜索。
- 如果实际文件结构变化，修改相关代码时要同步维护 `FILE_INDEX.md`。
- `FILE_INDEX.md` 只记录“去哪找”，不记录历史过程、任务状态、复盘原因和产品决策。

## 维护规则

- 如果本轮开发中实际查看了某个重要文件、目录、日志或数据位置，而本文档没有记录，收尾时要补充。
- 如果文件被移动、重命名、合并、拆分，收尾时要更新对应映射。
- 如果某个功能链路新增了关键文件，收尾时要补到“功能到文件映射”。
- 不记录历史过程、任务状态、复盘原因和产品决策。

## 1. 快速入口

| 我要做什么 | 优先看哪里 | 备注 |
|---|---|---|
| 一周安排 / 右侧日期详情 | `src/App.tsx`、`src/styles.css`、`server/index.ts`、`server/dataStore.ts` | 先看 `SDD.md` 链路 1、4，再定位具体 UI / API / 数据函数 |
| 项目待办 | `src/App.tsx`、`server/index.ts`、`server/dataStore.ts`、`personal-assistant-data/tasks.jsonl`、`personal-assistant-data/todo_projects.json` | 待办分类、deadline、完成态都在这条链路 |
| 小猫语音输入 | `src/App.tsx`、`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`、`server/index.ts` | 先分清 Web 小猫、桌面小猫和后端 parse/commit |
| 桌面小猫 / Electron | `electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`、`electron/server-runner.cjs`、`src/assets/desktop/` | 单击、双击、拖动、托盘、真实入口都先看这里 |
| 本地 API | `server/index.ts` | 路由入口；具体读写和业务规则再跳到 `server/dataStore.ts` |
| parse / commit 链路 | `server/index.ts`、`server/dataStore.ts`、`server/aiAdapter.ts`、`src/App.tsx` | `/api/input/parse` 只解析，`/api/input/commit` 才写入 |
| AI 1.0 会话 / 草稿 / 批量 / 周期 | `server/types.ts`、`server/dataStore.ts`、`server/index.ts`、`src/App.tsx` | 先看 `ParseResult`、`ConversationContext`、`PlanDraft`、`BatchOperationPreview`、`RecurringRuleRecord` |
| 数据读写 | `server/dataStore.ts`、`server/types.ts`、`personal-assistant-data/` | JSON/JSONL schema 和文件落点优先看这里 |
| AI / DeepSeek | `server/aiAdapter.ts`、`.env.local`、`server/dataStore.ts` | AI 输出必须经后端规则守卫后再写入 |
| 打包 / 正式入口 | `package.json`、`electron/main.cjs`、`electron/server-runner.cjs`、`dist/`、`dist-server/`、`desktop-release/`、`release/` | 本项目区分 source/dev、build output 和真实入口 `D:\YayaMind` |
| 样式和视觉 | `src/styles.css`、`src/App.tsx`、`src/assets/`、`src/assets/desktop/` | 页面样式主要在 CSS，桌面图标和小猫资源在 assets |
| 用户数据 | `personal-assistant-data/`；桌面正式态另看 `D:\YayaMindData\personal-assistant-data` | 开发态和桌面正式态数据目录不同，改前先确认当前入口 |
| 日志 | `dev-server.log`、`server-test.log`、`D:\YayaMindData\userData\desktop-cat.log`、`.run-logs/` | 桌面语音优先看 `desktop-cat.log` 的结构化事件 |
| 文档 | `PRD.md`、`SDD.md`、`TODO.md`、`PROJECT_CONTEXT.md`、`README.md`、`docs/` | 按“主读 / 定位 / 回溯 / 展示 / 模块深挖”分工读取 |
| AI 化 1.0 当前开发文档 | `PRD.md`、`SDD.md`、`TODO.md` | 根目录主文档已切换为 AI 化 1.0 开发版 |
| AI 化 1.0 / MVP 历史来源 | `docs/archive/versions/2026-06-22-ai-1.0-switch/` | 含 MVP 版 PRD/SDD/TODO、初始 1.0 roadmap 和 1.0 讨论草稿 |

## 2. 目录结构导航

### `src/`

React 前端工作台。需要改一周安排、右侧日期详情、项目待办、页面小猫、输入理解卡片、状态刷新、用户可见文案或视觉样式时看这里。

- `src/App.tsx`：主应用组件、页面状态、数据请求、日历/待办/详情/语音交互逻辑。
- `src/styles.css`：整体布局、周视图、右侧详情、待办、小猫气泡、响应式和视觉风格。
- `src/main.tsx`：React 入口。
- `src/assets/`：页面和桌面使用的图片资源。

### `server/`

本地 API、业务规则、数据读写和 AI adapter。需要改 API、解析、commit、冲突判断、提醒、总结、画像或数据 schema 时看这里。

- `server/index.ts`：Fastify 路由入口，含 `/api/bootstrap`、`/api/input/parse`、`/api/input/commit` 等。
- `server/dataStore.ts`：数据文件读写、bootstrap 聚合、自然语言解析守卫、commit 写入、冲突/提醒/总结等核心逻辑。
- `server/types.ts`：前后端共享的数据类型。
- `server/aiAdapter.ts`：DeepSeek 调用、AI 状态和回退边界。
- `server/auth.ts`、`server/requestContext.ts`：线上鉴权和请求上下文。

### `electron/`

Electron 桌面壳和桌面小猫。需要改真实桌面入口、小猫悬浮窗、单击/双击/拖动、托盘、IPC、系统听写桥、生产 API 自启动时看这里。

- `electron/main.cjs`：主进程、窗口、托盘、路径、日志、IPC、语音触发。
- `electron/preload.cjs`：主进程和 Web 工作台之间的安全桥。
- `electron/bubble.html`：桌面小猫悬浮窗 UI、拖动和点击事件。
- `electron/server-runner.cjs`：打包态启动本地 API 的入口。
- `electron/stt-helper.cjs`：历史/辅助语音转写 helper，改前先确认当前链路是否仍使用。

### `personal-assistant-data/`

开发态本地数据目录。需要查开发态日程、任务、提醒、执行记录、目标、画像、设置、总结输出时看这里。真实桌面入口运行态通常另写到 `D:\YayaMindData\personal-assistant-data`，不要混淆。

### `docs/`

展示材料、模块细节和历史归档。需要面试包装、作品集展示、模块设计深挖或查旧 `docs/archive/TASK_LOG.md` / `docs/archive/DECISIONS.md` 时看这里。

- `docs/sdd/`：模块级 SDD 深挖材料，只在对应模块需要细看时读。
- `docs/roadmap/`：后续版本规划文档。AI 化 1.0 初始 roadmap 已在版本切换时归档到 `docs/archive/versions/2026-06-22-ai-1.0-switch/AI-1.0-initial-roadmap-PRD-SDD.md`，当前 1.0 依据看根目录 `PRD.md` / `SDD.md` / `TODO.md`。
- `docs/interview/`：面试材料。
- `docs/portfolio/`：作品集材料和截图。
- `docs/archive/`：历史遗留 `TASK_LOG.md`、`DECISIONS.md` 和版本归档位置，只按需查旧证据；MVP 收口和 AI 1.0 切换归档见 `docs/archive/versions/2026-06-22-ai-1.0-switch/`。

### 根目录文档

日常主读和项目门面文档都在根目录。需要理解需求、设计、任务、历史和对外说明时按文档索引读取，不要全量扫所有长文档。

### 构建 / 打包相关目录

- `dist/`：Vite Web 构建输出。
- `dist-server/`：桌面打包用的后端 bundle。
- `release/`、`desktop-release/`：历史或本地构建产物目录，改前先核对当前 `package.json` 输出配置。
- `D:\YayaMindBuild\release`：当前打包脚本使用的 build output。
- `D:\YayaMind`：阶段收口同步后的真实入口目录。

## 3. 功能到文件映射

### 桌面语音链路

- 前端相关文件：`src/App.tsx`。
- 后端相关文件：`server/index.ts`、`server/dataStore.ts`、`server/aiAdapter.ts`。
- 桌面相关文件：`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`。
- 数据文件：写入 `events.jsonl`、`tasks.jsonl`、`reminders.jsonl`、`work_logs.jsonl`。
- 日志或验证点：`D:\YayaMindData\userData\desktop-cat.log`，关注 `native-voice-stop`、`desktop-recognized-text`、`desktop-auto-commit-start`、`commit-success`。

### 自然语言解析链路

- 前端相关文件：`src/App.tsx` 的输入理解、追问、决策和提交状态。
- 后端相关文件：`server/index.ts` 的 `/api/input/parse`、`/api/input/commit`；`server/dataStore.ts` 的解析、守卫和写入；`server/aiAdapter.ts` 的 AI 解析。
- 数据文件：`events.jsonl`、`tasks.jsonl`、`reminders.jsonl`、`work_logs.jsonl`。
- 日志或验证点：后端日志中的 `input parse result`、`input commit result`；前端刷新后 `/api/bootstrap` 数据出现。

### 日历 / 周视图

- 前端相关文件：`src/App.tsx` 的周视图、日期选择、拖拽、时间轴和事件样式计算；`src/styles.css` 的日历布局样式。
- 后端相关文件：`server/index.ts` 的 `/api/bootstrap`、`/api/calendar`、事件 PATCH/DELETE；`server/dataStore.ts` 的日历数据聚合。
- 数据文件：`events.jsonl`、`tasks.jsonl`、`reminders.jsonl`、`settings.json`。
- 日志或验证点：页面周一到周日展示、今天高亮、拖拽/编辑后刷新仍保留。

### 右侧详情

- 前端相关文件：`src/App.tsx` 的 selected date/item 状态、详情卡片、内联编辑、软删除；`src/styles.css` 的详情区样式。
- 后端相关文件：`server/index.ts` 的 events/tasks/work-logs PATCH/DELETE；`server/dataStore.ts` 的更新和软删除逻辑。
- 数据文件：`events.jsonl`、`tasks.jsonl`、`work_logs.jsonl`、`reminders.jsonl`。
- 日志或验证点：编辑后 `/api/bootstrap` 刷新；软删除后不再展示或参与冲突。

### 项目待办

- 前端相关文件：`src/App.tsx` 的项目待办分组、deadline、完成态和月历点；`src/styles.css` 的待办密度和布局。
- 后端相关文件：`server/index.ts` 的 `/api/todo-projects`、`/api/tasks`；`server/dataStore.ts` 的任务和项目读写。
- 数据文件：`tasks.jsonl`、`todo_projects.json`。
- 日志或验证点：新增、编辑、完成、删除后刷新仍一致。

### 提醒

- 前端相关文件：`src/App.tsx` 的提醒展示、处理按钮、小猫反馈。
- 后端相关文件：`server/index.ts` 的 `/api/reminders/*`；`server/dataStore.ts` 的提醒生成、done/dismiss/snooze。
- 数据文件：`reminders.jsonl`、`settings.json`。
- 日志或验证点：到点触发、小猫气泡、处理状态写入后不重复冒泡。

### 总结和画像

- 前端相关文件：`src/App.tsx` 的总结、目标、画像和个人习惯区。
- 后端相关文件：`server/index.ts` 的 `/api/summaries/generate`、`/api/profile`、`/api/settings`、`/api/goals`；`server/dataStore.ts` 的总结和画像逻辑。
- 数据文件：`summaries/`、`profiles.json`、`goals.json`、`settings.json`、`work_logs.jsonl`。
- 日志或验证点：生成 Markdown 总结、画像和设置刷新后仍可读取。

### 打包和桌面正式入口

- 前端相关文件：`src/assets/desktop/`、`src/App.tsx` 中桌面模式适配。
- 后端相关文件：`server/index.ts`、`electron/server-runner.cjs`、`dist-server/`。
- 桌面相关文件：`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`。
- 配置文件：`package.json` 的 `desktop:pack`、`desktop:dist`、`build`。
- 日志或验证点：`D:\YayaMind\YayaMind.exe` 冷启动、`http://127.0.0.1:8787/api/bootstrap` 返回 200、真实入口包含本轮变更。

## 4. 数据和日志定位

| 文件 / 目录 | 用途 | 注意事项 |
|---|---|---|
| `personal-assistant-data/events.jsonl` | 开发态日程、会议、时间块 | 软删除记录不应继续展示或参与冲突 |
| `personal-assistant-data/tasks.jsonl` | 开发态任务、截止任务、项目待办 | `projectId` 关联 `todo_projects.json` |
| `personal-assistant-data/todo_projects.json` | 开发态项目待办分类 | 默认工作、学校、生活，可扩展 |
| `personal-assistant-data/reminders.jsonl` | 开发态提醒 | 处理状态要可回溯，避免重复提醒 |
| `personal-assistant-data/plan_drafts.json` | AI 1.0 未确认整组草稿 | parse 阶段可写入 pending 草稿；确认前不算正式数据 |
| `personal-assistant-data/conversation_context.json` | AI 1.0 会话状态和当前待确认动作 | 用于草稿确认、修改、取消和候选选择上下文恢复 |
| `personal-assistant-data/recurring_rules.json` | AI 1.0 习惯 / 周期规则 | 确认周期草稿后写入，近期实例拆写到 events/tasks |
| `personal-assistant-data/work_logs.jsonl` | 开发态执行记录 | 支撑总结、画像和右侧详情 |
| `personal-assistant-data/goals.json` | 开发态阶段目标 | 目标页使用 |
| `personal-assistant-data/profiles.json` | 开发态个人画像 | 从执行数据沉淀，不硬造结论 |
| `personal-assistant-data/settings.json` | 开发态作息、休息日、城市等设置 | 影响时间轴、提醒和天气 |
| `personal-assistant-data/summaries/` | 开发态每日/每周 Markdown 总结 | 可用于 Obsidian |
| `D:\YayaMindData\personal-assistant-data\` | 桌面真实入口运行态数据 | 验收正式入口时优先确认这里，而不是开发态数据 |
| `D:\YayaMindData\userData\desktop-cat.log` | 桌面小猫结构化日志 | 桌面语音、IPC、commit 链路优先查 |
| `dev-server.log` | 本地开发服务日志 | 文件较大，按关键词查 |
| `server-test.log` | API/服务测试日志 | 按测试主题或时间查 |
| `.run-logs/` | 本地运行记录目录 | 只按需查 |

## 5. 文档索引

- 日常开发主读：`PRD.md`、`SDD.md`、`TODO.md`。
- 文件定位：`FILE_INDEX.md`。
- 历史回溯：`PROJECT_CONTEXT.md`。
- 后续版本规划：`docs/roadmap/`；当前 AI 化 1.0 已升格为根目录主文档。
- 版本归档：`docs/archive/versions/2026-06-22-ai-1.0-switch/`。
- 外部展示：`README.md`、`docs/interview/`、`docs/portfolio/`。
- 模块深挖：`docs/sdd/`。
- 历史遗留：`docs/archive/TASK_LOG.md`、`docs/archive/DECISIONS.md`，只按需查，不再默认写入。
