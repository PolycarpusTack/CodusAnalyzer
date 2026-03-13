-- CreateTable
CREATE TABLE "CodeReview" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codeContent" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "fileName" TEXT,
    "summary" TEXT,
    "positiveAspects" TEXT,
    "qualityScore" REAL,
    "totalLines" INTEGER,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "criticalCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "infoCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CodeReviewFinding" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CodeReviewFinding_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "CodeReview" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
