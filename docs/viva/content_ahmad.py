"""Ahmad Arshad - Backend / Engine & Safety Core. Content for the viva guide."""

from build_viva_guides import simple, say, push, trap, why, fig, qa, tech, SHARED_BASICS

ACCENT = "#b8260f"
NAME = "Ahmad Arshad"
ROLL = "2K22-BSCS-404"
ROLE = "Backend Developer &mdash; the Engine &amp; Safety Core"
TOPICS = "Server &middot; Database &middot; Security &middot; Audit chain &middot; Deletion &middot; Deployment"
SIG = "I built the engine that runs the AI safely, and everything behind the screen."

BODY = f"""
<h2>Part 1 &mdash; Your 30-second introduction (memorise word for word)</h2>
<p>When the examiner says <b>&ldquo;What was your role?&rdquo;</b>:</p>
{say("I was the Backend Developer. I built the engine room &mdash; everything the user never sees. That is four things. "
     "One: the server and the fifteen-table database that stores every contract and finding. "
     "Two: the safety machinery &mdash; the review queue that forces risky findings in front of a human, and the "
     "tamper-proof history log. "
     "Three: security &mdash; upload validation, access control, and making account deletion actually erase everything. "
     "Four: deployment &mdash; getting it live on the internet and keeping it there. "
     "In one line: I made the AI safe to depend on.")}

{SHARED_BASICS}

<h2 class="pagebreak">Part 3 &mdash; Topic 1: The backend, and why it is layered</h2>

{simple("<p>The <b>backend</b> is the part of a website you never see. When you press a button, your browser sends a "
        "message over the internet to a program running on an always-on computer somewhere. That program does the real "
        "work &mdash; reads the file, talks to the AI, saves things in the database &mdash; and sends an answer back.</p>"
        "<p>I built ours in three strict <b>layers</b>, and the rule is that a layer may only talk to the one below it:</p>"
        "<ul>"
        "<li><b>Routes</b> &mdash; the front door. They check who you are and whether your request is valid, then hand the "
        "work downwards. They contain no thinking.</li>"
        "<li><b>Services</b> &mdash; the brain. All the actual logic lives here: analysing a contract, guarding against "
        "attacks, writing audit records. These files do not even know that a website exists.</li>"
        "<li><b>Database layer</b> &mdash; storage. Nothing else.</li>"
        "</ul>")}

{fig('''<svg viewBox="0 0 860 250" role="img" aria-label="Three backend layers">
  <rect class="bx" x="30" y="20" width="800" height="56"/>
  <text class="lbl bold" x="430" y="44" text-anchor="middle">ROUTES &mdash; the front door</text>
  <text class="sm" x="430" y="63" text-anchor="middle">check the token, validate the request, then delegate. No business logic lives here.</text>

  <path class="ln" d="M430 76 L430 96"/><path class="ln" d="M425 88 l5 8 5 -8"/>

  <rect class="bxa" x="30" y="96" width="800" height="60"/>
  <text class="lbl bold" x="430" y="121" text-anchor="middle">SERVICES &mdash; the brain (no web framework imported here at all)</text>
  <text class="sm" x="430" y="140" text-anchor="middle">analysis &middot; injection guard &middot; audit chain &middot; user purge &middot; the provider fallback chain</text>

  <path class="ln" d="M430 156 L430 176"/><path class="ln" d="M425 168 l5 8 5 -8"/>

  <rect class="bx" x="30" y="176" width="800" height="56"/>
  <text class="lbl bold" x="430" y="200" text-anchor="middle">DATABASE &mdash; 15 tables</text>
  <text class="sm" x="430" y="219" text-anchor="middle">users, contracts, findings, review queue, audit chain, caches</text>
</svg>''', "The three layers. Because Services import no web code, the whole AI stack can be swapped out without touching a single route.")}

{say("The backend is layered strictly. Routes validate and delegate but contain no logic. Services hold all the "
     "business logic and deliberately import no web framework at all. The database layer only stores. That separation "
     "is not decoration &mdash; it is what let us replace the entire AI provider without touching a single route.")}

{push("Why does that separation actually matter? Give me a concrete benefit.",
      "&ldquo;Mid-project our AI provider withdrew the model we were using. Because the services depend on an "
      "<i>interface</i> rather than on a specific model, swapping to a different model was a "
      "<b>configuration change with zero code modification</b>. If our logic had been mixed into the routes, that "
      "would have been a rewrite. The layering paid for itself in a real emergency.&rdquo;")}

<h2 class="pagebreak">Part 4 &mdash; Topic 2: The database (15 tables)</h2>

{simple("<p>A <b>database</b> is where information is kept permanently, so it survives when the program restarts. Think of "
        "it as a set of spreadsheets. Each sheet is called a <b>table</b>. We have fifteen.</p>"
        "<p>The three that matter most form what I call the <b>spine</b>: a <b>User</b> owns <b>Contracts</b>; each "
        "contract has <b>Findings</b> (the individual risks we discovered inside it). Everything else hangs off that "
        "backbone.</p>")}

{fig('''<svg viewBox="0 0 860 210" role="img" aria-label="The database spine">
  <rect class="bxa" x="40" y="24" width="180" height="58"/>
  <text class="lbl bold" x="130" y="47" text-anchor="middle">User</text>
  <text class="sm" x="130" y="66" text-anchor="middle">the founder's account</text>

  <rect class="bxa" x="330" y="24" width="190" height="58"/>
  <text class="lbl bold" x="425" y="47" text-anchor="middle">ContractDraft</text>
  <text class="sm" x="425" y="66" text-anchor="middle">one uploaded contract</text>

  <rect class="bxa" x="630" y="24" width="190" height="58"/>
  <text class="lbl bold" x="725" y="47" text-anchor="middle">ClauseFinding</text>
  <text class="sm" x="725" y="66" text-anchor="middle">one risk in one clause</text>

  <path class="ln" d="M220 53 L326 53"/><text class="sm" x="273" y="45" text-anchor="middle">1 owns many</text>
  <path class="ln" d="M520 53 L626 53"/><text class="sm" x="573" y="45" text-anchor="middle">1 has many</text>

  <rect class="bx" x="40" y="120" width="150" height="52"/><text class="sm bold" x="115" y="142" text-anchor="middle">AuditEvent</text>
  <text class="sm" x="115" y="160" text-anchor="middle">the hash chain</text>
  <rect class="bx" x="215" y="120" width="150" height="52"/><text class="sm bold" x="290" y="142" text-anchor="middle">ReviewQueue</text>
  <text class="sm" x="290" y="160" text-anchor="middle">+ ReviewAction</text>
  <rect class="bx" x="390" y="120" width="150" height="52"/><text class="sm bold" x="465" y="142" text-anchor="middle">Caches</text>
  <text class="sm" x="465" y="160" text-anchor="middle">clause + report</text>
  <rect class="bx" x="565" y="120" width="255" height="52"/><text class="sm bold" x="692" y="142" text-anchor="middle">ExportJob, Letterhead, Comment,</text>
  <text class="sm" x="692" y="160" text-anchor="middle">Feedback, OAuth, OTP codes, Webhook</text>
</svg>''', "The spine, and the ten tables that hang off it.")}

<h3>The one question you will definitely be asked here</h3>
{qa("Two reviewers open the queue at the same instant and both click the same item. What stops them both getting it?",
    "&ldquo;We do <b>not</b> check-then-update, because both reviewers could pass the check in the same moment and both "
    "proceed. Instead we issue a single update that says: <i>set the assignee to me, but only on the condition that this "
    "row is still unclaimed</i>. The database guarantees that only one of those two updates can win. The loser gets a "
    "conflict response and the interface refreshes. The safety comes from the database, not from our code being "
    "lucky with timing.&rdquo;")}

{why("<p>This is a <b>race condition</b>, and it is a classic examiner question because most students get it wrong. "
     "Knowing that the check-then-act pattern is broken &mdash; and that the fix is a conditional update &mdash; is the "
     "difference between a student who copied a tutorial and one who understands concurrency.</p>")}

<h3>Why caches exist (and why they are a correctness feature, not just speed)</h3>
{say("The cache tables are keyed by a fingerprint of the contract's own content. So if the same contract is uploaded "
     "twice, the second analysis is instant and free. But the deeper reason is reproducibility: identical input gives "
     "byte-identical output. That matters when you have an audit trail to defend &mdash; a finding must not change "
     "underneath you.")}

<h2 class="pagebreak">Part 5 &mdash; Topic 3: Security (four attacks, and how we closed them)</h2>

<h3>Attack 1 &mdash; a disguised file upload</h3>
{simple("<p>Anyone can take a harmful file and simply <b>rename</b> it to <code>contract.pdf</code>. The name proves "
        "nothing, because the <b>attacker chooses the name</b>. Trusting a filename is like believing a stranger's "
        "claim about their own identity with no ID.</p>"
        "<p>So we ignore the name entirely and open the file to read its <b>first few bytes</b>. Every genuine PDF "
        "begins with the characters <code>%PDF-</code>. Every Word file begins with <code>PK</code> (because a .docx is "
        "secretly a zip archive). These opening bytes are called <b>magic bytes</b>. If they are wrong, we reject the "
        "file, whatever it claims to be called.</p>")}
{say("We check the file's actual bytes, not its extension &mdash; because the attacker controls the filename. A real "
     "PDF starts with the characters %PDF. If those bytes are missing, we reject it. We have fourteen tests on upload "
     "security alone.")}

<h3>Attack 2 &mdash; SSRF (making our own server attack itself)</h3>
{simple("<p>We let a user analyse a contract that lives at a web address. But a web address can point <b>inwards</b> &mdash; "
        "at our own private servers, or at the cloud provider's internal control panel, which normally nobody outside "
        "can reach.</p>"
        "<p>An attacker who can make <em>our</em> server fetch <em>their</em> chosen address is using our server as a "
        "weapon against ourselves. That attack is called <b>Server-Side Request Forgery</b>. We block it: no "
        "redirections, and only normal public web ports are allowed.</p>")}

<h3>Attack 3 &mdash; IDOR (reading someone else's contract by guessing)</h3>
{simple("<p>Suppose your contract is number 41 in our system. What stops you from typing 42 into the address bar and "
        "reading somebody else's contract? On badly built websites, <b>nothing does</b> &mdash; they merely hide the "
        "button in the interface, which stops nobody.</p>"
        "<p>This is called <b>Insecure Direct Object Reference</b>. We check ownership <b>on the server</b>, on every "
        "single request. Hiding a button is not security.</p>")}
{say("If my contract is number 41, I must not be able to type 42 and read yours. We check ownership on the server for "
     "every draft and every export. Hiding the button in the interface is not security &mdash; it only hides the door, "
     "it does not lock it.")}

<h3>Attack 4 &mdash; leaked secrets</h3>
{simple("<p>Passwords and API keys get accidentally saved into the code, where anybody who can see the code can read "
        "them. This happens constantly in real projects. We run an <b>automatic scanner on every change</b> that "
        "catches keys before they are committed, and after one audit we rotated every credential as a precaution.</p>")}

<h2 class="pagebreak">Part 6 &mdash; Topic 4: The tamper-evident audit chain (your strongest topic)</h2>

{simple("<p>Every important action &mdash; a contract analysed, a report exported, a user deleted &mdash; is written into "
        "a history log.</p>"
        "<p>The clever part is <b>how</b> we write it. First, understand a <b>hash</b>: it is a short fingerprint "
        "calculated from some data. Change even one letter of the data, and the fingerprint comes out completely "
        "different. You cannot work backwards from the fingerprint to the data. We use one called <b>SHA-256</b>.</p>"
        "<p>Now the trick: each record's fingerprint is calculated from <b>its own data plus the fingerprint of the "
        "record before it</b>. The records are chained together, like links.</p>"
        "<p>So if someone quietly edits an old record, that record's fingerprint changes &mdash; but the <em>next</em> "
        "record still stores the <b>old</b> fingerprint. They no longer match. The chain is visibly broken, and we can "
        "point to exactly where.</p>")}

{fig('''<svg viewBox="0 0 860 200" role="img" aria-label="The hash chain">
  <rect class="bx" x="20" y="30" width="240" height="76"/>
  <text class="sm bold" x="140" y="52" text-anchor="middle">Record 1 &mdash; contract analysed</text>
  <text class="sm" x="140" y="72" text-anchor="middle">who did it, what, when</text>
  <text class="sm" x="140" y="92" text-anchor="middle">h1 = SHA256( data1 )</text>

  <rect class="bx" x="310" y="30" width="240" height="76"/>
  <text class="sm bold" x="430" y="52" text-anchor="middle">Record 2 &mdash; report exported</text>
  <text class="sm" x="430" y="72" text-anchor="middle">who did it, what, when</text>
  <text class="sm" x="430" y="92" text-anchor="middle">h2 = SHA256( data2 + h1 )</text>

  <rect class="bx" x="600" y="30" width="240" height="76"/>
  <text class="sm bold" x="720" y="52" text-anchor="middle">Record 3 &mdash; user deleted</text>
  <text class="sm" x="720" y="72" text-anchor="middle">who did it, what, when</text>
  <text class="sm" x="720" y="92" text-anchor="middle">h3 = SHA256( data3 + h2 )</text>

  <path class="ln" d="M260 68 L306 68"/><path class="ln" d="M298 63 l8 5 -8 5"/>
  <path class="ln" d="M550 68 L596 68"/><path class="ln" d="M588 63 l8 5 -8 5"/>
  <text class="sm ac" x="283" y="60" text-anchor="middle">h1 feeds in</text>
  <text class="sm ac" x="573" y="60" text-anchor="middle">h2 feeds in</text>

  <text class="sm" x="430" y="140" text-anchor="middle">Edit Record 2 and h2 changes &mdash; but Record 3 still contains the OLD h2. The links disagree.</text>
  <text class="sm bold" x="430" y="164" text-anchor="middle">The chain does not PREVENT tampering. It makes tampering DETECTABLE.</text>
</svg>''', "The SHA-256 hash chain. A check walks the chain and reports exactly where it broke.")}

{trap("<p>The examiner will almost certainly ask: <b>&ldquo;Couldn't an administrator just edit the database "
      "directly?&rdquo;</b></p>"
      "<p><b>Do NOT say the database cannot be changed.</b> That is false, and a sharp examiner will destroy you for it.</p>")}

{say("Yes, they can. And that is precisely the point &mdash; they cannot do it <b>quietly</b>. The chain does not prevent "
     "tampering; it makes tampering <b>detectable</b>, and it tells us exactly which record was touched. We prove this "
     "with a test that deliberately corrupts a record in the middle of the chain and asserts that our verification "
     "endpoint reports the break.")}

{why("<p>That distinction &mdash; <i>prevents</i> versus <i>detects</i> &mdash; is the whole point of the technique. A "
     "student who says &lsquo;it makes the data unchangeable&rsquo; does not understand what a hash chain is. A student "
     "who says &lsquo;it makes changes detectable&rsquo; clearly does. This single sentence can move your grade.</p>")}

<h2 class="pagebreak">Part 7 &mdash; Topic 5: Account deletion (does deleted mean deleted?)</h2>

{simple("<p>If somebody asks us to delete their account, everything of theirs should genuinely disappear. That is both an "
        "ethical duty and a legal one (the &lsquo;right to erasure&rsquo;).</p>"
        "<p><b>We found that it did not.</b> Deleting an account removed the user and their contracts &mdash; but quietly "
        "left behind their uploaded letterhead image, their comments, their feedback, their contact messages, and their "
        "unused sign-up codes.</p>"
        "<p>There was a second, worse problem. An account can be deleted in <b>two</b> places: on our own admin screen, "
        "or in the dashboard of Clerk (the login company we use). Deleting it in Clerk's dashboard removed the account "
        "from Clerk &mdash; and left <b>all</b> their data in our database, orphaned and unreachable.</p>")}

{fig('''<svg viewBox="0 0 860 220" role="img" aria-label="Two deletion paths converge on one purge">
  <rect class="bx" x="20" y="30" width="180" height="52"/><text class="sm bold" x="110" y="52" text-anchor="middle">Door 1 &mdash; our admin screen</text>
  <text class="sm" x="110" y="70" text-anchor="middle">an admin clicks Delete</text>

  <rect class="bx" x="20" y="130" width="180" height="60"/><text class="sm bold" x="110" y="152" text-anchor="middle">Door 2 &mdash; Clerk dashboard</text>
  <text class="sm" x="110" y="170" text-anchor="middle">Clerk sends us a SIGNED message</text>

  <rect class="bxa" x="300" y="70" width="220" height="70"/>
  <text class="lbl bold" x="410" y="98" text-anchor="middle">ONE erase routine</text>
  <text class="sm" x="410" y="118" text-anchor="middle">purge_user_data()</text>

  <rect class="bx" x="610" y="24" width="230" height="72"/>
  <text class="sm bold" x="725" y="46" text-anchor="middle">ERASED</text>
  <text class="sm" x="725" y="64" text-anchor="middle">contracts, findings, letterhead, comments,</text>
  <text class="sm" x="725" y="82" text-anchor="middle">feedback, messages, logins, OTP codes</text>

  <rect class="bx" x="610" y="120" width="230" height="66"/>
  <text class="sm bold" x="725" y="142" text-anchor="middle">KEPT ON PURPOSE</text>
  <text class="sm" x="725" y="160" text-anchor="middle">the audit chain &mdash; it stores</text>
  <text class="sm" x="725" y="176" text-anchor="middle">WHO DID WHAT, never contract text</text>

  <path class="ln" d="M200 56 L296 90"/>
  <path class="ln" d="M200 158 L296 122"/>
  <path class="ln" d="M520 90 L606 66"/>
  <path class="dl" d="M520 122 L606 146"/>
</svg>''', "Both doors now call the SAME erase routine, so they cannot drift apart and disagree.")}

{say("Both ways of deleting an account now call the <b>same</b> erase function, so they cannot drift apart. For the "
     "Clerk path we added a webhook &mdash; a message Clerk sends us the instant a user is deleted. Because that message "
     "tells our server to erase somebody's data, we verify it is genuinely from Clerk using a cryptographic signature. "
     "If the signature is missing, wrong, or the message is old, we refuse it. And if the signing key is not configured "
     "at all, the endpoint refuses <b>everything</b> &mdash; otherwise anyone who found that web address could delete "
     "our users.")}

{trap("<p>Expect this challenge: <b>&ldquo;You keep the audit log after deletion. Isn't that a contradiction of the "
      "right to erasure?&rdquo;</b> It is a sharp question. Welcome it.</p>")}

{say("The audit log holds an <b>action and an actor</b> &mdash; &lsquo;user X exported a report at 2pm&rsquo;. It never "
     "holds contract content or personal details. So we erase the person's <b>content and personal data</b>, and we "
     "retain an <b>integrity ledger</b>. Erasure covers personal data; it does not require destroying the tamper-proof "
     "record that an event happened. That is the position real systems take, and we can defend it.")}

<h2 class="pagebreak">Part 8 &mdash; The technologies you must be able to explain</h2>
<p class="note">For each one the examiner may ask: <i>what is it, why did you use it, and what else could you have used?</i> These are the answers.</p>

{tech("FastAPI", "the web framework &middot; Python",
      "A <b>web framework</b> is a toolkit that lets a program listen for requests from the internet and answer them. "
      "FastAPI is the one we used, written in Python.",
      "Created by Sebasti&aacute;n Ram&iacute;rez in 2018. It became popular very quickly because it does two things at "
      "once: it is <b>asynchronous</b> (it can wait for many slow things at the same time), and it <b>validates data "
      "automatically</b> using Python's type hints.",
      "Our work is <b>waiting-heavy</b>: for one contract we send eight questions to the AI and wait for all of them. "
      "An asynchronous framework handles that naturally &mdash; while one request waits, the server serves others. "
      "A traditional framework would need one worker blocked per request.",
      "<b>Django</b> was rejected: it is excellent but heavier, and its strengths (admin panels, its own ORM conventions) "
      "were not what we needed. <b>Flask</b> was rejected: simpler, but has no built-in data validation, and we depend "
      "on validation for a <em>safety guarantee</em> (see Pydantic below).",
      "Every endpoint: <code>/analyze/contract</code>, <code>/reviews</code>, <code>/admin/users</code>, "
      "<code>/webhooks/clerk</code>.")}

{tech("Pydantic", "data validation &mdash; and our safety guarantee",
      "A library that checks that data has the right shape. You describe what a valid response looks like, and it "
      "refuses anything that does not match.",
      "Created by Samuel Colvin in 2017. Version 2 rewrote its core in Rust, making it extremely fast. It is the "
      "validation engine that FastAPI is built on.",
      "This is the part most students miss, so say it clearly: <b>our &ldquo;not legal advice&rdquo; guarantee is "
      "implemented as data validation.</b> Every AI response type declares that the disclaimer field must be present "
      "and must be true. If any programmer ever forgot it, or tried to strip it, the response would <b>fail validation "
      "and never be sent</b>. The safety property is enforced by the same machinery that parses the data.",
      "Hand-written checks were rejected &mdash; a human can forget to call a check. A schema cannot be forgotten, "
      "because nothing gets out without passing through it.",
      "Every request and response shape; the frozen API contract; the enforced disclaimer.")}

{tech("PostgreSQL &amp; SQLite", "the database",
      "<b>SQLite</b> is a database that lives in a single file on your computer &mdash; zero setup. <b>PostgreSQL</b> is "
      "a full database server, used by very large systems.",
      "SQLite was written by D. Richard Hipp in 2000 and is now the most widely deployed database in the world &mdash; "
      "it is inside every phone. PostgreSQL began at the University of California, Berkeley in 1986 and is the "
      "reference-standard open-source database.",
      "We use <b>SQLite in development</b> so a new team member can run the whole system with no database to install, "
      "and <b>PostgreSQL in production</b> where we need a real server, concurrent users, and managed backups. Our code "
      "is written against an abstraction, so the same code runs on both.",
      "<b>MongoDB</b> was rejected. Our data is highly relational &mdash; a user owns contracts, a contract has findings, "
      "a finding may have a review action. That is exactly what relational databases are for. Choosing a document store "
      "for relational data creates work rather than saving it.",
      "All fifteen tables; migrations keep the two engines in step.")}

{tech("Clerk", "authentication &mdash; who the user is",
      "<b>Authentication</b> means proving who somebody is &mdash; the login. Clerk is a specialist company that does "
      "logins for you: sign-up, passwords, Google sign-in, sessions, password reset.",
      "Founded in 2020 (Colin Sidoti and Braden Sidoti). It belongs to a category of services &mdash; alongside Auth0 "
      "and Firebase Authentication &mdash; that exist because <b>almost everybody who builds their own login gets it "
      "wrong</b>, and the consequences are severe.",
      "<b>We deliberately chose never to store a password at all.</b> If we do not hold passwords, we cannot leak them. "
      "That removes an entire category of vulnerability from our project, and it removes it <em>by design</em>, not by "
      "us being careful. Clerk also gives us permanent, never-reused account identifiers &mdash; which turned out to "
      "matter enormously (Part 9).",
      "<b>Rolling our own</b> was rejected: password hashing, session management, token expiry, reset flows and social "
      "login are each easy to get subtly wrong, and a student project getting it wrong means leaking real people's "
      "credentials. <b>Auth0</b> was a fair alternative; Clerk had the better developer experience for Next.js.",
      "Every login; every request carries a short-lived signed token which our backend verifies. Clerk also notifies "
      "us via a signed webhook when a user is deleted in its dashboard.")}

{tech("JWT &amp; JWKS", "how the server knows the token is real",
      "A <b>JWT</b> (JSON Web Token) is a small piece of text the browser sends with every request that says &lsquo;I am "
      "user X, and this was issued at 10:31&rsquo;. It is <b>digitally signed</b>, so it cannot be forged. <b>JWKS</b> is "
      "the public list of keys used to check those signatures.",
      "The JWT standard was published in 2015 (RFC 7519). Signing uses public-key cryptography: Clerk signs with a "
      "<b>private</b> key that only Clerk holds, and anybody can verify with the matching <b>public</b> key.",
      "Our backend never has to phone Clerk to ask &lsquo;is this user real?&rsquo; on every request &mdash; that would "
      "be slow and would fail if Clerk were briefly down. Instead we verify the signature ourselves using the public "
      "key. Tokens expire after about a minute, so a stolen token is almost worthless.",
      "Storing a session in our own database was rejected: it means a database read on every single request, and it "
      "means <em>we</em> hold the session state.",
      "Every authenticated request. The verification code lives in our auth layer.")}

{tech("SHA-256", "the fingerprint behind the audit chain",
      "A <b>hash function</b> turns any amount of data into a short fixed-length fingerprint. Change one character of "
      "the input and the fingerprint changes completely. You cannot reverse it to recover the input.",
      "SHA-256 was designed by the United States National Security Agency and published by NIST in 2001 as part of the "
      "SHA-2 family (standard FIPS 180-4). It is the same function that secures Bitcoin. It is considered secure today; "
      "its predecessor SHA-1 is broken and must not be used.",
      "It gives us <b>tamper-evidence</b> for the audit log (Part 6), and it gives us <b>content-addressed caching</b> "
      "&mdash; the same contract always produces the same fingerprint, so we can recognise a re-upload instantly.",
      "MD5 and SHA-1 were rejected because both are cryptographically broken &mdash; an attacker can construct two "
      "different inputs with the same fingerprint, which would let them forge an audit record.",
      "The audit chain; contract deduplication; the cache keys.")}

{tech("Docker &amp; DigitalOcean", "how it gets on the internet",
      "<b>Docker</b> packages an application together with everything it needs to run, so it behaves identically on "
      "your laptop and on the server. <b>DigitalOcean App Platform</b> runs that package on the internet for us.",
      "Docker appeared in 2013 and largely ended the &lsquo;but it works on my machine&rsquo; problem by making the "
      "environment part of the deliverable.",
      "Every push to our main branch automatically rebuilds and redeploys. That means <b>the deployed system is always "
      "the reviewed system</b> &mdash; there is no manual step where somebody forgets to upload the newest version.",
      "Manual deployment (copying files to a server) was rejected as error-prone and unrepeatable.",
      "The live backend and frontend; the deployment configuration is committed to the repository.")}

<h2 class="pagebreak">Part 9 &mdash; Your bug story (volunteer this &mdash; it wins marks)</h2>

{simple("<p>We deleted a test user. Then we signed up again with the <b>same email address</b>. The &lsquo;new&rsquo; "
        "account was not new at all &mdash; it still had the old user's contracts, results, and even their old chat "
        "conversation. A deleted person had come back from the dead.</p>"
        "<p><b>Our first instinct was that the server was leaking deleted data.</b> That instinct was <b>wrong</b>, and "
        "if we had chased it we would have fixed the wrong thing entirely.</p>"
        "<p>The truth: browsers can store data on your own computer. We were storing each person's results in the "
        "browser, labelled with their <b>email address</b>. But an email address can be <b>reused</b>. Delete the "
        "account, sign up again with the same email, and the label matches the data still sitting in that browser. So "
        "the app handed the old data to the new account. Nothing had ever left the browser.</p>"
        "<p>Then I found the <b>same mistake in the database</b>: our sign-up code table is keyed by email address too, "
        "so a recreated account could inherit the deleted user's pending codes. Same root cause, different layer.</p>")}

{say("An email address is not an identity. It is a label a person <b>currently holds</b>, and it can be reassigned to "
     "somebody else. An account ID is permanent and is never reused. We were keying private data on the reassignable "
     "thing. Now we key it on the permanent thing. And we found the same error in a second layer, which tells you it "
     "was a conceptual mistake, not a typo.")}

{trap("<p>State the <b>blast radius honestly</b>. Do not exaggerate it, and do not minimise it.</p>"
      "<p>It affected the <b>same physical browser only</b>. A stranger signing up with that email on their own laptop "
      "saw nothing, because the leftover data was on that one machine. It was a shared-device leak, not a server "
      "disclosure. Examiners respect precision far more than drama.</p>")}

<h2 class="pagebreak">Part 10 &mdash; Question bank (cover the answers and test yourself)</h2>

{qa("Walk me through what happens when a founder uploads a contract.",
    "&ldquo;Eight steps. We validate the file by reading its real opening bytes. We extract the text. We check it is "
    "actually a contract. We split it into clauses. We score each clause with the AI, eight at a time. We run three "
    "sweeps over the whole document, including a hunt for <b>missing</b> protections. We rank the findings. Then we "
    "save them, push anything risky to a human reviewer, and write a tamper-proof audit record.&rdquo;")}

{qa("Why is your backend layered? Isn't that over-engineering for a student project?",
    "&ldquo;It earned its keep in a real emergency. Our AI provider withdrew the model we were using, mid-project. "
    "Because the services depend on an interface rather than on a specific model, we swapped models with a "
    "<b>configuration change and zero code modification</b>. Without the layering that would have been a rewrite.&rdquo;")}

{qa("What is the error envelope?",
    "&ldquo;Every error the API returns has the same shape: a code, a human message, details, and a request ID. The "
    "request ID lets us find that exact request in the logs. It means the frontend never has to guess what an error "
    "looks like, and we never leak internal details like stack traces to a user.&rdquo;")}

{qa("How do you stop one user reading another user's contract?",
    "&ldquo;Ownership is checked <b>on the server</b> for every draft and every export &mdash; not hidden in the "
    "interface. If my contract is 41 and I ask for 42, I am refused. We have tests that attempt exactly that.&rdquo;")}

{qa("Your audit log is tamper-proof. Prove it.",
    "&ldquo;I would run our tamper test. It deliberately goes into the database, corrupts a record in the middle of the "
    "chain, and then calls our verify endpoint &mdash; which reports the break and its location. We demonstrate the "
    "claim rather than assert it. And to be precise: the chain does not prevent tampering, it makes tampering "
    "<b>detectable</b>.&rdquo;")}

{qa("Why did you keep the audit records when a user asks to be deleted?",
    "&ldquo;Because deleting links from a hash chain destroys the very property that makes it valuable &mdash; the "
    "ability to prove nothing was altered. The chain stores an actor and an action, never contract content or personal "
    "details. So we erase personal data and content, and retain an integrity ledger.&rdquo;")}

{qa("What happens if your database goes down?",
    "&ldquo;Then the product is down, and I will not pretend otherwise &mdash; the database is a genuine single point of "
    "failure. In production it is a managed service with backups and automatic failover, which is why we chose a "
    "managed provider rather than running our own. A multi-region setup was explicitly out of scope, and it is listed "
    "in our future work.&rdquo;")}

{qa("Why Clerk? Why not build login yourself?",
    "&ldquo;Because if we do not store passwords, we cannot leak them. Building authentication means getting password "
    "hashing, session expiry, reset flows and social login all correct, and each one is easy to get subtly wrong. We "
    "removed the whole category of risk by design rather than by being careful.&rdquo;")}

{qa("What was the hardest bug you personally solved?",
    "&ldquo;On the serverless platform, application startup hooks did not fire the way they do on a normal server, and "
    "our HTTP client ended up bound to an event loop that had already closed. It produced intermittent failures that "
    "were very hard to reproduce. The fix was to build the client lazily per request and detect a new event loop, "
    "rather than assuming one-time startup. Diagnosing it meant reasoning about the platform's execution model, not "
    "just reading our own code.&rdquo;")}

{qa("If you had three more months, what would you do first?",
    "&ldquo;Two things. First, retrospectively clean the rows orphaned by deletions performed before we fixed the purge "
    "&mdash; our fix governs deletions from now on and does not clean historical residue, and I would rather say that "
    "than pretend otherwise. Second, calibrate the confidence threshold statistically, so 0.7 can be defended with "
    "evidence rather than judgement.&rdquo;")}

<h2 class="pagebreak">Part 11 &mdash; Self-test the night before</h2>
<ul class="checklist">
  <li>Say the 30-second introduction with your eyes closed.</li>
  <li>Name the eight pipeline steps in order.</li>
  <li>Explain a hash chain to somebody who has never heard of one &mdash; and say the words <b>&ldquo;detects, does not prevent&rdquo;</b>.</li>
  <li>Explain why check-then-update is the wrong way to claim a review item.</li>
  <li>Explain what magic bytes are, and why filenames cannot be trusted.</li>
  <li>Explain what IDOR is, using the number 41 and 42.</li>
  <li>Explain why we chose Clerk, in one sentence, without notes.</li>
  <li>Tell the email-versus-account-ID bug story, including the part where your first hypothesis was <b>wrong</b>.</li>
  <li>Name the two things kept when an account is deleted, and why.</li>
  <li>Say aloud one limitation of the project without apologising for it.</li>
</ul>
"""
