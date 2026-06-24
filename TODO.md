# TODO - YayaMind 1.1 Schedule-only

## 当前版本

- 版本号：1.1 Schedule-only
- 版本基线：Git tag `v1.0-ai-assistant`
- 当前目标：在 1.0 基础上删除当前版本待办功能，只保留日程安排、提醒、画像和周期日程。
- PRD 对应文档：`PRD.md`
- SDD 对应文档：`SDD.md`

## P0 版本管理

- [x] 将当前本地 AI 1.0 状态提交为 `chore: freeze AI 1.0 assistant`。
- [x] 创建 tag `v1.0-ai-assistant`。
- [x] 推送 `main` 和 `v1.0-ai-assistant` 到 GitHub。
- [x] 从 1.0 基线创建分支 `codex/v1.1-schedule-only`。

## P0 删除待办当前入口

- [x] 删除导航栏“待办”入口。
- [x] 删除项目待办页面。
- [x] 删除右侧详情“待办”区域。
- [x] 删除待办月历侧栏入口。
- [x] `/api/bootstrap` 不再返回实际待办和待办项目。
- [x] 删除 `/api/tasks` 与 `/api/todo-projects` 当前 API 路由。

## P0 日程化语义

- [x] `add_task` 解析结果转成日程或待补充日程草稿。
- [x] 复杂草稿不再创建 task 草稿项。
- [x] 草稿确认不再写 `tasks.jsonl`。
- [x] 无时间周期习惯不再生成周期待办，改为追问时间。

## P0 验证

- [x] API 回放：“写简历”返回时间追问，不写待办。
- [x] API 回放：“下午三点写简历”写入 `events.jsonl`。
- [x] API 回放：“每天给猫刷牙”只追问一次时间，不生成待办。
- [x] API 回放：bootstrap 的 `tasks`、`todoProjects`、calendar tasks 均为 0。
- [x] `npm run build` 通过。
- [x] `npm run desktop:pack` 通过。
- [x] 同步到 `D:\YayaMind`。
- [x] 冷启动 `D:\YayaMind\YayaMind.exe` 并验证 `/api/bootstrap` 200。

## P1 文档同步

- [x] 更新 `PRD.md` 为 1.1 schedule-only。
- [x] 更新 `SDD.md` 为 1.1 schedule-only。
- [x] 更新 `TODO.md`。
- [x] 更新 `PROJECT_CONTEXT.md`。
- [x] 更新 `FILE_INDEX.md`。
- [x] 更新 `README.md`。
- [x] 更新根目录验收用例。

## Not Now

- [ ] 不恢复待办列表。
- [ ] 不恢复项目待办。
- [ ] 不做无时间习惯的待办化。
