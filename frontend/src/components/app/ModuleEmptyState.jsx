export default function ModuleEmptyState({ eyebrow = 'Workspace module', title, description, items = [] }) {
  return (
    <section className="module-empty" aria-labelledby="module-empty-title">
      <div className="module-empty__topline"><span className="module-empty__indicator" />Workflow not connected</div>
      <p className="module-empty__eyebrow">{eyebrow}</p>
      <h2 id="module-empty-title">{title}</h2>
      <p className="module-empty__description">{description}</p>
      {items.length ? <div className="module-empty__scope"><p>Planned workspace</p><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      <p className="module-empty__foot">No sample records are shown. This screen will reflect saved business data once its API workflow is available.</p>
    </section>
  );
}
