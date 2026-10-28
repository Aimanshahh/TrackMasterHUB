import logoUrl from '../../assets/brand/trackmaster-logo.png';

export default function AuthSplash({ label = 'Checking your session…' }) {
  return (
    <div className="auth-splash" role="status">
      <img
        className="auth-splash__logo"
        src={logoUrl}
        width="46"
        height="46"
        alt=""
      />
      <p className="auth-splash__label">{label}</p>
    </div>
  );
}
