const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { buildQuery } = require('../utils/queryBuilder');
const { parseNaturalLanguageQuery } = require('../utils/nlpParser');
const { validateProfilesQuery, validateSearchQuery } = require('../middleware/validation');

function formatProfile(row) {
  return {
    id: row.id,
    name: row.name,
    gender: row.gender,
    gender_probability: parseFloat(row.gender_probability),
    age: parseInt(row.age, 10),
    age_group: row.age_group,
    country_id: row.country_id,
    country_name: row.country_name,
    country_probability: parseFloat(row.country_probability),
    created_at: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
  };
}

router.get('/search', validateSearchQuery, async (req, res) => {
  try {
    const { q, page: pageRaw = '1', limit: limitRaw = '10' } = req.query;
    const parsedFilters = parseNaturalLanguageQuery(q);

    if (!parsedFilters) {
      return res.status(200).json({
        status: 'error',
        message: 'Unable to interpret query',
      });
    }

    const mergedQuery = {
      ...parsedFilters,
      page: pageRaw,
      limit: limitRaw,
      sort_by: req.query.sort_by || 'created_at',
      order: req.query.order || 'asc',
    };

    const { where, orderBy, limit, page, params, countParams, countWhere } =
      buildQuery(mergedQuery);

    const dataSQL = `SELECT * FROM profiles ${where} ${orderBy} LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}`;
    const countSQL = `SELECT COUNT(*)::int AS total FROM profiles ${countWhere}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataSQL, params),
      pool.query(countSQL, countParams),
    ]);

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total: countResult.rows[0].total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    console.error('Search error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/', validateProfilesQuery, async (req, res) => {
  try {
    const { where, orderBy, limit, page, params, countParams, countWhere } =
      buildQuery(req.query);

    const dataSQL = `SELECT * FROM profiles ${where} ${orderBy} LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}`;
    const countSQL = `SELECT COUNT(*)::int AS total FROM profiles ${countWhere}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataSQL, params),
      pool.query(countSQL, countParams),
    ]);

    return res.status(200).json({
      status: 'success',
      page,
      limit,
      total: countResult.rows[0].total,
      data: dataResult.rows.map(formatProfile),
    });
  } catch (err) {
    console.error('Get profiles error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Profile not found' });
    }

    return res.status(200).json({
      status: 'success',
      data: formatProfile(result.rows[0]),
    });
  } catch (err) {
    console.error('Get profile by ID error:', err);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

module.exports = router;