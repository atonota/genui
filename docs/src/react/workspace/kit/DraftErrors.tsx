import { createContext } from 'react';

export type RegisteredDraftError = Readonly<{
  message: string;
  controlId: string;
  childId: string;
  label: string;
}>;
export type RegisteredDraftErrors = Readonly<Record<string, RegisteredDraftError>>;
export type DraftErrorsRegistry = Readonly<{
  resetKey: unknown;
  report: (scope: string, errors: RegisteredDraftErrors) => void;
}>;

/** Nested editors register invalid raw drafts; committed record values remain separate. */
export const DraftErrorsContext = createContext<DraftErrorsRegistry | null>(null);
