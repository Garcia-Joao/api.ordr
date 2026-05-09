-- CreateTable
CREATE TABLE "StaffEvaluationCriterion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEvaluation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventDateId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "functionName" TEXT NOT NULL,
    "generalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEvaluationScore" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffEvaluationScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffEvaluationCriterion_companyId_idx" ON "StaffEvaluationCriterion"("companyId");

-- CreateIndex
CREATE INDEX "StaffEvaluationCriterion_active_idx" ON "StaffEvaluationCriterion"("active");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEvaluationCriterion_companyId_name_key" ON "StaffEvaluationCriterion"("companyId", "name");

-- CreateIndex
CREATE INDEX "StaffEvaluation_companyId_idx" ON "StaffEvaluation"("companyId");

-- CreateIndex
CREATE INDEX "StaffEvaluation_eventDateId_idx" ON "StaffEvaluation"("eventDateId");

-- CreateIndex
CREATE INDEX "StaffEvaluation_personId_idx" ON "StaffEvaluation"("personId");

-- CreateIndex
CREATE INDEX "StaffEvaluation_functionName_idx" ON "StaffEvaluation"("functionName");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEvaluation_eventDateId_personId_functionName_key" ON "StaffEvaluation"("eventDateId", "personId", "functionName");

-- CreateIndex
CREATE INDEX "StaffEvaluationScore_evaluationId_idx" ON "StaffEvaluationScore"("evaluationId");

-- CreateIndex
CREATE INDEX "StaffEvaluationScore_criterionId_idx" ON "StaffEvaluationScore"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffEvaluationScore_evaluationId_criterionId_key" ON "StaffEvaluationScore"("evaluationId", "criterionId");

-- AddForeignKey
ALTER TABLE "StaffEvaluationCriterion" ADD CONSTRAINT "StaffEvaluationCriterion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEvaluation" ADD CONSTRAINT "StaffEvaluation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEvaluation" ADD CONSTRAINT "StaffEvaluation_eventDateId_fkey" FOREIGN KEY ("eventDateId") REFERENCES "EventDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEvaluation" ADD CONSTRAINT "StaffEvaluation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEvaluationScore" ADD CONSTRAINT "StaffEvaluationScore_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StaffEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEvaluationScore" ADD CONSTRAINT "StaffEvaluationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "StaffEvaluationCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
