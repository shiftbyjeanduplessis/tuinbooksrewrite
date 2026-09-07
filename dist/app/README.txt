TuinBooks v59.6.67 — Multiple Admin Users

ROOT CAUSE
The Supabase access RPC already supports multiple administrators. The frontend
was sending newer UI role names such as:
- office_admin
- scheduler
- estimator
- team_leader

But create_business_invite() and update_business_user() accept:
- admin
- field

So an "Office administrator" invite could be rejected even though the database
supports it.

THIS FIX
- "+ Add office administrator" is now the clear action.
- New invitations default to role = admin.
- Office administrator sends the backend-supported value "admin".
- Field user sends the backend-supported value "field".
- Unsupported role values are removed from this dialog.
- Existing admins can still be edited/disabled.
- Multiple active admins can coexist with the owner.
- Field phones/PINs remain a separate access mechanism.

HOW TO ADD AN ADMIN AFTER DEPLOY
1. Business -> Settings / Access.
2. Click "+ Add office administrator".
3. Enter name and email.
4. Click "Create admin invite".
5. Copy/share the generated access link.
6. The recipient signs in using the same email address used for the invitation.
7. After acceptance they appear in the active users list as Admin.

DEPLOY
Replace these FOUR files in GitHub /app:
- index.html
- app.js
- service-worker.js
- VERSION.txt

Commit, let Render deploy, then hard-refresh.

NO SQL IS REQUIRED.
The existing database already supports multiple admin memberships.
