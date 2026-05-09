-- DropIndex
DROP INDEX "Category_companyId_name_key";

-- DropIndex
DROP INDEX "Category_companyId_slug_key";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "emoji" TEXT;
