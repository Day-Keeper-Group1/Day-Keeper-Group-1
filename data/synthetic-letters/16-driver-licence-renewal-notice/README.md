# 16 · Driver licence renewal notice

Sample `SYN-0008`, printed in small type at the bottom right of the page. One page. A renewal notice from a fictional government registry, Driver and Vehicle Registry, to Mrs M A Wilson, telling her that her driver licence expires on 13 November 2026 and asking her to pay the renewal fee before that day. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This notice did not follow an official sample or an annotated example document. It was built up from published regulation, published fee data and official guidance, without one.

No sample of a real Victorian driver licence renewal notice could be obtained. The road authority puts the notice PDF only inside a licence holder's own account, behind a login, and the rules the synthetic data was made under do not allow a real person's document to be used as a template. Two rounds of searching tried five other ways to find one and all five came up empty. So the shape of this page, meaning the order of the blocks, the type sizes and what is on it beyond the content the sources name, is inferred. That gap is recorded as a permanent one, not as something a later round of searching is expected to close.

The content was built up from the one regulation that says what a renewal notice must contain, from the law that sets the fee, and from the road authority's own published pages:

- **Road Safety (Drivers) Regulations 2019 (SR 100/2019), version 020, regulations 40, 41 and 42** (Victorian Legislation). Version 020 has been in force since 1 August 2026, so it covers this notice, and regulations 40, 41 and 42 read the same as in version 019. Regulation 40 is the only law that says what a renewal notice must carry: a date, and the meaning that the licence expires if it is not renewed before that date. It also says that not sending or not receiving the notice changes neither the expiry date nor the duty to renew. Regulation 41 gives the six months after expiry in which a licence can still be renewed. Regulation 42 says the new licence period runs from the old expiry date, not from the day the fee is paid. Those three rules are the notices printed across the bottom of the page. <https://content.legislation.vic.gov.au/sites/default/files/2026-07/19-100sra020-authorised.pdf>
- **Road Safety Act 1986 (Victoria), section 21A** (AustLII). The fee units for each licence term: 5.59 fee units for three years and 19.15 fee units for ten years. <https://classic.austlii.edu.au/au/legis/vic/consol_act/rsa1986125/s21a.html>
- **Fees and penalties table, 2025 to 26** (Department of Transport and Planning, Victoria). The table states the rule in its own words: a fee is the number of fee units in the legislation times the current value of a fee unit, rounded to the nearest 10 cents, under the Monetary Units Act 2004 section 7(3). Only that rule was taken from it, because its dollar figures are for 2025 to 26. The two fees in the "Renewal options" table were worked out with that rule and the 2026 to 27 fee unit of \$17.27, rather than typed in: 5.59 fee units is \$96.54, which rounds to \$96.50, and 19.15 fee units is \$330.72, which rounds to \$330.70. <https://transport.vic.gov.au/road-and-active-transport/registration-and-licensing/registration-and-licensing-fees/fines-and-fees>
- **Indexation of fees and penalties** (Department of Treasury and Finance, Victoria). The value of one fee unit for 2026 to 27, \$17.27, published in Special Gazette S234 on 5 May 2026. It is the other half of the fee calculation. <https://www.dtf.vic.gov.au/indexation-fees-and-penalties>
- **Renew your licence** (VicRoads). What a renewal notice carries: the licence terms and their fees, whether a new photograph is needed, and the fact that the notice carries a payment code only when no new photograph is needed. It also gives the sentence about writing the receipt number on the notice and using it as a temporary licence, that a notice is sent 4 to 6 weeks before expiry, and that only the 3 year term is available to people aged 75 and over. <https://www.vicroads.vic.gov.au/licences/manage-your-licence/renew-licence>
- **Driver licence fees** (VicRoads). The published fees, \$96.50 for three years and \$330.70 for ten years. The figures worked out from the fee units were checked against these two published numbers. <https://www.vicroads.vic.gov.au/licences/licence-fees/driver-licence-fees>
- **Licence renewal questions and answers** (VicRoads). The rule that a photograph more than 5 years old cannot be carried over, the 3 months allowed after paying to have the new photograph taken, and the 14 days allowed to report a change of name or address. <https://www.vicroads.vic.gov.au/contact/faqs/faqs-licence>

Made up, not taken from any source: the registry name Driver and Vehicle Registry, the brand band "licencedesk", the operating company Wenhurst Registry Services Pty Ltd, the recipient Mrs M A Wilson with her address and her date of birth, and every number on the page, which is the licence number, the customer number, the ABN, the three phone numbers and the two web addresses. The licence number has 8 digits grouped as "05 502 615" because no official statement of the real format was found. The date the last photograph was taken, 12/05/2021, was invented, but it was picked so that it is more than 5 years before this notice and so explains why a new photograph is needed. The dark green is not any real organisation's colour. The phone number printed for paying by phone is a Victorian landline reserved for use in fiction, where a real licence payment line would be a 13 number, because no 13 numbers are reserved for fictional use. The interpreter line at the foot of the page gives the sender's own number rather than a national interpreter service, because it was never confirmed whether a paper notice carries a national number. The order of the blocks and the look of the page are inferred, not taken from any real notice, because no sample of a real driver licence renewal notice could be obtained. Four things were deliberately left off: any national emblem at the top of the letterhead, a safe driver discount block, a tear off payment slip, which this type of notice does not have, and a payment code, because the published rules say a notice carries one only when no new photograph is needed.

## The six fields

### document_type

**Driver licence renewal notice.** Page 1, the large heading below the address block, "DRIVER LICENCE RENEWAL NOTICE". The table under the heading has the rows "Licence number", "Licence categories" and "Your licence expires", and the next section is headed "Renewal options". The answer key stores it as `driver_licence_renewal_notice`. This field is free text and the experiments do not score it.

### issuer

**Driver and Vehicle Registry.** Page 1, top left, the first line of the letterhead in bold, above a dark green badge reading "licencedesk". The name is printed again in the footer at the bottom of the page: "Issued by Wenhurst Registry Services Pty Ltd on behalf of Driver and Vehicle Registry." The web address at the top right is www.driver-and-vehicle-registry.example. The registry is the body the notice is issued on behalf of, and it is the only sender name printed more than once.

### action_required

**Pay Driver and Vehicle Registry.** Page 1, the bordered box in the middle of the page, "AMOUNT DUE \$96.50" on the left and "PAY BEFORE 13 November 2026" on the right. Below that box, the orange box "A new photograph is required" says "Pay first, then visit any customer service centre or photo point within 3 months of paying to have your photograph taken." The section below the orange box, "How to renew", gives three ways to pay: online, by phone and in person. Paying is what the notice asks for, and the photograph visit comes after the payment. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**2026-11-13.** Page 1, the bordered box, right half, the label "PAY BEFORE" with "13 November 2026" under it in large bold type. The same date is in the details table above, in the last row, "Your licence expires 13 November 2026". This notice has no separate pay by date: the licence expires on that day, and the box names that day as the day to pay before. The page spells the month out; the answer key writes it as year, month, day.

### amount

**\$96.50.** Page 1, the bordered box, left half, the label "AMOUNT DUE" with "\$96.50" under it in large bold type. The same figure is printed in the "Renewal options" table, on the "3 years" row, under the column heading "Fee". It is the fee for the 3 year licence term, and the box states it as the amount due.

### reference

**05 502 615.** Page 1, the details table under the heading, first row, the label "Licence number". The "How to renew" section asks for it again under the online option: "You will need your licence number and your customer number." The contract asks for the reference, account or customer number the person must quote. The licence number is the first line of the identification block and it identifies the licence this notice is about. The page carries no payment code, and says so in the orange box: "Because a new photograph is required, this notice does not carry a payment code for phone or internet banking."

### identifiers

Every number the letter prints that identifies her, something she holds, or this matter, each under the label printed beside it, written as printed. The first list is the numbers a reading must find; the reference is one of them, and a reading that gives any of them as the reference is right. The experiments score whether every number in the first list is found.

- **Licence number 05 502 615.** page 1, details table directly under the main heading, first row.
- **Customer number 812 466 305.** page 1, details table directly under the main heading, second row.
