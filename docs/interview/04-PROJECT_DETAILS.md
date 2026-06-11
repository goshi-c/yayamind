# YayaMind 项目详情与面试讲解稿

## 1. 一句话介绍

YayaMind 是一个本地优先的 AI 个人助手 Web MVP。它用 React/Vite 做前端工作台，用 Fastify 做本地后端，用 JSON/JSONL/Markdown 做数据层，通过语音和自然语言输入，把用户的口语安排转成日程、项目待办、提醒、执行记录和总结。

面试时可以这样开场：

> 这个项目不是普通 TODO，而是我从自己的学习、求职和项目管理痛点出发，做的一个 AI 个人执行助手。它的核心闭环是：用户用自然语言说一句安排，小猫助手理解并确认，后端写入本地结构化数据，前端在一周日程、项目待办和右侧详情中展示，并支持后续修改、提醒和复盘。

## 2. 项目目录结构

```text
个人助手/
  package.json
  vite.config.ts
  README.md
  PROJECT_CONTEXT.md
  TODO.md
  TASK_LOG.md
  DECISIONS.md

  src/
    App.tsx
    main.tsx
    styles.css
    assets/
      ragdoll-avatar.png

  server/
    index.ts
    dataStore.ts
    aiAdapter.ts
    types.ts

  personal-assistant-data/
    events.jsonl
    tasks.jsonl
    todo_projects.json
    work_logs.jsonl
    reminders.jsonl
    goals.json
    profiles.json
    settings.json
    summaries/

  docs/
    sdd/
    portfolio/
    interview/
```

## 3. 技术栈解释

### 前端为什么用 React + Vite

选择原因：

- React 适合做状态复杂的单页工作台；
- Vite 启动快，适合本地快速迭代；
- TypeScript 能约束数据结构；
- 作为作品集，React/Vite 是面试官容易理解的技术栈。

前端主要负责：

- 页面布局；
- 交互状态；
- 调用后端 API；
- 展示数据；
- 处理拖拽、语音、编辑、确认卡片。

### 后端为什么用 Fastify

选择原因：

- Fastify 轻量，适合本地 API；
- Node/TypeScript 与前端语言一致；
- 本地服务能读写文件；
- 方便后续迁移到桌面应用。

后端主要负责：

- 读取和写入本地数据；
- 解析自然语言；
- 接入 AI；
- 处理业务规则；
- 输出前端所需聚合数据。

### 为什么不用数据库

MVP 阶段没有用 SQLite 或云数据库，而是选择本地 JSON/JSONL。

原因：

- 项目目标是验证产品闭环，不是先做复杂持久化；
- JSONL 便于追加记录；
- 用户可以直接检查数据；
- 和 Obsidian/Markdown 生态更近；
- 面试时更容易解释数据结构。

未来如果要做长期产品，可以迁移到 SQLite 或 IndexedDB。

## 4. 前端结构

### 4.1 `src/main.tsx`

职责：

- React 入口；
- 挂载 `App`；
- 加载全局样式。

### 4.2 `src/App.tsx`

这是前端核心文件，包含页面状态、用户交互和渲染逻辑。

主要状态：

```text
data                 后端返回的完整数据
viewMode             当前导航：一周/待办/目标/画像/总结
selectedDate         当前选中日期
parsePreview         输入理解预览
pendingClarification 等待用户补充的问题
pendingDecision      冲突/重复等决策
pendingPostCommit    写入后确认/修改/取消
selectedDetail       右侧正在编辑的日程/任务/日志
dragPreview          日程拖动中的预览
todoProjectPage      核心项目页/其他项目页
```

核心模块：

- 左侧导航；
- 一周日程；
- 项目待办；
- 右侧详情；
- 目标和画像；
- Markdown 总结；
- 小猫语音浮窗；
- 日程拖拽；
- 项目待办拖拽；
- 内联编辑。

### 4.3 `src/styles.css`

负责整体视觉：

- 暖色浅色工作台；
- 三列项目待办；
- 半小时时间轴；
- 日程卡片；
- 小猫浮窗；
- 右侧详情；
- 日期 tag 色阶；
- 响应式和滚动区域。

### 4.4 前端如何调用后端

前端用 `fetch` 调用 `/api/...`。

Vite 配置：

```ts
server: {
  port: 5173,
  proxy: {
    '/api': 'http://localhost:8787'
  }
}
```

这意味着：

- 用户打开 `http://localhost:5173`；
- 前端请求 `/api/bootstrap`；
- Vite 把请求代理到 `http://localhost:8787/api/bootstrap`；
- 后端返回 JSON；
- 前端刷新页面状态。

## 5. 后端结构

### 5.1 `server/index.ts`

这是后端入口。

职责：

- 创建 Fastify app；
- 注册 API 路由；
- 调用 `ensureDataFiles()` 初始化数据文件；
- 监听 `127.0.0.1:8787`。

重要 API：

```text
GET    /api/bootstrap
GET    /api/ai/status
GET    /api/calendar
GET    /api/today
POST   /api/input/parse
POST   /api/input/commit
PATCH  /api/events/:id
DELETE /api/events/:id
POST   /api/tasks
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
POST   /api/todo-projects
PATCH  /api/todo-projects/:id
DELETE /api/todo-projects/:id
POST   /api/summaries/generate
```

面试表达：

> 前端不直接读写文件，而是统一通过 Fastify API。这样后续如果要迁移到桌面端或者换数据库，只需要保留 API 契约，前端改动会比较小。

### 5.2 `server/dataStore.ts`

这是业务核心。

职责：

- 数据文件路径管理；
- 确保文件存在；
- JSON/JSONL 读写；
- 输入解析；
- 日程和任务写入；
- 冲突判断；
- 日历构造；
- 项目待办构造；
- 天气提醒；
- Markdown 总结；
- 个人画像。

关键数据流都在这里完成。

### 5.3 `server/aiAdapter.ts`

职责：

- 读取 `.env.local` 中的 DeepSeek 配置；
- 提供 AI 状态；
- 调用模型解析自然语言；
- 调用模型进行语音转写纠错；
- 失败时让业务层回退规则解析。

面试表达：

> 我没有让 AI 直接写数据，而是让 AI 只返回结构化意图。真正写入前会经过本地规则校验，例如日期、时间、待办备注、冲突判断等，避免 AI 幻觉直接污染本地数据。

### 5.4 `server/types.ts`

定义核心类型：

- `EventRecord`：日程；
- `TaskRecord`：任务/待办；
- `TodoProjectRecord`：项目分类；
- `WorkLogRecord`：执行记录；
- `ReminderRecord`：提醒；
- `GoalRecord`：目标；
- `ProfileData`：个人画像；
- `ParseResult`：输入解析结果；
- `ParsedIntent`：意图枚举。

这些类型让前后端数据更稳定，也方便面试时讲清数据模型。

## 6. 数据文件说明

### 6.1 `events.jsonl`

保存有明确日期和时间的日程。

典型字段：

- `id`
- `type`
- `title`
- `date`
- `startAt`
- `endAt`
- `preparations`
- `notes`
- `status`
- `rawText`

### 6.2 `tasks.jsonl`

保存项目待办、截止任务、待补充事项。

典型字段：

- `id`
- `title`
- `status`
- `dueAt`
- `notes`
- `projectId`
- `tags`
- `rawText`

### 6.3 `todo_projects.json`

保存项目分类。

当前默认项目：

- 工作；
- 学校；
- 生活。

其他项目通过“其他项目”分页展示。

### 6.4 `work_logs.jsonl`

保存执行记录，例如开始、暂停、继续、完成。

### 6.5 `reminders.jsonl`

保存提醒，包括事件提醒和状态。

### 6.6 `goals.json`

保存阶段性目标。

### 6.7 `profiles.json`

保存个人画像雏形，例如时间习惯、估时模式、生活节奏。

### 6.8 `settings.json`

保存本地配置，例如时区、天气城市等。

### 6.9 `summaries/`

保存 Markdown 总结。

## 7. 核心数据流详解

### 7.1 页面初始化

1. 用户打开 `localhost:5173`；
2. React 前端加载；
3. `refreshData()` 调用 `/api/bootstrap`；
4. Fastify 调用 `getBootstrapData()`；
5. `dataStore` 读取本地文件；
6. 构造：
   - `today`
   - `calendar`
   - `todoProjects`
   - `tasks`
   - `goals`
   - `profile`
   - `settings`
7. 前端 `setData()`；
8. 页面渲染。

### 7.2 输入解析

1. 用户输入文本或语音；
2. 前端调用 `/api/input/parse`；
3. 后端执行 `parseAndEnrichTextInput()`；
4. 先做规则判断；
5. 必要时调用 AI；
6. 再做守卫：
   - 日期修正；
   - 时间修正；
   - 明确时间覆盖 AI；
   - 待办备注清洗；
   - 冲突/重复判断；
7. 返回 `ParseResult`；
8. 前端展示理解预览、追问或决策卡片。

### 7.3 输入提交

1. 用户确认；
2. 前端调用 `/api/input/commit`；
3. 后端再次解析或使用决策选项；
4. 根据 intent 写入：
   - `add_event` -> `events.jsonl`
   - `add_task` -> `tasks.jsonl`
   - `add_reminder` -> `reminders.jsonl`
   - `log_progress` -> `work_logs.jsonl`
5. 返回写入结果；
6. 前端刷新数据；
7. 页面跳到对应日期或项目。

### 7.4 日程拖拽

1. 用户按住日程块；
2. 前端根据鼠标位置计算分钟；
3. 按半小时吸附；
4. 更新 `dragPreview`；
5. 松手后调用 `PATCH /api/events/:id`；
6. 后端更新 `events.jsonl`；
7. 前端刷新。

### 7.5 项目待办拖拽到月历

1. 用户拖动待办；
2. 放到右侧月历某一天；
3. 前端调用 `PATCH /api/tasks/:id`；
4. 写入 `dueAt`；
5. 日期 tag 显示；
6. 根据 deadline 紧急程度显示色阶。

### 7.6 总结生成

1. 用户点击“生成今日总结”或“生成本周总结”；
2. 前端调用 `/api/summaries/generate`；
3. 后端读取日程、任务、执行记录、提醒；
4. 生成 Markdown；
5. 写入 `summaries/`；
6. 前端展示生成成功路径。

## 8. 产品功能结构

### 一周

用于看时间安排。

包含：

- 周一到周日；
- 当前时间线；
- 过去遮罩；
- 日程块；
- 冲突标记；
- 未来安排入口。

### 待办

用于看项目任务。

包含：

- 工作；
- 学校；
- 生活；
- 其他项目；
- 月历 deadline；
- 日期紧急色阶。

### 目标

用于管理阶段性目标。

### 画像

用于展示系统从执行记录中观察到的个人习惯。

### 总结

用于生成 Markdown 总结。

## 9. AI 解析策略

### 为什么不是纯 AI

纯 AI 容易出现：

- 日期误判；
- 把任务内容当地点；
- 把修改当新增；
- 生成不稳定字段；
- 成本和延迟不可控。

### 当前策略

- 规则优先处理明确表达；
- AI 处理复杂口语；
- guard 修正 AI 输出；
- 写入前确认；
- 写入后可撤销或修改。

### 示例

输入：

```text
工作新增一个待办，今天要把我的简历和其中的项目介绍重新改写一下，并且要自己能熟练地介绍每一个项目
```

系统应识别：

- intent：`add_task`
- project：工作
- title：改写简历和项目介绍，并熟练介绍每个项目
- dueAt：今天
- notes：不应误写成“地点：介绍每一个项目”

## 10. 面试讲解顺序

建议按这个顺序讲：

1. 背景：我为什么做；
2. 用户：谁会用；
3. 痛点：普通 TODO/日历解决不了什么；
4. 产品定位：AI 执行助手；
5. MVP：先做 Web 工作台；
6. 架构：React + Fastify + 本地数据；
7. 数据流：自然语言 -> 解析 -> 写入 -> 展示；
8. 亮点：语音、小猫、确认、项目待办、半小时时间轴、本地优先；
9. 迭代：从 MVP 到 V1.1；
10. 不足：桌面壳、多端、长期画像还没做；
11. 后续：桌面化、Obsidian 集成、作息偏好。

## 11. 项目亮点

- 产品从真实个人场景出发，不是模板项目；
- 有 PRD、SDD、TODO、TASK_LOG、DECISIONS；
- 有前后端和本地数据闭环；
- 有 AI 接入和规则兜底；
- 有语音交互和小猫角色；
- 有项目待办、日程、提醒、总结多个模块；
- 有持续迭代记录；
- 能讲清取舍和后续规划。

## 12. 项目不足

- 仍是 Web MVP，不是真正桌面应用；
- 数据文件还没有数据库级事务；
- AI 解析还有延迟和误判风险；
- 浏览器语音识别受环境影响；
- 移动端适配不是当前重点；
- 没有账号和云同步；
- 个人画像还处于雏形。

## 13. 推荐面试结尾

> 这个项目最大的价值不是我做了一个日历页面，而是我完整走了一遍 AI 产品从需求发现、PRD、SDD、MVP、用户反馈到迭代收尾的过程。它既能体现产品思维，也能体现我对前后端、数据流和 AI 接入边界的理解。后续如果继续做，我会优先把它封装成桌面助手，并和 Obsidian 知识库联动。

