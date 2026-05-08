-- Migration: add selected_plan to barbershops
BEGIN;

ALTER TABLE "barbershops" ADD COLUMN "selected_plan" text NOT NULL;

COMMIT;
