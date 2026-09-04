/** Part I §8: ship a fallback. Never a black canvas on stage. */
export function Fallback({ reason }: { reason: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ maxWidth: 460, padding: 32 }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 21,
            color: 'var(--text)',
            marginBottom: 10,
          }}
        >
          3D scene unavailable
        </div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          {reason}
        </div>
        <div
          className="mono"
          style={{ fontSize: 13, color: 'var(--text-mute)', lineHeight: 1.7, marginTop: 14 }}
        >
          The exploration and operations dashboards remain fully interactive — every number on
          this screen is computed from the same model, not from the renderer.
        </div>
      </div>
    </div>
  );
}
