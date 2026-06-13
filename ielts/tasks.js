/* ============================================================================
   IELTS Writing Lab — Task bank
   Each task carries everything the on-device app and the AI examiner need:
   - the visible prompt / stimulus
   - (Task 1) a chart spec rendered as SVG, plus `dataFacts` that are sent to the
     examiner so it can judge the ACCURACY of the figures the candidate reports
   - a band-8+ `modelAnswer` so the app is useful even with no API key
   The IELTS public band descriptors live in BAND_DESCRIPTORS at the bottom and
   are sent to the examiner to keep its marking calibrated and honest.
   ========================================================================== */

const TASK1_INSTRUCTION =
  "Summarise the information by selecting and reporting the main features, " +
  "and make comparisons where relevant. Write at least 150 words.";

const TASK2_INSTRUCTION =
  "Give reasons for your answer and include any relevant examples from your " +
  "own knowledge or experience. Write at least 250 words.";

/* ----------------------------- TASK 1 (Academic) ------------------------- */

const TASK1 = [
  {
    id: "t1-visitors-line",
    type: "task1",
    chartKind: "line",
    title: "Visitors to UK attractions, 2010–2020",
    prompt:
      "The line graph below shows the number of visitors (in millions) to " +
      "three types of attraction in the United Kingdom between 2010 and 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "line",
      yLabel: "Visitors (millions)",
      xLabels: ["2010", "2012", "2014", "2016", "2018", "2020"],
      yMax: 30,
      series: [
        { name: "Museums", color: "#2563eb", values: [11, 13, 15, 18, 22, 26] },
        { name: "Theme parks", color: "#dc2626", values: [16, 17, 17, 16, 15, 9] },
        { name: "Historic houses", color: "#059669", values: [9, 9, 10, 11, 12, 12] },
      ],
    },
    dataFacts:
      "Line graph, visitors in millions, 2010-2020.\n" +
      "Museums: 11 (2010) rising steadily to 26 (2020) — strongest growth, overtook theme parks around 2014-2016.\n" +
      "Theme parks: started highest at 16 (2010), roughly flat to 2016 (16-17), then fell sharply to 9 (2020).\n" +
      "Historic houses: lowest and most stable, 9 (2010) to 12 (2020), gentle rise.\n" +
      "Overall: museums became the most visited by the end; theme parks ended the lowest after a steep late decline.",
    modelAnswer:
      "The line graph illustrates how many people, in millions, visited museums, theme parks and historic houses in the UK over a ten-year period from 2010 to 2020.\n\n" +
      "Overall, museum attendance climbed steadily throughout the period to become the most popular attraction, whereas theme parks, which began as the clear leader, suffered a marked decline towards the end. Historic houses remained consistently the least visited.\n\n" +
      "In 2010, theme parks attracted the largest audience at around 16 million visitors, well ahead of museums (11 million) and historic houses (9 million). Theme park figures then held broadly steady until 2016 before falling sharply to just 9 million by 2020.\n\n" +
      "Museums, by contrast, grew without interruption, overtaking theme parks at around 2015 and reaching a peak of 26 million in 2020 — more than double their starting figure. Visitor numbers to historic houses rose only modestly across the decade, from 9 to 12 million, leaving them in last place throughout.",
  },
  {
    id: "t1-appliances-bar",
    type: "task1",
    chartKind: "bar",
    title: "Household appliances, 2000 vs 2020",
    prompt:
      "The bar chart below compares the percentage of households that owned " +
      "four selected appliances in one country in 2000 and in 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "bar",
      yLabel: "Households (%)",
      yMax: 100,
      categories: ["Washing machine", "Dishwasher", "Tumble dryer", "Smart speaker"],
      series: [
        { name: "2000", color: "#2563eb", values: [78, 28, 40, 0] },
        { name: "2020", color: "#f59e0b", values: [95, 55, 58, 47] },
      ],
    },
    dataFacts:
      "Grouped bar chart, % of households owning each appliance, 2000 vs 2020.\n" +
      "Washing machine: 78% -> 95% (already common, rose to near-universal, highest both years).\n" +
      "Dishwasher: 28% -> 55% (roughly doubled).\n" +
      "Tumble dryer: 40% -> 58% (moderate rise).\n" +
      "Smart speaker: 0% -> 47% (did not exist in 2000, biggest change, sharp rise from nothing).\n" +
      "Overall: ownership of every appliance increased; washing machines most common throughout; smart speakers showed the most dramatic growth.",
    modelAnswer:
      "The bar chart compares the proportion of households owning four kinds of appliance in a single country in the years 2000 and 2020.\n\n" +
      "Overall, ownership of every appliance rose over the two decades. Washing machines were the most widely owned in both years, while the most striking change was the emergence of smart speakers, which went from being entirely absent to being found in almost half of all homes.\n\n" +
      "In 2000, washing machines were already present in 78% of households, far ahead of tumble dryers (40%) and dishwashers (28%). By 2020 washing machines had become near-universal at 95%, whereas dishwasher ownership had roughly doubled to 55% and tumble dryers had climbed more modestly to 58%.\n\n" +
      "Smart speakers, which simply did not exist in households in 2000, accounted for 47% of homes by 2020. This represented the sharpest increase of any item on the chart, although smart speakers still remained the least common of the four appliances by the end of the period.",
  },
  {
    id: "t1-water-table",
    type: "task1",
    chartKind: "table",
    title: "Daily water use per person, four countries",
    prompt:
      "The table below gives information about the average amount of water " +
      "(in litres) used per person each day for three purposes in four countries.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "table",
      columns: ["Country", "Drinking & cooking", "Washing & hygiene", "Garden & other", "Total"],
      rows: [
        ["Country A", "12", "95", "43", "150"],
        ["Country B", "10", "60", "20", "90"],
        ["Country C", "8", "40", "12", "60"],
        ["Country D", "15", "120", "85", "220"],
      ],
    },
    dataFacts:
      "Table, litres of water per person per day, four countries, three purposes.\n" +
      "Country D uses the most overall (220L total): washing/hygiene 120, garden/other 85, drinking/cooking 15.\n" +
      "Country A second (150L): washing 95, garden 43, drinking 12.\n" +
      "Country B 90L: washing 60, garden 20, drinking 10.\n" +
      "Country C uses least (60L): washing 40, garden 12, drinking 8.\n" +
      "Across ALL countries, washing & hygiene is by far the largest category; drinking & cooking is consistently the smallest. Garden/other varies most between countries (12 to 85).",
    modelAnswer:
      "The table shows how much water, measured in litres, an average person uses each day in four countries (A to D), broken down into drinking and cooking, washing and hygiene, and garden or other uses.\n\n" +
      "Overall, water consumption varies considerably between the countries, with Country D using far more than the others. In every country, however, washing and hygiene accounts for the greatest share of water use, while drinking and cooking consistently requires the least.\n\n" +
      "Country D is the heaviest user at 220 litres per person per day, of which 120 litres go to washing and hygiene and a further 85 litres to the garden. Country A follows with a total of 150 litres, again dominated by washing (95 litres).\n\n" +
      "Countries B and C use markedly less, at 90 and 60 litres respectively. The clearest difference between countries lies in garden and other uses, which range from just 12 litres in Country C to 85 litres in Country D, whereas drinking and cooking stays within a narrow band of 8 to 15 litres everywhere.",
  },
  {
    id: "t1-glass-process",
    type: "task1",
    chartKind: "process",
    title: "How glass bottles are recycled",
    prompt:
      "The diagram below shows the process by which used glass bottles are " +
      "recycled and turned into new glass products.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "process",
      steps: [
        "Used bottles collected in recycling bins",
        "Transported to a recycling plant",
        "Washed and sorted by colour",
        "Crushed into small pieces (cullet)",
        "Melted in a furnace at high temperature",
        "Moulded into new bottles and jars",
        "New products delivered to shops",
      ],
      cyclic: true,
    },
    dataFacts:
      "Process diagram, cyclical, 7 stages, recycling of glass bottles.\n" +
      "1 Used bottles collected in recycling bins. 2 Transported to recycling plant. 3 Washed and sorted by colour. " +
      "4 Crushed into small pieces called cullet. 5 Melted in a furnace at high temperature. 6 Moulded into new bottles and jars. " +
      "7 New products delivered to shops, from where they may re-enter the cycle.\n" +
      "It is a man-made, linear-into-cyclical process with 7 stages; the loop closes because new products can be used and recycled again.",
    modelAnswer:
      "The diagram illustrates the various stages involved in recycling used glass bottles so that they can be made into new glass products. Overall, it is a cyclical process consisting of seven distinct steps, beginning with the collection of waste glass and ending with the delivery of new items to shops, from where the cycle can begin again.\n\n" +
      "At the first stage, used bottles are placed by consumers into recycling bins. These are then transported by vehicle to a recycling plant for processing. On arrival, the glass is thoroughly washed and sorted according to its colour.\n\n" +
      "Following this, the sorted glass is crushed into small fragments known as cullet. The cullet is subsequently fed into a furnace, where it is melted at a very high temperature until it becomes liquid. This molten glass is then moulded into new bottles and jars.\n\n" +
      "In the final stage, the newly formed products are delivered to shops for sale. Once these items have been used by consumers, they can be collected once more, allowing the entire process to repeat.",
  },
  {
    id: "t1-housing-pie",
    type: "task1",
    chartKind: "pie",
    title: "Reasons for moving home, 1990 vs 2020",
    prompt:
      "The two pie charts below show the main reasons people gave for moving " +
      "home in one country in 1990 and in 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "pie",
      charts: [
        {
          title: "1990",
          slices: [
            { name: "Larger property", value: 40, color: "#2563eb" },
            { name: "New job", value: 20, color: "#dc2626" },
            { name: "Lower cost", value: 15, color: "#059669" },
            { name: "Closer to family", value: 25, color: "#f59e0b" },
          ],
        },
        {
          title: "2020",
          slices: [
            { name: "Larger property", value: 22, color: "#2563eb" },
            { name: "New job", value: 33, color: "#dc2626" },
            { name: "Lower cost", value: 30, color: "#059669" },
            { name: "Closer to family", value: 15, color: "#f59e0b" },
          ],
        },
      ],
    },
    dataFacts:
      "Two pie charts, main reason for moving home, percentages, 1990 vs 2020.\n" +
      "1990: Larger property 40% (biggest), Closer to family 25%, New job 20%, Lower cost 15%.\n" +
      "2020: New job 33% (biggest), Lower cost 30%, Larger property 22%, Closer to family 15%.\n" +
      "Changes: 'Larger property' fell from the leading reason (40%) to 22%. 'New job' rose from 20% to 33% and became the top reason. " +
      "'Lower cost' doubled from 15% to 30%. 'Closer to family' fell from 25% to 15%.\n" +
      "Overall: practical/economic reasons (jobs, cost) grew and overtook lifestyle/space reasons.",
    modelAnswer:
      "The two pie charts compare the main reasons people gave for moving home in a particular country in 1990 and 2020.\n\n" +
      "Overall, the most significant shift was away from moving in order to obtain a larger property and towards economic motives, namely finding a new job or reducing living costs, which together dominated by 2020.\n\n" +
      "In 1990, the desire for a larger property was clearly the leading reason, cited by 40% of people, followed by the wish to be closer to family at 25%. Employment and cost were less important, accounting for 20% and 15% respectively.\n\n" +
      "By 2020 this picture had changed considerably. Moving for a new job had become the single most common reason at 33%, while seeking lower costs had doubled to 30%. In contrast, the proportion moving for a larger property had almost halved to 22%, and the share relocating to be near family had fallen to just 15%. Economic factors had therefore overtaken space and family as the principal drivers of moving home.",
  },
];

/* --------------------------------- TASK 2 -------------------------------- */

const TASK2 = [
  {
    id: "t2-community-service",
    type: "task2",
    qType: "Opinion (agree / disagree)",
    title: "Compulsory community service",
    prompt:
      "Some people believe that unpaid community service should be a " +
      "compulsory part of high school education. For example, working in a " +
      "charity, planting trees or helping the elderly.\n\n" +
      "To what extent do you agree or disagree?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "It is sometimes argued that secondary-school students should be required to undertake unpaid work for the benefit of their community. I largely agree with this view, as the advantages for both young people and society clearly outweigh the minor drawbacks.\n\n" +
      "The principal benefit is that community service develops qualities that classroom learning rarely cultivates. When teenagers help in a care home or restore a local park, they acquire empathy, responsibility and an understanding of social problems that no textbook can provide. A student who has spent weekends assisting elderly residents, for instance, is far more likely to grow into a considerate and civic-minded adult.\n\n" +
      "Furthermore, compulsory participation ensures fairness and reach. If such work were optional, only already-motivated students would volunteer, leaving the majority untouched. Making it mandatory exposes every young person to the experience and channels a vast amount of energy towards genuine social needs, from environmental projects to support for the vulnerable.\n\n" +
      "Opponents contend that forcing students to volunteer is contradictory and may breed resentment. While this concern is understandable, it can be addressed by allowing pupils to choose causes that interest them, which preserves a sense of ownership without abandoning the requirement itself.\n\n" +
      "In conclusion, although obliging students to serve their community is not without difficulties, the gains in personal development and social benefit are considerable. I therefore believe such service should form a compulsory element of high-school education.",
  },
  {
    id: "t2-school-age",
    type: "task2",
    qType: "Discussion (both views + opinion)",
    title: "Age to start school",
    prompt:
      "Some people think that children should begin their formal education at " +
      "a very early age. Others believe that children should not start school " +
      "until they are at least seven years old.\n\n" +
      "Discuss both views and give your own opinion.",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "Opinions differ as to when a child's formal schooling should begin. While some argue for an early start, others maintain that children benefit from delaying education until around the age of seven. Both positions have merit, though I personally favour a later start.\n\n" +
      "Those in favour of early education point to young children's remarkable capacity to absorb information. Beginning school at four or five, they argue, allows pupils to acquire literacy and numeracy when the brain is most receptive, while also teaching social skills and routine. In countries where formal learning starts early, supporters claim, children gain a useful academic head start.\n\n" +
      "On the other hand, advocates of a later start emphasise the importance of play in early childhood. They contend that pushing young children into structured lessons too soon can cause stress and stifle creativity. According to this view, the years before seven are better spent developing imagination, curiosity and emotional security through unstructured play, as is the practice in several Scandinavian countries with strong educational outcomes.\n\n" +
      "In my opinion, the second argument is more persuasive. Although early instruction may yield short-term gains, the evidence suggests these advantages fade, whereas a play-based start fosters a lasting love of learning and better long-term wellbeing.\n\n" +
      "In conclusion, while early schooling has its supporters, I believe that allowing children to begin formal education at around seven is more beneficial to their overall development.",
  },
  {
    id: "t2-working-from-home",
    type: "task2",
    qType: "Advantages / disadvantages",
    title: "Working from home",
    prompt:
      "In many countries, an increasing number of people now work from home " +
      "rather than travelling to an office.\n\n" +
      "Do the advantages of this development outweigh the disadvantages?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "The proportion of employees working remotely from their own homes, instead of commuting to a traditional workplace, has grown sharply in recent years. Although this shift brings certain drawbacks, I believe its advantages are the more significant.\n\n" +
      "The most obvious benefit is the time and money saved by eliminating the daily commute. Workers who no longer spend hours travelling can devote that time to their families, rest or exercise, which improves their wellbeing and productivity. Society gains too, since fewer commuters mean reduced traffic congestion and lower carbon emissions. In addition, home working offers flexibility that particularly benefits parents and people with disabilities, widening access to employment.\n\n" +
      "Nevertheless, the practice is not without problems. Working in isolation can damage collaboration and weaken the sense of belonging that an office provides, and some employees struggle to separate their professional and personal lives, leading to longer hours and stress. Younger workers, in particular, may miss the informal mentoring that comes from sitting alongside experienced colleagues.\n\n" +
      "However, most of these disadvantages can be reduced through hybrid arrangements and good management, such as regular team meetings and clear boundaries around working hours. The fundamental gains in flexibility, cost and environmental impact, by contrast, are difficult to replicate in a conventional office.\n\n" +
      "On balance, therefore, while remote work poses genuine challenges, I am convinced that its benefits for individuals, employers and the environment clearly outweigh its disadvantages.",
  },
  {
    id: "t2-traffic-congestion",
    type: "task2",
    qType: "Problem / causes & solutions",
    title: "Urban traffic congestion",
    prompt:
      "In many cities around the world, traffic congestion is becoming an " +
      "increasingly serious problem.\n\n" +
      "What are the causes of this problem, and what measures could be taken " +
      "to solve it?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "Traffic congestion has become a defining problem of modern urban life, clogging streets and wasting countless hours every day. This essay will examine the main causes of the issue before suggesting some practical solutions.\n\n" +
      "The principal cause of congestion is the sheer growth in private car ownership. As incomes have risen, owning a car has become both affordable and a symbol of status, so roads designed for far smaller volumes are now overwhelmed. A second factor is the inadequacy of public transport in many cities; where buses and trains are unreliable, infrequent or expensive, commuters have little choice but to drive. Poor urban planning, which separates homes from workplaces and forces long journeys, compounds the difficulty.\n\n" +
      "Several measures could ease the situation. Most importantly, governments should invest heavily in efficient, affordable public transport, including metro systems and dedicated bus lanes, so that leaving the car at home becomes the rational choice. This could be reinforced by congestion charges, such as those in London and Singapore, which discourage unnecessary driving in city centres. In the longer term, planners should design compact, mixed-use neighbourhoods where people can live, work and shop within walking or cycling distance.\n\n" +
      "In conclusion, urban congestion stems chiefly from rising car use and weak alternatives. By improving public transport, pricing road use sensibly and planning cities more wisely, authorities can significantly reduce the problem and create more liveable urban environments.",
  },
  {
    id: "t2-consumer-goods",
    type: "task2",
    qType: "Two-part (direct) question",
    title: "Buying more than we need",
    prompt:
      "Nowadays many people spend a large proportion of their income on " +
      "consumer goods such as clothes, gadgets and other items they do not " +
      "really need.\n\n" +
      "Why do people buy more than they need? What effects does this have on " +
      "individuals and society?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "In today's consumer society, a great many people devote much of their income to goods they could easily live without, from the latest smartphones to constantly changing fashions. This essay will consider why such overconsumption occurs and what consequences it has for both individuals and the wider community.\n\n" +
      "There are two principal reasons why people buy more than they need. The first is relentless advertising, which deliberately creates desires that did not previously exist by associating products with happiness, status and success. The second is social pressure: in a culture where possessions are seen as a measure of achievement, people purchase expensive items in order to keep up with friends and colleagues rather than out of genuine necessity.\n\n" +
      "The effects of this behaviour are largely negative. For individuals, excessive spending often leads to debt and financial anxiety, as people stretch their resources to fund a lifestyle they cannot truly afford. There is also a psychological cost, since the satisfaction gained from a new purchase is usually short-lived, prompting yet more buying. At the societal level, mass consumption drives the overuse of natural resources and generates enormous quantities of waste, accelerating environmental damage such as pollution and climate change.\n\n" +
      "In conclusion, people buy more than they need chiefly because of advertising and social comparison, and the consequences include personal debt and serious environmental harm. A shift towards more mindful, sustainable consumption would clearly benefit everyone.",
  },
  {
    id: "t2-arts-funding",
    type: "task2",
    qType: "Opinion (agree / disagree)",
    title: "Public money for the arts",
    prompt:
      "Some people believe that governments should spend public money on " +
      "essential services such as healthcare and education, rather than on " +
      "supporting the arts, for example music and painting.\n\n" +
      "To what extent do you agree or disagree?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "It is sometimes claimed that public funds are better directed towards vital services like hospitals and schools than towards artistic activities such as music or painting. While I accept that essential services must come first, I disagree that the arts should therefore be denied government support.\n\n" +
      "Admittedly, there is a strong case for prioritising healthcare and education. These services meet fundamental human needs: a society that cannot treat its sick or teach its children is failing in its most basic duties. When budgets are limited, it would be irresponsible to fund a new concert hall while hospitals lack beds, and to this extent the argument has obvious merit.\n\n" +
      "However, it does not follow that the arts deserve no public money at all. Culture is not a luxury but an essential part of a healthy society. Music, painting and theatre enrich people's lives, preserve national identity and foster creativity, the very quality that drives innovation in science and industry. Moreover, the arts are economically valuable, attracting tourists and supporting employment; many cities owe their prosperity largely to their galleries, festivals and museums.\n\n" +
      "The sensible approach, therefore, is one of balance rather than choice. Governments can and should fund essential services generously while still devoting a modest share of the budget to cultural life.\n\n" +
      "In conclusion, although healthcare and education must take priority, I firmly believe that abandoning public support for the arts would impoverish society, and I therefore disagree with the statement.",
  },
];

/* --------------------- IELTS public band descriptors --------------------- */
/* Condensed from the official IELTS Writing band descriptors (bands 5-9),
   used to keep the AI examiner calibrated. */

const BAND_DESCRIPTORS = {
  task1: {
    name: "Task Achievement",
    bands: {
      "9": "Fully satisfies all requirements; clearly presents a fully developed overview and key features.",
      "8": "Covers all requirements sufficiently; clear overview; key features well selected and highlighted.",
      "7": "Covers requirements; clear overview of main trends/stages; highlights key features but could be more fully extended; some irrelevant/inaccurate detail may appear.",
      "6": "Addresses requirements; presents an overview but key features may be inadequately covered; some detail may be irrelevant, inappropriate or inaccurate; may confuse a process with a figure.",
      "5": "Generally addresses the task but format may be inappropriate; recounts detail mechanically with NO clear overview; figures may be inaccurate; may lack data/key features.",
    },
  },
  task2: {
    name: "Task Response",
    bands: {
      "9": "Fully addresses all parts; presents a fully developed position with relevant, fully extended, well-supported ideas.",
      "8": "Sufficiently addresses all parts; well-developed response with relevant, extended and supported ideas.",
      "7": "Addresses all parts though some more than others; clear position throughout; main ideas extended/supported but may over-generalise or lack focus.",
      "6": "Addresses all parts though some more than others; relevant position but conclusions may be unclear/repetitive; ideas relevant but some inadequately developed/unclear.",
      "5": "Addresses the task only partially; position expressed but development not always clear; some main ideas limited, not sufficiently developed or irrelevant.",
    },
  },
  coherence_cohesion: {
    name: "Coherence & Cohesion",
    bands: {
      "9": "Cohesion used so well it attracts no attention; skilful paragraphing.",
      "8": "Sequences information logically; manages all cohesive devices well; paragraphing as required.",
      "7": "Logically organises information; clear progression; uses cohesive devices appropriately though there may be some under-/over-use; clear central topic in each paragraph.",
      "6": "Arranges information coherently; overall progression; uses cohesive devices effectively but cohesion within/between sentences may be faulty/mechanical; may not always use referencing clearly; paragraphing may be inadequate.",
      "5": "Presents information with some organisation but no overall progression; inadequate/inaccurate/over-use of cohesive devices; may be repetitive; may not write in paragraphs or paragraphing inadequate.",
    },
  },
  lexical_resource: {
    name: "Lexical Resource",
    bands: {
      "9": "Wide range used naturally and flexibly; very rare minor errors only as slips.",
      "8": "Wide range fluently and flexibly to convey precise meanings; skilful use of uncommon items but occasional inaccuracies in word choice/collocation; rare errors in spelling/word formation.",
      "7": "Sufficient range to allow flexibility and precision; uses less common items with some awareness of style/collocation; occasional errors in word choice, spelling and/or word formation.",
      "6": "Adequate range for the task; attempts less common vocabulary but with some inaccuracy; makes some errors in spelling/word formation but they do not impede communication.",
      "5": "Limited range, minimally adequate; noticeable errors in spelling/word formation that may cause some difficulty for the reader.",
    },
  },
  grammatical_range_accuracy: {
    name: "Grammatical Range & Accuracy",
    bands: {
      "9": "Wide range used fully flexibly and accurately; very rare minor errors only as slips.",
      "8": "Wide range of structures; majority of sentences error-free; only very occasional errors/inappropriacies.",
      "7": "Variety of complex structures; frequent error-free sentences; good control of grammar/punctuation but a few errors remain.",
      "6": "Mix of simple and complex sentence forms; some errors in grammar and punctuation but they rarely reduce communication.",
      "5": "Limited range of structures; attempts complex sentences but these tend to be less accurate than simple ones; may make frequent grammar errors and punctuation may be faulty; errors can cause some difficulty for the reader.",
    },
  },
};

window.IELTS_DATA = { TASK1, TASK2, BAND_DESCRIPTORS };
