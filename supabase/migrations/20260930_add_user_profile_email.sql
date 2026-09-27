ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';

UPDATE public.users AS profile
SET email = auth_user.email
FROM auth.users AS auth_user
WHERE auth_user.id = profile.id
  AND auth_user.email IS NOT NULL
  AND (profile.email IS NULL OR profile.email = '');