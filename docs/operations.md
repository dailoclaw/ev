# Operations runbook

## Secure rollout

1. Download and verify an EV Command JSON backup. For the current linked project, also keep a Supabase database backup or the protected REST baseline created during the audit.
2. Create/invite the permanent owner in Supabase Auth. Disable public signup in the hosted Auth settings.
3. Apply migrations with `npx supabase db push` and verify exactly one row exists in `public.app_settings` with the intended `owner_id`.
4. In a private browser window, confirm an unsigned user cannot read `providers`, `charging_sessions`, or `app_settings` through the REST API.
5. Deploy the frontend from the same revision. Sign in with the owner magic link, set the owner password in Settings, and confirm password sign-in before clearing the original browser session. Then confirm session count and lifetime totals against the pre-migration backup.
6. Add, edit, and delete a disposable test charge; verify each change reaches Supabase and disappears after cleanup.
7. Upload a disposable vehicle photo and verify the `vehicle-photos` bucket is private and the object path begins with the owner UUID.
8. Test offline: disconnect, add a disposable charge, reconnect, wait for the sync badge to become Live, and verify one remote row exists.

Do not apply the owner-only RLS migration hours before deploying the authenticated frontend: the old anonymous build will lose access by design.

## Owner binding and transfer

The migration selects the oldest Auth user when it can. If the owner row is absent, insert it with the SQL shown in the README. Owner transfer is an intentional administrative operation: create the replacement Auth user, update `app_settings.owner_id` in the SQL editor, move the photo object to the replacement UUID path, update `vehicle_photo_path`, verify login, then remove the old Auth user. There is no in-app owner-transfer control.

## Owner password

The signed-in owner can set or change the password in Settings. Use a password manager and at least 12 characters. Clearing browser website data removes the local session but not the Supabase password, so the owner can sign in again without email. Keep recovery magic-link login enabled; public signup remains disabled and recovery links must use an allow-listed redirect URL. Passwords and session tokens are held by Supabase Auth and are never included in EV Command JSON backups.

## Backup verification

A valid v2 backup contains:

- `version: 2` and `exportedAt`
- all providers and charging sessions
- budget, theme, visual style, density, and vehicle assumptions
- `vehiclePhotoDataUrl` when a photo exists

Restore previews counts before changing anything. Restore only merges new providers and non-duplicate sessions; it never deletes existing ledger rows. It also applies the backed-up settings and uploads the backed-up photo.

## Rollback

Frontend rollback is safe only to another authenticated/owner-aware revision once migration 005 is applied. Reopening anonymous policies is not a normal rollback because it makes the ledger public again. If the new client fails, keep RLS closed, restore the last known authenticated frontend, and use Supabase Studio/SQL for urgent data access.

Database rollback should use a Supabase point-in-time/database backup. Do not hand-delete migration history or run a blanket table wipe. Existing charge rows are not transformed by migrations 005–006, so most failures can be fixed forward.

## Monitoring and routine maintenance

- Treat a persistent `Sync needs attention` state as actionable; queued writes remain in IndexedDB until accepted.
- Run `npm audit --audit-level=high` and the full CI suite before dependency releases.
- Review Supabase Auth users periodically; a permanent single-owner deployment should have only the intended account unless a transfer is in progress.
- Download a JSON backup after material ledger or settings changes.
