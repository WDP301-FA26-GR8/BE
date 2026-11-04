import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorResponses,
  FORBIDDEN_EXAMPLE,
  GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
  UNAUTHENTICATED_RESPONSE,
} from '../../../infrastructure/http/decorators/api-error-responses.decorator';
import { ApiSuccessResponse } from '../../../infrastructure/http/decorators/api-success-response.decorator';
import { RequireRoles } from '../../../infrastructure/security/decorators/access.decorators';
import { CurrentPrincipal } from '../../../infrastructure/security/models/current-principal';
import type { AuthenticatedPrincipal } from '../../../infrastructure/security/tokens/access-token-verifier.port';
import {
  CancelInternalCostBodyDto,
  CancelInternalCostResponseDto,
  InternalCostDetailResponseDto,
  InternalCostIdParamDto,
  ListInternalCostsQueryDto,
  ListInternalCostsResponseDto,
  RecordInternalCostBodyDto,
  RecordInternalCostResponseDto,
} from './internal-cost.dto';
import { INTERNAL_COST_ERROR_EXAMPLES, toInternalCostApiException } from './internal-cost.http-errors';
import { InternalCostQueryService } from './internal-cost-query.service';
import { InternalCostService } from './internal-cost.service';

@ApiTags('internal-costs')
@Controller({ path: 'internal-costs', version: '1' })
export class InternalCostsController {
  constructor(
    private readonly service: InternalCostService,
    private readonly queryService: InternalCostQueryService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'internalCostRecord', summary: 'Record internal software cost' })
  @ApiBody({ type: RecordInternalCostBodyDto })
  @ApiSuccessResponse(RecordInternalCostResponseDto, {
    status: HttpStatus.CREATED,
    message: 'INTERNAL_COST.RECORDED',
    description: 'Internal software cost recorded atomically without invoice or commitment.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance records internal costs.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'The Cost Center or Application does not exist.',
      examples: [
        INTERNAL_COST_ERROR_EXAMPLES.COST_CENTER_NOT_FOUND,
        INTERNAL_COST_ERROR_EXAMPLES.APPLICATION_NOT_FOUND,
      ],
    },
    {
      status: HttpStatus.CONFLICT,
      description: 'Exchange rate missing or cost center inactive.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.RATE_MISSING, INTERNAL_COST_ERROR_EXAMPLES.COST_CENTER_INACTIVE],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Validation failed, cost center invalid, or software not internal.',
      examples: [
        INTERNAL_COST_ERROR_EXAMPLES.VALIDATION_ERROR,
        INTERNAL_COST_ERROR_EXAMPLES.COST_CENTER_INVALID,
        INTERNAL_COST_ERROR_EXAMPLES.APPLICATION_NOT_INTERNAL,
      ],
    },
  )
  async record(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Body() body: RecordInternalCostBodyDto) {
    try {
      const data = await this.service.record(actor, body);
      return data;
    } catch (error) {
      throw toInternalCostApiException(error);
    }
  }

  @Get()
  @RequireRoles('FINANCE', 'DEPARTMENT_HEAD')
  @ApiOperation({ operationId: 'internalCostList', summary: 'List internal software costs' })
  @ApiSuccessResponse(ListInternalCostsResponseDto, {
    status: HttpStatus.OK,
    message: 'INTERNAL_COST.LISTED',
    description: 'List of internal software costs; department heads only see their own department cost centers.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    { status: HttpStatus.FORBIDDEN, description: 'Forbidden role.', examples: [FORBIDDEN_EXAMPLE] },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid query.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.VALIDATION_ERROR],
    },
  )
  async list(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Query() query: ListInternalCostsQueryDto) {
    try {
      return await this.queryService.list(actor, query);
    } catch (error) {
      throw toInternalCostApiException(error);
    }
  }

  @Get(':id')
  @RequireRoles('FINANCE', 'DEPARTMENT_HEAD')
  @ApiOperation({ operationId: 'internalCostGet', summary: 'Get internal software cost details' })
  @ApiSuccessResponse(InternalCostDetailResponseDto, {
    status: HttpStatus.OK,
    message: 'INTERNAL_COST.RETRIEVED',
    description:
      'Internal software cost details; department heads only access entries of their own department cost centers.',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    { status: HttpStatus.FORBIDDEN, description: 'Forbidden role or department scope.', examples: [FORBIDDEN_EXAMPLE] },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Internal cost not found.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.NOT_FOUND],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid internal cost ID.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.VALIDATION_ERROR],
    },
  )
  async getById(@CurrentPrincipal() actor: AuthenticatedPrincipal, @Param() param: InternalCostIdParamDto) {
    try {
      return await this.queryService.getById(actor, param.id);
    } catch (error) {
      throw toInternalCostApiException(error);
    }
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequireRoles('FINANCE')
  @ApiOperation({ operationId: 'internalCostCancel', summary: 'Cancel an internal software cost entry' })
  @ApiBody({ type: CancelInternalCostBodyDto })
  @ApiSuccessResponse(CancelInternalCostResponseDto, {
    status: HttpStatus.OK,
    message: 'INTERNAL_COST.CANCELLED',
    description: 'Cancel an internal cost entry with a reason (OQ-F-10 / LD-11).',
  })
  @ApiErrorResponses(
    UNAUTHENTICATED_RESPONSE,
    GUARDED_SERVICE_UNAVAILABLE_RESPONSE,
    {
      status: HttpStatus.FORBIDDEN,
      description: 'Only Finance cancels internal costs.',
      examples: [FORBIDDEN_EXAMPLE],
    },
    {
      status: HttpStatus.NOT_FOUND,
      description: 'Internal cost not found.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.NOT_FOUND],
    },
    {
      status: HttpStatus.CONFLICT,
      description: 'Already cancelled.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.ALREADY_CANCELLED],
    },
    {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      description: 'Invalid internal cost ID or cancellation reason.',
      examples: [INTERNAL_COST_ERROR_EXAMPLES.VALIDATION_ERROR],
    },
  )
  async cancel(
    @CurrentPrincipal() actor: AuthenticatedPrincipal,
    @Param() param: InternalCostIdParamDto,
    @Body() body: CancelInternalCostBodyDto,
  ) {
    try {
      return await this.service.cancel(actor, param.id, body);
    } catch (error) {
      throw toInternalCostApiException(error);
    }
  }
}
