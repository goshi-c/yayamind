# PROJECT_CONTEXT - YayaMind 项目上下文

本文档是唯一历史上下文文档，采用“当前状态 + 索引 + 摘要卡片/历史条目”。它默认写入，不作为每次接手必读全文。

Codex 接手项目时，优先读：

1. `PRD.md`
2. `SDD.md`
3. `TODO.md`

`FILE_INDEX.md` 已纳入项目文档体系，负责文件定位。需要定位代码、目录、数据文件、日志或资源时，再读取 `FILE_INDEX.md`。它不写历史上下文、决策、验证结果或历史链路；这些内容仍写入本文档。

只有需要回溯历史、查旧验证证据、解释旧决策或确认外部入口时，才按编号、日期或关键词读取本文件相关片段。历史遗留 `docs/archive/TASK_LOG.md` / `docs/archive/DECISIONS.md` 不再默认读取或写入。

## 当前项目状态

- 当前版本：1.1 Schedule-only。
- 当前阶段：1.0 已冻结并推送到 GitHub tag `v1.0-ai-assistant`；1.1 正在从 1.0 基线删除当前版本待办能力，只保留日程安排、提醒、画像和周期日程。
- 当前开发入口：`npm run dev` 或 `npm run desktop:dev`。
- 当前正式入口：阶段收口同步后的 `D:\YayaMind\YayaMind.exe`。
- 最近完成：2026-06-24 完成 1.1 schedule-only：冻结并 push 1.0，删除待办导航、待办页面、右侧待办区和待办 API，后端不再读取展示或写入待办，并已同步真实入口。
- 文件定位：`FILE_INDEX.md` 已作为文件定位字典，用于快速定位代码、数据、日志、资源和目录；历史上下文、决策、验证结果和旧链路仍写入 `PROJECT_CONTEXT.md`。
- 最近风险：旧 `tasks.jsonl` / `todo_projects.json` 数据文件仍保留在用户数据目录，但 1.1 不读取展示；如需恢复待办能力，从 GitHub tag `v1.0-ai-assistant` 拉取。
- 下一步重点：真实入口人工验收左侧导航、右侧详情和小猫语音日程化表现。

## 上下文索引

| 编号 | 日期 | 主题 | 关键词 |
|---|---|---|---|
| CTX-20260624-004 | 2026-06-24 | 1.0 冻结与 1.1 删除待办 | v1.0 tag, schedule-only, remove todo, GitHub |
| CTX-20260624-003 | 2026-06-24 | 多项补充追问去重与 PRD/SDD 同步 | multi supplement, modifyPlanDraft, repeated question, PRD, SDD |
| CTX-20260624-002 | 2026-06-24 | 追问上下文、实时转写和周期待办二次返工 | pendingClarification, supplement, recurring task, real entry |
| CTX-20260624-001 | 2026-06-24 | 桌面小猫追问对话历史保留 | cat dialog history, clarification, listening, real entry |
| CTX-20260623-002 | 2026-06-23 | 右侧详情布局、草稿追问收敛与追问后系统听写重启 | detail panel, plan draft, direct question, hold draft, Win+H |
| CTX-20260623-001 | 2026-06-23 | 小猫状态呈现、系统听写焦点握手与 productize 规则沉淀 | cat dialog, Win+H, dictation target, status copy, productize |
| CTX-20260622-002 | 2026-06-22 | MVP 主文档归档并切换到 AI 化 1.0 开发版 | AI 1.0, version switch, archive, PRD, SDD, TODO |
| CTX-20260622-001 | 2026-06-22 | MVP 最终收口审计与 1.0 启动准备 | MVP closeout, PRD match, SDD match, AI 1.0 |
| CTX-20260618-001 | 2026-06-18 | 语音待办完整写入、项目词表识别、时间轴休息块和取消对话 | voice todo, project lexicon, sleep block, cancel voice |
| CTX-20260617-001 | 2026-06-17 | 待办拖拽旧能力回归修复与链路复盘 | todo drag, deadline tag, month calendar drop, product lesson |
| CTX-20260616-003 | 2026-06-16 | AI 化 1.0 独立规划文档 | AI 1.0, plan_day, roadmap, version isolation |
| CTX-20260616-002 | 2026-06-16 | PRD/SDD 主文档重构为 MVP 收口版 | PRD, SDD, MVP, version scope, productize, review |
| CTX-20260616-001 | 2026-06-16 | 文档体系重构 | PRD, SDD, TODO, PROJECT_CONTEXT, README, docs/archive/TASK_LOG, docs/archive/DECISIONS |
| CTX-20260616-005 | 2026-06-16 | MVP 收尾同步真实入口 | D:\YayaMind, desktop:pack, robocopy, synced entry |
| CTX-20260616-004 | 2026-06-16 | MVP 收尾体验修复与节假日补齐 | detail editor, todos, legal holiday, profile |
| 2026-06-15 | 2026-06-15 | 修复前端 404 | desktop, 404, DESKTOP_STATIC_DIR |
| 2026-06-15-sync | 2026-06-15 | 桌面版阶段收口同步规则 | D:\YayaMind, preview, packaged, real entry |
| 2026-06-12-cat-d | 2026-06-12 | 桌面小猫与 D 盘应用目录 | Electron, userData, sessionData, desktop cat |
| 2026-06-12-shell | 2026-06-12 | 桌面悬浮小猫应用壳 MVP | Electron shell, tray, pack |
| 2026-06-11-cloud | 2026-06-11 | 云端部署、登录与数据迁移收尾 | Vercel, Supabase, auth |
| 2026-06-10-interview | 2026-06-10 | 项目收尾与面试材料 | docs/interview, portfolio |
| 2026-06-04-state | 2026-06-04 | Web V1.1 当前状态摘要 | voice, date detail, week view |

---

## CTX-20260624-002 追问上下文、实时转写和周期待办二次返工

### 背景

用户继续反馈：同一悬浮对话框没有点击叉号前，应始终属于同一上下文；但真实入口里“我要准备面试一个小时 -> 面试是 4 点 / 4:00-5:00”会重复追问“面试什么时间”，甚至反过来问“这个时间段是干什么”。用户还指出后续语音没有实时转写文字；“每天都要给猫刷牙”这类长期事项应该进入日常待办。

### 本轮做了什么

- 修改 `src/App.tsx`：有 `pendingClarification` 或带问题的 `parsePreview` 时，后续桌面语音不再重新走 `/api/input/parse`，而是作为“补充信息”提交到当前上下文。
- 修改 `src/App.tsx`：悬浮窗已有历史消息时，后续系统听写实时文本会作为临时用户气泡显示，避免只显示“我在听”。
- 修改 `server/dataStore.ts`：带 `补充信息：` 的文本不再进入复杂规划 / 周期规划新建路由；AI 把“我要准备面试一个小时”误判成补充日程时，回退为新增安排，并因只有时长没有开始时间而追问具体时间。
- 修改 `server/dataStore.ts`：补充“4点 / 4:00-5:00”时按当前上下文补齐上一轮安排；当天已过的 1-7 点无上午/下午标记时，按后续时段理解，例如下午语境里的 4 点为 16:00。
- 修改 `server/dataStore.ts`：无明确时间的 `recurring_rules` 动态生成日常待办实例；“每天都要给猫刷牙”确认后，在当天待办中显示“给猫刷牙”。

### 验证状态

- `npm run build` 通过。
- 临时数据目录 `.run-logs/context-fix-data` 回放通过：
  - `我要准备面试一个小时` -> `add_event`，追问具体时间。
  - `补充信息：面试是4点` -> 直接写入 16:00-17:00 的“面试准备”，不再重复追问。
  - `每天都要给猫刷牙` -> `habit_rule`，确认后当天待办出现“给猫刷牙”周期待办。
- `npm run desktop:pack` 通过，输出到 `D:\YayaMindBuild\release\win-unpacked`。
- 已停止旧 `D:\YayaMind\YayaMind.exe` 进程并同步到 `D:\YayaMind`；`ROBOCOPY_EXIT=3`。
- 已从真实入口 `D:\YayaMind\YayaMind.exe` 冷启动，`http://127.0.0.1:8787/api/bootstrap` 返回 `200`。

### 后续人工验收点

- 在真实入口按原场景说“我要准备面试一个小时”，小猫追问时间后，说“面试是 4 点”，确认不再重复追问。
- 追问后继续说话时，确认悬浮窗能看到实时转写文字。
- 说“每天都要给猫刷牙”，确认规则后检查今天待办里是否出现“给猫刷牙”。

---

## CTX-20260624-001 桌面小猫追问对话历史保留

### 背景

用户反馈：当输入比较模糊的日程安排时，小猫确实会追问并重新打开语音功能，但追问问题没有显示；悬浮对话框应该像聊天一样向下追加用户原话、AI 追问和“我在听”提示，内容过长时出现滚动条。当前上下文只需要管理一轮对话；取消后上下文直接丢失，新开一轮对话。

### 本轮做了什么

- 修改 `src/App.tsx`：新增当前桌面会话内的 `desktopDialogMessages`，把用户原话、AI 追问 / 回答和继续听写提示组合成 `cat-dialog-v1` payload。
- 修复追问后 `restartVoiceInputSoon -> prepareNewVoiceSession()` 清掉 `parsePreview`，导致悬浮窗只剩“我正在听”的问题；现在追问会先固化到本轮消息列表，再启动系统听写。
- 当前对话历史只保留在本轮会话中；取消或 commit 完成后清空，避免跨会话混入旧上下文。
- `electron/bubble.html` 已具备可滚动消息容器，本轮未新增 Electron 渲染结构。

### 验证状态

- `npm run build` 通过。
- `npm run desktop:pack` 通过，输出到 `D:\YayaMindBuild\release\win-unpacked`。
- 已停止旧 `D:\YayaMind\YayaMind.exe` 进程，并同步最新构建到 `D:\YayaMind`；`ROBOCOPY_EXIT=3`。
- 已从真实入口 `D:\YayaMind\YayaMind.exe` 冷启动，`http://127.0.0.1:8787/api/bootstrap` 返回 `200`。

### 后续人工验收点

- 在真实桌面入口点击小猫，说一段缺时间的复杂规划，确认追问问题、用户原话和“我在听”提示都保留在同一个悬浮对话框。
- 连续回答追问，确认每轮新内容向下追加；内容变长时可以滚动查看历史。
- 点击取消，确认本轮对话消失；重新开始时不带入上一轮历史。

---

## CTX-20260623-002 右侧详情布局、草稿追问收敛与追问后系统听写重启

### 背景

用户指出右侧详情区“待办”占用过多空白，日程多时可见量不足；“具体安排”直接展示口语原文，应该由 AI / 规则整理成精炼摘要。用户同时指出小猫追问时没有重新打开语音输入，也没有明确输入框或“正在听”状态，导致用户不知道该如何回答。

### 本轮做了什么

- 修改 `src/styles.css`：日程 / 待办详情区各自使用圆角边框容器；日程区占据主要剩余空间，待办区压缩为紧凑块，标题和空状态间距收紧。
- 修改 `server/dataStore.ts` / `src/App.tsx`：日程 `具体安排` 写入和展示都增加摘要兜底，例如把口语化安排收敛为“准备面试 / 改个人助手项目 / 健身”。
- 修改 `server/dataStore.ts`：缺少关键时间的整组草稿只给“先放待定 / 全部取消”；补齐或可确认后才给“确认全部 / 全部取消”。追问文案改为直接问题，例如“面试什么时间？健身什么时间？”。
- 修改 `src/App.tsx`：`parsePreview` 出现追问或需要确认时，桌面真实入口会自动调用 `restartVoiceInputSoon`，重新请求系统听写；小猫对话框在追问旁展示“我在听”输入提示。
- 修改 `electron/main.cjs`：保持 Win+H 技术方案不变，缩短热键按下间隔和 renderer ready 兜底等待，以减少小猫点击后系统听写打开延迟。

### 验证状态

- `npm run build` 通过。
- 临时数据目录回放复杂规划句子，通过 `/api/input/parse` 验证输出：
  - 问题：`面试什么时间？`、`改项目什么时间？`、`健身什么时间？`
  - 选项：`先放待定`、`全部取消`
  - 摘要：`准备面试`、`改个人助手项目`、`健身`
- `npm run desktop:pack` 通过，输出到 `D:\YayaMindBuild\release\win-unpacked`。
- 已停止旧 `D:\YayaMind\YayaMind.exe` 进程，并用 `robocopy /MIR` 同步最新构建到 `D:\YayaMind`。
- 已从真实入口 `D:\YayaMind\YayaMind.exe` 冷启动，`D:\YayaMindData\userData\desktop-cat.log` 出现 `bubble-create`、`open-main`、`http://127.0.0.1:8787/` 权限检查和小猫消息刷新。

### 后续人工验收点

- 在真实桌面入口点击小猫，输入一段缺时间的复杂规划，确认小猫直接问缺失时间，并自动打开 Windows 听写等待回答。
- 右侧详情区检查日程 / 待办是否各自成框，待办空白是否不再挤占日程列表。
- 打开日程详情，确认“具体安排”是摘要版，而不是完整口语原文。

---

## CTX-20260623-001 小猫状态呈现、系统听写焦点握手与 productize 规则沉淀

### 背景

用户指出真实入口里小猫状态出现重复：对话框里已经有“完成了 / 正在听”等状态，底部又显示一次；草稿追问时还会先解释“生成草稿”这类内部过程，而不是直接问用户要补充什么。用户还指出界面显示“正在听，请说话”时，Windows 系统听写并没有真正打开，手动点系统听写时提示没有输入框。

### 本轮做了什么

- 修改 `src/App.tsx`：桌面 `cat-dialog-v1` payload 不再额外发送 `status`，避免小猫对话气泡和底部状态条重复显示；追问场景去掉重复输入状态。
- 修改 `server/dataStore.ts`：草稿 fallback 文案不再说“先做成草稿 / 确认后写入正式数据”，改为直接问缺失时间或给出“确认、修改、取消”动作。
- 修改 `src/App.tsx` / `electron/main.cjs` / `electron/preload.cjs`：桌面语音启动改为“主进程请求 native voice start -> 渲染层聚焦 `.system-dictation-capture` -> 回报 `desktop-cat:dictation-target-ready` -> 主进程触发 Win+H”；停止听写阶段只聚焦读取文本，不再通知主进程启动热键。
- 修改 `C:\Users\17978\.codex\skills\productize\PLAYBOOK_DEV.md`：新增“语言与状态呈现回归规则”，要求改状态机、提示文案、悬浮入口或状态条时检查父功能和相邻呈现层。
- 修改 `C:\Users\17978\.codex\skills\productize\PRODUCT_LESSONS.md`：新增经验 023，记录“改状态逻辑时漏看相邻呈现层，导致状态重复和内部文案外露”。

### 验证状态

- `npm run build` 通过。
- `node --check electron\main.cjs` 和 `node --check electron\preload.cjs` 通过。
- `npm run desktop:pack` 通过，输出到 `D:\YayaMindBuild\release\win-unpacked`。
- 已停止旧 `D:\YayaMind\YayaMind.exe` 进程，并用 `robocopy /MIR` 同步最新构建到 `D:\YayaMind`。
- 已从真实入口 `D:\YayaMind\YayaMind.exe` 冷启动，`http://127.0.0.1:8787/api/bootstrap` 返回正常。
- 真实入口日志已出现 `system-dictation-target-ready` 且 `focused=true`，随后出现 `system-dictation-hotkey-request`，说明 Win+H 已在输入框聚焦后触发；同一轮日志还出现 `desktop-recognized-text -> parse-preview-success -> desktop-auto-commit-start -> commit-success`。

### 后续人工验收点

- 用户在真实桌面入口点小猫说一段需要追问的长规划，确认小猫只直接问缺失问题，不先解释内部生成草稿过程。
- 用户确认小猫状态不再出现“气泡里一遍、底部又一遍”的重复。
- 用户再次点击小猫开始说话，观察 Windows 听写是否会稳定打开并落到输入框。

---

## CTX-20260622-001 MVP 最终收口审计与 1.0 启动准备

### 背景

用户判断当前 MVP 的功能和美观程度已经接近满意，希望在进入 AI 化 1.0 之前做一次最终收口：核对 `PRD.md` 与当前项目功能是否匹配，确认页面状态、异常兜底、原型 / 展示材料、功能链路和真实入口边界，然后把 MVP 版本收纳归档，并把 1.0 PRD 提上日程。

### 本轮做了什么

- 按主文档规则读取 `PRD.md`、`SDD.md`、`TODO.md`，按需读取 `FILE_INDEX.md`、`PROJECT_CONTEXT.md` 相关索引和 `docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md`。
- 对照代码入口抽查 `src/App.tsx`、`src/styles.css`、`server/index.ts`、`server/dataStore.ts`、`server/aiAdapter.ts`、`electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`，确认 MVP 需求在当前实现中有对应模块和链路。
- 更新 `PRD.md`：新增 MVP 收口结论，明确功能范围、页面状态、异常兜底、真实入口、原型 / 展示材料和 1.0 版本边界。
- 更新 `SDD.md`：补充 MVP -> AI 化 1.0 的版本切换流程，并把真实入口同步说明改为最终收口口径。
- 更新 `TODO.md`：把剩余事项改为“P0 保留人工验收项”“1.0 前置优化”“1.0 工程化优化”和“下一阶段：AI 化 1.0”。
- 新增 `docs/archive/versions/mvp-closeout-2026-06-22.md`，作为 MVP 收口归档摘要。

### 最终结果

MVP 可以作为一个功能基线收口：Web 工作台、自然语言输入、右侧日期详情、项目待办、本地数据层、桌面小猫、设置页、节假日 / 调休、软删除和日志排障都已经有稳定文档口径和代码入口。当前不再继续扩大 MVP 功能范围。

保留的非自动验收项是用户真实桌面环境下的小猫语音开口：点击小猫说一句明确日程，确认 `D:\YayaMindData\userData\desktop-cat.log` 出现 `commit-success`，并且工作台日程格子刷新。这一步不能由后台构建、API 健康检查或资源字符串核验完全替代。

### 关键链路

```text
用户输入 / 小猫语音
-> /api/input/parse 只解析
-> 追问 / 确认 / 自动 commit
-> /api/input/commit 写入本地 JSONL
-> /api/bootstrap 刷新
-> 周视图 / 右侧详情 / 项目待办 / 小猫反馈更新
```

```text
MVP 收口
-> PRD / SDD / TODO / PROJECT_CONTEXT 同步
-> build / desktop:pack / sync / cold-start 验证
-> 用户人工语音验收
-> 读取 docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md
-> 切换根级 PRD / SDD / TODO 到 AI 化 1.0
```

### 重要决策

- MVP 根文档只维护当前已实现闭环、收口基线和保留验收项；不再把 1.0 的 `plan_day`、历史实体词表、模糊时间解释器、画像排程混入 MVP。
- 新用户教程、最新截图和 `desktop:release-local` 脚本不阻塞 MVP 归档，作为 1.0 前置优化和工程化优化处理。
- 进入 1.0 前不能机械提升整份 roadmap；要先确认 1.0 P0 范围，再同步根级 `PRD.md` / `SDD.md` / `TODO.md`。

### 验证状态

- 已完成：文档与代码入口审计；主文档收口更新；MVP 归档摘要新增。
- 已完成：`npm run build` 通过，产物包含 `index-CUBEXDNA.js` / `index-BzO6TYCV.css`。
- 已完成：`npm run desktop:pack` 通过，输出到 `D:\YayaMindBuild\release\win-unpacked`。
- 已完成：停止旧 `D:\YayaMind\YayaMind.exe` 进程，并将 `D:\YayaMindBuild\release\win-unpacked` 同步到 `D:\YayaMind`；`ROBOCOPY_EXIT=3`，属于可接受成功码。
- 已完成：真实入口资源核验通过，`D:\YayaMind\resources\app\dist\assets` 包含最新 JS / CSS；Electron 资源可检索到 `cancel-voice`、`state-thinking` 等小猫链路关键字符串。
- 已完成：真实入口 `D:\YayaMind\YayaMind.exe` 已启动，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 待用户人工确认：真实点击小猫说一句，检查 `commit-success` 和日程刷新。

### 后续风险

- 如果未完成真实语音人工验收，就不能声称桌面语音在真实环境 100% 闭环，只能说自动验证和真实入口冷启动通过。
- 切换到 1.0 后，根级主文档必须代表 1.0 当前开发版；MVP 收口依据留在本文和 `docs/archive/versions/`。

---

## CTX-20260616-003 AI 化 1.0 独立规划文档

### 背景

用户提出 YayaMind AI 化 1.0 方向：产品不应继续变成更精密的日历，而应回到 AI 个人执行助手初心。1.0 核心是语音对话、模糊时间理解、个人画像参与排程、今日安排草稿和确认后写入。

当前 MVP 仍未完全收口，因此不能把 1.0 需求混入根目录当前 `PRD.md` / `SDD.md` / `TODO.md`，也不能直接开始业务开发。

### 本轮做了什么

- 新建 `docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md`，作为 AI 化 1.0 候选版本的独立 PRD / SDD 草案。
- 文档内明确版本边界：MVP 收口前不作为当前开发依据。
- 在 `PRD.md` 的 1.0 规划中只保留指向该文档的入口，不把 1.0 详细需求塞进当前 MVP 主文档。
- 在 `TODO.md` 增加“后续版本规划，不属于当前 MVP TODO”指针。
- 在 `FILE_INDEX.md` 增加 `docs/roadmap/` 的定位说明。

### 最终结果

当前文档分工变为：

```text
当前 MVP 开发依据：PRD.md / SDD.md / TODO.md
后续 AI 化 1.0 依据：docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md
```

后续若用户说“开始 1.0 版本开发”，应先读取 1.0 规划文档，再把 1.0 口径同步到根级 PRD / SDD / TODO，然后进入开发。

### 重要决策

- 1.0 不直接开发，先作为独立 roadmap 文档冻结。
- MVP 和 1.0 文档隔离，避免当前收口任务被后续需求污染。
- 1.0 的核心意图 `plan_day`、画像排程、模糊时间解释器、今日安排草稿暂不进入当前 MVP TODO。

### 可回溯文件

- `docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md`
- `PRD.md`
- `TODO.md`
- `FILE_INDEX.md`
- `PROJECT_CONTEXT.md`

### 验证状态

- 已验证：本轮只执行文档创建和索引同步。
- 未验证：未运行构建、类型检查、桌面打包或真实入口验证，因为没有业务代码开发目标。
- 风险：1.0 文档是规划草案，进入开发前仍需按当时 MVP 完成状态同步正式主文档。

### 后续建议

- 先继续完成 MVP 收口。
- MVP 收口后，使用本文档中的启动提示词进入 AI 化 1.0。

---

## CTX-20260616-002 PRD/SDD 主文档重构为 MVP 收口版

### 背景

根级 `PRD.md` 和 `SDD.md` 虽已补齐为日常主读入口，但仍带有临时反向补齐痕迹：版本口径把 MVP、V1.1 和桌面小猫语音链路收敛版混在一起，PRD 缺少完整文档头、修订历史和功能级验收，SDD 更像架构摘要而不是完整软件设计文档。

### 本轮做了什么

- 将 `PRD.md` 当前版本统一为 MVP 收口版，补文档信息、修订历史、用户场景、功能需求、非功能需求、数据需求、依赖约束、验收标准和版本规划。
- 将 `SDD.md` 当前版本统一为 MVP 收口版，补系统架构、模块详细设计、数据设计、接口设计、核心流程、状态机、测试策略、部署与运维设计。
- 更新 `TODO.md` 顶部当前版本口径，将旧 V1.1 任务段标注为历史阶段记录。
- 在 `productize` 和 `review` Skill 中沉淀 PRD / SDD 长期维护规则。

### 最终结果

当前项目日常开发主文档口径收敛为：

```text
当前版本 = MVP 收口版
PRD = 做什么、优先级、状态、验收
SDD = 系统怎么设计、接口怎么走、数据怎么落、怎么排障
TODO = 当前未完成项和下一步任务
```

历史 V1.1、桌面小猫语音链路、面试材料等内容保留为历史进展，不再作为当前版本标题。

### 关键链路

```text
读 Project Context / PRD / SDD / TODO / skills -> 判断文档口径混乱 -> 重构 PRD/SDD -> 同步 TODO/Context -> 更新 skills
```

### 重要决策

- 当前产品仍视为 MVP 阶段，MVP 还没有完全收口；不再把当前主文档版本直接写成 V1.1。
- P0 / P1 / P2 / P3 在当前 MVP 文档里都是版本计划内事项，只表示优先级；Not Now 单独列。
- PRD / SDD 不写历史流水账、复盘原因或面试展示叙事；历史事实进入 `PROJECT_CONTEXT.md`，经验规则进入 Skill 或经验库。
- 本轮只改文档和 Skill，不改业务代码，不打包，不同步真实入口。

### 可回溯文件

- `PRD.md`
- `SDD.md`
- `TODO.md`
- `PROJECT_CONTEXT.md`
- `C:\Users\17978\.codex\skills\productize\SKILL.md`
- `C:\Users\17978\.codex\skills\review\SKILL.md`

### 验证状态

- 已验证：读取了 `PROJECT_CONTEXT.md`、`PRD.md`、`SDD.md`、`TODO.md`、`FILE_INDEX.md`、`package.json`、API 路由索引、`productize` / `review` Skill 和 `productize` 模板。
- 未验证：本轮未运行构建、类型检查、桌面打包或真实入口冷启动，因为任务明确要求不改业务代码、不打包、不同步真实入口。
- 风险：PRD / SDD 的功能状态来自当前文档、TODO 和代码入口核对；桌面真实语音写入仍需用户在真实桌面环境人工验收。

### 后续建议

- 下一轮开发先按 MVP 收口版 `PRD.md` / `SDD.md` / `TODO.md` 执行。
- 若修 bug 暴露需求边界、异常处理、接口或数据链路变化，同步回 PRD / SDD。
- 完成桌面阶段收口时再执行打包、同步 `D:\YayaMind` 和真实入口冷启动验证。

---

## CTX-20260616-001 文档体系重构

### 背景

全局 `AGENTS.md`、`productize` Skill 和 `review` Skill 均要求产品项目日常开发主读 `PRD.md`、`SDD.md`、`TODO.md`。当前项目已有 MVP/V1.1 和桌面实现，但根目录缺少开发准入所需的 `PRD.md` 与 `SDD.md`，同时历史归档 `docs/archive/TASK_LOG.md`、`docs/archive/DECISIONS.md`、`README.md` 和 `docs/*` 承担了过多重叠职责。

### 本轮做了什么

- 新增根级 `PRD.md`，作为当前产品需求、版本目标、功能范围和验收标准的主文档。
- 新增根级 `SDD.md`，作为当前系统设计、关键链路、API/数据契约、验证点和可能断点的主文档。
- 在 `TODO.md` 顶部补当前版本、本轮目标、主读规则和当前未完成项。
- 在本文件顶部补当前项目状态和上下文索引。
- 将 `docs/archive/TASK_LOG.md` 和 `docs/archive/DECISIONS.md` 标注为历史遗留资料，不再作为默认读取或写入目标。
- 更新 `README.md` 文档索引，明确它是外部展示和运行入口说明，不是日常开发依据。

### 最终结果

日常开发入口收敛为：

```text
PRD.md -> SDD.md -> TODO.md
```

历史回溯入口收敛为：

```text
PROJECT_CONTEXT.md 按编号/日期/关键词定位
```

历史遗留资料只在查证据时使用：

```text
docs/archive/TASK_LOG.md / docs/archive/DECISIONS.md
```

### 关键链路

```text
文档重构 -> 补齐开发准入主文档 -> 收敛历史上下文 -> 标注遗留资料 -> 新会话可按三主文档接手
```

### 重要决策

- 根级 `PRD.md` / `SDD.md` 是日常开发主读；`docs/interview/01-PRD.md` 和 `docs/interview/02-SDD.md` 退回面试材料定位。
- `docs/sdd/` 保留为模块深挖材料，只有涉及对应模块时定位读取。
- `README.md` 只在运行方式、展示入口、部署入口或外部说明变化时更新。
- `docs/archive/TASK_LOG.md` / `docs/archive/DECISIONS.md` 保留历史，不删除、不继续写普通记录。

### 可回溯文件

- `PRD.md`
- `SDD.md`
- `TODO.md`
- `PROJECT_CONTEXT.md`
- `README.md`
- `docs/archive/TASK_LOG.md`
- `docs/archive/DECISIONS.md`

### 验证状态

- 已验证：本轮只执行文档读取和文档修改；未改业务代码；未运行打包；未做 Git 操作；未创建备份。
- 未验证：未运行构建、类型检查、桌面打包或真实入口冷启动，因为本轮明确不要求。
- 风险：根级 `PRD.md` / `SDD.md` 是根据现有文档、实现结构和关键 API 反向补齐，后续若业务实现继续变化，需要同步更新。

### 后续建议

- 新会话接手时先读 `PRD.md`、`SDD.md`、`TODO.md`。
- 若修桌面语音链路，优先看 `SDD.md` 链路 3 和 `TODO.md` 当前 P0。
- 若要查旧验证证据，再按关键词读取本文件或 `docs/archive/TASK_LOG.md` / `docs/archive/DECISIONS.md`。

---

## 2026-06-15 修复前端 404

打包版 YayaMind 桌面应用存在前端 404 问题：
- 原因：`electron/server-runner.cjs` 未设置 `DESKTOP_STATIC_DIR` 环境变量，Fastify 未注册静态文件路由
- 修复：在 `server-runner.cjs` 中添加兜底值 `path.join(__dirname, '..', 'dist')`
- 状态：源码已修复，待重新打包并同步到 `D:\YayaMind`

## 2026-06-15 桌面版阶段收口同步规则

YayaMind 桌面版当前需要区分两类目录：

- 开发源码目录：`D:\obsidian\MyVault\07_项目\个人助手`。所有功能、样式、图片、语音逻辑和文档修改都只改这里。
- 用户实际启动目录：`D:\YayaMind`。桌面快捷方式、开始菜单和重启后的日常入口指向这里，不应手动在这里改业务代码。

日常开发过程中不要每改一小步就同步到安装目录，避免把半成品同步给真实使用入口。阶段结束、用户明确说复盘/收口/这一轮结束时，必须执行桌面版收口流程：

1. 在源码目录完成修改。
2. 运行 `npm run desktop:pack` 生成最新版目录包。
3. 将 `D:\YayaMindBuild\release\win-unpacked` 同步到 `D:\YayaMind`。
4. 删除安装目录里残留的旧 hashed 图片或旧临时资源，避免旧资源被误加载。
5. 从真实入口 `D:\YayaMind\YayaMind.exe` 或桌面快捷方式启动验证，而不是只验证 build 输出目录。
6. 对视觉资源要做真实桌面截图验收，尤其是小猫透明背景、底色、阴影和资源版本。

这条规则来自 2026-06-15 的小猫旧橙色圆底回归：源码和 build 输出已更新，但快捷方式仍指向旧安装目录 `D:\YayaMind`，导致电脑重启后用户看到旧图。以后桌面应用类任务的阶段收口不能只说“打包成功”，必须确认真实用户入口已经同步并启动验证。

## 2026-06-12 桌面小猫与 D 盘应用目录

桌面小猫第二轮已完成 P0/P1/P2 主要闭环：浮窗改为透明背景的完整小布偶猫，支持默认睡觉态和单击倾听态；鼠标为 `grab` / `grabbing`；单击、双击、拖动已用延迟和位移阈值拆分；单击通过 IPC 触发主工作台 `startVoiceInput()`，并处理主窗口刚创建时 IPC 事件丢失的问题。

Electron 主进程现在记录 click、double click、drag start/end、voice start、bubble hide/show/close 和 renderer gone；小猫窗口异常关闭或渲染进程异常退出时会自动重建。托盘菜单保留打开主工作台、显示/隐藏小猫、开机自启和退出应用。

YayaMind 桌面应用相关产物与缓存已迁移到 `D:\YayaMind`：
- 目录版 EXE：`D:\YayaMind\release\win-unpacked\YayaMind.exe`
- 安装包：`D:\YayaMind\release\YayaMind Setup 0.1.0.exe`
- Portable：`D:\YayaMind\release\YayaMind 0.1.0.exe`
- Electron 运行数据：`D:\YayaMind\userData`
- Electron 会话数据：`D:\YayaMind\sessionData`
- npm / Electron / electron-builder 缓存：`D:\YayaMind\cache\...`

`npm run desktop:pack` 和 `npm run desktop:dist` 现在直接输出到 `D:\YayaMind\release`。打包版已验证可脱离命令行启动，`http://127.0.0.1:8787/api/bootstrap` 返回 200，说明生产本地 API 和静态资源加载链路可用。当前仍使用默认 Electron 图标，后续可补正式 `.ico`。


## 2026-06-12 桌面悬浮小猫应用壳 MVP

YayaMind 进入桌面壳第一版实现阶段。当前路线选择为 Electron：优先复用现有 React/Vite 前端、Fastify 本地 API 和现有数据链路，不重写核心业务逻辑，先把入口形态从浏览器标签页推进为桌面常驻小猫。

本轮新增 `electron/` 桌面入口：

- `electron/main.cjs`：Electron 主进程，创建透明置顶悬浮小猫窗口，并按需打开主工作台窗口。
- `electron/preload.cjs`：通过安全 IPC 暴露悬浮球拖动、吸边、展开和打开主窗口能力。
- `electron/bubble.html`：第一版桌面悬浮小猫 UI，支持拖动、靠近屏幕边缘后缩进，只露出一部分入口；双击打开完整 YayaMind 工作台。

当前桌面开发命令为 `npm run desktop:dev`。它会同时启动本地 API、Vite 前端和 Electron 桌面壳，并固定使用 Vite 5173 端口。若本地 API 和 Web 已经在运行，可用 `npm run desktop:open` 只打开桌面悬浮球。桌面壳已接入系统托盘、开机自启、Windows 打包配置和生产包内 API 自启动；全局快捷键、系统级录音权限管理和手机端迁移进入后续阶段。

本轮继续优化后，桌面小猫不再靠边吸附或半隐藏，而是拖到哪里就停在哪里，并记住位置。桌面小猫视觉已从头像按钮升级为透明背景内联 SVG 小布偶猫，包含睡觉态和倾听态；Electron 模式下主工作台内不再显示第二个猫脸，只保留桌面悬浮小猫作为统一入口。桌面小猫单击会通过 IPC 触发主工作台原有语音输入逻辑，双击只打开或聚焦主工作台。

桌面壳已新增系统托盘和开机自启开关：托盘菜单包含打开主工作台、显示/隐藏小猫悬浮窗、开机自启和退出应用。开机自启状态和小猫位置保存到 `D:\YayaMind\userData\desktop-settings.json`。

Windows 打包能力已接入：项目使用 `electron-builder`，提供 `npm run desktop:pack` 和 `npm run desktop:dist`。当前打包配置已能生成 Windows 目录包、NSIS 安装包和 portable EXE；打包版会自启动本地 Fastify API，并从生产静态资源加载主工作台。

## 2026-06-11 云端部署、登录与数据迁移收尾

YayaMind 已从本地 Web MVP 推进到可公开访问的 Vercel 版本，当前线上地址为 `https://yayamind.vercel.app/`，代码仓库为 `https://github.com/goshi-c/yayamind`。

当前部署形态：

- 前端：Vite/React 部署到 Vercel。
- 后端：Vercel `/api/*` Serverless 函数复用原 Fastify 路由。
- 云端存储：Supabase `yayamind_store` 单表文件镜像模式。
- 登录：Supabase Email/Password Auth。
- 数据隔离：云端 key 以 `userId/文件名` 为前缀，不同账号看到不同数据。
- 本地模式：仍保留 `personal-assistant-data/` 本地 JSON/JSONL/Markdown 数据层；不配置 Supabase 时本地开发不受影响。

本轮已解决的部署问题：

- 移除会把 `/api/*` 重写回前端 HTML 的 `vercel.json`。
- 修复 Vercel Serverless 中 ESM 相对导入缺少 `.js` 后缀导致的 `ERR_MODULE_NOT_FOUND`。
- 修复登录成功后因 request context 丢失导致 `/api/bootstrap` 报 `Missing authenticated user context` 并闪退回登录页的问题。
- 增强 Supabase Auth 错误提示，把邮箱未验证、账号已存在、密码不匹配、请求过频等场景转成中文。
- 将本地旧数据迁移到当前云端账号空间：`events.jsonl`、`tasks.jsonl`、`work_logs.jsonl`、`reminders.jsonl`、`reviews.jsonl`、`goals.json`、`todo_projects.json`、`profiles.json`、`settings.json` 和 `summaries/2026-06-02.md`。

安全状态：

- `.env.local`、`.run-logs/`、`.vercel/`、`personal-assistant-data/`、`dist/`、`node_modules/` 均不应提交。
- Supabase service role key、数据库密码、DeepSeek key 不写入仓库或文档。
- 因为调试时密钥曾在对话中出现，跑通后建议在 Supabase 和 DeepSeek 后台轮换密钥，并更新 Vercel 环境变量。

## 2026-06-10 项目收尾与面试材料

YayaMind 当前已完成一轮面向 AI 产品经理面试的文档收尾。新增 `docs/interview/` 目录，用于集中存放用户可读、可复述、可面试讲解的项目材料：

- `01-PRD.md`：产品背景、目标用户、核心痛点、MVP/V1.1 范围、核心流程和后续规划。
- `02-SDD.md`：React/Vite 前端、Fastify 后端、本地 JSON/JSONL 数据层、AI adapter、API 和核心数据流。
- `03-COMPETITOR_ANALYSIS.md`：Motion、Sunsama、Reclaim、Todoist、Notion Calendar、TickTick、Akiflow 的功能对比和差异化启发。
- `04-PROJECT_DETAILS.md`：项目结构、前后端连接、数据文件、核心数据流和面试讲解顺序。
- `05-INTERVIEW_QA.md`：AI 产品经理面试常见追问与推荐回答。

当前面试讲解主线：YayaMind 是一个本地优先、语音优先、带陪伴感的 AI 个人执行助手。技术上使用 React/Vite 前端、Fastify 本地后端、本地 JSON/JSONL/Markdown 数据层，AI 作为自然语言理解和语音纠错增强能力，关键写入仍由后端规则守卫。

## 2026-06-04 当前状态摘要

YayaMind 当前处于 Web V1.1 可用性打磨阶段，核心体验已经从“普通输入框 + 日历面板”推进到“点击小猫语音对话 + 一周缩略日程 + 右侧日期详情”的工作台形态。本轮重点围绕真实使用反馈修正了语音写入后的确认、修改和页面定位体验。

当前已确认的最新交互状态：

- 小猫头像是主要输入入口：点击开始听写，停顿约 1 秒后自动写入；按住并移动才拖动头像，避免点击和拖动冲突。
- 小猫气泡首屏默认不显示历史文案，只有听写、思考、追问、确认、修改等状态才出现。
- 新增日程/任务写入后，会先进入 `确认 / 修改 / 取消` 流程，并自动跳到对应日期和时间点，让用户马上看到小猫放到了哪里。
- 如果语音识别把“明天”识别成“今天”，用户可以点 `修改` 后直接说“不是今天，是明天”“不是周五，是周六”之类的话来修正。
- 已有安排可以继续用自然语言补充准备事项，例如“明天晚上的会要带上笔记本电脑”；准备类信息只进入准备事项，不再复制到备注。
- 一周安排中间区域仍保持周一到周日的整体预览；每一天内部可以滚动，时间轴保留细刻度，日程块支持拖动整体移动和上下边缘调整开始/结束时间。
- 中间日程块只显示短标题，具体时间由块的位置和高度表达；右侧详情再展示完整时间。
- 右侧详情区域是编辑主区域：页面上不再显示“日期详情”标题；具体安排、待补充事项、截止任务、提醒等都在右侧展开，内联编辑收敛为标题、月/日、开始/结束时间和准备事项。
- 当前视觉保持浅色暖调；日程块使用透明玻璃描边，必须让背景小时数字和虚线透出来。

本轮验证状态：

- `npx tsc --noEmit --pretty false` 通过。
- `npm run build` 通过。
- 本地 API `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 前端预览 `http://127.0.0.1:5173` 可打开，首屏无 Vite 错误。

## 项目定位

这是一个偏个人使用的 AI 个人助手项目，当前产品名为 **YayaMind**。目标不是再做一个普通 TODO 或日历工具，而是做一个能陪用户执行计划、记录真实进程、动态调整安排、沉淀个人习惯的生活化助手。

第一阶段先做 Web 模拟版：在网页里模拟桌面小猫浮窗，同时提供数据面板。后续再迁移为真正的桌面应用。项目既要自己长期可用，也要能包装成作品集项目，用来展示 AI 产品设计、前后端集成、本地数据存储和 SDD 能力。

当前代码已经完成 Web MVP，并完成一轮 V1.1 可用性增强：React/Vite 前端 + Fastify 本地后端 + JSON/JSONL 本地数据层。页面从深色工作台逐步调整为浅色橘黄/肉色调的涂鸦可爱风，品牌为 YayaMind，左上角图标方向为 `Y + 猫爪` 融合，浮窗角色方向为布偶猫风格。

## 核心体验

- 桌面入口是一只可爱的小猫，而不是冷冰冰的输入框。当前视觉方向是布偶猫风格，和用户真实猫咪“丫丫”关联。
- 小猫平时常驻在页面角落，可以点击、拖动、冒气泡，后续可做靠边隐藏、探头、挠屏幕等互动。
- 用户可以通过小猫语音对话告诉小猫：添加日程、安排任务、记录进度、调整计划、记录没完成原因、设置生活提醒。
- V1.1 后小猫浮窗以语音实时转写为主：用户说话后看到转写内容和理解预览，点击确认再写入；时间模糊、真实时间冲突、过载时只出现一个追问/选择卡片。
- 小猫默认有陪伴感和互动感。复盘和计划偏差分析时不明显切换人格，只是语气更认真，避免突然变得像审问。
- 产品重点是“计划 + 真实执行 + 动态重排 + 经验沉淀”，而不是只做计划列表。

## Web 面板布局

Web 面板采用三栏布局，当前 V1.1 已调整为“窄左侧导航 + 一周安排 + 日期详情”：

- 左侧：窄导航，只保留图标和短标签，避免占用主要信息空间。
- 中间：自然周一周安排，周一到周日列视图；有明确开始/结束时间的事项显示为透明日历块，块内只显示短标题，待补充事项/任务不混入时间轴。
- 右侧：选中日期详情，按顺序展示该日具体安排、出门天气提醒和执行记录；点击具体小事件块后打开右侧内联编辑。

日历视图要求：

- 已经过去的时间区域显示为灰色。
- 今天有当前时间线。
- 不同类型的安排用不同颜色区分。
- 工作任务、会议日程、生活杂事、运动训练、休息吃饭、风险/延期事项应有明显但好看的视觉区分。
- 时间轴覆盖 0:00-24:00，兼容凌晨安排和较晚作息。
- 日历块可以拖拽移动，也可以拖上下边缘调整开始/结束时间，按 10 分钟粒度吸附保存。
- 时间冲突只作为轻量小标签显示，不在右侧详情重复解释；冲突不默认代表错误，用户可以选择重叠。

## MVP 范围

第一版需要支持以下能力：

1. 开始、暂停、结束工作。
2. 添加日程，例如“明天早上 8 点有会”。
3. 添加任务，例如“今晚我要写完产品方案”。
4. 安排时间块，例如“今天 20:00-22:00 写方案”。
5. 记录进度，例如“我写了一半，可能干不完”。
6. 动态重排，在任务做不完或新任务插入时给 1-2 个方案让用户选择。
7. 记录没完成原因，并沉淀为后续估时和计划建议。
8. 记录生活事项和提醒，例如“20 分钟后提醒我晾衣服”。
9. 阶段性目标，包括目标、里程碑、任务关联、周复盘进展。
10. 个人画像雏形，包括时间习惯、任务估时、生活节奏、工作偏好。
11. 浏览器内提醒：网页打开时小猫冒泡提醒，并支持浏览器通知。
12. Obsidian 本地文件存储。
13. AI 自然语言解析和轻量建议。

## V1.1 迭代方向

MVP 已经完成，当前进入 **YayaMind V1.1** 迭代。V1.1 的目标不是继续堆复杂功能，而是在已有 Web MVP 闭环上优先提升基础好用程度，让用户更自然地把会议、提醒、任务、临时想法和准备事项交给小猫。

V1.1 的核心判断：

- 首页第一屏继续保持“一周安排”，左侧/中间是一周预览，右侧是选中日期详情。
- AI 感优先体现在输入理解，而不是复杂自动排程或大段建议。
- 用户可以像跟小猫说话一样输入自然语言，小猫负责抽取结构化信息，并在需要时用温和方式追问缺失字段。
- 右侧日期详情需要展示完整但克制的信息，包括标题、具体事项、时间、准备事项、提醒和执行记录；避免“目的/备注”等重复字段堆叠。
- 小猫角色是陪伴型助手，不是严厉监督型助手；反馈要轻、短、可继续行动。

V1.1 优先增强三块：

1. 输入理解确认：从一句话中提取标题、时间、类型、具体事项、准备事项、提醒等字段，写入前给用户可确认的结构化预览。
2. 日期详情增强：让选中日期不只是列出短标题，而能承接具体事项、时间、准备事项、提醒和执行记录。
3. 轻量动态安排与陪伴奖励反馈：对时间不明确、计划过载、完成/推进等场景给 1-2 个轻量建议和陪伴式反馈。

V1.1 当前已补齐的试用反馈：

- 明确时间段不再误追问；已取消/已移动的旧事项不再参与时间冲突判断；日程不按标题相似判重复。
- 右侧事项详情支持内联编辑标题、月/日、开始/结束时间、准备事项、截止时间和估时，并支持软删除。
- 执行记录支持编辑和删除；提醒生成的历史行保持只读。
- 小猫对话收敛为一个气泡，语音实时转写 + 确认写入，不再保留普通底部输入框。
- 一周安排时间块支持拖动和上下边缘拉伸，按 10 分钟吸附。
- 右侧详情移除普通提醒列表，只保留具体安排、出门天气提醒和执行记录。
- 后端接入 Open-Meteo 7 天游雨概率，结合外出类安排生成“出门前带伞”等提醒。

## 暂不做

第一版暂不做以下内容：

- 自动看屏幕或截图分析。
- 手机 App。
- 微信入口或小程序。
- 复杂自动排程算法。
- 系统级常驻提醒。
- 多用户账号系统。
- 睡眠/状态记录。
- 特别精致的小猫动画。
- 更完整的桌面系统能力，如全局快捷键、系统级录音权限管理。

## 冲突与重排原则

默认原则：无冲突就直接记录，有冲突才询问用户。

需要确认的情况：

- 新日程或时间块与已有安排真实时间范围重叠。
- 新任务安排与已有任务块冲突。
- 任务类可以保留疑似重复检查；日程类不按标题相似判重复。
- 当天计划过载，例如剩余可用时间小于新增任务预估时间。
- 时间不明确，例如“明天上午开会”但没有具体时间。
- 动态重排会移动已有计划。

重排建议不要给太多，默认只给 1-2 个方案，降低用户决策负担。日程时间冲突只给 `修改 / 重叠 / 取消` 这类动作选择，不暴露内部实现逻辑。

示例：

```text
今天还剩大约 1.5 小时可安排，但这个任务预计要 3 小时。

方案 A：今晚先做 1 小时，明天上午继续。
方案 B：整体放到明天上午。
```

## 复盘与个人画像

计划没完成时，小猫需要进入更严谨的复盘助手模式，询问原因并记录经验。

常见原因包括：

- 任务耗时低估。
- 中途被临时事项打断。
- 状态不好或太累。
- 主动休息或临时生活安排。
- 拖延或摸鱼。
- 任务范围变化。

第一版重点沉淀四类画像：

- 时间习惯：效率高的时间段、容易拖延的时间段、常见作息、一天可承受的工作块。
- 任务估时：哪些任务经常低估，哪些任务需要加缓冲，哪些任务适合拆分。
- 生活节奏：训练、吃饭、家务、社交、休息等对计划的影响。
- 工作偏好：适合长专注还是短冲刺，喜欢先做难事还是简单事，什么时候需要鼓励或直接督促。

画像的目的不是单纯分析用户，而是让下一次计划更贴合用户真实习惯。

## 数据存储设想

Obsidian 作为本地数据仓库，网页端负责给人阅读和操作。核心数据优先使用程序易读的 JSON/JSONL，周报和总结可以生成 Markdown。

初步目录设想：

```text
personal-assistant-data/
  events.jsonl
  tasks.jsonl
  work_logs.jsonl
  reviews.jsonl
  goals.json
  profiles.json
  settings.json
  summaries/
    2026-06-01.md
    2026-W23.md
```

数据流：

```text
小猫浮窗语音对话
  -> 语音实时转写
  -> 用户确认转写和理解预览
  -> AI 解析
  -> 本地后端写入 Obsidian 数据文件
  -> Web 面板刷新显示
```

## AI 使用策略

需要关注 AI 成本，不应所有操作都依赖强模型。

初步策略：

- 时间解析：规则优先，AI 兜底。
- 类型判断：AI 将一句话分类为日程、任务、进度、复盘、提醒等。
- 冲突判断：程序逻辑判断。
- 重排建议：简单规则 + AI 表达。
- 画像更新：先规则更新，必要时让 AI 生成总结句。
- 深度周报、长期画像总结：低频使用更强模型。

后续可以接入用户自己的模型 key 进行测试。

## 阶段路线

### 阶段 1：Web 模拟版

- 已完成 SDD 主体文档：`docs/sdd/00` 到 `docs/sdd/13`。
- 已做出三栏 Web 面板代码初版，MVP 已完成可演示闭环。
- 已在网页中模拟布偶猫风格浮窗入口。
- 已完成从文字输入基础闭环到小猫语音对话入口的迭代。
- 已实现基础本地 API、JSON/JSONL 文件读写、工作状态接口、提醒状态接口和基础冲突检查。
- V1.1 继续增强输入理解、日期详情、轻量动态安排和陪伴反馈，不扩展为复杂自动排程系统。

### 阶段 2：桌面壳

- 将成熟的小猫交互迁移到 Electron 或 Tauri。
- 支持真正的桌面常驻、窗口置顶、拖动、靠边隐藏。
- 接入系统级快捷键、录音权限和系统通知。

### 阶段 3：更深系统能力

- 活跃窗口检测。
- 空闲检测。
- 可选截图分析。
- 更完整的动态排程和个人画像。

## 后续待定问题

- 作息偏好设置入口：常用睡觉/起床时间、默认日历显示范围。
- 天气城市配置：默认城市、天气坐标或浏览器定位。
- 右侧内联详情继续细化：地点、提醒时间、准备事项增删控件。
- 涂鸦风视觉继续精修：手写感分隔线、安排块质感、图标和空状态。
- V1.1 作品集截图和功能说明更新。

## 2026-06-07 当前状态补充：项目待办模块

当前工作台已新增独立的 `待办` 导航入口。这个模块用于按项目分类管理任务，而不是按日期组织任务。项目分类存储在 `personal-assistant-data/todo_projects.json`，任务仍使用原任务数据结构，但额外支持 `projectId`、`status` 和 `dueAt`。

待办页左侧负责项目和任务管理：项目名称、任务标题、备注都采用点击文字原地编辑和失焦自动保存；完成任务会变浅灰、加删除线并下沉到当前项目底部；任务也可以拖到其他项目分组中移动。右侧负责当月日历，任务拖到某一天会把该日期写入 `dueAt`，并以不可编辑的日期 tag 展示；备注和日期 tag 是两行独立信息。

一周日程仍保留按周查看日程的核心职责。中间周视图不再显示截止任务划线，截止任务集中放在右侧日期详情中展示。当前一周日程时间轴显示 7:00-24:00，避免早晨 7 点前出现大段空白。

本轮还没有完成语音转写后的 AI 改写/纠错，也没有完成右侧日期详情所有字段的点击即编辑。下一轮应先读 `TODO.md` 顶部 2026-06-07 交接项。

## 2026-06-07 当前状态补充：语音纠错和待办截止逻辑

语音输入现在采用“实时转写先显示，停顿后先纠错，再进入理解/追问”的链路。明显转写错误会在解析前修正，例如 `项目代办` 修为 `项目待办`、`开为` 修为 `开会`。听写中的草稿不再提前触发缺时间/缺事项追问，避免用户刚说完半句时气泡来回跳。

项目待办解析增加了“项目名 + 新增待办 + 内容”的句式识别。类似 `学校新增一个待办，周四要提交开题报告的表格版` 会把 `学校` 作为项目归属，把 `提交开题报告的表格版` 作为待办标题，把 `周四` 写入 `dueAt` 以生成日期 tag。若用户说到具体时间点，例如 `周四下午3点`，时间点进入备注，便于用户在待办列表里看到补充说明。

右侧日期详情的截止任务收敛为“有具体时间点的待办才展示”。只有日期、没有具体时间点的待办保留在项目待办页和月历色点中，避免右侧详情被普通项目待办挤占。

视觉和手感继续往铅笔/涂鸦方向收敛：字体栈优先使用楷体、仿宋和文楷类字体；右侧详情颜色改为暖棕层级；待办拖拽移除猫爪图，改用系统抓取手势。

## CTX-20260616-004：MVP 收尾体验修复与节假日补齐

### 背景

用户在 MVP 收尾前指出一组真实使用问题：缩窄主界面时右侧新增日程加号消失；桌面 / Web 小猫气泡长时间停留；周视图标题过长、日期叠加“今天”和休息文字导致下移；个人画像页标题重复、作息设置和保存按钮错位；右侧详情编辑另起表单且长文本不可读；项目待办一页项目过多、新增入口和勾选圆圈未对齐；法定节假日开关没有真正影响本周休息日显示。

### 本轮做了什么

- `src/App.tsx`：将周视图事件短标题压缩到 2-3 个字；移除日期标题中的“今天”；接入 2026 年中国法定节假日 / 补班日集合；右侧详情改为原卡片原地编辑；任务备注、日程备注和具体安排纳入保存；待办改为每页两个项目并在项目标题旁提供圆形新增待办；空新增待办失焦或外部点击后自动收起；个人画像保存按钮仅在设置变更后显示。
- `src/styles.css`：将全局最小宽度从 1220px 降为 760px；修复窄视口右侧加号可见性；统一时间输入、详情编辑、个人画像、待办勾选和新增按钮的圆角、尺寸、对齐和响应式规则；休息日 / 法定节假日 / 补班日改为颜色提示，不再叠加文字。
- `electron/bubble.html`：桌面小猫消息气泡收到文本后 5 秒自动隐藏。
- `PRD.md`、`SDD.md`、`TODO.md`：同步本轮 MVP 收尾状态、验收口径和节假日实现边界。

### 验证状态

- 已运行 `npm run build`，TypeScript 和 Vite 生产构建通过。
- 已启动开发态预览 `http://localhost:5173/`，复用已有 8787 本地 API。
- Browser 验证：
  - 920px 窄视口下右侧新增日程加号仍可见，页面无横向溢出。
  - 周视图日期显示为 `周一 6/15` 到 `周日 6/21`，不再叠加“今天”。
  - `要去健身房` 类事件短标题显示为 `健身`。
  - 个人画像页只显示一个 `个人画像` 标题，保存按钮初始隐藏，时间输入框宽约 104px。
  - 待办页每页显示 2 个项目，项目内圆形加号数量与项目数一致，空新增待办点击外部后从 1 个表单收起为 0 个表单。
  - 右侧详情点击进入编辑后，同一张卡片出现 1 个内联编辑器，原展示头隐藏，时间输入框宽约 86px。
  - 2026-06-19、2026-06-20、2026-06-21 均带 `day-legal-rest`。

### 当前边界和风险

- 本条记录的初始验证层级是 source / dev 预览；后续已在 `CTX-20260616-005` 补执行 `npm run desktop:pack`、同步真实入口 `D:\YayaMind` 并冷启动验收。
- 2026 年节假日数据来自国务院办公厅 2026 年部分节假日安排口径，当前实现为前端年度集合；跨年需要更新年度数据或后续改为数据文件/API。
- 时间选择器的原生下拉样式仍受浏览器控制，代码已让点击时间输入框任意位置触发 `showPicker()`，并通过样式收窄输入框、统一圆角和强调色。

### 下一步建议

- 真实入口同步已补到 `CTX-20260616-005`；后续同类桌面体验修复收口时，不应只停在 dev/source 预览。
- 之后可继续补新用户教程或将打包同步流程沉淀为 `desktop:release-local` 脚本。

## CTX-20260616-005：MVP 收尾同步真实入口

### 背景

用户明确要求本轮 MVP 收尾改进直接同步到真实入口，并指出 `productize` Skill 应把“完成一组可验收改进后同步真实入口”的规则写清楚。

### 本轮做了什么

- 更新 `C:\Users\17978\.codex\skills\productize\SKILL.md`：将“真实入口优先提醒”移到 Skill 前部醒目位置，强调桌面/App 项目已有用户日常真实入口时，本轮功能或体验修改完成后不能只停在 source/dev 预览；底部桌面专项规则只保留引用，避免 Skill 过度复杂。
- 执行 `npm run desktop:pack`，生成最新 `D:\YayaMindBuild\release\win-unpacked`。
- 同步前确认路径边界：
  - 构建输出：`D:\YayaMindBuild\release\win-unpacked`
  - 正式启动目录：`D:\YayaMind`
  - 用户数据目录：`D:\YayaMindData`
  - `D:\YayaMindData` 不在正式启动目录内。
- 同步前停止正在运行的 `D:\YayaMind\YayaMind.exe` 进程，避免文件锁。
- 使用 `robocopy` 将 `win-unpacked` 镜像同步到 `D:\YayaMind`，排除 `cache`、`userData`、`sessionData` 目录；同步结果 `robocopy=3`，失败数为 0，并清理了旧 hashed JS/CSS 资源。
- 从 `D:\YayaMind\YayaMind.exe` 冷启动真实入口。

### 验证状态

- `D:\YayaMind\resources\app\dist\assets` 当前资源：
  - `index-DGXR-8JP.js`
  - `index-C5p-lAwQ.css`
  - `cat-listening-CWHVjGFs.png`
  - `cat-sleeping-B8rLpEFE.png`
- `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 当前存在 `D:\YayaMind\YayaMind.exe` 真实入口进程。
- `D:\YayaMindData\userData\desktop-cat.log` 出现本次冷启动后的 `bubble-create` 和权限检查日志。

### 当前边界和风险

- 本轮已经完成 final packaged / synced entry 验收中的打包、同步、冷启动和 API 健康检查。
- 仍需用户在真实桌面交互环境点击小猫说一句，确认日志出现 `commit-success`，且日程格子刷新；这一步不能由后台健康检查完全替代。

## CTX-20260616-006：项目待办拖拽、归类和小猫气泡显示修复

### 背景

用户在项目待办页指出：未归类 / 无命名项目删除受限；项目卡片宽度被内容长短撑得不一致；拖动项目或待办时缺少释放位置预览；待办编辑框没有跟随文字高度和宽度自然适配；语音说“生活新增一条待办”时没有归入生活；新一轮点击小猫听写时仍显示上一轮“已新增”历史提示。

### 本轮做了什么

- `src/App.tsx`：新增待办拖拽目标状态；项目卡片和待办项在拖过时显示目标预览；未归类删除按钮改为可清空其中待办；待办标题 / 备注编辑从单行输入改为按内容估算行数的多行输入；新语音会话开始时清空旧成功态和旧解析预览；桌面小猫消息优先显示实时输入 / 正在听，再显示上轮成功提示。
- `src/styles.css`：项目待办列表改为稳定两列等宽；项目卡片宽度设为 100%；补充拖拽高亮、占位条和多行编辑器样式。
- `server/dataStore.ts`：归类推断增加“已有项目名 + 新增/添加/记 + 待办/任务”和 AI 返回项目字段的兜底，避免已有项目被误建新项目或落入未归类。
- `TODO.md`：追加本轮开发态修复与验证记录。

### 验证状态

- 已运行 `npm run build`，TypeScript 和 Vite 生产构建通过。
- 开发态 Browser 验证 `http://localhost:5173/` 待办页：项目列表两列宽度为 `401px 401px`；生活、学校、未归类、工作四个项目卡片宽度均为 401px。
- 通过 `/api/input/parse` 验证 `生活新增一条待办` 被识别为 `add_task`。
- 使用临时 `YAYAMIND_DATA_DIR` 跑 commit 验证：已有工作、学校、生活三个项目时，`生活新增一条待办` 写入的 `taskProject` 为 `生活`，项目总数仍为 3。

### 当前边界和风险

- 本条记录属于 source / dev 预览验证，尚未同步到真实入口 `D:\YayaMind`。
- 真实桌面小猫的气泡退场和新一轮听写显示仍需用户在桌面环境点击小猫做人工手感确认。

## CTX-20260616-007：真实入口同步漏做复盘与补同步

### 背景

用户指出同类问题反复出现：源码和开发态预览修好了，但没有同步到真实入口，导致用户从日常入口 `D:\YayaMind\YayaMind.exe` 无法验证最新行为。本轮不继续处理新功能，专门复盘为什么漏做真实入口同步、强化规则，并把上一轮改动补同步到真实入口。

### 原因分析

- 不是缺少规则：`productize/SKILL.md`、`PROJECT_CONTEXT.md`、`TODO.md` 和 `FILE_INDEX.md` 都已经写过真实入口同步规则。
- 直接原因：上一轮收尾时把 `npm run build`、Browser 开发态验证、临时数据目录验证当成可交付结论，没有执行 final packaged / synced entry 的收尾闸门。
- 深层原因：规则写成“提醒 / 默认继续”后，模型仍可能在开发态验证通过后生成最终回复；缺少“最终回复前必须检查是否已经同步真实入口”的阻断条件。
- 对用户的实际影响：用户日常打开的是真实入口，不是源码目录、开发服务器或 build 输出目录；不同步就会让用户看到旧资源、旧小猫行为或旧前端逻辑，验证路径断掉。

### 本轮做了什么

- `C:\Users\17978\.codex\skills\productize\SKILL.md`：将真实入口规则升级为“桌面真实入口收尾闸门”，规定满足桌面/App、已有真实入口、本轮影响真实入口、用户未明确只要开发态、同步无高风险时，最终回复前必须完成 source/dev 验证、package/sync、真实入口冷启动验收。
- `C:\Users\17978\.codex\skills\productize\PRODUCT_LESSONS.md`：将经验 020 标记为已写入 Skill，并补充这次升级的关键是“最终回复前闸门”，不是只在汇报里提醒。
- `TODO.md`：补充本轮真实入口同步与验收结果。
- 补执行 `npm run desktop:pack`，生成最新 `D:\YayaMindBuild\release\win-unpacked`。
- 同步前确认路径边界：
  - 构建输出：`D:\YayaMindBuild\release\win-unpacked`
  - 正式启动目录：`D:\YayaMind`
  - 用户数据目录：`D:\YayaMindData`
  - 三者彼此分离。
- 停止旧 `D:\YayaMind\YayaMind.exe` 进程后，用 `robocopy /MIR` 将构建输出同步到 `D:\YayaMind`，排除 `cache`、`userData`、`sessionData`；同步结果 `ROBOCOPY_EXIT=3`，失败数 0，并清理旧 hash 资源。
- 从 `D:\YayaMind\YayaMind.exe` 冷启动真实入口。

### 验证状态

- `npm run desktop:pack` 通过，包含 `npm run build`、`npm run build:server` 和 electron-builder 目录包。
- 真实入口进程已启动，路径为 `D:\YayaMind\YayaMind.exe`，启动时间为 2026-06-16 21:39:51。
- `http://127.0.0.1:8787/api/bootstrap` 返回 200。
- `D:\YayaMind\resources\app\dist\assets` 当前资源：
  - `index-BrN2Qbyp.js`
  - `index-CnSCsdDJ.css`
  - `cat-listening-CWHVjGFs.png`
  - `cat-sleeping-B8rLpEFE.png`
- 真实入口 JS 中包含本轮小猫气泡优先级逻辑：有输入或正在听时优先显示本轮内容，再显示 `已加好`。
- 真实入口 CSS 中包含本轮项目待办改动：`todo-drop-slot`、`todo-drop-preview`、`todo-task-drop-preview`、两列 `repeat(2, minmax(260px, 1fr))`。
- `D:\YayaMindData\userData\desktop-cat.log` 出现本次冷启动后的 `bubble-create` 和权限检查日志。

### 预期作用

- 以后同类桌面/App任务在最终回复前会先触发真实入口收尾闸门：只要用户要从日常入口验证，且没有明确只要开发态，就不能把开发态验证当成交付。
- 这个机制有效的原理是把“能在源码/开发服务器看到”与“用户真实入口已加载新资源”拆成两个不同验收层，并把后者设为最终回复前的必过项。
- 对 YayaMind 这类桌面应用，真实可验收状态至少需要四层一致：源码已改、构建产物已生成、真实启动目录已同步、真实 exe 冷启动加载最新资源。

### 当前边界和风险

- 已完成 final packaged / synced entry 的打包、同步、冷启动和 API 健康检查。
- 小猫真实语音转写和拖拽手感仍需要用户在桌面环境亲自点击/拖动确认；后台只能确认真实入口已加载最新代码和日志链路已启动。

## CTX-20260616-008：待办拖拽语义、今日待办分区和闹钟语义修复

### 背景

用户指出项目待办拖拽仍然混乱：待办和项目都缺少“当前选中谁”的范围反馈，拖动时容易误把多条待办一起移动；同项目内排序、跨项目移动、项目卡片跨列 / 本列排序的逻辑没有被收窄。同时用户反馈桌面语音“今天晚上睡觉之前要定个闹钟，明天至少要两点钟起来”只完成转文字，没有落成待办；以及工作项目里 2026-06-16 的“喂流浪猫盒子”待办没有出现在右侧今日详情。

### 本轮做了什么

- `src/App.tsx`：项目待办拖拽新增长按武装状态，长按后才给待办 / 项目设置可拖拽并显示虚线选中框；待办跨项目释放统一追加到目标项目末尾，同项目内按目标待办上 / 下插入线排序；项目卡片按目标项目上 / 下插入线排序。
- `src/App.tsx`：右侧日期详情拆为“日程”和“待办”两个独立滚动区。日程区放明确时间块、待补充事项和提醒；待办区放当天带 `dueAt` 的项目待办。
- `src/styles.css`：新增待办 / 项目选中虚线框、蓝色插入线、跨项目末尾投放高亮和右侧详情双滚动区样式。
- `server/dataStore.ts`：`buildCalendar` 不再要求待办必须有具体时间点才进入当天详情；给 calendar task 补 `projectTitle`；“定闹钟 / 起床 / 起来 / 睡前”类输入优先解析为生活项目待办。
- `SDD.md`、`TODO.md`：增量记录本轮拖拽状态机、右侧详情分区和语义落库规则。

### 验证状态

- `npm run build` 通过，TypeScript 和 Vite 构建成功。
- 语义回放：`parseAndEnrichTextInput('今天晚上睡觉之前要定个闹钟，明天至少要两点钟起来', ..., 'voice')` 返回 `intent: add_task`、`projectTitle: 生活`、`needsConfirmation: false`。
- 临时 `YAYAMIND_DATA_DIR=.run-logs/tmp-voice-task-data` 跑 `commitTextInput`，确认写入 `tasks.jsonl`，并创建 / 关联“生活”项目；测试过程中误用一次环境变量写入开发态数据，已定位唯一测试行并移除，确认无残留。
- 临时 `YAYAMIND_DATA_DIR=.run-logs/tmp-day-task-data` 构造普通 2026-06-16 deadline 待办，`getBootstrapData().calendar[2026-06-16].tasks` 已包含该待办及 `projectTitle: 工作`。
- Browser source/dev 验证 `http://127.0.0.1:5173`：待办和项目初始没有 `draggable` 属性；页面 CSS 已加载 `.todo-selected`、任务 / 项目蓝色插入线和 `.today-detail-split` 分区样式。
- `npm run desktop:pack` 通过，包含 `npm run build`、`npm run build:server` 和 electron-builder 目录包。
- 已同步 `D:\YayaMindBuild\release\win-unpacked` 到真实入口 `D:\YayaMind`，同步结果 `ROBOCOPY_EXIT=3`，失败数 0。
- 从 `D:\YayaMind\YayaMind.exe` 冷启动真实入口，进程路径为 `D:\YayaMind\YayaMind.exe`，启动时间 2026-06-16 22:13:02，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口资源验证：`D:\YayaMind\resources\app\dist\assets` 包含 `index-BqdEopaU.js`、`index-ZhRr-Dms.css`；JS 中包含闹钟 / 起床待办规则，CSS 中包含 `today-detail-split`、`todo-selected` 和蓝色插入线。
- 真实入口 API 验证：2026-06-16 的 `calendar.tasks` 已返回“之前要去楼下把喂流浪猫的盒子收上来，新增一条待办”，`projectTitle: 工作`。
- Browser 刷新 `http://127.0.0.1:5173/?verify=20260616-2214` 后，右侧详情文本显示“日程”和“待办”两个分区，待办区包含“喂流浪猫盒子”工作待办。

### 当前边界和风险

- 已完成 final packaged / synced entry 的打包、同步、冷启动和 API 健康检查。
- 长按拖拽真实手感仍需要用户在桌面 / 浏览器里人工拖一次确认；后台已验证前端状态、样式加载、真实资源和数据聚合，但没有替用户执行真实鼠标长按拖拽。

## CTX-20260617-001：待办拖拽旧能力回归修复与链路复盘

### 背景

用户确认待办 / 项目的选中优先级已经基本正确，但指出两处旧能力回退：deadline 日期 tag 失去原本按日期远近变化的颜色；长按待办拖到右侧月历某一天后自动改截止日期的功能消失。用户同时要求复盘这类“只改功能链路中的一环，漏掉旁路旧能力”的问题，并写入经验库 / Skill。

### 本轮做了什么

- `src/App.tsx`：把右侧月历日期重新接入待办长按拖拽状态。拖动待办经过月历日期时生成 `date` 类型 drop preview，松手后调用 deadline 更新逻辑；月历日期按钮补 `data-todo-date`，用于识别日期落点。
- `src/styles.css`：把 `.todo-date-tag` 从 `.todo-inline-actions button` 通用操作按钮样式中排除，恢复 deadline tag 的颜色变量；新增 `.todo-date-drop-preview`，让拖到月历日期时有蓝色落点反馈。
- `SDD.md`：补细项目待办链路，明确同项目排序、跨项目移动、拖到月历改 deadline、日期 tag 颜色、月历色点和右侧日期详情都属于同一组回归项。
- `C:\Users\17978\.codex\skills\productize\PRODUCT_LESSONS.md`：新增经验 022，记录本次“只看排序，漏掉拖到日期和颜色”的返工。
- `C:\Users\17978\.codex\skills\productize\SKILL.md`：新增“功能链路回归闸门”，把修改已有功能链路前必须列出现有入口、输出、旁路能力、视觉反馈和旧验收提升为硬门禁。

### 验证状态

- `npm run build` 通过，TypeScript 和 Vite 构建成功。
- Browser source/dev 验证 `http://127.0.0.1:5173`：待办页可见 `#6/16` 日期 tag；computed style 显示 tag 已恢复有色背景、边框和文字色；右侧月历日期存在 `data-todo-date="2026-06-17"`。
- `npm run desktop:pack` 通过，生成 `D:\YayaMindBuild\release\win-unpacked`。
- 同步前确认构建输出目录 `D:\YayaMindBuild\release\win-unpacked` 和正式启动目录 `D:\YayaMind`；停止旧 `YayaMind.exe` 后用 robocopy 覆盖复制同步，`robocopy_exit=3`，失败数 0。
- 从 `D:\YayaMind\YayaMind.exe` 冷启动真实入口，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口首页加载本轮资源：`assets/index-BzKVjLSQ.css`、`assets/index-BEhXHX-p.js`；CSS 包含 `todo-date-drop-preview` 和 `todo-date-tag`，JS 资源包含 `data-todo-date`。

### 当前边界和风险

- 为避免改动用户真实待办数据，后台没有在真实数据上实际把某条待办拖到另一天并松手写入；已通过代码路径、构建、Browser 样式 / DOM 和真实入口资源验证确认链路已接回。
- 用户仍需在真实入口里人工长按一条待办，拖到右侧月历某天，确认松手后日期 tag、月历色点和右侧日期详情按预期更新。

## CTX-20260617-002：一日详情、右键删除、未归类兜底和设置页修补

### 背景

用户在一周日程右侧的一日详情和项目待办页继续做 MVP 收口体验修补：今天标题只显示“今天”；右侧待办只保留截止时间和正文；待办编辑框要和预览态行数、字体一致；删除按钮全部改为右键删除；未归类作为识别失败和项目未匹配时的兜底；小猫在 AI rewrite / intent parse / commit 期间不能提前睡觉；左侧底部新增设置入口，用于配置 AI 接口。用户同时提出 1.0 版本新增“习惯/周期安排”和“AI 修改已有日程”的规划。

### 本轮做了什么

- `src/App.tsx`：右侧今日标题对今天只显示“今天”；右侧待办区不再显示项目分类、具体安排和备注标签；待办详情编辑改为按内容动态计算行数，字号和行高与预览态对齐。
- `src/App.tsx`：去掉项目待办和右侧详情里的可见删除按钮；右键待办删除该待办，右键项目空白区域删除项目并把任务迁移到未归类；未归类本身改为不能删除。
- `server/dataStore.ts`：自然语言待办识别到不存在的项目名时，不再自动创建项目，改为落入未归类。
- `src/App.tsx`、`electron/bubble.html` 链路相关状态：前端在 parse / commit / refresh 期间保持 `isThinking`，桌面小猫在待确认、待修改、写入后确认等交互态保持站立；气泡增加灰色“我听到了，正在理解中”状态提示。
- `src/App.tsx`、`src/styles.css`、`server/types.ts`、`server/dataStore.ts`、`server/aiAdapter.ts`：新增左侧底部设置入口和 AI 接口配置，支持 provider、base URL、model、API Key；AI Adapter 优先读 `settings.json`，未配置时回退 `.env.local` / 环境变量。
- `PRD.md`、`SDD.md`、`TODO.md`：同步当前 MVP 范围、实现状态、接口和验收边界。
- `docs/roadmap/YayaMind-AI-1.0-PRD-SDD.md`：补充 1.0 的“习惯与周期安排”和“AI 修改已有日程”规划，当前不纳入 MVP 必做项。

### 当前边界和风险

- 本轮仍属于 MVP 体验修补，1.0 习惯/周期安排和复杂 AI 修改追问只更新 roadmap，没有进入根目录当前版本开发范围。
- 后续需要在真实入口人工确认：右键删除项目/待办、语音写入期间小猫不提前睡觉、设置页保存后 AI 调用走本地配置。

### 追加：桌面小猫透明区鼠标穿透

用户在真实桌面使用中发现：小猫悬浮窗虽然视觉上透明，但窗口矩形范围过大，透明区域会挡住后方文档或网页，导致需要把小猫挪走才能编辑底层内容。

本轮补充修改：

- `electron/main.cjs`：新增 `setBubbleMouseInteractive()`，通过 `BrowserWindow.setIgnoreMouseEvents(!interactive, { forward: true })` 切换悬浮窗鼠标穿透状态。
- `electron/preload.cjs`：向 `bubble.html` 暴露 `setInteractive()` IPC。
- `electron/bubble.html`：用鼠标位置判断是否落在小猫按钮矩形内；只有小猫本体区域恢复可点击/可拖拽，透明背景和消息气泡周围区域保持穿透。
- `PRD.md`、`SDD.md`、`TODO.md`：同步补充桌面小猫透明区不应挡住底层应用的验收口径。

验证边界：

- 后台可验证语法、构建、打包、真实入口资源和 API 冷启动。
- “透明区是否真的不挡住 Word/Obsidian/浏览器编辑区域”属于真实桌面鼠标手感，需要用户在真实入口把小猫放到文档上方人工点一下确认。

### 追加：右侧详情密度、小猫阶段状态和未归类兜底

用户继续指出：右侧待办编辑态内容看不清，查看态应该完整显示且字号可更小；右侧今天、日程、待办需要用分隔线形成三个块，日程和待办各自滚动；小猫听写后应同时保留用户原话和灰色阶段状态；项目待办里的未归类必须只有一个，不能因为语音 / 文本识别到未知项目就新建“未归类”项目；右键删除应先在鼠标旁弹出删除 / 不删除菜单。

本轮补充修改：

- `src/App.tsx`：新增 `voiceDisplayText` 和 `catProcessStatus`，把小猫气泡拆成“用户原话 / 转写”和灰色阶段提示。阶段提示使用“文字整理中 / 理解意图中 / 安排事项中 / 完成了”，完成后 5 秒清空。
- `src/App.tsx`：新增 `todoContextMenu`，项目待办右键只打开鼠标旁菜单，点“删除”才调用 `DELETE`；右键未归类只提示不可删除。
- `src/styles.css`：右侧详情改为三块分隔结构，日程区和待办区各自 `overflow-y: auto`；查看态文字改为更小字号并允许完整换行；编辑态输入框同步压小。
- `server/dataStore.ts`：未归类改成虚拟兜底项目；历史同名“未归类”项目在聚合时折叠到 `uncategorized`，防止出现多个未归类或被误删。
- `PRD.md`、`SDD.md`、`TODO.md`：同步补充需求、设计和验收口径。用户关于“功能细节变化是否自动同步 PRD/SDD”的期望，本轮按 `productize` 规则执行：功能边界、状态机、数据链路和验收口径变化时默认同步主文档；只有用户明确说“复盘 / 沉淀经验 / 更新 skill”时才升级到经验库或 Skill。

验证状态：

- `npm run build` 通过，TypeScript 和 Vite 构建成功。
- Browser source/dev 验证 `http://127.0.0.1:5173`：普通待办右键出现鼠标旁菜单，菜单文本为“删除 / 不删除”；右键未归类不弹删除菜单，并提示“未归类是兜底收纳区，不能删除。”。
- Browser source/dev 验证右侧一日详情：标题为“今天”；日程 / 待办两区均为独立滚动，computed style 显示 `overflow-y: auto`；查看态正文 `font-size: 12.5px`、`white-space: normal`。
- 当前 `http://127.0.0.1:8787` 由真实入口 `D:\YayaMind\YayaMind.exe` 的内置 API 监听，本轮没有停止真实入口进程，也没有同步半成品到 `D:\YayaMind`。

## CTX-20260618-001：语音待办完整写入、项目词表识别、时间轴休息块和取消对话

### 背景

用户在真实使用中反馈：长语音新增待办后，最终写入的待办正文只剩两三个字；语音转写 / AI 改写应该只修错别字和明显不通顺处，不能把任务内容摘要成短标题。用户还反馈：手动新增待办时，如果只写标题不写备注，点击外部应像编辑已有待办一样自动保存并退出编辑态；一周时间轴不应从起床时间裁剪到睡觉时间，而应固定 0:00-24:00，并把睡眠时段标成灰色“休息”；桌面小猫对话框离小猫过远，且需要右侧叉按钮用于取消本次语音对话；“web coding”这类语音转写应能匹配已有项目“外coding”，因此 AI 意图识别需要拿到当前项目词表。

### 本轮做了什么

- `server/aiAdapter.ts`：`parseTextWithAi` 增加项目词表上下文，prompt 明确已有项目名、近似同音词应回填词表中的原始项目名；待办标题必须保留完整事项内容，不输出“任务 / 同步 / 处理”这类短泛化词。
- `server/aiAdapter.ts`：语音纠错 prompt 明确不能总结或改写成短标题；安全纠错长度下限从原文 45% 收紧到 75%，避免“纠错”阶段吞掉大段内容。
- `server/dataStore.ts`：待办解析结果增加标题守卫；当 AI 给出过短泛化标题时，回退到原文中“待办”后的完整事项内容。项目匹配增加 alias 兜底，`外coding` 可匹配 `web coding / webcoding`。
- `src/App.tsx`：手动新增待办的空草稿失焦收起；非空标题失焦自动保存，即使备注为空也退出编辑态。增加保存锁，避免外部点击和 blur 同时触发导致重复保存。
- `src/App.tsx`、`src/styles.css`、`server/dataStore.ts`：一周时间轴固定 0:00-24:00；作息设置只用于生成灰色“休息”睡眠块，不再裁剪时间轴显示范围。跨午夜睡眠拆成 0:00-起床、睡觉-24:00 两段。
- `src/App.tsx`、`src/styles.css`：Web 小猫对话框更贴近小猫脚边，右侧新增取消按钮；取消会清空输入、追问、确认卡片、写入后修改卡片和隐藏听写捕获文本。
- `electron/main.cjs`、`electron/preload.cjs`、`electron/bubble.html`：桌面悬浮气泡新增取消按钮；点击后通过 IPC 通知主窗口舍弃当前语音会话，清空桌面消息，并把小猫状态切回休息。

### 验证状态

- `npm run build` 通过，TypeScript 和 Vite 构建成功。
- `node --check electron/main.cjs`、`node --check electron/preload.cjs` 通过；`electron/bubble.html` 的内联脚本通过 Node `new Function` 语法检查。
- Browser 开发态验证：一周时间轴显示 00:00-24:00，日期列渲染灰色“休息”块；项目待办里新增非空标题草稿后点击外部，表单退出编辑态且待办可见，随后已删除测试待办。
- 使用临时 `YAYAMIND_DATA_DIR` 回放：已有项目 `外coding` 时，输入 `web coding新加一条待办让他把桌面的入口同步一下` 被解析为 `add_task`，写入标题为“让他把桌面的入口同步一下”，`projectId` 指向已有 `外coding` 项目。
- `npm run desktop:pack` 通过；已同步 `D:\YayaMindBuild\release\win-unpacked` 到 `D:\YayaMind`；从 `D:\YayaMind\YayaMind.exe` 冷启动后 `/api/bootstrap` 返回 200；真实入口资源包含 `cancel-voice` 和 `sleep-block`。

### 当前边界和风险

- 本轮仍需在真实桌面入口中人工确认：桌面气泡叉按钮是否能关闭当前系统听写面板并舍弃文本；真实语音长句是否不再只写两三个字；时间轴灰色休息块在日常视口中的视觉密度是否合适。
- 当前技术路线仍是 Windows 系统听写桥：可在隐藏输入框中接收系统转写文本，但最终写入以用户第二次点击停止后的完整文本为准；未更换语音技术栈。

当前边界和风险：

- 本轮完成 source/dev 层面的代码、构建和浏览器验证；尚未执行 `npm run desktop:pack`、同步 `D:\YayaMind` 或真实入口冷启动。
- 阶段收口时仍需在真实入口人工确认：小猫语音阶段状态、右键删除菜单、右侧详情视觉密度和未归类唯一兜底在 `D:\YayaMind\YayaMind.exe` 中表现一致。

## CTX-20260618-002：休息块压缩、日程待办分割线和 AI 短标题修补

### 背景

用户继续指出一周时间轴里的休息区间不应把 6 点、7 点、8 点、9 点等内部刻度逐个排出来，因为休息时段不会安排日程；应压缩成一个小时高度的小灰块，写小字“休息”。同时，右侧一日详情中“日程”和“待办”之间需要更明确的视觉分割。周视图标题也不能直接截前三个字，例如“重构我”不合理，应由 AI 归纳成“重构”或“改skill”这类 2-3 字短标题。

### 本轮做了什么

- `src/App.tsx`：一周时间轴引入压缩睡眠映射，把真实睡眠区间压缩为固定 60 分钟显示高度；小时刻度和半小时辅助线会跳过睡眠区间内部，拖拽 / 调整日程时再映射回真实时间。
- `src/styles.css`：灰色“休息”块中间增加一条半小时虚线，让压缩块仍保留两个半小时小格的视觉语义；右侧待办区顶部增加更明显的分割线。
- `server/aiAdapter.ts`：AI 意图识别 prompt 明确要求日程 `title` 由用户原话归纳为 2-3 个中文短标题，不能机械截取前三个字。
- `src/App.tsx`：前端展示旧数据时增加短标题兜底，`重构我` 显示为 `重构`，涉及 skill / prompt / 规则修改的标题显示为 `重构` 或 `改skill`。

### 验证状态

- `npm run build` 通过，TypeScript 和 Vite 构建成功。
- Browser 开发态验证：周视图事件标题显示为 `健身`、`重构`、`上课`；休息块高度为一个小时格，文本为 `休息`；休息区间内部小时刻度被隐藏；右侧待办区顶部有 `2px` 分割线。
- `npm run desktop:pack` 通过；已同步 `D:\YayaMindBuild\release\win-unpacked` 到真实入口 `D:\YayaMind`；从 `D:\YayaMind\YayaMind.exe` 冷启动后 `/api/bootstrap` 返回 200。
- 真实入口资源验证：`D:\YayaMind\resources\app\dist\assets` 包含 `index-B1AV5fTr.js` 和 `index-D59ZIxBi.css`；资源中可检索到 `sleep-block`、休息文本、半小时虚线、`改skill`、`重构我` 和 `today-task-zone`。

### 当前边界和风险

- 新写入的日程标题会在 AI 解析阶段按 2-3 字归纳；历史已写入的长标题仍由前端展示兜底修正，不会批量改写用户历史数据。
- 休息块压缩会改变周视图纵向坐标映射，已在前端拖拽 / resize 反向映射中同步处理；仍建议用户在真实入口拖动一次日程确认手感。

## CTX-20260618-003：右键删除范围、双击编辑、桌面小猫处理中状态和面试日程修补

### 背景

用户继续做 MVP 真实使用体验修补：项目待办右键删除需要明确当前删除的是“某条待办”还是“整个项目”，且菜单只保留删除，取消靠点击页面其他位置失焦；项目待办和一周 / 右侧详情的编辑都应统一为双击进入，单击只查看 / 选中；编辑框不能固定两行，要按原内容行数自然展开；日程块颜色太浅；桌面小猫会被 YayaMind 主窗口盖住；小猫听写结束后的“安排事项中”应是气泡下方灰色小字，并且处理中不能自动消失，处理中小猫也不应继续闪听写光圈；用户真实说“明天下午两点有一个面试，半小时，准备答辩稿”时没有落库。

### 本轮做了什么

- `src/App.tsx`：项目待办标题、项目标题改为双击编辑；右侧详情单击事项只选中 / 查看，双击才创建 `detailDraft` 并进入内联编辑；编辑态 class 只在真实编辑草稿存在时出现。
- `src/App.tsx`：右键菜单增加 `label`，区分“删除待办：...”和“删除项目：...”；菜单只保留一个“删除”按钮，点击页面其他位置关闭即取消。
- `src/App.tsx`：详情编辑框和待办标题编辑框改用不设上限的动态行数计算，避免三行以上内容被固定两行裁掉。
- `src/App.tsx`、`electron/main.cjs`、`electron/bubble.html`：新增桌面小猫 `thinking` 状态；听写中仍显示动态光圈，安排事项中改为静态状态；主窗口打开后重新 lift 小猫窗口；桌面气泡拆为正文和灰色状态小字，`正在听 / 文字整理中 / 理解意图中 / 安排事项中` 不再 5 秒自动隐藏。
- `src/styles.css`：加深一周日程块透明色；统一右侧“今天”标题下划线、详情分隔线和待办区分隔线为同色 2px；加号靠近“今天”；补充右键菜单范围标题样式。
- `server/dataStore.ts`：新增明确新增日程判断，避免“准备”把“明天下午两点有一个面试...”误判成 `annotate_event`；补充“半个小时 / 半小时”时长解析，单点时间可推导 30 分钟结束时间。
- `PRD.md`、`SDD.md`、`TODO.md`：同步本轮交互规则、状态机和验收口径。

### 验证状态

- `npm run build` 通过，TypeScript 和 Vite 构建成功。
- `node --check electron/main.cjs`、`node --check electron/preload.cjs` 通过；`electron/bubble.html` 内联脚本通过 Node `new Function` 语法检查。
- 临时 `YAYAMIND_DATA_DIR` 回放 `明天下午两点有一个面试面试时间是半个小时注意一下面试要准备一下我的答辩稿`：`parseAndEnrichTextInput` 返回 `intent: add_event`，date 为 2026-06-19，startAt 为 14:00 本地时间，endAt 为 14:30 本地时间，preparations 包含“我的答辩稿”；`commitTextInput` 返回 `ok: true` 并写入 `events.jsonl`。
- Browser 开发态验证 `http://127.0.0.1:5173`：右侧标题 / 分隔线 computed style 均为 `2px solid rgba(216, 111, 56, 0.32)`；日程块背景为 `rgba(165, 96, 54, 0.12)`、边框为 `rgba(216, 111, 56, 0.72)`；待办右键菜单显示“删除待办：...删除”，按钮数为 1，失焦后关闭；项目空白右键显示“删除项目：vibe coding删除”；项目待办单击不出现编辑框，双击出现编辑框；右侧详情单击不编辑，双击出现内联编辑框。
- `npm run desktop:pack` 通过，生成 `D:\YayaMindBuild\release\win-unpacked`。
- 停止开发端口 8787 / 5173 后，从 `D:\YayaMind\YayaMind.exe` 冷启动真实入口，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口资源验证：`D:\YayaMind\resources\app\electron\bubble.html` 包含 `state-thinking` 和 `安排事项中` 处理中不隐藏逻辑；`electron/main.cjs` 包含 `open-main-after-front` 和 `thinking` 状态转发；打包 JS / CSS 中包含本轮双击编辑、右键范围菜单和最终样式。

### 当前边界和风险

- 已完成 source/dev、Browser 开发态、package/sync 和 final packaged / synced entry 冷启动验证。
- 真实桌面语音仍需要用户人工开口确认：说一句面试日程后日志应出现 `commit-success`，日程格子刷新；处理中小猫应静态、不闪光圈，气泡不应提前消失。
- 小猫置顶已在主窗口打开后主动 lift，但 Windows 桌面层级仍建议用户在真实入口里确认：主界面打开时小猫是否保持在前景。

## CTX-20260618-004：分隔线范围、长文本编辑框和光标状态返工修正

### 背景

用户指出上一轮右侧分隔线范围不正确：项目待办页右侧月历内栏不需要分隔线，一周详情只需要用两条分隔线把“今天 / 日程 / 待办”分开。同时，日程块颜色仍偏浅；桌面小猫长语音气泡上限太低；项目待办标题编辑框对长句仍像固定两行；普通悬停不应出现文本插入或抓手光标，只有长按拖拽和双击编辑时才切换对应光标。

### 本轮做了什么

- `src/App.tsx`：右侧 `aside` 增加 `todo-side-panel` / `week-detail-panel` 模式 class，避免项目待办侧栏和一周详情共用分隔线样式；编辑框行数计算改为按中文 / 英文视觉宽度估算长句折行；待办标题编辑调用改为更贴近窄卡片宽度。
- `src/styles.css`：在文件 EOF 增加最终覆盖块，项目待办侧栏去掉多余分隔线，一周详情只保留两条 2px 分隔线；日程块透明背景加深到 `rgba(165, 96, 54, 0.18)`，左边框加深到 `rgba(216, 111, 56, 0.84)`；项目 / 待办普通状态为箭头光标，长按武装后才显示抓取态，输入框内才显示文本光标。
- `electron/main.cjs`、`electron/bubble.html`：桌面小猫窗口高度从 190 提高到 280，消息区最大高度提高到 188px 并保留滚动，让长语音文字逐渐撑开但不超过窗口。
- `PRD.md`、`SDD.md`、`TODO.md`：同步补充一周详情两条线、待办侧栏无线、长句折行编辑框和光标状态边界。

### 验证状态

- `npm run build` 通过。
- `node --check electron/main.cjs` 通过；`electron/bubble.html` 内联脚本通过 Node `new Function` 语法检查。
- Browser 开发态验证 `http://127.0.0.1:5173`：一周详情 `today-detail-split` 和 `today-task-zone` 均为 `2px solid rgba(216, 111, 56, 0.32)`，标题和首个 section 无额外线；项目待办侧栏 section 分隔线为 0；日程块背景为 `rgba(165, 96, 54, 0.18)`、左边框为 `rgba(216, 111, 56, 0.84)`；项目 / 待办普通光标为 `default`；长按待办正文后进入 `todo-selected todo-drag-source` 且光标为抓取态；待办标题双击编辑后 rows 为 4。

### 当前边界和风险

- `npm run desktop:pack` 已通过；`D:\YayaMindBuild\release\win-unpacked` 已同步到真实入口 `D:\YayaMind`；从 `D:\YayaMind\YayaMind.exe` 冷启动后 `/api/bootstrap` 返回 200。
- 真实入口资源已核验：`electron/main.cjs` 包含 `BUBBLE_WINDOW_HEIGHT = 280`，`electron/bubble.html` 包含 `max-height: min(188px, calc(100vh - 94px))` 和 `安排事项中` 状态识别，打包 CSS / JS 中包含 `true EOF overrides`、`todo-side-panel`、`week-detail-panel` 和长待办 `rows=Yi(...,12)` 逻辑。
- 真实桌面语音长句还需要用户人工确认：气泡是否高度足够、处理中是否不提前消失。

## CTX-20260618-005：右键虚线范围、右侧详情无线滚动和编辑态修补

### 背景

用户指出项目待办右键菜单里“删除待办：...” / “删除项目：...”的范围文字没有必要，已有拖拽选中虚线框更适合表达当前选中的是待办还是项目；一周右侧详情不应再有“今天 / 日程 / 待办”的横向分割线，滚动条可隐藏但滚动能力要保留；休息日和休息块需要更清晰的颜色 / 纹理区分；右侧详情事项也应和项目待办一样右键弹“删除”菜单，双击编辑，并且编辑态不需要保存按钮，点击外部自动保存。

### 本轮做了什么

- `src/App.tsx`：项目待办右键菜单去掉 `label` 范围文字，右键项目 / 待办时分别给项目卡片或待办卡片追加虚线选中态；右侧详情新增 `detailContextMenu`，右键日程 / 待办只弹出“删除”菜单，不再立即删除，并给当前行加虚线框。
- `src/App.tsx`：右侧详情内联编辑移除显式“保存”按钮，继续复用失焦自动保存；双击进入编辑、单击只查看的规则保持不变。
- `src/styles.css`：隐藏一周日程、右侧滚动区、项目待办列表的可拖动滚动条但保留 `overflow-y: auto`；一周右侧详情和项目待办右侧栏全部移除横向分割线；右侧待办区增加一点上方留白；休息日改为偏深蓝色系，休息日日程块同步偏蓝；时间轴休息块改为深灰色密集斜杠纹理；编辑态标签、输入文字和边框颜色加深，去掉双框感。
- `PRD.md`、`SDD.md`、`TODO.md`：同步当前口径：删除范围由虚线框表达，右侧详情无线滚动，编辑态点击外部自动保存。

### 验证状态

- `npm run build` 通过。
- Browser 开发态验证 `http://127.0.0.1:5173`：项目待办页 4 个项目 / 3 条待办，项目待办列表 `overflow-y: auto` 且 `scrollbar-width: none`；右键待办菜单文本为“删除”，待办有 `2px dashed` 虚线框且任务数量不变；右键项目头部菜单文本为“删除”，项目卡片有 `2px dashed` 虚线框且项目数量不变。
- Browser 开发态验证一周详情：右侧 `today-detail-split`、`today-task-zone` 和标题 section 的边框均为 `0px none`；右侧滚动区 `overflow-y: auto` 且 `scrollbar-width: none`；待办区 `padding-top: 14px`。
- Browser 开发态验证视觉：休息日背景为蓝系渐变；`sleep-block` 背景包含 `repeating-linear-gradient(-45deg, ...)` 深灰斜杠纹理，`::after` 为 `none`。
- Browser 开发态验证右侧详情：右键详情行菜单文本为“删除”，当前行有 `2px dashed` 虚线框；未点击删除时行数不变。双击详情行进入编辑态后，`.inline-detail-editor` 边框为 `0px none`，保存按钮数量为 0，输入文字和 label 均为深色。

### 当前边界和风险

- 验证右侧详情右键时曾误点菜单触发一次删除；已立即把真实入口数据目录 `D:\YayaMindData\personal-assistant-data\events.jsonl` 中 `event_20260616085357_ljpn` 的 `status` 恢复为 `scheduled`，API 和页面均已重新显示 6/16 “健身”日程。该行 `updatedAt` 保留误点时产生的时间戳，避免额外猜测历史时间。
- 本轮 source/dev、`desktop:pack`、同步 `D:\YayaMind` 和真实入口冷启动资源核验均已完成；真实入口 `/api/bootstrap` 返回 200，正式资源包含 `todo-context-selected`、`detail-context-selected`、`detail-context-menu`、深灰斜杠休息块和隐藏滚动条规则。

## CTX-20260619-001：桌面小猫悬浮窗不可见修复

### 背景

用户反馈桌面上没有小猫悬浮窗了，但仍能打开主界面。排查时发现真实入口 `YayaMind.exe` 仍在运行，且存在 `MainWindowTitle = YayaMind Bubble` 的进程；`D:\YayaMindData\userData\desktop-cat.log` 也有 `bubble-create` 记录，说明不是没有创建窗口。猫图资源 `D:\YayaMind\resources\app\src\assets\desktop\cat-sleeping.png` 和 `cat-listening.png` 也存在。

### 本轮做了什么

- 将 `D:\YayaMindData\userData\desktop-settings.json` 中的小猫位置从右下角重置到主屏可见区域 `x=1220,y=560,width=360,height=280`。
- `electron/main.cjs`：小猫窗口创建后在 `ready-to-show` 和创建后 900ms 兜底主动调用 `liftBubbleWindow`，记录 `bubble-lift` 和 bounds。
- `electron/main.cjs`：二次启动和 app 激活时也统一调用 `liftBubbleWindow`，不再只 `show()`，避免窗口存在但没有浮到前台。

### 验证状态

- `node --check electron/main.cjs` 通过。
- `npm run build` 通过。
- `npm run desktop:pack` 通过，输出 `D:\YayaMindBuild\release\win-unpacked`。
- 已同步到真实入口 `D:\YayaMind`，`robocopy` 退出码 3，属于有复制 / 删除且失败数为 0 的可接受状态。
- 以正常可视方式启动 `D:\YayaMind\YayaMind.exe`，`/api/bootstrap` 返回 200。
- 真实入口日志出现：
  - `bubble-create`
  - `bubble-lift`，reason 为 `bubble-create-timeout`
  - `bubble-lift`，reason 为 `bubble-ready`
  - bounds 为 `x=1220,y=560,width=360,height=280`

### 当前边界和风险

- 本轮已确认进程、API、资源、真实入口日志都正常；仍需要用户肉眼确认桌面上是否已看到小猫。
- 后续桌面可视窗口冷启动验收不要用隐藏窗口方式启动，应使用正常可视启动；隐藏启动只适合无界面后台 helper。

## CTX-20260622-002：MVP 主文档归档并切换到 AI 化 1.0 开发版

### 背景

MVP 已完成最终收口审计，根目录 `PRD.md` / `SDD.md` / `TODO.md` 仍是 MVP 收口版。用户确认进入 AI 化 1.0 文档切换：保留 MVP 版、保留初始 1.0 roadmap 和本轮 1.0 讨论草稿，不直接覆盖丢弃；将 1.0 正式口径整理到根目录主文档。

### 本轮做了什么

- 新建归档目录：`docs/archive/versions/2026-06-22-ai-1.0-switch/`。
- 将 MVP 根目录主文档归档为：
  - `MVP-PRD.md`
  - `MVP-SDD.md`
  - `MVP-TODO.md`
- 将 1.0 来源材料归档为：
  - `AI-1.0-initial-roadmap-PRD-SDD.md`
  - `AI-1.0-discussion-draft.md`
- 新建根目录 AI 化 1.0 开发版：
  - `PRD.md`
  - `SDD.md`
  - `TODO.md`
- 更新 `FILE_INDEX.md`，把 AI 化 1.0 当前依据改为根目录主文档，并记录历史归档目录。

### 关键决策

- 根目录主文档只代表当前正在开发或验收的版本；从本轮开始，根目录 `PRD.md` / `SDD.md` / `TODO.md` 的当前版本为 AI 化 1.0。
- MVP 收口版不再占据根目录，但完整保留在版本归档目录。
- 1.0 初始 roadmap 和讨论草稿不继续作为当前开发入口，作为来源材料归档；正式依据合并进根目录主文档。
- 1.0 不再主动新增大方向，当前收口范围为：会话状态机、长语音与整组草稿、跨模块草稿预览、小猫全局修改入口、批量操作、画像与标题词表、习惯与周期安排。

### 验证状态

- 本轮是文档版本切换，不修改代码，不执行 build / desktop:pack / 真实入口同步。
- 已确认归档目录存在，且包含 MVP 文档、初始 1.0 roadmap 和讨论草稿。
- 后续进入开发前，应以新的根目录 `PRD.md` / `SDD.md` / `TODO.md` 为主读文档。

### 当前边界和风险

- `README.md` 未更新；它仍偏外部说明，后续如果对外展示 1.0 路线再单独调整。
- `docs/roadmap/` 目前不再包含已升格的 1.0 roadmap；新的未来版本规划可继续放回该目录。
- 1.0 目前是开发版文档，尚未实现对应功能。

## CTX-20260622-003：AI 化 1.0 规则型闭环开发与自验

### 背景

用户授权按 `TODO.md` 将 AI 化 1.0 的开发项一口气做完，并要求开发后自行验证 PRD / SDD 流程，不在子功能完成后停下来发散。

### 本轮做了什么

- `server/types.ts`：新增 `ConversationState`、`ConversationContext`、`PlanDraft`、`PlanDraftItem`、`CandidateItem`、`BatchOperationPreview`、`BatchOperationResult`、`RecurringRuleRecord` 等 1.0 类型，并扩展 `ParsedIntent` / `ParseResult`。
- `server/dataStore.ts`：新增 `plan_drafts.json`、`conversation_context.json`、`recurring_rules.json` 数据文件；扩展 `/api/bootstrap` 返回草稿、会话、标题词表和周期规则。
- `server/dataStore.ts`：扩展 parse / commit 链路，支持长规划整组草稿、草稿确认 / 修改 / 取消、批量候选与执行、画像作息更新、标题词表归一、习惯周期规则与近期实例。
- `server/index.ts`：兼容 1.0 commit 返回结构的日志摘要。
- `src/App.tsx`：补齐 1.0 前端类型和小猫理解卡片展示，能显示整组草稿项、批量候选、确认 / 修改 / 取消按钮。
- `PRD.md`、`SDD.md`、`TODO.md`、`FILE_INDEX.md`：增量同步 1.0 开发状态、验证证据和新增数据文件定位。

### 关键链路

```text
语音 / 文本输入
-> parseAndEnrichTextInput
-> ConversationContext 判断
-> PlanDraft / BatchOperationPreview / profile / habit 规则生成
-> 小猫理解卡片确认、修改或取消
-> commitTextInput
-> events / tasks / reminders / profiles / recurring_rules 写入
-> bootstrap 刷新工作台
```

### 验证状态

- `npm run build` 通过。
- `.run-logs/ai10-api-test.mjs` 使用临时数据目录 `.run-logs/ai10-test-data` 回放通过：
  - 长语音复杂规划返回 `plan_draft`，生成 4 项草稿。
  - parse 阶段只写 pending 草稿，不写正式 event。
  - “把健身改到九点”只修改当前 draft，再确认写入。
  - 确认草稿写入 4 项正式数据。
  - “每周六下午三点上课”写入周期规则，日历实例由 bootstrap 动态渲染。
  - “把今天下午所有安排往后挪一小时”生成 4 个候选并批量执行。
  - “我最近每天0点睡，8点起”写入 `sleepStart=00:00`、`wakeUp=08:00`。

### 当前边界和风险

- 本轮 1.0 是规则型可运行闭环，不是完整大模型规划引擎；复杂自然语言泛化能力后续仍可继续强化。
- 开发态 source/build 已验证；`desktop:pack`、同步 `D:\YayaMind` 和真实入口冷启动也已完成。
- 真实入口验收：`D:\YayaMind\YayaMind.exe` 启动后 `http://127.0.0.1:8787/api/bootstrap` 返回 200；正式 bundle `D:\YayaMind\resources\app\dist\assets\index-Bbrh4QSy.js` 可检索到“整组草稿 / 批量候选清单 / 修改草稿”等 1.0 字符串。

### 2026-06-22 习惯周期草稿返工

用户截图反馈“以后每天晚上 9 点 55 提前下楼准备衣服鞋子，健身一个小时到 11 点回家”被识别成 3 天普通日程，右侧标题和备注字段混乱，且小猫状态一直停在“理解中”，没有确认 / 修改入口。

本轮修复：

- `server/dataStore.ts`：`withPreview` 保留 `result.preview`，避免草稿选项、draft、batchOperation 被 fields 覆盖后丢失。
- `server/dataStore.ts`：周期草稿确认时只写 `recurring_rules.json`，不再把预览实例写入正式 `events.jsonl`；日历由 `/api/bootstrap` 按可见周动态生成周期日程。
- `server/dataStore.ts`：新增习惯安排抽取，健身类标题归一为“健身”；“一个小时到 11 点回家”解析为 22:00-23:00；“衣服 / 鞋子”作为明确准备事项，备注兜底为“带上衣服和鞋子”。
- `server/dataStore.ts`：周期实例用本地时间格式生成，避免 `toISOString().slice(11,16)` 把北京时间误读成 UTC 时间。
- `src/App.tsx`：parse 返回需确认草稿后清空 `catProcessStatus`，让小猫展示“我整理成草稿了，可以确认、修改或取消”，不再被“理解中”状态压住。

验证：

- `.run-logs/ai10-habit-regression.mjs` 使用临时数据目录回放通过：返回 options `确认规则 / 修改 / 取消`，标题为“健身”，时间为 `2026-06-22T14:00:00.000Z` 到 `2026-06-22T15:00:00.000Z`（北京时间 22:00-23:00），备注为“带上衣服和鞋子”；确认后只写 1 条 `recurring_rules.json`，当前可见周动态生成 7 条日历实例。
- `npm run build` 通过。
- `npm run desktop:pack` 通过，输出 `D:\YayaMindBuild\release\win-unpacked`。
- 已同步真实入口 `D:\YayaMind`；`robocopy` 返回 3 且 FAILED=0。
- 已从 `D:\YayaMind\YayaMind.exe` 冷启动，`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实前端 bundle `D:\YayaMind\resources\app\dist\assets\index-1wXXpxZX.js` 可检索到“等待确认”和“我整理成草稿了，可以确认、修改或取消”；真实后端 bundle 可检索到 `recurring_rules`。

## CTX-20260623-001：长语音无标点规划、草稿删除和悬浮窗置顶返工

### 背景

用户用测试句“今天下午吃饭前先准备面试一个小时，饭后改个人助手项目，晚上健身一个小时，21点50提醒我问鞋”验收 AI 1.0。真实表现错误：桌面语音听完后直接写入，内容和时间都不对；右侧出现标题很长的健身草稿，右键删除会刷新回来；小猫悬浮窗有时被其他窗口盖住，需要点任务栏才回来。

### 本轮修复

- `server/dataStore.ts`：复杂规划路由同时检查原始文本和整理后文本，避免语音纠错后丢失 1.0 草稿入口。
- `server/dataStore.ts`：`splitPlanSegments` 支持按“饭前 / 饭后 / 下午 / 晚上 / 21点50提醒”等自然时间锚点切段；跳过“今天 / 下午”这类空时间片。
- `server/dataStore.ts`：草稿时间解析不再把 `2026-06-23` 拼进中文时间段，避免年份数字被误读成 `20:26`；“吃饭前 / 饭后 / 晚上 / 21点50”分别落到本地时间 15:00-17:00、19:00-20:30、20:00-21:00、21:50。
- `server/dataStore.ts`：草稿日程投影保留 `isDraft` / `draftId`，右侧详情删除可以走取消草稿，不再误走正式 event 删除。
- `src/App.tsx`：桌面自动提交只允许简单新增和工作日志类意图；`plan_draft` / `batch_operation` / candidates 永远等待用户确认。
- `src/App.tsx`：右侧详情删除遇到草稿投影时调用 `cancel-draft:{draftId}`，并乐观移除整组草稿投影。
- `electron/main.cjs`：小猫悬浮窗显示后启动 topmost watch，定时重新 `liftBubbleWindow`，并在 lift 时重新设置 `alwaysOnTop` 和全工作区可见。
- 真实数据清理：取消错误草稿 `draft_20260622113529_169s`；忽略错误触发的 `reminder_20260623070406_hnjw`；右侧日提醒过滤已完成 / 已忽略提醒。

### 验证状态

- 使用临时数据目录 `.run-logs/ai10-fix-test-data` 回放无标点测试句，返回 `intent=plan_draft`、`needsConfirmation=true`，生成 4 项草稿：面试准备、改项目、健身、问鞋提醒。
- parse 阶段正式日程数量为 0；草稿日历投影均保留 `isDraft=true` 和同一 `draftId`。
- `npm run build` 通过。
- 真实数据核对：2026-06-23 当前 active draft 为空，右侧日程和提醒不再展示旧错误项。
- `npm run desktop:pack` 通过，输出 `D:\YayaMindBuild\release\win-unpacked`。
- 已同步真实入口 `D:\YayaMind`；`robocopy` 返回 3 且 FAILED=0。
- 已从 `D:\YayaMind\YayaMind.exe` 冷启动；`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口日志出现 `bubble-lift` 的 `bubble-create-timeout`、`bubble-ready` 和连续 `bubble-topmost-watch`，说明悬浮窗置顶保活逻辑已加载。
- 真实入口文件核对：`D:\YayaMind\resources\app\dist-server\index.cjs` 可检索到 `isActionablePlanSegment`、`draftId`、`饭前 / 饭后` 切段逻辑；`D:\YayaMind\resources\app\electron\main.cjs` 可检索到 `startBubbleTopMostWatch` 和 `bubble-topmost-watch`。

### 当前边界和风险

- 悬浮窗置顶属于桌面环境行为，代码已加保活日志 `bubble-topmost-watch`，最终仍建议用户在常用窗口前后切换时观察一次。

### 2026-06-23 PRD 流程二次返工

用户继续验收指出：虽然事项进入了时间轴，但没有严格按 PRD 展示“这是草稿”，也没有在小猫对话框里给出确认 / 修改 / 取消；同时第一次建立画像时，系统不知道吃饭和健身时间，不应凭默认时间硬排。

本轮修复：

- `server/dataStore.ts`：撤掉复杂规划里的 `吃饭前 / 饭后 / 晚上 / 下午 / 上午` 默认时间，不再用 15:00 / 19:00 / 20:00 等硬编码时间装懂。
- `server/dataStore.ts`：复杂规划草稿中缺少具体时间的 event / task 写入 `risk`，并在 `ParseResult.questions[0]` 合并追问：“晚饭大概几点？健身几点开始？”。
- `server/dataStore.ts`：仍保留明确提醒时间，例如 `21点50提醒我问鞋` 生成提醒草稿；parse 阶段不写正式 events / reminders。
- `src/App.tsx`：桌面 shell 主窗口不再隐藏小猫对话框，`parsePreview` 会显示“等待确认 / 整组草稿”卡片。
- `src/App.tsx`：草稿卡片逐项显示 `待补充` 和风险说明，并显示 `确认全部 / 修改草稿 / 取消草稿`。
- `src/App.tsx`、`src/styles.css`：时间轴和右侧详情中的草稿增加 `草稿` 标识、斜纹草稿样式和 `草稿标题` 文案，与正式日程视觉区分。

验证：

- 临时数据目录 `.run-logs/ai10-prd-flow-test-data` 回放无标点长语音：返回 `intent=plan_draft`、`needsConfirmation=true`、options 为 `确认全部 / 修改草稿 / 取消草稿`，正式 events 数为 0。
- 回放结果中 `面试准备 / 改项目 / 健身` 均无 startAt，带 `时间不明确，需要补充饭点或开始时间`；`问鞋` 提醒保留 `21:50`。
- `npm run build` 通过。
- `npm run desktop:pack` 通过，已同步到 `D:\YayaMind`。
- 真实入口 `D:\YayaMind\YayaMind.exe` 冷启动后 `/api/bootstrap` 返回 200。
- 真实入口 API 回放同一句话返回 `plan_draft`、确认 / 修改 / 取消三个选项，并已立即取消测试草稿；`activeDraftCount=0`。

## CTX-20260623-002：悬浮小猫对话流与草稿预览确认返工

### 背景

用户继续指出：PRD 规定的草稿确认流程不应散落在主界面右下角，而应由悬浮小猫完成完整对话。用户输入后，小猫应保留用户原话；如果需要追问，应在同一对话框里展示追问，并给出“我正在听，请继续补充”这类文字输入提示。已知时间点的内容可以先投影到日程 / 提醒作为草稿预览；时间不确定的安排不能硬排进时间轴，应标记待补充并追问。

### 本轮修复

- `PRD.md`：同步长语音草稿流程，明确“已知时间投影为草稿预览，未知时间进入小猫追问”，确认 / 修改 / 取消均在悬浮小猫内完成。
- `SDD.md`：新增 `Cat Dialog Stream` 模块和 `cat-dialog-v1` payload，记录 `bubble:select-option -> desktop-cat:bubble-option` 的按钮回传链路。
- `TODO.md`：新增 2026-06-23 二次返工验收项，标记悬浮小猫对话流和未知时间追问已完成。
- `src/App.tsx`：桌面模式下主窗口不再展示右下角小猫确认卡；改为向悬浮窗发送结构化 `cat-dialog-v1`，包含用户原话、系统回答、追问、输入提示和确认按钮。
- `electron/bubble.html`：悬浮小猫支持可滚动对话流、用户 / 系统 / 输入提示气泡和确认按钮；等待确认或追问时不再 5 秒自动隐藏。
- `electron/preload.cjs`、`electron/main.cjs`：新增悬浮窗选项点击回传主应用的 IPC 链路。

### 验证状态

- `npm run build` 通过。
- 使用独立临时数据目录 `.run-logs/ai10-dialog-flow-test-data` 回放用户测试句：返回 `intent=plan_draft`、`needsConfirmation=true`，选项为 `确认全部 / 修改草稿 / 取消草稿`。
- 回放结果中 `面试准备 / 改项目 / 健身` 均无 `startAt`，带 `时间不明确，需要补充饭点或开始时间`；`问鞋` 提醒保留 21:50。
- parse 后正式日程数为 0，active draft 为 1；执行取消草稿后 active draft 回到 0。
- `npm run desktop:pack` 通过，输出 `D:\YayaMindBuild\release\win-unpacked`。
- 已同步真实入口 `D:\YayaMind`；`robocopy` 返回 3 且 FAILED=0。
- 已从 `D:\YayaMind\YayaMind.exe` 冷启动；`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口 API 回放同一句话返回 `plan_draft`，选项为 `确认全部 / 修改草稿 / 取消草稿`；`面试 / 改项目 / 健身` 均无 `startAt`，`问鞋` 保留 21:50；已立即取消测试草稿，`activeDraftCount=0`。
- 真实入口文件核对：`D:\YayaMind\resources\app\dist\assets\index-CcSP1qrZ.js` 可检索到 `cat-dialog-v1` 和“我正在听，请继续补充”；`electron/bubble.html`、`electron/preload.cjs`、`electron/main.cjs` 可检索到 `dialog-option`、`bubble:select-option`、`desktop-cat:bubble-option`。

### 当前边界和风险

- 本轮已完成 source、build output、真实入口同步和冷启动 API 验证；悬浮窗视觉与真实语音按钮点击仍建议用户按原测试句肉眼验收一次，重点看小猫对话框是否显示用户原话、追问、输入提示和三个确认按钮。

## CTX-20260624-003：多项补充追问去重与 PRD/SDD 同步

### 背景

用户在真实语音验收中指出：同一悬浮小猫对话里已经回答“面试是下午三点到四点，改项目是七点到八点，健身是晚上十点开始”，小猫仍继续问“面试什么时间？健身什么时间？”。这说明补充回答虽然进入了当前上下文，但后端草稿修改只把整句补充应用到一个草稿项，没有批量填充多个缺时间事项。

### 本轮修复

- `server/dataStore.ts`：`modifyPlanDraft` 改为按草稿项标题和别名拆分补充子句；一句补充可以同时填充“面试 / 改项目 / 健身”等多个草稿项。
- `server/dataStore.ts`：补充时间写入后清除对应 `risk`，`buildPlanDraftQuestion` 只会继续追问仍缺时间的项目，不再重复问已回答字段。
- `server/dataStore.ts`：原本因缺少时间暂存为 task 的带时长安排，在用户补出明确时间段后转为 event 草稿块，便于投影到时间轴。
- `PRD.md`：同步同一对话未取消前保持同一上下文、一次补充可回答多个草稿项、后续听写实时转写继续显示、只追问仍缺字段等产品规则。
- `SDD.md`：同步 `pendingClarification` / `conversation_context` 回流、`modifyPlanDraft` 多项补充切片、问题重算和 task -> event 类型修正规则。
- `TODO.md`：补充 2026-06-24 三次返工验收项。

### 验证状态

- 临时数据目录 `.run-logs/context-fix-data` 回放：“今天准备面试一个小时，然后改项目一个小时，晚上健身一个小时”首次返回追问“面试什么时间？改项目什么时间？健身什么时间？”。
- 同一上下文补充：“面试是下午的三点到四点，改项目是七点到八点，健身是晚上十点开始”后，返回“已按你的补充改好，可以确认了。”，不再重复问面试或健身时间。
- 回放结果中三项均清除 `risk`：面试准备为 15:00-16:00 event，改项目为 19:00-20:00 event，健身为 22:00-23:00 event。

### 当前边界和风险

- `npm run build` 通过。
- `npm run desktop:pack` 通过，输出 `D:\YayaMindBuild\release\win-unpacked`。
- 已同步真实入口 `D:\YayaMind`；`robocopy` 返回 3，未返回失败码。
- 已从 `D:\YayaMind\YayaMind.exe` 冷启动；`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口文件核对：`D:\YayaMind\resources\app\dist-server\index.cjs` 可检索到 `findDraftItemInstruction`、`splitSupplementClauses`、`clearDraftTimeRisk` 和 `hasItemSpecificSupplement`。

### 当前边界和风险

- 本轮已完成 source、build output、真实入口同步和冷启动 API 验证；真实麦克风听写和悬浮窗视觉仍建议用户用截图里的原句肉眼验收一次。

## CTX-20260624-004：1.0 冻结与 1.1 删除待办

### 背景

用户决定 1.1 不再“冻结隐藏”待办，而是在确认 GitHub 可以保存版本后，直接从当前版本删除待办功能，减少后续代码阅读和维护成本。1.0 作为带待办能力的基线保存在 GitHub，需要时可从 tag 恢复。

### 本轮做了什么

- 将当前 AI 1.0 本地状态提交为 `chore: freeze AI 1.0 assistant`。
- 创建并推送 Git tag `v1.0-ai-assistant`。
- 创建分支 `codex/v1.1-schedule-only`。
- 删除当前用户入口里的待办导航、项目待办页面、右侧详情待办区域和待办月历侧栏。
- `server/index.ts` 移除当前版本 `/api/tasks` 与 `/api/todo-projects` 路由。
- `server/dataStore.ts` 的 bootstrap 不再返回实际待办和待办项目；日历 day tasks 为空。
- `server/dataStore.ts` 将 `add_task` 解析结果转成日程或待补充日程草稿。
- 复杂草稿不再创建 task 草稿项；草稿确认不再写 `tasks.jsonl`。
- 无时间周期习惯不再生成周期待办，改为追问具体时间。
- 根目录文档切换为 1.1 schedule-only：`PRD.md`、`SDD.md`、`TODO.md`、`FILE_INDEX.md`、`README.md`、`AI_1.1_TEST_CASES.md`。

### 验证状态

- `npm run build` 已通过一次。
- 临时数据目录 `.run-logs/v11-schedule-only-data` 回放：“写简历”返回时间追问，不写待办。
- 回放：“下午三点写简历”写入 `events.jsonl`。
- 回放：“每天给猫刷牙”只追问一次“给猫刷牙什么时间？”。
- 回放 bootstrap：`tasks=0`、`todoProjects=0`、calendar tasks 总数为 0。

### 最终验证

- 最终 `npm run build` 通过。
- `npm run desktop:pack` 通过，输出 `D:\YayaMindBuild\release\win-unpacked`。
- 已同步到真实入口 `D:\YayaMind`；`ROBOCOPY_EXIT=3`，未返回失败码。
- 已冷启动 `D:\YayaMind\YayaMind.exe`；`http://127.0.0.1:8787/api/bootstrap` 返回 200。
- 真实入口 bootstrap 返回 `tasks=0`、`todoProjects=0`、calendar tasks 总数为 0。

### 后续

- commit/tag/push 1.1。
- 用户在真实入口人工确认左侧导航无“待办”、右侧详情无“待办”框、小猫输入“写简历”会追问时间。
