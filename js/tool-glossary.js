/* tool-glossary.js
 * Lowercase, whitespace-normalized keys.
 * Chips without a matching entry render without a tooltip.
 */
window.TOOL_GLOSSARY = {
  /* ---------- UNDL toolset ---------- */
  "pandas": "Python library for cleaning, joining, and reshaping tabular data. Used here to filter Matomo's session exports and rebuild the IDP user funnel.",
  "tobii pro eye tracking": "Hardware and software that captures gaze position, fixation duration, and saccade paths during a user's task attempt.",
  "retrospective think-aloud": "Post-session method where participants narrate their reasoning while watching a replay of their own attempt. Surfaces intent that real-time think-aloud often interrupts.",
  "think-aloud protocol": "Method where participants verbalize their thoughts in real time while completing a task. Captures decision-making as it happens.",
  "sus scoring": "System Usability Scale — a 10-item standardized questionnaire that produces a 0–100 score, allowing usability to be compared across products.",
  "seq task evaluation": "Single Ease Question — a 1–7 rating asked immediately after each task to capture perceived difficulty in the moment.",
  "matomo analytics": "Open-source web analytics platform (the UNDL's tracking layer). Used here to reconstruct session-level user paths after filtering 82.5% bot traffic.",
  "comparative benchmarking": "Evaluating a product's metrics against scores from peer products in the same category — turns a raw number into a defensible position.",
  "competitive benchmarking": "Evaluating a product's performance against named direct competitors across a defined set of metrics.",
  "survey design": "Designing question structure, branching logic, and response scales to elicit reliable user responses at scale.",
  "stakeholder presentation": "Translating research findings into a delivery format scoped to the audience and their decision authority.",

  /* ---------- Design ---------- */
  "figma": "Collaborative interface design tool. Used for mockups, prototypes, design system work, and live collaboration with stakeholders.",
  "miro": "Online whiteboarding tool used for affinity mapping, journey diagrams, and clustering qualitative findings into themes.",
  "illustrator": "Vector graphics editor (Adobe). Used for poster work, iconography, and final-asset typesetting.",
  "notion": "Workspace tool for structured notes, research databases, and project documentation.",

  /* ---------- Data & analysis ---------- */
  "r": "Statistical computing language. Strong for spatial analysis, statistical modeling, and reproducible data visualization.",
  "ggplot2": "R's grammar-of-graphics plotting library. Builds visualizations by layering data, aesthetics, and geometries.",
  "tidyverse": "A collection of R packages (dplyr, tidyr, readr, ggplot2, etc.) that share a consistent data-frame-oriented API.",
  "python": "General-purpose programming language widely used for data work, scripting, and ML workflows.",
  "sql": "Query language for relational databases. Used for joins, aggregations, and pulling structured data out of warehouses.",
  "duckdb": "In-process analytical database optimized for querying large columnar data files (Parquet, CSV) without a server.",
  "excel": "Spreadsheet tool. Used here for quick pivots, manual data inspection, and stakeholder-facing summaries.",
  "beautifulsoup (html extraction analysis)": "Python library for parsing HTML and extracting structured data from web pages.",
  "data cleaning": "Filtering noise, normalizing inconsistent values, and reshaping raw data into a structure that supports defensible analysis.",
  "exploratory analysis": "Open-ended interrogation of a dataset to surface patterns, distributions, and hypotheses worth testing.",
  "trend analysis": "Tracking how a metric or signal changes over time to identify direction, inflection points, and momentum.",
  "search trend analysis": "Using search-query volume data to identify rising interest, seasonality, and shifting consumer language.",

  /* ---------- Spatial / geo ---------- */
  "mapbox gl js": "JavaScript library for rendering interactive vector-tile maps in the browser.",
  "spatial analysis": "Analyzing data where location is a primary variable — proximity, clustering, coverage, and overlay.",
  "geojson": "Open standard for encoding geographic features (points, lines, polygons) as JSON.",
  "h3 hexagonal grid": "Uber's open-source spatial indexing system that tiles the globe in hexagons at multiple resolutions.",
  "tippecanoe": "Tool that builds vector tilesets from large GeoJSON datasets for efficient web mapping.",
  "foursquare os places": "Open-source places dataset with point-of-interest data — names, categories, coordinates.",
  "valhalla routing engine": "Open-source routing engine for driving, walking, biking, and transit directions on OpenStreetMap data.",
  "nyc open data": "NYC's public data portal hosting municipal datasets — tree census, 311, MTA, ACS-derived demographics, etc.",
  "census acs": "American Community Survey — the Census Bureau's ongoing demographic and economic survey at sub-tract granularity.",
  "cloudflare r2": "S3-compatible object storage with no egress fees. Used here for hosting image and PDF assets.",

  /* ---------- SEO & web analytics ---------- */
  "ga4": "Google Analytics 4 — Google's event-based analytics platform that replaced Universal Analytics.",
  "google search console": "Google's tool for monitoring how a site performs in search results — impressions, clicks, indexing, errors.",
  "screaming frog": "Desktop crawler that scans a site's structure, surfacing broken links, redirects, metadata gaps, and indexing issues.",
  "semrush": "SEO and competitive-research platform covering keyword data, backlink profiles, and rankings.",
  "technical seo": "The infrastructure side of SEO — crawlability, indexation, site speed, structured data, and rendering.",
  "structured data evaluation": "Auditing a site's schema.org / JSON-LD markup against what search engines expect for rich results.",

  /* ---------- UX research methods ---------- */
  "card sorting": "Method where participants group concepts to reveal their mental model of how content should be organized.",
  "tree testing": "Method for evaluating how findable items are within a proposed information hierarchy, without the visual interface.",
  "heuristic evaluation": "Expert review of an interface against established usability principles (commonly Nielsen's 10 heuristics).",
  "nielsen's 10 usability heuristics": "Jakob Nielsen's foundational set of interface evaluation principles — visibility of system status, error prevention, etc.",
  "usability testing": "Observing real users attempting real tasks on a product to surface what works and what breaks.",
  "moderated usability testing": "Usability testing where a researcher is present to ask probing questions and adapt the session in real time.",
  "task-based evaluation": "Scoring an interface against participants' ability to complete defined real-world tasks.",
  "semi-structured interviews": "Interview format with prepared questions but flexibility to follow unexpected threads.",
  "severity rating framework": "A scheme for classifying usability issues by how much they affect users — frequency, impact, persistence.",
  "severity rating": "A scheme for classifying usability issues by how much they affect users — frequency, impact, persistence.",
  "optimal workshop": "Suite of remote UX research tools — card sorts, tree tests, first-click tests, surveys.",
  "wcag 2.1+": "Web Content Accessibility Guidelines version 2.1 and later — the W3C standard for accessible web content.",
  "aria": "Accessible Rich Internet Applications — W3C spec for adding semantics to dynamic UI for assistive technology.",
  "screen reader testing — nvda, voiceover, jaws": "Manually testing an interface with the three major screen readers across Windows and Mac.",

  /* ---------- Strategy / brand / consumer ---------- */
  "brand positioning": "Defining a brand's place in the consumer's mind relative to competitors — what it stands for and against.",
  "luxury brand positioning": "Brand positioning specific to the luxury segment, where scarcity, heritage, and craftsmanship signal value.",
  "competitive analysis": "Structured comparison of competitors' offerings, pricing, positioning, and market posture.",
  "competitive category analysis": "Mapping the competitive landscape of an entire product category, not just a single competitor set.",
  "consumer segmentation": "Dividing a market into groups with distinct needs, behaviors, or characteristics.",
  "consumer behavior research": "Studying how and why consumers make purchase decisions — motivations, triggers, barriers.",
  "consumer behavior analysis": "Analyzing patterns in actual consumer behavior data to identify decision drivers.",
  "consumer psychology": "Applying psychological theory to understand how consumers perceive, evaluate, and choose.",
  "consumer research": "Primary research with consumers — interviews, surveys, observation — to surface needs and behaviors.",
  "copywriting": "Writing the actual words of an interface, ad, or campaign — voice, clarity, and persuasion in tight space.",
  "campaign analysis": "Evaluating a marketing campaign's performance across reach, engagement, conversion, and brand metrics.",
  "campaign strategy": "Defining a campaign's objective, audience, channels, messaging, and success criteria upfront.",
  "supply chain research": "Investigating sourcing, manufacturing, and distribution to assess feasibility, cost, and risk.",
  "zoom": "Video conferencing platform. Used here for remote moderated sessions and stakeholder interviews.",

  /* ---------- Database / engineering ---------- */
  "database design": "Designing the schema, relationships, and indexes of a database for a specific use case.",
  "erd modeling": "Entity-Relationship Diagrams — visual modeling of entities, attributes, and the relationships between them.",
  "normalization": "Structuring a database to eliminate redundancy and preserve referential integrity (1NF, 2NF, 3NF, BCNF).",
  "referential integrity": "The database constraint that foreign keys must reference existing primary keys — no orphan rows.",
  "query optimization": "Restructuring SQL or schema to reduce execution time — indexes, joins, query plans.",

  /* ---------- Methods (general) ---------- */
  "iterative prototyping": "Building, testing, and refining prototypes in successive cycles, with user feedback driving each iteration.",
  "literature review": "Structured survey of existing published work on a topic to ground new research in prior findings.",
  "academic sources": "Peer-reviewed papers, books, and institutional reports used to ground analysis in established work."
};
