import { createError } from "@directus/errors";

export const UnexpectedError = createError(
  "UNEXPECTED_ERROR",
  "We encountered an unexpected error. Please try again later.",
  500
);


