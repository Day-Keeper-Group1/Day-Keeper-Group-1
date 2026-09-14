# 09 · Specialist account statement

Sample `SYN-0014`, printed in small type at the bottom left of the page. One page. A statement of account from a fictional eye surgeon, Mr Andrew Reid, to Mrs M A Wilson, for two visits to his rooms in June 2026, which says the account is already paid in full. The answer key is [`ground-truth.json`](ground-truth.json).

## Where it comes from

This statement did not follow an official sample or an annotated example document. It was built up from published guidance and official data, without one.

No government body publishes a template or a sample for a private specialist's account. Each private practice makes its own. The rules the synthetic data was made under do not allow a real clinic's account to be used as a template.

So the account was built up from what published medical guidance says a specialist's account contains, and from the official schedule of benefits:

- **Medicare Benefits Schedule data files, 1 March 2026 and 1 July 2026** (MBS Online, Australian Government Department of Health, Disability and Ageing). The March file gave the item numbers 104 and 105 in the services table. It also gave the two rebates, \$86.15 and \$43.35, which are the 85 percent benefits the schedule lists for those two items. The July file lists higher benefits for the same two items. It was used only to check that the March figures are the right ones, because both visits and the account date are in June 2026. <https://www.mbsonline.gov.au/internet/mbsonline/publishing.nsf/Content/Downloads-2026>
- **Informed Financial Consent: A collaboration between doctors and patients** (Australian Medical Association, October 2024). It gave the four money lines in the summary box: the total charge, the public benefit, the health fund benefit and the out-of-pocket cost. It also gave the wording of the first footnote, which says the account covers only this doctor and that other practitioners may send their own accounts. The example numbers in the guide were not copied. <https://www.ama.com.au/sites/default/files/2024-10/AMA-Informed-Financial-Consent-Guide-October-2024.pdf>
- **Guide for Patients on How the Health Care System Funds Medical Care** (Australian Medical Association). It gave the 85 percent benefit rate for a specialist visit outside hospital. It also says that health funds pay nothing for these outpatient visits. That is why the "Health fund benefit" line shows \$0.00. <https://ama.com.au/sites/default/files/documents/Guide%20for%20Patients%20on%20How%20the%20Health%20Care%20System%20Funds%20Medical%20Care.pdf>
- **Guideline for substantiating that a valid referral existed** (Australian Government Department of Health, Disability and Ageing). A specialist visit only attracts a benefit when there is a valid referral. This gave the "Referring doctor" and "Referral date" lines. It also gave the second footnote, which says a current referral from a general practitioner is needed before a benefit is paid. <https://www.health.gov.au/resources/publications/guideline-for-substantiating-that-a-valid-referral-existed-from-specialist-or-consultant-physician>
- **Difference between requests and referrals** (MBS Online fact sheet). It was used to check the label wording on the referral lines. <https://www.mbsonline.gov.au/internet/mbsonline/publishing.nsf/Content/ACBD06B0458586ADCA2588D200809117/%24File/Fact%20sheet%20-%20Diagnostic%20Imaging%20requests%20and%20referrals.PDF>
- **Health Insurance Act 1973** (Commonwealth, Federal Register of Legislation). It is the law that sets up the benefits schedule and the public benefit behind the rebate lines. The letter does not quote it. <https://www.legislation.gov.au/C2004A00101/latest/text>
- **Health Insurance Regulations 2018** (Commonwealth, Federal Register of Legislation). They hold the rules on referrals for specialist services. The letter does not quote them. <https://www.legislation.gov.au/F2018L01365/latest/text>

Made up, not taken from any source: the surgeon Mr Andrew Reid and his rooms at Suite 6, 42 Larkspur Street, the suburb Calderfield, the patient Mrs Margaret Anne Wilson with her address and date of birth, the referring doctor Dr Susan Patel and Marnworth Medical Clinic, and every identifying number on the page: the account number, ABN, provider number, scheme card number, phone numbers, email address, BPAY codes and bank details. The two fees, \$210.00 and \$105.00, were chosen inside the usual price ranges the spec card gives for a first and a follow-up specialist visit. The name "Patient Rebate Scheme" is made up. It stands in for the name of the real public health scheme. The heading "STATEMENT OF ACCOUNT" was picked from the headings the spec card lists, because the account covers two visits. The order of the blocks and the look of the page follow the usual layout the spec card describes, not any real account. Printing the "Terms" line and the "How to pay" section on an account that is already paid was also a choice, because a practice uses the same template for every account. The letterhead leaves off the college membership letters that a real eye surgeon usually prints after his name, because a made-up person must not claim to belong to a real organisation.

## The six fields

### document_type

**Specialist account statement.** Page 1, below the doctor's name and address, the large heading "STATEMENT OF ACCOUNT". The line under the doctor's name reads "OPHTHALMIC SURGEON · CONSULTING ROOMS". The "SERVICES PROVIDED" table lists two consultations with a fee and a rebate for each. The answer key stores it as `specialist_account_statement`. This field is free text and the experiments do not score it.

### issuer

**Mr Andrew Reid.** Page 1, top left, the name in large capitals, "MR ANDREW REID", with "OPHTHALMIC SURGEON · CONSULTING ROOMS" under it. The first footnote near the bottom of the page names him again: "This account relates to the services of Mr A Reid only." He is the surgeon who gave the services, and the account is sent in his own name.

### action_required

**No action.** Page 1, directly below the shaded summary box, the letter says "Payment received with thanks. This account is paid in full." The next sentence says the claim "has been lodged with the Patient Rebate Scheme on your behalf". The account is paid and the claim has been made for her, so there is nothing left for her to do. The answer key has `null` for this field. The value starts with one of the contract's eight action words, and the experiments score that word.

### due_date

**Not applicable.** No due date or pay-by date is printed on the letter. Page 1, on the right just below the "SERVICES PROVIDED" table, the summary box ends with "Balance due \$0.00". The sentence below the box says "This account is paid in full." There is nothing left to pay, so there is no date to pay by. The answer key has `null` for this field.

### amount

**No payment required.** Page 1, on the right just below the "SERVICES PROVIDED" table, the shaded summary box, last line in bold, "Balance due \$0.00". The line above it reads "Payments received -\$315.00". It takes away the whole "Total charge" of \$315.00 shown at the top of the box. Directly below the box the letter says "Payment received with thanks. This account is paid in full." Nothing is owed, so there is no amount to pay. The answer key has `null` for this field.

### reference

**709480.** Page 1, top right, the boxed table, first row, "Account no." with "709480" beside it. The same number is printed in the "HOW TO PAY" section, under "ELECTRONIC TRANSFER", as "Reference: 709480". The contract asks for the reference, account or customer number the person must quote. The account number is the number this statement is kept under, and the page itself asks for it as the reference on a bank transfer.
