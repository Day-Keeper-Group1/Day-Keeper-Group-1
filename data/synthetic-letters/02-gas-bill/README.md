# 02 · Gas bill

Sample `SYN-0002`, printed in small type at the bottom right of each page. Two pages. A natural gas bill from a fictional retailer, Example Energy, to Mrs M A Wilson, for the two months from 1 May to 30 June 2026. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This bill did not follow an official sample. It was built up from rules, because there is no official sample picture of a gas bill to follow. Gas retailers are private companies, and the rules the synthetic data was made under allow only published regulation and official government guidance as sources, never a real person's or a real company's document. So no real retailer's bill was used as a template either.

The layout was copied from letter 01, the electricity bill in this set. Both bills come from the same fictional retailer and are addressed to the same customer. What the bill contains was built up from these sources:

- **Energy Retail Code of Practice, version 6** (Essential Services Commission, Victoria). Clause 63 is the list of everything a Victorian gas bill must show, and it is the same clause that covers electricity bills. It gave the amount due, the pay-by date, the account details with the gas meter number (MIRN), the complaints service on page 1, the distributor's name and 24 hour gas emergency line, interpreter services, and the note about government concessions. The same clause says some items are for electricity bills only, so this bill has no Victorian Default Offer sentence, no greenhouse gas figures and no comparison with similar households. Clause 65 set the pay-by date at least 13 business days after the issue date. Clause 72 gave the payment methods. Clause 111 gave the box saying she is on one of the lowest priced plans, and the rule that this box must name a price comparison service. Clause 110 says a gas customer's plan is checked at least once every four months, and the box says so. <https://www.esc.vic.gov.au/sites/default/files/documents/Energy%20Retail%20Code%20of%20Practice%20%28version%206%29_2.pdf>
- **Winter gas concession** (Department of Families, Fairness and Housing, Victoria). The 17.5 percent concession line on page 2, the rule that it applies from 1 May to 31 October, and the formula that works out the \$50.21. <https://services.dffh.vic.gov.au/winter-gas-concession>
- **Victorian concessions: a guide to discounts and services, September 2025** (Department of Families, Fairness and Housing, Victoria). The structure and wording of the concession line and the note under it. Its dollar figures were a year out of date, so none of them were used. <https://services.dffh.vic.gov.au/sites/default/files/2025-09/Victorian%20concessions%20-%20guide%20to%20discounts%20and%20services-september-2025.pdf>
- **NMI Allocation List** (AEMO). Used the other way round. Victorian gas meter numbers start with 53. The meter number (MIRN) on this bill starts with 59, which is a range that has not been given out, and its check digit is also wrong on purpose. So it cannot belong to any real gas meter. <https://www.aemo.com.au/-/media/Files/Electricity/NEM/Retail_and_Metering/Metering-Procedures/NMI-Allocation-List.pdf>
- **Centrepay Procedural Guide** (Services Australia). The layout rules for paying by regular deductions from government payments. It gave the "paystead" column its place inside "How to pay", the same weight as the other payment methods, and plain black text. The names in that column are made up. <https://www.servicesaustralia.gov.au/centrepay-procedural-guide>

Made up, not taken from any source: the company names Example Energy Pty Ltd, Silverbank Gas Networks, Kelsworth Post, paystead and Public Payments Office, the ABN, every account, reference, meter and phone number, the websites, the customer and her address, the three gas price steps and the daily supply charge, the meter readings and the gas used, the heating value and pressure correction factor, the next scheduled read date, the fact that her last bill was paid in full, the way the GST figure is worked out, the words in the "lowest priced plans" box, the colours and logo, and the look of the whole bill. Victoria has no default gas price, so every rate on the bill is invented. The heating value and pressure correction factor were picked from a typical range, not from an official table. The regulation says a bill must show how the gas use was worked out, but not how to lay that out, so the meter reading block on page 2 is invented too. The layout copies letter 01, and most of letter 01's layout was itself worked out without a sample.

## The six fields

### document_type

**Gas bill.** Page 1, top right, says "TAX INVOICE" and under it "Natural gas account". Page 2 opens with "Your gas charges". The gas on page 2 is billed in megajoules (MJ), and the meter number on both pages is labelled "MIRN". The answer key stores it as `gas_bill`. This field is free text and the experiments do not score it.

### issuer

**Example Energy Pty Ltd.** Page 1, top left, the logo reads "Example Energy". The full name "Example Energy Pty Ltd" is printed at the right end of the "How to pay" heading, on the tear-off slip at the bottom of page 1 under "DETACH AND POST WITH YOUR PAYMENT TO", and in the privacy note at the foot of page 2. It is the company sending the bill and asking to be paid. The scoring accepts "Example Energy" as well, because one name contains the other.

### action_required

**Pay the total amount due.** Page 1, top left, the dark green box "TOTAL AMOUNT DUE" with "Pay by" under it, and the "How to pay" section across the lower half of the page. The whole bill exists to ask for this payment. This field is free text and the experiments do not score it.

### due_date

**2026-07-28.** Page 1, top left box, "Pay by 28/07/2026". The same date is repeated in the "Your account" table ("Pay by") and at the bottom right of the tear-off slip ("PAY BY"). The pay-by date is the date the payment is due. The page writes it day first, the Australian way; the answer key writes it as year, month, day.

### amount

**\$257.36.** Page 1, top left box, "TOTAL AMOUNT DUE \$257.36". It is also the last line of "Account summary" on the right ("TOTAL AMOUNT DUE") and "AMOUNT DUE" on the tear-off slip. The same figure appears as "Total of current charges" in the Account summary and in the last row of "Your gas charges" on page 2. It is the whole amount she has to pay. Her last bill of \$189.40 was paid, so the Account summary carries forward \$0.00. Page 2 works out the charges as \$307.57 of gas charges less a \$50.21 winter gas concession.

### reference

**5832 875 169.** Page 1, "Your account" table, first row, "Account number". The same number is printed in the top left box under the pay-by date ("Account 5832 875 169"), at the bottom left of the tear-off slip ("ACCOUNT NUMBER"), and in the last payment column ("Your account number: 5832 875 169"). The contract asks for the reference, account or customer number the person must quote, and the number this bill identifies her account by is the account number.
