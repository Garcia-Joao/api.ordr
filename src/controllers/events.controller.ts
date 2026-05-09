import type { Request, Response } from 'express'
import {
  cancelEventDate,
  createEventDate,
  createEventTemplate,
  deleteEventDate,
  deleteEventTemplate,
  getEventDate,
  getEventTemplate,
  listCurrentEventDates,
  listEventDates,
  listEventTemplates,
  listPeopleForEvents,
  updateEventDate,
  updateEventDatePersonStatus,
  updateEventTemplate,
} from '../services/events.service'

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

  return (
    user?.companyId ??
    user?.company?.id ??
    getSingleParam(headerCompanyId, 'COMPANY_ID')
  )
}

function handleError(res: Response, error: any) {
  const message = error?.message ?? 'INTERNAL_ERROR'

  const status =
    message.includes('NOT_FOUND')
      ? 404
      : message.includes('REQUIRED')
        ? 400
        : 500

  return res.status(status).json({
    error: message,
  })
}

export async function listEventPeopleController(req: Request, res: Response) {
  try {
    const people = await listPeopleForEvents()
    return res.json(people)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function listEventTemplatesController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const templates = await listEventTemplates(companyId)

    return res.json(templates)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function getEventTemplateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const templateId = getSingleParam(req.params.id, 'EVENT_TEMPLATE_ID')

    const template = await getEventTemplate(companyId, templateId)

    return res.json(template)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createEventTemplateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)

    const template = await createEventTemplate({
      companyId,
      ...req.body,
    })

    return res.status(201).json(template)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateEventTemplateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const templateId = getSingleParam(req.params.id, 'EVENT_TEMPLATE_ID')

    const template = await updateEventTemplate(companyId, templateId, req.body)

    return res.json(template)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deleteEventTemplateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const templateId = getSingleParam(req.params.id, 'EVENT_TEMPLATE_ID')

    const template = await deleteEventTemplate(companyId, templateId)

    return res.json(template)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function listEventDatesController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)

    const from =
      typeof req.query.from === 'string' ? req.query.from : undefined

    const to = typeof req.query.to === 'string' ? req.query.to : undefined

    const status =
      typeof req.query.status === 'string'
        ? (req.query.status as any)
        : undefined

    const dates = await listEventDates({
      companyId,
      from,
      to,
      status,
    })

    return res.json(dates)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function listCurrentEventDatesController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const dates = await listCurrentEventDates(companyId)

    return res.json(dates)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function getEventDateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID')

    const eventDate = await getEventDate(companyId, eventDateId)

    return res.json(eventDate)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function createEventDateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)

    const eventDate = await createEventDate({
      companyId,
      ...req.body,
    })

    return res.status(201).json(eventDate)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateEventDateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID')

    const eventDate = await updateEventDate(companyId, eventDateId, req.body)

    return res.json(eventDate)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function updateEventDatePersonStatusController(
  req: Request,
  res: Response
) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID')
    const personId = getSingleParam(req.params.personId, 'PERSON_ID')

    const result = await updateEventDatePersonStatus({
      companyId,
      eventDateId,
      personId,
      functionName: req.body.functionName ?? null,
      status: req.body.status,
      notes: req.body.notes ?? undefined,
      worksFullEvent: req.body.worksFullEvent,
      workHours: req.body.workHours,
      costOverride: req.body.costOverride,
      costNotes: req.body.costNotes ?? undefined,
    })

    return res.json(result)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function cancelEventDateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID')

    const eventDate = await cancelEventDate(companyId, eventDateId)

    return res.json(eventDate)
  } catch (error) {
    return handleError(res, error)
  }
}

export async function deleteEventDateController(req: Request, res: Response) {
  try {
    const companyId = getCompanyId(req)
    const eventDateId = getSingleParam(req.params.id, 'EVENT_DATE_ID')

    const eventDate = await deleteEventDate(companyId, eventDateId)

    return res.json(eventDate)
  } catch (error) {
    return handleError(res, error)
  }
}
