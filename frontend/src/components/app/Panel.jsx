export default function Panel({ heading, action, children, className = '' }) {
  return (
    <section className={`panel${className ? ` panel--${className}` : ''}`}>
      {heading || action ? (
        <div className="panel__head">
          {heading ? <h2 className="panel__title">{heading}</h2> : <span />}
          {action ? <div className="panel__action">{action}</div> : null}
        </div>
      ) : null}
      <div className="panel__body panel__body--flush">{children}</div>
    </section>
  );
}
