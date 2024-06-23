import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

@Controller()
export class OrderController {
  constructor() {}

  @MessagePattern({ cmd: 'order.getOrder' })
  getOrder(): string {
    return 'Hello from Order Service!';
  }
}
