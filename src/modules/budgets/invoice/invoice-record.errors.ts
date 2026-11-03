/** Invalid invoice references use the ordinary validation response, not an internal database error. */
export class InvoiceReferenceInvalidError extends Error {
  constructor(message = 'An invoice reference does not exist.') {
    super(message);
    this.name = 'InvoiceReferenceInvalidError';
  }
}
