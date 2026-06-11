import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { correctTranscribedTextWithAi, parseTextWithAi } from './aiAdapter.js';
import { getRequestUserId } from './requestContext.js';
import type { EventRecord, GoalRecord, ParseResult, ProfileData, ReminderRecord, ReviewRecord, SourceType, TaskRecord, TodoProjectRecord, WorkLogRecord } from './types.js';

const dataDir = join(process.cwd(), 'personal-assistant-data');
const useSupabaseStorage = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const requireCloudStorage = process.env.VERCEL === '1' && !useSupabaseStorage;
const supabaseTable = process.env.SUPABASE_YAYAMIND_TABLE || 'yayamind_store';

const files = {
  events: join(dataDir, 'events.jsonl'),
  tasks: join(dataDir, 'tasks.jsonl'),
  workLogs: join(dataDir, 'work_logs.jsonl'),
  reviews: join(dataDir, 'reviews.jsonl'),
  reminders: join(dataDir, 'reminders.jsonl'),
  goals: join(dataDir, 'goals.json'),
  todoProjects: join(dataDir, 'todo_projects.json'),
  profiles: join(dataDir, 'profiles.json'),
  summariesDir: join(dataDir, 'summaries'),
  settings: join(dataDir, 'settings.json')
};

type AppSettings = {
  timezone: string;
  dataVersion: number;
  assistantName: string;
  notification: {
    browserNotificationEnabled: boolean;
    quietDuringWorking: boolean;
  }
  ui: {
    calendarDays: number;
    dayStartHour: number;
    dayEndHour: number;
  };
  weather: {
    enabled: boolean;
    latitude: number;
    longitude: number;
    city: string;
    rainProbabilityThreshold: number;
    outdoorLeadMinutes: number;
  };
};

type WeatherAlert = {
  id: string;
  date: string;
  title: string;
  detail: string;
  remindAt?: string;
  relatedEventId?: string;
  probability?: number;
};

export async function ensureDataFiles() {
  if (requireCloudStorage) {
    throw new Error('Cloud storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!useSupabaseStorage) await mkdir(dataDir, { recursive: true });
  await ensureFile(files.events, '');
  await ensureFile(files.tasks, '');
  await ensureFile(files.workLogs, '');
  await ensureFile(files.reviews, '');
  await ensureFile(files.reminders, '');
  await ensureFile(files.goals, JSON.stringify({ goals: [] }, null, 2));
  await ensureFile(files.todoProjects, JSON.stringify({ projects: [] }, null, 2));
  await ensureFile(files.profiles, JSON.stringify(createDefaultProfile(), null, 2));
  if (!useSupabaseStorage) await mkdir(files.summariesDir, { recursive: true });
  await ensureFile(
    files.settings,
    JSON.stringify(createDefaultSettings(), null, 2)
  );
}

export async function getBootstrapData() {
  await ensureDataFiles();
  const [events, tasks, workLogs, storedReminders, goals, todoProjects, profile, settings] = await Promise.all([
    readJsonl<EventRecord>(files.events),
    readJsonl<TaskRecord>(files.tasks),
    readJsonl<WorkLogRecord>(files.workLogs),
    readJsonl<ReminderRecord>(files.reminders),
    readGoals(),
    readTodoProjects(),
    readProfile(),
    readSettings()
  ]);
  const reminders = await triggerDueReminders(storedReminders);
  const weatherAlerts = await buildWeatherAlerts(events, settings);

  const today = toLocalDateText(new Date());
  const activeSession = getActiveSession(workLogs);

  const todayTimeline: Array<{ id: string; time: string; text: string; at?: string; action?: WorkLogRecord['action']; feedbackType?: WorkLogRecord['feedbackType'] }> = [
    ...workLogs
      .filter((log) => log.status !== 'deleted' && log.at.startsWith(today))
      .map((log) => ({
        id: log.id,
        time: formatTime(log.at),
        text: log.note,
        at: log.at,
        action: log.action,
        feedbackType: log.feedbackType
      })),
    ...reminders
      .filter((reminder) => reminder.updatedAt.startsWith(today) && ['done', 'dismissed'].includes(reminder.status))
      .map((reminder) => ({
        id: `${reminder.id}_${reminder.status}`,
        time: formatTime(reminder.updatedAt),
        text: reminder.status === 'done' ? `提醒完成：${reminder.title}` : `提醒忽略：${reminder.title}`
      }))
  ];

  return {
    today: {
      date: today,
      activeSession,
      plans: [
        ...events
          .filter((event) => event.date === today && event.status === 'scheduled')
          .map((event) => ({
            id: event.id,
            title: event.title,
            time: event.startAt ? formatTime(event.startAt) : undefined,
            type: event.type
          })),
        ...tasks
          .filter((task) => task.status === 'todo' && task.title.trim() && task.dueAt?.startsWith(today) && hasTimedTodoDeadline(task))
          .map((task) => ({
            id: task.id,
            title: task.title,
            type: 'task',
            dueAt: task.dueAt,
            estimatedMinutes: task.estimatedMinutes,
            preparations: task.preparations ?? [],
            notes: task.notes ?? task.description,
            rawText: task.rawText
          }))
      ],
      timeline: todayTimeline.sort((a, b) => a.time.localeCompare(b.time)),
      reminders: reminders.filter((reminder) => ['pending', 'triggered', 'missed'].includes(reminder.status)),
      weatherAlerts: weatherAlerts.filter((alert) => alert.date === today)
    },
    calendar: buildCalendar(events, tasks, reminders, workLogs, weatherAlerts),
    todoProjects: buildVisibleTodoProjects(todoProjects, tasks),
    tasks: buildTaskList(tasks, todoProjects),
    goals,
    profile: buildProfileSnapshot(profile, workLogs, tasks)
  };
}

export async function commitTextInput(text: string, source = 'text', resolution: { selectedOptionId?: string | null } = {}) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const sourceType = normalizeSource(source);
  const parsed = await parseAndEnrichTextInput(text, now, sourceType);
  const effectiveText = parsed.rawText || text;

  if (parsed.needsConfirmation) {
    if (parsed.intent === 'add_task' && resolution.selectedOptionId === 'task-split') {
      const task = await appendTaskFromParse(parsed, effectiveText, sourceType, now, { tags: ['needs_split'] });
      return {
        ok: true,
        resolvedBy: 'task-split',
        parseResult: parsed,
        feedback: buildFeedback(parsed, 'task-split'),
        written: [{ file: 'tasks.jsonl', id: task.id }]
      };
    }

    if (parsed.intent === 'add_task' && resolution.selectedOptionId === 'duplicate-add') {
      const task = await appendTaskFromParse(parsed, effectiveText, sourceType, now);
      return {
        ok: true,
        resolvedBy: 'duplicate-add',
        parseResult: parsed,
        feedback: buildFeedback(parsed, 'duplicate-add'),
        written: [{ file: 'tasks.jsonl', id: task.id }]
      };
    }

    if (parsed.intent === 'add_task' && resolution.selectedOptionId === 'skip-duplicate') {
      return {
        ok: true,
        resolvedBy: 'skip-duplicate',
        parseResult: parsed,
        feedback: buildFeedback(parsed, 'skip-duplicate'),
        written: []
      };
    }

    if (parsed.intent === 'add_task' && resolution.selectedOptionId === 'defer-tomorrow') {
      const task = await appendTaskFromParse(parsed, effectiveText, sourceType, now, { dueAt: moveIsoToTomorrow(parsed.fields.dueAt, now) });
      return {
        ok: true,
        resolvedBy: 'defer-tomorrow',
        parseResult: parsed,
        feedback: buildFeedback(parsed, 'defer-tomorrow'),
        written: [{ file: 'tasks.jsonl', id: task.id }]
      };
    }

    if (parsed.intent === 'add_event' && resolution.selectedOptionId === 'save-pending') {
      const event = await appendEventFromParse(parsed, effectiveText, sourceType, now, { keepTime: false });
      return {
        ok: true,
        resolvedBy: 'save-pending',
        parseResult: parsed,
        feedback: buildFeedback(parsed, 'save-pending'),
        written: [{ file: 'events.jsonl', id: event.id }]
      };
    }

    if (parsed.intent === 'add_event' && resolution.selectedOptionId === 'keep-both') {
      const event = await appendEventFromParse(parsed, effectiveText, sourceType, now, { keepTime: true });
      return {
        ok: true,
        resolvedBy: 'keep-both',
        parseResult: parsed,
        feedback: buildFeedback(parsed, 'keep-both'),
        written: [{ file: 'events.jsonl', id: event.id }]
      };
    }

    return { ok: false, needsConfirmation: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [] };
  }

  if (parsed.intent === 'add_reminder') {
    const reminder: ReminderRecord = {
      id: createId('reminder'),
      title: String(parsed.fields.title ?? cleanupReminderTitle(effectiveText)),
      remindAt: String(parsed.fields.remindAt ?? inferReminderTime(text, now)),
      status: 'pending',
      importance: 'normal',
      linkedTaskId: null,
      relatedType: (parsed.fields.relatedType as ReminderRecord['relatedType'] | undefined) ?? 'general',
      relatedId: null,
      source: sourceType,
      rawText: effectiveText,
      createdAt: now,
      updatedAt: now
    };
    await appendJsonl(files.reminders, reminder);
    return { ok: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [{ file: 'reminders.jsonl', id: reminder.id }] };
  }

  if (parsed.intent === 'add_event') {
    const event = await appendEventFromParse(parsed, effectiveText, sourceType, now, { keepTime: true });
    return { ok: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [{ file: 'events.jsonl', id: event.id }] };
  }

  if (parsed.intent === 'delete_event' || parsed.intent === 'update_event' || parsed.intent === 'annotate_event') {
    return {
      ok: false,
      needsConfirmation: true,
      parseResult: parsed,
      feedback: '这句是在操作已有日程，需要先匹配到具体哪一条。',
      written: []
    };
  }

  if (['start_work', 'pause_work', 'resume_work', 'finish_work', 'progress_update'].includes(parsed.intent)) {
    const actionByIntent = {
      start_work: 'start',
      pause_work: 'pause',
      resume_work: 'resume',
      finish_work: 'finish',
      progress_update: 'progress'
    } as const;
    const result = await appendWorkLog(actionByIntent[parsed.intent as keyof typeof actionByIntent], String(parsed.fields.note ?? effectiveText), null, sourceType, effectiveText);
    return { ...result, parseResult: parsed, feedback: buildFeedback(parsed) };
  }

  if (parsed.intent === 'review_note') {
    const review: ReviewRecord = {
      id: createId('review'),
      targetType: 'general',
      targetId: null,
      reasonType: inferReasonType(text),
      note: effectiveText,
      lesson: inferLesson(effectiveText),
      source: sourceType,
      rawText: effectiveText,
      createdAt: now,
      updatedAt: now
    };
    await appendJsonl(files.reviews, review);
    return { ok: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [{ file: 'reviews.jsonl', id: review.id }] };
  }

  const task = await appendTaskFromParse(parsed, effectiveText, sourceType, now);
  return { ok: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [{ file: 'tasks.jsonl', id: task.id }] };
}

export async function appendWorkLog(
  action: WorkLogRecord['action'],
  note: string,
  taskId: string | null = null,
  source: SourceType = 'manual',
  rawText = note
) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const log: WorkLogRecord = {
    id: createId('worklog'),
    taskId,
    eventId: null,
    action,
    note,
    at: now,
    status: 'active',
    feedbackType: action === 'finish' ? 'completed' : action === 'progress' ? 'progress' : 'recorded',
    mood: action === 'finish' ? 'celebrating' : 'gentle',
    source,
    rawText,
    createdAt: now,
    updatedAt: now
  };
  await appendJsonl(files.workLogs, log);
  return { ok: true, written: [{ file: 'work_logs.jsonl', id: log.id }] };
}

export function parseTextInput(text: string, now = new Date().toISOString()): ParseResult {
  const rawText = text.trim();
  const timeInfo = inferTimeInfo(rawText, now);
  const purpose = inferPurpose(rawText);
  const preparations = inferPreparations(rawText);
  const notes = inferNotes(rawText, purpose, preparations);
  const estimatedMinutes = inferEstimatedMinutes(rawText);
  const base = {
    confidence: rawText ? 0.74 : 0,
    needsConfirmation: false,
    rawText,
    fields: {},
    questions: [] as string[],
    warnings: [] as string[],
    preview: {}
  };

  if (isEventDeleteText(rawText)) {
    return withPreview({
      ...base,
      intent: 'delete_event',
      confidence: 0.88,
      fields: {
        title: cleanupEventTitle(rawText),
        type: inferEventType(rawText),
        date: timeInfo.date,
        startAt: timeInfo.startAt,
        endAt: timeInfo.endAt,
        notes
      }
    });
  }

  if (isEventAnnotateText(rawText)) {
    return withPreview({
      ...base,
      intent: 'annotate_event',
      confidence: 0.86,
      fields: {
        title: cleanupEventTitle(rawText),
        type: inferEventType(rawText),
        date: timeInfo.date,
        startAt: timeInfo.startAt,
        endAt: timeInfo.endAt,
        preparations,
        notes
      }
    });
  }

  if (isEventUpdateText(rawText)) {
    return withPreview({
      ...base,
      intent: 'update_event',
      confidence: 0.84,
      fields: {
        title: cleanupEventTitle(rawText),
        type: inferEventType(rawText),
        date: timeInfo.date,
        startAt: timeInfo.startAt,
        endAt: timeInfo.endAt,
        preparations,
        notes
      }
    });
  };

  if (isExplicitTodoText(rawText)) {
    const todoNotes = inferTodoNote(rawText) ?? notes;
    return withPreview({
      ...base,
      intent: 'add_task',
      confidence: 0.9,
      fields: {
        title: cleanupTaskTitle(rawText),
        dueAt: inferDueAt(rawText, now),
        estimatedMinutes,
        preparations,
        notes: todoNotes
      }
    });
  }

  if (rawText.includes('提醒')) {
    return withPreview({
      ...base,
      intent: 'add_reminder',
      confidence: 0.88,
      fields: {
        title: cleanupReminderTitle(rawText),
        remindAt: inferReminderTime(rawText, now),
        notes,
        relatedType: inferReminderRelatedType(rawText)
      }
    });
  }

  if (timeInfo.hasSpecificTime || isScheduleLikeText(rawText)) {
    const hasContent = hasUsableScheduleContent(rawText);
    const needsTime = timeInfo.hasVagueTime && !timeInfo.hasSpecificTime;
    const needsContent = timeInfo.hasSpecificTime && !hasContent;
    const needsConfirmation = needsTime || needsContent;
    const questions = needsTime
      ? ['这个安排还差具体时间。可以补一个几点，也可以先放进待补充事项。']
      : needsContent
        ? ['这个时间还差具体要做什么。可以补充内容，也可以先放进待补充事项。']
        : [];
    const warnings = [
      ...(needsTime ? ['时间不明确'] : []),
      ...(needsContent ? ['内容不明确'] : [])
    ];
    const options = needsConfirmation ? [{ id: 'save-pending', title: '先放进待补充' }] : undefined;
    return withPreview({
      ...base,
      intent: 'add_event',
      confidence: timeInfo.hasSpecificTime ? 0.84 : 0.68,
      needsConfirmation,
      fields: {
        title: cleanupEventTitle(rawText),
        type: inferEventType(rawText),
        date: timeInfo.date,
        startAt: timeInfo.startAt,
        endAt: timeInfo.endAt,
        purpose,
        preparations,
        notes,
        estimatedMinutes
      },
      questions,
      warnings,
      preview: options ? { options } : {}
    });
  }

  if (/(暂停|先停|停一下|歇一下|休息一下|去吃饭)/.test(rawText)) {
    return withPreview({ ...base, intent: 'pause_work', confidence: 0.86, fields: { note: rawText } });
  }

  if (/(继续|回来了|恢复)/.test(rawText)) {
    return withPreview({ ...base, intent: 'resume_work', confidence: 0.84, fields: { note: rawText } });
  }

  if (/(写完了|做完了|完成了|结束|今天先做到这里|收工)/.test(rawText)) {
    return withPreview({ ...base, intent: 'finish_work', confidence: 0.85, fields: { note: rawText } });
  }

  if (/(开始|开工|现在做|现在写)/.test(rawText)) {
    return withPreview({ ...base, intent: 'start_work', confidence: 0.84, fields: { note: rawText } });
  }

  if (/(没做完|没完成|低估|被.*打断|以后要|下次|复盘)/.test(rawText)) {
    return withPreview({
      ...base,
      intent: 'review_note',
      confidence: 0.78,
      fields: { note: rawText, reasonType: inferReasonType(rawText), lesson: inferLesson(rawText) }
    });
  }

  if (/(一半|进度|可能.*不完|来不及|比我想的|卡住|做了|写了)/.test(rawText)) {
    return withPreview({ ...base, intent: 'progress_update', confidence: 0.78, fields: { note: rawText } });
  }

  return withPreview({
    ...base,
    intent: 'add_task',
    confidence: 0.72,
    fields: {
      title: cleanupTaskTitle(rawText),
      dueAt: inferDueAt(rawText, now),
      estimatedMinutes,
      preparations,
      notes
    }
  });
}

export async function parseAndEnrichTextInput(text: string, now = new Date().toISOString(), source: SourceType | string = 'text') {
  const prepared = await prepareTextForParsing(text, normalizeSource(source));
  const effectiveText = prepared.text;
  const attach = (result: ParseResult): ParseResult => prepared.transcription ? { ...result, transcription: prepared.transcription } : result;

  if (isExplicitTodoText(effectiveText)) {
    return attach(await enrichParseResult(parseTextInput(effectiveText, now)));
  }
  if (hasExplicitMeetingTimeText(effectiveText) && !isEventOperationText(effectiveText)) {
    return attach(await enrichParseResult(parseTextInput(effectiveText, now)));
  }
  const aiResult = await parseTextWithAi(effectiveText, now);
  const guarded = guardClarificationCompletion(
    effectiveText,
    guardParsedRequiredDetails(
      effectiveText,
      guardParsedTime(effectiveText, guardParsedExplicitTime(effectiveText, guardParsedDate(effectiveText, aiResult ?? parseTextInput(effectiveText, now), now), now))
    ),
    now
  );
  return attach(await enrichParseResult(guarded));
}

export async function enrichParseResult(result: ParseResult): Promise<ParseResult> {
  if (result.intent === 'add_task') {
    return enrichTaskParseResult(result);
  }

  if (result.intent !== 'add_event' || typeof result.fields.startAt !== 'string' || typeof result.fields.endAt !== 'string') {
    return result;
  }

  const conflictResult = await checkConflicts({
    title: typeof result.fields.title === 'string' ? result.fields.title : undefined,
    startAt: result.fields.startAt,
    endAt: result.fields.endAt,
    date: typeof result.fields.date === 'string' ? result.fields.date : undefined
  });

  if (!conflictResult.hasConflict) return result;

  const conflictTypes = new Set(conflictResult.conflicts.map((conflict) => conflict.type));
  const question = '这个时间已有安排，要修改、重叠还是取消？';

  return {
    ...result,
    confidence: Math.min(result.confidence, 0.64),
    needsConfirmation: true,
    questions: [...result.questions, question],
    warnings: [...result.warnings, ...Array.from(conflictTypes)],
    preview: {
      ...result.preview,
      conflicts: conflictResult.conflicts,
      options: conflictResult.options
    }
  };
}

async function appendEventFromParse(
  parsed: ParseResult,
  text: string,
  source: SourceType,
  now: string,
  options: { keepTime: boolean }
) {
  const event: EventRecord = {
    id: createId('event'),
    type: (parsed.fields.type as EventRecord['type']) ?? 'other',
    title: String(parsed.fields.title ?? cleanupEventTitle(text)),
    date: String(parsed.fields.date ?? new Date(now).toISOString().slice(0, 10)),
    startAt: options.keepTime && typeof parsed.fields.startAt === 'string' ? parsed.fields.startAt : undefined,
    endAt: options.keepTime && typeof parsed.fields.endAt === 'string' ? parsed.fields.endAt : undefined,
    purpose: typeof parsed.fields.purpose === 'string' ? parsed.fields.purpose : undefined,
    preparations: normalizeStringArray(parsed.fields.preparations),
    notes: typeof parsed.fields.notes === 'string' ? parsed.fields.notes : undefined,
    reminderIds: [],
    status: 'scheduled',
    linkedTaskId: null,
    tags: [],
    source,
    rawText: text,
    createdAt: now,
    updatedAt: now
  };
  await appendJsonl(files.events, event);
  return event;
}

async function appendTaskFromParse(
  parsed: ParseResult,
  text: string,
  source: SourceType,
  now: string,
  overrides: { dueAt?: string | null; tags?: string[] } = {}
) {
  const projects = await readTodoProjects();
  const project = await findOrCreateTodoProject(inferTodoProjectTitle(text, projects), projects);
  const task: TaskRecord = {
    id: createId('task'),
    title: String(parsed.fields.title ?? cleanupTaskTitle(text)),
    description: '',
    status: 'todo',
    priority: 'medium',
    dueAt: overrides.dueAt ?? ((parsed.fields.dueAt as string | null | undefined) ?? inferDueAt(text, now)),
    estimatedMinutes: (parsed.fields.estimatedMinutes as number | null | undefined) ?? null,
    preparations: normalizeStringArray(parsed.fields.preparations),
    notes: inferTodoNote(text) ?? sanitizeParsedTodoNote(parsed.fields.notes),
    actualMinutes: 0,
    linkedEventIds: [],
    goalId: null,
    projectId: project?.id ?? null,
    tags: overrides.tags ?? [],
    source,
    rawText: text,
    createdAt: now,
    updatedAt: now
  };
  await appendJsonl(files.tasks, task);
  return task;
}

export async function createTodoProject(title: string, options: { reuseExisting?: boolean } = { reuseExisting: true }) {
  await ensureDataFiles();
  const projects = await readTodoProjects();
  const now = new Date().toISOString();
  const existing = options.reuseExisting === false ? null : findSimilarTodoProject(title, projects);
  if (existing) return { ok: true, project: existing };
  const project: TodoProjectRecord = {
    id: createId('project'),
    title: title.trim(),
    status: 'active',
    createdAt: now,
    updatedAt: now
  };
  await writeTodoProjects([...projects, project]);
  return { ok: true, project };
}

export async function updateTodoProject(id: string, updates: { title?: string }) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const projects = await readTodoProjects();
  const nextProjects = projects.map((project) =>
    project.id === id ? { ...project, title: updates.title?.trim() || project.title, updatedAt: now } : project
  );
  await writeTodoProjects(nextProjects);
  return { ok: projects.some((project) => project.id === id), id };
}

export async function deleteTodoProject(id: string) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const projects = await readTodoProjects();
  const tasks = await readJsonl<TaskRecord>(files.tasks);
  await writeTodoProjects(projects.filter((project) => project.id !== id));
  await writeJsonl(
    files.tasks,
    tasks.map((task) => (task.projectId === id ? { ...task, projectId: null, updatedAt: now } : task))
  );
  return { ok: projects.some((project) => project.id === id), id };
}

export async function createTodoTask(input: { title?: string; notes?: string; projectId?: string | null }) {
  await ensureDataFiles();
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'title is required' };
  const now = new Date().toISOString();
  const task: TaskRecord = {
    id: createId('task'),
    title,
    description: '',
    status: 'todo',
    priority: 'medium',
    dueAt: null,
    estimatedMinutes: null,
    preparations: [],
    notes: input.notes?.trim() || undefined,
    actualMinutes: 0,
    linkedEventIds: [],
    goalId: null,
    projectId: input.projectId ?? null,
    tags: [],
    source: 'manual',
    rawText: title,
    createdAt: now,
    updatedAt: now
  };
  await appendJsonl(files.tasks, task);
  return { ok: true, task };
}

async function enrichTaskParseResult(result: ParseResult): Promise<ParseResult> {
  const cleanResult = sanitizeTaskParseResult(result);
  const tasks = await readJsonl<TaskRecord>(files.tasks);
  const events = await readJsonl<EventRecord>(files.events);
  const title = typeof cleanResult.fields.title === 'string' ? cleanResult.fields.title.trim() : '';
  const dueAt = typeof cleanResult.fields.dueAt === 'string' ? cleanResult.fields.dueAt : null;
  const estimatedMinutes = typeof cleanResult.fields.estimatedMinutes === 'number' ? cleanResult.fields.estimatedMinutes : null;
  const warnings: string[] = [];
  const questions: string[] = [];
  const options: Array<{ id: string; title: string }> = [];

  const explicitlyAdding = /新增|新加|添加|加一个|有一个|新任务|待办|项目代办/.test(cleanResult.rawText);
  const duplicateTasks = title
    ? tasks.filter((task) => task.status === 'todo' && isLikelyDuplicateTask(title, dueAt, task))
    : [];
  if (duplicateTasks.length > 0 && !explicitlyAdding) {
    warnings.push('duplicate_task');
    questions.push('这个任务看起来可能已经记过了，要继续新增还是先看已有任务？');
    options.push(
      { id: 'duplicate-add', title: '继续新增' },
      { id: 'skip-duplicate', title: '只保留已有任务' }
    );
  }

  if (dueAt && dueAt.startsWith(new Date().toISOString().slice(0, 10)) && estimatedMinutes) {
    const remainingMinutes = getRemainingAvailableMinutes(events);
    if (estimatedMinutes > remainingMinutes) {
      warnings.push('plan_overload');
      questions.push(`今天剩余可安排时间大约 ${remainingMinutes} 分钟，但这个任务估计要 ${estimatedMinutes} 分钟。要拆开做，还是改到明天？`);
      options.push(
        { id: 'task-split', title: '先记录为待拆分' },
        { id: 'defer-tomorrow', title: '改到明天' }
      );
    }
  }

  if (warnings.length === 0) return cleanResult;

  return {
    ...cleanResult,
    confidence: Math.min(cleanResult.confidence, 0.66),
    needsConfirmation: true,
    questions: [...cleanResult.questions, ...questions],
    warnings: [...cleanResult.warnings, ...warnings],
    preview: {
      ...cleanResult.preview,
      duplicateTasks,
      options
    }
  };
}

function sanitizeTaskParseResult(result: ParseResult): ParseResult {
  const fields = { ...result.fields };
  const cleanNote = sanitizeParsedTodoNote(fields.notes);
  if (cleanNote) {
    fields.notes = cleanNote;
  } else {
    delete fields.notes;
  }
  return { ...result, fields };
}

function isExplicitTodoText(text: string) {
  return /(项目待办|项目代办|待办|新任务|新增.*任务|新加.*任务|添加.*任务|有一个.*任务|有一个.*待办|^[^，。；;]{1,12}?(新增|新加|添加|加|记)(一个|个|一条)?[^，。；;]{1,24}$)/.test(text);
}

function isLikelyDuplicateTask(title: string, dueAt: string | null, task: TaskRecord) {
  const existingTitle = task.title.trim();
  if (!existingTitle) return false;
  const sameDueDate = Boolean(dueAt && task.dueAt && dueAt.slice(0, 10) === task.dueAt.slice(0, 10));
  if (title.length <= 3 || existingTitle.length <= 3) {
    return title === existingTitle && sameDueDate;
  }
  return sameDueDate
    ? existingTitle.includes(title) || title.includes(existingTitle)
    : title === existingTitle;
}

export async function updateReminderStatus(id: string, status: ReminderRecord['status']) {
  await ensureDataFiles();
  const reminders = await readJsonl<ReminderRecord>(files.reminders);
  const nextReminders = reminders.map((reminder) =>
    reminder.id === id ? { ...reminder, status, updatedAt: new Date().toISOString() } : reminder
  );
  await writeJsonl(files.reminders, nextReminders);
  return { ok: reminders.some((reminder) => reminder.id === id), id, status };
}

export async function updateTask(
  id: string,
  updates: {
    title?: string;
    notes?: string;
    dueAt?: string | null;
    estimatedMinutes?: number | null;
    preparations?: string[];
    status?: TaskRecord['status'];
    projectId?: string | null;
  }
) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const tasks = await readJsonl<TaskRecord>(files.tasks);
  const nextTasks = tasks.map((task) =>
    task.id === id
      ? {
          ...task,
          title: updates.title?.trim() || task.title,
          notes: updates.notes ?? task.notes,
          dueAt: updates.dueAt === undefined ? task.dueAt : updates.dueAt,
          estimatedMinutes: updates.estimatedMinutes === undefined ? task.estimatedMinutes : updates.estimatedMinutes,
          preparations: updates.preparations ?? task.preparations,
          status: updates.status ?? task.status,
          projectId: updates.projectId === undefined ? task.projectId : updates.projectId,
          updatedAt: now
        }
      : task
  );
  await writeJsonl(files.tasks, nextTasks);
  return { ok: tasks.some((task) => task.id === id), id };
}

export async function cancelTask(id: string) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const tasks = await readJsonl<TaskRecord>(files.tasks);
  const nextTasks = tasks.map((task) => (task.id === id ? { ...task, status: 'cancelled' as const, updatedAt: now } : task));
  await writeJsonl(files.tasks, nextTasks);
  return { ok: tasks.some((task) => task.id === id), id, status: 'cancelled' };
}

export async function updateEvent(id: string, updates: { title?: string; notes?: string; startAt?: string; endAt?: string; date?: string; purpose?: string; preparations?: string[] }) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const events = await readJsonl<EventRecord>(files.events);
  const nextEvents = events.map((event) =>
    event.id === id
      ? {
          ...event,
          title: updates.title?.trim() || event.title,
          notes: updates.notes ?? event.notes,
          purpose: updates.purpose ?? event.purpose,
          preparations: updates.preparations ?? event.preparations,
          date: updates.date ?? event.date,
          startAt: updates.startAt ?? event.startAt,
          endAt: updates.endAt ?? event.endAt,
          updatedAt: now
        }
      : event
  );
  await writeJsonl(files.events, nextEvents);
  return { ok: events.some((event) => event.id === id), id };
}

export async function cancelEvent(id: string) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const events = await readJsonl<EventRecord>(files.events);
  const nextEvents = events.map((event) => (event.id === id ? { ...event, status: 'cancelled' as const, updatedAt: now } : event));
  await writeJsonl(files.events, nextEvents);
  return { ok: events.some((event) => event.id === id), id, status: 'cancelled' };
}

export async function updateWorkLog(id: string, updates: { note?: string; at?: string }) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const workLogs = await readJsonl<WorkLogRecord>(files.workLogs);
  const nextLogs = workLogs.map((log) =>
    log.id === id
      ? {
          ...log,
          note: updates.note?.trim() || log.note,
          at: updates.at || log.at,
          updatedAt: now
        }
      : log
  );
  await writeJsonl(files.workLogs, nextLogs);
  return { ok: workLogs.some((log) => log.id === id), id };
}

export async function deleteWorkLog(id: string) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const workLogs = await readJsonl<WorkLogRecord>(files.workLogs);
  const nextLogs = workLogs.map((log) => (log.id === id ? { ...log, status: 'deleted' as const, updatedAt: now } : log));
  await writeJsonl(files.workLogs, nextLogs);
  return { ok: workLogs.some((log) => log.id === id), id, status: 'deleted' };
}

export async function snoozeReminder(id: string, minutes = 10) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const remindAt = new Date();
  remindAt.setMinutes(remindAt.getMinutes() + Math.max(1, minutes));
  const reminders = await readJsonl<ReminderRecord>(files.reminders);
  const nextReminders = reminders.map((reminder) =>
    reminder.id === id
      ? {
          ...reminder,
          remindAt: remindAt.toISOString(),
          status: 'pending' as const,
          updatedAt: now
        }
      : reminder
  );
  await writeJsonl(files.reminders, nextReminders);
  return { ok: reminders.some((reminder) => reminder.id === id), id, remindAt: remindAt.toISOString(), status: 'pending' };
}

export async function listGoals() {
  await ensureDataFiles();
  return readGoals();
}

export async function createGoal(title: string, targetDate: string | null = null) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const goals = await readGoals();
  const goal: GoalRecord = {
    id: createId('goal'),
    title: title.trim(),
    status: 'active',
    startDate: toLocalDateText(new Date()),
    targetDate,
    milestones: [],
    linkedTaskIds: [],
    createdAt: now,
    updatedAt: now
  };
  const nextGoals = [...goals, goal];
  await writeTextFile(files.goals, JSON.stringify({ goals: nextGoals }, null, 2));
  return { ok: true, goal };
}

export async function updateGoalStatus(id: string, status: GoalRecord['status']) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const goals = await readGoals();
  const nextGoals = goals.map((goal) => (goal.id === id ? { ...goal, status, updatedAt: now } : goal));
  await writeTextFile(files.goals, JSON.stringify({ goals: nextGoals }, null, 2));
  return { ok: goals.some((goal) => goal.id === id), id, status };
}

export async function getProfileData() {
  await ensureDataFiles();
  const [profile, workLogs, tasks] = await Promise.all([readProfile(), readJsonl<WorkLogRecord>(files.workLogs), readJsonl<TaskRecord>(files.tasks)]);
  return buildProfileSnapshot(profile, workLogs, tasks);
}

export async function generateMarkdownSummary(kind: 'daily' | 'weekly' = 'daily') {
  await ensureDataFiles();
  const [events, tasks, workLogs, reminders, reviews, goals] = await Promise.all([
    readJsonl<EventRecord>(files.events),
    readJsonl<TaskRecord>(files.tasks),
    readJsonl<WorkLogRecord>(files.workLogs),
    readJsonl<ReminderRecord>(files.reminders),
    readJsonl<ReviewRecord>(files.reviews),
    readGoals()
  ]);
  const now = new Date();
  const today = toLocalDateText(now);
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const startDate = kind === 'daily' ? today : toLocalDateText(weekStart);
  const endDate = kind === 'daily' ? today : toLocalDateText(weekEnd);
  const inRange = (value?: string | null) => Boolean(value && value.slice(0, 10) >= startDate && value.slice(0, 10) <= endDate);
  const title = kind === 'daily' ? `${today} YayaMind 日总结` : `${startDate} 至 ${endDate} YayaMind 周总结`;
  const fileName = kind === 'daily' ? `${today}.md` : `${startDate}_week.md`;
  const lines = [
    `# ${title}`,
    '',
    '## 安排',
    ...toMarkdownList(events.filter((event) => event.date >= startDate && event.date <= endDate).map((event) => `${formatTimeRangeForSummary(event.startAt, event.endAt)} ${event.title}`)),
    '',
    '## 任务',
    ...toMarkdownList(tasks.filter((task) => inRange(task.dueAt) || inRange(task.createdAt)).map((task) => `${task.status} · ${task.title}`)),
    '',
    '## 执行记录',
    ...toMarkdownList(workLogs.filter((log) => inRange(log.at)).map((log) => `${formatTime(log.at)} · ${log.action} · ${log.note}`)),
    '',
    '## 提醒',
    ...toMarkdownList(reminders.filter((reminder) => inRange(reminder.remindAt) || inRange(reminder.updatedAt)).map((reminder) => `${reminder.status} · ${reminder.title}`)),
    '',
    '## 复盘',
    ...toMarkdownList(reviews.filter((review) => inRange(review.createdAt)).map((review) => `${review.reasonType} · ${review.note}${review.lesson ? `｜经验：${review.lesson}` : ''}`)),
    '',
    '## 阶段性目标',
    ...toMarkdownList(goals.filter((goal) => goal.status === 'active').map((goal) => `${goal.title}${goal.targetDate ? `｜目标日期：${goal.targetDate}` : ''}`)),
    '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    ''
  ];
  const path = join(files.summariesDir, fileName);
  await writeTextFile(path, lines.join('\n'));
  return { ok: true, file: path, title, kind };
}

async function triggerDueReminders(reminders: ReminderRecord[]) {
  const now = Date.now();
  const updatedAt = new Date().toISOString();
  let changed = false;
  const nextReminders = reminders.map((reminder) => {
    if (reminder.status !== 'pending') return reminder;
    if (new Date(reminder.remindAt).getTime() > now) return reminder;
    changed = true;
    return { ...reminder, status: 'triggered' as const, updatedAt };
  });

  if (changed) {
    await writeJsonl(files.reminders, nextReminders);
  }

  return nextReminders;
}

export async function checkConflicts(candidate: { title?: string; startAt?: string; endAt?: string; date?: string }) {
  await ensureDataFiles();
  const events = await readJsonl<EventRecord>(files.events);
  const activeEvents = events.filter((event) => event.status === 'scheduled');

  const overlapEvents =
    candidate.startAt && candidate.endAt
      ? activeEvents.filter((event) => event.startAt && event.endAt && rangesOverlap(candidate.startAt!, candidate.endAt!, event.startAt, event.endAt))
      : [];

  const conflicts = overlapEvents.map((event) => ({ type: 'time_overlap', event }));

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    options: buildConflictOptions(conflicts)
  };
}

function buildConflictOptions(conflicts: Array<{ type: string; event: EventRecord }>) {
  if (conflicts.length === 0) return [];
  return [
    {
      id: 'edit-input',
      title: '修改'
    },
    {
      id: 'keep-both',
      title: '重叠'
    }
  ];
}

async function ensureFile(path: string, fallback: string) {
  try {
    await readTextFile(path);
  } catch {
    await writeTextFile(path, fallback);
  }
}

async function readJsonl<T>(path: string): Promise<T[]> {
  const content = await readTextFile(path);
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

async function appendJsonl(path: string, value: unknown) {
  const current = await readTextFile(path);
  const prefix = current.trim().length > 0 && !current.endsWith('\n') ? '\n' : '';
  await writeTextFile(path, `${current}${prefix}${JSON.stringify(value)}\n`);
}

async function writeJsonl(path: string, values: unknown[]) {
  await writeTextFile(path, values.map((value) => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''));
}

async function readGoals(): Promise<GoalRecord[]> {
  try {
    const content = await readTextFile(files.goals);
    const parsed = JSON.parse(content) as { goals?: GoalRecord[] };
    return Array.isArray(parsed.goals) ? parsed.goals : [];
  } catch {
    return [];
  }
}

async function readTodoProjects(): Promise<TodoProjectRecord[]> {
  try {
    const content = await readTextFile(files.todoProjects);
    const parsed = JSON.parse(content) as { projects?: TodoProjectRecord[] };
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

async function writeTodoProjects(projects: TodoProjectRecord[]) {
  await writeTextFile(files.todoProjects, JSON.stringify({ projects }, null, 2));
}

async function readProfile(): Promise<ProfileData> {
  try {
    const content = await readTextFile(files.profiles);
    return { ...createDefaultProfile(), ...(JSON.parse(content) as Partial<ProfileData>) };
  } catch {
    return createDefaultProfile();
  }
}

async function readSettings(): Promise<AppSettings> {
  try {
    const content = await readTextFile(files.settings);
    const stored = JSON.parse(content) as Partial<AppSettings>;
    const defaults = createDefaultSettings();
    return {
      ...defaults,
      ...stored,
      notification: { ...defaults.notification, ...(stored.notification ?? {}) },
      ui: { ...defaults.ui, ...(stored.ui ?? {}) },
      weather: { ...defaults.weather, ...(stored.weather ?? {}) }
    };
  } catch {
    return createDefaultSettings();
  }
}

async function readTextFile(path: string) {
  if (!useSupabaseStorage) return readFile(path, 'utf8');
  const stored = await supabaseRequest<Array<{ content: string }>>(
    `/rest/v1/${supabaseTable}?key=eq.${encodeURIComponent(storageKey(path))}&select=content`,
    { method: 'GET' }
  );
  const content = stored[0]?.content;
  if (typeof content !== 'string') throw new Error(`Missing cloud storage key: ${storageKey(path)}`);
  return content;
}

async function writeTextFile(path: string, content: string) {
  if (!useSupabaseStorage) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, 'utf8');
    return;
  }
  await supabaseRequest(`/rest/v1/${supabaseTable}`, {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({
      key: storageKey(path),
      content,
      updated_at: new Date().toISOString()
    })
  });
}

async function supabaseRequest<T = unknown>(path: string, init: RequestInit): Promise<T> {
  const url = `${process.env.SUPABASE_URL?.replace(/\/+$/, '')}${path}`;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const response = await fetch(url, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase storage request failed: ${response.status} ${detail}`);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function storageKey(path: string) {
  const key = path.startsWith(dataDir)
    ? path.slice(dataDir.length).replace(/^[/\\]+/, '').replace(/\\/g, '/')
    : path.replace(/\\/g, '/');
  if (!useSupabaseStorage) return key;
  const userId = getRequestUserId();
  if (!userId) throw new Error('Missing authenticated user context');
  return `${userId}/${key}`;
}

function createDefaultSettings(): AppSettings {
  return {
    timezone: 'Asia/Shanghai',
    dataVersion: 1,
    assistantName: 'YayaMind',
    notification: {
      browserNotificationEnabled: false,
      quietDuringWorking: true
    },
    ui: {
      calendarDays: 7,
      dayStartHour: 0,
      dayEndHour: 24
    },
    weather: {
      enabled: true,
      latitude: 31.2304,
      longitude: 121.4737,
      city: '',
      rainProbabilityThreshold: 45,
      outdoorLeadMinutes: 30
    }
  };
}

function createDefaultProfile(): ProfileData {
  return {
    timeHabits: {
      highFocusWindows: [],
      lowEnergyWindows: [],
      commonDelayWindows: []
    },
    estimationPatterns: {
      oftenUnderestimatedTags: [],
      bufferRules: []
    },
    lifeRhythm: {
      regularMeals: [],
      exercisePreferences: [],
      restPatterns: []
    },
    workPreferences: {
      focusStyle: 'unknown',
      preferredTaskOrder: 'unknown',
      encouragementStyle: 'gentle'
    },
    signals: [],
    updatedAt: new Date().toISOString()
  };
}

function buildProfileSnapshot(profile: ProfileData, workLogs: WorkLogRecord[], tasks: TaskRecord[]) {
  const progressLogs = workLogs.filter((log) => log.action === 'progress');
  const longFocusCount = workLogs.filter((log) => log.action === 'start').length;
  const needsSplitCount = tasks.filter((task) => task.tags.includes('needs_split')).length;
  const signals = [
    ...profile.signals,
    progressLogs.length ? `已记录 ${progressLogs.length} 条进度反馈。` : '进度反馈还不多，后续会继续学习节奏。',
    needsSplitCount ? `${needsSplitCount} 个任务被标记为需要拆分。` : '目前还没有明显的任务拆分信号。',
    longFocusCount ? `已有 ${longFocusCount} 次开始工作记录。` : '还缺少足够的开始工作记录。'
  ];
  return {
    ...profile,
    signals: Array.from(new Set(signals)).slice(-8),
    updatedAt: new Date().toISOString()
  };
}

function toMarkdownList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`) : ['- 暂无记录'];
}

function formatTimeRangeForSummary(startAt?: string, endAt?: string) {
  if (!startAt) return '待定';
  return endAt ? `${formatTime(startAt)}-${formatTime(endAt)}` : formatTime(startAt);
}

function buildCalendar(
  events: EventRecord[],
  tasks: TaskRecord[] = [],
  reminders: ReminderRecord[] = [],
  workLogs: WorkLogRecord[] = [],
  weatherAlerts: WeatherAlert[] = []
) {
  const weekStart = getWeekStart(new Date());
  const weekDates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return toLocalDateText(date);
  });
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndText = toLocalDateText(weekEnd);
  const futureDates = Array.from(
    new Set([
      ...events.filter((event) => event.status === 'scheduled' && event.date > weekEndText).map((event) => event.date),
      ...tasks
        .filter((task) => task.status === 'todo' && task.title.trim() && task.dueAt && task.dueAt.slice(0, 10) > weekEndText)
        .map((task) => task.dueAt!.slice(0, 10))
    ])
  )
    .sort()
    .slice(0, 21);

  return [...weekDates, ...futureDates].map((isoDate) => {
    const date = new Date(`${isoDate}T00:00:00`);
    return {
      date: isoDate,
      label: formatWeekLabel(date),
      items: assignEventLanes(events.filter((event) => event.date === isoDate && event.status === 'scheduled' && event.startAt && event.endAt)),
      pendingItems: events
        .filter((event) => event.date === isoDate && event.status === 'scheduled' && (!event.startAt || !event.endAt))
        .map(toCalendarEventItem),
      tasks: tasks
        .filter((task) => task.status === 'todo' && task.title.trim() && task.dueAt?.startsWith(isoDate) && hasTimedTodoDeadline(task))
        .map((task) => ({
          id: task.id,
          title: task.title,
          type: 'task',
          dueAt: task.dueAt,
          estimatedMinutes: task.estimatedMinutes,
          preparations: task.preparations ?? [],
          notes: task.notes ?? task.description,
          rawText: task.rawText
        })),
      reminders: reminders
        .filter((reminder) => reminder.remindAt.startsWith(isoDate) || reminder.updatedAt.startsWith(isoDate))
        .map((reminder) => ({
          id: reminder.id,
          title: reminder.title,
          remindAt: reminder.remindAt,
          status: reminder.status,
          relatedType: reminder.relatedType,
          relatedId: reminder.relatedId
        })),
      weatherAlerts: weatherAlerts.filter((alert) => alert.date === isoDate),
      timeline: workLogs
        .filter((log) => log.status !== 'deleted' && log.at.startsWith(isoDate))
        .map((log) => ({
          id: log.id,
          at: log.at,
          time: formatTime(log.at),
          text: log.note,
          action: log.action,
          feedbackType: log.feedbackType
        }))
        .sort((a, b) => a.time.localeCompare(b.time))
    };
  });
}

function getWeekStart(value: Date) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatWeekLabel(date: Date) {
  const today = new Date();
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
  const dateText = `${date.getMonth() + 1}/${date.getDate()}`;
  return toLocalDateText(date) === toLocalDateText(today) ? `今天 ${weekday} ${dateText}` : `${weekday} ${dateText}`;
}

function toLocalDateText(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildVisibleTodoProjects(projects: TodoProjectRecord[], tasks: TaskRecord[]) {
  const activeProjects = projects.filter((project) => project.status === 'active');
  const hasUncategorized = tasks.some((task) => task.status !== 'cancelled' && !task.projectId);
  return hasUncategorized
    ? [
        ...activeProjects,
        {
          id: 'uncategorized',
          title: '未归类',
          status: 'active' as const,
          createdAt: '',
          updatedAt: ''
        }
      ]
    : activeProjects;
}

function buildTaskList(tasks: TaskRecord[], projects: TodoProjectRecord[]) {
  const projectById = new Map(projects.map((project) => [project.id, project.title]));
  return tasks
    .filter((task) => task.status !== 'cancelled' && task.title.trim())
    .map((task) => {
      const tagProject = task.tags.find((tag) => tag !== 'needs_split');
      const projectId = task.projectId ?? (tagProject ? `tag:${tagProject}` : 'uncategorized');
      const projectTitle = task.projectId ? projectById.get(task.projectId) ?? '未归类' : tagProject ?? '未归类';
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        projectId,
        projectTitle,
        dueAt: task.dueAt,
        estimatedMinutes: task.estimatedMinutes,
        notes: task.notes ?? task.description,
        preparations: task.preparations ?? [],
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      };
    });
}

function hasTimedTodoDeadline(task: TaskRecord) {
  const text = `${task.rawText ?? ''} ${task.notes ?? ''}`;
  return hasExplicitTimeText(text) || /时间[：:]/.test(text);
}

function findSimilarTodoProject(title: string | undefined, projects: TodoProjectRecord[]) {
  const normalized = normalizeProjectTitle(title);
  if (!normalized) return null;
  return (
    projects.find((project) => {
      const projectTitle = normalizeProjectTitle(project.title);
      if (projectTitle === normalized) return true;
      const shortAliasMatch =
        Math.min(projectTitle.length, normalized.length) <= 4 &&
        (projectTitle.includes(normalized) || normalized.includes(projectTitle));
      return shortAliasMatch;
    }) ?? null
  );
}

async function findOrCreateTodoProject(title: string | undefined, projects: TodoProjectRecord[]) {
  const normalized = normalizeProjectTitle(title);
  if (!normalized) return null;
  const existing = findSimilarTodoProject(normalized, projects);
  if (existing) return existing;
  const created = await createTodoProject(normalized);
  return created.project;
}

function inferTodoProjectTitle(text: string, projects: TodoProjectRecord[]) {
  const actionPrefix = text.match(/^([^，。；;]{1,12}?)(?:新增|新加|添加|加|记)(?:一个|个|一条)?(?:项目)?(?:待办|代办|任务)/)?.[1]?.trim();
  if (actionPrefix && !/(现在|今天|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|我要|我想|需要)/.test(actionPrefix)) {
    return actionPrefix;
  }

  const looseActionPrefix = text.match(/^([^，。；;]{1,12}?)(?:新增|新加|添加|加|记)(?:一个|个|一条)?[^，。；;]{1,24}$/)?.[1]?.trim();
  if (looseActionPrefix && !/(现在|今天|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|我要|我想|需要)/.test(looseActionPrefix)) {
    return looseActionPrefix;
  }

  const explicit = text.match(/(?:项目|分类|类别)[：:，, ]*([^，。；;]+?)(?:的?待办|有|里面|下|里|，|。|；|;|$)/)?.[1]?.trim();
  if (explicit) return explicit;

  const prefix = text.match(/^([^，。；;]{1,12}?)(?:有|里有|里面有|项目有|分类有)(?:一个|个|一条)?(?:待办|任务)/)?.[1]?.trim();
  if (prefix && !/(现在|今天|明天|我要|我想|新加|新增|添加)/.test(prefix)) return prefix;

  const known = projects.find((project) => text.includes(project.title));
  return known?.title;
}

function normalizeProjectTitle(title?: string) {
  return (title ?? '')
    .replace(/^(给|在|到|把)/, '')
    .replace(/(项目|分类|类别|待办|任务)$/g, '')
    .trim();
}

function assignEventLanes(events: EventRecord[]) {
  const sorted = [...events].sort((a, b) => new Date(a.startAt ?? `${a.date}T23:59:00`).getTime() - new Date(b.startAt ?? `${b.date}T23:59:00`).getTime());
  const laneEnds: number[] = [];
  const placed = sorted.map((event) => {
    const start = new Date(event.startAt ?? `${event.date}T23:59:00`).getTime();
    const end = new Date(event.endAt ?? event.startAt ?? `${event.date}T23:59:00`).getTime();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    return {
      ...toCalendarEventItem(event),
      lane,
      laneCount: 1
    };
  });

  return placed.map((event, _, all) => {
    if (!event.startAt || !event.endAt) return event;
    const overlapping = all.filter((other) => {
      if (!other.startAt || !other.endAt) return false;
      return rangesOverlap(event.startAt!, event.endAt!, other.startAt, other.endAt);
    });
    const laneCount = overlapping.reduce((max, other) => Math.max(max, other.lane + 1), 1);
    return { ...event, laneCount, conflict: overlapping.length > 1 };
  });
}

function toCalendarEventItem(event: EventRecord) {
  return {
    id: event.id,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    type: event.type,
    purpose: event.purpose,
    preparations: event.preparations ?? [],
    notes: event.notes,
    reminderIds: event.reminderIds ?? [],
    rawText: event.rawText
  };
}

async function buildWeatherAlerts(events: EventRecord[], settings: AppSettings): Promise<WeatherAlert[]> {
  if (!settings.weather.enabled) return [];
  const forecast = await fetchWeatherForecast(settings);
  if (forecast.length === 0) return [];
  const forecastByDate = new Map(forecast.map((day) => [day.date, day]));
  const scheduledOutdoorEvents = events.filter((event) => event.status === 'scheduled' && event.date && isOutdoorEvent(event));
  const alerts: WeatherAlert[] = [];

  for (const event of scheduledOutdoorEvents) {
    const day = forecastByDate.get(event.date);
    if (!day || !day.rainy) continue;
    const remindAt = event.startAt ? new Date(new Date(event.startAt).getTime() - settings.weather.outdoorLeadMinutes * 60_000).toISOString() : undefined;
    const placeText = settings.weather.city.trim() ? `${settings.weather.city.trim()} ` : '';
    alerts.push({
      id: `weather_${event.id}`,
      date: event.date,
      title: '出门提醒',
      detail: `${placeText}${day.summary}，去“${event.title}”前记得带伞。`,
      remindAt,
      relatedEventId: event.id,
      probability: day.probability
    });
  }

  return alerts;
}

async function fetchWeatherForecast(settings: AppSettings): Promise<Array<{ date: string; probability: number; weatherCode: number; rainy: boolean; summary: string }>> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(settings.weather.latitude));
  url.searchParams.set('longitude', String(settings.weather.longitude));
  url.searchParams.set('daily', 'precipitation_probability_max,weather_code');
  url.searchParams.set('timezone', settings.timezone);
  url.searchParams.set('forecast_days', '7');

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        precipitation_probability_max?: number[];
        weather_code?: number[];
      };
    };
    const dates = data.daily?.time ?? [];
    const probabilities = data.daily?.precipitation_probability_max ?? [];
    const codes = data.daily?.weather_code ?? [];
    return dates.map((date, index) => {
      const probability = Number(probabilities[index] ?? 0);
      const weatherCode = Number(codes[index] ?? 0);
      const rainy = probability >= settings.weather.rainProbabilityThreshold || isRainWeatherCode(weatherCode);
      return {
        date,
        probability,
        weatherCode,
        rainy,
        summary: rainy ? `可能有雨（降雨概率 ${probability}%）` : `天气看起来还稳（降雨概率 ${probability}%）`
      };
    });
  } catch {
    return [];
  }
}

function isRainWeatherCode(code: number) {
  return [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
}

function isOutdoorEvent(event: EventRecord) {
  const text = `${event.title} ${event.purpose ?? ''} ${event.notes ?? ''} ${event.rawText ?? ''}`;
  return /出门|外出|通勤|返校|看医生|医院|机场|车站|高铁|地铁|公交|火车|飞机|打车|骑车|逛街|取快递|拿快递/.test(text);
}

function getActiveSession(workLogs: WorkLogRecord[]) {
  const last = [...workLogs].reverse().find((log) => ['start', 'pause', 'resume', 'finish'].includes(log.action));
  if (!last || last.action === 'finish' || last.action === 'pause') return null;
  return {
    title: last.note,
    startedAt: last.at
  };
}

function createId(prefix: string) {
  return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function cleanupTaskTitle(text: string) {
  const title = stripV11DetailText(text)
    .replace(/^([^，。；;]{1,12}?)(?:新增|新加|添加|加|记)(?:一个|个|一条)?(?:项目)?(?:待办|代办|任务)[，, ]*/, '')
    .replace(/^([^，。；;]{1,12}?)(?:新增|新加|添加|加|记)(?:一个|个|一条)?/, '')
    .replace(/^(项目)?待办[，, ]*(新增|新加|添加|加|记)?(一个|个|一条)?[，, ]*/, '')
    .replace(/^(新加|新增|添加|加|记)(一个|个|一条)?(项目)?待办[，, ]*/, '')
    .replace(/^(项目|分类|类别)[：:，, ]*[^，。；;]+?[，。；; ]*/, '')
    .replace(/^([^，。；;]{1,12}?)(?:有|里有|里面有|项目有|分类有)(?:一个|个|一条)?(?:待办|任务)[，, ]*/, '')
    .replace(/^我(要|想|需要)?/, '')
    .replace(/^(待办|任务)(是|：|:)?/, '')
    .replace(/^(今天|今晚|明天)/, '')
    .trim();
  return stripTodoTemporalText(title).trim() || title || text;
}

function stripTodoTemporalText(text: string) {
  return text
    .replace(/^(今天|今晚|明天|后天|这周|本周|下周)?\s*(周[一二三四五六日天]|星期[一二三四五六日天])?\s*(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2}|[一二两三四五六七八九十])?\s*点?(半|\d{1,2}分?)?\s*(要|需要|一定要|必须|得)?/, '')
    .replace(/^(今天|今晚|明天|后天|这周|本周|下周|周[一二三四五六日天]|星期[一二三四五六日天])\s*(要|需要|一定要|必须|得)?/, '')
    .trim();
}

function cleanupReminderTitle(text: string) {
  return stripV11DetailText(text).replace(/.*提醒我/, '').replace(/提醒/, '').trim() || text;
}

function cleanupEventTitle(text: string) {
  if (!hasUsableScheduleContent(text)) return '待补充安排';
  if (text.includes('面试')) {
    const company = text.match(/(?:主要是|主要|是)([^，。；;]*公司)/)?.[1]?.trim();
    return company ? `${company}面试` : '面试';
  }
  if (/(上课|课程|听课|讲座|课堂)/.test(text)) return '上课';
  if (/(开会|会议|会|沟通|讨论|复盘会)/.test(text)) return '开会';

  return (
    stripV11DetailText(text)
      .replace(/^嗯/, '')
      .replace(/有(个|一个|一场)/g, '')
      .replace(/然后要/g, '')
      .replace(/^(今天|今晚|明天|后天|这周|本周|周[一二三四五六日天]|星期[一二三四五六日天])/, '')
      .replace(/(上午|中午|下午|晚上|早上|今晚)/g, '')
      .replace(/\d{1,2}[:：]\d{2}\s*[-到至~～]\s*\d{1,2}[:：]\d{2}/, '')
      .replace(/(\d{1,2}|[一二两三四五六七八九十])\s*点(半|\d{1,2}分?)?/, '')
      .replace(/[，。；;]\s*$/g, '')
      .trim() || text
  );
}

function inferDueAt(text: string, now: string) {
  const date = new Date(now);
  if (text.includes('明天')) date.setDate(date.getDate() + 1);
  if (text.includes('后天')) date.setDate(date.getDate() + 2);
  const weekdayMatch = text.match(/(?:周|星期)([一二三四五六日天])/);
  if (weekdayMatch) {
    const target = '一二三四五六日天'.indexOf(weekdayMatch[1]);
    const targetDay = target >= 6 ? 0 : target + 1;
    const base = text.includes('下周') ? getWeekStart(new Date(now)) : date;
    if (text.includes('下周')) base.setDate(base.getDate() + 7);
    const currentDay = base.getDay();
    const diff = text.includes('下周')
      ? (targetDay === 0 ? 6 : targetDay - 1)
      : (targetDay - currentDay + 7) % 7 || 7;
    base.setDate(base.getDate() + diff);
    base.setHours(23, 59, 0, 0);
    return base.toISOString();
  }
  if (text.includes('今晚')) date.setHours(23, 59, 0, 0);
  return text.includes('今天') || text.includes('今晚') || text.includes('明天') || text.includes('后天') ? date.toISOString() : null;
}

function inferReminderTime(text: string, now: string) {
  const date = new Date(now);
  const minutesMatch = text.match(/(\d+)\s*分钟后/);
  if (minutesMatch) {
    date.setMinutes(date.getMinutes() + Number(minutesMatch[1]));
    return date.toISOString();
  }
  return date.toISOString();
}

function inferEstimatedMinutes(text: string) {
  const chineseHalfHourMatch = text.match(/([一二两三四五六七八九十\d]+)\s*个?半小时/);
  if (chineseHalfHourMatch) return parseChineseNumber(chineseHalfHourMatch[1]) * 60 + 30;
  const chineseHourMatch = text.match(/([一二两三四五六七八九十])\s*(个)?小时/);
  if (chineseHourMatch) return parseChineseNumber(chineseHourMatch[1]) * 60;
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(个)?小时/);
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60);
  const minuteMatch = text.match(/(\d+)\s*分钟/);
  if (minuteMatch) return Number(minuteMatch[1]);
  return null;
}

function inferPurpose(text: string) {
  const patterns = [
    /(?:具体内容|内容|要做的是|要干的是)(.+?)(?:，|。|；|;|提前|准备|要准备|备注|$)/,
    /(?:主要|目的|目标|为了|就是|是为了)(?:是|就是)?(.+?)(?:，|。|；|;|提前|记得|备注|$)/,
    /(?:确认|讨论|沟通)(.+?)(?:，|。|；|;|提前|记得|备注|$)/
  ];
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value && value.length > 1) return cleanupDetailFragment(value);
  }
  return undefined;
}

function inferPreparations(text: string) {
  const match = text.match(/(?:提前准备|提前要准备|需要准备|要准备|准备|带上|带)(.+?)(?:，|。|；|;|备注|提醒|$)/);
  if (!match?.[1]) return [];
  return splitListText(match[1]).map(cleanupDetailFragment).filter(Boolean).slice(0, 5);
}

function inferNotes(text: string, purpose?: string, preparations: string[] = []) {
  const explicitNote = text.match(/(?:备注|记一下|注意)(.+?)(?:，|。|；|;|$)/)?.[1]?.trim();
  if (explicitNote) return cleanupDetailFragment(explicitNote);
  const location = inferLocation(text);
  const detailParts = [location ? `地点：${location}` : undefined, purpose ? `内容：${purpose}` : undefined].filter(Boolean) as string[];
  if (detailParts.length === 0) return undefined;
  return detailParts.join('；');
}

function inferTodoNote(text: string) {
  const explicitNote = text.match(/(?:备注|记一下|注意)[：:，, ]*(.+?)(?:，|。|；|;|$)/)?.[1]?.trim();
  const timeNote = inferTodoTimeNote(text);
  const notes = [explicitNote ? cleanupDetailFragment(explicitNote) : undefined, timeNote].filter(Boolean) as string[];
  return notes.length ? Array.from(new Set(notes)).join('；') : undefined;
}

function sanitizeParsedTodoNote(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const note = value.trim();
  if (!note || /^地点[：:]/.test(note)) return undefined;
  return note;
}

function inferTodoTimeNote(text: string) {
  const range = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?(?:的)?\s*(\d{1,2})[:：](\d{2})\s*[-到至~～]\s*(\d{1,2})[:：](\d{2})/);
  if (range) return `时间：${range[1] ?? ''}${range[2]}:${range[3]}-${range[4]}:${range[5]}`;
  const hour = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2}|[一二两三四五六七八九十])\s*点(半|(\d{1,2})分?)?/);
  if (!hour) return undefined;
  const minute = hour[3] === '半' ? '30' : String(hour[4] ?? '00').padStart(2, '0');
  return `时间：${hour[1] ?? ''}${hour[2]}点${minute === '00' ? '' : minute}`;
}

function inferLocation(text: string) {
  const match = text.match(/(?:在|到|去)([^，。；;]+?)(?:开会|会议|上课|面试|见面|沟通|讨论|，|。|；|;|$)/);
  const value = match?.[1]?.trim();
  if (!value || value.length > 18) return undefined;
  if (/(凌晨|早上|上午|中午|下午|晚上|今晚|点|半|分钟)/.test(value) || hasExplicitTimeText(value)) return undefined;
  return cleanupDetailFragment(value);
}

function inferReminderRelatedType(text: string): ReminderRecord['relatedType'] {
  if (isScheduleLikeText(text)) return 'event';
  if (/(任务|写|做|整理|完成)/.test(text)) return 'task';
  return 'general';
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
}

function stripV11DetailText(text: string) {
  return text
    .replace(/(?:具体内容|内容|要做的是|要干的是).+?(?=，|。|；|;|提前|准备|要准备|备注|$)/g, '')
    .replace(/(?:主要|目的|目标|为了|就是|是为了)(?:是|就是)?.+?(?=，|。|；|;|提前|记得|备注|$)/g, '')
    .replace(/(?:提前准备|提前要准备|需要准备|准备|要准备|带上|带).+?(?=，|。|；|;|备注|提醒|$)/g, '')
    .replace(/(?:备注|记一下|注意).+?(?=，|。|；|;|$)/g, '')
    .replace(/可能要\s*[一二两三四五六七八九十\d.]+\s*(个)?半?小时/g, '')
    .replace(/估计要\s*[一二两三四五六七八九十\d.]+\s*(个)?半?小时/g, '')
    .replace(/[，。；;]\s*$/g, '');
}

function splitListText(text: string) {
  return text
    .replace(/和/g, '、')
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanupDetailFragment(text: string) {
  return text.replace(/^(一下|一下子|下轮|这次)/, '').replace(/^(是|就是|和|与)/, '').trim();
}

function parseChineseNumber(text: string) {
  const digit = Number(text);
  if (Number.isFinite(digit)) return digit;
  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10
  };
  if (text.includes('十')) {
    const [tensText, onesText] = text.split('十');
    const tens = tensText ? map[tensText] ?? 1 : 1;
    const ones = onesText ? map[onesText] ?? 0 : 0;
    return tens * 10 + ones;
  }
  return map[text] ?? 1;
}

function inferTimeInfo(text: string, now: string) {
  const date = inferDate(text, now);
  const range = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})\s*[-到至~～]\s*(\d{1,2})[:：](\d{2})/);
  if (range) {
    const period = range[1] ?? '';
    const startHour = normalizeHour(Number(range[2]), period);
    const endHour = normalizeHour(Number(range[4]), period);
    return {
      date,
      hasSpecificTime: true,
      hasVagueTime: false,
      startAt: atLocalTime(date, startHour, Number(range[3])),
      endAt: atLocalTime(date, endHour, Number(range[5]))
    };
  }

  const clock = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})/);
  if (clock) {
    const period = clock[1] ?? inferNearestTimePeriod(text, clock.index ?? 0);
    const hour = normalizeHour(Number(clock[2]), period);
    const minute = Number(clock[3]);
    return {
      date,
      hasSpecificTime: true,
      hasVagueTime: false,
      startAt: atLocalTime(date, hour, minute),
      endAt: atLocalTime(date, hour + 1, minute)
    };
  }

  const spokenRange = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?(?:的)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点?(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?\s*(?:到|至|[-~～])\s*(?:(凌晨|早上|上午|中午|下午|晚上|今晚)?(?:的)?\s*)?(\d{1,2}|[一二两三四五六七八九十]+)?\s*点?(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?/);
  if (spokenRange) {
    const startPeriod = spokenRange[1] ?? inferNearestTimePeriod(text, spokenRange.index ?? 0);
    const endPeriod = spokenRange[5] ?? startPeriod;
    const startHour = normalizeHour(parseChineseNumber(spokenRange[2]), startPeriod);
    const endRawHour = spokenRange[6] ? parseChineseNumber(spokenRange[6]) : parseChineseNumber(spokenRange[2]);
    const endHour = normalizeHour(endRawHour, endPeriod);
    const startMinute = spokenRange[3] === '半' ? 30 : parseChineseNumber(spokenRange[4] ?? '0');
    const endMinute = spokenRange[7] === '半' ? 30 : parseChineseNumber(spokenRange[8] ?? '0');
    return {
      date,
      hasSpecificTime: true,
      hasVagueTime: false,
      startAt: atLocalTime(date, startHour, startMinute),
      endAt: atLocalTime(date, endHour, endMinute)
    };
  }

  const hourMatch = text.match(/(早上|上午|中午|下午|晚上|今晚)?(?:的)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?/);
  if (hourMatch) {
    const period = hourMatch[1] ?? inferNearestTimePeriod(text, hourMatch.index ?? 0);
    const hour = normalizeHour(parseChineseNumber(hourMatch[2]), period);
    const minute = hourMatch[3] === '半' ? 30 : parseChineseNumber(hourMatch[4] ?? '0');
    return {
      date,
      hasSpecificTime: true,
      hasVagueTime: false,
      startAt: atLocalTime(date, hour, minute),
      endAt: atLocalTime(date, hour + 1, minute)
    };
  }

  const hasVagueTime = /(早上|上午|中午|下午|晚上|今晚|白天)/.test(text);
  return { date, hasSpecificTime: false, hasVagueTime, startAt: undefined, endAt: undefined };
}

function inferNearestTimePeriod(text: string, atIndex: number) {
  const before = text.slice(0, atIndex);
  const matches = Array.from(before.matchAll(/凌晨|早上|上午|中午|下午|晚上|今晚/g));
  return matches.at(-1)?.[0] ?? '';
}

function guardParsedExplicitTime(text: string, result: ParseResult, now: string): ParseResult {
  if (result.intent !== 'add_event' && result.intent !== 'update_event') return result;
  if (!hasExplicitTimeText(text)) return result;
  const timeInfo = inferTimeInfo(text, now);
  if (!timeInfo.hasSpecificTime || !timeInfo.startAt) return result;
  const fields = {
    ...result.fields,
    date: timeInfo.date,
    startAt: timeInfo.startAt,
    endAt: timeInfo.endAt
  };
  return {
    ...result,
    fields,
    preview: {
      ...result.preview,
      date: fields.date,
      startAt: fields.startAt,
      endAt: fields.endAt
    }
  };
}

function guardParsedTime(text: string, result: ParseResult): ParseResult {
  if (result.intent !== 'add_event') return result;
  if (!hasVagueTimeText(text) || hasExplicitTimeText(text)) return result;

  const fields = { ...result.fields };
  delete fields.startAt;
  delete fields.endAt;

  return {
    ...result,
    confidence: Math.min(result.confidence, 0.68),
    needsConfirmation: true,
    fields,
    questions: result.questions.length ? result.questions : ['这个安排还差具体时间，要先补一个几点，还是先记成待定？'],
    warnings: Array.from(new Set([...result.warnings, '时间不明确'])),
    preview: {
      ...result.preview,
      startAt: undefined,
      endAt: undefined,
      needsTimeConfirmation: true
    }
  };
}

function guardParsedRequiredDetails(text: string, result: ParseResult): ParseResult {
  if (result.intent !== 'add_event') return result;

  const fields = { ...result.fields };
  const hasConcreteStart = typeof fields.startAt === 'string';
  const needsTime = hasVagueTimeText(text) && !hasExplicitTimeText(text);
  const needsContent = hasConcreteStart && !hasUsableScheduleContent(text);
  if (!needsTime && !needsContent) return result;

  if (needsTime) {
    delete fields.startAt;
    delete fields.endAt;
  }

  const question = needsTime
    ? '这个安排还差具体时间。可以补一个几点，也可以先放进待补充事项。'
    : '这个时间还差具体要做什么。可以补充内容，也可以先放进待补充事项。';
  const warning = needsTime ? '时间不明确' : '内容不明确';

  return {
    ...result,
    confidence: Math.min(result.confidence, 0.68),
    needsConfirmation: true,
    fields,
    questions: result.questions.length ? result.questions : [question],
    warnings: Array.from(new Set([...result.warnings, warning])),
    preview: {
      ...result.preview,
      startAt: needsTime ? undefined : result.preview.startAt,
      endAt: needsTime ? undefined : result.preview.endAt,
      needsTimeConfirmation: needsTime || undefined,
      needsContentConfirmation: needsContent || undefined,
      options: mergePreviewOptions(result.preview.options, [{ id: 'save-pending', title: '先放进待补充' }])
    }
  };
}

function guardClarificationCompletion(text: string, result: ParseResult, now: string): ParseResult {
  if (result.intent !== 'add_event') return result;
  if (!text.includes('补充信息：')) return result;

  const [previousText, supplementText = ''] = text.split('补充信息：');
  if (!hasUsableScheduleContent(previousText) || !hasExplicitTimeText(supplementText)) return result;

  const timeInfo = inferTimeInfo(text, now);
  if (!timeInfo.hasSpecificTime || !timeInfo.startAt) return result;

  const fields = {
    ...result.fields,
    title: typeof result.fields.title === 'string' && result.fields.title !== '待补充安排'
      ? result.fields.title
      : cleanupEventTitle(previousText),
    type: result.fields.type ?? inferEventType(previousText),
    date: timeInfo.date,
    startAt: timeInfo.startAt,
    endAt: timeInfo.endAt,
    purpose: result.fields.purpose ?? inferPurpose(text),
    preparations: result.fields.preparations ?? inferPreparations(text),
    notes: result.fields.notes ?? inferNotes(text, inferPurpose(text), inferPreparations(text)),
    estimatedMinutes: result.fields.estimatedMinutes ?? inferEstimatedMinutes(text)
  };

  return {
    ...result,
    confidence: Math.max(result.confidence, 0.84),
    needsConfirmation: false,
    fields,
    questions: [],
    warnings: result.warnings.filter((warning) => warning !== '内容不明确'),
    preview: {
      ...result.preview,
      title: fields.title,
      type: fields.type,
      date: fields.date,
      startAt: fields.startAt,
      endAt: fields.endAt,
      needsContentConfirmation: undefined
    }
  };
}

function guardParsedDate(text: string, result: ParseResult, now: string): ParseResult {
  if (result.intent !== 'add_event' && result.intent !== 'add_task' && result.intent !== 'add_reminder' && result.intent !== 'update_event') return result;
  if (!/(今天|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天])/.test(text)) return result;
  const date = inferDate(text, now);
  const fields = { ...result.fields };
  if (result.intent === 'add_task') {
    const dueAt = inferDueAt(text, now);
    if (dueAt) fields.dueAt = dueAt;
  } else {
    fields.date = date;
    if (typeof fields.startAt === 'string') fields.startAt = replaceIsoDate(fields.startAt, date);
    if (typeof fields.endAt === 'string') fields.endAt = replaceIsoDate(fields.endAt, date);
    if (typeof fields.remindAt === 'string') fields.remindAt = replaceIsoDate(fields.remindAt, date);
  }
  return {
    ...result,
    fields,
    preview: {
      ...result.preview,
      date: fields.date,
      dueAt: fields.dueAt,
      startAt: fields.startAt,
      endAt: fields.endAt,
      remindAt: fields.remindAt
    }
  };
}

function replaceIsoDate(value: string, date: string) {
  return value.replace(/^\d{4}-\d{2}-\d{2}/, date);
}

function mergePreviewOptions(existing: unknown, additions: Array<{ id: string; title: string }>) {
  const options = Array.isArray(existing)
    ? existing.filter((option): option is { id: string; title: string } =>
        Boolean(option) &&
        typeof option === 'object' &&
        typeof (option as { id?: unknown }).id === 'string' &&
        typeof (option as { title?: unknown }).title === 'string'
      )
    : [];
  const ids = new Set(options.map((option) => option.id));
  for (const option of additions) {
    if (!ids.has(option.id)) options.push(option);
  }
  return options;
}

function hasVagueTimeText(text: string) {
  return /(凌晨|早上|上午|中午|下午|傍晚|晚上|今晚|白天)/.test(text);
}

function hasExplicitTimeText(text: string) {
  return /(\d{1,2})[:：](\d{2})|(\d{1,2}|[一二两三四五六七八九十]+)\s*点(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?|(\d{1,2}|[一二两三四五六七八九十]+)\s*(?:到|至|[-~～])\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点/.test(text);
}

function hasExplicitMeetingTimeText(text: string) {
  return /(开会|会议|会|面试)/.test(text) && hasExplicitTimeText(text);
}

function isEventOperationText(text: string) {
  return isEventDeleteText(text) || isEventUpdateText(text) || isEventAnnotateText(text);
}

function isEventDeleteText(text: string) {
  return /(删掉|删除|取消|撤掉|去掉|不要了|不用了)/.test(text) && isEventReferenceText(text);
}

function isEventUpdateText(text: string) {
  return /(修改|改到|改成|改为|重新安排|不是|换到|挪到|提前|推迟)/.test(text) && isEventReferenceText(text);
}

function isEventAnnotateText(text: string) {
  return /(备注|补充|带上|带|准备|加上|说明)/.test(text) && isEventReferenceText(text);
}

function isEventReferenceText(text: string) {
  return /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text);
}

function inferDate(text: string, now: string) {
  const date = new Date(now);
  if (text.includes('明天')) date.setDate(date.getDate() + 1);
  if (text.includes('后天')) date.setDate(date.getDate() + 2);

  const weekdayMatch = text.match(/(?:周|星期)([一二三四五六日天])/);
  if (weekdayMatch) {
    const target = '一二三四五六日天'.indexOf(weekdayMatch[1]);
    const targetDay = target >= 6 ? 0 : target + 1;
    if (text.includes('下周')) {
      const base = getWeekStart(new Date(now));
      base.setDate(base.getDate() + 7 + (targetDay === 0 ? 6 : targetDay - 1));
      return toLocalDateText(base);
    } else {
      const currentDay = date.getDay();
      const diff = (targetDay - currentDay + 7) % 7 || 7;
      date.setDate(date.getDate() + diff);
    }
  }

  return toLocalDateText(date);
}

function atLocalTime(dateText: string, hour: number, minute: number) {
  const date = new Date(`${dateText}T00:00:00`);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function normalizeHour(hour: number, period: string) {
  if ((period === '下午' || period === '晚上' || period === '今晚') && hour < 12) return hour + 12;
  if (period === '中午' && hour < 11) return hour + 12;
  return hour;
}

function inferEventType(text: string): EventRecord['type'] {
  if (/(开会|会议|沟通会|项目会|周会|复盘会|面试|电话|约了|见面)/.test(text)) return 'meeting';
  if (/(训练|运动|健身)/.test(text)) return 'exercise';
  if (/(吃饭|午饭|晚饭|早餐)/.test(text)) return 'meal';
  if (/(休息|睡|午休)/.test(text)) return 'rest';
  if (/(风险|延期|来不及|赶不完)/.test(text)) return 'risk';
  if (/(家务|洗衣|晾衣|取快递|买菜)/.test(text)) return 'life';
  if (/(写|做|整理|完成|时间块)/.test(text)) return 'task_block';
  return 'other';
}

function isScheduleLikeText(text: string) {
  return /(开会|会议|沟通会|项目会|周会|复盘会|面试|电话|约了|见面|训练|运动|吃饭|午饭|晚饭|休息|时间块|有个|有一场|有一个)/.test(text);
}

function hasUsableScheduleContent(text: string) {
  const contentSignals = /(开会|会议|沟通会|项目会|周会|复盘会|面试|电话|约了|见面|上课|课程|听课|讲座|课堂|训练|运动|健身|吃饭|午饭|晚饭|早餐|休息|睡|午休|写|做|整理|完成|讨论|确认)/;
  if (contentSignals.test(text)) return true;
  const stripped = text
    .replace(/今天|今晚|明天|后天|这周|本周|下周|周[一二三四五六日天]|星期[一二三四五六日天]/g, '')
    .replace(/凌晨|早上|上午|中午|下午|傍晚|晚上|白天/g, '')
    .replace(/\d{1,2}[:：]\d{2}\s*[-到至~～]?\s*\d{0,2}[:：]?\d{0,2}/g, '')
    .replace(/(\d{1,2}|[一二两三四五六七八九十])\s*点(半|\d{1,2}分?)?/g, '')
    .replace(/(开始|结束|左右|之前|之后|有个|有一个|有一场|安排|提醒|记得|我要|需要)/g, '')
    .replace(/[，。；;、\s]/g, '');
  return stripped.length >= 2;
}

function inferReasonType(text: string): ReviewRecord['reasonType'] {
  if (/(低估|比我想的|耗时)/.test(text)) return 'underestimated_time';
  if (/(打断|临时|插进来)/.test(text)) return 'interrupted';
  if (/(累|困|状态不好|没精神)/.test(text)) return 'low_energy';
  if (/(休息|吃饭|生活安排)/.test(text)) return 'planned_rest';
  if (/(拖延|摸鱼)/.test(text)) return 'procrastination';
  if (/(范围|需求|变复杂)/.test(text)) return 'scope_changed';
  return 'other';
}

function getRemainingAvailableMinutes(events: EventRecord[]) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  const scheduledMinutes = events
    .filter((event) => event.status === 'scheduled' && event.date === today && event.startAt && event.endAt)
    .map((event) => {
      const start = Math.max(new Date(event.startAt!).getTime(), now.getTime());
      const end = Math.min(new Date(event.endAt!).getTime(), endOfDay.getTime());
      return Math.max(0, Math.round((end - start) / 60_000));
    })
    .reduce((sum, minutes) => sum + minutes, 0);
  const rawRemaining = Math.max(0, Math.round((endOfDay.getTime() - now.getTime()) / 60_000));
  return Math.max(0, rawRemaining - scheduledMinutes);
}

function moveIsoToTomorrow(value: unknown, now: string) {
  const date = typeof value === 'string' ? new Date(value) : new Date(now);
  date.setDate(date.getDate() + 1);
  if (date.getHours() === 0 && date.getMinutes() === 0) {
    date.setHours(23, 59, 0, 0);
  }
  return date.toISOString();
}

function buildFeedback(result: ParseResult, resolvedBy?: string) {
  if (resolvedBy === 'save-pending') return '小猫已记录：这条先放进待补充事项，原话和日期都保留。';
  if (resolvedBy === 'keep-both') return '小猫已记录：已重叠新增，会在一周安排里并列显示。';
  if (resolvedBy === 'task-split') return '小猫已记录：这个任务先标成待拆分，今天不用硬塞满。';
  if (resolvedBy === 'defer-tomorrow') return '小猫已记录：任务改到明天了，今天先留一点呼吸空间。';
  if (resolvedBy === 'duplicate-add') return '小猫已记录：我把这条作为新的任务放进来了。';
  if (resolvedBy === 'skip-duplicate') return '好，先保留已有任务，不重复记录。';
  if (result.needsConfirmation && result.questions[0]) return result.questions[0];

  const messages: Record<string, string> = {
    add_event: '小猫已记录：安排放进一周安排了，右侧可以看完整详情。',
    add_task: '小猫已记录：任务先放好，准备事项和备注也一起收下了。',
    start_work: '开工记录好了，我会陪你把这段执行脚印留下来。',
    pause_work: '暂停记下来了，先缓一口气也算照顾计划。',
    resume_work: '继续记录好了，节奏接回来了。',
    finish_work: '完成记录好了，今天又往前推了一点。',
    progress_update: '进度记下来了，后面调整安排会用上。',
    add_reminder: '小猫已记录：提醒设好了，到点会在这里冒出来。',
    review_note: '复盘原因收好了，下次计划会更贴近现实。'
  };
  return messages[result.intent] ?? '小猫已记录。';
}

async function prepareTextForParsing(text: string, source: SourceType): Promise<{
  text: string;
  transcription?: NonNullable<ParseResult['transcription']>;
}> {
  const originalText = text.trim();
  if (!originalText || source !== 'voice') return { text: originalText };

  const ruleCorrected = correctTranscriptionByRules(originalText);
  const aiCorrected = await correctTranscribedTextWithAi(ruleCorrected);
  const correctedText = normalizeCorrectedTranscript(aiCorrected ?? ruleCorrected);

  if (!correctedText || correctedText === originalText) return { text: originalText };
  return {
    text: correctedText,
    transcription: {
      originalText,
      correctedText,
      provider: aiCorrected && aiCorrected !== ruleCorrected ? 'deepseek' : 'rules'
    }
  };
}

function correctTranscriptionByRules(text: string) {
  return text
    .replace(/项目代办/g, '项目待办')
    .replace(/代办/g, '待办')
    .replace(/行政(一个|个|一条)?(代码|待办|任务)/g, '新增$1待办')
    .replace(/新增(一个|个|一条)?代码/g, '新增$1待办')
    .replace(/新曾/g, '新增')
    .replace(/待半/g, '待办')
    .replace(/带办/g, '待办')
    .replace(/备住/g, '备注')
    .replace(/被注/g, '备注')
    .replace(/街止/g, '截止')
    .replace(/截至/g, '截止')
    .replace(/dead line/gi, 'deadline')
    .replace(/迪德莱恩|滴滴爱了|滴滴爱恩/g, 'deadline')
    .replace(/日成/g, '日程')
    .replace(/开为/g, '开会')
    .replace(/会义/g, '会议')
    .replace(/项木/g, '项目')
    .replace(/分内/g, '分钟')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCorrectedTranscript(text: string) {
  return text
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/[。；;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferLesson(text: string) {
  const lessonMatch = text.match(/(?:以后|下次)(.+)$/);
  return lessonMatch?.[1]?.trim() ?? '';
}

function normalizeSource(source: string): SourceType {
  return ['text', 'voice', 'manual', 'system'].includes(source) ? (source as SourceType) : 'text';
}

function withPreview(result: Omit<ParseResult, 'preview'> & { preview?: Record<string, unknown> }): ParseResult {
  return {
    ...result,
    preview: {
      intent: result.intent,
      ...result.fields
    }
  };
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(startB).getTime() < new Date(endA).getTime();
}
