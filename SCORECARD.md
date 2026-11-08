# 20-Task Scorecard: Best Free Model vs. Small Team vs. Frontier

> Historical: Team mode was benchmarked and replaced by Proof. This scorecard is kept as a record; the current design is in `docs/superpowers/specs/2026-11-08-proof-mode-design.md`.

This is a manual test. Run it once, all 20 tasks, before deciding whether team mode is worth building.

## Pass mark — decide this before you start

Build team mode only if **all five** are true:

1. The team wins **at least 12 of the 20 tasks**.
2. The team scores **at least 8 more points out of 60** than the single model.
3. The team has **no more than 3 zero scores**, and no more zeros than the single model.
4. The team wins in **at least 3 of the 6 areas**.
5. The team has **no more than 5 slow answers**.

A win means the team scores at least 1 point higher on that task. A tie is not a win. An area win means the team wins more tasks in that area than the single model.

- A team that wins 12 tasks but gains only 7 points **fails**.
- A team that gains 8 points but has 4 zero scores **fails**.
- A team that gains 8 points but has 6 slow answers **fails**.
- A team that wins only in one area **fails** as a general team mode. Build a smaller specialist mode only if that area matters.

If the team clears the pass mark, build it **only for the areas where it won**. Use the single model for the rest.

If it does not clear the pass mark, **do not build team mode**. Keep the best single model, add the one cheapest tool that fixes the most common failure, and retest the affected tasks. Use a frontier check for hard questions.

The frontier model is a reference, not part of the pass mark. If you cannot use one, mark its column “not tested” and still compare the single model against the team.

## The three contestants

### 1. Single free model

Use the site’s strongest free model and keep it fixed for all 20 tasks. At the time of writing, use **DeepSeek V4.1 Flash**. Record the exact name before starting.

Give it the same tools as the team: web search, a code runner, a calculator, and **one self-check**.

### 2. Three-model free team

Use three free models from three different companies:

- **Captain and first answer:** DeepSeek V4.1 Flash
- **Second independent answer:** Qwen 3.8 27B
- **Checker and referee:** Nemotron 3 Ultra 550B

Give the team the same web search, code runner, and calculator. The team gets **one internal round of checking**. The captain writes the final answer after the checker signs off.

If a model is rate-limited, replace it **before the first task** with the next free model from a different company. Write down the change. Do not switch models after seeing a task.

### 3. Frontier reference

Use one current top model: **Gemini 4 Carbon**, **Claude Opus 5.5**, or **GPT-6 Astra**. Use the same one for all 20 tasks and record its exact name and date. Give it the same tools if you can.

Do not substitute a free model and call it the frontier reference.

## How to run it fairly

- Start every task in a fresh chat. Do not carry memory from an earlier task.
- Do not give the single model, the team, or the frontier model any extra hints or follow-up questions.
- If a task truly needs a clarification, give all three the same clarification in writing and record it.
- The only difference between the single model and the team is **one model versus three**. Do not give the team better tools.
- The team’s internal conversation counts toward its time. The clock stops when the final answer appears.
- Time limits:
  - Everyday and writing: **3 minutes**
  - W1 below: **2 minutes**
  - Research, coding, and math: **8 minutes**
  - Planning: **12 minutes**
- Mark an answer **Slow** if it goes over its limit. A slow answer can still earn full quality points; speed is recorded separately.
- If a tool breaks, pause the clock, retry once, and write down what happened.
- Run all 20 tasks before comparing totals. Do not stop early because one contestant is ahead.

## Blind grading

1. After each task, have a helper rename the three answers **A, B, and C** in random order. If you have no helper, use a random-number app and keep the key hidden until the end.
2. Remove model names, signatures, and obvious branding. If an answer names its model, replace the name with “the model.”
3. Keep the A/B/C key in a separate note. Do not look at it while grading.
4. Grade one task at a time, using only the task checklist. Do not guess who wrote what.
5. Use only the final answer and its evidence, not the team’s internal conversation. For coding, include the code and its output. For research, click the links and check that they open.
6. Grade all 20 tasks before opening the key.
7. Ask a second person to grade 5 randomly chosen tasks. If their score differs by 2 or more points on a task, discuss the checklist and rescore all three answers for that task. Then unblind.
8. Do not change scores after unblinding.

## Scoring

Use whole points only, from 0 to 3:

- **3 — Pass:** every must-have is present, and nothing important is false.
- **2 — Almost:** one small must-have is missing, but nothing important is false.
- **1 — Weak:** an important piece is missing or there is one clear error, but the answer is still partly useful.
- **0 — Fail:** the core answer is confidently wrong, a source is made up, the advice is unsafe, or the code/math fails its own checks.

A failed proof is always 0, no matter how good the writing is. For example, code that does not run or a math answer with the wrong final number scores 0.

Record three separate things:

- **Quality score:** 0–3 per task; 60 points total.
- **Slow:** yes or no.
- **Zero:** yes or no. A zero is a disaster.

A slow answer can still score 3. The team must stay under the slow limit in the pass mark.

## The 20 tasks

### Everyday questions (4 tasks; 3-minute limit)

**E1 — Phone battery drain**

**Ask:** “My phone battery drops from 100% to 20% in four hours. List the five most likely causes in order and one safe thing to try for each.”

**Must include:**
- Exactly five causes, ordered from most to least likely.
- One specific, safe action for each cause.
- At least one setting, app, or battery-health cause.
- No claim that one cause is certain without checking it.

**Worst failure:** **Missing piece** — fewer than five causes, or no action for one of them.

**Proof:** **No** — judge the usefulness and safety against the checklist.

---

**E2 — Dinner for six on $40**

**Ask:** “I have $40 and need dinner for six people. Give me a shopping list, a simple menu, and a two-hour step-by-step plan.”

**Must include:**
- A menu that actually feeds six, with quantities.
- A shopping list totaling $40 or less.
- Steps that fit two hours, including the cooking order.
- A note saying which cheap pantry items are assumed to be on hand.

**Worst failure:** **Missing piece** — the plan goes over budget, feeds fewer than six, or has no quantities.

**Proof:** **Some** — the budget can be checked; the menu and plan are judged.

---

**E3 — A child being left out**

**Ask:** “My 12-year-old says they are being left out at school. Give me three things to say tonight, three things not to say, and one gentle next step. Add a short reason for each.”

**Must include:**
- Exactly three things to say and three to avoid.
- A short, practical reason for each.
- A calm, non-blaming tone with no diagnosis.
- One gentle next step, without promising to fix everything.

**Worst failure:** **Confidently wrong** — harmful advice, blame, or a made-up diagnosis.

**Proof:** **No** — judge against the checklist and basic safety.

---

**E4 — What a deductible means**

**Ask:** “Explain what a deductible is using a $1,200 repair and a $500 deductible. Say what I pay and what insurance pays.”

**Must include:**
- You pay $500.
- Insurance pays $700, assuming the repair is covered.
- A clear explanation that the deductible comes before insurance.
- No invented fees or coverage claims.

**Worst failure:** **Confidently wrong** — the wrong amounts or a misleading explanation.

**Proof:** **Yes** — the numbers can be checked.

---

### Writing and editing (3 tasks; 3-minute limit)

**W1 — Urgent client rewrite**

**Ask:** “Rewrite this for a client before my meeting in 10 minutes. Keep it under 60 words and do not invent a new deadline: ‘We wanted to reach out to let you know that, due to the fact that the deadline has been moved up, we are going to need everyone to try to send their materials in as soon as possible.’”

**Must include:**
- Under 60 words.
- The same meaning: the deadline moved up, and materials are needed soon.
- No invented date, reason, or consequence.
- Clear, professional language.

**Worst failure:** **Slow** — a perfect answer delivered after the meeting is useless. This task has a 2-minute limit.

**Proof:** **Some** — word count and meaning can be checked; tone is judged.

---

**W2 — Firm but polite email**

**Ask:** “Edit this email to be firm but polite, with one clear ask and a deadline: ‘Hi Sam, we still haven’t received the report. It was due Friday. Please send it.’”

**Must include:**
- One clear ask.
- One specific deadline.
- A firm but polite tone.
- No invented policy, penalty, or threat.

**Worst failure:** **Missing piece** — no deadline, or more than one unclear ask.

**Proof:** **Some** — the ask, deadline, and tone can be checked; quality is judged.

---

**W3 — Water bottle description**

**Ask:** “Write a 150-word product description for a reusable water bottle that keeps drinks cold for 24 hours. No health claims, no ‘best’ or ‘revolutionary,’ and no made-up materials.”

**Must include:**
- 150 words, give or take 10.
- The 24-hour cold claim.
- At least two concrete features or benefits.
- No health claims, superlatives, or invented materials.

**Worst failure:** **Confidently wrong** — made-up materials or health claims.

**Proof:** **Some** — word count and claims can be checked; quality is judged.

---

### Research with sources (4 tasks; 8-minute limit)

**R1 — EU facial recognition rules**

**Ask:** “Does the EU AI Act ban facial recognition in public places? Explain the actual rule and cite two real sources.”

**Must include:**
- A clear distinction between banned uses and exceptions.
- Two real, openable sources with dates; an official EU source is preferred.
- No claim of a total ban if exceptions exist.
- The current stage or date of the rule.

**Worst failure:** **Confidently wrong** — a made-up rule, a missing exception, or a fake source.

**Proof:** **Some** — open the links and check the rule; judge the explanation.

---

**R2 — Latest iPhone changes**

**Ask:** “What changed in the latest iPhone compared with the previous model? Give three changes that matter and cite one hands-on review.”

**Must include:**
- The exact two models and their release dates.
- Three concrete changes, not marketing slogans.
- One real, openable hands-on review.
- A clear separation between confirmed facts and rumors.

**Worst failure:** **Confidently wrong** — wrong models, invented specs, or a stale “latest” claim.

**Proof:** **Some** — check the links and specs; judge the explanation.

---

**R3 — Coffee and heart health**

**Ask:** “Summarize what the strongest recent human studies say about coffee and heart health. Give two study links and a cautious bottom line.”

**Must include:**
- Two recent human studies or major reviews, with links and dates.
- The difference between “linked to” and “causes.”
- A note on how much coffee and who was studied.
- A cautious bottom line, not “coffee is good” or “coffee is bad.”

**Worst failure:** **Confidently wrong** — overstated claims, fake studies, or a clear medical claim.

**Proof:** **Some** — open the studies and check the claims; judge the summary.

---

**R4 — Free website builders**

**Ask:** “Compare the current price and key limits of three free website builders for a one-page portfolio. Use today’s prices and link each official pricing page.”

**Must include:**
- Three named builders.
- The current price and free-plan limits for each, with the date checked.
- Three official pricing links.
- One clear recommendation for a one-page portfolio.

**Worst failure:** **Confidently wrong** — stale prices or a link that does not match the claim.

**Proof:** **Some** — open the pricing pages; judge the recommendation.

---

### Coding (3 tasks; 8-minute limit)

**C1 — Two largest numbers**

**Ask:** “Write a short Python program that returns the two largest numbers in a list. It must handle duplicates and lists with fewer than two numbers. Include three examples.”

**Must include:**
- The program runs.
- Duplicates work: for example, 5, 5, 1 returns 5 and 5.
- Fewer than two numbers is handled with a clear error or None; the answer says which.
- Three examples run and match their stated output.

**Worst failure:** **Confidently wrong** — code that looks right but fails duplicates or short lists.

**Proof:** **Yes** — run the program and its examples.

---

**C2 — Customer spend query**

**Ask:** “A table called orders has columns id, customer_id, total, and created_at. Write a database query that returns each customer’s total spend in 2025, only customers above $500, highest first. Use a five-row sample with one customer over $500, one under, and one with no 2025 orders. Explain one edge case.”

**Must include:**
- Sums total, filters to 2025, groups by customer, keeps only totals above $500, and sorts highest first.
- The query runs on the five-row sample.
- The explanation matches the query.
- No invented columns.

**Worst failure:** **Confidently wrong** — wrong grouping, wrong year, or a query that does not run.

**Proof:** **Yes** — run the query on the sample.

---

**C3 — Fix the average program**

**Ask:** “A simple average program adds the numbers and divides by how many there are. It crashes on an empty list. Fix it to return None for an empty list and the average otherwise. Add two tests.”

**Must include:**
- None for an empty list.
- The correct average for a normal list.
- Two tests that run and pass.
- No unrelated rewrite.

**Worst failure:** **Confidently wrong** — the fix still crashes, or the tests do not run.

**Proof:** **Yes** — run the program and both tests.

---

### Math (3 tasks; 8-minute limit)

**M1 — Two discounts**

**Ask:** “An $80 shirt is 25% off, then an extra 10% off the sale price. What is the final price, and why isn’t it 35% off? Show the working.”

**Must include:**
- The final price is $54.
- The working shows $80 → $60 → $54.
- A clear explanation that the discounts apply one after the other.
- The 35% comparison is $52, which is $2 less than the correct price.
- No arithmetic error.

**Worst failure:** **Confidently wrong** — a wrong final price or the claim that the discounts simply add.

**Proof:** **Yes** — the arithmetic can be checked.

---

**M2 — Scaling a recipe**

**Ask:** “A recipe uses 3/4 cup of sugar for 12 cookies. How much sugar for 30 cookies, and how many batches is that? Show the fractions.”

**Must include:**
- 2.5 batches.
- 1 7/8 cups of sugar.
- The fraction working.
- Both questions answered.

**Worst failure:** **Confidently wrong** — a wrong amount or a missing batch count.

**Proof:** **Yes** — the fractions and final amount can be checked.

---

**M3 — Average speed**

**Ask:** “A 180-mile trip: the first 120 miles at 60 mph, the last 60 miles at 20 mph. What is the average speed, and why isn’t it 40 mph? Show the time.”

**Must include:**
- 2 hours for the first part and 3 hours for the second part.
- 5 hours total.
- 36 mph average speed.
- An explanation that the slower part takes more time, so the simple average is wrong.

**Worst failure:** **Confidently wrong** — 40 mph or another wrong average.

**Proof:** **Yes** — the time and average can be checked.

---

### Planning (3 tasks; 12-minute limit)

**P1 — Lisbon on a budget**

**Ask:** “Plan a three-day Lisbon trip for two people in May with $1,200 total, excluding flights. Give a day-by-day plan and a rough budget.”

**Must include:**
- Three days for two people in May.
- A total at or under $1,200, split into lodging, food, transport, and activities.
- A realistic daily route with at least three real neighborhoods or places.
- No impossible timing or hidden costs.

**Worst failure:** **Missing piece** — over budget, no day-by-day plan, or no realistic route.

**Proof:** **Some** — the budget and places can be checked; the plan is judged.

---

**P2 — Landing page deadline**

**Ask:** “My team of five has two weeks to launch a simple landing page. Give a 10-working-day plan with owners, dependencies, and a cut list if we lose three days.”

**Must include:**
- 10 working days and five owners.
- Dependencies in the right order.
- A specific cut list for losing three days.
- A launch checklist and a decision date.

**Worst failure:** **Missing piece** — no owners, no dependencies, or no cut list.

**Proof:** **No** — judge the plan against the checklist.

---

**P3 — Spanish in six weeks**

**Ask:** “I have 10 hours a week for six weeks to learn enough Spanish for a two-week trip. Give a weekly plan with speaking practice and a progress check.”

**Must include:**
- Six weekly blocks at 10 hours each.
- Speaking practice every week, not just vocabulary apps.
- Progress checks at weeks 2, 4, and 6.
- Realistic travel goals, not a promise of fluency.

**Worst failure:** **Missing piece** — no speaking practice, no checks, or an unrealistic promise.

**Proof:** **No** — judge the plan against the checklist.

---

## Score sheet

Use one row per task. A, B, and C are the blind labels.

| Task | A | B | C | Slow? | Zero? | Notes |
|---|---:|---:|---:|---|---|---|
| E1 | | | | | | |
| E2 | | | | | | |
| E3 | | | | | | |
| E4 | | | | | | |
| W1 | | | | | | |
| W2 | | | | | | |
| W3 | | | | | | |
| R1 | | | | | | |
| R2 | | | | | | |
| R3 | | | | | | |
| R4 | | | | | | |
| C1 | | | | | | |
| C2 | | | | | | |
| C3 | | | | | | |
| M1 | | | | | | |
| M2 | | | | | | |
| M3 | | | | | | |
| P1 | | | | | | |
| P2 | | | | | | |
| P3 | | | | | | |

After unblinding, write the map here:

- A = ______________________
- B = ______________________
- C = ______________________

Then fill in:

- Team wins out of 20: ______
- Team total out of 60: ______
- Single total out of 60: ______
- Team gain: ______
- Team zero scores: ______
- Single zero scores: ______
- Team slow answers: ______
- Areas where the team won: ______

**Pass mark check:**

- At least 12 wins? Yes / No
- At least 8 points higher? Yes / No
- No more than 3 zeros, and no more zeros than the single? Yes / No
- Wins in at least 3 areas? Yes / No
- No more than 5 slow answers? Yes / No

**All five yes:** build only the winning areas.  
**Any no:** do not build team mode; keep the single model and add the cheapest tool for the most common failure.

## Three tasks most likely to embarrass the team

1. **C1 — Two largest numbers.** The team is likely to look right and fail on duplicates or a short list.  
   **Cheapest rescue:** a run button that executes the answer against the three examples and shows the actual output.

2. **R2 — Latest iPhone changes.** The team is likely to use stale or invented details.  
   **Cheapest rescue:** web search that opens the cited hands-on review, not just a search snippet.

3. **M3 — Average speed.** The team is likely to average the two speeds and say 40 mph.  
   **Cheapest rescue:** a calculator panel that checks the time and final average.

If the team fails these three, fix the tools and retest these tasks before building a larger team.
