# Schema Changes for Finding Resolution Tracking

The following fields need to be added to the `CodeReviewFinding` model in `prisma/schema.prisma`:

```prisma
model CodeReviewFinding {
  // ... existing fields ...

  resolution    String   @default("open")
  resolvedAt    DateTime?
}
```

## Steps to apply

1. Add the two fields above to the `CodeReviewFinding` model in `prisma/schema.prisma`.
2. Run the raw SQL migration: `sqlite3 <database-file> < prisma/migrations/manual_resolution_fields.sql`
3. Regenerate the Prisma client: `npx prisma generate`

## Valid resolution values

- `open` (default)
- `fixed`
- `wont_fix`
- `false_positive`
