# SDD - YayaMind 软件设计文档

## 1. 文档信息

- 文档名称：YayaMind 软件设计文档
- 当前版本：MVP 收口版
- 关联 PRD 版本：`PRD.md` MVP 收口版，2026-06-22
- 更新日期：2026-06-22
- 状态：MVP 功能收口完成，保留真实桌面语音人工验收项；下一阶段进入 AI 化 1.0 准备
- 维护者：用户 + Codex

### 修订历史

| 日期 | 版本口径 | 修订内容 |
|---|---|---|
| 2026-06-10 | 面试材料阶段 | 整理面试讲解用 SDD，不作为日常开发主文档 |
| 2026-06-16 | 接手补齐阶段 | 根目录补齐临时 SDD，描述关键链路、API 和数据契约 |
| 2026-06-16 | MVP 收口版 | 重构为软件设计文档，补模块设计、数据设计、接口、状态机、测试和运维 |
| 2026-06-17 | MVP 体验修补 | 补充右侧详情三块分区、待办右键确认菜单、未归类虚拟兜底和小猫语音阶段状态 |
| 2026-06-18 | MVP 语音待办修补 | 补充项目词表辅助意图识别、0-24 时间轴休息块、长待办标题守卫和取消语音 IPC |
| 2026-06-18 | MVP 右侧详情与右键范围修补 | 右键删除范围统一改由虚线选中框表达；右侧详情移除横向分割线、隐藏滚动条并保留滚动 |
| 2026-06-22 | MVP 最终收口审计 | 对照代码确认 MVP 模块、接口、数据目录、桌面链路、测试策略和 1.0 版本切换边界 |

## 2. 系统架构设计

### 2.1 整体架构

YayaMind 采用本地优先架构。React 工作台负责交互和展示，Fastify 本地 API 负责业务规则、自然语言解析守卫和文件读写，Electron 桌面壳提供桌面小猫、托盘、窗口和生产态 API 自启动。本地 JSON/JSONL/Markdown 文件是 MVP 的主要数据源。

```text
Web / Electron UI
  -> Fastify local API
  -> dataStore business rules
  -> JSON / JSONL / Markdown local data
  -> UI refresh and desktop cat feedback
```

### 2.2 能力边界

| 层级 | 职责 | 不负责 |
|---|---|---|
| 前端工作台 | 渲染一周安排、右侧详情、项目待办、输入理解、提醒和反馈；发起 API 请求；维护本地交互状态 | 不直接写本地数据文件，不绕过后端校验 |
| 后端 / API | 聚合数据、处理 parse / commit、校验业务规则、统一写入文件、返回可展示结果 | 不承担桌面窗口管理，不暴露密钥 |
| 数据层 | 读写 JSON/JSONL/Markdown；处理软删除、数据聚合、总结和画像基础逻辑 | 不做不可逆清理，不把取消记录物理删除 |
| 桌面壳 | 创建桌面小猫、主窗口、托盘、IPC、日志、生产态 API 自启动、真实入口路径管理 | 不实现业务写入规则 |
| AI 能力 | DeepSeek 可选增强自然语言理解和语音纠错；失败时回退规则 | 不直接决定写入，不绕过规则守卫 |
| 云端适配 | 历史上支持 Vercel / Supabase 模式 | 当前 MVP 收口主线不以云端为验收重点 |

### 2.3 模块划分与技术选型

| 模块 | 技术 / 文件 | 设计说明 |
|---|---|---|
| 前端工作台 | React 19、TypeScript、Vite、`src/App.tsx`、`src/styles.css` | 单页工作台，三栏布局，状态集中在主组件内 |
| 本地 API | Fastify、`server/index.ts` | 暴露 `/api/*` 路由，开发态监听 8787，生产态由 Electron 启动 |
| 数据与规则 | `server/dataStore.ts`、`server/types.ts` | 数据文件初始化、读写、聚合、解析、冲突、提醒、总结 |
| AI Adapter | `server/aiAdapter.ts`、`.env.local`、`settings.json` | DeepSeek / OpenAI-compatible 状态与调用；本地设置优先于环境变量，缺 key 或失败时回退 |
| 桌面壳 | Electron、`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`、`electron/server-runner.cjs` | 桌面小猫、托盘、主窗口、IPC、日志和生产 API |
| 打包 | `package.json`、`electron-builder`、`dist/`、`dist-server/` | `desktop:pack` 输出到 `D:\YayaMindBuild\release` |
| 数据目录 | `personal-assistant-data/`、`D:\YayaMindData\personal-assistant-data\` | 开发态和真实桌面运行态分离 |

### 2.4 关键设计原则

- 本地优先：MVP 的可靠性优先来自本地 API 和本地文件，而不是云服务。
- 后端守卫：任何 AI 结果都必须经后端规则校验再写入。
- parse 和 commit 分离：解析成功不是任务完成，只有 commit 成功并刷新才算写入完成。
- 开发态和真实入口分层：打包成功不等于真实入口验证完成。
- 软删除优先：删除 / 取消应保留可追踪状态，避免误删数据。
- 文档分工清晰：PRD 定义做什么和怎么验收；SDD 定义怎么设计和怎么实现；历史写入 Project Context。
- 版本隔离：MVP 收口版只维护当前已实现闭环和遗留人工验收；AI 化 1.0 的 `plan_day`、历史实体词表、模糊时间解释器和画像排程先保留在 roadmap，等版本切换后再进入根级设计。

## 3. 模块详细设计

### 3.1 前端工作台模块

- 模块职责：展示工作台；管理页面状态；调用 API；处理输入理解、追问、确认、编辑、刷新和反馈。
- 关键文件：`src/App.tsx`、`src/styles.css`、`src/main.tsx`。
- 输入：`/api/bootstrap` 返回数据、用户点击 / 拖拽 / 输入、桌面 IPC 转发的语音文本。
- 输出：API 请求、页面状态、右侧详情、周视图、待办分组、小猫气泡反馈。
- 核心逻辑：
  - `refreshData` 拉取 bootstrap 并更新工作台。
  - 周视图根据 `calendar.days` 渲染日程、待补充事项和截止任务。
  - 右侧详情根据 `selectedDate` / `selectedDetail` 聚合展示。
  - 右侧详情分为“今天标题 / 日程 / 待办”三个语义块，但不使用横向分割线；项目待办页右侧月历内栏同样不出现分割线。日程区和待办区都是固定区域内独立滚动，滚动条隐藏但保留滚轮 / 触控板滚动能力。日程区展示明确时间块、待补充事项和提醒；待办区略向下留白，展示当天有 `dueAt` 的项目待办，第一行只显示截止时间，后续直接完整显示待办内容，查看态用更小字号和自动换行，避免截止任务混入日程列表或暴露项目分类 / 备注标签。
  - 右侧详情单击事项只选中 / 查看，双击事项才把原卡片切换为编辑态，避免误触编辑；长文本字段用多行输入承载，编辑框按换行与长句折行动态计算行数，不限制为固定两行，字体和行高与预览态保持一致；编辑态不提供显式保存按钮，点击外部时自动保存。
  - 项目待办按项目卡片展示，每个项目标题旁提供圆形新增待办入口；空草稿失焦或外部点击时自动收起；删除入口为右键确认菜单：右键待办或项目空白区域时在鼠标旁显示只含“删除”的菜单，当前删除范围由待办或项目卡片上的虚线选中框表达，虚线范围与拖拽选中范围一致；点击页面其他位置即失焦关闭且不删除；未归类只展示不可删除提示。
  - 小猫语音气泡把用户原话 / 转写和处理状态拆开显示：上方保留用户说的话，下方灰色小字显示“文字整理中 / 理解意图中 / 安排事项中 / 完成了”；听写中使用动态光圈，安排事项中使用静态站立 / 坐着状态，处理中不自动隐藏，完成或失败后才延迟清空。
  - 项目待办拖拽必须先长按选中，普通悬停保持箭头光标，长按武装后才显示抓取光标，进入输入框编辑时才显示文本插入光标；选中后用虚线框反馈当前移动对象；待办只支持同项目内按插入线上下排序，或拖到其他项目后追加到该项目末尾；项目卡片只支持按插入线在同一线性顺序中移动。
  - 个人画像页只保留一个页标题，作息 / 休息日设置行内对齐，保存按钮仅在设置变更后出现。
  - 周视图标题使用短标题规则压缩为 2-3 个字；日期标题不额外叠加“今天”或“休”文字。
  - 输入链路先调用 parse，再根据结果追问、确认或 commit。
  - 项目待办操作调用 tasks / todo-projects API；新增待办草稿标题非空时，外部点击或表单失焦自动保存，备注为空不阻塞退出编辑态。
  - 一周时间轴固定按 0:00-24:00 渲染；`settings.habits.sleepStart` / `wakeUp` 只生成灰色“休息”背景块，不再裁剪时间轴范围。
- 状态变化：加载态、选中日期、选中事项、编辑态、听写态、解析态、待确认态、提交态、乐观更新态。
- 依赖模块：本地 API、Electron preload 暴露的桌面能力。
- 失败情况：API 未启动、响应非 JSON、commit 失败、刷新失败、乐观更新和后端结果不一致。

### 3.2 后端 API 模块

- 模块职责：暴露本地 HTTP API，作为前端和数据层之间的唯一业务入口。
- 关键文件：`server/index.ts`。
- 输入：HTTP 请求、请求体字段、环境变量、生产静态资源目录。
- 输出：JSON 响应、错误响应、静态资源。
- 核心逻辑：
  - 注册 `/api/bootstrap`、`/api/input/parse`、`/api/input/commit`、events、tasks、work logs、reminders、summaries 等路由。
  - commit 失败时返回明确错误，不让前端误判成功。
  - 生产态注册静态资源，供 Electron 打包版加载。
- 状态变化：请求进入 -> 业务函数执行 -> 成功 / 失败响应。
- 依赖模块：`server/dataStore.ts`、`server/aiAdapter.ts`、Fastify。
- 失败情况：端口占用、静态资源路径不对、Server runner 未启动、路由返回 HTML 而非 JSON。

### 3.3 数据与业务规则模块

- 模块职责：初始化数据文件、读写数据、构造 bootstrap、解析输入、执行 commit、处理冲突和软删除。
- 关键文件：`server/dataStore.ts`、`server/types.ts`。
- 输入：API 参数、已有数据、AI 解析候选、用户选择。
- 输出：聚合数据、parse 结果、commit 结果、写入文件。
- 核心逻辑：
  - `getBootstrapData` 聚合 events / tasks / reminders / work logs / goals / settings。
  - `parseInput` 和相关规则识别日程、任务、提醒、修改、删除、补充等意图。
  - `commitInput` 根据解析结果写入对应文件。
  - PATCH / DELETE 通过 rewrite JSONL 或状态变更实现编辑和软删除。
  - 冲突判断只基于真实时间范围，不按日程标题相似误判。
- 状态变化：文件不存在 -> 初始化；记录 active -> cancelled / done；写入前检查 -> 写入成功 / 写入失败。
- 依赖模块：Node 文件系统、AI adapter、共享类型。
- 失败情况：文件损坏、字段缺失、日期时间解析错误、已取消记录继续参与冲突。

### 3.4 AI / 规则混合模块

- 模块职责：增强自然语言理解和语音纠错，同时保证无 key 或失败时仍可用。
- 关键文件：`server/aiAdapter.ts`、`server/dataStore.ts`。
- 输入：用户原文、规则初判、环境变量或 `settings.json` 中的 AI key / base URL / model。
- 输出：AI 解析建议、状态信息、回退结果。
- 核心逻辑：
  - `/api/ai/status` 只返回配置状态，不泄露密钥。
  - `PATCH /api/settings` 可保存 AI provider、base URL、model、API Key 和启用状态；AI Adapter 每次调用优先读取本地 `settings.json` 的 `ai` 字段，未配置时回退 `.env.local` / 环境变量。
  - AI 结果作为候选，不直接落库。
  - AI parse prompt 接收当前已有项目分类词表；语音或文本提到近似项目名时，优先回填词表里的原始项目名。
  - 语音纠错只做轻量纠错，不允许总结或改写成短标题；后端对待办解析结果做标题守卫，过短泛化标题回退到原始待办正文。
  - AI 对项目待办的项目名识别只允许匹配已有项目；未匹配到时落到未归类，不自动新建项目。历史上已存在的普通“未归类”项目按标题归一化折叠为虚拟 `uncategorized`，避免出现多个未归类或被当作普通项目删除。
  - 后端规则负责最终意图、时间、冲突、缺信息判断。
- 状态变化：AI 可用 -> 参与解析；AI 不可用 / 失败 -> 规则回退。
- 依赖模块：本地设置、环境变量、外部模型 API。
- 失败情况：密钥缺失、网络失败、AI 输出结构不符合预期、AI 幻觉字段。

### 3.5 桌面壳与桌面小猫模块

- 模块职责：提供桌面常驻入口、主窗口、托盘、系统听写桥、IPC 和日志。
- 关键文件：`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`、`electron/server-runner.cjs`。
- 输入：鼠标单击 / 双击 / 拖动、系统听写文本、窗口生命周期、托盘动作。
- 输出：IPC 事件、主窗口打开 / 聚焦、小猫状态、`desktop-cat.log`、生产本地 API。
- 核心逻辑：
  - 单击请求语音，双击打开主工作台，拖动只移动位置。
  - 小猫气泡右侧提供取消入口；Electron 主进程通过 `desktop-cat:cancel-voice` 通知渲染层清空输入、追问、确认和修改状态，并把小猫切回休息。
  - 小猫透明悬浮窗默认开启鼠标穿透；`bubble.html` 根据鼠标是否落在小猫按钮矩形内通过 preload IPC 通知主进程，主进程调用 `setIgnoreMouseEvents` 切换交互区，避免透明背景挡住后方网页或文档。
  - 主进程记录桌面小猫关键事件和错误。
  - 生产态通过 `server-runner.cjs` 启动本地 API 并加载 `dist` 静态资源。
  - 小猫位置和设置保存到 Electron userData。
- 状态变化：休息、听写、解析、提交、反馈、异常恢复；主窗口创建 / 聚焦 / 关闭。
- 依赖模块：Electron、Windows 系统听写、前端工作台、后端 API。
- 失败情况：IPC 丢失、隐藏输入没收到文本、真实入口仍旧版、API 未启动、运行中的 exe 锁文件。

### 3.6 打包与运行环境模块

- 模块职责：构建 Web 和后端 bundle，生成桌面目录包或安装包，并支持真实入口同步。
- 关键文件：`package.json`、`dist/`、`dist-server/`、`D:\YayaMindBuild\release`。
- 输入：源码、静态资源、Electron 配置、缓存目录。
- 输出：构建产物、目录包、安装包、portable。
- 核心逻辑：
  - `npm run build` 执行 TypeScript 和 Vite 构建。
  - `npm run build:server` 通过 esbuild 生成 `dist-server/index.cjs`。
  - `npm run desktop:pack` 输出 Windows 目录包到 `D:\YayaMindBuild\release`。
- 状态变化：源码 -> dist / dist-server -> win-unpacked -> 同步真实入口。
- 依赖模块：electron-builder、Node、Windows 文件系统。
- 失败情况：端口旧进程、缓存锁、`win-unpacked.tmp` EPERM、构建产物和真实入口混淆。

## 4. 数据设计

### 4.1 数据目录

| 环境 | 数据目录 | 说明 |
|---|---|---|
| Web / API 开发态 | `personal-assistant-data/` | 本地开发默认数据 |
| 桌面真实入口运行态 | `D:\YayaMindData\personal-assistant-data\` | 验收正式入口时优先确认这里 |
| Electron 设置 / 日志 | `D:\YayaMindData\userData\` | 桌面设置和 `desktop-cat.log` |
| 构建输出 | `D:\YayaMindBuild\release` | 构建域，不放用户数据 |
| 真实启动入口 | `D:\YayaMind` | 安装 / 运行域，不手动改业务代码 |

### 4.2 数据对象与字段

| 文件 / 对象 | 字段 | 类型 | 必填 | 读写时机 |
|---|---|---|---|---|
| `events.jsonl` | `id` | string | 是 | 新增日程时生成 |
| `events.jsonl` | `title` | string | 是 | 新增 / 编辑 |
| `events.jsonl` | `date` | `YYYY-MM-DD` | 是 | 新增 / 移动 |
| `events.jsonl` | `startAt` / `endAt` | ISO datetime / null | 视类型 | 明确时间日程必填，待补充事项可为空 |
| `events.jsonl` | `type` | enum | 是 | meeting / task_block / life / exercise / meal / rest / risk / other |
| `events.jsonl` | `status` | enum | 是 | `scheduled`、`cancelled` |
| `events.jsonl` | `preparations` | string[] | 否 | 准备事项 |
| `tasks.jsonl` | `id`、`title` | string | 是 | 新增任务 |
| `tasks.jsonl` | `projectId` | string / null | 否 | 项目待办分组 |
| `tasks.jsonl` | `dueAt` | ISO datetime / date / null | 否 | 设置 deadline |
| `tasks.jsonl` | `status` | enum | 是 | `todo`、`in_progress`、`done`、`cancelled` |
| `tasks.jsonl` | `estimatedMinutes` | number / null | 否 | 估时和过载判断 |
| `todo_projects.json` | `id`、`title`、`order` | string / number | 是 | 项目分类 |
| `reminders.jsonl` | `id`、`title`、`dueAt`、`status` | mixed | 是 | 提醒创建和处理 |
| `work_logs.jsonl` | `id`、`type`、`note`、`taskId`、`at` | mixed | 是 / 否 | 执行记录 |
| `settings.json` | 作息、休息日、城市、AI provider/base URL/model/API Key | object | 否 | 设置页保存；作息生成时间轴休息块，时间轴范围固定 0:00-24:00 |
| `profiles.json` | 习惯画像字段 | object | 否 | 画像生成 / 更新 |
| `summaries/` | Markdown 内容 | text | 是 | 生成每日 / 每周总结 |

节假日 / 调休数据当前在 `src/App.tsx` 内以年度集合维护，MVP 先覆盖 2026 年中国法定节假日和补班日。`settings.habits.showLegalHolidays` 为开关；开启后 `getRestDayClass` 先判断补班日，再判断法定休息日，最后回落到用户选择的单双休 / 大小周规则。

### 4.3 软删除规则

- 日程删除：写回 `status: "cancelled"`，不物理删除 JSONL 行。
- 任务删除：写回 `status: "cancelled"`。
- 执行记录删除：允许删除或标记，具体按当前实现；删除后右侧详情不再展示。
- 软删除记录不得继续参与展示、冲突、重复和过载判断。
- 如未来需要物理清理，必须新增单独维护任务和备份策略，不在普通删除动作中执行。

### 4.4 数据兼容与迁移原则

- 新字段必须有默认值或兼容旧记录缺字段。
- 读取 JSONL 时应跳过或报告坏行，不能让整个工作台空白。
- 未归类作为虚拟项目返回，`todo_projects.json` 中不应长期保存多个“未归类”；历史同名项目聚合时折叠到 `uncategorized`。
- 涉及真实用户数据目录的迁移、清理、覆盖必须先确认路径和备份。
- 开发态数据和桌面真实入口数据不可在汇报中混称。

## 5. 接口设计

| API | 请求字段 | 响应字段 | 写入影响 | 异常响应 / 备注 |
|---|---|---|---|---|
| `GET /api/bootstrap` | 无 | `calendar`、`tasks`、`todoProjects`、`profile`、`settings` 等 | 只读 | 前端初始化和刷新核心接口 |
| `GET /api/calendar` | 日期范围可选 | 日历数据 | 只读 | 可供周视图使用 |
| `GET /api/today` | 日期可选 | 今日详情 | 只读 | 可与右侧详情共用 |
| `GET /api/ai/status` | 无 | AI 配置状态 | 只读 | 不返回 key |
| `PATCH /api/settings` | settings patch | settings | 写 `settings.json` | 用于个人习惯和 AI 接口配置 |
| `POST /api/input/parse` | `text`、`source` | parse 结果、追问、风险、预览 | 不写入 | 解析成功不代表完成 |
| `POST /api/input/commit` | `text`、`source`、`selectedOptionId` 等 | `ok`、`written`、`feedback` | 写 `events` / `tasks` / `reminders` / `work_logs` | 写入后前端必须 refresh |
| `POST /api/events` | `title`、`date`、`startAt`、`endAt`、`type` 等 | 新日程 | 写 `events.jsonl` | 字段缺失返回 400 |
| `PATCH /api/events/:id` | 标题、日期、时间、准备事项等 | 更新结果 | 重写对应 event | 失败不能展示成功态 |
| `DELETE /api/events/:id` | id | cancelled 结果 | 软删除 event | 不物理删除 |
| `POST /api/tasks` | `title`、`notes`、`projectId` | 新任务 | 写 `tasks.jsonl` | 标题缺失返回 400 |
| `PATCH /api/tasks/:id` | 标题、备注、deadline、状态、projectId 等 | 更新结果 | 重写对应 task | 可用于完成 / 移动 / deadline |
| `DELETE /api/tasks/:id` | id | cancelled 结果 | 软删除 task | 不物理删除 |
| `POST /api/todo-projects` | `title`、`reuseExisting` | 新项目 | 写 `todo_projects.json` | 可复用已有项目 |
| `PATCH /api/todo-projects/:id` | `title` | 更新项目 | 写 `todo_projects.json` | 项目名编辑 |
| `DELETE /api/todo-projects/:id` | id | 删除结果 | 更新项目和任务归属 | 任务不能丢失 |
| `POST /api/work/start` | `note`、`taskId` | 工作状态 | 写 `work_logs.jsonl` | 执行记录 |
| `POST /api/work/pause` | `note`、`taskId` | 工作状态 | 写 `work_logs.jsonl` | 暂停 |
| `POST /api/work/resume` | `note`、`taskId` | 工作状态 | 写 `work_logs.jsonl` | 继续 |
| `POST /api/work/finish` | `note`、`taskId` | 工作状态 | 写 `work_logs.jsonl` | 完成 |
| `PATCH /api/work-logs/:id` | `note`、`at` | 更新结果 | 重写 work log | 右侧详情编辑 |
| `DELETE /api/work-logs/:id` | id | 删除结果 | 删除或隐藏 work log | 右侧详情刷新 |
| `GET /api/reminders/pending` | 无 | pending reminders | 只读 | 到点提醒 |
| `POST /api/reminders/:id/done` | id | done 结果 | 写 reminder 状态 | 不重复冒泡 |
| `POST /api/reminders/:id/dismiss` | id | dismissed 结果 | 写 reminder 状态 | 忽略 |
| `POST /api/reminders/:id/snooze` | `minutes` | snoozed 结果 | 写 reminder 状态 | 稍后提醒 |
| `POST /api/summaries/generate` | `kind` | Markdown 路径 / 内容 | 写 `summaries/` | daily / weekly |
| `POST /api/conflicts/check` | title、date、startAt、endAt | 冲突结果 | 只读 | 只检查，不写入 |

接口原则：

- 只解析不写入：`/api/input/parse`、`/api/conflicts/check`、`/api/ai/status`、读取类接口。
- 写入后必须刷新：`/api/input/commit`、events / tasks / work logs / reminders 的 POST / PATCH / DELETE。
- 错误响应必须能被前端转成用户可理解提示，不能只暴露内部枚举。

## 6. 核心流程设计

### 6.1 初始化工作台

```text
打开 Web / 主窗口 -> 前端请求 /api/bootstrap -> 后端聚合数据 -> 前端渲染三栏 -> 选中今天 -> 可继续操作
```

- 验证点：`/api/bootstrap` 返回 JSON；周视图和右侧详情可见；空数据有稳定空态。
- 断点：API 未启动、生产静态资源路径错误、数据文件坏行、前端 fallback 数据误覆盖真实数据。

### 6.2 自然语言输入 parse -> commit -> refresh

```text
输入文本 -> parse -> 追问 / 确认 / 可提交 -> commit -> 写文件 -> refresh bootstrap -> 定位结果 -> 小猫反馈
```

- parse 阶段：不写文件，只生成理解结果和风险。
- commit 阶段：写文件，返回 `written`。
- refresh 阶段：前端重新拉 `/api/bootstrap`，不能只靠本地假状态。
- 断点：只 parse 不 commit、commit 成功但不刷新、需要确认却自动写入、AI 输出未守卫。

### 6.3 桌面小猫语音链路

```text
单击小猫 -> IPC 请求语音 -> Windows 系统听写 -> recognized text -> parse -> auto commit 或追问 -> desktop-cat.log -> refresh
```

- IPC 关键事件：`desktop-cat:request-voice`、`desktop-cat:native-voice-start`、`desktop-cat:native-voice-stop`、`desktop-cat:recognized-text`。
- 日志关键事件：`native-voice-stop`、`desktop-recognized-text`、`desktop-auto-commit-start`、`commit-start`、`commit-success`。
- 断点：点击和拖动误触、听写没有文本、parse 成功但桌面模式看不到确认卡、真实入口旧版。

### 6.4 右侧日期详情编辑

```text
点击日期 / 事项 -> 更新 selectedDate / selectedDetail -> 右侧展示 -> 编辑 / 删除 -> PATCH / DELETE -> refreshData
```

- 选择日期不等于编辑。
- 编辑入口只在双击事项或明确编辑控件后进入；单击事项只选中 / 查看，不进入编辑态。
- 删除默认软删除。
- 断点：右侧状态和周视图不同步、软删除还参与冲突、编辑后不刷新。

### 6.5 项目待办

```text
进入待办页 -> 读取 todoProjects + tasks -> 新增 / 编辑 / 完成 / 移动 / 设置 deadline -> tasks API -> refresh -> 项目列表 / 月历点 / 右侧日期详情同步更新
```

- 项目分组依赖 `projectId`；`null`、`uncategorized` 和历史同名“未归类”项目都归到唯一未归类分组。
- 当天带 `dueAt` 的未取消待办进入右侧日期详情的“待办”区；日程区和待办区分开滚动，不混排。
- 右键删除必须先显示鼠标旁确认菜单；右键本身不触发删除。
- 待办拖拽规则只有两类：同项目内按蓝色插入线排序；跨项目释放到目标项目框内后追加到目标项目末尾。
- 待办拖到右侧月历日期时，不参与项目排序，释放后把该待办 `dueAt` 改到目标日期；月历日期需要显示实时落点反馈，刷新后日期 tag、月历色点和右侧日期详情保持一致。
- 日期 tag 是 deadline 的可视化入口，必须保留按日期远近变化的颜色；移动或重排待办行布局时不能把它降级成普通按钮样式。
- 项目拖拽规则只有两类：同列 / 同顺序内按蓝色插入线排序；跨列视觉上仍按目标项目上方或下方插入到同一项目序列。
- 断点：删除项目导致任务丢失、完成后不下沉、deadline 只在 UI 存在、待办排序改动覆盖拖到月历改 deadline、日期 tag 颜色被普通操作按钮样式覆盖。

### 6.6 桌面阶段收口和真实入口验证

```text
开发态完成 -> npm run desktop:pack -> 同步 win-unpacked 到 D:\YayaMind -> 冷启动 YayaMind.exe -> /api/bootstrap -> 核心交互 / 日志验证
```

- 本流程只在阶段收口执行。
- 必须说明当前汇报是 source / dev / build output / final packaged 哪一层。
- 不要把 `npm run desktop:pack` 成功当作真实入口已验证。
- 断点：运行中 EXE 占用、旧资源残留、同步目录错误、真实入口读写数据目录不同。

### 6.7 MVP -> AI 化 1.0 版本切换

```text
MVP 收口审计 -> 归档 MVP 文档摘要 -> 读取 docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md -> 确认 1.0 范围 -> 同步根级 PRD / SDD / TODO -> 开始 1.0 开发
```

- MVP 根文档不再继续扩功能，只记录收口基线、保留验收项和版本边界。
- 1.0 开发前必须先确认 roadmap 中的 P0 范围，避免把草案整包机械提升为开发承诺。
- 切换后根目录 `PRD.md` / `SDD.md` / `TODO.md` 应代表 AI 化 1.0 当前开发版；MVP 收口依据保留在 `PROJECT_CONTEXT.md` 和 `docs/archive/versions/`。
- 断点：MVP 遗留人工验收被误当成 1.0 新需求、1.0 草案混入 MVP TODO、根文档版本口径和实际开发阶段不一致。

## 7. 状态机与边界处理

| 状态 / 边界 | 触发条件 | 用户反馈 | 系统处理 |
|---|---|---|---|
| 听写中 | 单击桌面小猫或页面语音入口 | 小猫进入听写态 | 接收系统听写或前端输入 |
| 解析中 | 有文本后调用 parse | 显示思考 / 理解中 | 调 `/api/input/parse` |
| 待确认 | 有风险或需要用户选择 | 展示用户能理解的动作 | 不写入，等待选择 |
| 追问中 | 缺日期、时间、类型、对象 | 只问一个关键问题 | 合并补充后重新 parse |
| 写入中 | 调 commit 或编辑 API | 显示提交中 | 调写入接口 |
| 写入成功 | commit / PATCH / DELETE 成功 | 小猫反馈，页面刷新 | 调 `/api/bootstrap` |
| 写入失败 | API 或文件写入失败 | 明确失败提示 | 不更新为成功态 |
| 缺信息 | 时间或事项不足 | 温和追问 | 不自动写入 |
| 冲突 | 真实时间范围重叠 | 修改 / 重叠 / 取消 | 用户确认前不覆盖 |
| 重复 | 任务疑似重复 | 提醒可能重复 | 用户确认前不新增 |
| 过载 | 剩余可用时间不足 | 给少量建议 | 不自动移动已有安排 |
| 桌面入口旧版 | 用户从旧安装目录启动 | 看到旧 UI / 旧链路 | 阶段收口同步并冷启动验证 |
| API 未启动 | 前端请求失败 | 页面错误或空态 | 启动 dev server 或生产 server runner |
| 数据文件异常 | JSON / JSONL 解析失败 | 失败提示，避免空白假成功 | 记录错误，保留原文件 |

## 8. 非功能设计

| 类别 | 设计要求 |
|---|---|
| 性能 | bootstrap 聚合应避免无意义阻塞；高频完成 / 删除应有即时反馈；桌面小猫反馈不能等待长链路无提示 |
| 安全 | 环境变量管理密钥；API 不返回 key；日志不写敏感信息；本地文件写入集中在 dataStore |
| 可用性 | 所有长链路都要有状态反馈；错误提示用户可理解；桌面小猫默认低打扰 |
| 可维护性 | PRD、SDD、TODO、PROJECT_CONTEXT 分工明确；接口和数据结构变化时同步文档 |
| 日志 | 桌面语音、IPC、parse、commit、bubble 需要结构化日志；链路问题先看日志再猜 |
| 可扩展性 | AI、云端、外部日历、移动端都通过边界层扩展，不侵入本地核心闭环 |
| 本地优先和隐私 | 用户数据默认在本地；不做未经授权的后台监听、截图或屏幕理解；清理 / 卸载不碰用户数据 |

## 9. 测试策略

### 9.1 单元测试重点

- 日期和时间解析：今天、明天、下周、下午、时间段。
- 冲突判断：真实时间重叠、前后相邻、已取消记录。
- 任务重复和过载规则。
- 数据读写：JSONL append / rewrite、软删除、旧字段兼容。
- parse / commit 的分离边界。

### 9.2 集成测试重点

- `/api/bootstrap` 聚合所有数据类型。
- `/api/input/parse` 到 `/api/input/commit` 的写入链路。
- events / tasks / work logs PATCH / DELETE 后刷新一致。
- 项目待办 projectId / dueAt / status 组合。
- reminders done / dismiss / snooze 状态。

### 9.3 冒烟测试

- `npm run build`。
- 开发态 `/api/bootstrap` 返回 200 和 JSON。
- 打开 Web 工作台无空白。
- 新增一个日程，刷新后仍存在。
- 删除或取消一个事项，不再展示。

### 9.4 回归测试

- 明确时间不被误追问。
- 缺时间不静默写入。
- 取消 / 删除记录不参与冲突。
- 点击日期不进入编辑。
- 完成 / 删除有即时反馈。
- 小猫默认气泡不挡主视图。

### 9.5 桌面真实入口测试

- 关闭开发服务后从 `D:\YayaMind\YayaMind.exe` 冷启动。
- `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 单击、双击、拖动语义正确。
- 真实说一句后日志出现 `commit-success`，日程刷新。
- 数据写入 `D:\YayaMindData\personal-assistant-data\`。

### 9.6 日志验证

- 桌面语音链路优先看 `D:\YayaMindData\userData\desktop-cat.log`。
- parse / commit 问题看 `parse-preview-*`、`commit-*`、`desktop-auto-commit-*`。
- 终端中文乱码时优先看 escaped 字段或源文件 UTF-8 内容。

### 9.7 用户手动验收场景

- 用户真实麦克风说一句明确日程。
- 用户说一句缺时间的安排。
- 用户拖动桌面小猫，释放后不触发听写。
- 用户双击小猫打开工作台。
- 用户从真实入口启动，而不是浏览器预览。

## 10. 部署与运维设计

### 10.1 开发态启动

- 同时启动 API 和 Web：

```bash
npm run dev
```

- Web：`http://localhost:5173`
- API：`http://localhost:8787`
- 数据：`personal-assistant-data/`

### 10.2 桌面开发态启动

```bash
npm run desktop:dev
```

如果 API 和 Web 已经在运行，只打开 Electron：

```bash
npm run desktop:open
```

注意：端口占用时要确认当前窗口连接的是不是本轮代码。

### 10.3 打包

```bash
npm run desktop:pack
```

- 构建 Web：`dist/`
- 构建后端：`dist-server/`
- 输出目录包：`D:\YayaMindBuild\release\win-unpacked`

### 10.4 同步真实入口

- 只在阶段收口执行。
- 来源：`D:\YayaMindBuild\release\win-unpacked`
- 目标：`D:\YayaMind`
- 同步后必须从 `D:\YayaMind\YayaMind.exe` 冷启动验证。
- 2026-06-22 MVP 最终收口已执行 `npm run build`、`npm run desktop:pack`、同步真实入口、资源核验和真实入口冷启动验证；`http://127.0.0.1:8787/api/bootstrap` 返回 200。用户真实麦克风开口写入仍属于人工验收项。

### 10.5 日志位置

| 日志 | 位置 | 用途 |
|---|---|---|
| 桌面小猫日志 | `D:\YayaMindData\userData\desktop-cat.log` | IPC、听写、parse、commit、气泡 |
| 开发服务日志 | `dev-server.log` | 本地 API / Web 开发诊断 |
| API 测试日志 | `server-test.log` | API 回放和测试结果 |
| 运行记录 | `.run-logs/` | 本地运行记录，按需查 |

### 10.6 常见故障排查

| 问题 | 优先检查 |
|---|---|
| 页面空白 | `/api/bootstrap` 是否 JSON、Vite 是否连当前代码、控制台错误 |
| 改了没生效 | 端口是否连接旧服务、桌面真实入口是否旧包 |
| 语音能听见但不写入 | `desktop-recognized-text` 后是否有 `desktop-auto-commit-start` 和 `commit-success` |
| 打包后 404 | `DESKTOP_STATIC_DIR`、`dist/` 是否存在、server runner 是否启动 |
| 删除后仍冲突 | 记录是否 `cancelled`，冲突函数是否过滤 |
| 真实入口旧版 | 是否同步到 `D:\YayaMind`，是否清理旧 hashed 资源，是否冷启动 |
| 中文乱码 | 源文件是否 UTF-8，是否已有 mojibake，别只怀疑字体 |
| 版本切换混乱 | 根级 `PRD.md` / `SDD.md` / `TODO.md` 当前是否仍是 MVP；1.0 是否只从 `docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md` 启动 |

### 10.7 运维边界

- 不把构建输出、安装目录和用户数据目录混放。
- 不在普通开发阶段频繁同步半成品到真实入口。
- 不把打包成功当作真实入口已验证。
- 不手动删除或迁移用户数据目录，除非用户明确授权并完成路径确认。

## 11. 文档维护规则

- 功能范围、优先级、验收变化：同步 `PRD.md`。
- 模块、接口、数据结构、链路、测试策略变化：同步 `SDD.md`。
- 当前任务和状态变化：同步 `TODO.md`。
- 历史进展、重要决策、验证结果、风险：追加到 `PROJECT_CONTEXT.md`。
- 文件、目录、日志、数据位置变化：同步 `FILE_INDEX.md`。
- PRD / SDD 不写流水账、复盘原因或长期历史；这些内容进入 `PROJECT_CONTEXT.md` 或经验库。
