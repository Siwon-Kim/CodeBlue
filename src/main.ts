import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './commons/exceptions/http-exception.filter';
import { ConfigType } from '@nestjs/config';
import appConfig from '../config/app.config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useStaticAssets(join(__dirname, '../../', 'public'));
  app.setBaseViewsDir(join(__dirname, '../../', 'views'));
  app.setViewEngine('ejs');

  // global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // global HTTP exception filter
  app.useGlobalFilters(new HttpExceptionFilter()); // global filter

  // cors
  app.enableCors();

  // config
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  const port = config.port;
  await app.listen(port);
  if (config.mode === 'development')
    logger.log(`Server opened on port ${port}`);
}
bootstrap();
