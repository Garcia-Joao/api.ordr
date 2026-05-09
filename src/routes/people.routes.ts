import { Router } from 'express'
import { requireAuth } from '../middleware/auth.middleware'
import { requirePermission } from '../middleware/require-permission.middleware'
import {
  createPerson,
  createPersonFunction,
  deletePerson,
  disablePerson,
  listPeople,
  listPersonFunctions,
  restorePerson,
  updatePerson,
} from '../services/people.service'

export const peopleRoutes = Router()

peopleRoutes.get('/', requireAuth, requirePermission('people.view'), async (_req, res) => {
  try {
    const people = await listPeople()
    res.json(people)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'PEOPLE_LIST_ERROR' })
  }
})

peopleRoutes.get('/functions', requireAuth, requirePermission('people.view'), async (_req, res) => {
  try {
    const functions = await listPersonFunctions()
    res.json(functions)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'PEOPLE_FUNCTIONS_LIST_ERROR' })
  }
})

peopleRoutes.post(
  '/functions',
  requireAuth,
  requirePermission('people.manage'),
  async (req, res) => {
    try {
      const functionItem = await createPersonFunction(req.body)
      res.status(201).json(functionItem)
    } catch (error: any) {
      console.error(error)
      res.status(400).json({
        error: error?.message || 'PERSON_FUNCTION_CREATE_ERROR',
      })
    }
  }
)

peopleRoutes.post('/', requireAuth, requirePermission('people.manage'), async (req, res) => {
  try {
    const person = await createPerson(req.body)
    res.status(201).json(person)
  } catch (error: any) {
    console.error(error)
    res.status(400).json({ error: error?.message || 'PERSON_CREATE_ERROR' })
  }
})

peopleRoutes.put('/:id', requireAuth, requirePermission('people.manage'), async (req, res) => {
  try {
    const person = await updatePerson(req.params.id, req.body)
    res.json(person)
  } catch (error: any) {
    console.error(error)
    res.status(400).json({ error: error?.message || 'PERSON_UPDATE_ERROR' })
  }
})

peopleRoutes.patch('/:id/disable', requireAuth, requirePermission('people.manage'), async (req, res) => {
  try {
    const result = await disablePerson(req.params.id)
    res.json(result)
  } catch (error: any) {
    console.error(error)
    res.status(400).json({ error: error?.message || 'PERSON_DISABLE_ERROR' })
  }
})

peopleRoutes.patch('/:id/restore', requireAuth, requirePermission('people.manage'), async (req, res) => {
  try {
    const result = await restorePerson(req.params.id)
    res.json(result)
  } catch (error: any) {
    console.error(error)
    res.status(400).json({ error: error?.message || 'PERSON_RESTORE_ERROR' })
  }
})

peopleRoutes.delete('/:id', requireAuth, requirePermission('people.manage'), async (req, res) => {
  try {
    const result = await deletePerson(req.params.id)
    res.json(result)
  } catch (error: any) {
    console.error(error)
    res.status(400).json({ error: error?.message || 'PERSON_DELETE_ERROR' })
  }
})
