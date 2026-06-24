# SDD - YayaMind AI 1.0 软件设计文档

## 1. 文档信息

- 文档名称：YayaMind AI 1.0 软件设计文档
- 当前版本：AI 化 1.0
- 关联 PRD：`PRD.md`，2026-06-24
- 更新日期：2026-06-24
- 状态：1.0 开发版
- 实现状态：2026-06-22 已完成规则型可运行闭环并通过开发态 API 回放 / build
- 维护者：用户 + Codex
- 历史来源：
  - `docs/archive/versions/2026-06-22-ai-1.0-switch/MVP-SDD.md`
  - `docs/archive/versions/2026-06-22-ai-1.0-switch/AI-1.0-initial-roadmap-PRD-SDD.md`
  - `docs/archive/versions/2026-06-22-ai-1.0-switch/AI-1.0-discussion-draft.md`

## 2. 架构目标

AI 1.0 不推翻 MVP 的本地优先架构，而是在现有 React 工作台、Fastify 本地 API、Electron 小猫和 JSON/JSONL 数据层上新增 AI 会话与规划层。

```text
桌面小猫 / Web 输入
-> 会话状态机
-> 转写确认与轻量纠错
-> 画像 / 标题词表 / 历史实体上下文
-> 输入理解与意图路由
-> 草稿 / 候选 / 修改计划生成
-> 用户确认 / 修改 / 取消
-> commit 写入本地数据
-> bootstrap 刷新工作台
```

## 3. 模块设计

| 模块 | 职责 | 可能涉及文件 |
|---|---|---|
| Conversation State Machine | 管理听写、理解、等待补充、等待确认、候选选择、执行和完成状态 | `src/App.tsx`、`electron/main.cjs`、`electron/preload.cjs` |
| Speech Finalization | 手动开始 / 结束语音、原文确认、轻量纠错、文本整理状态 | `src/App.tsx`、`electron/bubble.html` |
| Draft Manager | 管理整组草稿、跨模块预览、确认 / 修改 / 取消、恢复未确认草稿 | `src/App.tsx`、`server/types.ts`、后端草稿结构 |
| Cat Dialog Stream | 渲染悬浮小猫内的用户原话、系统回答、追问、输入提示和确认按钮，并把按钮选择回传主应用 | `src/App.tsx`、`electron/bubble.html`、`electron/main.cjs`、`electron/preload.cjs` |
| Intent Router | 区分新增、规划、修改、删除、批量、画像修改、习惯周期 | `server/dataStore.ts`、`server/aiAdapter.ts` |
| Profile & Lexicon Context | 生成标题词表、画像统计、历史实体候选、query rewrite 上下文 | `server/dataStore.ts`、`server/types.ts` |
| Global Mutation Planner | 生成单项修改、删除确认、多候选选择、批量候选清单 | `server/dataStore.ts` |
| Batch Operation Executor | 确认后逐条执行批量操作，返回成功和失败项 | `server/dataStore.ts`、`server/index.ts` |
| Habit / Recurring Rules | 管理习惯、周期规则和日历动态实例 | `server/dataStore.ts`、`server/types.ts` |
| Feedback Layer | 小猫对话框展示当前等待动作、成功、失败、冲突提醒 | `src/App.tsx`、`electron/bubble.html` |

## 4. 核心状态机

### 4.1 会话状态

```text
idle
-> listening
-> heard_original
-> organizing_text
-> understanding
-> awaiting_confirmation
-> awaiting_selection
-> awaiting_clarification
-> executing
-> completed
```

### 4.2 状态规则

- `listening` 由用户单击开始，第二次单击结束。
- 停顿、然后、等一下不作为结束判断。
- `heard_original` 展示“我听到的是...”。
- `organizing_text` 和 `understanding` 不写入正式数据。
- `awaiting_confirmation` 可绑定草稿、删除、批量候选、项目删除等。
- `awaiting_selection` 用于多个候选，例如多个面试。
- `awaiting_clarification` 用于“挪到几点”等追问。
- 新输入进入时，先判断是回答当前会话，还是开启新任务。
- 新任务不能丢；旧未确认上下文也不能无故丢。
- `awaiting_confirmation` 和 `awaiting_clarification` 在桌面真实入口中必须映射到悬浮小猫对话流；主窗口只展示草稿投影和候选数据，不承担主要确认入口。
- 桌面端存在 `pendingClarification`、`parsePreview.questions` 或服务端 `conversation_context.activeDraftId` 时，后续语音识别文本优先作为本轮补充提交，不重新走新任务 parse。
- 用户关闭悬浮对话框或选择取消前，`conversation_context` 必须持续绑定当前草稿 / 候选 / 追问；取消或完成后才能清理。

## 5. 数据设计

### 5.1 PlanDraft

```ts
type PlanDraft = {
  id: string;
  sourceText: string;
  date: string;
  status: "draft" | "confirmed" | "cancelled";
  items: PlanDraftItem[];
  assumptions: string[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

type PlanDraftItem = {
  id: string;
  kind: "event" | "task" | "reminder" | "profile_update" | "habit_rule";
  title: string;
  targetDate?: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  remindAt?: string;
  projectId?: string | null;
  source: "user_explicit" | "profile_inferred" | "lexicon_normalized" | "default_assumption" | "system_generated";
  confidence?: number;
  risk?: string;
};
```

草稿未确认前不写入正式 events / tasks / reminders。为支持恢复，草稿可以落到独立 pending 文件或会话存储；实现时必须保证未确认草稿不被当成正式数据。

当前实现：草稿落到 `plan_drafts.json`，会话状态落到 `conversation_context.json`。`/api/input/parse` 允许写入这两个 pending 文件用于恢复和预览，但不会写入正式 `events.jsonl` / `tasks.jsonl` / `reminders.jsonl`。

草稿投影规则：

- 有明确 `startAt` / `remindAt` / `dueAt` 的草稿项可以投影到一周时间轴、提醒区或待办区，但必须携带 `isDraft` / `draftId` 并使用草稿视觉。
- 缺少饭点、开始时间、结束时间或关键内容的草稿项保留在整组草稿与小猫追问中，不应伪造成正式可执行日程。
- 取消整组草稿时，所有投影必须一起消失；单独右键删除草稿投影时，本质也是取消当前整组草稿。
- 草稿补充规则：`modifyPlanDraft` 接收补充文本后，先按草稿项标题和别名切分子句，再分别调用时间解析；一句补充可以同时填充面试、项目、健身等多个草稿项。
- 问题生成规则：`buildPlanDraftQuestion` 必须基于补充后的草稿重新计算，只对仍缺少 `startAt` / `dueAt` / `remindAt` 或仍有时间风险的项目提问。
- 类型修正规则：因缺少时间而暂存为 task 的带时长安排，如果补充后获得明确时间段，应转为 event 草稿块，用于时间轴预览和后续正式日程写入。

### 5.2 ConversationContext

```ts
type ConversationContext = {
  id: string;
  state: "idle" | "listening" | "awaiting_confirmation" | "awaiting_selection" | "awaiting_clarification" | "executing" | "completed";
  activeDraftId?: string;
  pendingAction?: PendingAction;
  pendingCandidates?: CandidateItem[];
  lastUserText?: string;
  createdAt: string;
  updatedAt: string;
};
```

上下文用于防止多轮对话串线。候选选择和未确认草稿应可恢复；用户取消或完成后清理对应上下文。

### 5.3 CatDialogPayload

```ts
type CatDialogPayload = {
  type: "cat-dialog-v1";
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system" | "input";
    text: string;
  }>;
  options?: Array<{ id: string; label: string }>;
  status?: string; // 兼容旧 payload；新对话流优先用 messages 表达状态，避免重复显示。
};
```

桌面主应用通过 `desktop-cat:message` 向悬浮小猫发送结构化 payload。`electron/bubble.html` 负责渲染可滚动对话流；选项点击通过 `bubble:select-option -> desktop-cat:bubble-option` 回传给 `src/App.tsx`，再进入 `/api/input/commit`。
状态呈现原则：同一状态只由一个用户可见层表达。追问场景直接展示缺失问题；内部的草稿生成、parse、pending 写入等过程不作为面向用户的主文案。

追问交互原则：

- 缺少时间、地点或关键内容时，问题文案必须直接问用户需要补充的信息，例如“面试什么时间？”“健身什么时间？”，不把“时间不确定：请问...”这类状态解释展示给用户。
- 缺时间的整组草稿只提供“先放待定 / 全部取消”两个动作；等所有关键时间补齐或可由画像可靠推断后，才展示“确认全部 / 全部取消”。
- 桌面真实入口在进入追问后必须重新请求系统听写，并在小猫对话框内保留问题与“我在听”输入提示，避免按钮替代语音回答。
- 后续听写的实时转写仍通过 `cat-dialog-v1.messages` 追加临时用户气泡；即使已有历史消息，也不能只显示“我正在听”而丢失输入内容。
- `具体安排` 展示层优先使用精炼后的摘要文本，后端写入和前端展示都要避免直接把完整口语原文塞进详情卡。

### 5.4 Profile & Lexicon

```ts
type ProfileHabitValue<T> = {
  value: T;
  confidence: number;
  evidenceCount: number;
  lastUpdated: string;
};

type TitleLexiconItem = {
  canonicalTitle: string;
  aliases: string[];
  type?: "event" | "task" | "habit" | "project" | "custom";
  evidenceCount: number;
  lastSeenAt: string;
};
```

画像和词表可以先动态抽取，后续根据性能和可解释性缓存为 `profile_lexicon.json` 或扩展 `profiles.json`。

### 5.5 BatchOperation

```ts
type BatchOperationPreview = {
  id: string;
  sourceText: string;
  action: "delete" | "update_time" | "move_project" | "move_date" | "update_status";
  candidates: CandidateItem[];
  warnings: string[];
};

type BatchOperationResult = {
  ok: boolean;
  succeeded: CandidateItem[];
  failed: Array<{ item: CandidateItem; reason: string }>;
};
```

候选清单在主工作台右侧展示，小猫只提示用户当前等待确认。

### 5.6 Habit / RecurringRule

```ts
type RecurringRule = {
  id: string;
  title: string;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  timeHint?: string;
  targetKind: "event" | "task" | "reminder";
  nextOccurrences: string[];
  status: "active" | "paused" | "cancelled";
  createdAt: string;
  updatedAt: string;
};
```

有明确时间的周期规则在日历视图中动态生成日程实例，无明确时间的习惯生成待办或提醒。

当前实现：周期规则确认后只写入 `recurring_rules.json`；`/api/bootstrap` 根据有效周期规则和当前可见日期动态生成日历实例，不再把预览实例写成正式 event / task，避免“永久规则”被误落成有限几天的普通日程。

## 6. 接口设计

第一版可沿用现有 `/api/input/parse` 和 `/api/input/commit`，但需要扩展返回结构。

| 接口 | 1.0 行为 |
|---|---|
| `POST /api/input/parse` | 返回 intent、conversationState、draft、candidates、pendingAction、feedback |
| `POST /api/input/commit` | 根据 selectedOptionId / pendingAction 确认草稿、执行修改、执行批量操作 |
| `GET /api/bootstrap` | 返回正式数据、可恢复草稿、画像、词表摘要、习惯规则摘要 |
| `PATCH /api/settings` | 继续支持设置和 AI 配置 |
| 后续可选接口 | 如果 parse / commit 过重，再拆 `drafts`、`conversation`、`batch`、`profile` 专用接口 |

接口原则：

- parse 阶段不写正式业务数据。
- 未确认草稿不进入正式展示状态，但应能在 UI 中以草稿态渲染。
- commit 写入后必须刷新 bootstrap。
- 错误响应要能转成用户可理解提示。

当前扩展返回：

- `ParseResult.conversationState`：当前会话状态。
- `ParseResult.draft`：整组草稿。
- `ParseResult.candidates`：单项修改 / 删除或批量操作候选。
- `ParseResult.batchOperation`：批量操作预览。
- `/api/bootstrap.planDrafts`：未确认草稿。
- `/api/bootstrap.titleLexicon`：从历史正式数据动态抽取的标题词表。
- `/api/bootstrap.recurringRules`：已确认的有效周期规则。

## 7. 核心流程

### 7.1 长语音到整组草稿

```text
单击开始
-> listening
-> 再次单击结束
-> 显示原文确认
-> 文本整理 / 轻量纠错
-> parse + 画像 / 词表上下文
-> 生成 PlanDraft
-> 有明确时间的日程 / 待办 / 提醒跨模块草稿预览
-> 时间不明确的事项标记待补充
-> 悬浮小猫显示对话流、追问、确认全部 / 修改 / 取消
```

实现约束：

- `src/App.tsx` 组装 `cat-dialog-v1`，至少包含用户原话、系统结果、追问和输入提示。
- `electron/bubble.html` 对话内容超过窗口高度时滚动，不自动隐藏等待确认或等待补充状态。
- 用户选择确认 / 修改 / 取消时，悬浮窗通过 IPC 回传 optionId；主应用不得要求用户先切回主窗口。
- 如果画像不足，`server/dataStore.ts` 应返回 `risk` 和 `questions`，不能为“吃饭前 / 饭后 / 晚上健身”硬填默认时间。
- 桌面系统听写启动前，`electron/main.cjs` 先让主窗口发送 `desktop-cat:native-voice-start`，`src/App.tsx` 聚焦 `.system-dictation-capture` 后回报 `desktop-cat:dictation-target-ready`；主进程收到 `focused=true` 后再触发 Win+H，避免 Windows 听写提示“没有输入框”。

### 7.2 草稿确认

```text
确认全部
-> PlanDraftItem 拆分
-> event 写 events.jsonl
-> task 写 tasks.jsonl
-> reminder 写 reminders.jsonl
-> profile_update 写 profiles.json 或 pending evidence
-> habit_rule 写 recurring_rules / habits 数据
-> refresh bootstrap
```

### 7.3 草稿修改

```text
用户点 修改
-> 重新听写或输入修改说明
-> 绑定 activeDraftId
-> 只修改当前草稿
-> 不影响正式数据
```

### 7.4 全局修改

```text
用户说修改 / 删除 / 改画像
-> intent router 判定动作
-> 匹配候选
-> 0 个候选：追问或询问是否新建
-> 1 个候选：按风险直接执行或确认
-> 多个候选：展示候选选择
-> commit 执行
-> refresh bootstrap
```

### 7.5 批量操作

```text
用户表达批量意图
-> 生成 BatchOperationPreview
-> 主工作台右侧展示候选清单
-> 小猫等待确认
-> 用户确认
-> 逐条执行
-> 成功项刷新，失败项短反馈
```

### 7.6 画像总结

```text
第二天首次打开 / 后台可运行
-> 找到缺失总结日期
-> 读取最终事实
-> 更新标题词表、常见时间、常见时长、置信度
-> 标记 summary date 已处理
```

## 8. 状态与边界

| 边界 | 处理 |
|---|---|
| 用户打断当前草稿 | 保留旧草稿，记录新任务，询问保留还是取消 |
| 用户离开或关闭应用 | 未确认草稿和候选可恢复，不写正式数据 |
| 用户说“算了” | 取消当前追问 / 修改，不影响原数据 |
| 多候选 | 必须让用户选择 |
| 批量操作 | 必须展示影响范围并确认 |
| 删除整个项目 | 高影响确认，说明待办处理方式 |
| 画像不足 | 回到追问，不装懂 |
| 草稿冲突 | 并排显示，草稿保持草稿色 |
| 简单明确冲突 | 可写入并提醒冲突 |

## 9. 测试策略

### 单元测试

- 会话状态切换。
- 新输入属于回答上一轮还是新意图。
- 标题词表归一。
- 画像统计中位数 / 高频规则。
- 批量候选匹配。
- 习惯周期实例生成。

### 集成测试

- `/api/input/parse` 返回草稿且不写正式文件。
- 草稿确认后拆写 events / tasks / reminders。
- 草稿取消后不落库。
- 批量操作部分成功 / 失败结果。
- 画像总结补做缺失日期。

### 2026-06-22 开发态回放

- 临时数据目录：`.run-logs/ai10-test-data`。
- 回放脚本：`.run-logs/ai10-api-test.mjs`。
- 覆盖链路：
  - 长语音复杂规划生成 4 项整组草稿，parse 阶段不写正式 events。
  - 修改当前草稿，“把健身改到九点”只改 draft，确认后写入正式数据。
  - “每周六下午三点上课”生成周期规则，日历实例由 bootstrap 动态渲染。
  - “把今天下午所有安排往后挪一小时”生成批量候选并确认执行。
  - “我最近每天0点睡，8点起”写入作息画像，结果为 `sleepStart=00:00`、`wakeUp=08:00`。
- 构建验证：`npm run build` 通过。

### 用户验收

- 长语音整组草稿。
- 打断后旧草稿可恢复，新任务不丢。
- 小猫全局修改和删除确认。
- 右侧批量候选清单。
- 画像推断和标题归一。
- 习惯周期规则。

## 10. 部署与运维

- 开发态继续使用 `npm run dev`。
- 涉及桌面小猫、Electron IPC、真实入口语音时，阶段收口仍需 `desktop:pack`、同步 `D:\YayaMind`、冷启动真实入口。
- 本轮文档切换不修改代码、不打包、不同步真实入口。
