# 14 · Super annual member statement

Sample `SYN-0023`, printed in small type at the bottom right of each page. Three pages. A yearly statement for an account-based pension from a fictional superannuation fund, Wattlebank Super, to Mrs M A Wilson, for the year 1 July 2025 to 30 June 2026. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This statement did not follow an official sample or an annotated example document. It was built up from rules, without any sample statement to copy.

Super funds send these statements to their own members. The rules the synthetic data was made under never allow a real person's or a real company's document to be used. So the statement was built from what federal regulations say a super statement must contain, from the regulation that sets the minimum pension payment, and from the labels funds commonly use:

- **Corporations Regulations 2001, regulations 7.9.19, 7.9.20, 7.9.20AA, 7.9.60B and 7.9.75** (Federal Register of Legislation, Australian Government). The list of what a super fund's periodic statement must show: contributions, rollovers in, withdrawals, transaction costs, employer and parental leave pay contributions, net earnings and the rate they were allotted at, insurance benefits such as a death benefit, the government co-contribution, and long-term returns. It also says long-term returns must be given as compound average effective annual rates of net earnings, which is the wording above the "Long-term returns" table on page 2. The "Your account summary" table on page 1, the note under it, the "Long-term returns" table on page 2 and the "Insurance" paragraph on page 3 exist because these regulations require that content. Items that do not apply to her account, such as employer contributions and insurance cover, are stated in a sentence instead of a table line. <https://www.legislation.gov.au/F2001B00274/latest/text>
- **Superannuation Industry (Supervision) Regulations 1994, Schedule 7** (Federal Register of Legislation, Australian Government). The rule for the minimum yearly payment from an account-based pension. The balance on 1 July is multiplied by a percentage factor for the person's age on 1 July, which is 6 for ages 75 to 79. The result is rounded to the nearest 10 dollars. This gave the "Your minimum annual payment for 2026-27" table on page 1: \$123,400.00 at 6% is \$7,404.00, which rounds to \$7,400. An ATO web page lists the same factors, but it says they are indicative only and points back to this regulation, so the regulation is the source used. <https://www.legislation.gov.au/F1996B00580/latest/text>
- **What to check on your annual super fund statement** (SuperGuide). The labels funds commonly use that the regulations do not set: the opening balance and closing balance lines, the split of fees into administration fees and costs, investment fees and costs, and transaction costs, and the three preservation components on page 2. <https://www.superguide.com.au/super-booster/10-points-check-annual-super-fund-statement>

Made up, not taken from any source: the fund name Wattlebank Super, its ABN, USI, phone number and website, the member number, the member and her address, her date of birth and the date she joined, the beneficiary nomination for her daughter Helen Wilson, and every balance, payment, fee, transaction and return rate, including the 5 year and 10 year returns. The amounts were chosen so that they add up: the opening balance, less pension payments and fees, plus net earnings, equals the closing balance. The ABN was made up so that it fails the official ABN check digit test, which means it cannot belong to a real organisation. A real USI is a fund's ABN followed by three digits for the product, as the Australian Taxation Office's Super Fund Lookup glossary describes it. The USI at the top right of page 1 is the made-up ABN followed by three digits picked at random, so it cannot belong to a real fund either. The phone number comes from a reserved range of Victorian landline numbers. The logo, the colours, the pie chart and the look and order of the sections were also made up. The regulations say what a statement must contain but not what it looks like. The statement prints no bank account details. The research notes had suggested printing a line such as "No action is required", and this statement does not print one.

## The six fields

### document_type

**Annual member statement.** Page 1, below the header, the title reads "Annual Member Statement", with "For the period 1 July 2025 to 30 June 2026" under it. Page 3 has the section "About this statement", which begins "This statement covers the period shown at the top of page 1." The answer key stores it as `annual_member_statement`. This field is free text and the experiments do not score it.

### issuer

**Wattlebank Super.** Page 1, top left, the name "Wattlebank Super" is printed next to the logo. The same name is printed at the bottom left of every page, in the footer. Page 3, "About this statement", says "Wattlebank Super is issued by the trustee of the fund." It is the super fund that holds her account and sent the statement.

### action_required

**No action.** The statement asks her for no payment, no form and no reply, and sets no date. There is no payment section, form or reply slip on any of the three pages. Page 3, "About this statement", says the statement "reports what happened to your account over that period and what your account was worth at the end of it." The same section holds the only instructions on the statement: "Keep this statement with your tax records." and, if any information does not look right, "call the number at the top of page 1." Page 1, under "Your minimum annual payment for 2026-27", the fund says "We work it out and pay it to you on the same schedule as your existing payments", and the note under that table says "Your quarterly payments for 2026-27 have already been adjusted so that the minimum is met." The statement reports on a year that has ended. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**Not applicable.** No page has a "Pay by" line, a due date or any date by which she has to do something. The line under the title on page 1 gives the period the statement covers and the day it was prepared: "For the period 1 July 2025 to 30 June 2026 · Prepared 18 August 2026". The statement looks back over a finished year and sets no deadline.

### amount

**No payment required.** No page has an amount due, a payment section or a payment slip. The "Your account summary" table on page 1 reports what happened to her account over the year, from "Opening balance (1 July 2025)" to "Closing balance (30 June 2026)", and lists "Pension payments to you". The "Fees and costs" table on page 2 says the fees were "deducted from your account" or "deducted from investment returns", so they have already been taken. Under "Your minimum annual payment for 2026-27" on page 1, the fund says "We work it out and pay it to you". Nothing on the statement asks her to pay.

### reference

**12 242 124.** Page 1, "Your account" section, first item, "Member number". It is printed only once on the statement. The contract asks for the reference, account or customer number the person must quote. This statement identifies her account by its member number.
