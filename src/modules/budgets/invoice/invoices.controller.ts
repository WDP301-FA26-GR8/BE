import { Body, Controller, Get, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorResponses,
  FORBIDDEN_EXAMPLE,
  GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
  UNAUTHENTICATED_RESPONSE,
  VALIDATION_EXAMPLE,
} from '../../../infrastructure/http/decorators/api-error-responses.decorator';
import { ApiSuccessResponse } from '../../../infrastructure/http/decorators/api-success-response.decorator';
import { RequireRoles } from '../../../infrastructure/security/decorators/access.decorators';
import { CurrentPrincipal } from '../../../infrastructure/security/models/current-principal';
import { BudgetCommitmentNotFoundError } from '../budget/budget.errors';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import {
  AttachInvoiceDocumentBodyDto,
  AttachInvoiceDocumentResponseDto,
  CommitmentMatchResponseDto,
  InvoiceDetailResponseDto,
  InvoiceIdParamDto,
  InvoiceLineParamDto,
  ListCommitmentMatchesQueryDto,
  ListCommitmentMatchesResponseDto,
  ListInvoiceDocumentsQueryDto,
  ListInvoiceDocumentsResponseDto,
  ListInvoiceLinesQueryDto,
  ListInvoiceLinesResponseDto,
  ListInvoicesQueryDto,
  ListInvoicesResponseDto,
  ListInvoiceTaxLinesQueryDto,
  ListInvoiceTaxLinesResponseDto,
  MatchCommitmentBodyDto,
  RecordInvoiceBodyDto,
  RecordInvoiceResponseDto,
  UpdateInvoiceTaxLineBodyDto,
  UpdateInvoiceTaxLineResponseDto,
} from './invoice.dto';
import { InvoiceNotFoundError, InvoiceRateMissingError, InvoiceTaxLineNotBuyerRemitsError } from './invoice.errors';
import {
  ATTACH_DOC_CONFLICT_EXAMPLES,
  ATTACH_DOC_NOT_FOUND_EXAMPLES,
  MATCH_LINE_CONFLICT_EXAMPLES,
  MATCH_LINE_NOT_FOUND_EXAMPLES,
  RECORD_CONFLICT_EXAMPLES,
  RECORD_EXAMPLE,
  RECORD_UNPROCESSABLE_EXAMPLES,
  invoiceExample,
  mapInvoiceError,
} from './invoice.http-errors';
import { InvoiceService } from './invoice.service';
import { InvoiceDocumentService } from './invoice-document.service';
import { InvoiceMatchService } from './invoice-match.service';
import { InvoiceQueryService } from './invoice-query.service';
import { InvoiceTaxLineService } from './invoice-tax-line.service';

@ApiTags('invoices')
@Controller({ path: 'invoices', version: '1' })
export class InvoicesController {
  constructor(
    private readonly invoices: InvoiceService,
    private readonly documents: InvoiceDocumentService,
    private readonly matchService: InvoiceMatchService,
    private readonly taxLines: InvoiceTaxLineService,
    private readonly queries: InvoiceQueryService,
  ) {}

  @Post()
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'invoiceRecord', summary: 'Record an invoice and its tax lines' })
  @ApiBody({ type: RecordInvoiceBodyDto, examples: { invoice: { value: RECORD_EXAMPLE } } })
  @ApiSuccessResponse(RecordInvoiceResponseDto, {
    status: HttpStatus.CREATED,
    message: 'INVOICE.RECORDED',
    description:
      'The invoice, its lines, tax snapshots and audit event are recorded atomically. Returns the invoice id.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    { status: HttpStatus.FORBIDDEN, description: 'Only Finance records invoices.', examples: [FORBIDDEN_EXAMPLE] },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'A commitment selected for an invoice line or a credited invoice was not found.',
      examples: [invoiceExample(new BudgetCommitmentNotFoundError()), invoiceExample(new InvoiceNotFoundError())],
    },
    {
      status: HttpStatus.CONFLICT,
      description:
        'Duplicate invoice, missing exact-day rate, unavailable vendor, mismatched line vendor, unsupported reporting currency or refused commitment match.',
      examples: [...RECORD_CONFLICT_EXAMPLES, ...MATCH_LINE_CONFLICT_EXAMPLES],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description:
        'Invalid body or missing subscription, inconsistent line total, unsupported currency, excessive precision or amount out of range.',
      examples: RECORD_UNPROCESSABLE_EXAMPLES,
    },
  )
  async record(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: RecordInvoiceBodyDto) {
    try {
      return await this.invoices.record(actor, body);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Get()
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'invoiceList', summary: 'List invoices' })
  @ApiSuccessResponse(ListInvoicesResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.LISTED',
    description: 'Lists invoices with summary fields and pagination.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    { status: HttpStatus.FORBIDDEN, description: 'Only Finance views invoices.', examples: [FORBIDDEN_EXAMPLE] },
    { status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'Invalid query.', examples: [VALIDATION_EXAMPLE] },
  )
  async listInvoices(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query() query: ListInvoicesQueryDto) {
    try {
      return await this.queries.pageInvoices(actor, query);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Post(':id/documents')
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'invoiceDocumentAttach', summary: 'Attach a document to an invoice' })
  @ApiBody({ type: AttachInvoiceDocumentBodyDto })
  @ApiSuccessResponse(AttachInvoiceDocumentResponseDto, {
    status: HttpStatus.CREATED,
    message: 'INVOICE.DOCUMENT_ATTACHED',
    description: 'The document is attached to the invoice, and optionally linked to a buyer-remits tax line.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance attaches documents to invoices.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice, tax line, or document not found.',
      examples: ATTACH_DOC_NOT_FOUND_EXAMPLES,
    },
    {
      status: HttpStatus.CONFLICT,
      description: 'Document already attached or not ready.',
      examples: ATTACH_DOC_CONFLICT_EXAMPLES,
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid input or tax line payer is not BUYER_REMITS.',
      examples: [VALIDATION_EXAMPLE, invoiceExample(new InvoiceTaxLineNotBuyerRemitsError())],
    },
  )
  async attachDocument(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() params: InvoiceIdParamDto,
    @Body() body: AttachInvoiceDocumentBodyDto,
  ) {
    try {
      return await this.documents.attach(actor, params.id, body);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Get(':id/documents')
  @RequireRoles('FINANCE', 'IT_ADMIN')
  @ApiOperation({ operationId: 'invoiceDocumentsList', summary: 'List documents attached to an invoice' })
  @ApiSuccessResponse(ListInvoiceDocumentsResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.DOCUMENTS_LISTED',
    description: 'Lists all documents attached to this invoice, including tax proofs.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance and IT Admin view invoice documents.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice not found.',
      examples: [invoiceExample(new InvoiceNotFoundError())],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid parameters.',
      examples: [VALIDATION_EXAMPLE],
    },
  )
  async listDocuments(@Param() params: InvoiceIdParamDto, @Query() query: ListInvoiceDocumentsQueryDto) {
    try {
      return await this.documents.list(params.id, query);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Get(':id')
  @RequireRoles('FINANCE', 'IT_ADMIN')
  @ApiOperation({ operationId: 'invoiceGet', summary: 'Get invoice details' })
  @ApiSuccessResponse(InvoiceDetailResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.RETRIEVED',
    description: 'Retrieves invoice details including effective cost and deductible VAT.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance and IT Admin view invoice details.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice not found.',
      examples: [invoiceExample(new InvoiceNotFoundError())],
    },
    { status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'Invalid id.', examples: [VALIDATION_EXAMPLE] },
  )
  async getInvoice(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param() params: InvoiceIdParamDto) {
    try {
      return { invoice: await this.queries.getInvoice(actor, params.id) };
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Get(':id/lines')
  @RequireRoles('FINANCE', 'IT_ADMIN')
  @ApiOperation({ operationId: 'invoiceLinesList', summary: 'List lines of an invoice' })
  @ApiSuccessResponse(ListInvoiceLinesResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.LINES_LISTED',
    description: 'Lists invoice lines with pagination.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance and IT Admin view invoice lines.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice not found.',
      examples: [invoiceExample(new InvoiceNotFoundError())],
    },
    { status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'Invalid parameters.', examples: [VALIDATION_EXAMPLE] },
  )
  async listLines(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() params: InvoiceIdParamDto,
    @Query() query: ListInvoiceLinesQueryDto,
  ) {
    try {
      return await this.queries.pageLines(actor, params.id, query);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Get(':id/tax-lines')
  @RequireRoles('FINANCE', 'IT_ADMIN')
  @ApiOperation({ operationId: 'invoiceTaxLinesList', summary: 'List tax lines of an invoice' })
  @ApiSuccessResponse(ListInvoiceTaxLinesResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.TAX_LINES_LISTED',
    description: 'Lists invoice tax lines with pagination.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance and IT Admin view invoice tax lines.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice not found.',
      examples: [invoiceExample(new InvoiceNotFoundError())],
    },
    { status: HttpStatus.UNPROCESSABLE_ENTITY, description: 'Invalid parameters.', examples: [VALIDATION_EXAMPLE] },
  )
  async listTaxLines(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() params: InvoiceIdParamDto,
    @Query() query: ListInvoiceTaxLinesQueryDto,
  ) {
    try {
      return await this.queries.pageTaxLines(actor, params.id, query);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Put(':id/tax-lines/:position')
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'invoiceTaxLineSet', summary: 'Update or create an invoice tax line' })
  @ApiBody({ type: UpdateInvoiceTaxLineBodyDto })
  @ApiSuccessResponse(UpdateInvoiceTaxLineResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.TAX_LINE_SET',
    description:
      'Updates or creates a tax line on the invoice and recalculates cost reporting amounts across all lines.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance updates tax lines.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice not found.',
      examples: [invoiceExample(new InvoiceNotFoundError())],
    },
    {
      status: HttpStatus.CONFLICT,
      description: 'Missing exchange rate for invoice date.',
      examples: [invoiceExample(new InvoiceRateMissingError())],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid position or body.',
      examples: [VALIDATION_EXAMPLE],
    },
  )
  async updateTaxLine(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() params: InvoiceLineParamDto,
    @Body() body: UpdateInvoiceTaxLineBodyDto,
  ) {
    try {
      return await this.taxLines.update(actor, params.id, params.position, body);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Post(':id/lines/:position/commitment-match')
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'invoiceLineCommitmentMatch', summary: 'Match an invoice line to a budget commitment' })
  @ApiBody({ type: MatchCommitmentBodyDto })
  @ApiSuccessResponse(CommitmentMatchResponseDto, {
    status: HttpStatus.CREATED,
    message: 'INVOICE.LINE_COMMITMENT_MATCHED',
    description: 'Matches an invoice line against a budget commitment held for a request.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance matches invoice lines to commitments.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice, line position, or commitment not found.',
      examples: MATCH_LINE_NOT_FOUND_EXAMPLES,
    },
    {
      status: HttpStatus.CONFLICT,
      description: 'The commitment or line cannot be matched.',
      examples: MATCH_LINE_CONFLICT_EXAMPLES,
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid parameters or body.',
      examples: [VALIDATION_EXAMPLE],
    },
  )
  async matchLine(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() params: InvoiceLineParamDto,
    @Body() body: MatchCommitmentBodyDto,
  ) {
    try {
      return await this.matchService.match(actor, params.id, params.position, body.commitmentId);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }

  @Get(':id/commitment-matches')
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'invoiceCommitmentMatchesList', summary: 'List commitment matches of an invoice' })
  @ApiSuccessResponse(ListCommitmentMatchesResponseDto, {
    status: HttpStatus.OK,
    message: 'INVOICE.COMMITMENT_MATCHES_LISTED',
    description: 'Lists all commitment matches recorded for lines of this invoice.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance views commitment matches.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Invoice not found.',
      examples: [invoiceExample(new InvoiceNotFoundError())],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid parameters.',
      examples: [VALIDATION_EXAMPLE],
    },
  )
  async listMatches(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() params: InvoiceIdParamDto,
    @Query() query: ListCommitmentMatchesQueryDto,
  ) {
    try {
      return await this.matchService.listMatches(actor, params.id, query);
    } catch (error) {
      throw mapInvoiceError(error);
    }
  }
}
