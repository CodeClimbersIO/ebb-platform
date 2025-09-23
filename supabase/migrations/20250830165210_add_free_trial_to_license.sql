-- Add 'free_trial' to the license_type enum
ALTER TYPE public.license_type ADD VALUE 'free_trial';

-- Make expiration_date nullable since subscription status is managed by Stripe
ALTER TABLE public.license ALTER COLUMN expiration_date DROP NOT NULL;


  --  -- Rollback: Remove 'free_trial' from license_type enum
  -- -- Step 1: Drop the default constraint temporarily
  -- ALTER TABLE public.license ALTER COLUMN license_type DROP
  -- DEFAULT;

  -- -- Step 2: Create new enum without 'free_trial'  
  -- CREATE TYPE public.license_type_new AS ENUM ('perpetual',
  -- 'subscription');

  -- -- Step 3: Update the column to use new enum type
  -- ALTER TABLE public.license ALTER COLUMN license_type TYPE
  -- license_type_new USING
  -- license_type::text::license_type_new;

  -- -- Step 4: Drop old enum and rename new one
  -- DROP TYPE public.license_type;
  -- ALTER TYPE public.license_type_new RENAME TO license_type;

  -- -- Step 5: Restore the default constraint
  -- ALTER TABLE public.license ALTER COLUMN license_type SET
  -- DEFAULT 'perpetual';