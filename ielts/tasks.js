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
    id: "t1-internet-users-line",
    type: "task1",
    chartKind: "line",
    title: "Internet users by region, 2000–2020",
    prompt:
      "The line graph below shows the percentage of the population using the " +
      "internet in three regions of the world between 2000 and 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "line",
      yLabel: "Population using internet (%)",
      xLabels: ["2000", "2005", "2010", "2015", "2020"],
      yMax: 100,
      series: [
        { name: "North America", color: "#2563eb", values: [44, 67, 79, 84, 90] },
        { name: "Europe",        color: "#dc2626", values: [22, 49, 67, 78, 87] },
        { name: "Sub-Saharan Africa", color: "#059669", values: [1, 4, 11, 20, 30] },
      ],
    },
    dataFacts:
      "Line graph, % of population using the internet, 2000-2020, three regions.\n" +
      "North America: 44% (2000) -> 90% (2020), highest throughout, growth slowed after 2010.\n" +
      "Europe: 22% (2000) -> 87% (2020), strong steady rise, almost catches North America by 2020.\n" +
      "Sub-Saharan Africa: 1% (2000) -> 30% (2020), lowest throughout but grew 30-fold; growth accelerated after 2010.\n" +
      "Overall: digital gap narrowed for Europe vs North America, but Sub-Saharan Africa still well behind despite the fastest relative growth.",
    modelAnswer:
      "The line graph illustrates the proportion of people using the internet in North America, Europe and Sub-Saharan Africa between 2000 and 2020.\n\n" +
      "Overall, internet use rose substantially in all three regions, with North America consistently in the lead and Sub-Saharan Africa lagging well behind despite the most dramatic relative increase.\n\n" +
      "In 2000, internet use was already established in North America at 44%, well above Europe at 22% and almost non-existent in Sub-Saharan Africa at just 1%. Over the next decade, both wealthy regions expanded rapidly: North America climbed to 79% and Europe to 67% by 2010, while Sub-Saharan African usage rose only modestly to around 11%.\n\n" +
      "By 2020, the two leading regions had nearly converged, reaching 90% and 87% respectively, with North American growth visibly slowing as saturation approached. Sub-Saharan Africa, by contrast, accelerated sharply after 2010 to reach 30% by 2020 — a thirty-fold rise over the period, but still less than a third of the levels seen elsewhere.",
  },
  {
    id: "t1-daily-activities-bar",
    type: "task1",
    chartKind: "bar",
    title: "Time spent on daily activities by age group",
    prompt:
      "The bar chart below shows the average number of hours per day people in " +
      "three age groups in one country spent on selected activities in 2023.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "bar",
      yLabel: "Hours per day",
      yMax: 6,
      categories: ["Social media", "Exercise", "Reading", "Watching TV"],
      series: [
        { name: "16–25", color: "#2563eb", values: [4.2, 1.0, 0.4, 1.8] },
        { name: "26–45", color: "#dc2626", values: [2.5, 1.3, 0.6, 2.2] },
        { name: "46–65", color: "#059669", values: [0.9, 1.5, 1.4, 3.6] },
      ],
    },
    dataFacts:
      "Grouped bar chart, hours/day on each activity, 2023, three age groups (16-25, 26-45, 46-65).\n" +
      "Social media: dropped sharply with age, 4.2 (16-25) -> 2.5 (26-45) -> 0.9 (46-65).\n" +
      "Exercise: rose slightly with age, 1.0 -> 1.3 -> 1.5.\n" +
      "Reading: rose with age, 0.4 -> 0.6 -> 1.4.\n" +
      "Watching TV: rose with age, 1.8 -> 2.2 -> 3.6 (biggest single-activity figure overall).\n" +
      "Overall: social media is overwhelmingly a young-people activity; TV, reading and exercise all increase with age. The 16-25 group spends twice as much time on social media as on TV.",
    modelAnswer:
      "The bar chart compares the average daily hours spent on four activities by people in three age bands in 2023.\n\n" +
      "Overall, social media dominated younger people's days but fell sharply with age, while time devoted to television, reading and exercise all rose as people grew older.\n\n" +
      "Among 16-25 year-olds, social media consumed an average of 4.2 hours a day, more than twice as much as television (1.8 hours) and far ahead of exercise (1.0) or reading (just 0.4 hours). The 26-45 group showed a more balanced pattern: social media dropped to 2.5 hours while television rose to 2.2 hours, with exercise and reading inching upwards.\n\n" +
      "The oldest group, 46-65, displayed the opposite priorities. Television became the dominant activity at 3.6 hours per day, while social media fell to under an hour. Reading rose markedly to 1.4 hours and exercise reached its highest level at 1.5 hours, suggesting that physical and traditional pursuits replaced screen-based ones with age.",
  },
  {
    id: "t1-energy-pie",
    type: "task1",
    chartKind: "pie",
    title: "Sources of electricity in one country, 2010 vs 2030 (projected)",
    prompt:
      "The two pie charts below show the sources of electricity generation in " +
      "one country in 2010 and the projected mix for 2030.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "pie",
      charts: [
        { title: "2010", slices: [
          { name: "Coal",        value: 45, color: "#4b5563" },
          { name: "Natural gas", value: 25, color: "#f59e0b" },
          { name: "Nuclear",     value: 20, color: "#dc2626" },
          { name: "Renewables",  value: 10, color: "#059669" },
        ]},
        { title: "2030 (projected)", slices: [
          { name: "Coal",        value: 15, color: "#4b5563" },
          { name: "Natural gas", value: 20, color: "#f59e0b" },
          { name: "Nuclear",     value: 15, color: "#dc2626" },
          { name: "Renewables",  value: 50, color: "#059669" },
        ]},
      ],
    },
    dataFacts:
      "Two pie charts, % share of electricity generation, 2010 vs projected 2030.\n" +
      "2010: Coal 45% (largest), Natural gas 25%, Nuclear 20%, Renewables 10% (smallest).\n" +
      "2030 (projected): Renewables 50% (largest), Natural gas 20%, Coal 15%, Nuclear 15%.\n" +
      "Changes: Coal cut to one-third its previous share (45->15). Renewables five-fold rise (10->50) and overtakes coal to become dominant. Natural gas slight fall (25->20). Nuclear modest fall (20->15).\n" +
      "Overall: a projected reversal — fossil fuels recede and renewables become the leading source.",
    modelAnswer:
      "The two pie charts compare the share of electricity generated by four sources in one country in 2010 and the projected mix for 2030.\n\n" +
      "Overall, the country is forecast to undergo a dramatic shift away from fossil fuels, with renewables expected to grow five-fold and overtake coal as the leading source by 2030.\n\n" +
      "In 2010, coal was by far the dominant source, providing 45% of electricity, followed by natural gas at 25% and nuclear power at 20%. Renewables made the smallest contribution at just 10%.\n\n" +
      "The projected 2030 figures invert this hierarchy. Renewables are expected to rise sharply to 50%, becoming the single biggest source of electricity, while coal is forecast to fall to only 15% — a third of its earlier share. Natural gas and nuclear are also projected to decline modestly, to 20% and 15% respectively. If the projections are accurate, fossil fuels and nuclear together will account for only half of generation, where they once produced 90%.",
  },
  {
    id: "t1-uk-renewables-line",
    type: "task1",
    chartKind: "line",
    title: "Electricity from renewables, UK, 2000–2020",
    prompt:
      "The line graph below shows the percentage of total electricity in the " +
      "United Kingdom generated from three renewable sources between 2000 " +
      "and 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "line",
      yLabel: "% of total electricity",
      xLabels: ["2000","2005","2010","2015","2020"],
      yMax: 30,
      series: [
        { name: "Wind",   color: "#2563eb", values: [0.5, 1.5, 3, 12, 24] },
        { name: "Solar",  color: "#f59e0b", values: [0, 0, 0.1, 2, 4] },
        { name: "Hydro",  color: "#059669", values: [1.5, 1.5, 1.6, 1.7, 1.8] },
      ],
    },
    dataFacts:
      "Line graph, % of UK electricity from renewables, 2000-2020.\n" +
      "Wind: rose from 0.5% (2000) to 24% (2020), the strongest growth, slow at first then sharp acceleration after 2010.\n" +
      "Solar: effectively zero until ~2010, then rose to 4% by 2020.\n" +
      "Hydro: almost flat across the period, 1.5% -> 1.8%.\n" +
      "Overall: wind became overwhelmingly the dominant renewable; solar emerged as a meaningful contributor; hydro stagnated.",
    modelAnswer:
      "The line graph illustrates the share of total UK electricity generated from wind, solar and hydropower over a twenty-year period from 2000 to 2020.\n\n" +
      "Overall, wind power expanded dramatically to become the leading renewable source, while solar emerged from nothing to contribute meaningfully by the end of the period. Hydroelectric generation, by contrast, remained almost unchanged throughout.\n\n" +
      "In 2000, renewables accounted for only a tiny fraction of electricity, with hydropower providing 1.5%, wind 0.5% and solar virtually nothing. Over the following decade growth was modest: wind reached just 3% by 2010 and solar was still negligible at 0.1%, while hydro held steady.\n\n" +
      "The picture changed sharply after 2010. Wind generation accelerated, climbing to 12% by 2015 and then to 24% by 2020 — almost a fiftyfold increase over the period. Solar followed a similar but smaller trajectory, rising to 2% by 2015 and 4% by 2020. Hydro continued to plateau at under 2% throughout. By 2020, almost a third of British electricity came from these three renewables combined.",
  },
  {
    id: "t1-cars-by-income-bar",
    type: "task1",
    chartKind: "bar",
    title: "Car ownership by household income, 2022",
    prompt:
      "The bar chart below shows the percentage of households that owned no " +
      "car, one car, or two or more cars, in three household-income bands in " +
      "one country in 2022.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "bar",
      yLabel: "% of households",
      yMax: 80,
      categories: ["Low income", "Middle income", "High income"],
      series: [
        { name: "No car",     color: "#dc2626", values: [55, 18, 5] },
        { name: "One car",    color: "#2563eb", values: [38, 52, 30] },
        { name: "2+ cars",    color: "#059669", values: [7, 30, 65] },
      ],
    },
    dataFacts:
      "Grouped bar chart, % of households by car ownership, three income bands, 2022.\n" +
      "Low income: 55% own no car (biggest single figure), 38% one car, 7% two or more.\n" +
      "Middle income: 18% no car, 52% one car (the dominant pattern), 30% two or more.\n" +
      "High income: 5% no car, 30% one car, 65% two or more cars (the dominant pattern).\n" +
      "Overall: clear monotonic relationship — more income, more cars. The single-car group peaks in the middle band; the no-car and 2+ groups sit at opposite extremes.",
    modelAnswer:
      "The bar chart compares car-ownership patterns across three household-income bands in one country in 2022.\n\n" +
      "Overall, there is a clear positive relationship between income and the number of cars owned: households with no car cluster in the lowest income band, while multi-car households dominate at the top.\n\n" +
      "Among low-income households, the majority (55%) did not own a car at all, with a further 38% owning a single vehicle. Just 7% had two or more cars — by far the smallest figure in that group. The picture shifted markedly for middle-income households, where the single-car pattern dominated at 52%. Within this group only 18% were car-less, while almost a third had multiple vehicles.\n\n" +
      "Among high-income households the pattern was reversed: nearly two-thirds (65%) owned two or more cars, 30% owned a single car, and only 5% had no car. Strikingly, the proportion of two-car households climbed from 7% to 65% across the three income bands — a near tenfold increase that highlights how strongly car ownership tracks income.",
  },
  {
    id: "t1-employment-table",
    type: "task1",
    chartKind: "table",
    title: "Employment by sector, four countries, 2020",
    prompt:
      "The table below shows the percentage of the labour force employed in " +
      "agriculture, industry and services in four countries in 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "table",
      columns: ["Country", "Agriculture (%)", "Industry (%)", "Services (%)"],
      rows: [
        ["Country W", "2",  "18", "80"],
        ["Country X", "8",  "25", "67"],
        ["Country Y", "30", "22", "48"],
        ["Country Z", "55", "15", "30"],
      ],
    },
    dataFacts:
      "Table, % of labour force by sector, four countries, 2020.\n" +
      "Country W: services 80% (dominant), industry 18%, agriculture 2% (smallest). Pattern typical of advanced economies.\n" +
      "Country X: services 67%, industry 25%, agriculture 8%.\n" +
      "Country Y: agriculture 30%, industry 22%, services 48% — mixed-economy pattern.\n" +
      "Country Z: agriculture 55% (dominant), services 30%, industry 15%. Developing-economy pattern.\n" +
      "Overall: as you move from W to Z, the share in agriculture rises and the share in services falls. Services dominate in W and X; agriculture dominates in Z. Industry stays roughly between 15% and 25% in every country.",
    modelAnswer:
      "The table compares the proportion of the labour force employed in agriculture, industry and services in four countries (W, X, Y and Z) in 2020.\n\n" +
      "Overall, the four countries display strikingly different economic profiles: services dominate the workforce in W and X, whereas agriculture is by far the largest sector in Z. Industry remains within a relatively narrow band across all four.\n\n" +
      "In Country W, services accounted for 80% of jobs, with only 18% in industry and a tiny 2% in agriculture, suggesting a highly developed post-industrial economy. Country X followed a similar pattern at 67% services, 25% industry and 8% agriculture, though its industrial sector was somewhat larger.\n\n" +
      "Country Y showed a much more balanced distribution: 48% in services, 30% in agriculture and 22% in industry. Country Z, by contrast, was dominated by agriculture at 55%, with services at 30% and industry only 15% — a pattern typical of a still-developing economy. The clearest single trend, moving from W to Z, is the rise of agriculture from 2% to 55% and the corresponding decline of services from 80% to 30%.",
  },
  {
    id: "t1-coffee-process",
    type: "task1",
    chartKind: "process",
    title: "How instant coffee is produced",
    prompt:
      "The diagram below shows the stages involved in the production of " +
      "instant (soluble) coffee from coffee cherries to packaged product.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "process",
      steps: [
        "Coffee cherries picked from trees",
        "Beans extracted and washed",
        "Dried in the sun for several days",
        "Roasted in industrial ovens",
        "Ground into fine particles",
        "Brewed with hot water under high pressure",
        "Brewed liquid is freeze-dried into crystals",
        "Crystals packaged into jars and sealed",
      ],
      cyclic: false,
    },
    dataFacts:
      "Process diagram, linear, 8 stages, manufacture of instant coffee.\n" +
      "1 Cherries picked. 2 Beans extracted and washed. 3 Sun-dried. 4 Roasted. 5 Ground. 6 Brewed with hot water under pressure. 7 Brewed liquid freeze-dried into crystals. 8 Crystals packaged into jars.\n" +
      "Linear (not cyclical). Inputs: raw cherries. Output: sealed jars of soluble coffee.\n" +
      "Key transitions: raw cherry -> roasted bean (steps 1-4), bean -> brewed liquid (steps 5-6), liquid -> dry crystal -> packaged (steps 7-8).",
    modelAnswer:
      "The diagram illustrates the eight stages involved in producing instant coffee, beginning with the harvesting of fresh coffee cherries and ending with sealed jars ready for sale. Overall, the process is linear and can be divided into three broad phases: preparing the beans, extracting the liquid coffee, and converting it into a dry, soluble form.\n\n" +
      "At the first stage, ripe coffee cherries are picked from the trees, and the beans inside are removed and washed thoroughly. The cleaned beans are then laid out in the sun and dried for several days to reduce their moisture content. Once dry, the beans are roasted in large industrial ovens and subsequently ground into fine particles.\n\n" +
      "In the next phase, the ground coffee is brewed with hot water under high pressure, producing a concentrated liquid. This brewed liquid is then freeze-dried, a process that removes the water and leaves behind small soluble crystals.\n\n" +
      "In the final stage, the crystals are packaged into glass jars, sealed and prepared for distribution. The product can subsequently be reconstituted into a drink by adding hot water at home.",
  },
  {
    id: "t1-uni-funding-pie",
    type: "task1",
    chartKind: "pie",
    title: "Sources of university funding, 1990 vs 2020",
    prompt:
      "The two pie charts below show the main sources of funding for " +
      "universities in one country in 1990 and in 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "pie",
      charts: [
        { title: "1990", slices: [
          { name: "Government grants", value: 70, color: "#2563eb" },
          { name: "Tuition fees",      value: 10, color: "#dc2626" },
          { name: "Research contracts",value: 15, color: "#059669" },
          { name: "Donations",         value:  5, color: "#f59e0b" },
        ]},
        { title: "2020", slices: [
          { name: "Government grants", value: 25, color: "#2563eb" },
          { name: "Tuition fees",      value: 50, color: "#dc2626" },
          { name: "Research contracts",value: 18, color: "#059669" },
          { name: "Donations",         value:  7, color: "#f59e0b" },
        ]},
      ],
    },
    dataFacts:
      "Two pie charts, % of university funding by source, 1990 vs 2020.\n" +
      "1990: Government grants 70% (dominant), Research contracts 15%, Tuition fees 10%, Donations 5%.\n" +
      "2020: Tuition fees 50% (largest), Government grants 25%, Research contracts 18%, Donations 7%.\n" +
      "Changes: Government grants fell sharply from 70% to 25% (-45 pts). Tuition fees rose dramatically from 10% to 50% (+40 pts). Research contracts and donations both grew slightly.\n" +
      "Overall: a fundamental shift from public to private funding. Universities went from being mainly state-funded to being mainly fee-funded.",
    modelAnswer:
      "The two pie charts compare the main sources of university funding in one country in 1990 and in 2020.\n\n" +
      "Overall, the most striking change was a fundamental shift from public to private funding: government grants, which once dominated, were largely replaced by tuition fees as the principal source of income.\n\n" +
      "In 1990, government grants made up 70% of total funding, dwarfing all other sources. Research contracts contributed a further 15%, while tuition fees and donations were comparatively minor, at 10% and 5% respectively.\n\n" +
      "By 2020 the picture had reversed. Tuition fees had become the single largest source at 50% of total funding, while government grants had fallen sharply to just 25% — barely a third of their earlier share. Research contracts inched up to 18% and donations to 7%, but the dominant story was the rebalancing between the two largest categories. Universities had effectively moved from being mainly state-funded institutions to being primarily fee-funded ones over the three decades.",
  },
  {
    id: "t1-population-cities-line",
    type: "task1",
    chartKind: "line",
    title: "Population of four cities, 1980–2020",
    prompt:
      "The line graph below shows the population (in millions) of four " +
      "cities around the world between 1980 and 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "line",
      yLabel: "Population (millions)",
      xLabels: ["1980","1990","2000","2010","2020"],
      yMax: 25,
      series: [
        { name: "Tokyo",       color: "#2563eb", values: [16, 17, 18, 19, 19] },
        { name: "São Paulo",   color: "#dc2626", values: [12, 15, 17, 19, 22] },
        { name: "Lagos",       color: "#059669", values: [3, 5, 8, 12, 18] },
        { name: "London",      color: "#f59e0b", values: [7, 7, 7, 8, 9] },
      ],
    },
    dataFacts:
      "Line graph, population in millions, four cities, 1980-2020.\n" +
      "Tokyo: started highest at 16m (1980), modest growth to 19m by 2020. Plateaued in last decade.\n" +
      "São Paulo: 12m (1980) -> 22m (2020), the highest figure by the end. Steady growth.\n" +
      "Lagos: 3m (1980) -> 18m (2020), the most dramatic growth, six-fold rise, accelerating.\n" +
      "London: nearly flat at 7m through 2000, then modest rise to 9m by 2020. The smallest population throughout.\n" +
      "Overall: developing-world megacities (Lagos, São Paulo) grew far faster than developed-world capitals (Tokyo, London). By 2020 São Paulo was largest; Lagos had overtaken Tokyo.",
    modelAnswer:
      "The line graph illustrates how the populations of four major world cities — Tokyo, São Paulo, Lagos and London — changed over the four decades from 1980 to 2020.\n\n" +
      "Overall, the two developing-world cities, Lagos and São Paulo, experienced by far the greatest growth, while the two developed-world cities, Tokyo and London, grew much more slowly. By the end of the period the ranking of city sizes had changed significantly.\n\n" +
      "In 1980, Tokyo was clearly the largest of the four at 16 million, followed by São Paulo at 12 million, London at 7 million and Lagos at just 3 million. Over the following two decades, Tokyo grew modestly to 18 million and London barely changed, while São Paulo climbed steadily to 17 million.\n\n" +
      "The contrast became sharper after 2000. São Paulo continued to expand rapidly, reaching 22 million by 2020 to become the largest of the four. Lagos exploded from 8 million in 2000 to 18 million in 2020, overtaking Tokyo, which had plateaued at 19 million. London edged up to 9 million but remained by far the smallest, illustrating how urban growth has shifted decisively towards the developing world.",
  },
  {
    id: "t1-tourists-bar",
    type: "task1",
    chartKind: "bar",
    title: "International tourist arrivals at four destinations, 2000 vs 2020",
    prompt:
      "The bar chart below compares the number of international tourist " +
      "arrivals (in millions) at four well-known destinations in 2000 and " +
      "in 2020.",
    instruction: TASK1_INSTRUCTION,
    chart: {
      kind: "bar",
      yLabel: "International arrivals (millions)",
      yMax: 100,
      categories: ["France","Spain","Thailand","Egypt"],
      series: [
        { name: "2000", color: "#2563eb", values: [77, 47, 10, 5] },
        { name: "2020", color: "#f59e0b", values: [40, 19, 7, 4] },
      ],
    },
    dataFacts:
      "Grouped bar chart, international arrivals in millions, 4 destinations, 2000 vs 2020.\n" +
      "France: 77m (2000) -> 40m (2020), biggest absolute fall (-37m). Still the highest figure in both years.\n" +
      "Spain: 47m -> 19m (-28m fall, roughly halved).\n" +
      "Thailand: 10m -> 7m (small fall).\n" +
      "Egypt: 5m -> 4m (small fall).\n" +
      "Overall: all four destinations lost visitors over the period — likely reflecting the 2020 pandemic disruption. France and Spain saw very large absolute falls but remained the most-visited; Thailand and Egypt fell less in absolute terms but proportionally also lost a third or so. Rank order unchanged.",
    modelAnswer:
      "The bar chart compares the number of international tourist arrivals at four destinations — France, Spain, Thailand and Egypt — in 2000 and 2020.\n\n" +
      "Overall, every destination received fewer international visitors in 2020 than in 2000, but the absolute scale of the decline was far greater in Europe than in Asia or Africa. The relative ranking of the four countries was unchanged across the period.\n\n" +
      "France attracted by far the largest number of tourists in both years, although its figure fell sharply from 77 million in 2000 to 40 million in 2020 — a drop of nearly 50%. Spain, the second-most-visited destination, followed a similar pattern, declining from 47 million to 19 million over the same period.\n\n" +
      "The two smaller destinations also saw declines but on a much smaller absolute scale. Thailand's arrivals slipped from 10 million to 7 million, and Egypt's from 5 million to 4 million. Although the headline drops in France and Spain are visually dominant, in proportional terms all four destinations lost roughly a third to a half of their visitors, suggesting a broad and uneven contraction in global tourism by the end of the period.",
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
    id: "t2-smartphones",
    type: "task2",
    qType: "Advantages / disadvantages",
    title: "Smartphones in daily life",
    prompt:
      "The widespread use of smartphones has changed the way people live, work " +
      "and communicate with one another.\n\n" +
      "Do the advantages of this development outweigh the disadvantages?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "Smartphones have become an inseparable feature of modern life, reshaping everything from how we keep in touch to how we navigate, shop and earn a living. Although their impact has not been wholly positive, I believe the advantages they offer clearly outweigh the drawbacks.\n\n" +
      "The most obvious benefit is sheer convenience. A single device now performs the functions that once required a camera, a map, a wallet, a notebook and a desktop computer. This has saved enormous amounts of time and made services such as banking, healthcare and education accessible to people in remote areas who would otherwise struggle to reach them. Smartphones have also democratised information: anyone with a connection can access news, online courses and professional networks that were previously the preserve of the privileged few.\n\n" +
      "On the negative side, smartphones can be addictive and have been linked to falling attention spans, disrupted sleep and rising anxiety, particularly among teenagers. The constant availability they create has also blurred the line between work and personal life, leaving many people unable to switch off. Privacy concerns add a further worry, as enormous amounts of personal data flow through these devices every day.\n\n" +
      "However, most of these problems stem from how smartphones are used rather than from the devices themselves. Sensible habits, clearer workplace boundaries and better digital-literacy education in schools can mitigate the harm without sacrificing the benefits.\n\n" +
      "On balance, the gains in convenience, connectivity and access to information far exceed the costs, and I am convinced that the advantages of widespread smartphone use outweigh its disadvantages.",
  },
  {
    id: "t2-climate-individuals",
    type: "task2",
    qType: "Opinion (agree / disagree)",
    title: "Climate change and individual action",
    prompt:
      "Some people believe that climate change is too big a problem to be " +
      "solved by individuals, and that only governments and large companies " +
      "can make a real difference.\n\n" +
      "To what extent do you agree or disagree?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "There is a common view that ordinary people are powerless against a challenge as vast as climate change, and that meaningful progress can only come from governments and major industries. I partly accept this argument but ultimately disagree, because individual choices remain an essential part of any genuine solution.\n\n" +
      "It is undeniable that the largest sources of emissions sit firmly outside personal control. Industrial agriculture, fossil-fuel power generation and global supply chains together produce the vast majority of greenhouse gases, and only governments can set the regulations, taxes and subsidies that reshape these systems. International treaties, large-scale clean-energy investment and bans on the most polluting practices are decisions no individual can make alone, so to that extent the argument has clear merit.\n\n" +
      "Nevertheless, treating individuals as powerless is both inaccurate and unhelpful. Personal choices — driving less, eating less meat, insulating homes, voting and pressuring employers — together account for a significant proportion of national emissions in wealthy countries. Moreover, citizens are the ones who elect governments and buy from companies; without sustained public demand for cleaner products and stricter policies, neither will move quickly enough. The success of recycling, the rapid uptake of electric cars and the rise of plant-based diets all show how individual behaviour can shift entire markets.\n\n" +
      "In conclusion, while the heaviest lifting must indeed be done by governments and corporations, I disagree that individual action is irrelevant. The two operate together: institutional change creates the conditions for personal action, and personal action creates the political pressure that drives institutional change.",
  },
  {
    id: "t2-youth-employment",
    type: "task2",
    qType: "Two-part (direct) question",
    title: "Youth unemployment",
    prompt:
      "In many countries, young people today find it more difficult to secure " +
      "well-paid, stable jobs than previous generations did.\n\n" +
      "What are the reasons for this? What can governments and employers do " +
      "to address the problem?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "Across much of the world, young adults today face a far harder route into secure, well-paid employment than their parents did a generation ago. This essay will examine why this is happening and suggest what governments and employers can do to improve matters.\n\n" +
      "Several factors lie behind the problem. The first is structural: automation and the offshoring of routine work have hollowed out the entry-level jobs that once gave young people their first foothold in the labour market. The second is educational: while university participation has expanded rapidly, the skills many graduates leave with often do not match what employers actually need, particularly in technical and digital fields. A third factor is the rise of insecure, gig-style contracts, which leave young workers without the training, pensions and progression that previous generations could take for granted.\n\n" +
      "There are clear steps that policymakers and businesses could take to ease this situation. Governments could invest more heavily in vocational training and high-quality apprenticeships, giving young people credible alternatives to often-expensive university degrees. They could also use tax incentives and labour-law reform to encourage employers to offer secure contracts and proper training for new entrants. For their part, employers should treat early-career talent as a long-term investment rather than disposable labour, providing structured mentorship, transparent progression and fair entry-level pay.\n\n" +
      "In conclusion, young people's difficulty in finding good jobs stems from a combination of automation, mismatched education and the spread of insecure work. By rebuilding the bridge between education and employment, and by restoring stability to entry-level roles, governments and employers can give the next generation a genuine chance to flourish.",
  },
  {
    id: "t2-children-internet",
    type: "task2",
    qType: "Opinion (agree / disagree)",
    title: "Children's unsupervised internet access",
    prompt:
      "Some people believe that children under the age of twelve should not " +
      "be allowed to access the internet without an adult present.\n\n" +
      "To what extent do you agree or disagree?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "It is sometimes argued that children under the age of twelve should always be accompanied by an adult when going online. I largely agree with this view, because of the genuine risks young children face on the internet and their limited ability to assess them.\n\n" +
      "The main reason for supervising young users is exposure to harmful content. Search results, video platforms and social networks routinely surface violent, sexual or extremist material that even motivated parental controls do not fully filter. A child of seven or eight lacks the cognitive maturity to interpret such content critically, and a single bad encounter can cause lasting distress. An adult presence dramatically reduces this risk.\n\n" +
      "A second concern is exploitation. Predators target unsupervised children through chat features in games and apps, often pretending to be peers. Twelve is a reasonable upper threshold for routine supervision because it broadly aligns with the start of secondary education, when children begin to develop the social judgement needed to recognise these threats themselves.\n\n" +
      "Some object that constant supervision stifles independence and digital literacy. There is force in this argument, but it does not justify leaving very young children entirely alone online. A workable compromise is structured, supervised use — children watching a video alongside a parent, or completing a homework search with an adult nearby — which teaches digital skills without the obvious dangers.\n\n" +
      "In conclusion, although blanket supervision has minor drawbacks, the protection it offers from harmful content and exploitation clearly outweighs them. I therefore agree that children under twelve should not generally use the internet without an adult present.",
  },
  {
    id: "t2-zoos",
    type: "task2",
    qType: "Discussion (both views + opinion)",
    title: "Zoos: cruelty or conservation?",
    prompt:
      "Some people believe that zoos are cruel and that wild animals should " +
      "not be kept in captivity. Others argue that zoos play an important " +
      "role in conservation and public education.\n\n" +
      "Discuss both views and give your own opinion.",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "Opinions on zoos are sharply divided. While critics view them as fundamentally cruel, defenders point to their value in protecting endangered species and educating the public. Both sides have merit, but in my view a well-run modern zoo does more good than harm.\n\n" +
      "Those who oppose zoos argue that confining wild animals to enclosures, however spacious, denies them a natural existence. Large predators in particular suffer from restricted movement and abnormal behaviours such as pacing or self-harm. Critics also note that many older zoos exist primarily as commercial attractions, with welfare standards driven by profit rather than animal needs.\n\n" +
      "On the other hand, the defence of modern zoos rests on two strong arguments. First, accredited zoos run sophisticated breeding programmes that have rescued species — the Arabian oryx and the California condor among them — from near-extinction. Second, zoos give millions of urban families their only realistic chance to see and learn about wildlife. This exposure builds the public sympathy and political pressure needed to fund habitat protection in the wild.\n\n" +
      "In my opinion, the issue is not zoos in principle but zoos in practice. Roadside menageries that exist purely for spectacle should be closed, but properly accredited institutions — with large enclosures, qualified veterinary care and a clear conservation mission — make a genuine contribution that the wild simply cannot guarantee.\n\n" +
      "In conclusion, while the cruelty argument applies to badly-run facilities, modern conservation zoos play an essential role in protecting wildlife and educating the public, and on balance I believe such institutions should be supported.",
  },
  {
    id: "t2-mass-tourism",
    type: "task2",
    qType: "Advantages / disadvantages",
    title: "Mass tourism",
    prompt:
      "Increasing numbers of tourists now visit famous cultural and natural " +
      "sites around the world.\n\n" +
      "Do the advantages of this trend outweigh the disadvantages?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "The number of people travelling internationally to visit famous cultural landmarks and natural wonders has risen dramatically in recent decades. Although this mass tourism brings real benefits, I believe its disadvantages now slightly outweigh them.\n\n" +
      "On the positive side, tourism is an enormous source of income for the host country. Hotels, restaurants, transport and craft industries together support millions of jobs, often in regions with few alternatives. Tourism also funds the maintenance of cultural sites: many ancient monuments would simply fall into disrepair without the revenue brought in by visitors. Less tangibly, exposure to other cultures can foster international understanding and reduce prejudice.\n\n" +
      "However, the disadvantages have grown sharper as visitor numbers have soared. Iconic sites such as Venice, Machu Picchu or Mount Everest are now physically damaged by the sheer volume of footfall, and their fragile ecosystems and historic structures cannot easily recover. Local residents in popular cities increasingly find themselves priced out of housing by short-term rentals, while their neighbourhoods are reshaped to serve visitors rather than communities. Mass tourism also generates significant carbon emissions, particularly from air travel.\n\n" +
      "Defenders of the status quo argue that these problems can be managed through visitor caps, tourist taxes and better infrastructure. I agree that such measures help, but the pace at which tourism is growing has so far outstripped the will of authorities to enforce them.\n\n" +
      "In conclusion, while tourism brings genuine economic and cultural benefits, the cumulative damage to sites, communities and the environment is now too serious to ignore. On balance, the disadvantages of mass tourism appear to outweigh its advantages.",
  },
  {
    id: "t2-bilingual-primary",
    type: "task2",
    qType: "Opinion (agree / disagree)",
    title: "Second language from primary school",
    prompt:
      "Some people believe that all children should begin learning a second " +
      "language at primary school, while others think foreign-language " +
      "study should be left until secondary school.\n\n" +
      "Discuss both views and give your own opinion.",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "There is a long-running debate about when foreign-language learning should begin. Some maintain it should start as soon as children enter primary school, while others argue that secondary school is early enough. Both positions have merit, but I personally favour the earlier start.\n\n" +
      "Supporters of delaying language study until secondary school point out that primary-age children already have a great deal to absorb — reading, writing, numeracy and basic social skills — and adding another language risks overloading them. They also argue that secondary-school students learn languages more efficiently because they can already analyse grammar consciously and apply explicit study techniques.\n\n" +
      "The case for starting earlier, however, rests on well-established evidence that young children acquire languages with a fluency and accent that older learners rarely match. Their brains are still in a critical period for phonological learning, and they absorb new vocabulary almost effortlessly through play, song and conversation. Beginning at six or seven, even with only a few hours per week, lays a foundation that pays compounding returns throughout secondary school.\n\n" +
      "In my view, the secondary-school argument confuses depth with breadth. Younger children may not analyse a language formally, but they internalise it in a way that is extremely hard to reproduce later. The risk of overload can be mitigated by teaching languages through games, stories and simple conversation rather than formal grammar drills.\n\n" +
      "In conclusion, although delaying language study has some practical appeal, the developmental advantages of an early start are too significant to ignore. I therefore believe primary schools should introduce a second language as standard.",
  },
  {
    id: "t2-elderly-care",
    type: "task2",
    qType: "Discussion (both views + opinion)",
    title: "Elderly care",
    prompt:
      "Some people believe that elderly relatives should live with their " +
      "families and be cared for at home. Others think that they are better " +
      "looked after in professional care homes.\n\n" +
      "Discuss both views and give your own opinion.",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "As populations age, families across the world are facing difficult decisions about how to care for elderly relatives. Some believe older people should remain in the family home, while others argue that professional care homes provide better support. I think both options have a place, but a hybrid approach is usually the strongest.\n\n" +
      "Those who favour home care point to the emotional and cultural benefits. Living among children and grandchildren preserves the elderly person's sense of identity, maintains their relationships and avoids the loneliness that can settle in institutional settings. There are also practical savings, since professional care is often costly, and many cultures regard supporting older relatives as a fundamental duty.\n\n" +
      "On the other hand, advocates of professional care homes highlight the realities of modern life. Few adult children can take time away from full-time work to provide round-the-clock care, especially when a relative has dementia or a serious medical condition. Trained staff can administer medication safely, manage emergencies and offer specialist services that families simply cannot provide at home. Good care homes also encourage social activity among peers, which can lift mood and slow cognitive decline.\n\n" +
      "In my view, the right answer depends on the elderly person's health. Where someone is broadly independent, home life with regular family contact is clearly preferable. Once medical needs become complex, however, a high-quality care home is often safer and more comfortable for everyone, including the relative.\n\n" +
      "In conclusion, while home care is the ideal in principle, professional care becomes essential as needs grow. Families should not feel guilty about combining the two as circumstances change.",
  },
  {
    id: "t2-public-transport",
    type: "task2",
    qType: "Problem / causes & solutions",
    title: "Inadequate public transport",
    prompt:
      "In many cities, public transport is inadequate and most people rely " +
      "on private cars.\n\n" +
      "What are the causes of this problem and what measures could improve " +
      "public transport?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "In a great many cities, buses and trains are unreliable, slow or simply absent, leaving residents little option but to drive. This essay will examine the causes of inadequate public transport before suggesting ways it could be improved.\n\n" +
      "Several factors lie behind the problem. The first is decades of underinvestment: when fuel was cheap and city planners assumed car ownership would keep rising, governments built motorways instead of metros. The second is the political economy of road-building, which produces visible, ribbon-cutting projects, whereas slow, complicated rail or bus upgrades attract less attention from voters. A third cause is sprawling urban design — when homes, workplaces and shops are spread thinly across a large area, no transit network can serve them efficiently.\n\n" +
      "Several measures could turn the situation around. Most importantly, governments should commit to sustained, multi-decade investment in efficient mass transit: dedicated bus lanes that bypass traffic, modern metros in larger cities and reliable suburban rail. To make these systems genuinely attractive, fares must be affordable and services frequent, ideally turn-up-and-go rather than rigidly timetabled. In parallel, congestion charges or workplace parking levies make driving less appealing, encouraging the shift in behaviour that infrastructure alone cannot deliver.\n\n" +
      "In the longer term, cities should also be redesigned around denser, mixed-use neighbourhoods in which walking and cycling can replace many short car journeys altogether, reducing the burden on public transport itself.\n\n" +
      "In conclusion, inadequate public transport reflects past neglect and poor planning rather than any inevitable preference for cars. With sustained investment, smarter pricing and better urban design, cities can offer their residents a real alternative to driving.",
  },
  {
    id: "t2-women-stem",
    type: "task2",
    qType: "Two-part (direct) question",
    title: "Women in science and engineering",
    prompt:
      "In most countries, women are still significantly under-represented in " +
      "science and engineering professions.\n\n" +
      "Why is this the case, and what measures could be taken to address it?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "Despite decades of progress, women remain a clear minority in most science and engineering professions. This essay will examine the principal reasons for this imbalance and consider what could be done to correct it.\n\n" +
      "Several factors explain the under-representation. The most fundamental is cultural: girls are still routinely steered, sometimes subtly, towards subjects considered more 'feminine', and many lose interest in science around adolescence. Once they reach university, a shortage of female role models reinforces the impression that these are male fields. A second factor is the workplace itself: long-hours cultures, limited part-time options and inadequate parental leave all push women out at the point when they would otherwise be moving into senior technical roles.\n\n" +
      "A range of measures could shift the picture. In schools, gender-neutral careers advice and high-visibility female scientists in the curriculum would broaden girls' sense of what is possible. Universities should also expand outreach programmes and ensure their teaching environments are genuinely welcoming, with zero tolerance for harassment. Within industry, structural changes matter most: properly paid parental leave for both parents, transparent promotion criteria and flexible working would remove much of the penalty that women currently pay for combining a technical career with family life.\n\n" +
      "Targeted scholarships and mentoring schemes can also accelerate change, although these should be framed as redressing an existing imbalance rather than as favours that can be withdrawn.\n\n" +
      "In conclusion, the gender gap in science and engineering reflects cultural conditioning, weak role models and unfriendly workplaces. Tackling all three — in schools, universities and companies — is the only way to build professions that draw on the full talent available.",
  },
  {
    id: "t2-news-online",
    type: "task2",
    qType: "Advantages / disadvantages",
    title: "Online news",
    prompt:
      "Most people now get their news online rather than from newspapers, " +
      "television or radio.\n\n" +
      "Do the advantages of this development outweigh the disadvantages?",
    instruction: TASK2_INSTRUCTION,
    dataFacts: "",
    modelAnswer:
      "The way people get their news has shifted dramatically in the last twenty years, with online sources now overtaking newspapers, television and radio in most countries. Although this change has obvious drawbacks, I believe its advantages remain marginally greater.\n\n" +
      "The most striking benefit is speed and breadth. Major events are reported within minutes of happening, and readers can choose from a far wider range of perspectives than any single national broadcaster could provide. Online news is also more participatory: comments, social-media sharing and citizen journalism let ordinary people contribute reports, photographs and on-the-ground accounts that traditional media would have missed. For many, online news is also more affordable, since a great deal of high-quality reporting is free or cheap to access.\n\n" +
      "The disadvantages, however, are real and growing. The same speed that brings stories to readers also amplifies misinformation, as unverified claims spread before fact-checkers can respond. Algorithmic personalisation tends to surface emotionally engaging content, which often means outrage and polarisation rather than careful reporting. The economic pressure on online publications has hollowed out investigative journalism, and many local newspapers — once the backbone of accountability — have closed.\n\n" +
      "Set against these problems, the gains in immediacy, diversity and accessibility are substantial, but only if readers actively cultivate good habits: subscribing to a few trusted publications, cross-checking surprising claims and engaging beyond their algorithmic bubble.\n\n" +
      "In conclusion, while the shift to online news has weakened careful journalism and accelerated misinformation, it has also democratised access to information on a scale never previously possible. On balance, its advantages just outweigh its disadvantages, provided readers behave responsibly.",
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

/* ============================================================================
   LEARN MASTERY PATH — Master the X modules
   Each module isolates ONE micro-skill that, when fixed, lifts a specific
   criterion. Built for someone stuck at 4.5–6.5 who needs structured practice,
   not just "do another essay and hope it improves".
   ========================================================================== */

const MODULES = [
  {
    id: "mod_intro",
    tier: "foundation",
    title: "Master the Introduction",
    short: "Open every essay strong",
    blocks: "Task Response",
    why: "A weak introduction caps Task Response. Copying the prompt verbatim, or writing 'this essay will discuss', signals 'band 5 candidate' to the examiner before they reach paragraph 2.",
    concept: [
      "An IELTS Task 2 introduction must do THREE things in 2–3 sentences (about 50–70 words):",
      "1. PARAPHRASE the prompt — restate it in your own words.",
      "2. STATE YOUR POSITION clearly — what side of the question do you take?",
      "3. (Optional) PREVIEW your structure — briefly hint at the 2 main ideas you'll develop.",
      "",
      "Never copy the prompt verbatim. Never use 'this essay will discuss' as your position. Never write more than 3 sentences.",
    ],
    examples: [
      {
        kind: "good",
        prompt: "Some people believe universities should be free for all students. To what extent do you agree or disagree?",
        text: "There is a long-running debate about whether higher education should be funded entirely by the state. While supporters argue this guarantees equal access, opponents warn it is unsustainable. In my view, free university tuition is desirable in principle but impractical without major funding reforms.",
        why: "Paraphrases 'universities' → 'higher education', 'free' → 'funded by the state'. States a clear nuanced position. Hints at the body's structure.",
      },
      {
        kind: "good",
        prompt: "In many countries, traffic congestion has become a serious problem. What are the causes, and what could be done to solve it?",
        text: "Congestion in major cities has worsened steadily over the last two decades, slowing daily commutes and inflating commercial costs. This essay will trace the problem to rising private car ownership and weak public transport, and will argue that the most effective response combines investment in transit with smarter road pricing.",
        why: "Paraphrases 'traffic congestion' → 'congestion in major cities', 'serious problem' → 'worsened steadily, slowing commutes'. Commits to specific causes + solution before the body starts.",
      },
      {
        kind: "bad",
        prompt: "Some people believe universities should be free for all students. To what extent do you agree or disagree?",
        text: "Some people believe universities should be free for all students. This essay will discuss this topic and give my opinion.",
        why: "Copies the prompt almost verbatim. 'Will discuss' is empty filler with no actual position. The examiner discounts this opening.",
      },
      {
        kind: "bad",
        prompt: "In many countries, traffic congestion has become a serious problem. What are the causes, and what could be done to solve it?",
        text: "Nowadays, traffic congestion has become a very serious problem in many countries around the world. In this essay, I am going to discuss the causes of this problem and also some solutions that the governments and individuals can do to solve it, as it is very important for our cities and for our environment too.",
        why: "Two sentences, 50+ words wasted. 'Nowadays' / 'very serious' / 'around the world' are empty padding. The whole second sentence is filler. Examiner reads it as Band 5 — wordy and circular.",
      },
    ],
    walkthrough: {
      scenario: "Many people now work from home rather than commute to an office. Do the advantages of this development outweigh the disadvantages?",
      steps: [
        {
          label: "Read the prompt twice. Decode it.",
          thinking: "Question type: 'Do advantages outweigh disadvantages?' — I MUST take a side, not list both equally. Topic: working from home (not 'technology generally', not 'office life generally').",
        },
        {
          label: "Identify the keywords to paraphrase.",
          thinking: "Key nouns/verbs: 'work from home' / 'commute' / 'office'. Brainstorm synonyms: work from home → remote working / flexible working / working from one's residence. Commute to an office → travel to a traditional workplace / make the daily journey to an office.",
        },
        {
          label: "Decide your position BEFORE writing.",
          thinking: "I'll argue advantages clearly outweigh, with one concession for the social cost. That's a band-7 nuanced position — not 'I 100% agree' (too simple) and not 'both sides have merit' (no position).",
        },
        {
          label: "Write sentence 1 — paraphrased opener.",
          thinking: "Pick one paraphrase and use it cleanly. Don't pile up synonyms. Result: 'Remote working has expanded dramatically in recent years, replacing the daily commute for many employees in knowledge-based industries.'",
        },
        {
          label: "Write sentence 2 — state your position.",
          thinking: "Make the position concrete. Don't write 'this essay will discuss'. Write what you actually think. Result: 'While there are genuine social costs to consider, in my view the gains in flexibility, time and cost clearly outweigh them.'",
        },
      ],
      final_text: "Remote working has expanded dramatically in recent years, replacing the daily commute for many employees in knowledge-based industries. While there are genuine social costs to consider, in my view the gains in flexibility, time and cost clearly outweigh them.",
    },
    hints: [
      {
        label: "How do I open without copying the prompt?",
        text: "Find 2–3 key nouns/verbs in the prompt. Brainstorm one synonym for each. Use ONE synonym per word in your first sentence — don't pile them up. 'Universities should be free' → 'higher education should be funded by the state'. 'Work from home' → 'remote working'. Avoid 'Nowadays', 'In today's world', 'It is a fact that' — all empty padding.",
      },
      {
        label: "What position should I take?",
        text: "Don't sit on the fence. Pick one of: (a) I largely agree, (b) I largely disagree, (c) I agree with X but not Y, (d) both sides have merit but X is more important. Write the position in ONE clear sentence using 'In my view…' or 'I believe…'.",
      },
      {
        label: "Do I need to preview the structure?",
        text: "Optional but adds polish. If you're confident in your 2 body paragraphs, hint at them: 'I will argue that X and Y outweigh Z.' If you're not sure of your body yet, skip the preview entirely — a strong 2-sentence intro is better than a wandering 3-sentence one.",
      },
      {
        label: "How long should it be?",
        text: "50–70 words. 2–3 sentences. Any shorter and you've not paraphrased properly. Any longer and you're eating into your body paragraph time — the body is where Task Response is actually built.",
      },
    ],
    try_it_prompts: [
      "Write an introduction (2–3 sentences) for this Task 2 prompt:\n\n\"Many people now work from home rather than commute to an office. Do the advantages of this development outweigh the disadvantages?\"",
      "Write an introduction (2–3 sentences) for this Task 2 prompt:\n\n\"Some people believe primary schools should teach a second language. To what extent do you agree or disagree?\"",
      "Write an introduction (2–3 sentences) for this Task 2 prompt:\n\n\"In many cities, traffic congestion is becoming a serious problem. What are the causes, and what could be done to solve it?\"",
      "Write an introduction (2–3 sentences) for this Task 2 prompt:\n\n\"Some governments invest heavily in the arts. Others argue that public money should focus on essential services. Discuss both views and give your opinion.\"",
      "Write an introduction (2–3 sentences) for this Task 2 prompt:\n\n\"Most people now get their news online rather than from newspapers or television. Why is this trend happening, and is it positive or negative?\"",
    ],
    skill_description:
      "writing a strong IELTS Task 2 introduction that (1) paraphrases the prompt in different words from the original, (2) states a clear position on the question, and (3) optionally previews the structure. Penalise: copying the prompt verbatim, using empty 'this essay will discuss' filler, no clear position, more than 3 sentences.",
    mastery_target: 3,
  },
  {
    id: "mod_topic_sentence",
    tier: "polish",
    title: "Master the Topic Sentence",
    short: "Open every body paragraph with a clear claim",
    blocks: "Coherence & Cohesion",
    why: "Without a strong topic sentence, the examiner can't see your structure. Coherence drops because each paragraph reads like an unfocused list of thoughts.",
    concept: [
      "The first sentence of every body paragraph is its TOPIC SENTENCE. It must state, in one clear sentence, the main claim that paragraph will defend.",
      "A good topic sentence is:",
      "- A CLAIM, not a fact or question.",
      "- Specific enough to defend in 4–5 sentences.",
      "- Phrased so the examiner can predict where the paragraph will go.",
      "",
      "Avoid: 'There are many reasons.' (Too vague.) 'Firstly, technology is good.' (Too broad.) 'In addition, more.' (Just a connector, no claim.)",
    ],
    examples: [
      {
        kind: "good",
        prompt: "Argument for why remote work benefits employers",
        text: "The most compelling reason for employers to embrace remote work is the dramatic reduction in office overhead, which can be redirected into salaries and growth.",
        why: "A specific claim ('reduction in office overhead'), framed so we know what comes next (evidence + redirected to salaries).",
      },
      {
        kind: "bad",
        prompt: "Argument for why remote work benefits employers",
        text: "There are many advantages of remote work for employers.",
        why: "A statement of fact with no claim. The reader has no idea which advantage the paragraph will defend.",
      },
    ],
    try_it_prompts: [
      "Write a TOPIC SENTENCE (one sentence only) that could open a body paragraph defending this claim:\n\nA tax on sugary drinks would shift consumer behaviour towards healthier alternatives.",
      "Write a TOPIC SENTENCE (one sentence only) that could open a body paragraph defending this claim:\n\nRemote work reduces office overhead that employers can redirect into salaries.",
      "Write a TOPIC SENTENCE (one sentence only) that could open a body paragraph defending this claim:\n\nMandatory community service in schools builds civic responsibility in teenagers.",
      "Write a TOPIC SENTENCE (one sentence only) that could open a body paragraph defending this claim:\n\nFree university tuition is unsustainable without major reforms to public funding.",
      "Write a TOPIC SENTENCE (one sentence only) that could open a body paragraph defending this claim:\n\nLearning a second language at primary school produces lasting cognitive benefits.",
    ],
    skill_description:
      "writing a single clear topic sentence to open a body paragraph. It must make a SPECIFIC CLAIM (not a fact, not a question), be defensible in 4–5 sentences, and let the reader predict where the paragraph is going. Penalise: vague openers like 'There are many advantages', empty connectors like 'In addition, more', anything that does not commit to a specific claim.",
    mastery_target: 3,
  },
  {
    id: "mod_development",
    tier: "foundation",
    title: "Master Idea Development",
    short: "Develop every claim with reason → example → consequence",
    blocks: "Task Response · Coherence & Cohesion",
    why: "Underdeveloped paragraphs are the #1 reason candidates get stuck at Band 6 instead of 7. A claim without a reason and example is just an assertion.",
    concept: [
      "Every body paragraph in a band-7 essay follows a CHAIN:",
      "1. CLAIM (topic sentence).",
      "2. REASON — why is the claim true?",
      "3. EXAMPLE — a specific real-world case (a country, study, policy, named programme).",
      "4. CONSEQUENCE — so what? what follows from the example?",
      "",
      "Each link is 1–2 sentences. Total paragraph: 4–6 sentences, about 80–110 words.",
      "Vague generalisations ('many people think...', 'in some countries...') are NOT examples. Examples must be specific enough that the examiner could fact-check them.",
    ],
    examples: [
      {
        kind: "good",
        prompt: "Develop a paragraph defending the claim 'public transport reduces urban congestion'",
        text: "Well-designed public transport visibly reduces congestion because each filled train or bus removes dozens of private cars from the road. London is the clearest example: after the introduction of the Congestion Charge alongside expanded Tube and bus services, peak-time traffic in the central zone dropped by around 30%. The wider lesson is that supply and demand-side measures work together — investment in transit only succeeds when driving is also made less attractive.",
        why: "Claim → reason (filled trains remove cars) → specific example (London congestion charge + transit) → consequence (supply + demand work together). Specific enough to fact-check.",
      },
      {
        kind: "bad",
        prompt: "Develop a paragraph defending the claim 'public transport reduces urban congestion'",
        text: "Public transport is good for traffic. Many people think buses and trains can help. In some countries, this has worked well. So we should support public transport.",
        why: "Four sentences with zero specific content. No reason, no example, no consequence. Examiner caps Task Response at 5.",
      },
    ],
    try_it_prompts: [
      "Write a 4-sentence body paragraph (claim → reason → example → consequence) defending this claim:\n\nCompulsory community service in schools builds civic responsibility.",
      "Write a 4-sentence body paragraph (claim → reason → example → consequence) defending this claim:\n\nPublic transport investment is the most effective way to reduce urban congestion.",
      "Write a 4-sentence body paragraph (claim → reason → example → consequence) defending this claim:\n\nWorking from home benefits employers more than it benefits employees.",
      "Write a 4-sentence body paragraph (claim → reason → example → consequence) defending this claim:\n\nA tax on fast food would meaningfully reduce obesity rates.",
      "Write a 4-sentence body paragraph (claim → reason → example → consequence) defending this claim:\n\nGlobalisation has improved access to information for ordinary citizens.",
    ],
    skill_description:
      "developing a single body paragraph as a chain: CLAIM → REASON → SPECIFIC REAL-WORLD EXAMPLE → CONSEQUENCE. About 4–6 sentences, 80–110 words. Penalise: missing any of the four links, vague non-examples like 'in some countries' or 'many people think', restating the claim as the consequence, paragraphs under 60 words, paragraphs over 130 words.",
    mastery_target: 3,
  },
  {
    id: "mod_linking",
    tier: "polish",
    title: "Master Linking Words",
    short: "Connect ideas without monotony",
    blocks: "Coherence & Cohesion",
    why: "Over-using 'Firstly / Secondly / Finally' marks a candidate at band 5–6. Band 7+ uses varied, embedded connectors that don't shout.",
    concept: [
      "Cohesion at band 7 means connectors that signal the relationship between ideas — but VARIED and sometimes embedded inside sentences, not always stuck at the front.",
      "Replace your top 3 over-used connectors:",
      "- 'Firstly' → 'The most compelling reason is…' / 'To begin with…'",
      "- 'In addition' → 'A further factor is…' / 'Beyond this, …'",
      "- 'In conclusion' → 'On balance, …' / 'Taken together, …'",
      "",
      "And inside sentences: 'while', 'although', 'whereas', 'despite', 'because of', 'as a result of'.",
      "Rule of thumb: NO connector appears more than twice in the whole essay.",
    ],
    examples: [
      {
        kind: "good",
        prompt: "Joining two contrasting body paragraphs",
        text: "While the economic argument for remote work is compelling, the social cost has received less attention.",
        why: "'While… ,' connects contrast inside a single sentence. No 'On the other hand' shouted at the front.",
      },
      {
        kind: "bad",
        prompt: "Joining two contrasting body paragraphs",
        text: "Firstly, remote work saves money. Secondly, on the other hand, there are some bad things too.",
        why: "Two front-of-sentence connectors stacked ('Secondly, on the other hand'), and 'some bad things' is empty. Marks down for over-use AND vagueness.",
      },
    ],
    try_it_prompts: [
      "Rewrite this clunky paragraph opener as ONE sentence using an embedded connector. Aim for a single sentence that signals the contrast without 'on the other hand' at the front:\n\n\"Firstly, online learning has many advantages. Secondly, on the other hand, traditional classrooms also have advantages.\"",
      "Rewrite this paragraph opener as ONE sentence using an embedded connector for contrast:\n\n\"On the one hand, social media connects people. On the other hand, it can also isolate them.\"",
      "Rewrite this paragraph opener as ONE sentence that signals a CAUSAL relationship (not a generic 'because' at the front):\n\n\"Public transport reduces traffic. Because of this, in addition, it also reduces pollution.\"",
      "Rewrite this paragraph opener as ONE sentence using a CONCESSIVE connector ('although', 'while', 'despite') instead of two front connectors:\n\n\"Firstly, working from home saves time. Secondly, however, it can be lonely.\"",
      "Rewrite this paragraph opener as ONE sentence that links the same two ideas WITHOUT 'firstly / secondly' anywhere:\n\n\"Firstly, education improves earnings. Secondly, it also improves health outcomes.\"",
    ],
    skill_description:
      "varied, sometimes-embedded cohesive devices that connect ideas without monotony. Replace front-of-sentence 'Firstly / Secondly / On the other hand' patterns with embedded connectors ('while', 'although', 'whereas', 'despite') or fresher alternatives ('The most compelling reason is', 'A further factor is', 'On balance'). Penalise: any answer that still uses front-of-sentence 'Firstly / Secondly / On the other hand', any answer that just deletes the connector without replacing the function.",
    mastery_target: 3,
  },
  {
    id: "mod_conclusion",
    tier: "foundation",
    title: "Master the Conclusion",
    short: "Close with conviction, not repetition",
    blocks: "Task Response",
    why: "A weak conclusion that just repeats the intro is the single most common 'last impression' band 5/6 marker. A good conclusion takes 30 seconds to write but lifts the whole essay.",
    concept: [
      "A band-7 conclusion is 2–3 sentences (about 40–60 words) that:",
      "1. RESTATES YOUR POSITION clearly, in different words from the intro.",
      "2. SUMMARISES the two main reasons (very briefly — one phrase each).",
      "3. (Optional) Adds a SHORT final thought — a recommendation or implication.",
      "",
      "Never introduce new arguments. Never write 'In conclusion' if you used it in a previous essay this week — vary your opening phrase.",
    ],
    examples: [
      {
        kind: "good",
        prompt: "Concluding an essay arguing schools should teach financial literacy",
        text: "On balance, equipping young people with practical financial skills clearly benefits both the individual and society, by reducing personal debt and strengthening household economies. Schools that already do this should be the model, not the exception.",
        why: "Restates the position ('benefits both individual and society'), summarises the two reasons in one clause, ends with a forward-looking recommendation. 41 words.",
      },
      {
        kind: "bad",
        prompt: "Concluding an essay arguing schools should teach financial literacy",
        text: "In conclusion, financial literacy is important. Schools should teach it. I agree with this.",
        why: "Three near-empty sentences. No summary of reasons. 'I agree' adds nothing. Marker treats this as band 5.",
      },
    ],
    try_it_prompts: [
      "Write a CONCLUSION (2–3 sentences) for an essay arguing:\n\n\"Working from home benefits both employees and employers more than it disadvantages them.\"\n\nThe essay made two arguments: (1) it saves time/money for both sides, (2) it widens access to skilled work for parents and people with disabilities.",
      "Write a CONCLUSION (2–3 sentences) for an essay arguing:\n\n\"Schools should teach financial literacy as a core subject.\"\n\nThe essay made two arguments: (1) it reduces personal debt in young adults, (2) it strengthens household economies over time.",
      "Write a CONCLUSION (2–3 sentences) for an essay arguing:\n\n\"Mandatory community service in schools is beneficial.\"\n\nThe essay made two arguments: (1) it builds empathy and responsibility, (2) it gives every student fair exposure to social issues.",
      "Write a CONCLUSION (2–3 sentences) for an essay arguing:\n\n\"Public transport, not new roads, is the answer to urban congestion.\"\n\nThe essay made two arguments: (1) filled trains and buses physically remove cars, (2) supply-side transit investment only works if driving is also made less attractive.",
      "Write a CONCLUSION (2–3 sentences) for an essay arguing:\n\n\"The disadvantages of mass tourism now slightly outweigh its benefits.\"\n\nThe essay made two arguments: (1) cumulative damage to iconic sites and local communities is severe, (2) economic gains are real but increasingly concentrated.",
    ],
    skill_description:
      "writing a 2–3 sentence band-7 IELTS Task 2 conclusion that restates the position in different words, briefly summarises the two main reasons, and optionally adds a short recommendation. Penalise: openings that just say 'In conclusion, X is important', conclusions that introduce new arguments, conclusions over 70 words, or under 30 words.",
    mastery_target: 3,
  },
  {
    id: "mod_articles",
    tier: "foundation",
    title: "Master Articles & Inflections",
    short: "Fix the grammar errors examiners notice instantly",
    blocks: "Grammatical Range & Accuracy",
    why: "Missing articles ('the government', 'a study'), wrong plurals ('every subjects'), and stative verb errors ('I am agree') are the most-flagged grammar errors for non-native candidates — and the easiest to fix once spotted.",
    concept: [
      "Three grammar patterns to hard-wire:",
      "1. ARTICLES — singular countable nouns need 'a/an/the' (the government, a policy, an exam). Don't say 'government should', say 'the government should'.",
      "2. PLURAL AGREEMENT — 'every / each / one' is followed by SINGULAR. 'Every student' not 'every students'. 'One country' not 'one countries'.",
      "3. STATIVE VERBS — verbs like 'agree, disagree, know, think, believe' are FULL verbs. Never write 'I am agree' — write 'I agree'. Same for 'I am think' (wrong) → 'I think'.",
      "",
      "If you fix only these three, your Grammar band typically rises by a full point.",
    ],
    examples: [
      {
        kind: "good",
        prompt: "Express a position on a Task 2 prompt about climate change",
        text: "I largely agree that the government must take the lead on climate policy, although individual citizens also have a meaningful role to play in every household.",
        why: "Articles where needed ('the government', 'the lead'), 'every' followed by singular ('every household'), 'I agree' not 'I am agree'.",
      },
      {
        kind: "bad",
        prompt: "Express a position on a Task 2 prompt about climate change",
        text: "I am agree that government must take lead on climate policy, although individuals also have role to play in every households.",
        why: "'I am agree' (stative-verb error), missing 'the' before government/lead/role, 'every households' (every needs singular). Three errors flagged in one sentence.",
      },
    ],
    try_it_prompts: [
      "Rewrite this sentence correctly — fix the article, plural and stative-verb errors:\n\n\"I am agree that university should provide free education for every students because economic argument is clear.\"",
      "Rewrite this sentence correctly — fix the article, plural and stative-verb errors:\n\n\"Every government must take lead on climate, although individuals also have role to play in every households.\"",
      "Rewrite this sentence correctly — fix the article, plural and stative-verb errors:\n\n\"I am think that public transport is best solution for every cities and every town.\"",
      "Rewrite this sentence correctly — fix the article, plural and stative-verb errors:\n\n\"Government should reduce taxes on every small business so that economy can grow in every regions.\"",
      "Rewrite this sentence correctly — fix the article, plural and stative-verb errors:\n\n\"I am agree that schools must teach children to respect every cultures and every tradition.\"",
    ],
    skill_description:
      "correct use of articles (a/an/the), plural agreement (every/each/one + SINGULAR), and stative verbs (no 'am/is/are' before agree/think/know/believe). Mark strictly: if any of these three error types remains in the candidate's submission, it does NOT pass. Penalise: missing articles before singular countable nouns, 'every/each + plural', 'I am agree/think/know'.",
    mastery_target: 3,
  },
];

window.IELTS_DATA = { TASK1, TASK2, BAND_DESCRIPTORS, MODULES };
