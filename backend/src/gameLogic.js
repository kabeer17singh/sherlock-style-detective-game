const COMBO_DISTANCE = 120;

function comboKey(requires) {
  return [...requires].sort().join('+');
}

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
      if (Math.sqrt(dx * dx + dy * dy) > threshold) return false;
    }
  }
  return true;
}

function getReadyCombinations(caseData, boardData, unlockedClues, completedCombos) {
  const ready = [];
  const done = new Set(completedCombos || []);

  for (const combo of caseData.combinations || []) {
    const key = comboKey(combo.requires);
    if (done.has(key) || unlockedClues.includes(combo.unlocks)) continue;

    const hasAllOnBoard = combo.requires.every((id) =>
      boardData.some((c) => c.id === id)
    );
    if (!hasAllOnBoard || !areCluesAdjacent(boardData, combo.requires)) continue;

    ready.push({
      key,
      requires: combo.requires,
      unlocks: combo.unlocks,
      message: combo.message,
      challenge: combo.challenge,
      title: caseData.clues[combo.unlocks]?.title || 'New clue',
    });
  }

  return ready;
}

function validateDeductionAnswer(combo, optionId) {
  if (!combo?.challenge?.options) return false;
  const option = combo.challenge.options.find((o) => o.id === optionId);
  return Boolean(option?.correct);
}

function findComboByKey(caseData, key) {
  return (caseData.combinations || []).find((c) => comboKey(c.requires) === key);
}

function canAccuse(caseData, unlockedClues) {
  const required = caseData.solution?.requiredClues || [];
  return required.every((id) => unlockedClues.includes(id));
}

function evaluateAccusation(caseData, suspectId, evidenceClueIds = []) {
  const suspectCorrect = caseData.solution?.culpritId === suspectId;
  const requiredEvidence = caseData.solution?.evidenceClues || [];
  const evidenceCorrect =
    requiredEvidence.length === 0 ||
    (evidenceClueIds.length === requiredEvidence.length &&
      requiredEvidence.every((id) => evidenceClueIds.includes(id)));

  const correct = suspectCorrect && evidenceCorrect;

  return {
    correct,
    suspectCorrect,
    evidenceCorrect,
    culpritName: caseData.suspects?.find((s) => s.id === caseData.solution?.culpritId)?.name,
    explanation: caseData.solution?.explanation,
    redHerringNote: caseData.solution?.redHerringNote,
  };
}

function computeScore(stats, caseData, correct) {
  const maxLeads = caseData.maxLeads || 7;
  const leadsUsed = maxLeads - (stats.leadsRemaining ?? maxLeads);
  const elapsed = stats.elapsedSeconds || 0;
  const wrong = stats.wrongDeductions || 0;
  const hints = stats.hintsUsed || 0;

  let points = correct ? 1000 : 200;
  points -= wrong * 75;
  points -= hints * 120;
  points -= leadsUsed * 15;
  if (elapsed > 900) points -= 50;
  else if (elapsed < 600) points += 50;
  points = Math.max(0, points);

  let grade = 'C';
  if (!correct) grade = 'F';
  else if (points >= 900) grade = 'S';
  else if (points >= 750) grade = 'A';
  else if (points >= 550) grade = 'B';

  return {
    points,
    grade,
    elapsedSeconds: elapsed,
    wrongDeductions: wrong,
    hintsUsed: hints,
    leadsUsed,
  };
}

function getHintForCombo(combo) {
  const wrongOptions = (combo.challenge?.options || []).filter((o) => !o.correct);
  if (wrongOptions.length === 0) return null;
  const eliminate = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
  return {
    eliminatedOptionId: eliminate.id,
    text: `Ruled out: "${eliminate.text}"`,
  };
}

module.exports = {
  COMBO_DISTANCE,
  comboKey,
  areCluesAdjacent,
  getReadyCombinations,
  validateDeductionAnswer,
  findComboByKey,
  canAccuse,
  evaluateAccusation,
  computeScore,
  getHintForCombo,
};
