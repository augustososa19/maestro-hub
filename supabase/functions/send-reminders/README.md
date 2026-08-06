# Envio de lembretes

Esta função deve ser publicada no Supabase e chamada por um agendador a cada minuto.

Variáveis obrigatórias no ambiente da Edge Function:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`, por exemplo `mailto:contato@dominio.com`
- `CRON_SECRET`, uma string aleatória usada no header `x-cron-secret`

O frontend também precisa receber a mesma chave pública em `VITE_VAPID_PUBLIC_KEY`.

Exemplo de publicação:

```sh
supabase functions deploy send-reminders
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=... CRON_SECRET=...
```

O agendador deve fazer `POST` para a URL da função com:

```text
x-cron-secret: <CRON_SECRET>
```

A função valida o segredo diretamente e está configurada com `verify_jwt = false` para que o
agendador não precise armazenar a service role. Nunca adicione a chave VAPID privada,
`CRON_SECRET` ou service role ao repositório ou a variáveis `VITE_*`.
