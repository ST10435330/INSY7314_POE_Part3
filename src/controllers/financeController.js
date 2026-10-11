const Transaction = require('../models/Transaction');
const { ownFilter, transactionView } = require('./bookingController');
const ApiError = require('../utils/ApiError');

exports.list = async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const transactions = await Transaction.find(ownFilter(req.user))
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  return res.json({
    transactions: transactions.map(transactionView),
    page,
    limit
  });
};

exports.get = async (req, res) => {
  const transaction = await Transaction.findOne({
    _id: req.params.id,
    ...ownFilter(req.user)
  });

  if (!transaction) {
    throw new ApiError(
      404,
      'NOT_FOUND',
      'Transaction not found or unavailable to your account.'
    );
  }

  return res.json({
    transaction: transactionView(transaction)
  });
};

exports.income = async (req, res) => {
  const [summary] = await Transaction.aggregate([
    {
      $match: {
        freelancer: req.user._id,
        currency: 'ZAR',
        status: 'simulated'
      }
    },
    {
      $group: {
        _id: null,
        totalCents: { $sum: '$amountCents' },
        bookingCount: { $sum: 1 }
      }
    }
  ]);

  return res.json({
    income: {
      totalIncome: (summary?.totalCents || 0) / 100,
      currency: 'ZAR',
      bookingCount: summary?.bookingCount || 0,
      paymentType: 'simulated'
    }
  });
};