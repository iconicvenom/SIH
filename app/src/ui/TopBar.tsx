export function TopBar() {
  return (
    <div
      className="mono absolute left-0 right-0 top-4 flex justify-center"
      style={{ pointerEvents: 'none' }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 16, letterSpacing: '0.08em' }}>
        DRISHTI
      </div>
    </div>
  );
}
