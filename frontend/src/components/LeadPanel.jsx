import React from 'react';

export default function LeadPanel({
  locations,
  leadsRemaining,
  investigatedLocations,
  unlockedClues,
  gamePhase,
  onInvestigate,
}) {
  if (!locations?.length) return null;

  return (
    <div className="lead-panel">
      <div className="leads-header">
        <h3>Investigation leads</h3>
        <span className={`leads-count ${leadsRemaining === 0 ? 'empty' : ''}`}>
          {leadsRemaining} left
        </span>
      </div>
      <p className="hint">Spend a lead to investigate a location and uncover new evidence.</p>
      <div className="location-list">
        {locations.map((loc) => {
          const done =
            investigatedLocations.includes(loc.id) || unlockedClues.includes(loc.clueId);
          return (
            <button
              key={loc.id}
              type="button"
              className={`location-btn ${done ? 'done' : ''}`}
              disabled={done || leadsRemaining <= 0 || gamePhase === 'solved'}
              onClick={() => onInvestigate(loc.id)}
            >
              <strong>{loc.name}</strong>
              <span>{loc.action}</span>
              {done && <small>Investigated</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
