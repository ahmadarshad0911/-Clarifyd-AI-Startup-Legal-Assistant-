"""Step-by-step work journey per member.

"What did YOU actually do, and in what order?" is one of the most common viva
questions, and one of the easiest to answer badly -- students describe the
finished system rather than their own sequence of work.

Each journey below is chronological: what was built, WHY it had to come at that
point, what problem was hit, and what it unlocked next.
"""

from build_viva_guides import simple, say, push, trap, why, fig


def journey_intro(name, rule):
    return f"""
<h2 class="pagebreak">Part W &mdash; Your work, step by step (what you did, in order)</h2>

<div class="box trap">
  <div class="h">The question this answers</div>
  <p><b>&ldquo;What did YOU actually do, and in what order?&rdquo;</b> &mdash; and its harder follow-up,
  <b>&ldquo;why did you do it in that order?&rdquo;</b></p>
  <p>Most students answer this badly. They describe the <em>finished system</em> instead of their own <em>sequence of
  work</em>, which makes it sound like the project appeared fully formed &mdash; or worse, like somebody else built it
  and they are reciting it.</p>
  <p><b>Tell it as a story with causes.</b> Each step must explain why it had to come <em>then</em>, what went wrong,
  and what it unlocked. That is what a real engineer's memory of their own work sounds like.</p>
</div>

<div class="box say">
  <div class="h">Your one-line ordering rule (say this if asked why this order)</div>
  <p>&ldquo;{rule}&rdquo;</p>
</div>
"""


def step(n, title, did, why_now, problem, unlocked):
    return f"""
<div class="qa">
  <div class="q">Step {n} &mdash; {title}</div>
  <p class="a"><b>What I did:</b> {did}</p>
  <p style="margin:8px 0 0 25px"><b>Why it had to come now:</b> {why_now}</p>
  <p style="margin:8px 0 0 25px"><b>What went wrong:</b> {problem}</p>
  <p style="margin:8px 0 0 25px"><b>What it unlocked:</b> {unlocked}</p>
</div>
"""


TIMELINE_SVG = """<svg viewBox="0 0 860 130" role="img" aria-label="Project timeline">
  <path class="ln" d="M30 70 L830 70"/>
  <circle class="ac" cx="80" cy="70" r="7"/><text class="sm bold" x="80" y="50" text-anchor="middle">FREEZE</text>
  <text class="sm" x="80" y="94" text-anchor="middle">schemas</text>
  <text class="sm" x="80" y="108" text-anchor="middle">locked</text>

  <circle class="ac" cx="250" cy="70" r="7"/><text class="sm bold" x="250" y="50" text-anchor="middle">SERVICES</text>
  <text class="sm" x="250" y="94" text-anchor="middle">ingest, extract,</text>
  <text class="sm" x="250" y="108" text-anchor="middle">score</text>

  <circle class="ac" cx="430" cy="70" r="7"/><text class="sm bold" x="430" y="50" text-anchor="middle">API + DB</text>
  <text class="sm" x="430" y="94" text-anchor="middle">endpoints, review</text>
  <text class="sm" x="430" y="108" text-anchor="middle">queue, audit</text>

  <circle class="ac" cx="610" cy="70" r="7"/><text class="sm bold" x="610" y="50" text-anchor="middle">GATE</text>
  <text class="sm" x="610" y="94" text-anchor="middle">backend ready &rarr;</text>
  <text class="sm" x="610" y="108" text-anchor="middle">frontend starts</text>

  <circle class="ac" cx="790" cy="70" r="7"/><text class="sm bold" x="790" y="50" text-anchor="middle">HARDEN</text>
  <text class="sm" x="790" y="94" text-anchor="middle">security, privacy,</text>
  <text class="sm" x="790" y="108" text-anchor="middle">deploy</text>
</svg>"""


# ================================================================= AHMAD
AHMAD = journey_intro(
    "Ahmad Arshad",
    "I worked backend-first and bottom-up: nothing above a layer could be built until the layer beneath it was "
    "stable. The API contract was frozen first precisely so that Awais could build screens against something that "
    "would not move under him."
) + fig(TIMELINE_SVG, "The project timeline. My work is the first four markers; the frontend was deliberately blocked until the gate.") + """
<h3>My ten steps, in the order I actually did them</h3>
""" + step(
    1, "Froze the API contract before writing a single feature",
    "I defined the exact shape of every request and response &mdash; what a Finding looks like, what an error looks like "
    "&mdash; and locked it. It is recorded in the code as a frozen contract version.",
    "Because Awais had to build screens against my API. If I let its shape keep changing, he would rebuild his work "
    "every week. Freezing it early cost me some flexibility and bought the team a frontend that never had to be "
    "rewritten.",
    "Twice I later wanted to change a response shape. I could not, so I had to add fields <b>additively</b> instead. "
    "That was mildly annoying and absolutely the right constraint.",
    "Awais could start designing against a stable contract, and Wasif could write tests against a specification rather "
    "than against my current mood."
) + step(
    2, "Built the error envelope and request IDs",
    "Every error the API returns has one shape: a code, a message, details, and a request ID that also appears in every "
    "log line for that request.",
    "This is unglamorous plumbing and it had to come <b>before</b> the features, not after. Retrofitting consistent "
    "error handling into forty endpoints is far harder than starting with it.",
    "Nothing dramatic &mdash; but it is the reason we can debug a user's problem later. Without the request ID, "
    "investigating a report of &lsquo;it broke&rsquo; is guesswork.",
    "Every later feature got error handling for free, and Wasif could assert on error <b>codes</b> instead of matching "
    "error text."
) + step(
    3, "Designed the database schema and wrote the migrations",
    "Fifteen tables: the User &rarr; ContractDraft &rarr; ClauseFinding spine, plus the review workflow, the audit chain, "
    "and the caches.",
    "The data model constrains everything above it. Getting it wrong means rewriting the services later, so it came "
    "before the services, not alongside them.",
    "I initially had no separate ClauseFinding table &mdash; I was going to store the findings as a blob of JSON inside "
    "the contract row. That would have made it impossible to query &lsquo;show me every critical finding across all "
    "contracts&rsquo;, which the review queue needs. I split it out.",
    "The review queue, the audit chain, and the admin statistics all became possible &mdash; each of them needs to "
    "query findings independently of their contract."
) + step(
    4, "Built the upload and validation path",
    "File-size caps, extension allowlist, <b>magic-byte inspection</b> (reading the file's real first bytes rather than "
    "trusting its name), filename-traversal guards, and a SHA-256 content hash.",
    "It is the front door. Everything downstream assumes it is handling a real, safe document, and that assumption has "
    "to be <b>made true</b> at the boundary.",
    "My first version trusted the file extension. Wasif immediately broke it by renaming a file to <code>.pdf</code>. "
    "That is exactly what he is for, and it is why the magic-byte check exists.",
    "Taha's analysis code could assume it was always given a genuine, readable document, so he never had to defend "
    "against garbage input."
) + step(
    5, "Wired up persistence, and the analysis endpoint",
    "The endpoint that ties it together: accept the upload, call Taha's analysis services, store the draft and its "
    "findings, and return them.",
    "This is the first point at which the product <b>does something</b>. It needed steps 1 to 4 to exist first.",
    "The response was slow &mdash; the founder stared at a spinner for twenty seconds. We later changed it to return "
    "the clause findings <b>first</b> and enrich with the sweeps asynchronously.",
    "There was now a real, working product to build screens on top of. The backend-readiness gate could open."
) + step(
    6, "Built the review queue with an atomic claim",
    "The queue of findings that the system refuses to auto-approve, and the mechanism by which a reviewer claims one.",
    "It is the enforcement point for our central safety promise: risky findings must reach a human. Without it, the "
    "confidence gate is a suggestion rather than a rule.",
    "My first attempt was <b>check-then-update</b> &mdash; look to see if it is unclaimed, then claim it. That is a "
    "<b>race condition</b>: two reviewers can both pass the check in the same instant. I replaced it with a conditional "
    "update, so the database itself guarantees only one wins.",
    "The human-in-the-loop guarantee became real, and Wasif could write a concurrency test that proves it."
) + step(
    7, "Built the SHA-256 hash-chained audit log",
    "Every consequential action writes a record containing a fingerprint of the record before it, so the records form "
    "a chain.",
    "It had to come before the export and admin features, because those are exactly the actions that must be "
    "accountable.",
    "The subtle part was the first record &mdash; a chain needs a starting point, a <b>genesis</b> record with no "
    "predecessor. Getting that boundary case right took a while.",
    "We can now <b>detect</b> tampering, and Wasif could write the test I am proudest of: corrupt a record in the "
    "middle and assert we catch it."
) + step(
    8, "Deployed it, and fought the serverless event loop",
    "Docker, a managed Postgres database, automatic deployment from the main branch.",
    "A product that only runs on my laptop is not a product. Deploying early meant we found the deployment problems "
    "early, when there was still time.",
    "The hardest bug of the project. On the serverless platform, application startup hooks did not fire the way they do "
    "on a normal server, and our HTTP client ended up attached to an event loop that had already closed. It failed "
    "<b>intermittently</b>, which is the worst kind. The fix was to build the client lazily per request and detect a "
    "fresh event loop instead of assuming one-time startup.",
    "A live URL that the team, and an examiner, can actually visit."
) + step(
    9, "Hardened the security, after an audit of my own work",
    "Ownership checks on every object (IDOR), an SSRF guard on the URL analyser, secret scanning in CI, and rotated "
    "every credential.",
    "Deliberately late. You cannot meaningfully audit a system that does not exist yet &mdash; and auditing it while "
    "it was still changing shape would have meant auditing it twice.",
    "The audit found a real IDOR hole: an ownership check I had put in the interface but not enforced on the server. "
    "That is precisely the mistake I now warn about in my viva answers, and I found it in <b>my own code</b>.",
    "The security claims in our report became things we had <b>tested</b>, rather than things we had assumed."
) + step(
    10, "Fixed the deletion purge and built the Clerk webhook",
    "Made account deletion actually erase everything, from <b>both</b> deletion paths, sharing one purge routine.",
    "The very last thing, because it was triggered by a bug Awais and I found together &mdash; a deleted user coming "
    "back when the same email was reused.",
    "Two problems, not one. Deletion was leaving rows behind in six tables. And deleting from Clerk's own dashboard "
    "purged <b>nothing</b> in our database, because no webhook existed. I also had to make the webhook <b>fail "
    "closed</b>: if the signing secret is missing, it refuses everything &mdash; otherwise the URL is a remote "
    "account-deletion button for anyone who finds it.",
    "&lsquo;Deleted&rsquo; finally means deleted, and the story became one of the strongest things we can tell an "
    "examiner."
) + """
<div class="box say">
  <div class="h">If asked: "which step was hardest?"</div>
  <p>&ldquo;The serverless event-loop bug, without question. It failed <b>intermittently</b>, which means you cannot
  trust any single test run to tell you whether you have fixed it. And the cause was not in my code at all &mdash; it
  was in my <b>assumption</b> about how the platform starts an application. Fixing it meant reasoning about somebody
  else's execution model rather than reading my own lines.&rdquo;</p>
</div>

<div class="box say">
  <div class="h">If asked: "what would you do differently?"</div>
  <p>&ldquo;I would key private data on the account ID from day one, rather than discovering the problem through a bug.
  And I would write the deletion purge <b>at the same time</b> as each feature that stores data &mdash; because every
  table we added was another place we later had to remember to erase. Deletion should have been a checklist item on
  every new table, not a cleanup task at the end.&rdquo;</p>
</div>
"""


# ================================================================== TAHA
TAHA = journey_intro(
    "Taha Khan",
    "I built outward from the smallest unit: first score ONE clause correctly, then make it survive failure, then make "
    "it survive attack, then make it fast. Quality first, then reliability, then security, then speed &mdash; because "
    "optimising something that gives wrong answers is pointless."
) + fig(TIMELINE_SVG, "My work sits in the SERVICES and API phases: the reasoning engine, and the safety around it.") + """
<h3>My eight steps, in the order I actually did them</h3>
""" + step(
    1, "Made the model answer in a fixed format &mdash; before anything else",
    "I forced the model to reply with exactly four fields: severity, a risk score from 1 to 10, a confidence from 0 to "
    "1, and a plain-English reason. Then I validated that answer against a strict schema.",
    "Because a free-text answer is <b>useless to a program</b>. If the model replies with an essay, I cannot sort by "
    "severity, cannot route by confidence, and cannot test anything. Structure had to come first; everything else "
    "depends on it.",
    "The model kept adding chatty preambles &mdash; &lsquo;Certainly! Here is my analysis&hellip;&rsquo; &mdash; which "
    "broke parsing. I had to instruct it far more forcefully and, crucially, treat a malformed reply as a "
    "<b>failure</b> rather than trying to salvage it.",
    "Everything downstream. Ranking, the confidence gate, caching and testing are all only possible because the output "
    "has a guaranteed shape."
) + step(
    2, "Built the clause segmentation with a keyword lexicon",
    "Split the contract into clauses and sort them into ten types &mdash; liability, confidentiality, IP, termination "
    "and so on &mdash; using a dictionary of keywords, with <b>no AI at all</b>.",
    "The model scores <b>one clause at a time</b>, so something has to decide where one clause ends and the next "
    "begins. I chose a deterministic method deliberately: the same contract must always split the same way, or our "
    "results are not reproducible and the audit trail is worthless.",
    "My first version over-matched badly &mdash; on one twenty-page contract it produced <b>47 clauses, most of them "
    "boilerplate junk</b>. I had to add a force-majeure guard and tighten the lexicon. It went down to seven clean, "
    "genuine clauses.",
    "The scoring step now received meaningful units of text instead of fragments, which improved the scores "
    "immediately."
) + step(
    3, "Wrote the scoring rubric &mdash; and rewrote it four times",
    "The scoring guide the model receives: what makes a clause critical rather than merely high, with explicit "
    "escalation triggers (uncapped liability, a personal guarantee, perpetual or unrelated IP assignment, unilateral "
    "rights) and de-escalation guards so harmless boilerplate is not flagged.",
    "Without a rubric the model <b>drifts</b>: the same clause scores differently on different days. That is fatal for "
    "trust &mdash; a founder who re-uploads and sees different answers will never believe either of them.",
    "Version one over-flagged everything as high risk, which is just as useless as flagging nothing &mdash; a founder "
    "cannot triage a document where every clause screams. Four revisions, each measured against contracts we had "
    "labelled by hand, got it to a merit-based scale.",
    "Scores became stable and defensible, and I finally had a number I could quote: roughly 89% agreement with our own "
    "labels, always within one band."
) + step(
    4, "Built the fallback chain",
    "Primary model &rarr; a second, different model &rarr; a deterministic rules engine that needs no AI and no internet.",
    "Once the scoring was <b>good</b>, the next question was what happens when it is <b>unavailable</b>. Quality first, "
    "then reliability &mdash; there is no point making an unreliable thing fault-tolerant if its answers are wrong.",
    "The awkward design question was what counts as a failure. I decided that a <b>schema-invalid reply is a failure</b>, "
    "exactly like a network error &mdash; because a confidently malformed answer is more dangerous than no answer at "
    "all.",
    "The product can no longer be taken down by a provider outage. Ahmad could deploy knowing that a failure of NVIDIA "
    "is not a failure of Clarifyd."
) + step(
    5, "Built the prompt-injection defence",
    "Fenced the contract as untrusted data, neutralised break-out attempts, and made a suspected injection <b>force</b> "
    "the finding to a human reviewer.",
    "This came only after the chain worked, because it is a <b>different class</b> of problem: not &lsquo;the model "
    "failed&rsquo; but &lsquo;the model was <b>turned against us</b>&rsquo;. I needed the basic path solid before I "
    "could reason about an adversary.",
    "Realising the scale of it. I had been treating the contract as <b>our</b> data. It is not &mdash; it is written "
    "by the <b>counterparty</b>, who has a motive to make it look harmless. That reframing changed how I thought about "
    "the whole pipeline.",
    "We could honestly claim to handle hostile documents &mdash; and, more importantly, we knew the limits of that "
    "claim, which is why the last line of defence is a human."
) + step(
    6, "Made it fast: eight clauses at once, plus caching",
    "Concurrency of eight, and a cache keyed by a fingerprint of the clause's own content.",
    "Speed came <b>after</b> correctness, reliability and security &mdash; deliberately. Optimising something that gives "
    "wrong or unsafe answers is a waste of everybody's time.",
    "A cold analysis was taking far too long. Batching and concurrency brought it under about twenty seconds. The cache "
    "matters more than it sounds: boilerplate clauses repeat constantly across contracts, so the hit rate is high.",
    "The product became usable. Twenty seconds a founder will wait for; two minutes they will not."
) + step(
    7, "Discovered that findings were being silently dropped",
    "Under provider rate-limiting on long contracts, failing calls were being discarded. The founder would have received "
    "a <b>quietly incomplete</b> analysis and never known.",
    "I found this while benchmarking longer contracts &mdash; the finding count varied between runs on the <b>same "
    "document</b>, which should be impossible.",
    "This is the bug I am least proud of and most glad we found. A missing finding is invisible: there is no error, no "
    "warning, just a clause nobody looked at. In this product that could mean a founder signing something ruinous.",
    "I added a <b>token-bucket rate limiter</b> that paces every call. Now throttling makes the analysis <b>slower</b>, "
    "never incomplete. <b>Slower is acceptable. Silently wrong is not.</b>"
) + step(
    8, "Survived the model being withdrawn mid-project",
    "NVIDIA retired the Kimi model from our account. I migrated to Llama-3.1-70B.",
    "Not by choice &mdash; it simply happened, three weeks from the deadline.",
    "A moment of genuine panic, followed by relief. Because we speak a <b>generic protocol</b> behind a provider "
    "interface rather than using a vendor's own library, the migration was a <b>configuration change with zero code "
    "modification</b>. I then re-ran the benchmark against the new model and retuned the rubric where it had drifted.",
    "The single best piece of evidence in our entire viva that our architecture was <b>right</b> &mdash; because it was "
    "tested by an emergency we did not choose."
) + """
<div class="box say">
  <div class="h">If asked: "which step was hardest?"</div>
  <p>&ldquo;The rubric &mdash; and it is hardest for an unusual reason. Everything else has a <b>right answer</b> you
  can converge on. The rubric is a <b>judgement</b>: is a three-year non-compete critical, or merely high? I had to
  build a hand-labelled benchmark just to know whether a change had made things better or worse. Without a way to
  measure, I was just changing words and hoping.&rdquo;</p>
</div>

<div class="box say">
  <div class="h">If asked: "what would you do differently?"</div>
  <p>&ldquo;I would build the hand-labelled benchmark <b>first</b>, before writing a single prompt. For the first two
  weeks I was tuning prompts by reading outputs and thinking &lsquo;that looks better&rsquo; &mdash; which is not
  measurement, it is taste. The day we had a benchmark, progress became real.&rdquo;</p>
</div>
"""


# ================================================================= AWAIS
AWAIS = journey_intro(
    "Awais Khan",
    "I was BLOCKED from starting until the backend passed its readiness gate &mdash; and that was the right call. So I "
    "used the waiting time to design, then built the foundation (the design system and the auth bridge) before any "
    "individual screen, because every screen depends on both."
) + fig(TIMELINE_SVG, "I was deliberately blocked until the GATE. What I did before it, and after it, is the story below.") + """
<h3>My eight steps, in the order I actually did them</h3>
""" + step(
    1, "Waited &mdash; and used the wait to map every screen to an endpoint",
    "While Ahmad built the backend, I designed the screens and checked that <b>every single one</b> could be built from "
    "an endpoint that would actually exist in the frozen API contract.",
    "This was the team's rule: the frontend may not start until the backend passes a readiness checkpoint. It sounds "
    "restrictive, and it saved me from rebuilding my work three times.",
    "The check caught two screens I had designed that <b>no endpoint could support</b>. Better to find that on paper "
    "than after building them.",
    "When the gate opened, I was not designing &mdash; I was building, against an API I already understood."
) + step(
    2, "Built the design system before building any screen",
    "Defined every colour, spacing step, and text size <b>once</b>, as tokens. The Broadsheet style: ivory paper, "
    "coffee-black ink, a single red accent.",
    "Because without it, each screen drifts. This grey differs slightly from that grey, buttons come in three heights, "
    "and the product feels amateur in a way nobody can point at.",
    "The hard part was <b>restraint</b>. My instinct was to add gradients and shadows. But a founder is about to sign "
    "something that could cost them their company &mdash; the interface should feel serious and calm, not playful. I "
    "took things away rather than adding them.",
    "Every screen after this was faster to build and automatically consistent. Even our viva presentation uses the same "
    "tokens."
) + step(
    3, "Built the auth bridge to Clerk",
    "Connected the app to Clerk, so every request carries a fresh signed token, and the app knows who is signed in and "
    "what role they have.",
    "Nothing behind the login can be built until the app knows <b>who the user is</b>. This is the second foundation "
    "stone, along with the design system.",
    "Clerk's tokens expire after about a minute. My first version fetched the token once and cached it &mdash; so after "
    "sixty seconds every request started failing with an authentication error. I had to fetch a <b>fresh token per "
    "request</b>.",
    "Every authenticated screen became possible."
) + step(
    4, "Built the upload and findings screens &mdash; the core journey",
    "The dashboard where a contract is dropped, and the findings page: a health gauge, and a ranked list of clause "
    "cards with severity, explanation and suggested negotiation.",
    "This is <b>the product</b>. Everything else is secondary, so it was built first and given the most care.",
    "The findings page was overwhelming at first &mdash; a wall of text. I had to rank ruthlessly, collapse detail "
    "behind a click, and lead with the health gauge so a founder gets the headline in one second, not one minute.",
    "For the first time, the whole team could see the product working end to end in a browser."
) + step(
    5, "Made the analysis survive navigation",
    "Moved the analysis state <b>above</b> any single page, so a founder can navigate away mid-analysis and the work "
    "carries on, with the progress indicator following them.",
    "Analysis takes about twenty seconds &mdash; long enough that people <b>will</b> click away. A naive implementation "
    "throws the work away and starts again, which is infuriating and wastes an AI call.",
    "The bug that revealed it: navigating away and back started a <b>second</b> analysis of the same contract. Not just "
    "annoying &mdash; it cost money.",
    "The product started to feel professional rather than fragile."
) + step(
    6, "Kept the login library off the public pages",
    "The marketing pages render under a login-free stub, so they never download the ~220&nbsp;KB authentication library.",
    "A founder who has never heard of us will leave in three seconds if the landing page is slow. Every kilobyte on "
    "that path matters; on the dashboard, where they are already committed, it matters far less.",
    "It required a route-aware provider boundary, which is fiddly &mdash; the app must decide, per route, whether "
    "authentication even exists.",
    "A measurably faster public site, with no cost to the logged-in experience."
) + step(
    7, "Built Clarifyd AI, and then locked its Generate button",
    "The chat assistant with streaming replies, and document drafting &mdash; with the Generate button <b>disabled</b> "
    "until the AI confirms it has every essential term.",
    "The chat came first; the lock came after we saw what happened without it.",
    "A founder could press Generate immediately and receive a contract full of <code>[TO BE CONFIRMED]</code> blanks. "
    "The hard realisation: <b>my screen cannot know</b> when enough detail has been gathered &mdash; it depends "
    "entirely on which document is being written. So the <b>model</b> had to signal readiness, and my interface obeys "
    "it. I match that signal <b>loosely</b>, because the small chat model sometimes garbles punctuation, and a strict "
    "check would trap a founder behind a button that never unlocks.",
    "The assistant became genuinely useful rather than a demo that produces impressive-looking rubbish."
) + step(
    8, "Found &mdash; and fixed &mdash; the privacy bug",
    "Discovered that a deleted user's data reappeared when a new account was created on the same email. Re-keyed all "
    "browser storage from the email address to the permanent account ID, and made logout wipe everything.",
    "It surfaced during ordinary testing near the end, when we were deleting and recreating test accounts.",
    "Our first hypothesis was that the <b>server</b> was leaking deleted data. That was <b>wrong</b> &mdash; the data "
    "had never left the browser. Chasing that instinct would have wasted days fixing a defect that did not exist. The "
    "actual cause: I had labelled browser storage with the <b>email address</b>, and emails can be reassigned.",
    "The lesson that became our best viva story: <b>an email address is a label a person currently holds, not an "
    "identity.</b> And it led Ahmad to find the same conceptual mistake in the database."
) + """
<div class="box say">
  <div class="h">If asked: "which step was hardest?"</div>
  <p>&ldquo;The privacy bug &mdash; and the hard part was not the fix, which was small. The hard part was that our
  <b>reasoning</b> was wrong. We were certain the server was leaking. Every instinct said so. Being disciplined enough
  to actually check, rather than start fixing what we assumed, is the thing I would most want to be judged on.&rdquo;</p>
</div>

<div class="box say">
  <div class="h">If asked: "what would you do differently?"</div>
  <p>&ldquo;I would write frontend tests from the start. We have none &mdash; type-checking is our only automatic gate.
  It is our biggest quality gap and I own it. Every bug I found, I found by <b>clicking</b>, which does not scale and
  does not catch regressions.&rdquo;</p>
</div>
"""


# ================================================================= WASIF
WASIF = journey_intro(
    "Wasif Azeem",
    "I tested from the outside in, and in order of DANGER: first the inputs an attacker controls, then the failures "
    "nobody would notice, then the ordinary features. I deliberately wrote the security tests before the happy-path "
    "tests, because a broken happy path is loud and a security hole is silent."
) + fig(TIMELINE_SVG, "Testing ran alongside every phase &mdash; but the ORDER I wrote them in was driven by danger, not by convenience.") + """
<h3>My seven steps, in the order I actually did them</h3>
""" + step(
    1, "Set up the quality gate before writing a single test",
    "Wired continuous integration so that on <b>every</b> change, the test suite runs, the frontend type-check runs, "
    "and a secret scanner looks for committed passwords or API keys. A failure <b>blocks the merge</b>.",
    "Because a test that only runs when somebody <b>remembers</b> to run it does not exist. Under deadline pressure, "
    "nobody remembers. The gate had to be a mechanism, not a habit.",
    "Getting it to run reliably took longer than expected &mdash; a test suite that fails randomly is worse than no "
    "suite at all, because the team learns to ignore it.",
    "From that day on, no broken change could reach the main branch. Everything I wrote afterwards had teeth."
) + step(
    2, "Attacked the upload endpoint first (14 tests)",
    "Disguised files, oversized payloads, filenames with traversal sequences, and empty or corrupt documents.",
    "The upload is the <b>only</b> place an attacker can hand us arbitrary bytes. It is the front door, so it is where "
    "I started &mdash; before any feature testing.",
    "I broke it immediately. Ahmad's first version trusted the <b>file extension</b>, so I renamed a non-PDF to "
    "<code>.pdf</code> and it sailed through. That is exactly what the magic-byte check now prevents.",
    "The front door became genuinely defended, and Ahmad had a concrete demonstration of why filenames cannot be "
    "trusted."
) + step(
    3, "Tested the failure paths &mdash; using a fake AI",
    "Replaced the real AI with a stub I control, then ordered it to fail, to time out, and to return malformed nonsense "
    "&mdash; asserting each time that we retry, then fall back to the second model, then fall back to the rules engine.",
    "These are the <b>most important paths in the system</b> and they are <b>unreachable</b> in a test without a fake. "
    "I cannot make the real AI go down on demand, and I would not want a test suite that costs money and needs the "
    "internet.",
    "The subtle case was a <b>schema-invalid</b> reply &mdash; the AI answering successfully but in the wrong shape. "
    "I asserted that we treat that as a <b>failure</b>, not as an answer. A confidently malformed reply is more "
    "dangerous than an error.",
    "We could honestly claim graceful degradation, because it is <b>tested</b>, not hoped for."
) + step(
    4, "Wrote the tamper test &mdash; the one I am proudest of",
    "A test that deliberately reaches into the database, <b>corrupts a record in the middle of the audit chain</b>, and "
    "then asserts that our verification endpoint reports the break.",
    "Because the audit chain is our central security claim, and a claim without a demonstration is just a sentence in "
    "a report.",
    "It felt strange to write a test whose job is to <b>attack our own system</b>. That is precisely why it is worth "
    "more than ten tests that flatter it.",
    "The security claim in our thesis is <b>demonstrated</b>, not asserted &mdash; and I can run it in front of an "
    "examiner."
) + step(
    5, "Tested authorisation: IDOR and SSRF",
    "User A attempting to read user B's contract by guessing its ID. And the URL analyser being pointed at an internal "
    "address to make our own server attack itself.",
    "These are the two authorisation failures that a functional test would <b>never</b> catch, because from the "
    "attacker's point of view nothing looks broken &mdash; it just quietly works when it should not.",
    "I found a real IDOR hole: the ownership check existed in the <b>interface</b> but was not enforced on the "
    "<b>server</b>. Hiding a button hides a door; it does not lock it.",
    "Both are now enforced server-side, with tests that attempt the attack and assert refusal."
) + step(
    6, "Built the live benchmark &mdash; separately from the test suite",
    "A harness that runs the <b>real</b> model against contracts where <b>we</b> decided the correct severity by hand, "
    "and reports how often it agrees.",
    "Because the AI's <b>quality</b> cannot be tested the way behaviour is tested. It is statistical, slow, costs money "
    "and gives different answers each run &mdash; so it must live <b>outside</b> the merge gate. A gate that is slow "
    "and flaky is a gate people learn to bypass.",
    "Deciding the ground truth was genuinely hard: <b>we</b> had to agree what severity a clause deserved, and we did "
    "not always agree with each other. That disagreement is itself a finding worth admitting.",
    "We got a defensible number &mdash; roughly 89% exact-band agreement, always within one band &mdash; and, more "
    "importantly, Taha got a way to tell whether a rubric change made things <b>better or worse</b>."
) + step(
    7, "Wrote the regression test for the privacy bug",
    "Delete an account, re-register with the same email, and assert the new account inherits <b>nothing</b>. Plus: after "
    "deletion, no row in any user-owned table still references that account.",
    "The moment a real bug is found, a test must be written that <b>reproduces</b> it &mdash; before the fix, not after.",
    "The failing test was the proof we understood the bug at all. Until I could make it fail on demand, we were "
    "guessing at the cause &mdash; and our first guess had already been wrong.",
    "That class of bug can never silently return. <b>A bug without a regression test is a bug that comes back.</b>"
) + """
<div class="box say">
  <div class="h">If asked: "which step was hardest?"</div>
  <p>&ldquo;Deciding what &lsquo;correct&rsquo; even means for the AI benchmark. For every other test there is a right
  answer: the file is rejected, or it is not. For the benchmark, <b>we</b> had to be the ground truth &mdash; and the
  three of us did not always agree on whether a clause was critical or merely high. Admitting that disagreement, rather
  than pretending our labels are objective, is the honest position.&rdquo;</p>
</div>

<div class="box say">
  <div class="h">If asked: "what would you do differently?"</div>
  <p>&ldquo;Two things. I would add browser-level end-to-end tests &mdash; all 124 of my tests could pass while the
  product is completely broken, because a single wrong API URL in the frontend would not fail any of them. And I would
  run <b>mutation testing</b>: deliberately introduce bugs and check whether my tests actually catch them. It is the
  only honest way to test the tests.&rdquo;</p>
</div>
"""

JOURNEYS = {
    "Ahmad Arshad": AHMAD,
    "Taha Khan": TAHA,
    "Awais Khan": AWAIS,
    "Wasif Azeem": WASIF,
}
