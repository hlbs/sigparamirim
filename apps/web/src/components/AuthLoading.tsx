export function AuthLoading({ label = 'Preparando seu ambiente' }: { label?: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <div className="auth-loading-mark">
        <img src="/sig-logo.png" alt="" />
        <span aria-hidden="true" />
      </div>
      <strong>{label}</strong>
      <small>Conectando conhecimento, território e pessoas.</small>
    </div>
  );
}
