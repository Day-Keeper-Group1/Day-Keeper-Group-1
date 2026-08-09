/**
 * The six fields.
 *
 * These are the minimum a document must yield before it can become a task.
 * Six is a floor, not a ceiling: a provider may return more, and anything extra
 * is kept in the document's open payload rather than thrown away. But a payload
 * that is missing one of these six is not a valid extraction, and the validator
 * rejects it.
 *
 * The keys are snake_case because that is what the model is asked to produce and
 * what every design document already calls them. Do not rename one without
 * changing the prompt, the seed data, and the database rows together.
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
    "What the person has to do, as a short imperative phrase: pay the amount due, return the completed form, attend the appointment. If the document requires nothing, say so plainly.",
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
 * returns it for a document with no printed time is wrong. Its presence is
 * also what marks a document as an appointment for reminder scheduling; see
 * ./reminders.ts.
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
 * The sentence shown under a flagged field, resolved from status the way
 * FIELD_LABELS is resolved from key, so every surface says it identically.
 * The `uncertain` wording is the prototype's, verbatim.
 */
export const FIELD_STATUS_HINTS: Record<
  "confirmed" | "uncertain" | "unreadable",
  string | null
> = {
  confirmed: null,
  uncertain: "⚠ This was hard to read. Is it right?",
  unreadable: "⚠ We couldn't read this. Please type it in.",
};

/**
 * Fields a document can carry that are deliberately not in the contract yet.
 *
 * `summary` appears in the implementation roadmap's Step 5 as a seventh field.
 * It is not part of the contract: a generated prose summary adds a surface for
 * hallucination and costs screen space that a large-type field list uses better,
 * for readers who are exactly the people least able to spot an invented
 * sentence. It stays here as a named deferral rather than an oversight, so that
 * whoever revisits it knows it was considered. See
 * docs/architecture/adr-004-extraction-contract.md.
 */
export const DEFERRED_FIELD_KEYS = ["summary"] as const;
