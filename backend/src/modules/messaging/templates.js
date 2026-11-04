/**
 * Customer-facing wording for complaint emails. Only the ticket reference,
 * title and (when resolved) the resolution text are used. Internal notes and
 * assignee names are never passed in, so they can never leak.
 */
export const EMAIL_TEMPLATES = {
  logged: {
    subject: (c) => `We received your request (${c.reference})`,
    lines: (c) => [`We have logged your request “${c.title}” under reference ${c.reference}.`, 'Our team will look into it and keep you updated.'],
  },
  assigned: {
    subject: (c) => `Your request ${c.reference} has been assigned`,
    lines: (c) => [`Your request “${c.title}” (${c.reference}) has been assigned to a team member.`],
  },
  in_progress: {
    subject: (c) => `Work has started on ${c.reference}`,
    lines: (c) => [`We are now working on your request “${c.title}” (${c.reference}).`],
  },
  waiting_customer: {
    subject: (c) => `We need a reply from you about ${c.reference}`,
    lines: (c) => [`We need some information from you to continue with “${c.title}” (${c.reference}).`, 'Please reply to this email or call us.'],
  },
  resolved: {
    subject: (c) => `Your request ${c.reference} is resolved`,
    lines: (c) => [
      `Your request “${c.title}” (${c.reference}) has been resolved.`,
      ...(c.resolution ? [`What was done: ${c.resolution}`] : []),
      'If the problem comes back, reply to this email and we will reopen it.',
    ],
  },
};

/** Which complaint statuses send a customer email. Open (other than the first log) and closed do not. */
export const TEMPLATE_FOR_STATUS = {
  assigned: 'assigned',
  in_progress: 'in_progress',
  waiting_customer: 'waiting_customer',
  resolved: 'resolved',
};

export function renderComplaintEmail(template, { customerName, reference, title, resolution }, businessName) {
  const def = EMAIL_TEMPLATES[template];
  if (!def) throw new Error(`Unknown email template: ${template}`);
  const c = { reference, title, resolution };
  const body = [`Dear ${customerName || 'customer'},`, '', ...def.lines(c), '', `Regards,`, businessName].join('\n');
  return { subject: def.subject(c), body };
}
