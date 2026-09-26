// Archive exhibits (packet sections 03 to 17, 35). Written only from the
// research packet; nothing here comes from memory. Grades are proposals until
// T11 checks each source, and a page stays a draft until every source it cites
// is checked (enforced in tests/content.test.ts).
//
// Grades: A primary/object, B strong reconstruction, C later account or oral
// history, D disputed or insufficient, X modern reconstruction built here.

export type Grade = "A" | "B" | "C" | "D" | "X";

export const GRADES: Record<Grade, { badge: string; meaning: string }> = {
  A: { badge: "DOCUMENTED", meaning: "A surviving object, regulation, contemporary text, archive document or direct testimony." },
  B: { badge: "STRONG RECONSTRUCTION", meaning: "Supported by archival scholarship or several reliable sources." },
  C: { badge: "LATER ACCOUNT", meaning: "A later account or oral history: valuable, harder to check independently." },
  D: { badge: "DISPUTED", meaning: "A claim exists, but historians disagree or the documentation is weak." },
  X: { badge: "MODERN RECONSTRUCTION", meaning: "A system built here, today, from a historical principle." },
};

export interface Claim {
  text: string;
  grade: Grade;
  /** Source ids from src/content/sources.json. */
  sources: string[];
  /** "Why this label?": the reasoning behind the grade. */
  why: string;
  /** Required when there is no source: what is missing and what would settle it. */
  sourceNote?: string;
}

export interface Exhibit {
  slug: string;
  archive: string;
  title: string;
  place: string;
  period: string;
  lede: string;
  claims: Claim[];
  know: string[];
  unknown: string[];
  experiment?: { text: string; href: string };
  status: "draft" | "published";
}

export const EXHIBITS: Exhibit[] = [
  {
    slug: "norway",
    archive: "ARCHIVE 04.1",
    title: "The red cap",
    place: "Norway",
    period: "German occupation",
    lede: "A warm winter hat became a way for people to show where they stood. No cipher, no key: just a shared colour, worn by many people at once.",
    claims: [
      {
        text: "The red knitted topplue (nisselue) became a symbol of Norwegian identity and resistance during the German occupation.",
        grade: "B",
        sources: ["S01"],
        why: "A national encyclopedia entry, written from the historical record. A strong reference, but not itself a document from the time.",
      },
      {
        text: "A police prohibition on the red caps took effect on 26 February 1942, after wearing them had become so widespread that the authorities treated it as a demonstration.",
        grade: "B",
        sources: ["S01"],
        why: "Reported by the encyclopedia. The police notice itself would be primary evidence (grade A); finding a digitized copy is on the research list.",
      },
    ],
    know: [
      "The red cap was worn widely enough to be read as a political statement.",
      "The authorities took it seriously enough to ban it.",
    ],
    unknown: [
      "We have not yet seen the original police notice.",
      "We have found no evidence that Norwegian knitters hid coded text, such as Morse, in garments. The cap carried its meaning by being worn.",
    ],
    experiment: { text: "Try the two-colour carrier in the lab: a message in red and cream.", href: "./lab.html" },
    status: "draft",
  },
  {
    slug: "grini",
    archive: "ARCHIVE 04.2",
    title: "Grini: making in secret",
    place: "Grini, Norway",
    period: "German occupation",
    lede: "Women held at Grini made tiny knitted and embroidered things with almost nothing. Some were dangerous to own. Making them was a way to stay yourself.",
    claims: [
      {
        text: "Women prisoners made very small knitted mittens and socks, and embroidery, using improvised tools such as hairpins or sewing pins.",
        grade: "B",
        sources: ["S02"],
        why: "A museum's own account of objects in collections. Grade A would need the object records themselves.",
      },
      {
        text: "Thread was salvaged from clothing, bedding and other material to hand.",
        grade: "B",
        sources: ["S02"],
        why: "From the museum's account; the objects are the evidence behind it.",
      },
      {
        text: "Some pieces carried patriotic motifs and statements, and were made in hiding because owning them was dangerous.",
        grade: "B",
        sources: ["S02"],
        why: "From the museum's account.",
      },
      {
        text: "The museum reads this handwork as a way to keep concentration, imagination, competence, control, self-respect and inner freedom.",
        grade: "B",
        sources: ["S02"],
        why: "This is the museum's interpretation, shown as interpretation.",
      },
    ],
    know: [
      "Making can be resistance even when nobody outside ever sees it.",
      "Tools and thread were improvised from whatever prisoners had.",
    ],
    unknown: [
      "Agnes (Aggi) Klønig's story brings message-smuggling and clandestine needlework into the same life: she carried messages through her Red Cross access before she was imprisoned, and made clandestine needlework while imprisoned. We have not found evidence that her messages themselves were in stitches. The source for her story is not yet on our shelf.",
      "We have not yet read first-person accounts from Grini prisoners.",
    ],
    experiment: { text: "Knit a message small: try a narrow grid in the lab.", href: "./lab.html" },
    status: "draft",
  },
  {
    slug: "belgium",
    archive: "ARCHIVE 07.1",
    title: "Trains, windows and knitting",
    place: "Occupied Belgium",
    period: "First World War",
    lede: "The story of a woman at a window, knitting a record of passing trains, is told often. Parts of it rest on good evidence. Other parts still need a source.",
    claims: [
      {
        text: "Belgian intelligence networks, including La Dame Blanche (the White Lady), watched German rail transport and passed information to British intelligence.",
        grade: "B",
        sources: ["S03"],
        why: "Recent history written from newly available archives.",
      },
      {
        text: "A particular knitter recorded trains stitch by stitch, with different stitches for different kinds of train.",
        grade: "D",
        sources: [],
        why: "Widely retold, but we have no page-level source for a specific stitch system or a named knitter.",
        sourceNote: "Popular and educational retellings only. Page-level citations from the White Lady research would settle it either way.",
      },
      {
        text: "A 1942 handbook, A Guide to Codes and Signals by Gordon A. J. Petersen and Marshall McClintock, covers signals, Morse, signs, symbols and ciphers.",
        grade: "B",
        sources: ["S04"],
        why: "A library catalogue record confirms the book exists. What it says about handwork needs the pages themselves.",
      },
    ],
    know: [
      "Railway watching was real intelligence work in occupied Belgium.",
      "Codes and signals were taught to the public in wartime handbooks.",
    ],
    unknown: [
      "Whether any documented knitter used stitches to log trains, and how.",
      "What the 1942 handbook says about codes in handwork. Earlier research points to a section on knitting, embroidery, rugs and knots; we will quote it only once we have the pages.",
    ],
    experiment: { text: "Our knit-and-purl codes are modern reconstructions: try one in the lab.", href: "./lab.html" },
    status: "draft",
  },
  {
    slug: "cloth-as-resistance",
    archive: "ARCHIVE 02.1",
    title: "Cloth as resistance",
    place: "Many places",
    period: "From colonial boycotts to today",
    lede: "Textiles have carried politics in many ways besides hidden codes: by who makes them, by being worn together, by bearing witness, and by sheer number.",
    claims: [
      {
        text: "In colonial North America, boycotts of British goods included making cloth at home; spinning bees and homespun became part of the protest.",
        grade: "B",
        sources: ["S05", "S06", "S23"],
        why: "Museum and national park histories agree.",
      },
      {
        text: "Gandhi called on people to spin, weave and wear khadi, which became a symbol of resistance; in 1921 nationalists put the spinning wheel on their flag.",
        grade: "B",
        sources: ["S07"],
        why: "A museum history of Indian textiles.",
      },
      {
        text: "At the 1908 NUWSS procession, the Women Writers' Suffrage League carried a banner designed by Mary Lowndes and embroidered by Christiana Herringham.",
        grade: "A",
        sources: ["S08"],
        why: "The banner survives in a museum collection.",
      },
      {
        text: "In Chile under the dictatorship, women made arpilleras showing repression, disappearance, poverty, detention and daily life.",
        grade: "B",
        sources: ["S09"],
        why: "A human rights museum's exhibition on arpilleras as resistance, organization and testimony.",
      },
      {
        text: "The first major display of the AIDS Memorial Quilt on the National Mall, in 1987, had 1,920 panels, each for one person.",
        grade: "B",
        sources: ["S10"],
        why: "The quilt's own organization's history.",
      },
      {
        text: "The pink knitted hat was a main symbol of the 21 January 2017 Women's March; its simple pattern was shared so people could make or donate hats.",
        grade: "B",
        sources: ["S11"],
        why: "A museum article on an object in its collection.",
      },
      {
        text: "The Knitting Nannas began in Australia in 2012 in opposition to coal-seam gas; knitting went with watching company activity.",
        grade: "C",
        sources: ["S12"],
        why: "The group's own history: valuable first-hand, and not independently checked yet.",
      },
    ],
    know: [
      "Making cloth can change who earns from it.",
      "A shared object, worn by many, can say what one person alone cannot.",
      "A textile can be the record itself.",
      "Knitting is slow, which suits staying put and watching.",
    ],
    unknown: [
      "Each of these deserves its own page; this overview only points the way.",
    ],
    experiment: { text: "Play The Purloined Parcel, where the cloth is the letter.", href: "./game.html" },
    status: "draft",
  },
  {
    slug: "evidence",
    archive: "ARCHIVE 17.1",
    title: "Good story. Where's the evidence?",
    place: "Everywhere stories travel",
    period: "Any time",
    lede: "Secret-message stories move quickly from possible to everyone knows. This page is about telling the story and the evidence apart, without dismissing either.",
    claims: [
      {
        text: "The widely repeated story that quilt patterns formed a standard code for routes on the Underground Railroad lacks strong contemporary documentation.",
        grade: "D",
        sources: ["S14"],
        why: "The Smithsonian's folklife center reviews the story's modern popularity and the missing contemporary records.",
      },
      {
        text: "The story matters culturally, and oral tradition deserves respect as oral tradition.",
        grade: "C",
        sources: ["S14"],
        why: "The same review separates what people believe and find inspiring from what can be shown.",
      },
      {
        text: "Khipu use cords, knots and their arrangement to record structured information.",
        grade: "A",
        sources: ["S13"],
        why: "Surviving khipu are held in museum collections.",
      },
    ],
    know: [
      "A story can be meaningful and still not be proof that something happened as told.",
      "Separate facts can fuse into a stronger claim as they are retold. The Belgian train knitter and Aggi Klønig are two cases to watch.",
      "Khipu show that thread can hold structured data. They are not an ancestor of European coded knitting, and we do not present them as one.",
    ],
    unknown: [
      "How the quilt-code story took its current form: the review traces it, and we want to read it in full before summarizing.",
    ],
    experiment: { text: "Our own codes are labelled modern reconstruction. See how they work in the lab.", href: "./lab.html" },
    status: "draft",
  },
];
