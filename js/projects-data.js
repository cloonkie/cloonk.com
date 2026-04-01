const R2 = 'https://pub-9c199549e11948eb8b255ae7436c1cb5.r2.dev/portfolio/assests/pdf/';

window.PROJECTS = [
  {
    id: 'peleton-ad-campaign',
    num: '01',
    affiliation: 'FIT',
    title: 'Peleton Ad Campaign',
    short: 'Peleton Ad Campaign',
    topic: 'marketing',
    type: 'Copy Writing',
    year: '2023',
    img: 'd8d224_a709b5ff95df43fcb52bb577cdd4ecb9~mv2.png',
    desc: 'A concept-driven campaign exploring how movement is positioned as identity rather than activity. Focused on tightening brand voice, aligning messaging with audience psychology, and creating a cohesive narrative across print and digital placements.',
    media: [
      { type: 'image', src: 'd8d224_a709b5ff95df43fcb52bb577cdd4ecb9~mv2.png', caption: 'Campaign cover' },
    ],
  },

  {
    id: 'kenzo-product-elements',
    num: '02',
    affiliation: 'FIT',
    title: 'Kenzo Product Elements',
    short: 'In-Store Product Element Analysis',
    topic: 'fashion',
    type: 'Analysis',
    year: '2022',
    img: 'd8d224_156355c38f1f4ba6a05d7a48269cad3b~mv2.png',
    desc: 'A breakdown of how physical retail communicates brand identity through product placement, materiality, and spatial hierarchy. Evaluates how each in-store element contributes to perception, conversion, and brand consistency.',
    media: [
      { type: 'image', src: 'd8d224_156355c38f1f4ba6a05d7a48269cad3b~mv2.png', caption: 'Product element analysis' },
    ],
  },

  {
    id: 'fashion-freedom',
    num: '03',
    affiliation: 'FIT',
    title: 'Fashion=Freedom',
    short: 'Expression-themed Macro-trend Forecast',
    topic: 'trend',
    type: 'Forecast',
    year: '2021',
    img: 'd8d224_75bb282c899c41159e337c6533d5e3dd~mv2.png',
    desc: 'A macro-trend analysis identifying self-expression as a dominant cultural driver. Tracks how identity-driven consumption reshapes product design, brand positioning, and market segmentation.',
    media: [
      { type: 'image', src: 'd8d224_75bb282c899c41159e337c6533d5e3dd~mv2.png', caption: 'Trend forecast cover' },
    ],
  },

  {
    id: 'tiffany-store-plan',
    num: '04',
    affiliation: 'FIT',
    title: "Tiffany and Co's Store Plan",
    short: 'Tiffany and Co Merchandising Store Plan',
    topic: 'fashion',
    type: 'Merchandising',
    year: '2022',
    img: 'd8d224_736e460068b542e2b44cdf22f412a487~mv2.png',
    desc: 'A full retail strategy translating brand positioning into physical space. Covers layout optimization, product adjacency logic, and fixture planning to drive both traffic flow and conversion efficiency.',
    media: [
      { type: 'image', src: 'd8d224_8a4b2aff6f9f4cd8b5c0d90488bd6487~mv2.jpg', caption: 'Store plan — slide 1' },
    ],
  },

  {
    id: 'tiffany-ar',
    num: '05',
    affiliation: 'FIT',
    title: "Tiffany and Co's AR",
    short: "Tiffany's Digital Campaign Media Analysis",
    topic: 'marketing',
    type: 'Analysis',
    year: '2022',
    img: 'd8d224_14a347dab54840fa9dc310971c782632~mv2.png',
    desc: 'An evaluation of AR as a retail extension channel. Assesses how digital interaction layers reinforce brand storytelling while increasing engagement beyond physical touchpoints.',
    media: [
      { type: 'image', src: 'd8d224_14a347dab54840fa9dc310971c782632~mv2.png', caption: 'AR campaign overview' },
    ],
  },

  {
    id: 'tiffany-lock-campaign',
    num: '06',
    affiliation: 'FIT',
    title: "Tiffany's Lock Campaign",
    short: 'Tiffany and Co Lock Campaign Analysis',
    topic: 'marketing',
    type: 'Analysis',
    year: '2023',
    img: 'd8d224_d2459f98e2ce45e79e887c0161db3947~mv2.png',
    desc: 'A campaign-level analysis of how symbolic product storytelling scales across media. Focuses on influencer alignment, cultural positioning, and narrative consistency.',
    media: [
      { type: 'image', src: 'd8d224_d2459f98e2ce45e79e887c0161db3947~mv2.png', caption: 'Lock campaign analysis' },
    ],
  },

  // ─────────────────────────────
  // PRATT PROJECTS (UPDATED TONE)
  // ─────────────────────────────

  {
    id: 'poseidon-user-testing',
    num: '19',
    affiliation: 'Pratt Institute',
    title: 'Poseidon Project',
    short: 'User Testing & UX Evaluation',
    topic: 'ux research',
    type: 'User Research',
    year: '2024',
    img: R2 + 'poseidon.png',
    desc: 'A usability evaluation identifying where a research platform breaks down in real use. Focused on navigation clarity, accessibility gaps, and how effectively users can locate and interpret critical content.',
    context: {
      problem: 'Users could not reliably navigate or extract information from a content-heavy research platform, limiting its impact.'
    },
    approach: {
      summary: 'Ran moderated usability tests with defined tasks, tracking breakdown points across navigation, labeling, and comprehension.'
    },
    results: {
      before: ['Users struggled to locate key content', 'Navigation labeling unclear', 'Accessibility gaps present'],
      after: ['Clear friction points identified', 'Navigation improvements defined', 'Accessibility issues prioritized']
    },
    takeaways: [{
      title: 'Clarity drives usability',
      body: 'If users hesitate, the system is already failing.'
    }],
    media: [
      { type: 'pdf', src: R2 + 'poseidon.pdf', caption: 'User Testing Report' },
    ],
  },

  {
    id: 'eyewear-sales-analysis',
    num: '23',
    affiliation: 'Pratt Institute',
    title: 'Eyewear Sales Analysis',
    short: 'Retail Data Insights',
    topic: 'data analysis',
    type: 'Analytics',
    year: '2025',
    img: R2 + 'eyewear.png',
    desc: 'A structured analysis transforming raw retail data into decision-ready insights. Focused on isolating how pricing, promotions, and product attributes impact sell-through and revenue performance.',
    context: {
      problem: 'Sales performance drivers were unclear due to fragmented, unstructured data.'
    },
    approach: {
      summary: 'Standardized and analyzed 100K+ rows of sales data, enabling consistent comparisons across accounts, brands, and price tiers.'
    },
    results: {
      before: ['Inconsistent reporting structures', 'No clear performance drivers', 'Manual analysis required'],
      after: ['Clean, structured dataset', 'Key drivers identified', 'Repeatable analysis framework created']
    },
    takeaways: [{
      title: 'Structure enables insight',
      body: 'Without clean data, analysis is guesswork.'
    }],
    media: [
      { type: 'pdf', src: R2 + 'eyewear.pdf', caption: 'Analysis Presentation' },
    ],
  }
];