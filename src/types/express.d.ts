import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string
      username: string
      name?: string | null
      phone?: string | null
      photoBase64?: string | null
      role: string
      systemRole?: 'ADMIN' | 'CUSTOM'
      customRoleId?: string | null
      customRoleName?: string | null
      permissions?: string[]
      companyId: string
      companies?: Array<{
        id: string
        name: string
        isTest: boolean
        role: string
        systemRole?: 'ADMIN' | 'CUSTOM'
        customRoleId?: string | null
        customRoleName?: string | null
        permissions?: string[]
      }>
    }
  }
}
