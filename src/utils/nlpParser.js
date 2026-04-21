const COUNTRY_MAP = {
  nigeria: 'NG',
  nigerian: 'NG',
  niger: 'NE',
  ghana: 'GH',
  ghanaian: 'GH',
  senegal: 'SN',
  senegalese: 'SN',
  mali: 'ML',
  malian: 'ML',
  'ivory coast': 'CI',
  'cote divoire': 'CI',
  "cote d'ivoire": 'CI',
  benin: 'BJ',
  beninese: 'BJ',
  togo: 'TG',
  togolese: 'TG',
  'burkina faso': 'BF',
  'sierra leone': 'SL',
  liberia: 'LR',
  liberian: 'LR',
  guinea: 'GN',
  'guinea-bissau': 'GW',
  gambia: 'GM',
  mauritania: 'MR',
  'cape verde': 'CV',
  'cabo verde': 'CV',

  kenya: 'KE',
  kenyan: 'KE',
  ethiopia: 'ET',
  ethiopian: 'ET',
  tanzania: 'TZ',
  tanzanian: 'TZ',
  uganda: 'UG',
  ugandan: 'UG',
  rwanda: 'RW',
  rwandan: 'RW',
  burundi: 'BI',
  somalia: 'SO',
  somali: 'SO',
  djibouti: 'DJ',
  eritrea: 'ER',
  sudan: 'SD',
  'south sudan': 'SS',

  'south africa': 'ZA',
  zambia: 'ZM',
  zambian: 'ZM',
  zimbabwe: 'ZW',
  zimbabwean: 'ZW',
  mozambique: 'MZ',
  botswana: 'BW',
  namibia: 'NA',
  namibian: 'NA',
  malawi: 'MW',
  lesotho: 'LS',
  swaziland: 'SZ',
  eswatini: 'SZ',
  madagascar: 'MG',
  angola: 'AO',
  angolan: 'AO',

  cameroon: 'CM',
  cameroonian: 'CM',
  'democratic republic of congo': 'CD',
  'dr congo': 'CD',
  drc: 'CD',
  congo: 'CG',
  chad: 'TD',
  'central african republic': 'CF',
  gabon: 'GA',
  'equatorial guinea': 'GQ',

  egypt: 'EG',
  egyptian: 'EG',
  morocco: 'MA',
  moroccan: 'MA',
  algeria: 'DZ',
  algerian: 'DZ',
  tunisia: 'TN',
  tunisian: 'TN',
  libya: 'LY',
  libyan: 'LY',

  'united kingdom': 'GB',
  uk: 'GB',
  'great britain': 'GB',
  england: 'GB',
  france: 'FR',
  french: 'FR',
  germany: 'DE',
  german: 'DE',
  italy: 'IT',
  italian: 'IT',
  spain: 'ES',
  spanish: 'ES',
  portugal: 'PT',
  portuguese: 'PT',
  netherlands: 'NL',
  dutch: 'NL',
  belgium: 'BE',
  belgian: 'BE',
  sweden: 'SE',
  sweden: 'SE',
  norway: 'NO',
  danish: 'DK',
  denmark: 'DK',
  poland: 'PL',
  russian: 'RU',
  russia: 'RU',

  'united states': 'US',
  usa: 'US',
  america: 'US',
  american: 'US',
  canada: 'CA',
  canadian: 'CA',
  brazil: 'BR',
  brazilian: 'BR',
  mexico: 'MX',
  mexican: 'MX',
  argentina: 'AR',
  argentinian: 'AR',
  colombia: 'CO',
  colombian: 'CO',
  peru: 'PE',
  peruvian: 'PE',
  chile: 'CL',
  chilean: 'CL',

  china: 'CN',
  chinese: 'CN',
  india: 'IN',
  indian: 'IN',
  japan: 'JP',
  japanese: 'JP',
  'south korea': 'KR',
  korean: 'KR',
  indonesia: 'ID',
  indonesian: 'ID',
  pakistan: 'PK',
  pakistani: 'PK',
  bangladesh: 'BD',
  bangladeshi: 'BD',
  philippines: 'PH',
  filipino: 'PH',
  vietnam: 'VN',
  thai: 'TH',
  thailand: 'TH',
  turkey: 'TR',
  turkish: 'TR',
  'saudi arabia': 'SA',
  saudi: 'SA',
  'united arab emirates': 'AE',
  uae: 'AE',

  australia: 'AU',
  australian: 'AU',
  'new zealand': 'NZ',
};

const VALID_ISO_CODES = new Set(Object.values(COUNTRY_MAP));

/**
 * Parse a plain English query into filter params.
 * Returns null if the query cannot be interpreted.
 *
 * @param {string} query
 * @returns {{ gender?, min_age?, max_age?, age_group?, country_id? } | null}
 */
function parseNaturalLanguageQuery(query) {
  if (!query || typeof query !== 'string') return null;

  const q = query.toLowerCase().trim();
  if (!q) return null;

  const filters = {};
  let matched = false;

  if (/\b(males?|men|boys?)\b/.test(q)) {
    filters.gender = 'male';
    matched = true;
  } else if (/\b(females?|women|girls?|ladies|lady)\b/.test(q)) {
    filters.gender = 'female';
    matched = true;
  }
  if (/\b(male and female|female and male|both genders?|all genders?)\b/.test(q)) {
    delete filters.gender;
  }

  if (/\byoung\b/.test(q)) {
    filters.min_age = 16;
    filters.max_age = 24;
    matched = true;
  }

  if (/\b(old|elderly|aged)\b/.test(q)) {
    filters.min_age = 60;
    matched = true;
  }

  if (/\bmiddle.aged\b/.test(q)) {
    filters.min_age = 35;
    filters.max_age = 59;
    matched = true;
  }

  if (/\b(children|child|kids?)\b/.test(q)) {
    filters.age_group = 'child';
    matched = true;
  } else if (/\b(teenagers?|teens?|adolescents?)\b/.test(q)) {
    filters.age_group = 'teenager';
    matched = true;
  } else if (/\badults?\b/.test(q)) {
    filters.age_group = 'adult';
    matched = true;
  } else if (/\b(seniors?|elderly)\b/.test(q)) {
    filters.age_group = 'senior';
    matched = true;
  }

  const aboveMatch = q.match(/\b(?:above|over|older than|at least)\s+(\d+)\b/);
  if (aboveMatch) {
    filters.min_age = parseInt(aboveMatch[1], 10);
    matched = true;
  }

  const belowMatch = q.match(/\b(?:below|under|younger than|less than)\s+(\d+)\b/);
  if (belowMatch) {
    filters.max_age = parseInt(belowMatch[1], 10);
    matched = true;
  }

  const betweenMatch = q.match(/\b(?:between|aged?)\s+(\d+)\s+(?:and|to|-)\s+(\d+)\b/);
  if (betweenMatch) {
    filters.min_age = parseInt(betweenMatch[1], 10);
    filters.max_age = parseInt(betweenMatch[2], 10);
    matched = true;
  }

  const exactAgeMatch = q.match(/\b(\d+)\s+years?\s+old\b/);
  if (exactAgeMatch) {
    const age = parseInt(exactAgeMatch[1], 10);
    filters.min_age = age;
    filters.max_age = age;
    matched = true;
  }

  const isoMatch = q.match(/\b(?:from|in|of)\s+([A-Z]{2})\b/i);
  if (isoMatch) {
    const code = isoMatch[1].toUpperCase();
    if (VALID_ISO_CODES.has(code)) {
      filters.country_id = code;
      matched = true;
    }
  }

  if (!filters.country_id) {
    const countryKeys = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
    for (const key of countryKeys) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(?:(?:from|in|of)\\s+${escapedKey}|\\b${escapedKey}\\b)`,
        'i'
      );
      if (pattern.test(q)) {
        filters.country_id = COUNTRY_MAP[key];
        matched = true;
        break;
      }
    }
  }

  if (!matched) return null;

  return filters;
}

module.exports = { parseNaturalLanguageQuery };