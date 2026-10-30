/**
 * Initials mark for a customer. Used instead of photographs because the CRM
 * stores no images; the tone follows priority so a high-value record is
 * recognisable at a glance in a list.
 */
export default function CustomerAvatar({ name = '', tone = 'normal', size = 'md' }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase() || '—';

  return (
    <span className={`sp-avatar sp-avatar--${size}`} data-tone={tone} aria-hidden="true">
      {initials}
    </span>
  );
}
