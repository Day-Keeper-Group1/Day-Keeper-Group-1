# 15 · Insurance key facts sheet

Sample `SYN-0025`, printed in small type at the bottom right of each page, under the page number. Two pages. A Key Facts Sheet for a home building insurance policy from a fictional insurer, Quillhaven Insurance, prepared on 8 August 2026, with no recipient name or address printed on it. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This sheet followed an official form. The law sets out what a home building insurance Key Facts Sheet must say and how it must look. The blank form is part of the law itself: Form 1 in Schedule 5 of the Insurance Contracts Regulations 2017. No real insurer's Key Facts Sheet was used.

- **Insurance Contracts Regulations 2017, regulations 11, 12 and 13, and Schedule 5 Form 1** (Federal Register of Legislation, Commonwealth, compilation C02, current since 19 February 2021). Regulation 11 says which contracts need a Key Facts Sheet: home building insurance and home contents insurance. Regulation 12(2) sets the page size (A4) and the font (Arial). It also sets the font sizes: 18 point for the heading, 16 point for the word "STEP", 48 point for the step numbers, 8 point for the footnote under the table, and 10 point for everything else. It sets the colours as well: blue headings and policy name, white text on blue for the top row of the table and for the warning box, and table rows that alternate between white and light blue. Regulation 13(2) says the insurer must provide the sheet within 14 days after a person first asks for information about the contract, or after they take out the contract. Extending or varying a contract does not count. In the story, the sheet was sent on its own, five days after Margaret Wilson asked about her cover. Form 1 gave the heading, the wording of all four steps, the 13 events in the table, the footnote, the five parts of STEP 3, the warning box and the lines at the end of STEP 4. The form's table is stored as a picture inside the regulations PDF, so it was read by eye. The regulations are made under sections 33A to 33C of the Insurance Contracts Act 1984, which is the Act named at the top of each page. <https://www.legislation.gov.au/F2017L01658/latest/text>

The sheet differs from the official form in three places. The form says its content is "prescribed by the Australian Government". This sheet says "prescribed by law" instead, so that it does not claim to come from a real government. The legal fact stays the same, because the content is set by Commonwealth regulations. The form gives a real government website in STEP 4. This sheet describes that service in words and gives no web address. The form asks for the insurer's licence number (AFSL) in the last two lines. This sheet prints only the insurer's name there.

Made up, not taken from any source: the insurer Quillhaven Insurance, the policy name Quillhaven Home Advantage, the phone number and website in STEP 4, the date the sheet was prepared, the Yes, No and Optional answers in the table, the example conditions beside each event, the \$750.00 standard excess, the 21 day cooling off period, the choice of "Sum insured" as the type of cover, and the exact shades of blue and light blue. The form leaves blanks for the insurer to fill in these details. The example conditions are written to match common Australian home insurance terms, but no source was used for them. The regulations say only "blue" and "light blue" and give no colour values.

## The six fields

### document_type

**Insurance key facts sheet.** Page 1, top left, the blue heading "KEY FACTS ABOUT THIS HOME BUILDING POLICY". The line at the top right of both pages says "The content of this Key Facts Sheet is prescribed by law and is a requirement under the Insurance Contracts Act 1984". Page 1 also says "THIS IS NOT AN INSURANCE CONTRACT", and near the end of page 2, above the last two lines, the sheet says "The policy this KFS relates to is:". The answer key stores it as `insurance_key_facts_sheet`. This field is free text and the experiments do not score it.

### issuer

**Quillhaven Insurance.** Page 1, top right, inside the box under the line about the Insurance Contracts Act, "Quillhaven Insurance". The box has no label. The official form keeps that box for the insurer's logo or brand. The same name is printed twice at the end of page 2, under "The policy this KFS relates to is:", as "Provided/Distributed by Quillhaven Insurance." and "Underwritten by Quillhaven Insurance." The policy name under the heading on page 1 starts with "Quillhaven Home Advantage", and the website in STEP 4 is "www.quillhaven-insurance.example". It is the company that provides and underwrites the policy, and STEP 4 tells the reader to "contact us" for more information.

### action_required

**No action.** Page 1, under the title block, in capitals: "THIS IS NOT AN INSURANCE CONTRACT". Page 1, STEP 1, says what the sheet is for: "This Key Facts Sheet sets out some of the events covered and not covered by this policy and other information you should consider." The footnote under the table on page 1, marked with an asterisk, starts "This Key Facts Sheet is a guide only." The sheet does tell the reader to read the PDS: the same footnote ends "You must read the PDS and policy documentation for all information about this policy." Page 2 also says "You should consider which type of cover is best for you." This is general advice, with no date, no payment and no reply attached. Neither page has a payment section, a form to fill in, a reply slip or a date to act by. The sheet explains what the policy covers, and it does not ask for a payment, a reply or a signature. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**Not applicable.** Neither page prints a pay by date, a due date, a reply by date or an appointment. The one date on the sheet is on page 1, top left, under the policy name: "Prepared on: 8 August 2026". It tells the reader when the sheet was prepared. The sheet asks for nothing, so there is no date to do anything by.

### amount

**No payment required.** Neither page shows an amount due, a premium amount, a total or a way to pay. The one dollar figure on the sheet is on page 2, under "Excesses", in the sentence "for example the standard excess on this policy is \$750.00". The same paragraph starts "If you make a claim, the excess is the amount you may have to pay for each incident." The sheet describes the policy and does not ask for any money.

### reference

**Not applicable.** Neither page prints a policy number, an account number, a customer number or a payment reference. The box at the top right of page 1 holds only the insurer's name. The two lines at the end of page 2 name the insurer and give no number. The sheet describes a policy product, Quillhaven Home Advantage. It is not addressed to any named person. There is no number on it for the reader to quote.
