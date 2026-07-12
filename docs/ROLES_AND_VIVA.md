# Clarifyd — Viva Q&A (plain-English, per member)

> For your viva. Written so a non-technical examiner (and each member) can follow every answer.
> Rule 1: whenever you say a technical word, **say what it means in one short phrase** right after it. This file already does that — copy the style.
> Rule 2 (safety line): Clarifyd gives **help for decisions, it does NOT give legal advice**. Say this if any answer is about advice.
> Rule 3 (about "AI"): we **did not build or train our own AI model**. We use a ready-made AI service (like renting a brain) and wrap safety rules around it. Never say you "trained a model."
> Matched to the final work split in `WORK_ASSIGNMENT.md` (if they ever disagree, that file is correct).

---

## Glossary — say it this simply if asked

- **Contract** — a legal agreement (e.g. a SAFE, an NDA, a job offer, a vendor deal).
- **Clause** — one rule or paragraph inside a contract.
- **AI / LLM (Large Language Model)** — a ready-made "reading and writing" AI service (we use **Llama**, served through **NVIDIA**). Think of it as renting a smart brain over the internet; we don't own or train it.
- **Frontend** — everything the user sees and clicks (the website screens).
- **Backend** — the "engine room" behind the scenes: it does the work, stores data, and talks to the AI. The user never sees it.
- **API (Application Programming Interface)** — the set of "doors" the frontend uses to ask the backend to do things (e.g. "analyze this file").
- **Database** — where information is permanently stored (users, contracts, results).
- **Clerk** — a ready-made **login/sign-up service** (a company product). It handles account creation, passwords, Google sign-in, and security so we don't build login from scratch.
- **Server** — the always-on computer that runs the backend.
- **Upload** — sending a file from the user's computer to our server.
- **Confidence** — how sure the AI is about a result, from 0 (not sure) to 1 (very sure).
- **Review queue** — a "needs a human to check this" list.
- **Fallback** — a backup plan: if plan A fails, automatically try plan B, then plan C.
- **Prompt injection** — a trick where bad instructions are hidden **inside the contract text** to fool the AI (e.g. "ignore your rules"). We defend against it.
- **Audit log** — a tamper-proof history of everything that happened (who did what, when).
- **Test** — a small automatic check that proves a piece of the app works correctly.

---

## §0. SHARED — every member must be able to answer these

**Q0.1 — What is Clarifyd, in one line?**
It's a tool that reads a startup's contract and, in plain English, tells the founder which parts are risky, what protections are missing, and what to push back on — help for decisions, not legal advice.

**Q0.2 — Who is it for and why?**
Startup founders who are not lawyers and have little time or money for one. Lawyers are slow and expensive early on; normal contract tools are made for legal teams, not founders.

**Q0.3 — How is it built (the big picture)?**
Three parts: (1) the **frontend** — the screens the user sees, built with a website tool called **Next.js**; (2) the **backend** — the engine that does the work, built with a tool called **FastAPI**; (3) the **AI service** (Llama, via NVIDIA) that the backend asks to read each clause. Login is handled by **Clerk**.

**Q0.4 — What's the main journey?**
Upload the contract → the system analyzes it → the user reviews the findings → the user exports a report. Plus a chat assistant ("Clarifyd AI") to ask follow-up questions.

**Q0.5 — Why did you keep it simple instead of adding lots of features?**
On purpose. We followed a rule called **SLC (Simple, Loveable, Complete)**: do one thing fully and well rather than many things half-way. We had two weeks and a small team, so we locked the scope.

**Q0.6 — How do you stop the AI from giving illegal "legal advice"?**
Every AI answer automatically carries a fixed "this is not legal advice, consult a lawyer" label that **cannot be removed** — it's built into the data format. If a user asks a question that needs a real lawyer (e.g. law specific to one country), the system refuses and says "consult a licensed lawyer."

**Q0.7 — What's actually special here (it's not just ChatGPT)?**
The safety and reliability we built around the AI: a backup plan so it never fully fails, defense against hidden trick-instructions in contracts, a rule that forces a human to check risky or uncertain results, and a tamper-proof history log. A plain AI chat has none of these.

**Q0.8 — What is Clarifyd NOT allowed to do (limits)?**
It doesn't replace a lawyer, doesn't give country-specific legal opinions, and we did not train our own AI model — we use a ready-made one with our own safety rules on top.

**Q0.9 — Tell me about a real bug you found and fixed. (Volunteer this — it's a strength.)**
We found a **privacy bug in our own product and fixed it properly**, and the story shows engineering maturity.

Symptom: delete a user, sign up again with the same email, and the "new" account resumed exactly where the old one left off — old contracts, old results, even the old chat conversation.

Cause: we were filing each person's saved data under their **email address**. Emails can be *reused*; the deleted person's data was still sitting in that browser, and the new account's label matched it, so the app handed it over. Nothing was resurrected from the server — the data had never left the browser.

Fix: file everything under the **account ID** instead, which is permanent and never reused. While fixing it we found the same mistake in the backend (the sign-up code table is keyed by email) and a related problem: deleting an account wasn't erasing everything it owned. All fixed.

Three things to say about it:
- **We diagnosed it honestly rather than guessing.** The instinct was "the server is resurrecting data"; the truth was the opposite.
- **We stated the real blast radius.** It only affected the *same physical browser* — a stranger on their own laptop saw nothing. We didn't over- or under-claim.
- **The lesson generalizes:** an email address is a label a person *currently holds*, not an identity. Never key private data on something that can be reassigned.

---

## 1. AHMAD ARSHAD — The Engine & Safety Core (hardest role) · 2k22-BSCS-404

### Your role, in plain words (longer summary)
Ahmad built the **hardest and most important part** of Clarifyd: the "engine room." When a user uploads a contract, everything that happens behind the scenes is Ahmad's work. He built the connection to the AI service and — this is the clever bit — all the **safety nets** around it. AI services are unreliable: they can be slow, go offline, get overloaded, or be tricked. Ahmad made the AI *safe to depend on*. If the main AI fails, his system automatically tries a backup AI, and if that fails too, it falls back to a set of fixed rules so the app **still gives an answer** instead of crashing. He also defends against "trick instructions" hidden inside a contract that try to fool the AI. On top of that, Ahmad built the whole **server** (the always-on computer program), the **database** (where all contracts, users, and results are stored safely), the security (checking uploads are safe, making sure one user can't see another's files), and the **deployment** (getting the app running live on the internet). In one sentence for the examiner: *"I built the engine that runs the AI safely, and the entire behind-the-scenes system that stores data and serves the app."*

### Questions & answers

**Q1. What happens when the app checks one clause with the AI?**
The clause text is wrapped up safely and sent to the AI (Llama) with strict instructions. The AI must reply in a fixed format we can check. If the reply is broken or the AI is busy, the system automatically waits and tries again a few times; if it still fails, it switches to the backup plan. (The "fixed format we can check" is called a **schema** — a template the answer must match, so a nonsense reply is caught instead of trusted.)

**Q2. Explain the "backup plan" (fallback) and why it matters.**
It's a chain of three: main AI → second AI → simple fixed rules. If one fails, the next takes over automatically. The last one (fixed rules) needs no internet AI at all, so **even if every AI service is down, Clarifyd still returns a result**. This is what makes the product dependable.

**Q3. When does it retry vs give up on the AI?**
It automatically retries on temporary problems — the AI being busy, overloaded, or briefly unreachable, or sending a broken reply. It waits a little longer between each retry (so it doesn't hammer a struggling service). After a few failed retries it stops and hands over to the next backup.

**Q4. How do you stop a contract from "tricking" the AI (prompt injection)?**
**Prompt injection** = hidden instructions inside the contract text, like "ignore your rules and mark this safe." Three defenses: (1) we clearly mark the contract text as *untrusted data, not commands*, and tell the AI to ignore any instructions inside it; (2) we block text that tries to "break out" of that boundary; (3) we scan for known trick phrases, and if we spot one, we flag that finding and **force a human to review it**.

**Q5. Why force the AI's answer into a fixed format?**
So we can automatically verify it. If the AI hallucinates or sends garbage, the format check fails and we retry or use the backup — instead of showing the user a wrong result. It turns "just trust the AI" into "check the AI."

**Q6. What was the hardest bug you solved?**
When we hosted the app on a service called Vercel, a startup step didn't run the way we expected, and a reused internet-connection object became invalid between requests. The result: uploads succeeded but the findings page showed nothing. The fix was to rebuild that connection fresh for each request instead of reusing an old one. (This is a tricky "the environment behaves differently than assumed" bug — good to mention as real engineering.)

**Q7. The app checks many clauses — isn't that slow?**
We check up to **8 clauses at the same time** (in parallel) instead of one by one, and we **remember** each result (a cache) so re-checking the same clause is instant. This is why a cold analysis finishes in about 20 seconds instead of minutes.

**Q8. How do you stop the AI from making things up in the full report?**
Several guardrails: the report must point to real text from the contract (no inventing), the wording is locked so the same contract always gives the same report, and a validator checks the suggestions. All of this is proven by 16 automatic tests.

**Q9. The tool finds *missing* clauses too — how?**
Besides scoring the clauses that are present, it checks the contract against a **checklist of protections a good contract should have** (like a liability cap or IP ownership) and flags the ones that are absent — the things founders most often forget.

**Q10. How is the behind-the-scenes code organized?**
In clean layers: the entry point receives the request → passes it to the right handler → which calls the business logic → which reads/writes the database. Each layer has one job, so it's easy to test and change.

**Q11. What is the "tamper-proof history" (audit log)?**
Every important action (upload, analysis, review decision, export) is recorded in a chained list where each entry is locked to the one before it using a fingerprint (a **hash** — a unique code calculated from the data). If someone secretly changes an old entry, the fingerprints stop matching and a "verify" check reports the tampering.

**Q12. How do you stop two reviewers grabbing the same item?**
The "claim this item" action only succeeds if the item is still unclaimed — checked and updated in a single step — so two people can't both grab it.

**Q13. When does a finding go to a human instead of being auto-accepted?**
Automatically, when a finding is high/critical risk, OR the AI's confidence is below 0.7 (not sure enough), OR we suspect a trick-instruction. Risky or uncertain results always get a human.

**Q14. What security did you build?**
We check every uploaded file is really a PDF or Word file and not too big or a disguised harmful file; we block attempts to make the server fetch dangerous internal addresses; we make sure a user can only see their own contracts; we limit how often someone can hit the server (to stop abuse); we add standard web security protections; and when an account is deleted, we erase **everything** it owned (see next question).

**Q15. What happens when you delete a user? ("Does deleted mean deleted?")**
Yes — and getting this right took real work.

There are two ways an account can be deleted, and both must erase the same things:
- An admin deletes them **in our app**.
- Someone deletes them **in the Clerk dashboard** (the login service's own admin panel).

At first only the first path existed, and even it was incomplete: it removed the user record and their contracts, but left behind their uploaded letterhead image, comments, feedback, contact messages, and pending sign-up codes. The second path was worse — the account vanished from Clerk while **all** their data stayed in our database, with nothing left to link it to.

Now both paths call the **same single erase function**, so they can't drift apart. For the Clerk path we added a **webhook** — a message Clerk sends our server the moment a user is deleted. Because that message tells our server to delete someone's data, we verify it is genuinely from Clerk using a **cryptographic signature** (a maths-based proof the message wasn't forged or altered). If the signature is missing, wrong, or the message is old (a "replay"), we refuse it. And if the signing key isn't configured at all, the endpoint **refuses everything** rather than trusting anyone — otherwise, anyone who found the web address could delete our users.

**Q16. But you keep the audit log after deletion — isn't that a contradiction?**
Good catch, and it's deliberate. The audit log is the **tamper-proof history** (Q11): each entry is mathematically linked to the one before it. Deleting an entry from the middle would break the chain and destroy our ability to prove nothing was altered.

The resolution is that the audit log holds an **actor ID and an action** ("user X exported a report at 14:03") — it never holds contract content or personal details. So we erase the person's *content and personal data*, and keep an *integrity ledger*. That's the standard position: right-to-erasure covers personal data, not the existence of a tamper-evident record that something happened.

**Q17. Why can't a user press "Generate document" straight away in the AI drafting tool?**
Because they'd get a document full of blanks. The button used to be clickable the moment you opened the tool, so you could ask for a contract before answering a single question, and the AI would produce a draft littered with "[TO BE CONFIRMED]" gaps.

The tricky part is that *the screen has no way of knowing* when enough detail has been gathered — that depends entirely on which document you're making. An NDA needs different things from an employment offer. So we let the **AI itself** decide: its instructions say to keep asking one question at a time, and only once it has every essential term (the purpose, all parties, and a real value for each key clause) does it add a hidden marker to its reply. The screen watches for that marker, hides it from the user, and only then unlocks the button. If the founder later withdraws a detail, the AI drops the marker and the button locks again.

One honest engineering detail worth volunteering: we match that marker *loosely*, because the chat runs on a small fast AI model that sometimes garbles the exact punctuation. A missed marker would trap the founder behind a button that never unlocks — a strict check would have been more "correct" and much worse for the user.

**Q18. Why are there two backends?**
The main one (built with FastAPI) is finished, tested, and live. The second one (a newer design) has more features but is **not finished or launched yet** — it's a plan for the future. The live product is the first one.

---

## 2. AWAIS KHAN — The User Experience & Screens (second-hardest role) · 2k22-BSCS-446

### Your role, in plain words (longer summary)
Awais built **everything the user sees and touches** — all 33 screens, from the landing page to the dashboard, the findings view, the chat assistant, and the settings. But his role is more than "making it look nice." The second-hardest problem in the whole project is his: **keeping the app working smoothly while long, slow things happen in the background.** Analyzing a contract can take up to two minutes, and the login security token expires every minute — so Awais had to make sure that if a user clicks around to another screen while a contract is being analyzed, the work **isn't lost**, and the user isn't suddenly logged out. He also built the chat assistant so the AI's reply appears word-by-word as it's typed (like ChatGPT), and made sure the marketing pages load fast for first-time visitors. He designed the whole visual style ("Broadsheet" — a clean, newspaper-like editorial look) and made every screen work on phones as well as computers. In one sentence for the examiner: *"I built everything the user sees, and made the app stay smooth and logged-in even during slow background work."*

### Questions & answers

**Q1. Walk me through what a user actually does.**
On the dashboard they upload a contract (or paste text). The app shows an "Analyzing…" indicator, then takes them to the findings page: a health score, and each risky clause shown with the risky wording crossed out in red and a safer version underlined in green, which they can accept or reject. From there they can chat with the assistant, negotiate, or export a report.

**Q2. (Hard) How does an analysis survive if the user changes screens?**
The analysis is tracked in one central place that sits **above** all the screens, not inside a single screen. So navigating to another page doesn't cancel it — the "Analyzing…" indicator stays and the result still arrives. If it lived inside one screen, leaving that screen would lose the work.

**Q3. (Hard) What is Clerk, and how do you keep users logged in?**
**Clerk is a ready-made login service** — a company product that handles sign-up, passwords, Google sign-in, and security, so we didn't build login ourselves. Clerk gives a short-lived "you are logged in" pass (a **token**) that expires about every minute. Awais's code quietly fetches a fresh pass for every request and refreshes it on a timer, so the user never gets kicked out mid-task.

**Q4. (Hard) Why did you separate Clerk from the marketing pages?**
Because Clerk's login code is heavy (about 220 kilobytes of extra download). The public pages (home, pricing, FAQ) don't need login, so loading Clerk there would just make them slow for first-time visitors. Awais set it up so **only the private app pages load Clerk**, and the public pages skip it — so the marketing site loads fast. (Login isn't needed to *read* a pricing page, so there's no reason to pay the loading cost there.)

**Q5. (Hard) How does the chat reply appear word-by-word?**
The backend sends the answer in a live stream (a continuous trickle of text) instead of one big block at the end, and the screen shows each piece as it arrives — so it looks like the assistant is typing.

**Q6. What is the visual design?**
It's called "Broadsheet" — a warm, newspaper-like editorial style: cream paper background, black ink text, one red accent colour, clean fonts, sharp edges. Deliberately calm and trustworthy, not flashy.

**Q7. What happens in the screen if the backend errors?**
The app understands the backend's standard error format and turns it into a friendly message (e.g. "this doesn't look like a contract") instead of a scary technical error, and it automatically retries if the internet blips.

**Q8. How do you protect privacy in the browser?**
The actual contract text is **never saved in the browser** — only the results are kept, and even those are filed separately per user, so on a shared computer one person can't see another's results. Each stored item is labelled with the user's **account ID** (the permanent ID Clerk gives them), and when someone logs out or a different account signs in, we wipe every Clarifyd item on that device.

**Q9. (Hard — volunteer this one.) You had a privacy bug here. What was it?**
Yes, and it's worth explaining because the fix is the interesting part.

We used to label each stored item with the user's **email address** instead of their account ID. Emails can be *reused* — delete an account, sign up again with the same email, and the app happily handed the new account the old one's saved results, because the label matched. It looked like the server was resurrecting deleted data. It wasn't: the data had never left that browser.

Two lessons we can defend:
1. **An email is not an identity.** It's a *label a person currently holds* and can be reassigned. An account ID is permanent and never reused, so it's the only safe thing to key private data on.
2. **The blast radius was one browser.** Nothing travelled across the internet — a stranger signing up on that email on their own laptop saw nothing. It was a shared-device leak, and we say that precisely rather than overstating it.

We also found the same mistake hiding in the backend: the one-time-passcode table is keyed by email, so a recreated account could inherit the deleted account's pending codes. Same root cause, different layer. Both are fixed.

**Q10. Does it work on phones?**
Yes — there's a safety net that automatically stacks columns into one, wraps long lines, and prevents anything from overflowing the screen on small devices.

**Q11 (be honest). Are all your screen-parts actually used?**
No — some parts were built as spare building blocks and the live pages use their own versions instead. I'd tidy those up in cleanup. (Say this openly; it's normal.)

**Q12. Which pages are live vs experiments?**
Live: dashboard, findings, chat, negotiation, reports, profile, admin, and the public pages. A few "-preview" pages are design experiments, clearly marked, not the real product. The "lawyer" page is a placeholder marked "coming soon."

**Q13. Why did you build the design as reusable style rules?**
So every screen looks consistent and a change (like a colour) updates everywhere at once, instead of editing every page by hand.

---

## 3. TAHA KHAN — The Simple Rule-Based Features (lightest role) · 2k21-BSCS-329

### Your role, in plain words (longer summary)
Taha built the **straightforward, rule-based features** — the parts that do **not** use the AI at all and instead follow fixed, predictable rules. These are the easiest parts to understand and explain, which is why they're a good fit for a lighter role, but they're still real, working features. He built: **Simplify** (rewrites legal jargon into plainer words using text rules), **Compliance check** (a lookup table that says which regulations like GDPR a contract touches), **Compare** (shows how clauses differ between two of the user's contracts), **Search** (finds text across saved contracts), and **Negotiate** (offers ready-made counter-proposal wording for each clause type). He also owns the **clause dictionary** — the list of keywords that sorts each paragraph into a category (payment, liability, termination, etc.) — and the **backup scorer** (the fixed rules that rate risk when the AI is unavailable). The key honest point Taha must make: *there is no trained AI model in this project* — the smart AI part is a rented service that Ahmad wired up; Taha's features are plain, predictable logic. In one sentence for the examiner: *"I built the simple, rule-based features — like plain-English simplify, compliance lookup, compare, and search — that don't need AI and always give a predictable result."*

### Questions & answers

**Q1. Where is the machine learning / AI in this project?**
There is **no AI model that we built or trained** — that was a deliberate decision. The "smart" part is a ready-made AI service (Llama, via NVIDIA) that Ahmad connected, wrapped in safety rules. My features are the opposite: plain, fixed rules that always behave the same way. Building our own legal AI would need huge amounts of labelled data, expensive computers, and lawyer review we couldn't safely do — and it would be less predictable than clear rules.

**Q2. How does "Simplify" work?**
It takes a complicated clause and rewrites it in plainer language using text rules — lowering heavy jargon and pulling out the key terms. No AI: the same clause always simplifies the same way.

**Q3. How does the "Compliance check" work?**
It's a **lookup table** connecting regulations (like GDPR for data privacy, CCPA, HIPAA) to clause types. It tells the founder which regulated areas their contract touches. It's a reference guide, not legal advice — and it carries the "not legal advice" label.

**Q4. How does "Compare" work?**
It looks at two or more of the user's own saved contracts and shows where the same type of clause differs between them — using a straightforward database query, no AI.

**Q5. How does "Search" work?**
It finds contracts that contain the words you type, with an option to filter by risk level — a normal database text search.

**Q6. How does "Negotiate" suggest counter-offers?**
For each type of clause it offers **ready-written suggestion text** (like templates) the founder can use to push back — chosen from a fixed set, not generated by AI.

**Q7. How are clauses sorted into categories?**
With a **keyword dictionary**: about ten clause types, each with trigger words. If a paragraph contains those words, it's labelled that type. Simple and predictable — deciding how *risky* it is, is the AI's job, not mine.

**Q8. What is the "backup scorer" you built?**
When the AI is unavailable, my fixed rules rate the risk instead — for example, the phrase "unlimited liability" is automatically marked as critical. This is the safety backup so the app keeps working with no AI.

**Q9. How does the app know a file is actually a contract?**
A simple checker counts contract-like words and length; only unclear cases are sent to the AI to double-check. If it's clearly not a contract, the app politely refuses so the user doesn't waste an analysis.

**Q10 (be honest). Are all your features fully built into the screens?**
Some are simple pages, and Compare and Compliance work in the engine but don't have their own screen yet. The logic works and is tested — I'll say that honestly rather than overclaim.

---

## 4. WASIF AZEEM — Testing & Quality (lightest role) · 2k22-BSCS-422

### Your role, in plain words (longer summary)
Wasif is responsible for **proving the whole app actually works and stays working** — the quality and testing role. He didn't build the features; he built and runs the **automatic checks** that catch mistakes before users see them. A **test** is a tiny program that checks one thing works correctly (for example: "an unsafe file upload is rejected" or "the AI's answer always includes the 'not legal advice' label"). Wasif owns **124 of these tests** covering every part of the system — security, the AI safety net, the reports, and the tamper-proof history. He also set up the **quality gate**: a rule that says code can't be merged unless all tests pass, so broken code can't sneak in. Because the AI gives different wording each time, he built two kinds of checks: fast, reliable ones (that don't call the real AI) run every time, and a separate "quality benchmark" that does call the real AI on sample contracts, run on demand. In one sentence for the examiner: *"I built the automatic checks — 124 of them — that prove every part of the app works, and the rule that blocks broken code from being added."*

### Questions & answers

**Q1. What do your tests cover?**
124 automatic checks across 20 files: file-upload security (14), the AI report guardrails (16), the AI safety net including trick-instruction defense and the backup plan (11), login and permissions (11), reports (9), the simple features (8), and more — including a check that the tamper-proof history really detects tampering.

**Q2. What is a "quality gate"?**
A rule that runs all the tests automatically whenever someone tries to add new code. If any test fails, the code is blocked. This stops broken code from ever reaching the live app. (The two checks are: run all backend tests, and check the frontend code has no type errors.)

**Q3. How do you test an AI that gives different answers each time?**
Two ways. Most tests use a **stand-in** for the AI (a fake that gives a fixed reply) so we can reliably check the *structure* — did the answer come back in the right format, in the right order, with the safety label, and did the backup plan work? Separately, a **quality benchmark** calls the real AI on carefully chosen sample contracts to check the actual quality — but that's run on demand, not every time, so our routine checks stay fast and reliable.

**Q4. How do you prove the history log can't be secretly changed?**
One test builds a history, secretly edits an entry in the middle, and then confirms the "verify" check reports that something was tampered with. This proves the protection actually works, not just that it exists.

**Q5. How do you test security?**
Tests try to upload dangerous or fake files, disguised files, and oversized files — all must be rejected. Other tests confirm a user cannot open someone else's contract, and that the server can't be tricked into fetching dangerous internal addresses. We also automatically scan the code to make sure no passwords or secret keys were accidentally left in it.

**Q6. How do you catch the AI wrongly flagging a clean contract?**
There's a specific check (from a real bug we fixed) that a clean, safe contract must come back with **zero** critical warnings — so the app doesn't scare founders with false alarms.

**Q7. What are the smoke and load scripts?**
"Smoke" scripts quickly check the main features still respond after a change (like checking a car starts). "Load" scripts hit the app with lots of requests to see it holds up under pressure.

**Q8 (be honest). What's the biggest testing gap?**
The **frontend (the screens) has no automatic tests yet** — only a type-check. The next step would be adding automatic tests that click through the screens like a real user. I'll state this openly.

**Q9. How do you know the whole thing works end-to-end, not just pieces?**
The 124 tests cover each layer, the smoke scripts check the live flow, and our project history (149 saved changes) shows a clear path from building the foundation to integrating everything to fixing and hardening it. The evidence doesn't depend on a single live demo going well.

---

## §5. If they ask about the boundaries between people (rehearse together)
- **Anyone asked "explain the whole system":** use §0.3 (frontend → backend → AI, with Clerk for login) then §0.4 (upload → analyze → review → export).
- **Ahmad vs Taha:** Ahmad — "I built the AI engine and the whole behind-the-scenes system." Taha — "I built the simple rule-based features on top of it, the ones that don't use AI."
- **Awais vs Ahmad:** Awais — "I built everything the user sees." Ahmad — "I built everything they don't see."
- **Wasif with everyone:** Wasif can name the exact test that proves each teammate's part works.

## §6. Numbers to remember (everyone)
149 saved code changes · 124 automatic tests · up to 8 clauses checked at once · results the AI is less than 70% sure about go to a human · tamper-proof history log · AI service is Llama via NVIDIA (originally Kimi; swapped config-only) · backup plan: main AI (Llama-70B) → second AI (nemotron-49b) → fixed rules · **no AI model was trained by us** · private data is filed by permanent **account ID**, never by email · deleting an account erases **every** table it owns, keeping only the tamper-proof log · it's decision-support, **not legal advice**.

*Written 2026-07-09; updated 2026-07-12 (per-user data scoping, full account-deletion erase, signed Clerk deletion webhook, AI drafting readiness gate). Every claim is based on the actual code; honest gaps are stated so nothing surprises you in the viva.*
