const COMBO_DISTANCE = 120;

function cluePositions(boardData, clueIds) {
  return clueIds.map((id) => boardData.find((c) => c.id === id)).filter(Boolean);
}

function areCluesAdjacent(boardData, clueIds, threshold = COMBO_DISTANCE) {
  const positions = cluePositions(boardData, clueIds);
  if (positions.length !== clueIds.length) return false;

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const dx = positions[i].x - positions[j].x;
      const dy = positions[i].y - positions[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > threshold) return false;
    }
  }
  return true;
}

function findNewDiscoveries(caseData, boardData, unlockedClues) {
  const discoveries = [];
  const newUnlocked = [...unlockedClues];

  for (const combo of caseData.combinations || []) {
    if (newUnlocked.includes(combo.unlocks)) continue;

    const hasAllOnBoard = combo.requires.every((id) =>
      boardData.some((c) => c.id === id)
    );
    if (!hasAllOnBoard) continue;
    if (!areCluesAdjacent(boardData, combo.requires)) continue;

    newUnlocked.push(combo.unlocks);
    discoveries.push({
      unlocks: combo.unlocks,
      message: combo.message,
      title: caseData.clues[combo.unlocks]?.title || 'New clue',
    });
  }

  return { newUnlocked, discoveries };
}

function canAccuse(caseData, unlockedClues) {
  const required = caseData.solution?.requiredClues || [];
  return required.every((id) => unlockedClues.includes(id));
}

function evaluateAccusation(caseData, suspectId) {
  const correct = caseData.solution?.culpritId === suspectId;
  return {
    correct,
    culpritName: caseData.suspects?.find((s) => s.id === caseData.solution?.culpritId)?.name,
    explanation: caseData.solution?.explanation,
  };
}

module.exports = {
  COMBO_DISTANCE,
  areCluesAdjacent,
  findNewDiscoveries,
  canAccuse,
  evaluateAccusation,
};
