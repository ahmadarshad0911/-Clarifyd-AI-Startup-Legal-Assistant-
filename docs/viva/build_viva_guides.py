"""Generate one personal viva-preparation guide per team member.

Each guide is a self-contained HTML file, printable to PDF, built around three
layers for every concept:

    IN SIMPLE WORDS  - explained from zero, for a layman
    SAY THIS         - the exact sentence to speak to the examiner
    IF PUSHED        - the follow-up question, and the deeper answer

Plus, for every technology used: what it is, who made it, why it exists, why we
chose it, and what we rejected. Run:  python build_viva_guides.py
"""

import io
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ----------------------------------------------------------------- shared CSS
CSS = """
<style>
  :root{
    --paper:#fbf8f2; --card:#ffffff; --ink:#14110d; --body:#332d25; --muted:#6f6759;
    --red:#b8260f; --line:#e0d8c9; --rule:#c9c1b4;
    --ok:#2f6b3f; --warn:#a2661a; --info:#1d4e89;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    --sans:"Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,Arial,sans-serif;
    --mono:"Cascadia Mono",Consolas,"Courier New",monospace;
    --accent:__ACCENT__;
  }
  @media (prefers-color-scheme:dark){
    :root{ --paper:#131110; --card:#1c1917; --ink:#f3eee5; --body:#d6cec2; --muted:#918878;
           --red:#e2502f; --line:#37312b; --rule:#4a443c; --ok:#6bbd82; --warn:#d9a24b; --info:#6ba3e0; }
  }
  :root[data-theme="dark"]{ --paper:#131110; --card:#1c1917; --ink:#f3eee5; --body:#d6cec2; --muted:#918878;
    --red:#e2502f; --line:#37312b; --rule:#4a443c; --ok:#6bbd82; --warn:#d9a24b; --info:#6ba3e0; }
  :root[data-theme="light"]{ --paper:#fbf8f2; --card:#ffffff; --ink:#14110d; --body:#332d25; --muted:#6f6759;
    --red:#b8260f; --line:#e0d8c9; --rule:#c9c1b4; --ok:#2f6b3f; --warn:#a2661a; --info:#1d4e89; }

  @page{ size:A4; margin:16mm 15mm; }
  body{ background:var(--paper); color:var(--body); font-family:var(--serif);
        font-size:11.6pt; line-height:1.62; max-width:190mm; margin:0 auto; padding:20px 18px 90px; }

  .bar{ position:sticky; top:0; z-index:20; display:flex; gap:12px; align-items:center;
        background:var(--card); border-bottom:2px solid var(--accent); padding:10px 14px;
        margin:-20px -18px 26px; font-family:var(--sans); font-size:12px; color:var(--muted); }
  .bar b{ color:var(--ink); } .bar .grow{ flex:1; }
  .bar button{ font-family:var(--sans); font-size:11px; font-weight:700; padding:6px 12px;
        border:1px solid var(--ink); background:none; color:var(--ink); cursor:pointer; }
  .bar button:hover{ background:var(--ink); color:var(--paper); }
  @media print{ .bar{ display:none; } body{ max-width:none; padding:0; } }

  header.hero{ border:3px solid var(--ink); padding:22px 24px; margin-bottom:26px; background:var(--card); }
  header.hero .eyebrow{ font-family:var(--mono); font-size:10.5px; letter-spacing:.2em; text-transform:uppercase;
        font-weight:800; color:var(--accent); }
  header.hero h1{ font-size:30pt; margin:8px 0 2px; color:var(--ink); font-weight:700; letter-spacing:-.02em; line-height:1.05; }
  header.hero .who{ font-family:var(--sans); font-size:13pt; color:var(--body); margin:0; }
  header.hero .role{ display:inline-block; margin-top:12px; font-family:var(--mono); font-size:11px; font-weight:800;
        letter-spacing:.12em; text-transform:uppercase; color:var(--accent); border:2px solid var(--accent); padding:5px 10px; }
  header.hero .sig{ margin-top:14px; padding-top:12px; border-top:1px solid var(--line);
        font-size:13pt; font-style:italic; color:var(--ink); }

  h2{ font-family:var(--serif); font-size:19pt; color:var(--ink); font-weight:700; letter-spacing:-.015em;
      margin:34px 0 10px; padding-bottom:8px; border-bottom:2px solid var(--ink); page-break-after:avoid; }
  h3{ font-family:var(--sans); font-size:13pt; color:var(--ink); font-weight:700; margin:24px 0 8px; page-break-after:avoid; }
  h4{ font-family:var(--sans); font-size:11pt; color:var(--accent); font-weight:700; margin:16px 0 6px; page-break-after:avoid; }
  p{ margin:0 0 11px; }
  ul,ol{ margin:0 0 12px; padding-left:22px; } li{ margin:0 0 6px; }
  strong{ color:var(--ink); } code{ font-family:var(--mono); font-size:.86em; background:var(--paper);
      border:1px solid var(--line); padding:1px 5px; }

  .box{ border-left:5px solid var(--muted); background:var(--card); padding:12px 15px; margin:12px 0;
        page-break-inside:avoid; }
  .box .h{ font-family:var(--sans); font-size:9.5pt; letter-spacing:.14em; text-transform:uppercase;
        font-weight:800; margin-bottom:6px; }
  .box p:last-child{ margin-bottom:0; }

  .simple{ border-left-color:var(--info); }
  .simple .h{ color:var(--info); }
  .say{ border-left-color:var(--accent); background:var(--card); border-top:1px solid var(--line);
        border-right:1px solid var(--line); border-bottom:1px solid var(--line); }
  .say .h{ color:var(--accent); }
  .say p{ font-size:12.4pt; font-weight:600; color:var(--ink); font-style:italic; }
  .push{ border-left-color:var(--warn); } .push .h{ color:var(--warn); }
  .trap{ border-left-color:var(--red); } .trap .h{ color:var(--red); }
  .why{ border-left-color:var(--ok); } .why .h{ color:var(--ok); }

  figure{ margin:16px 0; page-break-inside:avoid; }
  figure svg{ width:100%; height:auto; display:block; }
  .svgbox{ border:1px solid var(--rule); background:var(--card); padding:14px; }
  figcaption{ font-family:var(--sans); font-size:9pt; color:var(--muted); padding-top:7px; }
  svg text{ font-family:var(--sans); fill:var(--ink); }
  svg .lbl{ font-size:11px; } svg .sm{ font-size:9.5px; fill:var(--muted); } svg .bold{ font-weight:700; }
  svg .bx{ fill:var(--card); stroke:var(--ink); stroke-width:1.4; }
  svg .bxa{ fill:none; stroke:var(--accent); stroke-width:2; }
  svg .ln{ stroke:var(--ink); stroke-width:1.3; fill:none; }
  svg .dl{ stroke:var(--muted); stroke-width:1.1; fill:none; stroke-dasharray:4 3; }
  svg .ac{ fill:var(--accent); }

  table{ width:100%; border-collapse:collapse; font-family:var(--sans); font-size:9.8pt; margin:12px 0;
         page-break-inside:avoid; }
  th{ text-align:left; padding:8px 10px; background:var(--card); color:var(--ink); font-size:9pt;
      text-transform:uppercase; letter-spacing:.06em; border-top:2px solid var(--ink); border-bottom:2px solid var(--ink); }
  td{ padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:top; }
  td b{ color:var(--ink); }

  .qa{ border:1px solid var(--line); background:var(--card); padding:14px 16px; margin:12px 0; page-break-inside:avoid; }
  .qa .q{ font-family:var(--sans); font-weight:700; color:var(--ink); font-size:11.4pt; margin-bottom:8px; }
  .qa .q::before{ content:"Q"; display:inline-block; background:var(--accent); color:#fff; font-size:9pt;
       width:19px; height:19px; line-height:19px; text-align:center; margin-right:9px; font-weight:800; }
  .qa .a{ margin:0; }
  .qa .a::before{ content:"A"; display:inline-block; border:1.5px solid var(--ink); color:var(--ink); font-size:9pt;
       width:16px; height:16px; line-height:15px; text-align:center; margin-right:9px; font-weight:800;
       font-family:var(--sans); }

  .tech{ border:2px solid var(--ink); padding:0; margin:18px 0; page-break-inside:avoid; background:var(--card); }
  .tech .head{ background:var(--ink); color:var(--paper); padding:9px 14px; font-family:var(--sans);
       font-weight:700; font-size:11.5pt; display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
  .tech .head span{ font-family:var(--mono); font-size:9pt; opacity:.75; font-weight:600; }
  .tech .body{ padding:13px 15px; }
  .tech dt{ font-family:var(--sans); font-weight:700; color:var(--accent); font-size:9.6pt;
       text-transform:uppercase; letter-spacing:.06em; margin-top:10px; }
  .tech dt:first-child{ margin-top:0; }
  .tech dd{ margin:3px 0 0; }

  .checklist{ list-style:none; padding-left:0; }
  .checklist li{ display:grid; grid-template-columns:22px 1fr; gap:9px; }
  .checklist li::before{ content:"\\25A1"; color:var(--accent); font-weight:800; }

  .rescue{ border:2px dashed var(--red); padding:14px 16px; background:var(--card); }
  .rescue p{ margin-bottom:8px; }

  .pagebreak{ page-break-before:always; }
  .note{ font-size:10.4pt; color:var(--muted); font-style:italic; }
</style>
"""

# ------------------------------------------------------------------ fragments
def hero(name, roll, role, topics, sig, accent_name):
    return f"""
<header class="hero">
  <div class="eyebrow">Clarifyd &middot; FYP Viva Preparation &middot; Personal Guide</div>
  <h1>{name}</h1>
  <p class="who">{role} &nbsp;&middot;&nbsp; {roll}</p>
  <div class="role">{topics}</div>
  <div class="sig">Your signature line: &ldquo;{sig}&rdquo;</div>
</header>

<div class="box simple">
  <div class="h">How to use this guide</div>
  <ol style="margin-bottom:0">
    <li><b>Read it once, slowly.</b> Do not memorise yet &mdash; just understand.</li>
    <li><b>Read it again, out loud.</b> Speak every <em>SAY THIS</em> box aloud. Your mouth must know the words, not only your head.</li>
    <li><b>Third pass:</b> cover the answers in the Question Bank and answer from memory.</li>
    <li><b>Night before:</b> do the self-test at the end with a teammate.</li>
  </ol>
</div>

<div class="box trap">
  <div class="h">The one rule</div>
  <p><b>Never say &ldquo;I don't know.&rdquo;</b> There is a better sentence for every situation, and they are all on the last page of this guide. Read that page twice.</p>
</div>
"""

SHARED_BASICS = """
<h2 class="pagebreak">Part 2 &mdash; Project basics (every member must know these)</h2>

<h3>What is Clarifyd? (in one breath)</h3>
<div class="box simple">
  <div class="h">In simple words</div>
  <p>A <b>contract</b> is a legal agreement &mdash; for example, the paperwork an investor gives a young company when they invest money in it. These documents are long, written in difficult language, and one bad sentence buried on page nine can cost the business owner everything they own.</p>
  <p>Our users are <b>founders</b> &mdash; people starting a small company. They usually cannot afford a lawyer, and lawyers are slow. So founders often sign these documents without truly understanding them.</p>
  <p>Clarifyd is a website. The founder uploads their contract. Our system reads it, finds the dangerous parts, and explains each one in normal everyday English &mdash; like a knowledgeable friend, not a lawyer.</p>
</div>
<div class="box say">
  <div class="h">Say this</div>
  <p>&ldquo;Clarifyd is an AI contract risk analyzer for pre-seed startup founders. A founder uploads a SAFE, an NDA or a term sheet. We extract the clauses, score each one for risk and confidence, sweep the document for loopholes &mdash; including protections that are <b>missing</b> &mdash; and explain every finding in plain English. It is decision-support. It is never legal advice.&rdquo;</p>
</div>

<h3>The user's journey (memorise this chain)</h3>
<figure>
  <div class="svgbox">
    <svg viewBox="0 0 880 90" role="img" aria-label="User journey">
      <rect class="bx" x="4" y="24" width="120" height="42"/><text class="lbl bold" x="64" y="50" text-anchor="middle">1. Upload</text>
      <rect class="bx" x="148" y="24" width="120" height="42"/><text class="lbl bold" x="208" y="50" text-anchor="middle">2. Analyze</text>
      <rect class="bx" x="292" y="24" width="120" height="42"/><text class="lbl bold" x="352" y="50" text-anchor="middle">3. Review</text>
      <rect class="bx" x="436" y="24" width="120" height="42"/><text class="lbl bold" x="496" y="50" text-anchor="middle">4. Export</text>
      <rect class="bxa" x="580" y="24" width="130" height="42"/><text class="lbl bold" x="645" y="50" text-anchor="middle">5. Draft (AI chat)</text>
      <path class="ln" d="M124 45 L144 45"/><path class="ln" d="M136 40 l8 5 -8 5"/>
      <path class="ln" d="M268 45 L288 45"/><path class="ln" d="M280 40 l8 5 -8 5"/>
      <path class="ln" d="M412 45 L432 45"/><path class="ln" d="M424 40 l8 5 -8 5"/>
      <path class="dl" d="M556 45 L578 45"/>
      <text class="sm" x="760" y="49">extension, not core</text>
    </svg>
  </div>
  <figcaption>Upload &rarr; Analyze &rarr; Review &rarr; Export. Drafting extends it; it does not replace it.</figcaption>
</figure>

<h3>The eight-step pipeline (know the order)</h3>
<p><b>1.</b> Validate the file (read its real bytes) &rarr; <b>2.</b> Extract the text &rarr; <b>3.</b> Is it even a contract? &rarr; <b>4.</b> Split into clauses &rarr; <b>5.</b> Score each clause with the AI (8 at a time) &rarr; <b>6.</b> Three whole-document sweeps &rarr; <b>7.</b> Rank the findings &rarr; <b>8.</b> Save, route risky ones to a human, write an audit record.</p>
<p class="note">Memory trick: <b>V</b>alidate, <b>E</b>xtract, <b>G</b>ate, <b>S</b>plit, <b>S</b>core, <b>S</b>weep, <b>R</b>ank, <b>R</b>ecord &mdash; &ldquo;Very Easy Girls Sing Sweet Songs, Rank Records.&rdquo;</p>

<h3>The four safety controls (the heart of the project &mdash; ANY member may be asked)</h3>
<table>
  <thead><tr><th style="width:26%">Control</th><th>What it means in one sentence</th></tr></thead>
  <tbody>
    <tr><td><b>Fallback chain</b></td><td>Main AI &rarr; second AI &rarr; a plain rules engine that needs no internet. The product <b>never</b> fails completely.</td></tr>
    <tr><td><b>Injection defence</b></td><td>The contract was written by the other side and may contain hidden instructions aimed at our AI. We treat it as hostile.</td></tr>
    <tr><td><b>Confidence gate</b></td><td>If the AI is less than 0.7 sure, or the clause is critical, or foul play is suspected &mdash; a human must check it.</td></tr>
    <tr><td><b>Hash-chained audit log</b></td><td>Every action is recorded so that secretly editing the past becomes <b>detectable</b>.</td></tr>
  </tbody>
</table>
<p>Plus: every AI answer carries a <b>&ldquo;not legal advice&rdquo;</b> label that <b>cannot be removed</b> &mdash; strip it and the response fails validation and never reaches the user.</p>

<h3>The five &ldquo;why not&rdquo; answers (any member can be asked these)</h3>
<table>
  <thead><tr><th style="width:30%">Question</th><th>Your answer</th></tr></thead>
  <tbody>
    <tr><td><b>Why not just use ChatGPT?</b></td><td>&ldquo;A plain chatbot invents facts, can be tricked by text hidden inside the contract, and will happily give legal advice that gets a founder sued. It also has no defined behaviour when it fails. We built the safety envelope that fixes all four.&rdquo;</td></tr>
    <tr><td><b>Why didn't you train your own AI?</b></td><td>&ldquo;A deliberate decision &mdash; Decision D8. Training a competitive model needs data and compute far beyond a final-year project. We rent a model and our contribution is the safety and reliability engineering around it.&rdquo;</td></tr>
    <tr><td><b>Why not hire a lawyer instead?</b></td><td>&ldquo;That is the correct answer for a big decision, and we say so in the product. But at pre-seed a lawyer is too slow and too expensive, so founders sign unread. We help them arrive at counsel prepared &mdash; or negotiate the small things themselves.&rdquo;</td></tr>
    <tr><td><b>Why two backends?</b></td><td>&ldquo;The Python backend is the tested, deployed product. The second one is a broader scaffold for the next phase. It is <b>not deployed and not merged</b>, and we do not claim it.&rdquo;</td></tr>
    <tr><td><b>Is this legal advice?</b></td><td>&ldquo;No, and the software enforces that on itself. Every AI response carries a disclaimer built into the data schema. Remove it and the response fails validation. We also refuse any question that depends on the law of a specific country.&rdquo;</td></tr>
  </tbody>
</table>
"""

RESCUE = """
<h2 class="pagebreak">Last page &mdash; What to say when you are stuck</h2>
<div class="rescue">
  <p><b>Never say &ldquo;I don't know.&rdquo;</b> Use one of these instead. Read them twice. They are all honest.</p>

  <p><b>1. It is a teammate's area:</b><br>
  &ldquo;That is <i>[name]</i>'s area and he can give you the exact detail &mdash; what I can tell you is how it connects to my part&hellip;&rdquo; then say what you <em>do</em> know.</p>

  <p><b>2. You genuinely do not know a fact:</b><br>
  &ldquo;I don't want to guess at a number and mislead you. I know where it is in the code / report and I can show you in a moment. The principle behind it is&hellip;&rdquo;</p>

  <p><b>3. They found a real weakness:</b><br>
  &ldquo;That is a fair criticism and we listed it ourselves in our limitations. Here is why we accepted that trade-off&hellip;&rdquo;<br>
  <span class="note">Never argue with a true criticism. Agreeing, then explaining the trade-off, is a strong answer. Defending the indefensible is a weak one.</span></p>

  <p><b>4. You did not understand the question:</b><br>
  &ldquo;Can I check I've understood &mdash; are you asking about <i>X</i> or about <i>Y</i>?&rdquo;<br>
  <span class="note">Asking for clarification is confidence, not weakness. Answering the wrong question is far worse.</span></p>

  <p><b>5. They ask for something we did not build:</b><br>
  &ldquo;We didn't build that, and it is in our future-work section. We scoped deliberately &mdash; Simple, Loveable, Complete &mdash; to finish one workflow properly rather than half-build several.&rdquo;</p>

  <p><b>6. Your mind goes blank:</b><br>
  &ldquo;May I take a moment to structure that answer?&rdquo; &mdash; then breathe, and start with the <em>problem</em> it solves. The rest will come.</p>
</div>

<div class="box trap">
  <div class="h">Three things never to say</div>
  <ul style="margin-bottom:0">
    <li><b>&ldquo;The AI does it.&rdquo;</b> &mdash; This sounds like you do not know how your own system works. Say what the AI is <em>asked</em>, and what happens to its answer afterwards.</li>
    <li><b>&ldquo;It's 100% accurate / it's secure.&rdquo;</b> &mdash; Absolute claims invite an examiner to find the counterexample, and they will. Say what you measured, and how.</li>
    <li><b>&ldquo;We ran out of time.&rdquo;</b> &mdash; Say instead: &ldquo;We scoped it out deliberately, and here is why.&rdquo; A decision beats an excuse every time.</li>
  </ul>
</div>
"""

FOOTER = """
<script>
  // nothing required; kept for the print button only
  document.querySelectorAll('[data-print]').forEach(b => b.onclick = () => window.print());
</script>
"""

def page(title, accent, body):
    css = CSS.replace('__ACCENT__', accent)
    return f"""<title>{title}</title>
{css}
<div class="bar">
  <b>{title}</b>
  <span class="grow"></span>
  <span>Print &rarr; &ldquo;Save as PDF&rdquo; &middot; A4</span>
  <button data-print>Print / Save as PDF</button>
</div>
{body}
{FOOTER}
"""

def tech(name, subtitle, what, history, why, alt, in_project):
    return f"""
<div class="tech">
  <div class="head">{name}<span>{subtitle}</span></div>
  <div class="body">
    <dl>
      <dt>What it is (plain words)</dt><dd>{what}</dd>
      <dt>Where it came from</dt><dd>{history}</dd>
      <dt>Why we chose it</dt><dd>{why}</dd>
      <dt>What we rejected, and why</dt><dd>{alt}</dd>
      <dt>Where it appears in Clarifyd</dt><dd>{in_project}</dd>
    </dl>
  </div>
</div>
"""

def qa(q, a):
    return f'<div class="qa"><div class="q">{q}</div><p class="a">{a}</p></div>\n'

def simple(t):  return f'<div class="box simple"><div class="h">In simple words</div>{t}</div>\n'
def say(t):     return f'<div class="box say"><div class="h">Say this</div><p>&ldquo;{t}&rdquo;</p></div>\n'
def push(q, a): return f'<div class="box push"><div class="h">If pushed: {q}</div><p>{a}</p></div>\n'
def trap(t):    return f'<div class="box trap"><div class="h">Trap &mdash; be careful here</div>{t}</div>\n'
def why(t):     return f'<div class="box why"><div class="h">Why this matters</div>{t}</div>\n'
def fig(svg, cap):
    return f'<figure><div class="svgbox">{svg}</div><figcaption>{cap}</figcaption></figure>\n'


# ------------------------------------------------------------------ assemble
def build():
    import content_ahmad as A
    import content_taha as T
    import content_awais as W
    import content_wasif as Q

    members = [
        (A, "VIVA_GUIDE_AHMAD.html"),
        (T, "VIVA_GUIDE_TAHA.html"),
        (W, "VIVA_GUIDE_AWAIS.html"),
        (Q, "VIVA_GUIDE_WASIF.html"),
    ]

    from content_scenarios import SCENARIOS
    from content_journey import JOURNEYS

    for mod, fname in members:
        title = f"Clarifyd Viva Guide &mdash; {mod.NAME}"
        body = (hero(mod.NAME, mod.ROLL, mod.ROLE, mod.TOPICS, mod.SIG, mod.ACCENT)
                + mod.BODY
                + JOURNEYS[mod.NAME]
                + SCENARIOS[mod.NAME]
                + RESCUE)
        html = page(title, mod.ACCENT, body)
        # ASCII-only: entity-encode anything else so no viewer can mis-decode it
        ent = {'—': '&mdash;', '–': '&ndash;', '·': '&middot;',
               '’': '&rsquo;', '‘': '&lsquo;', '“': '&ldquo;',
               '”': '&rdquo;', '…': '&hellip;', '→': '&rarr;',
               '←': '&larr;', 'á': '&aacute;'}
        for k, v in ent.items():
            html = html.replace(k, v)
        html = ''.join(c if ord(c) < 128 else '&#%d;' % ord(c) for c in html)

        path = os.path.join(OUT_DIR, fname)
        io.open(path, 'w', encoding='ascii', newline='').write(html)
        n_q = html.count('class="q"')
        n_t = html.count('class="tech"')
        n_f = html.count('<figure>')
        print(f"{fname:26s}  {len(html)//1024:4d} KB   {n_q:2d} Q&A   {n_t:2d} tech deep-dives   {n_f:2d} diagrams")


if __name__ == "__main__":
    build()
