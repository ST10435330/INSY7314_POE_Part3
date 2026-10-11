const Gig = require('../models/Gig');

function view(gig) {
  return {
    id: String(gig._id),
    title: gig.title,
    description: gig.description,
    price: gig.priceCents / 100,
    currency: 'ZAR',
    active: gig.active,
    freelancerId: gig.freelancer
      ? String(gig.freelancer._id || gig.freelancer)
      : null,
    freelancerName: gig.freelancer?.name
  };
}

function notFound(res) {
  return res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Gig not found or unavailable to your account.'
    }
  });
}

exports.list = async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);

  const gigs = await Gig.find({ active: true })
    .sort({ createdAt: -1, _id: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('freelancer', 'name');

  return res.json({
    gigs: gigs.map(view),
    page,
    limit
  });
};

exports.mine = async (req, res) => {
  const gigs = await Gig.find({
    freelancer: req.user._id,
    active: true
  }).sort({ createdAt: -1 });

  return res.json({ gigs: gigs.map(view) });
};

exports.get = async (req, res) => {
  const gig = await Gig.findOne({
    _id: req.params.id,
    active: true
  }).populate('freelancer', 'name');

  if (!gig) return notFound(res);

  return res.json({ gig: view(gig) });
};

exports.create = async (req, res) => {
  const { title, description, price } = req.body;

  const gig = await Gig.create({
    title,
    description,
    priceCents: Math.round(price * 100),
    freelancer: req.user._id
  });

  return res.status(201).json({
    message: 'Gig created.',
    gig: view(gig)
  });
};

exports.update = async (req, res) => {
  const changes = {};

  for (const field of ['title', 'description']) {
    if (req.body[field] !== undefined) {
      changes[field] = req.body[field];
    }
  }

  if (req.body.price !== undefined) {
    changes.priceCents = Math.round(req.body.price * 100);
  }

  const gig = await Gig.findOneAndUpdate(
    {
      _id: req.params.id,
      freelancer: req.user._id,
      active: true
    },
    { $set: changes },
    { new: true, runValidators: true }
  );

  if (!gig) return notFound(res);

  return res.json({
    message: 'Gig updated.',
    gig: view(gig)
  });
};

exports.remove = async (req, res) => {
  const gig = await Gig.findOneAndUpdate(
    {
      _id: req.params.id,
      freelancer: req.user._id,
      active: true
    },
    { $set: { active: false } },
    { new: true, runValidators: true }
  );

  if (!gig) return notFound(res);

  return res.json({
    message: 'Gig removed from the marketplace.',
    gig: view(gig)
  });
};