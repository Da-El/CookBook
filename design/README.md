# Grok Cookbook — UI Design Prototype (v2)

Light-first **kitchen journal** mockups (not an X/Instagram clone). Optional dark mode via the moon/sun control.

## Open

Open any HTML file in a browser from this folder:

| Screen | File |
|--------|------|
| Home feed | `index.html` |
| Sign in | `auth.html` |
| Sign up | `auth-signup.html` |
| Kitchen / profile | `Grok Cookbook.html` |
| Log meal | `add-meal.html` |
| Add ingredient | `add-ingredient.html` |
| Settings | `settings.html` |

Shared: `styles.css`, `theme.js`

## Design system

| Token | Light | Dark |
|-------|-------|------|
| Canvas | Warm cream `#f3efe6` | Deep brown-black |
| Surface | Paper white `#fffcf7` | Elevated brown |
| Accent | Terracotta `#c45c26` | Soft clay |
| Secondary | Sage green | Soft sage |
| Display type | Palatino / Georgia (serif) | same |
| Body | System sans | same |

### Layout (airtight rules)

- **Top bar** + **centered column** (~720px) + optional right rail — not a Twitter-style left icon rail
- Avatars: fixed `width/height`, `overflow: hidden`, initials in inner `<span>`, `place-items: center`
- All text rows: `min-width: 0` + ellipsis where needed
- Cards never use absolute-positioned text that can escape circles
- Theme: `data-theme="light"|"dark"` on `<html>`, persisted in `localStorage`

### Identity (vs social clones)

- Editorial Grok Cookbook feel: cream paper, terracotta, serif titles
- Language: “kitchen”, “log meal”, “Today’s table” — not “tweet” / “post”
- Actions: Note / Saved / Cook this — not repost / like / share spam
- Segmented controls and recipe “plates” instead of infinite timeline chrome

## Theme toggle

Click the moon (or Settings → Theme). Preference saves as `grok-cookbook-theme`.
