# 01 数据结构 SDD

## 目标

数据结构用于支撑第一版 Web 模拟个人助手的核心闭环：

```text
用户输入 -> AI/规则解析 -> 写入 Obsidian 本地数据 -> 页面刷新 -> 执行记录与复盘沉淀
```

第一版优先保证数据清楚、可读、容易追加、方便以后迁移到桌面应用。暂时不追求复杂数据库能力。

## 存储方式

Obsidian 作为本地数据仓库。核心数据使用 JSON / JSONL，方便程序读写；总结和周报使用 Markdown，方便人阅读。

建议目录：

```text
personal-assistant-data/
  events.jsonl
  tasks.jsonl
  work_logs.jsonl
  reviews.jsonl
  reminders.jsonl
  goals.json
  profiles.json
  settings.json
  summaries/
    2026-06-01.md
    2026-W23.md
```

第一版规则：

- 高频追加记录使用 JSONL。
- 低频整体更新的数据使用 JSON。
- Markdown 只存总结，不作为核心业务数据源。
- 每条记录都保留 `id`、`createdAt`、`updatedAt`。
- 时间统一存 ISO 字符串，页面展示时再转成本地时间。

## 通用字段

大多数记录都包含：

```json
{
  "id": "task_20260601_001",
  "createdAt": "2026-06-01T20:00:00+08:00",
  "updatedAt": "2026-06-01T20:00:00+08:00",
  "source": "text",
  "rawText": "今晚我要写完产品方案"
}
```

字段说明：

- `id`：记录唯一标识，建议使用类型前缀。
- `createdAt`：创建时间。
- `updatedAt`：最后更新时间。
- `source`：来源，例如 `text`、`voice`、`manual`、`system`。
- `rawText`：用户原始输入，便于以后复盘解析质量。

## events.jsonl

用于存日程和明确时间块。

适合记录：

- 会议。
- 约定时间的事项。
- 已安排到具体时间段的任务块。
- 训练、吃饭、家务等生活时间块。

示例：

```json
{
  "id": "event_20260601_001",
  "type": "meeting",
  "title": "项目沟通会",
  "date": "2026-06-02",
  "startAt": "2026-06-02T10:00:00+08:00",
  "endAt": "2026-06-02T11:00:00+08:00",
  "status": "scheduled",
  "linkedTaskId": null,
  "tags": ["work"],
  "source": "text",
  "rawText": "明天上午 10 点开项目沟通会",
  "createdAt": "2026-06-01T20:00:00+08:00",
  "updatedAt": "2026-06-01T20:00:00+08:00"
}
```

第一版 `type`：

- `meeting`
- `task_block`
- `life`
- `exercise`
- `meal`
- `rest`
- `risk`
- `other`

第一版 `status`：

- `scheduled`
- `done`
- `cancelled`
- `missed`
- `moved`

## tasks.jsonl

用于存任务。任务可以没有具体时间，也可以关联到一个或多个日历时间块。

示例：

```json
{
  "id": "task_20260601_001",
  "title": "写完产品方案",
  "description": "",
  "status": "todo",
  "priority": "medium",
  "dueAt": "2026-06-01T23:00:00+08:00",
  "estimatedMinutes": 120,
  "actualMinutes": 0,
  "linkedEventIds": [],
  "goalId": null,
  "tags": ["product"],
  "source": "text",
  "rawText": "今晚我要写完产品方案",
  "createdAt": "2026-06-01T20:00:00+08:00",
  "updatedAt": "2026-06-01T20:00:00+08:00"
}
```

第一版 `status`：

- `todo`
- `in_progress`
- `paused`
- `done`
- `partially_done`
- `cancelled`
- `deferred`

第一版 `priority`：

- `low`
- `medium`
- `high`

## work_logs.jsonl

用于记录真实执行过程，而不是只记录计划。

适合记录：

- 开始工作。
- 暂停工作。
- 继续工作。
- 结束工作。
- 中途进度。
- 被打断。

示例：

```json
{
  "id": "worklog_20260601_001",
  "taskId": "task_20260601_001",
  "eventId": null,
  "action": "start",
  "note": "开始写产品方案",
  "at": "2026-06-01T20:00:00+08:00",
  "source": "text",
  "rawText": "开始写产品方案",
  "createdAt": "2026-06-01T20:00:00+08:00",
  "updatedAt": "2026-06-01T20:00:00+08:00"
}
```

第一版 `action`：

- `start`
- `pause`
- `resume`
- `progress`
- `finish`
- `interrupt`

## reviews.jsonl

用于记录计划偏差、没完成原因和复盘结论。

示例：

```json
{
  "id": "review_20260601_001",
  "targetType": "task",
  "targetId": "task_20260601_001",
  "reasonType": "underestimated_time",
  "note": "原本以为 2 小时能写完，实际还需要补结构和案例。",
  "lesson": "类似产品方案任务下次至少预留 3 小时，并先拆大纲。",
  "createdAt": "2026-06-01T22:30:00+08:00",
  "updatedAt": "2026-06-01T22:30:00+08:00"
}
```

第一版 `reasonType`：

- `underestimated_time`
- `interrupted`
- `low_energy`
- `planned_rest`
- `procrastination`
- `scope_changed`
- `other`

## reminders.jsonl

用于存浏览器内提醒和生活提醒。

示例：

```json
{
  "id": "reminder_20260601_001",
  "title": "晾衣服",
  "remindAt": "2026-06-01T20:20:00+08:00",
  "status": "pending",
  "importance": "normal",
  "linkedTaskId": null,
  "source": "text",
  "rawText": "20 分钟后提醒我晾衣服",
  "createdAt": "2026-06-01T20:00:00+08:00",
  "updatedAt": "2026-06-01T20:00:00+08:00"
}
```

第一版 `status`：

- `pending`
- `triggered`
- `done`
- `dismissed`
- `missed`

未处理提醒不强打断工作，安静挂在右侧今日面板。

## goals.json

用于存阶段性目标。第一版不需要复杂目标管理，只需要能关联任务和复盘。

示例：

```json
{
  "goals": [
    {
      "id": "goal_20260601_001",
      "title": "完成个人助手 Web MVP",
      "status": "active",
      "startDate": "2026-06-01",
      "targetDate": "2026-06-30",
      "milestones": [
        {
          "id": "milestone_001",
          "title": "完成 SDD 和数据结构",
          "status": "in_progress"
        }
      ],
      "linkedTaskIds": [],
      "createdAt": "2026-06-01T20:00:00+08:00",
      "updatedAt": "2026-06-01T20:00:00+08:00"
    }
  ]
}
```

## profiles.json

用于存个人画像雏形。第一版不做复杂分析，先记录可被后续建议使用的经验。

示例：

```json
{
  "timeHabits": {
    "highFocusWindows": [],
    "lowEnergyWindows": [],
    "commonDelayWindows": []
  },
  "estimationPatterns": {
    "oftenUnderestimatedTags": [],
    "bufferRules": []
  },
  "lifeRhythm": {
    "regularMeals": [],
    "exercisePreferences": [],
    "restPatterns": []
  },
  "workPreferences": {
    "focusStyle": "unknown",
    "preferredTaskOrder": "unknown",
    "encouragementStyle": "gentle"
  },
  "updatedAt": "2026-06-01T20:00:00+08:00"
}
```

## settings.json

用于存本地设置。

示例：

```json
{
  "timezone": "Asia/Shanghai",
  "dataVersion": 1,
  "assistantName": "YayaMind",
  "notification": {
    "browserNotificationEnabled": false,
    "quietDuringWorking": true
  },
  "ai": {
    "provider": "openai",
    "model": "",
    "useUserApiKey": true
  },
  "ui": {
    "calendarDays": 7,
    "dayStartHour": 7,
    "dayEndHour": 24
  }
}
```

## 第一版不做

- 不引入数据库。
- 不做多用户账号。
- 不做复杂同步和冲突合并。
- 不把 Markdown 当作核心数据源。
- 不提前设计过深的画像结构。

## 验收标准

- 可以用本地文件保存任务、日程、提醒、工作记录和复盘记录。
- 页面可以根据这些文件渲染日历、今日面板和未处理提醒。
- 输入解析结果能落到明确的数据文件。
- 工作记录能反映真实执行过程，而不只是计划。
- 复盘记录能为后续个人画像和估时建议提供材料。
