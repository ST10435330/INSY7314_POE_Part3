import './IncomeSummary.css';

const formatMoney = new Intl.NumberFormat('en-ZA', {
  style: 'currency',
  currency: 'ZAR'
}).format;

export default function IncomeSummary({ income, taxEstimate }) {
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
      {taxEstimate && (
        <p className="income-summary__note">
          Illustrative estimate using a flat rate on platform income.
          Actual tax depends on your personal circumstances.
        </p>
      )}
    </section>
  );
}
