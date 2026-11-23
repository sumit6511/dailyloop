export interface ConnectionsCategory {
  title: string;
  /** 1 = easiest (yellow) ... 4 = trickiest (purple), matching the classic Connections palette. */
  difficulty: 1 | 2 | 3 | 4;
  words: [string, string, string, string];
}

/**
 * A bank entry carries extra, generation-time-only knowledge about which *other* words could
 * plausibly be argued into this category. It never reaches stored puzzle content — the
 * generator uses it to guarantee every grid has exactly one valid grouping, so a red herring
 * can make a puzzle harder but never ambiguous.
 */
export interface ConnectionsBankEntry extends ConnectionsCategory {
  /** Words from elsewhere in the bank that also genuinely fit this category. */
  herrings?: string[];
  /** For pattern categories ("contains a hidden number", palindromes, ...): any word that fits. */
  matches?: (word: string) => boolean;
}

const containsHidden = (hidden: readonly string[]) => (word: string) =>
  hidden.some((h) => word !== h && word.includes(h));
const startsWithAny = (prefixes: readonly string[]) => (word: string) =>
  prefixes.some((p) => word !== p && word.startsWith(p));
const sortedLetters = (word: string) => [...word].sort().join("");
const anagramOf = (base: string) => (word: string) => word !== base && sortedLetters(word) === sortedLetters(base);

const BODY_PARTS = ["LEG", "ARM", "SHIN", "HIP", "CHIN", "TOE", "LIP", "KNEE", "RIB"];
const NUMBER_WORDS = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"];
const SMALL_ANIMALS = ["CAT", "BEAR", "PIG", "COW", "RAT", "BAT", "DOG", "OWL", "APE", "EEL", "HEN", "YAK", "EMU", "ELK", "FOX", "HOG", "RAM"];
const BIRDS = ["EAGLE", "SPARROW", "PARROT", "PENGUIN", "KIWI"];
const INSECTS = ["BEETLE", "CRICKET", "MANTIS", "LOCUST"];
const NUTS = ["ALMOND", "CASHEW", "PISTACHIO", "WALNUT"];

// Every grid takes exactly one category from each difficulty tier. Words MAY repeat across
// categories (RUBY, CLUB, ...) — the generator never puts two categories sharing a word in the
// same grid, and rejects any grid whose words could be grouped more than one way.
export const CATEGORY_BANK: ConnectionsBankEntry[] = [
  // --- Difficulty 1 (yellow): straightforward groups -------------------------------------------
  { title: "Fruits", difficulty: 1, words: ["KIWI", "MANGO", "APPLE", "LEMON"], herrings: ["ORANGE", "OLIVE", "TOMATO"] },
  { title: "Planets", difficulty: 1, words: ["MARS", "VENUS", "EARTH", "SATURN"] },
  { title: "Big Cats", difficulty: 1, words: ["LION", "TIGER", "JAGUAR", "LEOPARD"] },
  { title: "Greek Letters", difficulty: 1, words: ["ALPHA", "BETA", "GAMMA", "DELTA"] },
  { title: "Kitchen Appliances", difficulty: 1, words: ["BLENDER", "TOASTER", "KETTLE", "OVEN"] },
  { title: "Board Games", difficulty: 1, words: ["MONOPOLY", "CLUE", "RISK", "SCRABBLE"] },
  { title: "Superheroes", difficulty: 1, words: ["BATMAN", "SUPERMAN", "FLASH", "THOR"] },
  { title: "Gemstones", difficulty: 1, words: ["RUBY", "EMERALD", "SAPPHIRE", "TOPAZ"] },
  { title: "Dog Breeds", difficulty: 1, words: ["POODLE", "HUSKY", "BEAGLE", "CORGI"] },
  { title: "European Capitals", difficulty: 1, words: ["PARIS", "MADRID", "VIENNA", "OSLO"] },
  { title: "Insects", difficulty: 1, words: ["BEETLE", "CRICKET", "MANTIS", "LOCUST"] },
  { title: "Pasta Sauces", difficulty: 1, words: ["MARINARA", "ALFREDO", "PESTO", "BOLOGNESE"] },
  { title: "Types of Nuts", difficulty: 1, words: ["ALMOND", "CASHEW", "PISTACHIO", "WALNUT"], herrings: ["PEANUT"] },
  { title: "Dinosaurs", difficulty: 1, words: ["RAPTOR", "TRICERATOPS", "STEGOSAURUS", "DIPLODOCUS"] },
  { title: "Types of Storms", difficulty: 1, words: ["TORNADO", "CYCLONE", "TYPHOON", "HURRICANE"] },
  { title: "Weather", difficulty: 1, words: ["RAIN", "SNOW", "HAIL", "SLEET"] },
  { title: "Ocean Creatures", difficulty: 1, words: ["SHARK", "WHALE", "OCTOPUS", "DOLPHIN"] },
  { title: "Musical Instruments", difficulty: 1, words: ["PIANO", "VIOLIN", "DRUM", "FLUTE"], herrings: ["BASS"] },
  { title: "Rainbow Colors", difficulty: 1, words: ["ORANGE", "YELLOW", "INDIGO", "VIOLET"] },
  { title: "Farm Animals", difficulty: 1, words: ["COW", "PIG", "GOAT", "SHEEP"] },
  { title: "Vegetables", difficulty: 1, words: ["CARROT", "POTATO", "ONION", "CELERY"] },
  { title: "Joints", difficulty: 1, words: ["SHOULDER", "ELBOW", "KNEE", "ANKLE"] },
  { title: "Shapes", difficulty: 1, words: ["CIRCLE", "SQUARE", "TRIANGLE", "HEXAGON"] },
  { title: "Birds", difficulty: 1, words: ["EAGLE", "SPARROW", "PARROT", "PENGUIN"], herrings: ["KIWI"] },
  { title: "Team Sports", difficulty: 1, words: ["SOCCER", "HOCKEY", "RUGBY", "BASEBALL"], herrings: ["CRICKET"] },
  { title: "Coffee Drinks", difficulty: 1, words: ["LATTE", "MOCHA", "ESPRESSO", "MACCHIATO"] },
  { title: "Breakfast Foods", difficulty: 1, words: ["PANCAKE", "WAFFLE", "OMELETTE", "CEREAL"], herrings: ["EGG"] },
  { title: "Furniture", difficulty: 1, words: ["SOFA", "TABLE", "CHAIR", "DRESSER"] },
  { title: "Trees", difficulty: 1, words: ["OAK", "MAPLE", "BIRCH", "WILLOW"], herrings: ["PINE", "APPLE", "LEMON", "MANGO", "OLIVE"] },
  { title: "Card Suits", difficulty: 1, words: ["SPADE", "CLUB", "HEART", "DIAMOND"] },
  { title: "Metals", difficulty: 1, words: ["COPPER", "IRON", "ZINC", "NICKEL"] },

  // --- Difficulty 2 (green): needs a little knowledge ------------------------------------------
  { title: "Programming Languages", difficulty: 2, words: ["PYTHON", "JAVA", "RUBY", "GO"] },
  { title: "Car Brands", difficulty: 2, words: ["TESLA", "HONDA", "MAZDA", "LEXUS"], herrings: ["JAGUAR"] },
  { title: "Chess Pieces", difficulty: 2, words: ["BISHOP", "KNIGHT", "ROOK", "PAWN"] },
  { title: "Types of Bread", difficulty: 2, words: ["BAGUETTE", "RYE", "SOURDOUGH", "CIABATTA"] },
  { title: "Card Games", difficulty: 2, words: ["POKER", "BRIDGE", "RUMMY", "HEARTS"] },
  { title: "Types of Dance", difficulty: 2, words: ["TANGO", "SALSA", "WALTZ", "BALLET"] },
  { title: "Herbs & Spices", difficulty: 2, words: ["BASIL", "THYME", "CUMIN", "PAPRIKA"] },
  { title: "Types of Boats", difficulty: 2, words: ["CANOE", "YACHT", "KAYAK", "FERRY"] },
  { title: "Pasta Shapes", difficulty: 2, words: ["PENNE", "FUSILLI", "RIGATONI", "LINGUINE"] },
  { title: "Types of Hats", difficulty: 2, words: ["FEDORA", "BERET", "BEANIE", "TURBAN"] },
  { title: "Martial Arts", difficulty: 2, words: ["KARATE", "JUDO", "TAEKWONDO", "AIKIDO"] },
  { title: "Desserts", difficulty: 2, words: ["TIRAMISU", "MOUSSE", "SORBET", "TRIFLE"] },
  { title: "Rivers", difficulty: 2, words: ["NILE", "AMAZON", "THAMES", "DANUBE"] },
  { title: "Types of Tea", difficulty: 2, words: ["CHAMOMILE", "OOLONG", "MATCHA", "DARJEELING"] },
  { title: "Shakespeare Plays", difficulty: 2, words: ["HAMLET", "MACBETH", "OTHELLO", "TEMPEST"] },
  { title: "Volcano Words", difficulty: 2, words: ["MAGMA", "LAVA", "CRATER", "ASH"] },
  { title: "Shades of Red", difficulty: 2, words: ["SCARLET", "CRIMSON", "MAROON", "BURGUNDY"], herrings: ["RUBY", "CHERRY"] },
  { title: "Shades of Blue", difficulty: 2, words: ["NAVY", "COBALT", "AZURE", "CERULEAN"], herrings: ["INDIGO", "SAPPHIRE"] },
  { title: "Currencies", difficulty: 2, words: ["PESO", "YEN", "EURO", "RUPEE"] },
  { title: "Constellations", difficulty: 2, words: ["ORION", "LYRA", "DRACO", "CASSIOPEIA"], herrings: ["PHOENIX"] },
  { title: "Guitar Types", difficulty: 2, words: ["ACOUSTIC", "ELECTRIC", "BASS", "CLASSICAL"] },
  { title: "Cheeses", difficulty: 2, words: ["BRIE", "CHEDDAR", "GOUDA", "FETA"] },
  { title: "Mountain Ranges", difficulty: 2, words: ["ANDES", "ALPS", "ROCKIES", "HIMALAYAS"] },
  { title: "Noble Gases", difficulty: 2, words: ["NEON", "ARGON", "XENON", "KRYPTON"] },
  { title: "Bones", difficulty: 2, words: ["FEMUR", "TIBIA", "RADIUS", "PELVIS"] },
  { title: "Fabrics", difficulty: 2, words: ["SILK", "DENIM", "VELVET", "LINEN"] },
  { title: "Mythical Creatures", difficulty: 2, words: ["DRAGON", "PHOENIX", "UNICORN", "GRIFFIN"] },
  { title: "Units of Length", difficulty: 2, words: ["INCH", "METER", "MILE", "FURLONG"] },
  { title: "Track & Field", difficulty: 2, words: ["HURDLES", "JAVELIN", "DISCUS", "MARATHON"] },
  { title: "Sushi Words", difficulty: 2, words: ["NIGIRI", "MAKI", "SASHIMI", "WASABI"] },
  { title: "Apple Products", difficulty: 2, words: ["IPHONE", "IPAD", "MACBOOK", "AIRPODS"] },
  { title: "Painters", difficulty: 2, words: ["MONET", "DALI", "PICASSO", "REMBRANDT"] },
  { title: "Composers", difficulty: 2, words: ["BACH", "MOZART", "CHOPIN", "HANDEL"] },
  { title: "Computer Hardware", difficulty: 2, words: ["MOUSE", "MONITOR", "MODEM", "ROUTER"], herrings: ["KEYBOARD"] },
  { title: "Hairstyles", difficulty: 2, words: ["BOB", "BUN", "MULLET", "MOHAWK"] },
  { title: "U.S. Coins", difficulty: 2, words: ["PENNY", "NICKEL", "DIME", "QUARTER"] },

  // --- Difficulty 3 (blue): double meanings & specialist vocab ---------------------------------
  { title: "Types of Clouds", difficulty: 3, words: ["CIRRUS", "CUMULUS", "STRATUS", "NIMBUS"] },
  { title: "Sandwiches", difficulty: 3, words: ["REUBEN", "CLUB", "HOAGIE", "PANINI"] },
  { title: "Yoga Poses", difficulty: 3, words: ["COBRA", "EAGLE", "CAMEL", "LOTUS"] },
  { title: "Skiing Terms", difficulty: 3, words: ["SLALOM", "MOGUL", "CHAIRLIFT", "POWDER"] },
  { title: "Weightlifting Moves", difficulty: 3, words: ["SNATCH", "CLEAN", "DEADLIFT", "SQUAT"] },
  { title: "Parts of a Ship", difficulty: 3, words: ["BOW", "STERN", "HULL", "KEEL"] },
  { title: "Types of Bridges", difficulty: 3, words: ["SUSPENSION", "ARCH", "BEAM", "CANTILEVER"] },
  { title: "Things with Keys", difficulty: 3, words: ["PIANO", "MAP", "LOCK", "KEYBOARD"] },
  { title: "Fictional Detectives", difficulty: 3, words: ["HOLMES", "POIROT", "MARPLE", "COLUMBO"] },
  { title: "Golf Scores", difficulty: 3, words: ["BIRDIE", "EAGLE", "BOGEY", "PAR"] },
  { title: "Tennis Terms", difficulty: 3, words: ["ACE", "LOVE", "DEUCE", "LET"] },
  { title: "Poker Moves", difficulty: 3, words: ["BLUFF", "FOLD", "RAISE", "CHECK"] },
  { title: "Kitchen Verbs", difficulty: 3, words: ["WHISK", "KNEAD", "FOLD", "SIFT"] },
  { title: "Knots", difficulty: 3, words: ["BOWLINE", "HITCH", "REEF", "SHEEPSHANK"] },
  { title: "___fish", difficulty: 3, words: ["SWORD", "STAR", "JELLY", "GOLD"], herrings: ["ANGEL", "LION", "CAT", "SHELL"] },
  { title: "___board", difficulty: 3, words: ["KEY", "SURF", "CARD", "WHITE"], herrings: ["SNOW"] },
  { title: "___ball", difficulty: 3, words: ["FOOT", "BASKET", "MEAT", "SNOW"], herrings: ["EYE", "BASE"] },
  { title: "Moon___", difficulty: 3, words: ["WALK", "BEAM", "STONE", "LIGHT"], herrings: ["SHINE"] },
  { title: "___light", difficulty: 3, words: ["MOON", "HEAD", "FLASH", "TRAFFIC"], herrings: ["STAR"] },
  { title: "___paper", difficulty: 3, words: ["NEWS", "SAND", "WALL", "TOILET"], herrings: ["FLY"] },
  { title: "___cake", difficulty: 3, words: ["PAN", "CUP", "CHEESE", "SPONGE"], herrings: ["CARROT"] },
  { title: "Famous Bears", difficulty: 3, words: ["PADDINGTON", "BALOO", "POOH", "YOGI"] },
  { title: "Silent K", difficulty: 3, words: ["KNIFE", "KNIGHT", "KNOT", "KNEE"], matches: (w) => w.startsWith("KN") },
  { title: "Famous Ships", difficulty: 3, words: ["TITANIC", "MAYFLOWER", "ENDEAVOUR", "BOUNTY"], herrings: ["BEAGLE"] },
  { title: "Moons of Jupiter", difficulty: 3, words: ["IO", "EUROPA", "GANYMEDE", "CALLISTO"] },
  { title: "Snow___", difficulty: 3, words: ["BALL", "FLAKE", "MAN", "BOARD"], herrings: ["STORM"] },
  { title: "___fly", difficulty: 3, words: ["BUTTER", "DRAGON", "FIRE", "HOUSE"], herrings: ["HORSE", "FRUIT"] },
  { title: "Dog Commands", difficulty: 3, words: ["SIT", "STAY", "HEEL", "SPEAK"] },
  { title: "NATO Alphabet", difficulty: 3, words: ["BRAVO", "CHARLIE", "TANGO", "WHISKEY"], herrings: ["DELTA", "ALPHA", "ECHO", "HOTEL"] },

  // --- Difficulty 4 (purple): wordplay ---------------------------------------------------------
  {
    title: "Hidden Animals",
    difficulty: 4,
    words: ["BEARD", "PIGMENT", "COWARD", "SCATTER"],
    matches: containsHidden(SMALL_ANIMALS),
  },
  {
    title: "Hidden Body Parts",
    difficulty: 4,
    words: ["LEGEND", "ARMADA", "SHINE", "CHIPMUNK"],
    matches: containsHidden(BODY_PARTS),
  },
  {
    title: "Hidden Numbers",
    difficulty: 4,
    words: ["OFTEN", "STONE", "WEIGHT", "CANINE"],
    matches: containsHidden(NUMBER_WORDS),
  },
  {
    title: "Starts with a Body Part",
    difficulty: 4,
    words: ["HANDLE", "EARNEST", "CHINA", "HIPSTER"],
    matches: startsWithAny(["HAND", "EAR", "CHIN", "HIP", "ARM", "LEG", "LIP", "TOE", "SHIN", "KNEE", "HEAD", "NOSE", "EYE", "FOOT", "NECK", "HEEL"]),
  },
  { title: "Anagrams of LISTEN", difficulty: 4, words: ["SILENT", "ENLIST", "TINSEL", "INLETS"], matches: anagramOf("LISTEN") },
  { title: "Anagrams of POST", difficulty: 4, words: ["STOP", "POTS", "TOPS", "SPOT"], matches: anagramOf("POST") },
  { title: "Sound Like Letters", difficulty: 4, words: ["SEA", "TEA", "BEE", "EYE"], herrings: ["PEA", "YOU", "WHY", "JAY", "QUEUE"] },
  { title: "Palindromes", difficulty: 4, words: ["LEVEL", "RADAR", "CIVIC", "ROTOR"], matches: (w) => w.length > 2 && w === [...w].reverse().join("") },
  { title: "Fire___", difficulty: 4, words: ["FLY", "PLACE", "WORKS", "MAN"], herrings: ["BALL", "ARM", "WALL", "PROOF"] },
  { title: "___bug", difficulty: 4, words: ["LADY", "BED", "JITTER", "LITTER"], herrings: ["FIRE", "STINK"] },
  { title: "Things That Can Be Broken", difficulty: 4, words: ["RECORD", "HEART", "PROMISE", "SILENCE"], herrings: ["CODE", "NEWS", "ICE"] },
  { title: "Things You Can Crack", difficulty: 4, words: ["CODE", "JOKE", "EGG", "KNUCKLES"], herrings: [...NUTS, "SAFE", "WHIP"] },
  { title: "Things You Shuffle", difficulty: 4, words: ["CARDS", "FEET", "PLAYLIST", "PAPERS"], herrings: ["DECK"] },
  { title: "Things You Can Draw", difficulty: 4, words: ["CURTAINS", "BATH", "SWORD", "CONCLUSION"], herrings: ["CARDS", "BREATH"] },
  { title: "Things with Teeth", difficulty: 4, words: ["COMB", "SAW", "ZIPPER", "GEAR"], herrings: ["SHARK"] },
  { title: "Things with Needles", difficulty: 4, words: ["PINE", "CACTUS", "COMPASS", "SYRINGE"] },
  {
    title: "Things with Wings",
    difficulty: 4,
    words: ["PLANE", "ANGEL", "HOSPITAL", "BAT"],
    herrings: [...BIRDS, ...INSECTS, "PHOENIX", "GRIFFIN", "DRAGON"],
  },
  { title: "Things with Shells", difficulty: 4, words: ["TURTLE", "EGG", "TACO", "PEANUT"], herrings: [...NUTS, "SNAIL"] },
  { title: "Things with Rings", difficulty: 4, words: ["SATURN", "CIRCUS", "PHONE", "OLYMPICS"], herrings: ["BELL"] },
];
