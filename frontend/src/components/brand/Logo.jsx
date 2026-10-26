import { Link } from 'react-router-dom';

import logoUrl from '../../assets/brand/trackmaster-logo.png';

/**
 * Brand lockup: the official logo artwork plus the product name set in the
 * interface typeface. The supplied logo already contains the wordmark, so the
 * adjacent text names the product (TrackMaster Hub) rather than repeating it.
 */
export default function Logo({
  size = 42,
  subtitle = 'CRM & operations',
  linked = true,
  className = '',
}) {
  const content = (
    <>
      <img
        className="brand__logo"
        src={logoUrl}
        width={size}
        height={size}
        alt=""
        loading="eager"
        decoding="async"
      />
      <span className="brand__text">
        <span className="brand__name">TrackMaster Hub</span>
        {subtitle ? <span className="brand__sub">{subtitle}</span> : null}
      </span>
    </>
  );

  if (!linked) {
    return <div className={`brand ${className}`.trim()}>{content}</div>;
  }

  return (
    <Link to="/" className={`brand ${className}`.trim()} aria-label="TrackMaster Hub — home">
      {content}
    </Link>
  );
}
