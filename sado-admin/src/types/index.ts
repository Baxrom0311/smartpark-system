/**
 * Domain types mirroring the sado-api Pydantic schemas.
 * Keep these in lockstep with `sado-api/app/schemas/*.py`.
 */

export type UserRole = "parent" | "teacher" | "therapist" | "admin";
export type UserLanguage = "uz" | "ru" | "kk" | "en";
export type RiskLevel = "green" | "yellow" | "red";
export type AssessmentStatus =
  | "pending"
  | "recording"
  | "processing"
  | "completed"
  | "failed";

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

export interface ApiError {
  detail: string;
  code?: string;
  request_id?: string;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
  total: number | null;
}

export interface Child {
  id: string;
  name: string;
  birth_date: string;
  gender: "male" | "female" | "unknown";
  language: UserLanguage;
  notes: string | null;
  parent_id: string;
  kindergarten_id: string | null;
  created_at: string;
  updated_at: string;
  age_years: number;
}

export interface Kindergarten {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  teacher_count: number;
  child_count: number;
  region_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KindergartenStats {
  kindergarten_id: string;
  name: string;
  total_children: number;
  risk_green: number;
  risk_yellow: number;
  risk_red: number;
  assessed_children: number;
}

export interface Region {
  id: string;
  name: string;
  parent_id: string | null;
  type: "country" | "region" | "district";
}

export interface Exercise {
  id: string;
  title: string;
  description: string | null;
  category: string;
  age_group: string;
  difficulty: string;
  language: UserLanguage;
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

export interface Assessment {
  id: string;
  child_id: string;
  type: string;
  status: AssessmentStatus;
  risk_level: RiskLevel | null;
  confidence: number | null;
  created_at: string;
  completed_at: string | null;
}

export type AssignmentStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "expired";

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

export interface RiskDistribution {
  green: number;
  yellow: number;
  red: number;
  unknown: number;
}

export interface DailyAssessmentPoint {
  date: string;
  count: number;
}

export interface RolePopulation {
  parent: number;
  teacher: number;
  therapist: number;
  admin: number;
}

export interface SystemStats {
  total_children: number;
  total_users: number;
  total_kindergartens: number;
  total_regions: number;
  total_assessments: number;
  completed_assessments: number;
  assessments_today: number;
  active_therapists: number;
  red_risk_percentage: number;
  risk_distribution: RiskDistribution;
  user_roles: RolePopulation;
  weekly_assessments: DailyAssessmentPoint[];
}

export interface RegionStat {
  region_id: string | null;
  region_name: string;
  children: number;
  assessments: number;
  risk_distribution: RiskDistribution;
}

export interface KindergartenStatRow {
  kindergarten_id: string;
  name: string;
  region_id: string | null;
  region_name: string | null;
  child_count: number;
  assessments: number;
  red_count: number;
  yellow_count: number;
  green_count: number;
}

export interface RegionalStats {
  regions: RegionStat[];
  kindergartens: KindergartenStatRow[];
  daily_trend: DailyAssessmentPoint[];
}


/** Acoustic + linguistic features extracted from one recording. */
export interface MfccFeatures {
  n_mfcc: number;
  n_frames: number;
  matrix?: number[][];
  mean: number[];
  std: number[];
  min: number;
  max: number;
}

export interface PitchData {
  f0_hz: number[];
  f0_mean: number;
  f0_min: number;
  f0_max: number;
  voiced_ratio: number;
}

export interface FormantData {
  tracks: { f1: number[]; f2: number[]; f3: number[] };
  f1_mean: number;
  f2_mean: number;
  f3_mean: number;
}

export interface PhonemeScores {
  scores: Record<string, number>;
  weakest: { phoneme: string; score: number }[];
  strongest: { phoneme: string; score: number }[];
}

/** Risk-only analysis row for the parent-safe view. */
export interface AnalysisPublic {
  recording_id: string;
  risk_level: RiskLevel;
  confidence: number;
  transcript: string | null;
  feature_summary: Record<string, unknown> | null;
  model_name: string;
  model_version: string;
  created_at: string;
}

export interface AnalysisDetailed extends AnalysisPublic {
  mfcc_features: MfccFeatures | null;
  pitch_data: PitchData | null;
  formant_data: FormantData | null;
  phoneme_scores: PhonemeScores | null;
}

export interface AssessmentAnalysisResponse {
  assessment_id: string;
  overall_risk: RiskLevel | null;
  overall_confidence: number | null;
  status: AssessmentStatus;
  completed_at: string | null;
  results: AnalysisPublic[];
}

export interface AssessmentDetailedAnalysisResponse {
  assessment_id: string;
  overall_risk: RiskLevel | null;
  overall_confidence: number | null;
  status: AssessmentStatus;
  completed_at: string | null;
  results: AnalysisDetailed[];
}

export type NotificationType =
  | "system"
  | "assessment_ready"
  | "exercise_assigned"
  | "exercise_due"
  | "referral";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnreadCountResponse {
  unread: number;
}
