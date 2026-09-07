TuinBooks v59.6.70 — Permanent PIN generation repair

ROOT CAUSE
v59.6.68 accidentally replaced the existing authoritative permanent-PIN
wrapper with:

  create_mobile_access_code(...)
  then
  tuinbooks_record_field_phone_pin_v59668(...)

The first call could create the real PIN successfully and the second call could
then fail with:

  The newly-created PIN could not be matched to its credential

This produced a false-looking PIN-generation failure and could leave an
unintended newly-created PIN behind.

FIX
The Access dashboard now reconnects to the already-deployed TuinBooks permanent
PIN system:

  tuinbooks_create_mobile_access_code_v59649
  tuinbooks_list_field_phones_v59649

That wrapper creates the real PIN AND records the clear four-digit value in the
authorised office PIN directory in one server-side operation.

There is NO second client-side credential matching step.

IMPORTANT
Do not use the PIN from a previous failed v59.6.69 attempt.
Create a fresh replacement PIN after deploying v59.6.70.

DEPLOY
NO SQL REQUIRED FOR THIS REPAIR.

In GitHub /app replace:
- index.html
- app.js
- service-worker.js
- VERSION.txt

Commit -> Render deploy -> hard refresh.

TEST
1. Business -> Access.
2. Add field phone.
3. Enter phone name and team.
4. Click Create permanent PIN.
5. A four-digit PIN must appear with no red credential-match error.
6. Click Done.
7. The new phone must appear in the Field phones panel as Waiting for phone,
   with the same visible PIN.
8. Pair the phone using that PIN.
9. Refresh Access. The phone should show Active and retain the visible PIN.

The v59.6.68 database objects can remain; v59.6.70 simply stops using that
duplicate path.
