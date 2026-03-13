-- Manual migration: Add resolution tracking fields to CodeReviewFinding
-- Apply with: sqlite3 <database-file> < prisma/migrations/manual_resolution_fields.sql

ALTER TABLE CodeReviewFinding ADD COLUMN resolution TEXT DEFAULT 'open';
ALTER TABLE CodeReviewFinding ADD COLUMN resolvedAt DATETIME;
