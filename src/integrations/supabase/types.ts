export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_security_audit: {
        Row: {
          action: string;
          actor_user_id: string | null;
          created_at: string;
          details: string | null;
          id: string;
          target_user_id: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          target_user_id?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          created_at?: string;
          details?: string | null;
          id?: string;
          target_user_id?: string | null;
        };
        Relationships: [];
      };
      app_legal_pages: {
        Row: {
          content: string;
          id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          id?: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          id?: string;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      banners: {
        Row: {
          created_at: string;
          cta_label: string | null;
          id: string;
          image_url: string;
          is_active: boolean;
          sort_order: number;
          subtitle: string | null;
          target_url: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cta_label?: string | null;
          id?: string;
          image_url: string;
          is_active?: boolean;
          sort_order?: number;
          subtitle?: string | null;
          target_url?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cta_label?: string | null;
          id?: string;
          image_url?: string;
          is_active?: boolean;
          sort_order?: number;
          subtitle?: string | null;
          target_url?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          is_hidden: boolean;
          keywords: string[];
          parent_id: string | null;
          sort_order: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id: string;
          is_hidden?: boolean;
          keywords?: string[];
          parent_id?: string | null;
          sort_order?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          is_hidden?: boolean;
          keywords?: string[];
          parent_id?: string | null;
          sort_order?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      favorites: {
        Row: {
          created_at: string;
          id: string;
          shop_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          shop_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          shop_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_attempts: {
        Row: {
          created_at: string;
          id: string;
          outcome: "success" | "failure";
          phone: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          outcome: "success" | "failure";
          phone: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          outcome?: "success" | "failure";
          phone?: string;
        };
        Relationships: [];
      };
      password_reset_attempts: {
        Row: {
          created_at: string;
          id: string;
          phone: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          phone: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          phone?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          shop_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          shop_id?: string | null;
          title: string;
          type?: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          shop_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          author_name: string | null;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          shop_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          author_name?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          shop_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          author_name?: string | null;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          shop_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_bank_details: {
        Row: {
          bank_account_holder: string | null;
          bank_account_number: string | null;
          bank_name: string | null;
          created_at: string;
          shop_id: string;
          updated_at: string;
        };
        Insert: {
          bank_account_holder?: string | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          shop_id: string;
          updated_at?: string;
        };
        Update: {
          bank_account_holder?: string | null;
          bank_account_number?: string | null;
          bank_name?: string | null;
          created_at?: string;
          shop_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_bank_details_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          address: string | null;
          created_at: string;
          description: string;
          id: string;
          image_url: string | null;
          is_24_7: boolean;
          map_url: string | null;
          name: string;
          opening_hours: Json | null;
          owner_id: string;
          phone: string;
          rating: number;
          sector_id: string;
          specialties: string[];
          status: string;
          subsection_id: string;
          updated_at: string;
          visits: number;
          whatsapp: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          description: string;
          id?: string;
          image_url?: string | null;
          is_24_7?: boolean;
          map_url?: string | null;
          name: string;
          opening_hours?: Json | null;
          owner_id: string;
          phone: string;
          rating?: number;
          sector_id: string;
          specialties?: string[];
          status?: string;
          subsection_id: string;
          updated_at?: string;
          visits?: number;
          whatsapp?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          description?: string;
          id?: string;
          image_url?: string | null;
          is_24_7?: boolean;
          map_url?: string | null;
          name?: string;
          opening_hours?: Json | null;
          owner_id?: string;
          phone?: string;
          rating?: number;
          sector_id?: string;
          specialties?: string[];
          status?: string;
          subsection_id?: string;
          updated_at?: string;
          visits?: number;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_ratings: {
        Row: {
          author_name: string | null;
          comment: string | null;
          created_at: string | null;
          id: string | null;
          rating: number | null;
          shop_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          author_name?: string | null;
          comment?: string | null;
          created_at?: string | null;
          id?: string | null;
          rating?: number | null;
          shop_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          author_name?: string | null;
          comment?: string | null;
          created_at?: string | null;
          id?: string | null;
          rating?: number | null;
          shop_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ratings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      consume_password_reset_attempt: {
        Args: {
          p_phone: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user" | "owner";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "owner"],
    },
  },
} as const;
