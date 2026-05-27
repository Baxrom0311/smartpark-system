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
