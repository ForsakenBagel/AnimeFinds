/**
 * anilist.js
 * Thin wrapper around AniList's public GraphQL API.
 * No auth required for these read-only queries. AniList enforces a
 * per-IP rate limit, so callers should debounce/throttle requests
 * (see the debounce() helper below, used by the autocomplete field).
 */

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

async function anilistQuery(query, variables) {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429) {
    throw new Error("RATE_LIMITED");
  }

  // AniList returns a JSON body with details even on a non-200 response,
  // so read it before deciding how to fail — that detail is far more
  // useful than a bare status code when something like a bad filter
  // combination gets rejected server-side.
  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = json && json.errors && json.errors[0] ? json.errors[0].message : null;
    console.error("AniList request failed:", res.status, detail, { query, variables });
    throw new Error(detail || `AniList returned an error (HTTP ${res.status}).`);
  }
  if (json && json.errors && json.errors.length) {
    console.error("AniList GraphQL error:", json.errors[0].message, { query, variables });
    throw new Error(json.errors[0].message || "GRAPHQL_ERROR");
  }
  return json.data;
}

/** Debounce helper: delays fn until `wait` ms after the last call. */
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Pick the best display title available for a media object. */
function displayTitle(media) {
  if (!media || !media.title) return "Untitled";
  return media.title.english || media.title.romaji || "Untitled";
}

const SEARCH_TITLES_QUERY = `
  query ($search: String) {
    Page(perPage: 8) {
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title { romaji english }
        coverImage { medium }
        seasonYear
      }
    }
  }
`;

const RECOMMENDATIONS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english }
      recommendations(sort: RATING_DESC, perPage: 16) {
        nodes {
          mediaRecommendation {
            id
            title { romaji english }
            coverImage { large }
            averageScore
            genres
            episodes
            seasonYear
            format
            siteUrl
            tags { name }
          }
        }
      }
    }
  }
`;

/**
 * Filter search. genre_in on AniList's API is an OR match (any listed
 * genre), so we ask for a superset server-side using the first genre
 * (if any) to narrow the candidate pool, then apply a strict client-side
 * AND filter for every selected genre, theme tag and demographic tag.
 * This keeps the query simple while still giving correct AND semantics.
 */
const FILTER_MEDIA_QUERY = `
  query (
    $genre: String
    $year: Int
    $epGreater: Int
    $epLesser: Int
  ) {
    Page(page: 1, perPage: 50) {
      media(
        type: ANIME
        genre: $genre
        seasonYear: $year
        episodes_greater: $epGreater
        episodes_lesser: $epLesser
        sort: POPULARITY_DESC
      ) {
        id
        title { romaji english }
        coverImage { large }
        averageScore
        genres
        episodes
        seasonYear
        format
        siteUrl
        tags { name }
      }
    }
  }
`;

/**
 * Removes null/undefined entries from an object. Used so that unset,
 * optional filters (e.g. episode bounds the person left blank) are left
 * out of the GraphQL variables entirely, rather than sent as an explicit
 * null — the standard, safest way to represent "no filter" for an
 * optional GraphQL argument.
 */
function withoutNulls(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== undefined));
}

async function searchTitles(searchTerm) {
  const data = await anilistQuery(SEARCH_TITLES_QUERY, { search: searchTerm });
  return data.Page.media;
}

async function fetchRecommendations(mediaId) {
  const data = await anilistQuery(RECOMMENDATIONS_QUERY, { id: mediaId });
  const nodes = data.Media.recommendations.nodes
    .map((n) => n.mediaRecommendation)
    .filter(Boolean);
  return { sourceTitle: displayTitle(data.Media), results: nodes };
}

async function fetchFilteredMedia({ genres, themes, demographic, year, epMin, epMax }) {
  const variables = {
    genre: genres && genres.length ? genres[0] : null,
    year: year || null,
    epGreater: epMin ? epMin - 1 : null,
    epLesser: epMax ? epMax + 1 : null,
  };
  const data = await anilistQuery(FILTER_MEDIA_QUERY, withoutNulls(variables));
  let results = data.Page.media;

  // Strict AND across all selected genres.
  if (genres && genres.length) {
    results = results.filter((m) => genres.every((g) => m.genres.includes(g)));
  }

  // Theme + demographic both live in AniList's tag system.
  const requiredTags = [...(themes || [])];
  if (demographic) requiredTags.push(demographic);
  if (requiredTags.length) {
    results = results.filter((m) => {
      const tagNames = (m.tags || []).map((t) => t.name);
      return requiredTags.every((t) => tagNames.includes(t));
    });
  }

  return results;
}
