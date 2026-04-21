const ALLOWED_SORT_FIELDS = {
  age: 'age',
  created_at: 'created_at',
  gender_probability: 'gender_probability',
};

const ALLOWED_ORDERS = ['asc', 'desc'];

/**
 * Build SQL components from request query params.
 *
 * @param {object} query  - Express req.query
 * @returns {{ where: string, orderBy: string, limit: number, offset: number, params: any[], countParams: any[], countWhere: string }}
 */
function buildQuery(query) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  const {
    gender,
    age_group,
    country_id,
    min_age,
    max_age,
    min_gender_probability,
    min_country_probability,
    sort_by = 'created_at',
    order = 'asc',
    page = '1',
    limit: limitRaw = '10',
  } = query;

  if (gender !== undefined) {
    conditions.push(`gender = $${paramIndex++}`);
    params.push(gender);
  }

  if (age_group !== undefined) {
    conditions.push(`age_group = $${paramIndex++}`);
    params.push(age_group);
  }

  if (country_id !== undefined) {
    conditions.push(`country_id = $${paramIndex++}`);
    params.push(country_id.toUpperCase());
  }

  if (min_age !== undefined) {
    conditions.push(`age >= $${paramIndex++}`);
    params.push(parseInt(min_age, 10));
  }

  if (max_age !== undefined) {
    conditions.push(`age <= $${paramIndex++}`);
    params.push(parseInt(max_age, 10));
  }

  if (min_gender_probability !== undefined) {
    conditions.push(`gender_probability >= $${paramIndex++}`);
    params.push(parseFloat(min_gender_probability));
  }

  if (min_country_probability !== undefined) {
    conditions.push(`country_probability >= $${paramIndex++}`);
    params.push(parseFloat(min_country_probability));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sortField = ALLOWED_SORT_FIELDS[sort_by] || 'created_at';
  const sortOrder = ALLOWED_ORDERS.includes(order?.toLowerCase()) ? order.toUpperCase() : 'ASC';
  const orderByClause = `ORDER BY ${sortField} ${sortOrder}`;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limitRaw, 10) || 10));
  const offset = (pageNum - 1) * limitNum;

  const countParams = [...params];
  const countWhere = whereClause;

  params.push(limitNum);
  params.push(offset);

  return {
    where: whereClause,
    orderBy: orderByClause,
    limit: limitNum,
    offset,
    page: pageNum,
    params,
    countParams,
    countWhere,
    limitParam: `$${paramIndex++}`,
    offsetParam: `$${paramIndex}`,
  };
}

module.exports = { buildQuery, ALLOWED_SORT_FIELDS, ALLOWED_ORDERS };