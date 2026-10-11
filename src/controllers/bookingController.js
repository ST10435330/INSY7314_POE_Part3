const Booking = require('../models/Booking');
const service = require('../services/bookingService');
const ApiError = require('../utils/ApiError');

const bookingView = booking => ({
  id: String(booking._id),
  gigId: String(booking.gig),
  gigTitle: booking.gigTitle,
  clientId: String(booking.client),
  freelancerId: String(booking.freelancer),
  amount: booking.amountCents / 100,
  currency: booking.currency,
  status: booking.status,
  createdAt: booking.createdAt
});

const transactionView = transaction => ({
  id: String(transaction._id),
  bookingId: String(transaction.booking),
  clientId: String(transaction.client),
  freelancerId: String(transaction.freelancer),
  amount: transaction.amountCents / 100,
  currency: transaction.currency,
  status: transaction.status,
  createdAt: transaction.createdAt
});

const ownFilter = user => ({
  $or: [{ client: user._id }, { freelancer: user._id }]
});

exports.bookingView = bookingView;
exports.transactionView = transactionView;
exports.ownFilter = ownFilter;

exports.create = async (req, res) => {
  const { booking, transaction, replay } = await service.book(
    req.user._id,
    req.body
  );

  return res.status(replay ? 200 : 201).json({
    message: replay
      ? 'Existing booking retrieved.'
      : 'Booking confirmed; simulated transaction recorded.',
    booking: bookingView(booking),
    transaction: transactionView(transaction),
    replay
  });
};

exports.list = async (req, res) => {
  const bookings = await Booking.find(ownFilter(req.user))
    .sort({ createdAt: -1 });

  return res.json({
    bookings: bookings.map(bookingView)
  });
};

exports.get = async (req, res) => {
  const booking = await Booking.findOne({
    _id: req.params.id,
    ...ownFilter(req.user)
  });

  if (!booking) {
    throw new ApiError(
      404,
      'NOT_FOUND',
      'Booking not found or unavailable to your account.'
    );
  }

  return res.json({ booking: bookingView(booking) });
};