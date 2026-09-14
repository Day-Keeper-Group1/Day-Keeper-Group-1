# 07 · Penalty reminder notice

Sample `SYN-0007`, printed in small type at the bottom right of each page. Two pages. A penalty reminder notice dated 30 July 2026 from a fictional council, Calderfield City Council, to Mrs M A Wilson, about a parking fine that was not paid by its first due date. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This notice did not follow an official sample or an annotated example, and no real notice was used as a template. No official or real penalty reminder notice could be found. The Attorney-General's Guidelines under the Infringements Act were read in full, and they contain no sample either. The rules the synthetic data was made under never allow a real person's letter as a source.

So the notice was built up from what Victorian law says a penalty reminder notice must contain, from official fee tables and fee pages, and from one official Fines Victoria form:

- **Infringements Regulations 2026, regulations 9 and 16** (Victorian Government). Regulation 16 is the list of what a penalty reminder notice must contain: that it is a penalty reminder notice, its date, the person's name and address, the council's name, the issuing officer's number, the date, time and place of the offence, the penalty and the fee, how to pay, the new due date, the right to go to court, what happens if nothing is done, internal review, payment plans, where to find more information, and where to get legal and financial advice. Most blocks on the two pages exist because an item on that list requires them. Regulation 9 sets the penalty reminder notice fee at 1.74 fee units. <https://www.legislation.vic.gov.au/in-force/statutory-rules/infringements-regulations-2026/001>
- **Infringements Act 2006, version 065** (Victorian Government). Section 29 says the council that issued the fine is the one that sends the reminder. It also says the new time to pay must end at least 14 days after the notice is served. Section 12(2) says a posted notice counts as served 7 days after its date. These two sections were used to set the new due date of 20 August 2026, which is 21 days after the notice date. Section 30 gives the 28 days to elect to go to court, printed under "GOING TO COURT" on page 2. Section 22 covers internal review and section 46 covers paying by instalments, both on page 2. <https://www.legislation.vic.gov.au/in-force/acts/infringements-act-2006/065>
- **Fines Reform Regulations 2026, regulation 9** (Victorian Government). The further fee of 9.01 fee units that is added when a notice of final demand is issued. That is the \$155.60 under "IF YOU DO NOT ACT" on page 2. <https://www.legislation.vic.gov.au/in-force/statutory-rules/fines-reform-regulations-2026/001>
- **Fines Reform Act 2014, version 033** (Victorian Government). Regulation 16 requires the notice to name this Act when it says what happens if nothing is done. It is named under "IF YOU DO NOT ACT" on both pages. Part 5 of the Act is the payment arrangements mentioned under "IF YOU ARE HAVING DIFFICULTY PAYING" on page 2. <https://www.legislation.vic.gov.au/in-force/acts/fines-reform-act-2014/033>
- **Application for Internal Review (Infringements Only), form INF6.0.28, version 6** (Fines Victoria). The wording of "PENALTY REMINDER NOTICE FEE WAIVER" on page 2, including that the original penalty is still payable if the fee is waived. It also gave the short names of the five review grounds listed on page 2. <https://online.fines.vic.gov.au/-/media/Files/Downloadable-applications/Application-for-Internal-Review.pdf>
- **Fees and Penalties 2025 to 26** (Department of Transport and Planning, Victoria). Offence code 701, its description "Parking for longer than indicated", the rule it comes from (Road Safety Road Rules 2017 r 205(1)), and its penalty of 0.2 penalty units. That penalty is the \$41.00 infringement penalty on page 1. The table also states that fees are rounded to the nearest 10 cents. <https://transport.vic.gov.au/road-and-active-transport/registration-and-licensing/registration-and-licensing-fees/fines-and-fees>
- **Indexation of fees and penalties** (Department of Treasury and Finance, Victoria). The value of one fee unit from 1 July 2026, \$17.27. At that value, 1.74 fee units rounds to the \$30.00 fee on page 1. At the same value, 9.01 fee units rounds to the \$155.60 on page 2. <https://www.dtf.vic.gov.au/indexation-fees-and-penalties>
- **Penalty Reminder Notice** (Fines Victoria). The published \$30.00 fee, which matches the fee on page 1. It also confirms that a council's fine is still handled by that council at this stage, and it lists the options a person has. <https://online.fines.vic.gov.au/Infringement-fines/Penalty-Reminder-Notice>
- **Notice of Final Demand** (Fines Victoria). The published \$155.60 further fee, and the \$185.60 total of both fees. Both figures match the ones under "IF YOU DO NOT ACT" on page 2. <https://online.fines.vic.gov.au/Infringement-fines/Notice-of-Final-Demand>
- **Privacy and Data Protection Act 2014** (Victorian Government). Named under "PRIVACY" on page 2.

Made up, not taken from any source: the council name Calderfield City Council, its "finesdesk" label, its logo and colours, the State Infringements Registry named on page 2, the ABN, the BPAY biller code and reference, every phone number, the PO Box and the website, the recipient and her address, and the offence itself (date, time, street, car, registration, officer number and infringement number). The date, time, street, registration, offence, officer number and infringement number are the same as on letter 06, the parking infringement notice that this reminder follows. The whole layout is also made up: the order of the blocks, the dark red heading bands, the offence table, the tear-off slip, and which blocks go on page 1 and which go on page 2. The barcode is for looks only and does not scan. The 21 days to the new due date was reasoned from the Act, and no real notice was available to confirm it. Regulation 16 does not require the infringement number, the offence description, the legislation line or the original due date, and they were printed by choice. The regulation names two real advice services, and the letter describes them by what they do instead of naming them.

## The six fields

### document_type

**Penalty reminder notice.** Page 1, the dark red band across the top says "PENALTY REMINDER NOTICE", with "Issued under the Infringements Act 2006" at its right end. The paragraph under "WHY YOU HAVE RECEIVED THIS NOTICE" calls it "This penalty reminder notice". The small footer at the bottom left of both pages also names it. The answer key stores it as `penalty_reminder_notice`. This field is free text and the experiments do not score it.

### issuer

**Calderfield City Council.** Page 1, top left, beside the logo, "Calderfield City Council", with "finesdesk" in a black box under it. The name is printed again in the small footer at the bottom left of both pages. On page 2 it appears under "GOING TO COURT", "INTERPRETER" and "PRIVACY". It is the council that sent the notice and is asking to be paid. Page 2 says a written statement to go to court must be served "on Calderfield City Council".

### action_required

**Pay Calderfield City Council.** Page 1, the "AMOUNT NOW PAYABLE" section with the "PAY BY" box on its right, and the "HOW TO PAY" section below it. Page 2 repeats it as the first item under "YOUR OPTIONS": "Pay the total amount now payable by the due date shown on the front of this notice." The front page is built around this payment: the amount table, the PAY BY box, the ways to pay, and the slip to send back with the payment. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**2026-08-20.** Page 1, the box on the right of the "AMOUNT NOW PAYABLE" section, "PAY BY 20 August 2026". The same date is printed at the top right of the tear-off slip at the bottom of page 1 ("Pay by 20 August 2026"). The paragraph under "WHY YOU HAVE RECEIVED THIS NOTICE" says the notice "extends the time for payment". The PAY BY date is the last day of that new time to pay. The page writes the month as a word; the answer key writes it as year, month, day.

### amount

**\$71.00.** Page 1, "AMOUNT NOW PAYABLE" section, last line, "Total amount now payable \$71.00". It is also printed in the "PAY BY" box on the right, above the words "total amount now payable", and on the tear-off slip ("TOTAL AMOUNT NOW PAYABLE"). It is the whole amount she has to pay: the \$41.00 infringement penalty plus the \$30.00 penalty reminder notice fee, as the table adds up.

### reference

**7717145263.** Page 1, the box at the top right, first row, "Infringement no.". The same number is printed on the tear-off slip ("Infringement no."), under the barcode on the slip, and at the right end of the dark red band at the top of page 2 ("Infringement no."). The contract asks for the reference, account or customer number the person must quote. The "Online" column under "HOW TO PAY" on page 1 says "Quote the infringement number."
