# Post-Account Role Onboarding

## Goal

Create the first post-account onboarding slice for MassageLab. Onboarding should happen after account creation/sign-in, remain optional, and collect only safe account-level preferences that can later shape account/home shortcuts.

## Boundaries

- Do not ask anonymous homepage visitors to complete onboarding.
- Do not store PHI, client details, clinical note content, or treatment information.
- Do not grant verified roles from onboarding answers.
- Do not add a database migration for the first slice; use existing `UserPreference.appSettings`.
- Keep therapist/student credential verification in the existing account credential workflow.

## First Slice

- Add a signed-in `/onboarding` route.
- Store `appSettings.onboarding` with primary role, use cases, optional therapist jurisdiction, short notes, and a recommended next path.
- Route default registration and verified-email sign-in toward `/onboarding`.
- Add an account shortcut so users can revisit onboarding.
- Cover the pure preference builder with focused tests and keep browser coverage focused on public/sign-in-safe surfaces.

## Future Follow-Up

- Use saved onboarding preferences to tailor the signed-in account/home surface.
- Add reorderable shortcuts only after the shortcut model is explicit.
- For therapists, prefill credential-verification forms from safe onboarding/profile data only after the verification workflow is reviewed.
