// Startup legal template skeletons. {{PLACEHOLDERS}} are filled by the
// Legal Co-Pilot (Clarifyd AI) using terms collected in the builder chat.
// These are starting points only — not legal advice.

export type StartupTemplate = {
  id: string;
  name: string;
  category: string;
  terms: string[];
  body: string;
};

export const STARTUP_TEMPLATES: Record<string, StartupTemplate> = {
  "Mutual NDA": {
    id: "Mutual NDA",
    name: "Mutual Non-Disclosure Agreement",
    category: "Confidentiality",
    terms: [
      "Party A legal name",
      "Party B legal name",
      "Effective date",
      "Purpose of disclosure",
      "Confidentiality term (years)",
      "Governing law / jurisdiction",
    ],
    body: `MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of {{EFFECTIVE_DATE}}
by and between {{PARTY_A}} ("Party A") and {{PARTY_B}} ("Party B").

1. PURPOSE
The parties wish to explore {{PURPOSE}} and may disclose Confidential Information to each other.

2. CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public information disclosed by one party to the other,
whether oral, written, or electronic, that is marked confidential or would reasonably be
understood to be confidential.

3. OBLIGATIONS
Each party shall: (a) use the Confidential Information only for the Purpose; (b) protect it with
at least the same care it uses for its own confidential information; and (c) not disclose it to
third parties without prior written consent.

4. EXCLUSIONS
Confidential Information does not include information that is public, independently developed,
or rightfully received from a third party without restriction.

5. TERM
This Agreement remains in effect for {{CONFIDENTIALITY_TERM}} years from the Effective Date.

6. GOVERNING LAW
This Agreement is governed by the laws of {{GOVERNING_LAW}}.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

_______________________        _______________________
{{PARTY_A}}                     {{PARTY_B}}`,
  },

  "SAFE Note": {
    id: "SAFE Note",
    name: "Simple Agreement for Future Equity (SAFE)",
    category: "Fundraising",
    terms: [
      "Company legal name",
      "Investor legal name",
      "Investment amount",
      "Post-money valuation cap",
      "Discount rate (or none)",
      "State of incorporation",
    ],
    body: `SIMPLE AGREEMENT FOR FUTURE EQUITY

THIS CERTIFIES THAT in exchange for the payment by {{INVESTOR}} ("Investor") of
{{INVESTMENT_AMOUNT}} (the "Purchase Amount"), {{COMPANY}} (the "Company"), a
{{STATE_OF_INCORPORATION}} corporation, issues to the Investor the right to certain shares of
the Company's capital stock, subject to the terms below.

1. VALUATION CAP
The "Post-Money Valuation Cap" is {{VALUATION_CAP}}.

2. DISCOUNT RATE
The "Discount Rate" is {{DISCOUNT_RATE}}.

3. EQUITY FINANCING CONVERSION
If there is an Equity Financing before this SAFE terminates, the SAFE will automatically convert
into shares of the Company's preferred stock, priced at the lower of the Valuation Cap price or
the Discount Rate price.

4. LIQUIDITY / DISSOLUTION EVENTS
On a Liquidity Event or Dissolution Event, the Investor will be entitled to the greater of the
Purchase Amount or the as-converted value, with standard SAFE priority.

5. INVESTOR REPRESENTATIONS
The Investor represents it is an accredited investor and is acquiring this SAFE for its own
account.

6. GOVERNING LAW
This SAFE is governed by the laws of {{STATE_OF_INCORPORATION}}.

{{COMPANY}}                     INVESTOR: {{INVESTOR}}
_______________________        _______________________`,
  },

  "Employment Offer": {
    id: "Employment Offer",
    name: "Executive Employment Offer Letter",
    category: "Hiring",
    terms: [
      "Company legal name",
      "Candidate full name",
      "Job title",
      "Start date",
      "Base salary",
      "Equity grant (shares / %)",
      "Vesting schedule",
    ],
    body: `EMPLOYMENT OFFER LETTER

{{COMPANY}} is pleased to offer {{CANDIDATE_NAME}} the position of {{JOB_TITLE}}.

1. START DATE
Your employment will begin on {{START_DATE}}.

2. COMPENSATION
Your annual base salary will be {{BASE_SALARY}}, paid in accordance with the Company's standard
payroll schedule.

3. EQUITY
Subject to Board approval, you will be granted {{EQUITY_GRANT}}, vesting over {{VESTING_SCHEDULE}}
with a standard one-year cliff.

4. INVENTION ASSIGNMENT
As a condition of employment, you must sign the Company's Confidential Information and Invention
Assignment Agreement.

5. AT-WILL EMPLOYMENT
Your employment is at-will and may be terminated by either party at any time, with or without
cause or notice.

6. BENEFITS
You will be eligible for the Company's standard benefits package.

This offer is contingent on satisfactory completion of background and reference checks.

_______________________        _______________________
{{COMPANY}} (Authorized)        {{CANDIDATE_NAME}}`,
  },

  "SaaS Master Agreement": {
    id: "SaaS Master Agreement",
    name: "SaaS Master Services Agreement",
    category: "Commercial",
    terms: [
      "Provider legal name",
      "Customer legal name",
      "Effective date",
      "Subscription term",
      "Uptime SLA (%)",
      "Liability cap basis",
      "Governing law / jurisdiction",
    ],
    body: `SAAS MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into as of {{EFFECTIVE_DATE}} between
{{PROVIDER}} ("Provider") and {{CUSTOMER}} ("Customer").

1. SERVICES
Provider will make its software-as-a-service platform available to Customer per the applicable
Order Form.

2. SUBSCRIPTION TERM
The initial subscription term is {{SUBSCRIPTION_TERM}}, renewing automatically unless either
party gives written notice of non-renewal at least 30 days before term end.

3. SERVICE LEVEL
Provider will use commercially reasonable efforts to maintain {{UPTIME_SLA}} monthly uptime,
excluding scheduled maintenance.

4. DATA PROTECTION
Provider will maintain administrative, physical, and technical safeguards for Customer Data and
will not use Customer Data except to provide the Services.

5. LIMITATION OF LIABILITY
Except for breaches of confidentiality or indemnification obligations, each party's aggregate
liability is capped at {{LIABILITY_CAP_BASIS}}.

6. TERMINATION
Either party may terminate for material breach not cured within 30 days of written notice.

7. GOVERNING LAW
This Agreement is governed by the laws of {{GOVERNING_LAW}}.

_______________________        _______________________
{{PROVIDER}}                    {{CUSTOMER}}`,
  },
};
