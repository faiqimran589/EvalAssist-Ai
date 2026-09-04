export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If the browser is running on localhost or 127.0.0.1, always prioritize local backend on port 8001
    // to avoid stale or expired Cloudflare tunnel URLs causing "Failed to fetch"
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8001/api/v1';
    }
    // Non-local origins (Cloudflare tunnel, LAN IP): use SAME-ORIGIN relative
    // paths. The Next.js server proxies /api/v1/* to the backend
    // (next.config.js rewrites), so the single tunnel to the frontend serves
    // everything — no public backend URL is ever baked into the environment.
    return '/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1';
}

export interface ApiRequestOptions extends RequestInit {
  /**
   * Hard timeout in milliseconds. When exceeded, the fetch is aborted via
   * AbortController so the caller's loading state can never spin forever.
   */
  timeoutMs?: number;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options;
  const token = typeof window !== 'undefined' ? localStorage.getItem('evalassist_token') : null;

  const headers = new Headers(fetchOptions.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // If not FormData, default to application/json
  if (!(fetchOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const base = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;

  // Optional hard timeout: aborts the fetch once elapsed. Guarantees callers
  // always resolve or reject (no infinite loading on stalled requests).
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let didTimeout = false;
  if (timeoutMs && timeoutMs > 0) {
    const controller = new AbortController();
    timeoutTimer = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);
    // Chain a caller-provided signal (if any) into the timeout controller.
    const callerSignal = fetchOptions.signal as AbortSignal | null | undefined;
    if (callerSignal) {
      if (callerSignal.aborted) controller.abort();
      else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    fetchOptions.signal = controller.signal;
  }

  const timeoutMessage = () =>
    `Request timed out after ${Math.round((timeoutMs || 0) / 1000)} seconds. Please retry.`;
  const isTimeoutAbort = (err: any) => err?.name === 'AbortError' && didTimeout;

  try {
    let res: Response;
    try {
      res = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } catch (err: any) {
      // A timeout must NOT trigger the localhost fallback retry — that would
      // double the wait. Fail immediately with a clear message.
      if (isTimeoutAbort(err)) throw new Error(timeoutMessage());
      // If fetch failed on an ABSOLUTE (non-localhost) URL, attempt fallback
      // to localhost:8001. Same-origin relative URLs (/api/v1/...) are served
      // by the Next.js server itself — retrying localhost from a phone would
      // be nonsense.
      if (
        typeof window !== 'undefined' &&
        !url.startsWith('/') &&
        !url.includes('localhost:8001') &&
        !url.includes('127.0.0.1:8001')
      ) {
        try {
          const fallbackUrl = endpoint.startsWith('http')
            ? endpoint
            : `http://localhost:8001/api/v1${endpoint}`;
          res = await fetch(fallbackUrl, {
            ...fetchOptions,
            headers,
          });
        } catch (err2: any) {
          if (isTimeoutAbort(err2)) throw new Error(timeoutMessage());
          throw new Error('Failed to fetch. Make sure the backend server is running on http://localhost:8001.');
        }
      } else {
        throw new Error('Failed to fetch. Make sure the backend server is running on http://localhost:8001.');
      }
    }

    if (!res.ok) {
      let errorDetail = 'Request failed';
      try {
        const errJson = await res.json();
        // Backend error bodies use {"error": ...} (OCR endpoints) or {"detail": ...} (FastAPI)
        errorDetail = errJson.detail || errJson.error || errJson.message || JSON.stringify(errJson);
      } catch {
        errorDetail = `HTTP ${res.status}: ${res.statusText}`;
      }
      throw new Error(errorDetail);
    }

    return await res.json();
  } catch (err: any) {
    // Also converts a late abort (e.g. mid response-body streaming).
    if (isTimeoutAbort(err)) throw new Error(timeoutMessage());
    throw err;
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

/** True when the error was caused by a request timeout (AbortController or message). */
export function isTimeoutError(err: any): boolean {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  return /timed?\s?out/i.test(String(err.message || ''));
}

/** Hard 40s client-side limit for Vision OCR extraction requests. The backend
 *  enforces its own 35s timeout; this guarantees the UI can never hang even
 *  if the request never completes (e.g. a tunnel drops mid-upload). */
export const OCR_REQUEST_TIMEOUT_MS = 40000;

export const api = {
  // Auth
  login: (data: { email: string; password: string; expected_role?: string }) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  registerTeacher: (data: { name: string; email: string; password: string }) =>
    apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  registerStudentToken: (data: { name: string; email: string; password: string; share_token: string }) =>
    apiRequest('/auth/register-student-token', { method: 'POST', body: JSON.stringify(data) }),

  resolveToken: (token: string) =>
    apiRequest(`/auth/quick-join/resolve?token=${encodeURIComponent(token)}`),

  getMe: () => apiRequest('/auth/me'),

  // Assessments & Wizard
  createAssessment: (data: any) =>
    apiRequest('/assessments', { method: 'POST', body: JSON.stringify(data) }),

  listAssessments: () => apiRequest('/assessments'),

  getAssessment: (id: string) => apiRequest(`/assessments/${id}`),

  publishAssessment: (id: string) =>
    apiRequest(`/assessments/${id}/publish`, { method: 'POST' }),

  extractQuestions: (formData: FormData, timeoutMs: number = OCR_REQUEST_TIMEOUT_MS) =>
    apiRequest('/assessments/extract-questions', { method: 'POST', body: formData, timeoutMs }),

  extractRubric: (formData: FormData, timeoutMs: number = OCR_REQUEST_TIMEOUT_MS) =>
    apiRequest('/assessments/extract-rubric', { method: 'POST', body: formData, timeoutMs }),

  extractBulkAnswerKey: (formData: FormData, timeoutMs: number = OCR_REQUEST_TIMEOUT_MS) =>
    apiRequest('/assessments/extract-answer-key', { method: 'POST', body: formData, timeoutMs }),

  extractDiagrams: (formData: FormData, timeoutMs: number = OCR_REQUEST_TIMEOUT_MS) =>
    apiRequest('/assessments/extract-diagrams', { method: 'POST', body: formData, timeoutMs }),

  generateRubric: (data: {
    question_text: string;
    marks: number;
    question_type?: string;
    subject?: string;
    options?: string[];
    correct_answer?: string;
  }) =>
    apiRequest('/assessments/generate-rubric', { method: 'POST', body: JSON.stringify(data) }),

  // Attempts & Session
  startAttempt: (assessmentId: string) =>
    apiRequest(`/session/start/${assessmentId}`, { method: 'POST' }),

  getAttemptStatus: (attemptId: string) =>
    apiRequest(`/session/status/${attemptId}`),

  extendAttempt: (attemptId: string, extendMinutes: number = 15) =>
    apiRequest('/session/extend', {
      method: 'POST',
      body: JSON.stringify({ attempt_id: attemptId, extend_minutes: extendMinutes }),
    }),

  logBlurEvent: (attemptId: string, details?: string) =>
    apiRequest(`/session/log-blur/${attemptId}`, {
      method: 'POST',
      body: JSON.stringify({ event_type: 'blur', details }),
    }),

  submitAttempt: (attemptId: string, formData: FormData) =>
    apiRequest(`/session/submit/${attemptId}`, { method: 'POST', body: formData }),

  // Submissions (Teacher)
  listTeacherSubmissions: (assessmentId?: string) =>
    apiRequest(assessmentId ? `/submissions?assessment_id=${assessmentId}` : '/submissions'),

  listActiveAttempts: () => apiRequest('/submissions/active-attempts'),

  getSubmissionDetail: (id: string) => apiRequest(`/submissions/${id}`),

  instructAIRevision: (submissionId: string, instruction: string, questionId?: string) =>
    apiRequest(`/submissions/${submissionId}/instruct-ai`, {
      method: 'POST',
      body: JSON.stringify({ instruction, question_id: questionId }),
    }),

  acceptAIRevision: (submissionId: string) =>
    apiRequest(`/submissions/${submissionId}/accept-ai-revision`, { method: 'POST' }),

  rejectAIRevision: (submissionId: string) =>
    apiRequest(`/submissions/${submissionId}/reject-ai-revision`, { method: 'POST' }),

  publishSubmissionGrades: (id: string) =>
    apiRequest(`/submissions/${id}/publish-grades`, { method: 'POST' }),

  finalizeSubmissionGrades: (id: string) =>
    apiRequest(`/submissions/${id}/finalize-grades`, { method: 'POST' }),

  overrideQuestionGrades: (submissionId: string, grades: Record<string, number>) =>
    apiRequest(`/submissions/${submissionId}/override-grades`, {
      method: 'POST',
      body: JSON.stringify({ question_grades: grades }),
    }),

  // Performance & Growth Plans
  getPerformanceOverview: () => apiRequest('/performance/overview'),
  getPerformanceMatrix: () => apiRequest('/performance/matrix'),
  getGrowthPlans: () => apiRequest('/growth-plans'),

  // Student Endpoints
  getStudentDashboardSummary: () => apiRequest('/student/dashboard/summary'),
  getStudentSubmissions: () => apiRequest('/student/submissions'),
  getStudentSubmissionDetail: (id: string) => apiRequest(`/student/submissions/${id}`),
  getLearningPathDiagnostic: (concept?: string) =>
    apiRequest(concept ? `/learning-path/diagnostic?concept=${encodeURIComponent(concept)}` : '/learning-path/diagnostic'),
  getPracticeModule: (id: string) => apiRequest(`/learning-path/practice/${id}`),
};

export function getUploadFileUrl(filePath?: string | null): string {
  if (!filePath) return '';
  if (filePath.startsWith('http')) return filePath;
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  // Always same-origin: the Next.js server proxies /uploads/* to the backend
  // (next.config.js rewrites), which works identically on localhost and
  // through the Cloudflare tunnel. Identical on server and client render, so
  // no hydration mismatch and no absolute backend URL to go stale.
  return `/${cleanPath}`;
}
