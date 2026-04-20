import { applyDecorators } from '@nestjs/common';

const passthroughDecorator = () => applyDecorators();

export const ApiStandardErrorResponses = passthroughDecorator;
export const ApiOkEntityResponse = passthroughDecorator;
export const ApiCreatedEntityResponse = passthroughDecorator;
