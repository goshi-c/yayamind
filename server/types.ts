export type SourceType = 'text' | 'voice' | 'manual' | 'system';

export type EventRecord = {
  id: string;
  type: 'meeting' | 'task_block' | 'life' | 'exercise' | 'meal' | 'rest' | 'risk' | 'other';
  title: string;
  date: string;
  startAt?: string;
  endAt?: string;
  purpose?: string;
  preparations?: string[];
  notes?: string;
  reminderIds?: string[];
  status: 'scheduled' | 'done' | 'cancelled' | 'missed' | 'moved';
  linkedTaskId: string | null;
  tags: string[];
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'paused' | 'done' | 'partially_done' | 'cancelled' | 'deferred';
  priority: 'low' | 'medium' | 'high';
  dueAt: string | null;
  estimatedMinutes: number | null;
  preparations?: string[];
  notes?: string;
  actualMinutes: number;
  linkedEventIds: string[];
  goalId: string | null;
  projectId?: string | null;
  order?: number;
  tags: string[];
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type TodoProjectRecord = {
  id: string;
  title: string;
  status: 'active' | 'archived';
  order?: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkLogRecord = {
  id: string;
  taskId: string | null;
  eventId: string | null;
  action: 'start' | 'pause' | 'resume' | 'progress' | 'finish' | 'interrupt';
  note: string;
  at: string;
  status?: 'active' | 'deleted';
  feedbackType?: 'recorded' | 'progress' | 'completed' | 'deferred' | 'review';
  mood?: 'gentle' | 'steady' | 'celebrating';
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type ReminderRecord = {
  id: string;
  title: string;
  remindAt: string;
  status: 'pending' | 'triggered' | 'done' | 'dismissed' | 'missed';
  importance: 'low' | 'normal' | 'high';
  linkedTaskId: string | null;
  relatedType?: 'task' | 'event' | 'day' | 'general';
  relatedId?: string | null;
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type RestDayMode = 'weekend' | 'single_sunday' | 'single_saturday' | 'alternate_weekends' | 'custom';

export type AppSettings = {
  timezone: string;
  dataVersion: number;
  assistantName: string;
  notification: {
    browserNotificationEnabled: boolean;
    quietDuringWorking: boolean;
  };
  ui: {
    calendarDays: number;
    dayStartHour: number;
    dayEndHour: number;
  };
  habits: {
    sleepStart: string;
    wakeUp: string;
    restDayMode: RestDayMode;
    customRestDays: number[];
    alternateWeekendStartsOn: string;
    showLegalHolidays: boolean;
  };
  weather: {
    enabled: boolean;
    latitude: number;
    longitude: number;
    city: string;
    rainProbabilityThreshold: number;
    outdoorLeadMinutes: number;
  };
  ai: {
    provider: 'deepseek' | 'openai-compatible';
    enabled: boolean;
    baseUrl: string;
    model: string;
    apiKey: string;
  };
};

export type ReviewRecord = {
  id: string;
  targetType: 'task' | 'event' | 'day' | 'general';
  targetId: string | null;
  reasonType:
    | 'underestimated_time'
    | 'interrupted'
    | 'low_energy'
    | 'planned_rest'
    | 'procrastination'
    | 'scope_changed'
    | 'other';
  note: string;
  lesson: string;
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type GoalRecord = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'done' | 'cancelled';
  startDate: string;
  targetDate: string | null;
  milestones: Array<{
    id: string;
    title: string;
    status: 'todo' | 'in_progress' | 'done';
  }>;
  linkedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ProfileData = {
  timeHabits: {
    highFocusWindows: string[];
    lowEnergyWindows: string[];
    commonDelayWindows: string[];
  };
  estimationPatterns: {
    oftenUnderestimatedTags: string[];
    bufferRules: string[];
  };
  lifeRhythm: {
    regularMeals: string[];
    exercisePreferences: string[];
    restPatterns: string[];
  };
  workPreferences: {
    focusStyle: string;
    preferredTaskOrder: string;
    encouragementStyle: string;
  };
  signals: string[];
  updatedAt: string;
};

export type ConversationState =
  | 'idle'
  | 'listening'
  | 'heard_original'
  | 'organizing_text'
  | 'understanding'
  | 'awaiting_confirmation'
  | 'awaiting_selection'
  | 'awaiting_clarification'
  | 'executing'
  | 'completed';

export type PlanDraftItem = {
  id: string;
  kind: 'event' | 'task' | 'reminder' | 'profile_update' | 'habit_rule';
  title: string;
  targetDate?: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  remindAt?: string;
  projectId?: string | null;
  notes?: string;
  source: 'user_explicit' | 'profile_inferred' | 'lexicon_normalized' | 'default_assumption' | 'system_generated';
  confidence?: number;
  risk?: string;
};

export type PlanDraft = {
  id: string;
  sourceText: string;
  date: string;
  status: 'draft' | 'confirmed' | 'cancelled';
  items: PlanDraftItem[];
  assumptions: string[];
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type CandidateItem = {
  id: string;
  kind: 'event' | 'task' | 'reminder' | 'project' | 'profile' | 'habit_rule';
  title: string;
  detail?: string;
  date?: string;
  startAt?: string;
  endAt?: string;
  dueAt?: string | null;
};

export type PendingAction = {
  id: string;
  type:
    | 'confirm_draft'
    | 'modify_draft'
    | 'cancel_draft'
    | 'delete_item'
    | 'update_item'
    | 'batch_operation'
    | 'profile_update'
    | 'habit_rule';
  targetId?: string;
  targetKind?: CandidateItem['kind'];
};

export type BatchOperationPreview = {
  id: string;
  sourceText: string;
  action: 'delete' | 'update_time' | 'move_project' | 'move_date' | 'update_status';
  candidates: CandidateItem[];
  warnings: string[];
};

export type BatchOperationResult = {
  ok: boolean;
  succeeded: CandidateItem[];
  failed: Array<{ item: CandidateItem; reason: string }>;
};

export type ConversationContext = {
  id: string;
  state: ConversationState;
  activeDraftId?: string;
  pendingAction?: PendingAction;
  pendingCandidates?: CandidateItem[];
  lastUserText?: string;
  createdAt: string;
  updatedAt: string;
};

export type RecurringRuleRecord = {
  id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  timeHint?: string;
  targetKind: 'event' | 'task' | 'reminder';
  nextOccurrences: string[];
  status: 'active' | 'paused' | 'cancelled';
  source: SourceType;
  rawText: string;
  createdAt: string;
  updatedAt: string;
};

export type ParsedIntent =
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
  | 'review_note'
  | 'plan_draft'
  | 'batch_operation'
  | 'profile_update'
  | 'habit_rule';

export type ParseResult = {
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
  conversationState?: ConversationState;
  draft?: PlanDraft;
  candidates?: CandidateItem[];
  pendingAction?: PendingAction;
  batchOperation?: BatchOperationPreview;
};
