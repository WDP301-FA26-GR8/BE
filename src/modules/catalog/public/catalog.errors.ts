/** The document does not exist, is not uploaded yet, or belongs to someone else. */
export class DocumentNotFoundError extends Error {
  constructor() {
    super('The document does not exist.');
    this.name = 'DocumentNotFoundError';
  }
}

/** The role may not choose this purpose or attach to this target. */
export class DocumentPurposeForbiddenError extends Error {
  constructor() {
    super('This role may not choose this purpose for a file.');
    this.name = 'DocumentPurposeForbiddenError';
  }
}

/** The document has an owner already. */
export class DocumentAlreadyAttachedError extends Error {
  constructor() {
    super('The document has an owner already.');
    this.name = 'DocumentAlreadyAttachedError';
  }
}

/** The document is not uploaded yet. */
export class DocumentNotReadyToAttachError extends Error {
  constructor() {
    super('The document is not uploaded yet.');
    this.name = 'DocumentNotReadyToAttachError';
  }
}
