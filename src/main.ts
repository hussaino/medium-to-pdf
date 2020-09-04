import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import 'source-map-support/register';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const server = await app.listen(9100);
  server.setTimeout(1000000);
}
bootstrap();
