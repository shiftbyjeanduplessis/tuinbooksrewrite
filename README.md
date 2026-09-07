# TuinBooks UI-Restored Release R18

R18 is the **true office-UI recovery** release.

R17 built successfully on Render, but `/app/` was still the stripped TypeScript rewrite shell. R18 corrects that packaging error by making the established TuinBooks office product the production `/app/` again.

## Production authority
- `/app/` — established full TuinBooks office application and mobile pages.
- `/management/` — established Management product.
- `/rewrite/` — retained TypeScript rewrite, isolated from production UI authority until feature-by-feature parity is proven.

The build must never silently replace `/app/` with the stripped rewrite shell again.

## R18 parity protections retained on the established UI
- Street address is visible directly on Schedule cards.
- The visit ID remains visible while a card is being dragged.
- Visit detail has a literal **Service normally / Do not service** two-state control.
- Do not service can apply to this visit only or to the entire client.
- Service work is shown with distinct service icons/chips rather than generic tick tiles.
- Sunday is supported as a seventh routine service day in the active scheduler, importer, workbook path and owner/field mobile week.
- Client and visit Do not service warnings are visible to the mobile profile.
- Existing v60.8.17 cancellation/billing/audit-isolation logic is retained in the recovered office runtime.

## Deploy
1. Replace the contents of the `tuinbooksrewrite` repository with this release (or copy these files over the R17 repository and commit all changes).
2. Commit and push to `main`.
3. Render should run the existing build command.
4. The build proof line must be:

`TUINBOOKS UI-RESTORED RELEASE R18: full established office UI published to /app/; rewrite isolated at /rewrite/.`

5. After Render reports live, hard refresh the browser once (`Ctrl+Shift+R`).
6. Open `/app/` and confirm the normal TuinBooks header/navigation is back before doing deeper QA.

## Database
No new database migration is required merely to restore the R18 office UI. The R17 audit-reader SQL remains in the repository for the isolated rewrite work, but it is not a prerequisite for the recovered `/app/` UI.
