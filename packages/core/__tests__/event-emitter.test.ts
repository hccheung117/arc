import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventEmitter } from "../src/shared/event-emitter.js";

/**
 * EventEmitter Tests
 *
 * Tests the EventEmitter utility for pub-sub functionality.
 */

describe("EventEmitter", () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  describe("on and emit", () => {
    it("should call handler when event is emitted", () => {
      const handler = vi.fn();
      emitter.on("test-event", handler);

      emitter.emit("test-event", { foo: "bar" });

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ foo: "bar" });
    });

    it("should call multiple handlers for the same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test-event", handler1);
      emitter.on("test-event", handler2);

      emitter.emit("test-event", { data: 123 });

      expect(handler1).toHaveBeenCalledWith({ data: 123 });
      expect(handler2).toHaveBeenCalledWith({ data: 123 });
    });

    it("should not call handler for different event", () => {
      const handler = vi.fn();
      emitter.on("event-a", handler);

      emitter.emit("event-b", { data: "test" });

      expect(handler).not.toHaveBeenCalled();
    });

    it("should handle emitting events with no listeners", () => {
      expect(() => {
        emitter.emit("nonexistent-event", { data: "test" });
      }).not.toThrow();
    });
  });

  describe("off", () => {
    it("should remove specific handler", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test-event", handler1);
      emitter.on("test-event", handler2);

      emitter.off("test-event", handler1);
      emitter.emit("test-event", { data: "test" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith({ data: "test" });
    });

    it("should handle removing non-existent handler", () => {
      const handler = vi.fn();

      expect(() => {
        emitter.off("test-event", handler);
      }).not.toThrow();
    });

    it("should handle removing handler for non-existent event", () => {
      const handler = vi.fn();

      expect(() => {
        emitter.off("nonexistent-event", handler);
      }).not.toThrow();
    });
  });

  describe("removeAllListeners", () => {
    it("should remove all listeners for specific event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("event-a", handler1);
      emitter.on("event-b", handler2);

      emitter.removeAllListeners("event-a");

      emitter.emit("event-a", { data: "test" });
      emitter.emit("event-b", { data: "test" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("should remove all listeners for all events when no event specified", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("event-a", handler1);
      emitter.on("event-b", handler2);

      emitter.removeAllListeners();

      emitter.emit("event-a", { data: "test" });
      emitter.emit("event-b", { data: "test" });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe("listenerCount", () => {
    it("should return 0 for event with no listeners", () => {
      expect(emitter.listenerCount("test-event")).toBe(0);
    });

    it("should return correct count after adding listeners", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test-event", handler1);
      emitter.on("test-event", handler2);

      expect(emitter.listenerCount("test-event")).toBe(2);
    });

    it("should return correct count after removing listener", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on("test-event", handler1);
      emitter.on("test-event", handler2);

      emitter.off("test-event", handler1);

      expect(emitter.listenerCount("test-event")).toBe(1);
    });
  });

  describe("error handling", () => {
    it("should continue calling other handlers if one throws", () => {
      const throwingHandler = vi.fn(() => {
        throw new Error("Handler error");
      });
      const normalHandler = vi.fn();

      // Spy on console.error to suppress error output
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      emitter.on("test-event", throwingHandler);
      emitter.on("test-event", normalHandler);

      emitter.emit("test-event", { data: "test" });

      expect(throwingHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("deduplication", () => {
    it("should not add the same handler twice", () => {
      const handler = vi.fn();

      emitter.on("test-event", handler);
      emitter.on("test-event", handler);

      // Set only stores unique references, so should only call once per emit
      emitter.emit("test-event", { data: "test" });

      // Since Set de-duplicates, handler should only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
