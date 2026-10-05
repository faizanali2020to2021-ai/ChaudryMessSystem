/**
 * Greedy minimum-transaction debt simplification matching Kotlin SettlementCalculator.kt:
 * repeatedly matches the largest debtor with the largest creditor until everyone is settled.
 */
function computeSettlements(balances) {
  // Creditors: positive remaining balance (> 0.01)
  const creditors = balances
    .filter(b => (b.remainingBalance || 0) > 0.01)
    .map(b => ({ name: b.personName, amount: Number(b.remainingBalance) }));

  // Debtors: negative remaining balance (< -0.01)
  const debtors = balances
    .filter(b => (b.remainingBalance || 0) < -0.01)
    .map(b => ({ name: b.personName, amount: Math.abs(Number(b.remainingBalance)) }));

  const settlements = [];

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const creditor = creditors[0];
    const debtor = debtors[0];

    const settleAmount = Math.min(creditor.amount, debtor.amount);
    if (settleAmount > 0.01) {
      settlements.push({
        fromName: debtor.name,
        toName: creditor.name,
        amount: Math.round(settleAmount * 100) / 100
      });
    }

    const newCreditorAmt = creditor.amount - settleAmount;
    const newDebtorAmt = debtor.amount - settleAmount;

    creditors.shift();
    if (newCreditorAmt > 0.01) {
      creditors.unshift({ name: creditor.name, amount: Math.round(newCreditorAmt * 100) / 100 });
    }

    debtors.shift();
    if (newDebtorAmt > 0.01) {
      debtors.unshift({ name: debtor.name, amount: Math.round(newDebtorAmt * 100) / 100 });
    }
  }

  return settlements;
}

module.exports = { computeSettlements };
