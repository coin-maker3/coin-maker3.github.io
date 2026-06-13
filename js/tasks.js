// ─── TASK 1 PROMPTS ────────────────────────────────────────────────────────

const TASK1_PROMPTS = [
  {
    id: 't1-1',
    title: 'International Tourism Arrivals',
    instruction: 'The bar chart below shows the number of international tourist arrivals (in millions) in three countries — France, Spain, and the United States — for the years 2010, 2015, and 2020.',
    question: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
    suggestedTime: 20,
    chartConfig: {
      type: 'bar',
      data: {
        labels: ['2010', '2015', '2020'],
        datasets: [
          {
            label: 'France',
            data: [77.6, 84.5, 40.0],
            backgroundColor: 'rgba(212, 168, 67, 0.75)',
            borderColor: 'rgba(212, 168, 67, 1)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'Spain',
            data: [52.7, 68.2, 19.0],
            backgroundColor: 'rgba(74, 111, 165, 0.75)',
            borderColor: 'rgba(74, 111, 165, 1)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'USA',
            data: [60.0, 77.5, 22.0],
            backgroundColor: 'rgba(34, 197, 94, 0.65)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8a9ab5', font: { family: 'Inter', size: 12 } }
          },
          title: {
            display: true,
            text: 'International Tourist Arrivals (millions)',
            color: '#e8edf5',
            font: { family: 'Inter', size: 13, weight: '600' },
            padding: { bottom: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } },
            title: {
              display: true,
              text: 'Arrivals (millions)',
              color: '#8a9ab5',
              font: { family: 'Inter', size: 11 }
            }
          }
        }
      }
    }
  },

  {
    id: 't1-2',
    title: 'CO₂ Emissions Per Capita',
    instruction: 'The line graph below shows CO₂ emissions per capita (in metric tonnes) for four countries — Australia, China, Germany, and India — between 1990 and 2020.',
    question: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
    suggestedTime: 20,
    chartConfig: {
      type: 'line',
      data: {
        labels: ['1990', '1995', '2000', '2005', '2010', '2015', '2020'],
        datasets: [
          {
            label: 'Australia',
            data: [15.4, 16.1, 17.3, 17.7, 17.0, 15.7, 14.8],
            borderColor: 'rgba(212, 168, 67, 1)',
            backgroundColor: 'rgba(212, 168, 67, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(212, 168, 67, 1)',
            tension: 0.4
          },
          {
            label: 'China',
            data: [2.2, 2.7, 3.1, 4.6, 6.7, 7.0, 7.4],
            borderColor: 'rgba(239, 68, 68, 1)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(239, 68, 68, 1)',
            tension: 0.4
          },
          {
            label: 'Germany',
            data: [12.7, 11.0, 10.3, 9.8, 9.2, 8.9, 7.7],
            borderColor: 'rgba(74, 111, 165, 1)',
            backgroundColor: 'rgba(74, 111, 165, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(74, 111, 165, 1)',
            tension: 0.4
          },
          {
            label: 'India',
            data: [0.9, 1.0, 1.1, 1.3, 1.6, 1.8, 1.9],
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(34, 197, 94, 1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8a9ab5', font: { family: 'Inter', size: 12 } }
          },
          title: {
            display: true,
            text: 'CO₂ Emissions Per Capita (metric tonnes)',
            color: '#e8edf5',
            font: { family: 'Inter', size: 13, weight: '600' },
            padding: { bottom: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } },
            title: {
              display: true,
              text: 'Tonnes per capita',
              color: '#8a9ab5',
              font: { family: 'Inter', size: 11 }
            }
          }
        }
      }
    }
  },

  {
    id: 't1-3',
    title: 'University Subjects by Gender',
    instruction: 'The bar chart below shows the percentage of male and female students enrolled in six university subject areas — Engineering, Medicine, Arts, Business, Sciences, and Law — in 2022.',
    question: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
    suggestedTime: 20,
    chartConfig: {
      type: 'bar',
      data: {
        labels: ['Engineering', 'Medicine', 'Arts', 'Business', 'Sciences', 'Law'],
        datasets: [
          {
            label: 'Male (%)',
            data: [76, 44, 35, 55, 52, 48],
            backgroundColor: 'rgba(74, 111, 165, 0.8)',
            borderColor: 'rgba(74, 111, 165, 1)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: 'Female (%)',
            data: [24, 56, 65, 45, 48, 52],
            backgroundColor: 'rgba(212, 168, 67, 0.75)',
            borderColor: 'rgba(212, 168, 67, 1)',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            labels: { color: '#8a9ab5', font: { family: 'Inter', size: 12 } }
          },
          title: {
            display: true,
            text: 'University Enrolment by Subject and Gender (2022)',
            color: '#e8edf5',
            font: { family: 'Inter', size: 13, weight: '600' },
            padding: { bottom: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } },
            title: {
              display: true,
              text: 'Percentage (%)',
              color: '#8a9ab5',
              font: { family: 'Inter', size: 11 }
            }
          },
          y: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } }
          }
        }
      }
    }
  },

  {
    id: 't1-4',
    title: 'Internet Usage by Region',
    instruction: 'The line graph below shows the percentage of the population using the internet in three regions — Europe, Asia Pacific, and Africa — between 2000 and 2022.',
    question: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
    suggestedTime: 20,
    chartConfig: {
      type: 'line',
      data: {
        labels: ['2000', '2003', '2006', '2009', '2012', '2015', '2018', '2022'],
        datasets: [
          {
            label: 'Europe',
            data: [18, 30, 46, 60, 71, 79, 85, 90],
            borderColor: 'rgba(212, 168, 67, 1)',
            backgroundColor: 'rgba(212, 168, 67, 0.08)',
            borderWidth: 2,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(212, 168, 67, 1)',
            tension: 0.4
          },
          {
            label: 'Asia Pacific',
            data: [4, 9, 16, 26, 38, 48, 58, 72],
            borderColor: 'rgba(74, 111, 165, 1)',
            backgroundColor: 'rgba(74, 111, 165, 0.08)',
            borderWidth: 2,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(74, 111, 165, 1)',
            tension: 0.4
          },
          {
            label: 'Africa',
            data: [0.5, 1.1, 2.6, 6.7, 15, 24, 35, 43],
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.08)',
            borderWidth: 2,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: 'rgba(34, 197, 94, 1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8a9ab5', font: { family: 'Inter', size: 12 } }
          },
          title: {
            display: true,
            text: 'Internet Usage (% of population)',
            color: '#e8edf5',
            font: { family: 'Inter', size: 13, weight: '600' },
            padding: { bottom: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' }, callback: v => v + '%' },
            title: {
              display: true,
              text: '% of population',
              color: '#8a9ab5',
              font: { family: 'Inter', size: 11 }
            },
            max: 100
          }
        }
      }
    }
  },

  {
    id: 't1-5',
    title: 'Renewable Energy Growth',
    instruction: 'The bar chart below shows the percentage of total electricity generation from renewable sources in five countries — Germany, China, the USA, India, and the UK — in 2010, 2015, and 2020.',
    question: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant.\n\nWrite at least 150 words.',
    suggestedTime: 20,
    chartConfig: {
      type: 'bar',
      data: {
        labels: ['Germany', 'China', 'USA', 'India', 'UK'],
        datasets: [
          {
            label: '2010',
            data: [16.9, 18.7, 10.1, 14.2, 7.1],
            backgroundColor: 'rgba(74, 111, 165, 0.75)',
            borderColor: 'rgba(74, 111, 165, 1)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: '2015',
            data: [29.7, 23.8, 13.4, 17.5, 22.3],
            backgroundColor: 'rgba(212, 168, 67, 0.75)',
            borderColor: 'rgba(212, 168, 67, 1)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: '2020',
            data: [44.3, 28.5, 19.8, 23.1, 42.1],
            backgroundColor: 'rgba(34, 197, 94, 0.65)',
            borderColor: 'rgba(34, 197, 94, 1)',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#8a9ab5', font: { family: 'Inter', size: 12 } }
          },
          title: {
            display: true,
            text: 'Renewable Energy Share (% of electricity generation)',
            color: '#e8edf5',
            font: { family: 'Inter', size: 13, weight: '600' },
            padding: { bottom: 12 }
          }
        },
        scales: {
          x: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' } }
          },
          y: {
            grid: { color: '#1e2d45' },
            ticks: { color: '#8a9ab5', font: { family: 'Inter' }, callback: v => v + '%' },
            title: {
              display: true,
              text: '% of total electricity',
              color: '#8a9ab5',
              font: { family: 'Inter', size: 11 }
            }
          }
        }
      }
    }
  }
];

// ─── TASK 2 PROMPTS ────────────────────────────────────────────────────────

const TASK2_PROMPTS = [
  {
    id: 't2-1',
    type: 'opinion',
    prompt: `Some people believe that technology has made our lives more complicated, while others argue that it has significantly improved the quality of life.

Discuss both these views and give your own opinion.

Write at least 250 words.`,
    suggestedTime: 40
  },

  {
    id: 't2-2',
    type: 'discussion',
    prompt: `Some school-leavers choose to take a gap year — a period of time off between finishing school and starting university — to travel or work abroad.

Discuss the advantages and disadvantages of taking a gap year before starting university.

Write at least 250 words.`,
    suggestedTime: 40
  },

  {
    id: 't2-3',
    type: 'argument',
    prompt: `In many cities, governments spend large amounts of money on improving public transport systems, while others believe this money should be used to build new roads for private vehicles.

Which policy do you think would be more beneficial for society as a whole?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words.`,
    suggestedTime: 40
  },

  {
    id: 't2-4',
    type: 'discussion',
    prompt: `There is a growing debate about the role of universities in today's society. Some people argue that the primary purpose of a university education is to prepare students for employment, while others believe it should focus on developing academic knowledge and critical thinking.

Discuss both views and give your own opinion.

Write at least 250 words.`,
    suggestedTime: 40
  },

  {
    id: 't2-5',
    type: 'opinion',
    prompt: `The rise of technology has enabled many people to work from home rather than commuting to an office. Some believe this trend is largely positive for individuals and society, while others see it as harmful.

Do you think working from home has more positive or negative effects on society overall?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words.`,
    suggestedTime: 40
  },

  {
    id: 't2-6',
    type: 'argument',
    prompt: `Some parents and education experts believe that children should begin learning a foreign language in primary school, as early as possible. Others argue it is better to introduce a second language at secondary school, when children are more intellectually mature.

Which approach do you think is more effective?

Give reasons for your answer and include any relevant examples from your own knowledge or experience.

Write at least 250 words.`,
    suggestedTime: 40
  }
];
