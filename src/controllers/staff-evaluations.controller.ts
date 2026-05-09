import type { Request, Response } from 'express'
import {
  createStaffEvaluationCriterion,
  getPeopleEvaluationRatings,
  getPersonEvaluationSummary,
  listEventStaffForReview,
  listStaffEvaluationCriteria,
  saveStaffEvaluation,
} from '../services/staff-evaluations.service'

function getSingleParam(value: string | string[] | undefined, fieldName: string) {
  const normalized = Array.isArray(value) ? value[0] : value

  if (!normalized || typeof normalized !== 'string') {
    throw new Error(`${fieldName}_REQUIRED`)
  }

  return normalized
}

function getCompanyId(req: Request) {
  const user = (req as any).user
  const headerCompanyId = req.headers['x-company-id']

  const companyId =
    user?.companyId ??
    user?.company?.id ??
    getSingleParam(headerCompanyId, 'COMPANY_ID')

  return companyId
}

function handleError(res: Response, error: any) {
  const message = error?.message ?? 'INTERNAL_ERROR'

  const status =
    message.includes('NOT_FOUND')
      ? 404
      : message.includes('REQUIRED') || message.includes('INVALID') || message.includes('FINISHED')
        ? 400
        : 500

  return res.status(status).json({ error: message })
}

export async function listStaffEvaluationCriteriaController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const criteria = await listStaffEvaluationCriteria(companyId)
    return res.json(criteria)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createStaffEvaluationCriterionController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const criterion = await createStaffEvaluationCriterion({
      companyId,
      name: req.body.name,
      description: req.body.description ?? null,
    })

    return res.status(201).json(criterion)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function listEventStaffForReviewController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.eventDateId, 'EVENT_DATE_ID')
    const staff = await listEventStaffForReview(companyId, eventDateId)
    return res.json(staff)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function saveStaffEvaluationController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.eventDateId, 'EVENT_DATE_ID')

    const evaluation = await saveStaffEvaluation({
      companyId,
      eventDateId,
      personId: req.body.personId,
      functionName: req.body.functionName,
      functionScore: req.body.functionScore,
      generalNotes: req.body.generalNotes ?? null,
      scores: req.body.scores ?? [],
    })

    return res.json(evaluation)
  } catch (error) {
    return handleError(res, error)
  }
}


export async function getPeopleEvaluationRatingsController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const ratings = await getPeopleEvaluationRatings(companyId)
    return res.json(ratings)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function getPersonEvaluationSummaryController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const personId = getSingleParam(req.params.personId, 'PERSON_ID')
    const summary = await getPersonEvaluationSummary(companyId, personId)
    return res.json(summary)
  } catch (error) {
    return handleError(res, error)
  }
}
