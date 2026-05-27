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
  total: number | null;
}

export interface Child {
  id: string;
  parent_id: string;
  name: string;
  birth_date: string;
  gender: "male" | "female" | "other";
  language: UserLanguage;
  kindergarten_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Kindergarten {
  id: string;
  name: string;
  region_id: string | null;
  address: string | null;
  teacher_count: number;
  child_count: number;
  created_at: string;
}

export interface Region {
  id: string;
  name: string;
  parent_id: string | null;
  type: "country" | "region" | "district";
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

export interface SystemStats {
  total_users: number;
  total_children: number;
  total_assessments: number;
  assessments_today: number;
  red_risk_pct: number;
  yellow_risk_pct: number;
  green_risk_pct: number;
  active_therapists: number;
  active_kindergartens: number;
  weekly_assessments: Array<{ date: string; count: number }>;
}
