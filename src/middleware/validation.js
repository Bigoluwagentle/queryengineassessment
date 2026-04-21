const { ALLOWED_SORT_FIELDS, ALLOWED_ORDERS } = require('../utils/queryBuilder');

const VALID_GENDERS = ['male', 'female'];
const VALID_AGE_GROUPS = ['child', 'teenager', 'adult', 'senior'];

function validateProfilesQuery(req, res, next) {
  const {
    gender,
    age_group,
    country_id,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by,
    order,
    page,
    limit,
  } = req.query;

  if (gender !== undefined) {
    if (gender.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (!VALID_GENDERS.includes(gender.toLowerCase())) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    req.query.gender = gender.toLowerCase();
  }

  if (age_group !== undefined) {
    if (age_group.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (!VALID_AGE_GROUPS.includes(age_group.toLowerCase())) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    req.query.age_group = age_group.toLowerCase();
  }

  if (country_id !== undefined) {
    if (country_id.trim() === '') {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (!/^[A-Za-z]{2}$/.test(country_id.trim())) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    req.query.country_id = country_id.trim().toUpperCase();
  }

  if (min_age !== undefined) {
    const val = parseInt(min_age, 10);
    if (isNaN(val) || String(val) !== min_age.trim()) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (val < 0) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (max_age !== undefined) {
    const val = parseInt(max_age, 10);
    if (isNaN(val) || String(val) !== max_age.trim()) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
    if (val < 0) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (min_gender_probability !== undefined) {
    const val = parseFloat(min_gender_probability);
    if (isNaN(val) || val < 0 || val > 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (min_country_probability !== undefined) {
    const val = parseFloat(min_country_probability);
    if (isNaN(val) || val < 0 || val > 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (sort_by !== undefined) {
    if (!ALLOWED_SORT_FIELDS[sort_by]) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (order !== undefined) {
    if (!ALLOWED_ORDERS.includes(order.toLowerCase())) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (page !== undefined) {
    const val = parseInt(page, 10);
    if (isNaN(val) || val < 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (limit !== undefined) {
    const val = parseInt(limit, 10);
    if (isNaN(val) || val < 1 || val > 50) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  next();
}

function validateSearchQuery(req, res, next) {
  const { q, page, limit } = req.query;

  if (q === undefined || q.trim() === '') {
    return res.status(400).json({ status: 'error', message: 'Missing or empty parameter: q' });
  }

  if (page !== undefined) {
    const val = parseInt(page, 10);
    if (isNaN(val) || val < 1) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  if (limit !== undefined) {
    const val = parseInt(limit, 10);
    if (isNaN(val) || val < 1 || val > 50) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  next();
}

module.exports = { validateProfilesQuery, validateSearchQuery };