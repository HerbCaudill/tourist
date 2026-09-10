import type { Faq } from "./types"
import type { Story } from "../types"

/** The three stories within a block or two, strongest first. */
export const stories: StoryData[] = [
  {
    id: "mcgonagall",
    place: "Greyfriars Kirkyard",
    coordinates: { lat: 55.9466, lon: -3.1919 },
    title: "The worst poet in the world is buried here",
    preview:
      "William McGonagall, whose verse was so bad that audiences pelted him with fish, lies in an unmarked pauper’s grave a few steps past the gate. He believed to the end that he was Scotland’s greatest living poet.",
    account: [
      "William Topaz McGonagall (1825–1902) was a Dundee handloom weaver who, at 52, felt what he called “a strange kind of feeling stealing over me” and decided he was a poet. He toured pubs and music halls reciting works like The Tay Bridge Disaster, and audiences came mainly to throw things at him.",
      "He spent his last years in Edinburgh, poor and mostly forgotten, and died in a rented room on South College Street in September 1902. He was buried here in a pauper’s grave with no stone. The plaque near the north wall was added in 1999.",
      "The fish-throwing is well documented in the contemporary press. The claim that he never realised he was being mocked is more debated: some biographers think he understood exactly what was happening and played along for the fee.",
    ],
    sources: [
      {
        name: "Notable burials",
        org: "Greyfriars Kirkyard Trust",
        url: "https://greyfriarskirk.com/visit-us/kirkyard/",
      },
      {
        name: "McGonagall Online",
        org: "National Library of Scotland",
        url: "https://www.mcgonagall-online.org.uk/",
      },
      {
        name: "Obituary, 30 September 1902",
        org: "Dundee Courier",
        url: "https://www.britishnewspaperarchive.co.uk/",
      },
    ],
    faq: [
      {
        question: "Did he really not know people were laughing at him?",
        matches: /laugh|mock|know|realis|joke/i,
        answer:
          "Probably he knew, at least some of the time. His 1890 autobiographical preface complains bitterly about the abuse and names the pubs where it happened, which is not the writing of someone who missed it. But he kept performing for the fee, and he never once conceded that a poem was bad. A fair summary: he heard the laughter and refused to accept the verdict.",
        source: "McGonagall, Poetic Gems (1890), autobiographical preface",
      },
      {
        question: "Where exactly is the plaque?",
        matches: /plaque|where|find|grave/i,
        answer:
          "Go through the main gate from Candlemaker Row and keep left along the north wall, past the Martyrs’ Monument. The plaque is set into the wall about forty metres along, at eye height. It marks the general area of the paupers’ ground rather than the exact grave, which was never recorded.",
        source: "Greyfriars Kirkyard Trust, Notable burials",
      },
      {
        question: "What was so bad about his poetry?",
        matches: /bad|poem|poetry|verse|tay bridge/i,
        answer:
          "Mostly the rhymes and the metre. He would stretch or crush a line to land on a rhyme, and his subjects were often disasters reported with a newsreader’s flatness. The Tay Bridge Disaster ends by explaining that the bridge would not have fallen “had they been supported on each side with buttresses, at least many sensible men confesses.” Readers still argue about whether the badness is sincere or a kind of accidental genius.",
        source: "McGonagall, The Tay Bridge Disaster (1880)",
      },
    ],
  },
  {
    id: "bobby",
    place: "Greyfriars Bobby fountain",
    coordinates: { lat: 55.947, lon: -3.1912 },
    title: "Bobby’s nose, and a dog that may have been two dogs",
    preview:
      "Visitors rub the statue’s nose for luck, which has worn it to bare bronze. Several local historians argue the loyal terrier was quietly replaced with a younger dog around 1867 to keep the story going.",
    account: [
      "The statue at the top of Candlemaker Row shows a Skye terrier said to have guarded his master’s grave in the kirkyard for fourteen years, from 1858 until his own death in 1872. It was unveiled in 1873, a year after the dog died, and is the smallest listed building in Edinburgh.",
      "The nose-rubbing is recent. It started around 2000, spread through guidebooks and social media, and has now stripped the patina down to bright bronze. The city council has repeatedly asked people to stop, and has repainted the nose at least once.",
      "The two-dog theory comes from a 2011 study by Jan Bondeson, who argues that the original Bobby was a mongrel who died around 1867 and that the kirkyard’s curator and a nearby restaurant owner, both profiting from visitors, replaced him with a younger Skye terrier. Others dispute this, pointing to continuous eyewitness accounts. Nobody disputes that a dog lived in the kirkyard and that the story sold a lot of dinners.",
    ],
    sources: [
      {
        name: "Greyfriars Bobby: The Most Faithful Dog in the World",
        org: "Jan Bondeson, Amberley (2011)",
        url: "https://www.amberley-books.com/",
      },
      {
        name: "Please stop rubbing Bobby’s nose",
        org: "City of Edinburgh Council",
        url: "https://www.edinburgh.gov.uk/",
      },
    ],
    faq: [
      {
        question: "Why do people think there were two dogs?",
        matches: /two|replace|second|bondeson|why/i,
        answer:
          "Mainly because descriptions of the dog change. Early accounts describe a scruffy mongrel; later ones, and the statue, show a well-kept Skye terrier. Bondeson also found that the kirkyard curator, James Brown, was paid by visitors to point out the dog, and that Traill’s restaurant fed it, so both had reason to keep a Bobby on show. It is a plausible argument from circumstantial evidence, not a proven one.",
        source: "Bondeson, Greyfriars Bobby (2011)",
      },
      {
        question: "Is it bad luck to rub the nose?",
        matches: /luck|rub|nose/i,
        answer:
          "Nobody rubbed it for luck before about 2000, so the tradition is younger than most of the people doing it. The only measurable effect is on the statue, which the council would like you to leave alone.",
        source: "City of Edinburgh Council",
      },
    ],
  },
  {
    id: "heriot",
    place: "George Heriot’s School",
    coordinates: { lat: 55.9457, lon: -3.1925 },
    title: "Jinglin’ Geordie’s school for fatherless boys",
    preview:
      "James VI’s goldsmith left his fortune in 1624 to house and teach “puir faitherless bairns”. The turreted building behind the kirkyard wall is still a school, and locals will tell you it inspired Hogwarts. Rowling has never confirmed it.",
    account: [
      "George Heriot (1563–1624) was goldsmith and moneylender to James VI and his queen, and followed the court to London in 1603. He was nicknamed Jinglin’ Geordie for the sound of coins in his pockets. He died childless and left most of his fortune, about £23,000, to found a hospital for the orphaned sons of Edinburgh burgesses.",
      "The building went up between 1628 and 1650 on the site of a former Dominican friary, just outside the Flodden Wall. Cromwell’s army used it as a barracks before it opened. It became a fee-paying day school in 1886 and still admits fatherless children free of charge under the terms of the original bequest.",
      "The Hogwarts connection is a guess that has hardened into fact through repetition. Rowling wrote parts of the early books in cafés with a view of the school, and the four-tower plan and house system are suggestive, but she has never named it as a source. Treat it as pleasant folklore.",
    ],
    sources: [
      {
        name: "History of the school",
        org: "George Heriot’s School",
        url: "https://www.george-heriots.com/",
      },
      {
        name: "George Heriot",
        org: "Oxford Dictionary of National Biography",
        url: "https://www.oxforddnb.com/",
      },
    ],
    faq: [
      {
        question: "Can I go inside?",
        matches: /inside|visit|enter|tour|open/i,
        answer:
          "Not normally. It is a working school, so the grounds are closed to the public during term. It usually opens for Doors Open Day in late September, and the best year-round view is from the kirkyard’s south wall, about fifty metres from where you are.",
        source: "George Heriot’s School, visiting information",
      },
      {
        question: "Does it still take fatherless children?",
        matches: /fatherless|free|still|foundation|bequest/i,
        answer:
          "Yes. The school’s Foundation still funds places for children who have lost a parent, in line with Heriot’s 1624 bequest. Around forty such pupils are on the roll at any time.",
        source: "George Heriot’s School, Foundation",
      },
    ],
  },
]

/** A story as authored, before distance and bearing are computed. */
type StoryData = Omit<Story, "distanceMeters" | "bearing"> & {
  /** Fixture-only canned answers. */
  faq: Faq[]
}
