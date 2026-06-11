# YayaMind 个人助手 Web MVP

YayaMind 是一个本地优先的 AI 个人助手 Web 模拟版。它不是普通 TODO 或日历，而是围绕“计划安排、真实执行记录、动态重排、提醒、复盘和个人画像”做的生活化助手。

第一版用网页模拟桌面工作台和布偶猫浮窗，后续可以迁移到 Electron 或 Tauri 桌面壳。

## 最新状态

当前版本已经进入 V1.1 体验打磨阶段，主界面是“左侧导航 + 中间一周安排 + 右侧日期详情 + 小猫语音入口”。

本轮最新完成：

- 小猫首屏只显示头像，不再默认弹出历史消息或引导文案。
- 点击小猫即可听写，停顿约 1 秒自动写入；按住并移动才拖动头像。
- 新增日程/任务后会自动跳到对应日期时间，并显示 `确认 / 修改 / 取消`。
- 可以对刚写入的事项继续语音修改日期、时间、备注和准备事项。
- 可以给已有会议追加备注/准备事项，例如“明天晚上的那个会加备注，要带笔记本电脑”。
- 中间一周安排保持周一到周日缩略视图，每天内部可滚动，日程块可拖动/拉伸。
- 右侧日期详情承担完整编辑：具体安排、待补充事项、截止任务、提醒都在右侧处理。
- 视觉继续保持浅色暖调，今天列半透明，会议卡片使用暖色系。

## 已实现能力

- 自然周一周安排：周一到周日、当前日期高亮、过去日期弱化。
- 日历时间轴：0:00-24:00 时间块、当前时间线、过去时间遮罩。
- 日历块操作：支持拖动移动时间块，支持拖上下边缘调整开始/结束时间，按半小时粒度保存。
- 日程与任务写入：自然语言输入可写入 `events.jsonl`、`tasks.jsonl`。
- AI 输入理解：已接入 DeepSeek adapter，有 key 时优先使用 AI 解析，无 key 或失败时回退规则解析。
- 工作记录：开始、暂停、结束、进度快捷记录写入 `work_logs.jsonl`。
- 冲突处理：时间重叠、疑似重复、时间不明确、计划过载会触发确认方案。
- 冲突视觉：冲突时间块会在一周安排和右侧详情同步显示“已冲突”。
- 语音对话：小猫浮窗以语音实时转写为主，用户确认后写入；追问、选择、理解预览收敛在一个气泡内。
- 事项编辑：日程、任务、待定事项支持右下角内联编辑和软删除。
- 执行记录：执行记录支持编辑和删除。
- 提醒：到点触发、小猫气泡、浏览器通知、完成、稍后、忽略；右侧日期详情默认只展示出门天气提醒。
- 天气/出门提醒：后端读取 Open-Meteo 7 天游雨概率，识别外出安排并提示带伞等准备。
- 阶段性目标：本地 `goals.json` 目标管理。
- 个人画像：根据执行记录和任务信号形成画像雏形。
- Markdown 总结：生成每日/每周总结到 `personal-assistant-data/summaries/`。
- 布偶猫浮窗：原创动画风格头像，可拖动，支持语音对话和陪伴式反馈。

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Node.js + Fastify
- 数据：本地 JSON / JSONL / Markdown
- 存储目录：`personal-assistant-data/`

## 本地运行

```bash
npm install
npm run dev
```

默认端口：

- Web 前端：http://localhost:5173 或 Vite 自动分配的相邻端口，例如 http://localhost:5174
- 本地 API：http://localhost:8787

AI 配置：

- 复制 `.env.example` 为 `.env.local`。
- 填入 `DEEPSEEK_API_KEY` 后重启后端。
- 可访问 `http://localhost:8787/api/ai/status` 确认当前 AI provider、model 和 key 是否生效；接口不会返回密钥。

## 部署与作品集预览

当前项目支持 Vercel 作品集预览：本地后端可用时使用真实数据；线上没有 `/api` 后端时，会自动进入演示数据，保证面试官打开链接能看到产品形态。

真实跨设备使用已预留 Vercel `/api` Serverless + Supabase 存储模式。配置 Supabase 环境变量后，线上同一个网址可以通过云端 API 保存数据。具体步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。

## 数据文件

运行后会自动创建：

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
```

该目录已加入 `.gitignore`，避免真实个人数据进入版本管理。

## 文档

- 项目上下文：[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- 当前任务：[TODO.md](TODO.md)
- 推进记录：[TASK_LOG.md](TASK_LOG.md)
- 架构与演示：[docs/portfolio/](docs/portfolio/)
- SDD 文档：[docs/sdd/](docs/sdd/)
- 面试材料：[docs/interview/](docs/interview/)

## 面试材料

`docs/interview/` 面向 AI 产品经理面试准备，建议先读 [面试材料索引](docs/interview/README.md)，再按顺序阅读：

- [PRD 产品需求文档](docs/interview/01-PRD.md)
- [SDD 开发设计与实现流程](docs/interview/02-SDD.md)
- [竞品分析](docs/interview/03-COMPETITOR_ANALYSIS.md)
- [项目详情与面试讲解稿](docs/interview/04-PROJECT_DETAILS.md)
- [面试高频 Q&A](docs/interview/05-INTERVIEW_QA.md)
