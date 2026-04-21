# Insighta Labs — Intelligence Query Engine

A RESTful API for querying demographic profile data with advanced filtering, sorting, pagination, and a rule-based natural language search endpoint.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Deployment**: Railway / Heroku / any Node.js host

---

## Getting Started

### 1. Clone and install

```bash
git clone <your-repo-url>
cd insighta-api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set your DATABASE_URL
```

`.env` format:
```
DATABASE_URL=postgresql://user:password@host:5432/insighta_db
PORT=3000
NODE_ENV=production
```

### 3. Seed the database

Download `profiles.json` from the provided Google Drive link, then run:

```bash
# Option A: Seed from local file (recommended)
node scripts/seed.js --file ./profiles.json

# Option B: Attempt auto-download from Google Drive
node scripts/seed.js
```

The seed script is **idempotent** — re-running it will not create duplicates. It uses `INSERT ... ON CONFLICT (name) DO NOTHING`.

### 4. Start the server

```bash
npm start        # production
npm run dev      # development (nodemon)
```

---

## API Endpoints

### `GET /api/profiles`

Returns paginated, filtered, and sorted profiles.

**Query Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `gender` | `male` \| `female` | Filter by gender |
| `age_group` | `child` \| `teenager` \| `adult` \| `senior` | Filter by age group |
| `country_id` | `string (2 chars)` | ISO 3166-1 alpha-2 code (e.g. `NG`, `KE`) |
| `min_age` | `integer` | Minimum age (inclusive) |
| `max_age` | `integer` | Maximum age (inclusive) |
| `min_gender_probability` | `float 0–1` | Minimum gender confidence score |
| `min_country_probability` | `float 0–1` | Minimum country confidence score |
| `sort_by` | `age` \| `created_at` \| `gender_probability` | Sort field (default: `created_at`) |
| `order` | `asc` \| `desc` | Sort direction (default: `asc`) |
| `page` | `integer` | Page number (default: `1`) |
| `limit` | `integer (max 50)` | Results per page (default: `10`) |

**Example:**
```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

**Success Response (200):**
```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 312,
  "data": [
    {
      "id": "b3f9c1e2-7d4a-7c91-9c2a-1f0a8e5b6d12",
      "name": "emmanuel",
      "gender": "male",
      "gender_probability": 0.99,
      "age": 34,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.85,
      "created_at": "2026-04-01T12:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/profiles/search?q=<query>`

Parses a plain English query into filters and returns matching profiles.

**Query Parameters:**

| Parameter | Description |
|---|---|
| `q` | Plain English query string (required) |
| `page` | Page number (default: `1`) |
| `limit` | Results per page (default: `10`, max: `50`) |

**Example:**
```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=adult females above 30 in kenya&page=2&limit=20
```

**Error Response (uninterpretable query):**
```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

---

## Natural Language Parsing — Approach & Design

### Overview

The `/api/profiles/search` endpoint uses **rule-based parsing only** — no AI, no LLMs, no external services. The parser converts a plain English string into a structured filter object using regex pattern matching.

The parser operates in this order:
1. Normalize the query to lowercase
2. Extract gender signals
3. Extract semantic age descriptors ("young", "elderly")
4. Extract stored age group keywords
5. Extract explicit numeric age bounds
6. Extract country references
7. If nothing matched → return `null` → respond with `"Unable to interpret query"`

---

### Gender Keywords

| Input keywords | Resolves to |
|---|---|
| `male`, `males`, `men`, `boys`, `boy` | `gender=male` |
| `female`, `females`, `women`, `girls`, `girl`, `ladies`, `lady` | `gender=female` |
| `male and female`, `both`, `all genders` | No gender filter (returns all) |

---

### Age Descriptors (Semantic — not stored groups)

These map to age range filters and are **not** stored `age_group` values:

| Input | Resolves to |
|---|---|
| `young` | `min_age=16` + `max_age=24` |
| `old`, `elderly` | `min_age=60` |
| `middle-aged`, `middle aged` | `min_age=35` + `max_age=59` |

---

### Stored Age Groups

These map directly to the `age_group` database field:

| Input keywords | Resolves to |
|---|---|
| `child`, `children`, `kids`, `kid` | `age_group=child` |
| `teenager`, `teen`, `teens`, `adolescent` | `age_group=teenager` |
| `adult`, `adults` | `age_group=adult` |
| `senior`, `seniors` | `age_group=senior` |

> Note: `elderly` also maps to `age_group=senior` and `min_age=60`.

---

### Explicit Age Bounds

| Input pattern | Resolves to |
|---|---|
| `above 30`, `over 30`, `older than 30`, `at least 30` | `min_age=30` |
| `below 50`, `under 50`, `younger than 50`, `less than 50` | `max_age=50` |
| `between 20 and 40`, `aged 20 to 40` | `min_age=20` + `max_age=40` |
| `25 years old` | `min_age=25` + `max_age=25` |

---

### Country Keywords

The parser supports:

1. **Country names** — over 80 countries supported including full African continent, major European, American, and Asian nations.
2. **Adjectives/demonyms** — e.g., `nigerian` → `NG`, `kenyan` → `KE`, `ghanaian` → `GH`
3. **ISO 2-letter codes** — e.g., `from NG`, `in AO`
4. **Prepositions** — `from`, `in`, `of` are all recognized

Examples:
```
"from nigeria"     → country_id=NG
"in angola"        → country_id=AO
"from KE"          → country_id=KE
"kenyan adults"    → age_group=adult + country_id=KE
```

Multi-word country names are matched first (longest-match wins):
- `south africa` matches before `africa`
- `south sudan` matches before `sudan`

---

### Combined Query Examples

| Natural language query | Parsed filters |
|---|---|
| `young males from nigeria` | `gender=male`, `min_age=16`, `max_age=24`, `country_id=NG` |
| `females above 30` | `gender=female`, `min_age=30` |
| `people from angola` | `country_id=AO` |
| `adult males from kenya` | `gender=male`, `age_group=adult`, `country_id=KE` |
| `male and female teenagers above 17` | `age_group=teenager`, `min_age=17` |
| `senior women in ghana` | `gender=female`, `age_group=senior`, `country_id=GH` |
| `children below 10` | `age_group=child`, `max_age=10` |
| `men between 25 and 40` | `gender=male`, `min_age=25`, `max_age=40` |
| `elderly nigerians` | `min_age=60`, `country_id=NG` |

---

## Parser Limitations

The following are known edge cases and gaps in the parser:

### 1. No semantic understanding
The parser uses regex, not semantics. It won't understand paraphrases like:
- `"people who are not teenagers"` (negation not supported)
- `"working-age adults"` (custom descriptors not supported)
- `"people in their 30s"` (decade-based ranges not supported)

### 2. "Young" is not an `age_group`
`young` maps to `min_age=16, max_age=24` for parsing purposes only. It is **not** stored in the database as an age group. Querying `age_group=young` on `GET /api/profiles` will return a 422 error.

### 3. Limited country coverage
While 80+ countries are covered, some smaller nations or territories may not be in the map. ISO codes must be exactly 2 letters. Partial country names (e.g., `"nig"` for Nigeria) are not matched.

### 4. No typo correction
`"niggeria"` or `"femalle"` will not be matched. The parser requires correct spelling.

### 5. Conflicting age filters
If a query contains both `young` (max_age=24) and `above 30` (min_age=30), both filters are applied, resulting in an impossible range that returns 0 results. The parser does not detect contradictions.

### 6. No OR logic
Queries like `"males or females from nigeria"` are not parsed as OR conditions. The parser always produces AND-combined filters.

### 7. Context-ambiguous words
`"old"` maps to `min_age=60`, but `"old enough"` or `"old records"` would incorrectly trigger this filter.

### 8. No support for multiple countries
`"people from nigeria or ghana"` is not supported. Only the first country match is used.

### 9. Singular vs plural edge cases
Most singular/plural forms are covered, but unusual forms (e.g., `"ladys"`) may not match.

---

## Database Schema

```sql
CREATE TABLE profiles (
  id                  VARCHAR(36)   PRIMARY KEY,        -- UUID v7
  name                VARCHAR(255)  NOT NULL UNIQUE,
  gender              VARCHAR(10)   NOT NULL,            -- "male" or "female"
  gender_probability  FLOAT         NOT NULL,
  age                 INT           NOT NULL,
  age_group           VARCHAR(20)   NOT NULL,            -- child|teenager|adult|senior
  country_id          VARCHAR(2)    NOT NULL,            -- ISO 3166-1 alpha-2
  country_name        VARCHAR(255)  NOT NULL,
  country_probability FLOAT         NOT NULL,
  created_at          TIMESTAMP     NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
```

Indexes exist on: `gender`, `age_group`, `country_id`, `age`, `created_at`, `gender_probability`, `country_probability`, and a composite `(gender, country_id)`.

---

## Error Responses

All errors follow this structure:
```json
{ "status": "error", "message": "<description>" }
```

| HTTP Code | Meaning |
|---|---|
| `400` | Missing or empty required parameter |
| `404` | Profile not found |
| `422` | Invalid parameter type or value |
| `500` | Internal server error |

---

## Deployment Notes

- Set `DATABASE_URL` as an environment variable on your host
- The server auto-initializes the schema on startup (safe for cold starts)
- Run the seed script once after first deployment: `node scripts/seed.js --file ./profiles.json`
- `Access-Control-Allow-Origin: *` is set on all responses

---

## License

MIT