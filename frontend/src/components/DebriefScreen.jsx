import React from 'react';

export default function DebriefScreen({ result, caseData, onLeave }) {
  if (!result) return null;

  const { score, correct, culpritName, explanation, redHerringNote, by } = result;
  const allClueIds = caseData ? Object.keys(caseData.clues) : [];
  const missed = allClueIds.filter((id) => !(result.unlockedClues || []).includes(id));

  return (
    <div className={`verdict-overlay debrief ${correct ? 'win' : 'lose'}`}>
      <div className="verdict-card panel debrief-card">
        <div className={`grade-badge grade-${score?.grade || 'F'}`}>{score?.grade || 'F'}</div>
        <h2>{correct ? 'Case Closed' : 'Investigation Failed'}</h2>
        <p className="score-points">{score?.points ?? 0} points</p>

        <div className="debrief-stats">
          <span>Time: {formatTime(score?.elapsedSeconds)}</span>
          <span>Wrong theories: {score?.wrongDeductions ?? 0}</span>
          <span>Hints: {score?.hintsUsed ?? 0}</span>
          <span>Leads used: {score?.leadsUsed ?? 0}</span>
        </div>

        <p>
          {correct
            ? `${by} correctly identified ${culpritName}.`
            : `The killer was ${culpritName}.`}
        </p>
        <p className="verdict-explanation">{explanation}</p>

        {redHerringNote && (
          <div className="red-herring-box">
            <strong>Red herring</strong>
            <p>{redHerringNote}</p>
          </div>
        )}

        {missed.length > 0 && (
          <div className="missed-clues">
            <strong>Clues you missed</strong>
            <ul>
              {missed.map((id) => (
                <li key={id}>{caseData.clues[id]?.title}</li>
              ))}
            </ul>
          </div>
        )}

        <button type="button" onClick={onLeave}>
          Return to Lobby
        </button>
      </div>
    </div>
  );
}

function formatTime(sec) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
