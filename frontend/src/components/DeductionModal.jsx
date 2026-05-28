import React, { useState } from 'react';

export default function DeductionModal({
  deduction,
  gameMode,
  voteStatus,
  wrongCount,
  onSubmit,
  onHint,
  onClose,
  hint,
}) {
  const [selected, setSelected] = useState(null);

  if (!deduction) return null;

  const canHint = gameMode === 'solo' && wrongCount >= 3;

  return (
    <div className="modal-overlay">
      <div className="modal panel deduction-modal">
        <h3>Deduction Challenge</h3>
        <p className="deduction-prompt">{deduction.challenge?.prompt}</p>
        <p className="hint">
          Linked clues: {deduction.requires.map((id) => id.replace('clue-', '#')).join(' + ')}
        </p>

        {gameMode === 'coop' && voteStatus && (
          <p className="vote-status">
            Votes: {voteStatus.voted}/{voteStatus.required}
            {voteStatus.voters?.length > 0 && ` (${voteStatus.voters.join(', ')})`}
          </p>
        )}

        {hint && (
          <div className="hint-box">{hint.text}</div>
        )}

        <div className="deduction-options">
          {deduction.challenge?.options?.map((opt) => {
            const eliminated = hint?.eliminatedOptionId === opt.id;
            if (eliminated) return null;
            return (
              <button
                key={opt.id}
                type="button"
                className={`deduction-option ${selected === opt.id ? 'selected' : ''}`}
                onClick={() => setSelected(opt.id)}
              >
                {opt.text}
              </button>
            );
          })}
        </div>

        <div className="modal-actions">
          {canHint && (
            <button type="button" className="secondary" onClick={() => onHint(deduction.key)}>
              Detective&apos;s Hunch
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            Later
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => onSubmit(deduction.key, selected)}
          >
            {gameMode === 'coop' ? 'Submit Theory' : 'Confirm Theory'}
          </button>
        </div>
      </div>
    </div>
  );
}
