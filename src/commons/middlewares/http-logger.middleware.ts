import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HTTPLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP'); // HTTP protocol logger
  use(req: Request, res: Response, next: NextFunction) {
    // when response is finished, print log
    res.on('finish', () => {
      this.logger.log(
        `${req.ip} ${req.method}, ${res.statusCode}`,
        req.originalUrl,
      );
    });
    next();
  }
}
