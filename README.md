# Fotos da igreja — Igreja Evangélica Vinho Novo em Saquarema

Site para a igreja baixar as fotos dos cultos e eventos, com um painel
reservado para quem publica as imagens. Feito para celular, no mesmo estilo da
ficha de visitantes.

Três telas:

- **`/`** — a lista de álbuns. Cada evento é um card com capa, data e quantas
  fotos tem, e uma busca no topo acha pelo nome ou pela data.
- **`/album/NOME-DO-ALBUM`** — as fotos daquele evento. Toque em uma foto para
  ver grande (com setas e teclado) e na setinha para salvar no aparelho. O
  download é foto a foto, de propósito: quem quer três leva três, e o gasto de
  internet do plano grátis fica sob controle. Ninguém precisa de cadastro.
- **`/painel/CHAVE-SECRETA`** — o painel de quem publica. Cria o álbum, arrasta
  as fotos (ou escolhe pelo celular), acompanha a barra de envio, troca a capa,
  apaga foto e apaga álbum. Um álbum pode ficar **oculto** enquanto as fotos
  não estão prontas: só aparece no site quando você marca como publicado.

## Como funciona por dentro

| Parte | Onde fica |
|---|---|
| Telas | `site/index.html`, `site/album.html` e `site/painel.html` — HTML puro, sem framework |
| Estilo | `site/estilo.css` — mesmas cores da ficha de visitantes |
| Servidor | `netlify/functions/` — cria álbuns, assina os endereços e registra as fotos |
| Banco | Supabase (PostgreSQL), tabelas criadas por `supabase.sql` |
| Fotos | Cloudinary, Cloudflare R2 ou Supabase Storage — escolhido pelas variáveis de ambiente |
| Hospedagem | Netlify, configurada por `netlify.toml` |

As tabelas ficam trancadas (RLS ligado, sem políticas públicas): ninguém acessa
direto pela internet. Só as funções do servidor, que usam a chave de serviço,
gravam e leem. O navegador nunca vê chave nenhuma.

As fotos moram em um balde privado. Para mostrar ou baixar, o servidor assina um
endereço temporário (vale 6 horas) para cada arquivo. Para enviar, o painel pede
um endereço de envio válido por 15 minutos e o celular manda a foto **direto**
para o armazenamento — o arquivo não passa pela função, então não esbarra no
limite de tamanho da Netlify e álbuns de centenas de fotos sobem sem travar.

O painel é protegido por um link secreto: a chave vai no endereço e é conferida
no servidor, contra a variável `PAINEL_KEY`.

Antes de enviar, o painel encolhe cada foto para no máximo 2560 px (dá para
desligar) e gera uma miniatura de 700 px. É isso que faz o álbum abrir rápido no
celular e o espaço grátis render muito mais.

## Publicar

Passo a passo completo em [COMO-INSTALAR.md](COMO-INSTALAR.md).

Variáveis de ambiente exigidas na Netlify:

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
PAINEL_KEY
```

Para guardar as fotos no Cloudinary (25 GB grátis) em vez do Supabase Storage
(1 GB), acrescente estas três — o site troca sozinho:

```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

Existe ainda o Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `R2_BUCKET`), mas o cadastro dele pede cartão.

Para conferir se está tudo ligado, abra `/api/diagnostico` no navegador.

## Rodar local

```bash
node dev-local.js
```

Sobe em `http://localhost:8888` com um Supabase de mentira. Não precisa de
internet, conta nem chave. As fotos do teste ficam na pasta `.dev-fotos/`.

- Galeria: `http://localhost:8888/`
- Painel: `http://localhost:8888/painel/chave-de-teste`

## Onde guardar muita foto de graça

| Serviço | Grátis | Cabe (~900 KB/foto encolhida) | Pede cartão? |
|---|---|---|---|
| **Supabase Storage** | 1 GB + 5 GB de download/mês | ~1.100 fotos | **Não** |
| **Cloudinary** | 25 créditos/mês (~25 GB entre espaço e download) | ~20.000 fotos | **Não** |
| Cloudflare R2 | 10 GB, sem cobrança de download | ~11.000 fotos | Sim |
| Backblaze B2 | 10 GB | ~11.000 fotos | Sim |

**Recomendação (sem cartão nenhum): Cloudinary.** São 25 GB contra 1 GB do
Supabase, o cadastro não pede cartão e o adaptador já está pronto — é só
preencher as três variáveis. O banco continua no Supabase, que para texto é
folgadíssimo.

Uma diferença importante: no Supabase Storage o endereço da foto é assinado e
expira em 6 horas; no Cloudinary o endereço é **fixo e público**. Ninguém acha
sem o link (o nome do arquivo tem um trecho sorteado), mas um link repassado
continua abrindo para sempre. Para fotos de culto isso costuma ser aceitável —
se não for, fique no Supabase.

De brinde, o Cloudinary entrega a foto já convertida para o formato leve que o
celular aceita (`q_auto,f_auto`), o que corta uns 30% da internet gasta.

O banco em si (os nomes dos álbuns e das fotos) é minúsculo: cabem centenas de
milhares de linhas nos 500 MB grátis do Supabase. O que enche é o armazenamento
das imagens — por isso a opção de encolher as fotos no envio.
