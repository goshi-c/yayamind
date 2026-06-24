# YayaMind AI 化 1.0 迭代方案 - PRD / SDD 草案

## 0. 文档边界

- 文档名称：YayaMind AI 化 1.0 迭代方案 - PRD / SDD 草案
- 版本口径：1.0 候选版本，不属于当前 MVP 收口范围
- 当前状态：规划冻结草案，等待 MVP 收口后进入开发
- 更新日期：2026-06-17
- 维护者：用户 + Codex
- 关联当前主文档：`../../PRD.md`、`../../SDD.md`、`../../TODO.md`

### 使用规则

- 当前根目录 `PRD.md` / `SDD.md` 仍以 MVP 收口版为准。
- 本文档只承载 1.0 的需求、设计和开发入口，不要求当前立即实现。
- 当用户明确说“开始 1.0 版本开发”或“MVP 已收口，进入 AI 化 1.0”时，Codex 才应把本文档作为 1.0 开发依据。
- 进入 1.0 开发前，应先把本文档拆分或同步到当时的根级 `PRD.md` / `SDD.md` / `TODO.md`，并将当前版本口径从 MVP 收口切换为 AI 化 1.0。
- 本文档不写入当前 MVP TODO 的必须完成项，避免版本混淆。

### 版本隔离

| 文档 / 区域 | 作用 | 当前是否执行 |
|---|---|---|
| 根目录 `PRD.md` | 当前 MVP 收口需求主文档 | 是 |
| 根目录 `SDD.md` | 当前 MVP 收口软件设计主文档 | 是 |
| 根目录 `TODO.md` | 当前 MVP 收口任务清单 | 是 |
| 本文档 | AI 化 1.0 候选版本 PRD / SDD / TODO 草案 | 否，MVP 收口后启用 |

## 1. 产品判断

1.0 的核心判断：

```text
日历是展示层，不是核心。
核心是语音对话、模糊时间理解、个人画像学习、今日安排草稿。
```

当前产品已经具备语音输入、日程、待办、提醒、小猫浮窗和个人画像雏形，但体验正在滑向“用户手动把事情填进日历”。1.0 要把 YayaMind 拉回“AI 个人执行助手”：用户随口说今天要做什么，系统先理解为今日规划，结合个人习惯补全时间，生成可确认草稿，确认后才写入日程、待办和提醒。

## 2. PRD 1.0 草案

### 2.1 文档信息

- 产品名称：YayaMind
- 版本名称：AI 化 1.0
- 当前阶段：MVP 后续版本规划
- 目标用户：希望用自然语言安排当天事务，并希望助手理解个人生活节奏的个人用户
- 一句话定位：能听懂模糊安排、结合个人习惯生成今日计划草稿的 AI 个人执行助手

### 2.2 当前问题

| 问题 | 表现 | 1.0 目标 |
|---|---|---|
| 语音输入不稳定 | 用户说一大段时，中间停顿容易被误判为说完；实时转写未完成就开始追问 | 支持连续语音会话，明确听写、短暂停顿、理解、确认状态 |
| 人名和专有名词易被误听 | 云转文字或系统听写可能把用户之前提过的人名、项目名、地点名识别成近音词 | 从历史任务中沉淀本地实体词表，作为语音改写和 query rewrite 的上下文 |
| AI 只做新增 | 用户说“下午先做面试，吃完饭改项目，晚上健身”时，系统容易直接拆记录 | 新增 `plan_day` 今日规划意图，先生成草稿 |
| 画像没有参与排程 | 饭点、睡觉、健身、专注块、任务估时没有真正进入规划 | 画像成为排程输入 |
| 模糊时间不够智能 | “吃饭前”“睡觉前”“晚上”“今天剩下时间”需要用户手动说几点 | 新增模糊时间解释器，优先推断，轻量确认 |

### 2.3 1.0 核心目标

实现最小可用 AI 规划闭环：

```text
语音输入一段模糊安排
-> 结合历史实体词表做 query rewrite
-> AI 识别为今日规划
-> 读取个人习惯画像
-> 自动补全时间
-> 生成今日安排草稿
-> 用户确认 / 修改
-> 写入日程、待办、提醒和画像
```

用户感知目标：

- 不用把每件事都说成精确时间段。
- 小猫能逐渐理解用户吃饭、睡觉、健身和专注节奏。
- 复杂安排先生成草稿，不直接乱写。
- 日历只展示确认后的结果，不再是核心输入心智。

### 2.4 功能清单

| 编号 | 功能 | 优先级 | 1.0 状态 |
|---|---|---|---|
| AI10-F01 | 语音会话稳定性优化 | P0 | 待开发 |
| AI10-F02 | `plan_day` 今日规划意图 | P0 | 待开发 |
| AI10-F03 | 个人画像参与排程 | P0 | 待开发 |
| AI10-F04 | 今日安排草稿确认后写入 | P0 | 待开发 |
| AI10-F05 | 模糊时间解释器 `timeAnchorResolver` | P1 | 待开发 |
| AI10-F06 | 长期任务与今日推进块 | P1 | 待开发 |
| AI10-F07 | 生活提醒识别 | P1 | 待开发 |
| AI10-F08 | 陪伴反馈模板 `feedbackTemplates` | P2 | 待开发 |
| AI10-F09 | 习惯与周期安排 | P0 | 待开发 |
| AI10-F10 | AI 修改已有日程 | P0 | 待开发 |
| AI10-F11 | 历史实体词表与 query rewrite | P1 | 待开发 |

### 2.5 AI10-F01 语音会话稳定性优化

- 优先级：P0
- 用户目标：用户可以连续说一大段今日安排，中间短暂停顿不会被误提交。
- 状态设计：

```text
idle 空闲
listening 正在听
thinking_pause 短暂停顿，继续等用户
understanding 正在理解
confirming 展示理解结果 / 安排草稿
```

- 停顿策略：

```text
0-1 秒停顿：继续听
1-2.5 秒停顿：显示“我在听，你可以继续说”
2.5-3 秒以上停顿：认为用户可能说完，进入理解
```

- 结束词：

```text
就这些 / 先这样 / 差不多了 / 安排一下 / 你帮我排一下
```

- 继续词：

```text
等一下 / 我还没说完 / 还有 / 然后 / 再然后 / 继续听
```

- 关键规则：实时转写阶段只展示草稿，不提前触发缺时间或缺事项追问；只有用户说完后，才进入理解。
- 验收标准：最终验收用例 2 中 1 秒停顿不会提交，结束词出现后才开始理解。

### 2.6 AI10-F02 `plan_day` 今日规划意图

- 优先级：P0
- 新增核心意图：`plan_day`
- 触发输入示例：

```text
帮我安排一下今天
今天下午先把面试准备做完，然后吃饭，晚上健身
现在两点，吃饭前我要把这个弄完
这个任务要 14 个小时，但今天只安排 2 个小时
上午先做简历，下午做项目，晚上去健身
```

- 交互规则：`plan_day` 不直接写入日程，先生成今日安排草稿。
- 草稿必须展示：
  - AI 理解到的事项。
  - 自动推断的时间。
  - 哪些时间来自用户明确输入。
  - 哪些时间来自个人画像。
  - 哪些地方有风险，例如时间不够、任务过大、需要拆分。

示例草稿：

```text
我先按你平时 18:30 左右吃饭、晚上 20:30 左右健身来排：

14:10-16:30 面试准备
16:30-16:45 休息
16:45-18:10 完善个人助手
18:10-18:30 缓冲
18:30-19:10 晚饭
19:20-20:20 继续完善个人助手
20:30-21:30 健身
21:50 提醒：问对象带什么鞋

晚饭和健身时间是根据你的习惯推断的。
```

- 用户选项：

```text
确认安排 / 修改一下 / 只记录不安排 / 取消
```

- 验收标准：最终验收用例 1 可识别为 `plan_day`，生成草稿，确认后再写入。

### 2.7 AI10-F09 习惯与周期安排

- 优先级：P0
- 命名建议：左侧第三个导航不再叫“目标”，1.0 建议命名为“习惯”或“规律”；它承载长期重复事项、周期安排和习惯养成，不等同于项目目标。
- 用户目标：用户说“我每天要给猫刷牙”“以后每周六下午上家教课”时，系统能识别为长期规律，并把今天或对应日期的实例自动落到日程或待办。
- 业务规则：
  - 有具体时间点或时间段的周期事项进入日程，例如“每周六下午三点上家教课”。
  - 没有具体时间点的习惯进入当天待办，例如“每天给猫刷牙”。
  - 习惯实例不进入项目待办，不要求归属到工作/学校/生活项目。
  - 用户只描述长期习惯时，先生成习惯规则和近期实例草稿，确认后写入。
- 数据建议：新增或扩展 `habits.json` / `recurring_rules.json`，记录 `title`、`frequency`、`timeHint`、`nextOccurrences`、`status`、`source`。
- 验收标准：说“每天给猫刷牙”后，今天待办出现“给猫刷牙”；说“每周六下午上家教课”后，后续周六日程出现对应时间块。

### 2.8 AI10-F10 AI 修改已有日程

- 优先级：P0
- 用户目标：用户说“明天下午的会议地点改到 C 楼”时，系统理解为修改已有日程，而不是新增一条会议。
- 识别规则：
  - 包含“改到 / 修改 / 不是 / 换成 / 加备注 / 地点改为”等表达时，优先进入 `update_event` 或 `annotate_event`。
  - 先按日期、时间段、标题关键词和事件类型查找已有日程。
  - 找到 1 条时直接生成修改草稿或低风险写入。
  - 找到 0 条时追问用户是否要新建，或补充日期/时间/标题。
  - 找到多条时由 AI 追问“你要改哪一个”，并列出候选项。
- 写入规则：地点、备注、准备事项优先写入 event notes / preparations；时间和日期修改写入 `date`、`startAt`、`endAt`。
- 验收标准：已有“明天下午会议”时，说“明天下午的会议地点改到 C 楼”能更新该日程；找不到或找到多条时不会静默新增或误改。

### 2.9 AI10-F03 个人画像参与排程

- 优先级：P0
- 需求：个人画像不只展示在画像页，而要作为今日规划和模糊时间解析的输入。
- 画像字段建议：

```text
mealHabits：午饭/晚饭时间、一日几餐、吃饭平均时长
sleepHabits：起床/睡觉时间
exerciseHabits：健身常见时间、健身平均时长
focusHabits：默认专注块、休息间隔、高效时间段
taskDurationStats：不同任务类型的实际耗时、是否经常低估、缓冲比例
planningPreferences：是否喜欢先做难事、是否接受重叠、是否需要缓冲
```

- 字段元信息：

```text
confidence
evidenceCount
lastUpdated
```

- 更新分类：
  - 长期习惯：“我以后一般七点吃晚饭” -> 更新长期画像。
  - 今日临时调整：“今天晚饭改到八点” -> 只影响今天，不改长期画像。
  - 行为学习：多次在 18:30 左右吃饭，可以提高晚饭时间置信度，但不要一次行为就覆盖长期习惯。

- 验收标准：最终验收用例 4 能区分今日临时调整和长期画像更新。

### 2.10 AI10-F11 历史实体词表与 query rewrite

- 优先级：P1
- 用户目标：用户再次提到之前安排过的人、地点、项目或专有名词时，即使语音转写出现近音错字，AI 也能优先参考历史词表改写成正确表达。
- 触发条件：桌面小猫语音转写结束、页面输入提交、`/api/input/parse` 进入意图识别前。
- 词表来源：
  - 历史 `events.jsonl`、`tasks.jsonl`、`reminders.jsonl` 中的标题、备注、准备事项和地点。
  - 项目待办分类 `todo_projects.json`。
  - 用户确认过的 rewrite 结果，尤其是人名、机构名、课程名、地点名、项目名。
- 交互逻辑：
  - 先从本地历史中构建候选实体词表，不上传完整历史正文，只把少量候选词作为 AI 改写上下文。
  - query rewrite 阶段优先修正明显近音、错别字和人名误识别。
  - rewrite 只改变输入理解文本，不直接写入数据；最终仍走现有 parse -> preview -> commit 守卫。
  - 当候选词有多个相近匹配时，保留原文并在确认卡片里轻量提示，不静默替换成不确定实体。
- 数据建议：
  - 第一版可运行时从现有历史数据动态抽取，不必立即落独立文件。
  - 如果性能或可解释性需要，再新增 `entity_lexicon.json`，字段包含 `text`、`type`、`aliases`、`sourceRefs`、`lastSeenAt`、`confidence`。
- 异常情况：
  - 不能因为词表里有某个人名，就把所有近音词强行改成人名。
  - 不能把隐私性历史全文拼进 AI prompt；只传必要候选词和类型。
  - 用户手动改正后，应优先尊重用户本轮原文或确认结果。
- 验收标准：用户曾经安排过“张三开会”后，再次语音说到该人名，即使转写成近音错字，rewrite 结果也优先纠正为“张三”；找不到高置信候选时不乱改。

### 2.11 AI10-F04 今日安排草稿确认后写入

- 优先级：P0
- 需求：草稿确认后才拆写 `events`、`tasks`、`reminders`、`profiles`。
- 写入规则：
  - 明确时间块 -> `events.jsonl`。
  - 无固定时间但需要推进 -> `tasks.jsonl`。
  - 生活提醒 -> `reminders.jsonl`。
  - 长期习惯更新 -> `profiles.json` 或画像数据结构。
  - 今日临时调整 -> 今日上下文，不直接覆盖长期画像。
- 验收标准：未点击确认前不写入；确认后写入并刷新工作台。

### 2.12 AI10-F05 模糊时间解释器 `timeAnchorResolver`

- 优先级：P1
- 支持表达：

```text
吃饭前 / 吃完饭后
午饭前 / 晚饭后
健身前 / 健身后
睡觉前
下午 / 晚上 / 一会儿 / 待会儿
今天剩下的时间
```

- 示例：

```text
现在两点，吃饭前把面试准备做完。
```

如果画像里晚饭为 18:30，吃饭前留 20 分钟缓冲，则可用时间为：

```text
14:10-18:10
```

- 画像不足时的策略：不要卡死，不要频繁追问；先默认推断并轻量确认。

```text
我还不知道你一般几点吃晚饭，今天先按 18:30 预留可以吗？
```

选项：

```text
可以 / 改成 19:00 / 以后都按 19:00
```

### 2.13 AI10-F06 长期任务与今日推进块

- 优先级：P1
- 示例输入：

```text
这个个人助手项目大概要 14 个小时，但今天只安排 2 个小时。
```

- 正确处理：
  - 创建长期任务：完善个人助手项目，总估时 14 小时。
  - 创建今日推进块：今天只安排 2 小时。
  - 不标记为今天必须完成。
  - 结束后询问进度，例如“今天推进到哪里了，剩余大概还要多久？”

### 2.14 AI10-F07 生活提醒识别

- 优先级：P1
- 示例输入：

```text
九点五十提醒我问对象带什么鞋。
睡觉前提醒我收拾明天面试的东西。
晚上提醒我跟妈妈说一声。
```

- 写入目标：`reminders.jsonl`。
- 关键规则：不要误写成普通任务或日程。
- 反馈要求：轻量可爱但不要油腻；“小蝴蝶/小猫”文案只作为偶尔彩蛋，不每次出现。

示例反馈：

```text
记好啦，21:50 我提醒你问她带什么鞋。
小蝴蝶先把这个提醒叼走啦，到点再飞回来。
```

### 2.15 AI10-F08 陪伴反馈模板

- 优先级：P2
- 建议新增 `feedbackTemplates`。
- 场景模板：

```text
安排草稿：我先按你的习惯排了一版，你看看顺不顺。
确认安排：安排好啦，中途变动也可以随时叫我改。
任务完成：完成啦，这一块可以从脑子里放下了。
没做完：没关系，我先帮你记成推进中，要不要说一下是时间不够，还是任务比预想大？
提醒成功：记好啦，到点我会冒出来提醒你。
```

- 原则：短句、不说教、可爱但不幼稚、做不完不责备。

### 2.16 1.0 不做

```text
复杂全自动排程算法
多日大规模排程
完整机器学习画像训练
手机端
屏幕识别
继续深挖日历视觉细节
过度游戏化
```

### 2.17 最终验收用例

#### 用例 1：完整今日规划

输入：

```text
现在两点，今天下午吃饭前把面试准备做完，吃完饭之后完善个人助手，晚上去健身，九点五十提醒我问对象带什么鞋。
```

预期：

```text
识别为 plan_day。
生成今日安排草稿。
晚饭、健身时间来自画像或默认推断。
21:50 创建提醒。
确认后再写入。
```

#### 用例 2：短暂停顿不中断

用户说：

```text
今天下午先做面试准备……
停顿 1 秒……
然后吃饭后改个人助手……
停顿 1 秒……
晚上去健身，就这些，帮我排一下。
```

预期：

```text
停顿 1 秒不提交。
识别到“就这些，帮我排一下”后才开始理解。
```

#### 用例 3：吃饭前

输入：

```text
吃饭前把这个方案写完。
```

预期：

```text
读取晚饭习惯。
推断可用时间。
生成草稿，不直接追问几点吃饭。
```

#### 用例 4：临时调整与长期习惯区分

输入：

```text
今天晚饭改到八点。
```

预期：

```text
只影响今天。
不更新长期画像。
```

输入：

```text
我以后一般七点吃晚饭。
```

预期：

```text
更新长期 mealHabits。
```

## 3. SDD 1.0 草案

### 3.1 架构变化

1.0 不推翻 MVP 架构，而是在现有链路上新增“规划层”：

```text
语音会话层
-> 历史实体词表与 query rewrite 层
-> 输入理解层
-> 今日规划层 plan_day
-> 画像与模糊时间解析层
-> 草稿确认层
-> commit 写入层
-> 日历 / 待办 / 提醒展示层
```

日历、一周视图和右侧详情仍是展示层；核心新增模块是 `entityLexicon`、`queryRewriteContext`、`plan_day`、`timeAnchorResolver`、`profileSchedulerContext` 和 `planDraftCommitter`。

### 3.2 模块划分

| 模块 | 职责 | 可能涉及文件 |
|---|---|---|
| Voice Session State Machine | 管理 idle / listening / thinking_pause / understanding / confirming | `src/App.tsx`、`electron/main.cjs`、`electron/preload.cjs` |
| Entity Lexicon Builder | 从历史日程、待办、提醒、项目分类和确认过的 rewrite 中抽取人名、地点、项目名等候选实体 | `server/dataStore.ts`、`server/types.ts` |
| Query Rewrite Context | 在 parse 前把少量高置信实体候选传给 AI / 规则改写，用于修正语音转写中的人名和专有名词 | `server/aiAdapter.ts`、`server/dataStore.ts` |
| Plan Day Intent Parser | 识别 `plan_day`，把复杂输入拆成事项、提醒、长期任务、临时调整 | `server/dataStore.ts`、`server/aiAdapter.ts` |
| Profile Scheduler Context | 从画像、设置和历史行为中读取饭点、睡眠、健身、专注块和估时偏好 | `server/dataStore.ts`、`server/types.ts`、`profiles.json`、`settings.json` |
| Time Anchor Resolver | 将“吃饭前 / 晚上 / 睡觉前 / 今天剩下时间”等表达转成时间范围 | `server/dataStore.ts` 或后续拆分文件 |
| Plan Draft Builder | 生成今日安排草稿，标注时间来源和风险 | `server/dataStore.ts` 或后续拆分文件 |
| Plan Draft Committer | 用户确认后拆写 events / tasks / reminders / profiles | `server/dataStore.ts` |
| Feedback Templates | 按场景输出短反馈 | `src/App.tsx`、`server/dataStore.ts` 或独立配置 |

### 3.3 数据设计

#### 个人画像扩展

建议在 `profiles.json` 中新增或兼容以下结构：

```ts
type HabitValue<T> = {
  value: T;
  confidence: number;
  evidenceCount: number;
  lastUpdated: string;
};

type ProfileDataV10 = {
  mealHabits: {
    lunchTime?: HabitValue<string>;
    dinnerTime?: HabitValue<string>;
    mealDurationMinutes?: HabitValue<number>;
    mealsPerDay?: HabitValue<number>;
  };
  sleepHabits: {
    wakeUp?: HabitValue<string>;
    sleepStart?: HabitValue<string>;
  };
  exerciseHabits: {
    commonTime?: HabitValue<string>;
    durationMinutes?: HabitValue<number>;
  };
  focusHabits: {
    defaultFocusMinutes?: HabitValue<number>;
    breakMinutes?: HabitValue<number>;
    highFocusWindows?: string[];
  };
  taskDurationStats: Record<string, {
    actualMinutes?: HabitValue<number>;
    bufferRatio?: HabitValue<number>;
    oftenUnderestimated?: boolean;
  }>;
  planningPreferences: {
    preferredTaskOrder?: string;
    acceptsOverlap?: boolean;
    needsBuffer?: boolean;
  };
};
```

兼容原则：

- 老字段继续读取，不因缺少新字段导致画像页或 bootstrap 崩溃。
- 新字段缺失时使用默认推断，例如晚饭 18:30、健身 20:30、睡觉 22:00。
- 一次行为不覆盖长期画像，只增加 evidence 或生成今日临时上下文。

#### 今日规划草稿

草稿可以先作为 `ParseResult.preview.planDraft` 返回，不必第一版落文件。

建议结构：

```ts
type PlanDraft = {
  date: string;
  sourceText: string;
  items: Array<{
    id: string;
    kind: 'event' | 'task' | 'reminder' | 'habit_adjustment' | 'progress_block';
    title: string;
    startAt?: string;
    endAt?: string;
    remindAt?: string;
    estimatedMinutes?: number;
    source: 'user_explicit' | 'profile_inferred' | 'default_assumption' | 'system_generated';
    reason: string;
    risk?: string;
  }>;
  warnings: string[];
  assumptions: string[];
  options: Array<{ id: string; title: string }>;
};
```

#### 历史实体词表

第一版可以动态抽取，不强制新增文件；如果后续需要缓存，可新增：

```ts
type EntityLexiconItem = {
  text: string;
  type: "person" | "place" | "project" | "organization" | "custom";
  aliases?: string[];
  sourceRefs: Array<{
    source: "event" | "task" | "reminder" | "todoProject" | "rewrite";
    id?: string;
  }>;
  lastSeenAt: string;
  confidence: number;
};
```

兼容原则：

- 不要求历史数据迁移；词表可以从现有文件现算或懒加载缓存。
- AI prompt 只接收少量候选实体，不接收完整历史正文。
- 用户确认过的改写结果可以提升置信度，误改后应允许降权或保留原文。

### 3.4 接口设计

沿用现有接口，第一版不必新增公开 API：

| 接口 | 1.0 行为 |
|---|---|
| `POST /api/input/parse` | 对今日规划输入返回 `intent: "plan_day"`，`needsConfirmation: true`，`preview.planDraft` |
| `POST /api/input/commit` | 当 `selectedOptionId = "confirm-plan"` 时，将草稿拆写到 events / tasks / reminders / profiles |
| `GET /api/bootstrap` | 返回扩展后的 profile / settings，供前端展示和规划上下文使用 |
| `PATCH /api/settings` | 继续支持作息类配置；长期画像更新可后续新增独立接口 |

注意：

- `plan_day` parse 阶段不写入。
- `confirm-plan` 才写入。
- `record-only` 只记录为任务 / 备忘，不排进日程。
- `cancel` 不写入。

### 3.5 核心流程

#### 3.5.1 语音会话

```text
idle
-> listening
-> thinking_pause
-> listening
-> understanding
-> confirming
```

关键规则：

- 实时转写只更新草稿文本。
- 继续词让状态回到 listening。
- 结束词或长停顿进入 understanding。
- understanding 阶段才调用 parse。

#### 3.5.2 今日规划

```text
用户输入
-> 抽取高置信实体候选
-> query rewrite 修正语音转写 / 人名专有名词
-> plan_day 识别
-> 读取 profile / settings / today events / today tasks
-> timeAnchorResolver 解释模糊时间
-> 生成 planDraft
-> 前端展示草稿
-> 用户确认 / 修改 / 只记录 / 取消
```

#### 3.5.3 草稿确认写入

```text
confirm-plan
-> event items 写 events.jsonl
-> task / progress_block items 写 tasks.jsonl
-> reminder items 写 reminders.jsonl
-> long-term habit updates 写 profiles.json 或 pending profile evidence
-> refresh bootstrap
-> 日历 / 待办 / 提醒展示结果
```

### 3.6 状态与边界

| 边界 | 处理方式 |
|---|---|
| 用户短暂停顿 | 不解析，不追问，只提示可以继续说 |
| 用户说“还有 / 然后” | 继续听 |
| 用户说结束词 | 进入理解 |
| 画像不足 | 默认推断 + 轻量确认，不频繁追问 |
| 任务超长 | 创建长期任务 + 今日推进块 |
| 生活提醒 | 写 reminder，不误写 task / event |
| 草稿未确认 | 不写入任何日程 / 任务 / 提醒 |
| 用户只记录不安排 | 写入任务或备注，不占日历时间 |
| 用户取消 | 不写入 |

### 3.7 测试策略

- 单元测试：
  - `plan_day` 识别。
  - 结束词 / 继续词识别。
  - `timeAnchorResolver` 对吃饭前、吃完饭后、睡觉前、晚上、今天剩余时间的解析。
  - 长期习惯和今日临时调整的分类。
- 集成测试：
  - `/api/input/parse` 返回 planDraft 且不写入。
  - `/api/input/commit` + `confirm-plan` 写入 events / tasks / reminders。
  - profile 缺字段时仍能生成默认草稿。
- 用户验收：
  - 四个最终验收用例全部跑通。
  - 明确当前是开发态验证还是真实桌面入口验证。

## 4. 1.0 开发前置条件

在启动 1.0 开发前，必须满足：

- [ ] MVP 收口完成或用户明确同意从 MVP 收口切换到 1.0。
- [ ] 根目录 `PRD.md` / `SDD.md` / `TODO.md` 已从 MVP 收口版切换到 AI 化 1.0。
- [ ] 本文档被同步或拆分进正式主文档。
- [ ] 明确本轮只做 P0，还是 P0 + P1。
- [ ] 明确是否需要真实桌面入口同步验证；如果只是开发态验证，不要求打包。

## 5. 推荐开发顺序

1. 先改语音会话：停顿策略、结束词、继续词、实时转写不提前追问。
2. 新增历史实体词表与 query rewrite 上下文：先让人名、项目名、地点名不被误听写带偏。
3. 新增 `plan_day` 意图：识别复杂今日规划，先生成草稿。
4. 扩展个人画像：饭点、睡觉、健身、专注块、任务估时。
5. 做模糊时间解释器：吃饭前、睡觉前、晚上、今天剩余时间。
6. 做草稿确认后写入：确认后再拆成 events、tasks、reminders、profiles。
7. 最后补陪伴反馈模板。

## 6. 1.0 启动提示词

后续可以直接对 Codex 说：

```text
MVP 已收口，现在开始 YayaMind AI 化 1.0。请先读取 docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md，并把 1.0 口径同步到根目录 PRD/SDD/TODO，然后按 P0 顺序开发。
```
