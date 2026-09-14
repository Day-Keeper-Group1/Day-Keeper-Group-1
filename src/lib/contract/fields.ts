/**
 * The six fields.
 *
 * `document_type`, `issuer`, `action_required`, `due_date`, `amount`,
 * `reference`: the minimum a letter must yield before it can become a task.
 *
 * **Six is a floor, not a ceiling.** A reader that returns more is not punished
 * for being richer. Anything outside the keys below is kept in the extraction's
 * `open_payload` rather than thrown away, so nothing is lost while we work out
 * whether a field has earned a place in the contract. See ./extraction.ts.
 *
 * A payload missing one of the six is rejected, and a field the reader could not
 * read must say `unreadable` rather than be left out. Silence and "I could not
 * read this" are different answers, and the contract will not accept one for the
 * other: a key that is simply absent could mean the model skipped it, the prompt
 * lost it, or the letter never carried it, and nothing downstream can tell those
 * apart. The validator that holds this line is in ./extraction.ts.
 *
 * The keys are snake_case because that is what the model is asked to produce and
 * what every design document already calls them. Renaming one means changing the
 * prompt, the seed data and the stored rows together, and that friction is
 * deliberate.
 */
export const CONTRACT_FIELD_KEYS = [
  "document_type",
  "issuer",
  "action_required",
  "due_date",
  "amount",
  "reference",
] as const;

export type ContractFieldKey = (typeof CONTRACT_FIELD_KEYS)[number];

export function isContractFieldKey(key: string): key is ContractFieldKey {
  return (CONTRACT_FIELD_KEYS as readonly string[]).includes(key);
}

/**
 * What each field is called on screen, and the order the review page shows them.
 *
 * The order is the order a person reads a letter: who it is from, what they
 * want, by when, how much, and the number to quote. It is not alphabetical and
 * it is not the order the model happens to return.
 *
 * The wording is the product prototype's, verbatim. "From", not "Issuer":
 * these labels are read by people who did not choose this software and should
 * never have to learn its vocabulary. The snake_case keys keep the technical
 * names; the labels speak person.
 */
export const FIELD_LABELS: Record<ContractFieldKey, string> = {
  document_type: "Document type",
  issuer: "From",
  action_required: "What to do",
  due_date: "Due date",
  amount: "Amount",
  reference: "Reference",
};

/**
 * What the model is told each field means. This lives beside the keys rather
 * than inside a prompt file so that the definition and the schema cannot drift
 * apart: change the meaning here and the prompt changes with it.
 */
export const FIELD_DESCRIPTIONS: Record<ContractFieldKey, string> = {
  document_type:
    "What kind of document this is, in plain words a person would use: utility bill, government letter, fine notice, medical letter, insurance renewal.",
  issuer:
    "The organisation that sent it, as printed on the page. Prefer the name a person would recognise over a legal entity name.",
  action_required:
    "What the person has to do. Start with one of these words, then name who or what in a few words: Pay, Attend, Return form, Collect, Take medicine, Stop using, Contact, No action. For example: Pay Example Energy; Attend Orthopaedic Clinic; Return form to Public Payments Office; Collect parcel from Calderfield Post Office; Take blood pressure tablet; Stop using heater; Contact a Support at Home provider. If the document asks for nothing, write No action.",
  due_date:
    "The date the action is due, as ISO 8601 (YYYY-MM-DD). If the page shows an ambiguous format, resolve it in favour of Australian day-first convention and mark the field uncertain.",
  amount:
    "The amount payable, exactly as written on the page including the currency symbol. Do not convert, round, or reformat.",
  reference:
    "The reference, account, or customer number the person must quote. Keep the spacing as printed.",
};

/**
 * Optional fields: known to the contract, never required.
 *
 * `due_time` exists because an appointment happens AT a time, not just BY a
 * date, and the prototype shows "Fri 4 Sep, 10:30 am". The six-field floor is
 * unchanged: a provider that omits `due_time` is fine, and a provider that
 * returns it for a document with no printed time is wrong. It changes what the
 * calendar prints, not when the reminders go out: every document gets the same
 * ladder (./reminders.ts).
 */
export const OPTIONAL_FIELD_KEYS = ["due_time"] as const;

export type OptionalFieldKey = (typeof OPTIONAL_FIELD_KEYS)[number];

export const OPTIONAL_FIELD_LABELS: Record<OptionalFieldKey, string> = {
  due_time: "Time",
};

export const OPTIONAL_FIELD_DESCRIPTIONS: Record<OptionalFieldKey, string> = {
  due_time:
    "The time of day the action happens, as 24-hour HH:mm, only when the page prints one (an appointment time, a hearing time). Omit this field entirely for documents that name no time. Never invent a time from a due date.",
};

/**
 * Every key the system recognises: the six required plus the optional ones.
 * Anything a provider returns outside this list lands in open_payload.
 */
export const KNOWN_FIELD_KEYS = [
  ...CONTRACT_FIELD_KEYS,
  ...OPTIONAL_FIELD_KEYS,
] as const;

/**
 * The one value that means "this document asks for no money".
 *
 * The contract requires all six fields, so a document with nothing to pay
 * still reports an amount; this is what it says. Shared so the reader, the
 * seed, and any screen that decides to hide the row all agree on the spelling.
 * If it were two literals, the screen's comparison would silently stop
 * matching the day someone reworded one of them.
 */
export const NO_PAYMENT_REQUIRED = "No payment required";

/**
 * The one value that means "this document does not have such a thing".
 *
 * Six fields are a floor, so an appointment letter that prints no reference
 * number still has to report `reference`. Without this it could only say
 * `unreadable`, and "there is nothing to read" and "I could not read it" are
 * different answers: the first is a confident fact about the letter, the second
 * makes the card tell a person something is missing when nothing is.
 *
 * A field carrying this value has status `confirmed`, not `unreadable`, and a
 * screen may hide its row the same way it may hide a NO_PAYMENT_REQUIRED
 * amount. Hiding a row never means dropping the data.
 */
export const NOT_APPLICABLE = "Not applicable";

/**
 * The words an `action_required` value may start with.
 *
 * A task title has room for about thirty characters on a phone, and the person
 * reading it decides one thing from it: whether to act now. So the field is a
 * verb from this list followed by a few words naming who or what: "Pay Example
 * Energy", "Attend Orthopaedic Clinic", "Stop using heater". The verb is what
 * the evaluation scores and what a screen can group by; the words after it
 * are free. The list was settled on 14 September 2026 against every letter
 * type the synthetic pipeline produces; a letter that fits none of them is a
 * reason to extend the list here, not to write a sentence.
 *
 * Two-word entries are matched as a whole, so "Return form" is one verb and
 * "Return" alone is not.
 */
export const ACTION_WORDS = [
  "Pay",
  "Attend",
  "Return form",
  "Collect",
  "Take medicine",
  "Stop using",
  "Contact",
  "No action",
] as const;

export type ActionWord = (typeof ACTION_WORDS)[number];

/** The one value that means "this document asks the person to do nothing". */
export const NO_ACTION = "No action";

/**
 * The action word a value starts with, or null when it starts with none.
 * Case and repeated spaces are ignored; the words after it are not looked at.
 */
export function actionWordOf(value: string): ActionWord | null {
  const v = value.trim().replace(/\s+/g, " ").toLowerCase();
  for (const word of ACTION_WORDS) {
    const w = word.toLowerCase();
    if (v === w || v.startsWith(w + " ")) return word;
  }
  return null;
}

/**
 * There is deliberately no table of "please check this" hints here. The screen
 * shows and never asks, and nothing on it is a question; the argument is in
 * ./api.ts, beside the confirm request that does not exist.
 */
