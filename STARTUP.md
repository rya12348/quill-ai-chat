# Stet: the startup thesis

## One sentence

**Stet turns any public website into a safe, live lesson with a quiz and student responses — in under a minute.**

A tutor pastes a simulation, an article, or a primary source. Stet builds a teachable lesson around it, embeds the real page in an opaque sandbox with the ads and trackers stripped, and gives the tutor one link that works on a school Chromebook with no student accounts.

## Why this is a real company, not another AI chat

The market is full of AI lesson *generators*. Nearpod, Diffit, MagicSchool and Brisk all produce text or slides. Almost none of them can run the actual website inside the lesson because embedding the open web safely is hard: sites block iframes, leak cookies, inject ads, and break inside a sandbox.

Stet already has that layer. It fetches a public page server-side, rewrites its assets and frames through a token-scoped capability proxy, strips the ad wrapper, and renders it in an opaque-origin iframe. The proxy is the moat; the lesson is the product on top.

Nearpod is the proof of willingness to pay: it charges **$159–$397/year per teacher** and reserves its AI lesson generator for school and district contracts. Teachers still spend **$500–$1,600 of their own money** on classroom tools each year. Homeschool families spend **$500–$2,500 per child annually** on curriculum and resources. There is a large, reachable buyer who is already paying, and the incumbent's AI is locked behind enterprise sales.

## The customer, in order

1. **Tutors and homeschool parents.** One decision-maker, own budget, immediate pain, no procurement. They teach the same student repeatedly, so a great lesson creates retention. This is the beachhead.
2. **Individual teachers.** They already pay out of pocket for tools that save time. A $9/month price is an easy yes compared with $159–$397/year. They are reachable through teacher TikTok, Instagram, Facebook groups, Pinterest, and homeschool co-ops.
3. **Tutoring centers and microschools.** Several tutors share lessons and want a roster. Charge per seat or a flat center plan.
4. **Schools and districts.** Later. This is where the large contracts are, but it needs SSO, rostering, admin controls, and a sales motion. Do not start here.

## Product

### The wedge: one link, one live lesson

The teacher enters a topic, a URL, a grade, and a duration. Stet returns:

- a clear objective;
- four teachable steps: explore, investigate, explain, reflect;
- teacher notes with what to say and what to watch for;
- a five-question quiz with explanations, graded on the server;
- an exit ticket;
- a public student link that needs only a first name.

The student sees the real site in a sandboxed frame, works through the tasks, answers the quiz, and submits. The teacher sees every score and exit response, and can export a CSV.

### Why the live page matters

The live page is not decoration. It removes the worst part of lesson prep: finding a resource, checking it is appropriate, keeping students on it, and hoping the ads do not appear. Stet makes the live resource part of the lesson and keeps it read-only, ad-stripped, and away from the teacher's session.

### What we deliberately do not do yet

No live synchronous classroom, no gradebook, no district rostering, no student accounts, no video, no LMS integration. Those are expansions, not the first product.

## Business model

| Plan | Price | Included |
|---|---|---|
| Free | $0 | 3 lessons/month, 40 responses per lesson, live embed, server-graded quiz, share link |
| Pro | $9/month | Unlimited lessons, 200 responses per lesson, CSV export, priority generation |
| Center / school | Later | Shared library, roster, admin billing, SSO |

The free plan is a real trial, not a demo: a tutor can run one full lesson with a real student and see the value. The cap creates a natural upgrade moment when they plan a second week.

**Unit economics:** generation uses the existing free model chain, so the marginal cost of a lesson is near zero. The paid path can move to a reliable hosted model and still keep a high gross margin at $9/month. The expensive part is distribution, not inference.

## Go-to-market

### The first 30 days

- Put the landing page and free lesson flow in front of 50 tutors/homeschool parents. Do not buy ads.
- Post one short video per day: "I turned [real website] into a 20-minute lesson in 40 seconds." Show the live page and the student response page, not a slide deck.
- Offer a founding-teacher price ($9/month locked) to the first 25 paying accounts.
- Join 10 homeschool/tutor communities and answer lesson-planning questions with a free lesson built for the person asking. Do not spam links.
- Instrument the funnel: landing → guest lesson → published lesson → student response → return visit → upgrade.

### The next 90 days

- SEO pages for "Nearpod alternative for tutors", "turn a website into a lesson", "live lesson generator", and subject-specific examples.
- A public lesson library: the best lessons are discoverable and remixable. This is the loop competitors cannot copy without the live-web layer.
- A referral mechanic: a teacher shares a student link; the footer says "Made with Stet — make your own." The student's parent and other teachers see it.
- Partner with 5 homeschool co-ops and 5 tutoring centers for a paid pilot.
- Add a "center" plan only after three centers ask for shared access.

### The long-term expansion

Start with the lesson. Expand into the **live learning layer for the open web**: any tutor, teacher, or training team can turn a real website into a guided activity with prompts, checks, and evidence of completion. The same primitive works for onboarding, compliance training, and customer education. That is the larger company.

## Moat

1. **The proxy and sandbox.** Hard to build correctly; already working across real sites, frames, assets, and games.
2. **The lesson graph.** Which sites work, which prompts produce good responses, and which lessons get completed. This improves with usage.
3. **The share loop.** Every student link is a distribution surface.
4. **Workflow ownership.** The lesson, the student responses, and the review live in one place. A text generator cannot own the classroom moment.

## The 90-day scorecard

The startup is working if, by day 90:

- 500 visitors from teacher/homeschool channels;
- 150 free lessons created;
- 60 lessons actually opened by a student;
- 300 student responses;
- 25 paying Pro accounts (~$225 MRR);
- 40% of activated teachers create a second lesson within 14 days;
- under 5% monthly churn among paying tutors.

If activation is high but conversion is low, raise the free response cap or add a per-lesson one-time pass. If traffic is high but activation is low, the lesson quality or the first-run experience is the problem, not the price.

## Risks and how to handle them

- **Website breakage.** The proxy already degrades gracefully; the lesson still works as a text activity if the live page is unavailable. Show a clear fallback.
- **Copyright and acceptable use.** Only public pages; do not cache or redistribute content beyond the live view; provide a takedown path; do not position the product as a way to bypass school filters.
- **Student privacy.** No student accounts, collect only a first name and responses, let the teacher delete a lesson and all responses, publish a plain-language privacy policy before charging.
- **Model reliability.** Generation is bounded and validated; a malformed lesson is retried on another lane. A teacher can always regenerate.
- **Competition.** Nearpod can add web embeds, but its business is district contracts. Win the individual tutor with speed, price, and a live page that actually works.

## What shipped in this build

- A new teacher-first landing page and signup path.
- A Lessons workspace: create a lesson from a topic or a public URL, see the objective, steps, quiz, teacher notes, live site, share link, student responses, and CSV export.
- A public student lesson page with no account, server-graded quiz, explanations, and exit ticket.
- A data model for lessons, responses, and subscriptions.
- Plan-aware limits: 3 free lessons/month and 40 responses per lesson; Pro is unlimited lessons and 200 responses.
- A Stripe checkout route and signed webhook that upgrades an account to Pro once the keys are configured.
- The existing Stet chat/Research/Build/Canvas product is still available behind the same account, so the lesson studio does not throw away the work that came before.

## The one thing to do next

Get 10 real tutors to run one lesson with a real student this week. Watch where they stop. The product is already good enough to learn from; the risk is building more before talking to the buyer.
