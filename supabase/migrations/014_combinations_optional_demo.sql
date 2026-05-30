-- Optional demo on combinations.
--
-- "Demo-less" niches (personal_brand, viral; see src/lib/carousel/niches.ts)
-- have no product/app screenshot to pair with a hook, so a combination can be
-- hook-only and gets a single AI caption. Relax the NOT NULL constraint on
-- combinations.demo_id; the foreign key + on-delete-cascade stay intact for the
-- rows that do reference a demo.

alter table public.combinations
  alter column demo_id drop not null;
