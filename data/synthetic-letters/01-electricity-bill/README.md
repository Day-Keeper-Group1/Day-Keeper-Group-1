# 01 · Electricity bill

Sample `SYN-0001`, printed in small type at the bottom right of each page. Two pages. A monthly electricity bill from a fictional retailer, Example Energy, to Mrs M A Wilson, for July 2026. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This bill was not copied from a real bill, and no real retailer's bill was used as a template. Electricity retailers are private companies, and the rules the synthetic data was made under allow only published regulation and official government guidance as sources, never a real person's or a real company's document.

So the bill was built up from what Victorian regulation says an electricity bill must contain, and from the one official sample bill the regulator has published:

- **Energy Retail Code of Practice, version 6, clause 63** (Essential Services Commission, Victoria). The list of everything a Victorian electricity bill must show: amount due, pay-by date, account details, the Victorian Default Offer sentence, the complaints service on page 1, the distributor's name and fault line, interpreter services, and payment methods. Every block on page 1 exists because a clause requires it. <https://www.esc.vic.gov.au/sites/default/files/documents/Energy%20Retail%20Code%20of%20Practice%20%28version%206%29_2.pdf>
- **Guideline: Greenhouse Gas Disclosure on Electricity Customers' Bills** (ESC, 2022). Figure 1 is the regulator's own sample bill. It gave the order and labels of the Account summary lines, and the chart on page 2 that draws monthly usage and emissions together. It is the only official picture of a bill that was used. <https://www.esc.vic.gov.au/sites/default/files/documents/Guideline%20Greenhouse%20gas%20disclosure%20on%20customer%20bills%20-20211204%20-%20Final.pdf>
- **Victorian Default Offer 2026 to 27, Final Decision** (ESC, May 2026). The daily supply charge (127.13c) and usage rate (27.47c per kWh) on page 2. <https://www.esc.vic.gov.au/sites/default/files/documents/Victorian%20Default%20Offer%202026%E2%80%9327%20Final%20Decision%20Paper.pdf>
- **Greenhouse gas coefficient for electricity bills, 2026** (ESC). The 0.87 kg CO2-e per kWh used for the emissions figure on page 2. <https://www.esc.vic.gov.au/sites/default/files/documents/Greenhouse%20gas%20co-efficient%202026_2.pdf>
- **Annual electricity concession** (Department of Families, Fairness and Housing, Victoria). The 17.5 percent concession line on page 2 and how it is worked out. <https://services.dffh.vic.gov.au/annual-electricity-concession>
- **NMI Allocation List** (AEMO). Used the other way round: the meter number (NMI) on the bill was picked from a gap in this list, so it cannot belong to any real meter. <https://www.aemo.com.au/-/media/Files/Electricity/NEM/Retail_and_Metering/Metering-Procedures/NMI-Allocation-List.pdf>

Made up, not taken from any source: the company names Example Energy Pty Ltd and Havercombe Power Networks, the ABN, every account, reference and phone number, the customer and her address, the usage figures, the colours and logo, and the look of the header, the payment panel, the page 2 table and the "Could you save money" box. The regulation says those blocks must exist but not what they look like.

## The six fields

### document_type

**Electricity bill.** Page 1, top right, says "TAX INVOICE" and under it "Electricity account". Page 2 opens with "Your electricity charges". The answer key stores it as `electricity_bill`. This field is free text and the experiments do not score it.

### issuer

**Example Energy Pty Ltd.** Page 1, top left, the logo reads "Example Energy". The full name "Example Energy Pty Ltd" is printed at the right end of the "How to pay" heading and on the tear-off slip at the bottom of page 1, under "Detach and post with your payment to". It is the company sending the bill and asking to be paid. The scoring accepts "Example Energy" as well, because one name contains the other.

### action_required

**Pay Example Energy.** Page 1, top left, the dark green box "TOTAL AMOUNT DUE" with "Pay by" under it, and the "How to pay" section across the lower half of the page. The whole bill exists to ask for this payment. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**2026-08-24.** Page 1, top left box, "Pay by 24/08/2026". The same date is repeated in the "Your account" table ("Pay by") and at the bottom right of the tear-off slip ("PAY BY"). The pay-by date is the date the payment is due. The page writes it day first, the Australian way; the answer key writes it as year, month, day.

### amount

**\$82.42.** Page 1, top left box, "TOTAL AMOUNT DUE \$82.42". It is also the last line of "Account summary" on the right and "AMOUNT DUE" on the tear-off slip. It is the whole amount she has to pay: the \$78.12 of charges for July plus \$4.30 left over from her last bill, as the Account summary adds up.

### reference

**7960 963 636.** Page 1, "Your account" table, first row, "Account number". The same number is printed in the top left box under the pay-by date ("Account 7960 963 636"), at the bottom left of the tear-off slip ("ACCOUNT NUMBER"), and in the last payment column ("Your account number"). The contract asks for the reference, account or customer number the person must quote, and the number this bill identifies her account by is the account number.
