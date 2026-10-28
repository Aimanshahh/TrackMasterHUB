import { Link } from 'react-router-dom';

export default function Panel({ heading, action, children, className = '' }) {
  return (
    <section className={`panel${className ? ` panel--${className}` : ''}`}>
      {heading || action ? (
        <div className="panel__head">
          <div className="panel__heading">
            {heading ? <p className="panel__title">{heading}</p> : null}
            {heading ? <p className="panel__meta">Shared module table</p> : null}
          </div>
          {action ? <div className="panel__action">{action}</div> : null}
        </div>
      ) : null}

      <div className="panel__body panel__body--flush">{children}</div>
    </section>
  );
}
