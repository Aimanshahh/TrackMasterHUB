import { formatDayTime } from '../../app/operations.js';
import { CHECKLIST_ITEMS, engineKillLabel } from '../../app/installation.js';

/** The checklist as it stood, shown as ticks so a past visit can be read at a glance. */
export function ChecklistChips({ checklist }) {
  return (
    <ul className="inst-chips" aria-label="Installation checklist">
      {CHECKLIST_ITEMS.map((item) => (
        <li key={item.key} className={checklist?.[item.key] ? 'is-yes' : 'is-no'}>
          <span aria-hidden="true">{checklist?.[item.key] ? '✓' : '–'}</span>
          {item.label}
          <span className="sr-only">{checklist?.[item.key] ? ' done' : ' not done'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Installation history: status moves, detail edits, checklist saves and engine-kill changes, newest first. */
export default function InstallationHistory({ history = [] }) {
  if (!history.length) return null;
  return (
    <ol className="inst-history">
      {[...history].reverse().map((entry, index) => (
        <li key={`${entry.at}-${index}`} className={`inst-history__item inst-history__item--${entry.kind ?? 'status'}`}>
          <span className="inst-history__mark" aria-hidden="true" />
          <div>
            <p className="inst-history__title">
              {entry.kind === 'checklist' ? 'Checklist' : entry.kind === 'engine_kill' ? 'Engine kill' : entry.kind === 'details' ? 'Details' : entry.statusLabel || entry.status}
            </p>
            {entry.kind === 'engine_kill' && entry.data ? (
              <p>{engineKillLabel(entry.data.from)} → <strong>{engineKillLabel(entry.data.to)}</strong>{entry.data.reason ? ` — ${entry.data.reason}` : ''}</p>
            ) : entry.note ? <p>{entry.note}</p> : null}
            {entry.kind === 'checklist' && entry.data?.checklist ? <ChecklistChips checklist={entry.data.checklist} /> : null}
          </div>
          <time dateTime={entry.at}>{formatDayTime(entry.at)}{entry.by ? <small>{entry.by}</small> : null}</time>
        </li>
      ))}
    </ol>
  );
}
