# 12 本地 API 契约 SDD

## 目标

本地 API 契约用于连接 Web 前端和本地后端。第一版后端主要负责读写 Obsidian 数据文件、解析输入、判断冲突、提供今日面板和日历所需数据。

本文件先定义接口能力和数据流，不绑定具体代码结构。

## API 原则

- 前端不直接读写本地文件。
- 文件读写统一经过本地后端。
- AI 调用统一经过本地后端。
- 高风险写入先经过确认流程。
- API 返回前端可直接渲染的数据，但不把 UI 状态硬编码到后端。

## 基础接口

### 获取初始化数据

```text
GET /api/bootstrap
```

用途：

- 页面打开时加载基础数据。
- 返回设置、今日数据、日历数据、未处理提醒、当前工作状态。

返回内容：

```json
{
  "settings": {},
  "today": {},
  "calendar": {},
  "activeSession": null,
  "pendingReminders": []
}
```

### 获取日历数据

```text
GET /api/calendar?start=2026-06-01&days=7
```

用途：

- 给中间日历列视图提供未来 7-10 天数据。

读取：

- `events.jsonl`
- `tasks.jsonl`
- `reminders.jsonl`

### 获取今日面板数据

```text
GET /api/today?date=2026-06-01
```

用途：

- 给右侧今日面板提供当前工作、今日计划、执行记录、未处理提醒、小猫建议。

读取：

- `events.jsonl`
- `tasks.jsonl`
- `work_logs.jsonl`
- `reminders.jsonl`

## 输入解析接口

```text
POST /api/input/parse
```

请求：

```json
{
  "source": "text",
  "text": "今晚我要写完产品方案"
}
```

返回：

```json
{
  "intent": "add_task",
  "confidence": 0.86,
  "needsConfirmation": false,
  "fields": {},
  "questions": [],
  "warnings": [],
  "preview": {}
}
```

规则：

- 只解析，不一定写入。
- 如果明确且无冲突，可以由后端返回可直接提交的 `preview`。
- 如果需要确认，前端进入 `interactionState = confirming`。

## 提交输入结果

```text
POST /api/input/commit
```

用途：

- 将已确认的解析结果写入本地数据文件。

请求：

```json
{
  "parseResult": {},
  "userConfirmation": {
    "confirmed": true,
    "selectedOptionId": null,
    "editedText": null
  }
}
```

返回：

```json
{
  "ok": true,
  "written": [
    {
      "file": "tasks.jsonl",
      "id": "task_20260601_001"
    }
  ],
  "statePatch": {}
}
```

## 工作状态接口

### 开始工作

```text
POST /api/work/start
```

### 暂停工作

```text
POST /api/work/pause
```

### 继续工作

```text
POST /api/work/resume
```

### 结束工作

```text
POST /api/work/finish
```

这些接口统一写入 `work_logs.jsonl`，必要时更新 `tasks.jsonl` 或触发复盘。

## 提醒接口

### 列出未处理提醒

```text
GET /api/reminders/pending
```

### 标记完成

```text
POST /api/reminders/:id/done
```

### 忽略提醒

```text
POST /api/reminders/:id/dismiss
```

第一版提醒触发主要由前端页面打开时轮询或定时检查，后端负责状态写入。

## 冲突与重排接口

```text
POST /api/conflicts/check
```

用途：

- 在写入任务、日程、时间块前检查冲突。

返回：

```json
{
  "hasConflict": true,
  "conflicts": [],
  "options": []
}
```

如果用户选择重排方案：

```text
POST /api/reschedule/commit
```

规则：

- 未确认前不写入正式数据。
- 每次默认只返回 1-2 个方案。
- AI 只辅助表达，不做最终排程判断。

## 错误处理

第一版至少处理：

- 数据文件不存在：自动创建空文件或默认 JSON。
- JSONL 单行解析失败：跳过该行并返回警告。
- AI 调用失败：回退到规则解析或进入手动确认。
- 写入失败：返回错误，不更新前端状态。

## 第一版不做

- 不做远程 API。
- 不做用户登录。
- 不做复杂权限系统。
- 不做数据库事务。
- 不做外部日历同步接口。
- 不做后台常驻服务接口。

## 验收标准

- 前端能通过 API 获取初始化数据。
- 前端能提交自然语言输入并拿到解析结果。
- 确认后的任务、日程、提醒、工作记录能写入本地文件。
- 冲突和重排在写入前可被检查。
- 提醒状态可被更新。
- API 契约足够支撑第一版 Web 面板实现。
