// Tipos compartidos de Markia (reflejan las tablas de Supabase).

export type ColorRole = "primary" | "secondary" | "accent" | "cream";
export type LayoutId = "centrado" | "banda" | "esquina" | "dividido" | "marco";
export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export interface TemplateDefinition {
  layout: LayoutId;
  fondo: ColorRole;
  texto: ColorRole;
  detalle: ColorRole;
}

export interface Template {
  id: string;
  user_id: string | null;
  kind: "generic" | "custom" | "addon_pack";
  name: string;
  definition: TemplateDefinition;
  created_at: string;
}

export interface Plan {
  id: string;
  name: string;
  price_cents: number;
  monthly_posts: number;
  generic_templates: number;
  custom_templates: number;
  instagram_autopost: boolean;
}

export interface Subscription {
  id: string;
  plan_id: string;
  subscription_status: string;
  next_due_date: string | null;
  posts_used_this_cycle: number;
  extra_posts_balance: number;
  extra_template_slots?: number;
  cycle_resets_on: string | null;
  plans: Plan | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  business_name: string | null;
  phone?: string | null;
  onboarding_completed: boolean;
}

export interface BrandKit {
  id?: string;
  user_id?: string;
  logo_path: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  color_cream: string;
  niche: string | null;
  voice_tone: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  template_id: string | null;
  title: string | null;
  caption: string | null;
  hashtags: string[];
  image_headline: string | null;
  image_subtext: string | null;
  post_type: string | null;
  scheduled_at: string | null;
  status: PostStatus;
  created_at: string;
}
