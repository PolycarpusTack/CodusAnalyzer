-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CodeReviewFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "columnStart" INTEGER,
    "columnEnd" INTEGER,
    "codeSnippet" TEXT,
    "suggestion" TEXT,
    "explanation" TEXT,
    "documentation" TEXT,
    "autoFixable" BOOLEAN NOT NULL DEFAULT false,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "resolution" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeReviewFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CodeReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CodeReviewFinding" ("autoFixable", "category", "codeSnippet", "columnEnd", "columnStart", "createdAt", "documentation", "explanation", "fixed", "id", "lineEnd", "lineStart", "message", "reviewId", "ruleId", "severity", "suggestion") SELECT "autoFixable", "category", "codeSnippet", "columnEnd", "columnStart", "createdAt", "documentation", "explanation", "fixed", "id", "lineEnd", "lineStart", "message", "reviewId", "ruleId", "severity", "suggestion" FROM "CodeReviewFinding";
DROP TABLE "CodeReviewFinding";
ALTER TABLE "new_CodeReviewFinding" RENAME TO "CodeReviewFinding";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
