import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

type MenuItemInput = {
  id?: string
  productId: string
  price: number
  active?: boolean
  sortOrder?: number
}

type MenuInput = {
  name: string
  description?: string | null
  active?: boolean
  items?: MenuItemInput[]
}

function normalizeMenu(menu: any) {
  return {
    ...menu,
    items: (menu.items ?? []).map((item: any) => ({
      ...item,
      price: Number(item.price),
      product: item.product
        ? {
            ...item.product,
            price: Number(item.product.price),
          }
        : null,
    })),
  }
}

const menuInclude = {
  items: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  },
}

async function ensureProductsBelongToCompany(companyId: string, items: MenuItemInput[] = []) {
  const productIds = Array.from(new Set(items.map((item) => item.productId).filter(Boolean)))
  if (productIds.length === 0) return

  const count = await prisma.product.count({
    where: {
      companyId,
      id: { in: productIds },
      deletedAt: null,
    },
  })

  if (count !== productIds.length) throw new Error('MENU_PRODUCT_NOT_FOUND')
}

export async function listMenus(companyId: string) {
  const menus = await prisma.menu.findMany({
    where: { companyId },
    include: menuInclude,
    orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }],
  })

  return menus.map(normalizeMenu)
}

export async function getActiveMenu(companyId: string) {
  const menu = await prisma.menu.findFirst({
    where: { companyId, active: true },
    include: menuInclude,
  })

  return menu ? normalizeMenu(menu) : null
}

export async function getMenu(companyId: string, menuId: string) {
  const menu = await prisma.menu.findFirst({
    where: { id: menuId, companyId },
    include: menuInclude,
  })

  if (!menu) throw new Error('MENU_NOT_FOUND')
  return normalizeMenu(menu)
}

export async function createMenu(companyId: string, input: MenuInput) {
  if (!input.name?.trim()) throw new Error('MENU_NAME_REQUIRED')
  await ensureProductsBelongToCompany(companyId, input.items)

  const menu = await prisma.$transaction(async (tx) => {
    if (input.active) {
      await tx.menu.updateMany({ where: { companyId, active: true }, data: { active: false } })
    }

    return tx.menu.create({
      data: {
        companyId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        active: Boolean(input.active),
        items: {
          create: (input.items ?? []).map((item, index) => ({
            productId: item.productId,
            price: new Prisma.Decimal(item.price ?? 0),
            active: item.active ?? true,
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: menuInclude,
    })
  })

  return normalizeMenu(menu)
}

export async function updateMenu(companyId: string, menuId: string, input: Partial<MenuInput>) {
  const existing = await prisma.menu.findFirst({ where: { id: menuId, companyId } })
  if (!existing) throw new Error('MENU_NOT_FOUND')
  await ensureProductsBelongToCompany(companyId, input.items)

  const menu = await prisma.$transaction(async (tx) => {
    if (input.active) {
      await tx.menu.updateMany({ where: { companyId, active: true, id: { not: menuId } }, data: { active: false } })
    }

    if (input.items) {
      await tx.menuItem.deleteMany({ where: { menuId } })
    }

    return tx.menu.update({
      where: { id: menuId },
      data: {
        ...(typeof input.name === 'string' ? { name: input.name.trim() } : {}),
        ...(Object.prototype.hasOwnProperty.call(input, 'description')
          ? { description: input.description?.trim() || null }
          : {}),
        ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
        ...(input.items
          ? {
              items: {
                create: input.items.map((item, index) => ({
                  productId: item.productId,
                  price: new Prisma.Decimal(item.price ?? 0),
                  active: item.active ?? true,
                  sortOrder: item.sortOrder ?? index,
                })),
              },
            }
          : {}),
      },
      include: menuInclude,
    })
  })

  return normalizeMenu(menu)
}

export async function activateMenu(companyId: string, menuId: string) {
  const existing = await prisma.menu.findFirst({ where: { id: menuId, companyId } })
  if (!existing) throw new Error('MENU_NOT_FOUND')

  const menu = await prisma.$transaction(async (tx) => {
    await tx.menu.updateMany({ where: { companyId, active: true }, data: { active: false } })
    return tx.menu.update({ where: { id: menuId }, data: { active: true }, include: menuInclude })
  })

  return normalizeMenu(menu)
}

export async function deleteMenu(companyId: string, menuId: string) {
  const existing = await prisma.menu.findFirst({ where: { id: menuId, companyId } })
  if (!existing) throw new Error('MENU_NOT_FOUND')
  if (existing.active) throw new Error('ACTIVE_MENU_CANNOT_BE_DELETED')

  await prisma.menu.delete({ where: { id: menuId } })
  return { ok: true }
}
