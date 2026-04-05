/**
 * BarnBook public schema — Supabase Postgres types for typed clients.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/** public.profiles — extends auth.users */
export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  updated_at: string;
}

/** public.barns */
export interface Barn {
  id: string;
  name: string;
  owner_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  logo_url: string | null;
  banner_url: string | null;
  about: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  public_email: string | null;
  public_phone: string | null;
  barn_type: "standard" | "mare_motel";
  created_at: string;
  updated_at: string;
}

/** public.barn_photos */
export interface BarnPhoto {
  id: string;
  barn_id: string;
  photo_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

/** public.barn_members */
export interface BarnMember {
  id: string;
  barn_id: string;
  user_id: string;
  role: string;
  status: "active" | "disabled";
  created_at: string;
}

/** public.access_keys (formerly barn_keys) — barn & stall invite keys */
export interface AccessKey {
  id: string;
  barn_id: string;
  key_type: "barn" | "stall";
  horse_id: string | null;
  label: string | null;
  token_hash: string | null;
  key_code: string;
  permission_level: "viewer" | "editor";
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
}

/** @deprecated Use AccessKey */
export type BarnKey = AccessKey;

/** public.barn_access_requests */
export interface BarnAccessRequest {
  id: string;
  barn_id: string;
  user_id: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
}

/** public.key_redemptions */
export interface KeyRedemption {
  id: string;
  access_key_id: string;
  user_id: string;
  redeemed_at: string;
}

/** public.key_requests */
export interface KeyRequest {
  id: string;
  barn_id: string;
  requester_id: string;
  full_name: string | null;
  email: string | null;
  desired_role: string;
  message: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
}

/** public.user_horse_access — individual horse access via stall keys */
export interface UserHorseAccess {
  id: string;
  user_id: string;
  horse_id: string;
  source_key_id: string | null;
  created_at: string;
}

/** public.horses */
export interface Horse {
  id: string;
  barn_id: string;
  created_by: string | null;
  name: string;
  barn_name: string | null;
  breed: string | null;
  sex: string | null;
  color: string | null;
  foal_date: string | null;
  sire: string | null;
  dam: string | null;
  registration_number: string | null;
  microchip_number: string | null;
  photo_url: string | null;
  qr_code: string;
  /** Care card fields — publicly visible */
  feed_regimen: string | null;
  supplements: string | null;
  special_care_notes: string | null;
  turnout_schedule: string | null;
  created_at: string;
  updated_at: string;
}

/** public.activity_log */
export interface ActivityLog {
  id: string;
  horse_id: string;
  logged_by: string | null;
  activity_type: string;
  notes: string | null;
  distance: number | null;
  duration_minutes: number;
  speed_avg: number | null;
  details: Json | null;
  logged_at_barn_id: string | null;
  updated_at: string | null;
  updated_by_user_id: string | null;
  created_at: string;
}

/** public.health_records */
export interface HealthRecord {
  id: string;
  horse_id: string;
  record_type: string;
  provider_name: string | null;
  description: string | null;
  notes: string | null;
  record_date: string;
  next_due_date: string | null;
  document_url: string | null;
  details: Json | null;
  logged_by: string | null;
  logged_at_barn_id: string | null;
  updated_at: string | null;
  updated_by_user_id: string | null;
  created_at: string;
}

/** public.horse_stays */
export interface HorseStay {
  id: string;
  horse_id: string;
  home_barn_id: string;
  host_barn_id: string;
  start_date: string;
  end_date: string | null;
  status: "active" | "completed" | "cancelled";
  created_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** public.log_media */
export interface LogMedia {
  id: string;
  log_type: "activity" | "health";
  log_id: string;
  media_type: "photo" | "video";
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

/** public.horse_biometric_embeddings */
export interface HorseBiometricEmbedding {
  horse_id: string;
  pose_key: string;
  embedding: Json;
  photo_url: string | null;
  updated_at: string;
}

export type ProfileInsert = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  updated_at?: string;
};

export type ProfileUpdate = Partial<Omit<Profile, "id">>;

export type BarnInsert = {
  id?: string;
  name: string;
  owner_id?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  about?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  barn_type?: "standard" | "mare_motel";
  created_at?: string;
  updated_at?: string;
};

export type BarnUpdate = Partial<Omit<Barn, "id">>;

export type BarnPhotoInsert = {
  id?: string;
  barn_id: string;
  photo_url: string;
  caption?: string | null;
  sort_order?: number;
  created_at?: string;
};

export type BarnMemberInsert = {
  id?: string;
  barn_id: string;
  user_id: string;
  role?: string;
  status?: "active" | "disabled";
  created_at?: string;
};

export type BarnMemberUpdate = Partial<Omit<BarnMember, "id" | "barn_id" | "user_id">>;

export type AccessKeyInsert = {
  id?: string;
  barn_id: string;
  key_type: "barn" | "stall";
  horse_id?: string | null;
  label?: string | null;
  token_hash?: string | null;
  key_code: string;
  permission_level?: "viewer" | "editor";
  max_uses?: number | null;
  times_used?: number;
  is_active?: boolean;
  created_at?: string;
  expires_at?: string | null;
};

/** @deprecated Use AccessKeyInsert */
export type BarnKeyInsert = AccessKeyInsert;

export type UserHorseAccessInsert = {
  id?: string;
  user_id: string;
  horse_id: string;
  source_key_id?: string | null;
  created_at?: string;
};

export type HorseInsert = {
  id?: string;
  barn_id: string;
  created_by?: string | null;
  name: string;
  barn_name?: string | null;
  breed?: string | null;
  sex?: string | null;
  color?: string | null;
  foal_date?: string | null;
  sire?: string | null;
  dam?: string | null;
  registration_number?: string | null;
  microchip_number?: string | null;
  photo_url?: string | null;
  qr_code: string;
  feed_regimen?: string | null;
  supplements?: string | null;
  special_care_notes?: string | null;
  turnout_schedule?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type HorseUpdate = Partial<Omit<Horse, "id" | "created_at">>;

export type HorseStayInsert = {
  id?: string;
  horse_id: string;
  home_barn_id: string;
  host_barn_id: string;
  start_date?: string;
  end_date?: string | null;
  status?: "active" | "completed" | "cancelled";
  created_by_user_id?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LogMediaInsert = {
  id?: string;
  log_type: "activity" | "health";
  log_id: string;
  media_type: "photo" | "video";
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  sort_order?: number;
  created_at?: string;
};

export type ActivityLogInsert = {
  id?: string;
  horse_id: string;
  logged_by?: string | null;
  activity_type: string;
  notes?: string | null;
  distance?: number | null;
  duration_minutes: number;
  speed_avg?: number | null;
  details?: Json | null;
  logged_at_barn_id?: string | null;
  created_at?: string;
};

export type ActivityLogUpdate = Partial<
  Omit<ActivityLog, "id" | "horse_id">
>;

export type HealthRecordInsert = {
  id?: string;
  horse_id: string;
  record_type: string;
  provider_name?: string | null;
  description?: string | null;
  notes?: string | null;
  record_date: string;
  next_due_date?: string | null;
  document_url?: string | null;
  details?: Json | null;
  logged_by?: string | null;
  logged_at_barn_id?: string | null;
  created_at?: string;
};

export type HealthRecordUpdate = Partial<
  Omit<HealthRecord, "id" | "horse_id">
>;

export type HorseBiometricEmbeddingInsert = {
  horse_id: string;
  pose_key: string;
  embedding: Json;
  photo_url?: string | null;
  updated_at?: string;
};

export type HorseBiometricEmbeddingUpdate = Partial<
  Omit<HorseBiometricEmbedding, "horse_id" | "pose_key">
>;

type R = Record<string, unknown>;

/** Supabase client generic — `& R` satisfies @supabase/postgrest-js `GenericTable` Row/Insert/Update */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile & R;
        Insert: ProfileInsert & R;
        Update: ProfileUpdate & R;
        Relationships: [];
      };
      barns: {
        Row: Barn & R;
        Insert: BarnInsert & R;
        Update: BarnUpdate & R;
        Relationships: [];
      };
      barn_members: {
        Row: BarnMember & R;
        Insert: BarnMemberInsert & R;
        Update: BarnMemberUpdate & R;
        Relationships: [];
      };
      barn_photos: {
        Row: BarnPhoto & R;
        Insert: BarnPhotoInsert & R;
        Update: Partial<Omit<BarnPhoto, "id">> & R;
        Relationships: [];
      };
      access_keys: {
        Row: AccessKey & R;
        Insert: AccessKeyInsert & R;
        Update: Partial<AccessKey> & R;
        Relationships: [];
      };
      key_redemptions: {
        Row: KeyRedemption & R;
        Insert: {
          id?: string;
          access_key_id: string;
          user_id: string;
          redeemed_at?: string;
        } & R;
        Update: Partial<Omit<KeyRedemption, "id">> & R;
        Relationships: [];
      };
      key_requests: {
        Row: KeyRequest & R;
        Insert: {
          id?: string;
          barn_id: string;
          requester_id: string;
          full_name?: string | null;
          email?: string | null;
          desired_role?: string;
          message?: string | null;
          status?: "pending" | "approved" | "denied";
          created_at?: string;
        } & R;
        Update: Partial<Omit<KeyRequest, "id">> & R;
        Relationships: [];
      };
      barn_access_requests: {
        Row: BarnAccessRequest & R;
        Insert: {
          id?: string;
          barn_id: string;
          user_id: string;
          status?: "pending" | "approved" | "denied";
          created_at?: string;
        } & R;
        Update: Partial<Omit<BarnAccessRequest, "id">> & R;
        Relationships: [];
      };
      user_horse_access: {
        Row: UserHorseAccess & R;
        Insert: UserHorseAccessInsert & R;
        Update: Partial<Omit<UserHorseAccess, "id">> & R;
        Relationships: [];
      };
      horses: {
        Row: Horse & R;
        Insert: HorseInsert & R;
        Update: HorseUpdate & R;
        Relationships: [];
      };
      activity_log: {
        Row: ActivityLog & R;
        Insert: ActivityLogInsert & R;
        Update: ActivityLogUpdate & R;
        Relationships: [];
      };
      health_records: {
        Row: HealthRecord & R;
        Insert: HealthRecordInsert & R;
        Update: HealthRecordUpdate & R;
        Relationships: [];
      };
      horse_stays: {
        Row: HorseStay & R;
        Insert: HorseStayInsert & R;
        Update: Partial<Omit<HorseStay, "id">> & R;
        Relationships: [];
      };
      log_media: {
        Row: LogMedia & R;
        Insert: LogMediaInsert & R;
        Update: Partial<Omit<LogMedia, "id">> & R;
        Relationships: [];
      };
      horse_biometric_embeddings: {
        Row: HorseBiometricEmbedding & R;
        Insert: HorseBiometricEmbeddingInsert & R;
        Update: HorseBiometricEmbeddingUpdate & R;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      redeem_access_key: {
        Args: { p_raw_code: string; p_user_id: string };
        Returns: Json;
      };
    };
  };
};
