# YayaMind

YayaMind 是一个本地优先的桌面日程安排助手。当前版本为 **1.1 Schedule-only**：以一周日程、今日详情、桌面小猫语音输入、提醒、画像和周期日程为主，不再提供待办列表或项目待办。

1.0 已冻结到 GitHub tag `v1.0-ai-assistant`。如果后续需要恢复待办能力，从该 tag 拉取即可。

## 当前能力

- 一周日程：周一到周日时间轴、当前时间线、冲突并排、拖动和拉伸时间块。
- 今日详情：编辑日程、查看待补充事项、提醒和天气提示。
- 桌面小猫：语音输入、原文确认、追问、草稿确认、修改和取消。
- AI 理解：支持 DeepSeek 或 OpenAI compatible 接口；无 key 时回退规则解析。
- 整组草稿：复杂安排先生成草稿，确认后写入。
- 周期日程：有明确时间的周期安排生成周期规则和近期日程实例。
- 画像：从日程和执行记录中沉淀时间习惯、生活节奏和近期信号。
- 总结：生成每日/每周 Markdown 总结到本地目录。
- 桌面版：Electron 打包后同步到 `D:\YayaMind` 作为真实入口。

## 1.1 删除内容

- 没有“待办”导航。
- 没有项目待办页面。
- 今日详情没有待办框。
- `/api/tasks` 与 `/api/todo-projects` 不属于当前版本 API。
- 自然语言中的“任务/待办/要做某事”会被日程化：有时间直接进日程，无时间则追问时间。
- “每天给猫刷牙”这类无时间习惯不会生成待办，会追问具体时间。

旧数据文件 `tasks.jsonl` 和 `todo_projects.json` 不会被删除，但 1.1 不读取展示、不写入。

## 本地运行

```bash
npm install
npm run dev
```

默认端口：

- Web 前端：http://localhost:5173
- 本地 API：http://localhost:8787

AI 配置：

- 复制 `.env.example` 为 `.env.local`。
- 填入 `DEEPSEEK_API_KEY` 或在设置页配置 OpenAI compatible 接口。
- 访问 `http://localhost:8787/api/ai/status` 可查看接口状态，不返回密钥。

## 桌面应用

常用命令：

```powershell
npm run desktop:dev
npm run desktop:pack
npm run desktop:dist
```

当前打包输出：

```text
D:\YayaMindBuild\release\win-unpacked
```

当前真实入口：

```text
D:\YayaMind\YayaMind.exe
```

真实入口运行数据：

```text
D:\YayaMindData\personal-assistant-data
D:\YayaMindData\userData\desktop-cat.log
```

阶段收口时需要：

1. `npm run build`
2. `npm run desktop:pack`
3. 同步 `D:\YayaMindBuild\release\win-unpacked` 到 `D:\YayaMind`
4. 冷启动 `D:\YayaMind\YayaMind.exe`
5. 验证 `http://127.0.0.1:8787/api/bootstrap` 返回 200

## 数据文件

运行后会自动创建本地数据：

```text
personal-assistant-data/
  events.jsonl
  reminders.jsonl
  recurring_rules.json
  plan_drafts.json
  conversation_context.json
  work_logs.jsonl
  goals.json
  profiles.json
  settings.json
  summaries/
```

历史兼容数据：

```text
tasks.jsonl
todo_projects.json
```

这两个文件属于 1.0 待办能力的历史数据，1.1 不作为当前功能读取展示。

## 文档

- 产品需求：[PRD.md](PRD.md)
- 系统设计：[SDD.md](SDD.md)
- 当前任务：[TODO.md](TODO.md)
- 文件定位：[FILE_INDEX.md](FILE_INDEX.md)
- 项目上下文：[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- 1.1 验收用例：[AI_1.1_TEST_CASES.md](AI_1.1_TEST_CASES.md)

历史资料和面试材料在 `docs/` 下。
