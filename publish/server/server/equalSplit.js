/**
 * Splits amount equally among personIds.
 * Rounds each share to 2 decimal places, then nudges the LAST person's share
 * by whatever rounding remainder is left, guaranteeing sum(shares) == amount exactly.
 * Matches Kotlin ExpenseRepository.splitEqually.
 */
function splitEqually(amount, personIds) {
  if (!personIds || personIds.length === 0) {
    throw new Error('At least one person must be selected for the split.');
  }

  const n = personIds.length;
  const numAmount = Number(amount);
  
  // Calculate raw share rounded to 2 decimals
  const rawShare = Math.round((numAmount / n) * 100) / 100;
  
  const shares = [];
  let sumSoFar = 0;

  for (let i = 0; i < n; i++) {
    const pId = personIds[i];
    if (i === n - 1) {
      // Last person gets exact remaining difference
      const lastShare = Math.round((numAmount - sumSoFar) * 100) / 100;
      shares.push({ personId: pId, shareAmount: lastShare });
    } else {
      shares.push({ personId: pId, shareAmount: rawShare });
      sumSoFar = Math.round((sumSoFar + rawShare) * 100) / 100;
    }
  }

  return shares;
}

module.exports = { splitEqually };
