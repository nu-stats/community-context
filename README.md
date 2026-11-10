# Immigration and Crime: Community Context

A small website for Assignment A (`../community-context.md`). A student chooses a group (country of birth), a ranking period and three indicators from a menu of seven (population and foreign_born_percent are given). The page shows:

- the 50 cities where the group is largest, with the group size and the three variables in each of the three periods;
- the weighted-average calculation step by step (sum of the weights, sum of weight x value, the division, the plain average, the national value, the weighted average minus the plain average);
- the share of the group's U.S. residents who live in those 50 cities;
- a button to download the table as a CSV file.

It does the same as the course workbook (`../data/community-context-workbook.xlsx`). It uses Census data only (Census 2000, ACS 2006-2010, ACS 2020-2024). There is no crime data.

## Files

| File | What it is |
| --- | --- |
| `index.html`, `app.js`, `style.css` | The page, with five tabs: Start here, Top 50, Data, Weighted averages and Test this site. Plain HTML and JavaScript, no build step, no packages. The look follows Husky Eye View (dark, glass panels). |
| `data/cities.json` | 343 cities: code, name, state and the four variables for three periods. |
| `data/national.json` | National value of each menu indicator for three periods. |
| `data/groups.json` | 59 groups: group size in each city for three periods, and the U.S. total. |
| `build-data.mjs` | Rebuilds the two JSON files from the validated source tables. |
| `STUDENT-TEST.md` | A walkthrough for a student who tests the site. |

## Run it locally

The page loads its data with `fetch`, so open it from a web server, not by double-clicking `index.html`. From this folder:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000/>. Any static server works (for example `npx serve`).

## Rebuild the data

Only needed if the Census files change. From the repository root:

```bash
node scripts/build-city-assignment-data.mjs <temporary folder>
node course/assignments/site/build-data.mjs <temporary folder>
```

The first command writes the three `group-*.tsv` tables (it also rewrites `course/assignments/data/cities-over-75k.csv`; run `git diff` afterward to see whether that file changed). The second reads those tables and the city CSV and writes `data/cities.json` and `data/groups.json`. It needs the git-ignored files in `data/source/census/`.

## How the numbers are made

- Cities are ranked by the group's size in the chosen period. If two cities have the same size, the lower city code comes first.
- Weighted average = sum of (group size x value) / sum of group size, over the 50 cities, using the group size of the same period.
- A city with no value for a variable is left out of that variable's calculation (its weight is not counted either).
- National values: filled in for all indicators and periods from Census Bureau U.S.-level tables (50 states and DC, same definitions as the city values): `data/national.json` for the seven menu indicators (computed by `fetch/fetch-national.mjs`), plus foreign_born_percent (11.1, 12.7, 14.1) and population (281,421,906; 303,965,272; 334,922,499) in `app.js`. Income can be shown in 2024 dollars (a box on Start here, ticked by default; 2000 and 2006-2010 are restated with the annual CPI-U: 1999 = 166.575, 2010 = 218.056, 2024 = 313.689) or in the published dollars of each period. Students can overtype any value.
- Menu: poverty_percent, unemployment_percent, median_household_income, bachelors_percent, renter_percent, black_percent, hispanic_percent. The five indicators beyond poverty and unemployment come from site/fetch/ (Census 2000 SF3 and ACS 2006-2010 bulk files) and the existing 2020-2024 ACS file; income is in each period's own dollars.
- The CSV has plain variable names only, for example `poverty_percent_2020_24`. City codes with a leading zero lose it if a spreadsheet opens the file and treats the column as numbers.

## Publish on GitHub Pages (not done)

This has not been published. All paths are relative, so the folder works as it is. One way to do it:

1. Make sure the repository (or a separate repository holding a copy of this folder) is public. The two JSON files are the only data; they hold Census numbers only.
2. In the repository settings, open Pages and choose a source: either a branch and folder, or a GitHub Actions workflow that uploads `course/assignments/site/`. GitHub's built-in "branch" option only offers `/` or `/docs`, so for this subfolder use the Actions option, or copy the folder's contents to the root or `docs/` of a small separate repository.
3. The site would then be at `https://<account>.github.io/<repository>/`. Test it once from that address before giving students the link.
