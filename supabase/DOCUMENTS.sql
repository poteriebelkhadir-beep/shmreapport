-- SHM Rapports — documents générés (modèles PDF sauvegardés)
-- À exécuter dans Supabase → SQL Editor (une seule fois).
--
-- Comme rapport_users, cette table n'est accessible que par le serveur
-- (clé service_role). Aucune policy RLS : la clé anon ne peut rien lire.

create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       text        not null,
  template_type text        not null
                check (template_type in ('hierarchy', 'technical', 'proposals', 'custom')),
  name          text        not null,
  content       jsonb       not null,
  created_at    timestamptz not null default now()
);

create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);

alter table public.documents enable row level security;
-- Volontairement AUCUNE policy : accès réservé au service_role (serveur).
