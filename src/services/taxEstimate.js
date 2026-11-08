const TAX_RATE_PERCENT = 20;

function estimateTax(incomeCents) {
  const taxCents = Math.round(incomeCents * (TAX_RATE_PERCENT / 100));

  return {
    model: 'illustrative-flat-rate',
    ratePercent: TAX_RATE_PERCENT,
    estimatedTax: taxCents / 100,
    afterEstimatedTax: (incomeCents - taxCents) / 100
  };
}

module.exports = { estimateTax };
