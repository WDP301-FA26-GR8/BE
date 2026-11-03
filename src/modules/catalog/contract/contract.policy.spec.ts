import {
  ContractNameRequiredError,
  DocumentFileInvalidError,
  DocumentPurposeNotAvailableError,
  DocumentTooLargeError,
  DocumentTypeNotAllowedError,
  DocumentUploadMismatchError,
} from './contract.errors';
import {
  DocumentAlreadyAttachedError,
  DocumentNotReadyToAttachError,
  DocumentPurposeForbiddenError,
} from '../public/catalog.errors';
import {
  LINK_TTL_SECONDS,
  assertAttachable,
  assertFileAllowed,
  assertMayAttachTo,
  assertMayChoosePurpose,
  assertPurposeAvailable,
  assertUploadMatches,
  cleanContractName,
  contentMatchesType,
  mayOpen,
} from './contract.policy';

const MB = 1024 * 1024;
const pdf = { fileName: 'hop-dong-k1.pdf', contentType: 'application/pdf', sizeBytes: 2 * MB, maxBytes: 10 * MB };

describe('who chooses which purpose of a file (US-04-04 AC-6, AC-9)', () => {
  it.each([
    ['CONTRACT_ATTACHMENT', ['IT_ADMIN']],
    ['CONTRACT_ATTACHMENT', ['FINANCE']],
    ['PURCHASE_DOCUMENT', ['IT_ADMIN']],
    ['PURCHASE_DOCUMENT', ['FINANCE']],
    ['TAX_PAYMENT_PROOF', ['FINANCE']],
    ['SIGNATURE_RECORD', ['IT_ADMIN']],
    ['IMPORT_SOURCE', ['IT_ADMIN']],
    ['COST_STATEMENT', ['FINANCE']],
  ] as const)('lets %s be chosen by %j', (purpose, roles) => {
    expect(() => {
      assertMayChoosePurpose(purpose, roles);
    }).not.toThrow();
  });

  it.each([
    ['IMPORT_SOURCE', ['FINANCE']],
    ['COST_STATEMENT', ['IT_ADMIN']],
    ['TAX_PAYMENT_PROOF', ['IT_ADMIN']],
    ['SIGNATURE_RECORD', ['FINANCE']],
    ['PURCHASE_DOCUMENT', ['EMPLOYEE']],
    ['CONTRACT_ATTACHMENT', ['MANAGER']],
    ['CONTRACT_ATTACHMENT', []],
  ] as const)('refuses %s to %j', (purpose, roles) => {
    expect(() => {
      assertMayChoosePurpose(purpose, roles);
    }).toThrow(DocumentPurposeForbiddenError);
  });

  it('lets a person with both roles choose what either of them may', () => {
    expect(() => {
      assertMayChoosePurpose('IMPORT_SOURCE', ['FINANCE', 'IT_ADMIN']);
    }).not.toThrow();
  });
});

describe('the purposes that have somewhere to be attached today', () => {
  it('are the three that attach to a contract or invoice', () => {
    expect(() => {
      assertPurposeAvailable('CONTRACT_ATTACHMENT');
      assertPurposeAvailable('PURCHASE_DOCUMENT');
      assertPurposeAvailable('TAX_PAYMENT_PROOF');
    }).not.toThrow();
  });

  it.each(['SIGNATURE_RECORD', 'IMPORT_SOURCE', 'COST_STATEMENT'] as const)(
    'are not yet for %s: its target does not exist',
    (purpose) => {
      expect(() => {
        assertPurposeAvailable(purpose);
      }).toThrow(DocumentPurposeNotAvailableError);
    },
  );
});

describe('attaching a file by purpose and target (US-04-04 F-17, US-01-12 AC-10)', () => {
  it('lets IT_ADMIN and FINANCE attach CONTRACT_ATTACHMENT to CONTRACT', () => {
    expect(() => assertMayAttachTo('CONTRACT_ATTACHMENT', 'CONTRACT', ['IT_ADMIN'])).not.toThrow();
    expect(() => assertMayAttachTo('CONTRACT_ATTACHMENT', 'CONTRACT', ['FINANCE'])).not.toThrow();
  });

  it('lets IT_ADMIN attach PURCHASE_DOCUMENT to CONTRACT, and refuses FINANCE', () => {
    expect(() => assertMayAttachTo('PURCHASE_DOCUMENT', 'CONTRACT', ['IT_ADMIN'])).not.toThrow();
    expect(() => assertMayAttachTo('PURCHASE_DOCUMENT', 'CONTRACT', ['FINANCE'])).toThrow(
      DocumentPurposeForbiddenError,
    );
  });

  it('lets FINANCE attach PURCHASE_DOCUMENT to INVOICE, and refuses IT_ADMIN', () => {
    expect(() => assertMayAttachTo('PURCHASE_DOCUMENT', 'INVOICE', ['FINANCE'])).not.toThrow();
    expect(() => assertMayAttachTo('PURCHASE_DOCUMENT', 'INVOICE', ['IT_ADMIN'])).toThrow(
      DocumentPurposeForbiddenError,
    );
  });

  it('lets FINANCE attach TAX_PAYMENT_PROOF to INVOICE, and refuses IT_ADMIN', () => {
    expect(() => assertMayAttachTo('TAX_PAYMENT_PROOF', 'INVOICE', ['FINANCE'])).not.toThrow();
    expect(() => assertMayAttachTo('TAX_PAYMENT_PROOF', 'INVOICE', ['IT_ADMIN'])).toThrow(
      DocumentPurposeForbiddenError,
    );
  });

  it('refuses CONTRACT_ATTACHMENT to INVOICE', () => {
    expect(() => assertMayAttachTo('CONTRACT_ATTACHMENT', 'INVOICE', ['FINANCE'])).toThrow(
      DocumentPurposeForbiddenError,
    );
    expect(() => assertMayAttachTo('CONTRACT_ATTACHMENT', 'INVOICE', ['IT_ADMIN'])).toThrow(
      DocumentPurposeForbiddenError,
    );
  });

  it('refuses TAX_PAYMENT_PROOF to CONTRACT', () => {
    expect(() => assertMayAttachTo('TAX_PAYMENT_PROOF', 'CONTRACT', ['FINANCE'])).toThrow(
      DocumentPurposeForbiddenError,
    );
  });

  it('refuses non-whitelisted roles', () => {
    expect(() => assertMayAttachTo('PURCHASE_DOCUMENT', 'INVOICE', ['EMPLOYEE'])).toThrow(
      DocumentPurposeForbiddenError,
    );
    expect(() => assertMayAttachTo('CONTRACT_ATTACHMENT', 'CONTRACT', ['MANAGER'])).toThrow(
      DocumentPurposeForbiddenError,
    );
  });
});

describe('the file that may be stored (US-04-04 AC-10)', () => {
  it('takes a PDF and the images, with the extension that goes with the type', () => {
    expect(() => {
      assertFileAllowed(pdf);
      assertFileAllowed({ ...pdf, fileName: 'scan.PNG', contentType: 'image/png' });
      assertFileAllowed({ ...pdf, fileName: 'anh.jpg', contentType: 'image/jpeg' });
      assertFileAllowed({ ...pdf, fileName: 'anh.JPEG', contentType: 'image/jpeg' });
    }).not.toThrow();
  });

  it.each([
    ['an executable', { fileName: 'setup.exe', contentType: 'application/x-msdownload' }],
    ['an executable that says it is a PDF', { fileName: 'hop-dong.pdf.exe', contentType: 'application/pdf' }],
    ['a PDF with the extension of an image', { fileName: 'hop-dong.png', contentType: 'application/pdf' }],
    ['a type that is not taken', { fileName: 'bang.xlsx', contentType: 'application/vnd.ms-excel' }],
    ['a file with no extension', { fileName: 'hopdong', contentType: 'application/pdf' }],
  ])('refuses %s', (_name, over) => {
    expect(() => {
      assertFileAllowed({ ...pdf, ...over });
    }).toThrow(DocumentTypeNotAllowedError);
  });

  it('refuses a file over the largest size, and says the largest', () => {
    expect(() => {
      assertFileAllowed({ ...pdf, sizeBytes: 10 * MB + 1 });
    }).toThrow(new DocumentTooLargeError(10 * MB));
    expect(() => {
      assertFileAllowed({ ...pdf, sizeBytes: 10 * MB });
    }).not.toThrow();
  });

  it.each([
    ['an empty file', { sizeBytes: 0 }, 'EMPTY'],
    ['a file with no name', { fileName: '   ' }, 'NAME'],
    ['a name that is a path', { fileName: '../../etc/passwd.pdf' }, 'NAME'],
    ['a name with a backslash', { fileName: 'a\\b.pdf' }, 'NAME'],
    ['a name with a control character', { fileName: 'a\u0000b.pdf' }, 'NAME'],
  ])('refuses %s', (_name, over, problem) => {
    expect(() => {
      assertFileAllowed({ ...pdf, ...over });
    }).toThrow(new DocumentFileInvalidError(problem as 'EMPTY' | 'NAME'));
  });
});

describe('what was stored is what was declared (US-04-04 AC-10)', () => {
  const declared = { contentType: 'application/pdf', sizeBytes: 100 };

  it('accepts the object the storage reports with the same size and type', () => {
    expect(() => {
      assertUploadMatches(declared, { contentLength: 100, contentType: 'application/pdf' });
    }).not.toThrow();
  });

  it.each([
    ['another size', { contentLength: 101, contentType: 'application/pdf' }],
    ['another type', { contentLength: 100, contentType: 'application/x-msdownload' }],
    ['no size', { contentLength: undefined, contentType: 'application/pdf' }],
    ['no type', { contentLength: 100, contentType: undefined }],
  ])('refuses an object with %s', (_name, stored) => {
    expect(() => {
      assertUploadMatches(declared, stored);
    }).toThrow(DocumentUploadMismatchError);
  });
});

describe('who opens a file (US-04-04 AC-1, AC-3, AC-6)', () => {
  const base = { uploaderAppUserId: 'u1', actorAppUserId: 'u1', roles: ['IT_ADMIN'] };

  it('lets the one who uploaded a file that is not attached yet open it, and nobody else see it', () => {
    expect(mayOpen({ ...base, status: 'PENDING_ATTACH' })).toBe('OPEN');
    expect(mayOpen({ ...base, status: 'PENDING_ATTACH', actorAppUserId: 'u2' })).toBe('HIDDEN');
    expect(mayOpen({ ...base, status: 'PENDING_ATTACH', actorAppUserId: 'f1', roles: ['FINANCE'] })).toBe('HIDDEN');
  });

  it('lets the IT Admin and Finance open a file that is attached', () => {
    expect(mayOpen({ ...base, status: 'READY', actorAppUserId: 'u2' })).toBe('OPEN');
    expect(mayOpen({ ...base, status: 'READY', actorAppUserId: 'f1', roles: ['FINANCE'] })).toBe('OPEN');
  });

  it.each([['MANAGER'], ['EMPLOYEE'], ['SPENDING_APPROVER'], ['SUPER_ADMIN']])(
    'never lets %s open a file, attached or not',
    (role) => {
      expect(mayOpen({ ...base, status: 'READY', actorAppUserId: 'x', roles: [role] })).toBe('FORBIDDEN');
      expect(mayOpen({ ...base, status: 'PENDING_ATTACH', roles: [role] })).toBe('FORBIDDEN');
    },
  );

  it('loses the right when the role is lost, whoever uploaded the file', () => {
    expect(mayOpen({ ...base, status: 'PENDING_ATTACH', roles: [] })).toBe('FORBIDDEN');
  });

  it.each(['AWAITING_UPLOAD', 'QUARANTINED'] as const)('shows nobody a file that is %s', (status) => {
    expect(mayOpen({ ...base, status })).toBe('HIDDEN');
  });

  it('lives for five minutes, no longer', () => {
    expect(LINK_TTL_SECONDS).toBe(300);
  });
});

describe('attaching a file to a contract (US-04-04 AC-6)', () => {
  it('lets a file that is waiting for its owner be attached', () => {
    expect(() => {
      assertAttachable('PENDING_ATTACH');
    }).not.toThrow();
  });

  it('refuses a file that has an owner already, and one that is not uploaded yet', () => {
    expect(() => {
      assertAttachable('READY');
    }).toThrow(DocumentAlreadyAttachedError);
    expect(() => {
      assertAttachable('AWAITING_UPLOAD');
    }).toThrow(DocumentNotReadyToAttachError);
    expect(() => {
      assertAttachable('QUARANTINED');
    }).toThrow(DocumentNotReadyToAttachError);
  });
});

describe('the name of a contract', () => {
  it('is kept trimmed and may not be blank', () => {
    expect(cleanContractName('  Hợp đồng Figma 2026  ')).toBe('Hợp đồng Figma 2026');
    expect(() => cleanContractName('   ')).toThrow(ContractNameRequiredError);
    expect(() => cleanContractName('')).toThrow(ContractNameRequiredError);
  });
});

describe('what the first bytes of a file must say (US-04-04 AC-10)', () => {
  const bytes = (...values: number[]) => Uint8Array.from(values);
  const ascii = (text: string) => Uint8Array.from(Buffer.from(text, 'latin1'));

  it.each([
    ['application/pdf', ascii('%PDF-1.7')],
    ['image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00)],
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0, 0x00)],
  ])('accepts the signature of %s', (type, prefix) => {
    expect(contentMatchesType(type, prefix)).toBe(true);
  });

  it.each([
    ['application/pdf', ascii('MZ an executable')],
    ['application/pdf', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/png', ascii('%PDF-1.7')],
    ['image/jpeg', bytes(0x89, 0x50, 0x4e, 0x47)],
    ['application/pdf', new Uint8Array()],
    ['application/x-msdownload', ascii('MZ')],
  ])('refuses bytes that are not those of %s', (type, prefix) => {
    expect(contentMatchesType(type, prefix)).toBe(false);
  });

  it('refuses a prefix that stops inside the signature', () => {
    expect(contentMatchesType('application/pdf', ascii('%PD'))).toBe(false);
  });
});
