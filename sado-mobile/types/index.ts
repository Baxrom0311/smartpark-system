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
export type ChildGender = "male" | "female" | "other";
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

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
  total: number | null;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string;
  gender: ChildGender;
  language: UserLanguage;
  kindergarten_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChildCreateRequest {
  name: string;
  birth_date: string;
  gender: ChildGender;
  language: UserLanguage;
  kindergarten_id?: string | null;
}

export interface Exercise {
  id: string;
  category: string;
  age_group: string;
  difficulty: number;
  language: UserLanguage;
  title: string;
  description: string;
  audio_example_path: string | null;
  image_path: string | null;
  created_at: string;
}

export interface ExerciseAssignment {
  id: string;
  child_id: string;
  exercise_id: string;
  assigned_by: string;
  due_date: string | null;
  completed_at: string | null;
  score: number | null;
  created_at: string;
  exercise: Exercise | null;
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

export interface AssessmentResult {
  assessment_id: string;
  risk_level: RiskLevel;
  confidence: number;
  summary: string;
  recommendations: string[];
}
