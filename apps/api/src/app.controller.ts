import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller()
export class AppController {
  constructor(
    @Inject('PAYMENT_SERVICE') private paymentClient: ClientProxy,
    @Inject('ORDER_SERVICE') private orderClient: ClientProxy,
  ) { }

  @Get('health')
  getHealth() {
    return { status: 'ok', env: process.env.NODE_ENV };
  }

  @Get('payment')
  getPayment() {
    return this.paymentClient.send({ cmd: 'payment.getPayment' }, {});
  }

  @Get('order')
  getOrder() {
    return this.orderClient.send({ cmd: 'order.getOrder' }, {});
  }
}
