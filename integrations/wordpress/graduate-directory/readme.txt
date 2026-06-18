=== The Directory — Graduate Directory ===
Requires at least: 6.4
Requires PHP: 8.1
Stable tag: 0.1.0
License: MIT

Surface your school's certified graduates from The Directory (headless SaaS)
inside WordPress — server-side rendered for SEO, with schema.org JSON-LD so AI
agents can read your practitioners too.

== Installation ==
1. Copy this `graduate-directory` folder into wp-content/plugins/ (or zip + upload).
2. Activate the plugin.
3. Settings → Graduate Directory: set the API base URL, your school slug, and the
   read-only API key issued by The Directory.
4. Add the "Graduate Directory" block, or use the [graduate_directory] shortcode.

== How it works ==
This is the WordPress adapter over The Directory's one integration contract
(REST + JSON-LD). The same contract powers the universal Web Component embed and
(designed) Drupal / Webflow adapters. Calls are server-side and cached ~5 minutes.

== Shortcode ==
[graduate_directory]                          — all published graduates
[graduate_directory modality="holotropic"]    — filter by modality slug
[graduate_directory online="1"]               — online-capable only
[graduate_directory q="anxiety"]              — semantic query
