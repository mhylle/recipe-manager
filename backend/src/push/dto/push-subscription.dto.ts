import {
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

/** The `keys` object exactly as `PushSubscription.toJSON()` produces it. */
export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  auth: string;
}

export class SavePushSubscriptionDto {
  /**
   * Constrained to an https URL because it is handed to an outbound HTTP call.
   * Unvalidated, it is a request-forgery primitive pointing anywhere the backend
   * can reach, including inside the estate's own network.
   */
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class DeletePushSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(2048)
  endpoint: string;
}
