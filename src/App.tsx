import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent } from 'react';
import ragdollAvatar from './assets/ragdoll-avatar.png';

type AssistantData = {
  today: {
    date: string;
    activeSession: null | { title: string; startedAt: string };
    plans: Array<{ id: string; title: string; time?: string; type: string }>;
    timeline: CalendarLog[];
    reminders: Array<{ id: string; title: string; remindAt: string; status: string }>;
    weatherAlerts: WeatherAlert[];
  };
  calendar: Array<{
    date: string;
    label: string;
    items: CalendarItem[];
    pendingItems: CalendarItem[];
    tasks: CalendarItem[];
    reminders: CalendarReminder[];
    weatherAlerts: WeatherAlert[];
    timeline: CalendarLog[];
  }>;
  todoProjects: TodoProject[];
  tasks: TaskListItem[];
  goals: GoalRecord[];
  profile: ProfileData;
};

type CalendarItem = {
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string | null;
  date?: string;
  type: string;
  lane?: number;
  laneCount?: number;
  conflict?: boolean;
  purpose?: string;
  preparations?: string[];
  notes?: string;
  reminderIds?: string[];
  estimatedMinutes?: number | null;
  rawText?: string;
};

type CalendarReminder = { id: string; title: string; remindAt: string; status: string; relatedType?: string; relatedId?: string | null };

type DetailTarget = CalendarItem & { kind: 'event' | 'task' };

type CalendarLog = { id: string; at?: string; time: string; text: string; action?: string; feedbackType?: string };

type WeatherAlert = { id: string; date: string; title: string; detail: string; remindAt?: string; relatedEventId?: string; probability?: number };

type TodoProject = {
  id: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
};

type TaskListItem = {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'paused' | 'done' | 'partially_done' | 'cancelled' | 'deferred';
  projectId: string;
  projectTitle: string;
  dueAt: string | null;
  estimatedMinutes: number | null;
  notes?: string;
  preparations?: string[];
  createdAt: string;
  updatedAt: string;
};

type TodoTaskDraft = { title: string; notes: string; projectId: string };
type TodoEditField = 'title' | 'notes';

type DetailDraft = {
  id: string;
  title: string;
  notes: string;
  date: string;
  startTime: string;
  endTime: string;
  dueDate: string;
  dueTime: string;
  estimatedMinutes: string;
  purpose: string;
  preparationsText: string;
};

type LogDraft = { id: string; note: string; date: string; time: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

type GoalRecord = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'done' | 'cancelled';
  startDate: string;
  targetDate: string | null;
  milestones: Array<{ id: string; title: string; status: string }>;
  linkedTaskIds: string[];
};

type ProfileData = {
  timeHabits: { highFocusWindows: string[]; lowEnergyWindows: string[]; commonDelayWindows: string[] };
  estimationPatterns: { oftenUnderestimatedTags: string[]; bufferRules: string[] };
  lifeRhythm: { regularMeals: string[]; exercisePreferences: string[]; restPatterns: string[] };
  workPreferences: { focusStyle: string; preferredTaskOrder: string; encouragementStyle: string };
  signals: string[];
  updatedAt: string;
};

type AuthSession = {
  access_token: string;
  refresh_token?: string;
  user?: {
    id?: string;
    email?: string;
  };
};

type ParsedIntent =
  | 'add_event'
  | 'update_event'
  | 'delete_event'
  | 'annotate_event'
  | 'add_task'
  | 'start_work'
  | 'pause_work'
  | 'resume_work'
  | 'finish_work'
  | 'progress_update'
  | 'add_reminder'
  | 'review_note';

type ParseResult = {
  intent: ParsedIntent;
  confidence: number;
  needsConfirmation: boolean;
  rawText: string;
  transcription?: {
    originalText: string;
    correctedText: string;
    provider: 'deepseek' | 'rules';
  };
  fields: Record<string, unknown>;
  questions: string[];
  warnings: string[];
  preview: Record<string, unknown>;
};

type ConflictOption = {
  id: string;
  title: string;
};

type CommitResponse = {
  ok: boolean;
  parseResult?: ParseResult;
  needsConfirmation?: boolean;
  resolvedBy?: string;
  feedback?: string;
  written?: Array<{ file: string; id: string; status?: string }>;
};

type PostCommitAction = {
  id: string;
  kind: 'event' | 'task';
  title: string;
  date?: string;
  startAt?: string;
  endAt?: string;
};

type ViewMode = 'week' | 'todos' | 'goals' | 'profile' | 'summary';

const emptyData: AssistantData = {
  today: {
    date: toLocalDateText(new Date()),
    activeSession: null,
    plans: [],
    timeline: [],
    reminders: [],
    weatherAlerts: []
  },
  calendar: [],
  todoProjects: [],
  tasks: [],
  goals: [],
  profile: {
    timeHabits: { highFocusWindows: [], lowEnergyWindows: [], commonDelayWindows: [] },
    estimationPatterns: { oftenUnderestimatedTags: [], bufferRules: [] },
    lifeRhythm: { regularMeals: [], exercisePreferences: [], restPatterns: [] },
    workPreferences: { focusStyle: 'unknown', preferredTaskOrder: 'unknown', encouragementStyle: 'gentle' },
    signals: [],
    updatedAt: new Date().toISOString()
  }
};

const portfolioPreviewData = createPortfolioPreviewData();
const authStorageKey = 'yayamind.auth.session';

function getSupabaseAuthConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && anonKey ? { url: url.replace(/\/+$/, ''), anonKey } : null;
}

function isHostedApp() {
  if (typeof window === 'undefined') return false;
  return !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

function readStoredAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(authStorageKey);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function storeAuthSession(session: AuthSession | null) {
  if (!session) {
    window.localStorage.removeItem(authStorageKey);
    return;
  }
  window.localStorage.setItem(authStorageKey, JSON.stringify(session));
}

async function submitSupabaseAuth(mode: 'login' | 'signup', email: string, password: string) {
  const config = getSupabaseAuthConfig();
  if (!config) throw new Error('Supabase 登录还没有配置好。');
  const endpoint = mode === 'login' ? '/auth/v1/token?grant_type=password' : '/auth/v1/signup';
  const response = await fetch(`${config.url}${endpoint}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error_description === 'string' ? result.error_description : '登录失败，请检查账号密码。');
  }
  if (!result.access_token) {
    throw new Error('账号已创建，但还没有返回登录会话。请检查 Supabase 是否关闭了邮箱验证。');
  }
  return result as AuthSession;
}

function createPortfolioPreviewData(): AssistantData {
  const now = new Date();
  const today = toLocalDateText(now);
  const weekStart = getWeekStart(now);
  const isoAt = (dayOffset: number, time: string) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    return `${toLocalDateText(date)}T${time}:00+08:00`;
  };
  const dateAt = (dayOffset: number) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    return toLocalDateText(date);
  };
  const calendar = Array.from({ length: 7 }, (_, index) => {
    const date = dateAt(index);
    const items: CalendarItem[] = [];
    const pendingItems: CalendarItem[] = [];
    const tasks: CalendarItem[] = [];
    const reminders: CalendarReminder[] = [];
    const timeline: CalendarLog[] = [];
    const weatherAlerts: WeatherAlert[] = [];

    if (index === 1) {
      items.push({
        id: 'demo-event-1',
        title: 'AI 产品面试复盘',
        date,
        startAt: isoAt(index, '10:00'),
        endAt: isoAt(index, '11:00'),
        type: 'meeting',
        purpose: '梳理 YayaMind 的 PRD、SDD 和 MVP 取舍',
        preparations: ['准备项目讲解顺序', '整理高频追问回答']
      });
      tasks.push({
        id: 'demo-task-1',
        title: '完善作品集部署说明',
        date,
        dueAt: isoAt(index, '21:00'),
        type: 'task',
        estimatedMinutes: 60,
        notes: '把 GitHub、Vercel、真实可用版架构讲清楚'
      });
    }

    if (index === 2) {
      items.push({
        id: 'demo-event-2',
        title: '开题报告修改',
        date,
        startAt: isoAt(index, '14:30'),
        endAt: isoAt(index, '16:00'),
        type: 'task_block',
        purpose: '根据导师意见修改研究问题和技术路线',
        preparations: ['对照主稿冻结内容', '检查 DOCX/PPT 文本一致性']
      });
      reminders.push({ id: 'demo-reminder-1', title: '出门前带电脑和资料', remindAt: isoAt(index, '13:40'), status: 'pending' });
      weatherAlerts.push({
        id: 'demo-weather-1',
        date,
        title: '出门提醒',
        detail: '下午可能有雨，出门前记得带伞和电脑。',
        remindAt: isoAt(index, '13:30'),
        probability: 68
      });
    }

    if (index === 4) {
      pendingItems.push({
        id: 'demo-pending-1',
        title: '补充 Paper Pilot 面试案例',
        date,
        type: 'task',
        notes: '还需要补清楚具体讲哪个用户流程'
      });
      timeline.push({
        id: 'demo-log-1',
        at: isoAt(index, '18:20'),
        time: '18:20',
        text: '完成一轮项目待办梳理，估时比预期多 20 分钟。',
        action: 'progress',
        feedbackType: 'progress'
      });
    }

    return {
      date,
      label: formatWeekLabel(new Date(`${date}T12:00:00`)),
      items,
      pendingItems,
      tasks,
      reminders,
      weatherAlerts,
      timeline
    };
  });

  const todayData = calendar.find((day) => day.date === today) ?? calendar[0];
  const createdAt = now.toISOString();
  return {
    today: {
      date: todayData.date,
      activeSession: { title: '作品集包装与部署', startedAt: isoAt(1, '09:30') },
      plans: todayData.items.map((item) => ({ id: item.id, title: item.title, time: item.startAt, type: item.type })),
      timeline: todayData.timeline,
      reminders: todayData.reminders,
      weatherAlerts: todayData.weatherAlerts
    },
    calendar,
    todoProjects: [
      { id: 'work', title: '工作', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'school', title: '学校', status: 'active', createdAt, updatedAt: createdAt },
      { id: 'life', title: '生活', status: 'active', createdAt, updatedAt: createdAt }
    ],
    tasks: [
      {
        id: 'demo-todo-1',
        title: '把 YayaMind 发布到 GitHub',
        status: 'in_progress',
        projectId: 'work',
        projectTitle: '工作',
        dueAt: isoAt(1, '22:00'),
        estimatedMinutes: 45,
        notes: '排除个人数据和 API Key，只提交作品集代码。',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'demo-todo-2',
        title: '准备 Vercel 作品集链接',
        status: 'todo',
        projectId: 'work',
        projectTitle: '工作',
        dueAt: isoAt(2, '20:00'),
        estimatedMinutes: 60,
        notes: '先上线只读预览，后续再接云端真实数据。',
        createdAt,
        updatedAt: createdAt
      },
      {
        id: 'demo-todo-3',
        title: '整理开题材料主稿',
        status: 'todo',
        projectId: 'school',
        projectTitle: '学校',
        dueAt: isoAt(4, '18:00'),
        estimatedMinutes: 120,
        notes: '保持研究主题和创新点不漂移。',
        createdAt,
        updatedAt: createdAt
      }
    ],
    goals: [
      {
        id: 'demo-goal-1',
        title: '把个人助手包装成 AI PM 作品集',
        status: 'active',
        startDate: today,
        targetDate: dateAt(6),
        milestones: [
          { id: 'demo-milestone-1', title: '完成 MVP 功能对齐', status: 'done' },
          { id: 'demo-milestone-2', title: '上线可访问作品集链接', status: 'in_progress' },
          { id: 'demo-milestone-3', title: '规划真实多人可用架构', status: 'todo' }
        ],
        linkedTaskIds: ['demo-todo-1', 'demo-todo-2']
      }
    ],
    profile: {
      timeHabits: {
        highFocusWindows: ['上午 9:30-11:30 适合做结构化文档'],
        lowEnergyWindows: ['晚饭后容易切换任务变慢'],
        commonDelayWindows: ['临近截止前需要提前拆小块']
      },
      estimationPatterns: {
        oftenUnderestimatedTags: ['文档同步', '部署配置'],
        bufferRules: ['面试材料类任务默认加 20% 缓冲']
      },
      lifeRhythm: {
        regularMeals: ['午饭后适合安排轻量整理'],
        exercisePreferences: ['晚上适合放短训练块'],
        restPatterns: ['连续两小时后需要短休息']
      },
      workPreferences: {
        focusStyle: '语音快速记录，右侧再精修',
        preferredTaskOrder: '先完成可验收闭环，再补细节',
        encouragementStyle: '轻提醒，不催促'
      },
      signals: ['最近在同时推进求职材料、开题报告和作品集部署。'],
      updatedAt: createdAt
    }
  };
}

export function App() {
  const authConfig = getSupabaseAuthConfig();
  const authRequired = isHostedApp() && Boolean(authConfig);
  const [data, setData] = useState<AssistantData>(emptyData);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => readStoredAuthSession());
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [parsePreview, setParsePreview] = useState<ParseResult | null>(null);
  const [pendingClarification, setPendingClarification] = useState<ParseResult | null>(null);
  const [pendingDecision, setPendingDecision] = useState<ParseResult | null>(null);
  const [pendingPostCommit, setPendingPostCommit] = useState<PostCommitAction | null>(null);
  const [pendingModification, setPendingModification] = useState<PostCommitAction | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailTarget | null>(null);
  const [detailDraft, setDetailDraft] = useState<DetailDraft | null>(null);
  const [selectedLog, setSelectedLog] = useState<CalendarLog | null>(null);
  const [logDraft, setLogDraft] = useState<LogDraft | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateText(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [catPosition, setCatPosition] = useState<null | { left: number; top: number }>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [summaryMessage, setSummaryMessage] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectTitleDraft, setProjectTitleDraft] = useState('');
  const [newTaskDraftByProject, setNewTaskDraftByProject] = useState<Record<string, TodoTaskDraft>>({});
  const [activeNewTaskProjectId, setActiveNewTaskProjectId] = useState<string | null>(null);
  const [editingTodoTaskId, setEditingTodoTaskId] = useState<string | null>(null);
  const [editingTodoField, setEditingTodoField] = useState<TodoEditField>('title');
  const [todoTaskDraft, setTodoTaskDraft] = useState<TodoTaskDraft>({ title: '', notes: '', projectId: 'uncategorized' });
  const [draggedTodoTaskId, setDraggedTodoTaskId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const [dragPreview, setDragPreview] = useState<null | { id: string; startAt: string; endAt: string }>(null);
  const [calendarFocusMode, setCalendarFocusMode] = useState<'week' | 'future'>('week');
  const [todoProjectPage, setTodoProjectPage] = useState<'core' | 'other'>('core');
  const [optimisticTodoStatuses, setOptimisticTodoStatuses] = useState<Record<string, TaskListItem['status']>>({});
  const inputRef = useRef('');
  const pendingClarificationRef = useRef<ParseResult | null>(null);
  const pendingDecisionRef = useRef<ParseResult | null>(null);
  const isListeningRef = useRef(false);
  const voiceSilenceTimer = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const seenTriggeredReminderIds = useRef(new Set<string>());

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (resource, options = {}) => {
      const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.toString() : resource.url;
      if (!url.startsWith('/api') || !authSession?.access_token) return nativeFetch(resource, options);
      const headers = new Headers(options.headers ?? (resource instanceof Request ? resource.headers : undefined));
      headers.set('Authorization', `Bearer ${authSession.access_token}`);
      return nativeFetch(resource, { ...options, headers });
    };
    return () => {
      window.fetch = nativeFetch;
    };
  }, [authSession?.access_token]);

  useEffect(() => {
    if (authRequired && !authSession) return;
    refreshData().catch(() => {
      setData(portfolioPreviewData);
    });
  }, [authRequired, authSession?.access_token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    pendingClarificationRef.current = pendingClarification;
  }, [pendingClarification]);

  useEffect(() => {
    pendingDecisionRef.current = pendingDecision;
  }, [pendingDecision]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (authRequired && !authSession) return;
      refreshData().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [authRequired, authSession?.access_token]);

  useEffect(() => {
    const freshTriggered = data.today.reminders.find(
      (reminder) => reminder.status === 'triggered' && !seenTriggeredReminderIds.current.has(reminder.id)
    );
    if (!freshTriggered) return;

    seenTriggeredReminderIds.current.add(freshTriggered.id);
    setMessage(`提醒到点了：${freshTriggered.title}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('YayaMind 提醒', { body: freshTriggered.title });
    }
  }, [data.today.reminders]);

  useEffect(() => {
    const nextWeatherAlert = data.today.weatherAlerts.find((alert) => {
      if (!alert.remindAt) return true;
      return new Date(alert.remindAt).getTime() <= Date.now() + 60 * 60_000;
    });
    if (nextWeatherAlert) {
      setMessage(nextWeatherAlert.detail);
    }
  }, [data.today.weatherAlerts]);

  async function requestNotificationPermission() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      setMessage('这个浏览器暂时不支持通知，我会先在页面里提醒你。');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setMessage(permission === 'granted' ? '浏览器通知已开启。' : '没关系，我先在页面里提醒你。');
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthMessage('');
    try {
      const session = await submitSupabaseAuth(authMode, authEmail.trim(), authPassword);
      setAuthSession(session);
      storeAuthSession(session);
      setAuthPassword('');
      setData(emptyData);
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : '登录失败，请稍后再试。');
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  function logout() {
    setAuthSession(null);
    storeAuthSession(null);
    setData(portfolioPreviewData);
    setAuthMode('login');
    setAuthPassword('');
    setMessage('');
  }

  async function refreshData() {
    const nextData = await fetch('/api/bootstrap').then((res) => {
      if (!res.ok) throw new Error('bootstrap failed');
      return res.json();
    });
    setData(nextData);
    return nextData as AssistantData;
  }

  function patchTodoTaskInView(taskId: string, patch: Partial<TaskListItem>) {
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...patch, updatedAt: new Date().toISOString() } : task))
    }));
  }

  function patchTodoProjectInView(projectId: string, patch: Partial<TodoProject>) {
    setData((current) => ({
      ...current,
      todoProjects: current.todoProjects.map((project) => (project.id === projectId ? { ...project, ...patch, updatedAt: new Date().toISOString() } : project))
    }));
  }

  function removeEventFromView(eventId: string) {
    setData((current) => ({
      ...current,
      today: {
        ...current.today,
        plans: current.today.plans.filter((plan) => plan.id !== eventId)
      },
      calendar: current.calendar.map((day) => ({
        ...day,
        items: day.items.filter((item) => item.id !== eventId),
        pendingItems: day.pendingItems.filter((item) => item.id !== eventId)
      }))
    }));
  }

  function removeTaskFromView(taskId: string) {
    setData((current) => ({
      ...current,
      today: {
        ...current.today,
        plans: current.today.plans.filter((plan) => plan.id !== taskId)
      },
      tasks: current.tasks.filter((task) => task.id !== taskId),
      calendar: current.calendar.map((day) => ({
        ...day,
        tasks: day.tasks.filter((task) => task.id !== taskId),
        pendingItems: day.pendingItems.filter((item) => item.id !== taskId)
      }))
    }));
  }

  function removeLogFromView(logId: string) {
    setData((current) => ({
      ...current,
      today: {
        ...current.today,
        timeline: current.today.timeline.filter((log) => log.id !== logId)
      },
      calendar: current.calendar.map((day) => ({
        ...day,
        timeline: day.timeline.filter((log) => log.id !== logId)
      }))
    }));
  }

  function removeTodoProjectFromView(projectId: string) {
    setData((current) => ({
      ...current,
      todoProjects: current.todoProjects.filter((project) => project.id !== projectId),
      tasks: current.tasks.map((task) => (task.projectId === projectId ? { ...task, projectId: 'uncategorized' } : task))
    }));
  }

  function selectCalendarDate(date: string) {
    setSelectedDate(date);
    setSelectedDetail(null);
    setDetailDraft(null);
  }

  function scrollScheduleToTime(date: string, isoTime?: string) {
    window.setTimeout(() => {
      const schedule = document.querySelector<HTMLElement>(`[data-date="${date}"] .day-schedule`);
      if (!schedule) return;
      const targetDate = isoTime ? new Date(isoTime) : new Date(`${date}T12:00:00`);
      const targetRatio = clampPercent((getMinutesFromDayStart(targetDate) / dayMinutes) * 100) / 100;
      const targetTop = schedule.scrollHeight * targetRatio - schedule.clientHeight / 3;
      schedule.scrollTop = Math.max(0, targetTop);
    }, 120);
  }

  function focusWrittenAction(action: PostCommitAction) {
    if (!action.date) return;
    setSelectedDate(action.date);
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const endText = toLocalDateText(weekEnd);
    setCalendarFocusMode(action.date > endText ? 'future' : 'week');
    scrollScheduleToTime(action.date, action.startAt);
  }

  function createPostCommitAction(result: CommitResponse): PostCommitAction | null {
    const written = result.written?.find((item) => item.file === 'events.jsonl' || item.file === 'tasks.jsonl');
    if (!written || written.status === 'moved') return null;
    const fields = result.parseResult?.fields ?? {};
    const startAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
    const endAt = typeof fields.endAt === 'string' ? fields.endAt : undefined;
    const dueAt = typeof fields.dueAt === 'string' ? fields.dueAt : undefined;
    const date =
      typeof fields.date === 'string'
        ? fields.date
        : startAt
          ? toLocalDateText(new Date(startAt))
          : dueAt
            ? toLocalDateText(new Date(dueAt))
            : undefined;
    return {
      id: written.id,
      kind: written.file === 'events.jsonl' ? 'event' : 'task',
      title: String(fields.title ?? result.parseResult?.rawText ?? '新安排'),
      date,
      startAt: startAt ?? dueAt,
      endAt
    };
  }

  async function deletePostCommitAction(action: PostCommitAction) {
    const path = action.kind === 'task' ? `/api/tasks/${action.id}` : `/api/events/${action.id}`;
    const response = await fetch(path, { method: 'DELETE' });
    if (response.ok) {
      setPendingPostCommit(null);
      setPendingModification(null);
      setMessage('');
      await refreshData();
    } else {
      setMessage('这条没有取消成功，可以再试一次。');
    }
  }

  async function applyPostCommitModification(action: PostCommitAction, text: string) {
    setIsThinking(true);
    const parsed = await fetch('/api/input/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'voice' })
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null) as ParseResult | null;
    const body = buildModificationBody(action, text, parsed, action.date);
    if (Object.keys(body).length === 0) {
      setIsThinking(false);
      setMessage('我没听清要改哪里，你可以直接说“不是周五，是周六”或者“加备注：带电脑”。');
      restartVoiceInputSoon(220);
      return;
    }
    const path = action.kind === 'task' ? `/api/tasks/${action.id}` : `/api/events/${action.id}`;
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    setIsThinking(false);
    if (response.ok) {
      setInput('');
      inputRef.current = '';
      setPendingModification(null);
      setPendingPostCommit(null);
      setMessage('');
      await refreshData();
      const nextDate = typeof body.date === 'string'
        ? body.date
        : typeof body.startAt === 'string'
          ? toLocalDateText(new Date(body.startAt))
          : action.date;
      if (nextDate) scrollScheduleToTime(nextDate, typeof body.startAt === 'string' ? body.startAt : action.startAt);
    } else {
      setMessage('修改没有保存成功，可以再试一次。');
    }
  }

  function findExistingEventTarget(text: string, parsed?: ParseResult | null) {
    const fields = parsed?.fields ?? {};
    const parsedStartAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
    const parsedDate = typeof fields.date === 'string' ? fields.date : undefined;
    const targetDate = parsedStartAt ? toLocalDateText(new Date(parsedStartAt)) : parsedDate ?? inferCorrectionDate(text, selectedDate) ?? selectedDate;
    const primaryDay = calendarDays.find((item) => item.date === targetDate);
    const fallbackDay = calendarDays.find((item) => item.date === selectedDate);
    const candidateDays = [primaryDay, fallbackDay].filter(Boolean) as AssistantData['calendar'];
    const timeMinutes = parsedStartAt ? getMinutesFromDayStart(new Date(parsedStartAt)) : inferSpokenTimeMinutes(text);
    const wantsEventLike = /(会|会议|开会|面试|上课|课程)/.test(text);
    const candidates = candidateDays
      .flatMap((day) => day.items.map((item) => ({ ...item, date: item.date ?? day.date })))
      .filter((item) => !wantsEventLike || isMeetingLikeItem(item));
    if (candidates.length === 0) return null;

    return candidates
      .map((item) => ({ item, score: scoreEventCandidate(item, text, timeMinutes, targetDate) }))
      .filter((entry) => entry.score > -1000)
      .sort((a, b) => b.score - a.score || (b.item.startAt ?? '').localeCompare(a.item.startAt ?? ''))[0]?.item ?? null;
  }

  async function applyExistingEventNote(text: string, parsed?: ParseResult | null, targetOverride?: CalendarItem) {
    if (!/(备注|带上|带|准备|补充)/.test(text) || !/(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return false;
    const target = targetOverride ?? findExistingEventTarget(text, parsed);
    if (!target) return false;
    const targetDate = target.date ?? inferCorrectionDate(text, selectedDate) ?? selectedDate;
    const preparations = extractSimplePreparations(text);
    const note = extractSimpleNote(text);
    const response = await fetch(`/api/events/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes: note ? mergeText(target.notes, note) : target.notes,
        preparations: mergeList(target.preparations ?? [], preparations)
      })
    });
    if (!response.ok) return false;
    setInput('');
    inputRef.current = '';
    setMessage('');
    setSelectedDate(targetDate);
    await refreshData();
    scrollScheduleToTime(targetDate, target.startAt);
    return true;
  }

  async function applyExistingEventChange(text: string) {
    if (!/(删|删除|取消|撤掉|去掉|改|修改|重新安排|不是|补充|备注|带上|带|准备)/.test(text)) return false;
    const parsed = await fetch('/api/input/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'voice' })
    })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null) as ParseResult | null;
    const intent = getEventOperationIntent(text, parsed);
    if (!intent) return false;
    const target = findExistingEventTarget(text, parsed);
    if (!target) {
      setMessage('我没找到要操作的那条会议，可以补一句日期或几点。');
      return true;
    }

    if (intent === 'delete_event') {
      const response = await fetch(`/api/events/${target.id}`, { method: 'DELETE' });
      if (!response.ok) return false;
      setInput('');
      inputRef.current = '';
      setMessage('');
      const nextDate = target.date ?? selectedDate;
      setSelectedDate(nextDate);
      await refreshData();
      scrollScheduleToTime(nextDate, target.startAt);
      return true;
    }

    if (intent === 'annotate_event') {
      return applyExistingEventNote(text, parsed, target);
    }

    const targetDate = target.date ?? inferCorrectionDate(text, selectedDate) ?? selectedDate;
    const body = buildModificationBody(
      { id: target.id, kind: 'event', title: target.title, date: target.date ?? targetDate, startAt: target.startAt, endAt: target.endAt },
      text,
      parsed,
      target.date ?? targetDate
    );
    if (Object.keys(body).length === 0) return false;

    const response = await fetch(`/api/events/${target.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) return false;
    setInput('');
    inputRef.current = '';
    setMessage('');
    const nextDate = typeof body.date === 'string' ? body.date : target.date ?? targetDate;
    setSelectedDate(nextDate);
    await refreshData();
    scrollScheduleToTime(nextDate, typeof body.startAt === 'string' ? body.startAt : target.startAt);
    return true;
  }

  useEffect(() => {
    const text = input.trim();
    if (!text || pendingClarification || pendingDecision || isListening || isThinking) {
      setParsePreview(null);
      return;
    }

    const timer = window.setTimeout(() => {
      fetch('/api/input/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, source: 'text' })
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((result: ParseResult | null) => {
          setParsePreview(result);
        })
        .catch(() => {
          setParsePreview(null);
        });
    }, 260);

    return () => window.clearTimeout(timer);
  }, [input, pendingClarification, pendingDecision, isListening, isThinking]);

  useEffect(() => {
    if (!message || pendingClarification || pendingDecision || pendingPostCommit || pendingModification) return;
    const timer = window.setTimeout(() => setMessage(''), 10_000);
    return () => window.clearTimeout(timer);
  }, [message, pendingClarification, pendingDecision, pendingPostCommit, pendingModification]);

  const calendarDays = useMemo(() => {
    if (data.calendar.length > 0) return data.calendar;
    const weekStart = getWeekStart(new Date());
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return {
        date: toLocalDateText(date),
        label: formatWeekLabel(date),
        items: [],
        pendingItems: [],
        tasks: [],
        reminders: [],
        weatherAlerts: [],
        timeline: []
      };
    });
  }, [data.calendar]);
  const currentWeekDays = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const startText = toLocalDateText(weekStart);
    const endText = toLocalDateText(weekEnd);
    return calendarDays.filter((day) => day.date >= startText && day.date <= endText).slice(0, 7);
  }, [calendarDays]);
  const futureCalendarDays = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const futureEnd = new Date(weekEnd);
    futureEnd.setDate(weekEnd.getDate() + 14);
    const endText = toLocalDateText(weekEnd);
    const futureEndText = toLocalDateText(futureEnd);
    return calendarDays.filter((day) => day.date > endText && day.date <= futureEndText && getDayPlanCount(day) > 0);
  }, [calendarDays]);
  const selectedDay = calendarDays.find((day) => day.date === selectedDate) ?? currentWeekDays[0] ?? calendarDays[0];
  const visibleCalendarDays = useMemo(() => {
    if (calendarFocusMode !== 'future') return currentWeekDays;
    return futureCalendarDays.length > 0 ? futureCalendarDays : [];
  }, [calendarFocusMode, currentWeekDays, futureCalendarDays]);
  const futurePlanCount = useMemo(() => {
    return futureCalendarDays.reduce((sum, day) => sum + getDayPlanCount(day), 0);
  }, [futureCalendarDays]);
  const visibleTodoTasks = useMemo(
    () => data.tasks.map((task) => optimisticTodoStatuses[task.id] ? { ...task, status: optimisticTodoStatuses[task.id] } : task),
    [data.tasks, optimisticTodoStatuses]
  );
  const projectTodoGroups = useMemo(() => buildProjectTodoGroups(data.todoProjects, visibleTodoTasks), [data.todoProjects, visibleTodoTasks]);
  const coreProjectTodoGroups = useMemo(() => getCoreTodoGroups(projectTodoGroups), [projectTodoGroups]);
  const otherProjectTodoGroups = useMemo(() => getOtherTodoGroups(projectTodoGroups), [projectTodoGroups]);
  const visibleProjectTodoGroups = todoProjectPage === 'core' ? coreProjectTodoGroups : otherProjectTodoGroups;
  const monthCalendarDays = useMemo(() => buildMonthCalendarDays(now), [now]);
  const todoDeadlineDates = useMemo(() => new Set(visibleTodoTasks.map((task) => task.dueAt?.slice(0, 10)).filter(Boolean) as string[]), [visibleTodoTasks]);
  const todoDeadlineDots = useMemo(() => buildTodoDeadlineDots(visibleTodoTasks), [visibleTodoTasks]);

  useEffect(() => {
    window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>('.day-schedule').forEach((schedule) => {
        const nowLine = schedule.querySelector<HTMLElement>('.now-line');
        const targetTop = nowLine
          ? nowLine.offsetTop - schedule.clientHeight / 3
          : (7 / 24) * schedule.scrollHeight - 24;
        schedule.scrollTop = Math.max(0, targetTop);
      });
    }, 80);
  }, [visibleCalendarDays.length, calendarFocusMode, now]);

  async function submitInput() {
    await commitInput();
  }

  function startVoiceInput(options: { silent?: boolean } = {}) {
    const SpeechRecognition = (window as WindowWithSpeech).SpeechRecognition ?? (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessage('这个浏览器暂时没有语音识别，先用输入框记录。');
      return;
    }
    recognitionRef.current?.stop();
    if (voiceSilenceTimer.current) window.clearTimeout(voiceSilenceTimer.current);
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      const nextTranscript = transcript.trim();
      setInput(nextTranscript);
      inputRef.current = nextTranscript;
      queueVoiceAutoSubmit();
    };
    recognition.onend = () => {
      setIsListening(false);
      if (voiceSilenceTimer.current) {
        window.clearTimeout(voiceSilenceTimer.current);
        voiceSilenceTimer.current = null;
      }
    };
    recognition.onerror = () => {
      setIsListening(false);
      setMessage('刚才没有听清，可以再点一下小猫。');
    };
    recognitionRef.current = recognition;
    setInput('');
    setIsListening(true);
    if (!options.silent) setMessage('');
    try {
      recognition.start();
    } catch (error) {
      setIsListening(false);
      console.warn('voice recognition start failed', error);
      if (!options.silent) setMessage('刚才没有打开听写，可以再点一下小猫。');
    }
  }

  function restartVoiceInputSoon(delay = 360) {
    window.setTimeout(() => {
      startVoiceInput({ silent: true });
      window.setTimeout(() => {
        if (!isListeningRef.current) startVoiceInput({ silent: true });
      }, 700);
    }, delay);
  }

  function stopVoiceInput() {
    if (voiceSilenceTimer.current) {
      window.clearTimeout(voiceSilenceTimer.current);
      voiceSilenceTimer.current = null;
    }
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function queueVoiceAutoSubmit() {
    if (voiceSilenceTimer.current) window.clearTimeout(voiceSilenceTimer.current);
    voiceSilenceTimer.current = window.setTimeout(async () => {
      const text = inputRef.current.trim();
      if (!text) {
        stopVoiceInput();
        return;
      }
      recognitionRef.current?.stop();
      setIsListening(false);
      const normalizedText = await normalizeVoiceTranscript(text);
      if (normalizedText !== text) {
        setInput(normalizedText);
        inputRef.current = normalizedText;
        await new Promise((resolve) => window.setTimeout(resolve, 360));
      }
      setIsThinking(true);
      void commitInput(undefined, normalizedText, normalizedText !== text ? 'text' : 'voice');
    }, 1000);
  }

  async function normalizeVoiceTranscript(text: string) {
    const response = await fetch('/api/input/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'voice' })
    });
    if (!response.ok) return text;
    const result = (await response.json()) as ParseResult;
    return result.transcription?.correctedText?.trim() || text;
  }

  async function commitInput(selectedOptionId?: string, inputOverride?: string, sourceOverride: 'voice' | 'text' | 'manual' = 'voice') {
    const activeClarification = pendingClarificationRef.current;
    const activeDecision = selectedOptionId ? pendingDecisionRef.current : null;
    const text = buildInputForCommit((inputOverride ?? input).trim(), activeClarification, activeDecision);
    if (!text) return;

    if (!activeClarification && !activeDecision && !selectedOptionId && pendingModification) {
      await applyPostCommitModification(pendingModification, text);
      return;
    }

    if (!activeClarification && !activeDecision && !selectedOptionId && await applyExistingEventChange(text)) {
      setIsThinking(false);
      return;
    }

    if (!activeClarification && !activeDecision && !selectedOptionId && needsIntentCheck(text)) {
      setIsThinking(false);
      setInput('');
      inputRef.current = '';
      setMessage('刚刚这句是要新增安排或任务吗？');
      restartVoiceInputSoon();
      return;
    }

    const response = await fetch('/api/input/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: sourceOverride, selectedOptionId })
    });
    const result = response.ok ? ((await response.json()) as CommitResponse) : null;

    if (response.ok && result?.ok) {
      setIsThinking(false);
      setInput('');
      inputRef.current = '';
      setParsePreview(null);
      setPendingClarification(null);
      setPendingDecision(null);
      const nextAction = createPostCommitAction(result);
      setPendingPostCommit(nextAction);
      setMessage(nextAction ? '' : getCommitMessage(result.parseResult, result.resolvedBy, result.feedback));
      await refreshData();
      if (nextAction) focusWrittenAction(nextAction);
    } else if (result?.needsConfirmation) {
      setIsThinking(false);
      const nextParse = result.parseResult ?? null;
      if (nextParse && getConflictOptions(nextParse).length === 0) {
        setPendingClarification(nextParse);
        setParsePreview(null);
        setInput('');
        inputRef.current = '';
        restartVoiceInputSoon();
      } else {
        setPendingClarification(null);
        setPendingDecision(nextParse);
        setParsePreview(null);
        setInput('');
      }
      setMessage(getCommitMessage(result.parseResult, undefined, result.feedback));
    } else {
      setIsThinking(false);
      setMessage('这条还没记上，等下再试一次。');
    }
  }

  function handleDecisionOption(optionId: string) {
    if (optionId === 'edit-input') {
      const originalText = pendingDecision?.rawText ?? '';
      setPendingDecision(null);
      setInput(originalText);
      inputRef.current = originalText;
      setMessage('');
      restartVoiceInputSoon(160);
      return;
    }
    void commitInput(optionId);
  }

  async function commitQuickProgress(text: string) {
    const response = await fetch('/api/input/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: 'manual' })
    });
    const result = response.ok ? ((await response.json()) as CommitResponse) : null;

    if (response.ok && result?.ok) {
      setMessage(getCommitMessage(result.parseResult, undefined, result.feedback));
      await refreshData();
    } else {
      setMessage('这条进度还没记上，等下再试一次。');
    }
  }

  async function callAction(path: string, body: Record<string, unknown> = {}) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      await refreshData();
      setMessage('状态更新好了。');
    } else {
      setMessage('这一步没有成功，稍后再试。');
    }
  }

  function openDetail(item: DetailTarget) {
    setSelectedDetail(item);
    setSelectedLog(null);
    setLogDraft(null);
    setDetailDraft(createDetailDraft(item, selectedDate));
  }

  function openDetailFromRow(event: ReactMouseEvent<HTMLElement>, item: DetailTarget) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('button, input, textarea, select, .detail-editor, .detail-actions')
    ) {
      return;
    }
    openDetail(item);
  }

  async function deleteItem(item: DetailTarget) {
    if (item.kind === 'task') removeTaskFromView(item.id);
    else removeEventFromView(item.id);
    setSelectedDetail(null);
    setDetailDraft(null);
    setMessage('已删除，这条不会再出现在安排里。');
    const path = item.kind === 'task' ? `/api/tasks/${item.id}` : `/api/events/${item.id}`;
    const response = await fetch(path, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('删除没有成功，等下再试一次。');
      await refreshData();
    }
  }

  async function saveItemDraft() {
    if (!selectedDetail || !detailDraft) return;
    const path = selectedDetail.kind === 'task' ? `/api/tasks/${selectedDetail.id}` : `/api/events/${selectedDetail.id}`;
    const body =
      selectedDetail.kind === 'task'
        ? {
            title: detailDraft.title,
            dueAt: combineLocalDateTime(detailDraft.dueDate, detailDraft.dueTime),
            estimatedMinutes: detailDraft.estimatedMinutes ? Number(detailDraft.estimatedMinutes) : null,
            preparations: splitPreparations(detailDraft.preparationsText)
          }
        : {
            title: detailDraft.title,
            preparations: splitPreparations(detailDraft.preparationsText),
            date: detailDraft.date,
            startAt: combineLocalDateTime(detailDraft.date, detailDraft.startTime),
            endAt: combineLocalDateTime(detailDraft.date, detailDraft.endTime)
          };
    const response = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (response.ok) {
      setSelectedDetail(null);
      setDetailDraft(null);
      setMessage('修改好了。');
      await refreshData();
    } else {
      setMessage('修改没有成功，等下再试一次。');
    }
  }

  function openLog(log: CalendarLog) {
    setSelectedLog(log);
    setSelectedDetail(null);
    setDetailDraft(null);
    setLogDraft(createLogDraft(log, selectedDate));
  }

  async function saveLogDraft() {
    if (!selectedLog || !logDraft) return;
    const response = await fetch(`/api/work-logs/${selectedLog.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: logDraft.note, at: combineLocalDateTime(logDraft.date, logDraft.time) })
    });
    if (response.ok) {
      setSelectedLog(null);
      setLogDraft(null);
      setMessage('执行记录改好了。');
      await refreshData();
    } else {
      setMessage('执行记录没有改成功，等下再试一次。');
    }
  }

  async function deleteLog(log: CalendarLog) {
    removeLogFromView(log.id);
    setSelectedLog(null);
    setLogDraft(null);
    setMessage('执行记录已删除。');
    const response = await fetch(`/api/work-logs/${log.id}`, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('执行记录没有删掉，等下再试一次。');
      await refreshData();
    }
  }

  async function createGoalFromForm() {
    const title = goalTitle.trim();
    if (!title) {
      setMessage('目标标题还空着。');
      return;
    }
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, targetDate: goalTargetDate || null })
    });
    if (response.ok) {
      setGoalTitle('');
      setGoalTargetDate('');
      setMessage('阶段性目标已加入。');
      await refreshData();
    } else {
      setMessage('目标还没加上，稍后再试。');
    }
  }

  async function updateGoal(id: string, status: GoalRecord['status']) {
    const response = await fetch(`/api/goals/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      setMessage(status === 'done' ? '目标完成记录好了。' : '目标状态已更新。');
      await refreshData();
    }
  }

  async function refreshDataWithTransition() {
    const startViewTransition = (document as Document & { startViewTransition?: (callback: () => Promise<void>) => void }).startViewTransition;
    if (startViewTransition) {
      startViewTransition(async () => {
        await refreshData();
      });
      return;
    }
    await refreshData();
  }

  async function updateTodoTaskStatus(task: TaskListItem, status: TaskListItem['status']) {
    setOptimisticTodoStatuses((current) => ({ ...current, [task.id]: status }));
    patchTodoTaskInView(task.id, { status });
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.ok) {
      setMessage(status === 'done' ? '这条待办完成了，已收到底部。' : '这条待办已恢复。');
      await refreshDataWithTransition();
      setOptimisticTodoStatuses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
    } else {
      setMessage('待办状态没有更新成功，稍后再试。');
      setOptimisticTodoStatuses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      await refreshData();
    }
  }

  async function createBlankTodoProject() {
    const response = await fetch('/api/todo-projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '新项目' })
    });
    if (response.ok) {
      const result = (await response.json()) as { project?: TodoProject };
      if (result.project) {
        setTodoProjectPage('other');
        setEditingProjectId(result.project.id);
        setProjectTitleDraft(result.project.title);
      }
      setMessage('项目分类加好了，可以直接改标题。');
      await refreshData();
    } else {
      setMessage('项目分类没有加上，稍后再试。');
    }
  }

  function startEditTodoProject(project: TodoProject) {
    setEditingProjectId(project.id);
    setProjectTitleDraft(project.title);
  }

  async function saveTodoProjectTitle(projectId: string, options: { focusNewTask?: boolean } = {}) {
    const title = projectTitleDraft.trim();
    if (!title) {
      setMessage('项目分类名称还空着。');
      return;
    }
    if (projectId === 'uncategorized') {
      const response = await fetch('/api/todo-projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });
      if (response.ok) {
        const result = (await response.json()) as { project?: TodoProject };
        if (result.project) {
          const uncategorizedTasks = data.tasks.filter((task) => task.projectId === 'uncategorized');
          await Promise.all(
            uncategorizedTasks.map((task) =>
              fetch(`/api/tasks/${task.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: result.project!.id })
              })
            )
          );
        }
        setEditingProjectId(null);
        setProjectTitleDraft('');
        setMessage('未归类已经改成新的项目分类。');
        await refreshData();
        if (options.focusNewTask && result.project) startNewTodoTask(result.project.id);
      }
      return;
    }

    patchTodoProjectInView(projectId, { title });
    setEditingProjectId(null);
    setProjectTitleDraft('');
    if (options.focusNewTask) startNewTodoTask(projectId);
    const response = await fetch(`/api/todo-projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (response.ok) {
      setMessage('项目分类已更新。');
      void refreshData();
    } else {
      setMessage('项目分类没有改成功，稍后再试。');
      await refreshData();
    }
  }

  async function deleteTodoProject(project: TodoProject) {
    if (project.id === 'uncategorized') return;
    removeTodoProjectFromView(project.id);
    setMessage('项目分类已删除，原有待办已移到未归类。');
    const response = await fetch(`/api/todo-projects/${project.id}`, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('项目分类没有删掉，稍后再试。');
      await refreshData();
    }
  }

  function updateNewTodoTaskDraft(projectId: string, patch: Partial<TodoTaskDraft>) {
    setNewTaskDraftByProject((drafts) => ({
      ...drafts,
      [projectId]: { ...(drafts[projectId] ?? { title: '', notes: '', projectId }), ...patch }
    }));
  }

  function startNewTodoTask(projectId: string) {
    setActiveNewTaskProjectId(projectId);
    updateNewTodoTaskDraft(projectId, { projectId });
    window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(`[data-new-task-project="${projectId}"]`)?.focus();
    }, 60);
  }

  async function createTodoTaskFromProject(projectId: string) {
    const draft = newTaskDraftByProject[projectId] ?? { title: '', notes: '', projectId };
    const title = draft.title.trim();
    if (!title) {
      setMessage('待办内容还空着。');
      return;
    }
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes: draft.notes.trim() || undefined,
        projectId: projectId === 'uncategorized' ? null : projectId
      })
    });
    if (response.ok) {
      setNewTaskDraftByProject((drafts) => ({ ...drafts, [projectId]: { title: '', notes: '', projectId } }));
      setActiveNewTaskProjectId(null);
      setMessage('待办加好了。');
      await refreshData();
    } else {
      setMessage('待办没有加上，稍后再试。');
    }
  }

  function startEditTodoTask(task: TaskListItem, field: TodoEditField) {
    setEditingTodoTaskId(task.id);
    setEditingTodoField(field);
    setTodoTaskDraft({
      title: task.title,
      notes: stripTodoDateTags(task.notes ?? ''),
      projectId: task.projectId
    });
  }

  async function saveTodoTaskDraft(taskId: string) {
    const title = todoTaskDraft.title.trim();
    if (!title) {
      setMessage('待办内容还空着。');
      return;
    }
    const notes = todoTaskDraft.notes.trim() || '';
    const projectId = todoTaskDraft.projectId === 'uncategorized' ? 'uncategorized' : todoTaskDraft.projectId;
    patchTodoTaskInView(taskId, { title, notes, projectId });
    setEditingTodoTaskId(null);
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes,
        projectId: todoTaskDraft.projectId === 'uncategorized' ? null : todoTaskDraft.projectId
      })
    });
    if (response.ok) {
      setMessage('待办已更新。');
      void refreshData();
    } else {
      setMessage('待办没有改成功，稍后再试。');
      await refreshData();
    }
  }

  async function deleteTodoTask(task: TaskListItem) {
    removeTaskFromView(task.id);
    setEditingTodoTaskId((current) => (current === task.id ? null : current));
    setMessage('待办已删除。');
    const response = await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' });
    if (response.ok) {
      void refreshData();
    } else {
      setMessage('待办没有删掉，稍后再试。');
      await refreshData();
    }
  }

  async function moveTodoTaskToProject(task: TaskListItem, projectId: string) {
    if (task.projectId === projectId) return;
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId === 'uncategorized' ? null : projectId })
    });
    if (response.ok) {
      setDraggedTodoTaskId(null);
      setMessage('待办已移动到新的项目。');
      await refreshDataWithTransition();
    } else {
      setMessage('待办没有移动成功，稍后再试。');
    }
  }

  async function assignTodoDeadline(task: TaskListItem, date: string) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt: `${date}T15:59:00.000Z` })
    });
    if (response.ok) {
      setDraggedTodoTaskId(null);
      setMessage(`已把“${task.title}”链接到 ${date} 截止。`);
      await refreshData();
    } else {
      setMessage('截止日期没有更新成功，稍后再试。');
    }
  }

  async function clearTodoDeadline(task: TaskListItem) {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt: null })
    });
    if (response.ok) {
      setMessage('截止日期已移除。');
      await refreshData();
    } else {
      setMessage('截止日期没有删掉，稍后再试。');
    }
  }

  function startTodoDrag(event: { dataTransfer: DataTransfer }, task: TaskListItem) {
    setDraggedTodoTaskId(task.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task.id);
  }

  function getDraggedTodoTask(event: { dataTransfer: DataTransfer }) {
    const id = event.dataTransfer.getData('text/plain') || draggedTodoTaskId;
    return data.tasks.find((item) => item.id === id) ?? null;
  }

  async function generateSummary(kind: 'daily' | 'weekly') {
    const response = await fetch('/api/summaries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind })
    });
    if (response.ok) {
      const result = (await response.json()) as { file: string; title: string };
      setSummaryMessage(`已生成：${result.title} | ${result.file}`);
      setMessage('Markdown 总结已经写回本地。');
    } else {
      setSummaryMessage('总结生成失败，稍后再试。');
    }
  }

  function startCatDrag(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    function moveCat(moveEvent: MouseEvent) {
      if (!moved && Math.abs(moveEvent.clientX - startX) <= 6 && Math.abs(moveEvent.clientY - startY) <= 6) return;
      moved = true;
      setCatPosition({
        left: Math.min(window.innerWidth - rect.width, Math.max(12, moveEvent.clientX - offsetX)),
        top: Math.min(window.innerHeight - rect.height, Math.max(12, moveEvent.clientY - offsetY))
      });
    }

    function stopDrag() {
      window.removeEventListener('mousemove', moveCat);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('blur', stopDrag);
      if (!moved) startVoiceInput();
    }

    window.addEventListener('mousemove', moveCat);
    window.addEventListener('mouseup', stopDrag);
    window.addEventListener('blur', stopDrag);
  }

  function startEventAdjust(
    event: ReactMouseEvent<HTMLElement>,
    item: CalendarItem,
    date: string,
    mode: 'move' | 'resize-start' | 'resize-end'
  ) {
    if (!item.startAt || !item.endAt) return;
    event.preventDefault();
    event.stopPropagation();

    const schedule = event.currentTarget.closest('.schedule-inner') as HTMLElement | null;
    if (!schedule) return;
    const rect = schedule.getBoundingClientRect();
    const start = new Date(item.startAt);
    const end = new Date(item.endAt);
    const originalStart = getMinutesFromDayStart(start);
    const originalEnd = getMinutesFromDayStart(end);
    const duration = Math.max(30, originalEnd - originalStart);
    const pointerStartMinute = minuteFromClientY(event.clientY, rect);
    let moved = false;

    async function saveAdjusted(nextStartMinute: number, nextEndMinute: number) {
      const startAt = makeLocalDateTime(date, nextStartMinute);
      const endAt = makeLocalDateTime(date, nextEndMinute);
      const response = await fetch(`/api/events/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, startAt, endAt })
      });
      if (response.ok) {
        setMessage('时间已经按半小时刻度调整好了。');
        await refreshData();
        setDragPreview(null);
      } else {
        setDragPreview(null);
        setMessage('时间调整没有保存成功，等下再试一次。');
      }
    }

    function moveEvent(moveEvent: MouseEvent) {
      moved = true;
      const currentMinute = minuteFromClientY(moveEvent.clientY, rect);
      const delta = snapToHalfHour(currentMinute - pointerStartMinute);
      let nextStart = originalStart;
      let nextEnd = originalEnd;
      if (mode === 'move') {
        nextStart = clampMinute(snapToHalfHour(originalStart + delta));
        nextEnd = nextStart + duration;
        if (nextEnd > dayMinutes) {
          nextEnd = dayMinutes;
          nextStart = Math.max(0, nextEnd - duration);
        }
      }
      if (mode === 'resize-start') {
        nextStart = clampMinute(Math.min(originalEnd - 30, snapToHalfHour(currentMinute)));
      }
      if (mode === 'resize-end') {
        nextEnd = clampMinute(Math.max(originalStart + 30, snapToHalfHour(currentMinute)));
      }
      const previewStart = makeLocalDateTime(date, nextStart);
      const previewEnd = makeLocalDateTime(date, nextEnd);
      setDragPreview({ id: item.id, startAt: previewStart, endAt: previewEnd });
      setSelectedDetail((current) =>
        current?.id === item.id ? { ...current, startAt: previewStart, endAt: previewEnd, date, kind: 'event' } : current
      );
    }

    function stopDrag(stopEvent: MouseEvent) {
      window.removeEventListener('mousemove', moveEvent);
      window.removeEventListener('mouseup', stopDrag);
      if (!moved) {
        setDragPreview(null);
        return;
      }
      const currentMinute = minuteFromClientY(stopEvent.clientY, rect);
      const delta = snapToHalfHour(currentMinute - pointerStartMinute);
      let nextStart = originalStart;
      let nextEnd = originalEnd;
      if (mode === 'move') {
        nextStart = clampMinute(snapToHalfHour(originalStart + delta));
        nextEnd = nextStart + duration;
        if (nextEnd > dayMinutes) {
          nextEnd = dayMinutes;
          nextStart = Math.max(0, nextEnd - duration);
        }
      } else if (mode === 'resize-start') {
        nextStart = clampMinute(Math.min(originalEnd - 30, snapToHalfHour(currentMinute)));
      } else {
        nextEnd = clampMinute(Math.max(originalStart + 30, snapToHalfHour(currentMinute)));
      }
      void saveAdjusted(nextStart, nextEnd);
    }

    window.addEventListener('mousemove', moveEvent);
    window.addEventListener('mouseup', stopDrag);
  }

  function startPanelResize(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;

    function movePanel(moveEvent: MouseEvent) {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(Math.min(460, Math.max(280, nextWidth)));
    }

    function stopPanelResize() {
      window.removeEventListener('mousemove', movePanel);
      window.removeEventListener('mouseup', stopPanelResize);
    }

    window.addEventListener('mousemove', movePanel);
    window.addEventListener('mouseup', stopPanelResize);
  }

  function updateDetailDatePart(field: 'date' | 'dueDate', part: 'month' | 'day', value: string) {
    const numeric = value.replace(/\D/g, '').slice(0, 2);
    const nextNumber = Number(numeric);
    if (!numeric || Number.isNaN(nextNumber)) return;
    setDetailDraft((draft) => {
      if (!draft) return draft;
      const [yearText, monthText, dayText] = draft[field].split('-');
      const currentYear = Number(yearText) || new Date().getFullYear();
      const currentMonth = Number(monthText) || 1;
      const currentDay = Number(dayText) || 1;
      const nextMonth = part === 'month' ? Math.min(12, Math.max(1, nextNumber)) : currentMonth;
      const maxDay = new Date(currentYear, nextMonth, 0).getDate();
      const nextDay = part === 'day' ? Math.min(maxDay, Math.max(1, nextNumber)) : Math.min(currentDay, maxDay);
      return { ...draft, [field]: `${currentYear}-${String(nextMonth).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}` };
    });
  }

  function renderInlineDetailEditor(item: DetailTarget) {
    if (!detailDraft || selectedDetail?.id !== item.id || selectedDetail.kind !== item.kind) return null;

    return (
      <div
        className="detail-editor inline-detail-editor"
        onBlur={(event) => {
          const nextTarget = event.relatedTarget;
          if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
          void saveItemDraft();
        }}
      >
        <label>
          标题
          <input value={detailDraft.title} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, title: event.target.value })} />
        </label>
        {item.kind === 'event' ? (
          <>
            <div className="detail-date-time-row">
              <label>
                月
                <input inputMode="numeric" value={getDatePart(detailDraft.date, 'month')} onChange={(event) => updateDetailDatePart('date', 'month', event.target.value)} />
              </label>
              <label>
                日
                <input inputMode="numeric" value={getDatePart(detailDraft.date, 'day')} onChange={(event) => updateDetailDatePart('date', 'day', event.target.value)} />
              </label>
              <label>
                开始
                <input type="time" step="1800" value={detailDraft.startTime} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, startTime: event.target.value })} />
              </label>
              <label>
                结束
                <input type="time" step="1800" value={detailDraft.endTime} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, endTime: event.target.value })} />
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="detail-date-time-row">
              <label>
                月
                <input inputMode="numeric" value={getDatePart(detailDraft.dueDate, 'month')} onChange={(event) => updateDetailDatePart('dueDate', 'month', event.target.value)} />
              </label>
              <label>
                日
                <input inputMode="numeric" value={getDatePart(detailDraft.dueDate, 'day')} onChange={(event) => updateDetailDatePart('dueDate', 'day', event.target.value)} />
              </label>
              <label>
                截止时间
                <input type="time" step="1800" value={detailDraft.dueTime} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, dueTime: event.target.value })} />
              </label>
            </div>
            <label>
              估时分钟
              <input inputMode="numeric" value={detailDraft.estimatedMinutes} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, estimatedMinutes: event.target.value.replace(/\D/g, '') })} />
            </label>
          </>
        )}
        <label>
          准备事项
          <textarea rows={1} value={detailDraft.preparationsText} onChange={(event) => setDetailDraft((draft) => draft && { ...draft, preparationsText: event.target.value })} />
        </label>
        <div className="detail-actions">
          <button onClick={saveItemDraft}>保存</button>
          <button onClick={() => {
            setSelectedDetail(null);
            setDetailDraft(null);
          }}>取消</button>
          <button className="danger-button" onClick={() => deleteItem(item)}>删除</button>
        </div>
      </div>
    );
  }

  const hasActiveCatContent = Boolean(
    message ||
    pendingClarification ||
    pendingDecision ||
    pendingPostCommit ||
    pendingModification ||
    parsePreview ||
    input ||
    isListening ||
    isThinking
  );
  const shouldShowCatDialog = hasActiveCatContent;

  if (authRequired && !authSession) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-brand">
            <span>Yaya</span>
            <span>Mind</span>
          </div>
          <form className="auth-form" onSubmit={submitAuth}>
            <p className="eyebrow">{authMode === 'login' ? '登录账号' : '创建账号'}</p>
            <h1>{authMode === 'login' ? '打开你的个人助手' : '第一次使用 YayaMind'}</h1>
            <label>
              邮箱
              <input type="email" value={authEmail} autoComplete="email" onChange={(event) => setAuthEmail(event.target.value)} required />
            </label>
            <label>
              密码
              <input type="password" value={authPassword} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} minLength={6} onChange={(event) => setAuthPassword(event.target.value)} required />
            </label>
            {authMessage ? <p className="auth-message">{authMessage}</p> : null}
            <button className="auth-submit" type="submit" disabled={isAuthSubmitting}>
              {isAuthSubmitting ? '处理中' : authMode === 'login' ? '登录' : '注册并进入'}
            </button>
            <button
              className="auth-switch"
              type="button"
              onClick={() => {
                setAuthMode((mode) => (mode === 'login' ? 'signup' : 'login'));
                setAuthMessage('');
              }}
            >
              {authMode === 'login' ? '第一次用，创建账号' : '已有账号，返回登录'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${draggedTodoTaskId ? 'todo-dragging' : ''}`} style={{ gridTemplateColumns: `76px minmax(0, 1fr) 8px ${rightPanelWidth}px` }}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-text"><span>Yaya</span><span>Mind</span></span>
        </div>
        {[
          ['□', '一周', 'week'],
          ['✓', '待办', 'todos'],
          ['✦', '目标', 'goals'],
          ['♡', '画像', 'profile'],
          ['↺', '总结', 'summary']
        ].map(([icon, item, mode]) => (
          <button className={`nav-item ${viewMode === mode ? 'nav-active' : ''}`} key={item} title={item} onClick={() => setViewMode(mode as ViewMode)}>
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{item}</span>
          </button>
        ))}
        {authSession ? (
          <button className="nav-item logout-button" title="退出账号" onClick={logout}>
            <span className="nav-icon">↩</span>
            <span className="nav-label">退出</span>
          </button>
        ) : null}
      </aside>

      <section className="calendar-panel">
        {viewMode === 'week' ? (
          <>
            <header className="panel-header calendar-toolbar">
              <p className="eyebrow">一周日程</p>
              <div className="calendar-actions">
                {calendarFocusMode === 'future' ? (
                  <button onClick={() => {
                    setCalendarFocusMode('week');
                    setSelectedDate(toLocalDateText(new Date()));
                  }}>
                    回到今天
                  </button>
                ) : null}
                <button onClick={() => setCalendarFocusMode((mode) => mode === 'future' ? 'week' : 'future')}>
                  {calendarFocusMode === 'future' ? '一周' : `未来 ${futurePlanCount}`}
                  <span>›</span>
                </button>
              </div>
            </header>

            <div className={`calendar-grid ${calendarFocusMode === 'future' ? 'calendar-grid-future' : ''}`} style={{ gridTemplateColumns: `repeat(${calendarFocusMode === 'future' ? 7 : Math.max(1, visibleCalendarDays.length)}, minmax(0, 1fr))` }}>
          {visibleCalendarDays.length ? visibleCalendarDays.map((day) => (
            <article data-date={day.date} className={`day-column ${getDayStateClass(day.date, now)} ${day.date === selectedDate ? 'day-selected' : ''}`} key={day.date} onClick={() => selectCalendarDate(day.date)}>
              <h2>
                <span>{getWeekdayText(day.label)}</span>
                <small>{getDateText(day.label)}</small>
              </h2>
              <div className="day-schedule">
                <div className="schedule-inner">
                <div className="time-guide">
                  {getMinorTimeMarks().map((minutes) => (
                    <i key={minutes} style={getMinuteMarkStyle(minutes)} />
                  ))}
                  {getHourMarks().map((hour) => (
                    <span key={hour} style={getHourMarkStyle(hour)}>{hour}:00</span>
                  ))}
                </div>
                {isToday(day.date, now) ? (
                  <>
                    <div className="past-shade" style={getPastShadeStyle(now)} />
                    <div className="now-line" style={getNowLineStyle(now)} />
                  </>
                ) : null}
                {day.items.length > 0 ? (
                  day.items.map((item) => (
                    <button
                      data-event-id={item.id}
                      className={`event-card event-${item.type} ${Number(item.laneCount ?? 1) > 1 ? 'event-compact' : ''} ${item.conflict ? 'event-conflict' : ''}`}
                      key={item.id}
                      draggable={false}
                      style={getEventStyle(dragPreview?.id === item.id ? dragPreview.startAt : item.startAt, dragPreview?.id === item.id ? dragPreview.endAt : item.endAt, item.lane, item.laneCount)}
                      onMouseDown={(event) => startEventAdjust(event, item, day.date, 'move')}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectCalendarDate(day.date);
                      }}
                    >
                      <span
                        className="resize-handle resize-start"
                        onMouseDown={(event) => startEventAdjust(event, item, day.date, 'resize-start')}
                      />
                      <strong>{getShortTitle(item.title)}</strong>
                      {item.conflict ? <i>冲突</i> : null}
                      <span
                        className="resize-handle resize-end"
                        onMouseDown={(event) => startEventAdjust(event, item, day.date, 'resize-end')}
                      />
                    </button>
                  ))
                ) : null}
                </div>
              </div>
            </article>
          )) : (
            <div className="empty-future">
              <strong>还没有本周以后的安排</strong>
              <span>说一句“下周四下午三点开会”，这里就会出现。</span>
            </div>
          )}
            </div>
          </>
        ) : null}

        {viewMode === 'todos' ? (
          <section className="workspace-view todo-view">
            <header className="panel-header todo-toolbar">
              <p className="eyebrow">项目待办</p>
              <div className="todo-toolbar-actions">
                {otherProjectTodoGroups.length ? (
                  <button className="todo-page-toggle" onClick={() => setTodoProjectPage((page) => (page === 'core' ? 'other' : 'core'))}>
                    {todoProjectPage === 'core' ? `其他项目 ${otherProjectTodoGroups.length}` : '核心项目'}
                    <span>›</span>
                  </button>
                ) : null}
                <button className="todo-add-project" onClick={createBlankTodoProject}>
                  <span>＋</span>
                  新增项目
                </button>
              </div>
            </header>
            <div className="project-todo-list">
              {visibleProjectTodoGroups.length ? (
                visibleProjectTodoGroups.map((group) => (
                  <section
                    className="project-todo-group"
                    key={group.projectId}
                    style={{ '--project-color': group.color } as CSSProperties}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const task = getDraggedTodoTask(event);
                      if (task) void moveTodoTaskToProject(task, group.projectId);
                    }}
                  >
                    <div className="project-todo-head">
                      {editingProjectId === group.projectId ? (
                        <input
                          value={projectTitleDraft}
                          onChange={(event) => setProjectTitleDraft(event.target.value)}
                          autoFocus
                          onBlur={() => {
                            void saveTodoProjectTitle(group.projectId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void saveTodoProjectTitle(group.projectId, { focusNewTask: true });
                          }}
                        />
                      ) : (
                        <strong onClick={() => startEditTodoProject(group.project)}>{group.projectTitle}</strong>
                      )}
                      <span>{group.openCount} / {group.tasks.length}</span>
                      <div className="todo-inline-actions">
                        <button disabled={group.projectId === 'uncategorized'} onClick={() => deleteTodoProject(group.project)}>
                          删除
                        </button>
                      </div>
                    </div>
                    {activeNewTaskProjectId === group.projectId ? (
                    <div className="todo-task-form">
                      <input
                        data-new-task-project={group.projectId}
                        value={newTaskDraftByProject[group.projectId]?.title ?? ''}
                        onChange={(event) => updateNewTodoTaskDraft(group.projectId, { title: event.target.value })}
                        placeholder=""
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void createTodoTaskFromProject(group.projectId);
                        }}
                      />
                      <input
                        value={newTaskDraftByProject[group.projectId]?.notes ?? ''}
                        onChange={(event) => updateNewTodoTaskDraft(group.projectId, { notes: event.target.value })}
                        placeholder=""
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void createTodoTaskFromProject(group.projectId);
                        }}
                      />
                    </div>
                    ) : null}
                    <div className="project-todo-items">
                      {group.tasks.length === 0 && activeNewTaskProjectId !== group.projectId ? (
                        <button className="todo-empty-start" onClick={() => startNewTodoTask(group.projectId)}>
                          写第一条待办
                        </button>
                      ) : null}
                      {group.tasks.map((task) => {
                        const isDone = task.status === 'done';
                        return (
                          <article
                            data-task-id={task.id}
                            className={`project-todo-item ${isDone ? 'todo-done' : ''}`}
                            key={task.id}
                            draggable
                            onDragStart={(event) => startTodoDrag(event, task)}
                            onDragEnd={() => setDraggedTodoTaskId(null)}
                            style={{ viewTransitionName: `todo-${task.id}`, '--project-color': getProjectColor(task.projectId) } as CSSProperties}
                          >
                            <button
                              className="todo-check"
                              aria-label={isDone ? '恢复待办' : '完成待办'}
                              type="button"
                              draggable={false}
                              onMouseDown={(event) => event.stopPropagation()}
                              onDragStart={(event) => event.preventDefault()}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void updateTodoTaskStatus(task, isDone ? 'todo' : 'done');
                              }}
                            >
                              {isDone ? '✓' : ''}
                            </button>
                            <div className="todo-copy">
                              {editingTodoTaskId === task.id && editingTodoField === 'title' ? (
                                <input
                                  className="todo-title-editor"
                                  value={todoTaskDraft.title}
                                  onChange={(event) => setTodoTaskDraft((draft) => ({ ...draft, title: event.target.value }))}
                                  autoFocus
                                  onBlur={() => {
                                    void saveTodoTaskDraft(task.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      void saveTodoTaskDraft(task.id).then(() => startNewTodoTask(task.projectId));
                                    }
                                  }}
                                />
                              ) : (
                                <span onClick={() => startEditTodoTask(task, 'title')}>{task.title}</span>
                              )}
                              {editingTodoTaskId === task.id && editingTodoField === 'notes' ? (
                                <input
                                  className="todo-note-editor"
                                  value={todoTaskDraft.notes}
                                  onChange={(event) => setTodoTaskDraft((draft) => ({ ...draft, notes: event.target.value }))}
                                  placeholder="备注"
                                  autoFocus
                                  onBlur={() => {
                                    void saveTodoTaskDraft(task.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') void saveTodoTaskDraft(task.id);
                                  }}
                                />
                              ) : (
                                <small onClick={() => startEditTodoTask(task, 'notes')}>{formatTodoMeta(task)}</small>
                              )}
                              {getTodoDateTag(task) ? (
                                <button className="todo-date-tag" style={getTodoDateTagStyle(task)} onClick={() => clearTodoDeadline(task)}>
                                  <span>{getTodoDateTag(task)}</span>
                                  <b>×</b>
                                </button>
                              ) : null}
                            </div>
                            <div className="todo-inline-actions todo-row-actions">
                              <button onClick={() => deleteTodoTask(task)}>删除</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))
              ) : (
                <p className="muted">还没有待办任务。说一句“我要写完产品方案”，这里就会出现。</p>
              )}
            </div>
          </section>
        ) : null}

        {viewMode === 'goals' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <p className="eyebrow">阶段性目标</p>
                <h1>目标和里程碑</h1>
              </div>
            </header>
            <div className="goal-form">
              <input value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} placeholder="新增一个阶段性目标" />
              <input value={goalTargetDate} onChange={(event) => setGoalTargetDate(event.target.value)} type="date" />
              <button onClick={createGoalFromForm}>添加目标</button>
            </div>
            <div className="workspace-list">
              {data.goals.length ? (
                data.goals.map((goal) => (
                  <article className="workspace-card" key={goal.id}>
                    <strong>{goal.title}</strong>
                    <span>{goal.targetDate ? `目标日期：${goal.targetDate}` : '未设置目标日期'}</span>
                    <small>{getGoalStatusLabel(goal.status)}</small>
                    <div className="card-actions">
                      <button onClick={() => updateGoal(goal.id, 'done')}>瀹屾垚</button>
                      <button onClick={() => updateGoal(goal.id, goal.status === 'paused' ? 'active' : 'paused')}>{goal.status === 'paused' ? '恢复' : '暂停'}</button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="muted">还没有阶段性目标。先加一个最重要的方向。</p>
              )}
            </div>
          </section>
        ) : null}

        {viewMode === 'profile' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <p className="eyebrow">个人画像</p>
                <h1>习惯信号</h1>
              </div>
            </header>
            <div className="profile-grid">
              <ProfileBlock title="时间习惯" items={[...data.profile.timeHabits.highFocusWindows, ...data.profile.timeHabits.commonDelayWindows]} empty="还在观察你的高效和拖延时段。" />
              <ProfileBlock title="估时模式" items={[...data.profile.estimationPatterns.bufferRules, ...data.profile.estimationPatterns.oftenUnderestimatedTags]} empty="还没有稳定的估时模式。" />
              <ProfileBlock title="生活节奏" items={[...data.profile.lifeRhythm.regularMeals, ...data.profile.lifeRhythm.exercisePreferences, ...data.profile.lifeRhythm.restPatterns]} empty="还没有生活节奏记录。" />
              <ProfileBlock title="近期信号" items={data.profile.signals} empty="继续记录执行过程后，这里会逐渐丰富。" />
            </div>
          </section>
        ) : null}

        {viewMode === 'summary' ? (
          <section className="workspace-view">
            <header className="panel-header">
              <div>
                <p className="eyebrow">总结</p>
                <h1>Markdown 输出</h1>
              </div>
            </header>
            <div className="summary-actions">
              <button onClick={() => generateSummary('daily')}>生成今日总结</button>
              <button onClick={() => generateSummary('weekly')}>生成本周总结</button>
            </div>
            <p className="summary-message">{summaryMessage || '总结会写入 personal-assistant-data/summaries，方便放回 Obsidian 阅读。'}</p>
          </section>
        ) : null}
      </section>

      <div className="panel-resizer" onMouseDown={startPanelResize} title="拖动调整右侧宽度" />
      <aside className="today-panel">
        {viewMode === 'todos' ? (
          <section className="todo-month-panel">
            <p className="eyebrow">{now.getFullYear()} 年 {now.getMonth() + 1} 月</p>
            <div className="todo-month-weekdays">
              {['一', '二', '三', '四', '五', '六', '日'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="todo-month-grid">
              {monthCalendarDays.map((day) => (
                <button
                  className={`todo-month-day ${day.inMonth ? '' : 'todo-month-muted'} ${todoDeadlineDates.has(day.date) ? 'todo-month-deadline' : ''}`}
                  key={day.date}
                  onClick={() => selectCalendarDate(day.date)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const task = getDraggedTodoTask(event);
                    if (task) void assignTodoDeadline(task, day.date);
                  }}
                >
                  <span>{day.day}</span>
                  {todoDeadlineDots.get(day.date)?.length ? (
                    <i className="todo-month-dots">
                      {todoDeadlineDots.get(day.date)!.slice(0, 8).map((color, index) => (
                        <b key={`${color}_${index}`} style={{ backgroundColor: color }} />
                      ))}
                    </i>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
        <section>
          <h2>{selectedDay ? formatSelectedDayTitle(selectedDay.label) : '选择一天'}</h2>
        </section>

        <section>
          {selectedDay?.items.length ? (
            selectedDay.items
              .slice()
              .sort((a, b) => (a.startAt ?? a.dueAt ?? '').localeCompare(b.startAt ?? b.dueAt ?? ''))
              .map((item) => (
                <article
                  className={`detail-row ${item.conflict ? 'detail-row-conflict' : ''}`}
                  key={item.id}
                  onClick={(event) => openDetailFromRow(event, { ...item, kind: 'event' })}
                >
                  <div className="detail-row-head">
                    <div>
                      <strong>{formatItemTime(item)}</strong>
                      <span>标题：{item.title}</span>
                      {getCompactItemMeta(item) ? <small>{getCompactItemMeta(item)}</small> : null}
                    </div>
                  </div>
                  {renderDetailExtras(item)}
                  {renderInlineDetailEditor({ ...item, kind: 'event' })}
                </article>
              ))
          ) : (
            <p className="muted">这天暂时没有明确时间块。</p>
          )}
        </section>

        {selectedDay && [...selectedDay.pendingItems, ...selectedDay.tasks.filter(needsTaskClarification)].length ? (
          <section>
            <p className="eyebrow">待补充事项</p>
            {[...selectedDay.pendingItems, ...selectedDay.tasks.filter(needsTaskClarification)]
              .slice()
              .map((item) => (
                <article
                  className="detail-row detail-row-pending"
                  key={item.id}
                  onClick={(event) => openDetailFromRow(event, { ...item, kind: item.type === 'task' ? 'task' : 'event' })}
                >
                  <div className="detail-row-head">
                    <div>
                      <strong>{getPendingItemLabel(item)}</strong>
                      <span>{item.title}</span>
                      <small>{getPendingItemHint(item)}</small>
                    </div>
                  </div>
                  {renderDetailExtras(item)}
                  {renderInlineDetailEditor({ ...item, kind: item.type === 'task' ? 'task' : 'event' })}
                </article>
              ))}
          </section>
        ) : null}

        {selectedDay?.tasks.filter((item) => !needsTaskClarification(item)).length ? (
          <section>
            <p className="eyebrow">截止任务</p>
            {selectedDay.tasks
              .filter((item) => !needsTaskClarification(item))
              .slice()
              .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
              .map((item) => (
                <article className="detail-row detail-row-deadline" key={item.id} onClick={(event) => openDetailFromRow(event, { ...item, kind: 'task' })}>
                  <div className="detail-row-head">
                    <div>
                      <strong>{formatItemTime(item)}</strong>
                      <span>{item.title}</span>
                      <small>截止任务</small>
                    </div>
                  </div>
                  {renderDetailExtras(item)}
                  {renderInlineDetailEditor({ ...item, kind: 'task' })}
                </article>
              ))}
          </section>
        ) : null}

        {(selectedDay?.weatherAlerts?.length || selectedDay?.reminders?.length) ? (
          <section>
            <p className="eyebrow">提醒</p>
            {selectedDay.weatherAlerts.length ? (
              <div className="reminder-group">
                <strong>出门提醒</strong>
                {selectedDay.weatherAlerts.map((alert) => (
                  <div className="weather-row" key={alert.id}>
                    <span>{alert.detail}</span>
                    <small>{alert.remindAt ? `建议提醒：${formatReminderTime(alert.remindAt)}` : '出门前看一眼。'}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {selectedDay.reminders.length ? (
              <div className="reminder-group">
                <strong>事件提醒</strong>
                {selectedDay.reminders.map((reminder) => (
                  <div className="reminder-row" key={reminder.id}>
                    <strong>{reminder.title}</strong>
                    <small>{formatReminderTime(reminder.remindAt)} · {getReminderStatusLabel(reminder.status)}</small>
                  </div>
                ))}
              </div>
            ) : null}
            {notificationPermission !== 'granted' ? (
              <button className="notification-button" onClick={requestNotificationPermission}>
                开启桌面提醒
              </button>
            ) : null}
          </section>
        ) : null}
          </>
        )}
      </aside>

      <div
        className="cat-widget"
        style={catPosition ? { left: catPosition.left, top: catPosition.top, right: 'auto', bottom: 'auto' } : undefined}
      >
        {shouldShowCatDialog ? <div className={`cat-dialog ${hasActiveCatContent ? '' : 'cat-dialog-idle'}`}>
          {message && !pendingClarification && !pendingDecision ? <p>{message}</p> : null}
          {pendingClarification ? (
            <ClarificationCard
              result={pendingClarification}
              onCancel={() => {
                setPendingClarification(null);
                setInput('');
                setMessage('好，这条先不补充。你可以重新告诉我。');
              }}
            />
          ) : pendingDecision ? (
            <DecisionCard
              result={pendingDecision}
              onSelect={handleDecisionOption}
              onCancel={() => {
                setPendingDecision(null);
                setInput('');
                setMessage('好，这条先不处理。你可以重新告诉我。');
              }}
            />
          ) : pendingPostCommit ? (
            <PostCommitCard
              action={pendingPostCommit}
              onConfirm={() => {
                setPendingPostCommit(null);
                setMessage('');
              }}
              onModify={() => {
                setPendingModification(pendingPostCommit);
                setPendingPostCommit(null);
                setMessage('');
                restartVoiceInputSoon(160);
              }}
              onCancel={() => deletePostCommitAction(pendingPostCommit)}
            />
          ) : pendingModification ? (
            <div className="post-commit-card">
              <strong>直接说要怎么改</strong>
              <span>比如“不是周五，是周六”，或者“加备注：带电脑”。</span>
            </div>
          ) : parsePreview ? (
            <InputUnderstandingCard result={parsePreview} onSelectOption={commitInput} />
          ) : null}
          <div className="voice-panel">
            <div className={`voice-transcript ${input ? '' : 'voice-empty'}`}>
              {input || (isListening ? '...' : '')}
            </div>
          </div>
        </div> : null}
        <div className={`cat-face ${isListening ? 'cat-listening' : ''} ${isThinking ? 'cat-thinking' : ''} ${hasActiveCatContent ? '' : 'cat-sleeping'}`} onMouseDown={startCatDrag} title="点一下开始说话，拖动可以移动小猫">
          <img src={ragdollAvatar} alt="YayaMind 布偶猫助手" />
          <span className="cat-state-mark" />
        </div>
      </div>

    </main>
  );
}

function formatTimeRange(startAt?: string, endAt?: string) {
  if (!startAt) return '待定';
  const start = new Date(startAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (!endAt) return start;
  const end = new Date(endAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return `${start}-${end}`;
}

function formatItemTime(item: CalendarItem) {
  if (item.startAt) return formatTimeRange(item.startAt, item.endAt);
  if (item.dueAt) return `截止 ${formatReminderTime(item.dueAt)}`;
  return '待定';
}

function formatPinnedItemMeta(item: CalendarItem) {
  if (item.startAt) return formatTimeRange(item.startAt, item.endAt);
  if (item.dueAt) return `截止 ${formatReminderTime(item.dueAt)}`;
  if (typeof item.estimatedMinutes === 'number') return `约 ${item.estimatedMinutes} 分钟`;
  return '待定';
}

function needsTaskClarification(item: CalendarItem) {
  if (item.type !== 'task') return false;
  const text = `${item.title} ${item.notes ?? ''} ${item.rawText ?? ''}`;
  return /什么什么|那个|在这之前|之前记得|一定要把那个|可$|，，|呃/.test(text);
}

function getCompactItemMeta(item: CalendarItem) {
  const label = getTypeLabel(item.type);
  if (item.conflict) return label ? `${label} · 冲突` : '冲突';
  return label;
}

function renderDetailExtras(item: CalendarItem) {
  const rows: Array<{ label: string; value: string }> = [];
  const content = getItemContent(item);
  const preparations = dedupeTextList(item.preparations ?? []);
  const notes = cleanupDisplayNote(item.notes, preparations);

  if (content) rows.push({ label: '具体安排', value: content });
  if (preparations.length) rows.push({ label: '准备事项', value: preparations.join('、') });
  if (notes) rows.push({ label: '备注', value: notes });
  if (typeof item.estimatedMinutes === 'number') rows.push({ label: '估时', value: `${item.estimatedMinutes} 分钟` });

  return rows.map((row) => <em key={row.label}>{row.label}：{row.value}</em>);
}

function getItemContent(item: CalendarItem) {
  const raw = cleanupSpokenDetail(item.purpose || item.rawText || '');
  const title = item.title.trim();
  if (!raw || raw === title) return '';
  if (raw.includes(title) && raw.length <= title.length + 4) return '';
  return raw;
}

function dedupeTextList(items: string[]) {
  const result: string[] = [];
  for (const item of items.map((value) => value.trim()).filter(Boolean)) {
    if (!result.some((existing) => existing.includes(item) || item.includes(existing))) result.push(item);
  }
  return result;
}

function cleanupDisplayNote(note: string | undefined, preparations: string[]) {
  const normalized = (note ?? '').trim().replace(/^准备[：:]\s*/, '').trim();
  if (!normalized) return '';
  if (preparations.some((item) => item.includes(normalized) || normalized.includes(item))) return '';
  return normalized;
}

function getPendingItemLabel(item: CalendarItem) {
  if (item.type === 'task') return '待补充内容';
  const text = `${item.title} ${item.notes ?? ''} ${item.rawText ?? ''}`;
  return hasSpecificTimeOnlySignal(text) ? '待补充内容' : '待补充时间';
}

function getPendingItemHint(item: CalendarItem) {
  if (item.type === 'task') return '这条需要补清楚具体要做什么，再作为截止任务。';
  return getPendingItemLabel(item) === '待补充内容'
    ? '补上具体要做什么后，会进入一周安排。'
    : '补上日期/开始结束时间后，会进入一周安排。';
}

function hasSpecificTimeOnlySignal(text: string) {
  const hasSpecificTime = /(\d{1,2})[:：](\d{2})|(\d{1,2}|[一二两三四五六七八九十])\s*点(半|\d{1,2}分?)?/.test(text);
  const hasConcreteContent = /(开会|会议|沟通|讨论|复盘|面试|上课|课程|电话|见面|训练|运动|吃饭|午饭|晚饭|写|做|整理|完成)/.test(text);
  return hasSpecificTime && !hasConcreteContent;
}

function needsIntentCheck(text: string) {
  const normalized = text.trim();
  if (normalized.length < 3) return true;
  if (/[�□■]{2,}/.test(normalized)) return true;
  const planningSignals =
    /新增|新加|添加|加一个|有一个|待办|项目代办|今天|明天|后天|周[一二三四五六日天]|星期[一二三四五六日天]|早上|上午|中午|下午|晚上|今晚|点|半|分钟|小时|开会|会议|面试|提醒|记得|任务|截止|之前|开始|结束|完成|写完|做完|安排|复盘|进度|暂停|继续|晾|洗|打扫|运动|吃饭/.test(normalized);
  return !planningSignals;
}

function getDayPlanCount(day: AssistantData['calendar'][number]) {
  return day.items.length + day.pendingItems.length + day.tasks.filter((task) => !needsTaskClarification(task)).length;
}

function getItemReminders(item: CalendarItem, reminders: CalendarReminder[]) {
  return reminders.filter((reminder) => {
    if (reminder.relatedId && reminder.relatedId === item.id) return true;
    if (item.reminderIds?.includes(reminder.id)) return true;
    return reminder.title.includes(item.title) || item.title.includes(reminder.title);
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

function getWeekdayText(label: string) {
  const parts = label.replace(/^今天\s+/, '').split(' ');
  return parts.length >= 2 ? `${parts[0]} ${parts.at(-1)}` : label;
}

function getDateText(label: string) {
  return label.startsWith('今天') ? '今天' : '';
}

function formatSelectedDayTitle(label: string) {
  return label.replace(/^今天\s+/, '');
}

function formatReminderTime(value: string) {
  const date = new Date(value);
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function createDetailDraft(item: DetailTarget, fallbackDate: string): DetailDraft {
  const start = item.startAt ? new Date(item.startAt) : null;
  const end = item.endAt ? new Date(item.endAt) : null;
  const due = item.dueAt ? new Date(item.dueAt) : null;
  return {
    id: item.id,
    title: item.title,
    notes: item.notes ?? '',
    date: start ? toLocalDateText(start) : fallbackDate,
    startTime: start ? toTimeInputValue(start) : '',
    endTime: end ? toTimeInputValue(end) : '',
    dueDate: due ? toLocalDateText(due) : fallbackDate,
    dueTime: due ? toTimeInputValue(due) : '',
    estimatedMinutes: typeof item.estimatedMinutes === 'number' ? String(item.estimatedMinutes) : '',
    purpose: item.purpose ?? '',
    preparationsText: item.preparations?.join('\n') ?? ''
  };
}

function createLogDraft(log: CalendarLog, fallbackDate: string): LogDraft {
  const at = log.at ? new Date(log.at) : null;
  return {
    id: log.id,
    note: log.text,
    date: at ? toLocalDateText(at) : fallbackDate,
    time: at ? toTimeInputValue(at) : log.time
  };
}

function toTimeInputValue(date: Date) {
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
}

function combineLocalDateTime(date: string, time: string) {
  if (!date || !time) return undefined;
  return new Date(`${date}T${time}:00`).toISOString();
}

function getDatePart(date: string, part: 'month' | 'day') {
  const [, month = '1', day = '1'] = date.split('-');
  return String(Number(part === 'month' ? month : day) || 1);
}

function splitPreparations(value: string) {
  return value
    .split(/[\n,，、；;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDayStateClass(dateText: string, now: Date) {
  const today = toLocalDateText(now);
  if (dateText < today) return 'day-past';
  if (dateText === today) return 'day-current';
  return 'day-future';
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    meeting: '会议',
    task_block: '任务块',
    life: '生活',
    exercise: '训练',
    meal: '吃饭',
    rest: '休息',
    risk: '风险',
    other: '',
    task: '任务'
  };
  return labels[type] ?? '安排';
}

const dayStartHour = 7;
const dayEndHour = 24;
const dayMinutes = (dayEndHour - dayStartHour) * 60;

function getHourMarks() {
  return Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, index) => dayStartHour + index);
}

function getHourMarkStyle(hour: number) {
  return {
    top: `${clampPercent(((hour - dayStartHour) * 60 / dayMinutes) * 100)}%`
  };
}

function getMinorTimeMarks() {
  const marks: number[] = [];
  for (let minutes = 30; minutes < dayMinutes; minutes += 30) {
    if (minutes % 60 !== 0) marks.push(minutes);
  }
  return marks;
}

function getMinuteMarkStyle(minutesFromStart: number) {
  return {
    top: `${clampPercent((minutesFromStart / dayMinutes) * 100)}%`
  };
}

function isToday(dateText: string, now: Date) {
  return dateText === toLocalDateText(now);
}

function toLocalDateText(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinutesFromDayStart(value: Date) {
  return value.getHours() * 60 + value.getMinutes() - dayStartHour * 60;
}

function minuteFromClientY(clientY: number, rect: DOMRect) {
  const ratio = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return snapToHalfHour(ratio * dayMinutes);
}

function snapToHalfHour(minutes: number) {
  return Math.round(minutes / 30) * 30;
}

function clampMinute(minutes: number) {
  return Math.min(dayMinutes, Math.max(0, minutes));
}

function makeLocalDateTime(date: string, minutesFromStart: number) {
  const dateTime = new Date(`${date}T00:00:00`);
  dateTime.setMinutes(dayStartHour * 60 + clampMinute(minutesFromStart));
  return dateTime.toISOString();
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function getNowLineStyle(now: Date) {
  return {
    top: `${clampPercent((getMinutesFromDayStart(now) / dayMinutes) * 100)}%`
  };
}

function getPastShadeStyle(now: Date) {
  return {
    height: `${clampPercent((getMinutesFromDayStart(now) / dayMinutes) * 100)}%`
  };
}

function getEventStyle(startAt?: string, endAt?: string, lane = 0, laneCount = 1) {
  if (!startAt) return {};
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : new Date(start.getTime() + 60 * 60 * 1000);
  const startMinutes = getMinutesFromDayStart(start);
  const durationMinutes = Math.max(30, (end.getTime() - start.getTime()) / 60_000);
  const safeLaneCount = Math.max(1, laneCount);
  const gap = 4;
  const widthPercent = 100 / safeLaneCount;

  return {
    height: `${clampPercent((durationMinutes / dayMinutes) * 100)}%`,
    left: `calc(${lane * widthPercent}% + ${lane > 0 ? gap : 0}px)`,
    right: 'auto',
    top: `${clampPercent((startMinutes / dayMinutes) * 100)}%`,
    width: `calc(${widthPercent}% - ${lane > 0 ? gap : 0}px)`
  };
}

function getDeadlineStyle(dueAt?: string | null) {
  if (!dueAt) return {};
  const minutes = getMinutesFromDayStart(new Date(dueAt));
  return {
    top: `${clampPercent((minutes / dayMinutes) * 100)}%`
  };
}

function formatElapsed(startedAt: string, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(startedAt).getTime()) / 60_000));
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours === 0) return `${restMinutes} 分钟`;
  return `${hours} 小时 ${restMinutes} 分钟`;
}

function getCatSuggestion(data: AssistantData, now: Date) {
  const activeSession = data.today.activeSession;
  if (activeSession) {
    const minutes = Math.max(0, Math.floor((now.getTime() - new Date(activeSession.startedAt).getTime()) / 60_000));
    if (minutes >= 90) return '这段已经挺长了，可以考虑收个小尾巴，或者记录一下当前进度。';
    if (minutes >= 45) return '已经进入一段有效专注了，先别急着切任务，保住这个节奏。';
    return '刚开工不久，先把当前任务推进到一个可停顿的小节点。';
  }

  const nextPlan = data.today.plans[0];
  if (nextPlan) return `现在没有执行中的任务，可以从“${getShortTitle(nextPlan.title)}”开始。`;
  if (data.today.reminders.length > 0) return '今天有未处理提醒，可以先清掉一个生活小尾巴。';
  return '今天面板还很轻，可以先丢一件最小可执行的任务给我。';
}

function getReminderStatusLabel(status: string) {
  if (status === 'triggered') return '已触发';
  if (status === 'missed') return '已错过';
  return '待提醒';
}

function getGoalStatusLabel(status: GoalRecord['status']) {
  const labels: Record<GoalRecord['status'], string> = {
    active: '进行中',
    paused: '已暂停',
    done: '已完成',
    cancelled: '已取消'
  };
  return labels[status];
}

function buildProjectTodoGroups(projects: TodoProject[], tasks: TaskListItem[]) {
  const groups = new Map<string, { project: TodoProject; projectId: string; projectTitle: string; tasks: TaskListItem[]; openCount: number; color: string }>();
  projects.forEach((project) => {
    groups.set(project.id, { project, projectId: project.id, projectTitle: project.title, tasks: [], openCount: 0, color: getProjectColor(project.id) });
  });
  tasks
    .filter((task) => task.status !== 'cancelled' && task.title.trim())
    .forEach((task) => {
      const projectId = task.projectId || 'uncategorized';
      const projectTitle = task.projectTitle || '未归类';
      const project = projects.find((item) => item.id === projectId) ?? {
        id: projectId,
        title: projectTitle,
        status: 'active' as const,
        createdAt: '',
        updatedAt: ''
      };
      const group = groups.get(projectId) ?? { project, projectId, projectTitle, tasks: [], openCount: 0, color: getProjectColor(projectId) };
      group.tasks.push(task);
      if (task.status !== 'done') group.openCount += 1;
      groups.set(projectId, group);
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      tasks: group.tasks.sort((a, b) => {
        const doneOrder = Number(a.status === 'done') - Number(b.status === 'done');
        if (doneOrder !== 0) return doneOrder;
        return (a.dueAt ?? a.createdAt).localeCompare(b.dueAt ?? b.createdAt);
      })
    }))
    .sort((a, b) => {
      const openOrder = Number(a.openCount === 0) - Number(b.openCount === 0);
      if (openOrder !== 0) return openOrder;
      return a.projectTitle.localeCompare(b.projectTitle, 'zh-CN');
    });
}

type ProjectTodoGroup = ReturnType<typeof buildProjectTodoGroups>[number];

const coreTodoProjectTitles = ['工作', '学校', '生活'];

function getCoreTodoGroups(groups: ProjectTodoGroup[]) {
  return coreTodoProjectTitles
    .map((title) => groups.find((group) => group.projectTitle === title))
    .filter(Boolean) as ProjectTodoGroup[];
}

function getOtherTodoGroups(groups: ProjectTodoGroup[]) {
  return groups.filter((group) => !coreTodoProjectTitles.includes(group.projectTitle));
}

function buildTodoDeadlineDots(tasks: TaskListItem[]) {
  const dots = new Map<string, string[]>();
  tasks
    .filter((task) => task.status !== 'cancelled' && task.dueAt)
    .forEach((task) => {
      const date = task.dueAt!.slice(0, 10);
      dots.set(date, [...(dots.get(date) ?? []), getProjectColor(task.projectId)]);
    });
  return dots;
}

function getProjectColor(projectId: string) {
  const palette = ['#9b3d3d', '#2f6f68', '#b2742e', '#5c6fa6', '#8f5b83', '#6f7b3b', '#b85f42', '#4f7f9b'];
  if (projectId === 'uncategorized') return '#9a8b7d';
  let hash = 0;
  for (const char of projectId) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return palette[hash % palette.length];
}

function buildMonthCalendarDays(now: Date) {
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const start = new Date(firstDay);
  const weekday = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  start.setDate(firstDay.getDate() - weekday + 1);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date: toLocalDateText(date),
      day: date.getDate(),
      inMonth: date.getMonth() === now.getMonth()
    };
  });
}

function formatTodoMeta(task: TaskListItem) {
  const parts = [
    stripTodoDateTags(task.notes ?? '') || '',
    task.status === 'done' ? '已完成' : ''
  ].filter(Boolean);
  return parts.join(' · ') || '添加备注';
}

function getTodoDateTag(task: TaskListItem) {
  if (!task.dueAt) return '';
  const date = new Date(task.dueAt);
  if (Number.isNaN(date.getTime())) return '';
  return `#${date.getMonth() + 1}/${date.getDate()}`;
}

function getTodoDateTagStyle(task: TaskListItem): CSSProperties {
  if (!task.dueAt) return {};
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.floor((dueDay.getTime() - today.getTime()) / 86_400_000);
  const palette =
    daysLeft <= 0
      ? { background: '#f3a39a', border: '#d97870' }
      : daysLeft <= 2
        ? { background: '#f7bbb1', border: '#e49a91' }
        : daysLeft <= 4
          ? { background: '#f9d1c5', border: '#ebb5a8' }
          : daysLeft <= 7
            ? { background: '#f6dfcf', border: '#e4c6b0' }
            : { background: '#eee9e1', border: '#d9d0c4' };
  return {
    '--todo-date-bg': palette.background,
    '--todo-date-border': palette.border
  } as CSSProperties;
}

function stripTodoDateTags(text: string) {
  return text.replace(/#\d{4}-\d{2}-\d{2}/g, '').replace(/\s+/g, ' ').trim();
}

function ProfileBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  const visibleItems = items.filter(Boolean);
  return (
    <article className="workspace-card">
      <strong>{title}</strong>
      {visibleItems.length ? (
        visibleItems.map((item) => <span key={item}>{item}</span>)
      ) : (
        <span>{empty}</span>
      )}
    </article>
  );
}

function InputUnderstandingCard({ result, onSelectOption }: { result: ParseResult; onSelectOption: (optionId?: string) => void }) {
  const options = getConflictOptions(result);
  const rows = getUnderstandingRows(result);

  return (
    <div className={`parse-preview understanding-card ${result.needsConfirmation ? 'parse-warning' : ''}`}>
      <div className="understanding-head">
        <span>{result.needsConfirmation ? '需要确认' : '小猫理解中'}</span>
        <strong>{getIntentLabel(result.intent)}</strong>
        {result.preview.parser === 'deepseek' ? <small className="ai-participation">DeepSeek 参与</small> : null}
      </div>
      {result.transcription ? (
        <small className="transcription-correction">
          已修正转写：{result.transcription.correctedText}
        </small>
      ) : null}
      <div className="understanding-rows">
        {rows.map((row) => (
          <div className="understanding-row" key={row.label}>
            <small>{row.label}</small>
            <b>{row.value}</b>
          </div>
        ))}
      </div>
      {result.questions[0] ? <p className="understanding-question">{result.questions[0]}</p> : null}
      {options.length > 0 ? (
        <div className="conflict-options">
          {options.map((option) => (
            <button key={option.id} onClick={() => onSelectOption(option.id)}>
              {option.title}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ClarificationCard({ result, onCancel }: { result: ParseResult; onCancel: () => void }) {
  return (
    <div className="clarification-card">
      <div>
        <span>小猫追问</span>
        <strong>{result.questions[0] ?? '这条还差一点信息。'}</strong>
      </div>
      <small>原话：{result.rawText}</small>
      <button onClick={onCancel}>取消</button>
    </div>
  );
}

function DecisionCard({ result, onSelect, onCancel }: { result: ParseResult; onSelect: (optionId: string) => void; onCancel: () => void }) {
  const options = getConflictOptions(result);
  return (
    <div className="clarification-card decision-card">
      <div>
        <span>需要你选一个</span>
        <strong>{result.questions[0] ?? '这个安排需要确认后再写入。'}</strong>
      </div>
      <small>原话：{result.rawText}</small>
      <div className="conflict-options">
        {options.map((option) => (
          <button key={option.id} onClick={() => onSelect(option.id)}>
            {option.title}
          </button>
        ))}
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function PostCommitCard({
  action,
  onConfirm,
  onModify,
  onCancel
}: {
  action: PostCommitAction;
  onConfirm: () => void;
  onModify: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="post-commit-card">
      <strong>{action.title}</strong>
      <span>已放进安排里，要保留吗？</span>
      <div className="conflict-options">
        <button onClick={onConfirm}>确认</button>
        <button onClick={onModify}>修改</button>
        <button onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}

function getEventOperationIntent(text: string, parsed?: ParseResult | null): 'delete_event' | 'update_event' | 'annotate_event' | null {
  if (parsed?.intent === 'delete_event' || parsed?.intent === 'update_event' || parsed?.intent === 'annotate_event') return parsed.intent;
  if (/(删掉|删除|取消|撤掉|去掉|不要了|不用了)/.test(text) && /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return 'delete_event';
  if (/(备注|补充|带上|带|准备|加上|说明)/.test(text) && /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return 'annotate_event';
  if (/(改|修改|改到|改成|改为|重新安排|不是|换到|挪到|提前|推迟)/.test(text) && /(会|会议|开会|面试|上课|课程|安排|日程)/.test(text)) return 'update_event';
  return null;
}

function isMeetingLikeItem(item: CalendarItem) {
  return /(meeting|会|会议|开会|面试|上课|课程)/.test(`${item.type} ${item.title} ${item.rawText ?? ''}`);
}

function scoreEventCandidate(item: CalendarItem, text: string, targetMinutes: number | null, targetDate: string) {
  let score = item.date === targetDate ? 20 : 0;
  if (isMeetingLikeItem(item)) score += 8;
  if (/上午|早上/.test(text) && item.startAt && new Date(item.startAt).getHours() < 12) score += 10;
  if (/下午/.test(text) && item.startAt && new Date(item.startAt).getHours() >= 12 && new Date(item.startAt).getHours() < 18) score += 10;
  if (/晚上|晚上的|今晚/.test(text) && item.startAt && new Date(item.startAt).getHours() >= 18) score += 10;
  if (targetMinutes !== null) {
    if (!item.startAt) return -1001;
    const diff = Math.abs(getMinutesFromDayStart(new Date(item.startAt)) - targetMinutes);
    if (diff > 120) return -1001;
    score += Math.max(0, 120 - diff);
  }
  return score;
}

function inferSpokenTimeMinutes(text: string) {
  const digital = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2})[:：](\d{2})/);
  if (digital) return normalizeSpokenHour(Number(digital[2]), digital[1] ?? '') * 60 + Number(digital[3]);

  const spoken = text.match(/(凌晨|早上|上午|中午|下午|晚上|今晚)?\s*(\d{1,2}|[一二两三四五六七八九十])\s*点(半|[一二三四五六七八九十\d]{1,2}分?)?/);
  if (!spoken) return null;
  const hour = normalizeSpokenHour(parseSpokenNumber(spoken[2]), spoken[1] ?? '');
  const minute = spoken[3]?.startsWith('半') ? 30 : 0;
  return hour * 60 + minute;
}

function normalizeSpokenHour(hour: number, period: string) {
  if ((period === '下午' || period === '晚上' || period === '今晚') && hour < 12) return hour + 12;
  if (period === '中午' && hour < 11) return hour + 12;
  return hour;
}

function parseSpokenNumber(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const map: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  return map[value] ?? 0;
}

function buildModificationBody(action: PostCommitAction, text: string, parsed: ParseResult | null, fallbackDate?: string) {
  const fields = parsed?.fields ?? {};
  const body: Record<string, unknown> = {};
  const parsedTitle = typeof fields.title === 'string' ? fields.title.trim() : '';
  const parsedStartAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
  const parsedEndAt = typeof fields.endAt === 'string' ? fields.endAt : undefined;
  const parsedDueAt = typeof fields.dueAt === 'string' ? fields.dueAt : undefined;
  const correctionDate = inferCorrectionDate(text, fallbackDate);
  const note = extractSimpleNote(text);
  const preparations = extractSimplePreparations(text);

  if (action.kind === 'event') {
    if (parsedTitle && !/(备注|带|准备|不是|改成|改到)/.test(text)) body.title = parsedTitle;
    if (parsedStartAt) {
      body.startAt = correctionDate ? replaceIsoDate(parsedStartAt, correctionDate) : parsedStartAt;
      body.date = toLocalDateText(new Date(String(body.startAt)));
      if (parsedEndAt) body.endAt = correctionDate ? replaceIsoDate(parsedEndAt, correctionDate) : parsedEndAt;
    } else if (correctionDate) {
      body.date = correctionDate;
      if (action.startAt) body.startAt = replaceIsoDate(action.startAt, correctionDate);
      if (action.endAt) body.endAt = replaceIsoDate(action.endAt, correctionDate);
    }
    if (note) body.notes = note;
    if (preparations.length) body.preparations = preparations;
    return body;
  }

  if (parsedTitle && !/(备注|带|准备|不是|改成|改到)/.test(text)) body.title = parsedTitle;
  if (parsedDueAt) body.dueAt = correctionDate ? replaceIsoDate(parsedDueAt, correctionDate) : parsedDueAt;
  if (!parsedDueAt && correctionDate && action.startAt) body.dueAt = replaceIsoDate(action.startAt, correctionDate);
  if (note) body.notes = note;
  if (preparations.length) body.preparations = preparations;
  return body;
}

function inferCorrectionDate(text: string, fallbackDate?: string) {
  const base = fallbackDate ? new Date(`${fallbackDate}T12:00:00`) : new Date();
  if (/今天/.test(text)) return toLocalDateText(base);
  if (/明天/.test(text)) {
    const date = new Date(base);
    date.setDate(base.getDate() + 1);
    return toLocalDateText(date);
  }
  if (/后天/.test(text)) {
    const date = new Date(base);
    date.setDate(base.getDate() + 2);
    return toLocalDateText(date);
  }
  const weekMatch = text.match(/(下周|下个星期|这周|本周)?(?:周|星期)([一二三四五六日天])/);
  if (!weekMatch) return undefined;
  const targetDay = '日一二三四五六'.indexOf(weekMatch[2] === '天' ? '日' : weekMatch[2]);
  const weekStart = getWeekStart(base);
  const date = new Date(weekStart);
  date.setDate(weekStart.getDate() + (targetDay === 0 ? 6 : targetDay - 1));
  if (/下周|下个星期/.test(weekMatch[1] ?? '')) date.setDate(date.getDate() + 7);
  return toLocalDateText(date);
}

function replaceIsoDate(value: string, dateText: string) {
  const date = new Date(value);
  const [year, month, day] = dateText.split('-').map(Number);
  date.setFullYear(year, month - 1, day);
  return date.toISOString();
}

function extractSimpleNote(text: string) {
  const noteMatch = text.match(/(?:备注|说明|注意)[：:，, ]*(.+)$/);
  if (noteMatch?.[1]) return noteMatch[1].trim();
  return '';
}

function extractSimplePreparations(text: string) {
  const match = text.match(/(?:带上|带|准备)[：:，, ]*(.+)$/);
  if (!match?.[1]) return [];
  return splitPreparations(match[1].replace(/^一个|^一下/, '').trim());
}

function mergeText(current = '', next = '') {
  const value = next.trim();
  if (!value) return current;
  if (!current.trim()) return value;
  if (current.includes(value)) return current;
  return `${current.trim()}\n${value}`;
}

function mergeList(current: string[], next: string[]) {
  return Array.from(new Set([...current, ...next].map((item) => item.trim()).filter(Boolean)));
}

function buildInputForCommit(text: string, pending: ParseResult | null, decision: ParseResult | null = null) {
  if (decision && !text) return decision.rawText;
  if (!pending) return text;
  if (!text) return '';
  return `${pending.rawText}，补充信息：${text}`;
}

function getShortTitle(title: string) {
  const normalized = title
    .replace(/^我要?/, '')
    .replace(/^需要/, '')
    .replace(/^今天/, '')
    .replace(/^今晚/, '')
    .trim();

  if (normalized.includes('开会') || normalized.includes('会议')) return '开会';
  if (normalized.includes('上课') || normalized.includes('课程')) return '上课';
  if (normalized.includes('面试')) return '面试';
  if (normalized.includes('提醒')) return normalized.replace(/.*提醒我?/, '').slice(0, 8) || '提醒';
  if (normalized.length <= 8) return normalized || title;
  return `${normalized.slice(0, 8)}…`;
}

function getUnderstandingRows(result: ParseResult) {
  const fields = result.fields;
  const rows: Array<{ label: string; value: string }> = [];
  const title = typeof fields.title === 'string' ? fields.title : undefined;
  const note = typeof fields.note === 'string' ? fields.note : undefined;
  const purpose = typeof fields.purpose === 'string' ? fields.purpose : undefined;
  const notes = typeof fields.notes === 'string' ? fields.notes : undefined;
  const startAt = typeof fields.startAt === 'string' ? fields.startAt : undefined;
  const endAt = typeof fields.endAt === 'string' ? fields.endAt : undefined;
  const remindAt = typeof fields.remindAt === 'string' ? fields.remindAt : undefined;
  const dueAt = typeof fields.dueAt === 'string' ? fields.dueAt : undefined;
  const estimatedMinutes = typeof fields.estimatedMinutes === 'number' ? fields.estimatedMinutes : undefined;
  const preparations = asStringArray(fields.preparations);

  rows.push({ label: '标题', value: summarizeScheduleTitle(result.intent, title || note || result.rawText || '新安排') });
  rows.push({
    label: '具体内容',
    value: buildScheduleDetailText({
      rawText: result.rawText,
      startAt: startAt ?? remindAt ?? dueAt,
      endAt,
      purpose,
      notes,
      estimatedMinutes
    })
  });
  if (preparations.length) rows.push({ label: '提前准备', value: preparations.join('\n') });
  return rows;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function formatPreviewTime(startAt?: string, endAt?: string) {
  if (!startAt) return '待定';
  const date = new Date(startAt);
  const dateText = `${date.getMonth() + 1}/${date.getDate()}`;
  return `${dateText} ${formatTimeRange(startAt, endAt)}`;
}

function summarizeScheduleTitle(intent: ParsedIntent, text: string) {
  const normalized = text.trim();
  if (/(面试|interview)/i.test(normalized)) return '面试';
  if (/(上课|课程|听课|讲座|课堂)/.test(normalized)) return '上课';
  if (/(开会|会议|会\b|沟通|讨论|复盘会)/.test(normalized)) return '开会';
  if (intent === 'add_reminder') return '提醒';
  if (intent === 'add_task') return '任务';
  return getShortTitle(normalized);
}

function buildScheduleDetailText({
  rawText,
  startAt,
  endAt,
  purpose,
  notes,
  estimatedMinutes
}: {
  rawText: string;
  startAt?: string;
  endAt?: string;
  purpose?: string;
  notes?: string;
  estimatedMinutes?: number;
}) {
  const location = extractLocationFromText(rawText);
  const rows = [
    startAt ? `时间：${formatPreviewTime(startAt, endAt)}` : '',
    location ? `地点：${location}` : '',
    `内容：${purpose || notes || cleanupSpokenDetail(rawText)}`,
    estimatedMinutes ? `预计：${estimatedMinutes} 分钟` : ''
  ].filter(Boolean);
  return rows.join('\n');
}

function extractLocationFromText(text: string) {
  const match = text.match(/(?:在|到|去)([^，。；;]+?)(?:开会|会议|上课|面试|见面|沟通|讨论|，|。|；|;|$)/);
  const value = match?.[1]?.trim();
  return value && value.length <= 18 ? value : undefined;
}

function cleanupSpokenDetail(text: string) {
  return text
    .replace(/^(嗯|呃|那个|就是|然后)+/, '')
    .replace(/[，。；;]\s*$/g, '')
    .trim() || text;
}

function getIntentLabel(intent: ParsedIntent) {
  const labels: Record<ParsedIntent, string> = {
    add_event: '日程 / 时间块',
    update_event: '修改日程',
    delete_event: '删除日程',
    annotate_event: '补充日程',
    add_task: '任务',
    start_work: '开始工作',
    pause_work: '暂停',
    resume_work: '继续',
    finish_work: '结束',
    progress_update: '进度',
    add_reminder: '提醒',
    review_note: '复盘'
  };
  return labels[intent];
}

function getPreviewText(result: ParseResult) {
  if (result.needsConfirmation && result.questions[0]) return result.questions[0];
  const title = result.fields.title;
  const note = result.fields.note;
  const remindAt = result.fields.remindAt;
  const startAt = result.fields.startAt;
  const endAt = result.fields.endAt;

  if (typeof remindAt === 'string') return `${String(title || '提醒')} · ${formatTimeRange(remindAt)}`;
  if (typeof startAt === 'string') return `${String(title || '安排')} · ${formatTimeRange(startAt, typeof endAt === 'string' ? endAt : undefined)}`;
  if (typeof title === 'string') return title;
  if (typeof note === 'string') return note;
  return '准备记录';
}

function getConflictOptions(result: ParseResult) {
  const options = result.preview.options;
  if (!Array.isArray(options)) return [];
  return options.filter(isConflictOption);
}

function isConflictOption(value: unknown): value is ConflictOption {
  if (!value || typeof value !== 'object') return false;
  const option = value as Record<string, unknown>;
  return typeof option.id === 'string' && typeof option.title === 'string';
}

function getCommitMessage(result?: ParseResult, resolvedBy?: string, feedback?: string) {
  if (feedback) return feedback;
  if (!result) return '记下来了，安排先放进口袋。';
  if (resolvedBy === 'save-pending') return '已放进待补充事项。';
  if (resolvedBy === 'keep-both') return '已重叠新增。';
  if (resolvedBy === 'task-split') return '任务先记成待拆分。';
  if (resolvedBy === 'defer-tomorrow') return '任务已经改到明天。';
  if (resolvedBy === 'duplicate-add') return '已继续新增这条任务。';
  if (resolvedBy === 'skip-duplicate') return '好，先保留已有任务，不重复记录。';
  if (result.needsConfirmation && result.questions[0]) return result.questions[0];

  const messages: Record<ParsedIntent, string> = {
    add_event: '日程已经排进一周安排。',
    update_event: '日程修改好了。',
    delete_event: '日程已删除。',
    annotate_event: '日程补充好了。',
    add_task: '任务记好了，先放进今日/待办里。',
    start_work: '开工啦，我会帮你留下执行脚印。',
    pause_work: '暂停记下来了，先缓一口气。',
    resume_work: '继续工作已记录，节奏接回来了。',
    finish_work: '结束记录好了，今天又往前推了一点。',
    progress_update: '进度记下来了，后面重排会用上。',
    add_reminder: '提醒设好了，到点会在这里冒出来。',
    review_note: '复盘原因收好了，下次计划会更贴近现实。'
  };
  return messages[result.intent];
}


