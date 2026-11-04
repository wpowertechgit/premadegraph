# English lite translation comparison

Compared on 4 November 2026 against the 12 chapters in `chapters_lite/`, paired by chapter number with `chapters_lite_en/`.

The review checked the prose, headings, captions, qualifications, technical terminology, equations, table values, citations, cross-references, and figure coverage. This is a translation comparison against the Hungarian source, not an independent validation of the source's scientific claims.

## Corrections

| Chapter | Corrections to the English version |
| --- | --- |
| 1 | Restored the exploratory wording about examining core-periphery structure, the civilisation-simulation context, further exploration of existing data, and the absence of a native client interface. Removed the implication that player performance metrics are attached to edges. Matched the early-frontend caption. |
| 2 | Restored the opening focus on recurring interactions; removed an added exclusivity claim in the ABM definition. |
| 3 | Restored explicit match-v5 and unique-account-identifier wording, the source's approximate match count, and figure/table introductions. |
| 4 | Restored the statement that datasets were not expanded after 28 April 2026, and the figure/table explanations. Used “tightly connected” to avoid implying the formal directed-graph concept of strong connectivity. |
| 5 | Restored the collection-focus explanation and the extended-thesis citation. Removed the added claim that *any* observed difference follows *directly* from queue mechanics. Expanded the ambiguous English abbreviation “ass.” to “assortativity.” |
| 6 | Restored “combat conversion” instead of “kill conversion,” the example of a second death, and the reported result that the Quinn example reached the score cap. Restored figure/table introductions. |
| 7 | Restored figure/table labels and explanatory references, including dataset and renderer context. |
| 8 | Removed an introductory addition absent from the Hungarian paragraph; retained the browser description in its own section. |
| 9 | Matched “in 40 ms” rather than the stronger “under 40 ms”; clarified completed wars versus wars involving dead tribes; restored figure/table introductions and the exact code expression. |
| 10 | Restored “first experimental run” rather than the added F2 designation and restored table/figure introductions. Removed an added explanatory sentence from the genome caption. |
| 11 | Removed the English-only Flexset seed=42 screenshot to match the Hungarian figure selection. Restored the introductions to the source's three screenshots and two tables. All four runs remain in the comparison table. |
| 12 | Matched “core-periphery-like” rather than a stronger structural classification and restored the final statement about what the complete pipeline demonstrates. |

## Structural and numeric checks

All 12 chapter pairs pass the following comparisons:

- Same heading hierarchy: 12 chapters, 56 sections, 22 subsections, and 2 paragraph headings.
- Same 10 list items and 19 displayed equations. Equation expressions match after translating text inside formulas.
- Same 19 tables, with matching numeric values in each table after normalising number formatting.
- Same 20 figures, including the sideways figure, in the same order. The two translated diagram PDFs are the English counterparts of the source figures.
- Same 39 captions, 39 labels, 37 cross-reference occurrences, and 34 citation commands, with matching citation keys and reference targets per chapter.

The English filenames, language-specific front matter, English diagram labels, and adjusted figure sizing remain intentional presentation differences. The Romanian and Hungarian abstracts remain excluded from the English build as requested.

## Source inconsistencies distinguished from translation errors

- Chapter 1 says “four” research questions but lists five. The English introduction says “five” and uses `RQ` labels; all five questions are preserved.
- Chapter 1 describes the screenshot as current in the prose but early in its caption. The English version now preserves that distinction.
- Chapter 3 uses approximate corpus sizes of 4980/2000, while later exact tables report 4981/2001. Both levels of precision are preserved rather than silently changing the source's numbers.
- Chapter 9 describes both datasets appearing simultaneously, while chapter 11 reports dataset-specific runs. Both source descriptions are retained; resolving the experiment description requires a separate factual review.
- Chapter 9 describes a 40-byte envelope but lists the payload at offset `32+`. The translation preserves the source table; this review does not establish the protocol layout.

The Hungarian chapters were not edited by this translation review.
