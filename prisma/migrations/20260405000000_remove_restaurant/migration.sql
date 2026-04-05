-- Drop restaurant-related columns and tables added by multi-tenant migration

-- Remove restaurantId from Availability if it exists
ALTER TABLE "Availability" DROP COLUMN IF EXISTS "restaurantId";

-- Drop Restaurant table if it exists
DROP TABLE IF EXISTS "Restaurant" CASCADE;
