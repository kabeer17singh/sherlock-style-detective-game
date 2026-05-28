import React from 'react';

export default function HowToPlay({ onClose }) {
  return (
    <div className="modal-overlay how-to-overlay">
      <div className="modal panel how-to-modal">
        <h2>How to Investigate</h2>
        <ol className="how-to-steps">
          <li>
            <strong>Spend leads</strong> to search locations and gather evidence.
          </li>
          <li>
            <strong>Drag clues</strong> onto the corkboard. Place related cards close together.
          </li>
          <li>
            <strong>Answer deduction challenges</strong> when red lines connect clues—co-op partners must agree.
          </li>
          <li>
            <strong>Accuse wisely:</strong> pick the culprit AND the two clues that prove motive.
          </li>
        </ol>
        <button type="button" onClick={onClose}>
          Begin Investigation
        </button>
      </div>
    </div>
  );
}
