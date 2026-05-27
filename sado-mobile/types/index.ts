/**
 * Domain types mirroring the sado-api Pydantic schemas.
 *
 * Keep these in lockstep with `sado-api/app/schemas/*.py`. Every type
 * used at an API boundary is declared here so screens and services
 * never have to depend on raw `unknown` payloads.
 */

export type UserRole = "parent" | "teacher" | "therapist" | "admin";
export type UserLanguage = "uz" | "ru" | "kk" | "en";
export type RiskLevel = "green" | "yellow" | "red";
export type ChildGender = "male" | "female" | "unknown";
export type AssessmentStatus =
  | "pending"
  | "in_progress"
  | "processing"
  | "completed"
  | "failed";
export type AssessmentType =
  | "screening"
  | "diagnostic"
  | "follow_up"
  | "practice";
export type RecordingTaskType =
  | "repeat_word"
  | "repeat_sentence"
  | "free_speech"
  | "naming"
  | "phoneme";

export interface UserPublic {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string;
  role: UserRole;
  language: UserLanguage;
  is_active: boolean;
  is_verified: boolean;
  region_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterRequest {
  email?: string;
  phone?: string;
  password: string;
  full_name: string;
  role?: UserRole;
  language?: UserLanguage;
}

export interface ApiErrorPayload {
  detail: string;
  code?: string;
  request_id?: string;
}

/**
 * Cursor-paginated page returned by every list endpoint.
 *
 * Mirrors `app.core.pagination.Page[T]` on the backend — the API does
 * NOT return a `total`. Use `has_more` + `next_cursor` to iterate.
 */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

/* ----------------------------------------------------------------- Children */

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string;
  gender: ChildGender;
  language: UserLanguage;
  notes: string | null;
  kindergarten_id: string | null;
  age_years: number;
  created_at: string;
  updated_at: string;
}

export interface ChildCreateRequest {
  name: string;
  birth_date: string;
  gender: ChildGender;
  language: UserLanguage;
  kindergarten_id?: string | null;
  notes?: string | null;
}

/* -------------------------------------------------------------- Exercises */

export type ExerciseCategory =
  | "articulation"
  | "phonemic"
  | "vocabulary"
  | "grammar"
  | "fluency"
  | "voice"
  | "listening";

export type ExerciseAgeGroup = "toddler" | "preschool" | "school" | "tween";
export type ExerciseDifficulty = "easy" | "medium" | "hard";

export type AssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped";

export interface Exercise {
  id: string;
  title: string;
  description: string | null;
  category: string;
  age_group: string;
  difficulty: string;
  language: string;
  duration_minutes: number;
  audio_example_path: string | null;
  image_path: string | null;
  instructions: string | null;
  target_phonemes: string | null;
  is_active: boolean;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseAssignment {
  id: string;
  child_id: string;
  exercise_id: string;
  assigned_by_id: string | null;
  status: AssignmentStatus;
  due_date: string | null;
  completed_at: string | null;
  score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  exercise: Exercise | null;
}

export interface ExerciseAssignmentCreateRequest {
  exercise_id: string;
  due_date?: string | null;
  notes?: string | null;
}

export interface ExerciseAssignmentCompleteRequest {
  score?: number | null;
  notes?: string | null;
}

/* ------------------------------------------------------------- Assessments */

export interface AudioRecording {
  id: string;
  assessment_id: string;
  task_type: RecordingTaskType;
  prompt: string | null;
  storage_key: string;
  content_type: string;
  size_bytes: number;
  duration_sec: number | null;
  sample_rate: number | null;
  processed: boolean;
  processing_error: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Assessment {
  id: string;
  child_id: string;
  created_by_id: string | null;
  type: AssessmentType;
  status: AssessmentStatus;
  overall_risk: RiskLevel | null;
  overall_confidence: number | null;
  summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  recordings: AudioRecording[];
}

export interface AssessmentCreateRequest {
  child_id: string;
  type?: AssessmentType;
}

export interface AnalysisRecord {
  recording_id: string;
  risk_level: RiskLevel;
  confidence: number;
  transcript: string | null;
  feature_summary: Record<string, unknown> | null;
  model_name: string;
  model_version: string;
  created_at: string;
}

export interface AssessmentAnalysis {
  assessment_id: string;
  overall_risk: RiskLevel | null;
  overall_confidence: number | null;
  status: AssessmentStatus;
  completed_at: string | null;
  results: AnalysisRecord[];
}
