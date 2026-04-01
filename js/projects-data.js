/* projects-data.js — single source of truth for all project data
 *
 * Each project can have a `media` array for the detail page showcase.
 * Each media item: { type: 'image' | 'pdf', src: 'filename or URL', caption: '...' }
 *
 * For Wix images:   src is just the slug, e.g. 'd8d224_abc~mv2.jpg'
 *                   (the CDN prefix is added automatically in projects-grid.js)
 * For R2 files:     src is a full URL (starts with https://)
 *                   (used as-is, no prefix applied)
 * For local files:  src is a relative path, e.g. 'assets/projects/tiffany-store-plan.pdf'
 *
 * Images show as full-width posters.
 * PDFs embed inline with a download button fallback.
 */

const R2 = 'https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/';

window.PROJECTS = [
  {
    id: 'peleton-ad-campaign',
    num: '01',
    title: 'Peleton Ad Campaign',
    short: 'Peleton Ad Campaign',
    topic: 'marketing',
    type: 'Copy Writing',
    year: '2023',
    img: 'd8d224_a709b5ff95df43fcb52bb577cdd4ecb9~mv2.png',
    desc: 'A concept ad campaign for Peleton exploring the emotional language of movement, motivation, and identity. The work focused on copywriting and visual direction for a series of print and digital ads.',
    media: [
      { type: 'image', src: 'd8d224_a709b5ff95df43fcb52bb577cdd4ecb9~mv2.png', caption: 'Campaign cover' },
    ],
  },
  {
    id: 'kenzo-product-elements',
    num: '02',
    title: 'Kenzo Product Elements',
    short: 'In-Store Product Element Analysis',
    topic: 'fashion',
    type: 'Analysis',
    year: '2022',
    img: 'd8d224_156355c38f1f4ba6a05d7a48269cad3b~mv2.png',
    desc: 'An in-depth analysis of Kenzo\'s in-store product elements, examining how physical merchandising communicates brand identity. Covered visual merchandising strategy, product placement, and sensory brand cues.',
    media: [
      { type: 'image', src: 'd8d224_156355c38f1f4ba6a05d7a48269cad3b~mv2.png', caption: 'Product element analysis' },
    ],
  },
  {
    id: 'fashion-freedom',
    num: '03',
    title: 'Fashion=Freedom',
    short: 'Expression-themed Macro-trend Forecast',
    topic: 'trend',
    type: 'Forecast',
    year: '2021',
    img: 'd8d224_75bb282c899c41159e337c6533d5e3dd~mv2.png',
    desc: 'A macro-trend forecast centered on self-expression as a cultural force shaping fashion. Traced the movement from streetwear and subculture to runway, forecasting how personal identity and individuality would define the season.',
    media: [
      { type: 'image', src: 'd8d224_75bb282c899c41159e337c6533d5e3dd~mv2.png', caption: 'Trend forecast cover' },
    ],
  },
  {
    id: 'tiffany-store-plan',
    num: '04',
    title: "Tiffany and Co's Store Plan",
    short: 'Tiffany and Co Merchandising Store Plan',
    topic: 'fashion',
    type: 'Merchandising',
    year: '2022',
    img: 'd8d224_736e460068b542e2b44cdf22f412a487~mv2.png',
    desc: 'A full merchandising store plan for Tiffany & Co., developed as a term project. Included floor layout, fixture placement, product adjacencies, lighting considerations, and a seasonal assortment strategy aligned with brand positioning.',
    media: [
      { type: 'image', src: 'd8d224_8a4b2aff6f9f4cd8b5c0d90488bd6487~mv2.jpg', caption: 'Store plan — slide 1' },
      { type: 'image', src: 'd8d224_93742ae478b54b9ab3833763e41613ca~mv2.jpg', caption: 'Floor layout' },
      { type: 'image', src: 'd8d224_05b899a4bd344df3a1ae82c0a393480c~mv2.jpg', caption: 'Fixture plan' },
      { type: 'image', src: 'd8d224_fa6ab1e1ce254b20a468a18b8d8169fc~mv2.jpg', caption: 'Product adjacency map' },
      { type: 'image', src: 'd8d224_181aeb0e01764e54bc69b69294fd130c~mv2.jpg', caption: 'Seasonal assortment' },
    ],
  },
  {
    id: 'tiffany-ar',
    num: '05',
    title: "Tiffany and Co's AR",
    short: "Tiffany's Digital Campaign Media Analysis",
    topic: 'marketing',
    type: 'Analysis',
    year: '2022',
    img: 'd8d224_14a347dab54840fa9dc310971c782632~mv2.png',
    desc: 'An analysis of Tiffany & Co.\'s augmented reality digital campaign, examining how the brand leveraged AR technology to extend retail experience beyond physical stores. Assessed engagement strategy, platform selection, and brand consistency.',
    media: [
      { type: 'image', src: 'd8d224_14a347dab54840fa9dc310971c782632~mv2.png', caption: 'AR campaign overview' },
    ],
  },
  {
    id: 'tiffany-lock-campaign',
    num: '06',
    title: "Tiffany's Lock Campaign",
    short: 'Tiffany and Co Lock Campaign Analysis',
    topic: 'marketing',
    type: 'Analysis',
    year: '2023',
    img: 'd8d224_d2459f98e2ce45e79e887c0161db3947~mv2.png',
    desc: 'A deep-dive analysis of Tiffany\'s Lock collection campaign — one of the brand\'s most high-profile recent launches. Examined brand storytelling, influencer strategy, media channel mix, and the cultural resonance of the lock motif.',
    media: [
      { type: 'image', src: 'd8d224_d2459f98e2ce45e79e887c0161db3947~mv2.png', caption: 'Lock campaign analysis' },
    ],
  },
  {
    id: 'uniqlo-assortment-refresh',
    num: '07',
    title: 'UNIQLO Assortment Refresh',
    short: 'Uniqlo Assortment Refresh Proposals',
    topic: 'fashion',
    type: 'Merchandising',
    year: '2022',
    img: 'd8d224_4a2341b3da9449cc9c528e8d93f57546~mv2.png',
    desc: 'A merchandising proposal to refresh UNIQLO\'s assortment strategy for a target demographic shift. Included competitive analysis, product gap identification, capsule proposals, and a revised assortment architecture.',
    media: [
      { type: 'image', src: 'd8d224_4a2341b3da9449cc9c528e8d93f57546~mv2.png', caption: 'Assortment refresh overview' },
    ],
  },
  {
    id: 'smiski-campaign',
    num: '08',
    title: 'SMISKI Campaign',
    short: 'SMISKI Ad Campaign',
    topic: 'marketing',
    type: 'Copy Writing',
    year: '2023',
    img: 'd8d224_173663d6c04e44b2866239fc8a2c2927~mv2.png',
    desc: 'An ad campaign concept for SMISKI, the Japanese collectible toy brand. Developed copy and creative direction for a series of ads leaning into the brand\'s mysterious, glow-in-the-dark aesthetic and its devoted collector community.',
    media: [
      { type: 'image', src: 'd8d224_be8813b4aae549d3b26ad6ec9b8c5361~mv2.jpg', caption: 'Ad 1' },
      { type: 'image', src: 'd8d224_e16a26d44bb240cc879efa909dd596bc~mv2.jpg', caption: 'Ad 2' },
    ],
  },
  {
    id: 'sos-save-our-society',
    num: '09',
    title: 'SOS — Save Our Society',
    short: 'Sustainability Macro-trend Forecast',
    topic: 'trend',
    type: 'Forecast',
    year: '2021',
    img: 'd8d224_053fecf62c96440d9cf999857c982855~mv2.png',
    desc: 'A sustainability-focused macro-trend forecast examining how environmental consciousness was reshaping fashion from supply chain to consumer behavior. Traced emerging material innovation, slow fashion movements, and brand transparency demands.',
    media: [
      { type: 'image', src: 'd8d224_053fecf62c96440d9cf999857c982855~mv2.png', caption: 'Sustainability forecast cover' },
    ],
  },
  {
    id: 'race-to-space',
    num: '10',
    title: 'Race To Space',
    short: 'Color-focused Micro-trend Forecast',
    topic: 'trend',
    type: 'Forecast',
    year: '2021',
    img: 'd8d224_a018aa724b5c42c596bec974f9efb555~mv2.png',
    desc: 'A color-focused micro-trend forecast inspired by the cultural fascination with space exploration. Traced how galactic palettes — deep navy, metallic silver, electric violet — were filtering from NASA aesthetics into fashion and interiors.',
    media: [
      { type: 'image', src: 'd8d224_a018aa724b5c42c596bec974f9efb555~mv2.png', caption: 'Color forecast cover' },
    ],
  },
  {
    id: 'pvh-corporation',
    num: '11',
    title: 'PVH Corporation',
    short: 'Fashion Corporation Analysis',
    topic: 'fashion',
    type: 'Analysis',
    year: '2021',
    img: 'd8d224_a1b431caeea04199bd9930e7f2aac1d6~mv2.png',
    desc: 'A comprehensive analysis of PVH Corp — the parent company of Calvin Klein and Tommy Hilfiger. Covered financial performance, brand portfolio strategy, global retail footprint, and sustainability commitments.',
    media: [
      { type: 'image', src: 'd8d224_a1b431caeea04199bd9930e7f2aac1d6~mv2.png', caption: 'PVH analysis cover' },
    ],
  },
  {
    id: 'cl-kpop-eye-candy',
    num: '12',
    title: "CL — Kpop's Eye Candy",
    short: 'Influencer Analysis on Korean Celebrity CL',
    topic: 'fashion',
    type: 'Analysis',
    year: '2021',
    img: 'd8d224_3a26e6c619214cb1a9c63eb30e098541~mv2.png',
    desc: 'An influencer and fashion analysis of CL, the Korean pop star. Examined how her personal style, brand partnerships, and cultural positioning made her a defining figure at the intersection of K-pop and global streetwear.',
    media: [
      { type: 'image', src: 'd8d224_3a26e6c619214cb1a9c63eb30e098541~mv2.png', caption: 'CL analysis cover' },
    ],
  },
  {
    id: 'textile-dyes',
    num: '13',
    title: 'Textile Dyes',
    short: 'Environmental Impact on Textile Dyes',
    topic: 'fashion',
    type: 'Research',
    year: '2021',
    img: 'd8d224_af0b3e171edc42629405911af4fe6b5c~mv2.png',
    desc: 'A research paper investigating the environmental impact of synthetic textile dyes — one of the fashion industry\'s most polluting processes. Covered wastewater contamination, regulatory frameworks, and emerging bio-dye alternatives.',
    media: [
      { type: 'image', src: 'd8d224_af0b3e171edc42629405911af4fe6b5c~mv2.png', caption: 'Research cover' },
    ],
  },
  {
    id: 'knit-wear',
    num: '14',
    title: 'Knit&Wear',
    short: 'Knit-Focused Fashion Forecast',
    topic: 'trend',
    type: 'Forecast',
    year: '2021',
    img: 'd8d224_dec90d769a4647ec932de2601c47ebc3~mv2.png',
    desc: 'A fashion forecast focused on knitwear as a macro cultural signal — tracing the rise of artisanal knit, chunky textures, and crochet across runway and street. Included color direction, silhouette forecasting, and retail opportunity mapping.',
    media: [
      { type: 'image', src: 'd8d224_dec90d769a4647ec932de2601c47ebc3~mv2.png', caption: 'Knitwear forecast cover' },
    ],
  },
  {
    id: 'kensie-merchandising',
    num: '15',
    title: 'Kensie Merchandising',
    short: 'Kensie Store Assortment Renewal Proposal',
    topic: 'fashion',
    type: 'Merchandising',
    year: '2022',
    img: 'd8d224_1332514481f547d2a1924070620e0cca~mv2.png',
    desc: 'An assortment renewal proposal for Kensie, identifying opportunities to modernize the brand\'s product mix and in-store presentation. Included customer persona analysis, competitive landscape review, and a phased assortment rebuilding strategy.',
    media: [
      { type: 'image', src: 'd8d224_1332514481f547d2a1924070620e0cca~mv2.png', caption: 'Kensie proposal cover' },
    ],
  },
  {
    id: 'mccormick-mixology',
    num: '16',
    title: 'McCormick Mixology',
    short: 'McCormick Mixology Diffusion Line Concept',
    topic: 'marketing',
    type: 'Proposal',
    year: '2023',
    img: 'd8d224_5853048f59724fee872d333d1001f963~mv2.png',
    desc: 'A brand extension proposal for McCormick — pitching a cocktail mixology diffusion line targeting the home bartender market. Developed the concept, brand identity, product range, packaging direction, and go-to-market strategy.',
    media: [
      { type: 'image', src: 'd8d224_bbb00f9ad9504275a5b4b9ecbb6a8953~mv2.jpg', caption: 'Proposal — page 1' },
      { type: 'image', src: 'd8d224_30918106361c4488b62bcb012f119f2c~mv2.jpg', caption: 'Brand concept' },
      { type: 'image', src: 'd8d224_b64bf2aad5e64f6495d24f17b06bf223~mv2.jpg', caption: 'Product range' },
      { type: 'image', src: 'd8d224_d593e020f12c4b7eba3f94877103205c~mv2.jpg', caption: 'Packaging direction' },
    ],
  },
  {
    id: 'work-pod-proposal',
    num: '17',
    title: 'Work Pod Proposal',
    short: 'Work Pod 3-D Spatial Design',
    topic: 'design',
    type: 'Proposal',
    year: '2023',
    img: 'd8d224_4ed2de895673404da72ee25801aa738e~mv2.png',
    desc: 'A spatial design concept for a modular, freestanding work pod — addressing the need for focused individual work within open-plan offices. Developed through 3D modeling with attention to acoustic properties, ergonomics, and material palette.',
    media: [
      { type: 'image', src: 'd8d224_4ed2de895673404da72ee25801aa738e~mv2.png', caption: 'Work pod render' },
    ],
  },
  {
    id: 'heinz-brand-loyalty',
    num: '18',
    title: 'Heinz Brand Loyalty',
    short: 'Heinz Brand Loyalty Assessment',
    topic: 'marketing',
    type: 'Proposal',
    year: '2023',
    img: 'd8d224_e858f08eed994b09aab99718c9eed435~mv2.png',
    desc: 'A brand loyalty assessment for Heinz examining the psychological and cultural drivers behind one of the world\'s most loyal consumer followings. Included loyalty framework analysis, NPS benchmarking, and strategic recommendations for maintaining brand devotion in a shifting market.',
    media: [
      { type: 'image', src: 'd8d224_e858f08eed994b09aab99718c9eed435~mv2.png', caption: 'Brand loyalty report cover' },
    ],
  },

  /* ── Pratt / Professional Projects (2024–2025) ── */

  {
    id: 'poseidon-user-testing',
    num: '19',
    title: 'Poseidon Project',
    short: 'User Testing & UX Evaluation',
    topic: 'ux research',
    type: 'User Research',
    year: '2024',
    img: R2 + 'poseidon.png',
    desc: 'A usability evaluation of the Poseidon Project platform, focused on improving accessibility, navigation clarity, and content discoverability.',
    context: {
      problem: 'A newly launched environmental research platform struggled with usability, limiting its ability to effectively communicate complex content to both experts and general audiences.'
    },
    approach: { summary: 'Conducted moderated usability testing with task-based scenarios, analyzing navigation flow, accessibility, and content comprehension across user groups.' },
    results: { before: ['Unclear navigation labeling', 'Low content discoverability', 'Accessibility barriers for general audiences'], after: ['Prioritized friction-point fixes delivered', 'Clearer labeling recommendations documented', 'Accessibility improvements scoped and ranked'] },
    takeaways: [{ title: 'Usability is a growth lever', body: 'Early clarity and accessibility investments directly impact adoption and trust.' }],
    pdf: R2 + 'poseidon.pdf',
    media: [
      { type: 'pdf', src: R2 + 'poseidon.pdf', caption: 'User Testing Report' },
    ],
  },

  {
    id: 'nyc-tourism-midterm',
    num: '20',
    title: 'NYC Tourism IA Study',
    short: 'Business Owner Research',
    topic: 'ux research',
    type: 'UX Research',
    year: '2024',
    img: R2 + 'nyc-midterm.png',
    desc: 'A research-driven information architecture study analyzing how NYC business owners interact with NYCTourism.com.',
    context: {
      problem: 'Business participation pathways were unclear, limiting engagement on a platform serving both tourists and local businesses.'
    },
    approach: { summary: 'Conducted interviews, card sorting, and tree testing to evaluate user mental models and navigation expectations.' },
    results: { before: ['Structural inconsistencies across navigation', 'Business pathways buried or mislabeled', 'Mental model misalignment with site structure'], after: ['Revised IA aligned with user expectations', 'Improved discoverability of business participation', 'Documented findings for redesign phase'] },
    takeaways: [{ title: 'IA must reflect user mental models', body: 'Not internal assumptions — structure should be derived from how users actually think.' }],
    pdf: R2 + 'nyc-midterm.pdf',
    media: [
      { type: 'pdf', src: R2 + 'nyc-midterm.pdf', caption: 'Midterm Presentation' },
    ],
  },

  {
    id: 'nyc-tourism-final',
    num: '21',
    title: 'NYC Tourism Redesign',
    short: 'IA & UX Solution',
    topic: 'ux research',
    type: 'UX Design',
    year: '2024',
    img: R2 + 'nyc-final.png',
    desc: 'A refined IA solution translating user research into high-fidelity design improvements for NYCTourism.com.',
    context: {
      problem: 'The platform required a scalable structure to support both tourists and business owners without compromising usability.'
    },
    approach: { summary: 'Developed low- and high-fidelity wireframes, validated through usability testing and iterative refinement.' },
    results: { before: ['Fragmented user flows for business owners', 'Overlapping tourist and business content', 'No clear engagement pathway'], after: ['Improved navigation and content hierarchy', 'Clearer user flows for both audiences', 'Stronger engagement pathways for business users'] },
    takeaways: [{ title: 'Insights only create value when executed', body: 'Research findings must translate into tangible, testable design solutions.' }],
    pdf: R2 + 'nyc-final.pdf',
    media: [
      { type: 'pdf', src: R2 + 'nyc-final.pdf', caption: 'Final Presentation' },
    ],
  },

  {
    id: 'amon-carter-analytics',
    num: '22',
    title: 'Amon Carter Museum',
    short: 'Digital Analytics Strategy',
    topic: 'analytics',
    type: 'Data Strategy',
    year: '2025',
    img: R2 + 'amon.png',
    desc: 'A full-scale digital analytics and SEO strategy to improve visibility and audience growth for the Amon Carter Museum of American Art.',
    context: {
      problem: 'Low organic visibility and limited engagement with younger and non-local audiences.'
    },
    approach: { summary: 'Performed SEO, web performance, and social media audits using GA4 and external tools.' },
    results: { before: ['Low search rankings for core content', 'Limited reach beyond local audience', 'Underutilized analytics infrastructure'], after: ['Prioritized roadmap for search improvement', 'Expanded reach strategy documented', 'Engagement optimization recommendations delivered'] },
    takeaways: [{ title: 'Analytics must drive decisions', body: 'Data only matters when it translates into clear, actionable next steps.' }],
    pdf: R2 + 'amon.pdf',
    media: [
      { type: 'pdf', src: R2 + 'amon.pdf', caption: 'Digital Strategy Deck' },
    ],
  },

  {
    id: 'eyewear-sales-analysis',
    num: '23',
    title: 'Eyewear Sales Analysis',
    short: 'Retail Data Insights',
    topic: 'data analysis',
    type: 'Analytics',
    year: '2025',
    img: R2 + 'eyewear.png',
    desc: 'A large-scale analysis identifying key drivers of eyewear sales performance across price tiers, promotions, and product attributes.',
    context: {
      problem: 'Retail decisions lacked clarity on the impact of pricing, promotions, and product attributes on sales performance.'
    },
    approach: { summary: 'Cleaned and analyzed 100K+ rows of sales data, applying statistical modeling to identify predictive factors.' },
    results: { before: ['Merchandising decisions made without data support', 'Unclear relationship between pricing and performance', 'Promotions applied without ROI measurement'], after: ['Pricing and promotion impact quantified', 'Predictive factors identified for key SKUs', 'Data-driven merchandising decisions enabled'] },
    takeaways: [{ title: 'Data quality is foundational', body: 'Meaningful insights require clean, trustworthy data as the starting point.' }],
    pdf: R2 + 'eyewear.pdf',
    media: [
      { type: 'pdf', src: R2 + 'eyewear.pdf', caption: 'Analysis Presentation' },
    ],
  },

  {
    id: 'data-viz-literacy',
    num: '24',
    title: 'Data Visualization Literacy',
    short: 'Research Paper',
    topic: 'research',
    type: 'Academic',
    year: '2024',
    img: R2 + 'dvl.png',
    desc: 'A research study on the importance of data visualization literacy in a data-driven world.',
    context: {
      problem: 'Users lack the critical skills to interpret and evaluate visual data effectively, creating risks of misinterpretation and misinformation.'
    },
    approach: { summary: 'Analyzed frameworks, tools, and educational gaps in data and visualization literacy across academic and industry contexts.' },
    results: { before: ['Widespread visualization misinterpretation documented', 'Educational gap in data literacy curricula', 'Limited frameworks for evaluating visual claims'], after: ['Literacy challenges mapped and categorized', 'Strategies proposed to reduce misinterpretation risk', 'Framework for improving visualization education outlined'] },
    takeaways: [{ title: 'Visualization without literacy misleads', body: 'Charts communicate — but only accurately when the reader has the tools to evaluate them.' }],
    pdf: R2 + 'dvl.pdf',
    media: [
      { type: 'pdf', src: R2 + 'dvl.pdf', caption: 'Research Paper' },
    ],
  },

  {
    id: 'jif-site-audit',
    num: '25',
    title: 'JIF.com Audit',
    short: 'SEO & Site Analysis',
    topic: 'seo',
    type: 'Audit',
    year: '2025',
    img: R2 + 'jif.png',
    desc: 'An SEO and site architecture audit identifying performance gaps and optimization opportunities for JIF.com.',
    context: {
      problem: 'Technical SEO issues and inefficient site structure limited organic growth despite strong brand presence.'
    },
    approach: { summary: 'Evaluated crawlability, backlinks, site structure, and keyword performance using industry tools.' },
    results: { before: ['Critical crawlability issues unaddressed', 'Weak backlink profile relative to brand authority', 'Keyword targeting misaligned with search intent'], after: ['Critical SEO issues identified and prioritized', 'Backlink and authority opportunities scoped', 'Actionable recommendations to improve traffic delivered'] },
    takeaways: [{ title: 'Technical infrastructure drives SEO', body: 'Brand strength alone cannot compensate for underlying technical SEO deficiencies.' }],
    pdf: R2 + 'jif.pdf',
    media: [
      { type: 'pdf', src: R2 + 'jif.pdf', caption: 'Site Audit Report' },
    ],
  },
];