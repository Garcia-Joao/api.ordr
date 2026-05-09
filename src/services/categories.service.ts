import { prisma } from '../lib/prisma'
import { createAuditLog } from './audit.service'

type CreateCategoryInput = {
  companyId: string
  name: string
  emoji?: string | null
}

type UpdateCategoryInput = {
  name?: string
  emoji?: string | null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function normalizeCategory(category: any) {
  return {
    id: category.id,
    name: category.name,
    emoji: category.emoji ?? '📦',
    slug: category.slug ?? null,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }
}

export async function getCategoriesByCompany(companyId: string) {
  const categories = await prisma.category.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    orderBy: { name: 'asc' },
  })

  return categories.map(normalizeCategory)
}

export async function getCategoryById(categoryId: string, companyId: string) {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      companyId,
      deletedAt: null,
    },
  })

  if (!category) {
    return null
  }

  return normalizeCategory(category)
}

export async function createCategory(data: CreateCategoryInput, userId: string) {
  if (!data.name?.trim()) {
    throw new Error('CATEGORY_NAME_REQUIRED')
  }

  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.category.create({
      data: {
        companyId: data.companyId,
        name: data.name.trim(),
        slug: slugify(data.name),
        createdByUserId: userId,
        updatedByUserId: userId,
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
      },
    })

    await createAuditLog(tx, {
      companyId: data.companyId,
      userId,
      entityType: 'Category',
      entityId: created.id,
      action: 'CATEGORY_CREATED',
      newValues: {
        name: created.name,
        slug: created.slug,
        emoji: created.emoji,
      },
    })

    return created
  })

  return normalizeCategory(category)
}

export async function updateCategory(
  categoryId: string,
  companyId: string,
  data: UpdateCategoryInput,
  userId: string
) {
  const existingCategory = await prisma.category.findFirst({
    where: {
      id: categoryId,
      companyId,
      deletedAt: null,
    },
  })

  if (!existingCategory) {
    throw new Error('CATEGORY_NOT_FOUND')
  }

  if (data.name !== undefined && !data.name.trim()) {
    throw new Error('CATEGORY_NAME_REQUIRED')
  }

  const category = await prisma.$transaction(async (tx) => {
    const updated = await tx.category.update({
      where: { id: categoryId },
      data: {
        name: data.name === undefined ? existingCategory.name : data.name.trim(),
        slug: data.name === undefined ? existingCategory.slug : slugify(data.name),
        updatedByUserId: userId,
        ...(data.emoji !== undefined ? { emoji: data.emoji } : {}),
      },
    })

    await createAuditLog(tx, {
      companyId,
      userId,
      entityType: 'Category',
      entityId: updated.id,
      action: 'CATEGORY_UPDATED',
      oldValues: {
        name: existingCategory.name,
        slug: existingCategory.slug,
        emoji: existingCategory.emoji,
      },
      newValues: {
        name: updated.name,
        slug: updated.slug,
        emoji: updated.emoji,
      },
    })

    return updated
  })

  return normalizeCategory(category)
}

export async function deleteCategory(
  categoryId: string,
  companyId: string,
  userId: string
) {
  const existingCategory = await prisma.category.findFirst({
    where: {
      id: categoryId,
      companyId,
      deletedAt: null,
    },
  })

  if (!existingCategory) {
    throw new Error('CATEGORY_NOT_FOUND')
  }

  const linkedProducts = await prisma.product.count({
    where: {
      categoryId,
      companyId,
      active: true,
      deletedAt: null,
    },
  })

  if (linkedProducts > 0) {
    throw new Error('CATEGORY_HAS_PRODUCTS')
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.update({
      where: { id: categoryId },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
        updatedByUserId: userId,
      },
    })

    await createAuditLog(tx, {
      companyId,
      userId,
      entityType: 'Category',
      entityId: categoryId,
      action: 'CATEGORY_DELETED',
      oldValues: {
        name: existingCategory.name,
        slug: existingCategory.slug,
        emoji: existingCategory.emoji,
      },
    })
  })

  return { ok: true }
}