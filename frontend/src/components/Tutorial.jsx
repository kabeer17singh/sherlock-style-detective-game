import React, { useState } from 'react';

const SECTIONS = [
  {
    id: 'overview',
    title: 'Your mission',
    content: (
      <>
        <p>
          You are a detective at The Agency. Each case is a 10–15 minute investigation:
          gather evidence, connect clues on the corkboard, pass deduction challenges, and
          accuse the killer with proof.
        </p>
        <p className="tutorial-tip">
          Play <strong>Solo</strong> or <strong>Co-op</strong> with a friend using a shared room code.
        </p>
      </>
    ),
  },
  {
    id: 'start',
    title: 'Starting a game',
    content: (
      <ol className="tutorial-steps">
        <li>Pick one of three cases from the lobby.</li>
        <li>Choose <strong>Solo</strong> or <strong>Co-op</strong>.</li>
        <li>
          Click <strong>Open New Case File</strong> to create a room, or enter a friend&apos;s{' '}
          <strong>6-letter room code</strong> to join.
        </li>
        <li>Share the invite link or QR code so your partner can join the same room.</li>
      </ol>
    ),
  },
  {
    id: 'leads',
    title: 'Investigation leads',
    content: (
      <>
        <p>
          You start with a limited number of <strong>leads</strong> (shown in the sidebar).
          Each lead lets you investigate one location—such as a theater, office, or dock.
        </p>
        <ul className="tutorial-bullets">
          <li>Click a location in <strong>Investigation leads</strong> to spend 1 lead.</li>
          <li>Each location can only be searched once.</li>
          <li>New evidence appears in your <strong>Case file</strong> on the left.</li>
          <li>When leads run out, rely on clues you already have and board deductions.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'board',
    title: 'Evidence board',
    content: (
      <>
        <p>
          Drag clue cards from the case file onto the corkboard. Arrange related evidence
          near each other to think through the crime.
        </p>
        <ul className="tutorial-bullets">
          <li>
            <span className="line-demo dashed" /> Dashed red lines = clues are close; a
            deduction may be possible.
          </li>
          <li>
            <span className="line-demo solid" /> Solid gold lines = deduction challenge is
            ready—open it and answer!
          </li>
          <li>Use <strong>Shared notes</strong> in co-op to coordinate theories with your partner.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'deduction',
    title: 'Deduction challenges',
    content: (
      <>
        <p>
          When the right clues sit close together on the board, a{' '}
          <strong>Deduction Challenge</strong> appears. You must pick the best theory from
          multiple choices—wrong answers hurt your score.
        </p>
        <ul className="tutorial-bullets">
          <li>
            <strong>Solo:</strong> Answer alone. After 3 wrong tries on one challenge, use{' '}
            <strong>Detective&apos;s Hunch</strong> to eliminate a wrong option (costs points).
          </li>
          <li>
            <strong>Co-op:</strong> Every detective in the room must submit the{' '}
            <strong>same correct answer</strong> before new evidence unlocks.
          </li>
          <li>Watch for the pulsing <strong>Deduction ready</strong> button in the sidebar.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'accuse',
    title: 'Final accusation',
    content: (
      <>
        <p>When all critical clues are unlocked, you can make your accusation—in two steps:</p>
        <ol className="tutorial-steps">
          <li>
            <strong>Step 1:</strong> Select who you believe is the killer.
          </li>
          <li>
            <strong>Step 2:</strong> Pick exactly <strong>two clues</strong> that prove motive and
            means.
          </li>
        </ol>
        <p className="tutorial-warning">
          Picking the right suspect but wrong evidence still fails the case. Read each clue
          carefully.
        </p>
      </>
    ),
  },
  {
    id: 'scoring',
    title: 'Grades & replay',
    content: (
      <>
        <p>After the verdict you receive a letter grade and debrief:</p>
        <ul className="tutorial-bullets">
          <li>
            <strong>S / A / B / C</strong> — based on speed, leads used, wrong deductions, and
            hints.
          </li>
          <li>Red herring notes explain why other suspects looked guilty.</li>
          <li>Try another case or beat your personal best score from the lobby.</li>
        </ul>
      </>
    ),
  },
];

export default function Tutorial({ onClose, defaultSection = 'overview' }) {
  const [activeId, setActiveId] = useState(defaultSection);

  const active = SECTIONS.find((s) => s.id === activeId) || SECTIONS[0];

  return (
    <div className="modal-overlay tutorial-overlay" onClick={onClose}>
      <div
        className="modal panel tutorial-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="tutorial-title"
      >
        <div className="tutorial-header">
          <h2 id="tutorial-title">Detective&apos;s Handbook</h2>
          <button type="button" className="tutorial-close secondary" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="tutorial-layout">
          <nav className="tutorial-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={activeId === s.id ? 'active' : ''}
                onClick={() => setActiveId(s.id)}
              >
                {s.title}
              </button>
            ))}
          </nav>

          <div className="tutorial-content">
            <h3>{active.title}</h3>
            {active.content}
          </div>
        </div>

        <div className="tutorial-footer">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
          {activeId !== SECTIONS[SECTIONS.length - 1].id ? (
            <button
              type="button"
              onClick={() => {
                const idx = SECTIONS.findIndex((s) => s.id === activeId);
                setActiveId(SECTIONS[idx + 1].id);
              }}
            >
              Next section
            </button>
          ) : (
            <button type="button" onClick={onClose}>
              Start investigating
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
