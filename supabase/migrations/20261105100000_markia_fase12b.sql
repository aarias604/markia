-- Markia · Fase 12b: modo de conexión de Instagram (inicio de sesión unificado de Meta)
alter table public.instagram_accounts add column if not exists api_mode text not null default 'instagram';
do $$ begin
  alter table public.instagram_accounts add constraint instagram_accounts_mode_ck check (api_mode in ('instagram', 'facebook'));
exception when duplicate_object then null; end $$;
