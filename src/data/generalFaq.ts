import type { Faq } from "../types"

/** Questions the prototype can answer without a story selected. */
export const generalFaq: Faq[] = [
  {
    question: "What’s the oldest thing near here?",
    matches: /old|ancient|first/i,
    answer:
      "The Flodden Wall, built in a panic after the Scots lost at Flodden in 1513. A stretch of it runs along the west side of the kirkyard and forms the boundary with Heriot’s. It never saw a siege.",
    source: "Historic Environment Scotland, Flodden Wall listing",
  },
  {
    question: "Why is it called Candlemaker Row?",
    matches: /candle|name|called/i,
    answer:
      "The candlemakers’ guild had its hall here from 1722, and the trade was pushed to the edge of town because rendering tallow smelled terrible. The guild’s hall still stands at the top of the street, with the motto “Omnia manifesta luce” over the door.",
    source: "Edinburgh World Heritage, Old Town street histories",
  },
  {
    question: "Anything from this year?",
    matches: /recent|this year|news|2026/i,
    answer:
      "Nothing within two blocks that would earn a place here. I checked local press from the last twelve months and found only routine council notices about the kirkyard paths. If you want, I can look farther out.",
  },
]
