import React, { useEffect } from 'react';

export default function DiscoveryToast({ discoveries, onDismiss }) {
  useEffect(() => {
    if (!discoveries.length) return;
    const timer = setTimeout(() => onDismiss(discoveries[0].id), 6000);
    return () => clearTimeout(timer);
  }, [discoveries, onDismiss]);

  if (!discoveries.length) return null;

  return (
    <div className="toast-stack">
      {discoveries.map((d) => (
        <div key={d.id} className="discovery-toast" onClick={() => onDismiss(d.id)}>
          <div className="toast-label">Breakthrough</div>
          <div className="toast-title">{d.title}</div>
          <p>{d.message}</p>
          {d.by && <span className="toast-by">Discovered by {d.by}</span>}
        </div>
      ))}
    </div>
  );
}
