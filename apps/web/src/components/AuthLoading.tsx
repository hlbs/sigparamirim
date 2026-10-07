export function AuthLoading({ label = 'Preparando seu ambiente' }: { label?: string }) {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <div className="auth-loading-mark">
        <img className="auth-loading-gif" src={document.documentElement.dataset.theme === 'dark' ? '/loading_b.gif' : '/loading_w.gif'} alt="" />
        <span aria-hidden="true" />
      </div>
      <strong>{label}</strong>
      <small>Conectando conhecimento, território e pessoas.</small>
    </div>
  );
}
