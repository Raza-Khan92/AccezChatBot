/** The assistant offers to take a visitor's details at most this many times in one conversation. */
export const MAX_OFFERS = 3

/**
 * What to do after answering a real question. The first offer is a soft invitation, only when the visitor shows interest.
 * If they carry on without filling the form, the form is offered again after each answer, up to the limit.
 * Once they have submitted their details, or the limit is reached, the assistant stops offering.
 */
export function leadStep(o: { offers: number; submitted: boolean; interested: boolean }): 'none' | 'invite' | 'form' {
  if (o.submitted || o.offers >= MAX_OFFERS) return 'none'
  if (o.offers === 0) return o.interested ? 'invite' : 'none'
  return 'form'
}

/**
 * After a visitor has submitted their details they can keep asking questions and get normal answers. The first two answers
 * after that carry a short note: the details were received, then that the team will get back to them. Nothing more after that.
 */
export function ackStep(acks: number): 'received' | 'soon' | 'none' {
  return acks === 0 ? 'received' : acks === 1 ? 'soon' : 'none'
}
