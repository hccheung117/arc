import { describe, it, expect } from "vitest";
import {
  AIError,
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderQuotaExceededError,
  ModelNotFoundError,
  ProviderServerError,
  ProviderInvalidRequestError,
  RequestCancelledError,
} from "../src/errors.js";

/**
 * Error Classification Tests
 *
 * Tests the error hierarchy and classification system.
 */
describe("Error Classification", () => {
  describe("AIError (Base Error)", () => {
    it("should be an instance of Error", () => {
      const error = new AIError("Test error");
      expect(error).toBeInstanceOf(Error);
    });

    it("should have default properties", () => {
      const error = new AIError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.isRetryable).toBe(false);
      expect(error.retryAfter).toBeUndefined();
      expect(error.statusCode).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it("should accept custom properties", () => {
      const cause = new Error("Root cause");
      const error = new AIError("Test error", {
        isRetryable: true,
        retryAfter: 60,
        statusCode: 500,
        cause,
      });

      expect(error.isRetryable).toBe(true);
      expect(error.retryAfter).toBe(60);
      expect(error.statusCode).toBe(500);
      expect(error.cause).toBe(cause);
    });

    it("should have proper name", () => {
      const error = new AIError("Test error");
      expect(error.name).toBe("AIError");
    });

    it("should capture stack trace", () => {
      const error = new AIError("Test error");
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("AIError");
    });
  });

  describe("ProviderAuthError", () => {
    it("should extend AIError", () => {
      const error = new ProviderAuthError("Auth failed");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ProviderAuthError);
    });

    it("should not be retryable", () => {
      const error = new ProviderAuthError("Auth failed");
      expect(error.isRetryable).toBe(false);
    });

    it("should have correct name", () => {
      const error = new ProviderAuthError("Auth failed");
      expect(error.name).toBe("ProviderAuthError");
    });

    it("should preserve message", () => {
      const error = new ProviderAuthError("Invalid API key");
      expect(error.message).toBe("Invalid API key");
    });

    it("should accept statusCode", () => {
      const error = new ProviderAuthError("Auth failed", { statusCode: 401 });
      expect(error.statusCode).toBe(401);
    });

    it("should accept cause", () => {
      const cause = new Error("Network error");
      const error = new ProviderAuthError("Auth failed", { cause });
      expect(error.cause).toBe(cause);
    });
  });

  describe("ProviderRateLimitError", () => {
    it("should extend AIError", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ProviderRateLimitError);
    });

    it("should be retryable by default", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded");
      expect(error.isRetryable).toBe(true);
    });

    it("should have correct name", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded");
      expect(error.name).toBe("ProviderRateLimitError");
    });

    it("should accept retryAfter", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded", {
        retryAfter: 120,
      });
      expect(error.retryAfter).toBe(120);
    });

    it("should accept statusCode", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded", {
        statusCode: 429,
      });
      expect(error.statusCode).toBe(429);
    });

    it("should preserve all metadata", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded", {
        statusCode: 429,
        retryAfter: 60,
        isRetryable: true,
      });

      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.isRetryable).toBe(true);
    });
  });

  describe("ProviderTimeoutError", () => {
    it("should extend AIError", () => {
      const error = new ProviderTimeoutError("Request timed out");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ProviderTimeoutError);
    });

    it("should be retryable by default", () => {
      const error = new ProviderTimeoutError("Request timed out");
      expect(error.isRetryable).toBe(true);
    });

    it("should have correct name", () => {
      const error = new ProviderTimeoutError("Request timed out");
      expect(error.name).toBe("ProviderTimeoutError");
    });

    it("should accept statusCode", () => {
      const error = new ProviderTimeoutError("Request timed out", { statusCode: 504 });
      expect(error.statusCode).toBe(504);
    });
  });

  describe("ProviderQuotaExceededError", () => {
    it("should extend AIError", () => {
      const error = new ProviderQuotaExceededError("Quota exceeded");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ProviderQuotaExceededError);
    });

    it("should not be retryable", () => {
      const error = new ProviderQuotaExceededError("Quota exceeded");
      expect(error.isRetryable).toBe(false);
    });

    it("should have correct name", () => {
      const error = new ProviderQuotaExceededError("Quota exceeded");
      expect(error.name).toBe("ProviderQuotaExceededError");
    });

    it("should accept statusCode", () => {
      const error = new ProviderQuotaExceededError("Quota exceeded", { statusCode: 403 });
      expect(error.statusCode).toBe(403);
    });
  });

  describe("ModelNotFoundError", () => {
    it("should extend AIError", () => {
      const error = new ModelNotFoundError("Model not found");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ModelNotFoundError);
    });

    it("should not be retryable", () => {
      const error = new ModelNotFoundError("Model not found");
      expect(error.isRetryable).toBe(false);
    });

    it("should have correct name", () => {
      const error = new ModelNotFoundError("Model not found");
      expect(error.name).toBe("ModelNotFoundError");
    });

    it("should accept statusCode", () => {
      const error = new ModelNotFoundError("Model not found", { statusCode: 404 });
      expect(error.statusCode).toBe(404);
    });
  });

  describe("ProviderServerError", () => {
    it("should extend AIError", () => {
      const error = new ProviderServerError("Server error");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ProviderServerError);
    });

    it("should be retryable by default", () => {
      const error = new ProviderServerError("Server error");
      expect(error.isRetryable).toBe(true);
    });

    it("should have correct name", () => {
      const error = new ProviderServerError("Server error");
      expect(error.name).toBe("ProviderServerError");
    });

    it("should accept statusCode", () => {
      const error = new ProviderServerError("Server error", { statusCode: 500 });
      expect(error.statusCode).toBe(500);
    });

    it("should handle various 5xx codes", () => {
      const error500 = new ProviderServerError("Error", { statusCode: 500 });
      const error502 = new ProviderServerError("Error", { statusCode: 502 });
      const error503 = new ProviderServerError("Error", { statusCode: 503 });

      expect(error500.statusCode).toBe(500);
      expect(error502.statusCode).toBe(502);
      expect(error503.statusCode).toBe(503);

      expect(error500.isRetryable).toBe(true);
      expect(error502.isRetryable).toBe(true);
      expect(error503.isRetryable).toBe(true);
    });
  });

  describe("ProviderInvalidRequestError", () => {
    it("should extend AIError", () => {
      const error = new ProviderInvalidRequestError("Invalid request");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(ProviderInvalidRequestError);
    });

    it("should not be retryable", () => {
      const error = new ProviderInvalidRequestError("Invalid request");
      expect(error.isRetryable).toBe(false);
    });

    it("should have correct name", () => {
      const error = new ProviderInvalidRequestError("Invalid request");
      expect(error.name).toBe("ProviderInvalidRequestError");
    });

    it("should accept statusCode", () => {
      const error = new ProviderInvalidRequestError("Invalid request", { statusCode: 400 });
      expect(error.statusCode).toBe(400);
    });

    it("should handle 413 (payload too large)", () => {
      const error = new ProviderInvalidRequestError("Payload too large", { statusCode: 413 });
      expect(error.statusCode).toBe(413);
      expect(error.isRetryable).toBe(false);
    });
  });

  describe("RequestCancelledError", () => {
    it("should extend AIError", () => {
      const error = new RequestCancelledError("Request cancelled");
      expect(error).toBeInstanceOf(AIError);
      expect(error).toBeInstanceOf(RequestCancelledError);
    });

    it("should not be retryable", () => {
      const error = new RequestCancelledError("Request cancelled");
      expect(error.isRetryable).toBe(false);
    });

    it("should have correct name", () => {
      const error = new RequestCancelledError("Request cancelled");
      expect(error.name).toBe("RequestCancelledError");
    });

    it("should accept cause", () => {
      const cause = new Error("Aborted");
      const error = new RequestCancelledError("Request cancelled", { cause });
      expect(error.cause).toBe(cause);
    });
  });

  describe("Error hierarchy and instanceof checks", () => {
    it("should allow instanceof checks for specific error types", () => {
      const errors = [
        new ProviderAuthError("Auth error"),
        new ProviderRateLimitError("Rate limit"),
        new ProviderTimeoutError("Timeout"),
        new ProviderQuotaExceededError("Quota"),
        new ModelNotFoundError("Not found"),
        new ProviderServerError("Server error"),
        new ProviderInvalidRequestError("Invalid"),
        new RequestCancelledError("Cancelled"),
      ];

      // All should be instances of AIError
      errors.forEach((error) => {
        expect(error).toBeInstanceOf(AIError);
      });

      // Each should be instance of its specific type
      expect(errors[0]).toBeInstanceOf(ProviderAuthError);
      expect(errors[1]).toBeInstanceOf(ProviderRateLimitError);
      expect(errors[2]).toBeInstanceOf(ProviderTimeoutError);
      expect(errors[3]).toBeInstanceOf(ProviderQuotaExceededError);
      expect(errors[4]).toBeInstanceOf(ModelNotFoundError);
      expect(errors[5]).toBeInstanceOf(ProviderServerError);
      expect(errors[6]).toBeInstanceOf(ProviderInvalidRequestError);
      expect(errors[7]).toBeInstanceOf(RequestCancelledError);

      // Cross-checks should fail
      expect(errors[0]).not.toBeInstanceOf(ProviderRateLimitError);
      expect(errors[1]).not.toBeInstanceOf(ProviderAuthError);
    });
  });

  describe("Retry semantics", () => {
    it("should classify retryable errors correctly", () => {
      const retryableErrors = [
        new ProviderRateLimitError("Rate limit"),
        new ProviderTimeoutError("Timeout"),
        new ProviderServerError("Server error"),
      ];

      retryableErrors.forEach((error) => {
        expect(error.isRetryable).toBe(true);
      });
    });

    it("should classify non-retryable errors correctly", () => {
      const nonRetryableErrors = [
        new ProviderAuthError("Auth error"),
        new ProviderQuotaExceededError("Quota"),
        new ModelNotFoundError("Not found"),
        new ProviderInvalidRequestError("Invalid"),
        new RequestCancelledError("Cancelled"),
      ];

      nonRetryableErrors.forEach((error) => {
        expect(error.isRetryable).toBe(false);
      });
    });

    it("should use default retryability for each error type", () => {
      // Retryable errors maintain their default
      const error1 = new ProviderServerError("Server error");
      expect(error1.isRetryable).toBe(true);

      // Non-retryable errors maintain their default
      const error2 = new ProviderAuthError("Auth error");
      expect(error2.isRetryable).toBe(false);

      // Base AIError can have custom retryability
      const error3 = new AIError("Custom error", { isRetryable: true });
      expect(error3.isRetryable).toBe(true);
    });
  });

  describe("Error metadata", () => {
    it("should preserve statusCode across all error types", () => {
      const errors = [
        new ProviderAuthError("Error", { statusCode: 401 }),
        new ProviderRateLimitError("Error", { statusCode: 429 }),
        new ProviderTimeoutError("Error", { statusCode: 504 }),
        new ProviderQuotaExceededError("Error", { statusCode: 403 }),
        new ModelNotFoundError("Error", { statusCode: 404 }),
        new ProviderServerError("Error", { statusCode: 500 }),
        new ProviderInvalidRequestError("Error", { statusCode: 400 }),
      ];

      expect(errors[0]?.statusCode).toBe(401);
      expect(errors[1]?.statusCode).toBe(429);
      expect(errors[2]?.statusCode).toBe(504);
      expect(errors[3]?.statusCode).toBe(403);
      expect(errors[4]?.statusCode).toBe(404);
      expect(errors[5]?.statusCode).toBe(500);
      expect(errors[6]?.statusCode).toBe(400);
    });

    it("should preserve retryAfter for rate limit errors", () => {
      const error = new ProviderRateLimitError("Rate limit", { retryAfter: 120 });
      expect(error.retryAfter).toBe(120);
    });

    it("should preserve cause chain", () => {
      const rootCause = new Error("Network failure");
      const intermediateCause = new AIError("Connection error", { cause: rootCause });
      const finalError = new ProviderTimeoutError("Request timed out", {
        cause: intermediateCause,
      });

      expect(finalError.cause).toBe(intermediateCause);
      expect((finalError.cause as AIError).cause).toBe(rootCause);
    });
  });

  describe("Error messages", () => {
    it("should preserve custom error messages", () => {
      const messages = [
        "Invalid API key provided",
        "Rate limit exceeded. Please try again later.",
        "Request timed out after 30 seconds",
        "Monthly quota exceeded",
        "Model 'gpt-5' not found",
        "Internal server error",
        "Invalid request: missing required field",
        "Request was cancelled by user",
      ];

      const errors = [
        new ProviderAuthError(messages[0]!),
        new ProviderRateLimitError(messages[1]!),
        new ProviderTimeoutError(messages[2]!),
        new ProviderQuotaExceededError(messages[3]!),
        new ModelNotFoundError(messages[4]!),
        new ProviderServerError(messages[5]!),
        new ProviderInvalidRequestError(messages[6]!),
        new RequestCancelledError(messages[7]!),
      ];

      errors.forEach((error, index) => {
        expect(error.message).toBe(messages[index]);
      });
    });

    it("should handle empty messages", () => {
      const error = new AIError("");
      expect(error.message).toBe("");
    });

    it("should handle very long messages", () => {
      const longMessage = "a".repeat(10000);
      const error = new AIError(longMessage);
      expect(error.message).toBe(longMessage);
    });
  });

  describe("Error serialization", () => {
    it("should be serializable to JSON", () => {
      const error = new ProviderRateLimitError("Rate limit exceeded", {
        statusCode: 429,
        retryAfter: 60,
      });

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        isRetryable: error.isRetryable,
        retryAfter: error.retryAfter,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);

      expect(parsed.name).toBe("ProviderRateLimitError");
      expect(parsed.message).toBe("Rate limit exceeded");
      expect(parsed.isRetryable).toBe(true);
      expect(parsed.retryAfter).toBe(60);
      expect(parsed.statusCode).toBe(429);
    });

    it("should handle undefined properties in serialization", () => {
      const error = new AIError("Simple error");

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        isRetryable: error.isRetryable,
        retryAfter: error.retryAfter,
        statusCode: error.statusCode,
      });

      const parsed = JSON.parse(serialized);

      // JSON.stringify omits undefined properties
      expect(parsed.name).toBe("AIError");
      expect(parsed.message).toBe("Simple error");
      expect(parsed.isRetryable).toBe(false);
      // undefined properties are omitted in JSON
      expect(parsed.retryAfter).toBeUndefined();
      expect(parsed.statusCode).toBeUndefined();
    });
  });

  describe("Error in catch blocks", () => {
    it("should be catchable with specific types", () => {
      const throwAuthError = () => {
        throw new ProviderAuthError("Auth failed");
      };

      const throwRateLimitError = () => {
        throw new ProviderRateLimitError("Rate limit");
      };

      // Catch specific error type
      try {
        throwAuthError();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderAuthError);
        expect(error).toBeInstanceOf(AIError);
        if (error instanceof ProviderAuthError) {
          expect(error.isRetryable).toBe(false);
        }
      }

      // Catch base AIError type
      try {
        throwRateLimitError();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AIError);
        if (error instanceof AIError) {
          expect(error.isRetryable).toBe(true);
        }
      }
    });

    it("should allow error type discrimination", () => {
      const handleError = (error: AIError): string => {
        if (error instanceof ProviderRateLimitError) {
          return `Retry after ${error.retryAfter || "unknown"} seconds`;
        } else if (error instanceof ProviderAuthError) {
          return "Check your API credentials";
        } else if (error instanceof ProviderTimeoutError) {
          return "Request timed out, please retry";
        } else if (error instanceof ProviderServerError) {
          return "Provider is experiencing issues";
        } else {
          return "An error occurred";
        }
      };

      expect(handleError(new ProviderRateLimitError("", { retryAfter: 60 }))).toBe(
        "Retry after 60 seconds"
      );
      expect(handleError(new ProviderAuthError(""))).toBe("Check your API credentials");
      expect(handleError(new ProviderTimeoutError(""))).toBe("Request timed out, please retry");
      expect(handleError(new ProviderServerError(""))).toBe("Provider is experiencing issues");
      expect(handleError(new ModelNotFoundError(""))).toBe("An error occurred");
    });
  });
});
