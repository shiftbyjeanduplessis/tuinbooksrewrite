# Existing Supabase compatibility

Milestone 1 deliberately performs **no schema migration**.

Used existing tables:

- `business_members`
- `businesses`
- `teams`
- `customers`
- `service_sites`
- `schedule_jobs`

Existing `schedule_jobs` does not have a canonical service-location column in the v42 shape. The compatibility adapter reads the location from legacy payload keys (`serviceSiteId`, then `siteId`) and exposes only `Visit.serviceLocationId` to the application.

This is temporary compatibility at the repository edge, not a second in-app client/site model.

The existing backend already contains later relational structures including `service_agreements`, `service_agreement_lines`, and `service_commitments`; those can be adopted in later milestones without replacing the Supabase project.
