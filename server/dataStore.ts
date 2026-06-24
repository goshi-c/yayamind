import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { correctTranscribedTextWithAi, parseTextWithAi } from './aiAdapter.js';
import { getRequestUserId } from './requestContext.js';
import type {
  AppSettings,
  BatchOperationPreview,
  CandidateItem,
  ConversationContext,
  EventRecord,
  GoalRecord,
  ParseResult,
  PlanDraft,
  PlanDraftItem,
  ProfileData,
  RecurringRuleRecord,
  ReminderRecord,
  ReviewRecord,
  SourceType,
  TaskRecord,
  TodoProjectRecord,
  WorkLogRecord
} from './types.js';

const dataDir = process.env.YAYAMIND_DATA_DIR || join(process.cwd(), 'personal-assistant-data');
const useSupabaseStorage = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const requireCloudStorage = process.env.VERCEL === '1' && !useSupabaseStorage;
const supabaseTable = process.env.SUPABASE_YAYAMIND_TABLE || 'yayamind_store';

const files = {
  events: join(dataDir, 'events.jsonl'),
  tasks: join(dataDir, 'tasks.jsonl'),
  workLogs: join(dataDir, 'work_logs.jsonl'),
  reviews: join(dataDir, 'reviews.jsonl'),
  reminders: join(dataDir, 'reminders.jsonl'),
  planDrafts: join(dataDir, 'plan_drafts.json'),
  conversation: join(dataDir, 'conversation_context.json'),
  recurringRules: join(dataDir, 'recurring_rules.json'),
  goals: join(dataDir, 'goals.json'),
  todoProjects: join(dataDir, 'todo_projects.json'),
  profiles: join(dataDir, 'profiles.json'),
  summariesDir: join(dataDir, 'summaries'),
  settings: join(dataDir, 'settings.json')
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
  await ensureFile(files.planDrafts, JSON.stringify({ drafts: [] }, null, 2));
  await ensureFile(files.conversation, JSON.stringify(createDefaultConversationContext(), null, 2));
  await ensureFile(files.recurringRules, JSON.stringify({ rules: [] }, null, 2));
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
  const [events, workLogs, storedReminders, goals, profile, settings, planDrafts, conversation, recurringRules] = await Promise.all([
    readJsonl<EventRecord>(files.events),
    readJsonl<WorkLogRecord>(files.workLogs),
    readJsonl<ReminderRecord>(files.reminders),
    readGoals(),
    readProfile(),
    readSettings(),
    readPlanDrafts(),
    readConversationContext(),
    readRecurringRules()
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
      ],
      timeline: todayTimeline.sort((a, b) => a.time.localeCompare(b.time)),
      reminders: reminders
        .filter((reminder) => ['pending', 'triggered', 'missed'].includes(reminder.status))
        .map((reminder) => ({
          id: reminder.id,
          title: reminder.title,
          remindAt: reminder.remindAt,
          status: reminder.status,
          updatedAt: reminder.updatedAt,
          relatedType: reminder.relatedType,
          relatedId: reminder.relatedId
        })),
      weatherAlerts: weatherAlerts.filter((alert) => alert.date === today)
    },
    calendar: buildCalendar(events, [], [], reminders, workLogs, weatherAlerts, planDrafts, recurringRules),
    todoProjects: [],
    tasks: [],
    goals,
    profile: buildProfileSnapshot(profile, workLogs, []),
    planDrafts: planDrafts.filter((draft) => draft.status === 'draft'),
    conversation,
    titleLexicon: buildTitleLexicon(events, [], reminders, []),
    recurringRules: recurringRules.filter((rule) => rule.status === 'active'),
    settings
  };
}

export async function updateSettings(patch: Partial<AppSettings>) {
  await ensureDataFiles();
  const current = await readSettings();
  const next = normalizeSettings({
    ...current,
    ...patch,
    notification: { ...current.notification, ...(patch.notification ?? {}) },
    ui: { ...current.ui, ...(patch.ui ?? {}) },
    habits: { ...current.habits, ...(patch.habits ?? {}) },
    weather: { ...current.weather, ...(patch.weather ?? {}) },
    ai: { ...current.ai, ...(patch.ai ?? {}) }
  });
  await writeTextFile(files.settings, JSON.stringify(next, null, 2));
  return { ok: true, settings: next };
}

export async function createManualEvent(body: {
  title?: string;
  date?: string;
  startAt?: string;
  endAt?: string;
  type?: EventRecord['type'];
  purpose?: string;
  preparations?: string[];
  notes?: string;
}) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const date = normalizeDateText(body.date) ?? toLocalDateText(new Date());
  const startAt = normalizeEventDateTime(date, body.startAt, '09:00');
  const endAt = normalizeEventDateTime(date, body.endAt, addMinutesToTimeText(startAt.slice(11, 16), 60));
  const event: EventRecord = {
    id: createId('event'),
    type: body.type ?? 'other',
    title: body.title?.trim() || '新日程',
    date,
    startAt,
    endAt,
    purpose: body.purpose?.trim() || undefined,
    preparations: Array.isArray(body.preparations) ? body.preparations.map((item) => item.trim()).filter(Boolean) : [],
    notes: body.notes?.trim() || undefined,
    reminderIds: [],
    status: 'scheduled',
    linkedTaskId: null,
    tags: [],
    source: 'manual',
    rawText: body.title?.trim() || '手动新增日程',
    createdAt: now,
    updatedAt: now
  };
  await appendJsonl(files.events, event);
  return { ok: true, event };
}

export async function commitTextInput(text: string, source = 'text', resolution: { selectedOptionId?: string | null } = {}) {
  await ensureDataFiles();
  const now = new Date().toISOString();
  const sourceType = normalizeSource(source);

  if (resolution.selectedOptionId?.startsWith('confirm-draft:')) {
    return confirmPlanDraft(resolution.selectedOptionId.slice('confirm-draft:'.length), sourceType, now);
  }

  if (resolution.selectedOptionId?.startsWith('cancel-draft:')) {
    return cancelPlanDraft(resolution.selectedOptionId.slice('cancel-draft:'.length), now);
  }

  if (resolution.selectedOptionId?.startsWith('hold-draft:')) {
    return holdPlanDraft(resolution.selectedOptionId.slice('hold-draft:'.length), now);
  }

  if (resolution.selectedOptionId?.startsWith('modify-draft:')) {
    return startPlanDraftModification(resolution.selectedOptionId.slice('modify-draft:'.length), now);
  }

  if (resolution.selectedOptionId?.startsWith('execute-batch:')) {
    return executeBatchOperation(resolution.selectedOptionId.slice('execute-batch:'.length), now);
  }

  if (resolution.selectedOptionId?.startsWith('delete-candidate:')) {
    return deleteCandidateById(resolution.selectedOptionId.slice('delete-candidate:'.length), now);
  }

  if (resolution.selectedOptionId?.startsWith('update-candidate:')) {
    return updateCandidateFromText(resolution.selectedOptionId.slice('update-candidate:'.length), text, now);
  }

  const parsed = await parseAndEnrichTextInput(text, now, sourceType);
  const effectiveText = parsed.rawText || text;

  if (parsed.intent === 'plan_draft' || parsed.intent === 'batch_operation' || parsed.intent === 'habit_rule') {
    return { ok: false, needsConfirmation: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [] };
  }

  if (parsed.intent === 'profile_update') {
    const result = await commitProfileUpdate(parsed, now);
    return { ...result, parseResult: parsed, feedback: buildFeedback(parsed), written: result.written };
  }

  if ((parsed.intent === 'delete_event' || parsed.intent === 'update_event') && parsed.candidates?.length) {
    return { ok: false, needsConfirmation: true, parseResult: parsed, feedback: buildFeedback(parsed), written: [] };
  }

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

  if (isEventAnnotateText(rawText) && !isExplicitNewEventText(rawText)) {
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
    return withPreview({
      ...base,
      intent: 'add_event',
      confidence: 0.76,
      needsConfirmation: !timeInfo.startAt,
      fields: {
        title: cleanupTaskTitle(rawText),
        type: inferEventType(rawText),
        date: timeInfo.date,
        startAt: timeInfo.startAt,
        endAt: timeInfo.endAt,
        purpose,
        estimatedMinutes,
        preparations,
        notes: inferTodoNote(rawText) ?? notes
      },
      questions: timeInfo.startAt ? [] : ['1.1 先只保留日程安排。这个安排要放到几点？'],
      warnings: timeInfo.startAt ? [] : ['时间不明确'],
      preview: timeInfo.startAt ? {} : { options: [{ id: 'save-pending', title: '先放待补充' }] }
    });
  }

  if (isLifeTodoReminderText(rawText)) {
    return withPreview({
      ...base,
      intent: 'add_event',
      confidence: 0.74,
      needsConfirmation: !timeInfo.startAt,
      fields: {
        title: cleanupTaskTitle(rawText),
        type: inferEventType(rawText),
        date: timeInfo.date,
        startAt: timeInfo.startAt,
        endAt: timeInfo.endAt,
        purpose,
        estimatedMinutes,
        preparations,
        notes: inferTodoNote(rawText) ?? notes
      },
      questions: timeInfo.startAt ? [] : ['这个生活安排要放到几点？'],
      warnings: timeInfo.startAt ? [] : ['时间不明确'],
      preview: timeInfo.startAt ? {} : { options: [{ id: 'save-pending', title: '先放待补充' }] }
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
    intent: 'add_event',
    confidence: 0.72,
    needsConfirmation: true,
    fields: {
      title: cleanupEventTitle(rawText),
      type: inferEventType(rawText),
      date: timeInfo.date,
      startAt: timeInfo.startAt,
      endAt: timeInfo.endAt,
      purpose,
      estimatedMinutes,
      preparations,
      notes
    },
    questions: ['这个安排要放到几点？'],
    warnings: ['时间不明确'],
    preview: { options: [{ id: 'save-pending', title: '先放待补充' }] }
  });
}

export async function parseAndEnrichTextInput(text: string, now = new Date().toISOString(), source: SourceType | string = 'text') {
  const prepared = await prepareTextForParsing(text, normalizeSource(source));
  const effectiveText = prepared.text;
  const originalText = text.trim();
  const hasSupplementText = originalText.includes('补充信息：') || effectiveText.includes('补充信息：');
  const routeText = [effectiveText, originalText].find((candidate) =>
    (!hasSupplementText && isComplexPlanText(candidate)) ||
    (!hasSupplementText && isBatchOperationText(candidate)) ||
    (!hasSupplementText && isHabitRuleText(candidate)) ||
    isProfileUpdateText(candidate) ||
    isCancelCurrentText(candidate)
  );
  const oneDotZeroText =
    routeText ?? originalText;
  const attach = (result: ParseResult): ParseResult => prepared.transcription ? { ...result, transcription: prepared.transcription } : result;

  if (isCancelCurrentText(oneDotZeroText)) {
    const context = await readConversationContext();
    await writeConversationContext({ ...context, state: 'completed', pendingAction: undefined, pendingCandidates: undefined, updatedAt: now });
    return attach(withPreview({
      intent: 'profile_update',
      confidence: 0.78,
      needsConfirmation: false,
      rawText: oneDotZeroText,
      fields: { cancelled: true },
      questions: [],
      warnings: [],
      preview: { title: '取消当前追问', detail: '原数据不会变化。' },
      conversationState: 'completed'
    }));
  }

  const currentContext = await readConversationContext();
  if (
    currentContext.activeDraftId &&
    (currentContext.pendingAction?.type === 'confirm_draft' || currentContext.pendingAction?.type === 'habit_rule') &&
    text.includes('补充信息：')
  ) {
    const supplementText = extractSupplementText(text);
    const draft = await modifyPlanDraft(currentContext.activeDraftId, supplementText || oneDotZeroText, now);
    const draftQuestion = buildPlanDraftQuestion(draft);
    const options = buildPlanDraftOptions(draft, Boolean(draftQuestion));
    return attach(withPreview({
      intent: 'plan_draft',
      confidence: 0.84,
      needsConfirmation: true,
      rawText: draft.sourceText,
      fields: { title: '整组草稿', draftId: draft.id, itemCount: draft.items.length },
      questions: [draftQuestion ?? '已按你的补充改好，可以确认了。'],
      warnings: draft.warnings,
      preview: {
        title: '整组草稿',
        draft,
        options
      },
      conversationState: 'awaiting_confirmation',
      draft,
      pendingAction: { id: createId('action'), type: 'confirm_draft', targetId: draft.id, targetKind: 'event' }
    }));
  }

  if (currentContext.state === 'awaiting_clarification' && currentContext.activeDraftId && currentContext.pendingAction?.type === 'modify_draft') {
    const draft = await modifyPlanDraft(currentContext.activeDraftId, oneDotZeroText, now);
    const draftQuestion = buildPlanDraftQuestion(draft);
    const options = buildPlanDraftOptions(draft, Boolean(draftQuestion));
    return attach(withPreview({
      intent: 'plan_draft',
      confidence: 0.82,
      needsConfirmation: true,
      rawText: draft.sourceText,
      fields: { title: '整组草稿', draftId: draft.id, itemCount: draft.items.length },
      questions: [draftQuestion ?? '已按你的补充改好。'],
      warnings: draft.warnings,
      preview: {
        title: '整组草稿',
        draft,
        options
      },
      conversationState: 'awaiting_confirmation',
      draft,
      pendingAction: { id: createId('action'), type: 'confirm_draft', targetId: draft.id, targetKind: 'event' }
    }));
  }

  if (isProfileUpdateText(oneDotZeroText)) {
    return attach(withPreview({
      intent: 'profile_update',
      confidence: 0.86,
      needsConfirmation: false,
      rawText: oneDotZeroText,
      fields: inferProfilePatch(oneDotZeroText),
      questions: [],
      warnings: [],
      preview: { title: '画像 / 作息修改', detail: oneDotZeroText },
      conversationState: 'executing'
    }));
  }

  if (!hasSupplementText && isComplexPlanText(oneDotZeroText)) {
    const draft = await createOrReplacePlanDraft(oneDotZeroText, now);
    const draftQuestion = buildPlanDraftQuestion(draft);
    const options = buildPlanDraftOptions(draft, Boolean(draftQuestion));
    return attach(withPreview({
      intent: 'plan_draft',
      confidence: 0.86,
      needsConfirmation: true,
      rawText: oneDotZeroText,
      fields: { title: '整组草稿', draftId: draft.id, itemCount: draft.items.length },
      questions: [draftQuestion ?? '这些安排可以确认了。'],
      warnings: draft.warnings,
      preview: {
        title: '整组草稿',
        draft,
        options
      },
      conversationState: 'awaiting_confirmation',
      draft,
      pendingAction: { id: createId('action'), type: 'confirm_draft', targetId: draft.id, targetKind: 'event' }
    }));
  }

  if (!hasSupplementText && isBatchOperationText(oneDotZeroText)) {
    const batchOperation = await buildBatchOperationPreview(oneDotZeroText, now);
    return attach(withPreview({
      intent: 'batch_operation',
      confidence: 0.84,
      needsConfirmation: true,
      rawText: oneDotZeroText,
      fields: { title: '批量操作', batchId: batchOperation.id, action: batchOperation.action },
      questions: ['我列出了会受影响的内容，确认后再逐条执行。'],
      warnings: batchOperation.warnings,
      preview: {
        title: '批量候选清单',
        batchOperation,
        options: batchOperation.candidates.length ? [{ id: `execute-batch:${batchOperation.id}`, title: '确认执行' }] : []
      },
      conversationState: batchOperation.candidates.length ? 'awaiting_confirmation' : 'awaiting_clarification',
      candidates: batchOperation.candidates,
      batchOperation,
      pendingAction: { id: batchOperation.id, type: 'batch_operation' }
    }));
  }

  if (!hasSupplementText && isHabitRuleText(oneDotZeroText)) {
    const draft = await createOrReplacePlanDraft(oneDotZeroText, now, { habitOnly: true });
    const draftQuestion = buildPlanDraftQuestion(draft);
    const options = draftQuestion
      ? buildPlanDraftOptions(draft, true)
      : [
          { id: `confirm-draft:${draft.id}`, title: '确认规则' },
          { id: `cancel-draft:${draft.id}`, title: '全部取消' }
        ];
    return attach(withPreview({
      intent: 'habit_rule',
      confidence: 0.82,
      needsConfirmation: true,
      rawText: oneDotZeroText,
      fields: { title: draft.items[0]?.title ?? '周期安排', draftId: draft.id },
      questions: [draftQuestion ?? '这是周期安排，我会先生成规则和近期日程草稿，确认后写入。'],
      warnings: draft.warnings,
      preview: {
        title: '习惯 / 周期草稿',
        draft,
        parser: draft.items.some((item) => item.source === 'profile_inferred') ? 'deepseek' : undefined,
        options
      },
      conversationState: 'awaiting_confirmation',
      draft,
      pendingAction: { id: createId('action'), type: 'habit_rule', targetId: draft.id, targetKind: 'habit_rule' }
    }));
  }

  if (isExplicitTodoText(effectiveText)) {
    return attach(await enrichParseResult(parseTextInput(effectiveText, now)));
  }
  if (isLifeTodoReminderText(effectiveText)) {
    return attach(await enrichParseResult(parseTextInput(effectiveText, now)));
  }
  if (hasExplicitMeetingTimeText(effectiveText) && !isEventOperationText(effectiveText)) {
    return attach(await enrichParseResult(parseTextInput(effectiveText, now)));
  }
  const projects = await readTodoProjects();
  const aiResult = await parseTextWithAi(effectiveText, now, {
    projectTitles: projects.map((project) => project.title)
  });
  const parsedBase = aiResult?.intent === 'annotate_event' && isExplicitNewEventText(effectiveText)
    ? parseTextInput(effectiveText, now)
    : aiResult ?? parseTextInput(effectiveText, now);
  const guarded = guardClarificationCompletion(
    effectiveText,
    guardParsedRequiredDetails(
      effectiveText,
      guardParsedTime(effectiveText, guardParsedExplicitTime(effectiveText, guardParsedDate(effectiveText, parsedBase, now), now))
    ),
    now
  );
  const enriched = await enrichParseResult(guarded);
  if ((enriched.intent === 'delete_event' || enriched.intent === 'update_event') && !enriched.needsConfirmation) {
    return attach(await enrichMutationCandidates(enriched, effectiveText, now));
  }
  return attach(enriched);
}

export async function enrichParseResult(result: ParseResult): Promise<ParseResult> {
  if (result.intent === 'add_task') {
    return convertTaskParseToScheduleOnlyEvent(result);
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

function convertTaskParseToScheduleOnlyEvent(result: ParseResult): ParseResult {
  const dueAt = typeof result.fields.dueAt === 'string' ? result.fields.dueAt : undefined;
  const title = typeof result.fields.title === 'string' ? result.fields.title : cleanupEventTitle(result.rawText);
  return withPreview({
    ...result,
    intent: 'add_event',
    confidence: Math.min(result.confidence, 0.78),
    needsConfirmation: !dueAt,
    fields: {
      ...result.fields,
      title,
      type: inferEventType(`${result.rawText} ${title}`),
      date: dueAt?.slice(0, 10) ?? inferDate(result.rawText, new Date().toISOString()),
      startAt: dueAt,
      endAt: dueAt ? addMinutesToIso(dueAt, typeof result.fields.estimatedMinutes === 'number' ? result.fields.estimatedMinutes : 60) : undefined,
      purpose: summarizePurposeText(typeof result.fields.notes === 'string' ? result.fields.notes : result.rawText),
      dueAt: undefined
    },
    questions: dueAt ? [] : ['1.1 已移除待办，这件事要安排到几点？'],
    warnings: dueAt ? result.warnings : Array.from(new Set([...result.warnings, '时间不明确'])),
    preview: dueAt ? result.preview : { ...result.preview, options: [{ id: 'save-pending', title: '先放待补充' }] }
  });
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
  event.purpose = summarizePurposeText(event.purpose ?? inferPurpose(text) ?? text);
  event.notes = summarizePurposeText(event.notes ?? inferNotes(text, event.purpose, event.preparations) ?? event.purpose);
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
  const project = findTodoProject(inferTodoProjectTitle(text, projects, getParsedProjectTitle(parsed)), projects);
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

function isCancelCurrentText(text: string) {
  return /^(算了|取消|先不要|不用了|撤销)$/.test(text.trim());
}

function isComplexPlanText(text: string) {
  const segments = splitPlanSegments(text);
  const hasMultipleTargets = segments.filter((segment) => /(提醒|待办|任务|面试|健身|项目|吃饭|开会|会议|上课|睡|起)/.test(segment)).length >= 2;
  return hasMultipleTargets && /(，|。|；|;|然后|饭前|饭后|吃饭前|吃完饭|晚上|下午|上午)/.test(text) && !isBatchOperationText(text);
}

function isBatchOperationText(text: string) {
  return /(所有|全部|这一批|一组).*(往后|推迟|提前|删除|删掉|挪到|改到|归到|项目)/.test(text) ||
    /(删除|删掉).*(待办|任务|日程|安排)/.test(text);
}

function isHabitRuleText(text: string) {
  return /(每天|每日|每周|每星期|每晚|每早|以后每|固定).+/.test(text);
}

function isProfileUpdateText(text: string) {
  return /(我最近|我平时|作息|画像|睡|起床|起).*(\d{1,2}|[一二两三四五六七八九十]+)\s*点/.test(text) ||
    /(健身|运动).*(通常|一般|经常|习惯)/.test(text);
}

async function createOrReplacePlanDraft(text: string, now: string, options: { habitOnly?: boolean } = {}) {
  const draft = await buildPlanDraft(text, now, options);
  const drafts = await readPlanDrafts();
  const nextDrafts = [...drafts.filter((item) => item.status !== 'draft'), draft].slice(-20);
  await writePlanDrafts(nextDrafts);
  await writeConversationContext({
    id: createId('conversation'),
    state: 'awaiting_confirmation',
    activeDraftId: draft.id,
    pendingAction: { id: createId('action'), type: options.habitOnly ? 'habit_rule' : 'confirm_draft', targetId: draft.id },
    lastUserText: text,
    createdAt: now,
    updatedAt: now
  });
  return draft;
}

async function buildPlanDraft(text: string, now: string, options: { habitOnly?: boolean } = {}): Promise<PlanDraft> {
  const id = createId('draft');
  const baseDate = inferDate(text, now);
  const items = options.habitOnly ? await buildHabitDraftItems(text, baseDate, now) : await buildPlanDraftItems(text, baseDate, now);
  const warnings = items.length === 0 ? ['没有识别到可执行条目'] : [];
  const riskWarnings = items.map((item) => item.risk).filter((risk): risk is string => Boolean(risk));
  const assumptions = items
    .filter((item) => item.source === 'default_assumption' || item.source === 'profile_inferred')
    .map((item) => `${item.title} 使用了默认或画像推断时间`);
  return {
    id,
    sourceText: text,
    date: baseDate,
    status: 'draft',
    items,
    assumptions,
    warnings: Array.from(new Set([...warnings, ...riskWarnings])),
    createdAt: now,
    updatedAt: now
  };
}

async function buildPlanDraftItems(text: string, baseDate: string, now: string): Promise<PlanDraftItem[]> {
  const [events, reminders] = await Promise.all([
    readJsonl<EventRecord>(files.events),
    readJsonl<ReminderRecord>(files.reminders)
  ]);
  const lexicon = buildTitleLexicon(events, [], reminders, []);
  const segments = splitPlanSegments(text);
  const items: PlanDraftItem[] = [];

  for (const segment of segments) {
    if (!isActionablePlanSegment(segment)) continue;
    const normalizedTitle = normalizeDraftTitle(segment, lexicon);
    if (!normalizedTitle) continue;
    const timeInfo = inferTimeInfo(segment, now);
    const inferred = inferDefaultDraftTime(segment, baseDate);
    const startAt = timeInfo.startAt ?? inferred?.startAt;
    const endAt = timeInfo.endAt ?? inferred?.endAt;
    const needsTimeClarification = !timeInfo.startAt && !inferred && needsDraftTimeClarification(segment);

    if (segment.includes('提醒')) {
      items.push({
        id: createId('draft_item'),
        kind: 'reminder',
        title: cleanupReminderTitle(segment),
        targetDate: baseDate,
        remindAt: timeInfo.startAt ?? inferred?.startAt ?? atLocalTime(baseDate, 9, 0),
        notes: summarizePurposeText(segment),
        source: timeInfo.startAt ? 'user_explicit' : 'default_assumption',
        confidence: timeInfo.startAt ? 0.86 : 0.62,
        risk: timeInfo.startAt ? undefined : '提醒时间不明确'
      });
    } else {
      items.push({
        id: createId('draft_item'),
        kind: 'event',
        title: normalizedTitle,
        targetDate: timeInfo.date ?? baseDate,
        startAt,
        endAt,
        notes: summarizePurposeText(segment),
        source: timeInfo.startAt ? 'user_explicit' : inferred ? 'default_assumption' : 'lexicon_normalized',
        confidence: timeInfo.startAt ? 0.86 : 0.68,
        risk: needsTimeClarification ? '时间不明确，需要补充饭点或开始时间' : undefined
      });
    }
  }

  return items;
}

function hasPlanTimeAnchor(segment: string) {
  return /(吃饭前|饭前|吃完饭后|吃饭后|饭后|上午|下午|晚上|今晚|早上|中午|傍晚)/.test(segment);
}

function needsDraftTimeClarification(segment: string) {
  return hasPlanTimeAnchor(segment) || /(一个小时|半小时|两小时|俩小时|[一二两三四五六七八九十]+个小时|\d+\s*个小时)/.test(segment);
}

function buildPlanDraftQuestion(draft: PlanDraft) {
  const unclearItems = draft.items.filter((item) => item.risk?.includes('时间不明确') || ((item.kind === 'event' || item.kind === 'task' || item.kind === 'habit_rule') && !item.startAt && !item.dueAt));
  if (unclearItems.length === 0) return null;
  return Array.from(new Set(unclearItems.map((item) => buildDirectTimeQuestion(item.title)))).slice(0, 3).join('\n');
}

function buildDirectTimeQuestion(title: string) {
  if (/面试/.test(title)) return '面试什么时间？';
  if (/健身|运动|锻炼/.test(title)) return '健身什么时间？';
  if (/饭|吃/.test(title)) return '吃饭什么时间？';
  return `${title}什么时间？`;
}

function buildPlanDraftOptions(draft: PlanDraft, hasMissingTime: boolean) {
  if (hasMissingTime) {
    return [
      { id: `hold-draft:${draft.id}`, title: '先放待定' },
      { id: `cancel-draft:${draft.id}`, title: '全部取消' }
    ];
  }
  return [
    { id: `confirm-draft:${draft.id}`, title: '确认全部' },
    { id: `cancel-draft:${draft.id}`, title: '全部取消' }
  ];
}

function isActionablePlanSegment(segment: string) {
  const stripped = segment.replace(/^(今天|明天|后天|上午|下午|晚上|今晚|吃饭前|饭前|吃完饭后|吃饭后|饭后|然后)\s*/, '').trim();
  if (!stripped) return false;
  return /(提醒|待办|任务|面试|健身|运动|锻炼|项目|改|写|整理|准备|开会|会议|上课|睡|起|吃饭|问)/.test(stripped);
}

async function buildHabitDraftItems(text: string, baseDate: string, now: string): Promise<PlanDraftItem[]> {
  const aiResult = await parseTextWithAi(text, now);
  const habit = buildHabitSchedule(text, baseDate, aiResult);
  const nextOccurrences = getNextOccurrences(text, baseDate, habit.startAt);
  return [
    {
      id: createId('draft_item'),
      kind: 'habit_rule',
      title: habit.title,
      targetDate: baseDate,
      startAt: nextOccurrences[0],
      endAt: habit.endAt,
      notes: habit.notes,
      source: 'user_explicit',
      confidence: 0.84
    },
    ...nextOccurrences.slice(0, 3).map((occurrence) => ({
      id: createId('draft_item'),
      kind: 'event' as const,
      title: habit.title,
      targetDate: occurrence.slice(0, 10),
      startAt: hasExplicitTimeText(text) ? occurrence : undefined,
      endAt: hasExplicitTimeText(text) ? addMinutesToIso(occurrence, habit.durationMinutes) : undefined,
      notes: habit.notes,
      source: aiResult?.warnings?.includes('ai_used') ? 'profile_inferred' as const : 'system_generated' as const,
      confidence: 0.78,
      risk: hasExplicitTimeText(text) ? undefined : '时间不明确'
    }))
  ];
}

async function confirmPlanDraft(draftId: string, source: SourceType, now: string) {
  const drafts = await readPlanDrafts();
  const draft = drafts.find((item) => item.id === draftId && item.status === 'draft');
  if (!draft) return { ok: false, feedback: '没有找到这组待确认草稿。', written: [] };

  const written: Array<{ file: string; id: string }> = [];
  const recurringRules = await readRecurringRules();
  const confirmsRecurringRule = draft.items.some((item) => item.kind === 'habit_rule');

  for (const item of draft.items) {
    if (confirmsRecurringRule && item.kind !== 'habit_rule') continue;

    if (item.kind === 'event') {
      const event: EventRecord = {
        id: createId('event'),
        type: inferEventType(item.title),
        title: item.title,
        date: item.targetDate ?? draft.date,
        startAt: item.startAt,
        endAt: item.endAt,
        purpose: summarizePurposeText(item.notes ?? item.title),
        preparations: [],
        notes: summarizePurposeText(item.notes ?? item.title),
        reminderIds: [],
        status: 'scheduled',
        linkedTaskId: null,
        tags: item.source === 'profile_inferred' ? ['profile_inferred'] : [],
        source,
        rawText: draft.sourceText,
        createdAt: now,
        updatedAt: now
      };
      await appendJsonl(files.events, event);
      written.push({ file: 'events.jsonl', id: event.id });
    }

    if (item.kind === 'task') {
      const startAt = item.dueAt ?? item.startAt;
      const event: EventRecord = {
        id: createId('event'),
        type: inferEventType(item.title),
        title: item.title,
        date: startAt?.slice(0, 10) ?? item.targetDate ?? draft.date,
        startAt,
        endAt: startAt ? addMinutesToIso(startAt, 60) : undefined,
        purpose: summarizePurposeText(item.notes ?? item.title),
        preparations: [],
        notes: summarizePurposeText(item.notes ?? item.title),
        reminderIds: [],
        status: 'scheduled',
        linkedTaskId: null,
        tags: item.source === 'profile_inferred' ? ['profile_inferred'] : [],
        source,
        rawText: draft.sourceText,
        createdAt: now,
        updatedAt: now
      };
      await appendJsonl(files.events, event);
      written.push({ file: 'events.jsonl', id: event.id });
    }

    if (item.kind === 'reminder') {
      const reminder: ReminderRecord = {
        id: createId('reminder'),
        title: item.title,
        remindAt: item.remindAt ?? atLocalTime(item.targetDate ?? draft.date, 9, 0),
        status: 'pending',
        importance: 'normal',
        linkedTaskId: null,
        relatedType: 'general',
        relatedId: null,
        source,
        rawText: draft.sourceText,
        createdAt: now,
        updatedAt: now
      };
      await appendJsonl(files.reminders, reminder);
      written.push({ file: 'reminders.jsonl', id: reminder.id });
    }

    if (item.kind === 'habit_rule') {
      const habit = buildHabitSchedule(draft.sourceText, draft.date, null);
      const rule: RecurringRuleRecord = {
        id: createId('rule'),
        title: habit.title,
        frequency: /每周|每星期/.test(draft.sourceText) ? 'weekly' : /每天|每日|每晚|每早/.test(draft.sourceText) ? 'daily' : 'custom',
        timeHint: localTimeTextFromIso(habit.startAt),
        targetKind: 'event',
        nextOccurrences: getNextOccurrences(draft.sourceText, draft.date, habit.startAt),
        status: 'active',
        source,
        rawText: draft.sourceText,
        createdAt: now,
        updatedAt: now
      };
      recurringRules.push(rule);
      written.push({ file: 'recurring_rules.json', id: rule.id });
    }
  }

  await writeRecurringRules(recurringRules);
  await writePlanDrafts(drafts.map((item) => (item.id === draftId ? { ...item, status: 'confirmed', updatedAt: now } : item)));
  await writeConversationContext({ id: createId('conversation'), state: 'completed', lastUserText: draft.sourceText, createdAt: now, updatedAt: now });
  return {
    ok: true,
    resolvedBy: 'confirm-draft',
    parseResult: {
      intent: 'plan_draft',
      confidence: 0.9,
      needsConfirmation: false,
      rawText: draft.sourceText,
      fields: { title: '整组草稿', draftId: draft.id, itemCount: draft.items.length },
      questions: [],
      warnings: draft.warnings,
      preview: { draft },
      conversationState: 'completed',
      draft
    } satisfies ParseResult,
    feedback: `已确认 ${written.length} 项，正式写入日程 / 提醒 / 周期规则。`,
    written
  };
}

async function cancelPlanDraft(draftId: string, now: string) {
  const drafts = await readPlanDrafts();
  const draft = drafts.find((item) => item.id === draftId);
  await writePlanDrafts(drafts.map((item) => (item.id === draftId ? { ...item, status: 'cancelled', updatedAt: now } : item)));
  await writeConversationContext({ id: createId('conversation'), state: 'completed', lastUserText: draft?.sourceText, createdAt: now, updatedAt: now });
  return {
    ok: true,
    resolvedBy: 'cancel-draft',
    feedback: '草稿已取消，没有写入正式数据。',
    written: []
  };
}

async function holdPlanDraft(draftId: string, now: string) {
  const drafts = await readPlanDrafts();
  const draft = drafts.find((item) => item.id === draftId);
  if (!draft) return { ok: false, feedback: '没有找到这组待定草稿。', written: [] };
  await writePlanDrafts(drafts.map((item) => (item.id === draftId ? { ...item, status: 'draft', updatedAt: now } : item)));
  await writeConversationContext({ id: createId('conversation'), state: 'completed', lastUserText: draft.sourceText, createdAt: now, updatedAt: now });
  return {
    ok: true,
    resolvedBy: 'hold-draft',
    feedback: '已先放进待定草稿，没有写入正式日程。',
    written: []
  };
}

async function startPlanDraftModification(draftId: string, now: string) {
  const drafts = await readPlanDrafts();
  const draft = drafts.find((item) => item.id === draftId && item.status === 'draft');
  if (!draft) return { ok: false, feedback: '没有找到可修改的草稿。', written: [] };
  await writeConversationContext({
    id: createId('conversation'),
    state: 'awaiting_clarification',
    activeDraftId: draftId,
    pendingAction: { id: createId('action'), type: 'modify_draft', targetId: draftId },
    lastUserText: draft.sourceText,
    createdAt: now,
    updatedAt: now
  });
  return {
    ok: false,
    needsConfirmation: true,
    parseResult: {
      intent: 'plan_draft',
      confidence: 0.78,
      needsConfirmation: true,
      rawText: draft.sourceText,
      fields: { title: '修改草稿', draftId },
      questions: ['直接说要怎么改，比如“把健身改到九点”或“取消提醒”。'],
      warnings: [],
      preview: { draft },
      conversationState: 'awaiting_clarification',
      draft
    } satisfies ParseResult,
    feedback: '直接说要怎么改这个草稿。',
    written: []
  };
}

async function modifyPlanDraft(draftId: string, instruction: string, now: string) {
  const drafts = await readPlanDrafts();
  const draft = drafts.find((item) => item.id === draftId && item.status === 'draft');
  if (!draft) throw new Error('Draft not found');
  const targetIndex = findDraftItemIndex(draft, instruction);
  const hasItemSpecificSupplement = draft.items.some((item) => Boolean(findDraftItemInstruction(item, instruction)));
  const nextItems = draft.items
    .map((item, index) => {
      const itemInstruction = findDraftItemInstruction(item, instruction);
      const shouldApply = itemInstruction || (!hasItemSpecificSupplement && targetIndex === index);
      if (!shouldApply) return item;
      const scopedInstruction = itemInstruction ?? instruction;
      if (/(取消|删掉|删除|不要)/.test(scopedInstruction)) return null;
      const next: PlanDraftItem = { ...item, notes: mergeText(item.notes, scopedInstruction) };
      const timeContext = buildDraftTimeContext(item, scopedInstruction, instruction);
      const timeInfo = inferTimeInfo(timeContext, now);
      if (timeInfo.startAt) {
        if (item.kind === 'event') {
          next.startAt = replaceIsoDate(timeInfo.startAt, item.targetDate ?? draft.date);
          next.endAt = timeInfo.endAt ? replaceIsoDate(timeInfo.endAt, item.targetDate ?? draft.date) : addMinutesToIso(next.startAt, 60);
        } else if (item.kind === 'task' && item.risk?.includes('时间不明确')) {
          next.kind = 'event';
          next.startAt = replaceIsoDate(timeInfo.startAt, item.targetDate ?? draft.date);
          next.endAt = timeInfo.endAt ? replaceIsoDate(timeInfo.endAt, item.targetDate ?? draft.date) : addMinutesToIso(next.startAt, 60);
          next.dueAt = undefined;
        } else if (item.kind === 'task') {
          next.dueAt = replaceIsoDate(timeInfo.startAt, item.targetDate ?? draft.date);
        } else if (item.kind === 'reminder') {
          next.remindAt = replaceIsoDate(timeInfo.startAt, item.targetDate ?? draft.date);
        }
        next.risk = clearDraftTimeRisk(next.risk);
        next.source = 'user_explicit';
        next.confidence = Math.max(next.confidence ?? 0, 0.86);
      }
      const title = extractDraftTitlePatch(scopedInstruction);
      if (title) next.title = title;
      return next;
    })
    .filter((item): item is PlanDraftItem => Boolean(item));
  const nextDraft = { ...draft, items: nextItems, updatedAt: now };
  await writePlanDrafts(drafts.map((item) => (item.id === draftId ? nextDraft : item)));
  await writeConversationContext({
    id: createId('conversation'),
    state: 'awaiting_confirmation',
    activeDraftId: draftId,
    pendingAction: { id: createId('action'), type: 'confirm_draft', targetId: draftId },
    lastUserText: instruction,
    createdAt: draft.createdAt,
    updatedAt: now
  });
  return nextDraft;
}

function findDraftItemIndex(draft: PlanDraft, instruction: string) {
  const index = draft.items.findIndex((item) => instruction.includes(item.title) || item.title.includes(instruction.slice(0, 4)));
  if (index >= 0) return index;
  if (hasExplicitTimeText(instruction)) {
    const missingTimeIndex = draft.items.findIndex((item) =>
      (item.kind === 'event' && (!item.startAt || !item.endAt)) ||
      (item.kind === 'task' && !item.dueAt) ||
      (item.kind === 'reminder' && !item.remindAt) ||
      item.risk?.includes('时间不明确')
    );
    if (missingTimeIndex >= 0) return missingTimeIndex;
  }
  if (/健身|运动|锻炼/.test(instruction)) {
    const match = draft.items.findIndex((item) => /健身|运动|锻炼/.test(item.title));
    if (match >= 0) return match;
  }
  if (/提醒/.test(instruction)) {
    const match = draft.items.findIndex((item) => item.kind === 'reminder');
    if (match >= 0) return match;
  }
  if (/面试/.test(instruction)) {
    const match = draft.items.findIndex((item) => /面试/.test(item.title));
    if (match >= 0) return match;
  }
  return 0;
}

function findDraftItemInstruction(item: PlanDraftItem, instruction: string) {
  const clauses = splitSupplementClauses(instruction);
  const aliases = getDraftItemAliases(item);
  const match = clauses.find((clause) => aliases.some((alias) => alias && clause.includes(alias)));
  if (!match) return null;
  const period = inferNearestPeriodBeforeInstruction(instruction, match);
  if (period && !/(凌晨|早上|上午|中午|下午|晚上|今晚)/.test(match)) return `${period}${match}`;
  return match;
}

function splitSupplementClauses(instruction: string) {
  const supplement = extractSupplementText(instruction)
    .replace(/(然后|再|另外|还有|以及|并且)/g, '，$1')
    .replace(/\s+/g, '');
  return supplement
    .split(/[，。；;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDraftItemAliases(item: PlanDraftItem) {
  const aliases = new Set<string>();
  const title = item.title.trim();
  if (title) aliases.add(title);
  if (/面试/.test(title)) ['面试', '面试准备', '准备面试'].forEach((alias) => aliases.add(alias));
  if (/健身|运动|锻炼/.test(title)) ['健身', '运动', '锻炼'].forEach((alias) => aliases.add(alias));
  if (/项目/.test(title)) ['项目', '改项目', '做项目', '个人助手项目'].forEach((alias) => aliases.add(alias));
  if (/饭|吃/.test(title)) ['吃饭', '午饭', '晚饭', '饭点'].forEach((alias) => aliases.add(alias));
  if (/提醒/.test(title) || item.kind === 'reminder') aliases.add('提醒');
  return Array.from(aliases).sort((a, b) => b.length - a.length);
}

function inferNearestPeriodBeforeInstruction(instruction: string, clause: string) {
  const index = instruction.indexOf(clause);
  if (index <= 0) return '';
  const before = instruction.slice(0, index);
  return Array.from(before.matchAll(/凌晨|早上|上午|中午|下午|晚上|今晚/g)).at(-1)?.[0] ?? '';
}

function buildDraftTimeContext(item: PlanDraftItem, scopedInstruction: string, fullInstruction: string) {
  if (/(凌晨|早上|上午|中午|下午|晚上|今晚)/.test(scopedInstruction)) return scopedInstruction;
  const inheritedPeriod = inferNearestPeriodBeforeInstruction(fullInstruction, scopedInstruction);
  const prefix = inheritedPeriod ? `${inheritedPeriod} ` : '';
  return `${item.notes ?? ''}，${prefix}${scopedInstruction}`;
}

function clearDraftTimeRisk(risk: string | undefined) {
  if (!risk?.includes('时间不明确')) return risk;
  const next = risk
    .replace(/时间不明确，需要补充饭点或开始时间/g, '')
    .replace(/时间不明确/g, '')
    .replace(/[，,；;。]\s*$/g, '')
    .trim();
  return next || undefined;
}

function extractSupplementText(text: string) {
  return text.split('补充信息：').at(-1)?.trim() ?? text.trim();
}

function extractDraftTitlePatch(instruction: string) {
  const match = instruction.match(/(?:标题|改成|改为)([^，。；;]+)/);
  const value = match?.[1]?.trim();
  if (!value || hasExplicitTimeText(value)) return undefined;
  return value.slice(0, 24);
}

async function buildBatchOperationPreview(text: string, now: string): Promise<BatchOperationPreview> {
  const [events, tasks] = await Promise.all([readJsonl<EventRecord>(files.events), readJsonl<TaskRecord>(files.tasks)]);
  const action: BatchOperationPreview['action'] = /(删除|删掉)/.test(text) ? 'delete' : /(项目|归到|归入)/.test(text) ? 'move_project' : 'update_time';
  const targetDate = inferDate(text, now);
  const afternoonOnly = /下午/.test(text);
  const candidates: CandidateItem[] = [];

  for (const event of events) {
    if (event.status !== 'scheduled') continue;
    if (event.date !== targetDate) continue;
    if (afternoonOnly && event.startAt && new Date(event.startAt).getHours() < 12) continue;
    candidates.push({
      id: event.id,
      kind: 'event',
      title: event.title,
      detail: event.startAt ? `${formatTime(event.startAt)} ${event.notes ?? ''}`.trim() : event.notes,
      date: event.date,
      startAt: event.startAt,
      endAt: event.endAt
    });
  }

  if (/(待办|任务)/.test(text)) {
    for (const task of tasks) {
      if (task.status === 'cancelled') continue;
      candidates.push({
        id: task.id,
        kind: 'task',
        title: task.title,
        detail: task.notes ?? task.description,
        dueAt: task.dueAt
      });
    }
  }

  const preview = {
    id: createId('batch'),
    sourceText: text,
    action,
    candidates: candidates.slice(0, 12),
    warnings: candidates.length ? [] : ['没有匹配到候选项']
  };
  await writeConversationContext({
    id: createId('conversation'),
    state: candidates.length ? 'awaiting_confirmation' : 'awaiting_clarification',
    pendingAction: { id: preview.id, type: 'batch_operation' },
    pendingCandidates: preview.candidates,
    lastUserText: text,
    createdAt: now,
    updatedAt: now
  });
  return preview;
}

async function executeBatchOperation(batchId: string, now: string) {
  const context = await readConversationContext();
  if (context.pendingAction?.id !== batchId || !context.pendingCandidates?.length) {
    return { ok: false, feedback: '没有找到待确认的批量候选。', written: [] };
  }
  const text = context.lastUserText ?? '';
  const candidates = context.pendingCandidates;
  const [events, tasks] = await Promise.all([readJsonl<EventRecord>(files.events), readJsonl<TaskRecord>(files.tasks)]);
  const succeeded: CandidateItem[] = [];
  const failed: Array<{ item: CandidateItem; reason: string }> = [];
  const moveMinutes = /提前/.test(text) ? -60 : 60;
  const isDelete = /(删除|删掉)/.test(text);

  const nextEvents = events.map((event) => {
    const candidate = candidates.find((item) => item.kind === 'event' && item.id === event.id);
    if (!candidate) return event;
    if (isDelete) {
      succeeded.push(candidate);
      return { ...event, status: 'cancelled' as const, updatedAt: now };
    }
    if (!event.startAt || !event.endAt) {
      failed.push({ item: candidate, reason: '缺少时间，无法批量移动' });
      return event;
    }
    succeeded.push(candidate);
    return { ...event, startAt: addMinutesToIso(event.startAt, moveMinutes), endAt: addMinutesToIso(event.endAt, moveMinutes), updatedAt: now };
  });

  const nextTasks = tasks.map((task) => {
    const candidate = candidates.find((item) => item.kind === 'task' && item.id === task.id);
    if (!candidate) return task;
    if (isDelete) {
      succeeded.push(candidate);
      return { ...task, status: 'cancelled' as const, updatedAt: now };
    }
    if (!task.dueAt) {
      failed.push({ item: candidate, reason: '没有截止时间，无法移动' });
      return task;
    }
    succeeded.push(candidate);
    return { ...task, dueAt: addMinutesToIso(task.dueAt, moveMinutes), updatedAt: now };
  });

  await Promise.all([writeJsonl(files.events, nextEvents), writeJsonl(files.tasks, nextTasks)]);
  await writeConversationContext({ id: createId('conversation'), state: 'completed', lastUserText: text, createdAt: now, updatedAt: now });
  return {
    ok: true,
    resolvedBy: 'execute-batch',
    feedback: `批量操作完成：成功 ${succeeded.length} 项，失败 ${failed.length} 项。`,
    written: succeeded.map((item) => ({ file: item.kind === 'event' ? 'events.jsonl' : 'tasks.jsonl', id: item.id })),
    batchResult: { ok: failed.length === 0, succeeded, failed }
  };
}

async function enrichMutationCandidates(result: ParseResult, text: string, now: string): Promise<ParseResult> {
  const events = await readJsonl<EventRecord>(files.events);
  const targetDate = inferDate(text, now);
  const candidates = events
    .filter((event) => event.status === 'scheduled')
    .filter((event) => event.date === targetDate || text.includes(event.title) || event.title.includes(String(result.fields.title ?? '')))
    .slice(0, 5)
    .map((event) => ({
      id: event.id,
      kind: 'event' as const,
      title: event.title,
      detail: event.startAt ? `${formatTime(event.startAt)}-${event.endAt ? formatTime(event.endAt) : ''}` : event.notes,
      date: event.date,
      startAt: event.startAt,
      endAt: event.endAt
    }));
  if (!candidates.length) return result;
  const optionPrefix = result.intent === 'delete_event' ? 'delete-candidate' : 'update-candidate';
  return {
    ...result,
    needsConfirmation: true,
    questions: [result.intent === 'delete_event' ? '确认删除哪一条？' : '确认修改哪一条？'],
    candidates,
    pendingAction: { id: createId('action'), type: result.intent === 'delete_event' ? 'delete_item' : 'update_item' },
    preview: {
      ...result.preview,
      candidates,
      options: candidates.map((candidate) => ({ id: `${optionPrefix}:${candidate.id}`, title: candidate.title }))
    },
    conversationState: 'awaiting_selection'
  };
}

async function deleteCandidateById(id: string, now: string) {
  const events = await readJsonl<EventRecord>(files.events);
  const tasks = await readJsonl<TaskRecord>(files.tasks);
  let touched = false;
  const nextEvents = events.map((event) => {
    if (event.id !== id) return event;
    touched = true;
    return { ...event, status: 'cancelled' as const, updatedAt: now };
  });
  const nextTasks = tasks.map((task) => {
    if (task.id !== id) return task;
    touched = true;
    return { ...task, status: 'cancelled' as const, updatedAt: now };
  });
  await Promise.all([writeJsonl(files.events, nextEvents), writeJsonl(files.tasks, nextTasks)]);
  return { ok: touched, resolvedBy: 'delete-candidate', feedback: touched ? '已删除这条内容。' : '没有找到要删除的内容。', written: touched ? [{ file: 'events.jsonl/tasks.jsonl', id }] : [] };
}

async function updateCandidateFromText(id: string, text: string, now: string) {
  const parsed = parseTextInput(text, now);
  const events = await readJsonl<EventRecord>(files.events);
  let touched = false;
  const nextEvents = events.map((event) => {
    if (event.id !== id) return event;
    touched = true;
    const startAt = typeof parsed.fields.startAt === 'string' ? parsed.fields.startAt : event.startAt;
    const endAt = typeof parsed.fields.endAt === 'string' ? parsed.fields.endAt : event.endAt;
    const notes = typeof parsed.fields.notes === 'string' && parsed.fields.notes.trim() ? mergeText(event.notes, parsed.fields.notes) : event.notes;
    return {
      ...event,
      title: typeof parsed.fields.title === 'string' && !/(改到|改成|备注|地点)/.test(text) ? parsed.fields.title : event.title,
      date: typeof parsed.fields.date === 'string' ? parsed.fields.date : event.date,
      startAt,
      endAt,
      notes,
      updatedAt: now
    };
  });
  await writeJsonl(files.events, nextEvents);
  return { ok: touched, resolvedBy: 'update-candidate', feedback: touched ? '日程已修改。' : '没有找到要修改的日程。', written: touched ? [{ file: 'events.jsonl', id }] : [] };
}

async function commitProfileUpdate(parsed: ParseResult, now: string) {
  if (parsed.fields.cancelled) return { ok: true, written: [] };
  const settingsPatch = parsed.fields.settings as Partial<AppSettings> | undefined;
  const profilePatch = parsed.fields.profile as Partial<ProfileData> | undefined;
  const written: Array<{ file: string; id: string }> = [];
  if (settingsPatch) {
    await updateSettings(settingsPatch);
    written.push({ file: 'settings.json', id: 'settings' });
  }
  if (profilePatch) {
    const profile = await readProfile();
    await writeTextFile(files.profiles, JSON.stringify({ ...profile, ...profilePatch, updatedAt: now }, null, 2));
    written.push({ file: 'profiles.json', id: 'profile' });
  }
  return { ok: true, resolvedBy: 'profile-update', written };
}

function splitPlanSegments(text: string) {
  const marked = text
    .replace(/然后/g, '，')
    .replace(/(吃饭前|饭前|吃完饭后|吃饭后|饭后|上午|下午|晚上|今晚|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天])/g, '，$1')
    .replace(/(\d{1,2}[:：]\d{2}|\d{1,2}\s*点(?:半|\d{1,2}分?)?)(?=\s*提醒)/g, '，$1')
    .replace(/(一个小时|半小时|两小时|俩小时|[一二两三四五六七八九十]+个小时|\d+\s*个小时)(?=(吃饭前|饭前|吃完饭后|吃饭后|饭后|上午|下午|晚上|今晚|\d{1,2}[:：]\d{2}|\d{1,2}\s*点|提醒))/g, '$1，');
  return marked
    .split(/[，。；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDraftTitle(segment: string, lexicon: Array<{ canonicalTitle: string; aliases: string[] }>) {
  const cleaned = segment
    .replace(/^(今天|明天|后天|上午|下午|晚上|今晚|饭前|饭后|吃饭前|吃饭后|吃完饭后|然后)/, '')
    .replace(/提醒我?/, '')
    .replace(/^(做|去|改|写|整理|准备一下|准备)/, '')
    .trim();
  const lexiconMatch = lexicon.find((item) => item.aliases.some((alias) => alias && cleaned.includes(alias)));
  if (lexiconMatch) return lexiconMatch.canonicalTitle;
  if (/运动|锻炼|健身/.test(segment)) return '健身';
  if (/面试/.test(segment)) return '面试准备';
  if (/吃饭|午饭|晚饭/.test(segment)) return '吃饭';
  if (/项目/.test(segment)) return '改项目';
  if (/睡/.test(segment)) return '睡觉';
  return cleanupTaskTitle(cleaned).slice(0, 24);
}

function inferDefaultDraftTime(segment: string, date: string): { startAt: string; endAt: string } | null {
  void segment;
  void date;
  return null;
}

function inferDraftProjectId(segment: string, projects: TodoProjectRecord[]) {
  const project = findTodoProject(inferTodoProjectTitle(segment, projects), projects);
  return project?.id ?? null;
}

function buildTitleLexicon(events: EventRecord[], tasks: TaskRecord[], reminders: ReminderRecord[], projects: TodoProjectRecord[]) {
  const counts = new Map<string, number>();
  for (const title of [...events.map((item) => item.title), ...tasks.map((item) => item.title), ...reminders.map((item) => item.title), ...projects.map((item) => item.title)]) {
    const cleaned = title.trim();
    if (!cleaned) continue;
    counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([canonicalTitle, evidenceCount]) => ({
      canonicalTitle,
      aliases: Array.from(new Set([canonicalTitle, ...getTitleAliases(canonicalTitle)])),
      type: 'custom',
      evidenceCount,
      lastSeenAt: new Date().toISOString()
    }));
}

function getTitleAliases(title: string) {
  const aliases: string[] = [];
  if (/健身/.test(title)) aliases.push('运动', '锻炼', '训练');
  if (/睡觉|休息/.test(title)) aliases.push('睡', '睡眠');
  if (/面试/.test(title)) aliases.push('面试准备', '准备面试');
  return aliases;
}

function normalizeHabitTitle(text: string) {
  if (/(健身|运动|锻炼|训练)/.test(text)) return '健身';
  return text
    .replace(/^(以后|固定|我想|我要)?(每天|每日|每周|每星期|每晚|每早)/, '')
    .replace(/^(都)?要/, '')
    .replace(/^\S+下午|^\S+上午|^\S+晚上/, '')
    .trim() || cleanupTaskTitle(text);
}

function buildHabitSchedule(text: string, baseDate: string, aiResult: ParseResult | null): {
  title: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  purpose: string;
  preparations: string[];
  notes: string;
} {
  const aiFields = aiResult?.fields ?? {};
  const durationMinutes = inferEstimatedMinutes(text) ?? 60;
  const endAt = extractHabitEndAt(text, baseDate);
  const explicitStart = typeof aiFields.startAt === 'string' ? replaceIsoDate(aiFields.startAt, baseDate) : undefined;
  const fallbackStart = inferTimeInfo(text, new Date(`${baseDate}T10:00:00+08:00`).toISOString()).startAt;
  const startAt = endAt ? addMinutesToIso(endAt, -durationMinutes) : explicitStart ?? fallbackStart ?? atLocalTime(baseDate, 20, 0);
  const title =
    /(健身|运动|锻炼|训练)/.test(text)
      ? '健身'
      : typeof aiFields.title === 'string' && aiFields.title.trim()
        ? aiFields.title.trim().slice(0, 12)
        : normalizeHabitTitle(text);
  const preparations = extractHabitPreparations(text, aiFields.preparations);
  const spokenPlan = cleanupHabitPurposeText(text);
  const aiPurpose = typeof aiFields.purpose === 'string' ? aiFields.purpose.trim() : '';
  const aiNotes = typeof aiFields.notes === 'string' ? aiFields.notes.trim() : '';
  return {
    title,
    startAt,
    endAt: endAt ?? addMinutesToIso(startAt, durationMinutes),
    durationMinutes,
    purpose: summarizePurposeText(spokenPlan || aiPurpose || text) ?? title,
    preparations,
    notes: preparations.length ? `带上${preparations.join('和')}` : summarizePurposeText(aiNotes) ?? ''
  };
}

function extractHabitEndAt(text: string, baseDate: string) {
  const matches = Array.from(text.matchAll(/(?:到|至)\s*(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?/g));
  const match = matches.at(-1);
  if (!match) return undefined;
  const period = match[1] ?? inferTimePeriodFromText(text) ?? '晚上';
  const hour = normalizeHour(parseChineseNumber(match[2]), period);
  const minute = match[3] === '半' ? 30 : parseChineseNumber(match[4] ?? '0');
  return atLocalTime(baseDate, hour, minute);
}

function inferTimePeriodFromText(text: string) {
  const matches = Array.from(text.matchAll(/凌晨|早上|上午|中午|下午|晚上|今晚/g));
  return matches.at(-1)?.[0];
}

function extractHabitPreparations(text: string, aiPreparations: unknown) {
  const hasExplicitGear = /衣服|衣物|运动服|鞋|鞋子|运动鞋/.test(text);
  const items = hasExplicitGear
    ? []
    : normalizeStringArray(aiPreparations).filter((item) => item.length <= 8 && !/(提前|准备好|下楼|回家|每天)/.test(item));
  if (/衣服|衣物|运动服/.test(text)) items.push('衣服');
  if (/鞋|鞋子|运动鞋/.test(text)) items.push('鞋子');
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, 5);
}

function cleanupHabitPurposeText(text: string) {
  return text
    .replace(/^(以后|以后每天|每天|每日|固定|我想|我要)/, '')
    .replace(/^(凌晨|早上|上午|中午|下午|晚上|今晚)/, '')
    .replace(/\s+/g, '')
    .trim();
}

function getNextOccurrences(text: string, baseDate: string, startAt?: string) {
  const base = new Date(`${baseDate}T00:00:00`);
  const inferredStartAt = inferTimeInfo(text, new Date().toISOString()).startAt;
  const timeText = startAt ? localTimeTextFromIso(startAt) : inferredStartAt ? localTimeTextFromIso(inferredStartAt) : '09:00';
  const [hour, minute] = timeText.split(':').map(Number);
  const dates: string[] = [];
  const weeklyMatch = text.match(/(?:每周|每星期)([一二三四五六日天])/);
  for (let offset = 0; dates.length < 4 && offset < 35; offset += 1) {
    const date = new Date(base);
    date.setDate(base.getDate() + offset);
    if (weeklyMatch) {
      const target = '一二三四五六日天'.indexOf(weeklyMatch[1]);
      const targetDay = target >= 6 ? 0 : target + 1;
      if (date.getDay() !== targetDay) continue;
    } else if (!/(每天|每日|每晚|每早)/.test(text) && offset > 0) {
      continue;
    }
    dates.push(atLocalTime(toLocalDateText(date), hour, minute));
  }
  return dates;
}

function localTimeTextFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function inferProfilePatch(text: string): Record<string, unknown> {
  const sleep = text.match(/(\d{1,2}|[一二两三四五六七八九十]+)\s*点(?:睡|休息)/);
  const wake = text.match(/(\d{1,2}|[一二两三四五六七八九十]+)\s*点(?:起|起床)/);
  const habits: Partial<AppSettings['habits']> = {};
  if (sleep) {
    const rawHour = parseChineseNumber(sleep[1]);
    habits.sleepStart = `${String(rawHour === 0 ? 0 : normalizeHour(rawHour, '晚上')).padStart(2, '0')}:00`;
  }
  if (wake) habits.wakeUp = `${String(normalizeHour(parseChineseNumber(wake[1]), '早上')).padStart(2, '0')}:00`;
  return {
    settings: Object.keys(habits).length ? { habits } : undefined,
    profile: {
      signals: [`用户更新画像：${text}`]
    }
  };
}

function mergeText(current: string | undefined, next: string) {
  const values = [current, next].map((item) => item?.trim()).filter(Boolean);
  return Array.from(new Set(values)).join('\n');
}

function draftItemToEventRecord(item: PlanDraftItem & { draftId?: string }, fallbackDate: string): EventRecord {
  return {
    id: item.id,
    type: inferEventType(item.title),
    title: item.title,
    date: item.targetDate ?? fallbackDate,
    startAt: item.startAt,
    endAt: item.endAt,
    purpose: summarizePurposeText(item.notes ?? item.title),
    preparations: [],
    notes: summarizePurposeText(item.notes ?? item.title),
    reminderIds: [],
    status: 'scheduled',
    linkedTaskId: null,
    tags: ['draft'],
    source: 'system',
    rawText: item.notes ?? item.title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDraft: true,
    draftId: item.draftId
  } as EventRecord & { isDraft: boolean; draftId?: string };
}

export async function createTodoProject(title: string, options: { reuseExisting?: boolean } = { reuseExisting: true }) {
  await ensureDataFiles();
  const projects = await readTodoProjects();
  const now = new Date().toISOString();
  if (normalizeProjectTitle(title) === '未归类') {
    return { ok: true, project: createUncategorizedTodoProject() };
  }
  const existing = options.reuseExisting === false ? null : findSimilarTodoProject(title, projects);
  if (existing) return { ok: true, project: existing };
  const project: TodoProjectRecord = {
    id: createId('project'),
    title: title.trim(),
    status: 'active',
    order: projects.length + 1,
    createdAt: now,
    updatedAt: now
  };
  await writeTodoProjects([...projects, project]);
  return { ok: true, project };
}

export async function updateTodoProject(id: string, updates: { title?: string; order?: number }) {
  await ensureDataFiles();
  if (id === 'uncategorized') return { ok: false, id };
  const now = new Date().toISOString();
  const projects = await readTodoProjects();
  const nextProjects = projects.map((project) =>
    project.id === id
      ? {
          ...project,
          title: updates.title?.trim() || project.title,
          order: typeof updates.order === 'number' ? updates.order : project.order,
          updatedAt: now
        }
      : project
  );
  await writeTodoProjects(nextProjects);
  return { ok: projects.some((project) => project.id === id), id };
}

export async function deleteTodoProject(id: string) {
  await ensureDataFiles();
  if (id === 'uncategorized') return { ok: false, id, error: 'uncategorized cannot be deleted' };
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
  const tasks = await readJsonl<TaskRecord>(files.tasks);
  const siblingCount = tasks.filter((task) => task.status !== 'cancelled' && (task.projectId ?? null) === (input.projectId ?? null)).length;
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
    order: siblingCount + 1,
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
  const parsedTitle = typeof fields.title === 'string' ? fields.title.trim() : '';
  const fallbackTitle = cleanupTaskTitle(result.rawText);
  if (shouldUseRawTodoTitle(parsedTitle, fallbackTitle)) {
    fields.title = fallbackTitle;
  }
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

function shouldUseRawTodoTitle(parsedTitle: string, fallbackTitle: string) {
  if (!fallbackTitle) return false;
  if (!parsedTitle) return true;
  if (fallbackTitle === parsedTitle) return false;
  if (fallbackTitle.length < 6) return false;
  const genericTitles = new Set(['任务', '待办', '事项', '安排', '同步', '处理', '修复', '新增', '项目']);
  if (genericTitles.has(parsedTitle)) return true;
  return parsedTitle.length <= 3 && fallbackTitle.length >= parsedTitle.length + 4 && fallbackTitle.includes(parsedTitle);
}

function isLifeTodoReminderText(text: string) {
  return /(定.*闹钟|闹钟|起床|起来|叫醒|睡觉之前|睡前)/.test(text) && !/(取消|删除|删掉)/.test(text);
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
    order?: number;
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
          order: typeof updates.order === 'number' ? updates.order : task.order,
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

function createDefaultConversationContext(): ConversationContext {
  const now = new Date().toISOString();
  return {
    id: createId('conversation'),
    state: 'idle',
    createdAt: now,
    updatedAt: now
  };
}

async function readPlanDrafts(): Promise<PlanDraft[]> {
  try {
    const content = await readTextFile(files.planDrafts);
    const parsed = JSON.parse(content) as { drafts?: PlanDraft[] };
    return Array.isArray(parsed.drafts) ? parsed.drafts : [];
  } catch {
    return [];
  }
}

async function writePlanDrafts(drafts: PlanDraft[]) {
  await writeTextFile(files.planDrafts, JSON.stringify({ drafts }, null, 2));
}

async function readConversationContext(): Promise<ConversationContext> {
  try {
    const content = await readTextFile(files.conversation);
    const parsed = JSON.parse(content) as Partial<ConversationContext>;
    const fallback = createDefaultConversationContext();
    return {
      ...fallback,
      ...parsed,
      state: parsed.state ?? fallback.state,
      createdAt: parsed.createdAt ?? fallback.createdAt,
      updatedAt: parsed.updatedAt ?? fallback.updatedAt
    };
  } catch {
    return createDefaultConversationContext();
  }
}

async function writeConversationContext(context: ConversationContext) {
  await writeTextFile(files.conversation, JSON.stringify(context, null, 2));
}

async function readRecurringRules(): Promise<RecurringRuleRecord[]> {
  try {
    const content = await readTextFile(files.recurringRules);
    const parsed = JSON.parse(content) as { rules?: RecurringRuleRecord[] };
    return Array.isArray(parsed.rules) ? parsed.rules : [];
  } catch {
    return [];
  }
}

async function writeRecurringRules(rules: RecurringRuleRecord[]) {
  await writeTextFile(files.recurringRules, JSON.stringify({ rules }, null, 2));
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
    return normalizeSettings({
      ...defaults,
      ...stored,
      notification: { ...defaults.notification, ...(stored.notification ?? {}) },
      ui: { ...defaults.ui, ...(stored.ui ?? {}) },
      habits: { ...defaults.habits, ...(stored.habits ?? {}) },
      weather: { ...defaults.weather, ...(stored.weather ?? {}) },
      ai: { ...defaults.ai, ...(stored.ai ?? {}) }
    });
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
    habits: {
      sleepStart: '22:00',
      wakeUp: '06:00',
      restDayMode: 'weekend',
      customRestDays: [0, 6],
      alternateWeekendStartsOn: '2026-01-03',
      showLegalHolidays: true
    },
    weather: {
      enabled: true,
      latitude: 31.2304,
      longitude: 121.4737,
      city: '',
      rainProbabilityThreshold: 45,
      outdoorLeadMinutes: 30
    },
    ai: {
      provider: 'deepseek',
      enabled: true,
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      apiKey: ''
    }
  };
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const sleepStart = normalizeTimeText(settings.habits.sleepStart, '22:00');
  const wakeUp = normalizeTimeText(settings.habits.wakeUp, '06:00');
  return {
    ...settings,
    ui: {
      ...settings.ui,
      calendarDays: Math.min(14, Math.max(7, Number(settings.ui.calendarDays) || 7)),
      dayStartHour: 0,
      dayEndHour: 24
    },
    habits: {
      ...settings.habits,
      sleepStart,
      wakeUp,
      customRestDays: Array.isArray(settings.habits.customRestDays)
        ? settings.habits.customRestDays.map(Number).filter((day) => day >= 0 && day <= 6)
        : [0, 6],
      alternateWeekendStartsOn: normalizeDateText(settings.habits.alternateWeekendStartsOn) ?? '2026-01-03'
    },
    ai: {
      ...settings.ai,
      provider: settings.ai?.provider === 'openai-compatible' ? 'openai-compatible' : 'deepseek',
      enabled: settings.ai?.enabled !== false,
      baseUrl: (settings.ai?.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, ''),
      model: settings.ai?.model?.trim() || 'deepseek-chat',
      apiKey: settings.ai?.apiKey?.trim() || ''
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
  todoProjects: TodoProjectRecord[] = [],
  reminders: ReminderRecord[] = [],
  workLogs: WorkLogRecord[] = [],
  weatherAlerts: WeatherAlert[] = [],
  planDrafts: PlanDraft[] = [],
  recurringRules: RecurringRuleRecord[] = []
) {
  void tasks;
  void todoProjects;
  const draftItems = planDrafts
    .filter((draft) => draft.status === 'draft')
    .flatMap((draft) => draft.items.map((item) => ({ ...item, draftId: draft.id })));
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
      ...events.filter((event) => event.status === 'scheduled' && event.date > weekEndText).map((event) => event.date)
    ])
  )
    .sort()
    .slice(0, 21);

  return [...weekDates, ...futureDates].map((isoDate) => {
    const date = new Date(`${isoDate}T00:00:00`);
    return {
      date: isoDate,
      label: formatWeekLabel(date),
      items: assignEventLanes([
        ...events.filter((event) => event.date === isoDate && event.status === 'scheduled' && event.startAt && event.endAt),
        ...buildRecurringEventsForDate(recurringRules, isoDate),
        ...draftItems
          .filter((item) => item.kind === 'event' && item.targetDate === isoDate && item.startAt && item.endAt)
          .map((item) => draftItemToEventRecord(item, isoDate))
      ]),
      pendingItems: [
        ...events
        .filter((event) => event.date === isoDate && event.status === 'scheduled' && (!event.startAt || !event.endAt))
        .map(toCalendarEventItem),
        ...draftItems
          .filter((item) => item.kind === 'event' && item.targetDate === isoDate && (!item.startAt || !item.endAt))
          .map((item) => ({ ...toCalendarEventItem(draftItemToEventRecord(item, isoDate)), isDraft: true, draftId: item.draftId }))
      ],
      tasks: [],
      reminders: (reminders
        .filter((reminder) => ['pending', 'triggered', 'missed'].includes(reminder.status))
        .filter((reminder) => reminder.remindAt.startsWith(isoDate) || reminder.updatedAt.startsWith(isoDate))
        .map((reminder) => ({
          id: reminder.id,
          title: reminder.title,
          remindAt: reminder.remindAt,
          status: reminder.status,
          updatedAt: reminder.updatedAt,
          relatedType: reminder.relatedType,
          relatedId: reminder.relatedId
        })) as Array<{
          id: string;
          title: string;
          remindAt: string;
          status: string;
          updatedAt?: string;
          relatedType?: string;
          relatedId?: string | null;
          isDraft?: boolean;
        }>).concat(
        draftItems
          .filter((item) => item.kind === 'reminder' && (item.remindAt?.startsWith(isoDate) || item.targetDate === isoDate))
          .map((item) => ({
            id: item.id,
            title: item.title,
            remindAt: item.remindAt ?? `${isoDate}T09:00:00+08:00`,
            status: 'draft',
            updatedAt: new Date().toISOString(),
            relatedType: 'general',
            relatedId: item.draftId,
            isDraft: true
          }))
      ),
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

function buildRecurringEventsForDate(rules: RecurringRuleRecord[], isoDate: string): EventRecord[] {
  return rules
    .filter((rule) => rule.status === 'active' && rule.targetKind === 'event' && shouldRuleOccurOnDate(rule, isoDate))
    .map((rule) => {
      const habit = buildHabitSchedule(rule.rawText, isoDate, null);
      const [hour, minute] = localTimeTextFromIso(habit.startAt).split(':').map(Number);
      const startAt = atLocalTime(isoDate, hour, minute);
      const durationMinutes = inferEstimatedMinutes(rule.rawText) ?? 60;
      return {
        id: `${rule.id}_${isoDate}`,
        type: inferEventType(rule.title),
        title: rule.title,
        date: isoDate,
        startAt,
        endAt: addMinutesToIso(startAt, durationMinutes),
        purpose: habit.purpose,
        preparations: habit.preparations,
        notes: habit.notes,
        reminderIds: [],
        status: 'scheduled',
        linkedTaskId: null,
        tags: ['recurring'],
        source: 'system',
        rawText: rule.rawText,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt
      };
    });
}

function buildRecurringTasksForDate(rules: RecurringRuleRecord[], isoDate: string) {
  return rules
    .filter((rule) => rule.status === 'active' && rule.targetKind === 'task' && shouldRuleOccurOnDate(rule, isoDate))
    .map((rule) => ({
      id: `${rule.id}_${isoDate}`,
      title: rule.title,
      type: 'task',
      projectTitle: '日常',
      dueAt: `${isoDate}T23:59:00+08:00`,
      estimatedMinutes: null,
      preparations: [],
      notes: '周期日程',
      rawText: rule.rawText,
      isRecurring: true
    }));
}

function shouldRuleOccurOnDate(rule: RecurringRuleRecord, isoDate: string) {
  if (rule.frequency === 'daily') return true;
  if (rule.frequency === 'weekly') {
    const match = rule.rawText.match(/(?:每周|每星期)([一二三四五六日天])/);
    if (!match) return rule.nextOccurrences.some((item) => item.startsWith(isoDate));
    const target = '一二三四五六日天'.indexOf(match[1]);
    const targetDay = target >= 6 ? 0 : target + 1;
    return new Date(`${isoDate}T12:00:00`).getDay() === targetDay;
  }
  return rule.nextOccurrences.some((item) => item.startsWith(isoDate));
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
  const activeProjects = projects.filter((project) => project.status === 'active' && project.id !== 'uncategorized' && normalizeProjectTitle(project.title) !== '未归类');
  return [...activeProjects, createUncategorizedTodoProject()];
}

function createUncategorizedTodoProject(): TodoProjectRecord {
  return {
    id: 'uncategorized',
    title: '未归类',
    status: 'active',
    order: 9999,
    createdAt: '',
    updatedAt: ''
  };
}

function buildTaskList(tasks: TaskRecord[], projects: TodoProjectRecord[]) {
  const projectById = new Map(projects.map((project) => [project.id, project.title]));
  const uncategorizedProjectIds = new Set(projects.filter((project) => normalizeProjectTitle(project.title) === '未归类').map((project) => project.id));
  return tasks
    .filter((task) => task.status !== 'cancelled' && task.title.trim())
    .map((task) => {
      const tagProject = task.tags.find((tag) => tag !== 'needs_split');
      const legacyUncategorized = task.projectId ? uncategorizedProjectIds.has(task.projectId) : false;
      const projectId = legacyUncategorized ? 'uncategorized' : task.projectId ?? (tagProject ? `tag:${tagProject}` : 'uncategorized');
      const projectTitle = legacyUncategorized ? '未归类' : task.projectId ? projectById.get(task.projectId) ?? '未归类' : tagProject ?? '未归类';
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        projectId,
        projectTitle,
        order: task.order,
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
  const candidateAliases = getProjectTitleAliases(normalized);
  return (
    projects.find((project) => {
      const projectAliases = getProjectTitleAliases(project.title);
      if (projectAliases.some((alias) => candidateAliases.includes(alias))) return true;
      const projectTitle = projectAliases[0] ?? normalizeProjectTitle(project.title);
      const shortAliasMatch =
        Math.min(projectTitle.length, normalized.length) <= 4 &&
        (projectTitle.includes(normalized) || normalized.includes(projectTitle));
      return shortAliasMatch;
    }) ?? null
  );
}

function findTodoProject(title: string | undefined, projects: TodoProjectRecord[]) {
  const normalized = normalizeProjectTitle(title);
  if (!normalized) return null;
  return findSimilarTodoProject(normalized, projects);
}

function getParsedProjectTitle(parsed: ParseResult) {
  const candidate =
    parsed.fields.projectTitle ??
    parsed.fields.project ??
    parsed.fields.category ??
    parsed.fields.projectName ??
    parsed.fields.projectId;
  return typeof candidate === 'string' ? candidate : undefined;
}

function inferTodoProjectTitle(text: string, projects: TodoProjectRecord[], parsedProjectTitle?: string) {
  const parsedKnown = parsedProjectTitle ? findSimilarTodoProject(parsedProjectTitle, projects) : null;
  if (parsedKnown) return parsedKnown.title;
  if (isLifeTodoReminderText(text)) return '生活';

  const knownActionProject = projects.find((project) => {
    const title = escapeRegExp(project.title.trim());
    if (!title) return false;
    return new RegExp(`${title}\\s*(?:新增|新加|添加|加|记)(?:一个|个|一条)?(?:新)?(?:项目)?(?:待办|代办|任务)?`).test(text);
  });
  if (knownActionProject) return knownActionProject.title;

  const actionKnownProject = projects.find((project) => {
    const title = escapeRegExp(project.title.trim());
    if (!title) return false;
    return new RegExp(`(?:新增|新加|添加|加|记)(?:一个|个|一条)?${title}(?:的)?(?:待办|代办|任务)`).test(text);
  });
  if (actionKnownProject) return actionKnownProject.title;

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
    .replace(/\s+/g, '')
    .toLowerCase()
    .trim();
}

function getProjectTitleAliases(title?: string) {
  const normalized = normalizeProjectTitle(title);
  if (!normalized) return [];
  const aliases = new Set([normalized]);
  if (normalized.startsWith('外')) aliases.add(`web${normalized.slice(1)}`);
  if (normalized.startsWith('web')) aliases.add(`外${normalized.slice(3)}`);
  aliases.add(normalized.replace(/外/g, 'web'));
  aliases.add(normalized.replace(/web/g, '外'));
  return Array.from(aliases).filter(Boolean);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    date: event.date,
    startAt: event.startAt,
    endAt: event.endAt,
    type: event.type,
    purpose: event.purpose,
    preparations: event.preparations ?? [],
    notes: event.notes,
    reminderIds: event.reminderIds ?? [],
    rawText: event.rawText,
    tags: event.tags ?? [],
    isDraft: (event as EventRecord & { isDraft?: boolean }).isDraft,
    draftId: (event as EventRecord & { draftId?: string }).draftId
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

function normalizeDateText(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  return toLocalDateText(date);
}

function normalizeTimeText(value: unknown, fallback: string) {
  const text = typeof value === 'string' ? value.trim() : '';
  const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallback;
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function normalizeEventDateTime(date: string, value: string | undefined, fallbackTime: string) {
  if (value && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const time = normalizeTimeText(value, fallbackTime);
  return `${date}T${time}:00+08:00`;
}

function addMinutesToTimeText(time: string, minutes: number) {
  const [hourText, minuteText] = normalizeTimeText(time, '09:00').split(':');
  const total = Number(hourText) * 60 + Number(minuteText) + minutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function addMinutesToIso(value: string, minutes: number) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
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
  const timeInfo = inferTimeInfo(text, now);
  if (timeInfo.hasSpecificTime && timeInfo.startAt) return timeInfo.startAt;
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
  const duration = inferDurationMinutes(text);
  if (duration) return duration;
  return null;
}

function inferDurationMinutes(text: string) {
  if (/半个?小时|半小时/.test(text)) return 30;
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

function summarizePurposeText(text: string | undefined) {
  if (!text) return undefined;
  let value = cleanupDetailFragment(stripV11DetailText(text))
    .replace(/^(今天|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天])/, '')
    .replace(/^(上午|中午|下午|晚上|今晚|早上|饭前|饭后|吃饭前|吃完饭后|然后)/, '')
    .replace(/^(我先|我要|我想|帮我|安排|加一个|新增|新加|记一下|记得)/, '')
    .replace(/(大概|可能|应该|差不多|左右|一下|一个)?(小时|分钟).*$/g, '')
    .replace(/[，。；;]\s*$/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (value.length < 4 && /面试/.test(text)) value = '准备面试';
  if (value.length < 3 && /健身|运动|锻炼/.test(text)) value = '健身';
  if (value.length < 3 && /项目/.test(text)) value = text.match(/(?:改|修改|整理|推进)?[^，。；;]*项目/)?.[0]?.trim() ?? value;
  if (!value) value = cleanupDetailFragment(text).trim();
  if (value.length > 42) value = `${value.slice(0, 40)}…`;
  return value || undefined;
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
  const durationMinutes = inferDurationMinutes(text);
  const range = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})\s*[-到至~～]\s*(\d{1,2})[:：](\d{2})/);
  if (range) {
    const period = range[1] ?? '';
    const startHour = normalizeInferredHour(Number(range[2]), period, date, now);
    const endHour = normalizeInferredHour(Number(range[4]), period, date, now);
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
    const hour = normalizeInferredHour(Number(clock[2]), period, date, now);
    const minute = Number(clock[3]);
    return {
      date,
      hasSpecificTime: true,
      hasVagueTime: false,
      startAt: atLocalTime(date, hour, minute),
      endAt: addMinutesToIso(atLocalTime(date, hour, minute), durationMinutes ?? 60)
    };
  }

  const spokenRange = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?(?:的)?\s*(\d{1,2}|[一二两三四五六七八九十]+)\s*点?(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?\s*(?:到|至|[-~～])\s*(?:(凌晨|早上|上午|中午|下午|晚上|今晚)?(?:的)?\s*)?(\d{1,2}|[一二两三四五六七八九十]+)?\s*点?(半|(\d{1,2}|[一二两三四五六七八九十]+)分?)?/);
  if (spokenRange) {
    const startPeriod = spokenRange[1] ?? inferNearestTimePeriod(text, spokenRange.index ?? 0);
    const endPeriod = spokenRange[5] ?? startPeriod;
    const startRawHour = parseChineseNumber(spokenRange[2]);
    const startHour = normalizeInferredHour(startRawHour, startPeriod, date, now);
    const endRawHour = spokenRange[6] ? parseChineseNumber(spokenRange[6]) : parseChineseNumber(spokenRange[2]);
    const endHour = normalizeInferredHour(endRawHour, endPeriod, date, now);
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
    const hour = normalizeInferredHour(parseChineseNumber(hourMatch[2]), period, date, now);
    const minute = hourMatch[3] === '半' ? 30 : parseChineseNumber(hourMatch[4] ?? '0');
    return {
      date,
      hasSpecificTime: true,
      hasVagueTime: false,
      startAt: atLocalTime(date, hour, minute),
      endAt: addMinutesToIso(atLocalTime(date, hour, minute), durationMinutes ?? 60)
    };
  }

  const hasVagueTime = /(早上|上午|中午|下午|晚上|今晚|白天)/.test(text);
  return { date, hasSpecificTime: false, hasVagueTime, startAt: undefined, endAt: undefined };
}

function normalizeInferredHour(hour: number, period: string, date: string, now: string) {
  const normalized = normalizeHour(hour, period);
  if (period || hour > 7 || date !== toLocalDateText(new Date(now))) return normalized;
  const candidate = atLocalTime(date, normalized, 0);
  if (new Date(candidate).getTime() < new Date(now).getTime()) return normalized + 12;
  return normalized;
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
  const needsTime = !hasConcreteStart && !hasExplicitTimeText(text) && (hasVagueTimeText(text) || isDurationOnlyScheduleText(text));
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

function isDurationOnlyScheduleText(text: string) {
  return Boolean(inferDurationMinutes(text)) && /(面试|会议|开会|上课|课程|准备|复习|健身|运动|锻炼|项目|写|整理)/.test(text);
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
    purpose: summarizePurposeText(typeof result.fields.purpose === 'string' ? result.fields.purpose : inferPurpose(text)),
    preparations: result.fields.preparations ?? inferPreparations(text),
    notes: summarizePurposeText(typeof result.fields.notes === 'string' ? result.fields.notes : inferNotes(text, inferPurpose(text), inferPreparations(text))),
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
  if (isExplicitNewEventText(text)) return false;
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

function isExplicitNewEventText(text: string) {
  return /(有一?个|有场|安排一?个|新增一?个|加一?个|记一?个|我要|我想|打算|需要|明天|后天|今天|上午|下午|晚上|\d{1,2}[点:：]|一?个小时|半小时|两小时|俩小时)/.test(text) &&
    /(面试|会议|开会|上课|课程|日程|安排)/.test(text) &&
    !/(已有|刚才|上次|那[个场条]|这[个场条]|备注|补充|带上|加上说明)/.test(text);
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
    add_task: '小猫已记录：这件事会先转成日程安排。',
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
      ...result.fields,
      ...(result.preview ?? {})
    }
  };
}

function rangesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return new Date(startA).getTime() < new Date(endB).getTime() && new Date(startB).getTime() < new Date(endA).getTime();
}
