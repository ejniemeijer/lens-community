# Migrations

**Fresh install?** Ignore this folder — run `../schema.sql`, which already
contains everything.

**Upgrading an existing install?** Apply the files here that are dated **after
the release you installed**, in filename order, before deploying the new build.
Each one is idempotent, so re-running a file you already applied is harmless.

Migrations predating the first public release (2026-09-15) are not included:
they upgrade databases that only ever existed before this project was published,
and `schema.sql` already reflects them.
