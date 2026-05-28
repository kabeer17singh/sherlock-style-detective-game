import React, { useState } from 'react';

export default function AccusationPanel({ suspects, canAccuse, gamePhase, onAccuse, disabled }) {
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);

  if (gamePhase === 'solved') return null;

  return (
    <div className="accusation-panel">
      <h3>Make Your Accusation</h3>
      {!canAccuse ? (
        <p className="hint">Unlock every critical clue by linking evidence on the board before accusing anyone.</p>
      ) : (
        <>
          <p className="hint">The evidence is in. Choose the culprit and stake your reputation.</p>
          <div className="suspect-list">
            {suspects.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`suspect-btn ${selected === s.id ? 'selected' : ''}`}
                onClick={() => setSelected(s.id)}
                disabled={disabled}
              >
                <strong>{s.name}</strong>
                <span>{s.role}</span>
                <small>{s.detail}</small>
              </button>
            ))}
          </div>
          {!confirming ? (
            <button
              type="button"
              disabled={!selected || disabled}
              onClick={() => setConfirming(true)}
            >
              Accuse Selected Suspect
            </button>
          ) : (
            <div className="confirm-accuse">
              <p>Are you certain? A wrong accusation ends the investigation.</p>
              <div className="confirm-actions">
                <button type="button" className="secondary" onClick={() => setConfirming(false)}>
                  Reconsider
                </button>
                <button
                  type="button"
                  onClick={() => onAccuse(selected)}
                  disabled={disabled}
                >
                  Confirm Accusation
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
