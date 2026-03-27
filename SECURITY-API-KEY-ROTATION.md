# URGENT: Rotate Exposed API Keys

**Exposed keys were committed to git history.** You must rotate them.

## 1. Firebase API Key (Web/Android)

1. Go to [Firebase Console](https://console.firebase.google.com) → Project Settings → Your apps
2. For the Web app: remove or regenerate the API key (Firebase doesn't let you rotate keys directly; restrict it in Google Cloud Console)
3. In [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials:
   - Find the exposed API key
   - Restrict it: Application restrictions (HTTP referrers for web, package name for Android), API restrictions (only Firebase APIs)
   - Or create a new key and restrict it, then remove the old one
4. Update **`mobile/.env`** (or Expo env / optional per-tenant `config.env`) with the new key
5. Update dashboard `.env.local` with the new key
6. Update Railway env vars if the API uses it

## 2. Tenant API Key

The `tab_dev_*` key was exposed. Generate a new one:

1. Super Admin dashboard → Tenants → Take A Break → edit or regenerate API key
2. Or run `railway run knex seed:run` (if seed generates new key) and update config.env
3. Update `mobile/.env` (and dashboard `.env.local`)

## 3. Git History (Optional but Recommended)

The keys are still in git history. To remove them:

- Use [BFG Repo-Cleaner](https://rsc.io/bfg) or `git filter-repo` to purge the keys from history
- Or create a new repo and force-push (breaks existing clones)

For many projects, rotating the keys is sufficient. Choose based on your security requirements.
