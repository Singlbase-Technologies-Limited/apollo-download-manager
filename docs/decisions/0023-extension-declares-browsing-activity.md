# ADR-0023: The browser extension declares the browsing activity it sends to the app

- **Status:** Accepted
- **Date:** 2026-11-25
- **Decided by:** the Product Owner
- **Issue:** #522 (from the legal due diligence, #441)
- **Changes:** [ADR-0020](0020-extension-store-distribution.md)'s Firefox declaration, `required: ["none"]`, and the listing's "Data collected: none"

## Context

The extension sends a download's link, the page it came from (the referrer), and the file name, size and type, when the browser knows them, to Apollo Download Manager on the same computer, through native messaging ([`browser-extension/src/shared/protocol.ts`](../../browser-extension/src/shared/protocol.ts), `AddPayload`). It keeps its settings and the popup's last 5 sends in the browser. Nothing leaves the computer. Until now, every store was told it collects no data.

What each store's own policy says, read on 2026-11-25:

- **Chrome Web Store:** "Web browsing activity" is user data ([User Data FAQ](https://developer.chrome.com/docs/webstore/user_data)). Extensions must disclose their handling of it "even when data is processed or stored locally". The FAQ's exemption for "a native program on the same computer" covers only the rule on handling data securely. Its collection "is prohibited, except to the extent required for a user-facing feature", and the listing needs a Limited Use statement ([Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)).
- **Firefox Add-ons:**
  - **The manifest key:** `data_collection_permissions` holds "the data types that the extension collects and transmits for storage and processing outside the extension" ([MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)).
  - **The policy:** AMO's [add-on policies](https://extensionworkshop.com/documentation/publish/add-on-policies/) apply "to any data sent to the native application as well". This was read through a summary of the page, not verbatim.
  - **The category:** `browsingActivity` is "Information about the websites users visit, such as specific URLs".
- **Edge Add-ons:** [developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies) §1.5.1: "Your extension may collect, access, use, or transmit personal information (including web browsing activity) only if required by and only for use in a prominently disclosed, user-facing feature", and "You must clearly state the data handling practices of your extension at the time of installation".

The PO's decision on 2026-11-25: "Declare browsing activity".

## Decision

**The extension declares, in every store, that it handles web browsing activity: the links of downloads the user sends, and the pages they came from, passed only to Apollo Download Manager on the same computer, for downloading them. It never sells, shares or sends them anywhere else.**

- **Firefox:** the manifest declares `data_collection_permissions: { required: ["browsingActivity"] }` ([`scripts/extension-lib.mjs`](../../scripts/extension-lib.mjs), tested in [`scripts/extension-lib.test.mjs`](../../scripts/extension-lib.test.mjs)). Firefox 140 and later show it at install.
- **Chrome Web Store and Edge Add-ons:** each listing's privacy form declares web browsing activity, for the single purpose of sending downloads to the app, with Chrome's Limited Use statement. The text is in [`browser-extension/store/README.md`](../../browser-extension/store/README.md).
- **The PO updates the live listings.** A changed declaration may send the item back to review.

## Options considered

| Option | For | Against |
|---|---|---|
| **Declare browsing activity (chosen)** | Matches each store's own definitions | Firefox shows it at install; the Chrome listing goes back to review |
| Keep "none", explained in the listing | No change for users | Contradicts the policies above; a reviewer may reject or remove the listing |
| Ask each store first | An answer from the store itself | Days or weeks; the Chrome listing stays as it is meanwhile |

## Consequences

- **The listings match what the extension does,** in each store's terms.
- **Firefox users see the declaration** when they install it.
- **The extension's behaviour doesn't change.**
- **ADR-0020** stays as written; its "none" is replaced by this decision.

## Follow-up

- The PO updates the Chrome Web Store listing's privacy practices, and uses this text in the Edge and Firefox submissions (#240).
- Read AMO's revised policy, dated 2026-12-01, before the Firefox submission.
