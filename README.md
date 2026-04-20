# 3181 FRC Scouting

Mobile-first scouting app for FRC Team 3181. Scouts create username/password accounts, submit match data from phones, and admin-marked accounts can change the questions that appear in the scouting form.

## What is included

- Pink and black 3181 UI built for phones first
- Supabase Auth with username/password UI
- Multi-page app: login, scout, admin, and data pages
- Admin pages hidden unless `profiles.is_admin` is true
- Dynamic questions stored in Supabase Postgres
- Question editor for counter, number, select, toggle, and text questions
- Recent submission viewer and CSV export
- Local draft saving so accidental refreshes do not wipe a scout's form
- Row Level Security policies for signed-in submissions and admin-only data access

## Supabase setup

1. Create a Supabase project.
2. In Authentication, keep Email provider enabled.
3. For easiest username-only scouting, turn off email confirmation in Auth settings.
4. Open the SQL Editor and run `supabase/schema.sql`.
5. Copy your project URL and anon public key into `src/supabase.js`.
6. Start the app with `npm start`.

The app turns usernames into fake Supabase Auth emails using this format:

```text
username@3181scouting.app
```

## Marking an admin

After the user signs up once, open the Supabase Table Editor for `profiles` and set `is_admin` to `true` for that username.

You can also run SQL:

```sql
update public.profiles
set is_admin = true
where username = 'leadscout';
```

Only admin users can see the Admin and Data links. RLS also blocks non-admin accounts from editing questions or reading submissions.

## Tables

- `profiles`: scout profile and admin flag
- `questions`: admin-managed scouting questions
- `submissions`: scout form submissions

If there are no Supabase questions yet, the app shows starter questions locally so you can test the flow immediately.

## Local testing

Because the app uses JavaScript modules, serve it from a local web server:

```powershell
npm start
```

Then open the local URL on your computer or phone.
