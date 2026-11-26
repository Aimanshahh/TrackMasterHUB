/** Progress toward the monthly installation target the admin set. Counts only, never money. */
export default function MonthlyTarget({ target }) {
  if (!target || !target.monthly) return null;
  const percent = Math.min(100, Math.round((target.done / target.monthly) * 100));
  return (
    <section className="sp-target" data-met={target.met} aria-label="Monthly target">
      <div className="sp-target__top">
        <strong>Monthly target</strong>
        <span>{target.done} of {target.monthly} installations</span>
      </div>
      <div className="sp-target__bar" role="progressbar" aria-valuemin={0} aria-valuemax={target.monthly} aria-valuenow={Math.min(target.done, target.monthly)}>
        <i style={{ width: `${percent}%` }} />
      </div>
      <p>
        {target.met
          ? `Target reached${target.done > target.monthly ? ` — ${target.done - target.monthly} above it` : ''}. Well done.`
          : `${target.remaining} more to reach this month’s target.`}
      </p>
    </section>
  );
}
