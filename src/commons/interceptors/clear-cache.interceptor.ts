import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class ClearCacheInterceptor implements NestInterceptor {
  protected clearCacheMethods = ['POST', 'DELETE'];
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    if (this.isRequestPostOrDelete(context)) {
      const request = context.switchToHttp().getRequest();
      // 1. pass report_id to the method
      await this.clearCacheKeysStartingWith(request.params.report_id);
    }
    return next.handle();
  }

  private async clearCacheKeysStartingWith(reportId: string): Promise<void> {
    const cacheKeys = await this.getCacheKeysStartingWith(reportId);
    // 4. map all filtered keys to delete from Redis
    await Promise.all(cacheKeys.map((key) => this.cacheManager.del(key)));
  }

  private async getCacheKeysStartingWith(prefix: string): Promise<string[]> {
    // 2. get all keys in Redis
    const cacheKeys = await this.cacheManager.store.keys('*');
    // 3. filter keys that starts with report_id: of all keys
    return cacheKeys.filter((key) => key.startsWith(`${prefix}:`));
  }

  private isRequestPostOrDelete(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    return this.clearCacheMethods.includes(req.method);
  }
}
