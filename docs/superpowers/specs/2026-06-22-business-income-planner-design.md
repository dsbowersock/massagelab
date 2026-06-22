# Business Income Planner Design

## Goal

Build the first MassageLab business-planning tool: a therapist and student income planner that turns a spreadsheet-style time and income worksheet into an interactive browser tool for exploring time off, work schedule, expenses, desired take-home income, employee wage comparison, and practical session pricing.

## Source Worksheet

The starting worksheet is `Business Plan 7 - Time & Income Worksheet.xlsx`. It contains one sheet with these core ideas:

- Days off for vacation, holidays, and personal days.
- Available work days and rounded available work weeks.
- Desired weekly work hours by day.
- Annual work hours from weekly hours and available weeks.
- Workload scenarios at 50%, 70%, 90%, and 100% of available hours.
- Desired annual income rows divided by annual hours to produce an hourly target.

The web tool should keep this decision model but should not recreate the spreadsheet grid directly. The spreadsheet is useful because it shows that time choices change income needs. The web tool should make that relationship easier to understand.

## Audience

The tool is for massage therapy students, educators, and working therapists. It should help a student understand why session pricing cannot be chosen by guessing, and it should help a therapist test realistic tradeoffs without doing spreadsheet math.

The tool is not accounting software, payroll software, tax advice, or financial advice. It is an educational planning calculator for rough decision support.

## Routes

- `/tools/business-planner`: public hub for MassageLab business-planning tools.
- `/tools/business-planner/income`: first live planner, focused on income, time, and session pricing.

The hub should show Income Planner as available. Future business-planning tools can be shown as planned items, but they should not look interactive until they exist.

## Persistence

Anonymous users can use the planner immediately. Their current worksheet values persist in browser storage on that device.

Signed-in users also get one account-backed current worksheet. The saved account value is overwritten as the current worksheet changes. There is no version history, no named scenario library, and no multi-scenario database model in v1.

Persisted values must be business-planning assumptions only. The tool must not collect client names, client details, treatment notes, clinical intake answers, health information, or other PHI-shaped data.

## Inputs

The v1 planner should support these editable assumptions:

- Preset: starting part-time, growing solo practice, full schedule, or custom.
- Desired annual take-home income.
- Monthly fixed business expenses.
- Per-session variable cost.
- Tax or set-aside percentage.
- Days off for vacation, holidays, and personal days.
- Weekly client hours by weekday.
- Weekly unpaid admin hours.
- Average session length.
- Optional employee hourly wage comparison.

The desired income input means personal take-home target, not gross business revenue. The tool should work backward from that target to estimate the gross revenue and session pricing needed to support it.

## Outputs

The planner should show:

- Total days off.
- Available work weeks.
- Weekly client hours.
- Annual client hours.
- Estimated sessions per year.
- Estimated sessions per week.
- Annual fixed expenses.
- Annual variable session costs.
- Gross revenue needed.
- Effective hourly revenue target.
- Suggested prices for 30, 60, 90, and 120 minute sessions.
- Optional employee comparison using the same available weeks and schedule assumptions.
- Plain-language interpretation of the current plan.

The main result should include both an hourly target and session-price suggestions. The session prices are what make the tool actionable for service-menu decisions.

## Calculation Model

The helper logic should be deterministic and testable outside React.

Inputs should be normalized before calculation. Negative numbers should become zero. Percentages should be clamped to a reasonable range. If annual client hours or average session length is zero, the outputs should avoid division-by-zero and explain that more schedule information is needed.

Core formulas:

- `totalDaysOff = vacationDays + holidayDays + personalDays`
- `availableDays = max(0, 365 - totalDaysOff)`
- `availableWeeks = round(availableDays / 7)`
- `weeklyClientHours = sum(weekdayClientHours)`
- `annualClientHours = weeklyClientHours * availableWeeks`
- `averageSessionHours = averageSessionMinutes / 60`
- `annualSessions = annualClientHours / averageSessionHours`
- `annualFixedExpenses = monthlyFixedExpenses * 12`
- `targetBeforeTax = desiredTakeHomeIncome / (1 - taxSetAsideRate)`
- `requiredGrossRevenue = targetBeforeTax + annualFixedExpenses + (annualSessions * perSessionVariableCost)`
- `hourlyRevenueTarget = requiredGrossRevenue / annualClientHours`
- `sessionPrice(minutes) = hourlyRevenueTarget * (minutes / 60) + perSessionVariableCost`

Workload scenarios should mirror the worksheet's teaching value by comparing 50%, 70%, 90%, and 100% of the entered client-hour capacity. Each scenario should show annual client hours, sessions per week, hourly target, and a 60-minute session price.

The employee comparison should remain small. If an employee hourly wage is entered, show estimated annual gross wages from the same weekly client hours and available weeks, plus an estimated take-home value using the same tax or set-aside rate. This is a comparison aid, not a payroll model.

## User Experience

The income planner should be a dashboard-style tool rather than a spreadsheet clone.

Recommended layout:

- Header with the title "Business Income Planner" and student/therapist framing.
- Preset strip with editable presets.
- Assumptions panel for income, expenses, taxes, time off, session length, weekly client hours, admin hours, and employee wage comparison.
- Results panel with the key numbers: gross revenue needed, client hours per year, sessions per week, hourly target, and suggested 60-minute price.
- Chart area with a bar chart for 30, 60, 90, and 120 minute suggested prices.
- Workload comparison area for 50%, 70%, 90%, and 100% capacity.
- Interpretation panel explaining what the current numbers mean in plain language.

The interface should teach lightly. It should not become a course page, but each result should help users understand the tradeoff: adding time off, lowering client hours, increasing expenses, or raising desired take-home income usually increases the required session price.

## App Integration

The tool should follow existing MassageLab public tool patterns:

- Use `AppPageShell`, `AppSurface`, and existing UI primitives.
- Use lucide icons where helpful.
- Use the existing Recharts dependency and `components/ui/chart.tsx` chart wrapper for visual output.
- Add public metadata through `createPublicPageMetadata`.
- Add `/tools/business-planner` and `/tools/business-planner/income` to the public route and sitemap contract.
- Add navigation under the Tools area, with the hub and income planner discoverable without sign-in.
- Add a homepage available-tools entry if the catalog can include it without crowding the first screen.
- Keep account-backed persistence in the existing user preference shape or an equivalent lightweight account preference path, not a new database table.

The planner should remain local-first for anonymous users and low-cost for signed-in users. It should not create database rows per edit, scenario, or result.

## Presets

Presets should seed editable assumptions. Selecting a preset changes the current worksheet values; it does not create a saved version.

Suggested presets:

- Starting part-time: lower weekly client hours, modest income target, simple expense assumptions.
- Growing solo practice: mid-range weekly client hours, realistic expenses, moderate income target.
- Full schedule: higher weekly client hours, higher expenses, higher income target.
- Custom: current edited values.

Preset copy should avoid implying that one schedule or price is correct. The point is to help users test possibilities.

## Accessibility And Content Rules

- Inputs need visible labels and clear units.
- Currency and hour outputs should be formatted consistently.
- Charts need accessible text summaries because the numbers matter more than the visual decoration.
- The tool should work on mobile, tablet, and desktop without horizontal spreadsheet overflow.
- No text should imply guaranteed income, legal advice, tax advice, or financial advice.
- The plain-language interpretation should be supportive and concrete, not judgmental.

## Testing

Unit tests should cover:

- Time-off and available-week calculations.
- Gross revenue and hourly target calculations.
- Session price outputs for 30, 60, 90, and 120 minutes.
- Zero-hour and zero-session guardrails.
- Tax/set-aside clamping.
- Workload scenario calculations.
- Employee wage comparison calculations.
- Persistence payload normalization without PHI-shaped fields.

Browser or source-contract tests should cover:

- `/tools/business-planner` renders as a public route.
- `/tools/business-planner/income` renders as a public route.
- Public route smoke tests include the new routes.
- The route contract includes the business planner routes in SEO metadata and sitemap output.
- The implementation does not introduce a versioned scenario database model.

## Out Of Scope For V1

- Multiple saved scenarios.
- Named scenario history.
- Spreadsheet import or export.
- Full accounting categories.
- Tax filing estimates.
- Payroll modeling.
- Booking-calendar integration.
- Service catalog price writing.
- Client data, clinical data, or PHI-bearing workflows.
- AI-generated business recommendations.

## Open Decisions Resolved In This Design

- The tool lives under `/tools/business-planner`, not under Education alone.
- The first live route is `/tools/business-planner/income`.
- Desired income means personal take-home target.
- The planner shows suggested prices for common session lengths.
- Expenses stay simple in v1.
- The tool includes a small optional employee wage comparison.
- The tool teaches lightly through interpretation and charts.
- Anonymous users persist values locally.
- Signed-in users persist one current worksheet, overwritten as they edit.
