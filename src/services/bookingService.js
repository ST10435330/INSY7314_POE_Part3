const mongoose = require('mongoose');
const Gig = require('../models/Gig');
const Booking = require('../models/Booking');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/ApiError');

async function existing(client, requestId, gigId) {
  const booking = await Booking.findOne({ client, requestId });

  if (!booking) return null;

  if (String(booking.gig) !== gigId) {
    throw new ApiError(
      409,
      'REQUEST_CONFLICT',
      'This request ID has already been used for another gig.'
    );
  }

  const transaction = await Transaction.findOne({
    booking: booking._id
  });

  return { booking, transaction, replay: true };
}

async function book(client, { gigId, requestId }) {
  const prior = await existing(client, requestId, gigId);

  if (prior) return prior;

  let result;

  try {
    await mongoose.connection.transaction(async session => {
      const gig = await Gig.findOneAndUpdate(
        { _id: gigId, active: true },
        { $inc: { bookingCount: 1 } },
        { new: true, session }
      );

      if (!gig) {
        throw new ApiError(
          404,
          'NOT_FOUND',
          'This gig is no longer available.'
        );
      }

      if (String(gig.freelancer) === String(client)) {
        throw new ApiError(
          403,
          'FORBIDDEN',
          'You cannot book your own gig.'
        );
      }

      const [booking] = await Booking.create([{
        gig: gig._id,
        client,
        freelancer: gig.freelancer,
        gigTitle: gig.title,
        amountCents: gig.priceCents,
        requestId
      }], { session });

      const [transaction] = await Transaction.create([{
        booking: booking._id,
        client,
        freelancer: gig.freelancer,
        amountCents: gig.priceCents
      }], { session });

      result = { booking, transaction, replay: false };
    });
  } catch (error) {
    if (error.code === 11000) {
      const replay = await existing(client, requestId, gigId);
      if (replay) return replay;
    }

    throw error;
  }

  return result;
}

module.exports = { book };