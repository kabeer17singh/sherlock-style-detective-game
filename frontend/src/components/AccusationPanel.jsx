import React, { useState } from 'react';

export default function AccusationPanel({
  suspects,
  clues,
  requiredEvidenceCount = 2,
  canAccuse,
  gamePhase,
  onAccuse,
  disabled,
}) {
  const [step, setStep] = useState(1);
  const [selectedSuspect, setSelectedSuspect] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState([]);

  if (gamePhase === 'solved') return null;

  const evidenceOptions = Object.entries(clues || {}).filter(([, c]) =>
    ['evidence', 'deduction', 'document'].includes(c.type)
  );

  const toggleEvidence = (id) => {
    setSelectedEvidence((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= requiredEvidenceCount) return prev;
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    onAccuse(selectedSuspect, selectedEvidence);
  };

  return (
    <div className="accusation-panel">
      <h3>Make Your Accusation</h3>
      {!canAccuse ? (
        <p className="hint">
          Gather all critical evidence via leads and deductions before accusing anyone.
        </p>
      ) : (
        <>
          {step === 1 && (
            <>
              <p className="hint">Step 1: Who is the killer?</p>
              <div className="suspect-list">
                {suspects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`suspect-btn ${selectedSuspect === s.id ? 'selected' : ''}`}
                    onClick={() => setSelectedSuspect(s.id)}
                    disabled={disabled}
                  >
                    <strong>{s.name}</strong>
                    <span>{s.role}</span>
                    <small>{s.detail}</small>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={!selectedSuspect || disabled}
                onClick={() => setStep(2)}
              >
                Next: Present Evidence
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <p className="hint">
                Step 2: Select exactly {requiredEvidenceCount} clues that prove motive and means.
              </p>
              <div className="evidence-pick-list">
                {evidenceOptions.map(([id, clue]) => (
                  <button
                    key={id}
                    type="button"
                    className={`evidence-pick ${selectedEvidence.includes(id) ? 'selected' : ''}`}
                    onClick={() => toggleEvidence(id)}
                    disabled={disabled}
                  >
                    {clue.title}
                  </button>
                ))}
              </div>
              <div className="confirm-actions">
                <button type="button" className="secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  type="button"
                  disabled={
                    selectedEvidence.length !== requiredEvidenceCount || disabled
                  }
                  onClick={handleConfirm}
                >
                  Submit Verdict
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
