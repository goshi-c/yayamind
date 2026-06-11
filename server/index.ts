import Fastify from 'fastify';
import { verifySupabaseUserId } from './auth';
import { getAiStatus } from './aiAdapter';
import {
  appendWorkLog,
  cancelEvent,
  cancelTask,
  checkConflicts,
  commitTextInput,
  createGoal,
  createTodoProject,
  createTodoTask,
  deleteTodoProject,
  deleteWorkLog,
  ensureDataFiles,
  generateMarkdownSummary,
  getBootstrapData,
  getProfileData,
  listGoals,
  parseAndEnrichTextInput,
  snoozeReminder,
  updateEvent,
  updateGoalStatus,
  updateReminderStatus,
  updateTodoProject,
  updateTask,
  updateWorkLog
} from './dataStore';
import { enterRequestContext } from './requestContext';
import type { ParseResult, TaskRecord } from './types';

export function buildApp() {
const app = Fastify({ logger: true });
const requireAuth = process.env.VERCEL === '1' && Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

app.addHook('onRequest', async (request, reply) => {
  if (!requireAuth) {
    enterRequestContext({ userId: null });
    return;
  }
  const userId = await verifySupabaseUserId(request.headers.authorization);
  if (!userId) {
    return reply.code(401).send({ ok: false, error: 'login required' });
  }
  enterRequestContext({ userId });
});

app.get('/api/bootstrap', async () => getBootstrapData());

app.get('/api/ai/status', async () => getAiStatus());

app.get('/api/calendar', async () => {
  const data = await getBootstrapData();
  return data.calendar;
});

app.get('/api/today', async () => {
  const data = await getBootstrapData();
  return data.today;
});

app.get('/api/goals', async () => listGoals());

app.post<{ Body: { title?: string; reuseExisting?: boolean } }>('/api/todo-projects', async (request, reply) => {
  const title = request.body?.title?.trim();
  if (!title) return reply.code(400).send({ ok: false, error: 'title is required' });
  return createTodoProject(title, { reuseExisting: request.body?.reuseExisting ?? false });
});

app.patch<{ Params: { id: string }; Body: { title?: string } }>('/api/todo-projects/:id', async (request) =>
  updateTodoProject(request.params.id, request.body ?? {})
);

app.delete<{ Params: { id: string } }>('/api/todo-projects/:id', async (request) => deleteTodoProject(request.params.id));

app.post<{ Body: { title?: string; targetDate?: string | null } }>('/api/goals', async (request, reply) => {
  const title = request.body?.title?.trim();
  if (!title) return reply.code(400).send({ ok: false, error: 'title is required' });
  return createGoal(title, request.body?.targetDate ?? null);
});

app.post<{ Params: { id: string }; Body: { status?: 'active' | 'paused' | 'done' | 'cancelled' } }>('/api/goals/:id/status', async (request, reply) => {
  const status = request.body?.status;
  if (!status) return reply.code(400).send({ ok: false, error: 'status is required' });
  return updateGoalStatus(request.params.id, status);
});

app.get('/api/profile', async () => getProfileData());

app.post<{ Body: { kind?: 'daily' | 'weekly' } }>('/api/summaries/generate', async (request) =>
  generateMarkdownSummary(request.body?.kind ?? 'daily')
);

app.post<{ Body: { text: string; source?: string; selectedOptionId?: string | null } }>('/api/input/commit', async (request, reply) => {
  const text = request.body?.text?.trim();
  if (!text) {
    return reply.code(400).send({ ok: false, error: 'text is required' });
  }
  const result = await commitTextInput(text, request.body.source, { selectedOptionId: request.body.selectedOptionId });
  request.log.info({
    input: text,
    inputEscaped: escapeForLog(text),
    source: request.body.source ?? 'text',
    selectedOptionId: request.body.selectedOptionId ?? null,
    ok: result.ok,
    needsConfirmation: result.needsConfirmation ?? false,
    resolvedBy: result.resolvedBy ?? null,
    parse: summarizeParseResult(result.parseResult)
  }, 'input commit result');
  return result;
});

app.post<{ Body: { text: string; source?: string } }>('/api/input/parse', async (request) => {
  const text = request.body?.text?.trim() ?? '';
  const result = await parseAndEnrichTextInput(text, undefined, request.body?.source);
  request.log.info({
    input: text,
    inputEscaped: escapeForLog(text),
    source: request.body?.source ?? 'text',
    parse: summarizeParseResult(result)
  }, 'input parse result');
  return result;
});

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/start', async (request) =>
  appendWorkLog('start', request.body?.note?.trim() || '开始工作', request.body?.taskId ?? null)
);

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/pause', async (request) =>
  appendWorkLog('pause', request.body?.note?.trim() || '暂停工作', request.body?.taskId ?? null)
);

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/resume', async (request) =>
  appendWorkLog('resume', request.body?.note?.trim() || '继续工作', request.body?.taskId ?? null)
);

app.post<{ Body: { note?: string; taskId?: string } }>('/api/work/finish', async (request) =>
  appendWorkLog('finish', request.body?.note?.trim() || '结束工作', request.body?.taskId ?? null)
);

app.get('/api/reminders/pending', async () => {
  const data = await getBootstrapData();
  return data.today.reminders;
});

app.post<{ Params: { id: string } }>('/api/reminders/:id/done', async (request) =>
  updateReminderStatus(request.params.id, 'done')
);

app.post<{ Params: { id: string } }>('/api/reminders/:id/dismiss', async (request) =>
  updateReminderStatus(request.params.id, 'dismissed')
);

app.post<{ Params: { id: string }; Body: { minutes?: number } }>('/api/reminders/:id/snooze', async (request) =>
  snoozeReminder(request.params.id, request.body?.minutes ?? 10)
);

app.post<{ Body: { title?: string; startAt?: string; endAt?: string; date?: string } }>('/api/conflicts/check', async (request) =>
  checkConflicts(request.body ?? {})
);

app.patch<{ Params: { id: string }; Body: { title?: string; notes?: string; dueAt?: string | null; estimatedMinutes?: number | null; preparations?: string[]; status?: TaskRecord['status']; projectId?: string | null } }>('/api/tasks/:id', async (request) =>
  updateTask(request.params.id, request.body ?? {})
);

app.post<{ Body: { title?: string; notes?: string; projectId?: string | null } }>('/api/tasks', async (request, reply) => {
  const result = await createTodoTask(request.body ?? {});
  return result.ok ? result : reply.code(400).send(result);
});

app.delete<{ Params: { id: string } }>('/api/tasks/:id', async (request) => cancelTask(request.params.id));

app.patch<{ Params: { id: string }; Body: { title?: string; notes?: string; startAt?: string; endAt?: string; date?: string; purpose?: string; preparations?: string[] } }>('/api/events/:id', async (request) =>
  updateEvent(request.params.id, request.body ?? {})
);

app.delete<{ Params: { id: string } }>('/api/events/:id', async (request) => cancelEvent(request.params.id));

app.patch<{ Params: { id: string }; Body: { note?: string; at?: string } }>('/api/work-logs/:id', async (request) =>
  updateWorkLog(request.params.id, request.body ?? {})
);

app.delete<{ Params: { id: string } }>('/api/work-logs/:id', async (request) => deleteWorkLog(request.params.id));

return app;
}

export async function startLocalServer() {
  const app = buildApp();
  await ensureDataFiles();
  await app.listen({ port: 8787, host: '127.0.0.1' });
}

if (process.env.VERCEL !== '1') {
  startLocalServer().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

function summarizeParseResult(result?: ParseResult) {
  if (!result) return null;
  return {
    intent: result.intent,
    confidence: result.confidence,
    needsConfirmation: result.needsConfirmation,
    rawText: result.rawText,
    rawTextEscaped: escapeForLog(result.rawText),
    correctedText: result.transcription?.correctedText,
    correctedTextEscaped: result.transcription?.correctedText ? escapeForLog(result.transcription.correctedText) : undefined,
    questions: result.questions,
    questionsEscaped: result.questions.map(escapeForLog),
    warnings: result.warnings,
    fields: {
      title: result.fields.title,
      type: result.fields.type,
      date: result.fields.date,
      startAt: result.fields.startAt,
      endAt: result.fields.endAt,
      dueAt: result.fields.dueAt,
      notes: result.fields.notes
    },
    preview: {
      needsTimeConfirmation: result.preview.needsTimeConfirmation,
      needsContentConfirmation: result.preview.needsContentConfirmation,
      options: result.preview.options
    }
  };
}

function escapeForLog(value: string) {
  return Array.from(value)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code > 127 ? `\\u${code.toString(16).padStart(4, '0')}` : char;
    })
    .join('');
}
