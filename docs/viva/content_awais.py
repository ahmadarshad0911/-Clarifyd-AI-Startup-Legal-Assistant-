"""Awais Khan - Frontend Developer. Content for the viva guide."""

from build_viva_guides import simple, say, push, trap, why, fig, qa, tech, SHARED_BASICS

ACCENT = "#1d4e89"
NAME = "Awais Khan"
ROLL = "2K22-BSCS-446"
ROLE = "Frontend Developer &mdash; the User Experience &amp; Screens"
TOPICS = "Screens &middot; Design system &middot; Auth bridge &middot; Per-user storage &middot; The privacy bug"
SIG = "Everything the founder sees, and everything their browser must never leak."

BODY = f"""
<h2>Part 1 &mdash; Your 30-second introduction (memorise word for word)</h2>
{say("I was the Frontend Developer. I built everything the user actually sees and touches. That is three things. "
     "One: the screens and the whole journey &mdash; upload, findings, the AI assistant, export. "
     "Two: the design system, so that every colour, spacing and text size is defined once and reused, which is why the "
     "product looks deliberate rather than assembled. "
     "Three &mdash; and this is the part I would most like to talk about &mdash; keeping each user's data separate "
     "inside the browser. We found a real privacy bug there, and fixing it properly taught us something worth saying "
     "out loud: an email address is not an identity.")}

{SHARED_BASICS}

<h2 class="pagebreak">Part 3 &mdash; Topic 1: What the frontend actually is</h2>

{simple("<p>The <b>frontend</b> is the part of a website that runs <b>inside the user's own browser</b> &mdash; the "
        "screens, the buttons, the text. The <b>backend</b> is a program running on a server far away that does the "
        "heavy work.</p>"
        "<p>They talk to each other over the internet. When a founder drops a contract onto our page, my code packages "
        "that file up and sends it to Ahmad's backend, then waits, then displays whatever comes back.</p>"
        "<p>An important consequence: <b>anything in the frontend is visible to the user.</b> They can open the "
        "developer tools and read every line of my code. So the frontend can never be trusted to enforce security. "
        "Hiding a button does not protect anything &mdash; the real check must happen on the server.</p>")}

{say("The frontend runs inside the user's browser, so the user can read every line of it. That means the frontend can "
     "never <b>enforce</b> security &mdash; it can only present it. Hiding a button stops nobody. Every real check "
     "&mdash; is this your contract, are you allowed to export this &mdash; happens on the server. I present the "
     "rules; Ahmad's backend enforces them.")}

{why("<p>Examiners love this question because many students genuinely believe that hiding a button is a security "
     "measure. Saying clearly that <b>the frontend cannot be trusted</b> proves you understand the client-server "
     "boundary.</p>")}

<h2 class="pagebreak">Part 4 &mdash; Topic 2: The design system</h2>

{simple("<p>A <b>design system</b> means defining every colour, spacing size and text size <b>once</b>, in one place, "
        "and then reusing those definitions everywhere &mdash; instead of picking a colour fresh on every screen.</p>"
        "<p>Without one, a website drifts: this page's grey is slightly different from that page's grey, buttons are "
        "three different heights, and the product feels amateur without anyone being able to say quite why.</p>"
        "<p>Ours is called <b>Broadsheet</b> &mdash; a brutalist editorial style, like a serious newspaper. Warm ivory "
        "paper, coffee-black ink, and a single red accent used sparingly. Sharp edges, no gradients, no glassy effects. "
        "The look is deliberate: a founder is about to sign something serious, and the interface should feel "
        "trustworthy and calm, not playful.</p>")}

{fig('''<svg viewBox="0 0 860 190" role="img" aria-label="Design tokens defined once and reused">
  <rect class="bxa" x="30" y="24" width="230" height="120"/>
  <text class="sm bold" x="145" y="48" text-anchor="middle">DEFINED ONCE (tokens)</text>
  <text class="sm" x="145" y="72" text-anchor="middle">paper #f4ede1</text>
  <text class="sm" x="145" y="90" text-anchor="middle">ink #0c0a08</text>
  <text class="sm" x="145" y="108" text-anchor="middle">accent red #b8260f</text>
  <text class="sm" x="145" y="126" text-anchor="middle">spacing scale, type scale</text>

  <rect class="bx" x="360" y="24" width="150" height="52"/><text class="sm bold" x="435" y="54" text-anchor="middle">Dashboard</text>
  <rect class="bx" x="360" y="92" width="150" height="52"/><text class="sm bold" x="435" y="122" text-anchor="middle">Findings</text>
  <rect class="bx" x="540" y="24" width="150" height="52"/><text class="sm bold" x="615" y="54" text-anchor="middle">Clarifyd AI</text>
  <rect class="bx" x="540" y="92" width="150" height="52"/><text class="sm bold" x="615" y="122" text-anchor="middle">Exports</text>
  <rect class="bx" x="715" y="58" width="120" height="52"/><text class="sm bold" x="775" y="88" text-anchor="middle">&hellip; 20 more</text>

  <path class="ln" d="M260 60 L356 50"/>
  <path class="ln" d="M260 84 L356 112"/>
  <path class="ln" d="M260 70 L536 50"/>
  <path class="ln" d="M260 96 L536 112"/>
  <text class="sm" x="300" y="164">Change the token once &rarr; every screen updates. That is why it stays consistent.</text>
</svg>''', "Tokens are defined once and consumed everywhere. These very viva slides use the same system as the product.")}

{say("Every colour and spacing value is defined once as a token and reused. Change it in one place and the whole "
     "product follows. That is why it looks consistent &mdash; and, in fact, our viva presentation uses the same design "
     "system as the product itself.")}

<h3>Two engineering problems I solved on the screens</h3>

{simple("<p><b>Problem one: the analysis takes 20 seconds, and users navigate away.</b></p>"
        "<p>A naive website would throw the work away the moment the user leaves the page and start again when they "
        "come back. I put the analysis state <b>above</b> the page, in a shared context that outlives any single screen. "
        "So the founder can wander off to another page, and the work carries on, with a progress indicator that follows "
        "them.</p>"
        "<p><b>Problem two: the login library is heavy.</b></p>"
        "<p>Our authentication library is around 220&nbsp;KB of code &mdash; a real download cost. But our public pages "
        "&mdash; the landing page, pricing, FAQ &mdash; do not need anyone to be logged in. So those pages render under "
        "a login-free stub and <b>never download it at all</b>. The public site is measurably faster as a result.</p>")}

<h2 class="pagebreak">Part 5 &mdash; Topic 3: The privacy bug (your headline story)</h2>

{trap("<p><b>Volunteer this. Do not wait to be asked.</b> It is the strongest story any of us has, because it is true, "
      "because we found it ourselves, and because the fix required understanding <em>why</em> we were wrong, not just "
      "what to change.</p>")}

{simple("<p>Browsers can store small pieces of data on your own computer, so that a website remembers things between "
        "visits. This is called <b>local storage</b>. We used it to remember a founder's recent analyses, so the "
        "dashboard loads instantly.</p>"
        "<p>Each stored item needs a <b>label</b> saying whose it is. We labelled them with the user's "
        "<b>email address</b>.</p>"
        "<p><b>The symptom:</b> we deleted a test user, then signed up again with the same email. The &lsquo;new&rsquo; "
        "account was not new. It still had the old user's contracts, results, and even the old chat conversation.</p>")}

{fig('''<svg viewBox="0 0 860 250" role="img" aria-label="Why reusing an email leaked the old account's data">
  <rect class="bx" x="20" y="20" width="380" height="94"/>
  <text class="sm bold" x="210" y="44" text-anchor="middle">BEFORE &mdash; labelled by EMAIL (broken)</text>
  <text class="sm" x="210" y="68" text-anchor="middle">clarifyd.recent-drafts : ali@mail.com</text>
  <text class="sm" x="210" y="88" text-anchor="middle">Delete the account. Sign up again with</text>
  <text class="sm ac" x="210" y="106" text-anchor="middle">the SAME email &rarr; the label MATCHES &rarr; old data returned</text>

  <rect class="bxa" x="450" y="20" width="390" height="94"/>
  <text class="sm bold" x="645" y="44" text-anchor="middle">AFTER &mdash; labelled by ACCOUNT ID (correct)</text>
  <text class="sm" x="645" y="68" text-anchor="middle">clarifyd.recent-drafts : user_2xK9pQ</text>
  <text class="sm" x="645" y="88" text-anchor="middle">A recreated account gets a BRAND-NEW id.</text>
  <text class="sm" x="645" y="106" text-anchor="middle">Nothing matches. The new account starts empty.</text>

  <rect class="bx" x="130" y="150" width="600" height="76"/>
  <text class="sm bold" x="430" y="176" text-anchor="middle">THE PRINCIPLE</text>
  <text class="sm" x="430" y="198" text-anchor="middle">An email address is a label a person CURRENTLY HOLDS &mdash; it can be given to someone else.</text>
  <text class="sm" x="430" y="216" text-anchor="middle">An account ID is PERMANENT and never reused. Never key private data on anything reassignable.</text>
</svg>''', "The whole bug, and the whole fix, in one picture.")}

<h3>The part that impresses examiners most: our first hypothesis was wrong</h3>
{say("Our first instinct was that the <b>server</b> was leaking deleted data. That instinct was <b>wrong</b>. The truth "
     "was the opposite: nothing had ever left the browser. The old data was still sitting on that machine, and the new "
     "account's label happened to match it. If we had chased our instinct, we would have spent days fixing a defect "
     "that did not exist.")}

{say("An email address is not an identity. It is a label a person <b>currently holds</b>, and it can be reassigned. An "
     "account ID is permanent and never reused. We were keying private data on the reassignable thing, so we moved to "
     "the permanent thing. And on logout, or when a different account signs in, we now wipe every Clarifyd item on that "
     "device.")}

{trap("<p><b>State the blast radius exactly. Do not exaggerate, do not minimise.</b></p>"
      "<p>It affected the <b>same physical browser only</b>. A stranger signing up with that email on their own laptop "
      "would have seen nothing, because the leftover data lived on that one machine. It was a shared-device leak, not a "
      "server-side disclosure of contracts across the internet.</p>"
      "<p>Examiners respect precision far more than drama. Overstating a bug is as dishonest as hiding it.</p>")}

{push("Did you check whether the same mistake appeared anywhere else?",
      "&ldquo;Yes, and that is the important part. We found the <b>same conceptual error in the database</b>: the "
      "one-time sign-up code table was also keyed by email address, so a recreated account could inherit the deleted "
      "user's pending codes. Same root cause, different layer. Finding a bug twice tells you it was a <b>thinking</b> "
      "mistake, not a typo &mdash; so we fixed the thinking, not just the line of code.&rdquo;")}

<h2 class="pagebreak">Part 6 &mdash; Topic 4: Clarifyd AI, and the button that refuses to work</h2>

{simple("<p>Clarifyd AI is the chat assistant. It answers a founder's follow-up questions and can draft a document with "
        "them, clause by clause.</p>"
        "<p>Originally, the <b>Generate document</b> button was clickable from the moment the chat opened. So a founder "
        "could ask for a contract before answering a single question &mdash; and receive a document full of blanks "
        "reading &lsquo;[TO BE CONFIRMED]&rsquo;. Impressive-looking, completely useless.</p>"
        "<p>Here is the interesting engineering problem: <b>the screen has no way of knowing when enough detail has "
        "been gathered.</b> It depends entirely on <em>which document</em> you are writing. A confidentiality agreement "
        "needs completely different details from a job offer. My code cannot possibly know that.</p>"
        "<p>So we let the <b>AI decide</b>. It keeps asking questions, and only when it genuinely has every essential "
        "term does it add a <b>hidden marker</b> to its reply. My screen watches for that marker, removes it so the "
        "founder never sees it, and only then unlocks the button.</p>")}

{fig('''<svg viewBox="0 0 860 200" role="img" aria-label="The readiness gate on the Generate button">
  <rect class="bx" x="30" y="24" width="240" height="70"/>
  <text class="sm bold" x="150" y="48" text-anchor="middle">AI still asking questions</text>
  <text class="sm" x="150" y="68" text-anchor="middle">&ldquo;Who are the two parties?&rdquo;</text>
  <text class="sm" x="150" y="84" text-anchor="middle">no hidden marker in the reply</text>

  <rect class="bx" x="310" y="24" width="240" height="70"/>
  <text class="sm bold ac" x="430" y="54" text-anchor="middle">GENERATE = LOCKED</text>
  <text class="sm" x="430" y="76" text-anchor="middle">&ldquo;Answer the questions to unlock&rdquo;</text>

  <rect class="bxa" x="590" y="24" width="240" height="70"/>
  <text class="sm bold" x="710" y="48" text-anchor="middle">AI has everything</text>
  <text class="sm" x="710" y="68" text-anchor="middle">reply contains the hidden marker</text>
  <text class="sm" x="710" y="84" text-anchor="middle">&rarr; GENERATE UNLOCKS</text>

  <path class="ln" d="M270 59 L306 59"/><path class="ln" d="M298 54 l8 5 -8 5"/>
  <path class="ln" d="M550 59 L586 59"/><path class="ln" d="M578 54 l8 5 -8 5"/>

  <text class="sm" x="430" y="140" text-anchor="middle">If the founder later withdraws a detail, the AI stops sending the marker and the button LOCKS AGAIN.</text>
  <text class="sm" x="430" y="164" text-anchor="middle">The marker is stripped before display &mdash; the founder never sees it.</text>
</svg>''', "The screen cannot know what a document needs. So the model signals readiness, and the interface obeys it.")}

{push("How exactly do you detect that hidden marker?",
      "&ldquo;We match it <b>loosely</b> rather than exactly &mdash; and that was a deliberate decision worth "
      "explaining. The chat runs on a small, fast model that occasionally garbles the exact punctuation of the marker. "
      "A strict, exact check would be more &lsquo;correct&rsquo; in a textbook sense &mdash; and it would trap a "
      "founder behind a button that never unlocks, with no way to understand why. We chose the user's outcome over the "
      "elegant implementation.&rdquo;")}

{why("<p>That answer shows <b>engineering judgement</b>, which is rarer and more valuable than technical knowledge. "
     "Knowing that the strictly-correct solution is sometimes the wrong one &mdash; and being able to say why &mdash; "
     "is what separates an engineer from a coder.</p>")}

<h2 class="pagebreak">Part 7 &mdash; The technologies you must be able to explain</h2>

{tech("React", "how the screen is built",
      "A library for building user interfaces out of reusable <b>components</b> &mdash; small self-contained pieces "
      "like a button, a card, or a risk badge, which you assemble like Lego bricks.",
      "Created at Facebook by Jordan Walke and released in 2013. Its central idea: rather than telling the browser "
      "<em>how</em> to change (&lsquo;find that box, change its text, add a red border&rsquo;), you describe <em>what "
      "the screen should look like</em> for the current data, and React works out the minimal set of changes needed. "
      "That is called <b>declarative</b> rendering.",
      "Our screens change constantly &mdash; findings arrive, progress advances, chat messages stream in word by word. "
      "Managing all that by hand is where bugs breed. React makes the interface a function of the data.",
      "Plain JavaScript with manual updates was rejected: it does not scale past a few screens and is exactly where "
      "inconsistency bugs come from.",
      "Every screen: dashboard, findings, Clarifyd AI, exports, admin.")}

{tech("Next.js", "the framework around React",
      "A framework built on top of React that adds the things every real website needs: routing between pages, "
      "rendering pages on the server for speed, and image and font optimisation.",
      "Created by Vercel (formerly Zeit) in 2016. Its key contribution is <b>server-side rendering</b> for React: the "
      "server sends a finished page, so the user sees content immediately instead of a blank screen while JavaScript "
      "downloads.",
      "Our public pages must load fast for a founder who has never heard of us and will leave in three seconds. "
      "Server-rendering them wins that. It also gives us a clean way to proxy our API calls, avoiding a whole class of "
      "cross-origin browser errors.",
      "Plain React (Create React App) was rejected: everything would be rendered in the browser, so the first paint "
      "would be slower on a poor connection.",
      "The entire frontend application.")}

{tech("TypeScript", "catching mistakes before the user does",
      "JavaScript with <b>types</b> added. You declare that a finding has a severity which is one of four specific "
      "words, and a confidence which is a number. If you then misspell a field or pass the wrong kind of value, the "
      "error appears <b>while you are writing the code</b>, not when a founder clicks the button.",
      "Created by Microsoft in 2012 (led by Anders Hejlsberg, who also designed C#). It compiles down to ordinary "
      "JavaScript, so browsers do not need to know anything about it.",
      "This is the point worth making: our backend's API contract was <b>frozen</b> early. TypeScript lets me check "
      "<em>at build time</em> that my screens still match that contract. If Ahmad's response shape and my code ever "
      "disagreed, the <b>build fails</b> &mdash; it never reaches a user. Type-checking is our frontend quality gate.",
      "Plain JavaScript was rejected: mistakes would only surface at runtime, in front of the person using it.",
      "Every frontend file. <code>tsc --noEmit</code> runs on every change and a failure blocks the merge.")}

{tech("Clerk (from the frontend side)", "the login, and the account ID that fixed our bug",
      "A specialist service that handles sign-up, sign-in, Google login, sessions and password reset. We never store a "
      "password ourselves.",
      "Founded in 2020. It exists because almost everyone who builds their own login gets some part of it subtly wrong, "
      "and the consequences are severe.",
      "Two reasons. First: <b>if we do not hold passwords, we cannot leak them</b> &mdash; an entire class of "
      "vulnerability removed by design. Second, and crucially for my part: Clerk gives every account a <b>permanent "
      "identifier that is never reused</b>. That identifier is what we now use to label browser storage &mdash; it is "
      "the fix for the privacy bug in Part 5.",
      "Building our own login was rejected: password hashing, session expiry, reset flows and social login are each "
      "easy to get wrong, and a student project getting it wrong means leaking real people's credentials.",
      "The login page; a fresh signed token attached to every request; the account ID used to namespace local storage.")}

{tech("Browser local storage", "where the bug lived",
      "A small store of data that a website may keep <b>on your own computer</b>, so it can remember things between "
      "visits. It is per-site and per-browser: another website cannot read ours.",
      "Standardised as part of HTML5 around 2009, to replace the practice of stuffing everything into cookies (which "
      "get sent to the server on every single request, making them slow and leaky).",
      "The dashboard should feel instant. Re-fetching everything from the server on every page load is slow, so we "
      "cache the results locally.",
      "Storing raw contract text in the browser was <b>rejected on principle</b> &mdash; we never persist the actual "
      "contract text in local storage, only the results. That is a privacy decision, taken deliberately.",
      "Recent analyses, the founder profile, the chat session &mdash; all now namespaced by the permanent account ID "
      "and wiped on logout.")}

{tech("Framer Motion", "the animation",
      "A library for animating React components &mdash; things fade and slide in rather than snapping into place.",
      "Built by the Framer design tool team. It expresses animation declaratively: you describe the start and end "
      "states, not the frames between.",
      "Motion is used sparingly and for one purpose: to show a founder that something is <b>happening</b> during a "
      "twenty-second analysis. Everything respects the operating system's <b>reduce motion</b> setting, which matters "
      "for users with vestibular disorders &mdash; that is an accessibility requirement, not a nicety.",
      "Animating with hand-written CSS was rejected as harder to coordinate and easy to get wrong for accessibility.",
      "Page entrances, the progress indicator, the streaming chat replies.")}

<h2 class="pagebreak">Part 8 &mdash; Question bank (cover the answers and test yourself)</h2>

{qa("Walk me through the interface, as a founder would experience it.",
    "&ldquo;They sign in, land on the dashboard, and drag a contract onto it. A progress indicator appears &mdash; and "
    "it follows them if they navigate away, because the analysis lives above the page. When it finishes they see a "
    "health gauge and a ranked list of findings, worst first. Each finding explains in plain English what the clause "
    "does and why it matters <b>to a startup</b>. They can open Clarifyd AI to ask follow-ups, and export a "
    "report.&rdquo;")}

{qa("You hide the admin button from normal users. Is that security?",
    "&ldquo;<b>No, and it is important that I say so.</b> Hiding a button hides a door; it does not lock it. Anyone can "
    "read my frontend code in their browser. The <b>real</b> check is on the server: it refuses the request regardless "
    "of what my interface shows. The frontend presents the rules; the backend enforces them.&rdquo;")}

{qa("How do you keep one user's data away from another's in the browser?",
    "&ldquo;Every stored item is labelled with the user's <b>permanent account ID</b> &mdash; never their email, "
    "because emails can be reassigned. And on logout, or when a different account signs in, we wipe every Clarifyd item "
    "on that device. We learned that the hard way, and I would like to tell you about it.&rdquo; <i>(then tell the bug "
    "story)</i>")}

{qa("Do you store the contract text in the browser?",
    "&ldquo;<b>Never.</b> Only the results. The raw contract text is deliberately stripped before anything is cached "
    "locally. It is a privacy decision we took on purpose, not an accident of implementation.&rdquo;")}

{qa("Why is the analysis able to survive navigation?",
    "&ldquo;Because the analysis state lives <b>above</b> any single page, in a shared context. A naive implementation "
    "ties the work to the page, so leaving it cancels the work. Ours keeps running and the progress indicator follows "
    "the user.&rdquo;")}

{qa("Why does the Generate button start disabled?",
    "&ldquo;Because otherwise a founder gets a contract full of blanks. And the interesting part is that <b>my screen "
    "cannot know</b> when enough detail has been gathered &mdash; it depends on which document is being written. So the "
    "AI signals readiness with a hidden marker, and the interface unlocks only then.&rdquo;")}

{qa("What is your frontend's testing story? Be honest.",
    "&ldquo;It is our weakest area and I will not dress it up. We have <b>no frontend unit tests</b>. Our only automatic "
    "gate is TypeScript type-checking, which does catch a real class of bug &mdash; if my screens stop matching the "
    "backend's frozen API contract, the build fails. But it is not a substitute for tests, and adding them is the "
    "fourth item in our future work.&rdquo;")}

{qa("Are all your components actually used?",
    "&ldquo;No &mdash; and I would rather say it than have you find it. Several polished components exist that are not "
    "wired to a live route; the live pages reimplement equivalents inline. That is the gap between our component count "
    "and our shipped features, and it is listed in our limitations.&rdquo;")}

{qa("Why does your design look like a newspaper?",
    "&ldquo;It is a deliberate choice. A founder is about to sign something that could cost them their company. The "
    "interface should feel serious, calm and trustworthy &mdash; like a broadsheet newspaper &mdash; not playful. Every "
    "colour, spacing and type size is a token defined once and reused, which is why it stays consistent across twenty "
    "screens.&rdquo;")}

<h2 class="pagebreak">Part 9 &mdash; Self-test the night before</h2>
<ul class="checklist">
  <li>Say the 30-second introduction with your eyes closed.</li>
  <li>Explain why <b>hiding a button is not security</b>, in one sentence.</li>
  <li>Explain what a design token is and why it prevents drift.</li>
  <li>Tell the privacy-bug story &mdash; including that your <b>first hypothesis was wrong</b>.</li>
  <li>Say the principle sentence: <b>&ldquo;an email is a label a person currently holds; an account ID is permanent.&rdquo;</b></li>
  <li>State the blast radius honestly: <b>same browser only</b>.</li>
  <li>Explain why the Generate button starts locked, and who decides when it unlocks.</li>
  <li>Explain the loose-marker decision &mdash; user outcome over elegant implementation.</li>
  <li>Own the frontend testing gap without apologising.</li>
  <li>Explain what TypeScript catches, using the frozen API contract as the example.</li>
</ul>
"""
