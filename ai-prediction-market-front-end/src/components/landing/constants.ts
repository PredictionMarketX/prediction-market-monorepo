// Landing page configuration constants

// Shared UI style constants - used across components for consistency
export const UI_STYLES = {
  // Card styles
  card: {
    base: 'bg-gray-900/50 rounded-2xl border border-purple-900/30',
    hover: 'transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/50',
    gradient: 'bg-gradient-to-br from-purple-900/10 to-transparent',
    padding: {
      sm: 'p-5',
      md: 'p-6',
    },
  },
  // Status badge colors for markets
  statusColors: {
    active: 'bg-green-500/20 text-green-400',
    resolved: 'bg-gray-800 text-gray-200',
    paused: 'bg-yellow-500/20 text-yellow-400',
  },
  // Button variants
  button: {
    primary: 'bg-purple-600 hover:bg-purple-700',
    outline: 'border-gray-700 text-white hover:bg-gray-800',
  },
  // Skeleton loading
  skeleton: {
    base: 'bg-gray-700/50 animate-pulse',
    rounded: 'rounded',
    roundedFull: 'rounded-full',
  },
} as const;

// Helper to get status color class
export function getStatusColorClass(status: string): string {
  const statusKey = status.toLowerCase() as keyof typeof UI_STYLES.statusColors;
  return UI_STYLES.statusColors[statusKey] || UI_STYLES.statusColors.active;
}

// Helper to build card class string
export function buildCardClasses(options?: { hover?: boolean; padding?: 'sm' | 'md' }): string {
  const { hover = true, padding = 'md' } = options || {};
  const classes: string[] = [UI_STYLES.card.base, UI_STYLES.card.padding[padding]];
  if (hover) classes.push(UI_STYLES.card.hover);
  return classes.join(' ');
}

export const LANDING_CONFIG = {
  // Brand
  brand: {
    name: "PloyMarket",
    tagline: "Decentralized Prediction Markets on Solana",
  },

  // Hero section
  hero: {
    badge: "AI-Powered Market Generation",
    title: {
      line1: "Trade the Future",
      highlight1: "Smarter",
      highlight2: "Faster",
      line2: "with AI",
    },
    description:
      "PloyMarket is a decentralized prediction market platform on Solana that uses AI to create and resolve markets.",
    primaryCta: "Explore Markets",
    secondaryCta: "Propose a Market",
  },

  // Features
  features: [
    {
      id: "solana",
      title: "Solana Speed",
      description: "Experience lightning-fast trades and ultra-low fees, powered by the Solana blockchain.",
      iconType: "solana" as const,
    },
    {
      id: "ai",
      title: "AI-Powered",
      description: "Our advanced AI creates, manages, and resolves markets, ensuring fairness and efficiency.",
      iconType: "ai" as const,
    },
    {
      id: "liquidity",
      title: "Deep Liquidity",
      description: "Trade with confidence thanks to our robust liquidity pools and automated market makers.",
      iconType: "liquidity" as const,
    },
  ],

  // Stats
  stats: [
    {
      id: "volume",
      value: "1.2M+",
      label: "Total Volume",
      iconType: "volume" as const,
    },
    {
      id: "traders",
      value: "500+",
      label: "Active Traders",
      iconType: "users" as const,
    },
    {
      id: "markets",
      value: "100+",
      label: "Active Markets",
      iconType: "markets" as const,
    },
    {
      id: "uptime",
      value: "99.9%",
      label: "Uptime",
      iconType: "uptime" as const,
    },
  ],

  // CTA section
  cta: {
    title: "Join the Future of Prediction Markets",
    description:
      "Connect your wallet and start trading on a wide range of markets, or propose your own.",
    primaryButton: "Get Started",
    secondaryButton: "Learn More",
  },

  // Footer
  footer: {
    sections: {
      platform: [
        { label: "Markets", href: "/markets" },
        { label: "Propose", href: "/propose" },
        { label: "Portfolio", href: "/portfolio" },
      ],
      support: [
        { label: "Documentation", href: "#" },
        { label: "Help Center", href: "#" },
        { label: "Contact", href: "#" },
      ],
    },
    social: {
      twitter: "https://twitter.com",
      discord: "https://discord.com",
      github: "https://github.com",
    },
  },
} as const;

// Navigation configuration
export const NAV_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/propose", label: "Propose" },
  { href: "/portfolio", label: "Portfolio" },
] as const;

// Animation background configuration
export const ANIMATION_CONFIG = {
  // Colors
  colors: {
    background: "rgb(3, 7, 18)",
    purple: {
      solid: "rgba(167, 139, 250,",
      base: "rgba(139, 92, 246,",
    },
    blue: {
      solid: "rgba(96, 165, 250,",
      base: "rgba(59, 130, 246,",
    },
    green: {
      solid: "rgba(52, 211, 153,",
    },
  },

  // Neural network
  neuralNetwork: {
    layers: [4, 6, 8, 6, 4],
    neuronSpacing: 60,
    connectionOpacity: 0.2,
    activationChangeRate: 0.02,
  },

  // Floating nodes
  nodes: {
    count: 50,
    speed: 0.3,
    connectionDistance: 100,
    mouseInteractionDistance: 150,
    mouseRepulsionForce: 25,
  },

  // Binary streams
  binaryStreams: {
    count: 15,
    charsPerStream: 30,
    opacity: { min: 0.15, max: 0.4 },
    speed: { min: 0.15, max: 0.55 },
    fontSize: 12,
  },

  // Circuit paths
  circuits: {
    count: 6,
    segmentLength: { min: 40, max: 120 },
    yVariation: 80,
    opacity: 0.15,
    pulseSpeed: { min: 0.003, max: 0.011 },
  },

  // Grid
  grid: {
    size: 80,
    opacity: 0.05,
  },

  // Data packets
  packets: {
    spawnInterval: 0.3,
    speed: { min: 0.025, max: 0.045 },
    trailOpacity: 0.6,
  },

  // Thinking rings
  thinkingRings: {
    spawnProbability: 0.04,
    maxRadius: { min: 25, max: 40 },
    expandSpeed: 0.6,
    initialOpacity: 0.25,
  },

  // Mouse effects
  mouse: {
    glowRadius: 60,
    glowOpacity: 0.08,
    connectionBoost: 1.5,
    extendedConnectionDistance: 160,
  },

  // Scan line
  scanLine: {
    speed: 40,
    opacity: 0.06,
  },

  // Vignette
  vignette: {
    innerRadius: 0.5,
    opacity: 0.3,
  },

  // Circuit path boundaries
  circuitBoundary: {
    yPadding: 50, // Padding from top/bottom canvas edges
  },

  // Binary stream positioning
  binaryStream: {
    heightOffset: 150, // Offset for stream wrapping calculation
    startOffset: 50, // Start position offset
  },

  // Node glow effects
  nodeGlow: {
    mouseProximity: 120, // Distance for glow effect
    multiplierBoost: 1.5, // Glow intensity multiplier
  },

  // Connection distance adjustment
  connectionAdjustment: {
    mouseDistanceOffset: 40, // Offset from extended connection distance
  },
} as const;