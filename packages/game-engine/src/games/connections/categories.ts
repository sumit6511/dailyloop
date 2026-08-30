export interface ConnectionsCategory {
  title: string;
  /** 1 = easiest (yellow) ... 4 = trickiest (purple), matching the classic Connections palette. */
  difficulty: 1 | 2 | 3 | 4;
  words: [string, string, string, string];
}

// Authored in fixed groups of 4 — each group is one day's puzzle, so within-group word
// uniqueness is guaranteed by construction. Words MAY repeat across different groups.
// 12 groups (48 categories) means ~12 days pass before the rotation repeats a puzzle.
export const CATEGORY_BANK: ConnectionsCategory[] = [
  // Day 1
  { title: "Programming Languages", difficulty: 1, words: ["PYTHON", "JAVA", "RUBY", "GO"] },
  { title: "Car Brands", difficulty: 2, words: ["TESLA", "HONDA", "MAZDA", "LEXUS"] },
  { title: "Fruits", difficulty: 1, words: ["KIWI", "MANGO", "APPLE", "LEMON"] },
  { title: "Chess Pieces", difficulty: 2, words: ["KING", "QUEEN", "ROOK", "PAWN"] },
  // Day 2
  { title: "___ Board", difficulty: 3, words: ["KEY", "SURF", "CARD", "WHITE"] },
  { title: "Ocean Creatures", difficulty: 1, words: ["SHARK", "WHALE", "OCTOPUS", "DOLPHIN"] },
  { title: "Shades of Red", difficulty: 2, words: ["SCARLET", "CRIMSON", "AMBER", "JADE"] },
  { title: "Musical Instruments", difficulty: 1, words: ["PIANO", "VIOLIN", "DRUM", "FLUTE"] },
  // Day 3
  { title: "Planets", difficulty: 1, words: ["MARS", "VENUS", "EARTH", "SATURN"] },
  { title: "Types of Bread", difficulty: 2, words: ["BAGUETTE", "RYE", "SOURDOUGH", "CIABATTA"] },
  { title: "Card Games", difficulty: 2, words: ["POKER", "BRIDGE", "RUMMY", "HEARTS"] },
  { title: "Big Cats", difficulty: 1, words: ["LION", "TIGER", "JAGUAR", "LEOPARD"] },
  // Day 4
  { title: "Greek Letters", difficulty: 1, words: ["ALPHA", "BETA", "GAMMA", "DELTA"] },
  { title: "Kitchen Appliances", difficulty: 1, words: ["BLENDER", "TOASTER", "KETTLE", "OVEN"] },
  { title: "Types of Dance", difficulty: 2, words: ["TANGO", "SALSA", "WALTZ", "BALLET"] },
  { title: "Weather Phenomena", difficulty: 2, words: ["THUNDER", "LIGHTNING", "HURRICANE", "BLIZZARD"] },
  // Day 5
  { title: "Board Games", difficulty: 1, words: ["MONOPOLY", "CLUE", "RISK", "SCRABBLE"] },
  { title: "Herbs & Spices", difficulty: 2, words: ["BASIL", "THYME", "CUMIN", "PAPRIKA"] },
  { title: "Types of Boats", difficulty: 2, words: ["CANOE", "YACHT", "KAYAK", "FERRY"] },
  { title: "Currencies", difficulty: 3, words: ["PESO", "YEN", "EURO", "RUPEE"] },
  // Day 6
  { title: "Constellations", difficulty: 3, words: ["ORION", "LYRA", "DRACO", "PHOENIX"] },
  { title: "Pasta Shapes", difficulty: 2, words: ["PENNE", "FUSILLI", "RIGATONI", "LINGUINE"] },
  { title: "Superheroes", difficulty: 1, words: ["BATMAN", "SUPERMAN", "FLASH", "THOR"] },
  { title: "Types of Hats", difficulty: 2, words: ["FEDORA", "BERET", "BEANIE", "TURBAN"] },
  // Day 7
  { title: "Martial Arts", difficulty: 2, words: ["KARATE", "JUDO", "TAEKWONDO", "AIKIDO"] },
  { title: "Gemstones", difficulty: 1, words: ["RUBY", "EMERALD", "SAPPHIRE", "TOPAZ"] },
  { title: "Desserts", difficulty: 2, words: ["TIRAMISU", "MOUSSE", "SORBET", "TRIFLE"] },
  { title: "Dog Breeds", difficulty: 1, words: ["POODLE", "HUSKY", "BEAGLE", "CORGI"] },
  // Day 8
  { title: "European Capitals", difficulty: 1, words: ["PARIS", "MADRID", "VIENNA", "OSLO"] },
  { title: "Types of Clouds", difficulty: 3, words: ["CIRRUS", "CUMULUS", "STRATUS", "NIMBUS"] },
  { title: "Guitar Types", difficulty: 2, words: ["ACOUSTIC", "ELECTRIC", "BASS", "CLASSICAL"] },
  { title: "Sandwich Types", difficulty: 3, words: ["REUBEN", "CLUB", "HOAGIE", "PANINI"] },
  // Day 9
  { title: "Rivers", difficulty: 2, words: ["NILE", "AMAZON", "THAMES", "DANUBE"] },
  { title: "Yoga Poses", difficulty: 3, words: ["COBRA", "EAGLE", "CAMEL", "LOTUS"] },
  { title: "Types of Tea", difficulty: 2, words: ["CHAMOMILE", "OOLONG", "MATCHA", "EARLGREY"] },
  { title: "Skiing Terms", difficulty: 3, words: ["SLALOM", "MOGUL", "CHAIRLIFT", "POWDER"] },
  // Day 10
  { title: "Insects", difficulty: 1, words: ["BEETLE", "CRICKET", "MANTIS", "LOCUST"] },
  { title: "Pasta Sauces", difficulty: 1, words: ["MARINARA", "ALFREDO", "PESTO", "BOLOGNESE"] },
  { title: "Card Suits & Related", difficulty: 2, words: ["SPADE", "CLUB", "HEART", "DIAMOND"] },
  { title: "Weightlifting Moves", difficulty: 3, words: ["SNATCH", "CLEAN", "DEADLIFT", "SQUAT"] },
  // Day 11
  { title: "Types of Nuts", difficulty: 1, words: ["ALMOND", "CASHEW", "PISTACHIO", "WALNUT"] },
  { title: "Sailing Terms", difficulty: 3, words: ["STARBOARD", "PORT", "RUDDER", "ANCHOR"] },
  { title: "Dinosaurs", difficulty: 1, words: ["TREX", "RAPTOR", "TRICERATOPS", "STEGOSAURUS"] },
  { title: "Coffee Drinks", difficulty: 2, words: ["LATTE", "MOCHA", "ESPRESSO", "MACCHIATO"] },
  // Day 12
  { title: "Shakespeare Plays", difficulty: 2, words: ["HAMLET", "MACBETH", "OTHELLO", "TEMPEST"] },
  { title: "Types of Bridges", difficulty: 3, words: ["SUSPENSION", "ARCH", "BEAM", "CANTILEVER"] },
  { title: "Volcanic Terms", difficulty: 2, words: ["MAGMA", "LAVA", "CRATER", "ASH"] },
  { title: "Types of Storms", difficulty: 1, words: ["TORNADO", "CYCLONE", "TYPHOON", "MONSOON"] },
];
