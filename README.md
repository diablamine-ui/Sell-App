# Dilam B' — dilamboutique.com

Site hébergé sur Cloudflare (Worker + fichiers statiques).

- `site/` : le site (pages, images dans `site/public/images/`)
- `src/worker.js` : le serveur (données, connexion admin, images, Meta CAPI)
- `schema.sql` : structure de la base D1
- `wrangler.jsonc` : configuration Cloudflare (aucun secret)

## Secrets (à saisir dans Cloudflare → Workers → dilamboutique → Settings → Variables and Secrets, type « Secret »)

| Nom | Contenu |
|---|---|
| `ADMIN_EMAIL` | email qui reçoit les codes de connexion admin |
| `RESEND_API_KEY` | clé API Resend (envoi des emails) |
| `META_CAPI_TOKEN` | jeton Meta Conversions API |

Ne jamais écrire une clé dans ce dépôt.
