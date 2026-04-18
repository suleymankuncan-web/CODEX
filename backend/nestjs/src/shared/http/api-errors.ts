import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

export function resourceNotFound(message: string) {
  return new NotFoundException(message);
}

export function stateConflict(message: string) {
  return new ConflictException(message);
}

export function semanticValidation(message: string) {
  return new UnprocessableEntityException(message);
}
