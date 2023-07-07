import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  protected cacheMethods = ['GET'];
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // Allow only GET request
    if (this.isRequestGet(context)) {
      const request = context.switchToHttp().getRequest();
      const cacheKey = this.generateCacheKey(request);
      console.log('cacheKey:', cacheKey);
      // check if cached data exists
      const cachedData = await this.cacheManager.get(cacheKey);
      if (cachedData) {
        console.log('Returning cached data.');
        return of(cachedData);
      }

      // If there is no cached data
      return next.handle().pipe(
        tap((data) => {
          console.log('Saving data in Redis.');
          this.cacheManager.set(cacheKey, data);
        }),
      );
    }
  }

  private generateCacheKey(request): string {
    // create unique key for Redis using request URL and query strings
    const reportId = request.params.report_id;
    const radius = request.query.radius;
    const maxCount = request.query.max_count;
    return `${reportId}:${radius}:${maxCount}`;
  }

  private isRequestGet(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    return this.cacheMethods.includes(req.method);
  }
}
