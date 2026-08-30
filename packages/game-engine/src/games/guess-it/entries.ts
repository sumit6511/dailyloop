export interface GuessItEntry {
  category: string;
  answer: string;
  aliases: string[];
  /** Exactly 4, revealed one at a time, easiest-to-guess-from last. */
  clues: [string, string, string, string];
}

// Facts only (no copyrighted text) — safe to expand or replace over time.
export const GUESS_IT_ENTRIES: GuessItEntry[] = [
  {
    category: "Technology",
    answer: "Facebook",
    aliases: [],
    clues: [
      "This company works in technology.",
      "It was founded by a Harvard student in his dorm room.",
      "It was founded in 2004.",
      "It became the world's largest social network, with billions of users.",
    ],
  },
  {
    category: "Countries",
    answer: "Japan",
    aliases: [],
    clues: [
      "This country is in Asia.",
      "It is made up of thousands of islands.",
      "Its capital is Tokyo.",
      "It is known as the Land of the Rising Sun.",
    ],
  },
  {
    category: "Companies",
    answer: "Tesla",
    aliases: [],
    clues: [
      "This company makes vehicles.",
      "It is named after a famous inventor.",
      "It was led to prominence by Elon Musk.",
      "It specializes in electric cars.",
    ],
  },
  {
    category: "Movies",
    answer: "Titanic",
    aliases: [],
    clues: [
      "This movie is a drama.",
      "It was directed by James Cameron.",
      "It is based on a real historical disaster.",
      "It stars Leonardo DiCaprio and Kate Winslet.",
    ],
  },
  {
    category: "People",
    answer: "Albert Einstein",
    aliases: ["Einstein"],
    clues: [
      "This person was a scientist.",
      "He developed the theory of relativity.",
      "He won the Nobel Prize in Physics.",
      "His famous equation is E=mc².",
    ],
  },
  {
    category: "Sports",
    answer: "Michael Jordan",
    aliases: ["Jordan", "MJ"],
    clues: [
      "This person is a former athlete.",
      "He played professional basketball.",
      "He won six NBA championships with the Chicago Bulls.",
      "There's a famous shoe brand named after him — Air Jordan.",
    ],
  },
  {
    category: "Places",
    answer: "Mount Everest",
    aliases: ["Everest"],
    clues: [
      "This is a natural landmark.",
      "It is located in the Himalayas.",
      "It sits on the border of Nepal and Tibet.",
      "It is the tallest mountain above sea level on Earth.",
    ],
  },
  {
    category: "Technology",
    answer: "iPhone",
    aliases: [],
    clues: [
      "This is a piece of technology.",
      "It was first released in 2007.",
      "It is made by Apple.",
      "It popularized the modern touchscreen smartphone.",
    ],
  },
  {
    category: "Countries",
    answer: "Egypt",
    aliases: [],
    clues: [
      "This country is in Africa.",
      "It is home to ancient pyramids.",
      "The Nile River flows through it.",
      "Its capital is Cairo.",
    ],
  },
  {
    category: "Companies",
    answer: "Amazon",
    aliases: [],
    clues: [
      "This company started in a garage.",
      "It was founded by Jeff Bezos.",
      "It began by selling books online.",
      "It is now one of the world's largest online retailers.",
    ],
  },
  {
    category: "Movies",
    answer: "The Lion King",
    aliases: ["Lion King"],
    clues: [
      "This is an animated film.",
      "It was produced by Disney.",
      "Its story is set in Africa.",
      "It features the song 'Circle of Life.'",
    ],
  },
  {
    category: "People",
    answer: "Marie Curie",
    aliases: ["Curie"],
    clues: [
      "This person was a scientist.",
      "She researched radioactivity.",
      "She won Nobel Prizes in two different sciences.",
      "She was the first woman to win a Nobel Prize.",
    ],
  },
  {
    category: "Sports",
    answer: "Cristiano Ronaldo",
    aliases: ["Ronaldo", "CR7"],
    clues: [
      "This person is an athlete.",
      "He plays professional football (soccer).",
      "He is from Portugal.",
      "His nickname includes his jersey number, 7.",
    ],
  },
  {
    category: "Places",
    answer: "The Great Wall of China",
    aliases: ["Great Wall of China", "Great Wall"],
    clues: [
      "This is a man-made structure.",
      "It was built over many centuries.",
      "It stretches for thousands of miles.",
      "It is located in China.",
    ],
  },
  {
    category: "Technology",
    answer: "Google",
    aliases: [],
    clues: [
      "This is a technology company.",
      "It began as a research project at Stanford.",
      "It is best known for its search engine.",
      "Its name comes from the number 'googol.'",
    ],
  },
  {
    category: "Countries",
    answer: "Brazil",
    aliases: [],
    clues: [
      "This country is in South America.",
      "It is the largest country on its continent.",
      "Portuguese is its official language.",
      "It is famous for hosting Carnival and the Amazon rainforest.",
    ],
  },
  {
    category: "Companies",
    answer: "Netflix",
    aliases: [],
    clues: [
      "This company is in entertainment.",
      "It started by mailing DVDs to customers.",
      "It later pioneered video streaming.",
      "It produces original shows and movies.",
    ],
  },
  {
    category: "Movies",
    answer: "Jurassic Park",
    aliases: [],
    clues: [
      "This is an adventure film.",
      "It was directed by Steven Spielberg.",
      "It is based on a novel by Michael Crichton.",
      "It features cloned dinosaurs on an island.",
    ],
  },
  {
    category: "People",
    answer: "Leonardo da Vinci",
    aliases: ["Da Vinci"],
    clues: [
      "This person lived during the Renaissance.",
      "He was both an artist and an inventor.",
      "He painted the Mona Lisa.",
      "He sketched designs for flying machines centuries before flight was possible.",
    ],
  },
  {
    category: "Sports",
    answer: "Serena Williams",
    aliases: [],
    clues: [
      "This person is an athlete.",
      "She plays professional tennis.",
      "She is from the United States.",
      "She has won 23 Grand Slam singles titles.",
    ],
  },
  {
    category: "Places",
    answer: "Eiffel Tower",
    aliases: [],
    clues: [
      "This is a famous landmark.",
      "It is made of iron.",
      "It was built for a World's Fair in 1889.",
      "It stands in Paris, France.",
    ],
  },
  {
    category: "Technology",
    answer: "Python",
    aliases: [],
    clues: [
      "This is a piece of technology.",
      "It was created by Guido van Rossum.",
      "It is named after a British comedy group.",
      "It is one of the world's most popular programming languages.",
    ],
  },
  {
    category: "Countries",
    answer: "Australia",
    aliases: [],
    clues: [
      "This is both a country and a continent.",
      "It is home to unique animals like kangaroos.",
      "Its capital is Canberra, though its largest city is Sydney.",
      "It is located in the Southern Hemisphere, surrounded by ocean.",
    ],
  },
  {
    category: "Companies",
    answer: "Nike",
    aliases: [],
    clues: [
      "This company makes sportswear.",
      "It is named after a Greek goddess.",
      "Its logo is called the 'Swoosh.'",
      "Its slogan is 'Just Do It.'",
    ],
  },
  {
    category: "Movies",
    answer: "The Matrix",
    aliases: ["Matrix"],
    clues: [
      "This is a science fiction film.",
      "It stars Keanu Reeves.",
      "Its plot involves a simulated reality.",
      "It is famous for its 'bullet time' visual effect.",
    ],
  },
  {
    category: "People",
    answer: "William Shakespeare",
    aliases: ["Shakespeare"],
    clues: [
      "This person was a writer.",
      "He lived in England during the 16th and 17th centuries.",
      "He wrote plays including Hamlet and Macbeth.",
      "He is often called the greatest playwright in the English language.",
    ],
  },
  {
    category: "Sports",
    answer: "Lionel Messi",
    aliases: ["Messi"],
    clues: [
      "This person is an athlete.",
      "He plays professional football (soccer).",
      "He is from Argentina.",
      "He won the FIFA World Cup with his national team in 2022.",
    ],
  },
  {
    category: "Places",
    answer: "Great Barrier Reef",
    aliases: [],
    clues: [
      "This is a natural wonder.",
      "It is the largest structure made by living organisms on Earth.",
      "It is located off the coast of Australia.",
      "It is made of coral reefs and can be seen from space.",
    ],
  },
  {
    category: "Technology",
    answer: "Wikipedia",
    aliases: [],
    clues: [
      "This is a website.",
      "It launched in 2001.",
      "Anyone can edit most of its pages.",
      "It is one of the most visited encyclopedias in the world, available in many languages.",
    ],
  },
  {
    category: "Companies",
    answer: "SpaceX",
    aliases: [],
    clues: [
      "This company works in aerospace.",
      "It was founded in 2002.",
      "It was founded by Elon Musk.",
      "It builds reusable rockets and spacecraft.",
    ],
  },
];
