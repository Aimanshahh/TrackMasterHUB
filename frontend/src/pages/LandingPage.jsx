import { Link } from 'react-router-dom';

import SystemHealthPanel from '../components/status/SystemHealthPanel.jsx';
import {
  capabilities,
  coverage,
  roles,
  standards,
  statusGroups,
  workflowSteps,
} from '../content/site.js';
import { useSystemHealth } from '../context/systemHealth.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

import '../styles/landing.css';

export default function LandingPage() {
  useDocumentTitle('CRM & Operations Platform');
  const health = useSystemHealth();

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__lede">
            <p className="eyebrow">
              <span className="eyebrow__mark" aria-hidden="true" />
              CRM &amp; field operations · TrackMaster
            </p>

            <h1 className="hero__title">
              Every customer, renewal and job in one{' '}
              <span className="hero__accent">clear</span> system.
            </h1>

            <p className="hero__body">
              TrackMaster Hub is the workspace behind the tracking business: customer records,
              quotations and approvals, renewals, field operations, OS tickets and billing. One
              backend, four focused interfaces, no duplicate records.
            </p>

            <div className="hero__actions">
              <Link className="btn btn--primary" to="/#platform">
                Explore the platform
                <span className="btn__arrow" aria-hidden="true">
                  →
                </span>
              </Link>
              <Link className="btn btn--link" to="/#roles">
                See the four interfaces
              </Link>
            </div>

            <p className="hero__caption">
              Customer ownership, pricing policy and audit history are part of the foundation —
              not an afterthought.
            </p>
          </div>

          <div className="hero__aside">
            <SystemHealthPanel health={health} />
            <p className="hero__aside-note">
              A live request to the Express API, through this page&rsquo;s own origin.
            </p>
          </div>
        </div>
      </section>

      <div className="coverage">
        <div className="container coverage__inner">
          <p className="coverage__label">In scope</p>
          <ul className="coverage__list">
            {coverage.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <section id="platform" className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                <span className="eyebrow__mark" aria-hidden="true" />
                The platform
              </p>
              <h2 className="section-title">
                One record of the business, from first call to final invoice.
              </h2>
            </div>
            <p className="section-head__body">
              Each module is built around a real workflow rather than a generic table. Statuses
              stay independent, ownership is explicit, and every consequential change leaves a
              trace.
            </p>
          </div>

          <div className="capabilities">
            {capabilities.map((capability, index) => (
              <article key={capability.title} className="capability">
                <span className="capability__index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="capability__title">{capability.title}</h3>
                  <p className="capability__body">{capability.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="section section--tinted">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                <span className="eyebrow__mark" aria-hidden="true" />
                Four interfaces
              </p>
              <h2 className="section-title">The same data, seen from the right desk.</h2>
            </div>
            <p className="section-head__body">
              Role is not a label on a screen. Admin sees the business, a salesperson sees their
              portfolio, the Manager owns invoice finalisation, and Operations does not need
              billing detail to do the job.
            </p>
          </div>

          <div className="roles">
            {roles.map((role, index) => (
              <article key={role.name} className="role">
                <span className="role__index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="role__name">{role.name}</h3>
                <p className="role__mandate">{role.mandate}</p>
                <p className="role__description">{role.description}</p>
                <ul className="role__list">
                  {role.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="workflow">
        <div className="container">
          <div className="section-head section-head--dark">
            <div>
              <p className="eyebrow eyebrow--dark">
                <span className="eyebrow__mark" aria-hidden="true" />
                One path, six steps
              </p>
              <h2 className="section-title">
                From a customer record to a settled account.
              </h2>
            </div>
            <p className="section-head__body">
              The first release is built around one complete path. Renewals, redo requests and
              complaints extend the same foundation, not a parallel process.
            </p>
          </div>

          <ol className="workflow__steps">
            {workflowSteps.map((step) => (
              <li key={step.index} className="workflow-step">
                <span className="workflow-step__index">{step.index}</span>
                <h3 className="workflow-step__title">{step.title}</h3>
                <p className="workflow-step__body">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="workflow__note">
            <div className="workflow__note-label">
              <p className="micro-label micro-label--dark">Independent statuses</p>
              <ul className="status-groups">
                {statusGroups.map((group) => (
                  <li key={group}>{group}</li>
                ))}
              </ul>
            </div>
            <p className="workflow__note-body">
              <strong>A completed installation is not a paid invoice.</strong> TrackMaster Hub keeps
              sales, operations, renewal, invoice, payment and subscription status separate — and
              never infers one from another.
            </p>
          </div>
        </div>
      </section>

      <section id="standards" className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">
                <span className="eyebrow__mark" aria-hidden="true" />
                Standards
              </p>
              <h2 className="section-title">Built to be trusted with the business.</h2>
            </div>
            <p className="section-head__body">
              TrackMaster Hub is a new system of record, and the rules below are design
              constraints rather than marketing. They apply to every module added from here.
            </p>
          </div>

          <div className="standards">
            {standards.map((standard, index) => (
              <article key={standard.title} className="standard">
                <span className="standard__index">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="standard__title">{standard.title}</h3>
                  <p className="standard__body">{standard.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
