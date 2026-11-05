import { formatDay } from '../../lib/dates.js';

const TONES = { active: 'paid', cancelled: 'overdue', superseded: 'muted' };

/** A list of certificates with the actions that make sense for each one's state. */
export default function CertificateTable({ certificates, onPreview, onReissue, onCancel, emptyMessage }) {
  if (!certificates.length) return <p className="data-state">{emptyMessage}</p>;

  return (
    <div className="ledger-scroll">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Certificate</th>
            <th scope="col">Vehicle</th>
            <th scope="col">Customer</th>
            <th scope="col">Valid until</th>
            <th scope="col">Status</th>
            <th scope="col" className="ledger__action-col"><span className="ledger__sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {certificates.map((cert) => (
            <tr key={cert.id}>
              <td>
                <span className="ledger__ref">{cert.number}</span>
                <span className="ledger__sub">Issued {formatDay(cert.issuedAt)}</span>
                {cert.reissueOf ? <span className="ledger__sub">Reissue: {cert.reissueReason}</span> : null}
              </td>
              <td>
                <span className="ledger__ref">{cert.vehicle.registration}</span>
                <span className="ledger__sub">{cert.vehicle.makeModel || '—'}</span>
              </td>
              <td>{cert.customer.name}<span className="ledger__sub">{cert.customer.phone}</span></td>
              <td>{formatDay(cert.expiresAt)}</td>
              <td>
                <span className="state-tag" data-state={TONES[cert.status]}>{cert.statusLabel}</span>
                {cert.status === 'cancelled' && cert.cancelReason ? <span className="ledger__sub">{cert.cancelReason}</span> : null}
              </td>
              <td className="ledger__action-col">
                <button type="button" className="btn btn--outline btn--small" onClick={() => onPreview(cert)}>View</button>
                {cert.status === 'active' && onReissue ? <button type="button" className="btn btn--outline btn--small" onClick={() => onReissue(cert)}>Reissue</button> : null}
                {cert.status === 'active' && onCancel ? <button type="button" className="btn btn--outline btn--small" onClick={() => onCancel(cert)}>Cancel</button> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
