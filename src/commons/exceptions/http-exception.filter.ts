import { Catch, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter {
  catch(exception, host) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const error = exception.getResponse() as
      | string
      | { error: string; statusCode: number; message: string | string[] };

    // throw new HttpException() that we defined
    if (typeof error === 'string') {
      response.status(status).json({
        success: false,
        error,
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
    // error handling that Nest.js handles itself
    else {
      response.status(status).json({
        success: false,
        ...error,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
    }
  }
}
