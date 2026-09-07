# Como colocar o site das fotos no ar

Passo a passo, do zero, sem pressa. Tudo de graça. Reserve uns 30 minutos.

Você vai precisar de duas contas gratuitas:

- **Supabase** — guarda a lista de álbuns e as fotos.
- **Netlify** — publica o site na internet.

---

## 1. Criar o banco no Supabase

1. Entre em <https://supabase.com> e clique em **Start your project**. Pode
   entrar com a conta do Google.
2. Clique em **New project**:
   - **Name:** `fotos-vinho-novo`
   - **Database Password:** clique em *Generate* e **guarde essa senha** num
     lugar seguro (você provavelmente não vai precisar dela, mas não dá para ver
     de novo depois).
   - **Region:** `South America (São Paulo)`
3. Espere uns dois minutos, até o projeto ficar pronto.
4. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
5. Abra o arquivo `supabase.sql` desta pasta, copie **tudo** e cole ali.
6. Clique em **Run**. Deve aparecer *Success*. Isso cria as duas tabelas
   (`albuns` e `fotos`) e o balde `fotos`, onde as imagens ficam guardadas.
7. Confira: menu **Storage** — o balde **fotos** tem de estar na lista, como
   *Private*. Se não estiver, clique em **New bucket**, nome `fotos`, deixe
   *Public bucket* **desligado** e salve.

## 2. Pegar as duas chaves do Supabase

Menu da esquerda: **Project Settings** (a engrenagem) → **API**.

Anote em um bloco de notas:

- **Project URL** — algo como `https://abcdefgh.supabase.co`
- **service_role** (em *Project API keys*, clique em *Reveal*) — uma chave bem
  comprida.

> A chave **service_role** é a chave do cofre. Ela só vai para dentro da
> Netlify, nunca para o WhatsApp, nunca para o site, nunca para ninguém.

## 3. Inventar a chave do painel

Pense em uma palavra secreta comprida, sem espaço nem acento. Por exemplo:

```
fotos-vinho-novo-2026-luz
```

É ela que vai no endereço do painel: quem tiver esse link publica fotos, quem
não tiver não entra. Escolha algo que ninguém adivinhe.

## 3.5. Pegar as chaves do Cloudinary (para as fotos)

O Supabase guarda o banco; as **fotos** vão para o Cloudinary, que dá 25 GB
grátis e não pede cartão.

1. Entre em <https://console.cloudinary.com> (se a tela inicial der erro, vá
   direto em <https://console.cloudinary.com/settings/api-keys>).
2. Anote três coisas: **Cloud name** (o seu é `nhusipwg`), **API Key** e
   **API Secret** (clique no olho para revelar).

Não precisa criar pasta nem nada lá dentro: o site cria sozinho, em
`albuns/nome-do-album/`.

> Se preferir não usar o Cloudinary, é só não cadastrar essas três variáveis —
> o site usa o Supabase Storage (1 GB) automaticamente.

## 4. Publicar na Netlify

1. Entre em <https://netlify.com> e crie a conta (pode ser com o Google).
2. Na tela inicial, clique em **Add new site** → **Deploy manually**.
3. Arraste **esta pasta inteira** (`fotos`) para dentro do quadro pontilhado.
   Espere subir.
4. Quando terminar, abra **Site configuration** → **Environment variables** →
   **Add a variable** e cadastre as três, uma por vez:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | o *Project URL* do passo 2 |
   | `SUPABASE_SERVICE_KEY` | a chave *service_role* do passo 2 |
   | `PAINEL_KEY` | a palavra secreta do passo 3 |
   | `CLOUDINARY_CLOUD_NAME` | `nhusipwg` |
   | `CLOUDINARY_API_KEY` | a *API Key* do passo 3.5 |
   | `CLOUDINARY_API_SECRET` | o *API Secret* do passo 3.5 |

5. Vá em **Deploys** → **Trigger deploy** → **Deploy site**. Isso republica o
   site já com as chaves.

> Se você preferir usar o GitHub em vez de arrastar a pasta, funciona igual:
> conecte o repositório e a Netlify lê o `netlify.toml` sozinha.

## 5. Conferir

Abra, no navegador:

```
https://SEU-SITE.netlify.app/api/diagnostico
```

Tem de aparecer `"tudo_certo": true`, e a linha `arquivos` deve dizer
**Cloudinary, nuvem nhusipwg** — é assim que você confirma que as fotos vão
para o lugar certo. Se aparecer alguma linha com **FALTANDO**
ou **FALHOU**, o próprio texto diz o que corrigir (quase sempre é uma variável
escrita errada ou o `supabase.sql` que não foi rodado).

## 6. Usar

- **Painel (só a liderança):**
  `https://SEU-SITE.netlify.app/painel/SUA-CHAVE-SECRETA`

  Crie um álbum, escolha as fotos e espere a barra chegar ao fim. Se quiser
  preparar com calma, desmarque *"Já aparece para todo mundo"* — o álbum fica
  oculto até você publicar.

- **Para a igreja:** `https://SEU-SITE.netlify.app`

  É esse endereço que vai no grupo do WhatsApp. Dentro de cada álbum tem também
  um link direto, que o painel mostra na tela (*"Link para a igreja"*).

Guarde o link do painel nos favoritos do celular de quem publica. E não mande
esse link em grupo nenhum.

---

## Dicas para o dia a dia

- **Fotos do iPhone (.HEIC):** o navegador não abre esse formato. Em
  *Ajustes → Câmera → Formatos*, escolha **Mais compatível** — as fotos passam a
  sair em JPEG. As HEIC até sobem, mas ficam sem miniatura na grade.
- **Deixe a opção de diminuir ligada.** 2560 px é maior que a tela de qualquer
  celular ou TV e continua ótimo para imprimir 15x21. Uma foto de 3 MB vira uma
  de ~900 KB — cabem três vezes mais fotos no espaço grátis, e a igreja gasta um
  terço da internet para baixar.
- **Mande as fotos pelo computador quando forem muitas.** Arrastar 200 fotos de
  uma vez funciona, mas no celular a bateria e a internet sofrem.
- **Apagou, foi.** Não existe lixeira: apagar foto ou álbum é definitivo.

## Quando o espaço grátis acabar

Com o Cloudinary são 25 créditos por mês: 1 crédito = 1 GB guardado ou 1 GB
baixado pelas pessoas. Um evento de 200 fotos encolhidas ocupa ~180 MB, então o
espaço não é o problema — o que consome é o download. Acompanhe em
**Console → Home**, no medidor de créditos.

Se apertar, duas saídas, as duas sem cartão:

1. **Limpar.** Apague no painel os álbuns antigos que ninguém baixa mais. Avise
   a igreja antes, dando um prazo para quem ainda não pegou as fotos.
2. **Encolher mais.** Dá para baixar o limite de 2560 px para 1920 px (a foto
   cai de ~900 KB para ~500 KB e continua ótima em qualquer celular ou TV). É
   uma linha no `site/painel.html` — pode me pedir.

O código também aceita o **Cloudflare R2** (10 GB, sem cobrança de download),
mas o cadastro dele exige cartão de crédito. Sem as variáveis `R2_*`, ele nem
entra na jogada.
