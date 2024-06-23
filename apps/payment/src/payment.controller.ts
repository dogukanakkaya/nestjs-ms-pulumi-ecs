import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class PaymentController {
  constructor() { }

  @MessagePattern({ cmd: 'payment.getPayment' })
  getPayment(): string {
    return 'Hello from Payment Service!';
  }
}
