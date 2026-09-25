export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      appointment_slots: {
        Row: {
          automation_id: string
          created_at: string
          ends_at: string
          external_ref: string
          id: string
          notes: string
          starts_at: string
          status: string
          trace_id: string
          visitor_email: string
          visitor_name: string
          visitor_phone: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          ends_at: string
          external_ref?: string
          id?: string
          notes?: string
          starts_at: string
          status?: string
          trace_id?: string
          visitor_email?: string
          visitor_name?: string
          visitor_phone?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          ends_at?: string
          external_ref?: string
          id?: string
          notes?: string
          starts_at?: string
          status?: string
          trace_id?: string
          visitor_email?: string
          visitor_name?: string
          visitor_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target: string
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target?: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target?: string
        }
        Relationships: []
      }
      automation_instances: {
        Row: {
          automation_slug: string
          billing_plan: string
          business_context: string
          client_id: string
          conversations_count: number
          created_at: string
          expires_at: string | null
          grace_days: number
          id: string
          killed: boolean
          leads_count: number
          origin: string
          prompt_override: string
          provisioned_at: string | null
          script_token: string
          status: Database["public"]["Enums"]["automation_status"]
          system_prompt: string
          updated_at: string
          user_id: string
          warning_sent: boolean
          webhook_secret: string
          webhook_url: string
          webhook_verified: boolean
          website_domain: string
        }
        Insert: {
          automation_slug: string
          billing_plan?: string
          business_context?: string
          client_id?: string
          conversations_count?: number
          created_at?: string
          expires_at?: string | null
          grace_days?: number
          id?: string
          killed?: boolean
          leads_count?: number
          origin?: string
          prompt_override?: string
          provisioned_at?: string | null
          script_token?: string
          status?: Database["public"]["Enums"]["automation_status"]
          system_prompt?: string
          updated_at?: string
          user_id: string
          warning_sent?: boolean
          webhook_secret?: string
          webhook_url?: string
          webhook_verified?: boolean
          website_domain?: string
        }
        Update: {
          automation_slug?: string
          billing_plan?: string
          business_context?: string
          client_id?: string
          conversations_count?: number
          created_at?: string
          expires_at?: string | null
          grace_days?: number
          id?: string
          killed?: boolean
          leads_count?: number
          origin?: string
          prompt_override?: string
          provisioned_at?: string | null
          script_token?: string
          status?: Database["public"]["Enums"]["automation_status"]
          system_prompt?: string
          updated_at?: string
          user_id?: string
          warning_sent?: boolean
          webhook_secret?: string
          webhook_url?: string
          webhook_verified?: boolean
          website_domain?: string
        }
        Relationships: []
      }
      automation_knowledge: {
        Row: {
          archived: boolean
          automation_id: string
          content: string
          created_at: string
          id: string
          scope: string
          title: string
          updated_at: string
          version_hash: string
        }
        Insert: {
          archived?: boolean
          automation_id: string
          content?: string
          created_at?: string
          id?: string
          scope?: string
          title?: string
          updated_at?: string
          version_hash?: string
        }
        Update: {
          archived?: boolean
          automation_id?: string
          content?: string
          created_at?: string
          id?: string
          scope?: string
          title?: string
          updated_at?: string
          version_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_knowledge_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_windows: {
        Row: {
          automation_id: string
          created_at: string
          end_minute: number
          id: string
          slot_minutes: number
          start_minute: number
          timezone: string
          weekday: number
        }
        Insert: {
          automation_id: string
          created_at?: string
          end_minute: number
          id?: string
          slot_minutes?: number
          start_minute: number
          timezone?: string
          weekday: number
        }
        Update: {
          automation_id?: string
          created_at?: string
          end_minute?: number
          id?: string
          slot_minutes?: number
          start_minute?: number
          timezone?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "availability_windows_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tags: {
        Row: {
          created_at: string
          id: string
          tag: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tag: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tag?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_leads: {
        Row: {
          automation_id: string
          created_at: string
          email: string
          id: string
          intent: string
          lead_score: number
          name: string
          phone: string
          source: string
          summary: string
          trace_id: string
          updated_at: string
          webhook_response: string
          webhook_status: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          email?: string
          id?: string
          intent?: string
          lead_score?: number
          name?: string
          phone?: string
          source?: string
          summary?: string
          trace_id?: string
          updated_at?: string
          webhook_response?: string
          webhook_status?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          email?: string
          id?: string
          intent?: string
          lead_score?: number
          name?: string
          phone?: string
          source?: string
          summary?: string
          trace_id?: string
          updated_at?: string
          webhook_response?: string
          webhook_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      global_prompts: {
        Row: {
          content: string
          key: string
          updated_at: string
        }
        Insert: {
          content?: string
          key: string
          updated_at?: string
        }
        Update: {
          content?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      groq_failover_log: {
        Row: {
          created_at: string
          id: string
          key_id: string | null
          message: string
          status_code: number
        }
        Insert: {
          created_at?: string
          id?: string
          key_id?: string | null
          message?: string
          status_code?: number
        }
        Update: {
          created_at?: string
          id?: string
          key_id?: string | null
          message?: string
          status_code?: number
        }
        Relationships: []
      }
      groq_keys: {
        Row: {
          cooldown_until: string | null
          created_at: string
          enabled: boolean
          error_count: number
          id: string
          is_primary: boolean
          key_hint: string
          key_value: string
          label: string
          last_used_at: string | null
          request_count: number
        }
        Insert: {
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          error_count?: number
          id?: string
          is_primary?: boolean
          key_hint?: string
          key_value: string
          label: string
          last_used_at?: string | null
          request_count?: number
        }
        Update: {
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          error_count?: number
          id?: string
          is_primary?: boolean
          key_hint?: string
          key_value?: string
          label?: string
          last_used_at?: string | null
          request_count?: number
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          amount: number
          automation_id: string | null
          automation_slug: string
          billing_plan: string
          id: string
          origin: string
          payment_method: string
          promo_code: string | null
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sender_name: string
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          automation_id?: string | null
          automation_slug: string
          billing_plan: string
          id?: string
          origin?: string
          payment_method: string
          promo_code?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          automation_id?: string | null
          automation_slug?: string
          billing_plan?: string
          id?: string
          origin?: string
          payment_method?: string
          promo_code?: string | null
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_name?: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          active: boolean
          description: string
          listed: boolean
          monthly_price: number
          name: string
          slug: string
          updated_at: string
          yearly_discount_pct: number
        }
        Insert: {
          active?: boolean
          description?: string
          listed?: boolean
          monthly_price?: number
          name?: string
          slug: string
          updated_at?: string
          yearly_discount_pct?: number
        }
        Update: {
          active?: boolean
          description?: string
          listed?: boolean
          monthly_price?: number
          name?: string
          slug?: string
          updated_at?: string
          yearly_discount_pct?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          category: string
          company_email: string
          company_name: string
          created_at: string
          id: string
          profile_completed: boolean
          updated_at: string
          user_id: string
          website_url: string
        }
        Insert: {
          category?: string
          company_email?: string
          company_name?: string
          created_at?: string
          id?: string
          profile_completed?: boolean
          updated_at?: string
          user_id: string
          website_url?: string
        }
        Update: {
          category?: string
          company_email?: string
          company_name?: string
          created_at?: string
          id?: string
          profile_completed?: boolean
          updated_at?: string
          user_id?: string
          website_url?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          percent_off: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          percent_off?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          percent_off?: number
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tenant_features: {
        Row: {
          automation_id: string
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          monthly_price: number
          updated_at: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          monthly_price?: number
          updated_at?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          monthly_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_features_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_escalations: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          reason: string
          resolved_at: string | null
          sentiment: number
          status: string
          trace_id: string
          transcript: Json
          visitor_contact: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          sentiment?: number
          status?: string
          trace_id?: string
          transcript?: Json
          visitor_contact?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          reason?: string
          resolved_at?: string | null
          sentiment?: number
          status?: string
          trace_id?: string
          transcript?: Json
          visitor_contact?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_escalations_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_evaluations: {
        Row: {
          accuracy_score: number
          automation_id: string | null
          created_at: string
          helpfulness_score: number
          id: string
          improvements: Json
          model: string
          overall_score: number
          strengths: Json
          summary: string
          tone_score: number
          transcript: string
          user_id: string
        }
        Insert: {
          accuracy_score?: number
          automation_id?: string | null
          created_at?: string
          helpfulness_score?: number
          id?: string
          improvements?: Json
          model?: string
          overall_score?: number
          strengths?: Json
          summary?: string
          tone_score?: number
          transcript: string
          user_id: string
        }
        Update: {
          accuracy_score?: number
          automation_id?: string | null
          created_at?: string
          helpfulness_score?: number
          id?: string
          improvements?: Json
          model?: string
          overall_score?: number
          strengths?: Json
          summary?: string
          tone_score?: number
          transcript?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_evaluations_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          messages: Json
          visitor: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          messages?: Json
          visitor?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          messages?: Json
          visitor?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          model: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          model?: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          model?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      widget_rate_limits: {
        Row: {
          automation_id: string
          capacity: number
          refilled_at: string
          tokens: number
        }
        Insert: {
          automation_id: string
          capacity?: number
          refilled_at?: string
          tokens?: number
        }
        Update: {
          automation_id?: string
          capacity?: number
          refilled_at?: string
          tokens?: number
        }
        Relationships: [
          {
            foreignKeyName: "widget_rate_limits_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: true
            referencedRelation: "automation_instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_staff_invite: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      owns_automation: { Args: { _automation_id: string }; Returns: boolean }
      provision_automation: {
        Args: { _automation_id: string }
        Returns: string
      }
      review_payment: {
        Args: { _approve: boolean; _payment_id: string; _reason: string }
        Returns: undefined
      }
      run_subscription_lifecycle: { Args: never; Returns: undefined }
      validate_promo: { Args: { _code: string }; Returns: number }
    }
    Enums: {
      app_role: "client" | "verifier" | "admin" | "owner" | "partner"
      automation_status:
        | "paid"
        | "pending_payment"
        | "stopped"
        | "revoked"
        | "suspended"
        | "active"
      payment_status: "pending" | "approved" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["client", "verifier", "admin", "owner", "partner"],
      automation_status: [
        "paid",
        "pending_payment",
        "stopped",
        "revoked",
        "suspended",
        "active",
      ],
      payment_status: ["pending", "approved", "rejected"],
    },
  },
} as const
