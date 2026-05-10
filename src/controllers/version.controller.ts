import { Request, Response } from 'express'
import * as versionService from '../services/version.service'

export function versionCheck(_req: Request, res: Response) {
  return res.json(versionService.getVersionCheck())
}
