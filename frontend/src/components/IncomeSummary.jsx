import './IncomeSummary.css';

const formatMoney = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR'
}).format;

export default function IncomeSummary({ income, taxEstimate }) {
  const taxShare = taxEstimate && income.totalIncome > 0
    ? Math.round(taxEstimate.estimatedTax / income.totalIncome * 100)
    : null;

  return (
    <section className="income-summary" aria-labelledby="income-title">
      <h3 id="income-title">Freelancer income and tax</h3>
      <p>Lifetime simulated earnings &middot; {income.bookingCount} bookings</p>
      <dl className="income-summary__cards">
        <div>
          <dt>Gross income</dt>
          <dd>{formatMoney(income.totalIncome)}</dd>
        </div>
        {taxEstimate && (
          <>
            <div>
              <dt>Estimated tax ({taxEstimate.ratePercent}%)</dt>
              <dd>{formatMoney(taxEstimate.estimatedTax)}</dd>
            </div>
            <div>
              <dt>Income after estimated tax</dt>
              <dd>{formatMoney(taxEstimate.afterEstimatedTax)}</dd>
            </div>
          </>
        )}
      </dl>
      {taxShare !== null && (
        <figure className="income-summary__chart">
          <figcaption>How gross income is split</figcaption>
          <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
            <rect width={taxShare} height="8" className="income-summary__tax" />
            <rect x={taxShare} width={100 - taxShare} height="8" className="income-summary__net" />
          </svg>
          <div className="income-summary__legend">
            <span>Estimated tax: {taxShare}%</span>
            <span>After estimated tax: {100 - taxShare}%</span>
          </div>
        </figure>
      )}
      {taxEstimate && (
        <p className="income-summary__note">
          Illustrative estimate using a flat rate on platform income.
          Actual tax depends on your personal circumstances.
        </p>
      )}
    </section>
  );
}
