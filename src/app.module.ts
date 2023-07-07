import { Module, NestModule, MiddlewareConsumer, Inject } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { ReportsModule } from './reports/reports.module';
import { PatientsModule } from './patients/patients.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { RequestsModule } from './requests/requests.module';
import { MysqlConfigProvider } from './commons/providers/typeorm-config.provider';
import { HTTPLoggerMiddleware } from './commons/middlewares/http-logger.middleware';
import { ConfigValidator } from '../config/config.validator';
import { AppController } from './app.controller';
import appConfig from '../config/app.config';

@Module({
  imports: [
    ConfigModule.forRoot(ConfigValidator),
    TypeOrmModule.forRootAsync({
      useClass: MysqlConfigProvider,
    }),
    ScheduleModule.forRoot(),
    ReportsModule,
    HospitalsModule,
    RequestsModule,
    PatientsModule,
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  constructor(
    @Inject(appConfig.KEY) private config: ConfigType<typeof appConfig>,
  ) {}

  private readonly isDev: boolean =
    this.config.mode === 'development' ? true : false;

  // when dev mode, log HTTP request
  configure(consumer: MiddlewareConsumer) {
    if (this.isDev) {
      consumer.apply(HTTPLoggerMiddleware).forRoutes('*');
    }
  }
}
