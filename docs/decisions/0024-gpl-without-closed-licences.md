# ADR-0024: Apollo Download Manager stays GPL-3.0-only, with no closed licences and no monetisation

- **Status:** Accepted
- **Date:** 2026-11-26
- **Decided by:** the Product Owner
- **Issue:** #530 (from the legal review, #441)
- **Changes:** [ADR-0017](0017-gpl-3-licence.md)'s contributor agreement, which kept "the right to offer Apollo Download Manager under other terms". The licence itself, GPL-3.0-only, stays.

## Context

[ADR-0017](0017-gpl-3-licence.md) licensed Apollo Download Manager under GPL-3.0-only. Through a Contributor Licence Agreement, Singlbase may also license contributions "under any licence terms Singlbase chooses, including … licences that aren't open source" ([`CLA.md`](../../CLA.md) §2). The legal review (#441, PR 519) found that clause behind several open questions:

- **The CLA:** it is an unreviewed draft, and the closed-licence right is its hardest part to justify to contributors.
- **SignPath:** SignPath Foundation, chosen to sign Windows releases (ADR-0022, PR 518), excludes "commercial dual-licensing".
- **The EU Cyber Resilience Act:** it treats monetised software as made available in a commercial activity.

The PO wanted to know whether the project could be "completely free and open to anyone" and "never commercial". The PO collected the official texts for this decision on 2026-11-26; they are kept outside the repository. What they say:

- **No licence can forbid others' commercial use and stay open source or free software:**
  - the Open Source Definition, criterion 6: a licence "may not restrict the program from being used in a business";
  - the FSF: "'Free software' does not mean 'noncommercial'", and a licence excluding commercial use "does not qualify as free software".

  "Never commercial" can therefore bind only Singlbase.
- **Authorship of AI-assisted code:** most of the code was written by an AI assistant under the PO's direction.
  - **US:** the Copyright Office's report *Copyright and Artificial Intelligence, Part 2* (29 January 2025) concludes that copyright "does not extend to purely AI-generated material, or material where there is insufficient human control over the expressive elements". It does protect "the creative selection, coordination, or arrangement of material in the outputs, or creative modifications of the outputs". 17 U.S.C. §102(b) excludes ideas, systems and methods of operation, so architecture choices alone don't make their author the author of the code.
  - **Kenya:** the Copyright Act (as at 31 December 2022), s.2, makes the author of a computer-generated computer program "the person by whom the arrangements necessary for the creation of the work were undertaken", and the author of a computer program "the person who exercised control over the making of the program".
  - **UK:** CDPA s.9(3) uses the same arrangements test.
  - **EU:** the Software Directive 2009/24/EC protects a program that is "the author's own intellectual creation" (Art. 1(3)), and its author is "the natural person or group of natural persons who has created the program" (Art. 2(1)), so the position is close to the US one.

  So the GPL protects the project fully where those rules apply, and protects the human-shaped parts in the US. No court has yet tested either rule for AI-assisted code.
- **Rights already given can't be taken back:** the GPL FAQ says the public's GPL rights "cannot be withdrawn". A copyright holder may also license "under several different licenses in parallel".
- **The EU Cyber Resilience Act** (Regulation (EU) 2024/2847) leaves out non-commercial open source:
  - recital 18: free and open-source software "not monetised by their manufacturers should not be considered to be a commercial activity";
  - recital 15: "Accepting donations without the intention of making a profit should not be considered to be a commercial activity". Donations exceeding the costs, paid technical support beyond cost, or monetising through other services would count.
  - recital 19: entities that develop open-source software "in a business context" may be open-source software stewards, but only for software "ultimately intended for commercial activities".

**PO decision, 2026-11-26:** "Keep GPL, drop closed-licence clause".

## Decision

**Apollo Download Manager stays GPL-3.0-only. Singlbase gives up licensing it under other terms, and does not monetise it.**

- **The licence:** GPL-3.0-only, as ADR-0017 decided. Copyright stays with Singlbase Technologies Limited.
- **No closed licences:** Singlbase offers Apollo Download Manager, its source and its contributions under no licence that isn't open source. The CLA's closed-licence right goes. Contributors grant only what the GPL needs: inbound licence equals outbound licence. They agree with a sign-off on each commit, the Developer Certificate of Origin, or a CLA limited to the GPL, whichever counsel advises.
- **No monetisation:** no price, no paid edition, no paid support beyond cost, no advertising, and no collecting personal data to make money. Donations, if any, cover costs only. This keeps the app outside the Cyber Resilience Act's commercial activity (recitals 15 and 18).
- **Anyone else may still sell or commercially use Apollo Download Manager under the GPL's terms.** That is part of being free software, and no licence could forbid it.
- **Changing this** (a closed licence, a paid offer) needs a new decision.

## Options considered

| Option | For | Against |
|---|---|---|
| **Keep GPL-3.0-only, drop the closed-licence clause (chosen)** | Every copy stays free, Singlbase's included; contributors grant only the GPL; no clash with SignPath; non-commercial under the CRA | The GPL's source duties stay; contributors can't later be asked to allow a closed licence |
| Keep the CLA as it is | Singlbase keeps every option | The CLA needs a lawyer before outside contributions; it conflicts with SignPath |
| MIT OR Apache-2.0 | Anyone may do anything; no source duties | Anyone could make a closed version; a new licence for a project already released under GPL |
| Public domain (0BSD, Unlicense) | No conditions at all | No patent grant; not recognised everywhere |
| A non-commercial licence | Forbids others' commercial use | Neither open source nor free software; SignPath and most communities refuse it |

## Consequences

- **Contributors see a simpler bargain:** they contribute under the GPL and keep their copyright, as the GPL itself provides.
- **The SignPath application** no longer has a dual-licensing question.
- **Singlbase can't sell a closed edition later** without every contributor's permission.
- **The CRA's commercial-activity test** is met only while nothing is monetised, so donations and support need care.
- **Not changed by this decision:** the open questions on the trademark, BitTorrent liability, export rules and the extension's store declarations. Those remain with the legal review's follow-ups (#441).

## Follow-up

Each item needs the PO's approval before it changes anything:

1. **Contributor terms:** replace [`CLA.md`](../../CLA.md)'s closed-licence grant with GPL-only terms, either the Developer Certificate of Origin or a CLA limited to the GPL. The choice is for counsel. Update [`CONTRIBUTING.md`](../../CONTRIBUTING.md) to match.
2. **Documents:** state the non-monetisation commitment in the README, [`docs/LICENSING.md`](../LICENSING.md) and the website's licence page, and remove "offer the project under other terms" wherever it appears.
3. **ADR-0022:** its "no closed licences while signed" becomes permanent through this decision.
4. **Donations:** if the PO wants them, a written rule that they cover costs only, kept with the CRA's recital 15 in mind.
