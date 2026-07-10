import {
  addCalendarDaysToDateInput,
  getBusinessDateInputValue,
  getBusinessMonthInputValue,
} from '../lib/business-date'

export function createIntegrationPeriodDefaults(now: Date = new Date()) {
  const date = getBusinessDateInputValue(now)
  return {
    month: getBusinessMonthInputValue(now),
    start: date,
    end: date,
  }
}

export function createCompetitionDraftDateDefaults(now: Date = new Date()) {
  const startsOn = getBusinessDateInputValue(now)
  return {
    dateCode: startsOn.replaceAll('-', '_'),
    startsOn,
    endsOn: addCalendarDaysToDateInput(startsOn, 14),
  }
}

export function getChecklistTemplateEffectiveDate(now: Date = new Date()) {
  return getBusinessDateInputValue(now)
}

export function createStoreApprovalsDateDefaults(now: Date = new Date()) {
  const date = getBusinessDateInputValue(now)
  return {
    month: getBusinessMonthInputValue(now),
    date,
  }
}
