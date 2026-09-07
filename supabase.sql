-- =====================================================================
--  Galeria de fotos — Igreja Evangélica Vinho Novo em Saquarema
--
--  Cole este código no SQL Editor do Supabase e clique em RUN.
--  Pode rodar quantas vezes quiser: ele nunca apaga nada nem duplica.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Álbuns  (um por evento: culto, batismo, casamento, retiro...)
-- ---------------------------------------------------------------------
create table if not exists public.albuns (
  id          bigint generated always as identity primary key,
  slug        text        not null unique,   -- vai no endereço: /album/batismo-2026
  titulo      text        not null,
  data_evento date        not null,
  descricao   text,
  capa        text,                          -- caminho da miniatura de capa
  publicado   boolean     not null default true,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Fotos  (o arquivo mora no Storage; aqui fica só o endereço dele)
-- ---------------------------------------------------------------------
create table if not exists public.fotos (
  id           bigint generated always as identity primary key,
  album_id     bigint      not null references public.albuns(id) on delete cascade,
  caminho      text        not null unique,  -- albuns/<slug>/<arquivo>.jpg
  caminho_mini text,                         -- albuns/<slug>/mini/<arquivo>.jpg
  nome_arquivo text        not null,
  tamanho      bigint,
  criado_em    timestamptz not null default now()
);

-- Abrir um álbum com centenas de fotos precisa continuar instantâneo.
create index if not exists fotos_album_idx    on public.fotos  (album_id, criado_em);
create index if not exists albuns_data_idx    on public.albuns (data_evento desc, criado_em desc);

-- ---------------------------------------------------------------------
-- 3. Tranca as tabelas: nenhuma política é criada de propósito.
--    Ninguém acessa direto pela internet; só as funções do site,
--    que usam a chave de serviço, gravam e leem.
-- ---------------------------------------------------------------------
alter table public.albuns enable row level security;
alter table public.fotos  enable row level security;

-- ---------------------------------------------------------------------
-- 4. O balde (bucket) do Storage onde as fotos ficam guardadas.
--    Privado: as imagens só abrem por link assinado, gerado pelo site.
--    Se preferir criar pela tela: Storage > New bucket > nome "fotos",
--    Public desligado, limite de 25 MB por arquivo.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('fotos', 'fotos', false, 26214400)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 5. Contador de acessos por álbum.
--    Some 1 a cada aparelho novo que abre o álbum. A soma é feita pelo
--    banco (não por leitura + escrita), então duas pessoas abrindo ao
--    mesmo tempo nunca derrubam a contagem uma da outra.
-- ---------------------------------------------------------------------
alter table public.albuns add column if not exists visitas bigint not null default 0;

create or replace function public.contar_visita(p_slug text)
returns void
language sql
as $$
  update public.albuns set visitas = visitas + 1 where slug = p_slug;
$$;
