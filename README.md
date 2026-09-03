# AnimeFinds

A small anime recommendation site. Search for a show you already like to get
similar titles, or filter by genre, theme, demographic, release year and
episode count to browse for something new. All anime data comes from the
public [AniList GraphQL API](https://anilist.co/graphiql) — nothing is
scraped or stored locally.

Live at [animefinds.com](https://animefinds.com).

## Features

- **Find similar shows** — search-as-you-type autocomplete, then pulls
  AniList's community-submitted "if you liked this" recommendations for
  the selected title.
- **Browse by filter** — narrow results by genre, theme, demographic,
  release year, and episode count.
- **Feedback form** — a simple way for visitors to leave tips or bug
  reports, protected against spam with Cloudflare Turnstile and delivered
  via Formspree.
- No backend, no build step, no accounts or stored user data — just static
  HTML/CSS/JS hosted on GitHub Pages.

## Tech stack

- Vanilla HTML, CSS, and JavaScript
- [AniList GraphQL API](https://anilist.co/graphiql) for anime data
- [Formspree](https://formspree.io) + [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) for the feedback form
- Hosted on GitHub Pages

## Setup

Two things need your own keys before the site is fully functional:

### 1. Formspree (feedback form delivery)

1. Create a free account at [formspree.io](https://formspree.io) and add a new form.
2. Copy the form endpoint it gives you (looks like `https://formspree.io/f/xxxxxxxx`).
3. In `js/feedback.js`, replace `FORMSPREE_ENDPOINT`'s placeholder value with that endpoint.
4. Leave CAPTCHA protection off for now — you'll enable it and select Cloudflare Turnstile in step 2 below.

### 2. Cloudflare Turnstile

1. Create a widget at the [Turnstile dashboard](https://dash.cloudflare.com/?to=/:account/turnstile), choosing the **Managed** widget mode (recommended default).
2. Add `animefinds.com` (and `localhost` if you want to test locally) under allowed domains.
3. Copy the **Site key** and paste it into `data-sitekey="..."` on the `<div class="cf-turnstile">` in `about.html`.
4. Copy the **Secret key** — in your Formspree form's settings, under the CAPTCHA section, enable protection, select **Cloudflare Turnstile**, and paste the secret key there. Formspree handles verifying the token server-side from that point on.

## File structure

```
index.html        Landing page — recommender (similar shows / filter search)
about.html         Project description + feedback form
css/style.css       All styling
js/anilist.js       AniList API queries (search, recommendations, filtering)
js/search.js         Landing page interactivity
js/feedback.js       Feedback form submission (Formspree)
```

## How it works

- **Find similar shows** uses AniList's `recommendations` field on a title —
  community-submitted "if you liked this, you'll like that" data. No custom
  similarity logic needed.
- **Browse by filter** queries AniList's `Page.media` with genre/year/episode
  filters server-side, then applies a strict client-side AND filter for
  multi-select genres, themes, and demographic (AniList's `genre_in` matches
  ANY listed genre, not all — see comments in `js/anilist.js`).
- "Theme" and "demographic" (Shounen/Shoujo/Seinen/Josei) aren't first-class
  fields on AniList — they're tags, matched via each title's `tags` list.
- AniList rate-limits requests per IP. Since all requests happen client-side
  from each visitor's browser, this should be a non-issue at personal-site
  traffic levels, but if the site ever gets a big traffic spike, expect some
  `429` responses (the UI already shows a friendly message for that case).
