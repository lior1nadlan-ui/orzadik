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
      abandoned_carts: {
        Row: {
          converted_order_id: string | null
          created_at: string
          email: string
          id: string
          items: Json
          name: string | null
          reminder_1_sent_at: string | null
          reminder_2_sent_at: string | null
          subtotal: number
          unsubscribed: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          converted_order_id?: string | null
          created_at?: string
          email: string
          id?: string
          items?: Json
          name?: string | null
          reminder_1_sent_at?: string | null
          reminder_2_sent_at?: string | null
          subtotal?: number
          unsubscribed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          converted_order_id?: string | null
          created_at?: string
          email?: string
          id?: string
          items?: Json
          name?: string | null
          reminder_1_sent_at?: string | null
          reminder_2_sent_at?: string | null
          subtotal?: number
          unsubscribed?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          author: string | null
          body_html: string
          category_id: string | null
          created_at: string | null
          description: string
          featured_image: string | null
          id: string
          is_published: boolean | null
          published_at: string
          read_time_minutes: number | null
          seo_keywords: string | null
          slug: string
          title_he: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          body_html: string
          category_id?: string | null
          created_at?: string | null
          description: string
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string
          read_time_minutes?: number | null
          seo_keywords?: string | null
          slug: string
          title_he: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          body_html?: string
          category_id?: string | null
          created_at?: string | null
          description?: string
          featured_image?: string | null
          id?: string
          is_published?: boolean | null
          published_at?: string
          read_time_minutes?: number | null
          seo_keywords?: string | null
          slug?: string
          title_he?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          claimed_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          name: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          claimed_at?: string | null
          created_at?: string
          email: string
          error?: string | null
          id?: string
          name?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          claimed_at?: string | null
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          name?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          failed_count: number
          finished_at: string | null
          id: string
          intro_html: string
          recipient_count: number
          sent_count: number
          started_at: string | null
          status: string
          subject: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          intro_html?: string
          recipient_count?: number
          sent_count?: number
          started_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          intro_html?: string
          recipient_count?: number
          sent_count?: number
          started_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          long_description: string | null
          name: string
          parent_slug: string | null
          slug: string
          sort_order: number
          updated_at: string
          wp_id: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          long_description?: string | null
          name: string
          parent_slug?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
          wp_id?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          long_description?: string | null
          name?: string
          parent_slug?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
          wp_id?: number | null
        }
        Relationships: []
      }
      crm_customer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_email: string
          id: string
          note: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_email: string
          id?: string
          note: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_email?: string
          id?: string
          note?: string
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          consented_at: string
          created_at: string
          email: string
          id: string
          name: string | null
          source: string
          unsubscribed_at: string | null
        }
        Insert: {
          consented_at?: string
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source: string
          unsubscribed_at?: string | null
        }
        Update: {
          consented_at?: string
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          custom_text: string | null
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          product_name: string
          product_sku: string | null
          quantity: number
          unit_price: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          custom_text?: string | null
          id?: string
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: string
          product_sku?: string | null
          quantity: number
          unit_price: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          custom_text?: string | null
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_sku?: string | null
          quantity?: number
          unit_price?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payment_secrets: {
        Row: {
          cardcom_token: string | null
          cardcom_token_approval_number: string | null
          cardcom_token_card_month: number | null
          cardcom_token_card_owner_identity_number: string | null
          cardcom_token_card_year: number | null
          created_at: string
          order_id: string
          updated_at: string
        }
        Insert: {
          cardcom_token?: string | null
          cardcom_token_approval_number?: string | null
          cardcom_token_card_month?: number | null
          cardcom_token_card_owner_identity_number?: string | null
          cardcom_token_card_year?: number | null
          created_at?: string
          order_id: string
          updated_at?: string
        }
        Update: {
          cardcom_token?: string | null
          cardcom_token_approval_number?: string | null
          cardcom_token_card_month?: number | null
          cardcom_token_card_owner_identity_number?: string | null
          cardcom_token_card_year?: number | null
          created_at?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_payment_secrets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cardcom_description: string | null
          cardcom_document_number: number | null
          cardcom_document_type: string | null
          cardcom_low_profile_id: string | null
          cardcom_operation: string | null
          cardcom_response_code: string | null
          cardcom_tranzaction_id: number | null
          contact_consent: boolean
          contact_consent_at: string | null
          created_at: string
          customer_address: string
          customer_city: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          gift_note: string | null
          gift_wrap: boolean
          id: string
          is_gift: boolean
          notes: string | null
          order_number: string
          paid_at: string | null
          payment_method: string | null
          payment_provider: string | null
          payment_status: string
          payment_txn_id: string | null
          review_request_sent_at: string | null
          shipped_at: string | null
          shipping: number
          shipping_carrier: string | null
          shipping_notified_at: string | null
          shipping_status: string
          status: string
          stock_decremented_at: string | null
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cardcom_description?: string | null
          cardcom_document_number?: number | null
          cardcom_document_type?: string | null
          cardcom_low_profile_id?: string | null
          cardcom_operation?: string | null
          cardcom_response_code?: string | null
          cardcom_tranzaction_id?: number | null
          contact_consent?: boolean
          contact_consent_at?: string | null
          created_at?: string
          customer_address: string
          customer_city?: string | null
          customer_email: string
          customer_name: string
          customer_phone: string
          gift_note?: string | null
          gift_wrap?: boolean
          id?: string
          is_gift?: boolean
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: string
          payment_txn_id?: string | null
          review_request_sent_at?: string | null
          shipped_at?: string | null
          shipping?: number
          shipping_carrier?: string | null
          shipping_notified_at?: string | null
          shipping_status?: string
          status?: string
          stock_decremented_at?: string | null
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cardcom_description?: string | null
          cardcom_document_number?: number | null
          cardcom_document_type?: string | null
          cardcom_low_profile_id?: string | null
          cardcom_operation?: string | null
          cardcom_response_code?: string | null
          cardcom_tranzaction_id?: number | null
          contact_consent?: boolean
          contact_consent_at?: string | null
          created_at?: string
          customer_address?: string
          customer_city?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          gift_note?: string | null
          gift_wrap?: boolean
          id?: string
          is_gift?: boolean
          notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          payment_status?: string
          payment_txn_id?: string | null
          review_request_sent_at?: string | null
          shipped_at?: string | null
          shipping?: number
          shipping_carrier?: string | null
          shipping_notified_at?: string | null
          shipping_status?: string
          status?: string
          stock_decremented_at?: string | null
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          product_id: string
        }
        Insert: {
          category_id: string
          product_id: string
        }
        Update: {
          category_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          id: string
          in_stock: boolean
          label: string
          price: number | null
          price_delta: number
          product_id: string
          sku: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          in_stock?: boolean
          label: string
          price?: number | null
          price_delta?: number
          product_id: string
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          in_stock?: boolean
          label?: string
          price?: number | null
          price_delta?: number
          product_id?: string
          sku?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          name_norm: string | null
          price: number
          sale_price: number | null
          search_blob: string | null
          short_description: string | null
          sku: string | null
          slug: string
          stock_qty: number | null
          stock_status: string
          thumbnail_url: string | null
          track_stock: boolean
          updated_at: string
          wp_id: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_norm?: string | null
          price?: number
          sale_price?: number | null
          search_blob?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          stock_qty?: number | null
          stock_status?: string
          thumbnail_url?: string | null
          track_stock?: boolean
          updated_at?: string
          wp_id?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_norm?: string | null
          price?: number
          sale_price?: number | null
          search_blob?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          stock_qty?: number | null
          stock_status?: string
          thumbnail_url?: string | null
          track_stock?: boolean
          updated_at?: string
          wp_id?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_member: boolean
          marketing_consent: boolean
          marketing_consent_at: string | null
          marketing_consent_source: string | null
          member_since: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_member?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          member_since?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_member?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          member_since?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          expires_at: string
          key: string
        }
        Insert: {
          count?: number
          expires_at: string
          key: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          id: string
          is_approved: boolean
          order_id: string | null
          product_id: string
          rating: number
          title: string | null
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          order_id?: string | null
          product_id: string
          rating: number
          title?: string | null
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          order_id?: string | null
          product_id?: string
          rating?: number
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_campaign_recipients: {
        Args: { p_campaign_id: string; p_limit: number }
        Returns: {
          campaign_id: string
          claimed_at: string | null
          created_at: string
          email: string
          error: string | null
          id: string
          name: string | null
          sent_at: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "campaign_recipients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_abandoned_carts: { Args: never; Returns: undefined }
      decrement_order_stock: { Args: { p_order_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_rate_limit: {
        Args: { p_key: string; p_ttl_seconds: number }
        Returns: number
      }
      norm_he: { Args: { t: string }; Returns: string }
      search_products: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_sort?: string
          p_term: string
        }
        Returns: {
          id: string
          name: string
          price: number
          sale_price: number
          slug: string
          stock_status: string
          thumbnail_url: string
          total_count: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
