/**
 * Common error types for the application
 */

export interface PrismaErrorMeta {
  target?: string[];
  field_name?: string;
  model_name?: string;
}

export interface PrismaError extends Error {
  code?: string;
  clientVersion?: string;
  meta?: PrismaErrorMeta;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
}

export interface ValidationError extends Error {
  errors?: Record<string, string[]>;
  path?: string[];
}

export interface NetworkError extends Error {
  isNetworkError?: boolean;
}
