import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    return next.handle().pipe(
      map((data) => {
        // If response already has success field, return as is
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // Extract message if present
        const message = data?.message;
        
        // Remove message from data if it exists
        if (data && typeof data === 'object' && 'message' in data) {
          const { message: _, ...rest } = data;
          return {
            success: true,
            data: rest,
            ...(message && { message }),
            timestamp: new Date().toISOString(),
          };
        }

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
