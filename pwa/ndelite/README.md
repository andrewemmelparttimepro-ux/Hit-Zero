# ND Elite White-Label Site

Static preview path:

```text
/ndelite/
```

This site mirrors the MCA public-site intake contract while using North Dakota Elite branding and public program content.

## Hit Zero Activation

The frontend submits to `public-intake-v1` with:

```json
{
  "kind": "lead",
  "program_slug": "ndelite",
  "source": "public_website",
  "parent_name": "...",
  "parent_email": "...",
  "parent_phone": "...",
  "athlete_name": "...",
  "athlete_age": 8,
  "interest": "Cheerleading",
  "preferred_contact": "email",
  "consent_to_text": false,
  "referrer_url": "...",
  "utm_source": "...",
  "utm_campaign": "...",
  "metadata": {
    "white_label_site": "ndelite",
    "current_site_url": "https://ndelite.com",
    "site_section": "ndelite_interest_form"
  }
}
```

Before this goes live, create or publish the Hit Zero `programs` row with `slug = 'ndelite'`, `is_public = true`, and `is_accepting_leads = true`. Public payment checkout should remain off until ND Elite has a validated program-owned payment connection.

## Source Content Used

- Main site: `https://ndelite.com`
- Cheerleading: `https://ndelite.com/cheerleading/`
- Tumbling: `https://ndelite.com/tumbling/`
- Programs: `https://ndelite.com/programs/`
- Private lessons: `https://ndelite.com/private-lessons/`
- Public event feed: `https://ndelite.com/wp-json/tribe/events/v1/events`
